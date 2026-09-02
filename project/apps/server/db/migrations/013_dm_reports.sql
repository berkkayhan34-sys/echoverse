-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE TABLE IF NOT EXISTS echoverse_dm_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES echoverse_users(id) ON DELETE CASCADE,
  message_id TEXT REFERENCES echoverse_dm_messages(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (reporter_id <> target_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS echoverse_dm_reports_replay_idx
  ON echoverse_dm_reports (reporter_id, target_id, COALESCE(message_id, ''));
CREATE INDEX IF NOT EXISTS echoverse_dm_reports_order_idx
  ON echoverse_dm_reports (created_at, id);
