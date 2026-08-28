<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0016: managed main guild and shared mobile navigation shell

## Status

Accepted for the current implementation slice.

## Context

The product has one public EchoVerse community and additional private guilds.
The public community must be durable, visible to every authenticated account,
and safe to enter only through an explicit user action. The responsive web
surface is also the current iOS/Android surface, so its navigation and voice
entry must remain consistent with the desktop renderer.

## Decision

- The `echoverse` guild is a persisted guild, not an authorization bypass.
- The deployment sets `ECHO_VERSE_MAIN_OWNER_EMAIL` to the founder account.
  The value is configuration, never source-controlled data.
- Startup reconciles the configured founder as the guild owner and backfills
  every existing account as a member. Registration, login, resume, and token
  identification reconcile membership for the current account as well.
- Private guild visibility and voice/text access remain membership-gated and
  invite-based. Selecting a guild does not join its voice lobby.
- Web and desktop render the same shared responsive navigation component. On
  narrow screens it provides a server/channel drawer, explicit DM/friends
  entry points, a voice-lobby action, safe-area spacing, and the same brand
  asset used by the renderer.

## Consequences

The main guild can be repaired idempotently after deployment or account
migrations, while private guilds retain their existing access controls. A
deployment that needs founder administration must provide the owner email in
its environment configuration; an unset value fails closed and does not grant
an arbitrary account elevated access.

## Validation and rollback

Unit and integration tests must cover membership backfill, owner/admin
authorization, private-guild denial, explicit lobby entry, and responsive
navigation rendering. Rollback is a code rollback; the membership rows are
additive and can be retained for a subsequent compatible release.
