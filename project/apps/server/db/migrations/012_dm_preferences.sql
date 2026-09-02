-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_dm_privacy (
  account_id TEXT PRIMARY KEY REFERENCES echoverse_users(id) ON DELETE CASCADE,
  allow_non_friend_requests BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS echoverse_dm_preferences (
  account_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  peer_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  muted BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, peer_id),
  CHECK (account_id <> peer_id)
);

CREATE INDEX IF NOT EXISTS echoverse_dm_preferences_account_idx
  ON echoverse_dm_preferences(account_id, updated_at);
