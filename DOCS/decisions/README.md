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
- [Unresolved decisions](unresolved.md)
