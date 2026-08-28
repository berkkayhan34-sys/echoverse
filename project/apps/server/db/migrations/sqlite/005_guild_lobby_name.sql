-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

ALTER TABLE echoverse_guilds
  ADD COLUMN lobby_name TEXT NOT NULL DEFAULT 'Lobby';
