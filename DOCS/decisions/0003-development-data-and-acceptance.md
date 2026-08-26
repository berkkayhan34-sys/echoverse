<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0003: workspace, local data, and AI acceptance tooling

- Status: Accepted
- Date: 2026-08-26

## Decision

- The future monorepo uses **npm workspaces**, a documented Node version
  policy, and one canonical root `package-lock.json`. This foundation phase
  does not introduce the workspace migration yet.
- Local development uses **SQLite**, while hosted production uses
  **PostgreSQL**. Schema, migration, backup, and compatibility tests must make
  the difference explicit before runtime cutover.
- AI-assisted UI acceptance uses the **ChatGPT Codex in-app Browser tool** for
  web and desktop-visible flows when a browser surface is applicable. It is a
  reproducible manual/AI acceptance layer, not a replacement for automated
  contract, integration, security, or end-to-end tests.

## Consequences

- A single package-manager convention reduces divergent install and CI flows.
- SQLite keeps local setup lightweight, while PostgreSQL matches hosted needs;
  portability and migration drift become explicit test responsibilities.
- Browser-based acceptance can inspect real user-visible state, but every
  repeatable regression still needs an automated test and recorded evidence.
