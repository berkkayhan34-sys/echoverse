/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import { socketEventPayloadSchemas, type Locale } from "@echoverse/contracts";
import type { Account, StoredDm, StoredDmReport, StoredDmRequest, User } from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";
import type { MemoryFriendship } from "./service.js";
import { serverLogger } from "../../runtime/observability.js";

type SocketEventName = keyof typeof socketEventPayloadSchemas;

export type FriendHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  pool: PersistenceDatabase | null;
  memoryFriendships: Map<string, MemoryFriendship>;
  memoryDmMessages: StoredDm[];
  dmReadAt: Map<string, number>;
  accountById(id: string): Promise<Account | null>;
  findUsersByUsername(query: string, selfId: string, locale: Locale): Promise<unknown[]>;
  listFriendState(accountId: string): Promise<unknown>;
  listConversations(accountId: string): Promise<unknown>;
  listDmPreferences(accountId: string): Promise<{
    privacy: { allowNonFriendRequests: boolean };
    peers: Array<{ peerId: string; muted: boolean; archived: boolean }>;
  }>;
  getDmPrivacy(accountId: string): Promise<{ allowNonFriendRequests: boolean }>;
  updateDmPrivacy(
    accountId: string,
    allowNonFriendRequests: boolean
  ): Promise<{ accountId: string; allowNonFriendRequests: boolean; updatedAt: string }>;
  updateDmPeerPreference(
    accountId: string,
    peerId: string,
    updates: { muted?: boolean; archived?: boolean }
  ): Promise<{ peerId: string; muted: boolean; archived: boolean } | null>;
  listDmRequests(accountId: string): Promise<{ incoming: any[]; outgoing: any[] }>;
  createDmRequest(
    senderId: string,
    recipientId: string,
    body: string
  ): Promise<{ created: boolean; request: StoredDmRequest }>;
  dmRequestBetween(senderId: string, recipientId: string): Promise<StoredDmRequest | null>;
  updateDmRequestStatus(
    accountId: string,
    requestId: string,
    status: "declined" | "spam"
  ): Promise<StoredDmRequest | null>;
  acceptDmRequest(
    accountId: string,
    requestId: string
  ): Promise<{ request: StoredDmRequest; message: StoredDm } | null>;
  conversationFor(accountId: string, conversationId: string): Promise<any>;
  conversationMembers(conversationId: string): Promise<any[]>;
  createGroupConversation(createdBy: string, memberIds: string[], name?: string): Promise<any>;
  loadConversationHistory(conversationId: string): Promise<StoredDm[]>;
  mutateGroupMember(
    actorId: string,
    conversationId: string,
    targetId: string,
    action: "add" | "remove" | "promote"
  ): Promise<{ ok: boolean; error?: string }>;
  leaveGroupConversation(
    accountId: string,
    conversationId: string
  ): Promise<{ ok: boolean; error?: string }>;
  friendshipBetween(a: string, b: string): Promise<any>;
  friendshipKey(a: string, b: string): string;
  areFriends(a: string, b: string): Promise<boolean>;
  loadDmHistory(a: string, b: string): Promise<StoredDm[]>;
  searchDm(
    accountId: string,
    target: { friendId?: string; conversationId?: string },
    query: string,
    limit?: number,
    options?: { authorId?: string; from?: string; to?: string; before?: string }
  ): Promise<StoredDm[]>;
  storeDm(
    senderId: string,
    recipientId: string,
    body: string,
    options?: Record<string, unknown>
  ): Promise<StoredDm>;
  dmById(messageId: string): Promise<StoredDm | null>;
  createDmReport(
    reporterId: string,
    targetId: string,
    messageId: string | null,
    reason: string
  ): Promise<{ created: boolean; report: StoredDmReport } | null>;
  validateAttachment(input: any): any;
  socketForAccount(accountId: string): User | undefined;
  emitToAccount(accountId: string, event: string, payload: any): void;
  emitDmPair(message: StoredDm, event: string, payload: any): void;
  resolveRequestLocale(value: unknown): Locale;
  sanitizeText(value: unknown): string;
  allowSocketEvent(socketId: string, event: string, limit: number): boolean;
  socketError(socket: any, key: string): string;
  onValidatedSocketEvent(
    socket: any,
    event: SocketEventName,
    handler: (payload: any, callback?: (response: unknown) => void) => unknown
  ): void;
};

