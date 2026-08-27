<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Client core

Browser-safe authentication, session, and feature-state boundaries shared by
web and Electron renderers. The package owns locale and username persistence,
session/token adapters, auth request construction, the versioned Socket.IO
handshake shape, deterministic DM/presence/typing state transitions, pure
media-control invariants, bounded screen-capture constraints, and
server-authoritative lobby membership transitions used for reconnect peer
repair.
Renderer-specific credential storage and platform capabilities remain outside
this package.

Feature-state helpers are pure functions. They preserve message ordering,
reject duplicate DM delivery by message ID, clear deleted attachment data, and
update only the account or conversation named by an event. This keeps reconnect
and replay handling, including lobby peer reconciliation, consistent across
renderers without importing React,
Electron, or Node APIs.
