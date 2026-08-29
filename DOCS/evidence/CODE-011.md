<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `FEATURE-002`

```yaml
id: FEATURE-002
status: complete
date: 2026-08-29
revision: pending-release-commit
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

| Check                                         | Result  | Evidence                                                                                             |
| --------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `npm test -- --run`                           | pending | Full unit/integration suite after the release changes.                                               |
| `npm run typecheck`                           | pending | All workspace packages.                                                                              |
| `npm run build`                               | pending | Web, desktop, server, and shared packages.                                                           |
| `npm run format:check` and `git diff --check` | pending | Formatting and whitespace gate.                                                                      |
| Integrated browser inspection                 | pending | Browser view verifies browser marker/title, branding, server rail, leave control, and invite dialog. |
| Render health and release workflow            | pending | Post-deploy version and artifact checks.                                                             |

## Security notes

The public-main fallback is limited to the fixed `echoverse` identifier. It
does not create an owner/admin role or bypass private-guild membership checks.
Leave operations remain server-authorized and owner-protected. Clipboard
bridges accept only bounded text and expose no filesystem or renderer process
access.
