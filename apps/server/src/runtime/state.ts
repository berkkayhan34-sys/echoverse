/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { Account, Guild, StoredDm, SpotifyPartyState, User } from "../domain/types.js";

export const users = new Map<string, User>();
export const guilds = new Map<string, Guild>();
export const spotifyParties = new Map<string, SpotifyPartyState>();
export const pendingCalls = new Map<string, {
  callerAccountId: string;
  callerSocketId: string;
  targetAccountId: string;
  targetSocketId: string;
  timer: ReturnType<typeof setTimeout>;
}>();
export const memoryAccounts = new Map<string, Account>();
export const memoryFriendships = new Map<string, {
  id: string;
  requesterId: string;
  addresseeId: string;
  status: "pending" | "accepted" | "blocked";
  createdAt: string;
}>();
export const memoryDmMessages: StoredDm[] = [];
export const accountPresence = new Map<string, string>();
export const dmReadAt = new Map<string, number>();
