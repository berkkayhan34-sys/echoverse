-- SPDX-FileCopyrightText: 2026 EchoVerse contributors
-- SPDX-License-Identifier: GPL-3.0-only

-- Older development builds persisted placeholder labels. Normalize only those
-- known placeholders; user-selected lobby names are intentionally preserved.
UPDATE echoverse_guilds
SET lobby_name = 'Lobby'
WHERE lower(trim(lobby_name)) IN ('testlobby', 'test lobby', 'testlooby', 'join lobby');
