<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-004.3 evidence — direct-message report intake

```yaml
id: PARITY-004.3
status: complete
```

Status: complete. Implementation and isolated local verification passed.

## Scope

The server now accepts the authenticated `dm:report` event. It validates the
reporter and target, permits an optional one-to-one direct-message reference,
stores no message body or attachment, returns the original record on replay,
and applies a ten-distinct-report-per-reporter-per-hour limit. Group-message
references, self/unknown targets, invalid identifiers, and messages outside
the reporter/target direct conversation are rejected.

Persistence is defined for the memory, SQLite, and PostgreSQL adapters by
`013_dm_reports.sql` and the corresponding SQLite migration. A unique index
provides replay protection across concurrent database requests.

## Verification

| Check                | Result | Evidence                                                                                                                                                 |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract validation  | pass   | `dm:report` rejects blank/oversized reasons and unknown fields; contract test passed.                                                                    |
| Service behavior     | pass   | Memory replay and ten-report limit test passed.                                                                                                          |
| Server integration   | pass   | Authenticated intake, privacy-safe response, replay, self-target, fake-message, and group-message rejection passed.                                      |
| SQLite migration     | pass   | Migration is idempotent and the report table/columns are asserted in the persistence test.                                                               |
| Full test suite      | pass   | 26 files, 151 tests passed on 2026-09-02.                                                                                                                |
| Typecheck/build      | pass   | Workspace typecheck and build completed successfully.                                                                                                    |
| Diff whitespace      | pass   | `git diff --check`.                                                                                                                                      |
| REUSE license lint   | pass   | `reuse lint --quiet`.                                                                                                                                    |
| Gitleaks             | pass   | 142 commits scanned; no leaks found.                                                                                                                     |
| PostgreSQL execution | pass   | `npm run test:db` passed 4/4 tests against the isolated PostgreSQL 16.4 cluster on loopback port `55432`; no production data or system service was used. |

## Explicit non-goals

Moderator report review/triage UI and report retention/deletion cleanup are
not part of this child. They belong to the next `PARITY-004.4` decision and
must not be inferred from this intake record.
