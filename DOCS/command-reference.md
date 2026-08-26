<!--
SPDX-FileCopyrightText: 2026 EchoVerse contributors
SPDX-License-Identifier: GPL-3.0-only
-->

# Codex komut referansı

Bu dosya, Codex’e verilecek kısa komutların ne anlama geldiğini ve hangi
aksiyonun alınacağını özetler. Bir komut açıkça belirtilmedikçe dış sistemlere
push, release veya deploy yapılmaz.

| Komut | Amaç | Alınan aksiyon |
| --- | --- | --- |
| `kontrol et` / `incele` | Mevcut durumu görmek | Dosyalar, Git durumu, testler veya dashboard salt-okunur incelenir; değişiklik yapılmaz. |
| `hiçbir şey yapma` | İşlemi durdurmak | Araç çağrısı, dosya değişikliği ve dış aksiyon yapılmaz. |
| `implemente et` | Sıradaki işi uygulamak | Roadmap’teki ilk aktif child izlenir; gerekli kod/dokümantasyon/test değişiklikleri yapılır, doğrulama çalıştırılır. Commit veya push yapılmaz. |
| `commitle` | Yerel Git kaydı oluşturmak | Tam diff, secret ve generated dosya kontrol edilir; uygun değişiklikler stage edilip commitlenir. Push yapılmaz. |
| `implemente et ve commitle` | Uygulama ve yerel kayıt | Önce implementasyon ve testler tamamlanır, sonra güvenli diff incelenerek commit oluşturulur. Push yapılmaz. |
| `pushla` | Remote branch’i güncellemek | Onaylanan commit remote branch’e pushlanır; push sonucu ve commit doğrulanır. Release/deploy otomatik olarak yapılmaz. |
| `release oluştur` | Sürüm yayınlamak | `VERSION`, package mirror’ları, tag, artifact, checksum ve workflow sonuçları doğrulanır; onaylı tag/release oluşturulur. |
| `deploy et` / `Render’ı güncelle` | Hosted servisi güncellemek | İlgili commit deploy edilir veya auto-deploy doğrulanır; build logları, servis durumu ve `/health` kontrol edilir. |
| `test et` | Davranışı doğrulamak | İlgili unit, integration, contract, E2E, security ve build kontrolleri çalıştırılır; test başarısızsa workaround yapılmaz. |
| `compile et` | Dağıtılabilir çıktı üretmek | İlgili platform build/release hedefi çalıştırılır; sürüm, artifact adı ve checksum kontrol edilir. |
| `yüklenebilir dosyayı masaüstüne at` | Installer’ı yerel olarak teslim etmek | Doğrulanmış installer açıkça belirtilen masaüstü konumuna kopyalanır; kaynak ve hedef checksum karşılaştırılır. |
| `Render’ı kontrol et` / `GitHub Actions’ı kontrol et` | Hosted sonucu görmek | Dashboard ve workflow sonuçları salt-okunur incelenir; gerekli job, log ve canlılık durumu raporlanır. |
| `sil` / `temizle` | Dosya veya çıktı kaldırmak | Hedef, geri alınabilirlik ve backup önce belirlenir; destructive işlem için ayrıca onay istenir. |
| `roadmap’i güncelle` | Planı değiştirmek | Child sırası, status/checkbox/evidence kuralları korunarak yalnızca dokümantasyon güncellenir. |

## Sabit kurallar

- `pushla` yalnızca GitHub remote değişikliğidir; release ve deploy ayrı komutlardır.
- Release veya deploy öncesinde test, security scan, version ve artifact kontrolleri geçmelidir.
- İlk aktif roadmap child’ı tamamlanmadan sonraki child’a geçilmez.
- Secret, kişisel veri, generated çıktı veya geçici dosya commitlenmez.
- Destructive işlemler backup ve açık onay olmadan yapılmaz.
