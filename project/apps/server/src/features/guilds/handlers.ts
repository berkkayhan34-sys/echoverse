/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Guild, GuildChannelType, GuildRole, User } from "../../domain/types.js";
import { canChangeRole } from "./permissions.js";

export type GuildHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  guilds: Map<string, Guild>;
  areFriends(a: string, b: string): Promise<boolean>;
  accountPresence: Map<string, string>;
  roomFor(guildId: string): string;
  textRoomFor(guildId: string): string;
  guildList(accountId?: string): Guild[];
  canManage(guildId: string, accountId?: string): boolean;
  createGuild(name: string, ownerId: string): Promise<Guild>;
  createInvite(
    guildId: string,
    createdBy: string,
    expiresInHours?: number
  ): Promise<{ token: string; guildId: string; expiresAt: string }>;
  joinByInvite(token: string, accountId: string): Promise<Guild | null>;
  leaveGuild(guildId: string, accountId: string): Promise<boolean>;
  roleFor(guildId: string, accountId?: string): GuildRole | undefined;
  isMember(guildId: string, accountId?: string): boolean;
  setRole(guildId: string, accountId: string, role: Exclude<GuildRole, "owner">): Promise<boolean>;
  revokeInvite(guildId: string, token: string): Promise<void>;
  renameLobby(guildId: string, name: string): Promise<Guild | null>;
  createChannel(
    guildId: string,
    name: string,
    type: GuildChannelType,
    categoryId?: string | null
  ): Promise<any>;
  updateChannel(
    guildId: string,
    channelId: string,
    updates: { name?: string; archived?: boolean }
  ): Promise<any>;
  listChannels(guildId: string): any[];
  hasPermission(guildId: string, accountId: string | undefined, permission: any): boolean;
  moderateMember(
    guildId: string,
    actorId: string,
    accountId: string,
    action: "kick" | "ban" | "timeout" | "unban",
    durationMinutes?: number,
    reason?: string
  ): Promise<boolean>;
  auditFor(guildId: string, limit?: number): Promise<any[]>;
  getPresence(roomId: string): unknown[];
  sendLobbyState(socket: any, roomId: string): void;
  leaveCurrentRoom(socket: any, user: User): void;
  broadcastPresence(roomId: string): void;
  sanitizeName(value: unknown, maxLength?: number): string;
  socketError(socket: any, key: string): string;
  onValidatedSocketEvent: (socket: any, event: any, handler: any) => void;
};

