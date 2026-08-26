<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0008: workspace lockfile and Node.js policy

- Status: Accepted
- Date: 2026-08-26

## Decision

- The future npm-workspaces monorepo uses one canonical root
  `package-lock.json`.
- Node.js **22 LTS** is the supported version for local development, CI,
  testing, and release tooling.
- Workspace migration and lockfile consolidation are implemented. App and
  package manifests live under `apps/` and `packages/`; the root
  `package-lock.json` is canonical.

## Consequences

Dependency resolution is reproducible across workspaces and environments, and
Node version drift is detectable in CI. The migration must update scripts,
documentation, and CI together and preserve a rollback point.
