<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Current audit and deferred-work roadmap

This is the authoritative tracker for the current EchoVerse baseline. The
completed v1.8 through v2.1 baseline children are archived in the
[completed-baseline reference](historic/roadmap/completed-baseline.md), with
their original evidence records retained under [`evidence/`](evidence/).

The purpose of this pass is to finish the current audit record, not to declare
the product ready for public release. The owner has explicitly deferred the
remaining release-readiness work until the project is deemed complete. The
final child below is therefore a reference register, not active implementation
work. Future feature or change requests will be added as separately ordered
children after that owner decision; they must not be silently folded into this
historical baseline.

Every current child has a stable ID, one checkbox, machine-readable metadata,
and an evidence link or `null`. Allowed status/checkbox pairs are
`incomplete`/`[ ]`, `in_progress`/`[-]`, `deferred`/`[ ]`, and
`complete`/`[x]`. A deferred child is intentionally not active and is excluded
from the first-active-child rule. Before working on
an incomplete child, change its status to `in_progress` and its checkbox to
`[-]`. A complete child requires implementation, applicable tests, security
review, documentation, and evidence. A deferred child must identify what is
deferred and the owner condition that makes it eligible for scheduling.

## Current baseline

The shipped baseline is product version `1.9.2`, with protocol major version 2.
The completed documentation, quality, runtime, localization, modular-boundary,
installer/update, observability, and reliability work is a historical
reference, not an open implementation queue. Local SQLite validation and CI
PostgreSQL validation remain the approved database split. Web acceptance is
complete for the current baseline; desktop development-runtime verification,
release signing, and public-release readiness remain explicitly deferred.

## Audit closure

### audit-closure-and-documentation-pass

```yaml
id: AUDIT-002
type: documentation_audit
status: complete
evidence: evidence/AUDIT-002.md
blocks_roadmap: true
```

[x] Reconcile the active roadmap with the completed baseline, archive completed
children without losing their evidence, create one final deferred-work
reference for owner-approved follow-up, reconcile the canonical navigation and
decision records, and verify the repository with the required documentation,
quality, build, security, and deployment-manifest checks.

## Roadmap operation after the baseline

The next authorized change should be a specific feature addition or behavior
change. It must be recorded as a new roadmap child or equivalent owner-approved
change record before implementation, preserving the repository’s requirement,
acceptance, security, validation, documentation, and release gates.

## Owner-approved feature work

### private-guild-dm-mobile-foundation

```yaml
id: FEATURE-001
type: runtime_feature
status: complete
evidence: evidence/CODE-010.md
blocks_roadmap: false
decision: decisions/0013-guild-access-dm-mobile.md
```

[x] Deliver the owner-approved private guild, role, invite, persistent DM,
mobile responsive, and mobile voice foundation in implementation order:

1. Add durable guild, membership, role, invite, and channel-access data with
   SQLite/PostgreSQL migrations and migration tests.
2. Add typed protocol contracts and server-side authorization for guild lists,
   text-channel access, voice-room entry, invites, and role administration.
3. Separate server selection from voice-room entry; preserve explicit lobby
   join/leave behavior and repair reconnect state.
4. Add the shared Direct Messages navigation and improve the message composer
   for keyboard, attachment, reply, edit, and mobile input ergonomics.
5. Apply responsive web navigation drawers, bottom navigation, media controls,
   permission states, and mobile voice-channel acceptance coverage.
6. Keep Windows, macOS, and web builds aligned through shared contracts,
   shared-ui components, localization, tests, and release validation.
7. Allow server owners and admins to rename the persistent voice lobby through
   an authorized, localized action; persist the name and broadcast updates to
   authorized guild members.
8. Persist the public `echoverse` main guild, reconcile the deployment-configured
   founder as owner, backfill existing accounts, and auto-enroll new accounts
   without weakening private-guild authorization.
9. Replace the narrow-screen navigation with the shared Discord-style drawer,
   mobile bottom navigation, explicit lobby entry, DM/friends access, safe-area
   composer spacing, and the same brand/sound assets across web and desktop.

10. Remove Spotify Together from the protocol, server handlers, native bridge,
    renderer, localization catalogs, configuration, documentation, and legacy
    token storage.

