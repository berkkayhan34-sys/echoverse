<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `RELEASE-1.9.0`

```yaml
id: RELEASE-1.9.0
status: complete
date: 2026-08-29
revision: 73a0ed2
```

## Verified in this working tree

- Guild message sends return an explicit acknowledgement and localized
  failure response.
- Group conversations persist in PostgreSQL/SQLite schemas, enforce active
  membership, fan out messages, and keep owner/admin role changes server-side.
- Group voice signaling is membership-authorized and capped at ten active
  members; a participant can disconnect without deleting the group.
- The shared emoji picker is common-first, searchable, and remembers recent
  selections across the web and Electron renderer.
- Packaged startup has a bounded updater wait and a bundled-renderer fallback
  for updater/cache failures.
- The Windows NSIS artifact `tmp/release/desktop/EchoVerse-Setup-1.9.0.exe`
  was installed silently on Windows and launched successfully; the branded
  login screen reported `EchoVerse v1.9.0` without the native File/Edit menu.

## Deferred or not yet verified

- Full Unicode catalog versioning, rich media, SFU scaling, background voice,
  and in-place participant renegotiation inside an active one-to-one call
  remain deferred. Creating a group from an active one-to-one call now
  preserves the current peer and starts the group call automatically.
- GitHub release `v1.9.0` is published with Windows, macOS Intel, and macOS
  Apple Silicon artifacts. Render health returned HTTP 200 with product
  version `1.9.0`, protocol version `2`, and PostgreSQL persistence.

## Validation run so far

| Check                                                         | Result                        |
| ------------------------------------------------------------- | ----------------------------- |
| `npm run typecheck`                                           | pass                          |
| `npm run lint`                                                | pass                          |
| `npm test -- --run --reporter=dot`                            | pass (22 files, 112 tests)    |
| format, localization, build, audit, and Windows package smoke | pass                          |
| GitHub Release workflow `33272054338`                         | pass                          |
| Quality Gate workflow `33272026294`                           | pass                          |
| Deploy EchoVerse Web workflow `33272026295`                   | pass                          |
| Render `GET /health`                                          | pass (`200`, version `1.9.0`) |
