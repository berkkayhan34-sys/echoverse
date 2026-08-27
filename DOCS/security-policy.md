<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Security policy

This policy defines the minimum security bar for EchoVerse. It documents
required controls and known review areas; it does not claim that every control
is already implemented.

## Security objectives

- protect account credentials, sessions, tokens, media, and private messages;
- prevent cross-user and cross-guild access;
- validate all untrusted protocol, upload, OAuth, and updater input;
- keep secrets and unnecessary personal data out of source, logs, and artifacts;
- make security failures visible, reproducible, and release-blocking.

## Trust boundaries

The browser/Electron renderer, Electron main process, backend HTTP API,
Socket.IO connections, database, OAuth/Spotify services, object/file storage,
and update distribution are separate trust boundaries. Renderer input,
socket payloads, request headers, uploaded files, remote metadata, and update
artifacts are untrusted until validated.

## Threat model and boundary ownership

The repository owner identified in [CODEOWNERS](../.github/CODEOWNERS) owns the
current code boundaries. Operational ownership, incident escalation, and
evidence retention must be named before public release under `DOC-005`.

| Boundary                             | Owner surface                                          | Primary threats                                                            | Required evidence owner                        |
| ------------------------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Browser and Electron renderer        | `apps/web/`, `apps/desktop/src/`                       | forged UI input, token exposure, unsafe DOM or Node access                 | `QUAL-002`, `CODE-006`                         |
| Electron main/preload                | `apps/desktop/electron/`                               | arbitrary IPC, filesystem/native capability escape, updater abuse          | `CODE-006`, `CODE-008`                         |
| HTTP and Socket.IO transport         | `apps/server/src/index.ts`                             | origin abuse, malformed payloads, replay, denial of service                | `QUAL-003`, `CODE-001`, `CODE-002`             |
| Feature and authorization boundaries | `apps/server/src/features/`, `apps/server/src/domain/` | IDOR, cross-guild/DM access, confused deputy behavior                      | `QUAL-002`, `QUAL-003`, `CODE-004`, `CODE-005` |
| Persistence and migrations           | `apps/server/db/`, `apps/server/src/persistence/`      | injection, unauthorized reads, retention/deletion residue, migration drift | `QUAL-003`, `CODE-003`                         |
| OAuth and third-party integrations   | Spotify bridge and server integration code             | token leakage, callback forgery, excessive scopes, provider failure        | `CODE-002`, `QUAL-003`                         |
| Release and update distribution      | `.github/workflows/`, desktop packaging                | artifact tampering, version confusion, unsigned publisher trust            | `CODE-008`, `OPS-003`                          |

The threat model covers credential/session theft, cross-user access, malformed
or oversized input, resource exhaustion, upload and media exfiltration, OAuth
token misuse, updater tampering, log leakage, and incomplete deletion. A
control listed here is a requirement until its owning tests and evidence pass;
the current baseline must not be read as proof that every control is active.

## Required controls

### Identity and authorization

Secrets come only from environment or an approved secret store. Production must
fail closed when required secrets are missing. Authentication and authorization
are enforced server-side for every HTTP route and Socket.IO event, including
membership, direct-message, attachment, presence, and signaling operations.

The required session lifecycle is: issue a short-lived session, store it only
at the platform-appropriate boundary, rotate refresh credentials, revoke on
logout or security action, reject expired/revoked credentials, and record only
privacy-safe correlation data. Web uses `Secure`/`HttpOnly` cookies; desktop
uses operating-system secure storage, as defined by
[ADR-0004](decisions/0004-session-and-deployment.md). The current token flow is
not complete until `CODE-001` and its negative tests pass.

### Input and resource limits

Boundary schemas must constrain strings, arrays, identifiers, attachments,
media metadata, signaling messages, and pagination. Authentication, messaging,
uploads, integrations, and expensive operations require rate limits, timeouts,
and bounded resource use. Error responses must not disclose credentials,
tokens, stack traces, or private records.

The current baseline has a 1 MiB HTTP JSON limit, an 8 MiB Socket.IO transport
buffer, 2,500-character chat text, 5,700,000-character base64 attachment data,
and 700,000-character avatar data. It also has HTTP, authentication, and DM
rate-limit defaults plus a 35-second pending-call timeout. These values are
inventory facts, not a complete security guarantee: MIME allowlists, all event
limits, timeout coverage, and bounded resource behavior require the negative
tests in `QUAL-002` and `QUAL-003`.

Every limit must have an explicit owner, a rejection response, a test for the
boundary and over-limit case, and release evidence showing the command and
result. Limits must be reviewed when a protocol, attachment, media, or updater
format changes.

### Browser, transport, and cookies

CORS origins, trusted proxy behavior, TLS assumptions, cookie flags, token
storage, and session expiry must be explicit configuration. Security headers and
origin checks must be covered by automated tests before production release.

### Electron and updates

The renderer uses a narrow preload bridge; it must not gain arbitrary Node or
filesystem access. Update manifests and packages require integrity validation,
trusted publisher/signing decisions, and a documented rollback path. An
unsigned artifact must not be described as production-ready.

