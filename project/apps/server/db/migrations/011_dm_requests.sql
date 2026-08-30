-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_dm_requests (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','declined','spam')),
  message_id TEXT REFERENCES echoverse_dm_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(sender_id, recipient_id)
);
CREATE INDEX IF NOT EXISTS echoverse_dm_requests_recipient_idx
  ON echoverse_dm_requests(recipient_id, status, created_at);
