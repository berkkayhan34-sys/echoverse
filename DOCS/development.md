<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Development workflow

This is the local workflow for the v2 modular-monolith workspace.

## Prerequisites

Use Node.js 22 LTS and the repository-supported package manager. Install
dependencies through the root npm workspace. App-specific commands remain
available in `apps/server/`, `apps/web/`, and `apps/desktop/`. Run `npm ci` at
the repository root; the root workspace lockfile is canonical. Do not
commit generated `node_modules`, `dist`, `release`, logs, or local databases.

GNU Make 4.4.1 is used for the repository targets. On Windows, install it with
the WinGet package `ezwinports.make` and restart the terminal so the updated
PATH is loaded.

## Current workspaces

- `apps/server/` — backend development and start scripts;
- `apps/web/` — browser client development/build;
- `apps/desktop/` — Electron development/build/package scripts;
- `packages/contracts/` — protocol v2 DTOs and boundary schemas;
- `packages/client-core/` — browser-safe session helpers;
- `packages/shared-ui/` — browser-safe shared UI primitives;
- `packages/config/` — validated server configuration;

## Local configuration

Desktop runtime settings are read from `apps/desktop/config.json`. Keep a local
server URL and placeholder integration identifiers there; do not put secrets in
that file or in examples. `apps/server/render.yaml` is the authoritative Render
manifest; the root `render.yaml` is a compatibility mirror for service
discovery only. Keep shared service identity and command fields synchronized,
but keep environment configuration authoritative in `apps/server/render.yaml`;
do not maintain two independent deployment definitions. Changes to either
manifest must run `make roadmap-check`. Retiring the root mirror or changing
this policy requires an ADR with a rollback path.

For a local server, use `http://localhost:3001` (or the port configured by the
server) and start the server before starting web/desktop. For hosted use, use
the HTTPS endpoint supplied by the approved deployment and verify CORS, TLS,
secret configuration, health, and logs before sharing an installer.

## Hosted backend and installer

The current Render setup installs from the repository root and starts
`@echoverse/server` through the workspace script.
Required environment variables must be declared and reviewed through the
authoritative `apps/server/render.yaml`; never replace a secret with a value copied
into a YAML file.

To build a Windows installer locally, run the existing desktop build script
from `apps/desktop/` and inspect `apps/desktop/release/`. Treat the output as an
unverified local artifact until the release checks, integrity metadata, and
signing/publisher decision in [release.md](release.md) pass.

## Make targets

From the repository root, `make help` lists the supported developer entrypoints.
Use `make setup` to install the server, web, and desktop dependencies, and
`make tooling-check` to verify Node.js 22 LTS. Use `make ai-check` for a safe
documentation/metadata gate, `make server-run`
to start the local backend, and `make ai-server-test` in a second terminal to
check its `/health` endpoint. `make release-check` validates version metadata
without creating artifacts; platform-specific `make release-*` targets create
local build output and are not a publication action.

## Disposable work paths

`work/` is for generated evidence, local design notes, and intermediate
artifacts. `.tmp/` is for short-lived scratch data. Both are ignored by Git and
must be treated as disposable: never store secrets, credentials, production
data, or the only copy of an important result there. `make work-init` creates
the directories when needed.

Read the package README and scripts before running a workspace command. Keep
environment files local and use placeholders in examples; never paste real
tokens, cookies, database URLs, or signing keys into Git or issue trackers.

## Version changes

1. Change root `VERSION`.
2. Mirror the exact value in package manifests required by tooling.
3. Update the roadmap/changelog and relevant release notes.
4. Run the metadata and workflow validation described in `release.md`.
5. Use a tag in the form `v<value>` only after the release decision is approved.

## Branches and reviews

Use a focused `docs/<topic>` branch for documentation/governance work unless
the owner explicitly directs another path. Pull requests must state scope,
validation, security impact, and deferred runtime work. Do not commit or push
from an agent session unless explicitly requested.
