-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_guild_channel_user_state (
  guild_id TEXT NOT NULL REFERENCES echoverse_guilds(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL REFERENCES echoverse_guild_channels(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  notification_level TEXT NOT NULL DEFAULT 'all'
    CHECK (notification_level IN ('all','none')),
  last_read_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (guild_id, channel_id, account_id)
);

CREATE INDEX IF NOT EXISTS echoverse_guild_channel_user_state_account_idx
  ON echoverse_guild_channel_user_state(account_id, guild_id, channel_id);
