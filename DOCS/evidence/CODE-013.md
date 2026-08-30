<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `1.9.1` live parity and connection hardening

```yaml
id: CODE-013
status: in_progress
version: 1.9.1
date: 2026-08-30
```

## Scope

- Web authentication remains available while the realtime socket reconnects;
  the workspace unlocks only after `auth:session` confirms the HTTP-only
  session.
- Hosted Socket.IO clients prefer polling and can explicitly retry after a
  failed connection.
- Guild message drafts are cleared only after a successful server
  acknowledgement; persistence failures return a safe localized error.
- Render's configured founder account persists the public `echoverse` guild
  before default channels and messages are written.

## Validation performed

| Check                                                                                           | Result                                                                             |
| ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm test -- --run --reporter=dot`                                                              | pass (23 files, 114 tests)                                                         |
| `npm run typecheck`                                                                             | pass                                                                               |
| `npm run lint`                                                                                  | pass                                                                               |
| `npm run format:check`                                                                          | pass                                                                               |
| `npm run build`                                                                                 | pass (desktop, web, server, shared packages)                                       |
| `npm run localization:check`                                                                    | pass (345 keys)                                                                    |
| `npm run dependency:check`                                                                      | pass (0 high-severity vulnerabilities)                                             |
| Two-account Render Socket.IO smoke (guild selection, chat ack/broadcast, voice lobby signaling) | pass                                                                               |
| Edge web smoke (login, main guild selection, durable chat message, DM/friends surface)          | pass                                                                               |
| `npm run reuse:check`                                                                           | unavailable (`reuse` CLI not installed locally)                                    |
| `npm run secret-scan`                                                                           | unavailable (`gitleaks` not installed locally)                                     |
| Windows Computer Use interactive verification                                                   | pending (two EchoVerse windows were returned, so no ambiguous window was acted on) |

## Security and recovery notes

The founder e-mail is stored only in Render's environment configuration and is
not committed to the repository. The server still authorizes guild membership,
channel access, and voice signaling server-side. A database write failure no
longer terminates the service or exposes the underlying PostgreSQL error to a
client.
