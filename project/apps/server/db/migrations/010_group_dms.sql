-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_dm_conversations (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('group')),
  name TEXT,
  created_by TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS echoverse_dm_members (
  conversation_id TEXT NOT NULL REFERENCES echoverse_dm_conversations(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  PRIMARY KEY (conversation_id, account_id)
);

ALTER TABLE echoverse_dm_messages
  ADD COLUMN IF NOT EXISTS conversation_id TEXT REFERENCES echoverse_dm_conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS echoverse_dm_conversation_idx
  ON echoverse_dm_messages(conversation_id, created_at);
