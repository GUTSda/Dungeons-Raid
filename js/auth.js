/* auth.js — Login Firebase (Google / Email+Password), cloud save per akun, Daily Login.
   Dimuat sebagai MODULE, taruh SETELAH js/game.js:  <script type="module" src="js/auth.js"></script>
   UI 100% mandiri (CSS di dalam file ini), tidak bergantung style.css. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithPopup, signInWithRedirect, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCqYja9sgr75LM-zmNf_B3XSOjrNwGx-U0",
  authDomain: "dungeon-raids-d899c.firebaseapp.com",
  projectId: "dungeon-raids-d899c",
  storageBucket: "dungeon-raids-d899c.firebasestorage.app",
  messagingSenderId: "654842452612",
  appId: "1:654842452612:web:6c663ccc22762295b880d1",
  measurementId: "G-BK62RCQFY3"
};

const D = window.DSB;
window.__authReady = true;                       // dicek index.html: kalau tidak ada → import gagal
const SAVE_KEY = 'dsb_save_v1', OWNER_KEY = 'dsb_owner';
const app = initializeApp(firebaseConfig), auth = getAuth(app), db = getFirestore(app);
let user = null;

/* =================== DAILY LOGIN: ubah hadiah di sini =================== */
const DAILY = [
  { t: '60 Gold',               i: '🪙', give: (p) => D.addGold(60) },
  { t: '2 Ramuan HP',           i: '🧪', give: (p) => { p.inventory.potions += 2; } },
  { t: '100 Gold',              i: '🪙', give: (p) => D.addGold(100) },
  { t: '1 Ramuan Kekuatan',     i: '💥', give: (p) => { p.inventory.pots.dmg++; } },
  { t: '150 Gold + 2 Ramuan HP', i: '💰', give: (p) => { D.addGold(150); p.inventory.potions += 2; } },
  { t: '1 Ramuan Baja',         i: '🛡️', give: (p) => { p.inventory.pots.def++; } },
  { t: '250 Gold + 1 Kunci Dungeon', i: '🗝️', give: (p) => { D.addGold(250); p.inventory.keys.dungeon = (p.inventory.keys.dungeon || 0) + 1; } }
];
const dstr = (ms) => new Date(ms).toLocaleDateString('en-CA');     // YYYY-MM-DD (zona waktu perangkat)

