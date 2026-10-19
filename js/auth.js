/* auth.js — Login Firebase (Google / Email+Password), cloud save per akun, Daily Login.
   Dimuat sebagai MODULE, taruh SETELAH js/game.js:  <script type="module" src="js/auth.js"></script>
   Tidak perlu ubah game.js: sync dilakukan dengan membungkus D.save(). */
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

/* =================== UI =================== */
const css = document.createElement('style');
css.textContent = `
#authGate,#dailyBox{position:absolute;inset:0;z-index:300;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.88);pointer-events:auto}
#authGate.on,#dailyBox.on{display:flex}
#authGate .card,#dailyBox .card{width:380px;max-height:520px;overflow:auto}
#dailyBox .card{width:640px}
#authGate h2{text-align:center}
#authGate input{display:block;width:100%;font:inherit;font-size:14px;color:var(--txt);background:#111;border:3px solid var(--edge);padding:8px 10px;margin:6px 0;outline:none;user-select:text;-webkit-user-select:text}
#authGate input:focus{border-color:var(--grass)}
#authGate button{width:100%;margin:4px 0;padding:8px}
#authMsg{color:var(--red);font-size:12px;min-height:16px;text-align:center;margin-top:4px}
#authLinks{display:flex;justify-content:space-between;font-size:12px;margin-top:6px}
#authLinks a{color:var(--blue);cursor:pointer}
#authChip{position:absolute;left:2px;top:2px;z-index:60;font-size:10px;opacity:.5;display:none;align-items:center;gap:4px;pointer-events:auto}
#authChip:hover{opacity:1}#authChip button{font-size:10px;padding:1px 6px;margin:0}
.dl{display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin:10px 0}
.dl div{background:var(--panel2);border:2px solid var(--edge);padding:6px 2px;text-align:center;font-size:11px;line-height:1.3}
.dl div b{display:block;font-size:10px;color:var(--dim)}.dl div span{display:block;font-size:22px}
.dl .done{opacity:.4}.dl .today{border-color:var(--gold);background:#3a3420}`;
document.head.appendChild(css);

const host = document.getElementById('gameScaler') || document.body;
const gate = document.createElement('div'); gate.id = 'authGate';
gate.innerHTML = `<div class="card"><h2 id="authTitle">Masuk</h2>
  <button class="pri" id="authGoogle">🔵 Lanjut dengan Google</button>
  <div class="dim" style="text-align:center;margin:6px 0">atau pakai email</div>
  <input id="authEmail" type="email" placeholder="Email" autocomplete="email">
  <input id="authPass" type="password" placeholder="Password (min. 6 karakter)" autocomplete="current-password">
  <button class="pri" id="authSubmit">Masuk</button>
  <div id="authMsg"></div>
  <div id="authLinks"><a id="authToggle">Belum punya akun? Daftar</a><a id="authReset">Lupa password?</a></div></div>`;
host.appendChild(gate);
const chip = document.createElement('div'); chip.id = 'authChip'; host.appendChild(chip);
const daily = document.createElement('div'); daily.id = 'dailyBox'; host.appendChild(daily);

const $ = (id) => document.getElementById(id);
let mode = 'login';
const msg = (t) => ($('authMsg').textContent = t || '');
const ERR = {
  'auth/invalid-email': 'Format email salah.', 'auth/missing-password': 'Isi password dulu.',
  'auth/invalid-credential': 'Email atau password salah.', 'auth/wrong-password': 'Email atau password salah.', 'auth/user-not-found': 'Akun tidak ditemukan.',
  'auth/email-already-in-use': 'Email sudah terdaftar, silakan masuk.', 'auth/weak-password': 'Password minimal 6 karakter.',
  'auth/too-many-requests': 'Terlalu banyak percobaan, coba lagi nanti.', 'auth/network-request-failed': 'Koneksi bermasalah.',
  'auth/popup-closed-by-user': '', 'auth/cancelled-popup-request': ''
};
const fail = (e) => msg(ERR[e.code] !== undefined ? ERR[e.code] : 'Gagal: ' + (e.code || e.message));

