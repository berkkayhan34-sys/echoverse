<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0009: v2 runtime cutover

- Status: Accepted
- Date: 2026-08-27

## Decision

The runtime is cut over to an npm-workspaces modular monolith under `project/apps/`
and `project/packages/`. The Socket.IO handshake identifies protocol version 2. Web
and desktop are updated together; clients that do not advertise v2 are
rejected by the server.

The server keeps one deployable process while separating validation, runtime
state, feature utilities, configuration, and persistence migrations. Hosted
PostgreSQL migrations and the local SQLite adapter have parallel, versioned
SQL histories with the same migration IDs and table/column contract. SQLite is
selected explicitly with `SQLITE_PATH`; PostgreSQL is selected explicitly with
`DATABASE_URL`, and configuring both is rejected.

## Migration and rollback

The cutover is a path move with no data deletion. The previous known-good
commit is `1ab4dd2`. To roll back, restore that commit and redeploy the prior
paths; database migrations are additive and can remain applied.

## Consequences

- Build, typecheck, Vitest, Playwright, and dependency gates run from one root.
- Protocol and input validation are shared by clients and server.
- Existing persisted tables retain their names and columns across PostgreSQL
  and SQLite. SQLite backup/restore is the local rollback mechanism; hosted
  PostgreSQL rollback remains an operational restore procedure.
- Full feature-by-feature extraction of the large renderer files remains a
  bounded follow-up, but no new runtime may be added outside `project/apps/`.

## Evidence

`npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e` pass on
the cutover tree. Production database execution and installer packaging remain
environment-dependent release checks.
