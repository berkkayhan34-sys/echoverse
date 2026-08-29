<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `CHAT-001`

```yaml
id: CHAT-001
status: in_progress
date: 2026-08-29
revision: 1.9.0 working tree
```

Guild messages are persisted with reply references, edits, deletes, pins,
reactions, bounded history, and case-insensitive channel search. The 1.9.0
slice adds an acknowledgement to guild sends so clients surface transport
failures instead of silently dropping a message. Persistent group DM history,
membership authorization, and fan-out messaging are covered by the same server
boundary.

Remaining work: threads, mention autocomplete, message-request/spam workflow,
attachment policy UI, notification controls, and adding a participant to an
already active one-to-one call.