Acceptance evidence is required for each child before this feature is marked
complete. No unrelated product feature should be added to this child.

### release-1-8-6-parity-and-branding

```yaml
id: FEATURE-002
type: runtime_feature
status: complete
evidence: evidence/CODE-011.md
blocks_roadmap: false
decision: null
```

[x] Restore the branded shared renderer and complete guild lifecycle parity:

1. Hide the web-only platform marker and web title when the renderer runs in
   the Electron shell, while retaining them in a normal browser.
2. Restore the EchoVerse icon and wordmark in the web authentication surface
   and keep the same assets available to the desktop UI cache.
3. Make the public `echoverse` guild visible and selectable for every
   authenticated account even when a stale membership row is missing, without
   granting an unconfigured account owner/admin privileges.
4. Add an explicit leave action for non-owner private guilds; leaving removes
   the guild from the user's server rail and is blocked for the public main
   guild and guild owners.
5. Route invite copying through the Electron native clipboard and retain a
   validated browser fallback so generated invite codes can be copied on all
   supported surfaces.

Acceptance evidence is recorded in [`evidence/CODE-011.md`](evidence/CODE-011.md).

### guild-voice-signaling-regression

```yaml
id: BUG-001
type: runtime_bugfix
status: complete
evidence: evidence/CODE-012.md
blocks_roadmap: false
decision: null
```

[x] Restore server voice WebRTC signaling without weakening the private-call
boundary: relays are allowed for authenticated members of the same active
guild lobby, private-call relays remain friendship-scoped, and outsiders are
denied. The regression is covered by an integration test for both allowed and
denied signaling.

### guild-voice-client-and-dm-composer-regression

```yaml
id: BUG-002
type: runtime_bugfix
status: complete
evidence: evidence/BUG-002.md
blocks_roadmap: false
decision: null
```

[x] Correct the client-side regressions reported after the 1.9.3 baseline:

1. Expose an accessible three-dot menu for leaving non-owner private guilds;
   selecting Leave removes the guild from the server rail while the public
   `echoverse` guild and owners remain protected.
2. Make first-time guild voice joins establish a deterministic, serialized
   WebRTC graph with queued early ICE candidates and a usable local microphone;
   private calls and guild voice must remain isolated and rejoining must not
   leave stale peers behind.
3. Make the direct-message composer use the available width for the message
   field and a compact, touch-friendly send control on desktop and mobile.

Acceptance evidence is recorded in [`evidence/BUG-002.md`](evidence/BUG-002.md).

### owner-test-guild-deletion-and-join-action

```yaml
id: BUG-003
type: runtime_feature
status: complete
evidence: evidence/BUG-003.md
blocks_roadmap: false
decision: null
```

[x] Add a server-authorized private-guild lifecycle action and make the left
server-rail plus action complete:

1. Permit permanent deletion only to the guild owner, never for the public
   `echoverse` guild, and only when every other member is one of the two
   explicitly allowlisted test accounts (`test@test.com` or
   `test2@test2.com`).
2. Delete the guild row in one persisted operation so foreign-key cascades
   remove its channels, messages, invites, memberships, moderation records,
   audit records, and permission overrides; clear the corresponding in-memory
   state and notify connected members.
3. Expose the delete action both in the private guild three-dot menu and the
   guild header/settings affordance; non-owners retain Leave and cannot delete.
4. Make the server-rail plus action offer both New server and Join with server
   code on desktop and responsive mobile layouts.

Acceptance requires positive and negative service/transport tests, localization
parity, type/build checks, and rendered shared-UI verification. The owner,
main-guild protection, member allowlist, and persisted cascade are server-side
invariants; client visibility is not an authority boundary.

## Release/version rule

The root [`VERSION`](../VERSION) file remains the canonical desktop-shell and
product release version.
Every release must update package mirrors, changelog/release notes, roadmap
status, checksums, and workflow evidence together, then publish only the
matching `v<version>` tag as described in [release.md](release.md).
The deployed web renderer has a separate commit-based revision. Web-only
changes publish a signed manifest identified by the latest Git commit and do
not require a new desktop installer; desktop/native or desktop-relevant shared
changes still require a new shell release.

### temporary-macbook-self-hosted-deployment

