// Prepper Support — yalnızca davetli kişilerin kullandığı kapalı mesajlaşma ve arama uygulaması
import { firebaseConfig, BOOT_ADMINS, TURN_URL, EXTRA_ICE } from "./config.js";
import { normalize, buildDir, newGroupId } from "./model.js";

/* ================= yardımcılar ================= */
const $ = s => document.querySelector(s);
const lower = s => String(s || "").trim().toLowerCase();
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const initials = n => { const p = String(n || "?").trim().split(/\s+/).filter(Boolean); return ((p[0] || "?")[0] + (p.length > 1 ? p[p.length - 1][0] : "")).toLocaleUpperCase("tr"); };
const PAL = ["#c2632f", "#4f7a3a", "#2f6f8f", "#8a4f9c", "#a3462f", "#3f7f6f", "#7a6a2f", "#5a5fa8", "#9c4f6b", "#2f8a5a"];
const colorOf = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PAL[h % PAL.length]; };
const fmtSec = s => Math.floor((s || 0) / 60) + ":" + String(Math.round(s || 0) % 60).padStart(2, "0");
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const hhmm = ts => new Date(ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); };
function dayLabel(ts) {
  const t = new Date(); t.setHours(0, 0, 0, 0); const d = new Date(ts); d.setHours(0, 0, 0, 0);
  const diff = Math.round((t - d) / 864e5);
  return diff === 0 ? "Bugün" : diff === 1 ? "Dün" : d.toLocaleDateString("tr-TR");
}
const shortWhen = ts => dayLabel(ts) === "Bugün" ? hhmm(ts) : dayLabel(ts);
let toastT;
function toast(msg, ms = 3800) { const t = $("#toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, ms); }
const ERR = {
  "permission-denied": "Bu işlem için yetkiniz yok.",
  "auth/invalid-credential": "E-posta veya şifre hatalı.", "auth/wrong-password": "E-posta veya şifre hatalı.", "auth/user-not-found": "Bu e-postayla kayıtlı hesap yok.",
  "auth/email-already-in-use": "Bu e-postayla zaten bir hesap var. Giriş yapın.", "auth/weak-password": "Şifre en az 6 karakter olmalı.",
  "auth/invalid-email": "E-posta adresi geçersiz.", "auth/too-many-requests": "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.",
  "auth/network-request-failed": "İnternet bağlantısı yok.", "auth/popup-closed-by-user": "Google penceresi kapatıldı.", "auth/unauthorized-domain": "Bu site adresi Firebase'de yetkili değil (Authentication → Settings → Authorized domains).",
  "unavailable": "Sunucuya ulaşılamıyor. Bağlantı gelince tekrar denenecek."
};
const errText = e => ERR[e && e.code] || (e && e.message) || String(e);
const ICON = {
  audio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="6" width="13" height="12" rx="2"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/></svg>',
  clip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/></svg>',
  out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M9 16l-4-4 4-4M5 12h11"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  end: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 9c-3.3 0-6.4.9-8.9 2.6-.7.5-.9 1.4-.5 2.1l1.2 2c.4.7 1.3.9 2 .6l2.6-1.2c.5-.2.8-.8.8-1.3v-2c1.8-.5 3.8-.5 5.6 0v2c0 .5.3 1.1.8 1.3l2.6 1.2c.7.3 1.6.1 2-.6l1.2-2c.4-.7.2-1.6-.5-2.1C18.4 9.9 15.3 9 12 9z"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h11l-3-3M20 16H9l3 3"/></svg>'
};

/* ================= durum ================= */
const DEMO = !firebaseConfig.apiKey || new URLSearchParams(location.search).has("demo");
const BOOT = DEMO ? [] : BOOT_ADMINS.map(lower);
const ST = { api: null, me: null, access: null, dir: null, view: null, msgs: new Map(), reads: {}, peer: null, online: navigator.onLine, unsubs: [], accessUnsub: null, dirUnsub: null, sig: "", readTimer: null };
const isDesktop = () => innerWidth > 820;
// ST.view: { name, role, groups:[{id,name,members}], contacts:{eposta:{name,role}} }
const myRole = () => BOOT.includes(ST.me.email) ? "admin" : (ST.view ? ST.view.role : null);
const isAdmin = () => myRole() === "admin";
const isGroup = p => typeof p === "string" && p.startsWith("g:");
const groupOf = p => ST.view && ST.view.groups.find(g => "g:" + g.id === p);
function nameOf(email) {
  email = lower(email);
  if (isGroup(email)) { const g = groupOf(email); return g ? g.name : "Grup"; }
  if (ST.view && ST.view.contacts[email]) return ST.view.contacts[email].name;
  if (ST.access && ST.access.members[email]) return ST.access.members[email].name;
  if (ST.me && email === ST.me.email) return ST.me.name || email;
  for (const m of ST.msgs.values()) if (lower(m.from) === email && m.fromName) return m.fromName;
  return email;
}
const safeKey = s => s.replace(/[^a-z0-9_]/g, "_");
const dmKey = (a, b) => "dm_" + safeKey([lower(a), lower(b)].sort().join("__"));
const keyOfPeer = p => isGroup(p) ? p : dmKey(ST.me.email, p);
const convOf = m => isGroup(m.to) ? m.to : dmKey(m.from, m.to);
const peerOf = m => isGroup(m.to) ? m.to : (lower(m.from) === ST.me.email ? lower(m.to) : lower(m.from));
const convMsgs = key => [...ST.msgs.values()].filter(m => convOf(m) === key).sort((a, b) => (a.at || 0) - (b.at || 0));
const unreadOf = key => { const r = ST.reads[key] || 0; let n = 0; for (const m of ST.msgs.values()) if (convOf(m) === key && lower(m.from) !== ST.me.email && (m.at || 0) > r) n++; return n; };
const pendingCount = () => { let n = 0; for (const m of ST.msgs.values()) if (m._pending) n++; return n; };
function msgText(m) {
  if (m.call) { const c = m.call, k = c.type === "video" ? "görüntülü arama" : "sesli arama";
    return c.st === "answered" ? (c.type === "video" ? "Görüntülü" : "Sesli") + " arama · " + fmtSec(c.dur) : c.st === "rejected" ? "Reddedilen " + k : c.st === "busy" ? "Meşgul · " + k : "Cevapsız " + k; }
  if (!m.att) return m.text || "";
  const a = m.att, k = (a.type || "").startsWith("image/") ? "Fotoğraf" : (a.type || "").startsWith("audio/") ? "Sesli mesaj (" + fmtSec(a.dur) + ")" : "Dosya: " + a.name;
  return m.text ? k + " · " + m.text : k;
}

/* ================= başlangıç ================= */
(async function boot() {
  try {
    const mod = DEMO ? await import("./backend-demo.js") : await import("./backend-firebase.js");
    ST.api = await mod.createBackend(firebaseConfig);
  } catch (e) {
    $("#root").innerHTML = `<div class="gate"><div class="card"><h1>Uygulama açılamadı</h1><p>${esc(navigator.onLine ? "Firebase'e bağlanılamadı: " + (e.message || e) : "İlk açılış için internet gerekiyor. Bağlantı gelince sayfayı yenileyin.")}</p><button class="btn" onclick="location.reload()">Yenile</button></div></div>`;
    return;
  }
  ST.api.onWriteError = e => toast(e.code === "permission-denied" ? "Gönderilemedi: bu işlem için yetkiniz yok." : "Gönderilemedi: " + errText(e));
  ST.api.onAuth(onUser);
  addEventListener("online", () => { ST.online = true; paintNet(); });
  addEventListener("offline", () => { ST.online = false; paintNet(); });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  document.addEventListener("visibilitychange", () => { if (!document.hidden) markReadSoon(); });
  addEventListener("popstate", () => { if (!isDesktop() && ST.peer && $("#split")) closeThread(true); });
})();

function stopData() { ST.unsubs.forEach(u => { try { u(); } catch (e) {} }); ST.unsubs = []; if (ST.accessUnsub) { ST.accessUnsub(); ST.accessUnsub = null; } if (ST.dirUnsub) { ST.dirUnsub(); ST.dirUnsub = null; } ST.msgs.clear(); ST.reads = {}; ST.access = null; ST.dir = null; ST.view = null; ST.sig = ""; }

function onUser(u) {
  stopData();
  ST.me = u;
  if (!u) return renderLogin();
  // Hesapları yönetici Firebase Console'dan açar; e-posta doğrulaması istenmez.
  ST.me.name = u.name || u.email;
  watchDir();
  if (BOOT.includes(u.email)) watchAccess();
}
// Herkes kendi rehberini okur; yöneticiler ayrıca tüm listeyi izler.
function watchDir() {
  ST.dirUnsub = ST.api.watchDir(ST.me.email, d => {
    ST.dir = d;
    if (d && d.role === "admin" && !ST.accessUnsub) watchAccess();
    if (d && d.role !== "admin" && ST.accessUnsub && !BOOT.includes(ST.me.email)) { ST.accessUnsub(); ST.accessUnsub = null; ST.access = null; }
    refreshView();
  }, e => toast("Rehber okunamadı: " + errText(e)));
}
function watchAccess() {
  ST.accessUnsub = ST.api.watchAccess(a => { ST.access = normalize(a, BOOT); refreshView(); },
    e => { if (!(e && e.code === "permission-denied")) toast("Kişi listesi okunamadı: " + errText(e)); });
}
function refreshView() {
  const adminView = ST.access && (BOOT.includes(ST.me.email) || (ST.dir && ST.dir.role === "admin"));
  ST.view = adminView ? buildDir(ST.access, ST.me.email) : ST.dir;
  if (!ST.view) { if (!BOOT.includes(ST.me.email) || ST.access) renderWait(); return; }
  if (ST.view.name) ST.me.name = ST.view.name;
  if (ST.peer && !isGroup(ST.peer) && !ST.view.contacts[ST.peer] && !convMsgs(keyOfPeer(ST.peer)).length) ST.peer = null;
  if (ST.peer && isGroup(ST.peer) && !groupOf(ST.peer)) ST.peer = null;
  if (!$("#app")) startApp();
  else { const ab = $("#adminBtn"); if (!!ab !== isAdmin()) { $("#app").remove(); startApp(); return; } ST.sig = ""; renderConvs(); renderThread(); paintSplit(); }
}

/* ================= giriş ekranları ================= */
function gate(inner) { $("#root").innerHTML = `<div class="gate"><div class="card"><div class="logo"><img src="icons/icon-192.png" alt="" width="56" height="56"><div><b>Prepper Support</b><small>Kapalı ekip mesajlaşması</small></div></div>${inner}</div></div>`; }
function renderLogin(mode = "in") {
  if (DEMO) {
    const ppl = ST.api.demoPeople();
    gate(`<h1>Demo modu</h1><p class="muted">Firebase ayarları henüz girilmedi. Bir kişi seçerek uygulamayı deneyin. Başka bir sekmede farklı bir kişi seçerseniz iki kişi gibi mesajlaşıp arayabilirsiniz.</p>
      <div class="demo-ppl">${ppl.map(p => `<button class="pick" data-e="${esc(p.email)}"><span class="av" style="--c:${colorOf(p.name)}">${esc(initials(p.name))}</span>${esc(p.name)}</button>`).join("")}</div>
      <button class="linkbtn" id="dReset" type="button">Demo verilerini sıfırla</button>`);
    document.querySelectorAll(".pick").forEach(b => b.onclick = () => ST.api.demoLogin(b.dataset.e));
    $("#dReset").onclick = () => { ST.api.demoReset(); toast("Demo verileri sıfırlandı"); };
    return;
  }
  const up = mode === "up";
  gate(`<h1>${up ? "Hesap oluştur" : "Giriş yap"}</h1>
    <p class="muted">Yalnızca yöneticinin davet ettiği kişiler girebilir.</p>
    <button class="btn google" id="gBtn" type="button"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 01-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.5z"/><path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.4 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11.5 11.5 0 0012 23.5z"/><path fill="#FBBC05" d="M5.6 14.2a6.9 6.9 0 010-4.4v-3H1.8a11.5 11.5 0 000 10.4z"/><path fill="#EA4335" d="M12 4.9c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 001.8 6.8l3.8 3C6.5 7 9 4.9 12 4.9z"/></svg>Google ile devam et</button>
    <div class="or"><span>veya e-posta ve şifre ile</span></div>
    <form id="fAuth" class="form">
      ${up ? '<label>Ad Soyad<input id="fName" autocomplete="name" required maxlength="60"></label>' : ""}
      <label>E-posta<input id="fMail" type="email" autocomplete="email" required></label>
      <label>Şifre<input id="fPass" type="password" autocomplete="${up ? "new-password" : "current-password"}" required minlength="6"></label>
      <button class="btn" type="submit">${up ? "Hesap oluştur" : "Giriş yap"}</button>
    </form>
    <div class="row-links"><button class="linkbtn" id="forgot" type="button">Şifremi unuttum</button></div>
    <p class="muted small">Hesabınızı yönetici açar. Size verilen e-posta ve şifreyle giriş yapın.</p>`);
  $("#gBtn").onclick = async () => { try { await ST.api.loginGoogle(); } catch (e) { toast(errText(e)); } };
  $("#fAuth").onsubmit = async e => {
    e.preventDefault(); const b = e.submitter; b.disabled = true;
    try { if (up) { await ST.api.register($("#fName").value.trim(), $("#fMail").value, $("#fPass").value); toast("Doğrulama e-postası gönderildi."); } else await ST.api.loginEmail($("#fMail").value, $("#fPass").value); }
    catch (er) { toast(errText(er)); b.disabled = false; }
  };
  const L = (id, fn) => { const x = $("#" + id); if (x) x.onclick = fn; };
  L("toUp", () => renderLogin("up")); L("toIn", () => renderLogin("in"));
  L("forgot", async () => { const m = $("#fMail").value; if (!m) { toast("Önce e-posta adresinizi yazın."); $("#fMail").focus(); return; } try { await ST.api.resetPassword(m); toast("Şifre sıfırlama bağlantısı gönderildi."); } catch (e) { toast(errText(e)); } });
}
function renderVerify() {
  gate(`<h1>E-postanızı doğrulayın</h1><p class="muted"><b>${esc(ST.me.email)}</b> adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıkladıktan sonra aşağıdaki düğmeye basın. Gelen kutusunda yoksa istenmeyen klasörüne bakın.</p>
    <button class="btn" id="vDone" type="button">Doğruladım</button>
    <div class="row-links"><button class="linkbtn" id="vSend" type="button">Bağlantıyı tekrar gönder</button><button class="linkbtn" id="vOut" type="button">Çıkış yap</button></div>`);
  $("#vDone").onclick = async () => { try { const u = await ST.api.reloadUser(); if (u && u.verified) onUser(u); else toast("Henüz doğrulanmamış görünüyor."); } catch (e) { toast(errText(e)); } };
  $("#vSend").onclick = async () => { try { await ST.api.resendVerify(); toast("Bağlantı tekrar gönderildi."); } catch (e) { toast(errText(e)); } };
  $("#vOut").onclick = () => ST.api.logout();
}
function renderWait() {
  if ($("#app")) { endCall(null, true); ST.unsubs.forEach(u => { try { u(); } catch (e) {} }); ST.unsubs = []; ST.msgs.clear(); ST.peer = null; }
  gate(`<h1>Erişim izni bekleniyor</h1><p class="muted">Bu uygulamayı yalnızca davetli kişiler kullanabilir. Yöneticiden <b>${esc(ST.me.email)}</b> adresini kişi listesine eklemesini isteyin. Eklendiğinizde bu ekran kendiliğinden açılır.</p>
    <button class="btn" id="wTry" type="button">Tekrar dene</button><div class="row-links"><button class="linkbtn" id="wOut" type="button">Başka hesapla giriş yap</button></div>`);
  $("#wTry").onclick = () => onUser(ST.me);
  $("#wOut").onclick = () => ST.api.logout();
}

/* ================= ana ekran ================= */
function startApp() {
  $("#root").innerHTML = `<div class="app" id="app">
    <header class="top">
      <div class="brand"><img src="icons/icon-192.png" alt="" width="30" height="30"><b>Prepper Support</b></div>
      <span class="net" id="net" role="status"></span>
      <div class="top-r">
        ${isAdmin() ? `<button class="ibtn" id="adminBtn" type="button" aria-label="Kişiler ve gruplar" title="Kişiler ve gruplar">${ICON.users}</button>` : ""}
        <button class="ibtn" id="outBtn" type="button" aria-label="Çıkış yap" title="Çıkış yap (${esc(ST.me.email)})">${ICON.out}</button>
      </div>
    </header>
    ${DEMO ? '<div class="demobar">Demo modu · veriler yalnızca bu tarayıcıda · <b>' + esc(ST.me.name) + '</b> olarak girdiniz</div>' : ""}
    <div class="split" id="split">
      <aside class="side" aria-label="Sohbetler"><div id="convList" class="convlist"></div><div class="side-f" id="sideNote"></div></aside>
      <section class="thread" id="thread" aria-label="Konuşma">
        <div class="th-h" id="thHead"></div>
        <div class="th-b" id="thBody" aria-live="polite"></div>
        <div class="th-busy" id="thBusy" hidden></div>
        <div class="th-rec" id="thRec" hidden><span class="recdot"></span><span>Kaydediliyor</span><b class="num" id="recT">0:00</b><span class="note">en fazla 2:00</span><button type="button" class="btn ghost sm" id="recCancel">İptal</button><button type="button" class="btn sm" id="recSend">Gönder</button></div>
        <form class="th-f" id="thForm">
          <button type="button" class="ibtn" id="thAtt" aria-label="Fotoğraf veya dosya ekle" title="Fotoğraf veya dosya ekle">${ICON.clip}</button>
          <input type="file" id="thFile" multiple hidden accept="image/*,application/pdf,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip">
          <textarea id="thText" rows="1" maxlength="4000" placeholder="Mesaj yazın…" aria-label="Mesaj"></textarea>
          <button type="button" class="ibtn" id="thMic" aria-label="Sesli mesaj kaydet" title="Sesli mesaj kaydet">${ICON.mic}</button>
          <button class="sendbtn" id="thSend" type="submit" aria-label="Gönder" title="Gönder">${ICON.send}</button>
        </form>
      </section>
    </div></div>`;
  if (isDesktop() && !ST.peer) ST.peer = defaultPeer();
  $("#outBtn").onclick = () => { endCall("ended"); ST.peer = null; ST.api.logout(); };
  if ($("#adminBtn")) $("#adminBtn").onclick = openAdmin;
  const ta = $("#thText");
  const grow = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 140) + "px"; };
  ta.oninput = grow;
  ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && isDesktop()) { e.preventDefault(); $("#thForm").requestSubmit(); } };
  $("#thForm").onsubmit = e => { e.preventDefault(); const t = ta.value; if (!t.trim()) return; ta.value = ""; grow(); sendMsg(ST.peer, t); ta.focus(); };
  $("#thAtt").onclick = () => $("#thFile").click();
  $("#thFile").onchange = async () => { const fl = [...$("#thFile").files]; $("#thFile").value = ""; if (fl.length) await sendFiles(fl); };
  $("#thMic").onclick = recStart;
  $("#recCancel").onclick = () => recStop(true);
  $("#recSend").onclick = () => recStop(false);
  ta.addEventListener("paste", e => { const fl = [...(e.clipboardData && e.clipboardData.files || [])]; if (fl.length) { e.preventDefault(); sendFiles(fl); } });
  const th = $("#thread");
  th.addEventListener("dragover", e => { e.preventDefault(); th.classList.add("drop"); });
  th.addEventListener("dragleave", e => { if (!th.contains(e.relatedTarget)) th.classList.remove("drop"); });
  th.addEventListener("drop", e => { e.preventDefault(); th.classList.remove("drop"); if (e.dataTransfer.files.length) sendFiles([...e.dataTransfer.files]); });
  addEventListener("resize", () => { if (isDesktop() && !ST.peer) { ST.peer = defaultPeer(); ST.sig = ""; } paintSplit(); renderThread(); });
  startData();
  paintNet(); paintSplit(); renderConvs(); renderThread();
}
function startData() {
  ST.unsubs.push(ST.api.watchMessages(ST.me.email, list => {
    list.forEach(ch => {
      if (ch.type === "removed") ST.msgs.delete(ch.id);
      else {
        const isNew = ch.type === "added" && !ch.initial && !ST.msgs.has(ch.id);
        ST.msgs.set(ch.id, { id: ch.id, ...ch.data, _pending: ch.pending });
        if (isNew && lower(ch.data.from) !== ST.me.email) incoming(ST.msgs.get(ch.id));
      }
    });
    msgsChanged();
  }, e => toast("Mesajlar okunamadı: " + errText(e))));
  ST.unsubs.push(ST.api.watchReads(ST.me.uid, r => { ST.reads = r; msgsChanged(); }));
  ST.unsubs.push(ST.api.watchIncoming(ST.me.email, onIncomingCall));
  loadIce();
}
function msgsChanged() {
  let n = 0; const ks = new Set([...ST.msgs.values()].map(convOf)); ks.forEach(k => n += unreadOf(k));
  document.title = (n ? "(" + n + ") " : "") + "Prepper Support";
  try { if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (e) {}
  if (!$("#app")) return;
  renderConvs(); renderThread(); paintNet(); markReadSoon();
}
function paintNet() {
  const el = $("#net"); if (!el) return;
  const p = pendingCount();
  el.className = "net " + (ST.online ? (p ? "sync" : "on") : "off");
  el.textContent = !ST.online ? (p ? `Çevrim dışı · ${p} mesaj sırada` : "Çevrim dışı") : p ? `Gönderiliyor · ${p}` : "Bağlı";
  el.title = !ST.online ? "İnternet yok. Yazdığınız mesajlar telefonda saklanır, bağlantı gelince otomatik gönderilir." : "";
}
function paintSplit() { const s = $("#split"); if (s) s.classList.toggle("show-thread", !!ST.peer && !isDesktop()); }
const viewing = key => $("#app") && !document.hidden && ST.peer && keyOfPeer(ST.peer) === key && (isDesktop() || $("#split").classList.contains("show-thread"));
function incoming(m) {
  const key = convOf(m); if (viewing(key)) return;
  const who = nameOf(m.from) + (isGroup(m.to) ? " · " + nameOf(m.to) : "");
  toast(who + ": " + String(msgText(m)).slice(0, 90));
  try {
    if (document.hidden && "Notification" in window && Notification.permission === "granted" && navigator.serviceWorker)
      navigator.serviceWorker.ready.then(r => r.showNotification(who, { body: String(msgText(m)).slice(0, 160), icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: key }));
  } catch (e) {}
}
function markReadSoon() { clearTimeout(ST.readTimer); ST.readTimer = setTimeout(markRead, 400); }
function markRead() {
  if (!ST.me || !ST.peer) return;
  const key = keyOfPeer(ST.peer); if (!viewing(key)) return;
  const list = convMsgs(key); if (!list.length) return;
  const last = Math.max(...list.map(m => m.at || 0));
  if ((ST.reads[key] || 0) >= last) return;
  ST.reads = { ...ST.reads, [key]: last };
  ST.api.setRead(ST.me.uid, key, last);
  msgsChanged();
}

/* --- sohbet listesi --- */
function people() {
  const s = new Map();
  Object.entries(ST.view.contacts || {}).forEach(([e, c]) => s.set(e, c.name || e));
  // Eski yazışmalar listede kalsın (kişi artık görünmüyorsa da geçmiş okunabilir)
  for (const m of ST.msgs.values()) { const p = peerOf(m); if (!isGroup(p) && p !== ST.me.email && !s.has(p)) s.set(p, nameOf(p)); }
  return [...s].map(([email, name]) => ({ email, name, gone: !ST.view.contacts[email] }));
}
function convRows() {
  const groups = ST.view.groups.map(g => ({ peer: "g:" + g.id, name: g.name, group: true, count: g.members.length }));
  const rows = [...groups, ...people().map(p => ({ peer: p.email, name: p.name, gone: p.gone }))];
  rows.forEach(r => { const l = convMsgs(keyOfPeer(r.peer)); r.last = l[l.length - 1] || null; r.unread = unreadOf(keyOfPeer(r.peer)); });
  const by = (a, b) => ((b.last && b.last.at) || 0) - ((a.last && a.last.at) || 0) || a.name.localeCompare(b.name, "tr");
  return [...rows.filter(r => r.group).sort(by), ...rows.filter(r => !r.group).sort(by)];
}
const defaultPeer = () => { const r = ST.view ? convRows() : []; return r.length ? r[0].peer : null; };
const gIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.5a3.5 3.5 0 010 7M18 14a6 6 0 013.5 6"/></svg>';
function renderConvs() {
  const box = $("#convList"); if (!box) return;
  const rows = convRows();
  const firstDm = rows.findIndex(r => !r.group);
  box.innerHTML = (rows.length ? "" : `<div class="side-empty">${isAdmin() ? "Henüz grup yok. Sağ üstteki kişiler simgesinden grup oluşturup kişileri ekleyin." : "Henüz bir gruba eklenmediniz. Yöneticiniz sizi bir gruba eklediğinde kişiler burada görünür."}</div>`) + rows.map((r, i) => {
    const sec = i === 0 && r.group ? '<div class="side-sec">Gruplar</div>' : i === firstDm ? '<div class="side-sec">Kişiler</div>' : "";
    const prev = r.last ? (r.group && lower(r.last.from) !== ST.me.email ? nameOf(r.last.from) + ": " : lower(r.last.from) === ST.me.email ? "Siz: " : "") + msgText(r.last) : (r.group ? r.count + " kişi" : "Henüz mesaj yok");
    return `<button class="conv${r.unread ? " unread" : ""}" type="button" data-peer="${esc(r.peer)}" aria-current="${r.peer === ST.peer}">
      <span class="av${r.group ? " grp" : ""}" style="--c:${colorOf(r.name)}">${r.group ? gIcon : esc(initials(r.name))}</span>
      <span class="cmid"><span class="cn">${esc(r.name)}</span><span class="cp">${r.last && r.last._pending ? ICON.clock : ""}${esc(prev)}</span></span>
      <span class="cr">${r.last ? esc(shortWhen(r.last.at)) : ""}${r.unread ? `<span class="badge">${r.unread > 99 ? "99+" : r.unread}</span>` : ""}</span></button>`.replace(/^/, sec);
  }).join("");
  box.querySelectorAll("[data-peer]").forEach(b => b.onclick = () => openThread(b.dataset.peer));
  const note = $("#sideNote");
  if ("Notification" in window && Notification.permission === "default") {
    note.innerHTML = 'Uygulama arka plandayken yeni mesaj bildirimi almak için <button class="linkbtn" id="nPerm" type="button">bildirimlere izin verin</button>.';
    $("#nPerm").onclick = () => Notification.requestPermission().then(renderConvs);
  } else note.textContent = DEMO ? "" : "İnternet kesilirse yazdığınız mesajlar sıraya alınır, bağlantı gelince gönderilir.";
}
function openThread(peer) {
  const wasOpen = !!ST.peer;
  ST.peer = peer; ST.sig = "";
  if (!isDesktop() && !wasOpen) history.pushState({ thread: 1 }, "");
  paintSplit(); renderConvs(); renderThread(); markReadSoon();
  if (isDesktop()) $("#thText").focus();
}
function closeThread(fromPop) {
  if (REC.mr) recStop(true);
  ST.peer = null; ST.sig = ""; paintSplit(); renderConvs();
  if (!fromPop && history.state && history.state.thread) history.back();
}

/* --- konuşma --- */
function renderThread() {
  const head = $("#thHead"); if (!head) return;
  const th = $("#thread");
  if (!ST.peer) { th.classList.add("empty"); head.innerHTML = ""; $("#thBody").innerHTML = '<div class="th-empty">Soldan bir sohbet seçin.</div>'; return; }
  th.classList.remove("empty");
  const rows = convRows(), cur = rows.find(r => r.peer === ST.peer) || { peer: ST.peer, name: nameOf(ST.peer), gone: true };
  const key = keyOfPeer(ST.peer);
  const grp = cur.group ? groupOf(ST.peer) : null;
  const sub = grp ? grp.members.map(e => e === ST.me.email ? "Siz" : nameOf(e)).join(", ") : cur.gone ? "Artık ortak bir grubunuz yok" : "Özel mesaj · yalnızca ikiniz görürsünüz";
  const hsig = ST.peer + "|" + cur.name + "|" + sub;
  if (head.dataset.sig !== hsig) {
    head.dataset.sig = hsig;
    head.innerHTML = `<button class="ibtn back" id="thBack" type="button" aria-label="Sohbetlere dön">${ICON.back}</button>
      <span class="av${cur.group ? " grp" : ""}" style="--c:${colorOf(cur.name)}">${cur.group ? gIcon : esc(initials(cur.name))}</span>
      <span class="cmid"><span class="tn">${esc(cur.name)}</span><span class="ts" title="${esc(sub)}">${esc(sub)}</span></span>
      ${cur.group || cur.gone ? "" : `<span class="thcall"><button type="button" class="ibtn" id="thCallA" aria-label="${esc(cur.name)} ile sesli arama" title="Sesli arama">${ICON.audio}</button><button type="button" class="ibtn" id="thCallV" aria-label="${esc(cur.name)} ile görüntülü arama" title="Görüntülü arama">${ICON.video}</button></span>`}`;
    $("#thBack").onclick = () => closeThread(false);
    if (!cur.group && !cur.gone) { $("#thCallA").onclick = () => startCall(ST.peer, "audio"); $("#thCallV").onclick = () => startCall(ST.peer, "video"); }
  }
  const list = convMsgs(key);
  const sig = key + "|" + list.map(m => m.id + (m._pending ? "p" : "")).join(",").length + "|" + list.length + "|" + (list.length ? list[list.length - 1].id + (list[list.length - 1]._pending ? "p" : "") : "") + "|" + pendingCount() + "|" + dayLabel(Date.now());
  if (sig === ST.sig) return;
  const body = $("#thBody");
  const nearBottom = body.scrollHeight - body.scrollTop - body.clientHeight < 90 || !ST.sig.startsWith(key + "|");
  let lastDay = "", html = "";
  list.forEach(m => {
    const dk = dayKey(m.at || 0); if (dk !== lastDay) { html += `<div class="dsep"><span>${esc(dayLabel(m.at || 0))}</span></div>`; lastDay = dk; }
    const mine = lower(m.from) === ST.me.email, nm = nameOf(m.from);
    const canDel = mine || (isAdmin() && isGroup(m.to));
    const stamp = `<span class="t">${m._pending ? `<span class="pend" title="${ST.online ? "Gönderiliyor" : "İnternet gelince gönderilecek"}">${ICON.clock}</span>` : mine ? `<span class="okk">${ICON.check}</span>` : ""}${esc(hhmm(m.at || 0))}${canDel && !m.call ? `<button type="button" data-del="${esc(m.id)}">Sil</button>` : ""}</span>`;
    if (m.call) {
      const c = m.call, ok = c.st === "answered", other = mine ? lower(m.to) : lower(m.from);
      html += `<div class="bub callbub${mine ? " mine" : ""}${ok ? "" : " miss"}"><span class="cbi">${ICON[c.type === "video" ? "video" : "audio"]}</span><span class="cbt"><b>${esc(msgText(m))}</b><small>${mine ? "Giden" : "Gelen"} · ${esc(hhmm(m.at || 0))}</small></span><button type="button" class="cback" data-cb="${esc(other)}" data-ct="${c.type === "video" ? "video" : "audio"}">Geri ara</button></div>`;
      return;
    }
    const a = m.att; let ah = "";
    if (a && (a.type || "").startsWith("image/")) ah = `<button type="button" class="mimg" data-att="${esc(m.id)}" aria-label="Fotoğrafı büyüt">${a.thumb ? `<img src="${a.thumb}" alt="${esc(a.name)}">` : "Fotoğraf"}</button>`;
    else if (a && (a.type || "").startsWith("audio/")) ah = `<div class="aud"><button type="button" class="play" data-aud="${esc(m.id)}" aria-label="Sesli mesajı oynat">▶</button><span>Sesli mesaj</span><b class="num">${fmtSec(a.dur)}</b></div>`;
    else if (a) ah = `<button type="button" class="mfile" data-att="${esc(m.id)}"><span class="fx">${esc((String(a.name).split(".").pop() || "DOSYA").toUpperCase().slice(0, 4))}</span><span class="fn"><b>${esc(a.name)}</b><small>${fmtSize(a.size || 0)}</small></span></button>`;
    html += `<div class="bub${mine ? " mine" : ""}${a ? " hasatt" : ""}${m._pending ? " pending" : ""}" style="--c:${colorOf(nm)}">${!mine && isGroup(m.to) ? `<span class="who">${esc(nm)}</span>` : ""}${ah}${m.text ? `<p>${esc(m.text)}</p>` : ""}${stamp}</div>`;
  });
  body.innerHTML = html || `<div class="th-empty">${cur.group ? "Gruba ilk mesajı yazın. Buradaki mesajları yalnızca bu grubun üyeleri görür." : esc(cur.name) + " ile henüz mesajlaşmadınız."}</div>`;
  $("#thForm").hidden = !!cur.gone;
  body.querySelectorAll("[data-del]").forEach(b => { let armed = false; b.onclick = async () => {
    if (!armed) { armed = true; b.textContent = "Silinsin mi?"; setTimeout(() => { armed = false; b.textContent = "Sil"; }, 3000); return; }
    const mm = ST.msgs.get(b.dataset.del);
    try { await ST.api.deleteMessage(b.dataset.del); if (mm && mm.att && lower(mm.from) === ST.me.email) ST.api.deleteFile(mm.att.id).catch(() => {}); } catch (e) { toast(errText(e)); } }; });
  body.querySelectorAll("[data-att]").forEach(b => b.onclick = () => { const mm = ST.msgs.get(b.dataset.att); if (mm && mm.att) viewFile(mm.att); });
  body.querySelectorAll("[data-aud]").forEach(b => b.onclick = () => { const mm = ST.msgs.get(b.dataset.aud); if (mm && mm.att) playAudio(b, mm.att); });
  body.querySelectorAll("[data-cb]").forEach(b => b.onclick = () => startCall(b.dataset.cb, b.dataset.ct));
  body.querySelectorAll(".mimg img").forEach(im => im.addEventListener("load", () => { if (nearBottom) body.scrollTop = body.scrollHeight; }, { once: true }));
  if (nearBottom) body.scrollTop = body.scrollHeight;
  ST.sig = sig;
}

/* --- gönderme --- */
// Alıcı bilgisi: grup mesajını yalnızca grubun o anki üyeleri görür
function target(peer) {
  if (isGroup(peer)) { const g = groupOf(peer); if (!g) return null; return { to: peer, group: g.id, participants: g.members.slice() }; }
  peer = lower(peer); if (!ST.view.contacts[peer]) return null;
  return { to: peer, participants: [ST.me.email, peer] };
}
function sendMsg(peer, text, att, call) {
  text = String(text || "").trim(); if (!text && !att && !call) return false;
  const t = target(peer); if (!t) { toast("Bu sohbete artık mesaj gönderemezsiniz."); return false; }
  const m = { ...t, from: ST.me.email, fromName: ST.me.name, text, at: Date.now() };
  if (att) m.att = att; if (call) m.call = call;
  try { ST.api.sendMessage(m); return true; } catch (e) { toast(errText(e)); return false; }
}
function upload(peer, data, meta) {
  const t = target(peer); if (!t) throw new Error("Bu sohbete artık gönderilemez");
  const r = ST.api.putFile({ data, name: meta.name, type: meta.type, size: data.length, at: Date.now(), uid: ST.me.uid, from: ST.me.email, ...t });
  const att = { id: r.id, name: meta.name, type: meta.type, size: meta.size || data.length };
  if (meta.thumb) att.thumb = meta.thumb; if (meta.dur) att.dur = meta.dur;
  return att;
}
const busy = t => { const el = $("#thBusy"); if (el) { el.hidden = !t; el.textContent = t || ""; } };
const readDataURL = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error("Dosya okunamadı")); r.readAsDataURL(f); });
function loadImage(file) {
  return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 2000); };
    i.onerror = () => { URL.revokeObjectURL(u); rej(new Error("Görsel açılamadı. iPhone fotoğrafıysa Ayarlar > Kamera > Biçimler > En Uyumlu seçin.")); };
    i.src = u; });
}
function shrinkImg(img, side, maxLen) {
  let s = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)), q = 0.82, out = "";
  const c = document.createElement("canvas");
  for (let k = 0; k < 12; k++) {
    c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    out = c.toDataURL("image/jpeg", q); if (out.length <= maxLen) break;
    if (q > 0.5) q -= 0.12; else s *= 0.8;
  }
  return out;
}
async function sendFiles(list) {
  const peer = ST.peer; if (!peer) return;
  for (const f of list) {
    const type = f.type || "application/octet-stream", isImg = type.startsWith("image/");
    if (!isImg && f.size > 700 * 1024) { toast(f.name + ": dosya 700 KB'tan büyük. Daha küçük bir dosya seçin."); continue; }
    busy("Hazırlanıyor: " + f.name);
    try {
      let data, meta = { name: f.name, type, size: f.size };
      if (isImg) { const img = await loadImage(f); data = shrinkImg(img, 1600, 760000); meta.thumb = shrinkImg(img, 360, 45000); meta.type = "image/jpeg"; meta.size = data.length; }
      else data = await readDataURL(f);
      const cap = $("#thText").value; $("#thText").value = "";
      sendMsg(peer, cap, upload(peer, data, meta));
    } catch (e) { toast(f.name + " gönderilemedi: " + errText(e)); }
  }
  busy("");
}
function dataToBlob(d) {
  const [h, b] = String(d).split(","); const type = (h.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
  const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return new Blob([u], { type });
}
const FILES = new Map();
async function fileURL(att) {
  if (FILES.has(att.id)) return FILES.get(att.id);
  const f = await ST.api.getFile(att.id); if (!f) throw new Error("Dosya bulunamadı veya silinmiş");
  const u = URL.createObjectURL(dataToBlob(f.data)); FILES.set(att.id, u); return u;
}
async function playAudio(btn, att) {
  const box = btn.closest(".aud");
  try { btn.disabled = true; btn.textContent = "…"; const u = await fileURL(att); box.innerHTML = `<audio controls autoplay src="${u}"></audio>`; }
  catch (e) { btn.disabled = false; btn.textContent = "▶"; toast("Ses açılamadı: " + errText(e)); }
}
async function viewFile(att) {
  try {
    busy("Açılıyor: " + att.name);
    const u = await fileURL(att); busy("");
    if ((att.type || "").startsWith("image/")) {
      const v = document.createElement("div"); v.className = "viewer"; v.setAttribute("role", "dialog"); v.setAttribute("aria-label", att.name);
      v.innerHTML = `<img src="${u}" alt="${esc(att.name)}"><div class="vbar"><a class="btn ghost sm" href="${u}" download="${esc(att.name)}">İndir</a><button class="btn sm" type="button">Kapat</button></div>`;
      const close = () => { v.remove(); removeEventListener("keydown", k); };
      const k = e => { if (e.key === "Escape") close(); };
      v.onclick = e => { if (e.target === v || e.target.tagName === "BUTTON") close(); };
      addEventListener("keydown", k); document.body.appendChild(v);
    } else { const a = document.createElement("a"); a.href = u; a.download = att.name; document.body.appendChild(a); a.click(); a.remove(); }
  } catch (e) { busy(""); toast(errText(e)); }
}

/* --- ses kaydı --- */
const REC = { mr: null, stream: null, chunks: [], t0: 0, timer: null, cancel: false, peer: null };
const recMime = () => { const c = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus", "audio/webm"]; try { return c.find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || ""; } catch (e) { return ""; } };
async function recStart() {
  if (!window.MediaRecorder || !navigator.mediaDevices) { toast("Bu tarayıcı ses kaydını desteklemiyor."); return; }
  try { REC.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { toast("Mikrofon izni verilmedi. Tarayıcı ayarlarından bu site için mikrofona izin verin."); return; }
  const mime = recMime();
  try { REC.mr = new MediaRecorder(REC.stream, mime ? { mimeType: mime, audioBitsPerSecond: 32000 } : { audioBitsPerSecond: 32000 }); }
  catch (e) { REC.mr = new MediaRecorder(REC.stream); }
  REC.chunks = []; REC.cancel = false; REC.t0 = Date.now(); REC.peer = ST.peer;
  REC.mr.ondataavailable = ev => { if (ev.data && ev.data.size) REC.chunks.push(ev.data); };
  REC.mr.onstop = recDone; REC.mr.start(1000);
  $("#thRec").hidden = false; $("#thForm").classList.add("recording");
  const tick = () => { const s = (Date.now() - REC.t0) / 1000; $("#recT").textContent = fmtSec(s); if (s >= 120) recStop(false); };
  tick(); REC.timer = setInterval(tick, 250);
}
function recStop(cancel) { REC.cancel = !!cancel; clearInterval(REC.timer); try { if (REC.mr && REC.mr.state !== "inactive") REC.mr.stop(); else recDone(); } catch (e) { recDone(); } }
async function recDone() {
  const dur = Math.round((Date.now() - REC.t0) / 1000);
  try { REC.stream && REC.stream.getTracks().forEach(t => t.stop()); } catch (e) {}
  if ($("#thRec")) { $("#thRec").hidden = true; $("#thForm").classList.remove("recording"); }
  const chunks = REC.chunks, peer = REC.peer; REC.mr = null; REC.stream = null; REC.chunks = [];
  if (REC.cancel || !chunks.length || !peer) return;
  if (dur < 1) { toast("Kayıt çok kısa"); return; }
  const type = (chunks[0].type || recMime() || "audio/webm").split(";")[0];
  const blob = new Blob(chunks, { type });
  if (blob.size > 720 * 1024) { toast("Ses kaydı çok uzun. En fazla 2 dakika kaydedin."); return; }
  try { const data = await readDataURL(blob); const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
    sendMsg(peer, "", upload(peer, data, { name: "sesli-mesaj." + ext, type, size: blob.size, dur })); }
  catch (e) { toast("Sesli mesaj gönderilemedi: " + errText(e)); }
}

/* ================= kişiler ve yetkiler (yönetici) ================= */
function openAdmin() {
  if (!ST.access) { toast("Kişi listesi yükleniyor, birazdan tekrar deneyin."); return; }
  const dlg = document.createElement("div"); dlg.className = "modal"; dlg.setAttribute("role", "dialog"); dlg.setAttribute("aria-modal", "true"); dlg.setAttribute("aria-labelledby", "admT");
  document.body.appendChild(dlg);
  const orig = ST.access;
  const draft = JSON.parse(JSON.stringify({ members: orig.members, groups: Object.fromEntries(Object.entries(orig.groups).map(([id, g]) => [id, { name: g.name }])) }));
  let tab = Object.keys(draft.groups).length ? "groups" : "people", dirty = false;
  const close = () => { if (dirty && !confirm("Kaydedilmemiş değişiklikler var. Yine de kapatılsın mı?")) return; dlg.remove(); removeEventListener("keydown", k); };
  const k = e => { if (e.key === "Escape") close(); };
  addEventListener("keydown", k);
  const touch = () => { dirty = true; const m = $("#admMsg"); if (m) m.textContent = "Kaydetmeyi unutmayın."; };
  const sortedPeople = () => Object.entries(draft.members).sort((a, b) => (a[1].name || a[0]).localeCompare(b[1].name || b[0], "tr"));
  const sortedGroups = () => Object.entries(draft.groups).sort((a, b) => a[1].name.localeCompare(b[1].name, "tr"));
  const gCount = id => Object.values(draft.members).filter(m => (m.groups || []).includes(id)).length;
  const paint = () => {
    const people = sortedPeople(), groups = sortedGroups();
    const peopleHtml = `<form class="addrow" id="admAdd"><input id="aName" placeholder="Ad Soyad" required maxlength="60" aria-label="Ad Soyad"><input id="aMail" type="email" placeholder="E-posta" required aria-label="E-posta">
        <select id="aRole" aria-label="Rol"><option value="member">Üye</option><option value="admin">Yönetici</option></select><button class="btn sm" type="submit">Ekle</button></form>
      <div class="mlist">${people.map(([e, m]) => `<div class="mrow"><span class="av" style="--c:${colorOf(m.name || e)}">${esc(initials(m.name || e))}</span>
        <span class="cmid"><b>${esc(m.name || e)}</b><small>${esc(e)}</small><small class="gl">${(m.groups || []).filter(id => draft.groups[id]).map(id => esc(draft.groups[id].name)).join(" · ") || (m.role === "admin" ? "Yönetici · herkesi görür" : "Hiçbir grupta değil")}</small></span>
        ${BOOT.includes(e) ? '<span class="tag">Kalıcı yönetici</span>' : `<select data-role="${esc(e)}" aria-label="${esc(m.name)} rolü"><option value="member"${m.role !== "admin" ? " selected" : ""}>Üye</option><option value="admin"${m.role === "admin" ? " selected" : ""}>Yönetici</option></select><button class="linkbtn danger" type="button" data-rm="${esc(e)}">Çıkar</button>`}</div>`).join("") || '<div class="mrow muted">Henüz kişi yok.</div>'}</div>`;
    const groupsHtml = `<form class="addrow g" id="admG"><input id="gName" placeholder="Yeni grup adı (ör. Aile, Mahalle ekibi)" required maxlength="40" aria-label="Grup adı"><button class="btn sm" type="submit">Grup oluştur</button></form>
      ${groups.map(([id, g]) => `<div class="gcard"><div class="gcard-h"><span class="av grp sm" style="--c:${colorOf(g.name)}">${gIcon}</span><input class="gname" data-gname="${id}" value="${esc(g.name)}" maxlength="40" aria-label="Grup adı"><span class="muted gcnt">${gCount(id)} kişi</span><button class="linkbtn danger" type="button" data-gdel="${id}">Sil</button></div>
        <div class="gmembers">${people.map(([e, m]) => `<label class="chk"><input type="checkbox" data-g="${id}" data-e="${esc(e)}"${(m.groups || []).includes(id) ? " checked" : ""}><span>${esc(m.name || e)}</span></label>`).join("") || '<span class="muted">Önce Kişiler sekmesinden kişi ekleyin.</span>'}</div></div>`).join("") || '<p class="muted">Henüz grup yok. Yukarıdan bir grup oluşturup üyelerini işaretleyin.</p>'}`;
    dlg.innerHTML = `<div class="sheet"><div class="sheet-h"><h2 id="admT">Kişiler ve gruplar</h2><button class="ibtn" id="admX" type="button" aria-label="Kapat">×</button></div>
      <div class="tabs" role="tablist"><button type="button" role="tab" data-tab="groups" aria-selected="${tab === "groups"}">Gruplar <span>${groups.length}</span></button><button type="button" role="tab" data-tab="people" aria-selected="${tab === "people"}">Kişiler <span>${people.length}</span></button></div>
      <p class="muted hint">${tab === "groups" ? "Herkes yalnızca kendi gruplarındaki kişileri görür ve onlarla yazışır. Yöneticiler herkesi görür." : "Önce kişiyi Firebase → Authentication → Users → Add user ile e-posta ve şifreyle açın, sonra aynı e-postayı buraya ekleyin."}</p>
      <div class="tabbody">${tab === "groups" ? groupsHtml : peopleHtml}</div>
      <div class="sheet-f"><span class="muted" id="admMsg">${dirty ? "Kaydetmeyi unutmayın." : ""}</span><button class="btn ghost" type="button" id="admC">Kapat</button><button class="btn" type="button" id="admS">Kaydet</button></div></div>`;
    $("#admX").onclick = close; $("#admC").onclick = close;
    dlg.onclick = e => { if (e.target === dlg) close(); };
    dlg.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; paint(); });
    const on = (sel, ev, fn) => dlg.querySelectorAll(sel).forEach(el => el[ev] = () => fn(el));
    if (tab === "people") {
      $("#admAdd").onsubmit = e => { e.preventDefault(); const em = lower($("#aMail").value); if (!em.includes("@")) return;
        const prev = draft.members[em]; draft.members[em] = { name: $("#aName").value.trim(), role: $("#aRole").value, groups: prev ? prev.groups : [] }; touch(); paint(); setTimeout(() => $("#aName") && $("#aName").focus(), 0); };
      on("[data-role]", "onchange", el => { draft.members[el.dataset.role].role = el.value; touch(); paint(); });
      on("[data-rm]", "onclick", el => { const e = el.dataset.rm; if (e === ST.me.email) { toast("Kendinizi listeden çıkaramazsınız."); return; } delete draft.members[e]; touch(); paint(); });
    } else {
      $("#admG").onsubmit = e => { e.preventDefault(); const n = $("#gName").value.trim(); if (!n) return; draft.groups[newGroupId()] = { name: n }; touch(); paint(); };
      on("[data-gname]", "oninput", el => { draft.groups[el.dataset.gname].name = el.value.trim() || "Grup"; touch(); });
      on("[data-gdel]", "onclick", el => { const id = el.dataset.gdel; if (!confirm(`"${draft.groups[id].name}" grubu silinsin mi? Grubun eski mesajları üyelerde kalır.`)) return;
        delete draft.groups[id]; Object.values(draft.members).forEach(m => m.groups = (m.groups || []).filter(x => x !== id)); touch(); paint(); });
      on("[data-g]", "onchange", el => { const m = draft.members[el.dataset.e], id = el.dataset.g; m.groups = (m.groups || []).filter(x => x !== id); if (el.checked) m.groups.push(id);
        touch(); const c = el.closest(".gcard").querySelector(".gcnt"); if (c) c.textContent = gCount(id) + " kişi"; });
    }
    $("#admS").onclick = async () => {
      const b = $("#admS"); b.disabled = true;
      const access = normalize(draft, BOOT);
      const dirs = {}; Object.keys(access.members).forEach(e => dirs[e] = buildDir(access, e));
      const removed = Object.keys(orig.members).filter(e => !access.members[e]);
      try { await ST.api.saveAccess(access, dirs, removed); dirty = false; toast("Kaydedildi"); close(); }
      catch (e) { toast("Kaydedilemedi: " + errText(e)); b.disabled = false; }
    };
  };
  paint();
}

/* ================= birebir arama (sesli / görüntülü, WebRTC) ================= */
// Bağlantı bilgileri calls/{id} belgesi ve calls/{id}/ice alt koleksiyonu üzerinden değiş tokuş edilir.
const CALL = { st: null, pc: null, local: null, id: null, role: null, peer: null, peerName: "", type: "audio", unsubs: [], qIce: [], t0: 0, timer: null, ringTimer: null, ring: null, muted: false, camOff: false, facing: "user", logged: false, seen: new Set(), endTxt: "", call: null };
const RING_MS = 40000;
let ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }].concat(Array.isArray(EXTRA_ICE) ? EXTRA_ICE : []);
let iceLoaded = !TURN_URL;
async function loadIce() {
  if (!TURN_URL || DEMO) { iceLoaded = true; return; }
  try { const r = await fetch(TURN_URL); if (r.ok) { const a = await r.json(); if (Array.isArray(a) && a.length) ICE = a.concat(Array.isArray(EXTRA_ICE) ? EXTRA_ICE : []); } } catch (e) {}
  iceLoaded = true;
}
function callUI() {
  let el = $("#callUI");
  if (!el) {
    el = document.createElement("div"); el.id = "callUI"; el.className = "callui"; el.hidden = true;
    el.setAttribute("role", "dialog"); el.setAttribute("aria-modal", "true"); el.setAttribute("aria-label", "Arama");
    el.innerHTML = `<video id="cRemoteV" class="c-rv" autoplay playsinline></video><audio id="cRemoteA" autoplay></audio>
      <div class="c-top"><span class="av big" id="cAv"></span><div class="c-nm" id="cName"></div><div class="c-st" id="cState"></div></div>
      <video id="cLocalV" class="c-lv" autoplay playsinline muted hidden></video><div class="c-ctl" id="cCtl"></div>`;
    document.body.appendChild(el);
  }
  return el;
}
function callPaint() {
  const el = callUI(), s = CALL.st;
  el.hidden = !s; if (!s) return;
  el.classList.toggle("video", CALL.type === "video"); el.classList.toggle("live", s === "live");
  $("#cAv").textContent = initials(CALL.peerName || "?"); $("#cAv").style.setProperty("--c", colorOf(CALL.peerName || ""));
  $("#cName").textContent = CALL.peerName;
  const kind = CALL.type === "video" ? "Görüntülü" : "Sesli";
  $("#cState").textContent = { calling: kind + " arama · çalıyor…", incoming: kind + " arama geliyor", connecting: "Bağlanıyor…", live: fmtSec((Date.now() - CALL.t0) / 1000), ended: CALL.endTxt || "Arama bitti" }[s] || "";
  const B = (id, cls, label, svg) => `<button type="button" class="cbtn ${cls}" id="${id}" aria-label="${label}">${svg}<span>${label}</span></button>`;
  const MIC = ICON.mic.replace("</svg>", (CALL.muted ? '<path d="M4 4l16 16"/>' : "") + "</svg>");
  const CAM = ICON.video.replace("</svg>", (CALL.camOff ? '<path d="M3 3l18 18"/>' : "") + "</svg>");
  let h = "";
  if (s === "incoming") h = B("cRej", "red", "Reddet", ICON.end) + B("cAcc", "green", "Aç", ICON[CALL.type === "video" ? "video" : "audio"]);
  else if (s !== "ended") h = B("cMute", CALL.muted ? "on" : "", CALL.muted ? "Mikrofon kapalı" : "Mikrofon", MIC)
    + (CALL.type === "video" ? B("cCam", CALL.camOff ? "on" : "", CALL.camOff ? "Kamera kapalı" : "Kamera", CAM) + B("cFlip", "", "Çevir", ICON.flip) : "")
    + B("cEnd", "red", "Kapat", ICON.end);
  $("#cCtl").innerHTML = h;
  const on = (id, fn) => { const b = $("#" + id); if (b) b.onclick = fn; };
  on("cAcc", acceptCall); on("cRej", () => endCall("rejected")); on("cEnd", () => endCall("ended"));
  on("cMute", () => { CALL.muted = !CALL.muted; CALL.local && CALL.local.getAudioTracks().forEach(t => t.enabled = !CALL.muted); callPaint(); });
  on("cCam", () => { CALL.camOff = !CALL.camOff; CALL.local && CALL.local.getVideoTracks().forEach(t => t.enabled = !CALL.camOff); callPaint(); });
  on("cFlip", flipCam);
  const lv = $("#cLocalV"); lv.hidden = !(CALL.type === "video" && CALL.local && !CALL.camOff);
  if (CALL.local && lv.srcObject !== CALL.local) lv.srcObject = CALL.local;
}
function timerStart() { clearInterval(CALL.timer); CALL.timer = setInterval(() => { if (CALL.st === "live") $("#cState").textContent = fmtSec((Date.now() - CALL.t0) / 1000); }, 1000); }
function ringTone(on) {
  try {
    if (!on) { if (CALL.ring) { clearInterval(CALL.ring.iv); CALL.ring.ctx.close(); } CALL.ring = null; return; }
    if (CALL.ring) return;
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = CALL.role === "callee" ? 660 : 440; g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9); o.stop(ctx.currentTime + 1); };
    beep(); CALL.ring = { ctx, iv: setInterval(beep, CALL.role === "callee" ? 1600 : 3000) };
    if (CALL.role === "callee" && navigator.vibrate) navigator.vibrate([400, 300, 400]);
  } catch (e) {}
}
async function getMedia(type) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error("Bu tarayıcı arama desteklemiyor.");
  try { return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: type === "video" ? { facingMode: CALL.facing, width: { ideal: 640 }, height: { ideal: 480 } } : false }); }
  catch (e) { throw new Error(type === "video" ? "Kamera / mikrofon izni verilmedi. Tarayıcı ayarlarından bu site için izin verin." : "Mikrofon izni verilmedi. Tarayıcı ayarlarından bu site için izin verin."); }
}
function makePC(side) {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  pc.onicecandidate = e => { if (e.candidate && CALL.id) ST.api.addIce(CALL.id, side, e.candidate.toJSON()); };
  pc.ontrack = e => {
    const st = e.streams[0] || new MediaStream([e.track]);
    const a = $("#cRemoteA"), v = $("#cRemoteV");
    if (CALL.type === "video") { v.srcObject = st; v.play && v.play().catch(() => {}); a.srcObject = null; } else { a.srcObject = st; a.play && a.play().catch(() => {}); }
  };
  pc.onconnectionstatechange = () => {
    const s = pc.connectionState;
    if (s === "connected" && CALL.st !== "live") { CALL.st = "live"; CALL.t0 = Date.now(); ringTone(false); callPaint(); timerStart(); }
    else if (s === "disconnected" && CALL.st === "live") $("#cState").textContent = "Bağlantı zayıf…";
    else if (s === "failed") { CALL.endTxt = TURN_URL || EXTRA_ICE.length ? "Bağlantı kurulamadı." : "Bağlantı kurulamadı. Ağ doğrudan bağlantıya izin vermiyor; TURN sunucusu ayarlanmalı."; endCall("ended", false); }
  };
  return pc;
}
function listenIce(otherSide) {
  CALL.unsubs.push(ST.api.watchIce(CALL.id, otherSide, c => { if (CALL.pc && CALL.pc.remoteDescription) CALL.pc.addIceCandidate(c).catch(() => {}); else CALL.qIce.push(c); }));
}
const flushIce = () => { CALL.qIce.splice(0).forEach(c => CALL.pc.addIceCandidate(c).catch(() => {})); };
async function startCall(peer, type) {
  if (CALL.st) { toast("Zaten bir aramadasınız."); return; }
  if (!ST.online) { toast("Arama için internet gerekiyor. Mesaj ya da sesli mesaj gönderebilirsiniz; bağlantı gelince iletilir."); return; }
  peer = lower(peer);
  Object.assign(CALL, { st: "calling", role: "caller", peer, peerName: nameOf(peer), type, muted: false, camOff: false, logged: false, qIce: [], endTxt: "" });
  callPaint(); ringTone(true);
  try {
    if (!iceLoaded) await loadIce();
    CALL.local = await getMedia(type); callPaint();
    CALL.id = ST.api.newCallId();
    CALL.pc = makePC("from");
    CALL.local.getTracks().forEach(t => CALL.pc.addTrack(t, CALL.local));
    const offer = await CALL.pc.createOffer(); await CALL.pc.setLocalDescription(offer);
    const now = Date.now();
    await ST.api.setCall(CALL.id, { from: ST.me.email, fromName: ST.me.name, to: peer, toName: CALL.peerName, participants: [ST.me.email, peer], type, status: "ringing", offer: { type: offer.type, sdp: offer.sdp }, createdAt: now, updatedAt: now });
    const myId = CALL.id;
    CALL.unsubs.push(ST.api.watchCall(myId, async d => {
      if (!d || !CALL.pc || CALL.id !== myId) return;
      if (d.answer && !CALL.pc.currentRemoteDescription) { CALL.st = "connecting"; ringTone(false); callPaint(); await CALL.pc.setRemoteDescription(d.answer); flushIce(); }
      if (d.status === "rejected") { CALL.endTxt = CALL.peerName + " aramayı reddetti"; endCall(null, true, "rejected"); }
      else if (d.status === "busy") { CALL.endTxt = CALL.peerName + " başka bir aramada"; endCall(null, true, "busy"); }
      else if (d.status === "ended" && d.endedBy !== ST.me.email) { CALL.endTxt = "Arama bitti"; endCall(null, true); }
    }));
    listenIce("to");
    CALL.ringTimer = setTimeout(() => { if (CALL.st === "calling") { CALL.endTxt = "Cevap yok"; endCall("missed"); } }, RING_MS);
  } catch (e) { CALL.endTxt = e.message || "Arama başlatılamadı"; toast(CALL.endTxt); endCall(null, true); }
}
function onIncomingCall(d) {
  if (CALL.id === d.id && CALL.role === "callee" && CALL.st === "incoming" && d.status !== "ringing") { CALL.endTxt = d.status === "missed" ? "Cevapsız arama" : "Arayan kapattı"; endCall(null, true); return; }
  if (d.status !== "ringing" || CALL.seen.has(d.id) || Date.now() - (d.createdAt || 0) > RING_MS + 5000) return;
  CALL.seen.add(d.id);
  if (CALL.st) { ST.api.updateCall(d.id, { status: "busy", updatedAt: Date.now() }).catch(() => {}); return; }
  Object.assign(CALL, { st: "incoming", role: "callee", id: d.id, call: d, peer: lower(d.from), peerName: ST.view && ST.view.contacts[lower(d.from)] ? nameOf(d.from) : (d.fromName || d.from), type: d.type || "audio", muted: false, camOff: false, logged: false, qIce: [], endTxt: "" });
  callPaint(); ringTone(true);
  try { if (document.hidden && "Notification" in window && Notification.permission === "granted" && navigator.serviceWorker)
    navigator.serviceWorker.ready.then(r => r.showNotification("Gelen arama · " + CALL.peerName, { body: (CALL.type === "video" ? "Görüntülü" : "Sesli") + " arama. Açmak için dokunun.", icon: "icons/icon-192.png", tag: "call-" + d.id, requireInteraction: true })); } catch (e) {}
  clearTimeout(CALL.ringTimer); CALL.ringTimer = setTimeout(() => { if (CALL.st === "incoming" && CALL.id === d.id) { CALL.endTxt = "Cevapsız arama"; endCall(null, true); } }, RING_MS + 2000);
}
async function acceptCall() {
  ringTone(false); CALL.st = "connecting"; callPaint();
  try {
    if (!iceLoaded) await loadIce();
    CALL.local = await getMedia(CALL.type); callPaint();
    CALL.pc = makePC("to");
    CALL.local.getTracks().forEach(t => CALL.pc.addTrack(t, CALL.local));
    await CALL.pc.setRemoteDescription(CALL.call.offer);
    const ans = await CALL.pc.createAnswer(); await CALL.pc.setLocalDescription(ans);
    await ST.api.updateCall(CALL.id, { answer: { type: ans.type, sdp: ans.sdp }, status: "accepted", acceptedAt: Date.now(), updatedAt: Date.now() });
    listenIce("from"); flushIce();
    const myId = CALL.id;
    CALL.unsubs.push(ST.api.watchCall(myId, d => { if (d && d.status === "ended" && d.endedBy !== ST.me.email && CALL.id === myId) { CALL.endTxt = "Arama bitti"; endCall(null, true); } }));
  } catch (e) { toast(e.message || "Arama açılamadı"); endCall("rejected"); }
}
async function flipCam() {
  if (!CALL.local || CALL.type !== "video") return;
  CALL.facing = CALL.facing === "user" ? "environment" : "user";
  try {
    const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: CALL.facing, width: { ideal: 640 }, height: { ideal: 480 } } });
    const nt = ns.getVideoTracks()[0], old = CALL.local.getVideoTracks()[0];
    const snd = CALL.pc && CALL.pc.getSenders().find(x => x.track && x.track.kind === "video"); if (snd) await snd.replaceTrack(nt);
    if (old) { CALL.local.removeTrack(old); old.stop(); } CALL.local.addTrack(nt); nt.enabled = !CALL.camOff;
    $("#cLocalV").srcObject = CALL.local;
  } catch (e) { toast("Kamera değiştirilemedi"); }
}
// status: veritabanına yazılacak durum (null: yazma) · local: yalnızca bu cihazı kapat
function endCall(status, local, why) {
  if (!CALL.st || CALL.st === "ended") return;
  const wasLive = CALL.st === "live", dur = wasLive ? Math.round((Date.now() - CALL.t0) / 1000) : 0;
  const { id, role, peer, type, logged } = CALL;
  CALL.logged = true;
  ringTone(false); clearTimeout(CALL.ringTimer); clearInterval(CALL.timer);
  CALL.unsubs.forEach(u => { try { u(); } catch (e) {} }); CALL.unsubs = [];
  try { CALL.pc && CALL.pc.close(); } catch (e) {}
  try { CALL.local && CALL.local.getTracks().forEach(t => t.stop()); } catch (e) {}
  CALL.pc = null; CALL.local = null;
  if (status && id) ST.api.updateCall(id, { status, endedBy: ST.me.email, endedAt: Date.now(), updatedAt: Date.now(), dur }).catch(() => {});
  // arama kaydını sohbete yalnızca arayan yazar
  if (role === "caller" && !logged && peer && id) sendMsg(peer, "", null, { type, dur, st: wasLive ? "answered" : (why || status || "missed") });
  CALL.st = "ended"; callPaint();
  setTimeout(() => { if (CALL.st === "ended") { CALL.st = null; CALL.id = null; CALL.role = null; callPaint(); const v = $("#cRemoteV"); if (v) v.srcObject = null; const a = $("#cRemoteA"); if (a) a.srcObject = null; } }, wasLive ? 1500 : 2200);
}
addEventListener("pagehide", () => { if (CALL.st && CALL.st !== "ended" && CALL.id) ST.api.updateCall(CALL.id, { status: CALL.st === "incoming" ? "rejected" : "ended", endedBy: ST.me && ST.me.email, updatedAt: Date.now() }).catch(() => {}); });
