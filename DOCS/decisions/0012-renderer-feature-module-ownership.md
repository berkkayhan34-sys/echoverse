<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0012: renderer feature-module ownership

- Status: Accepted
- Date: 2026-08-28

## Decision

The web and Electron renderers own their platform-specific runtime feature
modules. Pure state transitions, validation, protocol construction, and other
deterministic helpers remain in `project/packages/client-core`. Browser-safe
visual components remain in `project/packages/shared-ui`.

Renderer feature modules receive explicit, narrow dependencies for current
state, state updates, transport access, and platform capabilities. They do not
share a lifecycle coordinator or expose native Electron APIs to the web
renderer. The desktop renderer keeps sound, updater, Electron session, and
screen-source behavior local to its feature modules and preload boundary.

## Alternatives considered

1. **One shared runtime coordinator with capability adapters** — rejected
   because it would make media, session, reconnect, and Electron-only lifecycle
   behavior depend on a broad cross-platform interface.
2. **Close CODE-006 at the shared core/UI boundary** — rejected because the
   roadmap explicitly requires renderer feature extraction and the entrypoints
   would remain difficult to audit.
3. **Per-renderer feature modules with shared pure helpers** — accepted because
   it keeps platform effects explicit while still centralizing deterministic
   state and protocol behavior.

## Security and compatibility consequences

Native capabilities remain behind the desktop preload bridge, and browser
permissions remain browser-owned. Feature modules must preserve server-side
authorization, fail-closed media behavior, socket reconnect semantics, and
existing event payloads. Shared code must not import Electron or assume a DOM
or native permission model.

## Migration and recovery

Extraction is incremental and source-compatible: each moved action retains its
existing event names and state transitions. A faulty extraction can be
recovered by reverting the corresponding Git commit or forward-fixed in the
renderer module without changing persisted data or protocol versions.

## Evidence requirements

CODE-006 evidence must identify each renderer feature module, its dependency
boundary, the tests/build checks that cover it, and the web visual verification
performed. Desktop runtime verification remains deferred to the late release
roadmap by owner decision.
