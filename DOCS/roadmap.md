<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Stationary implementation roadmap

This is the only authoritative implementation order for EchoVerse. Ordinary
children are stationary and must be completed in the order shown. A temporary
audit child may block the ordinary sequence, but it must be removed only after
its evidence is complete and moved to the historical audit record.

Every child has a stable ID, one checkbox, machine-readable metadata, and an
evidence link or `null`. Allowed statuses are `incomplete`, `in_progress`, and
`complete`; they must match the checkbox: `[ ]`, `[-]`, and `[x]` respectively.
The first incomplete or in-progress child is the only active child. Before
working on it, change its status to `in_progress` and its checkbox to `[-]`.
Do not edit a later child until the immediately preceding child is explicitly
complete with implementation, applicable tests, security review,
documentation, and evidence.

Every implementation child inherits the applicable checks in
[testing-policy.md](testing-policy.md). Public events, persisted data,
authentication, authorization, deployment, compatibility, and release policy
changes require an ADR before implementation. Evidence records describe what
was verified at a revision; they do not replace the status in this file.

## Current baseline

The shipped baseline is product version `1.7.5`, with protocol major version 2.
The workspace cutover, canonical versioning, GPL-3.0-only metadata, dependency
audit, baseline build/typecheck/Vitest/Playwright smoke checks, and the Render
deployment are complete. They do not close the incomplete children below.

## v1.8.x — documentation and repository readiness

### documentation-and-roadmap-governance

```yaml
id: DOC-001
type: documentation_foundation
status: complete
evidence: evidence/DOC-001.md
blocks_roadmap: true
```

[x] Establish the stationary child/evidence convention for this roadmap,
create the documented `DOCS/evidence/` and `DOCS/audits/` surfaces, add an
evidence template and a roadmap/status validator, and make `DOCS/README.md`
the complete navigation index. Keep the first-active-child rule, checkbox and
metadata consistency, and historical-audit lifecycle machine-checkable.

### architecture-and-repository-truth

```yaml
id: DOC-002
type: documentation_and_architecture
status: complete
evidence: evidence/DOC-002.md
```

[x] Reconcile the architecture map with the actual repository: document the
feature ownership/public entrypoint/test/README map, account for the empty
legacy `src/` path, repair the old `desktop/` and `server/` paths in
`DOCS/release-build-tr.md`, and resolve the dual Render manifest policy. If
`project/render.yaml` is retired, record the decision and recovery path in an ADR;
otherwise document and validate one authoritative mirror process.

### development-testing-and-release-docs

```yaml
id: DOC-003
type: documentation_and_tooling_policy
status: complete
evidence: evidence/DOC-003.md
```

[x] Align development, testing, release, Makefile, and workflow documentation
with the root npm workspace and Node.js 22 LTS policy. Document the required
lint/format, SPDX/REUSE, secret-scan, coverage, E2E, integration, artifact,
checksum, installer-launch, and rollback gates. Document that local release
targets never publish, that unsigned artifacts are not production-ready, and
that release scripts cannot publish accidentally.

### security-threat-data-lifecycle

```yaml
id: DOC-004
type: security_and_privacy_policy
status: complete
evidence: evidence/DOC-004.md
```

[x] Add the missing threat-model and data-lifecycle detail: trust-boundary
owners, secret and token handling, session lifecycle, upload/media limits,
rate-limit and timeout expectations, safe-error rules, log redaction,
retention/access, user deletion, backup/export deletion, and deletion evidence.
Link each required control to its owning test and release evidence.

### governance-and-public-release-runbook

```yaml
id: DOC-005
type: governance_and_operations
status: complete
evidence: evidence/DOC-005.md
```

[x] Name the operational owner, incident escalation path, release approvers,
and evidence-retention owner. Write the pre-public-release runbook for
CODEOWNERS, required reviews, branch protection, security reporting, release
approval, rollback, and incident response. Keep the solo-maintainer exception
active until this gate is deliberately activated.

### documentation-foundation-verification