export function registerGuildHandlers({
  socket,
  io,
  users,
  guilds,
  areFriends,
  accountPresence,
  roomFor,
  textRoomFor,
  guildList,
  canManage,
  createGuild,
  createInvite,
  joinByInvite,
  leaveGuild,
  roleFor,
  isMember,
  setRole,
  revokeInvite,
  renameLobby,
  createChannel,
  updateChannel,
  listChannels,
  hasPermission,
  moderateMember,
  auditFor,
  getPresence,
  sendLobbyState,
  leaveCurrentRoom,
  broadcastPresence,
  sanitizeName,
  socketError,
  onValidatedSocketEvent
}: GuildHandlerDependencies) {
  onValidatedSocketEvent(
    socket,
    "guild:create",
    async ({ name }: { name: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
        return;
      }

      const guildName = sanitizeName(name, 32);
      if (!guildName) {
        callback?.({ ok: false, error: socketError(socket, "server.guildNameEmpty") });
        return;
      }

      const guild = await createGuild(guildName, user.accountId);
      const invite = await createInvite(guild.id, user.accountId);
      for (const peer of io.sockets.sockets.values()) {
        peer.emit("guild:list", guildList(peer.data.account?.id));
      }
      callback?.({ ok: true, guild: { ...guild, role: "owner" }, invite });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:join-code",
    async ({ code }: { code: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
        return;
      }
      const guild = await joinByInvite(String(code ?? "").trim(), user.accountId);
      if (!guild) {
        callback?.({ ok: false, error: socketError(socket, "server.guildCodeNotFound") });
        return;
      }

      for (const peer of io.sockets.sockets.values()) {
        peer.emit("guild:list", guildList(peer.data.account?.id));
      }
      callback?.({ ok: true, guild });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:create-invite",
    async (
      { guildId, expiresInHours }: { guildId: string; expiresInHours?: number },
      callback: any
    ) => {
      const user = users.get(socket.id);
      if (!user?.accountId) {
        callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
        return;
      }
      if (!guilds.has(guildId) || !canManage(guildId, user.accountId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      callback?.({ ok: true, invite: await createInvite(guildId, user.accountId, expiresInHours) });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:revoke-invite",
    async ({ guildId, token }: { guildId: string; token: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !canManage(guildId, user.accountId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      await revokeInvite(guildId, token);
      callback?.({ ok: true });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:set-role",
    async (
      {
        guildId,
        accountId,
        role
      }: { guildId: string; accountId: string; role: Exclude<GuildRole, "owner"> },
      callback: any
    ) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !hasPermission(guildId, user.accountId, "guild:manage")) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      if (!canChangeRole(roleFor(guildId, user.accountId), role)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      const changed = await setRole(guildId, accountId, role);
      callback?.(
        changed ? { ok: true } : { ok: false, error: socketError(socket, "server.accountNotFound") }
      );
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:channels",
    ({ guildId }: { guildId: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !hasPermission(guildId, user.accountId, "channel:view")) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      callback?.({ ok: true, channels: listChannels(guildId) });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:moderate-member",
    async (
      {
        guildId,
        accountId,
        action,
        durationMinutes,
        reason
      }: {
        guildId: string;
        accountId: string;
        action: "kick" | "ban" | "timeout" | "unban";
        durationMinutes?: number;
        reason?: string;
      },
      callback: any
    ) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !hasPermission(guildId, user.accountId, "guild:moderate")) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      const changed = await moderateMember(
        guildId,
        user.accountId,
        accountId,
        action,
        durationMinutes,
        reason
      );
      if (!changed) {
        callback?.({ ok: false, error: socketError(socket, "server.moderationFailed") });
        return;
      }
      for (const peer of io.sockets.sockets.values()) {
        if (peer.data.account?.id && isMember(guildId, peer.data.account.id))
          peer.emit("guild:moderation-changed", { guildId, accountId, action });
      }
      callback?.({ ok: true });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:audit",
    async ({ guildId, limit }: { guildId: string; limit?: number }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !hasPermission(guildId, user.accountId, "guild:moderate")) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      callback?.({ ok: true, events: await auditFor(guildId, limit) });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:create-channel",
    async (
      {
        guildId,
        name,
        type,
        categoryId
      }: { guildId: string; name: string; type: GuildChannelType; categoryId?: string | null },
      callback: any
    ) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !hasPermission(guildId, user.accountId, "channel:manage")) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      const channel = await createChannel(guildId, sanitizeName(name, 64), type, categoryId);
      for (const peer of io.sockets.sockets.values()) {
        if (peer.data.account?.id && isMember(guildId, peer.data.account.id))
          peer.emit("guild:channels", { guildId, channels: listChannels(guildId) });
      }
      callback?.({ ok: true, channel });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:update-channel",
    async (
      {
        guildId,
        channelId,
        name,
        archived
      }: { guildId: string; channelId: string; name?: string; archived?: boolean },
      callback: any
    ) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !hasPermission(guildId, user.accountId, "channel:manage")) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      const channel = await updateChannel(guildId, channelId, {
        ...(name ? { name: sanitizeName(name, 64) } : {}),
        ...(typeof archived === "boolean" ? { archived } : {})
      });
      if (!channel) {
        callback?.({ ok: false, error: socketError(socket, "server.channelNotFound") });
        return;
      }
      for (const peer of io.sockets.sockets.values()) {
        if (peer.data.account?.id && isMember(guildId, peer.data.account.id))
          peer.emit("guild:channels", { guildId, channels: listChannels(guildId) });
      }
      callback?.({ ok: true, channel });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:rename-lobby",
    async ({ guildId, name }: { guildId: string; name: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !canManage(guildId, user.accountId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildPermissionRequired") });
        return;
      }
      const lobbyName = sanitizeName(name, 32);
      if (!lobbyName) {
        callback?.({ ok: false, error: socketError(socket, "server.lobbyNameEmpty") });
        return;
      }
      const updated = await renameLobby(guildId, lobbyName);
      if (!updated) {
        callback?.({ ok: false, error: socketError(socket, "server.lobbyRenameFailed") });
        return;
      }
      for (const peer of io.sockets.sockets.values()) {
        const accountId = peer.data.account?.id;
        if (accountId && isMember(guildId, accountId)) peer.emit("guild:updated", updated);
      }
      callback?.({ ok: true, guild: updated });
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:leave",
    async ({ guildId }: { guildId: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !isMember(guildId, user.accountId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      const left = await leaveGuild(guildId, user.accountId);
      if (user.guildId === guildId) leaveCurrentRoom(socket, user);
      if (user.activeGuildId === guildId) {
        socket.leave(textRoomFor(guildId));
        user.activeGuildId = undefined;
        users.set(socket.id, user);
      }
      socket.emit("guild:list", guildList(user.accountId));
      callback?.(
        left
          ? { ok: true }
          : { ok: false, error: socketError(socket, "server.guildOwnerCannotLeave") }
      );
    }
  );

  onValidatedSocketEvent(
    socket,
    "guild:select",
    ({ guildId }: { guildId: string }, callback: any) => {
      const user = users.get(socket.id);
      if (!user?.accountId || !isMember(guildId, user.accountId)) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      if (user.activeGuildId) socket.leave(textRoomFor(user.activeGuildId));
      user.activeGuildId = guildId;
      users.set(socket.id, user);
      socket.join(textRoomFor(guildId));
      socket.emit("guild:channels", { guildId, channels: listChannels(guildId) });
      callback?.({ ok: true, guildId });
    }
  );

  onValidatedSocketEvent(socket, "join-room", ({ guildId }: { guildId: string }, callback: any) => {
    const user = users.get(socket.id);
    if (!user) return;

    const safeGuild = String(guildId || "");
    if (!guilds.has(safeGuild) || !user.accountId || !isMember(safeGuild, user.accountId)) {
      callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
      return;
    }
    leaveCurrentRoom(socket, user);

    const roomId = roomFor(safeGuild);
    user.roomId = roomId;
    user.guildId = safeGuild;
    user.activeGuildId = safeGuild;
    users.set(socket.id, user);
    socket.join(roomId);
    socket.join(textRoomFor(safeGuild));

    const peers = getPresence(roomId).filter((peer: any) => peer.socketId !== socket.id);
    socket.emit("room-peers", peers);
    sendLobbyState(socket, roomId);
    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      userId: user.userId,
      username: user.username,
      avatarData: user.avatarData
    });
    broadcastPresence(roomId);
    callback?.({ ok: true, guildId: safeGuild });
  });

  onValidatedSocketEvent(socket, "voice:sync-request", () => {
    const user = users.get(socket.id);
    if (!user?.roomId) {
      socket.emit("voice:lobby-state", { members: [], syncedAt: Date.now() });
      return;
    }
    sendLobbyState(socket, user.roomId);
  });

  onValidatedSocketEvent(socket, "leave-room", () => {
    const user = users.get(socket.id);
    if (!user) return;
    leaveCurrentRoom(socket, user);
    socket.emit("presence", []);
    socket.emit("voice:lobby-state", { members: [], syncedAt: Date.now() });
  });

  onValidatedSocketEvent(
    socket,
    "presence:set",
    async ({ status }: { status: string }, callback: any) => {
      const account = socket.data.account;
      if (!account) {
        callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
        return;
      }
      const allowed = ["online", "idle", "dnd", "invisible"];
      const value = allowed.includes(status) ? status : "online";
      accountPresence.set(account.id, value);
      for (const peer of io.sockets.sockets.values()) {
        const peerAccountId = peer.data.account?.id;
        if (
          peerAccountId === account.id ||
          (peerAccountId && (await areFriends(account.id, peerAccountId)))
        ) {
          peer.emit("presence:changed", { accountId: account.id, status: value });
        }
      }
      callback?.({ ok: true, status: value });
    }
  );

  onValidatedSocketEvent(
    socket,
    "presence:get",
    async ({ accountIds }: { accountIds?: string[] }, callback: any) => {
      const account = socket.data.account;
      if (!account) {
        callback?.({ ok: false, error: socketError(socket, "server.sessionRequired") });
        return;
      }
      const presence: Record<string, string> = {};
      for (const id of accountIds || []) {
        presence[id] =
          id === account.id || (await areFriends(account.id, id))
            ? accountPresence.get(id) || "offline"
            : "offline";
      }
      callback?.({ ok: true, presence });
    }
  );
}
