<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Completed roadmap baseline reference

This immutable reference records the completed children removed from the active
roadmap during the 2026-08-28 audit-closure documentation pass. It preserves
the implementation order and points to the original evidence records; it is
not an active task list and must not be edited to represent future work.

The active tracker is [`../../roadmap.md`](../../roadmap.md). Future work that
arises after the owner declares the baseline complete belongs in a new,
owner-approved roadmap child or change record. The entries below are complete
baseline work and must not be reimplemented merely because they are archived.

## v1.8.x — documentation and repository readiness

| ID | Completed child | Evidence |
| --- | --- | --- |
| `DOC-001` | Documentation and roadmap governance | [`DOC-001`](../../evidence/DOC-001.md) |
| `DOC-002` | Architecture and repository truth | [`DOC-002`](../../evidence/DOC-002.md) |
| `DOC-003` | Development, testing, and release docs | [`DOC-003`](../../evidence/DOC-003.md) |
| `DOC-004` | Security, threat, and data lifecycle | [`DOC-004`](../../evidence/DOC-004.md) |
| `DOC-005` | Governance and public-release runbook | [`DOC-005`](../../evidence/DOC-005.md) |
| `DOC-006` | Documentation foundation verification | [`DOC-006`](../../evidence/DOC-006.md) |

## v1.9.x — validation and quality foundation

| ID | Completed child | Evidence |
| --- | --- | --- |
| `QUAL-001` | Canonical validation tooling | [`QUAL-001`](../../evidence/QUAL-001.md) |
| `QUAL-002` | Contract and boundary test foundation | [`QUAL-002`](../../evidence/QUAL-002.md) |
| `QUAL-003` | Integration, security, and evidence gates | [`QUAL-003`](../../evidence/QUAL-003.md) |

## v2.0.x — runtime hardening and modular-monolith completion

| ID | Completed child | Evidence |
| --- | --- | --- |
| `CODE-001` | Session and transport security | [`CODE-001`](../../evidence/CODE-001.md) |
| `CODE-002` | Input limits and safe failure boundaries | [`CODE-002`](../../evidence/CODE-002.md) |
| `CODE-003` | Persistence adapters and migrations | [`CODE-003`](../../evidence/CODE-003.md) |
| `CODE-004A-LOCALIZATION` | Complete application localization | [`CODE-004A-LOCALIZATION`](../../evidence/CODE-004A-LOCALIZATION.md) |
| `CODE-004` | Server feature extraction | [`CODE-004`](../../evidence/CODE-004.md) |
| `CODE-005` | Authorization completeness | [`CODE-005`](../../evidence/CODE-005.md) |
| `CODE-006` | Shared client core and boundaries | [`CODE-006`](../../evidence/CODE-006.md) |
| `CODE-007` | WebRTC and media regressions | [`CODE-007`](../../evidence/CODE-007.md) |
| `CODE-008` | Installer and update smoke | [`CODE-008`](../../evidence/CODE-008.md) |
| `CODE-009` | v2 runtime verification audit | [`CODE-009`](../../evidence/CODE-009.md) |

## v2.1.x — operational baseline

| ID | Completed child | Evidence |
| --- | --- | --- |
| `OPS-001` | Privacy-safe observability | [`OPS-001`](../../evidence/OPS-001.md) |
| `OPS-002` | Performance and failure recovery | [`OPS-002`](../../evidence/OPS-002.md) |

## Deferred work retained by reference

The following items were intentionally not marked complete and remain in the
active roadmap’s final deferred reference: signed publisher-verified artifacts
(`OPS-003`), support/incident/release evidence (`OPS-004`), the public-release
readiness gate (`READY-001`), desktop development-runtime acceptance, and
future export/import or newly approved feature/audit work. Signing and
notarization are documented separately in
[`../../evidence/OPS-003.md`](../../evidence/OPS-003.md).
