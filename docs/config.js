// Prepper Support — ayarlar
// Bu bilgiler gizli değildir; veriyi koruyan firestore.rules dosyasıdır.

// 1) Firebase proje bilgileri. Firebase Console → Proje ayarları → Uygulamalarınız → Web uygulaması → "SDK yapılandırması".
//    apiKey boş bırakılırsa uygulama DEMO modunda açılır (veriler yalnızca bu tarayıcıda tutulur).
export const firebaseConfig = {
  apiKey: "AIzaSyCX6E_fbLqyWmzG_vT5Peutj1ehkcLQ6fk",
  authDomain: "prepper-support.firebaseapp.com",
  projectId: "prepper-support",
  storageBucket: "prepper-support.firebasestorage.app",
  messagingSenderId: "304588178918",
  appId: "1:304588178918:web:f459d8c7f7f53d3d634227"
};

// 2) Her zaman yönetici olan hesaplar. firestore.rules içindeki isBoot() listesiyle AYNI olmalı.
export const BOOT_ADMINS = ["mustafakiliclar90@gmail.com"];

// 3) Arama sunucusu (TURN). Mobil veride ve bazı şirket ağlarında aramaların bağlanması için gerekir.
//    Metered.ca kullanıyorsanız panelden aldığınız adresi yazın, örnek:
//    "https://UYGULAMA-ADINIZ.metered.live/api/v1/turn/credentials?apiKey=API-ANAHTARINIZ"
export const TURN_URL = "";

//    Ya da kendi sunucunuzun bilgilerini doğrudan yazın, örnek:
//    [{ urls: "turn:sunucu.ornek.com:3478", username: "kullanici", credential: "sifre" }]
export const EXTRA_ICE = [];
