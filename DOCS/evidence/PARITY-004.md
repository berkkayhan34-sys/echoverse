<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-004 evidence — DM safety and privacy

```yaml
id: PARITY-004
status: complete
```

## Scope

EchoVerse now enforces the complete direct-message safety and privacy boundary
on the server. Message requests remain quarantined until the recipient acts;
spam and block precedence are enforced; per-account privacy and per-peer
mute/archive preferences persist; authenticated reports are rate-limited and
privacy-safe; and expired moderation records plus deleted-message tombstones
are removed by the selected 180-day retention policy.

The implementation is split into independently verifiable children:

| Child        | Result   | Evidence                            |
| ------------ | -------- | ----------------------------------- |
| PARITY-004.1 | complete | `evidence/CHAT-001.md` and ADR-0023 |
| PARITY-004.2 | complete | `evidence/PARITY-004.2.md`          |
| PARITY-004.3 | complete | `evidence/PARITY-004.3.md`          |
| PARITY-004.4 | complete | `evidence/PARITY-004.4.md`          |

All decisions are server-enforced. Client controls do not replace
authorization, membership, privacy, block, rate-limit, or replay checks.

## Acceptance verification

- Wrong-user, blocked-user, replay, privacy, membership, and rate-limit cases
  are covered by the server integration and feature tests.
- The current full suite passes: 27 test files and 153 tests.
- SQLite and isolated PostgreSQL persistence checks pass, including report
  intake, retention cleanup, and active-message preservation.
- Workspace build, typecheck, localization, REUSE, Gitleaks, roadmap
  validation, and whitespace checks pass.

The repository lint command still reports ten pre-existing unused-variable
findings in `project/packages/shared-ui/src/workspace.tsx`; no retention or
DM-safety finding was introduced by this work.

## Explicit non-goals

Account deletion requests, backup/export lifecycle, host-log retention, and a
moderator report-review UI remain separate roadmap work. They are not required
to satisfy the DM safety and privacy contract represented by this item.