```yaml
id: DOC-006
type: verification_audit
status: complete
evidence: evidence/DOC-006.md
```

[x] Run the documentation/repository audit over DOC-001 through DOC-005,
including links, metadata, SPDX/REUSE declarations, ignored paths, stale
references, ADR completeness, and the complete diff. Record reproducible
evidence before any product-runtime code is changed.

## v1.9.x — validation and quality foundation

### canonical-validation-tooling

```yaml
id: QUAL-001
type: tooling_and_ci
status: complete
evidence: evidence/QUAL-001.md
```

[x] Add deterministic root-workspace install checks, Node 22 enforcement in all
local and CI/release jobs, formatting and linting, SPDX/REUSE validation,
secret scanning, dependency scanning, coverage reporting, and machine-readable
failure output. Replace app-local installation drift with the documented
canonical lockfile workflow.

### contract-and-boundary-test-foundation

```yaml
id: QUAL-002
type: automated_testing
status: complete
evidence: evidence/QUAL-002.md
```

[x] Expand Vitest contracts and boundary fixtures for event compatibility,
version negotiation, malformed and oversized payloads, pagination, attachment
metadata, signaling messages, safe error shapes, and cross-client web/desktop
compatibility. Add deterministic unit coverage for validators, reducers,
selectors, adapters, and configuration failures.

### integration-security-and-evidence-gates

```yaml
id: QUAL-003
type: ci_quality_gate
status: complete
evidence: evidence/QUAL-003.md
```

[x] Add server HTTP/Socket.IO integration, authorization/IDOR, rate-limit,
timeout, origin/security-header, secret-negative, and database test jobs. Run
the Playwright E2E suite in CI, publish concise command/runtime/result/artifact
evidence, and make every release-blocking failure visible rather than skipped.

## v2.0.x — runtime hardening and modular-monolith completion

### session-and-transport-security

```yaml
id: CODE-001
type: runtime_security
status: complete
evidence: evidence/CODE-001.md
```

[x] Implement and test the documented hybrid session model: short-lived
`Secure`/`HttpOnly` web cookies, desktop OS secure storage, refresh rotation,
revocation, expiry, logout, origin checks, CORS/trusted-proxy/TLS settings,
security headers, and fail-closed production secret validation.

### input-limits-and-safe-failure-boundaries

```yaml
id: CODE-002
type: runtime_security
status: complete
evidence: evidence/CODE-002.md
```

[x] Enforce boundary schemas, size/type limits, rate limits, timeouts, bounded
resource use, and privacy-safe error responses for every HTTP route, Socket.IO
event, upload, OAuth callback, media/signaling operation, and updater input.
Prove that stack traces, credentials, tokens, message bodies, and other users'
data never cross the response or log boundary.

### persistence-adapters-and-migrations

```yaml
id: CODE-003
type: persistence_and_compatibility
status: complete
evidence: evidence/CODE-003.md
```

[x] Implement the production SQLite adapter, complete PostgreSQL integration
coverage, and add migration, schema, backup/restore, rollback, and
SQLite/PostgreSQL compatibility tests. Keep hosted PostgreSQL migrations and
the local adapter behavior explicitly aligned.

### complete-application-localization

```yaml
id: CODE-004A-LOCALIZATION
type: localization_foundation
status: in_progress
evidence: evidence/CODE-004A-LOCALIZATION.md
```

[-] Inventory every application-owned string, including visible UI text,
validation and error messages, notifications, empty/loading states, server
responses, logs, and other runtime text users may not directly see. Move the
complete inventory into key/value locale catalogs with no hard-coded natural
language strings left in application code. Ship English (`en`) and Turkish
(`tr`) first, with explicit locale selection, deterministic fallback, and a
documented process for adding later locales. Protocol/event names, SQL/CSS
identifiers, URLs, and third-party literals must be explicitly classified as
non-localizable rather than silently omitted.

