// Prepper Support — demo arka ucu
// Firebase ayarları girilmemişse kullanılır. Veriler bu tarayıcıda (localStorage) tutulur;
// aynı tarayıcıda açılan sekmeler birbirine mesaj atabilir ve arayabilir. Gerçek kullanım için değildir.
const KEY = "prepper-demo-v1";
const now = Date.now();
const SEED = () => ({
  access: {
    "mustafa@demo.local": { name: "Mustafa Kılıçlar", role: "admin" },
    "ayse@demo.local": { name: "Ayşe Yılmaz", role: "member" },
    "mehmet@demo.local": { name: "Mehmet Demir", role: "member" },
    "zeynep@demo.local": { name: "Zeynep Kaya", role: "member" }
  },
  messages: {
    m1: { to: "all", from: "ayse@demo.local", fromName: "Ayşe Yılmaz", text: "Herkes buradaysa toplanma noktası yine parkın önü mü?", at: now - 26 * 3600e3, participants: [] },
    m2: { to: "all", from: "mustafa@demo.local", fromName: "Mustafa Kılıçlar", text: "Evet, park girişi. Su ve el feneri getirmeyi unutmayın.", at: now - 25.5 * 3600e3, participants: [] },
    m3: { to: "mustafa@demo.local", from: "mehmet@demo.local", fromName: "Mehmet Demir", text: "Jeneratörün yakıtını kontrol ettim, iki gün yeter.", at: now - 3 * 3600e3, participants: ["mehmet@demo.local", "mustafa@demo.local"] }
  },
  files: {}, reads: {}, calls: {}, ice: {}
});

export async function createBackend() {
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } };
  let S = load(); if (!S) { S = SEED(); save(); }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { throw new Error("Demo depolama alanı doldu"); } }
  const bc = "BroadcastChannel" in window ? new BroadcastChannel("prepper-demo") : null;
  const watchers = new Set();
  const notify = () => { S = load() || S; watchers.forEach(w => w()); };
  const commit = () => { save(); bc && bc.postMessage(1); setTimeout(notify, 0); };
  if (bc) bc.onmessage = () => notify();
  addEventListener("storage", e => { if (e.key === KEY) notify(); });
  const rid = () => Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  const clone = o => JSON.parse(JSON.stringify(o));
  // Bir koleksiyonu süzer, öncekiyle karşılaştırıp değişiklikleri bildirir
  function watchColl(getColl, filter, cb) {
    let prev = null;
    const run = () => {
      const cur = {}; Object.entries(getColl() || {}).forEach(([id, d]) => { if (filter(d)) cur[id] = JSON.stringify(d); });
      const out = [], initial = prev === null, p = prev || {};
      Object.keys(cur).forEach(id => { if (!(id in p)) out.push({ type: "added", id, data: JSON.parse(cur[id]), pending: false, initial }); else if (p[id] !== cur[id]) out.push({ type: "modified", id, data: JSON.parse(cur[id]), pending: false, initial }); });
      Object.keys(p).forEach(id => { if (!(id in cur)) out.push({ type: "removed", id, data: JSON.parse(p[id]), pending: false, initial }); });
      prev = cur; if (out.length || initial) cb(out);
    };
    watchers.add(run); setTimeout(run, 0);
    return () => watchers.delete(run);
  }
  let user = null; const authCbs = new Set();
  const setUser = u => { user = u; try { u ? sessionStorage.setItem(KEY + "-me", JSON.stringify(u)) : sessionStorage.removeItem(KEY + "-me"); } catch (e) {} authCbs.forEach(cb => cb(u)); };
  try { user = JSON.parse(sessionStorage.getItem(KEY + "-me")); } catch (e) {}

  return {
    mode: "demo",
    onWriteError: null,
    demoPeople: () => Object.entries(S.access).map(([email, m]) => ({ email, name: m.name })),
    demoLogin(email) { const m = S.access[email]; setUser({ uid: "u_" + email.split("@")[0], email, name: m ? m.name : email, verified: true }); },
    demoReset() { localStorage.removeItem(KEY); S = SEED(); commit(); },
    onAuth(cb) { authCbs.add(cb); setTimeout(() => cb(user), 0); return () => authCbs.delete(cb); },
    async loginGoogle() { throw new Error("Demo modunda kişi seçerek giriş yapılır."); },
    async loginEmail() { throw new Error("Demo modunda kişi seçerek giriş yapılır."); },
    async register() { throw new Error("Demo modunda kayıt yoktur."); },
    async resetPassword() {}, async resendVerify() {},
    async reloadUser() { return user; },
    async logout() { setUser(null); },

    watchAccess(cb) { let last = ""; const run = () => { const j = JSON.stringify(S.access); if (j !== last) { last = j; cb(clone(S.access)); } }; watchers.add(run); setTimeout(run, 0); return () => watchers.delete(run); },
    async saveAccess(members) { S.access = clone(members); commit(); },

    watchMessages(email, cb) { return watchColl(() => S.messages, d => d.to === "all" || (d.participants || []).includes(email), cb); },
    sendMessage(m) { const id = rid(); S.messages[id] = clone(m); commit(); return id; },
    async deleteMessage(id) { delete S.messages[id]; commit(); },
    putFile(f) { const id = rid(); S.files[id] = f; commit(); return { id, done: Promise.resolve() }; },
    async getFile(id) { return S.files[id] || null; },
    async deleteFile(id) { delete S.files[id]; commit(); },

    watchReads(uid, cb) { let last = ""; const run = () => { const r = S.reads[uid] || {}; const j = JSON.stringify(r); if (j !== last) { last = j; cb(clone(r)); } }; watchers.add(run); setTimeout(run, 0); return () => watchers.delete(run); },
    setRead(uid, key, ts) { S.reads[uid] = { ...(S.reads[uid] || {}), [key]: ts }; commit(); },

    newCallId: rid,
    async setCall(id, d) { S.calls[id] = clone(d); commit(); },
    async updateCall(id, p) { if (!S.calls[id]) throw new Error("Arama bulunamadı"); Object.assign(S.calls[id], clone(p)); commit(); },
    watchCall(id, cb) { let last = ""; const run = () => { const j = JSON.stringify(S.calls[id] || null); if (j !== last) { last = j; cb(S.calls[id] ? clone(S.calls[id]) : null); } }; watchers.add(run); setTimeout(run, 0); return () => watchers.delete(run); },
    addIce(id, side, c) { const k = rid(); S.ice[k] = { call: id, side, c, at: Date.now() }; commit(); },
    watchIce(id, side, cb) { return watchColl(() => S.ice, d => d.call === id && d.side === side, ch => ch.forEach(x => { if (x.type === "added") cb(x.data.c); })); },
    watchIncoming(email, cb) { return watchColl(() => S.calls, d => d.to === email, ch => ch.forEach(x => { if (x.type !== "removed") cb({ id: x.id, ...x.data }); })); }
  };
}
