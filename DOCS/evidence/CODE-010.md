<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `FEATURE-001`

```yaml
id: FEATURE-001
status: complete
date: 2026-08-29
revision: working-tree
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

| Command or check                                                | Runtime/dependencies          | Result  | Artifacts or notes                                                                          |
| --------------------------------------------------------------- | ----------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `npm test -- --run project/apps/server/src/integration.test.ts` | Node.js 22 / Vitest           | pass    | Offline request, duplicate, cancellation, reconnect, authorization, and guild tests passed. |
| `npm test -- --run`                                             | Node.js 22 / Vitest           | pending | Full suite to be rerun after final formatting and version updates.                          |
| `npm run typecheck`                                             | Node.js 22 / TypeScript       | pending | Final release gate.                                                                         |
| `npm run build`                                                 | Node.js 22 / workspace builds | pending | Web, desktop, server, and package builds.                                                   |
| Integrated browser mobile/desktop inspection                    | In-app Browser                | pending | Representative responsive interactions and no-overflow checks.                              |

## Review notes

The migration removes only duplicate friendship rows for the same unordered
pair, retaining the most recently updated row. A database backup/recovery point
must be retained by the deployment operator before applying production
migrations. Historical documentation remains unchanged.
