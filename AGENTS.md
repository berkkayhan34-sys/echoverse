<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse agent instructions

This repository is in a documentation-and-governance foundation phase. Until
the foundation roadmap item is explicitly accepted, do not change runtime
behavior, product features, protocol behavior, data formats, or deployment
behavior. Documentation and repository metadata changes remain in scope.

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

1. `AGENTS.md` — agent operating rules and repository boundaries.
2. `DOCS/architecture.md` — target runtime, module, data, and integration
   architecture.
3. `DOCS/security-policy.md` — security objectives, trust boundaries, and
   release blockers.
4. `DOCS/testing-policy.md` — test levels, quality gates, and completion rules.
5. `DOCS/development.md` — local setup and day-to-day development workflow.
6. `DOCS/release.md` — versioning, packaging, signing, and release procedure.
7. `DOCS/decisions/` — confirmed decisions and unresolved choices.
8. `DOCS/roadmap.md` — ordered migration and feature work.
9. `README-TR.md` and `DOCS/` — owner-facing and historical references; they
   must link to, and must not contradict, the canonical documents above.
10. `VERSION` — the single canonical product version. Package manifests are
    compatibility mirrors and release automation must validate them against it.

When two documents disagree, update the lower-authority document or record an
unresolved decision; do not silently invent a third interpretation.

## 3. Current target architecture

EchoVerse will remain a modular monolith in a single repository. The planned
shape is:

```text
apps/
  server/       # HTTP and Socket.IO transport composition
  web/          # browser entrypoint
  desktop/      # Electron shell and desktop-only bridge
packages/
  contracts/    # versioned protocol and runtime validation contracts
  client-core/  # shared auth, session, socket, and feature state
  shared-ui/    # shared browser-safe components and styles
  config/       # validated environment and endpoint configuration
DOCS/
```

The current `server/`, `web/`, and `desktop/` paths remain the implementation
surface until the planned cutover. The root `src/` server entrypoint is legacy
and must not receive new product behavior.

The owner-selected refactor strategy is **B: controlled big-bang cutover**.
The foundation phase may prepare documentation, contracts, tests, and build
checks, but it must not gradually ship a second runtime architecture beside
the current one. The cutover is a separately approved, bounded change with a
rollback point and an explicit compatibility review.

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

The planned quality gate is documented in `DOCS/testing-policy.md`. It will
eventually include TypeScript typecheck, lint/format, server unit and
integration tests, protocol/authorization negative tests, frontend tests,
WebRTC regression coverage, security/dependency scans, production builds, and
installer smoke checks.

During the documentation foundation phase, validate only documentation,
metadata, links, YAML/JSON syntax, SPDX/REUSE consistency, and repository
boundaries. `make ai-check` is the safe default gate; `make ai-server-test`
may be used only when a server was intentionally started separately. Do not
start or modify product daemons merely to validate docs.

## 7. Branch and change policy

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

## 8. Licensing and metadata

EchoVerse is GPL-3.0-only. New text/configuration files must carry the SPDX
header used by this repository, and non-source assets must be covered by
`REUSE.toml` annotations. Existing application source headers will be added or
updated in a later code-maintenance slice so this documentation foundation
does not silently become a runtime-code change.
