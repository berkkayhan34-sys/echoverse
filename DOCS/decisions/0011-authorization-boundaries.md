<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0011: server-side authorization boundaries

- Status: Accepted
- Date: 2026-08-27

## Decision

EchoVerse authorizes protected operations at the server feature boundary, after
the shared transport schema has validated the event. Each handler derives the
acting account from the authenticated socket session and checks the resource
relationship before reading, mutating, or relaying data:

- account and profile operations require the authenticated account;
- guild operations require an authenticated account and the target guild
  membership represented by the server-side user state;
- direct messages and calls require an accepted friendship between the two
  account IDs;
- call answers, endings, and WebRTC signaling require the caller and target to
  be the two participants of the active call;
- presence reads are limited to accounts visible through the authenticated
  user's accepted-friend state, while presence writes affect only the actor;
- integration state is limited to the actor's active guild room and party
  leadership.

Authorization failures return the existing stable, localized error contract or
are dropped at the relay boundary. Client-side visibility and socket IDs are
never treated as authorization. The one-process modular-monolith architecture
remains unchanged, and no compatibility shim or alternate transport is added.

## Alternatives considered

1. **Central middleware-only authorization** — rejected because resource
   ownership differs across guild, friendship, call, and integration domains;
   a generic middleware would either duplicate domain lookups or make the
   boundary less auditable.
2. **Client-enforced authorization** — rejected because renderers and socket
   identifiers are untrusted and cannot protect cross-account data.
3. **Per-feature server checks** — accepted because each feature owns the
   relationship and can fail closed before a side effect or relay.

## Security and compatibility consequences

The server becomes the sole authority for protected resources, including
alternate Socket.IO event paths. Negative tests must cover missing sessions,
expired sessions, wrong users, cross-guild targets, non-friends, and unrelated
call participants. Existing event names and successful payload shapes remain
compatible; only unauthorized operations are rejected or suppressed.

## Recovery and evidence

The change is source-only and reversible through Git. No persisted schema or
deployment resource changes are required. `CODE-005` must link integration and
negative authorization evidence before it can be marked complete.