The localization boundary must be Unicode-first and language-independent:
UTF-8 must be preserved end to end across input, validation, Socket.IO
payloads, persistence, logs, search, sorting, export/import, and updater
metadata. Code must not assume ASCII or one-code-point characters; grapheme
clusters, combining marks, emoji, CJK text, locale-aware case conversion,
plural/date/number formatting, and font fallback must be handled explicitly.
The catalogs and UI layout must leave room for future locale metadata such as
writing direction and longer translations, even though only `en` and `tr` ship
initially.

The child is incomplete until automated tests prove that both catalogs have
the same keys, interpolation placeholders and required values match, missing
translations follow the documented fallback, unknown keys fail safely, server
and clients resolve the same catalog, and representative web/desktop flows
work in both English and Turkish. Tests must also cover non-ASCII, combining,
emoji, and CJK fixtures through the complete client/server/database/search
path, plus locale-aware formatting and future-direction-safe layout behavior.
Record static string-inventory and browser acceptance evidence.

Current status and blockers recorded on 2026-08-27:

- Server-owned response and user-facing diagnostic strings in
  `project/apps/server/src/index.ts` are now catalog-backed in the working tree;
  commit-level evidence and complete acceptance remain pending.
- The static source inventory and catalog guard now pass for the application
  source tree, including JSX text, user-facing attributes, DOM text assignment,
  CSS generated text, catalog key parity, and interpolation parity.
- The current Playwright and integrated-browser acceptance covers the web shell
  in English and Turkish, and the static string-inventory guard passes; the
  complete desktop Electron browser-flow matrix has not yet been recorded. The documented
  Electron runner downloaded its declared runtime but macOS refused to launch
  the helper with `sandbox_extension_issue_file ... (Operation not permitted)`.
- Catalog, client, server, and SQLite Unicode fixtures pass locally, including
  combining marks, emoji, CJK text, grapheme-safe username validation and
  client/server username search. Export/import coverage is not an existing
  runtime boundary and remains later roadmap work, as approved by the owner.
- The experimental Node SQLite adapter was replaced with the approved native
  `better-sqlite3` adapter; the prior Node experimental warning is no longer
  emitted by the SQLite tests. Native dependency installation and Node.js 22
  LTS remain documented prerequisites.
- Complete desktop Electron browser-flow acceptance and release signing remain
  later roadmap work, as approved by the owner. The local Electron runner still
  cannot launch its helper because macOS reports
  `sandbox_extension_issue_file ... (Operation not permitted)`.
- `.DS_Store` files are intentionally ignored and out of scope; no cleanup or
  validation action is required for them.
- Local REUSE and Gitleaks gates are installed and pass. PostgreSQL integration
  remains intentionally CI-only by owner decision; SQLite is the local database
  validation target and PostgreSQL is not a local blocker.

### server-feature-extraction

```yaml
id: CODE-004
type: architecture_refactor
status: incomplete
evidence: null
```

[ ] Extract identity/accounts, guilds/membership/presence, chat/history,
friends/DM, calls/signaling, Spotify, persistence, and transport composition
into cohesive feature modules. Move authorization and input schemas into the
owning feature boundary, preserve one server process, remove obsolete paths,
and enforce dependency direction with focused tests.

### authorization-completeness

```yaml
id: CODE-005
type: runtime_authorization
status: incomplete
evidence: null
```

[ ] Enforce server-side authorization for every protected route and event,
including guild membership, direct messages, attachments, presence, calls,
signaling, and integrations. Add missing/expired/wrong-user/cross-membership
negative tests and prove that authorization cannot be bypassed through an
alternate transport or identifier.

### shared-client-core-and-boundaries

```yaml
id: CODE-006
type: client_architecture
status: incomplete
evidence: null
```

[ ] Extract shared auth/session/socket/feature state into `project/packages/client-core`
and browser-safe UI primitives into `project/packages/shared-ui`. Split the large web
and desktop renderer files by feature, keep Electron-only behavior behind the
narrow preload bridge, and add tests for permissions, reconnect, media controls,
and renderer/preload isolation.

