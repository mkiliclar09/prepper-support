// Prepper Support — çevrim dışı kabuk
// Uygulama dosyaları ve Firebase kütüphaneleri telefonda saklanır; internet yokken de uygulama açılır.
const CACHE = "prepper-v3";
const SHELL = ["./", "index.html", "styles.css?v=3", "app.js?v=3", "config.js", "backend-firebase.js", "backend-demo.js", "model.js", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/favicon.png"];

self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  const u = new URL(r.url);
  // Firebase kütüphaneleri sürüm numaralı ve değişmez: önce önbellek
  if (u.hostname === "www.gstatic.com" && u.pathname.startsWith("/firebasejs/")) {
    e.respondWith(caches.match(r).then(hit => hit || fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })));
    return;
  }
  if (u.origin !== location.origin) return;
  // Uygulama dosyaları: önce ağ (güncel sürüm), yoksa önbellek
  e.respondWith(fetch(r).then(res => { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)); } return res; })
    .catch(() => caches.match(r, { ignoreSearch: r.mode === "navigate" }).then(hit => hit || caches.match("index.html"))));
});

self.addEventListener("notificationclick", e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => { const w = ws[0]; if (w) return w.focus(); return self.clients.openWindow("./"); }));
});
