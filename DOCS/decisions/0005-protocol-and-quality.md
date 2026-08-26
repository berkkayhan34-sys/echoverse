<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0005: protocol compatibility and test tooling

- Status: Accepted
- Date: 2026-08-26

## Decision

- Socket.IO events use a versioned envelope. Compatibility, deprecation, and
  minimum-client rules are explicit in the contracts package.
- Automated tests use **Vitest + Playwright**. Vitest covers unit,
  integration, and contract-oriented TypeScript tests; Playwright covers
  repeatable browser flows. The Codex in-app Browser remains the AI/manual
  visible-flow acceptance surface and does not replace automation.

## Consequences

Protocol changes require compatibility fixtures and negative cases. Test
commands can run consistently in local development and CI, while browser
acceptance evidence remains useful for visual and interaction regressions.
