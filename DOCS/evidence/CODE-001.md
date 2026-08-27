<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Evidence: `CODE-001`

```yaml
id: CODE-001
status: complete
date: 2026-08-27
revision: working tree (pending publication)
```

## Scope

- Affected source-of-truth files: session/deployment ADR, security policy,
  development workflow, server configuration, Render manifest, web and desktop
  authentication boundaries, and session integration/unit tests.
- Security impact: replaces long-lived browser local-storage bearer tokens with
  HTTP-only cookies; adds short-lived access credentials, hashed rotating
  refresh credentials, refresh-family replay revocation, logout invalidation,
  origin/CORS enforcement, explicit proxy and secure-cookie configuration, and
  Electron OS secure-storage IPC.
- Deferred runtime work: durable multi-instance session storage is deferred to
  the persistence roadmap; feature-specific authorization, WebRTC/media
  validation, and release signing remain later roadmap children.

## Validation

| Command or check                                  | Result | Evidence                                                                                                |
| ------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `npm test`                                        | pass   | 9 test files and 40 tests passed, including session-manager and HTTP cookie/rotation integration cases. |
| `npm run typecheck --workspace=@echoverse/server` | pass   | Server session/config integration typechecked.                                                          |
| `npm run typecheck --workspace=@echoverse/config` | pass   | Production secret, proxy, cookie, and lifetime configuration typechecked.                               |
| `npm run build --workspace=@echoverse/web`        | pass   | Browser build completed without local-storage token references.                                         |
| `npm run build --workspace=@echoverse/desktop`    | pass   | Electron renderer build completed with the secure-storage bridge types.                                 |
| `git diff --check`                                | pass   | No whitespace errors in the implementation diff.                                                        |

## Review notes

Web auth is served through `/auth/register`, `/auth/login`, `/auth/refresh`,
`/auth/session`, and `/auth/logout`; web responses do not include access or
refresh token fields. Desktop auth remains on the explicit desktop Socket.IO
channel because Electron credentials are persisted only by the main-process
`safeStorage` bridge. The server registry is process-local and therefore
intentionally fails closed by invalidating sessions on restart; a durable
session adapter belongs with the later persistence work.
