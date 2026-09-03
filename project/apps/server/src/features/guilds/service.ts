/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import type {
  Account,
  Guild,
  GuildChannel,
  GuildChannelType,
  GuildCategory,
  GuildRole,
  User
} from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";
import { RETENTION_DAYS } from "../../persistence/retention.js";
import {
  permissionCan,
  type GuildPermission,
  type PermissionOverride,
  roleCan
} from "./permissions.js";

export type GuildServiceDependencies = {
  io: any;
  pool?: PersistenceDatabase | null;
  accountById?: (id: string) => Promise<Account | null>;
  guilds: Map<string, Guild>;
  guildMembers: Map<string, Set<string>>;
  guildRoles?: Map<string, Map<string, GuildRole>>;
  guildChannels?: Map<string, GuildChannel[]>;
  guildCategories?: Map<string, GuildCategory[]>;
  guildPermissionOverrides?: Map<string, Map<string, PermissionOverride>>;
  guildModeration?: Map<
    string,
    Map<string, { action: "ban" | "timeout"; expiresAt?: string | null; reason?: string | null }>
  >;
  guildAuditEvents?: Map<
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
  >;
  guildInvites?: Map<
    string,
    { guildId: string; createdBy: string; expiresAt: string; revokedAt?: string }
  >;
  users: Map<string, User>;
};

export const MAIN_GUILD_ID = "echoverse";
export const MAIN_GUILD_NAME = "EchoVerse";
/** The deployment supplies the founder identity; never persist it in source. */
export const MAIN_GUILD_OWNER_EMAIL =
  process.env.ECHO_VERSE_MAIN_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US") || null;

const TEST_GUILD_DELETE_EMAILS = new Set(["test@test.com", "test2@test2.com"]);

