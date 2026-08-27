<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Repository structure

This is the implemented map for the modular-monolith cutover. It deliberately
separates application entrypoints, shared packages, documentation, and
operational configuration.

```text
echoverse/
├─ project/
│  ├─ apps/
│  │  ├─ server/       # HTTP and Socket.IO composition
│  │  ├─ web/          # browser application
│  │  └─ desktop/      # Electron main, preload, and renderer shell
│  ├─ packages/
│  │  ├─ contracts/    # event names, DTOs, schemas, protocol versions
│  │  ├─ client-core/  # shared session, auth, socket, and feature state
│  │  ├─ shared-ui/    # browser-safe components and design primitives
│  │  └─ config/       # environment parsing and endpoint configuration
├─ DOCS/
│  ├─ architecture/   # target structure and boundary maps
│  ├─ decisions/      # accepted and unresolved ADRs
│  ├─ evidence/       # reproducible validation artifacts
│  ├─ audits/         # risk and quality reviews
│  └─ historic/       # immutable V1.* release/setup notes
├─ .github/            # contribution, security, ownership, and automation
├─ VERSION             # canonical product version
├─ LICENSE             # GPL-3.0-only license text
├─ REUSE.toml          # SPDX/REUSE annotations
├─ README.md           # English product entrypoint
├─ README-TR.md        # Turkish product entrypoint
└─ tmp/                # ignored generated/local state
```

## Current-to-target mapping

| Current path            | Target responsibility                     | Constraint                                                                      |
| ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| `project/apps/server/`  | backend application                       | Keep transport composition separate from feature modules.                       |
| `project/apps/web/`     | browser application plus shared packages  | Shared contracts/core are the integration boundary.                             |
| `project/apps/desktop/` | Electron application plus shared packages | Keep native APIs behind the Electron boundary.                                  |
| `src/`                  | retired legacy entrypoint                 | Removed in v2 cutover; restore only by rollback to `1ab4dd2`.                   |
| `DOCS/`                 | canonical documentation                   | Keep new policy in the canonical files indexed by `DOCS/README.md`.             |
| `tmp/`                  | ignored generated/local state             | Keep build output, reports, environments, runtime data, and scratch files here. |
| `DOCS/historic/`        | immutable historical V1.* notes           | Do not add new policy or current setup guidance here.                           |

## Dependency direction

`contracts` and browser-safe shared packages may be consumed by web and desktop.
Feature modules may depend on contracts and infrastructure interfaces, but
transport and platform adapters must not become a hidden shared global. Server
domain code must not import Electron or renderer modules.

## Ownership and navigation

Each target package needs a named owner, public entrypoint, test location, and
README before the cutover. The repository root stays intentionally small:
version/license/governance, workspace tooling, and links to canonical docs.

## Ownership and navigation map

The repository owner listed in [CODEOWNERS](../../.github/CODEOWNERS) owns the
current application and package surfaces. The map below records the actual
entrypoints and test locations; an absent focused test file is an explicit
quality gap, not evidence that the surface is fully tested.

| Surface or capability        | Current owner and boundary                                                                                                                  | Public entrypoint                                                                                                              | Focused tests                                                                                     | README                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Server transport             | `project/apps/server/` HTTP and Socket.IO composition                                                                                       | `project/apps/server/src/index.ts`                                                                                             | `project/apps/server/src/index.test.ts`                                                           | [`server component reference`](../components/server.md)           |
| Chat feature                 | `project/apps/server/src/features/chat/`                                                                                                    | `project/apps/server/src/features/chat/commands.ts`                                                                            | `project/apps/server/src/features/chat/commands.test.ts`                                          | [`server component reference`](../components/server.md)           |
| Other server capabilities    | `project/apps/server/src/index.ts` pending feature extraction: identity/accounts, guilds/presence, friends/DM, calls/signaling, and Spotify | `project/apps/server/src/index.ts`                                                                                             | `project/apps/server/src/index.test.ts`; feature-specific coverage is pending                     | [`server component reference`](../components/server.md)           |
| Server validation and limits | `project/apps/server/src/domain/` and `project/apps/server/src/runtime/`                                                                    | `project/apps/server/src/domain/validation.ts`                                                                                 | Covered by the current server tests; broader boundary cases are roadmap work                      | [`server component reference`](../components/server.md)           |
| Server persistence           | `project/apps/server/src/persistence/` and `project/apps/server/db/`                                                                        | `project/apps/server/src/persistence/migrations.ts`, `sqlite.ts`, and `sqlite-migrations.ts`                                   | `project/apps/server/src/persistence/sqlite.test.ts`; PostgreSQL coverage in `database.dbtest.ts` | [`server component reference`](../components/server.md)           |
| Web client                   | `project/apps/web/` browser entrypoint                                                                                                      | `project/apps/web/src/main.tsx` and `project/apps/web/src/App.tsx`                                                             | `project/tests/e2e/smoke.spec.ts`; no web-local unit suite yet                                    | [`web component reference`](../components/web.md)                 |
| Desktop client               | `project/apps/desktop/` Electron shell and renderer                                                                                         | `project/apps/desktop/electron/main.cjs`, `project/apps/desktop/electron/preload.cjs`, and `project/apps/desktop/src/main.tsx` | `project/tests/e2e/smoke.spec.ts`; installer smoke coverage is pending                            | [`desktop component reference`](../components/desktop.md)         |
| Protocol contracts           | `project/packages/contracts/`                                                                                                               | `project/packages/contracts/src/index.ts`                                                                                      | `project/packages/contracts/src/index.test.ts`                                                    | [`contracts component reference`](../components/contracts.md)     |
| Shared client core           | `project/packages/client-core/`                                                                                                             | `project/packages/client-core/src/index.ts`                                                                                    | No focused test file yet                                                                          | [`client-core component reference`](../components/client-core.md) |
| Shared UI                    | `project/packages/shared-ui/` browser-safe primitives                                                                                       | `project/packages/shared-ui/src/index.tsx`                                                                                     | No focused test file yet                                                                          | [`shared-ui component reference`](../components/shared-ui.md)     |
| Configuration                | `project/packages/config/` validated environment configuration                                                                              | `project/packages/config/src/index.ts`                                                                                         | `project/packages/config/src/index.test.ts`                                                       | [`config component reference`](../components/config.md)           |

The server feature rows that currently point to `index.ts` are intentionally
documented as pending extraction. The extraction child must move ownership,
schemas, authorization, and focused tests together; this map must then be
updated with the new public boundaries.

The root `src/`, `server/`, `web/`, and `desktop/` paths are absent. They are
not alternate implementation surfaces and must not be recreated for new work.
