<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Unresolved decisions

## Resolved decisions

### CODE-006 runtime feature-module ownership

Resolved on 2026-08-28: option **a**, per-renderer feature modules with shared
pure `client-core` helpers. The accepted architecture is recorded in
[ADR-0012](0012-renderer-feature-module-ownership.md). The remaining work is
implementation and evidence, not an unresolved architecture decision.

## CODE-008 release smoke environment

The release validation implementation now verifies updater metadata, SHA-512
checksums, blockmaps, and packaged startup through the explicit smoke-test
entrypoint. Apple Silicon artifacts pass locally. The remaining required launch
checks cannot execute on this host: the host is Apple Silicon without Intel
translation support (`bad CPU type in executable`), and Windows installers
require a Windows runner.

Recommended resolution: run the existing Windows and macOS Intel CI jobs on
the pushed revision, then retain their logs and artifacts in CODE-008 evidence.
Installing Intel translation locally would only address the Intel check and
would not replace the required Windows validation. Until those CI results exist,
CODE-008 must remain in progress and CODE-009 cannot begin.

Operational ownership, incident escalation, evidence retention, and release
approval are defined in the [governance and public-release runbook](../governance.md).
The current owner identity comes from CODEOWNERS; any later delegation must be
recorded with scope, dates, and handoff evidence.

Each resolution needs an ADR with alternatives, security impact, migration
steps, rollback, and evidence requirements.