```yaml
id: OPS-005
type: self_hosted_deployment
sequence: 910
status: complete
evidence: evidence/OPS-005.md
blocks_roadmap: true
decision: decisions/0024-macbook-self-hosted-deployment.md
depends_on: [ARCH-001, SEC-001, MOD-001]
```

[x] Provision the temporary Debian/T2 MacBook as a non-root GitHub
self-hosted runner, run the PostgreSQL-backed server through a user systemd
service on port `3001`, and deploy only after verification gates pass. Keep
Cloudflare Tunnel as the only public ingress, keep secrets in the host-owned
environment file, and record runner registration, health, backup, sleep/
restart, and recovery evidence before marking this operational item complete.

## Post-feature parity audit

### discord-gap-analysis-and-parity-roadmap

```yaml
id: AUDIT-003
type: product_audit_and_roadmap
status: complete
evidence: evidence/AUDIT-003.md
blocks_roadmap: true
```

[x] Compare the current EchoVerse implementation with Discord's documented
server permissions, channel organization, messaging, DM safety, moderation,
voice/screen-share, emoji/media, and platform surfaces. Record the gaps and
order the follow-up work so domain, authorization, and safety foundations are
implemented before UI polish or additional clients.

The ordered follow-up is documented in
[`audits/discord-gap-analysis.md`](audits/discord-gap-analysis.md) and must be
split into independently evidenced children before implementation:

1. domain and channel model;
2. custom roles and permission evaluation;
3. guild administration, invites, moderation, and auditability;
4. messaging parity (search, pins, threads, mentions, and content policy);
5. DM safety and social graph;
6. emoji and rich media;
7. voice scaling and mobile lifecycle;
8. platform strategy (responsive PWA versus native mobile);
9. reliability, security, accessibility, and release gate.

This audit does not claim Discord compatibility and does not authorize native
mobile development or production deployment. The current responsive mobile
web path remains the supported iOS/Android surface until a platform decision
is recorded.

## Discord + TeamSpeak product direction

The following children are the ordered implementation queue for the target
product: Discord-like communities, identity, and text/social features combined
with TeamSpeak-like persistent, low-friction voice rooms. The product direction
is accepted in ADR-0014 and the detailed execution profile is accepted in
ADR-0021; the children remain incomplete until implementation and evidence are
finished. Each ID is stable and must not be reused; dependencies are
machine-facing identifiers.

### foundation-product-contract

```yaml
id: ARCH-001
type: product_and_protocol_foundation
sequence: 100
status: complete
evidence: evidence/ARCH-001.md
blocks_roadmap: true
decision: decisions/0021-discord-parity-execution-profile.md
depends_on: [FEATURE-001, AUDIT-003]
```

[x] Freeze the Discord + TeamSpeak hybrid product contract: server/guild
ownership, persistent voice rooms, text channels, DMs, identities, presence,
message/media boundaries, compatibility guarantees, and non-goals.

### channel-and-space-model

```yaml
id: ARCH-002
type: domain_model
sequence: 200
status: complete
evidence: evidence/ARCH-002.md
blocks_roadmap: true
decision: decisions/0021-discord-parity-execution-profile.md
depends_on: [ARCH-001]
```

[x] Design and migrate categories, text channels, persistent voice rooms,
optional stage/forum spaces, ordering, archive/delete rules, and backward
compatibility for the current general/music/lobby surface. The compatibility
slice includes a durable lobby display name that owners and admins can rename
through an authorized server action, with member-visible updates and migration
coverage.

### permissions-and-role-hierarchy

```yaml
id: SEC-001
type: authorization
sequence: 300
status: complete
evidence: evidence/SEC-001.md
blocks_roadmap: true
decision: decisions/0021-discord-parity-execution-profile.md
depends_on: [ARCH-002]
```

[x] Implement a server-side role hierarchy and permission evaluator with
channel/category overrides, inherited defaults, deny-by-default behavior,
negative tests, and shared member/role administration UI.

### guild-administration-and-moderation

```yaml
id: MOD-001
type: moderation_and_governance
sequence: 400
status: complete
evidence: evidence/MOD-001.md
blocks_roadmap: true
depends_on: [SEC-001]
```

