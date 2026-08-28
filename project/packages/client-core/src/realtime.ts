/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { PeerInfo } from "@echoverse/contracts";

export type LobbyMemberTransition = {
  memberSocketIds: string[];
  joinedSomeone: boolean;
  leftSomeone: boolean;
};

/**
 * Bounds reconnect work so an unavailable server cannot create an infinite
 * retry loop or leave the renderer in an ambiguous connection state.
 */
export const REALTIME_RETRY_POLICY = {
  reconnection: true,
  reconnectionAttempts: 8,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5_000,
  timeout: 10_000
} as const;

/**
 * Compares server-authoritative lobby membership for reconnect repair. The
 * renderer may use the deltas for sound, while the returned IDs reconcile its
 * peer graph even when point events were missed.
 */
export function getLobbyMemberTransition(
  previous: PeerInfo[],
  next: PeerInfo[],
  selfSocketId: string | undefined,
  reconnecting: boolean
): LobbyMemberTransition {
  const previousIds = new Set(previous.map((member) => member.socketId));
  const nextIds = new Set(next.map((member) => member.socketId));
  const joinedSomeone = !reconnecting
    ? next.some((member) => member.socketId !== selfSocketId && !previousIds.has(member.socketId))
    : false;
  const leftSomeone = !reconnecting
    ? previous.some((member) => member.socketId !== selfSocketId && !nextIds.has(member.socketId))
    : false;

  return {
    memberSocketIds: [...nextIds],
    joinedSomeone,
    leftSomeone
  };
}
