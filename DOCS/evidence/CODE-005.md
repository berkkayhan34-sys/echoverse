<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-005`

```yaml
id: CODE-005
status: complete
date: 2026-08-27
revision: f876bbb
decision: decisions/0011-authorization-boundaries.md
```

## Scope

- Protected identity, guild, presence, friendship, direct-message, call,
  signaling and chat operations now authorize from server-side
  account, membership, friendship, room, and active-call state.
- Custom guild lists are filtered to the default guild or a server-recorded
  membership. Joining by code records membership before room entry.
- Call control and WebRTC relay use explicit participant identities; active
  calls remain authorized after the initial answer and are cleaned up on
  disconnect.
- No database schema or public event shape changed. PostgreSQL remains a
  CI/service-only validation target by owner decision.

## Validation

| Command or check                                                                                | Runtime/dependencies                   | Result                                    | Artifacts or notes                                                                          |
| ----------------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------- |
| `npm exec -- vitest run project/apps/server/src/integration.test.ts -t 'limits guild membership | blocks cross-user direct-message       | expires unanswered calls' --reporter=dot` | Node, Socket.IO, SQLite/memory runtime                                                      | pass | Focused scenarios passed for guild admission, friend-scoped presence, cross-user DM denial, active-call participant checks, signaling relay, and call cleanup. |
| `npm test -- --reporter=dot`                                                                    | Node/npm workspace dependencies        | pass                                      | 14 test files and 59 tests passed.                                                          |
| `npm run typecheck`                                                                             | TypeScript workspace dependencies      | pass                                      | All available workspaces typechecked without errors.                                        |
| `npm run build`                                                                                 | Vite/TypeScript workspace dependencies | pass                                      | Desktop, server, web, and package builds completed.                                         |
| `npm run lint` plus JSON result check                                                           | ESLint workspace dependency            | pass                                      | 65 files checked; 0 errors and 0 warnings.                                                  |
| `npm run localization:check`                                                                    | Node and repository source             | pass                                      | 335 catalog keys and visible-text constraints passed.                                       |
| `npm run format:check`                                                                          | Prettier workspace dependency          | pass                                      | All repository files matched the formatter.                                                 |
| `git diff --check`                                                                              | Git                                    | pass                                      | No whitespace errors in the working-tree diff.                                              |
| `make ai-check`                                                                                 | Repository tooling                     | pass                                      | Roadmap, decision, documentation, metadata, and repository-boundary checks passed.          |
| `make reuse-check`                                                                              | Homebrew REUSE 6.2.0                   | pass                                      | All 211 repository files passed the REUSE scope check.                                      |
| `make secret-scan`                                                                              | Homebrew Gitleaks 8.30.1               | pass                                      | 67 commits scanned with no leaks found.                                                     |
| `npm run dependency:check`                                                                      | npm audit                              | pass                                      | No high-severity or higher dependency vulnerabilities found.                                |
| `npm run test:db`                                                                               | PostgreSQL service and `DATABASE_URL`  | deferred by decision                      | Owner authorized SQLite-only local testing; PostgreSQL integration remains CI/service-only. |

## Review notes

The authorization decision is recorded in ADR-0011. The implementation does
not treat client visibility, arbitrary socket IDs, or renderer state as an
authorization boundary. Unauthorized operations fail closed or are not relayed.
The current evidence proves the changed server paths and their negative tests;
further authorization work is not a blocker for this child, while later media,
client-core, operational, and release roadmap items retain their own scope.
