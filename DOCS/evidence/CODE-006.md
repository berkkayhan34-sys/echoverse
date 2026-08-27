<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-006`

```yaml
id: CODE-006
status: complete
date: 2026-08-28
revision: working tree (pending publication)
decision: decisions/0012-renderer-feature-module-ownership.md
```

## Scope

- `client-core` owns shared auth/session/socket contracts, deterministic
  feature state, media invariants, and reconnect transitions.
- `shared-ui` owns browser-safe primitives and composed workspace, server, and
  direct-message views.
- Web and desktop renderer feature modules own friends/DM commands and audio
  device effects through explicit state and capability dependencies.
- The Electron renderer continues to use the fixed-channel preload bridge; raw
  IPC is not exposed. Desktop runtime launch verification is deferred by owner
  decision; web verification is the active acceptance surface.

## Validation

| Command or check                                                                                                                         | Runtime/dependencies                            | Result                       | Artifacts or notes                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `make quality`                                                                                                                           | Node 22, Homebrew REUSE/Gitleaks, npm workspace | `pass`                       | Formatting, lint, REUSE, Gitleaks, localization (343 keys), audit, typecheck, Vitest (86 tests), and coverage passed. |
| `npm run build --workspaces --if-present`                                                                                                | Node 22, TypeScript, Vite                       | `pass`                       | Server, web, desktop, and shared packages built successfully.                                                         |
| `npm exec -- vitest run project/apps/web/src/features/direct-messages.test.ts project/apps/desktop/src/features/direct-messages.test.ts` | Vitest                                          | `pass`                       | Web and desktop DM feature modules preserve reply targets and clear composer state.                                   |
| Integrated Browser web shell check                                                                                                       | Codex in-app Browser, local Vite build          | `pass`                       | Auth shell rendered in English with no captured error or warning logs; responsive layout was visually inspected.      |
| `git diff --check`                                                                                                                       | Git                                             | `pass`                       | No whitespace errors.                                                                                                 |
| `npm run test:e2e`                                                                                                                       | Node 22, Playwright                             | `pass`                       | Four web smoke scenarios passed; desktop runtime remains deferred.                                                    |
| `npm run test:db`                                                                                                                        | PostgreSQL service                              | `deferred by owner decision` | SQLite remains the local database target; PostgreSQL is CI/service-only.                                              |

## Review notes

ADR-0012 resolves the ownership choice as per-renderer feature modules with
shared pure helpers. The extracted modules preserve existing Socket.IO event
names and state transitions, keep platform effects local, and do not add a
cross-platform lifecycle coordinator. The web bridge version identity was also
aligned with the canonical product version (`1.7.5-web`).
