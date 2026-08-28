<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Changelog

Sürümler root `VERSION` dosyasına göre adlandırılır. Bu kayıt, belgelenmiş ve
doğrulanmış değişiklikleri özetler; planlanan işler release edilmiş sayılmaz.

## Unreleased

- Dokümantasyon ve repo yönetişimi temeli hazırlanıyor.
- Runtime davranış değişikliği bu fazın kapsamı dışındadır.

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
