<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse architecture

This document describes the implemented v2 architecture and the constraints for
future changes. Runtime entrypoints live under `apps/`; shared boundaries live
under `packages/`.

## Architectural decision

EchoVerse is a modular monolith in one repository and one primary backend
deployment. Web and desktop share protocol contracts and client-core logic.
Electron-only lifecycle, updater, tray, native capture, and filesystem behavior
stays at the desktop boundary. Microservices and separate repositories are out
of scope for the current horizon.

The owner-selected refactor strategy is **B: controlled big-bang cutover**.
The v2 cutover moves the runtime to `apps/` and shared packages in one bounded
change with a rollback point and compatibility review.

## Target repository shape

The structure is documented in [repository structure](architecture/repository-structure.md).
At a high level:

```text
apps/
  server/       # transport composition and process entrypoint
  web/          # browser entrypoint
  desktop/      # Electron shell and native bridge
packages/
  contracts/    # versioned events, DTOs, and runtime validators
  client-core/  # shared auth, session, socket, and feature state
  shared-ui/    # browser-safe shared components and styles
  config/       # validated environment and endpoint configuration
DOCS/           # canonical decisions, policies, and procedures
```

The final names may be adjusted only through an ADR. The important invariant is
that transport, domain logic, client state, and platform integrations have
explicit boundaries and directional dependencies.

## Server boundaries

The backend is organized by business capability rather than by one large
handler file:

- identity and accounts;
- guilds, membership, and presence;
- chat and message history;
- friends and direct messages;
- calls and WebRTC signaling;
- Spotify integration;
- persistence and migrations;
- HTTP/Socket.IO transport composition.

Each feature owns input schemas, authorization rules, domain operations, and
focused tests. Transport adapters translate external requests into feature
commands; they do not contain persistence policy or hidden authorization.

## Client boundaries

The web and desktop clients share protocol contracts and browser-safe client
state. Feature modules own their screens, selectors, commands, and tests.
Desktop-only code is limited to an explicit bridge for native capabilities;
renderer code must not reach directly into Node or the filesystem.

## Trust and data flow

External HTTP requests, Socket.IO events, OAuth callbacks, media/signaling
messages, file uploads, and updater inputs are untrusted. Validation happens at
the boundary, authorization is checked on the server, and only validated data
enters domain modules. Database, third-party APIs, and native OS services are
side-effect boundaries behind small adapters.

```text
untrusted input
      -> schema validation
      -> authentication and authorization
      -> feature command/use case
      -> persistence or integration adapter
      -> typed response/event
```

## Version source of truth

`VERSION` at the repository root is the canonical product version. Package
manifests mirror it for ecosystem tooling, and release workflows must validate
the mirrors and the `v<version>` tag before publishing. See
[release workflow](release.md) and [ADR-0002](decisions/0002-licensing-and-versioning.md).

## Development platform decisions

The monorepo uses npm workspaces. Local persistence uses SQLite and the
hosted production profile uses PostgreSQL; migrations and compatibility tests
must make that boundary explicit. AI-assisted visible-flow acceptance uses the
ChatGPT Codex in-app Browser tool, while automated contract, integration,
security, and end-to-end tests remain mandatory. See
[ADR-0003](decisions/0003-development-data-and-acceptance.md).

## Migration status

The v2 structure is now the implementation surface. Remaining extraction work
is tracked by feature module and must not reintroduce a second runtime beside
`apps/`.

## Architectural change process

Any change to module boundaries, public events, persisted data, deployment
topology, or compatibility policy requires an ADR before implementation. An ADR
must state the problem, decision, alternatives, consequences, migration and
rollback plan, and evidence required for acceptance.
