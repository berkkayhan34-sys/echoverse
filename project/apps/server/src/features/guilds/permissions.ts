/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import type { GuildRole } from "../../domain/types.js";

/** Permissions are evaluated on the server; UI visibility is never authority. */
export type GuildPermission =
  | "guild:view"
  | "guild:manage"
  | "guild:invite"
  | "guild:moderate"
  | "channel:view"
  | "channel:manage"
  | "message:send"
  | "message:manage";

const roleRank: Record<GuildRole, number> = {
  member: 1,
  moderator: 2,
  admin: 3,
  owner: 4
};

const rolePermissions: Record<GuildRole, ReadonlySet<GuildPermission>> = {
  member: new Set(["guild:view", "channel:view", "message:send"]),
  moderator: new Set([
    "guild:view",
    "guild:invite",
    "guild:moderate",
    "channel:view",
    "message:send",
    "message:manage"
  ]),
  admin: new Set([
    "guild:view",
    "guild:manage",
    "guild:invite",
    "guild:moderate",
    "channel:view",
    "channel:manage",
    "message:send",
    "message:manage"
  ]),
  owner: new Set([
    "guild:view",
    "guild:manage",
    "guild:invite",
    "guild:moderate",
    "channel:view",
    "channel:manage",
    "message:send",
    "message:manage"
  ])
};

export function roleCan(role: GuildRole | undefined, permission: GuildPermission) {
  return Boolean(role && rolePermissions[role].has(permission));
}

export function roleRankOf(role: GuildRole | undefined) {
  return role ? roleRank[role] : 0;
}

export function canChangeRole(actor: GuildRole | undefined, target: GuildRole | undefined) {
  return roleRankOf(actor) > roleRankOf(target);
}
