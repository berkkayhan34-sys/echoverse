<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-008`

```yaml
id: CODE-008
status: complete
date: 2026-08-29
revision: working-tree; supersedes 90a405a for unattended updater behavior
```

## Scope

- Electron Builder artifact validation checks updater metadata, artifact names,
  SHA-512 checksums, sizes, and compressed blockmaps.
- Packaged startup smoke validation checks the built renderer, both locale
  catalogs, and packaged branding resources before normal Electron startup.
- Updater failure handling rolls state back to the known-good installed version,
  clears progress, and leaves a localized visible error without attempting an
  install from invalid metadata.
- Packaged startup checks GitHub Releases before creating a window, waits for an
  available package, and invokes the silent install path while preserving the
  existing installation directory and administrative-rights scope.
- GitHub Actions validates Windows, macOS Intel, and macOS Apple Silicon
  packaging and launch behavior; the standalone Windows workflow also installs
  and launches the NSIS installer output.

## Validation

| Command or check                                                                       | Runtime/dependencies                             | Result                   | Artifacts or notes                                                                                                                                                            |
| -------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run verify:artifacts --workspace @echoverse/desktop -- --target mac --arch arm64` | Node 22, electron-builder artifacts              | `pass`                   | Local Apple Silicon ZIP/DMG metadata, checksums, sizes, and blockmaps validated.                                                                                              |
| `ECHO_VERSE_SMOKE_TEST=1 EchoVerse.app/Contents/MacOS/EchoVerse`                       | Local macOS Apple Silicon packaged app           | `pass`                   | Mounted ARM64 DMG launched through the explicit packaged smoke entrypoint.                                                                                                    |
| GitHub Build EchoVerse Desktop                                                         | GitHub Actions run `33127671427`, Node 22        | `pass`                   | Windows artifact validation plus macOS Intel and Apple Silicon artifact validation and mounted-DMG launch smoke all passed.                                                   |
| GitHub Quality Gate                                                                    | GitHub Actions run `33127671392`                 | `pass`                   | Quality and PostgreSQL migration jobs passed.                                                                                                                                 |
| GitHub Test Windows Build                                                              | GitHub Actions run `33128549285`, Windows runner | `pass`                   | NSIS installer built, branding/assets and updater metadata validated, installed executable launched with the packaged smoke flag, and evidence artifact uploaded.             |
| `npm exec -- vitest run project/apps/desktop/electron/updater-validation.test.ts`      | Node 22, Vitest                                  | `pass`                   | Six updater boundary tests passed, including known-good-version preservation, invalid-version rejection, download completion, listener cleanup, errors, and timeout handling. |
| `node --check project/apps/desktop/electron/main.cjs`                                  | Node 22                                          | `pass`                   | Startup update gate and silent-install orchestration passed syntax validation.                                                                                                |
| macOS Intel local launch                                                               | Apple Silicon host without Intel translation     | `not locally executable` | Required validation was completed on the GitHub Intel runner instead.                                                                                                         |

## Review notes

The first published smoke workflow revision exposed two test-harness path
errors: macOS steps inherited the desktop working directory, and the Windows
check assumed an extra install subdirectory. Both were corrected in
`39f2176` and `90a405a`; the final platform workflows passed. Unsigned local
artifacts remain validation outputs and are not production-ready until signing
and publisher trust are separately approved.
