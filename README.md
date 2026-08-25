# page-can

`page-can`, Chromium tabanlı tarayıcıların yeni sekme sayfasını favoriler, yer imleri, pomodoro, odak istatistikleri ve yapılacaklarla değiştiren hafif bir Manifest V3 uzantısıdır.

## Özellikler

- İsteğe bağlı isim, favicon ve kullanıcı tanımlı klavye kısayolu içeren favori site kartları
- Atanabilir kısayolla açılan, ekran ortasında blurlu 3×3 çekmece gösteren ve içindeki siteleri otomatik `1–9` tuşlarına bağlayan uygulama klasörleri
- Kullanıcının seçtiği tuş basılıyken favori, klasör, pomodoro, medya ve yapılacak kısayollarını ortak ipucu yüzeyleriyle gösterme
- Atanabilir bir kısayolla yapılacaklar girişine doğrudan odaklanma
- Son beş yer imini sabit satır ritminde gösteren liste ve aranabilir tam yer imi görünümü
- Ayarlanabilir geri sayım ve sınırsız sayaç modlarına sahip odak zamanlayıcısı
- Tarayıcı kapansa veya yeni sekme kapanmış olsa da geri sayımı sürdüren alarm/bildirim sistemi
- Sınırsız sayaç için kapanma, uyku, ekran kilidi ve ayarlanabilir hareketsizlik koruması
- Uzun sayaç oturumlarında ayarlanabilir “Hâlâ odakta mısın?” kontrolü ve otomatik duraklatma
- Otomatik duraklatılan oturumun bitiş saatini düzeltme, devam ettirme veya kaydetmeden silme
- Haftanın en yüksek gününe göre saat çizgileri üreten, gerçek geçen süreyi kaydeden haftalık ve aylık odak istatistikleri
- Aylık görünümden hatalı günlük odak toplamını düzenleme veya silme
- Yapılacaklar ve tamamlananlar görünümleri, inline düzenleme ve tam liste ekranı
- Açık, koyu ve sistem teması
- Vurgu, yüksek kontrastlı secondary metin, kart ve isteğe bağlı border rengi
- Kart opaklığı ve blur ayarı
- Yerel fotoğraf seçme, WebP optimizasyonu, otomatik vurgu rengi, karartma, blur ve konum ayarları
- Masaüstü odaklı ve klavye erişilebilir arayüz
- YouTube ve YouTube Music için kapak, takip edilebilir süre, temel oynatma denetimleri ve atanabilir kısayol

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

## Arayüz mimarisi

Arayüz iki katmana ayrılır:

- `components/ui`: davranış ve görsel sözleşmesi ortak olan temel bileşenler
- `components/<feature>`: favoriler, yer imleri, odak, istatistikler ve yapılacaklar gibi alan bileşenleri
- `styles`: yalnızca tema değişkenleri, reset ve sayfa yerleşimi

Temel bileşen kuralları:

- `Button`: yalnızca `default`, `ghost` ve `outlined` varyantlarını kullanır.
- `IconButton`: yalnızca `ghost` ve `outlined` varyantlarını kullanır. Kart içi aksiyonlar `ghost`, bağımsız aksiyonlar `outlined` olur.
- `Card`: padding, başlık, sağ üst aksiyon ve footer ritmini tek noktadan yönetir; favoriler ve saat alanı da aynı yüzey sistemini kullanır.
- `Dialog`: başlık ile subtitle'ı dikey ayraçla aynı satırda, kapatma ve varsa `Vazgeç / Kaydet` eylemlerini ortak düzende gösterir.
- `Input`: metin, URL, sayı, arama ve çok satırlı girişlerin ikon, placeholder, focus ve trailing aksiyon davranışını yönetir.
- Yapılacak ekleme ve inline düzenleme aynı `TodoTextField` bileşenini kullanır: alan içerikle birlikte en fazla dört satıra kadar büyür, metin 500 karakterle sınırlıdır, `Enter` ekler/kaydeder, `Shift+Enter` yeni satır açar, düzenlemede odak kaybı kaydeder ve `Escape` değişikliği iptal eder. Liste tek satırlı bir özet gösterir; tıklanan görev satır sonları korunarak tam metne açılır.
- `ShortcutField`: kısayol kaydetme, gösterme, açıklama ve `Kaldır` eylemini standartlaştırır.
- `ShortcutHint`: seçilen gösterme tuşu basılıyken farklı kartlardaki kısayolları aynı kompakt `<kbd>` yüzeyiyle gösterir.
- `List` ve `ListItem`: yer imi ve yapılacak satırlarının hizasını ve sağ aksiyon alanını paylaşır.
- `SegmentedToggle`: az sayıda birbirini dışlayan görünüm veya mod seçeneği için kullanılır.
- `ChoicePicker`: açıklama gerektiren birbirini dışlayan seçenekleri, ikonlu ve kolay taranabilen seçim kartları olarak sunar.

