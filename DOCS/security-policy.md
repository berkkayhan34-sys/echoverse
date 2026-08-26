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

## Required controls

### Identity and authorization

Secrets come only from environment or an approved secret store. Production must
fail closed when required secrets are missing. Authentication and authorization
are enforced server-side for every HTTP route and Socket.IO event, including
membership, direct-message, attachment, presence, and signaling operations.

### Input and resource limits

Boundary schemas must constrain strings, arrays, identifiers, attachments,
media metadata, signaling messages, and pagination. Authentication, messaging,
uploads, integrations, and expensive operations require rate limits, timeouts,
and bounded resource use. Error responses must not disclose credentials,
tokens, stack traces, or private records.

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
