<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0007: governance activation timing

- Status: Accepted
- Date: 2026-08-26

## Decision

Until EchoVerse is prepared for public release, the repository has one active
maintainer and does not require a second reviewer for every change. The owner
may self-review focused work, including documentation and private development.

Before the first public release, the repository activates the governance gate:
CODEOWNERS review becomes mandatory for security, release, deployment,
architecture, licensing, and data changes, with at least one required
reviewer. Secret handling, security validation, complete-diff review, and
release evidence remain mandatory now; this ADR does not weaken those controls.

## Consequences

The current workflow stays practical for a solo maintainer while the activation
criteria are explicit and cannot be forgotten at publication time. The first
public release checklist must verify that the GitHub branch/review settings
match this decision.
