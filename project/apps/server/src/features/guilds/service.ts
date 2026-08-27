/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Guild, SpotifyPartyState, User } from "../../domain/types.js";

export type GuildServiceDependencies = {
  io: any;
  guilds: Map<string, Guild>;
  guildMembers: Map<string, Set<string>>;
  users: Map<string, User>;
  spotifyParties: Map<string, SpotifyPartyState>;
};

export function createGuildService({
  io,
  guilds,
  guildMembers,
  users,
  spotifyParties
}: GuildServiceDependencies) {
  function guildList(accountId?: string) {
    return [...guilds.values()].filter(
      (guild) =>
        guild.id === "echoverse" || Boolean(accountId && guildMembers.get(guild.id)?.has(accountId))
    );
  }

  function roomFor(guildId: string) {
    return `guild:${guildId}:lobby`;
  }

  function getPresence(roomId: string) {
    return [...users.values()]
      .filter((user) => user.roomId === roomId)
      .map((user) => ({
        socketId: user.socketId,
        userId: user.userId,
        username: user.username,
        avatarData: user.avatarData
      }));
  }

  function broadcastPresence(roomId: string) {
    const members = getPresence(roomId);
    io.to(roomId).emit("presence", members);
    io.to(roomId).emit("voice:lobby-state", { members, syncedAt: Date.now() });
  }

  function sendLobbyState(socket: any, roomId: string) {
    socket.emit("voice:lobby-state", {
      members: getPresence(roomId),
      syncedAt: Date.now()
    });
  }

  function leaveCurrentRoom(socket: any, user: User) {
    if (!user.roomId) return;

    const oldRoom = user.roomId;
    const oldGuild = user.guildId;

    socket.leave(oldRoom);
    socket.to(oldRoom).emit("peer-left", { socketId: socket.id, username: user.username });

    if (oldGuild) {
      const party = spotifyParties.get(oldGuild);
      if (party?.leaderSocketId === socket.id) {
        spotifyParties.delete(oldGuild);
        io.to(oldRoom).emit("spotify:party-ended");
      }
    }

    user.roomId = undefined;
    user.guildId = undefined;
    users.set(socket.id, user);

    broadcastPresence(oldRoom);
  }

  return { broadcastPresence, getPresence, guildList, leaveCurrentRoom, roomFor, sendLobbyState };
}
