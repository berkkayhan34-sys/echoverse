-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_guild_permission_overrides (
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('guild','category','channel')),
  scope_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','moderator','member')),
  permission TEXT NOT NULL,
  allowed INTEGER NOT NULL CHECK (allowed IN (0,1)),
  PRIMARY KEY (guild_id, scope_type, scope_id, role, permission)
);
CREATE TABLE IF NOT EXISTS echoverse_guild_reports (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS echoverse_guild_reports_order_idx
  ON echoverse_guild_reports(guild_id, created_at, id);