export function registerFriendHandlers({
  socket,
  io,
  users,
  pool,
  memoryFriendships,
  memoryDmMessages,
  dmReadAt,
  accountById,
  findUsersByUsername,
  listFriendState,
  listConversations,
  listDmPreferences,
  getDmPrivacy,
  updateDmPrivacy,
  updateDmPeerPreference,
  listDmRequests,
  createDmRequest,
  dmRequestBetween,
  updateDmRequestStatus,
  acceptDmRequest,
  conversationFor,
  conversationMembers,
  createGroupConversation,
  loadConversationHistory,
  mutateGroupMember,
  leaveGroupConversation,
  friendshipBetween,
  friendshipKey,
  areFriends,
  loadDmHistory,
  searchDm,
  storeDm,
  createDmReport,
  dmById,
  validateAttachment,
  socketForAccount,
  emitToAccount,
  emitDmPair,
  resolveRequestLocale,
  sanitizeText,
  allowSocketEvent,
  socketError,
  onValidatedSocketEvent
}: FriendHandlerDependencies) {
  function isFriendshipConflict(error: unknown) {
    const code = String((error as { code?: unknown })?.code || "");
    return (
      code === "23505" ||
      code === "SQLITE_CONSTRAINT_UNIQUE" ||
      /unique|duplicate/i.test(String(error))
    );
  }

  async function emitConversation(conversationId: string, event: string, payload: unknown) {
    for (const member of await conversationMembers(conversationId)) {
      emitToAccount(member.accountId, event, payload);
    }
  }

  async function decorateGroupMessages(messages: StoredDm[]) {
    return Promise.all(
      messages.map(async (message) => {
        const sender = await accountById(message.senderId);
        return {
          ...message,
          senderUsername: sender?.username || "",
          senderAvatarData: sender?.avatarData || null
        };
      })
    );
  }

  onValidatedSocketEvent(socket, "friends:search", async ({ query }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }

    try {
      const results = await findUsersByUsername(
        query,
        user.accountId,
        resolveRequestLocale(socket.data.locale)
      );
      callback?.({ ok: true, results });
    } catch {
      serverLogger.error("echoverse.friends.search_failed");
      callback?.({ ok: false, error: socketError(socket, "server.userSearchFailed") });
    }
  });

  onValidatedSocketEvent(socket, "friends:list", async (_payload, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }

    try {
      callback?.({ ok: true, ...((await listFriendState(user.accountId)) as object) });
    } catch {
      serverLogger.error("echoverse.friends.list_failed");
      callback?.({ ok: false, error: socketError(socket, "server.friendsListFailed") });
    }
  });

  onValidatedSocketEvent(socket, "friends:request", async ({ targetId }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }

    const target = await accountById(String(targetId || ""));
    if (!target || target.id === user.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.userNotFound") });
      return;
    }

    const existing = await friendshipBetween(user.accountId, target.id);
    if (existing) {
      callback?.({ ok: false, error: socketError(socket, "server.friendshipExists") });
      return;
    }

    const id = crypto.randomUUID();
    try {
      if (!pool) {
        memoryFriendships.set(friendshipKey(user.accountId, target.id), {
          id,
          requesterId: user.accountId,
          addresseeId: target.id,
          status: "pending",
          createdAt: new Date().toISOString()
        });
      } else {
        const createdAt = new Date().toISOString();
        await pool.query(
          `INSERT INTO echoverse_friendships
            (id, requester_id, addressee_id, status, created_at, updated_at)
           VALUES ($1, $2, $3, 'pending', $4, $4)`,
          [id, user.accountId, target.id, createdAt]
        );
      }
    } catch (error) {
      serverLogger.error("echoverse.friends.request_failed", {
        conflict: isFriendshipConflict(error)
      });
      callback?.({
        ok: false,
        error: socketError(
          socket,
          isFriendshipConflict(error) ? "server.friendshipExists" : "server.requestFailed"
        )
      });
      return;
    }

    const targetSocket = socketForAccount(target.id);
    if (targetSocket) {
      io.to(targetSocket.socketId).emit("friends:changed");
      io.to(targetSocket.socketId).emit("friends:request-received", {
        id: user.accountId,
        username: user.username,
        avatarData: user.avatarData
      });
    }

    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:respond", async ({ friendshipId, accept }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }

    const id = String(friendshipId || "");
    if (!pool) {
      const row = [...memoryFriendships.values()].find((friendship) => friendship.id === id);
      if (!row || row.addresseeId !== user.accountId || row.status !== "pending") {
        callback?.({ ok: false, error: socketError(socket, "server.friendRequestNotFound") });
        return;
      }

      if (accept) {
        row.status = "accepted";
        memoryFriendships.set(friendshipKey(row.requesterId, row.addresseeId), row);
      } else {
        memoryFriendships.delete(friendshipKey(row.requesterId, row.addresseeId));
      }

      const otherSocket = socketForAccount(row.requesterId);
      if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    } else {
      const result = await pool.query(
        `SELECT requester_id, addressee_id, status
         FROM echoverse_friendships
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      const row = result.rows[0];
      if (!row || row.addressee_id !== user.accountId || row.status !== "pending") {
        callback?.({ ok: false, error: socketError(socket, "server.friendRequestNotFound") });
        return;
      }

      if (accept) {
        await pool.query(
          `UPDATE echoverse_friendships
           SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [id]
        );
      } else {
        await pool.query(`DELETE FROM echoverse_friendships WHERE id = $1`, [id]);
      }

      const otherSocket = socketForAccount(row.requester_id);
      if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    }

    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:cancel", async ({ friendshipId }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }

    const id = String(friendshipId || "");
    let targetId: string;
    if (!pool) {
      const row = [...memoryFriendships.values()].find(
        (friendship) => friendship.id === id && friendship.requesterId === user.accountId
      );
      if (!row || row.status !== "pending") {
        callback?.({ ok: false, error: socketError(socket, "server.friendRequestNotFound") });
        return;
      }
      targetId = row.addresseeId;
      memoryFriendships.delete(friendshipKey(row.requesterId, row.addresseeId));
    } else {
      const lookup = await pool.query(
        `SELECT addressee_id, requester_id, status
         FROM echoverse_friendships
         WHERE id = $1
         LIMIT 1`,
        [id]
      );
      const row = lookup.rows[0];
      if (!row || row.requester_id !== user.accountId || row.status !== "pending") {
        callback?.({ ok: false, error: socketError(socket, "server.friendRequestNotFound") });
        return;
      }
      const result = await pool.query(
        `DELETE FROM echoverse_friendships
         WHERE id = $1 AND requester_id = $2 AND status = 'pending'`,
        [id, user.accountId]
      );
      if (!result.rowCount) {
        callback?.({ ok: false, error: socketError(socket, "server.friendRequestNotFound") });
        return;
      }
      targetId = String(row.addressee_id);
    }

    emitToAccount(targetId, "friends:changed", {});
    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:remove", async ({ targetId }, callback) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }

    const target = String(targetId || "");
    if (!pool) {
      memoryFriendships.delete(friendshipKey(user.accountId, target));
    } else {
      await pool.query(
        `DELETE FROM echoverse_friendships
         WHERE
           (requester_id = $1 AND addressee_id = $2)
           OR
           (requester_id = $2 AND addressee_id = $1)`,
        [user.accountId, target]
      );
    }

    const otherSocket = socketForAccount(target);
    if (otherSocket) io.to(otherSocket.socketId).emit("friends:changed");
    socket.emit("friends:changed");
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:block", async ({ targetId }, callback) => {
    const account = socket.data.account;
    const target = String(targetId || "");
    if (!account || !target || account.id === target) {
      callback?.({ ok: false, error: socketError(socket, "server.blockFailed") });
      return;
    }

    const existing = await friendshipBetween(account.id, target);
    if (!pool) {
      memoryFriendships.set(friendshipKey(account.id, target), {
        id: existing?.id || crypto.randomUUID(),
        requesterId: account.id,
        addresseeId: target,
        status: "blocked",
        createdAt: existing?.createdAt || new Date().toISOString()
      });
    } else if (existing) {
      await pool.query(
        `UPDATE echoverse_friendships
         SET status='blocked', requester_id=$1, addressee_id=$2, updated_at=NOW()
         WHERE id=$3`,
        [account.id, target, existing.id]
      );
    } else {
      await pool.query(
        `INSERT INTO echoverse_friendships
          (id, requester_id, addressee_id, status, created_at, updated_at)
         VALUES ($1,$2,$3,'blocked',NOW(),NOW())`,
        [crypto.randomUUID(), account.id, target]
      );
    }

    socket.emit("friends:changed");
    emitToAccount(target, "friends:changed", {});
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "friends:unblock", async ({ targetId }, callback) => {
    const account = socket.data.account;
    const target = String(targetId || "");
    if (!account || !target) return callback?.({ ok: false });

    const existing = await friendshipBetween(account.id, target);
    if (!existing || existing.status !== "blocked") {
      return callback?.({ ok: false, error: socketError(socket, "server.blockNotFound") });
    }

    if (!pool) memoryFriendships.delete(friendshipKey(account.id, target));
    else await pool.query(`DELETE FROM echoverse_friendships WHERE id=$1`, [existing.id]);

    socket.emit("friends:changed");
    emitToAccount(target, "friends:changed", {});
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:conversations", async (_payload, callback) => {
    const account = socket.data.account;
    if (!account)
      return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
    callback?.({ ok: true, conversations: await listConversations(account.id) });
  });

  onValidatedSocketEvent(socket, "dm:requests", async (_payload, callback) => {
    const account = socket.data.account;
    if (!account)
      return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
    try {
      callback?.({ ok: true, ...(await listDmRequests(account.id)) });
    } catch (error) {
      serverLogger.error("echoverse.dm.requests_list_failed", {
        error: error instanceof Error ? error.message : "unknown"
      });
      callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
    }
  });

  onValidatedSocketEvent(socket, "dm:preferences", async (_payload, callback) => {
    const account = socket.data.account;
    if (!account)
      return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
    try {
      callback?.({ ok: true, ...(await listDmPreferences(account.id)) });
    } catch (error) {
      serverLogger.error("echoverse.dm.preferences_list_failed", {
        error: error instanceof Error ? error.message : "unknown"
      });
      callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
    }
  });

  onValidatedSocketEvent(
    socket,
    "dm:privacy-update",
    async ({ allowNonFriendRequests }, callback) => {
      const account = socket.data.account;
      if (!account)
        return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      try {
        const privacy = await updateDmPrivacy(account.id, allowNonFriendRequests);
        socket.emit("dm:preferences-changed", { privacy });
        callback?.({ ok: true, privacy });
      } catch (error) {
        serverLogger.error("echoverse.dm.privacy_update_failed", {
          error: error instanceof Error ? error.message : "unknown"
        });
        callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
      }
    }
  );

  onValidatedSocketEvent(
    socket,
    "dm:peer-preference-update",
    async ({ peerId, muted, archived }, callback) => {
      const account = socket.data.account;
      if (!account)
        return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      if (peerId === account.id || !(await accountById(peerId))) {
        return callback?.({ ok: false, error: socketError(socket, "server.userNotFound") });
      }
      try {
        const preference = await updateDmPeerPreference(account.id, peerId, { muted, archived });
        if (!preference) {
          callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
          return;
        }
        socket.emit("dm:preferences-changed", { preference });
        callback?.({ ok: true, preference });
      } catch (error) {
        serverLogger.error("echoverse.dm.peer_preference_update_failed", {
          error: error instanceof Error ? error.message : "unknown"
        });
        callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
      }
    }
  );

  onValidatedSocketEvent(socket, "dm:request-respond", async ({ requestId, action }, callback) => {
    const account = socket.data.account;
    if (!account)
      return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });

    if (action === "decline" || action === "spam") {
      const request = await updateDmRequestStatus(
        account.id,
        requestId,
        action === "spam" ? "spam" : "declined"
      );
      if (!request) {
        callback?.({ ok: false, error: socketError(socket, "server.messageRequestNotFound") });
        return;
      }
      emitToAccount(request.senderId, "dm:requests-changed", {});
      socket.emit("dm:requests-changed", {});
      callback?.({ ok: true, request });
      return;
    }

    try {
      const result = await acceptDmRequest(account.id, requestId);
      if (!result) {
        callback?.({ ok: false, error: socketError(socket, "server.messageRequestNotFound") });
        return;
      }
      const sender = await accountById(result.message.senderId);
      const payload = {
        ...result.message,
        senderUsername: sender?.username || "",
        senderAvatarData: sender?.avatarData || null
      };
      emitDmPair(result.message, "dm:message", payload);
      emitToAccount(result.request.senderId, "friends:changed", {});
      socket.emit("friends:changed");
      emitToAccount(result.request.senderId, "dm:requests-changed", {});
      socket.emit("dm:requests-changed", {});
      callback?.({ ok: true, request: result.request, message: payload });
    } catch (error) {
      serverLogger.error("echoverse.dm.request_accept_failed", {
        requestId,
        error: error instanceof Error ? error.message : "unknown"
      });
      callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
    }
  });

  onValidatedSocketEvent(socket, "dm:group-create", async ({ memberIds, name }, callback) => {
    const account = socket.data.account;
    if (!account || memberIds.includes(account.id)) {
      callback?.({ ok: false, error: socketError(socket, "server.groupCreateFailed") });
      return;
    }
    for (const memberId of memberIds) {
      if (!(await areFriends(account.id, memberId))) {
        callback?.({ ok: false, error: socketError(socket, "server.groupMemberNotFriend") });
        return;
      }
    }
    try {
      const conversation = await createGroupConversation(account.id, memberIds, name);
      const members = await conversationMembers(conversation.id);
      const payload = { ...conversation, kind: "group", members };
      await emitConversation(conversation.id, "dm:conversation-created", payload);
      callback?.({ ok: true, conversation: payload });
    } catch (error) {
      callback?.({
        ok: false,
        error: socketError(
          socket,
          String(error).includes("group_size") ? "server.groupTooLarge" : "server.groupCreateFailed"
        )
      });
    }
  });

  onValidatedSocketEvent(
    socket,
    "dm:group-add",
    async ({ conversationId, accountId }, callback) => {
      const actor = socket.data.account;
      if (!actor)
        return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      if (!(await accountById(accountId)))
        return callback?.({ ok: false, error: socketError(socket, "server.group.invalid_member") });
      const result = await mutateGroupMember(actor.id, conversationId, accountId, "add");
      if (!result.ok)
        return callback?.({
          ok: false,
          error: socketError(socket, `server.group.${result.error}`)
        });
      const members = await conversationMembers(conversationId);
      await emitConversation(conversationId, "dm:conversation-updated", {
        conversationId,
        members
      });
      callback?.({ ok: true, members });
    }
  );

  onValidatedSocketEvent(
    socket,
    "dm:group-remove",
    async ({ conversationId, accountId }, callback) => {
      const actor = socket.data.account;
      if (!actor)
        return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      const result = await mutateGroupMember(actor.id, conversationId, accountId, "remove");
      if (!result.ok)
        return callback?.({
          ok: false,
          error: socketError(socket, `server.group.${result.error}`)
        });
      const members = await conversationMembers(conversationId);
      await emitConversation(conversationId, "dm:conversation-updated", {
        conversationId,
        members
      });
      emitToAccount(accountId, "dm:conversation-removed", { conversationId });
      callback?.({ ok: true });
    }
  );

  onValidatedSocketEvent(
    socket,
    "dm:group-promote",
    async ({ conversationId, accountId }, callback) => {
      const actor = socket.data.account;
      if (!actor)
        return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      const result = await mutateGroupMember(actor.id, conversationId, accountId, "promote");
      if (!result.ok)
        return callback?.({
          ok: false,
          error: socketError(socket, `server.group.${result.error}`)
        });
      const members = await conversationMembers(conversationId);
      await emitConversation(conversationId, "dm:conversation-updated", {
        conversationId,
        members
      });
      callback?.({ ok: true, members });
    }
  );

  onValidatedSocketEvent(socket, "dm:group-leave", async ({ conversationId }, callback) => {
    const account = socket.data.account;
    if (!account)
      return callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
    const result = await leaveGroupConversation(account.id, conversationId);
    if (!result.ok)
      return callback?.({ ok: false, error: socketError(socket, `server.group.${result.error}`) });
    await emitConversation(conversationId, "dm:conversation-updated", {
      conversationId,
      members: await conversationMembers(conversationId)
    });
    socket.emit("dm:conversation-removed", { conversationId });
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:history", async ({ friendId, conversationId }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");
    if (conversationId) {
      if (!user?.accountId || !(await conversationFor(user.accountId, conversationId))) {
        callback?.({ ok: false, error: socketError(socket, "server.notGroupMember") });
        return;
      }
      callback?.({
        ok: true,
        messages: await decorateGroupMessages(await loadConversationHistory(conversationId))
      });
      return;
    }
    if (!user?.accountId || !(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: socketError(socket, "server.notFriends") });
      return;
    }

    callback?.({ ok: true, messages: await loadDmHistory(user.accountId, friend) });
  });

  onValidatedSocketEvent(
    socket,
    "dm-search",
    async ({ friendId, conversationId, query, authorId, from, to, before, limit }, callback) => {
      const user = users.get(socket.id);
      if (!user?.accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
        return;
      }
      if (conversationId) {
        if (!(await conversationFor(user.accountId, conversationId))) {
          callback?.({ ok: false, error: socketError(socket, "server.notGroupMember") });
          return;
        }
        if (authorId) {
          const members = await conversationMembers(conversationId);
          if (!members.some((member: any) => member.accountId === authorId)) {
            callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
            return;
          }
        }
      } else {
        const friend = String(friendId || "");
        if (!(await areFriends(user.accountId, friend))) {
          callback?.({ ok: false, error: socketError(socket, "server.notFriends") });
          return;
        }
        if (authorId && authorId !== user.accountId && authorId !== friend) {
          callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
          return;
        }
      }
      const messages = await searchDm(user.accountId, { friendId, conversationId }, query, limit, {
        authorId,
        from,
        to,
        before
      });
      callback?.({
        ok: true,
        messages: conversationId ? await decorateGroupMessages(messages) : messages,
        nextCursor: messages.length === (limit || 100) ? messages.at(-1)?.createdAt || null : null
      });
    }
  );

  onValidatedSocketEvent(socket, "dm:report", async ({ targetId, messageId, reason }, callback) => {
    const account = socket.data.account;
    if (!account) {
      callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
      return;
    }
    const target = await accountById(String(targetId));
    if (!target || target.id === account.id) {
      callback?.({ ok: false, error: socketError(socket, "server.dmReportTargetInvalid") });
      return;
    }

    const linkedMessageId: string | null = messageId ? String(messageId) : null;
    if (linkedMessageId) {
      const message = await dmById(linkedMessageId);
      const isDirectMessage =
        Boolean(message) &&
        !message?.conversationId &&
        ((message?.senderId === account.id && message?.recipientId === target.id) ||
          (message?.senderId === target.id && message?.recipientId === account.id));
      if (!isDirectMessage) {
        callback?.({ ok: false, error: socketError(socket, "server.dmReportMessageAccessDenied") });
        return;
      }
    }

    const report = await createDmReport(account.id, target.id, linkedMessageId, reason);
    if (!report) {
      callback?.({ ok: false, error: socketError(socket, "server.dmReportRateLimited") });
      return;
    }
    callback?.({ ok: true, created: report.created, report: report.report });
  });

  onValidatedSocketEvent(
    socket,
    "dm:send",
    async ({ friendId, conversationId, body, replyToId, attachment }, callback) => {
      if (!allowSocketEvent(socket.id, "dm:send", 30)) {
        callback?.({ ok: false, error: socketError(socket, "server.messageRateLimited") });
        return;
      }
      const user = users.get(socket.id);
      const friend = String(friendId || "");
      const clean = sanitizeText(body);

      if (!user?.accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
        return;
      }
      if (conversationId && !(await conversationFor(user.accountId, conversationId))) {
        callback?.({ ok: false, error: socketError(socket, "server.notGroupMember") });
        return;
      }

      if (replyToId) {
        const parent = await dmById(String(replyToId));
        const replyAllowed = conversationId
          ? parent?.conversationId === conversationId
          : Boolean(
              parent &&
              !parent.conversationId &&
              ((parent.senderId === user.accountId && parent.recipientId === friend) ||
                (parent.senderId === friend && parent.recipientId === user.accountId))
            );
        if (!replyAllowed) {
          callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
          return;
        }
      }

      const checkedAttachment = validateAttachment(attachment);
      if (!checkedAttachment.ok) {
        callback?.({ ok: false, error: socketError(socket, checkedAttachment.errorKey) });
        return;
      }
      if (!clean && !checkedAttachment.value) {
        callback?.({ ok: false, error: socketError(socket, "server.emptyMessage") });
        return;
      }

      if (!conversationId) {
        const target = await accountById(friend);
        if (!target || target.id === user.accountId) {
          callback?.({ ok: false, error: socketError(socket, "server.userNotFound") });
          return;
        }
        const friendship = await friendshipBetween(user.accountId, friend);
        const isAcceptedFriend = friendship?.status === "accepted";
        const blocked = friendship?.status === "blocked";
        if (blocked) {
          callback?.({ ok: false, error: socketError(socket, "server.userBlocked") });
          return;
        }
        if (!isAcceptedFriend) {
          const recipientPrivacy = await getDmPrivacy(friend);
          if (!recipientPrivacy.allowNonFriendRequests) {
            callback?.({ ok: false, error: socketError(socket, "server.messageRequestsDisabled") });
            return;
          }
          if (checkedAttachment.value) {
            callback?.({
              ok: false,
              error: socketError(socket, "server.messageRequestAttachmentsNotAllowed")
            });
            return;
          }
          const request = await dmRequestBetween(user.accountId, friend);
          if (request?.status === "pending") {
            callback?.({ ok: false, error: socketError(socket, "server.messageRequestPending") });
            return;
          }
          if (request && request.status !== "accepted") {
            callback?.({ ok: false, error: socketError(socket, "server.messageRequestClosed") });
            return;
          }
          let created: Awaited<ReturnType<typeof createDmRequest>>;
          try {
            created = await createDmRequest(user.accountId, friend, clean);
          } catch (error) {
            // A concurrent send may win the unique directional-request race.
            const current = await dmRequestBetween(user.accountId, friend);
            if (current?.status === "pending") {
              callback?.({ ok: false, error: socketError(socket, "server.messageRequestPending") });
              return;
            }
            serverLogger.error("echoverse.dm.request_create_failed", {
              error: error instanceof Error ? error.message : "unknown"
            });
            callback?.({ ok: false, error: socketError(socket, "server.requestFailed") });
            return;
          }
          if (!created.created) {
            callback?.({ ok: false, error: socketError(socket, "server.messageRequestPending") });
            return;
          }
          const requestPayload = {
            ...created.request,
            senderUsername: user.username,
            senderAvatarData: user.avatarData
          };
          emitToAccount(friend, "dm:request-received", requestPayload);
          emitToAccount(friend, "dm:requests-changed", {});
          socket.emit("dm:requests-changed", {});
          callback?.({ ok: true, request: requestPayload });
          return;
        }
      }

      const message = await storeDm(user.accountId, friend || conversationId!, clean, {
        conversationId: conversationId || null,
        replyToId: replyToId ? String(replyToId) : null,
        attachmentName: checkedAttachment.value?.name || null,
        attachmentMime: checkedAttachment.value?.mime || null,
        attachmentData: checkedAttachment.value?.data || null
      });
      const payload = {
        ...message,
        senderUsername: user.username,
        senderAvatarData: user.avatarData
      };
      if (conversationId) await emitConversation(conversationId, "dm:message", payload);
      else emitDmPair(message, "dm:message", payload);
      callback?.({ ok: true, message: payload });
    }
  );

  onValidatedSocketEvent(socket, "dm:edit", async ({ messageId, body }, callback) => {
    const account = socket.data.account;
    const message = await dmById(String(messageId || ""));
    const clean = sanitizeText(body);
    const canAccessMessage = message?.conversationId
      ? await conversationFor(account?.id || "", message.conversationId)
      : account && message
        ? await areFriends(account.id, message.recipientId)
        : false;
    if (
      !account ||
      !message ||
      message.senderId !== account.id ||
      !canAccessMessage ||
      message.deletedAt ||
      !clean
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messageEditFailed") });
      return;
    }

    const editedAt = new Date().toISOString();
    if (!pool) {
      message.body = clean;
      message.editedAt = editedAt;
    } else {
      await pool.query(`UPDATE echoverse_dm_messages SET body=$1, edited_at=$2 WHERE id=$3`, [
        clean,
        editedAt,
        message.id
      ]);
      message.body = clean;
      message.editedAt = editedAt;
    }
    if (message.conversationId)
      await emitConversation(message.conversationId, "dm:updated", message);
    else emitDmPair(message, "dm:updated", message);
    callback?.({ ok: true, message });
  });

  onValidatedSocketEvent(socket, "dm:delete", async ({ messageId }, callback) => {
    const account = socket.data.account;
    const message = await dmById(String(messageId || ""));
    const canAccessMessage = message?.conversationId
      ? await conversationFor(account?.id || "", message.conversationId)
      : account && message
        ? await areFriends(account.id, message.recipientId)
        : false;
    if (
      !account ||
      !message ||
      message.senderId !== account.id ||
      !canAccessMessage ||
      message.deletedAt
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messageDeleteFailed") });
      return;
    }

    const deletedAt = new Date().toISOString();
    if (!pool) {
      message.body = "";
      message.deletedAt = deletedAt;
      message.attachmentName = null;
      message.attachmentMime = null;
      message.attachmentData = null;
    } else {
      await pool.query(
        `UPDATE echoverse_dm_messages
         SET body='', deleted_at=$1,
             attachment_name=NULL, attachment_mime=NULL, attachment_data=NULL
         WHERE id=$2`,
        [deletedAt, message.id]
      );
      message.body = "";
      message.deletedAt = deletedAt;
      message.attachmentName = null;
      message.attachmentMime = null;
      message.attachmentData = null;
    }
    if (message.conversationId) {
      await emitConversation(message.conversationId, "dm:deleted", {
        messageId: message.id,
        deletedAt
      });
    } else {
      emitDmPair(message, "dm:deleted", { messageId: message.id, deletedAt });
    }
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:typing", async ({ friendId, conversationId, typing }) => {
    const account = socket.data.account;
    if (!account) return;
    if (conversationId) {
      if (!(await conversationFor(account.id, conversationId))) return;
      for (const member of await conversationMembers(conversationId)) {
        if (member.accountId !== account.id) {
          emitToAccount(member.accountId, "dm:typing", {
            accountId: account.id,
            typing: !!typing,
            conversationId
          });
        }
      }
      return;
    }
    if (!friendId || !(await areFriends(account.id, friendId))) return;
    for (const peer of io.sockets.sockets.values()) {
      if (peer.data.account?.id === friendId) {
        peer.emit("dm:typing", { accountId: account.id, typing: !!typing });
      }
    }
  });

  onValidatedSocketEvent(socket, "dm:read", async ({ friendId }, callback) => {
    const account = socket.data.account;
    if (!account || !friendId || !(await areFriends(account.id, friendId))) {
      callback?.({ ok: false, error: socketError(socket, "server.notFriends") });
      return;
    }
    dmReadAt.set(`${account.id}:${friendId}`, Date.now());
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:react", async ({ messageId, emoji }, callback) => {
    const account = socket.data.account;
    const message = await dmById(String(messageId || ""));
    const cleanEmoji = String(emoji || "").slice(0, 12);
    if (!account || !message || !cleanEmoji) {
      callback?.({ ok: false, error: socketError(socket, "server.reactionFailed") });
      return;
    }
    if (message.conversationId) {
      if (!(await conversationFor(account.id, message.conversationId))) {
        callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
        return;
      }
    } else {
      const otherAccountId =
        account.id === message.senderId ? message.recipientId : message.senderId;
      if (
        (account.id !== message.senderId && account.id !== message.recipientId) ||
        !(await areFriends(account.id, otherAccountId))
      ) {
        callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
        return;
      }
    }

    const reactions = { ...(message.reactions || {}) };
    const set = new Set(reactions[cleanEmoji] || []);
    if (set.has(account.id)) set.delete(account.id);
    else set.add(account.id);
    if (set.size) reactions[cleanEmoji] = [...set];
    else delete reactions[cleanEmoji];
    message.reactions = reactions;

    if (!pool) {
      const memory = memoryDmMessages.find((item) => item.id === message.id);
      if (memory) memory.reactions = reactions;
    } else {
      await pool.query(`UPDATE echoverse_dm_messages SET reactions=$1::jsonb WHERE id=$2`, [
        JSON.stringify(reactions),
        message.id
      ]);
    }
    if (message.conversationId) {
      await emitConversation(message.conversationId, "dm:reaction", {
        messageId: message.id,
        reactions
      });
    } else {
      emitDmPair(message, "dm:reaction", { messageId: message.id, reactions });
    }
    callback?.({ ok: true, reactions });
  });
}