/* =================== UI (mandiri) =================== */
const css = document.createElement('style');
css.textContent = `
.dr-ov{position:fixed;inset:0;z-index:99990;display:none;align-items:center;justify-content:center;padding:16px;overflow:auto;touch-action:auto;
  font-family:"Trebuchet MS","Segoe UI",Arial,sans-serif;color:#f2efe2;-webkit-user-select:none;user-select:none}
.dr-ov.on{display:flex}
.dr-ov *{box-sizing:border-box;margin:0;padding:0}
#drGate{background:radial-gradient(ellipse at 50% 30%,#3a1d12 0%,#1a0f0b 45%,#07070a 100%)}
#drGate::before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.18) 0 2px,transparent 2px 4px);pointer-events:none}
.dr-ember{position:absolute;bottom:-10px;width:6px;height:6px;border-radius:50%;background:#ff9a3a;box-shadow:0 0 10px 3px #ff6a1a;opacity:0;animation:drUp linear infinite;pointer-events:none}
@keyframes drUp{0%{opacity:0;transform:translateY(0) scale(1)}15%{opacity:.9}100%{opacity:0;transform:translateY(-105vh) translateX(var(--dx)) scale(.3)}}
.dr-wrap{position:relative;width:min(440px,100%);margin:auto;z-index:1;animation:drIn .5s cubic-bezier(.2,.9,.3,1.2)}
@keyframes drIn{from{opacity:0;transform:translateY(24px) scale(.96)}to{opacity:1;transform:none}}
.dr-logo{text-align:center;margin-bottom:18px}
.dr-logo small{display:block;font-size:13px;font-weight:900;letter-spacing:8px;color:#ff8a4a;text-shadow:0 2px 0 #000}
.dr-logo h1{font-size:clamp(40px,11vw,60px);line-height:.95;font-weight:900;letter-spacing:3px;text-transform:uppercase;
  background:linear-gradient(180deg,#fff4c2 0%,#ffc83d 45%,#e8731e 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 4px 0 #000) drop-shadow(0 0 18px rgba(255,120,30,.55))}
.dr-panel{background:linear-gradient(180deg,#2b2a23,#1b1b16);border:4px solid #0b0b08;box-shadow:0 0 0 3px #e8b94a,0 0 0 6px #0b0b08,0 22px 50px rgba(0,0,0,.7);padding:22px 22px 18px}
.dr-tabs{display:flex;margin-bottom:18px;border:3px solid #0b0b08;background:#0b0b08;gap:3px}
.dr-tab{flex:1;padding:11px 0;text-align:center;font-weight:900;font-size:15px;letter-spacing:2px;text-transform:uppercase;cursor:pointer;background:#33332a;color:#9a9a88;transition:.15s}
.dr-tab.on{background:linear-gradient(180deg,#ffc83d,#e8931e);color:#1a1205;text-shadow:0 1px 0 #fff6}
.dr-btn{display:block;width:100%;border:3px solid #0b0b08;font:inherit;font-weight:900;font-size:16px;letter-spacing:1.5px;text-transform:uppercase;padding:13px 14px;cursor:pointer;
  box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -4px 0 rgba(0,0,0,.28),0 4px 0 #000;transition:transform .08s,filter .15s}
.dr-btn:hover{filter:brightness(1.12)}.dr-btn:active{transform:translateY(3px);box-shadow:inset 0 3px 0 rgba(255,255,255,.35),inset 0 -4px 0 rgba(0,0,0,.28),0 1px 0 #000}
.dr-btn:disabled{opacity:.55;cursor:wait}
.dr-google{background:#fff;color:#222;display:flex;align-items:center;justify-content:center;gap:12px}
.dr-google svg{width:22px;height:22px}
.dr-go{background:linear-gradient(180deg,#8fd25a,#4d7a2c);color:#0c1a05;margin-top:12px;text-shadow:0 1px 0 #fff5}
.dr-or{display:flex;align-items:center;gap:12px;margin:16px 0;color:#8a8a78;font-size:12px;font-weight:bold;letter-spacing:3px}
.dr-or::before,.dr-or::after{content:"";flex:1;height:2px;background:#3d3d33}
.dr-lb{display:block;font-size:12px;font-weight:900;letter-spacing:2px;color:#e8b94a;margin:12px 0 5px;text-transform:uppercase}
.dr-in{width:100%;font:inherit;font-size:16px;font-weight:bold;color:#fff;background:#0d0d0a;border:3px solid #4a4a3c;padding:12px 13px;outline:none;-webkit-user-select:text;user-select:text;transition:border-color .15s,box-shadow .15s}
.dr-in::placeholder{color:#5c5c4e;font-weight:normal}
.dr-in:focus{border-color:#ffc83d;box-shadow:0 0 0 3px rgba(255,200,61,.22)}
.dr-pw{position:relative}.dr-pw .dr-in{padding-right:48px}
.dr-eye{position:absolute;right:0;top:0;bottom:0;width:46px;background:none;border:0;color:#c9c9b4;font-size:18px;cursor:pointer}
.dr-msg{min-height:20px;margin-top:12px;text-align:center;font-size:13px;font-weight:bold;color:#ff6a5a}
.dr-msg.ok{color:#8fe36b}
.dr-foot{margin-top:6px;text-align:center}
.dr-foot a{color:#7cc0f0;font-size:13px;font-weight:bold;cursor:pointer;text-decoration:underline}
.dr-hint{text-align:center;margin-top:14px;font-size:11px;color:#7a7a68;letter-spacing:1px}
/* chip akun */
#drChip{position:fixed;left:6px;top:6px;z-index:99980;display:none;align-items:center;gap:6px;padding:3px 4px 3px 9px;background:rgba(0,0,0,.65);border:2px solid #4a4a3c;
  font:bold 11px "Trebuchet MS",Arial,sans-serif;color:#e6e4d8;opacity:.55;max-width:60vw}
#drChip:hover{opacity:1}#drChip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#drChip button{font:inherit;font-size:11px;color:#fff;background:#7a2f27;border:2px solid #0b0b08;padding:3px 8px;cursor:pointer}
/* daily */
#drDaily{background:rgba(5,5,8,.86)}
.dr-daily{position:relative;width:min(700px,100%);margin:auto;animation:drIn .45s cubic-bezier(.2,.9,.3,1.2)}
.dr-daily h2{text-align:center;font-size:clamp(26px,6vw,36px);font-weight:900;letter-spacing:4px;text-transform:uppercase;
  background:linear-gradient(180deg,#fff4c2,#ffc83d 50%,#e8731e);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 3px 0 #000)}
.dr-sub{text-align:center;color:#b9b9a4;font-size:13px;margin:6px 0 16px}
.dr-sub b{color:#ffc83d}
.dr-days{display:grid;grid-template-columns:repeat(auto-fit,minmax(84px,1fr));gap:8px;margin-bottom:18px}
.dr-day{background:#0d0d0a;border:3px solid #3d3d33;padding:8px 4px 10px;text-align:center;font-size:11px;font-weight:bold;line-height:1.3;color:#b9b9a4}
.dr-day b{display:block;font-size:10px;letter-spacing:2px;color:#7a7a68;margin-bottom:4px}
.dr-day span{display:block;font-size:30px;margin-bottom:4px}
.dr-day.done{opacity:.4}.dr-day.done span{color:#8fe36b}
.dr-day.today{border-color:#ffc83d;background:#3a3014;color:#fff;box-shadow:0 0 0 2px #000,0 0 18px rgba(255,200,61,.55);animation:drPulse 1.2s ease-in-out infinite}
.dr-day.today b{color:#ffc83d}
@keyframes drPulse{50%{transform:scale(1.06)}}
.dr-claim{background:linear-gradient(180deg,#ffc83d,#e8731e);color:#1a1205;font-size:18px;padding:15px}
`;
document.head.appendChild(css);

