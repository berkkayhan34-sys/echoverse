<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0010: project-root structure and generated state

**Status:** accepted
**Date:** 2026-08-27
**Owner:** EchoVerse maintainers

## Context

The repository had application code, technical references, generated output,
and temporary state spread across the root and several top-level directories.
That layout made ownership, documentation authority, and cleanup ambiguous. The
application already uses npm workspaces and a modular-monolith boundary, so the
layout change must preserve package names, runtime behavior, and the canonical
root lockfile.

## Decision

Use this repository shape:

```text
DOCS/       canonical technical documentation, decisions, evidence, and procedures
project/    all application code, packages, tests, assets, migrations, and local config
tmp/        ignored generated output, runtime data, local environments, and scratch state
```

The root retains only product-facing README files, legal and licensing metadata,
version and workspace metadata, repository tooling, and `.github/` automation.
The npm workspace globs are `project/apps/*` and `project/packages/*`. Technical
instructions and component references belong in `DOCS/`; product READMEs must
describe EchoVerse rather than the agent or its process.

Localization catalogs are project source and live at
`project/packages/contracts/src/localizations/`, one JSON file per language.
`en.json` and `tr.json` are mandatory and must remain key/placeholder-parity
complete. Unsupported locales use English fallback.

Build, coverage, test-result, runtime, environment, and temporary generated
state uses the root `tmp/` tree. Package-manager dependencies remain in the
standard root `node_modules` location because npm workspaces require that
install layout. Platform packagers may retain their required staging layout
only when the packager cannot consume a root `tmp/` output; such an exception
must be documented and must remain ignored.

## Consequences

- Workspace manifests and the lockfile must resolve `project/apps` and
  `project/packages` paths.
- CI, Render, release scripts, documentation, evidence, and validators must use
  the new paths; stale duplicate runtime paths are invalid.
- Moving source is not a behavior migration and does not delete persisted user
  data. Runtime compatibility is validated by the existing test and build
  gates.
- Future changes must not recreate application code or technical policy in the
  root.

## Validation and recovery

The change is recoverable through the Git history and the pre-change commit
`2294def`; no rollback operation was performed. Acceptance requires path/link
validation, lockfile/workspace installation, formatting, lint, typecheck, unit
tests, builds, REUSE, secret scanning, and the available browser checks. The
owner-approved local exception is that PostgreSQL service tests are deferred to
CI; SQLite remains required locally.
