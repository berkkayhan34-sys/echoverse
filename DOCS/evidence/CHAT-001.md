<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `CHAT-001`

```yaml
id: CHAT-001
status: in_progress
date: 2026-08-30
revision: 1.9.2 working tree (`codex/chat-search-pins-links`)
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

## `CHAT-001.5` — guild search, pins, and message links

The shared web and desktop server views now expose localized message search,
clear-search, copy-link, and pin/unpin controls. Search results are rendered
from the existing server `chat-search` event; pin mutations use the existing
server-authorized `chat-pin` event and update all subscribed clients through
`chat:pinned`. Message links encode the guild, channel, and message identifiers
in the current application URL hash without transmitting message content.
When that link is opened while the referenced channel is active, the renderer
uses the message identifier to bring the target message into view.

Verification completed: shared UI tests (including action callbacks and empty
search state), full Vitest suite, workspace typecheck, lint, localization
catalog check, and production web/desktop builds. Authenticated live browser
verification was completed against `http://localhost:5173` with a temporary
SQLite-backed local server on port `3001`: a test message was sent, found by
search, pinned and unpinned as the owner, copied as a message link, and opened
again through the copied deep link. The desktop test account was also observed
in the installed EchoVerse client and its guild lobby was opened. The
temporary SQLite database was removed after verification. The earlier
`uv_os_get_passwd`/`ENOMEM` startup issue was avoided only for this local test
run by preloading a non-repository Node compatibility shim; production code
was not changed for that workaround.
