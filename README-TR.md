# EchoVerse — Sıfırdan Kurulum

Bu paket iki parçadan oluşur:

- `server/` = herkesin bağlandığı merkezi EchoVerse sunucusu
- `desktop/` = arkadaşlarına vereceğin Windows uygulaması

## Hedef

Arkadaşın sadece EchoVerse uygulamasını kuracak, kullanıcı adını yazacak ve Lobby'ye girecek.
Node.js, port açma, Tailscale vb. arkadaş tarafında gerekmez.

---

# A) Önce server'ı internete koy

En kolay yöntem Render / Railway / benzeri bir Node.js hosting servisidir.

Server klasörü doğrudan deploy edilmeye hazırdır.

### Ayarlar

Root / Working Directory:

`server`

Build:

`npm install`

Start:

`npm start`

Server kendi `PORT` environment variable'ını otomatik kullanır.

Deploy tamamlanınca sana buna benzer HTTPS adresi verilir:

`https://echoverse-server-xxxx.onrender.com`

Bu adresi kopyala.

---

# B) Masaüstü uygulamasına server adresini yaz

`desktop/config.json` dosyasını Not Defteri ile aç.

Örnek:

```json
{
  "serverUrl": "https://echoverse-server-xxxx.onrender.com"
}
```

Kendi adresini yazıp kaydet.

---

# C) Windows installer üret

PowerShell aç:

```powershell
cd desktop
powershell -ExecutionPolicy Bypass -File .\BUILD-WINDOWS.ps1
```

İlk sefer npm paketlerini indirir.

Başarılı olursa `desktop/release/` altında installer oluşur.

Genellikle:

`EchoVerse Setup 1.0.0.exe`

Bu installer'ı arkadaşlarına gönderebilirsin.

---

# D) Local test

Server:

```powershell
cd server
npm install
npm run dev
```

Desktop için `config.json`:

```json
{
  "serverUrl": "http://localhost:3001"
}
```

Başka terminal:

```powershell
cd desktop
npm install
npm run dev
```

---

# Özellikler

- Kullanıcı adı
- Lobby
- Online kullanıcı listesi
- Gerçek zamanlı chat
- Bot: !ping, !roll, !help
- WebRTC ses
- Echo cancellation
- Noise suppression
- Auto gain
- Mikrofon mute
- Kamera
- Ekran paylaşımı
- Electron masaüstü uygulaması
- Windows installer
- Socket.IO signaling
- Merkezi backend mimarisi

## Not

Bu sürüm MVP'dir. Küçük arkadaş grupları için WebRTC mesh kullanır.
Büyük Discord sunucuları gibi onlarca eşzamanlı ses kullanıcısı için ileride SFU (LiveKit/mediasoup) gerekir.
