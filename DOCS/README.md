<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse documentation

This directory is the canonical technical documentation surface for EchoVerse.
The root README presents the product; decisions, boundaries, validation rules,
component references, and operating procedures belong here.

## Start here

- [Architecture](architecture.md)
- [Target repository structure](architecture/repository-structure.md)
- [Security policy](security-policy.md)
- [Testing policy](testing-policy.md)
- [Development workflow](development.md)
- [Repository agent instructions](agent-instructions.md)
- [Release workflow](release.md)
- [Operations and production diagnostics](operations.md)
- [Reliability budgets and recovery](reliability.md)
- [Governance and public-release runbook](governance.md)
- [Roadmap](roadmap.md)
- [Command reference](command-reference.md)
- [Decisions](decisions/README.md)
- [Unresolved decisions](decisions/unresolved.md)
- [Evidence records](evidence/README.md)
- [Component references](components/)
- [Active audits](audits/README.md)
- [Historical audit records](historic/audits/README.md)
- [Contribution guide](../.github/CONTRIBUTING.md)
- [Security reporting](../.github/SECURITY.md)
- [Changelog](changelog.md)
- [Turkish release build guide](release-build-tr.md)
- [Historical notes](historic/README.md)

## Documentation rules

The root `AGENTS.md` points to [`agent-instructions.md`](agent-instructions.md),
which owns repository-specific technical rules. This index must remain a
locator, not a second copy of architecture or security requirements. Historical
version notes remain under [`historic/`](historic/); new permanent guidance
belongs in the canonical documents above and may link to historical notes when
useful.

All documentation is written with implementation status in mind. Planned
behavior uses future/required language; implemented behavior requires code and
validation evidence.
