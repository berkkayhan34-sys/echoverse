<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-004.4 evidence — retention and deletion cleanup

```yaml
id: PARITY-004.4
status: complete
retention_days: 180
```

## Scope

The server applies the selected 180-day retention window to moderation and
deleted-content records. It removes expired direct-message and guild reports,
moderation audit events, and only messages whose `deleted_at` tombstone is past
the window. Active messages are not eligible for this cleanup. The pass runs
once after migrations during startup and then on a six-hour unref'd maintenance
timer; shutdown stops the timer before the database runtime closes.

The PostgreSQL and SQLite migrations add lookup indexes for the cleanup
predicates. Cleanup is idempotent and does not log message bodies, attachments,
credentials, tokens, or other private payloads.

## Verification

| Check                         | Result | Evidence                                                                                       |
| ----------------------------- | ------ | ---------------------------------------------------------------------------------------------- |
| In-memory retention behavior  | pass   | Expired tombstone/report/audit rows removed; recent and active rows preserved.                 |
| SQLite retention behavior     | pass   | Expired DM/guild reports, audit events, and message tombstones removed.                        |
| PostgreSQL retention behavior | pass   | Isolated PostgreSQL 16.4 test cluster: 5/5 database tests passed; active DM message preserved. |
| Migration idempotency         | pass   | Both adapters applied `014_retention_indexes` exactly once.                                    |
| Workspace typecheck           | pass   | All workspace TypeScript projects passed.                                                      |
| Full test suite               | pass   | 27 files, 153 tests passed.                                                                    |
| Build                         | pass   | Workspace production build completed successfully.                                             |
| Localization                  | pass   | 423-key catalog and visible-text checks passed.                                                |
| REUSE license lint            | pass   | 363/363 files compliant with GPL-3.0-only metadata.                                            |
| Gitleaks                      | pass   | 142 commits scanned; no leaks found.                                                           |
| Diff whitespace               | pass   | `git diff --check`.                                                                            |

## Explicit non-goals

Account deletion requests, backup/export lifecycle, host log retention, and a
moderator report-review UI remain separate roadmap work. This child only
implements server-side scheduled cleanup for the records currently owned by
the EchoVerse persistence boundary.
