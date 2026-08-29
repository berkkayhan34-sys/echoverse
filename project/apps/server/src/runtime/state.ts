/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type {
  Account,
  CallSession,
  Guild,
  GuildChannel,
  GuildRole,
  StoredDm,
  StoredGuildMessage,
  User
} from "../domain/types.js";

export const users = new Map<string, User>();
export const guilds = new Map<string, Guild>();
export const guildMembers = new Map<string, Set<string>>();
export const guildRoles = new Map<string, Map<string, GuildRole>>();
export const guildChannels = new Map<string, GuildChannel[]>();
export const guildModeration = new Map<
  string,
  Map<string, { action: "ban" | "timeout"; expiresAt?: string | null; reason?: string | null }>
>();
export const guildAuditEvents = new Map<
  string,
  Array<{
    id: string;
    guildId: string;
    actorId: string;
    action: string;
    targetId?: string | null;
    metadata: string;
    createdAt: string;
  }>
>();
export const guildInvites = new Map<
  string,
  { guildId: string; createdBy: string; expiresAt: string; revokedAt?: string }
>();
export const pendingCalls = new Map<
  string,
  CallSession & {
    timer: ReturnType<typeof setTimeout>;
  }
>();
export const activeCalls = new Map<string, CallSession>();
export const memoryAccounts = new Map<string, Account>();
export const memoryFriendships = new Map<
  string,
  {
    id: string;
    requesterId: string;
    addresseeId: string;
    status: "pending" | "accepted" | "blocked";
    createdAt: string;
  }
>();
export const memoryDmMessages: StoredDm[] = [];
export const memoryGuildMessages: StoredGuildMessage[] = [];
export const accountPresence = new Map<string, string>();
export const dmReadAt = new Map<string, number>();
