<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `FEATURE-001`

```yaml
id: FEATURE-001
status: complete
date: 2026-08-29
revision: 7978e34197a113c24aa5b8da8df28180e031dc52 (v1.8.5)
```

## Scope

- Friend search/request/response/cancel lifecycle now works for offline users,
  rejects duplicate relationships, and reconciles after reconnect.
- The deployment-configured founder reconciliation backfills the public
  `echoverse` guild for existing accounts and keeps new accounts enrolled.
- Legacy placeholder lobby names are normalized while custom names remain
  editable by owners and admins through the shared responsive workspace.
- The responsive web/desktop renderer uses a Discord-style mobile server rail,
  channel navigator, DM/friends entry points, and touch-safe bottom navigation.
- Spotify Together is removed from the active protocol, runtime, UI, bridge,
  configuration, localization, tests, and documentation; only its exact legacy
  token path is cleaned during desktop startup.

## Security and invariants

- Friendship operations remain authenticated and server-authorized; pending
  cancellation is limited to the original requester.
- Guild visibility and membership remain server-side and private guilds still
  require membership/invite authorization.
- Migration deduplication keeps one deterministic relationship per unordered
  account pair before enforcing the unique expression index.

## Validation

| Command or check                                                | Runtime/dependencies          | Result  | Artifacts or notes                                                                                                                                                               |
| --------------------------------------------------------------- | ----------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --run project/apps/server/src/integration.test.ts` | Node.js 22 / Vitest           | pass    | Offline request, duplicate, cancellation, reconnect, authorization, and guild tests passed.                                                                                      |
| `npm test -- --run`                                             | Node.js 22 / Vitest           | pass    | 20 test files and 100 tests passed.                                                                                                                                              |
| `npm run typecheck`                                             | Node.js 22 / TypeScript       | pass    | All workspace packages type-checked successfully.                                                                                                                                |
| `npm run build`                                                 | Node.js 22 / workspace builds | pass    | Web, desktop, server, and package builds completed successfully.                                                                                                                 |
| `npm run format:check`                                          | Node.js 22 / Prettier         | pass    | Repository formatting check passed.                                                                                                                                              |
| `npm run lint`                                                  | Node.js 22 / ESLint           | pass    | Lint completed with no findings.                                                                                                                                                 |
| `npm run dependency:check` / `npm audit --audit-level=high`     | Node.js 22 / npm              | pass    | Dependency checks passed; 0 high-or-critical vulnerabilities reported.                                                                                                           |
| `node DOCS/tools/validate-roadmap.mjs`                          | Node.js 22                    | pass    | Roadmap schema and status validation passed.                                                                                                                                     |
| GitHub Quality Gate + PostgreSQL migration job                  | GitHub Actions                | pass    | Release revision passed CI quality and database migration gates.                                                                                                                 |
| GitHub Release workflow                                         | GitHub Actions                | pass    | Windows and macOS installer artifacts published for `v1.8.5`.                                                                                                                    |
| Render `/health`                                                | Render / PostgreSQL           | pass    | Public health endpoint returned HTTP 200 and version `1.8.5`.                                                                                                                    |
| GitHub Pages web manifest                                       | GitHub Pages                  | pass    | Web manifest reports version `1.8.5` and the expected commit revision.                                                                                                           |
| Integrated browser mobile/desktop inspection                    | In-app Browser                | partial | At 390x844, landing/settings views rendered without horizontal overflow. Authenticated workspace interaction was not run because credential-entry confirmation was not provided. |

## Review notes

The migration removes only duplicate friendship rows for the same unordered
pair, retaining the most recently updated row. A database backup/recovery point
must be retained by the deployment operator before applying production
migrations. Historical documentation remains unchanged. The authenticated
workspace visual flow remains unverified; the browser result above is limited
to the public landing/settings surface and responsive overflow checks.
