<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Changelog

## Unreleased

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
