/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import { socketEventPayloadSchemas, type Locale } from "@echoverse/contracts";
import type { Account, StoredDm, User } from "../../domain/types.js";
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
  friendshipBetween(a: string, b: string): Promise<any>;
  friendshipKey(a: string, b: string): string;
  areFriends(a: string, b: string): Promise<boolean>;
  loadDmHistory(a: string, b: string): Promise<StoredDm[]>;
  storeDm(
    senderId: string,
    recipientId: string,
    body: string,
    options?: Record<string, unknown>
  ): Promise<StoredDm>;
  dmById(messageId: string): Promise<StoredDm | null>;
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
  friendshipBetween,
  friendshipKey,
  areFriends,
  loadDmHistory,
  storeDm,
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

  onValidatedSocketEvent(socket, "dm:history", async ({ friendId }, callback) => {
    const user = users.get(socket.id);
    const friend = String(friendId || "");
    if (!user?.accountId || !(await areFriends(user.accountId, friend))) {
      callback?.({ ok: false, error: socketError(socket, "server.notFriends") });
      return;
    }

    callback?.({ ok: true, messages: await loadDmHistory(user.accountId, friend) });
  });

  onValidatedSocketEvent(
    socket,
    "dm:send",
    async ({ friendId, body, replyToId, attachment }, callback) => {
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
      if (!(await areFriends(user.accountId, friend))) {
        callback?.({ ok: false, error: socketError(socket, "server.notFriends") });
        return;
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

      const message = await storeDm(user.accountId, friend, clean, {
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
      emitDmPair(message, "dm:message", payload);
      callback?.({ ok: true, message: payload });
    }
  );

  onValidatedSocketEvent(socket, "dm:edit", async ({ messageId, body }, callback) => {
    const account = socket.data.account;
    const message = await dmById(String(messageId || ""));
    const clean = sanitizeText(body);
    if (
      !account ||
      !message ||
      message.senderId !== account.id ||
      !(await areFriends(account.id, message.recipientId)) ||
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
    emitDmPair(message, "dm:updated", message);
    callback?.({ ok: true, message });
  });

  onValidatedSocketEvent(socket, "dm:delete", async ({ messageId }, callback) => {
    const account = socket.data.account;
    const message = await dmById(String(messageId || ""));
    if (
      !account ||
      !message ||
      message.senderId !== account.id ||
      !(await areFriends(account.id, message.recipientId)) ||
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
    emitDmPair(message, "dm:deleted", { messageId: message.id, deletedAt });
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "dm:typing", async ({ friendId, typing }) => {
    const account = socket.data.account;
    if (!account || !friendId || !(await areFriends(account.id, friendId))) return;
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
    const otherAccountId = account.id === message.senderId ? message.recipientId : message.senderId;
    if (
      (account.id !== message.senderId && account.id !== message.recipientId) ||
      !(await areFriends(account.id, otherAccountId))
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
      return;
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
    emitDmPair(message, "dm:reaction", { messageId: message.id, reactions });
    callback?.({ ok: true, reactions });
  });
}