### Privacy-safe diagnostics

Logs use correlation identifiers and operational context without passwords,
tokens, cookies, message bodies, media contents, or unnecessary personal data.
Retention and access for production logs must be documented before launch.

Log redaction must remove passwords, access/refresh tokens, cookies, auth
headers, message bodies, attachment data, media payloads, OAuth codes, and
unnecessary identifiers before serialization. Correlation IDs may connect
events across services, but they must not be reversible user identifiers.
Redaction tests belong to `OPS-001`; release evidence must include a safe
sample or machine-readable assertion without real user data.

## Data lifecycle

Data is collected only for a documented product or security purpose. Access is
least-privilege and server-authorized. Retention is the minimum needed for that
purpose, and deletion covers primary storage, derived data, media, exports,
backups, caches, and logs where applicable.

| Data class                     | Current storage                                                          | Required retention/deletion rule                                                                                                         | Test and release evidence owner                                                    |
| ------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Credentials and account data   | Password hash and account profile in PostgreSQL; memory fallback locally | Never retain plaintext passwords. Delete account data through an authorized, auditable request path and invalidate sessions.             | `CODE-001`, `CODE-005`, `CODE-003`; release evidence in the completed child record |
| Sessions and tokens            | Current in-memory socket state and signed tokens                         | Short expiry, rotation, revocation, logout invalidation, and no token values in logs or exports.                                         | `QUAL-002`, `QUAL-003`, `CODE-001`; release evidence in the completed child record |
| Messages and attachments       | PostgreSQL/SQLite message tables; attachment data is bounded inline data | User deletion must remove or irreversibly clear message content and attachments from active stores, with tombstone semantics documented. | `CODE-002`, `CODE-003`, `CODE-005`; release evidence in the completed child record |
| Presence, calls, and signaling | Transient server memory and peer state                                   | Clear on disconnect, timeout, logout, and failed negotiation; do not persist signaling payloads by default.                              | `QUAL-003`, `CODE-007`, `OPS-002`; release evidence in the completed child record  |
| OAuth/provider data            | Provider credentials and playback metadata at integration boundaries     | Store only the minimum token/metadata needed, revoke or discard credentials on disconnect/deletion, and redact callback data.            | `CODE-002`, `CODE-005`; release evidence in the completed child record             |
| Logs and diagnostics           | Application/host logging systems                                         | Define retention and access roles, redact before emission, and delete on the approved schedule.                                          | `OPS-001`, `OPS-004`; release evidence in the completed child record               |
| Backups and exports            | Not yet defined as a product surface                                     | Every backup/export must have an owner, expiry, access restriction, deletion job, and deletion verification.                             | `CODE-003`, `OPS-001`, `OPS-004`; release evidence in the completed child record   |

An account or data-deletion operation must be idempotent, authorization-checked,
bounded, and safe to retry. Its deletion evidence records the request and
completion identifiers, scope, timestamps, storage targets, actor class, and
verification result; it must not contain message bodies, media, credentials,
tokens, or unnecessary personal data. Failed or partial deletion remains
visible as an incident or release blocker until reconciled.

## Control-to-evidence mapping

The following mapping is the minimum acceptance path. `testing-policy.md`
defines the test-layer meaning; the roadmap child named in the last column must
link a completed record under `DOCS/evidence/` before the control can be called
verified.

| Control                                           | Owning test layer                                 | Release evidence child             |
| ------------------------------------------------- | ------------------------------------------------- | ---------------------------------- |
| Secret loading, session lifecycle, and revocation | Contract and security negative tests              | `CODE-001`                         |
| Authorization and cross-user isolation            | Server integration and IDOR tests                 | `QUAL-003`, `CODE-005`             |
| Input, size, rate, and timeout boundaries         | Contract, integration, and resource-limit tests   | `QUAL-002`, `QUAL-003`, `CODE-002` |
| Safe errors and diagnostic redaction              | Integration and redaction tests                   | `QUAL-003`, `OPS-001`              |
| Retention, user deletion, backup/export deletion  | Persistence and operational tests                 | `CODE-003`, `OPS-004`              |
| WebRTC/media cleanup and attachment handling      | Realtime media and E2E tests                      | `CODE-007`, `CODE-008`             |
| Updater integrity and publisher trust             | Artifact, checksum, installer, and rollback tests | `CODE-008`, `OPS-003`              |

## Release blockers

Missing required secrets, authorization bypasses, unvalidated boundary input,
known dependency vulnerabilities without an accepted exception, leaked
credentials, unverifiable updater artifacts, and failing security tests block a
release. Exceptions require an ADR with owner, scope, expiry, and compensating
controls.

## Reporting

Report suspected vulnerabilities privately through the process in
[`.github/SECURITY.md`](../.github/SECURITY.md). Do not open a public issue with
exploit details or attach secrets and personal data.

## Review cadence

Security review is required for authentication, authorization, protocol/event
changes, uploads, media/signaling, OAuth, Electron bridges, updater behavior,
deployment configuration, and dependency changes. The review must link to
tests or evidence and identify anything that remains unverified.
