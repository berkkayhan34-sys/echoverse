<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `RELEASE-1.9.6`

```yaml
id: RELEASE-1.9.6
status: complete
date: 2026-08-31
revision: fc9730ada6f6be951118d3b5e372d6ac83a7a6f6
tag: v1.9.6
release_workflow: 33337857966
```

## Published and deployed

- `main` contains commit `fc9730a` and the matching annotated `v1.9.6` tag is
  present on the origin remote.
- The GitHub release workflow completed successfully for Windows, macOS Intel,
  macOS Apple Silicon, and the publish job. The release asset page exposes the
  Windows installer and updater metadata, both macOS architectures, blockmaps,
  and `latest-mac.yml`.
- Render `GET https://echoverse-c3d5.onrender.com/health` returned HTTP 200,
  product version `1.9.6`, protocol version `2`, and PostgreSQL persistence.
- GitHub Pages `ui-manifest.json` returned HTTP 200 with product version
  `1.9.6`, web revision
  `fc9730ada6f6be951118d3b5e372d6ac83a7a6f6`, and minimum shell version
  `1.8.4`.

## Validation

| Check                                         | Result                                             |
| --------------------------------------------- | -------------------------------------------------- |
| `npm run version:check`                       | pass (`1.9.6`)                                     |
| `npm test -- --reporter=dot`                  | pass (23 files, 129 tests)                         |
| `npm run typecheck`                           | pass                                               |
| `npm run lint`                                | pass                                               |
| `npm run format:check` and `git diff --check` | pass                                               |
| `npm run localization:check`                  | pass (375 keys)                                    |
| `npm run reuse:check`                         | pass (REUSE 3.3; 331/331 files)                    |
| `npm run secret-scan`                         | pass (Gitleaks; 126 commits, no leaks)             |
| `npm run build`                               | pass (desktop, web, and packages)                  |
| GitHub Release workflow `33337857966`         | pass (all jobs and publish)                        |
| Render `/health`                              | pass (`200`, version `1.9.6`)                      |
| GitHub Pages `ui-manifest.json`               | pass (`200`, version `1.9.6`, revision `fc9730a…`) |

`npm run tooling-check` remains unavailable because the repository does not
define that npm script; the documented `make tooling-check` target is the
available Node.js runtime gate.
