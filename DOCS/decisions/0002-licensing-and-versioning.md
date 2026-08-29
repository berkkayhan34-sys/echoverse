<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0002: GPL-3.0-only and canonical version file

- Status: Accepted
- Date: 2026-08-26

## Decision

EchoVerse is distributed under GNU GPL version 3 **only** (`GPL-3.0-only`). New
text/configuration files carry SPDX identifiers and non-text assets are covered
by `REUSE.toml`. The root `VERSION` file is the canonical desktop-shell and
product release version; package manifests mirror it and desktop release
workflows validate the mirrors and `v<version>` tags. The deployed web
renderer has a separate commit-based revision, defined in ADR-0019.

## Consequences

- License intent is machine-readable and reviewable before publication.
- Version drift between packages, workflows, and release tags is rejected.
- Web-only commits can be deployed and cached without producing a desktop
  installer; the signed manifest records their Git revision separately.
- Existing application source headers can be added in the later code-maintenance
  slice without mixing that work into this documentation foundation.
- Third-party code and assets still require license/source review before import.
