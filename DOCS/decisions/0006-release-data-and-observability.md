<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0006: release artifacts, retention, and observability

- Status: Accepted
- Date: 2026-08-26

## Decision

- Initial updater distribution uses GitHub Releases and artifact checksums
  (**option B**). Platform signing/notarization is deferred; unsigned
  artifacts must not be called production-ready and remain a release risk.
- Data follows minimum retention with an explicit user deletion request path,
  including media, backups, exports, and deletion evidence.
- Operations start with privacy-safe structured logs and basic metrics. A later
  OpenTelemetry decision may extend this without changing redaction rules.

## Consequences

Release documentation must show checksums and clearly state signing status.
Retention/deletion behavior becomes a testable product and operations contract.
Structured diagnostics provide a simple first observability layer without
committing the project to a larger telemetry stack too early.
