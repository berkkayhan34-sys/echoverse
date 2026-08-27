<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Testing and quality policy

Testing is a release requirement, not an optional follow-up. This document
defines the intended gate and records the current gap so a green build cannot
be mistaken for complete product validation.

## Current baseline

The v2 workspace now has Vitest contract/configuration tests, an in-memory
HTTP/Socket.IO security boundary suite, PostgreSQL migration/relationship
tests, and a Playwright smoke suite. The quality workflow installs Chromium,
runs the browser suite, and publishes machine-readable evidence in CI.
Deeper feature-level authorization/IDOR coverage, WebRTC, and installer
coverage remain release-blocking work tracked on the roadmap.

The workspace now exposes deterministic `format:check`, `lint`,
`dependency:check`, `reuse:check`, `secret-scan`, `localization:check`, and `coverage` scripts in
addition to `make ai-check`, `make tooling-check`, `npm run typecheck`,
`npm test`, `npm run test:e2e`, and `npm run build`. Prettier, ESLint, Vitest,
and the V8 coverage provider are exact-pinned in the root package manifest;
`requirements-dev.txt` exact-pins the local REUSE CLI. CI runs the immutable
REUSE and Gitleaks actions after a root-workspace `npm ci`.

These gates establish the static, unit/coverage, server integration, and CI
evidence baseline. Shared contract, configuration, validator, and client
adapter fixtures are covered by `QUAL-002`; HTTP/Socket.IO security cases,
database migration checks, call timeout behavior, and the browser smoke gate
are covered by `QUAL-003`. WebRTC depth, artifact checksums, installer launch,
rollback evidence, and other release-blocking layers remain tracked by later
children. No current check may be described as covering one of those missing
layers.

## Required test layers

1. **Static checks** — formatting, lint, TypeScript typecheck, dependency and
   secret scans, SPDX/REUSE validation.
2. **Unit tests** — pure domain rules, validators, reducers, selectors, and
   adapters with deterministic fixtures.
3. **Server integration tests** — HTTP and Socket.IO routes, database behavior,
   authentication, authorization, rate limits, and safe error responses.
4. **Contract tests** — event names, payload schemas, version compatibility,
   and malformed/oversized input rejection shared by web and desktop.
5. **Client tests** — feature state, permissions, reconnect behavior, media
   controls, and renderer/preload boundaries.
6. **End-to-end and smoke tests** — login, guild/chat flows, calls/signaling,
   attachment handling, update/install startup, and failure recovery.
7. **Release checks** — production builds, artifact manifests/checksums,
   installer launch, version identity, and rollback evidence.

The selected automated stack is Vitest + Playwright. The Codex in-app Browser
is retained for AI/manual visible-flow acceptance and exploratory checks; it is
not a substitute for repeatable automated tests.

Local and CI validation targets Node.js 22 LTS. A version mismatch is a tooling
failure and must be fixed in the environment or documented as an approved
compatibility exception.

## Required gate matrix

Every release candidate must provide machine-readable evidence for the following
checks. The command names identify the required action; a missing command is a
failed gate, not a reason to skip the check.

| Gate                              | Required evidence                                             |
| --------------------------------- | ------------------------------------------------------------- |
| Formatting and lint               | Repository formatter and linter output with no new violations |
| Typecheck and unit/contract tests | Root workspace TypeScript and Vitest results                  |
| SPDX/REUSE and secret scan        | Clean metadata/license and secret-scan results                |
| Coverage                          | Published threshold and report for the applicable test layers |
| Integration and E2E               | HTTP/Socket.IO integration plus Playwright results            |
| Artifacts and checksums           | Versioned artifact list, hashes, and manifest verification    |
| Installer launch and rollback     | Platform smoke result and tested recovery/rollback evidence   |

The root `package-lock.json` and Node.js 22 LTS are mandatory for local and CI
checks. CI must install from the repository root with `npm ci`; app-specific
commands may build or test a selected workspace after that installation.

