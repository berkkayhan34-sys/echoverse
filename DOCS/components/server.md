<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse server

HTTP and Socket.IO composition for the modular monolith. Feature code is
organized under `src/features`, boundary validation under `src/domain`, and
database migrations under `db/migrations`.

Run `npm run dev` from this directory or `make server-run` from the repository
root. Production requires `JWT_SECRET`, an explicit `CORS_ORIGINS` value,
`WEB_COOKIE_SECURE=true`, and an intentional `TRUST_PROXY` setting. Browser
sessions use short-lived HTTP-only cookies; desktop sessions use short-lived
access/refresh credentials returned only to the desktop client and stored by
Electron through the OS secure-storage bridge.

Set exactly one persistence mode for a running server: `DATABASE_URL` selects
PostgreSQL, while `SQLITE_PATH` selects the local SQLite adapter. Both modes
share migration IDs and the account, friendship, and direct-message schema.
SQLite backups can be restored as the local rollback path; hosted PostgreSQL
restore remains an operator-controlled deployment action.
