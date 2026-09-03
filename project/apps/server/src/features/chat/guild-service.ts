/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import type { StoredGuildMessage } from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";

export type GuildMessageSearchOptions = {
  authorId?: string;
  from?: string;
  to?: string;
  before?: string;
};

export function createGuildChatService(
  pool: PersistenceDatabase | null,
  memoryMessages: StoredGuildMessage[] = []
) {
  function parse(value: unknown): Record<string, string[]> {
    if (typeof value === "string") {
      try {
        value = JSON.parse(value);
      } catch {
        return {};
      }
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, ids]) => Array.isArray(ids))
        .map(([emoji, ids]) => [
          emoji.slice(0, 12),
          (ids as unknown[]).filter(
            (id): id is string => typeof id === "string" && id.length <= 128
          )
        ])
    );
  }

  function fromRow(row: Record<string, any>): StoredGuildMessage {
    return {
      id: String(row.id),
      guildId: String(row.guild_id),
      channelId: String(row.channel_id),
      senderId: String(row.sender_id),
      body: row.deleted_at ? "" : String(row.body),
      createdAt: row.created_at?.toISOString?.() || String(row.created_at),
      replyToId: row.reply_to_id || null,
      editedAt: row.edited_at?.toISOString?.() || row.edited_at || null,
      deletedAt: row.deleted_at?.toISOString?.() || row.deleted_at || null,
      pinned: Boolean(row.pinned),
      reactions: parse(row.reactions)
    };
  }

  async function store(
    message: Omit<StoredGuildMessage, "id" | "createdAt" | "reactions" | "pinned">
  ) {
    const value: StoredGuildMessage = {
      ...message,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      pinned: false,
      reactions: {}
    };
    if (!pool) {
      memoryMessages.push(value);
      return value;
    }
    await pool.query(
      `INSERT INTO echoverse_guild_messages (id,guild_id,channel_id,sender_id,body,created_at,reply_to_id,reactions)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        value.id,
        value.guildId,
        value.channelId,
        value.senderId,
        value.body,
        value.createdAt,
        value.replyToId || null,
        "{}"
      ]
    );
    return value;
  }

  async function history(channelId: string, limit = 100) {
    if (!pool) return memoryMessages.filter((m) => m.channelId === channelId).slice(-limit);
    const result = await pool.query(
      `SELECT id,guild_id,channel_id,sender_id,body,created_at,reply_to_id,edited_at,deleted_at,pinned,reactions
       FROM echoverse_guild_messages WHERE channel_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [channelId, limit]
    );
    return result.rows.reverse().map(fromRow);
  }

  async function search(
    channelId: string,
    query: string,
    limit = 100,
    options: GuildMessageSearchOptions = {}
  ) {
    if (!pool)
      return memoryMessages
        .filter(
          (m) =>
            m.channelId === channelId &&
            !m.deletedAt &&
            m.body.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
            (!options.authorId || m.senderId === options.authorId) &&
            (!options.from || m.createdAt >= options.from) &&
            (!options.to || m.createdAt <= options.to) &&
            (!options.before || m.createdAt < options.before)
        )
        .sort((a, b) => {
          const created = b.createdAt.localeCompare(a.createdAt);
          return created || b.id.localeCompare(a.id);
        })
        .slice(0, limit);
    const values: unknown[] = [channelId, `%${query.trim().replace(/[\\%_]/g, "\\$&")}%`];
    const clauses = [
      "channel_id=$1",
      "deleted_at IS NULL",
      "LOWER(body) LIKE LOWER($2) ESCAPE '\\'"
    ];
    const add = (clause: string, value: unknown) => {
      values.push(value);
      clauses.push(clause.replace("$N", `$${values.length}`));
    };
    if (options.authorId) add("sender_id=$N", options.authorId);
    if (options.from) add("created_at >= $N", options.from);
    if (options.to) add("created_at <= $N", options.to);
    if (options.before) add("created_at < $N", options.before);
    values.push(limit);
    const result = await pool.query(
      `SELECT id,guild_id,channel_id,sender_id,body,created_at,reply_to_id,edited_at,deleted_at,pinned,reactions
       FROM echoverse_guild_messages WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC, id DESC LIMIT $${values.length}`,
      values
    );
    return result.rows.map(fromRow);
  }

  async function byId(id: string) {
    if (!pool) return memoryMessages.find((m) => m.id === id) || null;
    const result = await pool.query(
      `SELECT id,guild_id,channel_id,sender_id,body,created_at,reply_to_id,edited_at,deleted_at,pinned,reactions FROM echoverse_guild_messages WHERE id=$1 LIMIT 1`,
      [id]
    );
    return result.rows[0] ? fromRow(result.rows[0]) : null;
  }

  async function update(
    id: string,
    changes: {
      body?: string;
      deletedAt?: string | null;
      pinned?: boolean;
      reactions?: Record<string, string[]>;
    }
  ) {
    const message = await byId(id);
    if (!message) return null;
    const updated = {
      ...message,
      ...changes,
      ...(changes.body !== undefined ? { editedAt: new Date().toISOString() } : {})
    };
    if (!pool) {
      const index = memoryMessages.findIndex((m) => m.id === id);
      if (index >= 0) memoryMessages[index] = updated;
      return updated;
    }
    await pool.query(
      `UPDATE echoverse_guild_messages SET body=$1,edited_at=$2,deleted_at=$3,pinned=$4,reactions=$5 WHERE id=$6`,
      [
        updated.body,
        updated.editedAt || null,
        updated.deletedAt || null,
        updated.pinned ? 1 : 0,
        JSON.stringify(updated.reactions || {}),
        id
      ]
    );
    return updated;
  }

  return { byId, history, parse, search, store, update };
}
