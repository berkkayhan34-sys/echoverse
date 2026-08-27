/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import type { Guild, SpotifyPartyState, User } from "../../domain/types.js";

export type GuildHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  guilds: Map<string, Guild>;
  guildMembers: Map<string, Set<string>>;
  spotifyParties: Map<string, SpotifyPartyState>;
  areFriends(a: string, b: string): Promise<boolean>;
  accountPresence: Map<string, string>;
  roomFor(guildId: string): string;
  guildList(accountId?: string): Guild[];
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
  guildMembers,
  spotifyParties,
  areFriends,
  accountPresence,
  roomFor,
  guildList,
  getPresence,
  sendLobbyState,
  leaveCurrentRoom,
  broadcastPresence,
  sanitizeName,
  socketError,
  onValidatedSocketEvent
}: GuildHandlerDependencies) {
  onValidatedSocketEvent(socket, "guild:create", ({ name }: { name: string }, callback: any) => {
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

    const guild: Guild = {
      id: crypto.randomBytes(4).toString("hex"),
      name: guildName,
      createdBy: user.userId,
      createdAt: new Date().toISOString()
    };

    guilds.set(guild.id, guild);
    guildMembers.set(guild.id, new Set([user.accountId]));
    for (const peer of io.sockets.sockets.values()) {
      peer.emit("guild:list", guildList(peer.data.account?.id));
    }
    callback?.({ ok: true, guild });
  });

  onValidatedSocketEvent(socket, "guild:join-code", ({ code }: { code: string }, callback: any) => {
    const user = users.get(socket.id);
    if (!user?.accountId) {
      callback?.({ ok: false, error: socketError(socket, "server.loginRequired") });
      return;
    }
    const id = String(code ?? "")
      .trim()
      .toLowerCase();

    if (!guilds.has(id)) {
      callback?.({ ok: false, error: socketError(socket, "server.guildCodeNotFound") });
      return;
    }

    const members = guildMembers.get(id) || new Set<string>();
    members.add(user.accountId);
    guildMembers.set(id, members);
    callback?.({ ok: true, guild: guilds.get(id) });
  });

  onValidatedSocketEvent(socket, "join-room", ({ guildId }: { guildId: string }, callback: any) => {
    const user = users.get(socket.id);
    if (!user) return;

    const safeGuild = guilds.has(String(guildId)) ? String(guildId) : "echoverse";
    if (
      safeGuild !== "echoverse" &&
      (!user.accountId || !guildMembers.get(safeGuild)?.has(user.accountId))
    ) {
      callback?.({ ok: false, error: socketError(socket, "server.guildMembershipRequired") });
      return;
    }
    leaveCurrentRoom(socket, user);

    const roomId = roomFor(safeGuild);
    user.roomId = roomId;
    user.guildId = safeGuild;
    users.set(socket.id, user);
    socket.join(roomId);

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
