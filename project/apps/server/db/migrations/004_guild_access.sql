-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_guilds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS echoverse_guild_members (
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','moderator','member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (guild_id, account_id)
);

CREATE INDEX IF NOT EXISTS echoverse_guild_members_account_idx
  ON echoverse_guild_members(account_id, guild_id);

CREATE TABLE IF NOT EXISTS echoverse_guild_invites (
  token_hash TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS echoverse_guild_invites_guild_idx
  ON echoverse_guild_invites(guild_id, revoked_at, expires_at);
