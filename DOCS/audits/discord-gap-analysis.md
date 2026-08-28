<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Discord parity gap analysis

- Audit ID: `AUDIT-003`
- Date: 2026-08-28
- Scope: repository and product-surface review after the private guild, DM,
  responsive mobile, emoji, and sound-effect work

```yaml
id: AUDIT-003
status: active
evidence: null
```

The assessment is complete; the audit remains active in the lifecycle because
its ordered implementation children are still open.

This is a product comparison, not a claim of compatibility with Discord. The
comparison uses the current EchoVerse source and the public Discord help and
developer documentation linked below. Discord's own behavior and limits can
change; the links are the evidence used for this audit.

## Current EchoVerse baseline

The repository currently provides a modular web/desktop client with a shared
UI package, a server-side authorization boundary, private guild membership and
invites, four fixed guild roles, persistent one-to-one DMs, attachments,
reactions, edit/delete/reply actions, private calls, WebRTC voice/video and
screen share, responsive mobile web navigation, a broad Unicode emoji picker,
and named sound effects on web and desktop. iOS and Android are currently
covered by the responsive web/mobile-browser path; there are no native mobile
projects in this repository.

The current channel surface is intentionally small: a general text channel, a
music text entry, and one voice lobby. Guild roles are fixed to `owner`,
`admin`, `moderator`, and `member`. These are a foundation, not feature parity.

## Comparison and gaps

### Server structure and authorization

Discord supports role hierarchies, server-level permissions, channel-specific
overrides, and private channels that remove `View Channel` from `@everyone`
([Roles and Permissions](https://support.discord.com/hc/en-us/articles/214836687-Discord-Roles-and-Permissions),
[Channel Permissions](https://support.discord.com/hc/en-us/articles/206029707-Setting-Up-Permissions-FAQ)).
EchoVerse has private guild visibility, membership checks, invites, and fixed
roles, but does not yet expose custom roles, permission matrices, channel
categories, channel CRUD, or per-channel overrides. This is the highest-risk
structural gap because it affects authorization, persistence, and every client.

### Messaging and information architecture

Discord provides threads and forum-style organization in addition to ordinary
channels ([Threads FAQ](https://support.discord.com/hc/en-us/articles/4403205878423-Threads-FAQ),
[Forum Channels FAQ](https://support.discord.com/hc/en-us/articles/6208479917079-Forum-Channels-FAQ)).
EchoVerse has searchable DM history, reactions, attachments, and message
editing/deletion, but no message search across guilds, pins, threads, forum
posts, markdown/rich-embed policy, message links, or mention autocomplete.

### Direct messages and safety

Discord has message requests/spam handling and privacy controls for DMs from
shared servers ([Message Requests](https://support.discord.com/hc/en-us/articles/10593808896151-Message-Requests),
[Blocking & Privacy Settings](https://support.discord.com/hc/en-us/articles/217916488-Blocking-%26-Privacy-Settings)).
EchoVerse currently authorizes DMs through accepted friendships and supports a
block action in the conversation view, but lacks message requests, spam
quarantine, group DMs, privacy preferences, mute/archive controls, and a
server-wide safety/report workflow.

### Moderation, roles, and auditability

The current fixed role checks protect the implemented guild operations, but
there is no member management screen, kick/ban/timeout flow, report queue,
automated moderation, content policy, moderation log, or administrator audit
trail. These must be added server-side first; a client-only moderation control
would not be an acceptable design.

### Voice, video, and screen share

Discord documents voice/video calls, Go Live, and mobile screen sharing as
separate surfaces with platform limitations ([Go Live and Screen Share](https://support.discord.com/hc/en-us/articles/360040816151-Go-Live-and-Screen-Share),
[Mobile Screenshare FAQ](https://support.discord.com/hc/en-us/articles/360058862134--Mobile-Screenshare-FAQ)).
EchoVerse has one-to-one calls, guild voice, video, screen share, explicit
voice entry, and mobile-browser controls. It does not yet have a scalable
voice architecture (SFU/region selection), stage/stream audience controls,
concurrent stream policy, robust background/reconnect handling on mobile, or
device-level diagnostics and quality telemetry.

### Emoji and media

The shared composer now inserts Unicode emoji and relies on the platform's
font rendering, which works across supported Windows, macOS, iOS, and Android
webviews/browsers. This is not the same as Discord's server emoji, GIF, and
sticker ecosystem. EchoVerse still needs a versioned emoji data source,
accessible categories/search, custom guild emoji with authorization and size
limits, and safe media-provider boundaries if GIFs or stickers are approved.

### Platform delivery and operations

Windows, macOS, and web share contracts and UI code; mobile is responsive web,
not a native iOS/Android app. Native packaging, push notifications, deep links,
offline behavior, background audio policy, accessibility certification, and
mobile store distribution are therefore open decisions. Release signing,
production readiness, and interactive desktop acceptance are also explicitly
deferred in the main roadmap.

## Ordered implementation roadmap

The following order is deliberate. The first items establish domain and
security foundations; client polish and new media surfaces come later.

1. **Domain and channel model** — Introduce typed channel/category entities,
   migrations, ownership invariants, channel lifecycle APIs, and a compatibility
   review for the current general/music/lobby surface.
2. **Custom roles and permission evaluation** — Replace fixed role assumptions
   with a server-side permission model, role hierarchy, channel overrides,
   deny-by-default checks, and negative authorization tests. Add member/role UI
   only after the evaluator is stable.
3. **Guild administration and invites** — Add member management, invite list,
   revocation/expiry UI, moderation actions, audit events, privacy-safe logs,
   and rate/resource limits. Define report retention and deletion behavior.
4. **Messaging parity** — Add guild/DM search, pins, message links,
   mention autocomplete, threads, replies, markdown/attachment policy, and
   forum-style channels only where their data model is approved.
5. **DM safety and social graph** — Add message requests/spam quarantine,
   block/mute/archive preferences, group DMs, notification controls, and
   server-side privacy tests.
6. **Emoji and rich media** — Version the Unicode catalog and fallback policy,
   then consider custom guild emoji, GIFs, and stickers with moderation,
   licensing, upload limits, sanitization, and cross-platform rendering tests.
7. **Voice and mobile lifecycle** — Define the SFU/region/scaling decision,
   stage and stream permissions, reconnect/background behavior, device
   diagnostics, and mobile voice acceptance tests before adding native clients.
8. **Platform strategy** — Decide whether responsive PWA is sufficient or
   native iOS/Android clients are justified; document push, deep-link,
   permissions, offline, accessibility, and release-signing requirements.
9. **Reliability and release gate** — Add browser/mobile E2E coverage,
   performance budgets, observability dashboards, dependency/security scans,
   backup/restore drills, migration rollback evidence, signed artifacts, and
   a final public-release readiness review.

Each item must become an independently evidenced roadmap child before
implementation. No item authorizes production deployment, a native client, or
an external media provider by itself.
