<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# PARITY-004.2 — DM privacy and per-peer preferences

```yaml
id: PARITY-004.2
status: complete
```

## Scope

- Persist a per-account DM privacy setting; the selected default allows a
  non-friend to create a quarantined message request.
- Allow a recipient to mute notifications or archive a one-to-one DM peer.
- Keep all decisions server-authoritative and reject self/unknown peer updates.
- Share the controls through the common web and desktop UI components.

## Acceptance mapping

| Acceptance criterion                                       | Check/evidence                                                                               | Result                                                  |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| New accounts default to accepting quarantined requests     | `dm:preferences` integration assertion                                                       | verified                                                |
| Disabled non-friend requests are rejected server-side      | `dm:privacy-update` followed by `dm:send` integration assertion                              | verified                                                |
| Mute and archive update and round-trip through persistence | `dm:peer-preference-update` and subsequent `dm:preferences` integration assertions           | verified in memory and PostgreSQL runtimes              |
| Self/unknown peer changes are rejected                     | integration assertion for self target                                                        | verified                                                |
| Web/desktop surfaces expose the controls                   | shared UI tests for peer action buttons and privacy checkbox; both renderers typecheck/build | verified at component and authenticated local web level |

## Validation run

- `npm run typecheck` — pass for all workspaces.
- `npm run build` — pass for web, desktop renderer/preload, server, and packages.
- `npm test` — pass (26 files, 144 tests); includes the new privacy,
  mute/archive, schema, migration, and shared UI assertions.
- `npm run format:check` — pass.
- `npm run lint` — pass.
- `npm run localization:check` — pass (415 keys).
- `npm run reuse:check` — pass (REUSE 6.2.0; 354/354 files covered).
- `npm run secret-scan` — pass; no leaks found.
- `npm run test:db` — pass (3 tests) against an isolated PostgreSQL 16.4
  cluster under `tmp/tools/postgresql` on loopback port `55432`; no production
  data or system service was used. The JSON report is retained at
  `tmp/test-results/database.json`.
- Local web preview loaded at `http://127.0.0.1:5173/` while the local server
  was running on port `3001`; the localized login surface displayed the online
  server indicator. Screenshot: `tmp/test-results/PARITY-004.2-web-login.png`.
- Authenticated local web click-through used two local test accounts. The DM
  privacy checkbox toggled off/on correctly; the peer mute and archive controls
  updated their labels/icons and remained present after a page reload. Screenshots:
  `tmp/test-results/PARITY-004.2-dm-privacy.png` and
  `tmp/test-results/PARITY-004.2-dm-peer-controls-persisted.png`.
- The click-through also exposed and fixed an initialization bug where the first
  post-login preference request could use a stale socket reference. The login
  path now passes the authenticated socket explicitly, and the persisted
  mute/archive state was re-observed after reload.

## Verification notes

The repository's local Node host can raise `uv_os_get_passwd returned ENOMEM`
in some host configurations unless the ignored test-only preload is supplied;
this is an environment limitation, not an application fallback. The required
PostgreSQL-backed execution gate was completed in an isolated, portable local
cluster for this acceptance run.

## Security notes

- Privacy and peer preference updates are validated Socket.IO events and are
  checked against the authenticated account on the server.
- Non-friend requests remain quarantined; disabling them does not expose a
  client-side-only restriction.
- Mute suppresses notification/unread presentation only; it does not delete or
  hide message history. Archive is reversible and does not delete data.
