-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

ALTER TABLE echoverse_dm_messages ADD COLUMN reply_to_id TEXT;
ALTER TABLE echoverse_dm_messages ADD COLUMN edited_at TEXT;
ALTER TABLE echoverse_dm_messages ADD COLUMN deleted_at TEXT;
ALTER TABLE echoverse_dm_messages ADD COLUMN attachment_name TEXT;
ALTER TABLE echoverse_dm_messages ADD COLUMN attachment_mime TEXT;
ALTER TABLE echoverse_dm_messages ADD COLUMN attachment_data TEXT;
ALTER TABLE echoverse_dm_messages ADD COLUMN reactions TEXT NOT NULL DEFAULT '{}';
