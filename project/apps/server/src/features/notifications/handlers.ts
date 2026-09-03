/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import { socketEventPayloadSchemas, type GuildChannel } from "@echoverse/contracts";
import type { GuildNotificationLevel } from "@echoverse/contracts";
import type { User } from "../../domain/types.js";

type SocketEventName = keyof typeof socketEventPayloadSchemas;

export type GuildNotificationHandlerDependencies = {
  socket: any;
  users: Map<string, User>;
  notificationService: {
    getState(accountId: string, guildId: string, channelIds: string[]): Promise<any>;
    setLevel(
      accountId: string,
      guildId: string,
      channelId: string,
      level: GuildNotificationLevel
    ): Promise<void>;
    markRead(accountId: string, guildId: string, channelId: string): Promise<void>;
  };
  isMember(guildId: string, accountId?: string): boolean;
  listChannels(guildId: string): GuildChannel[];
  hasScopedPermission(
    guildId: string,
    accountId: string | undefined,
    permission: any,
    channelId?: string,
    categoryId?: string | null
  ): boolean;
  emitToAccount(accountId: string, event: string, payload: unknown): void;
  socketError(socket: any, key: string): string;
  onValidatedSocketEvent(
    socket: any,
    event: SocketEventName,
    handler: (payload: any, callback?: (response: unknown) => void) => unknown
  ): void;
};

export function registerGuildNotificationHandlers({
  socket,
  users,
  notificationService,
  isMember,
  listChannels,
  hasScopedPermission,
  emitToAccount,
  socketError,
  onValidatedSocketEvent
}: GuildNotificationHandlerDependencies) {
  function authenticatedAccountId() {
    return users.get(socket.id)?.accountId || socket.data.account?.id || "";
  }

  function visibleTextChannel(guildId: string, accountId: string, channelId: string) {
    const channel = listChannels(guildId).find(
      (candidate) => candidate.id === channelId && candidate.type === "text" && !candidate.archived
    );
    if (
      !channel ||
      !hasScopedPermission(guildId, accountId, "channel:view", channel.id, channel.categoryId)
    ) {
      return null;
    }
    return channel;
  }

  function visibleTextChannelIds(guildId: string, accountId: string) {
    return listChannels(guildId)
      .filter(
        (channel) =>
          channel.type === "text" &&
          !channel.archived &&
          hasScopedPermission(guildId, accountId, "channel:view", channel.id, channel.categoryId)
      )
      .map((channel) => channel.id);
  }

  async function sendState(accountId: string, guildId: string) {
    const state = await notificationService.getState(
      accountId,
      guildId,
      visibleTextChannelIds(guildId, accountId)
    );
    emitToAccount(accountId, "guild:notification-state", state);
    return state;
  }

  onValidatedSocketEvent(socket, "guild:notification-state", async ({ guildId }, callback) => {
    const accountId = authenticatedAccountId();
    if (!accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
      return;
    }
    if (!isMember(guildId, accountId)) {
      callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
      return;
    }
    try {
      const state = await sendState(accountId, guildId);
      callback?.({ ok: true, ...state });
    } catch {
      callback?.({ ok: false, error: socketError(socket, "error.operationFailed") });
    }
  });

  onValidatedSocketEvent(
    socket,
    "guild:set-notification-preference",
    async ({ guildId, channelId, level }, callback) => {
      const accountId = authenticatedAccountId();
      if (!accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
        return;
      }
      if (!isMember(guildId, accountId) || !visibleTextChannel(guildId, accountId, channelId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      try {
        await notificationService.setLevel(accountId, guildId, channelId, level);
        const state = await sendState(accountId, guildId);
        callback?.({ ok: true, ...state });
      } catch {
        callback?.({ ok: false, error: socketError(socket, "error.operationFailed") });
      }
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:mark-channel-read",
    async ({ guildId, channelId }, callback) => {
      const accountId = authenticatedAccountId();
      if (!accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
        return;
      }
      if (!isMember(guildId, accountId) || !visibleTextChannel(guildId, accountId, channelId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      try {
        await notificationService.markRead(accountId, guildId, channelId);
        const state = await sendState(accountId, guildId);
        callback?.({ ok: true, ...state });
      } catch {
        callback?.({ ok: false, error: socketError(socket, "error.operationFailed") });
      }
    }
  );
}
