/*
 * SPDX-FileCopyrightText: 2026 EchoVerse contributors
 * SPDX-License-Identifier: GPL-3.0-only
 */

import crypto from "node:crypto";
import type { Account, Guild, GuildRole, SpotifyPartyState, User } from "../../domain/types.js";
import type { PersistenceDatabase } from "../../persistence/sqlite.js";

export type GuildServiceDependencies = {
  io: any;
  pool?: PersistenceDatabase | null;
  guilds: Map<string, Guild>;
  guildMembers: Map<string, Set<string>>;
  guildRoles?: Map<string, Map<string, GuildRole>>;
  guildInvites?: Map<
    string,
    { guildId: string; createdBy: string; expiresAt: string; revokedAt?: string }
  >;
  users: Map<string, User>;
  spotifyParties: Map<string, SpotifyPartyState>;
};

export const MAIN_GUILD_ID = "echoverse";
export const MAIN_GUILD_NAME = "EchoVerse";
/** The deployment supplies the founder identity; never persist it in source. */
export const MAIN_GUILD_OWNER_EMAIL =
  process.env.ECHO_VERSE_MAIN_OWNER_EMAIL?.trim().toLocaleLowerCase("en-US") || null;

export function createGuildService({
  io,
  pool,
  guilds,
  guildMembers,
  guildRoles: providedGuildRoles,
  guildInvites: providedGuildInvites,
  users,
  spotifyParties
}: GuildServiceDependencies) {
  const guildRoles = providedGuildRoles ?? new Map<string, Map<string, GuildRole>>();
  const guildInvites =
    providedGuildInvites ??
    new Map<
      string,
      { guildId: string; createdBy: string; expiresAt: string; revokedAt?: string }
    >();
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
  }

  function roleFor(guildId: string, accountId?: string): GuildRole | undefined {
    if (!accountId) return undefined;
    return guildRoles.get(guildId)?.get(accountId);
  }

  function isMember(guildId: string, accountId?: string) {
    return Boolean(accountId && guildMembers.get(guildId)?.has(accountId));
  }

  function canManage(guildId: string, accountId?: string) {
    const role = roleFor(guildId, accountId);
    return role === "owner" || role === "admin";
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
    }

    guilds.set(MAIN_GUILD_ID, guild);
    for (const [memberId, role] of guildRoles.get(MAIN_GUILD_ID) || []) {
      if (role === "owner" && memberId !== account.id)
        setMembership(MAIN_GUILD_ID, memberId, "member");
    }
    setMembership(MAIN_GUILD_ID, account.id, "owner");
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
    return guild;
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
    if (roleFor(guildId, accountId) === "owner") return false;
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
    loadGuilds,
    roleFor,
    roomFor,
    textRoomFor,
    sendLobbyState,
    setRole,
    revokeInvite,
    renameLobby
  };
}
