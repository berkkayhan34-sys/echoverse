<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# GitHub ile Windows + macOS otomatik build

Bu depo yapısında GitHub Actions ile üç çıktı üretilir:

- EchoVerse Windows Setup `.exe`
- EchoVerse macOS Intel `.dmg`
- EchoVerse macOS Apple Silicon `.dmg`

## Önemli

`project/apps/desktop/config.json` içindeki `serverUrl`, onaylanmış HTTPS sunucu
adresiniz olmalıdır. Bu kurulumda adres `https://echoverse.borayarkin.net`'dir.
Dokümana gerçek token, cookie veya gizli environment değeri
eklemeyin.

Örnek:

```json
{
  "serverUrl": "https://echoverse.borayarkin.net"
}
```

## GitHub reposunda gerekli yapı

```text
echoverse/
├── .github/
│   └── workflows/
│       └── build-desktop.yml
├── project/apps/
│   ├── desktop/
│   ├── server/
│   └── web/
├── project/packages/
├── DOCS/
└── README-TR.md
```

`project/apps/server/render.yaml` Render için yetkili deployment manifestidir.
`project/render.yaml` yalnızca uyumluluk/discovery mirror'ıdır; iki ayrı deployment
kaynağı olarak yönetilmez.

## Actions'tan indirme

Kodları `main` branch'e gönderdiğinizde GitHub Actions otomatik başlar.

GitHub:
`Actions` → `Build EchoVerse Desktop` → en son başarılı run.

Workflow'lar güncel `project/apps/desktop/` yolunu kullanır. Windows testi için
`Test Windows Build`, yayın akışı için `Release EchoVerse` workflow'u
kullanılır. Workflow'lar Node.js 22 LTS ile root dizinde tek canonical
`npm ci` kurulumu yapar; build komutları daha sonra ilgili workspace içinden
çalışır.

Yerel `dist:*` ve `release:*` script'leri yayınlamaz (`--publish never`). GitHub
Release yalnızca açıkça onaylanmış tag ve başarılı doğrulama kapılarından sonra
yayınlar.

Sayfanın altındaki Artifacts bölümünde:

- `EchoVerse-Windows`
- `EchoVerse-macOS-Intel`
- `EchoVerse-macOS-Apple-Silicon`

çıkar.

MacBook M1/M2/M3/M4/M5 vb. ise Apple Silicon sürümünü kullanın.
Eski Intel MacBook ise Intel sürümünü kullanın.

## macOS güvenlik uyarısı

Bu build Apple Developer sertifikasıyla imzalanmış/notarize edilmiş değildir.
Bu nedenle macOS ilk açılışta geliştirici doğrulanamadı uyarısı verebilir.

Kullanıcı:
System Settings → Privacy & Security → Open Anyway

yoluyla açabilir.

Gerçek dağıtım için ileride Apple Developer hesabı + code signing + notarization eklenmelidir.
