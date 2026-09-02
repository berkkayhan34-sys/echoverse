-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

CREATE INDEX IF NOT EXISTS echoverse_dm_messages_deleted_at_idx
  ON echoverse_dm_messages(deleted_at);
CREATE INDEX IF NOT EXISTS echoverse_guild_messages_deleted_at_idx
  ON echoverse_guild_messages(deleted_at);
CREATE INDEX IF NOT EXISTS echoverse_guild_reports_created_at_idx
  ON echoverse_guild_reports(created_at);
CREATE INDEX IF NOT EXISTS echoverse_guild_audit_created_at_idx
  ON echoverse_guild_audit_events(created_at);
