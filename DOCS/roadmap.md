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

The shipped baseline is product version `1.8.8`, with protocol major version 2.
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
