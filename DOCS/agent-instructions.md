<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse agent instructions

This repository uses a modular-monolith workspace. Runtime implementation and
its tests live under `project/`; technical authority lives under `DOCS/`; and
generated/local state belongs under the ignored root `tmp/` directory.

## 1. Non-negotiable boundaries

- Read this file before working on the repository.
- Preserve unrelated user work. Never reset, clean, overwrite, or delete user
  files without explicit approval for the exact target.
- Never commit or expose passwords, tokens, cookies, private keys, database
  dumps, personal data, production logs, or real environment values.
- Treat authentication, authorization, WebRTC signaling, attachments, media,
  updater packages, and external integrations as security-sensitive.
- Do not claim a feature, test, security control, or deployment guarantee is
  implemented until its code, tests, documentation, and evidence agree.

## 2. Source-of-truth hierarchy

1. `AGENTS.md` — repository discovery bridge and workspace boundary.
2. `DOCS/agent-instructions.md` — project-specific engineering rules.
3. `DOCS/architecture.md` — target runtime, module, data, and integration
   architecture.
4. `DOCS/security-policy.md` — security objectives, trust boundaries, and
   release blockers.
5. `DOCS/testing-policy.md` — test levels, quality gates, and completion rules.
6. `DOCS/development.md` — local setup and day-to-day development workflow.
7. `DOCS/release.md` — versioning, packaging, signing, and release procedure.
8. `DOCS/decisions/` — confirmed decisions and unresolved choices.
9. `DOCS/roadmap.md` — ordered migration and feature work.
10. `README.md` and `README-TR.md` — owner-facing product entrypoints; they
    must link to, and must not contradict, the canonical documents above.
11. `VERSION` — the single canonical product version. Package manifests are
    compatibility mirrors and release automation must validate them against it.

When two documents disagree, update the lower-authority document or record an
unresolved decision; do not silently invent a third interpretation.

## 3. Current target architecture

EchoVerse will remain a modular monolith in a single repository. The planned
shape is:

```text
project/apps/
  server/       # HTTP and Socket.IO transport composition
  web/          # browser entrypoint
  desktop/      # Electron shell and desktop-only bridge
project/packages/
  contracts/    # versioned protocol and runtime validation contracts
  client-core/  # shared auth, session, socket, and feature state
  shared-ui/    # shared browser-safe components and styles
  config/       # validated environment and endpoint configuration
DOCS/
```

The current implementation surface is `project/apps/`, `project/packages/`,
and `project/tests/`. No application source, project-local configuration,
asset, migration, or test may be added outside `project/`. The root contains
only product entrypoints, canonical metadata, repository tooling, and links to
the technical documentation.

The owner-selected refactor strategy is **B: controlled big-bang cutover**.
The repository layout cutover is recorded in ADR-0010. It preserves runtime
behavior while relocating the existing implementation as one bounded change;
future runtime changes must continue to use the `project/` boundaries.

Server feature boundaries will be explicit: authentication/accounts,
guilds/presence, chat, friends/DM, calls/signaling, Spotify integration,
persistence, and transport. Each boundary should expose a small interface and
keep validation, authorization, and side effects at the correct layer.

## 4. Maintainability rules

- Prefer feature modules over one large handler or component file.
- Keep UI entrypoints thin; place reusable client behavior in shared modules
  and feature behavior in feature directories.
- Prefer modules below 500 lines. A larger file requires a documented reason,
  an owner, and a bounded extraction plan.
- Keep domain logic independent from Electron, Socket.IO, filesystem, and
  database adapters where practical.
- Use typed protocol contracts and runtime boundary validation for untrusted
  data. Do not rely on TypeScript types alone at network boundaries.
- Add focused tests and documentation with every behavior change.
- Remove obsolete duplicate implementations after their replacement is
  validated; do not retain commented-out code or hidden compatibility shims.

## 5. Security baseline

- Secrets are required from environment/configuration; no production fallback
  secret or default credential is allowed.
- Authentication and authorization deny by default and are enforced server-side
  for HTTP and Socket.IO events.
- CORS, origins, trusted proxy behavior, cookies/tokens, and TLS assumptions
  must be explicit and documented.
- Validate message, username, attachment, avatar, media, and signaling input
  at the server boundary with bounded sizes and safe error responses.
- Apply rate limits and resource budgets to authentication, messaging,
  signaling, uploads, and expensive operations.
- Do not log secrets or unnecessary personal data. Use privacy-safe structured
  diagnostics and correlation identifiers.
- Release artifacts require integrity verification and a documented signing or
  publisher-trust decision before being called production-ready.

## 6. Testing and completion

The quality gate is documented in `DOCS/testing-policy.md`. It includes
TypeScript typecheck, lint/format, server unit and
integration tests, protocol/authorization negative tests, frontend tests,
WebRTC regression coverage, security/dependency scans, production builds, and
installer smoke checks.

`make ai-check` is the safe non-daemon gate. `make ai-server-test` may be used
only when a server was intentionally started separately. SQLite is the local
database validation target; PostgreSQL integration remains a CI/service gate
and is not required on this development host.

## 7. Localization contract

Every natural-language string that can be shown to an application user,
including error dialogs, notifications, validation messages, empty/loading
states, and server responses, must be addressed by a catalog key. Catalog data
is stored only as one JSON file per language in
`project/packages/contracts/src/localizations/`: `en.json` and `tr.json` are
required and must have identical key sets and placeholders. English is the
fallback for unsupported locales. Protocol names, URLs, SQL, CSS identifiers,
storage keys, stable log IDs, MIME types, and other machine-facing literals are
not user-facing text and remain stable English identifiers.

Add both English and Turkish values in the same change. Use the shared loader;
do not add an `i18n.ts` catalog or hard-code user-visible natural language in
application code.

## 8. Branch and change policy

- Documentation/governance work uses a focused `docs/<topic>` branch unless the
  owner explicitly directs another integration path.
- Keep one coherent concern per change and review the complete diff before
  integration.
- Until public release, the owner may self-review as the sole maintainer. Before
  public release, CODEOWNERS and mandatory reviewer enforcement must be active
  for security, release, deployment, architecture, licensing, and data changes.
- Do not commit or push unless explicitly requested.
- A documentation-only change must state its affected source-of-truth files,
  validation performed, and any deferred runtime work.

## 9. Licensing and metadata

EchoVerse is GPL-3.0-only. New text/configuration/source files must carry the
SPDX header used by this repository, and non-source assets must be covered by
`REUSE.toml` annotations. Generated output, local environments, runtime data,
and temporary evidence must stay under ignored `tmp/` and must never be the
only copy of an important result.