## QUAL-001 tooling commands

Run the static and unit baseline from the repository root:

```text
npm run format:check
npm run lint
npm run dependency:check
npm run reuse:check
npm run secret-scan
npm run typecheck
npm test
npm run coverage
npm run test:db
```

The local REUSE and Gitleaks commands fail closed when their external tools are
not installed. Install both through the approved platform package path
documented by the development workflow, or use the CI action. The local REUSE
wrapper stages Git-tracked and non-ignored working-tree files under `tmp/` so
workspace dependencies and generated files cannot enter the license scope.
Coverage reports
are written under the ignored `tmp/coverage/` directory. The linter emits
JSON so CI can retain machine-readable diagnostics when a runner collects
step output. `npm run test:db` requires the ephemeral PostgreSQL service used
by the CI database job and is intentionally not part of the ordinary local
test command.

## Negative and security cases

Every protected route/event needs tests for missing, expired, malformed, and
wrong-user credentials. Every resource lookup needs an IDOR/cross-membership
case. Uploads and signaling need size/type/timeout cases. Tests must assert that
errors do not leak secrets, stack traces, or other users' data.

## Completion gate

A behavior change is complete only when relevant layers pass, documentation and
decision records are updated, and the complete diff has been reviewed for
secrets, unrelated files, stale references, and generated artifacts. A manual
check may supplement automation but cannot replace a deterministic regression
test for a repeatable bug.

## Evidence

CI should publish concise, reproducible evidence: command, dependency/runtime
versions, result, and artifact/checksum references. Failures remain visible;
tests must not be skipped, weakened, or hidden to obtain a green workflow.

## Make and AI/agent targets

The root `Makefile` provides stable entrypoints for humans and AI agents:

| Target                           | Purpose                                               | Starts a daemon?          |
| -------------------------------- | ----------------------------------------------------- | ------------------------- |
| `make ai-check` / `make ai-test` | Documentation, metadata, version, and whitespace gate | No                        |
| `make setup`                     | Install all workspace dependencies                    | No                        |
| `make typecheck`                 | Typecheck every workspace package                     | No                        |
| `make test`                      | Run Vitest unit/contract tests                        | No                        |
| `make e2e`                       | Run Playwright browser smoke tests                    | Starts web test server    |
| `make tooling-check`             | Verify the Node.js 22 LTS policy                      | No                        |
| `make format-check`              | Verify repository formatting                          | No                        |
| `make lint`                      | Run ESLint with machine-readable output               | No                        |
| `make reuse-check`               | Run SPDX/REUSE validation                             | No                        |
| `make secret-scan`               | Run Gitleaks secret scanning                          | No                        |
| `make dependency-check`          | Run the npm dependency audit                          | No                        |
| `make coverage`                  | Run Vitest and write coverage reports                 | No                        |
| `make db-test`                   | Run PostgreSQL migration and relationship tests       | No                        |
| `make ai-server-test`            | Health-check an already running local server          | No                        |
| `make server-run`                | Run the local server in the foreground                | Yes                       |
| `make web-build`                 | Build the web client                                  | No                        |
| `make desktop-build`             | Build the desktop renderer                            | No                        |
| `make release-check`             | Validate release metadata without building            | No                        |
| `make release-win`               | Build the Windows installer                           | No, but creates artifacts |
| `make release-mac-intel`         | Build macOS Intel artifacts                           | No, but creates artifacts |
| `make release-mac-arm64`         | Build macOS Apple Silicon artifacts                   | No, but creates artifacts |

`make ai-check` is the default safe gate for documentation-only work.
`make quality` runs the safe gate, all QUAL-001 static gates, Node policy,
typecheck, Vitest tests, and coverage. It does not start product daemons.
`make ai-server-test`
expects the server to be started separately with `make server-run`; set
`ECHO_SERVER_URL` to test another local endpoint. Release targets require
explicit owner approval and must be followed by the artifact checks in
[release.md](release.md).
