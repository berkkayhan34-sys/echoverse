<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse architecture

This document describes the implemented v2 architecture and the constraints for
future changes. Runtime entrypoints live under `project/apps/`; shared boundaries live
under `project/packages/`; technical authority lives under `DOCS/`.

## Architectural decision

EchoVerse is a modular monolith in one repository and one primary backend
deployment. Web and desktop share protocol contracts and client-core logic.
Electron-only lifecycle, updater, tray, native capture, and filesystem behavior
stays at the desktop boundary. Microservices and separate repositories are out
of scope for the current horizon.

The owner-selected refactor strategy is **B: controlled big-bang cutover**.
The v2 cutover moves the runtime to `project/apps/` and shared packages in one bounded
change with a recovery point and compatibility review. The repository-root layout
decision is recorded in [ADR-0010](decisions/0010-project-root-structure.md).

## Target repository shape

The structure is documented in [repository structure](architecture/repository-structure.md).
At a high level:

```text
project/
  apps/
    server/     # transport composition and process entrypoint
    web/        # browser entrypoint
    desktop/    # Electron shell and native bridge
  packages/
    contracts/  # versioned events, DTOs, and runtime validators
    client-core/ # shared auth, session, socket, and feature state
    shared-ui/  # browser-safe shared components and styles
    config/     # validated environment and endpoint configuration
DOCS/           # canonical decisions, policies, and procedures
tmp/            # ignored generated output and local runtime state
```

The names and root ownership are governed by ADR-0010. The important invariant is
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
- persistence and migrations;
- HTTP/Socket.IO transport composition.

Each feature owns input schemas, authorization rules, domain operations, and
focused tests. Transport adapters translate external requests into feature
commands; they do not contain persistence policy or hidden authorization.

## Discord + TeamSpeak product contract (ARCH-001)

The current contract combines Discord-style membership, text, DM, moderation,
and social surfaces with TeamSpeak-style persistent voice rooms. A guild owns
its categories and channels; membership is explicit for private guilds and the
`echoverse` guild is public and auto-enrolled. Voice entry is always an
explicit user action. Messages and attachments are server-validated and
authorization is evaluated on every event. The protocol keeps legacy
`guild:<id>:text` and `guild:<id>:lobby` rooms as compatibility aliases while
clients migrate to channel IDs. Provider-specific SFU, native mobile binaries,
and automatic voice joining are non-goals for this phase.

Message body, attachment, search, reply, mention, and deep-link rules are
defined in the canonical [message content policy](message-content-policy.md).

## Channel and space model (ARCH-002)

`echoverse_guild_categories` and `echoverse_guild_channels` are the durable
ordering boundary for text, voice, stage, and forum channels. Existing guilds
receive deterministic `general` and `Lobby` channels; the legacy lobby display
name remains persisted on the guild and is kept synchronized with the default
voice channel. Archived channels are hidden from active lists but retained for
message and audit integrity. Channel mutations are server-authorized and
broadcast as `guild:channels`.

## Client boundaries

The web and desktop clients share protocol contracts and browser-safe client
state. Feature modules own their screens, selectors, commands, and tests.
Desktop-only code is limited to an explicit bridge for native capabilities;
renderer code must not reach directly into Node or the filesystem.

The desktop renderer uses a bundled last-known-good build as its recovery
source. At packaged startup it may activate a separately published web UI only
after the signed manifest, shell compatibility, same-origin file list, sizes,
and SHA-512 digests have been verified. The UI is materialized under the
per-user cache and switched atomically; the Electron shell never treats an
arbitrary live remote page as the application renderer. See
[ADR-0018](decisions/0018-signed-remote-ui-cache.md).

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

`VERSION` at the repository root is the canonical desktop-shell/product release
version. Package manifests mirror it for ecosystem tooling, and desktop release
workflows validate the mirrors and the `v<version>` tag before publishing. The
deployed web renderer has a separate version dimension: its full lowercase Git
commit SHA is published as `webRevision` in the signed UI manifest and exposed
to the browser as `git-<sha>`. The desktop cache identity is the pair
`(VERSION, webRevision)`, so web-only commits do not require a new installer
while shell changes still require a desktop release. See [release workflow](release.md),
[ADR-0002](decisions/0002-licensing-and-versioning.md), and ADR-0019.

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
`project/apps/`.

## Architectural change process

Any change to module boundaries, public events, persisted data, deployment
topology, or compatibility policy requires an ADR before implementation. An ADR
must state the problem, decision, alternatives, consequences, migration and
rollback plan, and evidence required for acceptance.
