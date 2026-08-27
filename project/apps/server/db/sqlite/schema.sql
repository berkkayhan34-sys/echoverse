-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

-- Local SQLite reference schema. PostgreSQL migrations are authoritative for
-- hosted deployments; adapters must preserve these table and column names.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS echoverse_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_data TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS echoverse_friendships (
  id TEXT PRIMARY KEY,
  requester_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','accepted','blocked')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_id, addressee_id)
);

CREATE TABLE IF NOT EXISTS echoverse_dm_messages (
  id TEXT PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reply_to_id TEXT,
  edited_at TEXT,
  deleted_at TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  attachment_data TEXT,
  reactions TEXT NOT NULL DEFAULT '{}'
);
