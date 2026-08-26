<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Repository structure

This is the target map for the modular-monolith cutover. It deliberately
separates application entrypoints, shared packages, documentation, and
operational configuration. The map is preparatory; no runtime move is made by
this document.

```text
echoverse/
├─ apps/
│  ├─ server/          # HTTP and Socket.IO composition
│  ├─ web/             # browser application
│  └─ desktop/         # Electron main, preload, and renderer shell
├─ packages/
│  ├─ contracts/       # event names, DTOs, schemas, protocol versions
│  ├─ client-core/     # shared session, auth, socket, and feature state
│  ├─ shared-ui/       # browser-safe components and design primitives
│  └─ config/          # environment parsing and endpoint configuration
├─ DOCS/
│  ├─ architecture/   # target structure and boundary maps
│  ├─ decisions/      # accepted and unresolved ADRs
│  ├─ evidence/       # reproducible validation artifacts
│  ├─ audits/         # risk and quality reviews
│  └─ historic/       # immutable V1.* release/setup notes
├─ .github/            # contribution, security, ownership, and automation
├─ VERSION             # canonical product version
├─ LICENSE             # GPL-3.0-only license text
├─ REUSE.toml          # SPDX/REUSE annotations
└─ README-TR.md        # owner-facing entrypoint and documentation index
```

## Current-to-target mapping

| Current path | Target responsibility | Constraint |
| --- | --- | --- |
| `server/` | `apps/server/` | Keep transport composition separate from feature modules. |
| `web/` | `apps/web/` plus shared packages | Remove duplicated client logic only after contracts exist. |
| `desktop/` | `apps/desktop/` plus shared packages | Keep native APIs behind the Electron boundary. |
| `src/` | retired legacy entrypoint | No new product behavior; removal requires evidence and approval. |
| `DOCS/` | canonical documentation | Keep new policy in the canonical files indexed by `DOCS/README.md`. |
| `DOCS/historic/` | immutable historical V1.* notes | Do not add new policy or current setup guidance here. |

## Dependency direction

`contracts` and browser-safe shared packages may be consumed by web and desktop.
Feature modules may depend on contracts and infrastructure interfaces, but
transport and platform adapters must not become a hidden shared global. Server
domain code must not import Electron or renderer modules.

## Ownership and navigation

Each target package needs a named owner, public entrypoint, test location, and
README before the cutover. The repository root stays intentionally small:
version/license/governance, workspace tooling, and links to canonical docs.