const mk = (tag, id, cls) => { const e = document.createElement(tag); if (id) e.id = id; if (cls) e.className = cls; document.body.appendChild(e); return e; };
const gate = mk('div', 'drGate', 'dr-ov');
const daily = mk('div', 'drDaily', 'dr-ov');
const chip = mk('div', 'drChip');
const GSVG = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.6 0 20.2 0 24s.9 7.4 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';
gate.innerHTML = `<div class="dr-wrap">
  <div class="dr-logo"><small>⚔ ENTER THE ⚔</small><h1>Dungeon<br>Raids</h1></div>
  <div class="dr-panel">
    <div class="dr-tabs"><div class="dr-tab on" id="drTabL">Masuk</div><div class="dr-tab" id="drTabR">Daftar</div></div>
    <button class="dr-btn dr-google" id="drGoogle">${GSVG}<span>Lanjut dengan Google</span></button>
    <div class="dr-or">ATAU EMAIL</div>
    <label class="dr-lb" for="drEmail">Email</label>
    <input class="dr-in" id="drEmail" type="email" placeholder="kamu@email.com" autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false">
    <label class="dr-lb" for="drPass">Password</label>
    <div class="dr-pw"><input class="dr-in" id="drPass" type="password" placeholder="Minimal 6 karakter" autocomplete="current-password"><button class="dr-eye" id="drEye" type="button" aria-label="Lihat password">👁</button></div>
    <button class="dr-btn dr-go" id="drSubmit">Masuk</button>
    <div class="dr-msg" id="drMsg"></div>
    <div class="dr-foot"><a id="drReset">Lupa password?</a></div>
  </div>
  <div class="dr-hint">PROGRESS KAMU TERSIMPAN DI AKUN</div></div>`;
for (let i = 0; i < 16; i++) {                     // percikan api dekoratif
  const e = document.createElement('i'); e.className = 'dr-ember';
  e.style.cssText = `left:${Math.random() * 100}%;animation-duration:${5 + Math.random() * 7}s;animation-delay:${-Math.random() * 10}s;--dx:${(Math.random() - .5) * 120}px;width:${3 + Math.random() * 5}px;height:${3 + Math.random() * 5}px`;
  gate.appendChild(e);
}

