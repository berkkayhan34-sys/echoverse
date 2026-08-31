/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { chatMessageSchema, type Locale, socketEventPayloadSchemas } from "@echoverse/contracts";
import type { User } from "../../domain/types.js";
import { sanitizeText } from "../../domain/validation.js";
import { serverLogger } from "../../runtime/observability.js";
import { utilityBotResponse } from "./commands.js";

type SocketEventName = keyof typeof socketEventPayloadSchemas;

export type ChatHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  guildChat: ReturnType<typeof import("./guild-service.js").createGuildChatService>;
  isMember(guildId: string, accountId?: string): boolean;
  membersFor(
    guildId: string
  ): Promise<Array<{ accountId: string; username: string; avatarData?: string | null }>>;
  listChannels(guildId: string): Array<{ id: string; categoryId?: string | null }>;
  hasScopedPermission(
    guildId: string,
    accountId: string | undefined,
    permission: any,
    channelId?: string,
    categoryId?: string | null
  ): boolean;
  socketError(socket: any, key: string): string;
  accountById(id: string): Promise<{ username: string; avatarData: string | null } | null>;
  resolveRequestLocale(value: unknown): Locale;
  notificationService?: {
    getLevel(accountId: string, guildId: string, channelId: string): Promise<"all" | "none">;
    getUnreadCount(accountId: string, guildId: string, channelId: string): Promise<number>;
  };
  onValidatedSocketEvent(
    socket: any,
    event: SocketEventName,
    handler: (payload: any, callback?: (response: unknown) => void) => unknown
  ): void;
};

