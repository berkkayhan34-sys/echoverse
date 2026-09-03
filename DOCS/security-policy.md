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
Socket.IO connections, database, object/file storage,
and update distribution are separate trust boundaries. Renderer input,
socket payloads, request headers, uploaded files, remote metadata, and update
artifacts are untrusted until validated.

## Threat model and boundary ownership

The repository owner identified in [CODEOWNERS](../.github/CODEOWNERS) owns the
current code boundaries. Operational ownership, incident escalation, and
evidence retention must be named before public release under `DOC-005`.

| Boundary                             | Owner surface                                                          | Primary threats                                                            | Required evidence owner                        |
| ------------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| Browser and Electron renderer        | `project/apps/web/`, `project/apps/desktop/src/`                       | forged UI input, token exposure, unsafe DOM or Node access                 | `QUAL-002`, `CODE-006`                         |
| Electron main/preload                | `project/apps/desktop/electron/`                                       | arbitrary IPC, filesystem/native capability escape, updater abuse          | `CODE-006`, `CODE-008`                         |
| HTTP and Socket.IO transport         | `project/apps/server/src/index.ts`                                     | origin abuse, malformed payloads, replay, denial of service                | `QUAL-003`, `CODE-001`, `CODE-002`             |
| Feature and authorization boundaries | `project/apps/server/src/features/`, `project/apps/server/src/domain/` | IDOR, cross-guild/DM access, confused deputy behavior                      | `QUAL-002`, `QUAL-003`, `CODE-004`, `CODE-005` |
| Persistence and migrations           | `project/apps/server/db/`, `project/apps/server/src/persistence/`      | injection, unauthorized reads, retention/deletion residue, migration drift | `QUAL-003`, `CODE-003`                         |
| Release and update distribution      | `.github/workflows/`, desktop packaging                                | artifact tampering, version confusion, unsigned publisher trust            | `CODE-008`, `OPS-003`                          |

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
[ADR-0004](decisions/0004-session-and-deployment.md). CODE-001 implements this
baseline with an in-memory server-side session registry, refresh-family replay
revocation, HTTP cookie endpoints, and a narrow Electron secure-storage IPC
bridge. A process restart invalidates active sessions; durable multi-instance
session storage remains a later persistence concern.

Guild authorization uses the server-side `GuildPermission` evaluator. Roles
inherit the member baseline; moderator, admin, and owner capabilities are
explicit, and an actor cannot modify an equal or higher role. Channel access,
message management, invite creation, and moderation are checked for every
Socket.IO command. Kick, ban, timeout, and unban actions are persisted with
privacy-safe audit metadata; the owner cannot be removed by these actions.

### Input and resource limits

Boundary schemas must constrain strings, arrays, identifiers, attachments,
media metadata, signaling messages, and pagination. Authentication, messaging,
uploads, integrations, and expensive operations require rate limits, timeouts,
and bounded resource use. Error responses must not disclose credentials,
tokens, stack traces, or private records.

The current baseline has a 1 MiB HTTP JSON limit, an 8 MiB Socket.IO transport
buffer and serialized packet ceiling, 2,500-character chat text,
5,700,000-character base64 attachment data, 700,000-character avatar data,
15-second HTTP request and 10-second header timeouts, and a 5-second keep-alive
timeout. HTTP is limited to 240 requests per minute globally and 20 requests per
minute across auth routes. Socket.IO events have a default 120-per-minute
limit, with auth at 8, DM sends at 30, call starts at 10, and WebRTC ICE at
240; WebRTC SDP is capped at 200,000 characters and ICE candidates at 10,000.
These values are now executable policy for the implemented boundaries. DM
attachments use an explicit MIME allowlist and the declared MIME must match the
data-URL header. WebRTC carries bounded signaling metadata rather than media
bytes; media capture remains a browser/Electron resource concern covered by
CODE-007. Updater metadata and progress values
are validated before logging, UI display, or installation state changes.

#### Executable boundary budget

| Boundary                     | Limit or invariant                                                                                                    | Enforcement                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| HTTP JSON                    | 1 MiB body; 15-second request timeout; 10-second header timeout; 5-second keep-alive                                  | Express parser and HTTP server settings              |
| HTTP requests                | 240 requests/minute globally; 20 requests/minute across `/auth/*`                                                     | Express rate limiters                                |
| Socket.IO packet             | 8,000,000 serialized UTF-8 bytes; 8,000,000-byte transport ceiling                                                    | Socket packet middleware and Socket.IO configuration |
| Unclassified Socket.IO event | 120 events/minute per socket                                                                                          | Socket packet middleware                             |
| Authentication events        | 8 attempts/minute per socket                                                                                          | Authentication handlers                              |
| Direct-message sends         | 30/minute per socket; attachments capped at 5,700,000 base64 characters and restricted to the declared MIME allowlist | DM handler and attachment schema                     |
| Calls                        | 10 starts/minute; unanswered calls expire after 35 seconds                                                            | Call handler and pending-call timer                  |
| Chat                         | 120 messages/minute; 2,500 characters                                                                                 | Packet limiter and contract/sanitizer                |
| WebRTC descriptions          | 200,000-character SDP; validated event shape                                                                          | Contract schema at the relay boundary                |
| WebRTC ICE                   | 240 events/minute; 10,000-character candidate                                                                         | Packet limiter and contract schema                   |
| Avatar data                  | 700,000 characters; PNG, JPEG, or WebP data URL                                                                       | Avatar handler                                       |
| Updater metadata             | Semantic version max 64 chars; progress finite and 0–100                                                              | Electron updater boundary                            |