const $ = (id) => document.getElementById(id);
let mode = 'login';
const msg = (t, ok) => { const m = $('drMsg'); m.textContent = t || ''; m.className = 'dr-msg' + (ok ? ' ok' : ''); };
const ERR = {
  'auth/invalid-email': 'Format email salah.', 'auth/missing-password': 'Isi password dulu.', 'auth/missing-email': 'Isi email dulu.',
  'auth/invalid-credential': 'Email atau password salah.', 'auth/wrong-password': 'Email atau password salah.', 'auth/user-not-found': 'Akun tidak ditemukan.',
  'auth/email-already-in-use': 'Email sudah terdaftar, silakan Masuk.', 'auth/weak-password': 'Password minimal 6 karakter.',
  'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti.', 'auth/network-request-failed': 'Koneksi bermasalah.',
  'auth/operation-not-allowed': 'Metode login ini belum diaktifkan di Firebase.', 'auth/unauthorized-domain': 'Domain ini belum diizinkan di Firebase (Authorized domains).',
  'auth/popup-closed-by-user': '', 'auth/cancelled-popup-request': ''
};
const fail = (e) => msg(ERR[e.code] !== undefined ? ERR[e.code] : 'Gagal: ' + (e.code || e.message));
const busy = (b) => { for (const id of ['drSubmit', 'drGoogle']) $(id).disabled = b; };

