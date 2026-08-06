# page-can

`page-can`, Chromium tabanlı tarayıcıların yeni sekme sayfasını favoriler, yer imleri, pomodoro, odak istatistikleri ve yapılacaklarla değiştiren hafif bir Manifest V3 uzantısıdır.

## Özellikler

- İsteğe bağlı isim, favicon ve kullanıcı tanımlı klavye kısayolu içeren favori site kartları
- Son beş yer imini sabit satır ritminde gösteren liste ve aranabilir tam yer imi görünümü
- Ayarlanabilir geri sayım ve sınırsız sayaç modlarına sahip odak zamanlayıcısı
- Tarayıcı kapansa veya yeni sekme kapanmış olsa da geri sayımı sürdüren alarm/bildirim sistemi
- Haftanın en yüksek gününe göre saat çizgileri üreten, gerçek geçen süreyi kaydeden haftalık ve aylık odak istatistikleri
- Yapılacaklar ve tamamlananlar görünümleri, inline düzenleme ve tam liste ekranı
- Açık, koyu ve sistem teması
- Vurgu, yüksek kontrastlı secondary metin, kart ve isteğe bağlı border rengi
- Kart opaklığı ve blur ayarı
- Yerel fotoğraf seçme, WebP optimizasyonu, otomatik vurgu rengi, karartma, blur ve konum ayarları
- Masaüstü odaklı ve klavye erişilebilir arayüz

## Teknoloji

- WXT
- Svelte 5
- TypeScript
- Manifest V3
- Sade CSS
- `chrome.storage.sync` ve `chrome.storage.local`
- Wallpaper için IndexedDB
- Arka plan timer takibi için `chrome.alarms`

Harici font, state kütüphanesi, grafik kütüphanesi veya uzaktan çalışan kod kullanılmaz.

## Geliştirme

Gereksinim: Node.js 20 veya üzeri.

```bash
npm install
npm run dev
```

Ardından Chromium tabanlı tarayıcıda:

1. `chrome://extensions` adresini açın. Edge için `edge://extensions` kullanın.
2. **Geliştirici modu** seçeneğini etkinleştirin.
3. **Paketlenmemiş öğe yükle / Load unpacked** düğmesine basın.
4. Projedeki `.output/chrome-mv3-dev` klasörünü seçin.

WXT açıkken yapılan değişiklikler development paketine aktarılır. Manifest veya izin değişikliklerinden sonra uzantılar ekranındaki yenile düğmesini kullanın.

## Production build

```bash
npm run check
npm run build
```

Yüklenecek production klasörü:

```text
.output/chrome-mv3
```

Edge hedefi için:

```bash
npm run build:edge
```

Dağıtılabilir ZIP üretmek için:

```bash
npm run zip
```

## Veri saklama

| Veri | Saklama alanı |
| --- | --- |
| Tema ve pomodoro tercihleri | `chrome.storage.sync` |
| Favoriler, todo, timer ve istatistikler | `chrome.storage.local` |
| Optimize edilmiş wallpaper | IndexedDB |
| Tarayıcı yer imleri | Yalnızca `chrome.bookmarks` üzerinden okunur |

Wallpaper cihazdan dışarı gönderilmez. Seçilen fotoğraf en fazla 3840×2160 sınırına küçültülür, WebP olarak sıkıştırılır ve yerel IndexedDB içinde saklanır.

## Klavye kısayolları

Favori ve odak zamanlayıcısı kısayolları yeni sekme sayfası açık ve odaktayken çalışır. Yazı alanları, kontroller veya tarayıcının adres çubuğu odaktayken devreye girmez. Dinamik sayıda favoriye izin vermek için Chromium'un manifestte önceden tanımlanan global `commands` sistemi kullanılmaz.

Tek harf, Space, F1–F12 veya Alt, Ctrl, Shift ve Meta içeren bir kombinasyon kullanılabilir. Aynı kısayol iki favoriye veya hem favoriye hem odak zamanlayıcısına atanamaz.

## İzinler

- `storage`: ayarları ve uygulama verisini saklamak için
- `bookmarks`: yer imlerini listelemek için
- `alarms`: kapalı yeni sekmede pomodoro bitişini takip etmek için
- `notifications`: seans bitiş bildirimleri için
- `favicon`: favori ve yer imi ikonlarını yerel tarayıcı favicon servisiyle göstermek için

Uzantı herhangi bir web sitesi için host izni istemez.