export function registerChatHandlers({
  socket,
  io,
  users,
  guildChat,
  isMember,
  membersFor,
  listChannels,
  hasScopedPermission,
  socketError,
  accountById,
  resolveRequestLocale,
  notificationService,
  onValidatedSocketEvent
}: ChatHandlerDependencies) {
  function channelFor(guildId: string, channelId: string) {
    return listChannels(guildId).find((channel) => channel.id === channelId);
  }

  function canAccessChannel(
    guildId: string,
    accountId: string | undefined,
    permission: any,
    channelId: string
  ) {
    const channel = channelFor(guildId, channelId);
    return Boolean(
      channel && hasScopedPermission(guildId, accountId, permission, channel.id, channel.categoryId)
    );
  }

  async function decorate(messages: any[]) {
    const accounts = new Map<string, { username: string; avatarData: string | null } | null>();
    return Promise.all(
      messages.map(async (message) => {
        if (!accounts.has(message.senderId))
          accounts.set(message.senderId, await accountById(message.senderId));
        const sender = accounts.get(message.senderId);
        return {
          ...message,
          username: sender?.username || "Unknown",
          avatarData: sender?.avatarData || null,
          text: message.body
        };
      })
    );
  }
  onValidatedSocketEvent(socket, "chat-message", async (payload, callback) => {
    const user = users.get(socket.id);
    const parsed = chatMessageSchema.safeParse(payload);
    if (!parsed.success) return;
    const { guildId, text } = parsed.data;
    const channelId = parsed.data.channelId || `${guildId}:general`;
    if (!user || user.activeGuildId !== guildId || !isMember(guildId, user.accountId)) {
      callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
      return;
    }
    if (!canAccessChannel(guildId, user.accountId, "message:send", channelId)) {
      callback?.({ ok: false, error: socketError(socket, "server.messageSendFailed") });
      return;
    }

    const safeText = sanitizeText(text);
    if (!safeText) {
      callback?.({ ok: false, error: socketError(socket, "server.emptyMessage") });
      return;
    }

    const replyToId = parsed.data.replyToId || null;
    if (replyToId) {
      const parent = await guildChat.byId(replyToId);
      if (
        !parent ||
        parent.guildId !== guildId ||
        parent.channelId !== channelId ||
        !canAccessChannel(guildId, user.accountId, "channel:view", parent.channelId)
      ) {
        callback?.({ ok: false, error: socketError(socket, "server.messageSendFailed") });
        return;
      }
    }

    let stored: Awaited<ReturnType<typeof guildChat.store>>;
    try {
      stored = await guildChat.store({
        guildId,
        channelId,
        senderId: user.userId,
        body: safeText,
        replyToId
      });
    } catch (error) {
      // Persistence failures must not reject an async Socket.IO handler and
      // take down the process. Keep the client draft intact with a safe error
      // while retaining the full diagnostic only in structured server logs.
      serverLogger.error("echoverse.chat.store_failed", {
        guildId,
        channelId,
        error: error instanceof Error ? error.message : "unknown"
      });
      callback?.({ ok: false, error: socketError(socket, "server.messageSendFailed") });
      return;
    }
    const message = {
      id: stored.id,
      guildId,
      channelId,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData,
      text: safeText,
      replyToId: stored.replyToId,
      createdAt: stored.createdAt
    };

    io.to(`guild:${guildId}:text`).emit("chat-message", message);
    callback?.({ ok: true, message });

    if (notificationService) {
      for (const peer of io.sockets.sockets.values()) {
        const peerUser = users.get(peer.id);
        if (
          !peerUser?.accountId ||
          peerUser.accountId === user.accountId ||
          peerUser.activeGuildId !== guildId ||
          !canAccessChannel(guildId, peerUser.accountId, "channel:view", channelId)
        ) {
          continue;
        }
        try {
          const unreadCount = await notificationService.getUnreadCount(
            peerUser.accountId,
            guildId,
            channelId
          );
          peer.emit("guild:unread", { guildId, channelId, unreadCount });
        } catch (error) {
          serverLogger.error("echoverse.chat.unread_delivery_failed", {
            guildId,
            channelId,
            error: error instanceof Error ? error.message : "unknown"
          });
        }
      }
    }

    const mentionNames = new Set<string>();
    for (const match of safeText.matchAll(/(^|\s)@([^\s@]{1,80})/gu)) {
      const username = match[2]?.trim().toLocaleLowerCase();
      if (username) mentionNames.add(username);
    }
    if (mentionNames.size > 0) {
      try {
        const guildMembers = await membersFor(guildId);
        const targets = guildMembers.filter((member) =>
          mentionNames.has(member.username.toLocaleLowerCase())
        );
        for (const peer of io.sockets.sockets.values()) {
          const peerUser = users.get(peer.id);
          if (
            !peerUser?.accountId ||
            peerUser.activeGuildId !== guildId ||
            !targets.some((target) => target.accountId === peerUser.accountId) ||
            !canAccessChannel(guildId, peerUser.accountId, "channel:view", channelId)
          ) {
            continue;
          }
          if (notificationService) {
            try {
              if (
                (await notificationService.getLevel(peerUser.accountId, guildId, channelId)) ===
                "none"
              ) {
                continue;
              }
            } catch (error) {
              serverLogger.error("echoverse.chat.mention_preference_failed", {
                guildId,
                channelId,
                error: error instanceof Error ? error.message : "unknown"
              });
              continue;
            }
          }
          peer.emit("chat:mention", {
            guildId,
            channelId,
            messageId: message.id,
            senderUsername: message.username,
            senderAvatarData: message.avatarData,
            text: message.text,
            createdAt: message.createdAt
          });
        }
      } catch (error) {
        serverLogger.error("echoverse.chat.mention_delivery_failed", {
          guildId,
          channelId,
          error: error instanceof Error ? error.message : "unknown"
        });
      }
    }

    const botText = utilityBotResponse(
      safeText.toLowerCase(),
      resolveRequestLocale(socket.data.locale)
    );
    if (!botText) return;

    io.to(`guild:${guildId}:text`).emit("chat-message", {
      id: crypto.randomUUID(),
      guildId,
      userId: "bot:utility",
      username: "EchoBot",
      avatarData: null,
      text: botText,
      bot: true,
      createdAt: new Date().toISOString()
    });
  });

  onValidatedSocketEvent(
    socket,
    "chat-history",
    async ({ guildId, channelId, limit }, callback) => {
      const user = users.get(socket.id);
      if (
        !user?.accountId ||
        !isMember(guildId, user.accountId) ||
        !canAccessChannel(guildId, user.accountId, "channel:view", channelId)
      ) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      callback?.({ ok: true, messages: await decorate(await guildChat.history(channelId, limit)) });
    }
  );

  onValidatedSocketEvent(
    socket,
    "chat-search",
    async ({ guildId, channelId, query, limit }, callback) => {
      const user = users.get(socket.id);
      if (
        !user?.accountId ||
        !canAccessChannel(guildId, user.accountId, "channel:view", channelId)
      ) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      callback?.({
        ok: true,
        messages: await decorate(await guildChat.search(channelId, query, limit))
      });
    }
  );

  onValidatedSocketEvent(socket, "chat-edit", async ({ guildId, messageId, body }, callback) => {
    const user = users.get(socket.id);
    const message = await guildChat.byId(messageId);
    if (
      !user?.accountId ||
      !message ||
      message.guildId !== guildId ||
      (message.senderId !== user.accountId &&
        !canAccessChannel(guildId, user.accountId, "message:manage", message.channelId))
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messageEditFailed") });
      return;
    }
    const updated = await guildChat.update(messageId, { body: sanitizeText(body) });
    io.to(`guild:${guildId}:text`).emit("chat:updated", updated);
    callback?.({ ok: true, message: updated });
  });

  onValidatedSocketEvent(socket, "chat-delete", async ({ guildId, messageId }, callback) => {
    const user = users.get(socket.id);
    const message = await guildChat.byId(messageId);
    if (
      !user?.accountId ||
      !message ||
      message.guildId !== guildId ||
      (message.senderId !== user.accountId &&
        !canAccessChannel(guildId, user.accountId, "message:manage", message.channelId))
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messageDeleteFailed") });
      return;
    }
    const updated = await guildChat.update(messageId, {
      body: "",
      deletedAt: new Date().toISOString()
    });
    io.to(`guild:${guildId}:text`).emit("chat:deleted", {
      messageId,
      deletedAt: updated?.deletedAt
    });
    callback?.({ ok: true });
  });

  onValidatedSocketEvent(socket, "chat-pin", async ({ guildId, messageId, pinned }, callback) => {
    const user = users.get(socket.id);
    const message = await guildChat.byId(messageId);
    if (
      !user?.accountId ||
      !message ||
      message.guildId !== guildId ||
      !canAccessChannel(guildId, user.accountId, "message:manage", message.channelId)
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messagePinFailed") });
      return;
    }
    const updated = await guildChat.update(messageId, { pinned });
    io.to(`guild:${guildId}:text`).emit("chat:pinned", updated);
    callback?.({ ok: true, message: updated });
  });

  onValidatedSocketEvent(socket, "chat-react", async ({ guildId, messageId, emoji }, callback) => {
    const user = users.get(socket.id);
    const message = await guildChat.byId(messageId);
    if (
      !user?.accountId ||
      !message ||
      message.guildId !== guildId ||
      !isMember(guildId, user.accountId)
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.messageAccessDenied") });
      return;
    }
    const reactions = { ...(message.reactions || {}) };
    const ids = new Set(reactions[emoji] || []);
    if (ids.has(user.accountId)) ids.delete(user.accountId);
    else ids.add(user.accountId);
    if (ids.size) reactions[emoji] = [...ids];
    else delete reactions[emoji];
    const updated = await guildChat.update(messageId, { reactions });
    io.to(`guild:${guildId}:text`).emit("chat:reaction", {
      messageId,
      reactions: updated?.reactions || {}
    });
    callback?.({ ok: true, reactions: updated?.reactions || {} });
  });
}
