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
├─ apps/
│  ├─ server/          # HTTP and Socket.IO composition
│  ├─ web/             # browser application
│  └─ desktop/         # Electron main, preload, and renderer shell
├─ packages/
│  ├─ contracts/       # event names, DTOs, schemas, protocol versions
│  ├─ client-core/     # shared session, auth, socket, and feature state
│  ├─ shared-ui/       # browser-safe components and design primitives
│  └─ config/          # environment parsing and endpoint configuration
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
└─ README-TR.md        # owner-facing entrypoint and documentation index
```

## Current-to-target mapping

| Current path     | Target responsibility                     | Constraint                                                          |
| ---------------- | ----------------------------------------- | ------------------------------------------------------------------- |
| `apps/server/`   | backend application                       | Keep transport composition separate from feature modules.           |
| `apps/web/`      | browser application plus shared packages  | Shared contracts/core are the integration boundary.                 |
| `apps/desktop/`  | Electron application plus shared packages | Keep native APIs behind the Electron boundary.                      |
| `src/`           | retired legacy entrypoint                 | Removed in v2 cutover; restore only by rollback to `1ab4dd2`.       |
| `DOCS/`          | canonical documentation                   | Keep new policy in the canonical files indexed by `DOCS/README.md`. |
| `DOCS/historic/` | immutable historical V1.* notes           | Do not add new policy or current setup guidance here.               |

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

| Surface or capability        | Current owner and boundary                                                                                                          | Public entrypoint                                                                                      | Focused tests                                                                | README                                                                   |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Server transport             | `apps/server/` HTTP and Socket.IO composition                                                                                       | `apps/server/src/index.ts`                                                                             | `apps/server/src/index.test.ts`                                              | [`apps/server/README.md`](../../apps/server/README.md)                   |
| Chat feature                 | `apps/server/src/features/chat/`                                                                                                    | `apps/server/src/features/chat/commands.ts`                                                            | `apps/server/src/features/chat/commands.test.ts`                             | [`apps/server/README.md`](../../apps/server/README.md)                   |
| Other server capabilities    | `apps/server/src/index.ts` pending feature extraction: identity/accounts, guilds/presence, friends/DM, calls/signaling, and Spotify | `apps/server/src/index.ts`                                                                             | `apps/server/src/index.test.ts`; feature-specific coverage is pending        | [`apps/server/README.md`](../../apps/server/README.md)                   |
| Server validation and limits | `apps/server/src/domain/` and `apps/server/src/runtime/`                                                                            | `apps/server/src/domain/validation.ts`                                                                 | Covered by the current server tests; broader boundary cases are roadmap work | [`apps/server/README.md`](../../apps/server/README.md)                   |
| Server persistence           | `apps/server/src/persistence/` and `apps/server/db/`                                                                                | `apps/server/src/persistence/migrations.ts`                                                            | `apps/server/src/index.test.ts`; adapter coverage is pending                 | [`apps/server/README.md`](../../apps/server/README.md)                   |
| Web client                   | `apps/web/` browser entrypoint                                                                                                      | `apps/web/src/main.tsx` and `apps/web/src/App.tsx`                                                     | `tests/e2e/smoke.spec.ts`; no web-local unit suite yet                       | [`apps/web/README.md`](../../apps/web/README.md)                         |
| Desktop client               | `apps/desktop/` Electron shell and renderer                                                                                         | `apps/desktop/electron/main.cjs`, `apps/desktop/electron/preload.cjs`, and `apps/desktop/src/main.tsx` | `tests/e2e/smoke.spec.ts`; installer smoke coverage is pending               | [`apps/desktop/README.md`](../../apps/desktop/README.md)                 |
| Protocol contracts           | `packages/contracts/`                                                                                                               | `packages/contracts/src/index.ts`                                                                      | `packages/contracts/src/index.test.ts`                                       | [`packages/contracts/README.md`](../../packages/contracts/README.md)     |
| Shared client core           | `packages/client-core/`                                                                                                             | `packages/client-core/src/index.ts`                                                                    | No focused test file yet                                                     | [`packages/client-core/README.md`](../../packages/client-core/README.md) |
| Shared UI                    | `packages/shared-ui/` browser-safe primitives                                                                                       | `packages/shared-ui/src/index.tsx`                                                                     | No focused test file yet                                                     | [`packages/shared-ui/README.md`](../../packages/shared-ui/README.md)     |
| Configuration                | `packages/config/` validated environment configuration                                                                              | `packages/config/src/index.ts`                                                                         | `packages/config/src/index.test.ts`                                          | [`packages/config/README.md`](../../packages/config/README.md)           |

The server feature rows that currently point to `index.ts` are intentionally
documented as pending extraction. The extraction child must move ownership,
schemas, authorization, and focused tests together; this map must then be
updated with the new public boundaries.

The root `src/`, `server/`, `web/`, and `desktop/` paths are absent. They are
not alternate implementation surfaces and must not be recreated for new work.
