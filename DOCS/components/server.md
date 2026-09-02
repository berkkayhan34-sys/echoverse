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

Channel and guild-message state is durable in both adapters through migration
`008_spaces_channels_messages.sql`. `guild:channels`, `guild:create-channel`,
and `guild:update-channel` expose ordered text/voice/stage/forum channels while
retaining the legacy general/lobby aliases. `chat-message` now persists guild
messages; `chat-history`, `chat-search`, edit/delete, pin, and reaction events
are membership- and permission-checked before broadcast.

`guild:moderate-member` supports kick, ban, timeout, and unban with owner
protection, bounded duration, and privacy-safe audit records returned through
`guild:audit`. The permission evaluator lives in
`src/features/guilds/permissions.ts`; client visibility is not an authority
boundary.
SQLite backups can be restored as the local rollback path; hosted PostgreSQL
restore remains an operator-controlled deployment action.

Retention is owned by `src/persistence/retention.ts`. After migrations the
server removes moderation/report records older than 180 days and permanently
removes only DM or guild messages whose soft-delete tombstone is older than
180 days. The same pass runs every six hours with an unref'd timer and is
stopped before database shutdown; failures are surfaced through structured
diagnostics, while a failed maintenance interval is retried on the next
interval and a failed startup pass aborts startup.

The `echoverse` main guild is reconciled idempotently at startup and during
HTTP/socket authentication. `ECHO_VERSE_MAIN_OWNER_EMAIL` identifies the
founder account from deployment configuration. Existing accounts are backfilled
as members and new accounts are enrolled without changing private-guild invite
authorization. If historical membership or default-channel rows are missing,
the fixed main-guild identifier and its
`general`/`Lobby` channels remain readable/selectable while repair completes.
No account is promoted to owner/admin without the configured founder identity,
and the identity value is never stored in source or logs.

Private guild owners can permanently delete their guild through the
`guild:delete` socket event. The server rejects the public `echoverse` guild,
non-owners, and any private guild that has a member other than the owner or the
two explicitly allowlisted test accounts (`test@test.com` and
`test2@test2.com`). The persisted guild row is deleted in one operation so the
database foreign-key cascades remove channels, messages, invites, memberships,
moderation, audit, and permission-override records; connected members receive
an updated guild list and are removed from the deleted guild's rooms.

WebRTC signaling is authorized per transport boundary: active private calls
may relay only between their two call participants, while guild voice offers,
answers, and ICE candidates may relay only between authenticated sockets that
are currently in the same guild voice lobby. A socket outside that lobby is
denied even when it knows another socket's identifier.