function setMode(m) {
  mode = m; msg();
  $('drTabL').classList.toggle('on', m === 'login'); $('drTabR').classList.toggle('on', m === 'register');
  $('drSubmit').textContent = m === 'login' ? 'Masuk' : 'Buat Akun';
  $('drPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
}
$('drTabL').onclick = () => setMode('login');
$('drTabR').onclick = () => setMode('register');
$('drEye').onclick = () => { const p = $('drPass'); p.type = p.type === 'password' ? 'text' : 'password'; };
$('drSubmit').onclick = async () => {
  const e = $('drEmail').value.trim(), p = $('drPass').value; msg(); busy(true);
  try { await (mode === 'login' ? signInWithEmailAndPassword(auth, e, p) : createUserWithEmailAndPassword(auth, e, p)); } catch (x) { fail(x); }
  busy(false);
};
for (const id of ['drEmail', 'drPass']) $(id).addEventListener('keydown', (ev) => { ev.stopPropagation(); if (ev.key === 'Enter') $('drSubmit').click(); });
for (const id of ['drEmail', 'drPass']) $(id).addEventListener('keyup', (ev) => ev.stopPropagation());
$('drGoogle').onclick = async () => {
  msg(); busy(true); const pr = new GoogleAuthProvider();
  try { await signInWithPopup(auth, pr); }
  catch (x) { if (x.code === 'auth/popup-blocked') signInWithRedirect(auth, pr); else fail(x); }
  busy(false);
};
$('drReset').onclick = async () => {
  const e = $('drEmail').value.trim(); if (!e) return msg('Isi email dulu, lalu klik Lupa password.');
  try { await sendPasswordResetEmail(auth, e); msg('Email reset password sudah dikirim.', true); } catch (x) { fail(x); }
};

/* =================== CLOUD SAVE =================== */
const ref = () => doc(db, 'saves', user.uid);
let timer = null, dirty = false;
async function push() {
  if (!user) return; const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
  dirty = false;
  try { await setDoc(ref(), { save: raw, updated: serverTimestamp() }); } catch (e) { dirty = true; console.warn('cloud save gagal', e); }
}
function schedule() { if (!user) return; dirty = true; clearTimeout(timer); timer = setTimeout(push, 4000); }
const origSave = D.save;
D.save = function () { origSave(); schedule(); };
const flush = () => { if (dirty) { clearTimeout(timer); push(); } };
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
window.addEventListener('pagehide', flush);

/* Dipanggil setelah login: tentukan save mana yang dipakai. Kalau save lokal diganti → reload agar game memuat save baru. */
async function syncLogin() {
  let cloud = null;
  try { const s = await getDoc(ref()); if (s.exists()) cloud = s.data().save; }
  catch (e) { console.warn(e); alert('Gagal membaca cloud save. Cek Firestore sudah dibuat dan rules-nya terpasang.'); }
  const local = localStorage.getItem(SAVE_KEY), owner = localStorage.getItem(OWNER_KEY), uid = user.uid;
  let swap = false;
  if (owner === uid) { if (!local && cloud) { localStorage.setItem(SAVE_KEY, cloud); swap = true; } else if (local) await push(); }
  else if (cloud) {
    if (local && !owner && !confirm('Ada save di perangkat ini DAN di akun ini.\nOK = pakai save akun (save perangkat dihapus)\nBatal = timpa akun dengan save perangkat')) await push();
    else { localStorage.setItem(SAVE_KEY, cloud); swap = true; }
  } else {
    if (owner && local) { localStorage.removeItem(SAVE_KEY); swap = true; }      // save milik akun lain → akun baru mulai bersih
    else if (local) await push();                                                 // save lokal anonim → jadi milik akun ini
  }
  localStorage.setItem(OWNER_KEY, uid);
  if (swap) location.reload();
}

/* =================== AKUN / LOGOUT =================== */
function showChip() {
  chip.style.display = 'flex';
  chip.innerHTML = `<span></span><button id="drOut">Keluar</button>`;
  chip.firstChild.textContent = '👤 ' + (user.displayName || user.email || '');
  $('drOut').onclick = async () => {
    if (!confirm('Keluar dari akun?')) return;
    clearTimeout(timer); await push();
    localStorage.removeItem(SAVE_KEY); localStorage.removeItem(OWNER_KEY);
    await signOut(auth); location.reload();
  };
}

/* =================== DAILY LOGIN =================== */
let dailyShown = false;
function dailyInfo(p) {
  const today = dstr(Date.now()), d = p.daily || { last: null, streak: 0 };
  if (d.last === today) return null;
  const streak = d.last === dstr(Date.now() - 864e5) ? d.streak + 1 : 1;
  return { today, streak, idx: (streak - 1) % DAILY.length };
}
function showDaily() {
  const p = D.state, info = dailyInfo(p); if (!info) return;
  dailyShown = true;
  daily.innerHTML = `<div class="dr-daily"><div class="dr-panel">
    <h2>🎁 Daily Login</h2>
    <div class="dr-sub">Streak <b>${info.streak} hari</b> · absen putus kalau sehari terlewat</div>
    <div class="dr-days">${DAILY.map((r, i) => `<div class="dr-day ${i < info.idx ? 'done' : i === info.idx ? 'today' : ''}"><b>HARI ${i + 1}</b><span>${i < info.idx ? '✔' : r.i}</span>${r.t}</div>`).join('')}</div>
    <button class="dr-btn dr-claim" id="drClaim">Klaim Hadiah</button></div></div>`;
  daily.classList.add('on');
  $('drClaim').onclick = () => {
    const fresh = dailyInfo(D.state); if (!fresh) { daily.classList.remove('on'); return; }       // cegah klaim ganda
    DAILY[fresh.idx].give(D.state);
    D.state.daily = { last: fresh.today, streak: fresh.streak };
    D.save(); daily.classList.remove('on');
    const t = document.getElementById('toast'); if (t) { t.textContent = `🎁 Daily Login: ${DAILY[fresh.idx].t}`; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 2800); }
  };
}
/* tunggu sampai pemain punya karakter & sedang tidak di dalam dungeon, lalu tampilkan popup sekali per sesi */
setInterval(() => {
  if (!user || dailyShown || !D.state || D.run || gate.classList.contains('on')) return;
  if (dailyInfo(D.state)) showDaily(); else dailyShown = true;
}, 1500);

/* =================== START =================== */
gate.classList.add('on');                           // tampil langsung, tanpa menunggu Firebase (hindari kilatan game tanpa login)
onAuthStateChanged(auth, async (u) => {
  user = u;
  if (!u) { gate.classList.add('on'); chip.style.display = 'none'; return; }
  gate.classList.remove('on'); showChip(); await syncLogin();
});
