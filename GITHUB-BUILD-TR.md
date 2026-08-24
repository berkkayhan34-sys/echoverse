# GitHub ile Windows + macOS otomatik build

Bu sürüm GitHub Actions ile üç çıktı üretir:

- EchoVerse Windows Setup `.exe`
- EchoVerse macOS Intel `.dmg`
- EchoVerse macOS Apple Silicon `.dmg`

## Önemli

`desktop/config.json` içindeki `serverUrl` gerçek Render adresiniz olmalıdır.

Örnek:

```json
{
  "serverUrl": "https://echoverse-c3d5.onrender.com"
}
```

## GitHub reposunda gerekli yapı

```text
echoverse/
├── .github/
│   └── workflows/
│       └── build-desktop.yml
├── desktop/
├── server/
└── README-TR.md
```

## Actions'tan indirme

Kodları `main` branch'e gönderdiğinizde GitHub Actions otomatik başlar.

GitHub:
`Actions` → `Build EchoVerse Desktop` → en son başarılı run

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
