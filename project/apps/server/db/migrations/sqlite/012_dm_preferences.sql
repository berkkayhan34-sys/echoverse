-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_dm_privacy (
  account_id TEXT PRIMARY KEY REFERENCES echoverse_users(id) ON DELETE CASCADE,
  allow_non_friend_requests INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS echoverse_dm_preferences (
  account_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  muted INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, peer_id),
  CHECK (account_id <> peer_id)
);

CREATE INDEX IF NOT EXISTS echoverse_dm_preferences_account_idx
  ON echoverse_dm_preferences(account_id, updated_at);
