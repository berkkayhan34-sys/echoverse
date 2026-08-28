<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Reliability budgets and recovery

This document defines the implemented v2 reliability budgets and the recovery
behavior that must remain true when transport, persistence, or media resources
fail. It is intentionally small and uses existing platform/framework controls.

## Resource and performance budgets

| Resource               | Budget or timeout                                                                              | Enforcement                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| HTTP JSON request body | 1 MiB                                                                                          | Express JSON parser                                 |
| HTTP request lifecycle | 15 seconds request, 10 seconds headers, 5 seconds keep-alive                                   | Node HTTP server                                    |
| HTTP request rate      | 240 requests/minute globally; 20 requests/minute for auth                                      | Express rate limiters                               |
| Socket packet          | 8,000,000 serialized UTF-8 bytes and 8,000,000-byte transport buffer                           | Socket packet validator and Socket.IO configuration |
| Socket events          | 120/minute by default, with stricter limits for authentication, calls, messages, and signaling | Socket event limiter                                |
| Unanswered calls       | 35 seconds                                                                                     | Pending-call timer and cleanup                      |
| Pending calls          | 1,024 process-wide entries                                                                     | Server call handler rejects additional starts       |
| Reconnect attempts     | 8 attempts, 500 ms initial delay, 5 seconds maximum delay, 10-second connection timeout        | Shared `REALTIME_RETRY_POLICY`                      |
| SQLite busy wait       | 5 seconds; WAL mode enabled                                                                    | SQLite adapter                                      |

The budgets are denial-safe: malformed or over-limit input is rejected before
feature side effects, and an unavailable dependency produces a safe failure
instead of an unbounded queue or retry loop.

## Cleanup and restart behavior

- Socket disconnect clears rate-limit buckets, pending call timers, active calls,
  lobby membership, and transient presence/party state owned by that socket.
- Renderer cleanup disconnects the socket, closes peer connections, stops media
  tracks, releases audio resources, and clears speaking timers.
- SQLite close is idempotent so shutdown and test cleanup can safely converge on
  the same cleanup path. PostgreSQL pools are explicitly ended by the
  persistence runtime.
- Process restart clears in-memory sessions, calls, presence, metrics, and
  memory fallback data. File-backed SQLite remains the durable local store and
  uses the documented backup/restore procedure.

## Retry and idempotency rules

- Socket reconnect is bounded. After exhaustion, the renderer shows the
  localized offline/connection error and stops active media resources.
- Duplicate call starts for the same friend pair are rejected server-side while
  a pending or active call exists. The client must not create a second call as
  a retry substitute.
- Chat and DM delivery reducers ignore duplicate message IDs after reconnect or
  replay. Refresh-session work is guarded so concurrent refreshes do not rotate
  the same browser credential family twice.
- Non-idempotent persistence writes are not retried by the transport layer. A
  feature must establish ownership and retry safety before adding a retry.

## Degraded-state behavior

| Failure                                       | Required behavior                                                                                                                                           |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server unavailable or network interrupted     | Show localized connection-lost/retrying state; bounded retries eventually settle on localized offline state and release media resources.                    |
| Expired or invalid session                    | Refresh through the authorized session path; clear local identity when refresh fails; never keep retrying invalid credentials.                              |
| Database unavailable during startup           | Emit a stable failure event and exit rather than accepting requests against an unknown persistence state.                                                   |
| Local development without configured database | Use the documented in-memory fallback only for local/test operation; production configuration still requires its documented secret and deployment settings. |
| Malformed/oversized socket or HTTP input      | Return a stable safe error or reject before handler side effects; do not log payloads.                                                                      |

Performance and reliability checks belong in focused tests and the full quality
gate. PostgreSQL service validation remains CI-only by owner decision; SQLite
is the authorized local persistence target.
