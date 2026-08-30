<!-- SPDX-FileCopyrightText: 2026 EchoVerse contributors -->
<!-- SPDX-License-Identifier: GPL-3.0-only -->

# Evidence: `CHAT-001`

```yaml
id: CHAT-001
status: in_progress
date: 2026-08-30
revision: working-tree (`codex/parity-wave-1`)
```

Guild messages are persisted with reply references, edits, deletes, pins,
reactions, bounded history, and case-insensitive channel search. The 1.9.0
slice adds an acknowledgement to guild sends so clients surface transport
failures instead of silently dropping a message. Persistent group DM history,
membership authorization, and fan-out messaging are covered by the same server
boundary.

Remaining work: full threaded conversations, attachment policy UI,
notification controls, and adding a participant to an already active
one-to-one call.

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

## `CHAT-001.6` — channel replies and composer context

Guild messages can now reference a parent message only when that parent belongs
to the same guild and channel and is visible to the sender. The shared web and
desktop renderer exposes a localized reply action, a compact composer context
with a clear action, and an inline parent preview on the rendered reply. The
server rejects missing, cross-guild, cross-channel, or unauthorized parent
references before persistence.

Verification completed: shared UI unit tests cover reply-action delegation,
parent preview rendering, and composer-context clearing; the server integration
test covers a persisted same-channel reply and a rejected cross-channel reply;
workspace typecheck passed. Authenticated local browser verification against
`http://127.0.0.1:4173` sent a parent message, opened the reply action, rendered
the composer context, sent the reply, and confirmed the inline parent preview.
Screenshots are retained at `tmp/test-results/chat001-reply-composer.png` and
`tmp/test-results/chat001-reply-rendered.png`; a five-second Playwright proof
recording is retained at
`tmp/test-results/page@f923902076b84d76471f18c90cebad40.webm`.

## `CHAT-001.7` — focused thread panel

The shared web and desktop renderer now opens a focused thread panel for any
guild message. The panel derives direct and nested replies from the existing
persisted `replyToId` links, keeps the root message visible, exposes localized
close/reply actions, and routes each reply through the existing server-side
same-guild/same-channel authorization boundary. No new persistence format or
transport bypass was introduced; newly sent replies remain in the normal
channel history and appear in the open panel through the shared state.

Verification completed: the shared UI test covers nested reply grouping and
all panel actions; the full Vitest suite (23 files, 124 tests), workspace
typecheck, lint, formatting, localization, roadmap validation, and production
web/desktop builds passed. Authenticated local Playwright verification against
`http://127.0.0.1:4173` sent a root message, opened its localized `Konuyu aç`
action, confirmed the focused panel, replied from the panel, and confirmed the
reply rendered under the root. Screenshots are retained at
`tmp/test-results/chat001-thread-open.png` and
`tmp/test-results/chat001-thread-rendered.png`; the five-second proof
recording is retained at
`tmp/test-results/page@defbeac24ea06ca63f31feee4a8f0f88.webm`.

## `CHAT-001.8` — member mentions and authorized notifications

The shared web and desktop composer now offers a localized member suggestion
list while typing a trailing `@` mention. Candidates are loaded from the
server-authorized `guild:members` directory; the memory runtime now resolves
offline members through the account service instead of exposing an account ID
as a display name. Selecting a candidate inserts the exact username into the
composer.

After persistence, the server resolves mention names against the same guild
member directory and emits `chat:mention` only to connected members who can
view the mentioned channel. The renderer uses that event for the mention sound
and notification, removing the previous client-side text-match behavior that
could notify the wrong user. Mention delivery failures are logged without
rejecting an already-persisted chat send.

Verification completed: shared UI tests cover filtering and insertion;
server unit and integration tests cover case-insensitive resolution and
delivery isolation; workspace typecheck passed. Authenticated local
two-account Playwright verification against `http://127.0.0.1:4173` logged in
`test@test.com` and `test2@test2.com`, displayed both authorized member
suggestions, selected `@TestTwo`, sent a message, and observed the recipient
notification hook. Screenshots are retained at
`tmp/test-results/chat001-mention-suggestions.png` and
`tmp/test-results/chat001-mention-sent.png`; the five-second proof recording
is retained at
`tmp/test-results/page@5f796fc22e24a89ebfbd3435b50ed71a.webm`.

## `CHAT-001.9` — message requests and spam quarantine

Non-friends can now send one sanitized text-only message request. The server
deduplicates a pending directional request, rejects attachments until the
recipient accepts, and closes retries after decline or spam. The recipient
can accept, decline, or mark a request as spam from the shared web/desktop
friends modal. Acceptance creates the friendship and persists the original
message exactly once; a block created after the request takes precedence.
Request bodies are never written to server logs, and response actions remain
recipient-authorized on the server.

Verification completed: server integration tests cover pending deduplication,
acceptance and friendship conversion, spam closure, block precedence, and
attachment rejection. The full Vitest suite, workspace typecheck, lint,
formatting, localization, roadmap validation, and web/desktop builds were
rerun after implementation. Authenticated two-account browser verification
against `http://127.0.0.1:4173` created a request through the sender UI,
displayed it in the recipient's message-request inbox, accepted it, and
confirmed the new friend row. Screenshots are retained at
`tmp/test-results/chat001-message-request-inbox.png` and
`tmp/test-results/chat001-message-request-accepted.png`; the five-second
proof recording is retained at
`tmp/test-results/page@32a71fd3ba848d7d9b306ba55e4e1ff2.webm`.
