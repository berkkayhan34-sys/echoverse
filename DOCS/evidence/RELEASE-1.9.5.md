<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `RELEASE-1.9.5`

```yaml
id: RELEASE-1.9.5
status: complete
date: 2026-08-30
revision: 91ca56b
tag: v1.9.5
```

## Published and deployed

- `main` contains commit `91ca56b` and the matching `v1.9.5` tag is present on
  the origin remote.
- The GitHub release page for `v1.9.5` is published with all expected updater
  artifacts:

  | Artifact                             | Verified size (bytes) |
  | ------------------------------------ | --------------------: |
  | `EchoVerse-Setup-1.9.5.exe`          |             123191424 |
  | `EchoVerse-Setup-1.9.5.exe.blockmap` |                128663 |
  | `latest.yml`                         |                   347 |
  | `EchoVerse-1.9.5-x64.dmg`            |             149914409 |
  | `EchoVerse-1.9.5-x64.dmg.blockmap`   |                151036 |
  | `EchoVerse-1.9.5-x64.zip`            |             147379020 |
  | `EchoVerse-1.9.5-x64.zip.blockmap`   |                154335 |
  | `EchoVerse-1.9.5-arm64.dmg`          |             146035760 |
  | `EchoVerse-1.9.5-arm64.dmg.blockmap` |                146992 |
  | `EchoVerse-1.9.5-arm64.zip`          |             143454263 |
  | `EchoVerse-1.9.5-arm64.zip.blockmap` |                149279 |
  | `latest-mac.yml`                     |                   497 |

- Render `GET https://echoverse-c3d5.onrender.com/health` returned HTTP 200,
  product version `1.9.5`, protocol version `2`, and PostgreSQL persistence.
- GitHub Pages `ui-manifest.json` returned HTTP 200 with product version
  `1.9.5`, web revision `91ca56b2935d1faabe36a38e70e8eb724f28e51e`, and minimum
  shell version `1.8.4`.

## Validation

| Check                                         | Result                                        |
| --------------------------------------------- | --------------------------------------------- |
| `npm run version:check`                       | pass (`1.9.5`)                                |
| `npm run format:check` and `git diff --check` | pass                                          |
| `npm run localization:check`                  | pass (361 keys)                               |
| `npm run reuse:check`                         | pass (REUSE 6.2.0; 326/326 files)             |
| `npm run secret-scan`                         | pass (Gitleaks 8.30.1; 124 commits, no leaks) |
| `npm run dependency:check`                    | pass (0 vulnerabilities)                      |
| `npm run typecheck`                           | pass                                          |
| `npm test -- --run`                           | pass (23 files, 122 tests)                    |
| `npm run build`                               | pass (desktop, web, and packages)             |

Authenticated rendered owner-delete/join interaction remains tracked under
`BUG-003`; the local server could not start in this environment because Node
reported `uv_os_get_passwd returned ENOMEM`.
