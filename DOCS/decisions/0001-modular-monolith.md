<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0001: modular monolith with shared client contracts

- Status: Accepted
- Date: 2026-08-26

## Decision

Keep EchoVerse in one repository and one modular backend deployment while
extracting explicit server feature modules, shared protocol contracts, and a
shared browser client core for web and Electron. Electron-specific lifecycle,
tray, updater, and native capture code remains in the desktop shell.

The owner-selected migration strategy is **B: controlled big-bang cutover**.
The documentation foundation may prepare contracts, tests, and build checks,
but a second runtime architecture must not be shipped incrementally beside the
current one. The cutover will be a separately approved, bounded change with a
rollback point and an explicit compatibility review. Microservices and
separate repositories are not part of the current target.

## Consequences

- Web and desktop stop drifting through duplicated feature implementations.
- Server features can be reviewed and tested by boundary instead of by one
  monolithic entrypoint.
- Deployment remains simple while the project is small.
- The cutover has higher coordination and rollback risk; its branch, test
  evidence, release plan, and compatibility checklist must therefore be
  complete before runtime code is changed.