All rejected boundary inputs return a stable, non-sensitive error or are
dropped before relay. Request and packet errors do not serialize payloads,
credentials, cookies, stack traces, or database records.

Every limit must have an explicit owner, a rejection response, a test for the
boundary and over-limit case, and release evidence showing the command and
result. Limits must be reviewed when a protocol, attachment, media, or updater
format changes.

### Browser, transport, and cookies

CORS origins, trusted proxy behavior, TLS assumptions, cookie flags, token
storage, session expiry, and `SameSite` policy are explicit configuration.
Production refuses insecure web-cookie configuration; the authoritative Render
manifest enables the HTTPS cookie, cross-site `SameSite=None` policy, and proxy
settings for the GitHub Pages origin. Security
headers, CORS rejection, cookie attributes, refresh replay, expiry, and logout
invalidation are covered by the CODE-001 evidence record.

### Electron and updates

The renderer uses a narrow preload bridge; it must not gain arbitrary Node or
filesystem access. Update manifests and packages require integrity validation,
trusted publisher/signing decisions, and a documented rollback path. An
unsigned artifact must not be described as production-ready.

The packaged desktop client checks for updates before creating any user-facing
window. Available packages are downloaded automatically and installed with the
silent updater path; no installer UI or user-controlled elevation flow is
opened by the application. Windows may still show its standard UAC consent for
an existing machine-wide installation; the updater never bypasses that
operating-system security control. The updater preserves the package metadata that
identifies whether the existing installation requires administrative rights and
reuses its current installation directory. A bounded startup timeout allows
the known-good version to open when the update service is unavailable, while a
later completed download still uses the same silent install path. Startup,
download, metadata-rejection, timeout, and silent-install behavior require
automated tests and release evidence.

### Privacy-safe diagnostics

Logs use correlation identifiers and operational context without passwords,
tokens, cookies, message bodies, media contents, or unnecessary personal data.
Retention and access for production logs must be documented before launch.

The implemented server diagnostic contract and host retention/access procedure
are defined in [operations.md](operations.md). HTTP and Socket.IO lifecycle
records use validated opaque correlation identifiers; request payloads, query
strings, and user/resource identifiers are not emitted. The process-local
metrics summary resets on restart and is not a durable user-data store.

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

The current server-side moderation/report records and deleted-message tombstones
use a 180-day retention window. An idempotent startup and maintenance cleanup
removes only records past that window; active messages are not eligible. Account,
backup, export, and host-log deletion remain separate controlled procedures.

| Data class                     | Current storage                                                                          | Required retention/deletion rule                                                                                                         | Test and release evidence owner                                                    |
| ------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Credentials and account data   | Password hash and account profile in PostgreSQL; memory fallback locally                 | Never retain plaintext passwords. Delete account data through an authorized, auditable request path and invalidate sessions.             | `CODE-001`, `CODE-005`, `CODE-003`; release evidence in the completed child record |
| Sessions and tokens            | In-memory server-side session registry; web HTTP-only cookies; desktop OS secure storage | Short expiry, rotation, revocation, logout invalidation, and no token values in logs or exports.                                         | `QUAL-002`, `QUAL-003`, `CODE-001`; release evidence in the completed child record |
| Messages and attachments       | PostgreSQL/SQLite message tables; attachment data is bounded inline data                 | User deletion must remove or irreversibly clear message content and attachments from active stores, with tombstone semantics documented. | `CODE-002`, `CODE-003`, `CODE-005`; release evidence in the completed child record |
| Presence, calls, and signaling | Transient server memory and peer state                                                   | Clear on disconnect, timeout, logout, and failed negotiation; do not persist signaling payloads by default.                              | `QUAL-003`, `CODE-007`, `OPS-002`; release evidence in the completed child record  |
| OAuth/provider data            | Provider credentials and playback metadata at integration boundaries                     | Store only the minimum token/metadata needed, revoke or discard credentials on disconnect/deletion, and redact callback data.            | `CODE-002`, `CODE-005`; release evidence in the completed child record             |
| Logs and diagnostics           | Application/host logging systems                                                         | Define retention and access roles, redact before emission, and delete on the approved schedule.                                          | `OPS-001`, `OPS-004`; release evidence in the completed child record               |
| Backups and exports            | Not yet defined as a product surface                                                     | Every backup/export must have an owner, expiry, access restriction, deletion job, and deletion verification.                             | `CODE-003`, `OPS-001`, `OPS-004`; release evidence in the completed child record   |

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
