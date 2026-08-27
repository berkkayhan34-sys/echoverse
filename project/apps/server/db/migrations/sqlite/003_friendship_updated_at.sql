-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

ALTER TABLE echoverse_friendships ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';
UPDATE echoverse_friendships SET updated_at = created_at WHERE updated_at = '';
