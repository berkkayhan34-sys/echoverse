<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-003 — message search, threads, mentions, and links

```yaml
id: PARITY-003
status: complete
date: 2026-09-01
revision: local working tree on codex/parity-001-2-notifications-unread
```

## Scope implemented

- Channel search now supports server-side author, ISO date bounds, and
  timestamp cursors; deleted messages are excluded.
- Direct-message search is available from the shared DM header in web and
  desktop, with the same authorization, filtering, and pagination contract for
  direct pairs and active group conversations.
- DM reply parents are restricted to the same pair or group conversation.
- Existing channel thread/reply context, mention autocomplete/events, and
  message-link actions remain shared by both renderers.
- Message links now restore the authorized guild and channel before scrolling
  to the original message.
- The [message content policy](../message-content-policy.md) documents plain
  text/Markdown, attachment, embed, mention, search, and link boundaries.

## Acceptance mapping

| Acceptance criterion                                        | Verification                                                                                                                                                      | Result                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Search and thread results enforce membership and pagination | `chat-search` and `dm-search` contract validation; server authorization paths; memory-service filter tests; cursor returned from bounded result pages             | verified                                      |
| Mentions notify only authorized recipients                  | Existing server mention delivery checks remain green; no client-side authorization was added                                                                      | verified by affected-surface regression suite |
| Malformed, oversized, or hostile rich content is rejected   | Existing attachment schema/rate/size integration coverage plus documented no-HTML/no-remote-embed policy                                                          | verified                                      |
| Thread/reply state survives reconnect and reload            | Existing persisted reply/thread history coverage; DM reply parent now rejects cross-conversation IDs; deep-link reload selects guild/channel and restores message | verified                                      |
| Responsive user-facing search is usable                     | Playwright exercised DM search on desktop and rendered the DM inbox at 390×844                                                                                    | verified                                      |

## Validation run

- `npm run typecheck` — pass for all workspaces.
- `npm test -- --run` — pass (26 files, 141 tests).
- `npm run lint` — pass.
- `npm run format:check` — pass.
- `npm run localization:check` — pass (407 keys).
- `npm run build` — pass (server, shared packages, web, and desktop renderer/preload).
- `git diff --check` — pass.
- Authenticated Playwright flow with two temporary accounts and the local
  SQLite server — pass: DM search, channel thread panel, deep-link reload, and
  responsive DM inbox. Screenshots:
  - `tmp/test-results/PARITY-003-dm-search-desktop.png`
  - `tmp/test-results/PARITY-003-thread-desktop.png`
  - `tmp/test-results/PARITY-003-dm-inbox-mobile.png`
- `npm run secret-scan` — unavailable because Gitleaks is not installed.
- `npm run reuse:check` — unavailable because the required Python/REUSE
  runtime is not installed.

## Tooling follow-up (2026-09-01)

The validation executables were subsequently confirmed on this Windows host,
and the wrappers were updated to discover PATH and standard per-user install
locations:

- `npm run secret-scan` — pass with Gitleaks 8.30.1 (141 commits scanned; no
  leaks found).
- `npm run reuse:check` — pass with REUSE 6.2.0 (351/351 files covered;
  GPL-3.0-only; no bad, missing, unused, or unreadable license entries).

## Security and limitations

- Search authorization is evaluated on the server for every request; filters
  cannot widen a direct pair or group membership scope.
- Search queries are parameterized and wildcard characters are escaped.
- A local test-only OS-user lookup shim was used solely to work around the
  machine's known `uv_os_get_passwd`/`ENOMEM` failure while launching `tsx`; it
  is ignored and is not part of the application or release artifacts.
- PostgreSQL-specific execution was not available in this local visual run;
  the SQL path is covered by typed parameter construction and must be rerun in
  the repository's PostgreSQL database test environment before production
  deployment.
