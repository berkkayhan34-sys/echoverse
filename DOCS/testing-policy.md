<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Testing and quality policy

Testing is a release requirement, not an optional follow-up. This document
defines the intended gate and records the current gap so a green build cannot
be mistaken for complete product validation.

## Current baseline

The v2 workspace now has Vitest contract/configuration tests and a Playwright
smoke suite. Feature-level authorization, database integration, WebRTC and
installer coverage remain release-blocking work tracked on the roadmap.

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

| Target | Purpose | Starts a daemon? |
| --- | --- | --- |
| `make ai-check` / `make ai-test` | Documentation, metadata, version, and whitespace gate | No |
| `make setup` | Install all workspace dependencies | No |
| `make typecheck` | Typecheck every workspace package | No |
| `make test` | Run Vitest unit/contract tests | No |
| `make e2e` | Run Playwright browser smoke tests | Starts web test server |
| `make tooling-check` | Verify the Node.js 22 LTS policy | No |
| `make ai-server-test` | Health-check an already running local server | No |
| `make server-run` | Run the local server in the foreground | Yes |
| `make web-build` | Build the web client | No |
| `make desktop-build` | Build the desktop renderer | No |
| `make release-check` | Validate release metadata without building | No |
| `make release-win` | Build the Windows installer | No, but creates artifacts |
| `make release-mac-intel` | Build macOS Intel artifacts | No, but creates artifacts |
| `make release-mac-arm64` | Build macOS Apple Silicon artifacts | No, but creates artifacts |

`make ai-check` is the default safe gate for documentation-only work.
`make quality` runs metadata, typecheck, and Vitest checks. `make ai-server-test`
expects the server to be started separately with `make server-run`; set
`ECHO_SERVER_URL` to test another local endpoint. Release targets require
explicit owner approval and must be followed by the artifact checks in
[release.md](release.md).
