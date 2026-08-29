<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0021: Discord parity execution profile

- Status: Accepted
- Date: 2026-08-29
- Roadmap: `ARCH-001`, `ARCH-002`, `SEC-001`, `MOD-001`, `CHAT-001`,
  `VOICE-001`, `PLATFORM-001`, `READY-002`
- Refines: [ADR-0014](0014-discord-teamspeak-product-direction.md)

The owner confirmed this execution profile after the Discord surface audit on
2026-08-29. It refines implementation choices without replacing ADR-0014's
product target or its provider-neutral SFU boundary.

## Accepted decisions

1. **Voice implementation:** use the current secure, bounded P2P mesh while
   adding connection health, speaking indicators, diagnostics, and an explicit
   room peer limit. Keep a provider-neutral SFU boundary as the scale target;
   moving to an SFU requires capacity evidence and a later provider decision.
2. **Space model:** use persistent Discord-style categories containing text and
   voice channels. Joining and leaving a voice room is explicit; selecting a
   server must never silently join its voice room.
3. **Permissions:** implement owner, admin, moderator, and member roles with
   inherited server/category/channel permissions and deny-by-default server-
   side evaluation.
4. **Social graph and DMs:** support global user search, request/accept/reject
   flows, message requests, blocking, privacy controls, and offline delivery.
5. **Messaging:** implement search, pins, replies/threads, message links,
   mention autocomplete, reactions, emoji/GIF/file attachments, content and
   attachment policy, spam quarantine, mute/archive, and group DMs.
6. **Voice UX:** provide device selection, microphone test, mute/deafen,
   echo/noise controls, push-to-talk, speaking indicators, camera, screen
   sharing, reconnect states, and explicit permission/error states.
7. **Notifications:** provide per-server and per-channel preferences plus
   native desktop notifications containing sender identity, avatar, message,
   EchoVerse branding, unread badges, and sound controls without exposing
   unnecessary private content.
8. **Visibility and membership:** the public EchoVerse main server is visible
   and auto-enrolled for every account. Other servers are visible only to their
   members; private servers are invite-only, and leaving removes them from the
   server rail subject to the existing owner/main-server protections.

## Implementation consequences

- `ARCH-001` through `READY-002` remain ordered implementation work; these
  decisions do not claim that any child is complete.
- The responsive shared web renderer remains the iOS/Android surface. A native
  mobile client is not authorized by this ADR.
- Server-side authorization, persistence compatibility, localization, security
  review, and evidence are required for every child that implements these
  decisions.
