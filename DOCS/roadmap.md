<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Roadmap

Roadmap versions follow the canonical root `VERSION` file and the release
procedure in [release.md](release.md). Status is evidence-based: “planned” is
not “implemented”.

## Baseline

### 1.7.4 — frozen product baseline

Status: baseline under test/release maintenance. Existing runtime behavior is
out of scope for the documentation foundation work.

## Foundation and architecture

### 1.8.0 — documentation and repository foundation

Status: in progress in this documentation-only change.

- GPL-3.0-only, SPDX, REUSE, `VERSION`, and repository ignore rules;
- agent/contributor/security policies and canonical documentation index;
- architecture, repository structure, testing, development, and release docs;
- CI version validation and an explicit no-runtime-change boundary.
- stable root `Makefile` targets for AI-safe checks, local server health,
  builds, release preparation, and ignored `work/`/`.tmp/` scratch paths.

Acceptance: docs and metadata validate; no application source behavior changes
are introduced by this milestone.

The `work/` and `.tmp/` directories are intentionally disposable development
surfaces for generated evidence, local experiments, and intermediate files.
They are ignored by Git and must never contain secrets or irreplaceable data.

### 1.9.0 — contracts and quality foundation

Status: planned.

- versioned protocol contracts and runtime boundary schemas;
- CI typecheck/lint/test/security gates;
- authorization, malformed-input, and cross-client contract coverage;
- npm workspace migration plan, SQLite-local/PostgreSQL-hosted compatibility;
- canonical root `package-lock.json` and Node.js 22 LTS alignment;
- Codex in-app Browser acceptance flows alongside automated tests;
- hybrid web/desktop session lifecycle, rotation, revocation, and secure storage;
- a cutover runbook with rollback and compatibility evidence.

### 2.0.0 — modular-monolith cutover

Status: planned; owner-selected strategy B (controlled big-bang cutover).

- target `apps/` and `packages/` structure;
- feature-owned server modules and shared web/desktop client core;
- legacy root server retirement after evidence and approval;
- migration, compatibility, installer, and end-to-end validation.

### 2.1.0 — hardening and operational readiness

Status: planned.

- observability and privacy-safe diagnostics;
- platform-signed/publisher-verified update artifacts (currently deferred);
- performance/resource budgets and failure recovery;
- documented support, incident response, and release evidence.

## Change control

Any item that changes public events, persisted data, auth behavior, deployment,
or compatibility needs an ADR before implementation. Reorder or rename roadmap
versions only by changing `VERSION` policy and the relevant decision record
together.
