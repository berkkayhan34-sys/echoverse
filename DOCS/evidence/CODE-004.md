<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-004`

```yaml
id: CODE-004
status: complete
date: 2026-08-27
revision: working tree (pending publication)
```

## Scope

- Feature ownership moved from the server entrypoint into `features/identity`,
  `features/guilds`, `features/chat`, `features/friends`, `features/calls`,
  and `features/spotify`.
- Account and direct-message persistence access remains behind feature services;
  database selection, migration, and shutdown lifecycle moved to
  `persistence/runtime.ts`.
- The single server process and existing HTTP/Socket.IO contracts remain
  composed by `src/index.ts`; obsolete inline handlers were removed.
- Authorization policy behavior was preserved, while completeness and negative
  authorization coverage remain the dedicated `CODE-005` scope.

## Validation

| Command or check                                                                           | Runtime/dependencies                   | Result               | Artifacts or notes                                                                                                                                                 |
| ------------------------------------------------------------------------------------------ | -------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test -- --reporter=dot`                                                               | Node/npm workspace dependencies        | pass                 | 14 test files and 59 tests passed, including server integration, identity accounts, guild services, chat commands, SQLite persistence, and localization contracts. |
| `npm run typecheck`                                                                        | TypeScript workspace dependencies      | pass                 | Server and all available workspace packages typechecked without errors.                                                                                            |
| `npm run build`                                                                            | Vite/TypeScript workspace dependencies | pass                 | Desktop, server, web, contracts, config, client-core, and shared-ui builds completed.                                                                              |
| `npm run lint` plus JSON result check                                                      | ESLint workspace dependency            | pass                 | 65 files checked; 0 errors and 0 warnings.                                                                                                                         |
| `npm run format:check`                                                                     | Prettier workspace dependency          | pass                 | All repository files matched the formatter.                                                                                                                        |
| `npm run localization:check`                                                               | Node and repository source             | pass                 | 335 catalog keys and application visible-text constraints passed.                                                                                                  |
| `npm exec -- vitest run project/apps/server/src/persistence/sqlite.test.ts --reporter=dot` | Node and SQLite                        | pass                 | 1 focused file and 2 tests passed.                                                                                                                                 |
| `git diff --check`                                                                         | Git                                    | pass                 | No whitespace errors in the complete working-tree diff.                                                                                                            |
| `make ai-check`                                                                            | Repository tooling                     | pass                 | Version, metadata, roadmap, documentation, repository-boundary, and no-daemon checks passed.                                                                       |
| `make reuse-check`                                                                         | Homebrew REUSE 6.2.0                   | pass                 | All 211 repository files passed the REUSE scope check.                                                                                                             |
| `make secret-scan`                                                                         | Homebrew Gitleaks 8.30.1               | pass                 | 67 commits scanned with no leaks found.                                                                                                                            |
| `npm run dependency:check`                                                                 | npm audit                              | pass                 | No high-severity or higher dependency vulnerabilities found.                                                                                                       |
| `npm run test:db`                                                                          | PostgreSQL service and `DATABASE_URL`  | deferred by decision | Owner authorized SQLite-only local testing; PostgreSQL integration remains CI/service-only and is not a blocker for this slice.                                    |

## Review notes

The server entrypoint is now a process and transport composition boundary of
499 lines. Feature handlers own their event schemas and behavior; identity also
owns HTTP authentication routes, and persistence owns database lifecycle. The
architecture ownership map and server component reference were updated to match
the implementation. No new dependency, process, or alternate server path was
introduced. Desktop runtime verification remains explicitly deferred under the
approved localization decision and is unrelated to this server extraction.
