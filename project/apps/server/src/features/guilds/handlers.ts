/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Guild, GuildRole, SpotifyPartyState, User } from "../../domain/types.js";

export type GuildHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  guilds: Map<string, Guild>;
  spotifyParties: Map<string, SpotifyPartyState>;
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
  spotifyParties,
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
      for (const peer of io.sockets.sockets.values()) {
        peer.emit("guild:list", guildList(peer.data.account?.id));
      }
      callback?.({ ok: true, guild: { ...guild, role: "owner" } });
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
      if (!user?.accountId || roleFor(guildId, user.accountId) !== "owner") {
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
      if (!user?.accountId || (guildId !== "echoverse" && !isMember(guildId, user.accountId))) {
        callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
        return;
      }
      if (user.activeGuildId) socket.leave(textRoomFor(user.activeGuildId));
      user.activeGuildId = guildId;
      users.set(socket.id, user);
      socket.join(textRoomFor(guildId));
      callback?.({ ok: true, guildId });
    }
  );

  onValidatedSocketEvent(socket, "join-room", ({ guildId }: { guildId: string }, callback: any) => {
    const user = users.get(socket.id);
    if (!user) return;

    const safeGuild = guilds.has(String(guildId)) ? String(guildId) : "echoverse";
    if (safeGuild !== "echoverse" && (!user.accountId || !isMember(safeGuild, user.accountId))) {
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
    const party = spotifyParties.get(safeGuild);
    if (party?.active) socket.emit("spotify:party-state", party);
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
