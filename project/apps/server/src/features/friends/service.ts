/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import { attachmentSchema, truncateGraphemes, type Locale } from "@echoverse/contracts";
import type { Account, StoredDm } from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";

export type MemoryFriendship = {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt: string;
};

export type FriendshipRelationship =
  "none" | "pending_incoming" | "pending_outgoing" | "friends" | "blocked";

export type FriendServiceDependencies = {
  pool: PersistenceDatabase | null;
  sqliteDatabase: PersistenceDatabase | null;
  memoryAccounts: Map<string, Account>;
  memoryFriendships: Map<string, MemoryFriendship>;
  memoryDmMessages: StoredDm[];
  publicUserById(id: string): Promise<{
    id: string;
    username: string;
    avatarData: string | null;
  } | null>;
};

export function createFriendService({
  pool,
  sqliteDatabase,
  memoryAccounts,
  memoryFriendships,
  memoryDmMessages,
  publicUserById
}: FriendServiceDependencies) {
  function friendshipKey(a: string, b: string) {
    return [a, b].sort().join(":");
  }

  function parseReactions(value: unknown): Record<string, string[]> {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    const reactions: Record<string, string[]> = {};
    for (const [emoji, accountIds] of Object.entries(value)) {
      if (!Array.isArray(accountIds)) continue;
      const validAccountIds = accountIds.filter(
        (accountId): accountId is string => typeof accountId === "string" && accountId.length <= 128
      );
      if (validAccountIds.length) reactions[emoji] = validAccountIds;
    }
    return reactions;
  }

  async function findUsersByUsername(query: string, selfId: string, locale: Locale) {
    const clean = truncateGraphemes(String(query || "").trim(), 40).toLocaleLowerCase(
      locale === "tr" ? "tr-TR" : "en-US"
    );
    if (!clean) return [];

    if (!pool) {
      const results = [...memoryAccounts.values()]
        .filter(
          (account) =>
            account.id !== selfId &&
            account.username.toLocaleLowerCase(locale === "tr" ? "tr-TR" : "en-US").includes(clean)
        )
        .slice(0, 20)
        .map((account) => {
          const friendship = memoryFriendships.get(friendshipKey(selfId, account.id)) || null;
          return {
            id: account.id,
            username: account.username,
            avatarData: account.avatarData,
            friendshipId: friendship?.id,
            relationship: relationshipFor(friendship, selfId, account.id)
          };
        });
      return results;
    }

    const searchPattern = `%${clean.replace(/[\\%_]/g, "\\$&")}%`;
    const result = await pool.query(
      pool === sqliteDatabase
        ? `SELECT id, username, avatar_data
           FROM echoverse_users
           WHERE id <> $1 AND echoverse_search_key(username, $2) LIKE $3 ESCAPE '\\'
           ORDER BY username
           LIMIT 20`
        : `SELECT id, username, avatar_data
           FROM echoverse_users
           WHERE id <> $1 AND LOWER(username) LIKE $2 ESCAPE '\\'
           ORDER BY username
           LIMIT 20`,
      pool === sqliteDatabase ? [selfId, locale, searchPattern] : [selfId, searchPattern]
    );

    return Promise.all(
      result.rows.map(async (row) => {
        const friendship = await friendshipBetween(selfId, String(row.id));
        return {
          id: row.id,
          username: row.username,
          avatarData: row.avatar_data || null,
          friendshipId: friendship?.id,
          relationship: relationshipFor(friendship, selfId, String(row.id))
        };
      })
    );
  }

  function relationshipFor(
    friendship: {
      requester_id?: string;
      addressee_id?: string;
      status?: string;
      requesterId?: string;
      addresseeId?: string;
    } | null,
    selfId: string,
    otherId: string
  ): FriendshipRelationship {
    if (!friendship) return "none";
    const requesterId = friendship.requester_id ?? friendship.requesterId;
    const addresseeId = friendship.addressee_id ?? friendship.addresseeId;
    if (friendship.status === "accepted") return "friends";
    if (friendship.status === "blocked") return requesterId === selfId ? "blocked" : "none";
    if (friendship.status === "pending") {
      return requesterId === selfId
        ? "pending_outgoing"
        : addresseeId === selfId
          ? "pending_incoming"
          : "none";
    }
    return "none";
  }

  async function friendshipBetween(a: string, b: string) {
    if (!pool) return memoryFriendships.get(friendshipKey(a, b)) || null;

    const result = await pool.query(
      `SELECT id, requester_id, addressee_id, status, created_at
       FROM echoverse_friendships
       WHERE
         (requester_id = $1 AND addressee_id = $2)
         OR
         (requester_id = $2 AND addressee_id = $1)
       LIMIT 1`,
      [a, b]
    );

    return result.rows[0] || null;
  }

  async function listFriendState(accountId: string) {
    if (!pool) {
      const accepted: any[] = [];
      const incoming: any[] = [];
      const outgoing: any[] = [];

      for (const friendship of memoryFriendships.values()) {
        if (
          friendship.status === "accepted" &&
          (friendship.requesterId === accountId || friendship.addresseeId === accountId)
        ) {
          const otherId =
            friendship.requesterId === accountId ? friendship.addresseeId : friendship.requesterId;
          const other = await publicUserById(otherId);
          if (other) accepted.push(other);
        } else if (friendship.status === "pending" && friendship.addresseeId === accountId) {
          const other = await publicUserById(friendship.requesterId);
          if (other) incoming.push({ ...other, friendshipId: friendship.id });
        } else if (friendship.status === "pending" && friendship.requesterId === accountId) {
          const other = await publicUserById(friendship.addresseeId);
          if (other) outgoing.push({ ...other, friendshipId: friendship.id });
        }
      }

      return { accepted, incoming, outgoing };
    }

    const result = await pool.query(
      `SELECT f.id, f.requester_id, f.addressee_id, f.status,
              u1.username AS requester_username,
              u1.avatar_data AS requester_avatar,
              u2.username AS addressee_username,
              u2.avatar_data AS addressee_avatar
       FROM echoverse_friendships f
       JOIN echoverse_users u1 ON u1.id = f.requester_id
       JOIN echoverse_users u2 ON u2.id = f.addressee_id
       WHERE f.requester_id = $1 OR f.addressee_id = $1`,
      [accountId]
    );

    const accepted: any[] = [];
    const incoming: any[] = [];
    const outgoing: any[] = [];

    for (const row of result.rows) {
      if (row.status === "accepted") {
        if (row.requester_id === accountId) {
          accepted.push({
            id: row.addressee_id,
            username: row.addressee_username,
            avatarData: row.addressee_avatar || null
          });
        } else {
          accepted.push({
            id: row.requester_id,
            username: row.requester_username,
            avatarData: row.requester_avatar || null
          });
        }
      } else if (row.status === "pending" && row.addressee_id === accountId) {
        incoming.push({
          id: row.requester_id,
          username: row.requester_username,
          avatarData: row.requester_avatar || null,
          friendshipId: row.id
        });
      } else if (row.status === "pending" && row.requester_id === accountId) {
        outgoing.push({
          id: row.addressee_id,
          username: row.addressee_username,
          avatarData: row.addressee_avatar || null,
          friendshipId: row.id
        });
      }
    }

    return { accepted, incoming, outgoing };
  }

  async function areFriends(a: string, b: string) {
    const friendship = await friendshipBetween(a, b);
    return friendship?.status === "accepted";
  }

  async function storeDm(
    senderId: string,
    recipientId: string,
    body: string,
    options: {
      replyToId?: string | null;
      attachmentName?: string | null;
      attachmentMime?: string | null;
      attachmentData?: string | null;
    } = {}
  ) {
    const message: StoredDm = {
      id: crypto.randomUUID(),
      senderId,
      recipientId,
      body,
      createdAt: new Date().toISOString(),
      replyToId: options.replyToId || null,
      editedAt: null,
      deletedAt: null,
      attachmentName: options.attachmentName || null,
      attachmentMime: options.attachmentMime || null,
      attachmentData: options.attachmentData || null,
      reactions: {}
    };

    if (!pool) {
      memoryDmMessages.push(message);
      return message;
    }

    await pool.query(
      `INSERT INTO echoverse_dm_messages
        (
          id, sender_id, recipient_id, body, created_at,
          reply_to_id, attachment_name, attachment_mime, attachment_data, reactions
        )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
      [
        message.id,
        senderId,
        recipientId,
        body,
        message.createdAt,
        message.replyToId,
        message.attachmentName,
        message.attachmentMime,
        message.attachmentData,
        JSON.stringify(message.reactions)
      ]
    );

    return message;
  }

  async function loadDmHistory(a: string, b: string) {
    if (!pool) {
      return memoryDmMessages
        .filter(
          (message) =>
            (message.senderId === a && message.recipientId === b) ||
            (message.senderId === b && message.recipientId === a)
        )
        .slice(-200);
    }

    const result = await pool.query(
      `SELECT
         id, sender_id, recipient_id, body, created_at,
         reply_to_id, edited_at, deleted_at,
         attachment_name, attachment_mime, attachment_data, reactions
       FROM (
         SELECT
           id, sender_id, recipient_id, body, created_at,
           reply_to_id, edited_at, deleted_at,
           attachment_name, attachment_mime, attachment_data, reactions
         FROM echoverse_dm_messages
         WHERE
           (sender_id = $1 AND recipient_id = $2)
           OR
           (sender_id = $2 AND recipient_id = $1)
         ORDER BY created_at DESC
         LIMIT 200
       ) q
       ORDER BY created_at ASC`,
      [a, b]
    );

    return result.rows.map((row) => ({
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      body: row.deleted_at ? "" : row.body,
      createdAt: row.created_at?.toISOString?.() || String(row.created_at),
      replyToId: row.reply_to_id || null,
      editedAt: row.edited_at?.toISOString?.() || row.edited_at || null,
      deletedAt: row.deleted_at?.toISOString?.() || row.deleted_at || null,
      attachmentName: row.deleted_at ? null : row.attachment_name || null,
      attachmentMime: row.deleted_at ? null : row.attachment_mime || null,
      attachmentData: row.deleted_at ? null : row.attachment_data || null,
      reactions: parseReactions(row.reactions)
    }));
  }

  async function dmById(messageId: string): Promise<StoredDm | null> {
    if (!pool) return memoryDmMessages.find((message) => message.id === messageId) || null;

    const result = await pool.query(
      `SELECT
        id, sender_id, recipient_id, body, created_at,
        reply_to_id, edited_at, deleted_at,
        attachment_name, attachment_mime, attachment_data, reactions
       FROM echoverse_dm_messages
       WHERE id=$1 LIMIT 1`,
      [messageId]
    );

    const row = result.rows[0];
    if (!row) return null;

    return {
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      body: row.deleted_at ? "" : row.body,
      createdAt: row.created_at?.toISOString?.() || String(row.created_at),
      replyToId: row.reply_to_id || null,
      editedAt: row.edited_at?.toISOString?.() || row.edited_at || null,
      deletedAt: row.deleted_at?.toISOString?.() || row.deleted_at || null,
      attachmentName: row.deleted_at ? null : row.attachment_name || null,
      attachmentMime: row.deleted_at ? null : row.attachment_mime || null,
      attachmentData: row.deleted_at ? null : row.attachment_data || null,
      reactions: parseReactions(row.reactions)
    };
  }

  type ValidatedAttachment = ReturnType<typeof attachmentSchema.parse>;
  type AttachmentValidation =
    | { ok: true; value: ValidatedAttachment | null }
    | { ok: false; errorKey: "server.attachmentInvalid" };

  function validateAttachment(input: any): AttachmentValidation {
    if (!input) return { ok: true, value: null };

    const parsed = attachmentSchema.safeParse({
      name: input.name,
      mime: input.mime || "application/octet-stream",
      data: input.data
    });
    if (!parsed.success) return { ok: false, errorKey: "server.attachmentInvalid" };

    return { ok: true, value: parsed.data };
  }

  return {
    areFriends,
    dmById,
    findUsersByUsername,
    friendshipBetween,
    friendshipKey,
    relationshipFor,
    listFriendState,
    loadDmHistory,
    parseReactions,
    storeDm,
    validateAttachment
  };
}
