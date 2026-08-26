<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# EchoVerse

EchoVerse, web ve Electron istemcileri olan gerçek zamanlı bir iletişim
uygulamasıdır. Bu depo şu anda **1.7.5** sürümündedir; canonical sürüm
[`VERSION`](VERSION) dosyasındadır.

## Dokümantasyon giriş noktası

Kalıcı kararlar ve kurallar [`DOCS/`](DOCS/README.md) altında tutulur:

- [Mimari ve sınırlar](DOCS/architecture.md)
- [Hedef repo yapısı](DOCS/architecture/repository-structure.md)
- [Güvenlik politikası](DOCS/security-policy.md)
- [Test ve kalite politikası](DOCS/testing-policy.md)
- [Geliştirme akışı](DOCS/development.md)
- [Release akışı](DOCS/release.md)
- [Roadmap](DOCS/roadmap.md)
- [Kararlar](DOCS/decisions/README.md)
- [Katkı rehberi](.github/CONTRIBUTING.md)
- [Güvenlik bildirimi](.github/SECURITY.md)

`DOCS/` klasörü canonical dokümantasyon ve tarihsel sürüm notlarını içerir.
Yeni politika ve kararlar bu klasörün köküne veya altındaki ilgili bölüme
eklenir. Agent/LLM çalışma kuralları için
[`AGENTS.md`](AGENTS.md) dosyasını okuyun.

## Mevcut çalışma alanları

- `apps/server/` — merkezi HTTP ve Socket.IO backend'i;
- `apps/web/` — tarayıcı istemcisi;
- `apps/desktop/` — Electron uygulaması ve installer akışı;
- `packages/` — protokol sözleşmeleri, istemci çekirdeği, ortak arayüz ve yapılandırma;
- `DOCS/` — mimari, güvenlik, test, release ve karar kayıtları;

`apps/` ve `packages/` altındaki modular monolith v2 cutover'ı uygulanmıştır.
Protokol sürümü 2'dir; server ve istemciler birlikte güncellenmelidir.

## Yerel geliştirme

Her çalışma alanının kendi README'sini ve `package.json` script'lerini okuyun.
Tipik akış:

```powershell
cd apps/server
npm run dev
```

Başka bir terminalde web veya desktop çalışma alanını kendi script'iyle
başlatın. Yerel ayarlarda yalnızca örnek değerler kullanın; token, cookie,
gerçek veritabanı URL'si ve imzalama anahtarı commit edilmez. Ayrıntılı akış
için [development.md](DOCS/development.md) belgesine bakın.

Root `Makefile` içindeki `make setup` bağımlılıkları, `make quality` statik/test
kapısını, `make ai-server-test` çalışan local server health kontrolünü, `make
release-check` ise release metadata kontrolünü yapar. Tüm hedefler için
`make help` kullanın.

## Lisans

EchoVerse, ek istisna olmaksızın **GPL-3.0-only** ile lisanslanır. SPDX
başlıkları ve `REUSE.toml` kuralları lisansın makine tarafından doğrulanmasını
sağlar. Bkz. [`LICENSE`](LICENSE) ve [`REUSE.toml`](REUSE.toml).

## Durum ve sınırlar

Uygulama v2 çalışma alanına taşınmış ve temel test/build kapıları eklenmiştir.
Feature bazlı yetkilendirme, SQLite adapter'ı, WebRTC regresyonları ve installer
smoke kontrolleri release öncesi takip işidir; kapsamı [testing policy](DOCS/testing-policy.md)
ve [roadmap](DOCS/roadmap.md) içinde tanımlıdır.
