// Prepper Support — ses modemi
// Veriyi hoparlörden çalınan kısa tonlara çevirir, mikrofondan dinleyip geri çözer. İnternet gerekmez.
// Yöntem: 18 tonlu MFSK (her sembol 4 bit). Bir sembol, kendinden önceki iki sembolün tonunu asla kullanmaz;
// böylece odadaki yankı sonraki sembolleri bozamaz, başlangıç işareti, Reed–Solomon hata düzeltme ve CRC-16.
// Tarayıcıya bağımlı değildir; aynı dosya testte Node ile de çalışır.

/* ---------- ayarlar ---------- */
export const BANDS = {
  low: { f0: 1500, df: 150, label: "Duyulur (1,5–4 kHz)" },      // en güvenilir
  high: { f0: 15000, df: 150, label: "Yüksek (15–17,5 kHz)" }     // daha az duyulur, bazı telefonlarda zayıf
};
export const SPEEDS = { fast: 0.05, normal: 0.08, robust: 0.12 }; // sembol süresi (saniye)
const ND = 18;            // veri tonları 0..17
const NT = 20;            // + 2 başlangıç tonu
const SA = 18, SB = 19;   // başlangıç işareti: A B A B
const P1 = 17, P2 = 16;   // zincirin başlangıçtaki "önceki iki tonu"
// önceki iki ton dışında kalan tonlar (en az 16 tane), küçükten büyüğe
const cands = (p1, p2) => { const o = []; for (let t = 0; t < ND; t++) if (t !== p1 && t !== p2) o.push(t); return o; };
const PRE = [SA, SB, SA, SB];
const HDR_PAR = 4, BODY_PAR = 8;
export const MAX_PAYLOAD = 100;

