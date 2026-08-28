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
The shared visual contract is defined in `src/theme.css`, which both web and
desktop entrypoints import after their renderer-specific styles. It owns the
shared tokens, controls, panel surfaces, focus states, motion preferences, and
responsive breakpoints so the two clients do not drift visually.
`ServerView` composes the server topbar, video stage, guild chat, composer, and
voice controls. `WorkspaceOverlays` composes the members, media settings,
friends, call alerts, screen picker, and guild creation overlays;
transport, authorization, file processing, media permissions, preference
persistence, and other side effects remain in the owning renderer.
`WorkspaceSidebar` keeps server selection separate from explicit voice-lobby
entry and includes the persistent Direct Messages navigation; at mobile
breakpoints the same commands are exposed through the bottom navigation bar.
For guild owners and admins it also exposes the localized lobby-name editor;
the renderer submits the change through the server authorization boundary.
`ChatComposer` exposes a shared Unicode emoji picker; the platform's emoji font
does the final glyph rendering so the same message format works on Windows,
macOS, iOS, and Android browsers.
The package embeds no user-facing natural-language text: all labels, empty
states, dates, device fallbacks, and action names are supplied by the active
catalog.

The public barrel in `src/index.tsx` only exports the package surface. The
implementation is grouped by responsibility in `primitives.tsx`, `auth.tsx`,
`chat.tsx`, `direct.tsx`, `direct-view.tsx`, `server-view.tsx`,
`workspace-overlays.tsx`, and the feature components; no renderer imports an
internal module to bypass the shared boundary.
