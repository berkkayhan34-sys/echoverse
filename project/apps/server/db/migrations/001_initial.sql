-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS echoverse_friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS echoverse_dm_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS echoverse_dm_pair_idx
  ON echoverse_dm_messages(sender_id, recipient_id, created_at);