export function createGuildService({
  io,
  pool,
  accountById,
  guilds,
  guildMembers,
  guildRoles: providedGuildRoles,
  guildInvites: providedGuildInvites,
  users,
  guildChannels: providedGuildChannels,
  guildCategories: providedGuildCategories,
  guildPermissionOverrides: providedPermissionOverrides,
  guildModeration: providedGuildModeration,
  guildAuditEvents: providedAuditEvents
}: GuildServiceDependencies) {
  const guildRoles = providedGuildRoles ?? new Map<string, Map<string, GuildRole>>();
  const guildInvites =
    providedGuildInvites ??
    new Map<
      string,
      { guildId: string; createdBy: string; expiresAt: string; revokedAt?: string }
    >();
  const guildChannels = providedGuildChannels ?? new Map<string, GuildChannel[]>();
  const guildCategories = providedGuildCategories ?? new Map<string, GuildCategory[]>();
  const guildPermissionOverrides =
    providedPermissionOverrides ?? new Map<string, Map<string, PermissionOverride>>();
  const guildModeration =
    providedGuildModeration ??
    new Map<
      string,
      Map<string, { action: "ban" | "timeout"; expiresAt?: string | null; reason?: string | null }>
    >();
  const guildAuditEvents =
    providedAuditEvents ??
    new Map<
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
  const moderationAttempts = new Map<string, number[]>();
  const reportAttempts = new Map<string, number[]>();
  function toGuild(row: Record<string, any>): Guild {
    const createdAt = row.created_at?.toISOString?.() || String(row.created_at);
    return {
      id: String(row.id),
      name: String(row.name),
      lobbyName: String(row.lobby_name || "Lobby"),
      createdBy: String(row.owner_id),
      ownerId: String(row.owner_id),
      createdAt
    };
  }

  function toChannel(row: Record<string, any>): GuildChannel {
    return {
      id: String(row.id),
      guildId: String(row.guild_id),
      name: String(row.name),
      type: String(row.channel_type) as GuildChannelType,
      categoryId: row.category_id ? String(row.category_id) : null,
      position: Number(row.position || 0),
      archived: Boolean(row.archived),
      createdAt: row.created_at?.toISOString?.() || String(row.created_at)
    };
  }

  function defaultChannelsFor(guildId: string, createdAt = new Date().toISOString()) {
    return [
      {
        id: `${guildId}:general`,
        guildId,
        name: "general",
        type: "text" as const,
        categoryId: null,
        position: 0,
        archived: false,
        createdAt
      },
      {
        id: `${guildId}:lobby`,
        guildId,
        name: "Lobby",
        type: "voice" as const,
        categoryId: null,
        position: 1,
        archived: false,
        createdAt
      }
    ] satisfies GuildChannel[];
  }

  async function ensureDefaultChannels(guildId: string) {
    if (guildChannels.has(guildId) && guildChannels.get(guildId)!.length) return;
    const createdAt = new Date().toISOString();
    const defaults = defaultChannelsFor(guildId, createdAt);
    if (pool) {
      for (const channel of defaults) {
        await pool.query(
          `INSERT INTO echoverse_guild_channels (id, guild_id, name, channel_type, position, archived, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
          [channel.id, guildId, channel.name, channel.type, channel.position, 0, channel.createdAt]
        );
      }
    }
    guildChannels.set(guildId, defaults);
  }

  async function loadGuilds() {
    if (!pool) return;
    const [guildResult, memberResult] = await Promise.all([
      pool.query(
        "SELECT id, name, lobby_name, owner_id, created_at FROM echoverse_guilds ORDER BY created_at, id"
      ),
      pool.query("SELECT guild_id, account_id, role FROM echoverse_guild_members")
    ]);

    for (const row of guildResult.rows) guilds.set(String(row.id), toGuild(row));
    for (const row of memberResult.rows) {
      const guildId = String(row.guild_id);
      const accountId = String(row.account_id);
      const members = guildMembers.get(guildId) || new Set<string>();
      members.add(accountId);
      guildMembers.set(guildId, members);
      const roles = guildRoles.get(guildId) || new Map<string, GuildRole>();
      roles.set(accountId, String(row.role) as GuildRole);
      guildRoles.set(guildId, roles);
    }
    const channelResult = await pool.query(
      "SELECT id, guild_id, category_id, name, channel_type, position, archived, created_at FROM echoverse_guild_channels ORDER BY guild_id, position, id"
    );
    for (const row of channelResult.rows) {
      const channel = toChannel(row);
      const channels = guildChannels.get(channel.guildId) || [];
      channels.push(channel);
      guildChannels.set(channel.guildId, channels);
    }
    const categoryResult = await pool.query(
      "SELECT id,guild_id,name,position,archived,created_at FROM echoverse_guild_categories ORDER BY guild_id,position,id"
    );
    for (const row of categoryResult.rows) {
      const category: GuildCategory = {
        id: String(row.id),
        guildId: String(row.guild_id),
        name: String(row.name),
        position: Number(row.position || 0),
        archived: Boolean(row.archived),
        createdAt: row.created_at?.toISOString?.() || String(row.created_at)
      };
      const categories = guildCategories.get(category.guildId) || [];
      categories.push(category);
      guildCategories.set(category.guildId, categories);
    }
    const overrideResult = await pool.query(
      "SELECT guild_id,scope_type,scope_id,role,permission,allowed FROM echoverse_guild_permission_overrides"
    );
    for (const row of overrideResult.rows) {
      const overrides = guildPermissionOverrides.get(String(row.guild_id)) || new Map();
      overrides.set(
        `${String(row.scope_type)}:${String(row.scope_id)}:${String(row.role)}:${String(row.permission)}`,
        {
          role: String(row.role) as any,
          permission: String(row.permission) as GuildPermission,
          allowed: Boolean(row.allowed)
        }
      );
      guildPermissionOverrides.set(String(row.guild_id), overrides);
    }
    // Only database-backed guilds have a valid foreign-key target. The
    // in-memory main-guild placeholder is reconciled later, after the founder
    // row has been inserted by ensureMainGuildOwner.
    for (const row of guildResult.rows) await ensureDefaultChannels(String(row.id));
    const moderationResult = await pool.query(
      "SELECT guild_id, account_id, action, expires_at, reason FROM echoverse_guild_moderation WHERE action IN ('ban','timeout') ORDER BY created_at"
    );
    for (const row of moderationResult.rows) {
      const expiresAt = row.expires_at?.toISOString?.() || row.expires_at || null;
      if (expiresAt && Date.parse(String(expiresAt)) <= Date.now()) continue;
      const entries = guildModeration.get(String(row.guild_id)) || new Map();
      entries.set(String(row.account_id), {
        action: String(row.action) as "ban" | "timeout",
        expiresAt,
        reason: row.reason || null
      });
      guildModeration.set(String(row.guild_id), entries);
    }
  }

  function roleFor(guildId: string, accountId?: string): GuildRole | undefined {
    if (!accountId) return undefined;
    const role = guildRoles.get(guildId)?.get(accountId);
    if (role) return role;
    // Public main-guild members may be present before a persistence backfill
    // reaches this process. Give them the least-privileged member role so
    // ordinary chat/voice access matches the public membership invariant;
    // management still requires an explicit owner/admin role.
    return isPublicMainGuild(guildId) ? "member" : undefined;
  }

  function isPublicMainGuild(guildId: string) {
    return guildId === MAIN_GUILD_ID && guilds.has(MAIN_GUILD_ID);
  }

  function isMember(guildId: string, accountId?: string) {
    if (accountId && moderationFor(guildId, accountId)?.action === "ban") return false;
    return Boolean(
      accountId && (isPublicMainGuild(guildId) || guildMembers.get(guildId)?.has(accountId))
    );
  }

  function canManage(guildId: string, accountId?: string) {
    return roleCan(roleFor(guildId, accountId), "guild:manage");
  }

  function hasPermission(
    guildId: string,
    accountId: string | undefined,
    permission: Parameters<typeof roleCan>[1]
  ) {
    if (!isMember(guildId, accountId)) return false;
    const restriction = accountId ? moderationFor(guildId, accountId) : null;
    if (restriction?.action === "timeout" && permission !== "guild:moderate") return false;
    return permissionCan(roleFor(guildId, accountId), permission, [
      guildPermissionScope(guildId, "guild", guildId)
    ]);
  }

  function guildPermissionScope(
    guildId: string,
    scopeType: "guild" | "category" | "channel",
    scopeId: string
  ) {
    const source = guildPermissionOverrides.get(guildId);
    if (!source) return new Map<string, PermissionOverride>();
    const scope = new Map<string, PermissionOverride>();
    for (const [key, value] of source) {
      if (key.startsWith(`${scopeType}:${scopeId}:`))
        scope.set(`${value.role}:${value.permission}`, value);
    }
    return scope;
  }

  function hasScopedPermission(
    guildId: string,
    accountId: string | undefined,
    permission: GuildPermission,
    channelId?: string,
    categoryId?: string | null
  ) {
    if (!isMember(guildId, accountId)) return false;
    const restriction = accountId ? moderationFor(guildId, accountId) : null;
    if (restriction?.action === "timeout" && permission !== "guild:moderate") return false;
    return permissionCan(roleFor(guildId, accountId), permission, [
      ...(channelId ? [guildPermissionScope(guildId, "channel", channelId)] : []),
      ...(categoryId ? [guildPermissionScope(guildId, "category", categoryId)] : []),
      guildPermissionScope(guildId, "guild", guildId)
    ]);
  }

  function guildList(accountId?: string) {
    return [...guilds.values()]
      .filter((guild) => (!accountId ? guild.id === MAIN_GUILD_ID : isMember(guild.id, accountId)))
      .map((guild) => ({ ...guild, role: roleFor(guild.id, accountId) }));
  }

  function roomFor(guildId: string) {
    return `guild:${guildId}:lobby`;
  }

  function textRoomFor(guildId: string) {
    return `guild:${guildId}:text`;
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
    socket.emit("voice:lobby-state", { members: getPresence(roomId), syncedAt: Date.now() });
  }

  function setMembership(guildId: string, accountId: string, role: GuildRole) {
    const members = guildMembers.get(guildId) || new Set<string>();
    members.add(accountId);
    guildMembers.set(guildId, members);
    const roles = guildRoles.get(guildId) || new Map<string, GuildRole>();
    roles.set(accountId, role);
    guildRoles.set(guildId, roles);
  }

  async function ensureMainGuildOwner(account: Account): Promise<boolean> {
    if (
      !MAIN_GUILD_OWNER_EMAIL ||
      account.email.trim().toLocaleLowerCase("en-US") !== MAIN_GUILD_OWNER_EMAIL
    ) {
      return false;
    }

    const createdAt = new Date().toISOString();
    const current = guilds.get(MAIN_GUILD_ID);
    const guild: Guild = {
      id: MAIN_GUILD_ID,
      name: current?.name || MAIN_GUILD_NAME,
      lobbyName: current?.lobbyName || "Lobby",
      createdBy: account.id,
      ownerId: account.id,
      createdAt: current?.createdAt || createdAt
    };

    if (pool) {
      await pool.query(
        `INSERT INTO echoverse_guilds (id, name, lobby_name, owner_id, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET name = $2, owner_id = $4`,
        [guild.id, guild.name, guild.lobbyName, guild.ownerId, guild.createdAt]
      );
      await pool.query(
        `UPDATE echoverse_guild_members
         SET role = 'member'
         WHERE guild_id = $1 AND account_id <> $2 AND role = 'owner'`,
        [MAIN_GUILD_ID, account.id]
      );
      await pool.query(
        `INSERT INTO echoverse_guild_members (guild_id, account_id, role, created_at)
         VALUES ($1, $2, 'owner', $3)
         ON CONFLICT (guild_id, account_id) DO UPDATE SET role = 'owner'`,
        [MAIN_GUILD_ID, account.id, createdAt]
      );

      // A founder may sign in after other users are already connected. Backfill
      // every existing account in one idempotent pass and refresh their lists
      // so the public main server appears without requiring a second login.
      const accounts = await pool.query("SELECT id FROM echoverse_users WHERE id <> $1", [
        account.id
      ]);
      for (const row of accounts.rows) {
        await pool.query(
          `INSERT INTO echoverse_guild_members (guild_id, account_id, role, created_at)
           VALUES ($1, $2, 'member', $3)
           ON CONFLICT (guild_id, account_id) DO NOTHING`,
          [MAIN_GUILD_ID, String(row.id), createdAt]
        );
        setMembership(MAIN_GUILD_ID, String(row.id), "member");
      }
    }

    guilds.set(MAIN_GUILD_ID, guild);
    for (const [memberId, role] of guildRoles.get(MAIN_GUILD_ID) || []) {
      if (role === "owner" && memberId !== account.id)
        setMembership(MAIN_GUILD_ID, memberId, "member");
    }
    setMembership(MAIN_GUILD_ID, account.id, "owner");
    // The main guild row is inserted above. Create its default channels only
    // after that foreign-key target exists; this also repairs older databases
    // that were provisioned before channel persistence was introduced.
    await ensureDefaultChannels(MAIN_GUILD_ID);
    for (const peer of io.sockets.sockets.values()) {
      const peerAccountId = peer.data.account?.id;
      if (peerAccountId) peer.emit("guild:list", guildList(peerAccountId));
    }
    return true;
  }

  async function ensureMainGuildMembership(account: Account): Promise<void> {
    const owner = await ensureMainGuildOwner(account);
    const guild = guilds.get(MAIN_GUILD_ID);
    if (!guild || owner || (pool && !guild.ownerId)) return;

    const role: GuildRole = guild.ownerId === account.id ? "owner" : "member";
    if (pool) {
      await pool.query(
        `INSERT INTO echoverse_guild_members (guild_id, account_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (guild_id, account_id) DO NOTHING`,
        [MAIN_GUILD_ID, account.id, role]
      );
    }
    setMembership(MAIN_GUILD_ID, account.id, role);
  }

  async function createGuild(name: string, ownerId: string) {
    const guild: Guild = {
      id: crypto.randomBytes(8).toString("hex"),
      name,
      lobbyName: "Lobby",
      createdBy: ownerId,
      ownerId,
      createdAt: new Date().toISOString()
    };

    if (pool) {
      await pool.query(
        "INSERT INTO echoverse_guilds (id, name, lobby_name, owner_id, created_at) VALUES ($1, $2, $3, $4, $5)",
        [guild.id, guild.name, guild.lobbyName, ownerId, guild.createdAt]
      );
      await pool.query(
        "INSERT INTO echoverse_guild_members (guild_id, account_id, role, created_at) VALUES ($1, $2, 'owner', $3)",
        [guild.id, ownerId, guild.createdAt]
      );
    }

    guilds.set(guild.id, guild);
    setMembership(guild.id, ownerId, "owner");
    await ensureDefaultChannels(guild.id);
    return guild;
  }

  function listChannels(guildId: string) {
    const persisted = guildChannels.get(guildId);
    // The public main guild is created/reconciled during startup, but a
    // reconnect can briefly observe the in-memory placeholder before the
    // database repair finishes. Keep the canonical channels available during
    // that window so authenticated web clients can chat and join voice.
    const channels =
      persisted && persisted.length
        ? persisted
        : guildId === MAIN_GUILD_ID && guilds.has(MAIN_GUILD_ID)
          ? defaultChannelsFor(guildId, "1970-01-01T00:00:00.000Z")
          : [];
    return [...channels].filter((channel) => !channel.archived);
  }

  function listCategories(guildId: string) {
    return [...(guildCategories.get(guildId) || [])].filter((category) => !category.archived);
  }

  async function createCategory(guildId: string, name: string) {
    const categories = guildCategories.get(guildId) || [];
    const category: GuildCategory = {
      id: crypto.randomBytes(8).toString("hex"),
      guildId,
      name,
      position: categories.length,
      archived: false,
      createdAt: new Date().toISOString()
    };
    if (pool)
      await pool.query(
        "INSERT INTO echoverse_guild_categories (id,guild_id,name,position,archived,created_at) VALUES ($1,$2,$3,$4,0,$5)",
        [category.id, guildId, name, category.position, category.createdAt]
      );
    guildCategories.set(guildId, [...categories, category]);
    return category;
  }

  async function updateCategory(
    guildId: string,
    categoryId: string,
    updates: { name?: string; archived?: boolean }
  ) {
    const category = guildCategories.get(guildId)?.find((entry) => entry.id === categoryId);
    if (!category) return null;
    const updated = { ...category, ...updates };
    if (pool)
      await pool.query(
        "UPDATE echoverse_guild_categories SET name=$1,archived=$2 WHERE id=$3 AND guild_id=$4",
        [updated.name, updated.archived ? 1 : 0, categoryId, guildId]
      );
    guildCategories.set(
      guildId,
      (guildCategories.get(guildId) || []).map((entry) =>
        entry.id === categoryId ? updated : entry
      )
    );
    return updated;
  }

  async function reorderCategories(guildId: string, categoryIds: string[]) {
    const current = guildCategories.get(guildId) || [];
    if (
      new Set(categoryIds).size !== categoryIds.length ||
      categoryIds.some((id) => !current.some((entry) => entry.id === id))
    )
      return null;
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    const reordered = categoryIds.map((id, position) => ({ ...byId.get(id)!, position }));
    if (pool)
      for (const category of reordered)
        await pool.query(
          "UPDATE echoverse_guild_categories SET position=$1 WHERE id=$2 AND guild_id=$3",
          [category.position, category.id, guildId]
        );
    guildCategories.set(guildId, reordered);
    return reordered;
  }

  async function setPermissionOverride(
    guildId: string,
    scopeType: "guild" | "category" | "channel",
    scopeId: string,
    role: GuildRole,
    permission: GuildPermission,
    allowed: boolean
  ) {
    const validPermissions = new Set<GuildPermission>([
      "guild:view",
      "guild:manage",
      "guild:invite",
      "guild:moderate",
      "channel:view",
      "channel:manage",
      "message:send",
      "message:manage"
    ]);
    if (!validPermissions.has(permission) || !guilds.has(guildId)) return null;
    if (
      scopeType === "category" &&
      !guildCategories.get(guildId)?.some((entry) => entry.id === scopeId)
    )
      return null;
    if (
      scopeType === "channel" &&
      !guildChannels.get(guildId)?.some((entry) => entry.id === scopeId)
    )
      return null;
    const overrides =
      guildPermissionOverrides.get(guildId) || new Map<string, PermissionOverride>();
    const key = `${scopeType}:${scopeId}:${role}:${permission}`;
    const value = { role, permission, allowed };
    if (pool)
      await pool.query(
        "INSERT INTO echoverse_guild_permission_overrides (guild_id,scope_type,scope_id,role,permission,allowed) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (guild_id,scope_type,scope_id,role,permission) DO UPDATE SET allowed=$6",
        [guildId, scopeType, scopeId, role, permission, allowed ? 1 : 0]
      );
    overrides.set(key, value);
    guildPermissionOverrides.set(guildId, overrides);
    return value;
  }

  function listPermissionOverrides(guildId: string) {
    return [...(guildPermissionOverrides.get(guildId)?.entries() || [])].map(([key, value]) => ({
      key,
      ...value
    }));
  }

  async function membersFor(guildId: string) {
    if (pool) {
      const result = await pool.query(
        "SELECT m.account_id, m.role, u.username, u.avatar_data FROM echoverse_guild_members m JOIN echoverse_users u ON u.id=m.account_id WHERE m.guild_id=$1 ORDER BY u.username",
        [guildId]
      );
      return result.rows.map((row) => ({
        accountId: String(row.account_id),
        role: String(row.role),
        username: String(row.username),
        avatarData: row.avatar_data || null
      }));
    }
    return Promise.all(
      [...(guildMembers.get(guildId) || [])].map(async (accountId) => {
        const online = [...users.values()].find((user) => user.accountId === accountId);
        const account = online ? null : await accountById?.(accountId);
        return {
          accountId,
          role: roleFor(guildId, accountId) || "member",
          username: online?.username || account?.username || accountId,
          avatarData: online?.avatarData || account?.avatarData || null
        };
      })
    );
  }

  async function reportMember(
    guildId: string,
    reporterId: string,
    targetId: string,
    reason: string
  ) {
    const key = `${guildId}:${reporterId}`;
    const now = Date.now();
    const recent = (reportAttempts.get(key) || []).filter(
      (timestamp) => now - timestamp < 3_600_000
    );
    if (recent.length >= 10) return null;
    recent.push(now);
    reportAttempts.set(key, recent);
    const report = {
      id: crypto.randomUUID(),
      guildId,
      reporterId,
      targetId,
      reason,
      status: "open",
      createdAt: new Date().toISOString()
    };
    if (pool)
      await pool.query(
        "INSERT INTO echoverse_guild_reports (id,guild_id,reporter_id,target_id,reason,status,created_at) VALUES ($1,$2,$3,$4,$5,'open',$6)",
        [report.id, guildId, reporterId, targetId, reason, report.createdAt]
      );
    return report;
  }

  async function reportsFor(guildId: string, limit = 100) {
    if (!pool) return [];
    const result = await pool.query(
      "SELECT id,guild_id,reporter_id,target_id,reason,status,created_at FROM echoverse_guild_reports WHERE guild_id=$1 ORDER BY created_at DESC,id DESC LIMIT $2",
      [guildId, limit]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      guildId: String(row.guild_id),
      reporterId: String(row.reporter_id),
      targetId: String(row.target_id),
      reason: String(row.reason),
      status: String(row.status),
      createdAt: row.created_at?.toISOString?.() || String(row.created_at)
    }));
  }

  async function createChannel(
    guildId: string,
    name: string,
    type: GuildChannelType,
    categoryId?: string | null
  ) {
    const channels = guildChannels.get(guildId) || [];
    const channel: GuildChannel = {
      id: crypto.randomBytes(8).toString("hex"),
      guildId,
      name,
      type,
      categoryId: categoryId || null,
      position: channels.length,
      archived: false,
      createdAt: new Date().toISOString()
    };
    if (pool) {
      await pool.query(
        `INSERT INTO echoverse_guild_channels (id, guild_id, category_id, name, channel_type, position, archived, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          channel.id,
          guildId,
          channel.categoryId,
          channel.name,
          channel.type,
          channel.position,
          0,
          channel.createdAt
        ]
      );
    }
    guildChannels.set(guildId, [...channels, channel]);
    return channel;
  }

  async function updateChannel(
    guildId: string,
    channelId: string,
    updates: { name?: string; archived?: boolean }
  ) {
    const channel = guildChannels.get(guildId)?.find((candidate) => candidate.id === channelId);
    if (!channel) return null;
    const updated = { ...channel, ...updates };
    if (pool) {
      await pool.query(
        "UPDATE echoverse_guild_channels SET name=$1, archived=$2 WHERE id=$3 AND guild_id=$4",
        [updated.name, updated.archived ? 1 : 0, channelId, guildId]
      );
    }
    guildChannels.set(
      guildId,
      (guildChannels.get(guildId) || []).map((candidate) =>
        candidate.id === channelId ? updated : candidate
      )
    );
    return updated;
  }

  async function reorderChannels(guildId: string, channelIds: string[]) {
    const current = guildChannels.get(guildId) || [];
    if (
      new Set(channelIds).size !== channelIds.length ||
      channelIds.some((id) => !current.some((entry) => entry.id === id))
    )
      return null;
    const byId = new Map(current.map((entry) => [entry.id, entry]));
    const reordered = channelIds.map((id, position) => ({ ...byId.get(id)!, position }));
    if (pool)
      for (const channel of reordered)
        await pool.query(
          "UPDATE echoverse_guild_channels SET position=$1 WHERE id=$2 AND guild_id=$3",
          [channel.position, channel.id, guildId]
        );
    guildChannels.set(guildId, reordered);
    return reordered;
  }

  function hashInvite(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async function createInvite(guildId: string, createdBy: string, expiresInHours = 168) {
    const token = crypto.randomBytes(24).toString("base64url");
    const tokenHash = hashInvite(token);
    const expiresAt = new Date(Date.now() + expiresInHours * 3_600_000).toISOString();

    if (pool) {
      await pool.query(
        "INSERT INTO echoverse_guild_invites (token_hash, guild_id, created_by, expires_at) VALUES ($1, $2, $3, $4)",
        [tokenHash, guildId, createdBy, expiresAt]
      );
    }
    guildInvites.set(tokenHash, { guildId, createdBy, expiresAt });
    return { token, guildId, expiresAt };
  }

  async function joinByInvite(token: string, accountId: string) {
    const tokenHash = hashInvite(token);
    let invite = guildInvites.get(tokenHash);
    if (pool) {
      const result = await pool.query(
        "SELECT guild_id, created_by, expires_at, revoked_at FROM echoverse_guild_invites WHERE token_hash = $1 LIMIT 1",
        [tokenHash]
      );
      const row = result.rows[0];
      invite = row
        ? {
            guildId: String(row.guild_id),
            createdBy: String(row.created_by),
            expiresAt: row.expires_at?.toISOString?.() || String(row.expires_at),
            ...(row.revoked_at ? { revokedAt: String(row.revoked_at) } : {})
          }
        : undefined;
    }

    if (!invite || invite.revokedAt || Date.parse(invite.expiresAt) <= Date.now()) return null;
    const guild = guilds.get(invite.guildId);
    if (!guild) return null;

    if (pool) {
      await pool.query(
        "INSERT INTO echoverse_guild_members (guild_id, account_id, role) VALUES ($1, $2, 'member') ON CONFLICT (guild_id, account_id) DO NOTHING",
        [invite.guildId, accountId]
      );
    }
    setMembership(invite.guildId, accountId, "member");
    return guild;
  }

  async function revokeInvite(guildId: string, token: string) {
    const tokenHash = hashInvite(token);
    if (pool) {
      await pool.query(
        "UPDATE echoverse_guild_invites SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = $1 AND guild_id = $2",
        [tokenHash, guildId]
      );
    }
    const invite = guildInvites.get(tokenHash);
    if (invite && invite.guildId === guildId) invite.revokedAt = new Date().toISOString();
  }

  async function setRole(guildId: string, accountId: string, role: Exclude<GuildRole, "owner">) {
    if (guilds.get(guildId)?.ownerId === accountId) return false;
    if (!isMember(guildId, accountId)) return false;
    if (pool) {
      await pool.query(
        "UPDATE echoverse_guild_members SET role = $1 WHERE guild_id = $2 AND account_id = $3",
        [role, guildId, accountId]
      );
    }
    setMembership(guildId, accountId, role);
    return true;
  }

  async function renameLobby(guildId: string, lobbyName: string) {
    const guild = guilds.get(guildId);
    if (!guild) return null;
    if (pool) {
      await pool.query("UPDATE echoverse_guilds SET lobby_name = $1 WHERE id = $2", [
        lobbyName,
        guildId
      ]);
    }
    const updated = { ...guild, lobbyName };
    guilds.set(guildId, updated);
    return updated;
  }

  async function leaveGuild(guildId: string, accountId: string) {
    if (guildId === MAIN_GUILD_ID || roleFor(guildId, accountId) === "owner") return false;
    if (pool) {
      await pool.query(
        "DELETE FROM echoverse_guild_members WHERE guild_id = $1 AND account_id = $2",
        [guildId, accountId]
      );
    }
    guildMembers.get(guildId)?.delete(accountId);
    guildRoles.get(guildId)?.delete(accountId);
    return true;
  }

  type GuildDeleteResult = { ok: true } | { ok: false; reason: "not_allowed" | "members_present" };

  async function deleteGuild(guildId: string, accountId: string): Promise<GuildDeleteResult> {
    const guild = guilds.get(guildId);
    if (
      !guild ||
      guildId === MAIN_GUILD_ID ||
      (guild.ownerId !== accountId && roleFor(guildId, accountId) !== "owner")
    ) {
      return { ok: false, reason: "not_allowed" };
    }

    let memberRecords: Array<{ accountId: string; email: string }>;
    if (pool) {
      const result = await pool.query(
        `SELECT m.account_id, u.email
         FROM echoverse_guild_members m
         JOIN echoverse_users u ON u.id = m.account_id
         WHERE m.guild_id = $1`,
        [guildId]
      );
      memberRecords = result.rows.map((row) => ({
        accountId: String(row.account_id),
        email: String(row.email).trim().toLocaleLowerCase("en-US")
      }));
    } else {
      if (!accountById) return { ok: false, reason: "not_allowed" };
      const memberIds = [...(guildMembers.get(guildId) || [])];
      const accounts = await Promise.all(memberIds.map((id) => accountById(id)));
      if (accounts.some((account) => !account)) return { ok: false, reason: "members_present" };
      memberRecords = accounts.map((account) => ({
        accountId: account!.id,
        email: account!.email.trim().toLocaleLowerCase("en-US")
      }));
    }

    const hasUnapprovedMember = memberRecords.some(
      (member) => member.accountId !== accountId && !TEST_GUILD_DELETE_EMAILS.has(member.email)
    );
    if (hasUnapprovedMember) return { ok: false, reason: "members_present" };

    if (pool) await pool.query("DELETE FROM echoverse_guilds WHERE id = $1", [guildId]);

    guilds.delete(guildId);
    guildMembers.delete(guildId);
    guildRoles.delete(guildId);
    guildChannels.delete(guildId);
    guildCategories.delete(guildId);
    guildPermissionOverrides.delete(guildId);
    guildModeration.delete(guildId);
    guildAuditEvents.delete(guildId);
    for (const [tokenHash, invite] of guildInvites) {
      if (invite.guildId === guildId) guildInvites.delete(tokenHash);
    }
    for (const key of moderationAttempts.keys()) {
      if (key.startsWith(`${guildId}:`)) moderationAttempts.delete(key);
    }
    for (const key of reportAttempts.keys()) {
      if (key.startsWith(`${guildId}:`)) reportAttempts.delete(key);
    }
    return { ok: true };
  }

  function moderationFor(guildId: string, accountId: string) {
    const entry = guildModeration.get(guildId)?.get(accountId);
    if (!entry) return null;
    if (entry.expiresAt && Date.parse(entry.expiresAt) <= Date.now()) {
      guildModeration.get(guildId)?.delete(accountId);
      return null;
    }
    return entry;
  }

  async function moderateMember(
    guildId: string,
    actorId: string,
    accountId: string,
    action: "kick" | "ban" | "timeout" | "unban",
    durationMinutes?: number,
    reason?: string
  ) {
    const key = `${guildId}:${actorId}`;
    const now = Date.now();
    const recent = (moderationAttempts.get(key) || []).filter(
      (timestamp) => now - timestamp < 60_000
    );
    if (recent.length >= 30) return false;
    recent.push(now);
    moderationAttempts.set(key, recent);
    if (!guilds.has(guildId) || accountId === guilds.get(guildId)?.ownerId) return false;
    if (action === "kick" || action === "ban") {
      if (pool)
        await pool.query(
          "DELETE FROM echoverse_guild_members WHERE guild_id=$1 AND account_id=$2",
          [guildId, accountId]
        );
      guildMembers.get(guildId)?.delete(accountId);
      guildRoles.get(guildId)?.delete(accountId);
    }
    if (action === "ban" || action === "timeout") {
      const expiresAt = durationMinutes
        ? new Date(Date.now() + durationMinutes * 60_000).toISOString()
        : null;
      const entries = guildModeration.get(guildId) || new Map();
      entries.set(accountId, { action, expiresAt, reason: reason || null });
      guildModeration.set(guildId, entries);
      if (pool)
        await pool.query(
          "INSERT INTO echoverse_guild_moderation (guild_id,account_id,action,expires_at,reason) VALUES ($1,$2,$3,$4,$5)",
          [guildId, accountId, action, expiresAt, reason || null]
        );
    } else if (action === "unban") {
      guildModeration.get(guildId)?.delete(accountId);
      if (pool)
        await pool.query(
          "INSERT INTO echoverse_guild_moderation (guild_id,account_id,action,reason) VALUES ($1,$2,'unban',$3)",
          [guildId, accountId, reason || null]
        );
    }
    const event = {
      id: crypto.randomUUID(),
      guildId,
      actorId,
      action,
      targetId: accountId,
      metadata: JSON.stringify({ reason: reason || null }),
      createdAt: new Date().toISOString()
    };
    const audit = guildAuditEvents.get(guildId) || [];
    audit.push(event);
    guildAuditEvents.set(guildId, audit.slice(-500));
    if (pool)
      await pool.query(
        "INSERT INTO echoverse_guild_audit_events (id,guild_id,actor_id,action,target_id,metadata,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        [event.id, guildId, actorId, action, accountId, event.metadata, event.createdAt]
      );
    return true;
  }

  async function auditFor(guildId: string, limit = 100) {
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();
    if (pool)
      await pool.query(
        "DELETE FROM echoverse_guild_audit_events WHERE guild_id=$1 AND created_at < $2",
        [guildId, cutoff]
      );
    if (!pool) return (guildAuditEvents.get(guildId) || []).slice(-limit);
    const result = await pool.query(
      "SELECT id,guild_id,actor_id,action,target_id,metadata,created_at FROM echoverse_guild_audit_events WHERE guild_id=$1 ORDER BY created_at DESC, id DESC LIMIT $2",
      [guildId, limit]
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      guildId: String(row.guild_id),
      actorId: String(row.actor_id),
      action: String(row.action),
      targetId: row.target_id ? String(row.target_id) : null,
      metadata: String(row.metadata || "{}"),
      createdAt: row.created_at?.toISOString?.() || String(row.created_at)
    }));
  }

  function leaveCurrentRoom(socket: any, user: User) {
    if (!user.roomId) return;
    const oldRoom = user.roomId;
    socket.leave(oldRoom);
    socket.to(oldRoom).emit("peer-left", { socketId: socket.id, username: user.username });

    user.roomId = undefined;
    user.guildId = undefined;
    users.set(socket.id, user);
    broadcastPresence(oldRoom);
  }

  return {
    broadcastPresence,
    canManage,
    createGuild,
    createInvite,
    getPresence,
    guildList,
    ensureMainGuildMembership,
    ensureMainGuildOwner,
    isMember,
    joinByInvite,
    leaveCurrentRoom,
    leaveGuild,
    deleteGuild,
    loadGuilds,
    roleFor,
    roomFor,
    textRoomFor,
    sendLobbyState,
    setRole,
    revokeInvite,
    renameLobby,
    createChannel,
    ensureDefaultChannels,
    guildChannels: listChannels,
    guildCategories: listCategories,
    createCategory,
    updateCategory,
    reorderCategories,
    setPermissionOverride,
    listPermissionOverrides,
    hasScopedPermission,
    membersFor,
    reportMember,
    reportsFor,
    updateChannel,
    reorderChannels,
    hasPermission,
    moderateMember,
    auditFor,
    moderationFor
  };
}
