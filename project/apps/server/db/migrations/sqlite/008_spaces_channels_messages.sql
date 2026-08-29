-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_guild_categories (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS echoverse_guild_channels (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  category_id TEXT REFERENCES echoverse_guild_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel_type TEXT NOT NULL CHECK (channel_type IN ('text','voice','stage','forum')),
  position INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS echoverse_guild_channels_order_idx
  ON echoverse_guild_channels(guild_id, position, id);
CREATE TABLE IF NOT EXISTS echoverse_guild_messages (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES echoverse_guild_channels(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reply_to_id TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  pinned INTEGER NOT NULL DEFAULT 0,
  reactions TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS echoverse_guild_messages_history_idx
  ON echoverse_guild_messages(channel_id, created_at, id);
CREATE TABLE IF NOT EXISTS echoverse_guild_moderation (
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('kick','ban','timeout','unban')),
  expires_at TEXT,
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS echoverse_guild_audit_events (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS echoverse_guild_audit_order_idx
  ON echoverse_guild_audit_events(guild_id, created_at, id);
