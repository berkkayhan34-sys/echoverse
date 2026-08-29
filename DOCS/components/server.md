<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse server

HTTP and Socket.IO composition for the modular monolith. The entrypoint keeps
process wiring, transport middleware, shared socket lifecycle, and cross-feature
composition. Feature behavior is organized under `src/features`:
`identity`, `guilds`, `chat`, `friends`, `calls`, and persistence.
selection and migration lifecycle are owned by `src/persistence/runtime.ts`;
boundary validation remains under `src/domain` and migrations under `db/migrations`.

Run `npm run dev` from this directory or `make server-run` from the repository
root. Production requires `JWT_SECRET`, an explicit `CORS_ORIGINS` value,
`WEB_COOKIE_SECURE=true`, and an intentional `TRUST_PROXY` setting. Browser
sessions use short-lived HTTP-only cookies; desktop sessions use short-lived
access/refresh credentials returned only to the desktop client and stored by
Electron through the OS secure-storage bridge.

Set exactly one persistence mode for a running server: `DATABASE_URL` selects
PostgreSQL, while `SQLITE_PATH` selects the local SQLite adapter. Both modes
share migration IDs and the account, friendship, and direct-message schema.
Guild persistence also stores the lobby display name; the `guild:rename-lobby`
event is server-authorized for owners and admins and broadcasts the updated
guild only to its members.
SQLite backups can be restored as the local rollback path; hosted PostgreSQL
restore remains an operator-controlled deployment action.

The `echoverse` main guild is reconciled idempotently at startup and during
HTTP/socket authentication. `ECHO_VERSE_MAIN_OWNER_EMAIL` identifies the
founder account from deployment configuration; existing accounts are backfilled
as members and new accounts are enrolled without changing private-guild invite
authorization. If historical membership rows are missing, the fixed main-guild
identifier remains publicly readable/selectable while no account is promoted to
owner/admin without the configured founder identity. The value is never stored
in source or logs.

WebRTC signaling is authorized per transport boundary: active private calls
may relay only between their two call participants, while guild voice offers,
answers, and ICE candidates may relay only between authenticated sockets that
are currently in the same guild voice lobby. A socket outside that lobby is
denied even when it knows another socket's identifier.