[x] Add member management, invite lifecycle UI, kick/ban/timeout/report flows,
privacy-safe audit events, retention/deletion rules, rate limits, and a
moderator-facing safety workflow.

### messaging-and-social-parity

```yaml
id: CHAT-001
type: messaging_and_social
sequence: 500
status: incomplete
evidence: evidence/CHAT-001.md
blocks_roadmap: true
depends_on: [ARCH-002, SEC-001]
```

[ ] Add guild/DM search, pins, threads, replies, message links, mention
autocomplete, content/attachment policy, message requests, spam quarantine,
mute/archive, group DMs, and notification controls.

The 1.9.1 live-parity slice hardens the existing guild chat path against
hosted-database bootstrap failures and reconnect races; it is recorded in
[`evidence/CODE-013.md`](evidence/CODE-013.md). The broader parity work remains
incomplete.

The 1.9.0 slice is tracked as the following stable sub-items and is evidenced
without claiming the parent parity item is complete:

- `CHAT-001.1` — guild send acknowledgements and localized failure feedback;
  covered by the server integration and client transport checks.
- `CHAT-001.2` — persistent group DM conversations, membership checks, group
  history, and fan-out messaging; owner/admin membership changes are included.
- `CHAT-001.3` — group-call signaling for accepted conversation members, with
  a ten-person cap and call-only disconnect semantics.
- `CHAT-001.4` — browser sessions authenticated through the HTTP-only cookie
  can select the public main guild and send persisted guild messages; missing
  legacy main-guild channel rows are repaired or served from the canonical
  `general`/`Lobby` defaults during startup.
- `CHAT-001.5` — shared web/desktop guild chat search, server-authorized
  pin/unpin actions, pinned-message rendering, and copyable message links.
  Search and pin controls remain renderer-owned while authorization stays on
  the server boundary.
- `CHAT-001.6` — same-channel guild replies with server-side parent-message
  authorization, shared web/desktop reply actions, composer context, and inline
  parent previews. Full threaded conversations remain deferred.
- `CHAT-001.7` — focused thread panel derived from persisted same-channel reply
  links, with localized open/close/reply actions and nested reply rendering;
  authenticated browser evidence is recorded in `evidence/CHAT-001.md`.
- `CHAT-001.8` — server-authorized guild member mention suggestions and
  isolated `chat:mention` notifications, with offline-member name resolution
  and two-account browser evidence recorded in `evidence/CHAT-001.md`.
- `CHAT-001.9` — server-enforced text-only DM requests for non-friends,
  pending-request deduplication, recipient accept/decline/spam actions,
  attachment quarantine, block precedence, and friendship conversion on
  acceptance; evidence is recorded in `evidence/CHAT-001.md`.

Still deferred under `CHAT-001`: full threaded conversation lifecycle,
attachment policy UI, and notification controls beyond mention delivery. The
group-call UI supports converting an active one-to-one call
while creating a group; in-place participant renegotiation without that
conversion remains a follow-up item.

### emoji-and-rich-media

```yaml
id: MEDIA-001
type: client_media
sequence: 600
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [CHAT-001, MOD-001]
```

[ ] Version the Unicode catalog and accessibility/search model, then evaluate
custom server emoji, GIFs, stickers, previews, licensing, upload limits,
sanitization, and cross-platform rendering.

`MEDIA-001.1` (1.9.0): the shared picker now presents common emoji first,
supports local search, remembers the most recent selections, and is reused by
web and desktop. Full Unicode catalog versioning and rich-media uploads remain
deferred.

### scalable-voice-and-presence

```yaml
id: VOICE-001
type: realtime_media
sequence: 700
status: incomplete
evidence: null
blocks_roadmap: true
decision: decisions/0021-discord-parity-execution-profile.md
depends_on: [ARCH-002, SEC-001]
```

[ ] Implement the bounded P2P voice path and provider-neutral SFU boundary,
persistent voice-room semantics, stage/stream permissions,
reconnect/background lifecycle, device diagnostics, and quality telemetry.

`VOICE-001.1` (1.9.0): group DM voice signaling is available through the
existing bounded P2P transport, membership authorization, ten-member limit,
and per-participant leave behavior. SFU scaling, background lifecycle,
quality telemetry, and in-place participant renegotiation remain deferred.

