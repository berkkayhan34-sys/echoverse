<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0022: Persistent group DM and call semantics

```yaml
id: ADR-0022
status: accepted
date: 2026-08-29
owner: EchoVerse maintainers
```

## Decision

Group direct messages are durable conversations. A group owner may grant or
revoke group-admin status; owners and admins may add or remove members, while
any member may leave. A member leave removes that account from future access
without deleting the conversation or other members' history. The owner cannot
leave until ownership transfer exists.

Group voice calls are bounded to ten active conversation members. `Disconnect`
ends only the current call participation; it never deletes the persistent
conversation. Group messages and call signaling are authorized by active
conversation membership on the server, not by client UI state.

## Consequences

The existing friendship relationship is required when a new group is created,
but persisted membership remains available when a member is offline. Group
calls use the current bounded peer-to-peer transport for this release; SFU
scaling and adding participants to an already active one-to-one call remain
explicit follow-up work in the roadmap.
