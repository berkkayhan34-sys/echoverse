<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-009`

```yaml
id: CODE-009
status: complete
date: 2026-08-28
revision: working tree at audit completion
```

## Scope

This audit reviewed CODE-001 through CODE-008 and CODE-004A-LOCALIZATION
against the v2.0 closure requirements: architecture and repository ownership,
security boundaries, automated and browser testing, migration compatibility,
release artifacts, updater recovery, and stale/generated/duplicate paths.

## Audit matrix

| Area                              | Evidence                                                                                                             | Result                                                                                                                                                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture and repository shape | `DOCS/architecture.md`, `DOCS/architecture/repository-structure.md`, source-tree inspection, and `make ai-check`     | `pass`: application code remains under `project/`; technical documentation remains under `DOCS/`; legacy root `src/`, `web/`, `server/`, and `desktop/` paths are absent; no tracked generated or temporary output paths were found.                                          |
| Security boundaries               | `DOCS/security-policy.md`, `DOCS/threat-model.md`, server integration tests, Electron preload review, `make quality` | `pass`: HTTP and Socket.IO authorization, membership, malformed-input, size, and safe-error cases remain covered; Electron windows retain isolation, disabled Node integration, sandboxing, and fixed-channel IPC; updater failures fail closed.                              |
| Tests and release CI              | local quality/build/E2E gates plus GitHub runs `33127671392`, `33127671427`, and `33128549285`                       | `pass`: quality and PostgreSQL migration jobs passed; desktop artifact and mounted-DMG smoke jobs passed on macOS Intel and Apple Silicon; Windows installer packaging and installed-executable smoke passed.                                                                 |
| Browser acceptance                | Codex in-app Browser web-shell inspection and Playwright smoke suite                                                 | `pass`: the running web shell rendered online in English without visible error state; automated smoke passed for English, Turkish, and unsupported-locale English fallback. Desktop development-runtime inspection remains deferred by the recorded owner decision.           |
| Localization                      | `DOCS/evidence/CODE-004A-LOCALIZATION.md`, `make quality`, `project/packages/contracts/src/localizations/*.json`     | `pass`: English and Turkish catalogs contain the same 343 keys; visible user text uses catalog keys; English is the fallback; no `i18n.ts` catalog file exists. The desktop-runtime verification deferral remains explicitly recorded.                                        |
| Persistence and compatibility     | SQLite local tests, PostgreSQL CI migration job, contracts/config tests, and manifest validation                     | `pass`: authorized local SQLite coverage and CI PostgreSQL migration coverage passed; CODE-006 through CODE-008 introduce no schema or persisted-format transition; Render manifest authority and compatibility mirror remain documented and validated.                       |
| Release artifacts and recovery    | `DOCS/evidence/CODE-008.md`, artifact validators, platform smoke workflows, updater-validation tests                 | `pass`: artifact metadata, names, checksums, sizes, blockmaps, branding, version identity, packaged startup, installer launch, and invalid-update rejection passed; rejected or failed updates preserve the known-good version, reset progress, and expose a localized error. |
| Stale and duplicate paths         | complete tracked-file/path audit, `make ai-check`, `make quality`, final diff review                                 | `pass`: no stale runtime implementation, duplicate application tree, tracked generated output, or unresolved CODE-001–CODE-008 evidence claim remains. Historical references under `DOCS/historic/` are retained as historical records.                                       |

## Validation

| Command or check                                                                  | Runtime/dependencies                                | Result | Artifacts or notes                                                                                                                                                           |
| --------------------------------------------------------------------------------- | --------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `make quality`                                                                    | Node 22, repository gates, Homebrew REUSE/Gitleaks  | `pass` | Formatting, lint with no warnings/errors, metadata/version/roadmap checks, REUSE, Gitleaks, localization parity, npm audit, typecheck, 87 Vitest tests, and coverage passed. |
| `npm run build --workspaces --if-present`                                         | Node 22, TypeScript, Vite                           | `pass` | Server, web, desktop, and shared workspace builds completed successfully.                                                                                                    |
| `npm run test:e2e -- --reporter=line`                                             | Node 22, Playwright/Chromium                        | `pass` | Four web smoke scenarios passed, including English, Turkish, and unsupported-locale fallback.                                                                                |
| `npm exec -- vitest run project/apps/desktop/electron/updater-validation.test.ts` | Node 22, Vitest                                     | `pass` | Updater validation and known-good-version failure recovery tests passed.                                                                                                     |
| GitHub Quality Gate run `33127671392`                                             | GitHub Actions, Node 22, PostgreSQL service         | `pass` | Full quality and PostgreSQL migration jobs passed.                                                                                                                           |
| GitHub Build EchoVerse Desktop run `33127671427`                                  | GitHub Actions, Windows and macOS Intel/ARM runners | `pass` | Artifact validation and mounted-DMG launch smoke passed on all required platform runners.                                                                                    |
| GitHub Test Windows Build run `33128549285`                                       | GitHub Actions, Windows runner                      | `pass` | NSIS installation, branding/assets, updater metadata, checksum/blockmap, and installed executable smoke passed.                                                              |
| Codex in-app Browser web shell                                                    | Integrated Browser, local web runtime               | `pass` | Online web shell inspected in English with no visible error state; desktop development-runtime inspection remains owner-deferred.                                            |
| `git diff --check`                                                                | Git                                                 | `pass` | No whitespace errors.                                                                                                                                                        |

## Review notes

The audit corrected stale evidence revisions that still described already
published commits as pending publication, aligned testing/release/architecture
docs with the completed platform smoke evidence, and added explicit updater
failure recovery so invalid metadata cannot replace the known-good version.

Unsigned artifacts are intentionally not called production-ready. Platform
signing/notarization, binary publisher trust, key rotation, full installer
rollback, and final public-release approval remain later v2.1 roadmap work
(OPS-001 through OPS-004 and READY-001), not unresolved v2.0 audit blockers.