/* ---------- GF(256) ve Reed–Solomon ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(() => { let x = 1; for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
const mul = (a, b) => (a && b) ? EXP[LOG[a] + LOG[b]] : 0;
const div = (a, b) => a ? EXP[(LOG[a] + 255 - LOG[b]) % 255] : 0;
const pow = (x, p) => EXP[(((LOG[x] * p) % 255) + 255) % 255];
const inv = x => EXP[255 - LOG[x]];
const pScale = (p, x) => p.map(c => mul(c, x));
function pAdd(p, q) { const r = new Array(Math.max(p.length, q.length)).fill(0); p.forEach((c, i) => r[i + r.length - p.length] = c); q.forEach((c, i) => r[i + r.length - q.length] ^= c); return r; }
function pMul(p, q) { const r = new Array(p.length + q.length - 1).fill(0); for (let j = 0; j < q.length; j++) for (let i = 0; i < p.length; i++) r[i + j] ^= mul(p[i], q[j]); return r; }
function pEval(p, x) { let y = p[0]; for (let i = 1; i < p.length; i++) y = mul(y, x) ^ p[i]; return y; }
function pDivRem(a, b) { const o = a.slice(); for (let i = 0; i < a.length - (b.length - 1); i++) { const c = o[i]; if (c) for (let j = 1; j < b.length; j++) if (b[j]) o[i + j] ^= mul(b[j], c); } return o.slice(o.length - (b.length - 1)); }
const GEN = {};
function gen(n) { if (GEN[n]) return GEN[n]; let g = [1]; for (let i = 0; i < n; i++) g = pMul(g, [1, pow(2, i)]); return GEN[n] = g; }
export function rsEncode(msg, n) {
  const g = gen(n), o = [...msg, ...new Array(n).fill(0)];
  for (let i = 0; i < msg.length; i++) { const c = o[i]; if (c) for (let j = 1; j < g.length; j++) o[i + j] ^= mul(g[j], c); }
  return [...msg, ...o.slice(msg.length)];
}
const synd = (m, n) => [0, ...Array.from({ length: n }, (_, i) => pEval(m, pow(2, i)))];
// Düzeltilmiş veriyi ve düzeltilen bayt sayısını döndürür; düzeltilemezse null
export function rsDecode(msgIn, n) {
  let m = Array.from(msgIn);
  let s = synd(m, n);
  if (s.every(v => v === 0)) return { data: m.slice(0, m.length - n), fixed: 0 };
  // Berlekamp–Massey
  let loc = [1], old = [1];
  for (let i = 0; i < n; i++) {
    const K = i + 1; let d = s[K];
    for (let j = 1; j < loc.length; j++) d ^= mul(loc[loc.length - 1 - j], s[K - j]);
    old = [...old, 0];
    if (d) { if (old.length > loc.length) { const nl = pScale(old, d); old = pScale(loc, inv(d)); loc = nl; } loc = pAdd(loc, pScale(old, d)); }
  }
  while (loc.length && loc[0] === 0) loc.shift();
  const errs = loc.length - 1; if (errs * 2 > n) return null;
  // Chien
  const rl = loc.slice().reverse(), pos = [];
  for (let i = 0; i < m.length; i++) if (pEval(rl, pow(2, i)) === 0) pos.push(m.length - 1 - i);
  if (pos.length !== errs) return null;
  // Forney
  const cpos = pos.map(p => m.length - 1 - p);
  let eloc = [1]; for (const i of cpos) eloc = pMul(eloc, pAdd([1], [pow(2, i), 0]));
  const ev = pDivRem(pMul(s.slice().reverse(), eloc), [1, ...new Array(eloc.length).fill(0)]).reverse();
  const X = cpos.map(c => pow(2, -(255 - c)));
  const E = new Array(m.length).fill(0);
  for (let i = 0; i < X.length; i++) {
    const xi = inv(X[i]); let lp = 1;
    for (let j = 0; j < X.length; j++) if (j !== i) lp = mul(lp, 1 ^ mul(xi, X[j]));
    if (!lp) return null;
    const y = mul(X[i], pEval(ev.slice().reverse(), xi));
    E[pos[i]] = div(y, lp);
  }
  m = pAdd(m, E);
  if (synd(m, n).some(v => v !== 0)) return null;
  return { data: m.slice(0, m.length - n), fixed: errs };
}

/* ---------- CRC-16 (CCITT) ---------- */
export function crc16(b) { let c = 0xffff; for (const x of b) { c ^= x << 8; for (let k = 0; k < 8; k++) c = c & 0x8000 ? ((c << 1) ^ 0x1021) & 0xffff : (c << 1) & 0xffff; } return c; }

/* ---------- çerçeve ---------- */
// [A B A B] + başlık(uzunluk, bayrak + 4 RS) + gövde(veri + CRC16 + 8 RS); her bayt 2 sembol
// 4 bitlik değer v → önceki iki ton dışındaki tonlardan v'inci
function toTones(bytes) { let p1 = P1, p2 = P2; return bytes.flatMap(b => [b >> 4, b & 15]).map(v => { const t = cands(p1, p2)[v]; p2 = p1; p1 = t; return t; }); }
export function frameSymbols(payload, flags = 0) {
  if (payload.length > MAX_PAYLOAD) throw new Error("Mesaj çok uzun");
  const c = crc16(payload);
  const head = rsEncode([payload.length, flags & 255], HDR_PAR);
  const body = rsEncode([...payload, c >> 8, c & 255], BODY_PAR);
  return [...PRE, ...toTones(head), ...toTones(body)];
}
export const frameSeconds = (len, T) => (4 + 2 * (2 + HDR_PAR) + 2 * (len + 2 + BODY_PAR)) * T + 0.4;