function setMode(m) {
  mode = m; msg();
  $('authTitle').textContent = m === 'login' ? 'Masuk' : 'Daftar Akun';
  $('authSubmit').textContent = m === 'login' ? 'Masuk' : 'Daftar';
  $('authToggle').textContent = m === 'login' ? 'Belum punya akun? Daftar' : 'Sudah punya akun? Masuk';
  $('authPass').autocomplete = m === 'login' ? 'current-password' : 'new-password';
}
$('authToggle').onclick = () => setMode(mode === 'login' ? 'register' : 'login');
$('authSubmit').onclick = async () => {
  const e = $('authEmail').value.trim(), p = $('authPass').value; msg();
  try { await (mode === 'login' ? signInWithEmailAndPassword(auth, e, p) : createUserWithEmailAndPassword(auth, e, p)); } catch (x) { fail(x); }
};
$('authPass').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') $('authSubmit').click(); ev.stopPropagation(); });
$('authEmail').addEventListener('keydown', (ev) => ev.stopPropagation());   // jangan picu kontrol game saat mengetik
$('authGoogle').onclick = async () => {
  msg(); const pr = new GoogleAuthProvider();
  try { await signInWithPopup(auth, pr); }
  catch (x) { if (x.code === 'auth/popup-blocked') signInWithRedirect(auth, pr); else fail(x); }
};
$('authReset').onclick = async () => {
  const e = $('authEmail').value.trim(); if (!e) return msg('Isi email dulu, lalu klik Lupa password.');
  try { await sendPasswordResetEmail(auth, e); msg('Email reset password dikirim.'); $('authMsg').style.color = 'var(--grass)'; } catch (x) { fail(x); }
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
  catch (e) { console.warn(e); msg('Gagal membaca cloud save (cek Firestore rules).'); }
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
  chip.innerHTML = `<span>👤 ${(user.displayName || user.email || '').replace(/</g, '')}</span><button id="authOut">Keluar</button>`;
  $('authOut').onclick = async () => {
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
  daily.innerHTML = `<div class="card"><h2>🎁 Daily Login</h2>
    <div class="dim">Streak: ${info.streak} hari. Absen terputus kalau sehari terlewat.</div>
    <div class="dl">${DAILY.map((r, i) => `<div class="${i < info.idx ? 'done' : i === info.idx ? 'today' : ''}"><b>Hari ${i + 1}</b><span>${i < info.idx ? '✔' : r.i}</span>${r.t}</div>`).join('')}</div>
    <button class="pri" id="dlClaim" style="width:100%;padding:8px">Klaim: ${DAILY[info.idx].t}</button></div>`;
  daily.classList.add('on');
  $('dlClaim').onclick = () => {
    const fresh = dailyInfo(D.state); if (!fresh) { daily.classList.remove('on'); return; }       // cegah klaim ganda
    DAILY[fresh.idx].give(D.state);
    D.state.daily = { last: fresh.today, streak: fresh.streak };
    D.save(); daily.classList.remove('on');
    const t = $('toast'); if (t) { t.textContent = `🎁 Daily Login: ${DAILY[fresh.idx].t}`; t.style.display = 'block'; setTimeout(() => (t.style.display = 'none'), 2600); }
  };
}
/* tunggu sampai pemain punya karakter & sedang tidak di dalam dungeon, lalu tampilkan popup sekali per sesi */
setInterval(() => {
  if (!user || dailyShown || !D.state || D.run || gate.classList.contains('on')) return;
  if (dailyInfo(D.state)) showDaily(); else dailyShown = true;
}, 1500);

/* =================== START =================== */
onAuthStateChanged(auth, async (u) => {
  user = u;
  if (!u) { gate.classList.add('on'); chip.style.display = 'none'; return; }
  gate.classList.remove('on'); showChip(); await syncLogin();
});
