<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `BUG-001`

```yaml
id: BUG-001
status: complete
date: 2026-08-29
revision: working tree (pre-release)
```

## Scope

- Guild voice WebRTC offers, answers, and ICE candidates are relayed only
  between authenticated sockets in the same active voice lobby.
- Private-call signaling remains restricted to the active call participants
  who are friends.
- Unauthenticated or cross-lobby sockets cannot relay signaling by guessing a
  socket identifier.

## Validation

| Check                                                                                        | Result      | Evidence                                                                                          |
| -------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `npm test -- --run project/apps/server/src/integration.test.ts -t "relays WebRTC signaling"` | pass        | Same-lobby offer relay and unauthenticated outsider denial passed.                                |
| `npm test -- --run`                                                                          | pass        | 20 test files and 102 tests passed, including private-call and guild-voice signaling regressions. |
| `npm run typecheck`                                                                          | pass        | All workspace packages typechecked successfully.                                                  |
| `npm run build`                                                                              | pass        | Desktop, web, server, and shared packages built successfully.                                     |
| `npm run lint`                                                                               | pass        | ESLint completed without findings.                                                                |
| `npm run dependency:check`                                                                   | pass        | `npm audit --audit-level=high` found 0 vulnerabilities.                                           |
| `npm run reuse:check`                                                                        | unavailable | Repository script reported that the `reuse` CLI is not installed on this machine.                 |
| Production deployment/release                                                                | pending     | This fix is unreleased; the next release must include it.                                         |

## Security notes

The server checks the authoritative in-memory voice-room membership for both
socket IDs before relaying. The existing SDP/ICE schemas and per-socket rate
limits remain in force; no client-side authorization is trusted.
