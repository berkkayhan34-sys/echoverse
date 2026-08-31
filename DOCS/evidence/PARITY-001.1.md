<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-001.1 — channel structure and role management

```yaml
id: PARITY-001.1
status: complete
```

Status: complete on the working branch.

## Scope

- Shared web/desktop structure panel for categories, channels, and members.
- Collapsible category groups and channel type badges.
- Owner/admin create, rename, and archive actions for categories and channels.
- Owner/admin role changes for non-owner guild members.
- Server-side authorization remains authoritative; clients only render the
  controls and send existing validated socket events.
- Per-channel notification preferences and unread markers are deferred to
  `PARITY-001.2`.

## Acceptance mapping

| Acceptance criterion                                 | Check/evidence                                                                                                                                                       | Result                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Authorized structure mutations persist and broadcast | `guild:create-category`, `guild:update-category`, `guild:create-channel`, `guild:update-channel`, and reorder handlers now broadcast filtered `guild:channels` state | verified by integration test and authenticated browser interaction                                                              |
| Authorized role changes reach current guild members  | `guild:set-role` now broadcasts filtered `guild:members` state                                                                                                       | verified by integration test and authenticated browser interaction                                                              |
| Unauthorized visibility/mutations remain blocked     | Existing `hasPermission`/`hasScopedPermission` guards are unchanged; UI is only shown for owner/admin roles                                                          | server authorization tests pass; owner/admin visibility is verified in browser; regular-member UI visibility remains unverified |
| Keyboard and narrow-screen behavior                  | Native form controls/buttons, dialog semantics, tabbed layout, and responsive one-column layout are implemented in shared UI                                         | verified in the integrated browser at default and 390×844 viewports                                                             |

## Validation run

- `npm run typecheck` — pass (all packages with typecheck scripts).
- `npm test` — pass (23 files, 129 tests).
- `npm run build` — pass (web, desktop renderer/preload, server, and packages).
- `npm run dev` — the server required the repository-documented local
  `NODE_OPTIONS` workaround for this host's `uv_os_get_passwd` ENOMEM failure;
  once started, it listened on port 3001.
- Local web preview loaded at `http://127.0.0.1:5173/` and rendered the
  localized login surface.
- Authenticated browser run used a local owner account and a second local
  member account. The owner created and renamed a category, created a voice
  channel, and changed the member role to moderator. The panel was inspected
  at the default viewport and at 390×844; the tabbed layout kept controls
  reachable without horizontal overflow.
- Evidence screenshots were captured locally under
  `tmp/test-results/PARITY-001.1-tabs-desktop-final.png` and
  `tmp/test-results/PARITY-001.1-tabs-mobile-final.png`.

## Security and compatibility notes

- No new dependency or protocol was introduced.
- All mutations continue through the existing validated Socket.IO events and
  server-side role/permission checks.
- Broadcast payloads are filtered per connected guild member, so hidden
  channels/categories are not enumerated to unauthorized clients.
- Archived entries remain excluded by the existing list functions; no restore
  behavior is introduced in this slice.
