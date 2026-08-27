/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { SpotifyPartyState, User } from "../../domain/types.js";

export type SpotifyHandlerDependencies = {
  socket: any;
  io: any;
  users: Map<string, User>;
  spotifyParties: Map<string, SpotifyPartyState>;
  roomFor(guildId: string): string;
  onValidatedSocketEvent: (socket: any, event: any, handler: any) => void;
};

export function registerSpotifyHandlers({
  socket,
  io,
  users,
  spotifyParties,
  roomFor,
  onValidatedSocketEvent
}: SpotifyHandlerDependencies) {
  onValidatedSocketEvent(socket, "spotify:party-start", ({ guildId }: { guildId: string }) => {
    const user = users.get(socket.id);
    if (!user?.accountId || user.guildId !== guildId || !user.roomId) return;

    const state: SpotifyPartyState = {
      guildId,
      leaderSocketId: socket.id,
      leaderUsername: user.username,
      active: true,
      updatedAt: Date.now()
    };

    spotifyParties.set(guildId, state);
    io.to(user.roomId).emit("spotify:party-state", state);
  });

  onValidatedSocketEvent(socket, "spotify:party-stop", ({ guildId }: { guildId: string }) => {
    const user = users.get(socket.id);
    const party = spotifyParties.get(guildId);

    if (!user?.accountId || user.guildId !== guildId || !user.roomId) return;
    if (!party || party.leaderSocketId !== socket.id) return;

    spotifyParties.delete(guildId);
    io.to(roomFor(guildId)).emit("spotify:party-ended");
  });

  onValidatedSocketEvent(
    socket,
    "spotify:sync",
    ({ guildId, state }: { guildId: string; state: Partial<SpotifyPartyState> }) => {
      const user = users.get(socket.id);
      const party = spotifyParties.get(guildId);

      if (!user?.accountId || user.guildId !== guildId || !user.roomId) return;
      if (!party || party.leaderSocketId !== socket.id) return;

      const next: SpotifyPartyState = {
        ...party,
        ...state,
        guildId,
        leaderSocketId: socket.id,
        leaderUsername: user.username,
        active: true,
        updatedAt: Date.now()
      };

      spotifyParties.set(guildId, next);
      socket.to(roomFor(guildId)).emit("spotify:sync", next);
    }
  );
}
