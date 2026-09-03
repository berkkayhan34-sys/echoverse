<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Changelog

## 1.9.9

- Fix hosted web and desktop realtime connections by keeping the Cloudflare
  Tunnel endpoint on Socket.IO polling, while local endpoints retain WebSocket
  upgrades.
- Harden guild voice recovery in web and desktop with deterministic socket-pair
  offer ownership, serialized peer creation, bounded early-ICE queuing,
  foreground/reconnect repair, failed-peer recovery, and microphone-track
  reacquisition. Live two-client audio evidence is still required before the
  `PARITY-005` roadmap gate can close.
- Add server-authoritative direct-message report intake with privacy-safe
  persistence, replay protection, message ownership checks, and a bounded
  per-reporter rate limit, with PostgreSQL-backed integration coverage.
- Add the selected 180-day retention cleanup for moderation/report records
  and soft-deleted DM/guild message tombstones across PostgreSQL and SQLite.

## 1.9.8

- Point packaged desktop clients and hosted browser fallbacks at the
  self-hosted `https://echoverse.borayarkin.net` origin so API, Socket.IO, and
  session traffic use the deployed EchoVerse server.
- Document the approved hosted endpoint used by desktop release builds.

## 1.9.7

- Serve the built web renderer from the self-hosted EchoVerse server so
  `echoverse.borayarkin.net` provides the browser UI, API, and Socket.IO from
  one same-origin endpoint.
- Route the browser renderer to the self-hosted origin on the canonical public
  hostname and build the web bundle as part of the MacBook deployment gate.

## 1.9.6

- Add server-authorized message requests for non-friends with pending-request
  deduplication, recipient accept/decline/spam actions, attachment quarantine,
  and friendship conversion on acceptance.
- Add channel replies, focused thread panels, authorized member mention
  suggestions, and isolated mention notifications across the shared renderer.

## 1.9.5

- Add server-authorized private-guild deletion for owners when only the owner
  and approved test accounts remain; protect the public EchoVerse guild and
  clean persisted guild data through foreign-key cascades.
- Add owner delete and member leave controls to the shared server rail and
  guild header, with connected-member cleanup after deletion.
- Add New server and Join with server code actions to the server-rail plus
  control on desktop and responsive layouts.

## 1.9.4

- Stabilize first-time guild voice joins with deterministic peer setup,
  serialized connection creation, and early ICE candidate queuing.
- Add a visible leave action for non-owner private guilds and remove the guild
  from the server rail after a successful leave.
- Make the direct-message composer responsive with a flexible message field and
  compact send control across desktop and mobile layouts.

## 1.9.3

- Add shared guild-chat search, server-authorized pin/unpin controls, pinned
  message rendering, and copyable message deep links across web and desktop.
- Verify the live message flow with authenticated local browser coverage,
  including send, search, pin lifecycle, clipboard copy, and deep-link reopen.

## 1.9.2

- Enforce a single desktop process so updater, cache, tray, and renderer state
  cannot race when the app is launched repeatedly.
- Bring a second launch to the existing window instead of leaving a hidden
  process behind, and record bounded updater error details for diagnosis.

## 1.9.1

- Keep web authentication usable while the realtime connection is reconnecting;
  the workspace now opens only after the authenticated socket session is
  confirmed.
- Prefer Socket.IO polling on hosted proxies, upgrade to WebSocket when
  available, and provide an explicit retry action for offline sessions.
- Preserve unsent guild-message drafts until the server acknowledges durable
  storage, with an eight-second timeout and localized failure feedback.
- Prevent a PostgreSQL message-write failure from crashing the server process;
  return a safe error and retain structured diagnostics instead.

## 1.9.0

- Acknowledge guild message sends and surface localized transport failures.
- Add persistent, membership-authorized group DMs with owner/admin controls,
  group message history, and group voice calls capped at ten participants.
- Improve the shared emoji picker with common-first ordering, search, and
  recent emoji memory across web and desktop.
- Make packaged desktop startup resilient to updater timeouts and invalid
  cached UI by falling back to the bundled renderer and recording diagnostics.