`VOICE-001.2` — authenticated web/mobile clients use the same main-guild
membership and lobby authorization path as desktop; the integration suite
covers cookie-authenticated `join-room` and guild chat together.

### mobile-and-platform-delivery

```yaml
id: PLATFORM-001
type: platform_strategy
sequence: 800
status: incomplete
evidence: null
blocks_roadmap: true
decision: decisions/0021-discord-parity-execution-profile.md
depends_on: [CHAT-001, VOICE-001]
```

[ ] Deliver the PWA-first responsive web/mobile surface and specify push, deep
links, permissions, offline behavior, background voice, accessibility, and
Windows/macOS packaging parity. Native iOS/Android delivery remains deferred.

### signed-desktop-ui-cache

```yaml
id: PLATFORM-002
type: desktop_ui_delivery
sequence: 850
status: incomplete
evidence: null
blocks_roadmap: true
decision: decisions/0018-signed-remote-ui-cache.md
depends_on: [PLATFORM-001]
```

[ ] Keep the Electron native shell stable while delivering the shared renderer
through a signed, versioned UI manifest. Publish the manifest with the web
assets, verify Ed25519 signatures and per-file SHA-512 digests in the packaged
desktop client, atomically cache only compatible same-origin files, and fall
back to the previous cache or bundled renderer on every failure. Keep native
shell updates on the existing unattended installer path.

Acceptance requires signature/path/size/hash/fallback tests, `webRevision`
cache-identity coverage, web workflow manifest evidence, desktop/web production
builds, and a packaged startup smoke test proving that an unavailable or invalid
UI update still opens the known-good renderer.

`PLATFORM-002.1` (1.9.0): packaged startup now bounds update waiting to 30
seconds, logs failures, catches UI-cache preparation errors, and retries the
bundled renderer when a cached entrypoint fails. The Windows NSIS artifact was
installed silently and launched successfully; macOS and cross-platform update
acceptance remain deferred to the parent gate.

## Discord parity execution children from the 2026-08-30 desktop audit

The following children turn the latest Discord/EchoVerse comparison into an
implementation-ready queue. They refine `AUDIT-003` and the existing parent
items above; they do not claim Discord compatibility, authorize a native mobile
client, or authorize production deployment. Each child must retain its own
requirements, server-side authorization, negative tests, visual evidence, and
release impact. The order is deliberate: durable domain/security boundaries
come before UI polish and rich media.

### parity-channel-administration-surface

```yaml
id: PARITY-001
type: channel_and_member_ui
sequence: 410
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [ARCH-002, SEC-001, MOD-001]
```

[ ] Expose the existing category/channel and member permission model as a
usable server surface: collapsible categories, channel type badges, channel
creation/rename/archive actions, per-channel notification controls, unread
markers, role-grouped members, and an owner/admin management entrypoint.
Client controls remain advisory; every mutation and visibility decision stays
server-authorized.

Acceptance: authorized owner/admin actions persist and broadcast; members see
only permitted channels; unauthorized users cannot mutate or enumerate hidden
channels; keyboard and narrow-screen interactions have rendered evidence.

The parent is intentionally split into independently verifiable slices. The
first slice below covers the durable structure and role-management surface;
notification preferences and unread reconciliation remain a separate child.

### parity-channel-structure-management

```yaml
id: PARITY-001.1
type: channel_structure_and_role_management
sequence: 415
status: complete
evidence: evidence/PARITY-001.1.md
blocks_roadmap: false
depends_on: [ARCH-002, SEC-001, MOD-001]
```

[x] Add a shared web/desktop management surface for categories, channels, and
member roles. Categories can be collapsed, channels show their type, owners
and admins can create/rename/archive channels and categories, and authorized
administrators can change non-owner member roles. Every action uses the
existing server authorization boundary and broadcasts the filtered result to
current guild members.

Acceptance: an owner/admin can complete each structure or role mutation and
observe the persisted/broadcast result; a regular member cannot see or invoke
the management surface; unauthorized channel/category visibility remains
filtered server-side; the surface is keyboard reachable and usable at the
narrow-screen breakpoint. Per-channel notification controls and unread markers
are explicitly out of scope for this child and are tracked by the next child.

