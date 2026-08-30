<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `1.9.2` desktop updater process hardening

```yaml
id: CODE-014
status: in_progress
version: 1.9.2
date: 2026-08-30
```

## Scope

- The packaged desktop shell acquires a single-instance lock before startup
  update checks and renderer creation.
- A second launch focuses the existing window instead of starting a competing
  updater/cache process.
- Updater failures retain a safe localized user message while recording only a
  bounded diagnostic string in the local updater log.

## Validation planned

| Check                                              | Result                               |
| -------------------------------------------------- | ------------------------------------ |
| Node syntax, typecheck, lint, format, tests, build | pending 1.9.2 rerun                  |
| Packaged Windows artifact and smoke test           | pending 1.9.2 release workflow       |
| Two-account Render chat/voice smoke                | passed on 1.9.1; rerun after release |
| Computer Use single-window relaunch/update check   | pending                              |

## Security and recovery notes

The lock is a process-lifecycle guard, not an authorization boundary. Existing
server-side session, guild, channel, and voice authorization remains unchanged.
If a startup update fails, the bundled renderer remains the recovery path and
the previous installed shell remains launchable.
