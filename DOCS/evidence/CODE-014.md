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

| Check                                              | Result                                       |
| -------------------------------------------------- | -------------------------------------------- |
| Node syntax, typecheck, lint, format, tests, build | pass (23 files, 114 tests)                   |
| Packaged Windows artifact and smoke test           | pass (release workflow and local smoke)      |
| Two-account Render chat/voice smoke                | pass (guild, chat, voice peer, WebRTC relay) |
| Computer Use single-window relaunch/update check   | pending (installed 1.9.0 needs v1.9.2 run)   |

## Security and recovery notes

The lock is a process-lifecycle guard, not an authorization boundary. Existing
server-side session, guild, channel, and voice authorization remains unchanged.
If a startup update fails, the bundled renderer remains the recovery path and
the previous installed shell remains launchable.