Favorilerde site, uygulama klasörü ve ekleme hücresi aynı `AppTile` bileşeninin varyantlarıdır. İsim görünürlüğü, ikon yüzeyi ve üç nokta yönetim menüsü hem ana favori kartında hem de klasör çekmecesinde bu bileşen üzerinden yönetilir. Ana favoriler ve klasör uygulamaları sürükle-bırakla veya yönetim menüsündeki taşıma eylemleriyle yeniden sıralanabilir.

Her temel bileşen kendi klasöründeki CSS dosyasından, her alan bileşeni ise kendi feature CSS dosyasından sorumludur. `entrypoints/newtab/style.css` sadece global stil katmanlarını içe aktarır; component seçicileri burada tutulmaz.

## Geliştirme

Gereksinim: Node.js 22 veya üzeri.

```bash
npm install
npm run dev
```

Ardından Chromium tabanlı tarayıcıda:

1. `chrome://extensions` adresini açın. Edge için `edge://extensions` kullanın.
2. **Geliştirici modu** seçeneğini etkinleştirin.
3. **Paketlenmemiş öğe yükle / Load unpacked** düğmesine basın.
4. Projedeki `.output/chrome-mv3-dev` klasörünü seçin.

WXT açıkken yapılan değişiklikler development paketine aktarılır. Manifest veya izin değişikliklerinden sonra uzantılar ekranındaki yenile düğmesini kullanın. Uzantı ilk kez yüklendiyse ya da yeniden yüklendiyse, önceden açık YouTube / YouTube Music sekmelerini de bir kez yenileyin; Chromium bildirime dayalı içerik betiklerini mevcut sayfaya geriye dönük olarak eklemez.

## Production build

```bash
npm test
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
| Tema, pomodoro ve medya kısayolu | `chrome.storage.sync` |
| Favoriler, aktif/tamamlanan görevler, timer ve istatistikler | `chrome.storage.local` |
| Optimize edilmiş wallpaper | IndexedDB |
| Tarayıcı yer imleri | Yalnızca `chrome.bookmarks` üzerinden okunur |

Wallpaper cihazdan dışarı gönderilmez. Seçilen fotoğraf en fazla 3840×2160 sınırına küçültülür, WebP olarak sıkıştırılır ve yerel IndexedDB içinde saklanır.

Yeni sekme açılışında yalnızca son beş yer imi, aktif görevler ve haftalık istatistik görünümü hazırlanır. Tüm yer imleri, tamamlanan görevler ve aylık istatistikler ilgili detay ekranı açıldığında yüklenir. Eski tek-listeli todo verisi ilk açılışta aktif ve tamamlanan listelere otomatik taşınır.

## Klavye kısayolları

Favori, odak zamanlayıcısı ve medya kısayolları yeni sekme sayfası açık ve odaktayken çalışır. Yazı alanları, kontroller veya tarayıcının adres çubuğu odaktayken devreye girmez. Dinamik sayıda favoriye izin vermek için Chromium'un manifestte önceden tanımlanan global `commands` sistemi kullanılmaz.

Tek harf, Space, F1–F12 veya Alt, Ctrl, Shift ve Meta içeren bir kombinasyon kullanılabilir. Aynı kısayol favori, odak zamanlayıcısı ve medya denetimi arasında tekrar kullanılamaz.

## İzinler

- `storage`: ayarları ve uygulama verisini saklamak için
- `bookmarks`: yer imlerini listelemek için
- `alarms`: kapalı yeni sekmede pomodoro bitişini takip etmek için
- `notifications`: seans bitiş bildirimleri için
- `idle`: yalnızca cihazın aktif, hareketsiz veya kilitli durumunu görüp açık unutulan sayacı duraklatmak için
- `favicon`: favori ve yer imi ikonlarını yerel tarayıcı favicon servisiyle göstermek için
- `scripting`: YouTube medya içerik bağlantısı kaybolduğunda yalnızca izinli YouTube sekmesine yeniden bağlanmak için

Medya denetimi içerik betiği yalnızca `www.youtube.com` ve `music.youtube.com` sayfalarında çalışır. Uzantı diğer web sitelerine erişim istemez.
