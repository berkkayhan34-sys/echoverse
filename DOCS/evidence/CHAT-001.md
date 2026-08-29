<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `CHAT-001`

```yaml
id: CHAT-001
status: in_progress
date: 2026-08-29
revision: 1.8.7 candidate
```

Guild messages are now persisted with reply references, edits, deletes, pins,
reactions, bounded history, and case-insensitive channel search. Socket
contracts validate every operation and server authorization prevents
cross-guild access. The shared sidebar consumes the ordered channel list while
legacy general/lobby behavior remains available.

Remaining work: threads, mention autocomplete, message-request/spam workflow,
group DMs, attachment policy UI, and notification controls.
