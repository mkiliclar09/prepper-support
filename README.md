# Prepper Support

Yalnızca sizin davet ettiğiniz kişilerin kullanabildiği kapalı mesajlaşma ve arama uygulaması. Grup sohbeti, birebir mesaj, fotoğraf, dosya, sesli mesaj, sesli ve görüntülü arama içerir. Telefona uygulama gibi kurulur (Android ve iPhone).

İnternet kısa süre kesilirse yazdığınız mesajlar telefonda sıraya alınır ve bağlantı gelince kendiliğinden gönderilir. Uygulama internetsiz de açılır ve eski mesajlar okunabilir.

## Klasör yapısı

| Yol | Ne işe yarar |
|---|---|
| `docs/` | Uygulamanın kendisi (GitHub Pages bu klasörü yayınlar) |
| `docs/config.js` | Firebase bilgileri, kalıcı yönetici, arama sunucusu (TURN) |
| `firestore.rules` | Veritabanı güvenlik kuralları |
| `firebase.json` | İleride Firebase Hosting'e geçmek isterseniz kullanılır |

## Önce deneyin (demo modu)

`config.js` içindeki `apiKey` boşken uygulama demo modunda açılır. Bir kişi seçip girersiniz. Aynı tarayıcıda ikinci bir sekme açıp başka bir kişi seçerseniz iki kişi gibi mesajlaşıp arayabilirsiniz. Demo verileri yalnızca o tarayıcıda durur.

## Kurulum (program kurmadan, yalnızca tarayıcıdan)

### 1. Firebase projesini açın
1. [console.firebase.google.com](https://console.firebase.google.com) → **Proje ekle** → ad: `prepper-support` (Google Analytics gerekmez).
2. **Build → Authentication → Get started** → **Sign-in method**: **Google** ve **E-posta/Şifre**'yi açın.
3. **Build → Firestore Database → Create database** → konum: `eur3 (europe-west)` → **production mode**.
4. **Firestore → Rules** sekmesi → içindekini silin, `firestore.rules` dosyasının tamamını yapıştırın → **Publish**.
5. **Proje ayarları (⚙) → Genel → Uygulamalarınız → Web (</>)** → ad: `prepper-web` → kaydedin. Çıkan `firebaseConfig` bilgilerini `docs/config.js` içine yazın.

> Ücretsiz Spark planı yeterlidir. Dosyalar Firestore içinde tutulur, ayrıca Storage gerekmez.

### 2. Kalıcı yöneticiyi kontrol edin
`docs/config.js` içindeki `BOOT_ADMINS` ile `firestore.rules` içindeki iki e-posta listesi aynı olmalı. Şu an ikisinde de `mustafakiliclar90@gmail.com` yazıyor.

### 3. GitHub'a yükleyin
1. github.com → **New repository** → ad: `prepper-support` → **Public** → Create.
2. **Add file → Upload files** → bu klasördeki her şeyi (docs klasörü dahil) sürükleyip bırakın → **Commit changes**.
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: **main**, klasör: **/docs** → **Save**.
4. 1–2 dakika sonra adres: `https://KULLANICI-ADINIZ.github.io/prepper-support/`

### 4. Site adresini Firebase'e tanıtın
**Authentication → Settings → Authorized domains → Add domain** → `KULLANICI-ADINIZ.github.io`

### 5. Arama sunucusu (TURN)
Mobil veride ve bazı şirket ağlarında aramaların bağlanması için gerekir.
1. [metered.ca](https://www.metered.ca) → ücretsiz hesap → **TURN Server** → bir uygulama oluşturun.
2. **Credentials** bölümünden bir kimlik oluşturun; size bir `apiKey` verir.
3. `docs/config.js` içinde `TURN_URL` değerine şunu yazın:
   `https://UYGULAMA-ADINIZ.metered.live/api/v1/turn/credentials?apiKey=API-ANAHTARINIZ`

Ücretsiz kotayı ve fiyatları metered.ca/pricing sayfasından kontrol edin. Arama verisi yalnızca doğrudan bağlantı kurulamadığında bu sunucudan geçer.

### 6. Dışarıdan kaydı kapatın (önemli)
**Authentication → Settings → User actions** → **Enable create (sign-up)** kutusunun işaretini kaldırın → **Save**.
Böylece hesabı yalnızca siz açabilirsiniz. E-posta doğrulaması bu yüzden istenmez.

### 7. Kişileri ve grupları ekleme
1. **Firebase → Authentication → Users → Add user**: her kişi için e-posta ve şifre belirleyin. Şifreyi kişiye iletin.
2. **Uygulamada** sağ üstteki **kişiler** simgesi → **Kişiler** sekmesi → ad soyad, aynı e-posta ve rol → **Ekle**.
3. **Gruplar** sekmesi → grup adını yazıp **Grup oluştur** → grubun altında üyeleri işaretleyin.
4. **Kaydet**.

Görünürlük kuralları:
- Herkes yalnızca kendi gruplarını ve bu gruplardaki kişileri görür; yalnızca onlarla yazışıp arama yapabilir.
- Yöneticiler herkesi görür ve herkese görünür. Yönetici bir grubun mesajlarını görmek istiyorsa o gruba üye olarak işaretlenmelidir.
- "Tüm üyeler" grubu yoktur.
- Bir kişiyi gruba sonradan eklerseniz o andan sonraki mesajları görür; eski mesajlar ona açılmaz. Gruptan çıkarılan kişi yeni mesajları görmez.
- Firebase'de hesabı olup listede olmayan biri "Erişim izni bekleniyor" ekranında kalır.

### 8. Telefona kurulum
- **Android (Chrome):** siteyi açın → menü (⋮) → **Uygulamayı yükle**.
- **iPhone (Safari):** siteyi açın → Paylaş → **Ana Ekrana Ekle**.

## Güncelleme
Değişen dosyaları GitHub'da aynı yere tekrar yükleyin. Telefonlar yeni sürümü sonraki açılışta alır. Kabuğu tamamen yenilemek için `docs/sw.js` içindeki `prepper-v1` değerini artırın.

## Bilinen sınırlar (bu sürüm)
- Bildirimler uygulama açıkken veya arka planda açık dururken gelir. Uygulama tamamen kapalıyken bildirim için Firebase Blaze planı ve sunucu fonksiyonu gerekir.
- iPhone'da ana ekrandan açılan uygulamada Google penceresi açılmazsa e-posta/şifre ile giriş yapın.
- Arama ve ilk giriş için internet gerekir. İnternetin tamamen gittiği durum için ikinci aşamada yerel uygulama ve telefonlar arası (Bluetooth / Wi-Fi / LoRa) katman eklenecek.
