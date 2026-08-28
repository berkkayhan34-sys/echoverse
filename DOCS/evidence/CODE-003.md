<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-003`

```yaml
id: CODE-003
status: complete
date: 2026-08-27
revision: 2294def
```

## Scope

- Affected source-of-truth files: PostgreSQL and SQLite migration histories,
  the server persistence adapter/configuration, database integration tests, and
  development/architecture documentation.
- Security and reliability impact: local operation now uses an explicit
  file-backed SQLite adapter with foreign keys enabled, bounded busy timeout,
  WAL journaling, parameterized query translation, idempotent migrations, and
  Unicode-safe text storage. PostgreSQL remains the explicit hosted mode.
- Compatibility fix: additive migration `003_friendship_updated_at` supplies
  the column already required by friendship update operations without changing
  historical migration files.

## Validation

| Command or check    | Result           | Evidence                                                                                                                                                                                |
| ------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`          | pass             | 11 test files and 48 tests passed, including SQLite migration, cascade, Unicode, backup, restore, and rollback cases.                                                                   |
| `npm run typecheck` | pass             | All TypeScript workspaces typechecked without errors.                                                                                                                                   |
| `npm run lint`      | pass             | ESLint completed with no reported findings.                                                                                                                                             |
| `git diff --check`  | pass             | No whitespace errors in the implementation diff.                                                                                                                                        |
| `npm run test:db`   | deferred locally | Requires the repository PostgreSQL service via `DATABASE_URL`; the PostgreSQL suite now covers migration idempotence, cascades, metadata columns, and the additive timestamp migration. |

## Review notes

`DATABASE_URL` and `SQLITE_PATH` are mutually exclusive and the server reports
the selected persistence mode. SQLite and PostgreSQL use the same migration
IDs and logical table/column contract, with dialect-specific SQL only where
required. SQLite backup and restore are tested as the local rollback path;
hosted PostgreSQL restore remains an operator-controlled deployment action.
