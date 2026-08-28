<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-004A-LOCALIZATION`

```yaml
id: CODE-004A-LOCALIZATION
status: complete
date: 2026-08-27
revision: f876bbb
```

## Scope

- Affected source-of-truth files: JSON locale catalogs under
  `project/packages/contracts/src/localizations/`, the shared localization loader,
  server response boundaries, web and desktop renderers, Electron main/preload
  boundaries, updater validation, and localization documentation.
- Security and compatibility impact: user-visible server responses and client
  errors now resolve through the selected `en` or `tr` catalog; protocol/event
  names, machine-readable values, stable log IDs, URLs, SQL, CSS, and
  third-party literals remain explicitly non-localizable identifiers.
- Deferred runtime work: complete desktop Electron browser-flow coverage,
  export/import coverage, and release signing remain later roadmap work by
  owner decision. The local Electron runner could not launch because macOS
  reported `sandbox_extension_issue_file ... (Operation not permitted)` for the
  downloaded Electron helper.

## Validation

| Command or check                 | Runtime/dependencies                   | Result               | Artifacts or notes                                                                                                                                                                                                          |
| -------------------------------- | -------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                       | Node/npm workspace dependencies        | pass                 | 14 test files and 59 tests passed, including JSON key/placeholder parity, grapheme-safe Unicode username validation/search, server locale responses, SQLite persistence, server feature boundaries, and updater validation. |
| `npm run typecheck`              | TypeScript workspace dependencies      | pass                 | All available TypeScript workspaces typechecked without errors.                                                                                                                                                             |
| `npm run build`                  | Vite/TypeScript workspace dependencies | pass                 | Web and desktop production builds completed; all package builds completed.                                                                                                                                                  |
| `npm run lint`                   | ESLint workspace dependencies          | pass                 | ESLint completed without reported findings.                                                                                                                                                                                 |
| `npm run format:check`           | Prettier workspace dependency          | pass                 | All repository files matched the formatter.                                                                                                                                                                                 |
| `npm run test:e2e`               | Playwright and local browser process   | pass                 | Web shell plus English, Turkish, and unsupported-locale fallback smoke flows passed: 4 tests. Desktop Electron flows remain unverified.                                                                                     |
| integrated browser locale flow   | Codex in-app Browser                   | pass                 | Selected English and Turkish in the running web app; Turkish heading, tagline, connection state, controls, and language selection were visible without browser console errors.                                              |
| SQLite-backed search integration | Node 22 and temporary SQLite database  | pass                 | Server registration and username search passed through the native SQLite adapter with combining marks, emoji, CJK text, escaped search wildcards, and Turkish locale-aware matching.                                        |
| desktop Electron runner          | Electron 44 development runtime        | deferred by decision | The runner downloaded Electron but macOS refused to launch its helper with `sandbox_extension_issue_file ... (Operation not permitted)`; complete desktop flow acceptance is later roadmap work.                            |
| Electron package smoke           | electron-builder 26.15.3               | pass                 | Local macOS arm64 directory package contains `/dist/index.html`, `/electron/main.cjs`, and catalog-derived Info.plist permission descriptions under `tmp/release/desktop/`.                                                 |
| `npm run localization:check`     | Node and repository source             | pass                 | The guard checked 335 catalog keys plus application TypeScript, JSX, CSS, and HTML metadata for key parity, placeholders, raw JSX text, user-facing attributes, DOM text assignment, and generated CSS text.                |
| `make ai-check`                  | Repository tooling                     | pass                 | Canonical version, metadata, roadmap, documentation, and repository-boundary checks passed.                                                                                                                                 |
| `npm run reuse:check`            | Homebrew REUSE 6.2.0                   | pass                 | All 211 repository files passed the REUSE scope check.                                                                                                                                                                      |
| `npm run secret-scan`            | `gitleaks` executable                  | pass                 | Homebrew-provided Gitleaks 8.30.1 scanned the repository history and working tree without findings.                                                                                                                         |
| `npm run test:db`                | PostgreSQL service and `DATABASE_URL`  | deferred by decision | Not run locally: owner explicitly selected SQLite-only local validation and deferred PostgreSQL evidence to CI/service environments.                                                                                        |

## Review notes

The former `project/packages/contracts/src/i18n.ts` catalog and test were removed.
All shipped localization data is now one JSON file per language under the
`localizations` directory, with the code-facing loader kept separate from the
catalog data. Packaged desktop resources include the same JSON directory.

The web smoke matrix now also verifies that an unsupported stored locale such
as `trick` resolves to the English catalog. The same exact-language-tag rule is
covered at the shared contract, server HTTP/Socket.IO, desktop locale, and
updater-message boundaries. The localization foundation is complete for the
approved web-first scope. Desktop runtime verification was not performed and is
explicitly deferred to the late roadmap by owner decision; export/import scope
and release-signing acceptance are also later roadmap work. The
local Unicode search path is now covered through registration, Socket.IO search,
and the server's in-memory persistence boundary. The local REUSE and Gitleaks
gates are no longer blockers, and the approved `better-sqlite3` adapter removes
the previous Node experimental SQLite warning without suppressing diagnostics.