### webrtc-and-media-regressions

```yaml
id: CODE-007
type: realtime_media_testing
status: incomplete
evidence: null
```

[ ] Add repeatable WebRTC and signaling regression coverage for join/leave,
call connect/end, reconnect, microphone/deafen, screen share, timeout,
malformed messages, and cleanup after failure. Include attachment/media type,
size, timeout, and authorization cases.

### installer-and-update-smoke

```yaml
id: CODE-008
type: release_validation
status: incomplete
evidence: null
```

[ ] Add Windows and macOS Intel/Apple Silicon installer launch smoke tests,
version identity checks, updater manifest and checksum verification, startup
failure recovery, and update rollback checks. Record platform-specific
limitations and do not mark unsigned artifacts production-ready.

### v2-runtime-verification-audit

```yaml
id: CODE-009
type: verification_audit
status: incomplete
evidence: null
blocks_roadmap: true
```

[ ] Audit CODE-001 through CODE-008 and CODE-004A-LOCALIZATION against architecture, security, testing,
browser acceptance, migration compatibility, release artifacts, and rollback
evidence. The v2.0 line cannot close until all release blockers are green and
the complete diff contains no stale runtime, generated, or duplicate paths.

## v2.1.x — operational and release readiness

### privacy-safe-observability

```yaml
id: OPS-001
type: operations
status: incomplete
evidence: null
```

[ ] Implement structured privacy-safe logs, correlation IDs, basic metrics,
redaction tests, retention/access controls, and documented production
diagnostics without passwords, tokens, cookies, message bodies, media, or
unnecessary personal data.

### performance-and-failure-recovery

```yaml
id: OPS-002
type: reliability
status: incomplete
evidence: null
```

[ ] Define and test performance/resource budgets, connection and filesystem
cleanup, bounded queues, restart behavior, retry/idempotency rules, degraded
database and network states, and user-visible recovery paths.

### signed-publisher-verified-artifacts

```yaml
id: OPS-003
type: release_security
status: incomplete
evidence: null
```

[ ] Select and implement Windows publisher signing plus Apple code signing and
notarization. Verify publisher identity and update artifacts in CI, retain
checksums and provenance, and document key rotation and rollback. Until this
child is complete, release notes must identify artifacts as unsigned.

### support-incident-and-release-evidence

```yaml
id: OPS-004
type: operational_readiness
status: incomplete
evidence: null
```

[ ] Publish support, incident response, release evidence, artifact retention,
known-issues, and rollback procedures. Record the exact shipped version,
commit/tag, checksums, workflow results, signing status, and unresolved risks
for every release.

### public-release-readiness-gate

```yaml
id: READY-001
type: final_readiness_gate
status: incomplete
evidence: null
blocks_roadmap: true
```

[ ] Confirm that every preceding child is complete, all release blockers are
closed, governance is active, CI and browser evidence are reproducible, the
database and updater rollback paths are tested, and the public-release
checklist is approved. No new product feature or visual-polish work may start
before this gate passes.

## Future product work — starts only after READY-001

### new-product-features

```yaml
id: FEAT-001
type: product_feature
status: incomplete
evidence: null
```

[ ] Add new product capabilities only after the readiness gate, each as a
separately ordered child with an ADR where required, contract changes, focused
security/integration/E2E tests, browser evidence, release notes, and rollback
plan.

### interface-and-visual-polish

```yaml
id: UI-001
type: visual_polish
status: incomplete
evidence: null
```

[ ] Perform UI and interaction redesign only after READY-001 and the relevant
feature contract is complete. Each visual change must preserve the shared
client boundaries, use Codex Browser visible-flow acceptance where applicable,
and include a deterministic regression test for repeatable behavior.

## Release/version rule

The root [`VERSION`](../VERSION) file remains the canonical product version.
Every release must update package mirrors, roadmap status, changelog/release
notes, checksums, and workflow evidence together, then publish only the
matching `v<version>` tag as described in [release.md](release.md).
