<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Client core

Browser-safe authentication, session, and feature-state boundaries shared by
web and Electron renderers. The package owns locale and username persistence,
session/token adapters, auth request construction, the versioned Socket.IO
handshake shape, deterministic guild-chat and DM/presence/typing/unread state
transitions, pure media-control invariants, bounded screen-capture constraints, and
server-authoritative lobby membership transitions used for reconnect peer
repair.
Renderer-specific credential storage and platform capabilities remain outside
this package.

The package also exports the shared bounded realtime retry policy used by both
renderers. It limits reconnect attempts and delay growth so an unavailable
server reaches a deliberate user-visible offline state instead of retrying
forever.

Feature-state helpers are pure functions. They preserve message ordering,
reject duplicate guild-chat and DM delivery by message ID, clear deleted
attachment data, and update only the account or conversation named by an event.
This keeps reconnect and replay handling, including lobby peer reconciliation,
consistent across renderers without importing React, Electron, or Node APIs.

The shared UI package owns catalog-driven guild selection and channel history,
friends and request actions, call alerts, screen-source selection, workspace
navigation/profile controls, media settings, members/presence controls, video
stage, voice controls, private-call stage, direct-message header, guild composer,
and direct-message thread/composer markup. The direct-message
boundary keeps search filtering, date grouping, reply previews, attachment
presentation, reactions, and message actions consistent. Renderers retain
transport, send commands, media permissions, preference persistence,
authorization, and feature-specific side effects; shared components receive
user-visible labels and formatting functions from the active renderer catalog.
