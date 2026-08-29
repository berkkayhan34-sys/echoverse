<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Architecture decisions

This directory records decisions that would be expensive or unsafe to infer
from code. Confirmed decisions are stable until superseded by a new decision;
open questions are recorded explicitly rather than guessed.

- [ADR-0001: modular monolith and shared client](0001-modular-monolith.md)
- [ADR-0002: GPL-3.0-only and canonical version](0002-licensing-and-versioning.md)
- [ADR-0003: workspace, local data, and AI acceptance](0003-development-data-and-acceptance.md)
- [ADR-0004: session safety and deployment authority](0004-session-and-deployment.md)
- [ADR-0005: protocol compatibility and test tooling](0005-protocol-and-quality.md)
- [ADR-0006: release artifacts, retention, and observability](0006-release-data-and-observability.md)
- [ADR-0007: governance activation timing](0007-governance-activation.md)
- [ADR-0008: workspace lockfile and Node.js policy](0008-workspace-and-node-policy.md)
- [ADR-0009: v2 runtime cutover](0009-v2-runtime-cutover.md)
- [ADR-0010: project-root structure and generated state](0010-project-root-structure.md)
- [ADR-0011: server-side authorization boundaries](0011-authorization-boundaries.md)
- [ADR-0012: renderer feature-module ownership](0012-renderer-feature-module-ownership.md)
- [ADR-0014: Discord + TeamSpeak product direction](0014-discord-teamspeak-product-direction.md)
- [ADR-0015: unattended desktop updates](0015-unattended-desktop-updates.md)
- [ADR-0016: managed main guild and mobile shell](0016-main-guild-and-mobile-shell.md)
- [ADR-0017: shared responsive renderer surface](0017-shared-responsive-renderer-surface.md)
- [ADR-0018: signed remote UI cache for the desktop shell](0018-signed-remote-ui-cache.md)
- [ADR-0019: separate desktop shell and web revision tracks](0019-desktop-shell-and-web-revision-versioning.md)
- [ADR-0020: remove Spotify Together](0020-remove-spotify-together.md)
- [ADR-0021: Discord parity execution profile](0021-discord-parity-execution-profile.md)
- [ADR-0022: Persistent group DM and call semantics](0022-group-dm-and-call-semantics.md)
- [Unresolved decisions](unresolved.md)
