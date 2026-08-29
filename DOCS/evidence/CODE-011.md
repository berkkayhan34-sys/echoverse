<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `FEATURE-002`

```yaml
id: FEATURE-002
status: complete
date: 2026-08-29
revision: f1ab9e8a75022df471b72214ad2349f0145c3b11 (pre-release)
```

## Scope

- Electron-hosted web UI identifies the native shell, hides the browser-only
  `WEB` marker, and uses the product title.
- The web authentication surface ships the same EchoVerse icon and wordmark as
  the desktop shell.
- The public main guild remains visible and selectable for authenticated users
  when historical membership rows are missing; no unconfigured user receives a
  management role.
- Non-owner private guilds expose a leave action that removes the guild from
  the user's server list; the main guild and owners cannot leave.
- Invite copying uses the native Electron clipboard with a bounded browser
  fallback.

## Validation

| Check                                                           | Result  | Evidence                                                                                                                                                                       |
| --------------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test -- --run`                                             | pass    | 20 test files and 101 tests passed.                                                                                                                                            |
| `npm run typecheck`                                             | pass    | All workspace packages type-checked successfully.                                                                                                                              |
| `npm run build`                                                 | pass    | Web, desktop, server, and shared packages built successfully.                                                                                                                  |
| `npm run format:check` and `git diff --check`                   | pass    | Formatting and whitespace gates passed.                                                                                                                                        |
| `npm run lint`, `npm run localization:check`, roadmap validator | pass    | Lint, catalog parity, and roadmap checks passed.                                                                                                                               |
| `npm run dependency:check` / `npm audit --audit-level=high`     | pass    | No high-or-critical dependency vulnerabilities reported.                                                                                                                       |
| Integrated browser inspection                                   | partial | At 390x844, branded landing view rendered without horizontal overflow. Authenticated workspace interaction was not run because credential-entry confirmation was not provided. |
| Render health and release workflow                              | pending | Must be rechecked after the `v1.8.6` tag deploys.                                                                                                                              |

## Security notes

The public-main fallback is limited to the fixed `echoverse` identifier. It
does not create an owner/admin role or bypass private-guild membership checks.
Leave operations remain server-authorized and owner-protected. Clipboard
bridges accept only bounded text and expose no filesystem or renderer process
access.