/* ---------- verici ---------- */
export function synth(payload, { sampleRate, band = "low", T = SPEEDS.normal, flags = 0, amp = 0.6 }) {
  const { f0, df } = BANDS[band];
  const syms = frameSymbols(payload, flags);
  const N = Math.round(T * sampleRate), lead = Math.round(0.15 * sampleRate), tail = Math.round(0.25 * sampleRate);
  const ramp = Math.max(1, Math.round(0.006 * sampleRate));
  const out = new Float32Array(lead + syms.length * N + tail);
  syms.forEach((s, k) => {
    const w = 2 * Math.PI * (f0 + s * df) / sampleRate, base = lead + k * N;
    for (let i = 0; i < N; i++) {
      const e = i < ramp ? 0.5 - 0.5 * Math.cos(Math.PI * i / ramp) : i > N - ramp ? 0.5 - 0.5 * Math.cos(Math.PI * (N - i) / ramp) : 1;
      out[base + i] = amp * e * Math.sin(w * i);
    }
  });
  return out;
}

/* ---------- alıcı ---------- */
// push(samples) ile ses parçaları verilir; onFrame({payload, flags, fixed}) ve onBad() olayları üretir.
export class Receiver {
  constructor({ sampleRate, band = "low", T = SPEEDS.normal, onFrame, onBad, onLevels }) {
    const { f0, df } = BANDS[band];
    this.N = Math.round(T * sampleRate); this.H = Math.round(this.N / 4); this.W = Math.round(this.N * 0.7);
    this.coef = Float64Array.from({ length: NT }, (_, t) => 2 * Math.cos(2 * Math.PI * (f0 + t * df) / sampleRate));
    this.win = Float32Array.from({ length: this.W }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (this.W - 1)));
    this.buf = new Float32Array(0); this.bufStart = 0;   // bufStart: buf[0]'ın mutlak örnek numarası
    this.feat = []; this.featStart = 0;                   // her adım için 18 tonun enerjisi
    this.scan = 0;                                        // başlangıç işareti aramasının vardığı adım
    this.pending = null;
    this.onFrame = onFrame || (() => {}); this.onBad = onBad || (() => {}); this.onLevels = onLevels || (() => {});
  }
  push(chunk) {
    const nb = new Float32Array(this.buf.length + chunk.length); nb.set(this.buf); nb.set(chunk, this.buf.length); this.buf = nb;
    // yeni adımların özelliklerini hesapla
    let h = this.featStart + this.feat.length;
    while (h * this.H + this.W <= this.bufStart + this.buf.length) { this.feat.push(this.energies(h * this.H - this.bufStart)); h++; }
    if (this.feat.length) this.onLevels(this.feat[this.feat.length - 1]);
    this.decode();
    // eski veriyi at (yaklaşık son 3 çerçeve kadar tut)
    const keepH = Math.max(this.featStart, Math.min(this.scan, (this.pending ? this.pending.h : this.scan)) - 8);
    if (keepH > this.featStart) { this.feat.splice(0, keepH - this.featStart); this.featStart = keepH; }
    const keepS = Math.max(this.bufStart, (this.featStart + this.feat.length) * this.H - this.N * 2);
    if (keepS > this.bufStart) { this.buf = this.buf.slice(keepS - this.bufStart); this.bufStart = keepS; }
  }
  energies(off) {
    const e = new Float32Array(NT), W = this.W, b = this.buf, w = this.win;
    for (let t = 0; t < NT; t++) {
      const c = this.coef[t]; let s1 = 0, s2 = 0;
      for (let i = 0; i < W; i++) { const s0 = b[off + i] * w[i] + c * s1 - s2; s2 = s1; s1 = s0; }
      e[t] = s1 * s1 + s2 * s2 - c * s1 * s2;
    }
    return e;
  }
  F(h) { return this.feat[h - this.featStart]; }
  have(h) { return h >= this.featStart && h < this.featStart + this.feat.length; }
  // Başlangıç işareti: her adımda beklenen ton en güçlüsü olmalı (bir önceki işaret tonunun yankısı sayılmaz)
  // ve toplam enerjinin anlamlı bir kısmını taşımalı.
  isPre(h) {
    for (let k = 0; k < 4; k++) {
      const e = this.F(h + 4 * k), want = PRE[k], skip = k ? PRE[k - 1] : -1; let s = 0;
      for (let t = 0; t < NT; t++) if (t !== skip) { s += e[t]; if (e[t] > e[want]) return false; }
      if (!(e[want] > 0.25 * s && e[want] > 1e-7)) return false;
    }
    return true;
  }
  // Önceki iki sembolün tonları hariç en güçlü veri tonu (yankının etkisini ortadan kaldırır)
  bytesAt(h0, n) {
    let p1 = P1, p2 = P2; const v = [];
    for (let k = 0; k < 2 * n; k++) {
      const e = this.F(h0 + 4 * k), c = cands(p1, p2); let b = 0;
      for (let i = 1; i < c.length; i++) if (e[c[i]] > e[c[b]]) b = i;
      v.push(b & 15); p2 = p1; p1 = c[b];
    }
    const o = []; for (let i = 0; i < n; i++) o.push((v[2 * i] << 4) | v[2 * i + 1]); return o;
  }
  decode() {
    for (;;) {
      if (this.pending) {
        const p = this.pending, hb = p.h + 16, hdrBytes = 2 + HDR_PAR;
        if (!p.head) {
          if (!this.have(hb + 8 * hdrBytes)) return;
          const r = rsDecode(this.bytesAt(hb, hdrBytes), HDR_PAR);
          if (!r || r.data[0] > MAX_PAYLOAD) { this.pending = null; this.scan = p.e + 1; continue; }
          p.head = r; p.len = r.data[0]; p.flags = r.data[1];
        }
        const hd = hb + 8 * hdrBytes, nb = p.len + 2 + BODY_PAR;
        if (!this.have(hd + 8 * nb)) return;
        const r = rsDecode(this.bytesAt(hd, nb), BODY_PAR);
        const ok = r && crc16(r.data.slice(0, p.len)) === ((r.data[p.len] << 8) | r.data[p.len + 1]);
        if (ok) { this.onFrame({ payload: Uint8Array.from(r.data.slice(0, p.len)), flags: p.flags, fixed: r.fixed + p.head.fixed }); this.scan = hd + 8 * nb; }
        else { this.onBad(); this.scan = p.e + 1; }
        this.pending = null; continue;
      }
      // başlangıç işaretini ara: koşulu sağlayan ardışık adımların ortasını seç
      if (this.scan < this.featStart) this.scan = this.featStart;
      let found = -1;
      while (this.have(this.scan + 12 + 1)) {
        if (this.isPre(this.scan)) {
          let e = this.scan; while (this.have(e + 13) && this.isPre(e + 1)) e++;
          if (!this.have(e + 13)) return;      // koşu henüz bitmedi, daha fazla veri bekle
          found = Math.round((this.scan + e) / 2); this.runEnd = e; break;
        }
        this.scan++;
      }
      if (found < 0) return;
      this.pending = { h: found, e: this.runEnd };
    }
  }
}

/* ---------- şifreleme (grup anahtarı) ---------- */
// AES-GCM, 12 bayt IV, 8 bayt doğrulama etiketi (mesaja 20 bayt ekler); anahtar paroladan PBKDF2 ile türetilir.
export async function keyFrom(pass, crypto = globalThis.crypto) {
  const raw = await crypto.subtle.importKey("raw", new TextEncoder().encode(pass), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: new TextEncoder().encode("prepper-support/ses/v1"), iterations: 60000, hash: "SHA-256" }, raw, { name: "AES-GCM", length: 128 }, false, ["encrypt", "decrypt"]);
}
export async function seal(key, data, crypto = globalThis.crypto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, tagLength: 64 }, key, data));
  const o = new Uint8Array(12 + ct.length); o.set(iv); o.set(ct, 12); return o;
}
export async function open(key, data, crypto = globalThis.crypto) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: data.slice(0, 12), tagLength: 64 }, key, data.slice(12)));
}
