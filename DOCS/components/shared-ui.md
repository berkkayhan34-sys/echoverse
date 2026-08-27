<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Shared UI

Browser-safe React primitives. `ActionButton` standardizes action-only buttons,
and `LocaleSelect`, `AuthForm`, `GuildPicker`, `FriendsModal`, `ScreenPicker`,
`CallAlerts`, `WorkspaceSidebar`, `ServerTopbar`, `CreateGuildDialog`,
`MediaSettingsModal`, `MembersPanel`, `VideoStage`, `VoiceControls`,
`PrivateCallStage`, and `DirectMessageHeader` own
shared presentation while receiving catalog values and commands from their
owning renderer. `ChannelMessageList`,
`ChatComposer`, `DirectMessageThread`, `DirectMessageComposer`, and
`DirectMessageView` provide the shared guild and direct-message surfaces.
`ServerView` composes the server topbar, video stage, guild chat, composer, and
voice controls. `WorkspaceOverlays` composes the members, media settings,
friends, call alerts, screen picker, and guild creation overlays;
transport, authorization, file processing, media permissions, preference
persistence, and other side effects remain in the owning renderer.
The package embeds no user-facing natural-language text: all labels, empty
states, dates, device fallbacks, and action names are supplied by the active
catalog.

The public barrel in `src/index.tsx` only exports the package surface. The
implementation is grouped by responsibility in `primitives.tsx`, `auth.tsx`,
`chat.tsx`, `direct.tsx`, `direct-view.tsx`, `server-view.tsx`,
`workspace-overlays.tsx`, and the feature components; no renderer imports an
internal module to bypass the shared boundary.
