<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0014: Discord + TeamSpeak product direction

- Status: Accepted
- Date: 2026-08-28
- Roadmap: `ARCH-001`, `ARCH-002`, `SEC-001`, `VOICE-001`, `PLATFORM-001`

The owner selected the options below on 2026-08-28. This record fixes the
direction; individual roadmap children still require their own implementation
and evidence.

## Target

EchoVerse should combine Discord-like persistent communities, text/social
features, roles, moderation, and direct messages with TeamSpeak-like
persistent, low-friction voice rooms. The goal is feature compatibility in the
important user journeys, not a claim of protocol or UI compatibility with
either product.

## Accepted decisions

1. **Space model — B:** use Discord-style categories, text channels, voice
   channels, and community spaces. The voice experience must preserve the
   TeamSpeak goal of persistent, low-friction rooms with explicit join/leave;
   this is a behavior constraint across the Discord-style hierarchy.
2. **Permissions — A:** use granular inherited server/category/channel
   permissions with role hierarchy and deny-by-default evaluation.
3. **Voice topology — A:** define a provider-neutral SFU boundary so a managed
   or self-hosted SFU can be selected without coupling the protocol to one
   vendor. P2P remains a development fallback only, not the scale target.
4. **Identity — A:** use global accounts, friends/DMs, and per-server
   membership. Server-specific profile overrides may be added without creating
   a second account system.
5. **Mobile — A:** deliver responsive PWA/mobile web first; evaluate native
   iOS/Android clients after usage and lifecycle requirements are evidenced.
6. **Moderation — B:** ship owner/admin/moderator management first, then add
   report, timeout, audit, spam, and automated-safety capabilities before
   public scale.
7. **Media — A:** complete Unicode and custom server emoji foundations first;
   add GIF/sticker providers only behind explicit moderation, licensing, and
   upload boundaries.
8. **Scale — B:** target public communities in an initial single region while
   allowing private, invitation-only servers. Multi-region operation requires a
   later capacity decision and evidence.

These decisions are prerequisites for the roadmap children that reference this
ADR. They do not authorize a native client, an SFU provider, or production
deployment by themselves.