## 1.8.9

- Harden channel and category authorization so persisted scope overrides are
  enforced for chat history, message mutations, channel lists, and channel
  administration.

## 1.8.8

- Add persisted guild categories, channel/category ordering, archive state, and
  scope-aware permission overrides with deny-by-default evaluation.
- Add authorized member listing, reporting, moderation rate limits, and audit
  retention cleanup; expose shared role administration controls.
- Improve the shared workspace server rail with a compact invite action, a
  bottom-anchored account panel, and a protected-server leave workflow.

## 1.8.7

- Ship the parity foundation and channel/messaging protocol additions in the
  first release after the 1.8.6 web-cache split.

## 1.8.6

- Restore the EchoVerse icon and wordmark across browser and Electron-hosted
  UI, and remove the `WEB` marker from the desktop shell.
- Make the public EchoVerse main server visible to every authenticated account
  even when old membership data is incomplete, while preserving configured
  founder privileges.
- Add a clear leave action for joined private servers and remove them from the
  server rail after leaving.
- Make invite-code copying reliable through the native desktop clipboard and a
  validated browser fallback.

## 1.8.5

- Repair the friend lifecycle so users can search offline accounts, cancel
  pending requests, prevent duplicate relationships, and accept requests after
  reconnecting.
- Reconcile the public EchoVerse main guild for existing and newly registered
  accounts while retaining deployment-configured founder ownership.
- Normalize legacy placeholder lobby labels, keep authorized lobby renaming,
  and expose the shared responsive workspace with Discord-style mobile server,
  channel, DM, and bottom-navigation structure.
- Remove Spotify Together and its native bridge, protocol events, UI, assets,
  and legacy token file cleanup path.

## 1.8.4

- Stabilize the Electron shell release at `1.8.4` while the deployed web UI
  receives an independent Git commit revision on every web deployment.
- Add signed UI manifest schema 2 with `webRevision`-based cache identity, so
  compatible desktop installations refresh web-only commits without a new
  installer.

## 1.8.3

- Repair friend-list synchronization and make incoming/outgoing requests
  visible across web and desktop surfaces.
- Generate an invite when a private server is created and present a shared,
  copyable invite panel instead of a browser alert.
- Keep the responsive web/mobile shell aligned with the updated shared UI.

## 1.8.2

- Standardize web, desktop, and responsive mobile navigation on the shared
  workspace surface.
- Make administrator lobby renaming discoverable through a hover/focus pencil
  action while preserving server-side authorization.
- Keep the public main-guild bootstrap configuration explicit and secure.

Sürümler root `VERSION` dosyasına göre adlandırılır. Bu kayıt, belgelenmiş ve
doğrulanmış değişiklikleri özetler; planlanan işler release edilmiş sayılmaz.

## 1.8.1

- EchoVerse ana sunucusu için kalıcı üyelik ve yapılandırma tabanlı kurucu rolü.
- Tüm hesaplar için otomatik ana sunucu üyeliği; özel sunucularda davet tabanlı
  erişim korunuyor.
- Web, masaüstü ve mobil responsive yüzeyde ortak sunucu/lobi çekmecesi,
  DM/arkadaşlar erişimi ve marka uyumu.
- Arkadaşlık isteklerinde yarış durumlarına dayanıklı sunucu işlemi ve görünür
  istemci hata geri bildirimi.

## 1.8.0

- Owner ve adminlerin kalıcı ses lobisinin görünen adını değiştirebilmesi.
- Lobi adı için PostgreSQL/SQLite migration, yetki kontrolü, üye yayını ve
  web/masaüstü arayüzü.

## 1.7.4

- Mevcut ürün baseline'ı.
- Ayrıntılı tarihsel notlar [`DOCS/`](DOCS/README.md) altında tutulur.

## 1.7.5

- V2 modular-monolith çalışma alanı ve ortak paketleri.
- Protokol v2 el sıkışması, sınır doğrulama ve server güvenlik varsayılanları.
- PostgreSQL migration’ları, test/build kalite kapısı ve Playwright smoke testi.
