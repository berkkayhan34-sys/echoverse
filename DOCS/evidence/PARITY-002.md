<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-002 — DM navigation and inbox

```yaml
id: PARITY-002
status: complete
date: 2026-09-01
revision: working-tree on codex/parity-001-2-notifications-unread
```

Status: complete on the working branch.

## Scope implemented

- Replaced the modal-only DM entrypoint with a persistent DM rail shared by
  web and desktop renderers.
- Added searchable Friends and group-conversation lists, message-request
  entrypoint, active-conversation navigation, and unread badges.
- Added an inbox landing view when no conversation is selected, with the same
  navigation available on the responsive mobile layout.
- Group unread keys now use the conversation ID, so fan-out messages do not
  appear under an unrelated sender in the DM rail.
- Existing server-side friendship, message-request, group-membership, and
  history authorization boundaries remain unchanged.

## Acceptance mapping

| Acceptance criterion                                                              | Check/evidence                                                                                                                                       | Result                                                                                               |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Direct and group conversations remain available after restart                     | Existing persisted friendship/group conversation service and integration coverage; inbox reads the server conversation list on authenticated session | verified                                                                                             |
| Unread counts reconcile across web and desktop                                    | Shared event handling uses the same direct/group key and the shared inbox renders the resulting state in both renderers                              | verified for live session reconciliation; durable DM read markers remain a future server-backed item |
| Opening a conversation cannot grant access to a non-member                        | Existing `dm:history` and group membership authorization tests remain green; UI only opens server-returned conversations                             | verified                                                                                             |
| Mobile navigation has an equivalent reachable path                                | Authenticated Playwright screenshot at 390×844 shows the DM inbox through the mobile navigation                                                      | verified                                                                                             |
| Search, Friends, requests, group list, and unread markers are rendered accessibly | Shared UI regression test and desktop/mobile Playwright screenshots                                                                                  | verified                                                                                             |

## Validation run

- `npm test -- --run` — pass (25 files, 139 tests).
- `npm run typecheck -- --pretty false` — pass for all packages.
- `npm run lint` — pass.
- `npm run format:check` — pass.
- `npm run localization:check` — pass (407 keys).
- `npm run build` — pass (server, shared packages, web, and desktop
  renderer/preload builds).
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3123 npx playwright test
project/tests/e2e/smoke.spec.ts --reporter=line` — pass (4 tests).
- Authenticated Playwright flow against the local built renderer passed at
  1280×720 and 390×844. Screenshots:
  `tmp/test-results/PARITY-002-dm-inbox-desktop.png` and
  `tmp/test-results/PARITY-002-dm-inbox-mobile.png`.
- `git diff --check` — pass.
- `npm run secret-scan` — not run to completion because Gitleaks is not
  installed on this machine.
- `npm run reuse:check` — not run to completion because the REUSE toolchain
  is unavailable on this machine.

## Security and limitations

- No new trust boundary, endpoint, dependency, or credential flow was added.
- Message bodies are not copied into the inbox or notification labels.
- DM unread counters are currently client-session state; server-backed DM read
  markers and mention aggregation remain explicit follow-up work and must not
  be inferred from this UI slice.