### parity-channel-notifications-and-unread

```yaml
id: PARITY-001.2
type: channel_notifications_and_unread
sequence: 420
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [PARITY-001.1]
```

[ ] Add server-backed per-channel notification preferences, unread markers,
and cross-device reconciliation without exposing hidden channels or message
content in logs/notifications.

### parity-dm-navigation-and-inbox

```yaml
id: PARITY-002
type: dm_information_architecture
sequence: 510
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [CHAT-001]
```

[ ] Replace the modal-only DM entrypoint with a persistent DM rail containing
Friends, Message Requests, group conversations, unread state, search, and a
unified inbox for unreads and mentions. Keep the existing friendship and group
membership authorization boundary; do not expose message bodies in logs or
notification payloads beyond the documented product policy.

Acceptance: direct and group conversations remain available after restart;
unread counts reconcile across web and desktop; opening a conversation cannot
grant access to a non-member; mobile navigation has an equivalent reachable
path.

### parity-message-threads-and-mentions

```yaml
id: PARITY-003
type: messaging_parity
sequence: 520
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [CHAT-001, ARCH-002]
```

[ ] Add channel/DM message search that can scope by author/channel/date,
thread creation and reply context, mention autocomplete and mention events,
message links that restore the original location, and a documented
attachment/markdown/embed policy.

Acceptance: search and thread results enforce membership and pagination;
mentions notify only authorized recipients; malformed, oversized, or hostile
rich content is rejected; thread/reply state survives reconnect and reload.

### parity-dm-safety-and-privacy

```yaml
id: PARITY-004
type: dm_safety
sequence: 530
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [PARITY-002, MOD-001]
```

[ ] Add message requests, spam quarantine, block/mute/archive preferences,
per-user DM privacy controls, report intake, and retention/deletion behavior.
All decisions must be enforced by the server and covered by wrong-user,
blocked-user, replay, and rate-limit tests.

- `PARITY-004.1` — message-request inbox, text-only quarantine, recipient
  accept/decline/spam actions, block precedence, and replay-safe friendship
  conversion are complete; see `evidence/CHAT-001.md` and ADR-0023.

### parity-guild-voice-reliability-gate

```yaml
id: PARITY-005
type: voice_reliability
sequence: 610
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [VOICE-001]
```

[ ] Close the current guild-voice regression before scaling: two independent
authenticated clients must join the same lobby, exchange microphone audio,
leave, rejoin, and remain isolated from private calls. Cover deterministic
offer/answer ordering, early ICE, microphone acquisition, reconnect,
background/foreground transitions, device failure, and explicit disconnect.

Acceptance requires a repeatable two-client browser test, a desktop smoke
check, audio-path evidence (not only a connected badge), and failure evidence
for a non-member and a stale socket.

### parity-voice-scale-and-stage-boundary

```yaml
id: PARITY-006
type: realtime_media_architecture
sequence: 620
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [PARITY-005, SEC-001]
decision: pending owner choice of P2P-only, provider-neutral SFU boundary, or
immediate SFU integration
```

[ ] Decide and document the scale boundary for persistent voice: participant
limits, region selection, stage speakers/audience, stream permissions,
quality telemetry, and recovery when the media provider is unavailable. Do not
select a provider or add native mobile media code until the decision record and
rollback/forward-recovery plan exist.

### parity-emoji-and-rich-media

```yaml
id: PARITY-007
type: emoji_and_rich_media
sequence: 630
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [MEDIA-001, MOD-001]
```

[ ] Version the Unicode emoji catalog and fallback policy, improve accessible
category/search/recent behavior, then make a separate owner decision on custom
guild emoji, GIFs, stickers, and previews. Any approved upload/provider path
must define licensing, MIME/size limits, sanitization, moderation, and
cross-platform rendering tests.

### parity-settings-accessibility-and-localization

```yaml
id: PARITY-008
type: settings_and_accessibility
sequence: 710
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [PLATFORM-001, CHAT-001, VOICE-001]
```

[ ] Build a discoverable settings surface covering account/session security,
privacy and messaging permissions, notifications, appearance, accessibility,
voice/video devices, system/startup behavior, language/time, and reduced
motion. Ensure the packaged desktop renderer, browser renderer, and responsive
mobile path expose the same supported controls and that source/build/cache
versions cannot silently diverge.

