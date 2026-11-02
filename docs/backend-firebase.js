// Prepper Support — Firebase arka ucu
// Uygulama bu dosyadaki fonksiyonları kullanır; demo modunda backend-demo.js aynı arayüzü sunar.
const V = "10.12.2";
const G = `https://www.gstatic.com/firebasejs/${V}/`;

export async function createBackend(firebaseConfig) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(G + "firebase-app.js"), import(G + "firebase-auth.js"), import(G + "firebase-firestore.js")
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  // Çevrim dışı önbellek: internet kesilince yazılan mesajlar telefonda sıraya alınır, bağlantı gelince gönderilir.
  let fs;
  try { fs = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) }); }
  catch (e) { fs = F.getFirestore(app); }
  const { collection, doc, onSnapshot, setDoc, updateDoc, deleteDoc, getDoc, query, where } = F;
  const lower = s => String(s || "").trim().toLowerCase();
  const toUser = u => u ? { uid: u.uid, email: lower(u.email), name: u.displayName || "", verified: !!u.emailVerified } : null;
  const changes = (snap, initial) => snap.docChanges({ includeMetadataChanges: true }).map(ch => ({
    type: ch.type, id: ch.doc.id, data: ch.doc.data(), pending: ch.doc.metadata.hasPendingWrites, initial
  }));
  // Sunucu yanıtını beklemeden yazar; çevrim dışıyken de anında ekranda görünür.
  const fire = p => p.catch(e => { api.onWriteError && api.onWriteError(e); throw e; });

  getRedirectSafe();
  async function getRedirectSafe() { try { await A.getRedirectResult(auth); } catch (e) {} }

  const api = {
    mode: "firebase",
    onWriteError: null,
    onAuth(cb) { return A.onAuthStateChanged(auth, u => cb(toUser(u))); },
    async loginGoogle() {
      const p = new A.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
      if (standalone) return A.signInWithRedirect(auth, p);
      try { await A.signInWithPopup(auth, p); }
      catch (e) { if (e.code === "auth/popup-blocked") return A.signInWithRedirect(auth, p); throw e; }
    },
    loginEmail: (e, p) => A.signInWithEmailAndPassword(auth, lower(e), p),
    async register(name, e, p) {
      const c = await A.createUserWithEmailAndPassword(auth, lower(e), p);
      await A.updateProfile(c.user, { displayName: name });
      await A.sendEmailVerification(c.user);
    },
    resetPassword: e => A.sendPasswordResetEmail(auth, lower(e)),
    resendVerify: () => auth.currentUser && A.sendEmailVerification(auth.currentUser),
    async reloadUser() { if (!auth.currentUser) return null; await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return toUser(auth.currentUser); },
    logout: () => A.signOut(auth),

    watchAccess(cb, err) {
      return onSnapshot(doc(fs, "config", "access"), s => cb(s.exists() ? (s.data().members || {}) : {}), err);
    },
    saveAccess: members => setDoc(doc(fs, "config", "access"), { members }),

    watchMessages(email, cb, err) {
      const first = { a: true, b: true };
      const h = k => s => { const ini = first[k]; first[k] = false; cb(changes(s, ini)); };
      const u1 = onSnapshot(query(collection(fs, "messages"), where("to", "==", "all")), { includeMetadataChanges: true }, h("a"), err);
      const u2 = onSnapshot(query(collection(fs, "messages"), where("participants", "array-contains", email)), { includeMetadataChanges: true }, h("b"), err);
      return () => { u1(); u2(); };
    },
    sendMessage(m) { const ref = doc(collection(fs, "messages")); fire(setDoc(ref, m)).catch(() => {}); return ref.id; },
    deleteMessage: id => deleteDoc(doc(fs, "messages", id)),
    putFile(f) { const ref = doc(collection(fs, "msg_files")); const p = fire(setDoc(ref, f)); p.catch(() => {}); return { id: ref.id, done: p }; },
    async getFile(id) { const s = await getDoc(doc(fs, "msg_files", id)); return s.exists() ? s.data() : null; },
    deleteFile: id => deleteDoc(doc(fs, "msg_files", id)),

    watchReads(uid, cb) { return onSnapshot(doc(fs, "reads", uid), s => cb(s.exists() ? (s.data().convs || {}) : {}), () => {}); },
    setRead(uid, key, ts) { setDoc(doc(fs, "reads", uid), { convs: { [key]: ts } }, { merge: true }).catch(() => {}); },

    newCallId: () => doc(collection(fs, "calls")).id,
    setCall: (id, d) => setDoc(doc(fs, "calls", id), d),
    updateCall: (id, p) => updateDoc(doc(fs, "calls", id), p),
    watchCall(id, cb) { return onSnapshot(doc(fs, "calls", id), s => cb(s.exists() ? s.data() : null), () => {}); },
    addIce(id, side, c) { setDoc(doc(collection(fs, `calls/${id}/ice`)), { side, c, at: Date.now() }).catch(() => {}); },
    watchIce(id, side, cb) {
      return onSnapshot(query(collection(fs, `calls/${id}/ice`), where("side", "==", side)),
        s => s.docChanges().forEach(ch => { if (ch.type === "added") cb(ch.doc.data().c); }), () => {});
    },
    watchIncoming(email, cb) {
      return onSnapshot(query(collection(fs, "calls"), where("to", "==", email)),
        s => s.docChanges().forEach(ch => cb({ id: ch.doc.id, ...ch.doc.data() })), () => {});
    }
  };
  return api;
}
