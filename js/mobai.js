/* mobai.js — AI musuh BIASA: pathfinding (flow-field Dijkstra), anti-stuck, aggro pintar, & serangan bertelegraf unik per monster.
   Memakai sistem telegraf yang sama dengan boss.js (R.tele → digambar & di-resolve oleh D.Boss.tick), jadi semua serangan musuh
   bisa dilihat dulu: garis putus-putus = area, isian bertambah = waktu sampai kena. Dash (i-frame) / keluar area = aman.

   TAMBAH MONSTER BARU : tambah entri di D.MOB_AI (di bawah) dengan id yang sama seperti D.MOBS.
   TAMBAH SERANGAN     : tambah objek di array `atk` → { n:nama, min, max (jarak), los:true (butuh pandangan lurus), w:bobot, cd:jeda, fn:(R,m,S)=>durasi }
                         fn memakai S(detik, aksi) untuk menjadwalkan telegraf (circ / cone / line) atau shoot/lunge/blinkNear. */
(function (D) {
  const T = 32, PI = Math.PI, PI2 = PI * 2, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, hyp = Math.hypot;
  const C = () => D._c, rnd = (a, b) => a + Math.random() * (b - a), RED = '#ff5a4a';

  /* ================= GEOMETRI ================= */
  const freeAt = (R, x, y, r) => { const w = C().walk; return w(R, x - r, y - r) && w(R, x + r, y - r) && w(R, x - r, y + r) && w(R, x + r, y + r); };
  function clear(R, x0, y0, x1, y1, r) {                       // apakah "badan" (lingkaran r) bisa lewat garis lurus?
    const n = Math.ceil(hyp(x1 - x0, y1 - y0) / 8);
    for (let k = 1; k <= n; k++) { const f = k / n; if (!freeAt(R, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, r)) return false; }
    return true;
  }

  /* ================= NAV: flow-field (Dijkstra dari tile player) =================
     Dihitung ulang max tiap 0.1 dtk & hanya saat player pindah tile. Biaya ekstra di tile dekat dinding → musuh tidak menempel tembok. */
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], DC = [10, 10, 10, 10, 14, 14, 14, 14];
  const hk = [], hv = []; let popK = 0;
  function hpush(k, v) { let i = hk.length; hk.push(k); hv.push(v); while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= k) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = k; hv[i] = v; }
  function hpop() {
    const k0 = hk[0], v0 = hv[0], k = hk.pop(), v = hv.pop(), n = hk.length;
    if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && hk[c + 1] < hk[c]) c++; if (hk[c] >= k) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; } hk[i] = k; hv[i] = v; }
    popK = k0; return v0;
  }
  function flood(N, tx, ty) {
    const { m, w, h, d, pen } = N; d.fill(Infinity); N.tx = tx; N.ty = ty;
    if (tx < 0 || ty < 0 || tx >= w || ty >= h) return;
    const s = ty * w + tx; if (m[s] !== 1) return;
    d[s] = 0; hk.length = hv.length = 0; hpush(0, s);
    while (hk.length) {
      const i = hpop(), c = popK; if (c > d[i]) continue; const x = i % w, y = (i / w) | 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const ni = ny * w + nx; if (m[ni] !== 1) continue;
        if (k > 3 && (m[y * w + nx] !== 1 || m[ny * w + x] !== 1)) continue;        // dilarang memotong sudut tembok
        const nc = c + DC[k] + pen[ni]; if (nc < d[ni]) { d[ni] = nc; hpush(nc, ni); }
      }
    }
  }
  function ensureNav(R, dt) {
    const tx = Math.floor(R.p.x / T), ty = Math.floor(R.p.y / T); let N = R.nav;
    if (!N || N.m !== R.m) {
      const w = R.w, h = R.h, pen = new Uint8Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (R.m[y * w + x] !== 1) continue; let wall = false;
        for (let k = 0; k < 8 && !wall; k++) { const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= w || ny >= h || R.m[ny * w + nx] !== 1) wall = true; }
        pen[y * w + x] = wall ? 5 : 0;
      }
      N = R.nav = { m: R.m, w, h, d: new Float32Array(w * h), pen, tx: -9, ty: -9, age: 9, stamp: -1 };
    }
    if (N.stamp === R.t) return N; N.stamp = R.t; N.age += dt;
    if ((tx !== N.tx || ty !== N.ty) && N.age > .1) { flood(N, tx, ty); N.age = 0; }
    return N;
  }
  /* waypoint = sel terjauh di sepanjang jalur terpendek yang masih bisa dilihat lurus (path smoothing) */
  function waypoint(R, m, N) {
    const w = N.w, d = N.d, mm = N.m; let x = Math.floor(m.x / T), y = Math.floor(m.y / T), i = y * w + x, wx = null, wy = null;
    if (!(d[i] < Infinity)) return null;
    for (let s = 0; s < 7; s++) {
      let bi = -1, bd = d[i], bx = 0, by = 0;
      for (let k = 0; k < 8; k++) {
        const nx = x + DX[k], ny = y + DY[k]; if (nx < 0 || ny < 0 || nx >= N.w || ny >= N.h) continue;
        const ni = ny * w + nx; if (mm[ni] !== 1) continue; if (k > 3 && (mm[y * w + nx] !== 1 || mm[ny * w + x] !== 1)) continue;
        if (d[ni] < bd) { bd = d[ni]; bi = ni; bx = nx; by = ny; }
      }
      if (bi < 0) break;
      const cx = bx * T + 16, cy = by * T + 16;
      if (s === 0 || clear(R, m.x, m.y, cx, cy, m.r - 2)) { wx = cx; wy = cy; } else break;
      x = bx; y = by; i = bi;
    }
    return wx === null ? null : { x: wx, y: wy };
  }

  /* ================= GERAK ================= */
  function unstick(R, m, tx, ty) {                             // terdeteksi macet: geser menyamping, lalu snap ke tengah tile bila berulang
    m.wp = null; m.sN = (m.sN || 0) + 1;
    const a0 = atan2(ty - m.y, tx - m.x), sd = Math.random() < .5 ? 1 : -1; let a = a0 + sd * PI / 2;
    if (!freeAt(R, m.x + cos(a) * 14, m.y + sin(a) * 14, m.r - 2)) a = a0 - sd * PI / 2;
    m.nudge = { a, t: .35 };
    if (m.sN >= 3) { m.sN = 0; const cx = Math.floor(m.x / T) * T + 16, cy = Math.floor(m.y / T) * T + 16; if (freeAt(R, cx, cy, m.r - 2)) { m.x = cx; m.y = cy; } }
  }
  function go(R, m, tx, ty, spd, dt, noStuck) {
    const dx = tx - m.x, dy = ty - m.y, l = hyp(dx, dy); if (l < .5) return 0;
    const s = Math.min(l, spd * 60 * dt), bx = m.x, by = m.y; C().move(R, m, dx / l * s, dy / l * s, m.r - 2);
    const mv = hyp(m.x - bx, m.y - by); m.face = atan2(dy, dx);
    if (!noStuck) {
      m.sT = (m.sT || 0) + dt; m.sE = (m.sE || 0) + s; m.sA = (m.sA || 0) + mv;
      if (m.sT > .4) { if (m.sE > 2 && m.sA < m.sE * .3) unstick(R, m, tx, ty); else m.sN = 0; m.sT = m.sE = m.sA = 0; }
    }
    return mv;
  }
  function approach(R, m, dt, spd, N) {                        // PUBLIK: dipakai juga oleh boss.js
    N = N || ensureNav(R, dt); const P = R.p;
    if (m.nudge && m.nudge.t > 0) { m.nudge.t -= dt; return go(R, m, m.x + cos(m.nudge.a) * 50, m.y + sin(m.nudge.a) * 50, spd, dt, true); }
    if (hyp(P.x - m.x, P.y - m.y) < 340 && clear(R, m.x, m.y, P.x, P.y, m.r - 2)) { m.wp = null; return go(R, m, P.x, P.y, spd, dt); }
    m.wpT = (m.wpT || 0) - dt;
    if (!m.wp || m.wpT <= 0 || hyp(m.wp.x - m.x, m.wp.y - m.y) < 6) { m.wp = waypoint(R, m, N); m.wpT = rnd(.1, .2); }
    return m.wp ? go(R, m, m.wp.x, m.wp.y, spd, dt) : go(R, m, P.x, P.y, spd, dt);
  }
  function retreat(R, m, dt, spd) {                            // PUBLIK: mundur menjauhi player; kalau terjepit → geser menyamping
    const P = R.p, a = atan2(m.y - P.y, m.x - P.x);
    for (const o of [0, .6, -.6, 1.2, -1.2, 1.8, -1.8]) {
      const b = a + o; if (freeAt(R, m.x + cos(b) * 12, m.y + sin(b) * 12, m.r - 2)) return go(R, m, m.x + cos(b) * 40, m.y + sin(b) * 40, spd, dt, true);
    }
    return 0;
  }
  function strafe(R, m, dt, spd) {
    const a = atan2(R.p.y - m.y, R.p.x - m.x) + (m.sd || 1) * PI / 2;
    if (!freeAt(R, m.x + cos(a) * 12, m.y + sin(a) * 12, m.r - 2)) { m.sd = -(m.sd || 1); return 0; }
    return go(R, m, m.x + cos(a) * 40, m.y + sin(a) * 40, spd * .7, dt, true);
  }
  function relocate(R, m) {                                    // terjepit di dalam dinding → pindah ke tengah tile terdekat yang bisa dilewati
    const tx = Math.floor(m.x / T), ty = Math.floor(m.y / T); let best = null, bd = 1e9;
    for (let y = ty - 2; y <= ty + 2; y++) for (let x = tx - 2; x <= tx + 2; x++) { const cx = x * T + 16, cy = y * T + 16, d = hyp(cx - m.x, cy - m.y); if (d < bd && freeAt(R, cx, cy, m.r - 2)) { bd = d; best = { x: cx, y: cy }; } }
    if (best) { m.x = best.x; m.y = best.y; }
  }
  function stepLunge(R, m, dt) {                               // dash visual musuh (Seruduk, Menyambar, dst.)
    const k = m.lunge, stp = Math.min(k.left, k.spd * dt), n = Math.max(1, Math.ceil(stp / 6));
    for (let i = 0; i < n; i++) {
      const bx = m.x, by = m.y; C().move(R, m, k.ax * stp / n, k.ay * stp / n, m.r - 2);
      if (m.x === bx && m.y === by) { if (k.wall && k.left > 24) { m.stun = k.wall; m.seq = null; m.cast = null; m.acd = 1.2; } k.left = 0; break; }   // nabrak tembok → pusing (stun) = kesempatan serang
    }
    k.left -= stp; if (k.left <= .5) m.lunge = null;
  }
  function idle(R, m, dt) {                                    // belum sadar ada player: keluyuran pelan di sekitar sarang
    m.wT -= dt;
    if (m.wt && hyp(m.wt.x - m.x, m.wt.y - m.y) < 5) { m.wt = null; m.wT = rnd(1, 3); }
    if (!m.wt && m.wT <= 0) {
      for (let i = 0; i < 5; i++) {
        const a = rnd(0, PI2), r = rnd(20, 70); let x = m.x + cos(a) * r, y = m.y + sin(a) * r;
        if (hyp(x - m.hx, y - m.hy) > 110) { x = m.hx + cos(a) * rnd(0, 60); y = m.hy + sin(a) * rnd(0, 60); }
        if (freeAt(R, x, y, m.r - 2) && clear(R, m.x, m.y, x, y, m.r - 2)) { m.wt = { x, y }; break; }
      }
      m.wT = rnd(1.5, 3.5);
    }
    if (m.wt && !go(R, m, m.wt.x, m.wt.y, m.spd * .35, dt, true)) m.wt = null;
  }

  /* ================= PEMBUAT TELEGRAF (sama dengan boss.js) ================= */
  const ang = (R, m) => atan2(R.p.y - m.y, R.p.x - m.x);
  const tele = (R, m, o) => { (R.tele = R.tele || []).push(Object.assign({ t: 0, dmg: 1, src: m, c: RED }, o, { wind: o.wind * (m.wm || 1) })); };
  const circ = (R, m, x, y, r, wind, dmg, go) => tele(R, m, { shape: 'circle', x, y, r, wind, dmg, go });
  const cone = (R, m, a, r, span, wind, dmg, go) => { m.face = a; tele(R, m, { shape: 'cone', x: m.x, y: m.y, a, r, span, wind, dmg, go }); };
  const line = (R, m, a, len, w, wind, dmg, go) => { m.face = a; tele(R, m, { shape: 'line', x: m.x, y: m.y, a, len, w, wind, dmg, go }); };
  const shoot = (R, m, a, sp, mul) => R.proj.push({ x: m.x, y: m.y, vx: cos(a) * sp, vy: sin(a) * sp, dmg: m.atk * mul, life: 2.4 });
  const lunge = (m, a, len, spd, wall) => { m.lunge = { ax: cos(a), ay: sin(a), left: len, spd, wall }; };
  const flee = (m, t) => { m.fleeT = t; };
  const blinkNear = (R, m, x, y) => {                          // wraith: lenyap lalu muncul di dekat target
    R.fx.push({ x: m.x, y: m.y, rad: 1, life: .3, c: '#b08aff' });
    const a0 = atan2(m.y - y, m.x - x);
    for (const o of [0, .6, -.6, 1.2, -1.2, 2, -2, PI]) { const tx = x + cos(a0 + o) * 34, ty = y + sin(a0 + o) * 34; if (freeAt(R, tx, ty, m.r - 2)) { m.x = tx; m.y = ty; break; } }
    R.fx.push({ x: m.x, y: m.y, rad: 1, life: .3, c: '#b08aff' });
  };
  const dist = (R, m) => hyp(R.p.x - m.x, R.p.y - m.y);

  /* ================= DATA SERANGAN PER MONSTER ================= */
  D.MOB_AI = {
    /* Slime — melompat ke posisimu, atau memercik kalau kamu dekat */
    slime: { mv: 'rush', stop: 24, atk: [
      { n: 'Lompat', min: 55, max: 170, w: 3, cd: 2.4, fn: (R, m, S) => { S(0, () => { const x = R.p.x, y = R.p.y; circ(R, m, x, y, 46, .85, 1.4, () => lunge(m, atan2(y - m.y, x - m.x), Math.min(hyp(x - m.x, y - m.y), 170), 520)); }); return 1.0; } },
      { n: 'Percik', min: 0, max: 56, w: 2, cd: 1.6, fn: (R, m, S) => { S(0, () => circ(R, m, m.x, m.y, 54, .6, 1.1)); return .7; } }] },

    /* Kelelawar — terbang mengitari, lalu menyambar lurus dan kabur sebentar */
    bat: { mv: 'orbit', orbit: 100, atk: [
      { n: 'Menyambar', min: 40, max: 210, w: 1, cd: 2.0, fn: (R, m, S) => { S(0, () => { const a = ang(R, m), L = Math.min(dist(R, m) + 70, 260); line(R, m, a, L, 28, .55, 1.2, () => { lunge(m, a, L, 700); flee(m, .9); }); }); return .75; } }] },

    /* Skeleton — menjaga jarak & menembak panah (garis peringatan → panah terbang), tebas kalau didekati */
    skeleton: { mv: 'kite', lo: 100, hi: 190, atk: [
      { n: 'Panah', min: 80, max: 320, los: true, w: 3, cd: 2.2, fn: (R, m, S) => { S(0, () => { const a = ang(R, m); line(R, m, a, 330, 14, .7, 0, () => shoot(R, m, a, 430, 1.1)); }); return .9; } },
      { n: 'Tebas', min: 0, max: 64, w: 3, cd: 1.4, fn: (R, m, S) => { S(0, () => cone(R, m, ang(R, m), 60, .85, .55, 1.2)); return .65; } }] },

    /* Zombie — lambat tapi pukulannya berat; cakar ganda; muntah asam jarak menengah */
    zombie: { mv: 'rush', stop: 36, atk: [
      { n: 'Hantam', min: 0, max: 88, w: 2, cd: 2.2, fn: (R, m, S) => { S(0, () => cone(R, m, ang(R, m), 82, 1.05, .95, 1.7)); return 1.1; } },
      { n: 'Cakar Ganda', min: 0, max: 88, w: 2, cd: 1.6, fn: (R, m, S) => { S(0, () => cone(R, m, ang(R, m), 70, .9, .55, 1)); S(.65, () => cone(R, m, ang(R, m), 70, .9, .5, 1)); return 1.3; } },
      { n: 'Asam', min: 95, max: 210, los: true, w: 1, cd: 3, fn: (R, m, S) => { S(0, () => circ(R, m, R.p.x, R.p.y, 52, 1.1, 1.3)); return 1.2; } }] },

    /* Wraith — menghilang lalu menusuk dari dekatmu; tebasan garis hantu */
    wraith: { mv: 'rush', stop: 85, atk: [
      { n: 'Tebas Bayangan', min: 60, max: 240, los: true, w: 2, cd: 2.6, fn: (R, m, S) => { S(0, () => { const x = R.p.x, y = R.p.y; circ(R, m, x, y, 54, .9, 1.5, () => { blinkNear(R, m, x, y); flee(m, .7); }); }); return 1.0; } },
      { n: 'Garis Hantu', min: 0, max: 130, w: 2, cd: 2.0, fn: (R, m, S) => { S(0, () => { const a = ang(R, m); line(R, m, a, 240, 34, .65, 1.3, () => { lunge(m, a, 150, 600); flee(m, .6); }); }); return .8; } }] },

    /* Imp — penyihir: menembakkan 3 bola api beruntun; meledak di sekitarnya kalau didekati lalu kabur */
    imp: { mv: 'kite', lo: 130, hi: 210, atk: [
      { n: 'Bola Api', min: 80, max: 330, los: true, w: 3, cd: 2.8, fn: (R, m, S) => { for (const t of [0, .4, .8]) S(t, () => { const a = ang(R, m); line(R, m, a, 300, 16, .5, 0, () => shoot(R, m, a, 270, 1)); }); return 1.7; } },
      { n: 'Ledakan Api', min: 0, max: 100, w: 3, cd: 2.4, fn: (R, m, S) => { S(0, () => circ(R, m, m.x, m.y, 80, .7, 1.5, () => flee(m, 1))); return .8; } }] },

    /* Magma Cube — meledak di tempat; menggelinding lurus (nabrak tembok = pusing) */
    magma: { mv: 'rush', stop: 95, atk: [
      { n: 'Ledakan', min: 0, max: 112, w: 2, cd: 2.4, fn: (R, m, S) => { S(0, () => circ(R, m, m.x, m.y, 92, 1.05, 1.7)); return 1.2; } },
      { n: 'Menggelinding', min: 80, max: 270, los: true, w: 2, cd: 3, fn: (R, m, S) => { S(0, () => { const a = ang(R, m), L = Math.min(dist(R, m) + 90, 300); line(R, m, a, L, 44, .85, 1.5, () => lunge(m, a, L, 520, 1.2)); }); return 1.0; } }] },

    /* Babi liar — menyeruduk lurus (nabrak tembok = pusing 1,1 dtk), tanduk jarak dekat */
    boar: { mv: 'rush', stop: 30, atk: [
      { n: 'Seruduk', min: 80, max: 270, los: true, w: 3, cd: 2.6, fn: (R, m, S) => { S(0, () => { const a = ang(R, m); line(R, m, a, 260, 36, .7, 1.5, () => lunge(m, a, 260, 640, 1.1)); }); return .9; } },
      { n: 'Tanduk', min: 0, max: 58, w: 2, cd: 1.4, fn: (R, m, S) => { S(0, () => cone(R, m, ang(R, m), 60, .8, .5, 1.1)); return .6; } }] }
  };
  const DEFAULT = { mv: 'rush', stop: 28, atk: [{ n: 'Serang', min: 0, max: 60, w: 1, cd: 1.2, fn: (R, m, S) => { S(0, () => cone(R, m, ang(R, m), 56, .8, .6, 1)); return .7; } }] };

  /* ================= OTAK ================= */
  function init(m) {
    m.ai = 1; m.acd = rnd(.4, 1); m.alert = m.alert || 0; m.fleeT = 0; m.wT = rnd(0, 2); m.wpT = 0; m.od = Math.random() < .5 ? 1 : -1; m.sd = m.od; m.seed = rnd(0, 6.28);
    if (m.hx === undefined) { m.hx = m.x; m.hy = m.y; }
  }
  function begin(R, m, a) {
    const q = [], wm = R.kind === 'dungeon' ? Math.max(.72, 1 - .012 * (R.lv || 1)) : 1;      // makin dalam dungeon, telegraf makin singkat
    m.wm = wm; m.face = ang(R, m);
    const dur = a.fn(R, m, (t, fn) => q.push({ t, fn })); q.sort((x, y) => x.t - y.t);
    m.seq = { t: 0, q, dur, cd: a.cd }; m.cast = a.n;
  }
  const MobAI = D.MobAI = {
    ensureNav, approach, retreat,
    interrupt(R, m) {                                          // dipanggil saat stun: batalkan serangan yang sedang disiapkan
      if (!m.seq && !m.lunge) return;
      m.seq = null; m.lunge = null; m.cast = null; m.acd = Math.max(m.acd || 0, .8);
      if (R.tele) R.tele = R.tele.filter(o => o.src !== m);
    },
    blind(R, m) { m.alert = 0; if (m.seq) this.interrupt(R, m); },      // player Stealth: musuh kehilangan jejak
    update(R, m, dt, d, mul) {
      if (m.dummy) return;                                     // dummy Training Room: diam, tidak menyerang
      if (m.ai === undefined) init(m);
      const N = ensureNav(R, dt), P = R.p, cfg = D.MOB_AI[m.id] || DEFAULT;
      m.acd -= dt; m.alert -= dt; m.fleeT -= dt;
      if (!freeAt(R, m.x, m.y, m.r - 2)) relocate(R, m);
      if (m.lunge) stepLunge(R, m, dt);
      if (m.seq) {                                             // sedang menyerang: diam di tempat, jalankan jadwal telegraf
        const q = m.seq; q.t += dt; while (q.q.length && q.q[0].t <= q.t) q.q.shift().fn();
        if (q.t >= q.dur) { m.seq = null; m.cast = null; m.acd = q.cd * rnd(.85, 1.2); }
        return;
      }
      if (m.lunge) return;

      /* --- kesadaran: lihat langsung ATAU dengar lewat jalur (bukan tembus tembok) --- */
      const sight = m.aggro * mul, cell = Math.floor(m.y / T) * R.w + Math.floor(m.x / T), pathPx = N.d[cell] / 10 * T;
      const body = d < 380 && clear(R, m.x, m.y, P.x, P.y, m.r - 2), was = m.alert > 0;
      if (m.tauntT > 0 || (body && d < sight) || pathPx < sight * .9) m.alert = 5;
      if (!was && m.alert > 0) {                               // baru sadar: reaksi sejenak + bangunkan teman satu kelompok
        m.acd = Math.max(m.acd, rnd(.5, 1));
        for (const o of R.mobs) if (o !== m && !o.dead && !o.isBoss && !(o.alert > 0) && hyp(o.x - m.x, o.y - m.y) < 200 && clear(R, m.x, m.y, o.x, o.y, 3)) o.alert = 3.5;
      }
      if (!(m.alert > 0)) return idle(R, m, dt);

      /* --- pilih serangan --- */
      if (m.acd <= 0) {
        const c = cfg.atk.filter(a => d >= a.min && d <= a.max && (!a.los || body));
        if (c.length) { let t = c.reduce((s, a) => s + a.w, 0) * Math.random(), pick = c[0]; for (const a of c) { if ((t -= a.w) <= 0) { pick = a; break; } } begin(R, m, pick); return; }
      }
      /* --- gerak sesuai gaya --- */
      const spd = m.spd * (m.slow > 0 ? .55 : 1);
      if (m.fleeT > 0) retreat(R, m, dt, spd * 1.25);
      else if (cfg.mv === 'kite') { if (d < cfg.lo) retreat(R, m, dt, spd); else if (d > cfg.hi || !body) approach(R, m, dt, spd, N); else strafe(R, m, dt, spd); }
      else if (cfg.mv === 'orbit') {
        m.oa = (m.oa === undefined ? atan2(m.y - P.y, m.x - P.x) : m.oa) + m.od * dt * 1.7;
        const rr = cfg.orbit + Math.sin(R.t * 3 + m.seed) * 25, tx = P.x + cos(m.oa) * rr, ty = P.y + sin(m.oa) * rr;
        if (body && clear(R, m.x, m.y, tx, ty, m.r - 2)) go(R, m, tx, ty, spd, dt, true); else approach(R, m, dt, spd, N);
      }
      else if (d > (cfg.stop || 28)) approach(R, m, dt, spd, N);
      /* --- jangan numpuk dengan musuh lain --- */
      for (const o of R.mobs) {
        if (o === m || o.dead) continue; const dx = m.x - o.x, dy = m.y - o.y, dd = hyp(dx, dy), mn = m.r + o.r - 2;
        if (dd < mn && dd > .01) { const p = (mn - dd) * .5; C().move(R, m, dx / dd * p, dy / dd * p, m.r - 2); }
      }
    }
  };
})(window.DSB);
