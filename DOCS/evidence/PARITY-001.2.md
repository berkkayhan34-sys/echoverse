<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-001.2 — channel notifications and unread reconciliation

```yaml
id: PARITY-001.2
status: complete
date: 2026-08-31
revision: working-tree on codex/parity-001-2-notifications-unread
```

Status: complete on the working branch.

## Scope implemented

- Server-backed per-account, per-guild, per-channel notification levels:
  `all` and `none`.
- Server-backed `last_read_at` markers and unread counts for visible text
  channels.
- Cross-device state reconciliation through `guild:notification-state` and
  account-wide emission to every active socket for that account.
- Unread updates after a persisted human chat message, excluding the sender,
  deleted messages, muted channels, and channels the recipient cannot view.
- Shared web/desktop/mobile-responsive channel controls with unread badges,
  mute/unmute controls, and mark-read behavior.
- Hidden channel IDs and message bodies are not included in notification
  payloads or notification-specific logs.

## Acceptance mapping

| Acceptance criterion                                                             | Check/evidence                                                                                     | Result                               |
| -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Preferences persist per account/guild/channel and default to enabled             | Notification service memory tests and SQLite migration/upsert test                                 | verified for memory and SQLite paths |
| Unread counts exclude self-authored/deleted messages and respect read/mute state | Notification service tests plus chat-handler unread publication test                               | verified                             |
| Cross-device reconciliation reaches every active account socket                  | Notification handler test exercises account-wide state emission                                    | verified                             |
| Hidden channels are not enumerated or mutable through notification events        | Authorization handler test rejects a hidden channel with a generic membership error                | verified                             |
| Shared UI renders unread badges, mute controls, and marks channels read          | Shared UI tests, successful web/desktop builds, and two-context Playwright screenshots             | verified                             |
| Message content is absent from notification payloads/logs                        | Chat handler test asserts unread payload shape; logging contains only guild/channel/error metadata | verified                             |

## Validation run

- `npm test -- --run` — pass (25 files, 138 tests).
- Focused notification/shared UI tests — pass (3 files, 31 tests).
- `npm run typecheck -- --pretty false` — pass for all packages with a
  typecheck script.
- `npm run lint` — pass.
- `npm run format:check` — pass.
- `npm run localization:check` — pass (402 keys).
- `npm run build` — pass (server, shared packages, web, and desktop
  renderer/preload builds).
- `node DOCS/tools/validate-roadmap.mjs` — pass.
- `git diff --check` — pass.
- `npm run secret-scan` — not run to completion because Gitleaks is not
  installed on this machine.
- `npm run reuse:check` — not run to completion because the REUSE toolchain
  is unavailable on this machine.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3123 npx playwright test
project/tests/e2e/smoke.spec.ts --reporter=line` — pass (4 tests) against
  the local built web renderer. The local server used an ignored test-only
  preload for the host's `uv_os_get_passwd` ENOMEM issue.
- A two-context Playwright flow registered isolated local test accounts,
  selected the shared `EchoVerse` guild, sent a guild message from the second
  account while the first was in DMs, observed unread badge `1`, marked the
  channel read, and toggled mute. The flow passed at 1280×720 and 390×844.
  Screenshots: `tmp/test-results/PARITY-001.2-unread-badge-desktop.png`,
  `tmp/test-results/PARITY-001.2-mark-read-desktop.png`,
  `tmp/test-results/PARITY-001.2-muted-channel-desktop.png`, and
  `tmp/test-results/PARITY-001.2-unread-badge.png`.

## Visual verification

Authenticated rendered verification used two isolated local test accounts and
the repository-approved Playwright fallback because the integrated browser
connector was not available in this turn. The default viewport shows the
unread badge, read state, and muted bell; the narrow viewport shows the same
unread marker in the responsive channel drawer. No production credentials,
messages, or server state were used or changed.

## Security and compatibility notes

- Server authorization remains authoritative: only guild members with
  `channel:view` for a non-archived text channel can read or mutate state.
- State is keyed by account, guild, and channel; one user's preference cannot
  alter another user's state.
- Notification payloads contain only IDs, levels, and bounded counts. Message
  bodies are not logged or transported by these events.
- No new dependency or public HTTP endpoint was introduced.