Acceptance: every setting has an accessible name, keyboard/touch path,
localized label, explicit loading/error/success state, and a test proving the
setting is applied or safely rejected; sensitive settings require the correct
server/native boundary.

### parity-mobile-and-platform-surface

```yaml
id: PARITY-009
type: responsive_platform_delivery
sequence: 720
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [PARITY-002, PARITY-005, PARITY-008]
decision: decisions/0021-discord-parity-execution-profile.md
```

[ ] Complete the PWA-first mobile experience: Discord-style server/channel/DM
navigation, touch-sized controls, safe-area composer spacing, push/deep-link
policy, background voice/reconnect behavior, and mobile accessibility. Keep
native iOS/Android binaries out of scope until a separate platform decision is
approved.

### parity-integrations-and-bot-boundary

```yaml
id: PARITY-010
type: integrations_and_bots
sequence: 730
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [SEC-001, MOD-001]
```

[ ] Define the bot/app contract before adding an App Directory: installation
consent, scoped permissions, revocation, rate limits, audit events, bot
identity, and connected-app privacy. The existing EchoBot remains a bounded
first-party capability until this boundary is approved.

### parity-release-evidence-and-version-reconciliation

```yaml
id: PARITY-011
type: release_readiness_and_documentation
sequence: 900
status: incomplete
evidence: null
blocks_roadmap: true
depends_on:
  [
    PARITY-001,
    PARITY-002,
    PARITY-003,
    PARITY-004,
    PARITY-005,
    PARITY-007,
    PARITY-008,
    PARITY-009,
    PARITY-010
  ]
```

[ ] Reconcile the current root `VERSION`, package mirrors, roadmap baseline,
evidence revisions, changelog, and web `webRevision`. Add cross-client
authenticated E2E, visual acceptance, security scans, artifact/checksum
checks, installer startup/recovery, and deployment health evidence to the
release gate. A successful build or deploy alone is not acceptance evidence.

The latest audit observed `VERSION=1.9.5` while older roadmap/evidence entries
still reference `1.9.2`/`1.9.4`; this child must resolve that documentation
drift before a parity release is called complete.

### reliability-and-public-release-gate

```yaml
id: READY-002
type: release_readiness
sequence: 900
status: incomplete
evidence: null
blocks_roadmap: true
depends_on: [MOD-001, MEDIA-001, VOICE-001, PLATFORM-001]
```

[ ] Add browser/mobile E2E coverage, performance budgets, observability,
dependency/security scans, migration rollback and backup drills, signed
artifacts, incident procedures, and the final public-release readiness gate.

## Final deferred work reference

### post-completion-deferred-work

```yaml
id: DEFER-001
type: deferred_work_reference
status: deferred
evidence: null
blocks_roadmap: false
deferred_until: owner declares the current project baseline complete
```

[ ] After the owner declares the current project baseline complete, schedule
the following as explicit, independently evidenced roadmap work:

- `OPS-003`: select and implement Windows publisher signing plus Apple code
  signing/notarization; verify publisher identity and updater artifacts in CI;
  retain checksums and provenance; document key rotation and rollback. The
  required signing identities, provider decision, and protected CI credentials
  are not currently available.
- `OPS-004`: publish support, incident-response, release-evidence,
  artifact-retention, known-issues, and rollback procedures for each shipped
  version.
- `READY-001`: run the final public-release readiness gate only after the
  preceding deferred release work is complete, governance is activated, and
  the owner approves the result.
- Complete desktop Electron development-runtime and interactive acceptance
  that the owner intentionally deferred while web acceptance was sufficient
  for the baseline.
- Add export/import behavior and its hostile-input, compatibility, deletion,
  and recovery evidence if that product boundary is approved.
- Revisit any new audit findings, features, or requested changes introduced
  after this baseline. Each must be added as a new confirmed child with its own
  requirements, tests, security review, documentation, and release impact;
  this reference does not pre-approve future scope.

Until this child is activated by the owner, unsigned desktop artifacts remain
validation-only and must not be called production-ready. No release,
deployment, signing, or feature implementation is implied by this reference.
