<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-007`

```yaml
id: CODE-007
status: complete
date: 2026-08-28
revision: working tree (pending publication)
```

## Scope

- Socket.IO integration tests cover authorized guild admission, join/leave
  boundaries, call connect/end, unanswered-call timeout, malformed signaling,
  stale signaling after call cleanup, disconnect cleanup, and authorization.
- Attachment tests cover oversized payloads and MIME/data mismatches at the
  server boundary.
- `client-core` tests cover fail-closed microphone/deafen/push-to-talk state,
  bounded screen-share constraints, and reconnect lobby reconciliation.

## Validation

| Command or check                                                                                                     | Runtime/dependencies                      | Result                       | Artifacts or notes                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `npm exec -- vitest run project/apps/server/src/integration.test.ts -t 'rejects malformed and stale WebRTC signals'` | Node 22, Socket.IO, SQLite/memory runtime | `pass`                       | Malformed offer, active-call answer, disconnect cleanup, and stale post-cleanup relay were exercised.                                    |
| `npm exec -- vitest run project/apps/server/src/integration.test.ts`                                                 | Node 22, Socket.IO, SQLite/memory runtime | `pass`                       | Complete server boundary suite passed, including call timeout, guild join, authorization, attachment size/MIME, and signaling scenarios. |
| `npm exec -- vitest run project/packages/client-core/src/index.test.ts`                                              | Vitest                                    | `pass`                       | Microphone/deafen/push-to-talk, bounded screen constraints, and reconnect transitions passed.                                            |
| `make quality`                                                                                                       | Node 22, repository gates                 | `pass`                       | Full quality suite passed with the regression tests included.                                                                            |
| PostgreSQL integration                                                                                               | PostgreSQL service                        | `deferred by owner decision` | SQLite is the authorized local database target; PostgreSQL remains CI/service-only.                                                      |

## Review notes

The tests exercise server-authoritative signaling and cleanup rather than
mocking away the authorization boundary. Native microphone, camera, screen,
and desktop runtime permissions are not claimed as verified here; desktop
runtime verification remains deferred by owner decision.
