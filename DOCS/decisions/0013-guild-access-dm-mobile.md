<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# ADR-0013: private guild access, direct messages, and mobile voice

- Status: Accepted
- Date: 2026-08-28

## Decision

Guilds are private by default. A guild is visible only to its owner and
accounts with an accepted membership; membership is granted through an
owner/admin-controlled invite. Guild membership and roles are persisted in the
configured SQLite or PostgreSQL database.

Guild roles are `owner`, `admin`, `moderator`, and `member`. Authorization is
enforced server-side for every guild, membership, invite, channel, and message
operation. A guild selection opens its text view; entering the voice lobby is
always an explicit user action.

The shared workspace exposes a persistent Direct Messages section backed by
accepted friendships. Web and desktop use the same shared components and
contracts. Mobile web uses responsive drawers and bottom navigation, while
voice-channel actions remain available on supported mobile browsers.

## Consequences

- The public seeded guild is replaced by an ownerless system surface that does
  not grant access to private guilds.
- Existing in-memory guild state must be migrated into durable tables before
  the server is considered compatible with this decision.
- Invite tokens are opaque, revocable, bounded, and never logged or exposed in
  diagnostics beyond their user-facing copy.
- Mobile media behavior remains subject to browser permissions and platform
  autoplay restrictions; the UI must provide explicit permission/error states.

## Security and compatibility

Clients never determine guild visibility or role authority. Every handler
derives the authenticated account from the server session and checks the
persisted relationship before reading or mutating a guild resource. Existing
DM friendship authorization remains in force.

The change is a protocol and persistence evolution. Migrations are additive,
existing accounts and friendships remain valid, and a rollback requires
restoring the pre-migration database backup before reverting the application.

## Validation

The feature requires migration tests for SQLite and PostgreSQL-compatible SQL,
negative authorization tests for cross-guild access and role escalation,
invite lifecycle tests, shared component tests, mobile viewport acceptance,
and desktop/web production builds.
