/* unique.js — Pola basic attack & 4 skill khusus Unique Item (Z X C = skill biasa, V = Ultimate).
   • Hanya item Unique yang punya pola serangan & skill sendiri. Item biasa dari Shop tetap pakai pola standar (combatfx.js).
   • Skill Spasi tetap berlaku untuk SEMUA senjata (terpisah dari 4 skill ini).
   • Tiap unique didaftarkan di D.UNIQ[idItem]. Satu entri =
       { pattern:[ {t:'langkah', ...}, ... ]   // urutan basic attack (berulang tiap klik)
         skills:{ z,x,c,v }                     // type: 'toggle' | 'cast' | 'hold' (hold punya press/hold/release)
         mods(R,u) → pengali stat | tick(R,dt,u) | onStrike(R,m) | draw(ctx,R,cx,cy,u) }
   • Langkah pola tersedia: slash, spray, slam, pierce, fan, nova, tpcombo (lihat STEPS). Tambah langkah baru = tambah fungsi di STEPS.
   • Tiap Unique punya: pattern (combo 4 hit) + holdAtk (tahan Basic Attack: charge → lepas) + skills Z/X/C/V. Angka mudah diganti.
   • holdAtk = { th:detik tahan sebelum charge, max:detik charge penuh, start/tick/release/draw }. Tap singkat = basic attack biasa.
   Hook engine: combatfx.js (FX.attack, strike) · dungeon.js (update, attack, ghost) · passives.js (pengali stat) · game.js (tombol, HUD, gambar). */
(function (D) {
  const PI = Math.PI, PI2 = PI * 2, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, hyp = Math.hypot;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const walkOk = (R, x, y) => [[-9, -9], [9, -9], [-9, 9], [9, 9]].every(([dx, dy]) => D._c.walk(R, x + dx, y + dy));
  const useRes = (R, n) => { const u = R.u; if (!u || u.rs === undefined || u.rs < n) return false; u.rs -= n; return true; };
  const stunMob = (m, t) => { if (!m.isBoss && !m.dead) m.stun = Math.max(m.stun || 0, t); };
  const adiff = (a, b) => (((a - b + PI) % PI2) + PI2) % PI2 - PI;
  const FU = () => D.FX.u, C = () => D._c, col = () => D.ROLES[D.state.role].color;
  const FIRE = '#ff7a3a', GOLD = '#ffd54a', AC = '#6fe0b0', AW = '#bff5ff';
  const fl = (R, x, y, t, c) => R.ft.push({ x, y, t: String(t), c: c || '#fff', life: .9 });

  /* ---------- geometri ---------- */
  const alive = (R) => R.mobs.filter((m) => !m.dead);
  const inCircle = (R, x, y, r) => alive(R).filter((m) => hyp(m.x - x, m.y - y) < r + m.r * .5);
  const inCone = (R, x, y, a, range, half) => alive(R).filter((m) => { const d = hyp(m.x - x, m.y - y) - m.r; return d < range && (d < 14 || Math.abs(adiff(atan2(m.y - y, m.x - x), a)) <= half); });
  const inLine = (R, x, y, a, len, w) => alive(R).filter((m) => { const dx = m.x - x, dy = m.y - y, al = dx * cos(a) + dy * sin(a), pe = Math.abs(-dx * sin(a) + dy * cos(a)); return al > -m.r && al < len + m.r && pe < w / 2 + m.r; });
  const nearest = (R, x, y, max) => { let t = null, bd = max; for (const m of alive(R)) { const d = hyp(m.x - x, m.y - y); if (d < bd) { bd = d; t = m; } } return t; };

  /* ---------- efek bantu ---------- */
  const strike = (R, m, mult, o) => FU().strike(R, m, mult, o);
  const burn = (R, m, mul, dur, c) => { if (m.dead) return; (m.sts = m.sts || {}).burn = { t: dur || 3, tick: .5, dps: R.s.atk * (mul || 1) / (dur || 3), c: c || FIRE }; };
  function burst(R, x, y, r, c, big) {
    const u = FU(), V = u.st(R); u.ring(V, x, y, 6, r, .35, c, 6, true); u.ring(V, x, y, 3, r * .55, .25, '#fff', 3, true);
    u.flash(V, x, y, r * .7, .18, c); u.spark(V, x, y, big ? 30 : 16, c, { v0: 70, v1: 300 });
  }
  function dashAlong(R, ang, dist) {
    const V = FU().st(R); V.gh.push({ x: R.p.x, y: R.p.y, a: ang, life: .4, max: .4, c: col() });
    for (let d = 0; d < dist; d += 6) {
      const s = Math.min(6, dist - d), bx = R.p.x, by = R.p.y; C().move(R, R.p, cos(ang) * s, sin(ang) * s, 9);
      if (R.p.x === bx && R.p.y === by) break; if (d % 30 === 0) V.gh.push({ x: R.p.x, y: R.p.y, a: ang, life: .3, max: .3, c: col() });
    }
  }
  const clampPt = (R, aim, range) => { const a = atan2(aim.y - R.p.y, aim.x - R.p.x), l = Math.min(range, hyp(aim.x - R.p.x, aim.y - R.p.y)); return { x: R.p.x + cos(a) * l, y: R.p.y + sin(a) * l, a }; };
  const rgba = (rgb, a) => `rgba(${rgb},${a})`;

  /* =====================  LANGKAH POLA BASIC ATTACK  ===================== */
  const STEPS = {
    slash(R, ang, o) {                                     // tebasan berbusur (o.burn = bakar)
      const u = FU(), V = u.st(R), c = o.col || col(), dir = o.dir || 1, rng = o.range || R.s.range + 12, span = o.span || 2.6, dur = Math.min(.26, R.s.cd * .9);
      V.sw = { k: 'slash', t: 0, dur, ang, dir, lunge: o.lunge || 8 };
      u.add(V, { k: 'arc', fol: 1, a: ang, dir, span, r: rng + 10, th: o.th || 30, life: dur * 1.7, sw: .5, c });
      u.later(V, dur * .35, () => {
        const h = inCone(R, R.p.x, R.p.y, ang, rng, span / 2);
        h.forEach((m) => { strike(R, m, o.mult || 1, { kb: o.kb || 6, c, ang }); if (o.burn) burn(R, m, o.burn); });
        if (h.length) u.spark(V, R.p.x + cos(ang) * rng * .8, R.p.y + sin(ang) * rng * .8, 8, c, { a: ang, sp: .8 });
      });
      return 0;
    },
    spray(R, ang, o) {                                     // semburan (api) berbentuk kerucut, beberapa denyut
      const u = FU(), V = u.st(R), c = o.col || col(), rng = o.range || 120, half = o.half || .55, n = o.pulses || 3;
      V.sw = { k: 'thrust', t: 0, dur: .32, ang };
      for (let i = 0; i < n; i++) u.later(V, .06 + i * .09, () => {
        u.spark(V, R.p.x + cos(ang) * 18, R.p.y + sin(ang) * 18, 18, i % 2 ? GOLD : c, { a: ang, sp: half, v0: 150, v1: 400, l: 1.4, sz: 1.3 });
        u.flash(V, R.p.x + cos(ang) * rng * .55, R.p.y + sin(ang) * rng * .55, rng * .42, .13, c);
        inCone(R, R.p.x, R.p.y, ang, rng, half).forEach((m) => { strike(R, m, o.mult || .5, { n: 3, c, ang }); if (o.burn) burn(R, m, o.burn); });
      });
      return .1 + n * .09;
    },
    slam(R, ang, o) {                                      // hantaman area di depan
      const u = FU(), V = u.st(R), c = o.col || col(), dur = .4, r = o.r || 90;
      V.sw = { k: 'smash', t: 0, dur, ang, lunge: 12 };
      u.later(V, dur * .55, () => {
        const x = R.p.x + cos(ang) * (o.dist || 60), y = R.p.y + sin(ang) * (o.dist || 60); burst(R, x, y, r, c);
        const h = inCircle(R, x, y, r); h.forEach((m) => { strike(R, m, o.mult || 1.5, { kb: o.kb || 14, c, ang }); if (o.burn) burn(R, m, o.burn); });
        V.shk = Math.max(V.shk, 6); if (h.length) u.hitstop(R, .05);
      });
      return .12;
    },
    pierce(R, ang, o) {                                    // garis lurus (tusukan / tembakan)
      const u = FU(), V = u.st(R), c = o.col || col(), len = o.len || 200, w = o.w || 30;
      V.sw = { k: 'thrust', t: 0, dur: .26, ang };
      u.later(V, .09, () => {
        const x0 = R.p.x + cos(ang) * 14, y0 = R.p.y + sin(ang) * 14;
        u.add(V, { k: 'line', x1: x0, y1: y0, x2: x0 + cos(ang) * len, y2: y0 + sin(ang) * len, w: o.vw || Math.max(8, w * .5), life: .22, c });
        u.ring(V, x0 + cos(ang) * len, y0 + sin(ang) * len, 4, 26, .2, '#fff', 3);
        inLine(R, R.p.x, R.p.y, ang, len, w).forEach((m) => { strike(R, m, o.mult || 1, { kb: o.kb || 4, c, ang }); if (o.burn) burn(R, m, o.burn); });
      });
      return 0;
    },
    fan(R, ang, o) { const n = o.n || 3, sp = o.spread || .3; for (let i = 0; i < n; i++) STEPS.pierce(R, ang + (i - (n - 1) / 2) * sp, o); return .1; },
    nova(R, ang, o) {                                      // ledakan di sekeliling diri
      const u = FU(), V = u.st(R), c = o.col || col(), r = o.r || 110;
      V.sw = { k: 'raise', t: 0, dur: .35, ang };
      u.later(V, .15, () => { burst(R, R.p.x, R.p.y, r, c); const h = inCircle(R, R.p.x, R.p.y, r); h.forEach((m) => { strike(R, m, o.mult || 1.3, { kb: o.kb || 10, c }); if (o.burn) burn(R, m, o.burn); }); V.shk = Math.max(V.shk, 4); });
      return .15;
    },
    fireballs(R, ang, o) {                                 // MAGE: 3 bola api beruntun; 3× kena musuh yang sama → ledakan kecil +2% Mana
      const u = FU(), V = u.st(R), U = S(R), c = o.col || col(), len = o.len || 300, cnt = new Map();
      V.sw = { k: 'cast', t: 0, dur: .5, wu: .12, ang, big: false };
      if (U.on.z) useRes(R, .5);                           // Combustion Field: biaya Mana tambahan tiap menyihir
      for (let i = 0; i < 3; i++) u.later(V, .12 + i * .13, () => {
        const a = ang + (i - 1) * .04, ox = R.p.x + cos(a) * 26, oy = R.p.y + sin(a) * 26; let t = null, bd = 1e9;
        for (const m of inLine(R, ox, oy, a, len, 26)) { const d = hyp(m.x - ox, m.y - oy); if (d < bd) { bd = d; t = m; } }
        const L = t ? Math.max(20, bd) : len;
        u.add(V, { k: 'line', x1: ox, y1: oy, x2: ox + cos(a) * L, y2: oy + sin(a) * L, w: 12, life: .16, c: i % 2 ? GOLD : c });
        u.spark(V, ox, oy, 5, c, { a, sp: .4 });
        if (!t) return;
        strike(R, t, o.mult || .5, { n: 5, c, ang: a }); burn(R, t, .15, 2, c);
        const n = (cnt.get(t) || 0) + 1; cnt.set(t, n);
        if (n === 3) {
          burst(R, t.x, t.y, 55, c); inCircle(R, t.x, t.y, 55).forEach((m) => strike(R, m, .5, { n: 4, c, kb: 6 }));
          U.rs = Math.min(100, (U.rs || 0) + 2); fl(R, t.x, t.y - 26, '+2% MANA', '#6fe0ff');
        }
      });
      return .5;
    },
    dshot(R, ang, o) {                                     // ARCHER: Double Shot (panah tembus kalau Wind Infusion aktif, 1% Stamina / tembakan)
      const u = FU(), V = u.st(R), U = S(R), s = R.s; V.sw = { k: 'draw', t: 0, dur: .3, wu: .1, ang, big: false };
      u.later(V, .1, () => {
        for (let i = 0; i < 2; i++) {
          let pierce = false; if (U.on.z) { if (useRes(R, 1)) pierce = true; else { U.on.z = false; fl(R, R.p.x, R.p.y - 28, 'Stamina habis — Wind OFF', '#ff6b5a'); } }
          const a = ang + (i ? .045 : -.045), x = R.p.x + cos(a) * 20, y = R.p.y + sin(a) * 20, spd = 1100, c = pierce ? '#bff5ff' : (o.col || col());
          V.pj.push({ k: 'arrow', x, y, a, spd, life: (s.range + 190) / spd, mult: o.mult || .65, big: false, pierce, rad: pierce ? 8 : 6, c, at: s.arrow, hit: [], t: 0 });
          u.spark(V, x, y, 4, c, { a, sp: .3, v0: 120, v1: 300 });
        }
      });
      return 0;
    },
    cleave(R, ang, o) {                                    // FIGHTER: tebasan berputar lambat, area luas, abaikan 15% armor (≈ +15% damage)
      const u = FU(), V = u.st(R), c = o.col || col(), r = o.r || 105, dur = .55;
      V.sw = { k: 'flurry', t: 0, dur, ang, lunge: 6 };
      u.add(V, { k: 'arc', fol: 1, a: ang, dir: 1, span: 5.8, r: r + 8, th: 44, life: dur * 1.1, sw: .5, c });
      u.later(V, dur * .45, () => {
        burst(R, R.p.x, R.p.y, r * .9, c); const h = inCircle(R, R.p.x, R.p.y, r);
        h.forEach((m) => strike(R, m, (o.mult || 1.6) * 1.15, { kb: o.kb || 12, c, ang })); V.shk = Math.max(V.shk, 4); if (h.length) u.hitstop(R, .04);
      });
      return .35;
    },
    bash(R, ang, o) {                                      // TANK: Shield Bash (dorongan perisai)
      const u = FU(), V = u.st(R), U = S(R), c = o.col || col(); V.sw = { k: 'smash', t: 0, dur: .35, ang, lunge: 12 }; U.bash = 0;
      u.later(V, .14, () => {
        const h = inCone(R, R.p.x, R.p.y, ang, 78, .8); U.bash = h.length ? R.t : 0;
        h.forEach((m) => strike(R, m, o.mult || 1, { kb: 30, c, ang, n: 8 })); u.ring(V, R.p.x + cos(ang) * 46, R.p.y + sin(ang) * 46, 6, 40, .2, '#fff', 3); V.shk = Math.max(V.shk, 3);
      });
      return .1;
    },
    guard(R, ang, o) {                                     // TANK: tebasan pedang tajam; combo sukses (bash lalu slash kena) → shield 3% Max HP
      const U = S(R), u = FU(), V = u.st(R), c = o.col || col(), ok = U.bash && R.t - U.bash < 1.2;
      STEPS.slash(R, ang, { mult: o.mult || 1.3, col: c, range: 66, span: 2.2, th: 28, kb: 8 });
      u.later(V, .12, () => { if (ok && inCone(R, R.p.x, R.p.y, ang, 78, 1.1).length) { U.sh = R.s.hp * .03; U.shT = 6; U.hp0 = R.hp; D.FX.buffFx(R, '#8fc4ff'); fl(R, R.p.x, R.p.y - 30, 'SHIELD +3%', '#8fc4ff'); } U.bash = 0; });
      return 0;
    },
    tpcombo(R, ang, o) {                                   // teleport ke belakang musuh terdekat → combo basic attack normal (3 hit)
      const u = FU(), V = u.st(R), t = nearest(R, R.p.x, R.p.y, o.range || 340), role = D.state.role;
      if (!t) { D.FX.role[role](R, ang, 0); return 0; }
      const a = atan2(t.y - R.p.y, t.x - R.p.x), ox = R.p.x, oy = R.p.y, ok = (x, y) => [[-9, -9], [9, -9], [-9, 9], [9, 9]].every(([dx, dy]) => C().walk(R, x + dx, y + dy));
      let done = false;
      for (const off of [t.r + 26, t.r + 40, t.r + 14]) { const x = t.x + cos(a) * off, y = t.y + sin(a) * off; if (ok(x, y)) { R.p.x = x; R.p.y = y; done = true; break; } }
      if (!done) for (const sd of [1.57, -1.57]) { const x = t.x + cos(a + sd) * (t.r + 26), y = t.y + sin(a + sd) * (t.r + 26); if (ok(x, y)) { R.p.x = x; R.p.y = y; done = true; break; } }
      if (done) {
        const c = o.col || col(); V.gh.push({ x: ox, y: oy, a, life: .4, max: .4, c }); u.ring(V, ox, oy, 6, 46, .3, c, 4, true); u.ring(V, R.p.x, R.p.y, 6, 56, .3, '#fff', 3, true);
        u.flash(V, R.p.x, R.p.y, 34, .16, c); u.spark(V, R.p.x, R.p.y, 14, c, {}); R.inv = Math.max(R.inv, .3);
      }
      for (let i = 0; i < 3; i++) u.later(V, .08 + i * .24, () => { if (t.dead) return; D.FX.role[role](R, atan2(t.y - R.p.y, t.x - R.p.x), i); });
      return .95;
    },

    /* ================= FIGHTER — Ironwill Greataxe (Heavy Impact) ================= */
    overhead(R, ang, o) {                                  // Hit 1 Overhead Cleave: banting vertikal, hitlag 0.05 dtk saat kontak
      const u = FU(), V = u.st(R), c = o.col || col(), dur = .42, r = o.r || 82;
      V.sw = { k: 'smash', t: 0, dur, ang, lunge: 10 };
      u.later(V, dur * .55, () => {
        const x = R.p.x + cos(ang) * 62, y = R.p.y + sin(ang) * 62; burst(R, x, y, r, c);
        u.add(V, { k: 'line', x1: x, y1: y - 110, x2: x, y2: y, w: 16, life: .18, c: GOLD });
        const h = inCircle(R, x, y, r); h.forEach((m) => strike(R, m, o.mult || 1.5, { kb: 10, c, ang, n: 9 }));
        V.shk = Math.max(V.shk, 6); if (h.length) u.hitstop(R, .05);
      });
      return .1;
    },
    tackle(R, ang, o) {                                    // Hit 3 Shoulder Tackle (dorong + stagger) → Spin 360°
      const u = FU(), V = u.st(R), c = o.col || col();
      V.sw = { k: 'smash', t: 0, dur: .4, ang, lunge: 14 }; R.inv = Math.max(R.inv, .25); dashAlong(R, ang, o.dash || 58);
      u.later(V, .08, () => {
        const h = inCone(R, R.p.x, R.p.y, ang, 84, .8); h.forEach((m) => { strike(R, m, o.mult || 1, { kb: 30, c, ang, n: 8 }); stunMob(m, .5); });
        u.ring(V, R.p.x + cos(ang) * 40, R.p.y + sin(ang) * 40, 6, 44, .2, '#fff', 3); V.shk = Math.max(V.shk, 4); if (h.length) u.hitstop(R, .04);
      });
      u.later(V, .4, () => STEPS.cleave(R, ang, { mult: o.spin || 1.3, r: 104, col: c, kb: 14 }));
      return .9;
    },
    quake(R, ang, o) {                                     // Hit 4 Earthshatter Slam: angkat tinggi → hantam, tanah retak berapi, knockback
      const u = FU(), V = u.st(R), c = o.col || col(), r = o.r || 125;
      V.sw = { k: 'raise', t: 0, dur: .4, ang };
      u.later(V, .4, () => { V.sw = { k: 'smash', t: 0, dur: .4, ang, lunge: 8 }; });
      u.later(V, .62, () => {
        const x = R.p.x + cos(ang) * 75, y = R.p.y + sin(ang) * 75;
        for (let i = 0; i < 9; i++) { const a = ang + (i - 4) * .3, l = rnd(110, 170), j = rnd(-.15, .15); u.add(V, { k: 'line', x1: x, y1: y, x2: x + cos(a) * l * .5, y2: y + sin(a) * l * .5, w: 7, life: .8, c: '#ffb06a' }); u.add(V, { k: 'line', x1: x + cos(a) * l * .5, y1: y + sin(a) * l * .5, x2: x + cos(a + j) * l, y2: y + sin(a + j) * l, w: 5, life: .8, c: '#ff5a2a' }); }
        burst(R, x, y, r, '#ff7a3a', true); u.ring(V, x, y, 10, r * 1.2, .45, GOLD, 7, true);
        const h = inCircle(R, x, y, r); h.forEach((m) => { strike(R, m, o.mult || 2.8, { kb: 34, c: '#ff7a3a', n: 12, ang }); burn(R, m, .6, 3, FIRE); });
        V.shk = Math.max(V.shk, 14); if (h.length) u.hitstop(R, .09);
      });
      return .65;
    },

    /* ================= MAGE — Embercall Staff (Catalyst) ================= */
    twinEmber(R, ang, o) {                                 // Hit 1: 2 bola api melayang, melengkung mengejar target terdekat
      const u = FU(), V = u.st(R), U = S(R), c = o.col || col(); V.sw = { k: 'cast', t: 0, dur: .42, wu: .14, ang, big: false };
      if (U.on.z) useRes(R, .5);
      u.later(V, .14, () => {
        const t = nearest(R, R.p.x, R.p.y, 380), sp = t ? .75 : .22;
        for (const sd of [-1, 1]) {
          const a = ang + sd * sp, x = R.p.x + cos(a) * 30, y = R.p.y + sin(a) * 30;
          V.pj.push({ k: 'orb', x, y, a, spd: 470, tgt: t, life: 1.3, mult: o.mult || .7, big: false, oc: false, rad: 9, c: sd > 0 ? GOLD : c, hit: [], t: 0 }); u.spark(V, x, y, 6, c, { a, sp: .5 });
        }
      });
      return 0;
    },
    flameStep(R, ang, o) {                                 // Hit 2: side-step tipis + kibasan staf → gelombang api busur
      const U = S(R), side = (U.fs = -(U.fs || 1)); R.inv = Math.max(R.inv, .2); dashAlong(R, ang + side * PI / 2, 46);
      STEPS.slash(R, ang, { mult: o.mult || 1.2, col: o.col || col(), range: 150, span: 2.1, th: 36, dir: side, kb: 8, burn: .25, lunge: 0 });
      return 0;
    },
    vortex(R, ang, o) {                                    // Hit 3: pusaran api di kaki target, menarik musuh 0.5 dtk
      const u = FU(), V = u.st(R), c = o.col || col(), r = o.r || 80, t = nearest(R, R.p.x + cos(ang) * 110, R.p.y + sin(ang) * 110, 280);
      const x = t ? t.x : R.p.x + cos(ang) * 130, y = t ? t.y : R.p.y + sin(ang) * 130; V.sw = { k: 'raise', t: 0, dur: .5, ang };
      u.ring(V, x, y, r * .3, r, .55, c, 3, true); u.ring(V, x, y, r * .2, r * .8, .5, GOLD, 3, true);
      for (let i = 0; i < 5; i++) u.later(V, .05 + i * .1, () => {
        for (const m of alive(R)) { const dx = x - m.x, dy = y - m.y, d = hyp(dx, dy); if (d > r * 1.6 || d < 8) continue; const sp = Math.min(d, (m.isBoss ? 30 : 280) * .1); C().move(R, m, dx / d * sp, dy / d * sp, m.r - 2); }
        u.spark(V, x + rnd(-r, r) * .7, y + rnd(-r, r) * .7, 3, Math.random() < .5 ? c : GOLD, { a: -PI / 2, sp: .6, v0: 40, v1: 130 });
      });
      u.later(V, .55, () => { burst(R, x, y, r, c); inCircle(R, x, y, r).forEach((m) => { strike(R, m, o.mult || 1, { n: 6, c }); burn(R, m, .25, 2, c); }); });
      return .35;
    },
    erupt(R, ang, o) {                                     // Hit 4 Ignition Erupt: staf ke tanah → pilar api eksplosif di bawah tiap musuh
      const u = FU(), V = u.st(R), c = o.col || col(); V.sw = { k: 'smash', t: 0, dur: .45, ang, lunge: 4 }; let hs = false;
      const list = inCone(R, R.p.x, R.p.y, ang, 230, 1.0).sort((a, b) => hyp(a.x - R.p.x, a.y - R.p.y) - hyp(b.x - R.p.x, b.y - R.p.y)).slice(0, 6);
      const pts = list.length ? list.map((m) => [m.x, m.y]) : [[R.p.x + cos(ang) * 100, R.p.y + sin(ang) * 100], [R.p.x + cos(ang) * 170, R.p.y + sin(ang) * 170]];
      pts.forEach(([x, y], i) => {
        u.ring(V, x, y, 12, 62, .3 + i * .07, '#ff5a4a', 3, true);
        u.later(V, .3 + i * .07, () => {
          burst(R, x, y, 62, c, true); u.add(V, { k: 'line', x1: x, y1: y - 150, x2: x, y2: y, w: 22, life: .3, c: GOLD });
          inCircle(R, x, y, 62).forEach((m) => { strike(R, m, o.mult || 1.5, { kb: 12, c, n: 10 }); burn(R, m, .6, 3, c); stunMob(m, .5); hs = true; });
          V.shk = Math.max(V.shk, 6); if (hs) { hs = false; u.hitstop(R, .05); }
        });
      });
      return .35;
    },

    /* ================= TANK — Bastion Aegis (Shield-Breaker) ================= */
    edgeThrust(R, ang, o) {                                // Hit 1: tepi perisai + dorong badan ke depan (stagger)
      const u = FU(), V = u.st(R), c = o.col || col(); V.sw = { k: 'smash', t: 0, dur: .35, ang, lunge: 12 }; dashAlong(R, ang, 30);
      u.later(V, .12, () => {
        const h = inCone(R, R.p.x, R.p.y, ang, 82, .8); h.forEach((m) => { strike(R, m, o.mult || 1.1, { kb: 30, c, ang, n: 8 }); stunMob(m, .6); });
        u.ring(V, R.p.x + cos(ang) * 46, R.p.y + sin(ang) * 46, 6, 40, .2, '#fff', 3); V.shk = Math.max(V.shk, 3);
      });
      return .1;
    },
    vault(R, ang, o) {                                     // Hit 2: tusuk pedang → tendang chestplate musuh ke belakang
      const u = FU(), V = u.st(R), c = o.col || col(); let h = []; V.sw = { k: 'thrust', t: 0, dur: .4, ang };
      u.later(V, .1, () => { h = inCone(R, R.p.x, R.p.y, ang, 86, .5); h.forEach((m) => strike(R, m, o.mult || 1.2, { kb: 4, c, ang, n: 6 })); u.spark(V, R.p.x + cos(ang) * 70, R.p.y + sin(ang) * 70, 8, c, { a: ang, sp: .5 }); });
      u.later(V, .28, () => { h.forEach((m) => { if (m.dead) return; strike(R, m, .7, { kb: 46, c, ang, n: 8 }); stunMob(m, .4); }); if (h.length) { u.ring(V, R.p.x + cos(ang) * 60, R.p.y + sin(ang) * 60, 6, 44, .2, '#fff', 3); u.hitstop(R, .04); } });
      return .2;
    },
    aegisSlam(R, ang, o) {                                 // Hit 3: perisai dihantam ke tanah → gelombang kejut fisik
      const u = FU(), V = u.st(R), c = o.col || col(), r = o.r || 118; V.sw = { k: 'smash', t: 0, dur: .45, ang, lunge: 2 };
      u.later(V, .25, () => {
        burst(R, R.p.x, R.p.y, r, c, true); u.ring(V, R.p.x, R.p.y, 10, r * 1.15, .4, '#fff', 5, true);
        const h = inCircle(R, R.p.x, R.p.y, r); h.forEach((m) => { strike(R, m, o.mult || 1.5, { kb: 22, c, n: 9 }); stunMob(m, .6); });
        V.shk = Math.max(V.shk, 8); if (h.length) u.hitstop(R, .05);
      });
      return .2;
    },
    counter(R, ang, o) {                                   // Hit 4 Shield Counter Cleave: putar perisai tarik musuh ke tengah → tebasan horizontal berat
      const u = FU(), V = u.st(R), c = o.col || col(), px = R.p.x + cos(ang) * 58, py = R.p.y + sin(ang) * 58; let n = 0;
      V.sw = { k: 'flurry', t: 0, dur: .3, ang, lunge: 0 }; u.add(V, { k: 'arc', fol: 1, a: ang, dir: 1, span: 5, r: 92, th: 30, life: .3, sw: .4, c });
      u.later(V, .12, () => inCone(R, R.p.x, R.p.y, ang, 150, 1.1).forEach((m) => { if (m.isBoss) return; const dx = px - m.x, dy = py - m.y, d = hyp(dx, dy); if (d < 6) return; C().move(R, m, dx / d * Math.min(d, 90), dy / d * Math.min(d, 90), m.r - 2); n++; }));
      u.later(V, .32, () => STEPS.slash(R, ang, { mult: o.mult || 2.6, col: c, range: 106, span: 3.2, th: 42, kb: 16, lunge: 14 }));
      u.later(V, .45, () => { if (!n) return; const U = S(R); U.sh = R.s.hp * .03; U.shT = 6; U.hp0 = R.hp; D.FX.buffFx(R, '#8fc4ff'); fl(R, R.p.x, R.p.y - 30, 'SHIELD +3%', '#8fc4ff'); u.hitstop(R, .06); });
      return .6;
    },

    /* ================= ARCHER — Windpiercer Bow (Acrobatic Archery) ================= */
    snap(R, ang, o) {                                      // Hit 1: Double Snap-Shot sambil mundur 1 tap
      STEPS.dshot(R, ang, { mult: o.mult || .6, col: o.col }); R.inv = Math.max(R.inv, .15); dashAlong(R, ang + PI, 30); return 0;
    },
    gale(R, ang, o) {                                      // Hit 2: Piercing Gale — 1 panah berputar cepat, menembus lurus
      const u = FU(), V = u.st(R), s = R.s; V.sw = { k: 'draw', t: 0, dur: .38, wu: .14, ang, big: true };
      u.later(V, .14, () => {
        const x = R.p.x + cos(ang) * 22, y = R.p.y + sin(ang) * 22, spd = 1500;
        V.pj.push({ k: 'arrow', x, y, a: ang, spd, life: (s.range + 300) / spd, mult: o.mult || 1.7, big: true, pierce: true, rad: 11, c: AW, at: s.arrow, hit: [], t: 0 });
        u.ring(V, x, y, 4, 36, .2, AW, 3); u.spark(V, x, y, 10, AW, { a: ang, sp: .3, v0: 150, v1: 380 }); V.shk = Math.max(V.shk, 2.5);
      });
      return .1;
    },
    vaultShot(R, ang, o) {                                 // Hit 3: backflip lompati musuh / menjauh + 3 panah menyebar
      const u = FU(), V = u.st(R), s = R.s, t = nearest(R, R.p.x, R.p.y, 130), ja = t ? atan2(t.y - R.p.y, t.x - R.p.x) : ang + PI, jd = t ? hyp(t.x - R.p.x, t.y - R.p.y) + t.r + 70 : 150;
      R.inv = Math.max(R.inv, .45); dashAlong(R, ja, jd); V.sw = { k: 'draw', t: 0, dur: .4, wu: .1, ang, big: false };
      u.ring(V, R.p.x, R.p.y, 6, 50, .3, AW, 3, true);
      u.later(V, .1, () => { for (let i = -1; i <= 1; i++) { const a = ang + i * .26, x = R.p.x + cos(a) * 20, y = R.p.y + sin(a) * 20; V.pj.push({ k: 'arrow', x, y, a, spd: 1050, life: (s.range + 120) / 1050, mult: o.mult || .75, big: false, pierce: false, rad: 6, c: o.col || col(), at: s.arrow, hit: [], t: 0 }); } });
      return .2;
    },
    windblade(R, ang, o) {                                 // Hit 4 Rain of Windblades: panah raksasa ke tanah → badai angin kecil
      const u = FU(), V = u.st(R), t = nearest(R, R.p.x, R.p.y, 320), x = t ? t.x : R.p.x + cos(ang) * 200, y = t ? t.y : R.p.y + sin(ang) * 200, r = 95;
      V.sw = { k: 'draw', t: 0, dur: .45, wu: .2, ang, big: true }; u.ring(V, x, y, 12, r, .35, AW, 3, true);
      u.later(V, .22, () => u.add(V, { k: 'line', x1: x - 40, y1: y - 230, x2: x, y2: y, w: 14, life: .2, c: AW }));
      u.later(V, .35, () => {
        burst(R, x, y, r, AC, true); const h = inCircle(R, x, y, r); h.forEach((m) => { strike(R, m, o.mult || 1.9, { kb: 14, c: AW, n: 10 }); stunMob(m, .4); m.slow = Math.max(m.slow || 0, 1.5); });
        V.shk = Math.max(V.shk, 6); if (h.length) u.hitstop(R, .06);
      });
      for (let i = 1; i <= 5; i++) u.later(V, .35 + i * .3, () => {
        u.ring(V, x, y, 20, r * .9, .3, AW, 2); u.spark(V, x + rnd(-r, r) * .7, y + rnd(-r, r) * .5, 4, AW, { a: rnd(0, PI2), sp: .3, v0: 80, v1: 180 });
        inCircle(R, x, y, r * .9).forEach((m) => { strike(R, m, .3, { n: 3, c: AW }); m.slow = Math.max(m.slow || 0, 1); });
      });
      return .45;
    }
  };

  /* =====================  ENGINE UNIQUE  ===================== */
  const DEF = Object.freeze({ atk: 1, spd: 1, taken: 1, crit: 0, cd: 1, ls: 0, root: false, ghost: false, skr: 1, cc: false });   // skr = laju cooldown skill X & C (2 = cooldown 2× lebih cepat)
  let slowT = 0, slowK = 1; const CK = ['bdash', 'tempest', 'quake', 'charge', 'lock'];
  const S = (R) => R.u || (R.u = { cd: { z: 0, x: 0, c: 0, v: 0 }, on: {}, tm: {}, hold: null, pi: 0, last: -9, m: DEF });
  D.UNIQ = {};
  const cur = () => { const e = D.state && D.state.equipment; if (!e) return null; for (const s of ['weapon', 'offhand']) if (D.UNIQ[e[s]]) return D.UNIQ[e[s]]; return null; };

  const toggleSk = (n, i, c, msg) => ({ n, i, type: 'toggle', cd: .5,
    press(R, aim, u, k) { u.on[k] = !u.on[k]; D.FX.buffFx(R, c); fl(R, R.p.x, R.p.y - 28, `${msg} ${u.on[k] ? 'ON' : 'OFF'}`, c); } });
  const formSk = (n, i, c, cd, dur, msg, fn) => ({ n, i, type: 'cast', cd, status: (R, u) => (u.tm.form > 0 ? Math.ceil(u.tm.form) + 's' : ''),
    press(R, aim, u) { u.tm.form = dur; D.FX.buffFx(R, c); burst(R, R.p.x, R.p.y, 130, c, true); fl(R, R.p.x, R.p.y - 30, msg, c); if (fn) fn(R, u); D.Cine.flash(c, .25); } });

  D.Uniq = {
    cur, S, STEPS,
    /* ----- dipakai engine lain ----- */
    atkMul: (R) => (R.u ? R.u.m.atk : 1), spdMul: (R) => (R.u ? R.u.m.spd : 1), takenMul: (R) => (R.u ? R.u.m.taken : 1),
    critAdd: (R) => (R.u ? R.u.m.crit : 0), cdMul: (R) => (R.u ? R.u.m.cd : 1), lsExtra: (R) => (R.u ? R.u.m.ls : 0),
    rooted: (R) => !!(R.u && R.u.m.root), ccImmune: (R) => !!(R.u && R.u.m.cc),
    afterHurt(R, raw) { const d = cur(); if (d && d.afterHurt && R.u) d.afterHurt(R, raw, R.u); }, ghost: (R) => !!(R.u && R.u.m.ghost),
    onStrike(R, m, r) { const d = cur(); if (d && d.onStrike && !m.dead) d.onStrike(R, m, r); },

    /* basic attack: dipanggil FX.attack. true = pola unique menangani (pola standar dilewati) */
    attack(R, ang) {
      const d = cur(); if (!d || !d.pattern) return false; const u = S(R);
      if (u.bl || u.nv || u.ch) return true;                       // sedang channel Dragon Blitz / Supernova: tidak menyerang biasa
      if (R.t - u.last > R.s.cd + .8) u.pi = 0;
      const st = d.pattern[u.pi % d.pattern.length]; u.pi++; u.last = R.t;
      const ext = STEPS[st.t](R, ang, st) || 0; if (ext) R.atkT = Math.max(R.atkT, ext);
      return true;
    },

    press(k, aim) {
      const R = D.run; if (!R || R.done || R.pop) return false; const d = cur(); if (!d) return false; const sk = d.skills[k]; if (!sk) return false; const u = S(R);
      if (u.hold && u.hold.k !== k) return false;
      if (sk.block && sk.block(R, u)) { fl(R, R.p.x, R.p.y - 26, 'Tidak bisa dipakai sekarang', '#aaa'); return false; }
      if (u.cd[k] > 0) return false;
      if (u.ch || u.ad) this.cancelCh(R, u);                // pakai skill = batalkan charge Hold Attack
      if (sk.type === 'hold') { if (u.hold) return false; u.hold = { k, t: 0 }; if (sk.press(R, aim, u, k) === false) { u.hold = null; return false; } return true; }
      if (sk.press(R, aim, u, k) === false) return false;
      if (u.cd[k] <= 0) u.cd[k] = sk.cd;
      return true;
    },
    release(k) {
      const R = D.run; if (!R || !R.u || !R.u.hold || R.u.hold.k !== k) return;
      const d = cur(), sk = d && d.skills[k], u = R.u, h = u.hold; u.hold = null;
      if (sk && sk.release) sk.release(R, h, u); u.cd[k] = sk ? sk.cd : 1;
    },
    reset(R) { if (R && R.u) { const u = R.u; u.hold = null; u.ch = u.ad = u.tap = null; u.adLock = false; u.bl = u.nv = u.sg = u.rn = u.tn = u.ww = u.dm = u.cl = u.fz = u.iceA = u.ub = null; u.sh = 0; u.tm.form = 0; u.rs = u.sw = u.lz = null; u.bs = []; u.zn = []; u.ud = []; u.orbs = []; u.gv = null; } CK.concat('nova').forEach((k) => D.Cine.off(k)); slowT = 0; },
    /* slow-motion sesaat (detik NYATA, skala waktu k). Dipakai game.js: dt *= D.Uniq.timeScale(realDt) */
    slowmo(sec, k) { slowT = Math.max(slowT, sec); slowK = k; },
    timeScale(rdt) { if (slowT > 0 && D.run) { slowT -= rdt; return slowK; } slowT = 0; return 1; },
    aimHold(ang) { const R = D.run; if (R && R.u && R.u.hold) R.u.hold.aim = ang; },   // game.js: arah bidik terkini tiap frame selama skill Hold ditahan
    releaseAll() { const R = D.run; if (R && R.u && R.u.hold) this.release(R.u.hold.k); },

    /* ---- Hold Basic Attack (tahan klik / tombol Serang ≥ holdAtk.th detik → charge, lepas → jurus) ----
       Tap singkat = basic attack biasa (pola combo). game.js memanggil atkDown tiap frame saat tombol ditekan, atkUp saat tidak. */
    hasHold() { const d = cur(); return !!(d && d.holdAtk); },
    atkDown(x, y) { const R = D.run; if (!R || R.done) return; const u = S(R); if (u.adLock) return; u.ad = u.ad || { t: 0 }; u.ad.w = { x, y }; },
    atkUp() {
      const R = D.run; if (!R || !R.u) return; const u = R.u; if (!u.ad && !u.adLock) return;
      const a = u.ad; u.ad = null; u.adLock = false;
      if (u.ch) this.fireCh(R, u);
      else if (a && !R.done && !R.pop && cur()) { const n = u.pi; D.attack(a.w.x, a.w.y); if (u.pi === n) u.tap = { x: a.w.x, y: a.w.y, t: .3 }; }   // tap ditolak (cooldown) → di-buffer 0.3 dtk
    },
    atkCancel() { const R = D.run; if (R && R.u) { if (R.u.ch || R.u.ad) this.cancelCh(R, R.u); R.u.adLock = false; R.u.tap = null; } },
    cancelCh(R, u) { if (u.ch) { u.ch = null; D.Cine.off('lock'); } if (u.ad) { u.ad = null; u.adLock = true; } },
    fireCh(R, u) { const d = cur(), c = u.ch; if (!d || !c) { u.ch = null; return; } u.ch = null; D.Cine.off('lock'); if (d.holdAtk.release) d.holdAtk.release(R, u, c); u.pi = 0; u.last = R.t; },

    update(R, dt) {
      const u = S(R), d = cur();
      for (const k in u.cd) if (u.cd[k] > 0) u.cd[k] -= dt * ((k === 'x' || k === 'c') && u.m ? (u.m.skr || 1) : 1);
      for (const k in u.tm) if (u.tm[k] > 0) u.tm[k] -= dt;
      if (u.cineOn && !(u.tm.cine > 0)) { CK.forEach((k) => D.Cine.off(k)); u.cineOn = false; }
      if (!d) { u.m = DEF; if (u.ch || u.ad) this.cancelCh(R, u); return; }
      if (u.sh > 0) {                                      // shield sementara: serap damage yang baru diterima (HP dikembalikan)
        const drop = (u.hp0 !== undefined ? u.hp0 : R.hp) - R.hp; if (drop > 0.01) { const ab = Math.min(u.sh, drop); R.hp += ab; u.sh -= ab; }
        u.shT -= dt; if (u.shT <= 0) u.sh = 0;
      }
      u.hp0 = R.hp;
      if (d.res) { if (u.rs === undefined) u.rs = 100; if (!d.res.noRegen || !d.res.noRegen(R, u)) u.rs = Math.min(100, u.rs + d.res.regen * dt); }   // resource Mana / Stamina (0-100)
      u.m = d.mods ? Object.assign({}, DEF, d.mods(R, u)) : DEF;
      if (d.tick) d.tick(R, dt, u);
      if (u.hold) { const sk = d.skills[u.hold.k]; u.hold.t += dt; if (sk.hold) sk.hold(R, dt, u.hold, u); if (sk.max && u.hold.t >= sk.max) this.release(u.hold.k); }
      if (u.tap) { u.tap.t -= dt; if (u.tap.t <= 0 || R.done) u.tap = null; else if (R.atkT <= 0) { const n = u.pi; D.attack(u.tap.x, u.tap.y); if (u.pi !== n) u.tap = null; } }
      const ha = d.holdAtk;
      if (ha && u.ad) {                                                              // Hold Attack: charge
        const a = u.ad; a.t += dt;
        if (!u.ch && !u.adLock && a.t >= ha.th && R.atkT <= 0 && !u.hold && !u.bl && !u.nv && !R.pop) { u.ch = { t: 0, k: 0, ang: 0, w: a.w }; u.tap = null; if (ha.start) ha.start(R, u, u.ch); }
        if (u.ch) {
          const c = u.ch; c.t += dt; c.k = Math.min(1, c.t / ha.max); c.w = a.w; c.ang = atan2(a.w.y - R.p.y, a.w.x - R.p.x); R.atkT = Math.max(R.atkT, .12);
          if (ha.tick) ha.tick(R, dt, u, c);
          if (c.t >= ha.max) { this.fireCh(R, u); u.adLock = true; }                 // penuh → otomatis lepas
        }
      }
      if (u.m.ghost) R.inv = Math.max(R.inv, .15);             // untargetable: kebal & musuh kehilangan jejak
    },

    /* info tombol HUD */
    slots(R) {
      const d = cur(); if (!d) return null; const u = S(R);
      return ['z', 'x', 'c', 'v'].map((k) => {
        const s = d.skills[k]; let st = '', on = false;
        if (u.on[k]) { st = 'ON'; on = true; }
        else if (u.hold && u.hold.k === k) { st = u.hold.t.toFixed(1) + 's'; on = true; }
        else if (s.block && s.block(R, u)) st = '🔒';
        else if (u.cd[k] > 0) st = Math.ceil(u.cd[k]) + 's';
        else st = (s.status && s.status(R, u)) || 'Siap';
        return { k, n: s.n, i: s.i, st, on };
      });
    },

    /* overlay gambar dunia (aura, zona) */
    draw(ctx, R, cx, cy) {
      const d = cur(); if (!d) return; const u = S(R), px = R.p.x - cx, py = R.p.y - cy, t = R.t;
      if (d.draw) d.draw(ctx, R, cx, cy, u);
      if (u.ch) {                                                                     // cincin progres charge Hold Attack + visual per role
        const k = u.ch.k; ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.beginPath(); ctx.arc(px, py, 38, 0, PI2); ctx.stroke();
        ctx.lineWidth = 4; ctx.strokeStyle = k >= 1 ? GOLD : d.col; ctx.shadowColor = d.col; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, py, 38, -PI / 2, -PI / 2 + PI2 * k); ctx.stroke(); ctx.restore();
        if (d.holdAtk.draw) d.holdAtk.draw(ctx, R, cx, cy, u, u.ch, d);
      }
      if (u.sh > 0) { ctx.save(); ctx.strokeStyle = 'rgba(143,200,255,.9)'; ctx.lineWidth = 3; ctx.shadowColor = '#8fc4ff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, py, 26, 0, PI2); ctx.stroke(); ctx.restore(); }
      if (d.res && u.rs !== undefined) {                    // bar Mana / Stamina kecil di bawah karakter
        ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(px - 20, py + 24, 40, 5); ctx.fillStyle = d.res.c; ctx.fillRect(px - 19, py + 25, 38 * Math.max(0, u.rs) / 100, 3);
        ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(d.res.n + ' ' + Math.round(u.rs) + '%', px, py + 38); ctx.restore();
      }
      if (u.tm.form > 0) {                                  // aura bentuk ultimate
        const r = d.aura || 50, g = ctx.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, rgba(d.rgb, .05)); g.addColorStop(1, rgba(d.rgb, .3 + .08 * sin(t * 8)));
        ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, r, 0, PI2); ctx.fill();
        ctx.setLineDash([7, 6]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = rgba(d.rgb, .9); ctx.lineWidth = 2; ctx.shadowColor = d.col; ctx.shadowBlur = 12; ctx.stroke(); ctx.restore();
      }
      if (u.bl) {                                           // zona Dragon Blitz + penanda charge
        const b = u.bl, r = b.r, k = Math.min(1, b.t / 5);
        ctx.save(); ctx.fillStyle = rgba(d.rgb, .1 + .1 * k); ctx.beginPath(); ctx.arc(px, py, r, 0, PI2); ctx.fill();
        ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 50; ctx.strokeStyle = rgba(d.rgb, .95); ctx.lineWidth = 3; ctx.shadowColor = d.col; ctx.shadowBlur = 14; ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.lineWidth = 4; ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(px, py, r * (.25 + .6 * k), 0, PI2); ctx.stroke();
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `${b.t.toFixed(1)}s  ledakan +${Math.round(Math.min(5, b.t) * 5)}%`; ctx.strokeText(tx, px, py - r - 10); ctx.fillText(tx, px, py - r - 10); ctx.restore();
      }
    }
  };

  /* =====================  KIT UNIQUE  ===================== */

  /* ---------- ASSASSIN — Dragonfang Dagger (kit utama, sesuai rancangan) ---------- */
  D.UNIQ.u_assassin = {
    id: 'u_assassin', col: FIRE, rgb: '255,122,58', aura: 85,
    /* pola: slash api ×2 → sembur api → teleport ke belakang musuh terdekat + combo basic attack normal */
    pattern: [
      { t: 'slash', dir: 1, mult: 1.1, col: FIRE, span: 2.6, range: 72, th: 34, burn: .35 },
      { t: 'slash', dir: -1, mult: 1.1, col: FIRE, span: 2.6, range: 72, th: 34, burn: .35 },
      { t: 'spray', mult: .55, col: FIRE, range: 125, half: .55, pulses: 3, burn: .4 },
      { t: 'tpcombo', col: FIRE, range: 340 }
    ],
    mods: (R, u) => ({ spd: u.tm.form > 0 ? 1.5 : 1, root: !!u.bl, ghost: !!u.bl, skr: u.tm.form > 0 ? 2 : 1 }),   // Ultimate Form: X & C cooldown 2× lebih cepat
    onStrike(R, m) { const u = S(R); if (u.on.z || u.tm.form > 0) burn(R, m, .9, 3, FIRE); },   // Burning Ashes / Ultimate Form: basic attack membakar
    tick(R, dt, u) {
      if (u.on.z) {                                                                 // Burning Ashes: bayar 0.1% HP maks / detik
        if (u.tm.form > 0) u.on.z = false;
        else { R.hp = Math.max(1, R.hp - R.s.hp * .001 * dt); if (R.hp <= 1) { u.on.z = false; fl(R, R.p.x, R.p.y - 28, 'HP habis — Ashes OFF', '#ff6b5a'); } }
        if (u.on.z && Math.random() < dt * 10) FU().spark(FU().st(R), R.p.x + rnd(-8, 8), R.p.y + 4, 1, FIRE, { a: -PI / 2, sp: .4, v0: 20, v1: 70, sz: 1.3 });
      }
      if (u.tm.form > 0) {                                                          // Ultimate Form: area kecil, musuh di dalamnya terbakar 2% HP / detik
        u.auraT = (u.auraT || 0) - dt; const V = FU().st(R);
        if (Math.random() < dt * 30) FU().spark(V, R.p.x + rnd(-60, 60), R.p.y + rnd(-30, 30), 1, Math.random() < .5 ? FIRE : GOLD, { a: -PI / 2, sp: .3, v0: 30, v1: 90, sz: 1.5 });
        if (u.auraT <= 0) {
          u.auraT = 1;
          inCircle(R, R.p.x, R.p.y, 85).forEach((m) => { C().trueHit(m, .02 * Math.min(m.max, 1e6)); FU().spark(V, m.x, m.y, 8, FIRE, { a: -PI / 2, sp: .9 }); });
        }
      }
    },
    skills: {
      z: Object.assign(toggleSk('Burning Ashes', '🔥', FIRE, 'BURNING ASHES'), { block: (R, u) => u.tm.form > 0 }),   // tidak bisa dipakai saat Ultimate Form
      x: { n: 'Burning Dash', i: '💨', type: 'cast', cd: 8,
        press(R, aim, u) {
          const u2 = FU(), V = u2.st(R), ang = aim.ang, MAX = 230; let tgt = null, ba = 1e9;
          for (const m of alive(R)) { const dx = m.x - R.p.x, dy = m.y - R.p.y, al = dx * cos(ang) + dy * sin(ang), pe = Math.abs(-dx * sin(ang) + dy * cos(ang)); if (al > 0 && al < MAX + m.r && pe < m.r + 28 && al < ba) { ba = al; tgt = m; } }
          R.atkT = Math.max(R.atkT, .3);
          if (!tgt) { dashAlong(R, ang, MAX); u2.ring(V, R.p.x, R.p.y, 6, 50, .3, FIRE, 4, true); u.cd.x = 3; return; }
          const a = atan2(tgt.y - R.p.y, tgt.x - R.p.x); dashAlong(R, a, Math.max(0, ba - (tgt.r + 22))); R.inv = Math.max(R.inv, .9);
          D.Cine.on('bdash', { bars: 1, zoom: .1, vig: .65 }); u.tm.cine = 1.15; u.cineOn = true; R.hs = Math.max(R.hs || 0, .12);        // auto masuk cutscene
          u2.later(V, .04, () => {
            D.Cine.invert(.3); D.Cine.flash(FIRE, .25);                                                                                   // layar invert
            const a2 = tgt.dead ? a : atan2(tgt.y - R.p.y, tgt.x - R.p.x); V.sw = { k: 'smash', t: 0, dur: .4, ang: a2, lunge: 10 };
            u2.add(V, { k: 'arc', fol: 1, a: a2, dir: 1, span: 1.5, r: 175, th: 64, life: .45, sw: .35, c: FIRE });
            u2.add(V, { k: 'arc', fol: 1, a: a2, dir: -1, span: 1.2, r: 140, th: 40, life: .4, sw: .3, c: GOLD });
            u2.spark(V, R.p.x + cos(a2) * 30, R.p.y + sin(a2) * 30, 46, FIRE, { a: a2, sp: .75, v0: 160, v1: 440, l: 1.6, sz: 1.6 });
            u2.ring(V, R.p.x + cos(a2) * 90, R.p.y + sin(a2) * 90, 10, 110, .4, FIRE, 7, true);
            inCone(R, R.p.x, R.p.y, a2, 175, .75).forEach((m) => { strike(R, m, 2.2, { kb: 26, c: FIRE, n: 12, ang: a2 }); burn(R, m, 1.2, 3, FIRE); });   // cone AOE + burn
            V.shk = Math.max(V.shk, 11); u2.hitstop(R, .08); fl(R, R.p.x, R.p.y - 30, 'BURNING DASH!', FIRE);
          });
          u.cd.x = 8;
        } },
      c: { n: 'Dragon Blitz', i: '🐉', type: 'hold', cd: 14, max: 5,
        status: (R, u) => '', 
        press(R, aim, u) {
          const u2 = FU(), V = u2.st(R), r = 115; u.bl = { t: 0, cut: .1, r };
          burst(R, R.p.x, R.p.y, r, FIRE, true); fl(R, R.p.x, R.p.y - 30, 'DRAGON BLITZ', FIRE); V.sw = { k: 'finish', t: 0, dur: .5, ang: aim.ang, lunge: 0 };
          inCircle(R, R.p.x, R.p.y, r).forEach((m) => strike(R, m, 1, { n: 8, c: FIRE }));                       // musuh di AOE langsung kena
          R.inv = Math.max(R.inv, .3);
        },
        hold(R, dt, h, u) {                                  // slash beruntun gaya basic attack Assassin di dalam AOE
          const b = u.bl; if (!b) return; b.t = h.t; b.cut -= dt; R.inv = Math.max(R.inv, .15);
          if (b.cut <= 0) {
            b.cut = .26; const u2 = FU(), V = u2.st(R), t = nearest(R, R.p.x, R.p.y, b.r), x = t ? t.x : R.p.x + rnd(-b.r, b.r) * .8, y = t ? t.y : R.p.y + rnd(-b.r, b.r) * .8, a = rnd(0, PI);
            V.gh.push({ x: R.p.x, y: R.p.y, a, life: .25, max: .25, c: FIRE });
            for (const k of [0, PI / 2]) u2.add(V, { k: 'line', x1: x - cos(a + k) * 62, y1: y - sin(a + k) * 62, x2: x + cos(a + k) * 62, y2: y + sin(a + k) * 62, w: 9, life: .18, c: k ? GOLD : FIRE });
            u2.ring(V, x, y, 4, 40, .2, '#fff', 3); u2.spark(V, x, y, 6, FIRE, {});
            inCircle(R, x, y, 46).forEach((m) => { if (hyp(m.x - R.p.x, m.y - R.p.y) < b.r + m.r) strike(R, m, .35, { n: 3, c: FIRE }); });
          }
        },
        release(R, h, u) {                                   // meledak: 2× basic attack, +5% tiap detik di-hold (maks 5 dtk)
          const b = u.bl; u.bl = null; if (!b) return; const u2 = FU(), V = u2.st(R), mult = 2 * (1 + .05 * Math.min(5, h.t)), r = b.r * 1.15;
          burst(R, R.p.x, R.p.y, r, FIRE, true); u2.ring(V, R.p.x, R.p.y, 10, r * 1.2, .5, GOLD, 8, true);
          const hit = inCircle(R, R.p.x, R.p.y, r); hit.forEach((m) => { strike(R, m, mult, { kb: 22, c: FIRE, n: 14 }); burn(R, m, .8, 3, FIRE); });
          V.shk = Math.max(V.shk, 12); if (hit.length) u2.hitstop(R, .1); D.Cine.flash(FIRE, .2); R.inv = Math.max(R.inv, .4);
          fl(R, R.p.x, R.p.y - 34, `LEDAKAN ×${mult.toFixed(2)}`, GOLD);
        } },
      v: formSk('ULTIMATE FORM', '🌋', FIRE, 90, 15, 'ULTIMATE FORM!', (R, u) => { u.on.z = false; })
    }
  };

  /* ---------- FIGHTER — Ironwill Greataxe ---------- */
  const FC = '#e0653a', BR = '#cd7f32';
  D.UNIQ.u_fighter = {
    id: 'u_fighter', col: FC, rgb: '205,127,50', aura: 70,
    pattern: [                                                                      // Heavy Impact: Overhead Cleave → Horizontal Sweep → Shoulder Tackle+Spin → Earthshatter Slam
      { t: 'overhead', mult: 1.5, r: 82, col: FC },
      { t: 'slash', dir: -1, mult: 1.4, col: FC, span: 3.7, range: 118, th: 42, kb: 10, lunge: 12 },
      { t: 'tackle', mult: 1.0, spin: 1.3, col: FC, dash: 58 },
      { t: 'quake', mult: 2.8, r: 125, col: FC }
    ],
    holdAtk: {                                                                      // Charge Slash: tahan ≤2 dtk (hyper-armor), lepas = ayunan raksasa, abaikan 30% Armor
      th: .25, max: 2,
      start(R, u, c) { D.FX.buffFx(R, FC); fl(R, R.p.x, R.p.y - 30, 'CHARGE SLASH', FC); },
      tick(R, dt, u, c) { if (Math.random() < dt * (10 + 30 * c.k)) FU().spark(FU().st(R), R.p.x + rnd(-26, 26), R.p.y + rnd(-6, 20), 1, c.k >= 1 ? GOLD : FC, { a: -PI / 2, sp: .3, v0: 30, v1: 100, sz: 1.3 }); if (c.k >= 1 && !c.full) { c.full = true; FU().ring(FU().st(R), R.p.x, R.p.y, 10, 70, .3, GOLD, 4, true); } },
      release(R, u, c) {
        const u2 = FU(), V = u2.st(R), k = c.k, a = c.ang, mult = (2.2 + 3.3 * k) * 1.3, rng = 150 + 25 * k;        // ×1.3 ≈ abaikan 30% armor
        V.sw = { k: 'smash', t: 0, dur: .45, ang: a, lunge: 16 }; R.atkT = Math.max(R.atkT, .5); R.inv = Math.max(R.inv, .15);
        u2.add(V, { k: 'arc', fol: 1, a, dir: 1, span: 3.6, r: rng + 10, th: 66, life: .42, sw: .4, c: FC }); u2.add(V, { k: 'arc', fol: 1, a, dir: -1, span: 3.0, r: rng - 25, th: 34, life: .36, sw: .3, c: GOLD });
        u2.later(V, .12, () => {
          const h = inCone(R, R.p.x, R.p.y, a, rng, 1.5); burst(R, R.p.x + cos(a) * 60, R.p.y + sin(a) * 60, 90 + 40 * k, FC, true);
          h.forEach((m) => strike(R, m, mult, { kb: 24 + 20 * k, c: FC, n: 12, ang: a })); V.shk = Math.max(V.shk, 8 + 6 * k); if (h.length) u2.hitstop(R, .06 + .05 * k); D.Cine.flash(FC, .15);
        });
        fl(R, R.p.x, R.p.y - 34, `CHARGE SLASH ×${mult.toFixed(1)}`, k >= 1 ? GOLD : FC);
      },
      draw(ctx, R, cx, cy, u, c) { const px = R.p.x - cx, py = R.p.y - cy; ctx.save(); ctx.strokeStyle = rgba('224,101,58', .55 + .35 * c.k); ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -R.t * 40; ctx.shadowColor = FC; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, py, 150 + 25 * c.k, c.ang - 1.5, c.ang + 1.5); ctx.stroke(); ctx.restore(); }
    },
    mods: (R, u) => ({ cd: u.on.z ? 1 / 1.3 : 1, ls: u.on.z ? .05 : 0, spd: u.ww ? .6 : u.ch ? .5 : 1, taken: (u.tm.form > 0 ? .6 : 1) * (u.ch ? .75 : 1), cc: u.tm.form > 0 || !!u.ch }),   // charge = hyper-armor (kebal CC, damage diterima -25%)
    tick(R, dt, u) {
      const V = FU().st(R);
      if (u.on.z) {                                                                 // Bloodlust Berserk: -1% HP / detik (berhenti di 10% HP)
        if (u.tm.form > 0) u.on.z = false;
        else { R.hp = Math.max(1, R.hp - R.s.hp * .01 * dt); if (R.hp < R.s.hp * .1) { u.on.z = false; fl(R, R.p.x, R.p.y - 28, 'HP rendah — Bloodlust OFF', '#ff6b5a'); } }
        if (u.on.z && Math.random() < dt * 14) FU().spark(V, R.p.x + rnd(-10, 10), R.p.y + 6, 1, '#d1303f', { a: -PI / 2, sp: .4, v0: 20, v1: 70, sz: 1.3 });
      }
      if (u.ww) {                                                                   // Executioner's Whirlwind: putar kapak + vakum musuh
        const w = u.ww; w.tk -= dt; w.sp -= dt;
        for (const m of alive(R)) { const dx = R.p.x - m.x, dy = R.p.y - m.y, d = hyp(dx, dy); if (d > 175 || d < 30) continue; const sp = Math.min(d - 28, (m.isBoss ? 40 : 150) * dt); C().move(R, m, dx / d * sp, dy / d * sp, m.r - 2); }
        if (w.sp <= 0) { w.sp = .28; w.a += 2.1; V.sw = { k: 'flurry', t: 0, dur: .3, ang: w.a, lunge: 0 }; FU().add(V, { k: 'arc', fol: 1, a: w.a, dir: 1, span: 4.2, r: 112, th: 34, life: .3, sw: .4, c: FC }); }
        if (w.tk <= 0) { w.tk = .35; inCircle(R, R.p.x, R.p.y, 118).forEach((m) => strike(R, m, .4, { n: 3, c: FC })); }
        R.atkT = Math.max(R.atkT, .2);
      }
      if (u.tm.form > 0) {                                                          // Avatar of Iron: aura Shockwave konstan
        u.auraT = (u.auraT || 0) - dt;
        if (Math.random() < dt * 20) FU().spark(V, R.p.x + rnd(-30, 30), R.p.y + rnd(-26, 26), 1, BR, { a: -PI / 2, sp: .3, v0: 20, v1: 60, sz: 1.5 });
        if (u.auraT <= 0) { u.auraT = .5; FU().ring(V, R.p.x, R.p.y, 10, 110, .4, BR, 4, true); inCircle(R, R.p.x, R.p.y, 110).forEach((m) => strike(R, m, .45, { kb: 8, c: BR, n: 3 })); V.shk = Math.max(V.shk, 1.5); }
      }
    },
    draw(ctx, R, cx, cy, u) {
      const px = R.p.x - cx, py = R.p.y - cy, t = R.t;
      if (u.tm.form > 0) {                                                          // tubuh perunggu raksasa
        ctx.save(); const g = ctx.createRadialGradient(px, py - 6, 4, px, py - 6, 34); g.addColorStop(0, 'rgba(255,214,140,.55)'); g.addColorStop(1, 'rgba(160,90,30,.15)');
        ctx.fillStyle = g; ctx.strokeStyle = 'rgba(255,200,120,.9)'; ctx.lineWidth = 3; ctx.shadowColor = BR; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(px, py - 6, 30 + 2 * sin(t * 5), 0, PI2); ctx.fill(); ctx.stroke(); ctx.restore();
      }
      if (u.ww) {
        const w = u.ww, k = Math.min(1, w.t / 5); ctx.save(); ctx.strokeStyle = rgba('224,101,58', .9); ctx.lineWidth = 3; ctx.shadowColor = FC; ctx.shadowBlur = 12; ctx.setLineDash([16, 10]); ctx.lineDashOffset = -t * 80;
        ctx.beginPath(); ctx.arc(px, py, 118, 0, PI2); ctx.stroke(); ctx.setLineDash([]); ctx.strokeStyle = GOLD; ctx.beginPath(); ctx.arc(px, py, 118 * (.2 + .7 * k), 0, PI2); ctx.stroke();
        ctx.shadowBlur = 0; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `${w.t.toFixed(1)}s  ledakan +${Math.round(Math.min(5, w.t) * 5)}%`; ctx.strokeText(tx, px, py - 128); ctx.fillText(tx, px, py - 128); ctx.restore();
      }
    },
    skills: {
      z: Object.assign(toggleSk('Bloodlust Berserk', '🩸', FC, 'BLOODLUST'), { block: (R, u) => u.tm.form > 0 }),   // AS +30%, lifesteal 5%, -1% HP/dtk; terkunci saat Ultimate
      x: { n: 'Seismic Slam', i: '🪓', type: 'cast', cd: 9,
        press(R, aim, u) {
          const u2 = FU(), V = u2.st(R), ang = aim.ang, L = Math.max(70, Math.min(240, hyp(aim.x - R.p.x, aim.y - R.p.y)));
          dashAlong(R, ang, L); R.inv = Math.max(R.inv, .6); R.atkT = Math.max(R.atkT, .5);                    // melompat ke kursor
          D.Cine.on('quake', { bars: .7, zoom: .1, vig: .45 }); u.tm.cine = .75; u.cineOn = true;               // cinematic singkat: zoom-in
          u2.later(V, .12, () => {
            V.sw = { k: 'smash', t: 0, dur: .45, ang, lunge: 10 }; const x = R.p.x, y = R.p.y;
            for (let i = 0; i < 9; i++) { const a = ang + (i - 4) * .17, l = rnd(120, 175), j = rnd(-.15, .15); u2.add(V, { k: 'line', x1: x, y1: y, x2: x + cos(a) * l * .5, y2: y + sin(a) * l * .5 + 0, w: 6, life: .7, c: '#d9cba0' }); u2.add(V, { k: 'line', x1: x + cos(a) * l * .5, y1: y + sin(a) * l * .5, x2: x + cos(a + j) * l, y2: y + sin(a + j) * l, w: 4, life: .7, c: '#8a6a3a' }); }   // tanah retak
            u2.ring(V, x + cos(ang) * 80, y + sin(ang) * 80, 10, 120, .4, '#d9cba0', 7, true); u2.spark(V, x + cos(ang) * 40, y + sin(ang) * 40, 40, '#d9cba0', { a: ang, sp: .8, v0: 120, v1: 380, l: 1.5, sz: 1.5 });
            const h = inCone(R, x, y, ang, 170, .8); h.forEach((m) => { strike(R, m, 3, { kb: 16, c: '#d9cba0', n: 12, ang }); stunMob(m, 1.5); });   // damage fisik besar + Stun 1.5 dtk
            V.shk = Math.max(V.shk, 14); u2.hitstop(R, .09); fl(R, x, y - 30, 'SEISMIC SLAM!', '#d9cba0');
          });
        } },
      c: { n: "Executioner's Whirlwind", i: '🌀', type: 'hold', cd: 14, max: 5,
        press(R, aim, u) { u.ww = { t: 0, tk: .1, sp: 0, a: aim.ang }; burst(R, R.p.x, R.p.y, 110, FC, true); fl(R, R.p.x, R.p.y - 30, "EXECUTIONER'S WHIRLWIND", FC); },
        hold(R, dt, h, u) { if (u.ww) u.ww.t = h.t; },
        release(R, h, u) {                                   // ledakan pungkasan +5%/dtk; musuh HP < 20% → True Damage
          const w = u.ww; u.ww = null; if (!w) return; const u2 = FU(), V = u2.st(R), mult = 3 * (1 + .05 * Math.min(5, h.t)), r = 150; let tr = 0;
          burst(R, R.p.x, R.p.y, r, FC, true); u2.ring(V, R.p.x, R.p.y, 10, r * 1.2, .5, GOLD, 8, true);
          const hit = inCircle(R, R.p.x, R.p.y, r);
          hit.forEach((m) => { if (m.max && m.hp < m.max * .2) { C().trueHit(m, R.s.atk * mult); tr++; u2.spark(V, m.x, m.y, 14, '#d79cff', {}); } else strike(R, m, mult, { kb: 20, c: FC, n: 12 }); });
          V.shk = Math.max(V.shk, 12); if (hit.length) u2.hitstop(R, .1); D.Cine.flash(FC, .2);
          fl(R, R.p.x, R.p.y - 34, `LEDAKAN ×${mult.toFixed(2)}${tr ? ' · TRUE' : ''}`, tr ? '#d79cff' : GOLD);
        } },
      v: formSk('Avatar of Iron', '🗿', BR, 90, 14, 'AVATAR OF IRON!', (R, u) => { u.on.z = false; })   // Z terkunci, kebal CC, Armor +100% (≈ damage diterima ×0.6)
    }
  };

  /* ---------- MAGE — Embercall Staff ---------- */
  const MC = '#ff7a3a', MC2 = '#ffb06a';
  const meteor = (R, x, y, r, mult, delay) => {            // meteor kecil: telegraph → hantam → damage api AoE + Knockup (≈ stun singkat + dorong)
    const u = FU(), V = u.st(R); u.ring(V, x, y, r, r, delay, '#ff5a4a', 3, true); u.ring(V, x, y, r * .3, r * .9, delay, MC2, 3, true);
    u.later(V, delay, () => { burst(R, x, y, r, MC, true); inCircle(R, x, y, r).forEach((m) => { strike(R, m, mult, { kb: 12, c: MC, n: 10 }); burn(R, m, .8, 3); stunMob(m, .9); u.spark(V, m.x, m.y, 8, MC2, { a: -PI / 2, sp: .5, v0: 100, v1: 260 }); }); V.shk = Math.max(V.shk, 7); });
  };
  D.UNIQ.u_mage = {
    id: 'u_mage', col: MC, rgb: '255,122,58', aura: 48, res: { n: 'MANA', c: '#6fe0ff', regen: 3, noRegen: (R, u) => u.on.z },
    /* pola: 3 bola api beruntun (3× kena musuh sama → ledakan kecil +2% Mana) */
    pattern: [                                                                      // Catalyst: Twin Ember → Flame Step+Arcane Arc → Fiery Vortex → Ignition Erupt
      { t: 'twinEmber', mult: .7, col: MC },
      { t: 'flameStep', mult: 1.2, col: MC },
      { t: 'vortex', mult: 1.0, r: 80, col: MC },
      { t: 'erupt', mult: 1.5, col: MC }
    ],
    holdAtk: {                                                                      // Flame Dash Blast: tahan = jarak & damage naik; lepas = teleport-dash menembus musuh, meledak di belakangnya
      th: .25, max: 1.5,
      start(R, u, c) { D.FX.buffFx(R, MC); fl(R, R.p.x, R.p.y - 30, 'FLAME DASH', MC); },
      tick(R, dt, u, c) { if (Math.random() < dt * 30) { const a = rnd(0, PI2); FU().spark(FU().st(R), R.p.x + cos(a) * 24, R.p.y + sin(a) * 24, 1, Math.random() < .5 ? MC : GOLD, { a: a + PI, sp: .2, v0: 30, v1: 90 }); } },
      release(R, u, c) {
        const u2 = FU(), V = u2.st(R), k = c.k, a = c.ang, L = 190 + 150 * k, hit = inLine(R, R.p.x, R.p.y, a, L, 56); let dist = L;
        if (hit.length) { let far = 0; for (const m of hit) far = Math.max(far, (m.x - R.p.x) * cos(a) + (m.y - R.p.y) * sin(a) + m.r); dist = Math.min(L + 70, far + 50); }   // berhenti sedikit di belakang musuh terjauh
        hit.forEach((m) => { strike(R, m, 1.3 * (1 + .5 * k), { kb: 6, c: MC, n: 8, ang: a }); burn(R, m, .3, 2, MC); });
        R.inv = Math.max(R.inv, .6); R.atkT = Math.max(R.atkT, .45); dashAlong(R, a, dist); V.sw = { k: 'raise', t: 0, dur: .4, ang: a };
        u2.add(V, { k: 'line', x1: R.p.x - cos(a) * dist, y1: R.p.y - sin(a) * dist, x2: R.p.x, y2: R.p.y, w: 26, life: .25, c: MC });
        u2.later(V, .1, () => {
          const r = 105 + 30 * k; burst(R, R.p.x, R.p.y, r, MC, true); u2.ring(V, R.p.x, R.p.y, 10, r * 1.2, .45, GOLD, 7, true);
          const h = inCircle(R, R.p.x, R.p.y, r); h.forEach((m) => { strike(R, m, 2.4 * (1 + .6 * k), { kb: 18, c: MC, n: 14 }); burn(R, m, .7, 3, MC); stunMob(m, .6); });
          V.shk = Math.max(V.shk, 10); if (h.length) u2.hitstop(R, .08); D.Cine.flash(MC, .2); fl(R, R.p.x, R.p.y - 34, `IGNITION ×${(2.4 * (1 + .6 * k)).toFixed(1)}`, GOLD);
        });
      },
      draw(ctx, R, cx, cy, u, c) { const px = R.p.x - cx, py = R.p.y - cy, L = 190 + 150 * c.k; ctx.save(); ctx.strokeStyle = rgba('255,122,58', .7); ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -R.t * 60; ctx.shadowColor = MC; ctx.shadowBlur = 10; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + cos(c.ang) * L, py + sin(c.ang) * L); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(px + cos(c.ang) * L, py + sin(c.ang) * L, 14, 0, PI2); ctx.stroke(); ctx.restore(); }
    },
    mods: (R, u) => ({ atk: u.on.z ? 1.2 : 1, root: !!u.nv, spd: u.ch ? .6 : 1 }),
    tick(R, dt, u) {
      if (u.on.z) {                                                                 // Combustion Field: -0.5% Mana / detik (+0.5% tiap menyihir)
        u.rs = Math.max(0, u.rs - .5 * dt); if (u.rs <= 0) { u.on.z = false; fl(R, R.p.x, R.p.y - 28, 'Mana habis — Field OFF', '#ff6b5a'); }
        if (Math.random() < dt * 14) { const a = rnd(0, PI2); FU().spark(FU().st(R), R.p.x + cos(a) * 20, R.p.y + sin(a) * 20, 1, MC, { a: -PI / 2, sp: .4, v0: 20, v1: 60, sz: 1.3 }); }
      }
      if (u.sg) {                                                                   // Inferno Singularity: tarik musuh ke pusat + damage konstan (radius tumbuh)
        const g = u.sg; g.r = 80 + 28 * Math.min(5, g.t); g.tk -= dt;
        for (const m of alive(R)) { const dx = g.x - m.x, dy = g.y - m.y, d = hyp(dx, dy); if (d > g.r * 1.3 || d < 12) continue; const sp = Math.min(d, (m.isBoss ? 35 : 130) * dt); C().move(R, m, dx / d * sp, dy / d * sp, m.r - 2); }
        if (g.tk <= 0) { g.tk = .4; inCircle(R, g.x, g.y, g.r).forEach((m) => strike(R, m, .3, { n: 2, c: MC })); }
        if (Math.random() < dt * 40) { const a = rnd(0, PI2), r = rnd(g.r * .4, g.r); FU().spark(FU().st(R), g.x + cos(a) * r, g.y + sin(a) * r, 1, Math.random() < .5 ? MC : GOLD, { a: a + PI, sp: .2, v0: 40, v1: 110 }); }
      }
    },
    draw(ctx, R, cx, cy, u) {
      const t = R.t, px = R.p.x - cx, py = R.p.y - cy;
      if (u.on.z) { ctx.save(); ctx.strokeStyle = rgba('255,122,58', .7); ctx.lineWidth = 2; ctx.shadowColor = MC; ctx.shadowBlur = 10; ctx.setLineDash([4, 5]); ctx.lineDashOffset = -t * 30; ctx.beginPath(); ctx.arc(px, py, 30 + 2 * sin(t * 6), 0, PI2); ctx.stroke(); ctx.restore(); }
      if (u.sg) {
        const g = u.sg, gx = g.x - cx, gy = g.y - cy, k = Math.min(1, g.t / 5); ctx.save();
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, g.r); gr.addColorStop(0, rgba('40,0,0', .75)); gr.addColorStop(.5, rgba('255,90,40', .2 + .15 * k)); gr.addColorStop(1, rgba('255,122,58', 0));
        ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, g.r, 0, PI2); ctx.fill();
        ctx.lineWidth = 3; ctx.shadowColor = MC; ctx.shadowBlur = 12;
        for (let i = 0; i < 3; i++) { ctx.strokeStyle = i ? rgba('255,213,74', .7) : rgba('255,122,58', .9); ctx.setLineDash([14, 10]); ctx.lineDashOffset = t * (60 + 25 * i) * (i % 2 ? -1 : 1); ctx.beginPath(); ctx.arc(gx, gy, g.r * (1 - i * .25), 0, PI2); ctx.stroke(); }
        ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `${g.t.toFixed(1)}s  ledakan +${Math.round(Math.min(5, g.t) * 5)}%`; ctx.strokeText(tx, gx, gy - g.r - 8); ctx.fillText(tx, gx, gy - g.r - 8); ctx.restore();
      }
      if (u.nv) {                                                                   // Supernova: layar meredup + bola api raksasa di atas karakter
        const n = u.nv, k = Math.min(1, n.t / 5); ctx.save();
        ctx.fillStyle = `rgba(0,0,0,${.4 * Math.min(1, n.t / .6)})`; ctx.fillRect(0, 0, 960, 540);
        ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.beginPath(); ctx.ellipse(px, py + 14, 26 + 24 * k, 8 + 6 * k, 0, 0, PI2); ctx.fill();   // bayangan di tanah
        const by = py - 78 - 8 * sin(t * 3), r = 16 + 40 * k, g = ctx.createRadialGradient(px, by, 0, px, by, r * 1.9);
        g.addColorStop(0, 'rgba(255,255,230,1)'); g.addColorStop(.3, 'rgba(255,210,90,.95)'); g.addColorStop(.6, 'rgba(255,100,40,.55)'); g.addColorStop(1, 'rgba(255,60,20,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, by, r * 1.9, 0, PI2); ctx.fill();
        ctx.strokeStyle = rgba('255,213,74', .8); ctx.lineWidth = 2; ctx.shadowColor = MC; ctx.shadowBlur = 16;
        for (let i = 0; i < 8; i++) { const a = i * PI / 4 + t * 1.5, l = r * (1.3 + .4 * sin(t * 7 + i)); ctx.beginPath(); ctx.moveTo(px + cos(a) * r, by + sin(a) * r); ctx.lineTo(px + cos(a) * r * 1.9 * l / r * .8, by + sin(a) * r * 1.9 * l / r * .8); ctx.stroke(); }
        ctx.shadowBlur = 0; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.lineWidth = 3;
        const tx = `${n.t.toFixed(1)}s  ledakan +${Math.round(Math.min(5, n.t) * 5)}%`; ctx.strokeText(tx, px, by - r * 1.9 - 8); ctx.fillText(tx, px, by - r * 1.9 - 8); ctx.restore();
      }
    },
    skills: {
      z: Object.assign(toggleSk('Combustion Field', '🔥', MC, 'COMBUSTION'), {            // Magic damage +20%, Mana -0.5%/dtk
        press(R, aim, u, k) { if (!u.on[k] && u.rs < 3) { fl(R, R.p.x, R.p.y - 28, 'Mana kurang', '#aaa'); return false; } u.on[k] = !u.on[k]; D.FX.buffFx(R, MC); fl(R, R.p.x, R.p.y - 28, `COMBUSTION ${u.on[k] ? 'ON' : 'OFF'}`, MC); } }),
      x: { n: 'Meteor Blink', i: '☄️', type: 'cast', cd: 9,
        press(R, aim, u) {
          const u2 = FU(), V = u2.st(R), a = atan2(aim.y - R.p.y, aim.x - R.p.x), L = Math.min(340, hyp(aim.x - R.p.x, aim.y - R.p.y)); let f = 1, ok = false, nx = R.p.x, ny = R.p.y;
          for (; f > .1; f -= .05) { nx = R.p.x + cos(a) * L * f; ny = R.p.y + sin(a) * L * f; if (walkOk(R, nx, ny)) { ok = true; break; } }
          if (!ok || L < 40) { fl(R, R.p.x, R.p.y - 26, 'Tujuan tidak valid', '#aaa'); return false; }
          const ox = R.p.x, oy = R.p.y; V.gh.push({ x: ox, y: oy, a, life: .4, max: .4, c: MC }); u2.ring(V, ox, oy, 6, 50, .3, MC2, 4, true);
          R.p.x = nx; R.p.y = ny; R.inv = Math.max(R.inv, .9); R.atkT = Math.max(R.atkT, .3);
          u2.ring(V, nx, ny, 6, 56, .3, '#fff', 3, true); u2.flash(V, nx, ny, 36, .16, MC);
          meteor(R, ox, oy, 100, 2.4, .55); meteor(R, nx, ny, 100, 2.4, .55); fl(R, nx, ny - 30, 'METEOR BLINK!', MC);   // meteor di titik asal & tujuan
        } },
      c: { n: 'Inferno Singularity', i: '🌀', type: 'hold', cd: 14, max: 5,
        press(R, aim, u) {
          const p = clampPt(R, aim, 300), V = FU().st(R); u.sg = { x: p.x, y: p.y, r: 80, t: 0, tk: .2 };
          burst(R, p.x, p.y, 90, MC, true); fl(R, p.x, p.y - 30, 'INFERNO SINGULARITY', MC); R.atkT = Math.max(R.atkT, .3);
        },
        hold(R, dt, h, u) { if (u.sg) u.sg.t = h.t; },
        release(R, h, u) {                                   // ledakan pungkasan: 3× ATK, +5% per detik hold
          const g = u.sg; u.sg = null; if (!g) return; const u2 = FU(), V = u2.st(R), mult = 3 * (1 + .05 * Math.min(5, h.t)), r = g.r * 1.1;
          burst(R, g.x, g.y, r, MC, true); u2.ring(V, g.x, g.y, 10, r * 1.25, .5, GOLD, 8, true);
          const hit = inCircle(R, g.x, g.y, r); hit.forEach((m) => { strike(R, m, mult, { kb: 18, c: MC, n: 14 }); burn(R, m, .8, 3); stunMob(m, .6); });
          V.shk = Math.max(V.shk, 11); if (hit.length) u2.hitstop(R, .09); D.Cine.flash(MC, .2); fl(R, g.x, g.y - 34, `LEDAKAN ×${mult.toFixed(2)}`, GOLD);
        } },
      v: { n: 'Supernova Cataclysm', i: '🌠', type: 'hold', cd: 90, max: 5,
        press(R, aim, u) {
          u.nv = { t: 0 }; D.Cine.on('nova', { bars: 1, zoom: .05, vig: .95 }); D.Cine.flash('#ffb06a', .3);     // letterbox + vignette + kamera meredup
          D.FX.buffFx(R, MC); fl(R, R.p.x, R.p.y - 34, 'SUPERNOVA CATACLYSM', MC); R.atkT = Math.max(R.atkT, .3);
        },
        hold(R, dt, h, u) { const n = u.nv; if (!n) return; n.t = h.t; const V = FU().st(R), a = rnd(0, PI2), r = rnd(50, 110); FU().spark(V, R.p.x + cos(a) * r, R.p.y - 70 + sin(a) * r * .6, 1, Math.random() < .5 ? MC : GOLD, { a: a + PI, sp: .15, v0: 60, v1: 150, sz: 1.4 }); },
        release(R, h, u) {                                   // bola api menghantam tanah: bakar SELURUH arena, +5% per detik hold
          const n = u.nv; u.nv = null; D.Cine.off('nova'); if (!n) return; const u2 = FU(), V = u2.st(R), mult = 8 * (1 + .05 * Math.min(5, h.t));
          D.Cine.flash('#fff', .45); D.Cine.invert(.12);
          for (let i = 0; i < 4; i++) u2.ring(V, R.p.x, R.p.y, 10, 260 + i * 160, .4 + i * .15, i % 2 ? GOLD : MC, 8, true);
          burst(R, R.p.x, R.p.y, 200, MC, true);
          const all = alive(R); all.forEach((m) => { strike(R, m, mult, { kb: 20, c: MC, n: 14 }); burn(R, m, 1.5, 4, MC); stunMob(m, .8); });
          V.shk = Math.max(V.shk, 18); if (all.length) u2.hitstop(R, .12); R.atkT = Math.max(R.atkT, .5);
          fl(R, R.p.x, R.p.y - 36, `CATACLYSM ×${mult.toFixed(2)}`, GOLD);
        } }
    }
  };

  /* ---------- TANK — Bastion Aegis ---------- */
  const TC = '#3498db', HOLY = '#ffe9a0';
  D.UNIQ.u_tank = {
    id: 'u_tank', col: TC, rgb: '52,152,219', aura: 80, res: { n: 'STAMINA', c: '#ffd54a', regen: 6, noRegen: (R, u) => u.on.z },
    pattern: [                                                                      // Shield-Breaker: Edge Thrust → Sword Vault → Aegis Slam → Shield Counter Cleave
      { t: 'edgeThrust', mult: 1.1, col: TC },
      { t: 'vault', mult: 1.2, col: TC },
      { t: 'aegisSlam', mult: 1.5, r: 118, col: TC },
      { t: 'counter', mult: 2.6, col: TC }
    ],
    holdAtk: {                                                                      // Absolute Guard Blast: tahan = serap 80% damage; lepas = ledakan Light damage sebesar damage terserap
      th: .25, max: 4,
      start(R, u, c) { c.abs = 0; c.hp = R.hp; D.FX.buffFx(R, HOLY); fl(R, R.p.x, R.p.y - 30, 'ABSOLUTE GUARD', HOLY); },
      tick(R, dt, u, c) {
        const drop = c.hp - R.hp; if (drop > .01) { c.abs = Math.min(R.s.hp * 2, c.abs + drop * 4); FU().spark(FU().st(R), R.p.x + cos(c.ang) * 30, R.p.y + sin(c.ang) * 30, 8, HOLY, { a: c.ang, sp: 1, v0: 80, v1: 220 }); }   // taken ×0.2 → terserap = drop ×4
        c.hp = R.hp;
      },
      release(R, u, c) {
        const u2 = FU(), V = u2.st(R), dmg = R.s.atk * 1.2 + c.abs, r = 135 + Math.min(40, c.abs / Math.max(1, R.s.hp) * 120);
        burst(R, R.p.x, R.p.y, r, HOLY, true); u2.ring(V, R.p.x, R.p.y, 10, r * 1.2, .5, '#fff', 8, true); V.sw = { k: 'smash', t: 0, dur: .4, ang: c.ang, lunge: 0 }; R.atkT = Math.max(R.atkT, .45);
        const h = inCircle(R, R.p.x, R.p.y, r); h.forEach((m) => { C().trueHit(m, dmg); u2.spark(V, m.x, m.y, 10, HOLY, {}); stunMob(m, .5); if (!m.isBoss && !m.dead) { const dx = m.x - R.p.x, dy = m.y - R.p.y, d = hyp(dx, dy) || 1; C().move(R, m, dx / d * 26, dy / d * 26, m.r - 2); } });
        V.shk = Math.max(V.shk, 10); if (h.length) u2.hitstop(R, .08); D.Cine.flash(HOLY, .2); fl(R, R.p.x, R.p.y - 34, `GUARD BLAST ${Math.round(dmg)}`, GOLD);
      },
      draw(ctx, R, cx, cy, u, c) { const px = R.p.x - cx, py = R.p.y - cy; ctx.save(); ctx.strokeStyle = rgba('255,233,160', .95); ctx.lineWidth = 7; ctx.shadowColor = HOLY; ctx.shadowBlur = 14; ctx.beginPath(); ctx.arc(px, py, 40, c.ang - .95, c.ang + .95); ctx.stroke();
        ctx.shadowBlur = 0; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; const tx = `SERAP ${Math.round(c.abs)}`; ctx.strokeText(tx, px, py - 50); ctx.fillText(tx, px, py - 50); ctx.restore(); }
    },
    mods: (R, u) => ({ spd: (u.on.z ? .7 : 1) * (u.ch ? .5 : 1), root: !!u.dm, taken: (u.tm.form > 0 ? .5 : 1) * (u.ch ? .2 : 1) * (u.dm ? Math.max(.4, 1 - (.2 + .06 * Math.min(5, u.dm.t))) : 1) }),
    afterHurt(R, raw, u) {                                                          // Iron Wall: pantulkan 15% damage ke penyerang terdekat
      if (!u.on.z || !(raw > 0)) return; const t = nearest(R, R.p.x, R.p.y, 150); if (!t) return;
      C().trueHit(t, raw * .15); FU().spark(FU().st(R), t.x, t.y, 6, TC, {}); fl(R, t.x, t.y - 22, 'PANTUL', TC);
    },
    tick(R, dt, u) {
      const V = FU().st(R);
      if (u.on.z) { u.rs = Math.max(0, u.rs - .2 * dt); if (u.rs <= 0) { u.on.z = false; fl(R, R.p.x, R.p.y - 28, 'Stamina habis — Stance OFF', '#ff6b5a'); } }
      if (u.dm) {                                                                   // Aegis Judgment: damage holy konstan di dalam kubah
        const d = u.dm; d.tk -= dt; if (d.tk <= 0) { d.tk = .4; inCircle(R, R.p.x, R.p.y, d.r).forEach((m) => strike(R, m, .3, { n: 2, c: HOLY })); }
        if (Math.random() < dt * 25) { const a = rnd(0, PI2); FU().spark(V, R.p.x + cos(a) * d.r * rnd(.3, 1), R.p.y + sin(a) * d.r * rnd(.3, 1), 1, HOLY, { a: -PI / 2, sp: .3, v0: 20, v1: 60, sz: 1.3 }); }
      }
      if (u.tm.form > 0) {                                                          // Bastion Domain: musuh dalam benteng diperlambat
        u.auraT = (u.auraT || 0) - dt; if (u.auraT <= 0) { u.auraT = .3; inCircle(R, R.p.x, R.p.y, 190).forEach((m) => { m.slow = Math.max(m.slow || 0, .5); }); }
      }
    },
    draw(ctx, R, cx, cy, u) {
      const px = R.p.x - cx, py = R.p.y - cy, t = R.t;
      if (u.on.z) { ctx.save(); ctx.strokeStyle = rgba('52,152,219', .85); ctx.lineWidth = 4; ctx.shadowColor = TC; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(px, py, 34, -PI * .8, -PI * .2); ctx.stroke(); ctx.beginPath(); ctx.arc(px, py, 34, PI * .2, PI * .8); ctx.stroke(); ctx.restore(); }
      if (u.dm) {
        const d = u.dm, k = Math.min(1, d.t / 5); ctx.save(); const g = ctx.createRadialGradient(px, py, d.r * .2, px, py, d.r); g.addColorStop(0, rgba('255,233,160', .05)); g.addColorStop(1, rgba('255,233,160', .28 + .2 * k));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, d.r, 0, PI2); ctx.fill(); ctx.strokeStyle = rgba('255,233,160', .95); ctx.lineWidth = 3 + 2 * k; ctx.shadowColor = HOLY; ctx.shadowBlur = 16; ctx.stroke();
        ctx.lineWidth = 1.5; ctx.shadowBlur = 0; for (let i = 0; i < 6; i++) { const a = i * PI / 3 + t * .4; ctx.beginPath(); ctx.moveTo(px + cos(a) * d.r * .3, py + sin(a) * d.r * .3); ctx.lineTo(px + cos(a) * d.r, py + sin(a) * d.r); ctx.stroke(); }
        ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `${d.t.toFixed(1)}s  gelombang +${Math.round(Math.min(5, d.t) * 5)}%  ·  DEF kubah -${Math.round((.2 + .06 * Math.min(5, d.t)) * 100)}%`; ctx.strokeText(tx, px, py - d.r - 8); ctx.fillText(tx, px, py - d.r - 8); ctx.restore();
      }
      if (u.tm.form > 0) {                                                          // benteng bayangan raksasa
        ctx.save(); ctx.fillStyle = 'rgba(20,24,50,.28)'; ctx.beginPath(); ctx.arc(px, py, 190, 0, PI2); ctx.fill(); ctx.strokeStyle = 'rgba(90,120,220,.85)'; ctx.lineWidth = 3; ctx.shadowColor = TC; ctx.shadowBlur = 14; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(15,18,40,.8)'; for (let i = 0; i < 8; i++) { const a = i * PI / 4 + PI / 8, tx = px + cos(a) * 190, ty = py + sin(a) * 190; ctx.fillRect(tx - 9, ty - 16, 18, 26); for (let j = -1; j <= 1; j++) ctx.fillRect(tx + j * 7 - 2, ty - 21, 4, 6); }
        ctx.restore();
      }
    },
    skills: {
      z: Object.assign(toggleSk('Iron Wall Stance', '🏰', TC, 'IRON WALL'), {           // Speed -30%, pantul 15%, Stamina -0.2%/dtk
        press(R, aim, u, k) { if (!u.on[k] && u.rs < 3) { fl(R, R.p.x, R.p.y - 28, 'Stamina kurang', '#aaa'); return false; } u.on[k] = !u.on[k]; D.FX.buffFx(R, TC); fl(R, R.p.x, R.p.y - 28, `IRON WALL ${u.on[k] ? 'ON' : 'OFF'}`, TC); } }),
      x: { n: 'Shield Charge', i: '🛡️', type: 'cast', cd: 9,
        press(R, aim, u) {
          const u2 = FU(), V = u2.st(R), ang = aim.ang, MAX = 260; let tgt = null, ba = 1e9;
          for (const m of alive(R)) { const dx = m.x - R.p.x, dy = m.y - R.p.y, al = dx * cos(ang) + dy * sin(ang), pe = Math.abs(-dx * sin(ang) + dy * cos(ang)); if (al > 0 && al < MAX + m.r && pe < m.r + 30 && al < ba) { ba = al; tgt = m; } }
          R.atkT = Math.max(R.atkT, .3); R.inv = Math.max(R.inv, .5);
          if (!tgt) { dashAlong(R, ang, MAX); u2.ring(V, R.p.x, R.p.y, 6, 50, .3, TC, 4, true); u.cd.x = 3; return; }
          dashAlong(R, atan2(tgt.y - R.p.y, tgt.x - R.p.x), Math.max(0, ba - (tgt.r + 24)));
          D.Cine.on('charge', { bars: 1, zoom: .1, vig: .6 }); u.tm.cine = .9; u.cineOn = true; R.hs = Math.max(R.hs || 0, .28);   // zoom-in + screen freeze singkat
          u2.later(V, .05, () => {
            const x = R.p.x, y = R.p.y; burst(R, x, y, 135, TC, true); u2.ring(V, x, y, 8, 160, .4, '#fff', 6, true); D.Cine.flash('#ffffff', .2);
            inCircle(R, x, y, 135).forEach((m) => { strike(R, m, 2.4, { kb: 22, c: TC, n: 12, ang }); stunMob(m, 1.5); m.tauntT = Math.max(m.tauntT || 0, 5); });   // Stun + Taunt
            V.shk = Math.max(V.shk, 13); u2.hitstop(R, .1); fl(R, x, y - 30, 'SHIELD CHARGE!', TC);
          });
          u.cd.x = 9;
        } },
      c: { n: 'Aegis Judgment', i: '⚖️', type: 'hold', cd: 14, max: 5,
        press(R, aim, u) { u.dm = { t: 0, r: 130, tk: .2 }; burst(R, R.p.x, R.p.y, 130, HOLY, true); fl(R, R.p.x, R.p.y - 30, 'AEGIS JUDGMENT', HOLY); FU().st(R).sw = { k: 'smash', t: 0, dur: .45, ang: aim.ang, lunge: 0 }; R.atkT = Math.max(R.atkT, .4); },
        hold(R, dt, h, u) { if (u.dm) u.dm.t = h.t; },
        release(R, h, u) {                                   // gelombang suci pungkasan: 3× ATK, +5% per detik
          const d = u.dm; u.dm = null; if (!d) return; const u2 = FU(), V = u2.st(R), mult = 3 * (1 + .05 * Math.min(5, h.t)), r = d.r * 1.4;
          burst(R, R.p.x, R.p.y, r, HOLY, true); u2.ring(V, R.p.x, R.p.y, 10, r * 1.2, .5, '#fff', 8, true);
          const hit = inCircle(R, R.p.x, R.p.y, r); hit.forEach((m) => { strike(R, m, mult, { kb: 24, c: HOLY, n: 14 }); stunMob(m, .6); });
          V.shk = Math.max(V.shk, 10); if (hit.length) u2.hitstop(R, .08); D.Cine.flash(HOLY, .2); fl(R, R.p.x, R.p.y - 34, `GELOMBANG SUCI ×${mult.toFixed(2)}`, GOLD);
        } },
      v: formSk('Bastion Domain', '🏯', TC, 90, 14, 'BASTION DOMAIN!')                    // damage diterima -50%, musuh di dalam benteng diperlambat
    }
  };

  /* ---------- ARCHER — Windpiercer Bow ---------- */
  D.UNIQ.u_archer = {
    id: 'u_archer', col: AC, rgb: '111,224,176', aura: 55, res: { n: 'STAMINA', c: '#ffd54a', regen: 8 },
    pattern: [                                                                      // Acrobatic Archery: Double Snap-Shot → Piercing Gale → Acrobatic Vault (3 panah) → Rain of Windblades
      { t: 'snap', mult: .6, col: AC },
      { t: 'gale', mult: 1.7 },
      { t: 'vaultShot', mult: .75, col: AC },
      { t: 'windblade', mult: 1.9 }
    ],
    holdAtk: {                                                                      // Focus Lock On: zoom-in, musuh di sekitar kursor melambat; lepas = panah tembus, PASTI crit
      th: .25, max: 2,
      start(R, u, c) { D.Cine.on('lock', { bars: .5, zoom: .1, vig: .55 }); fl(R, R.p.x, R.p.y - 30, 'FOCUS LOCK ON', AW); },
      tick(R, dt, u, c) { for (const m of alive(R)) if (hyp(m.x - c.w.x, m.y - c.w.y) < 130) m.slow = Math.max(m.slow || 0, .25); },
      release(R, u, c) {
        const u2 = FU(), V = u2.st(R), s = R.s, k = c.k, a = c.ang, mult = 3.2 + 1.8 * k;
        u.tm.gc = 1.2; V.sw = { k: 'draw', t: 0, dur: .4, wu: .08, ang: a, big: true }; R.atkT = Math.max(R.atkT, .4);          // gc → mods: crit +100 (semua kena = crit)
        u2.later(V, .08, () => {
          const x = R.p.x + cos(a) * 22, y = R.p.y + sin(a) * 22, spd = 1700;
          V.pj.push({ k: 'arrow', x, y, a, spd, life: (s.range + 420) / spd, mult, big: true, pierce: true, rad: 11, c: AW, at: s.arrow, hit: [], t: 0 });
          u2.ring(V, x, y, 4, 42, .25, AW, 4); u2.spark(V, x, y, 14, '#fff', { a, sp: .25, v0: 180, v1: 460 }); V.shk = Math.max(V.shk, 5); D.Cine.flash(AW, .15);
        });
        fl(R, R.p.x, R.p.y - 34, `LOCK-ON ×${mult.toFixed(1)} · CRIT`, GOLD);
      },
      draw(ctx, R, cx, cy, u, c) {
        const px = R.p.x - cx, py = R.p.y - cy, wx = c.w.x - cx, wy = c.w.y - cy, r = 46 - 22 * c.k; ctx.save(); ctx.strokeStyle = c.k >= 1 ? 'rgba(255,213,74,.95)' : 'rgba(191,245,255,.9)'; ctx.lineWidth = 2; ctx.shadowColor = AC; ctx.shadowBlur = 10;
        ctx.globalAlpha = .5; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(wx, wy); ctx.stroke(); ctx.globalAlpha = 1; ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(wx, wy, r, 0, PI2); ctx.stroke(); ctx.beginPath(); ctx.arc(wx, wy, 130, 0, PI2); ctx.globalAlpha = .3; ctx.stroke(); ctx.globalAlpha = 1;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { ctx.beginPath(); ctx.moveTo(wx + dx * (r - 8), wy + dy * (r - 8)); ctx.lineTo(wx + dx * (r + 10), wy + dy * (r + 10)); ctx.stroke(); } ctx.restore();
      }
    },
    mods: (R, u) => ({ spd: (1 + .05 * (u.gale ? u.gale.n : 0)) * (u.ch ? .5 : 1), cd: u.tm.form > 0 ? .5 : 1, crit: (u.tm.form > 0 ? 100 : 0) + (u.tm.gc > 0 ? 100 : 0) }),   // Ultimate / Lock-On: semua tembakan crit
    onStrike(R, m, r) {
      const u = S(R);
      if (r && r.c) u.gale = { n: Math.min(5, (u.gale ? u.gale.n : 0) + 1), t: 3 };                // tiap crit: speed +5% 3 dtk (stack 5×)
      if (u.tm.frost > 0 && !m.dead) m.slow = Math.max(m.slow || 0, 3);                            // panah es Tempest Reposition
    },
    tick(R, dt, u) {
      if (u.gale) { u.gale.t -= dt; if (u.gale.t <= 0) u.gale = null; }
      if (u.rn) {                                                                   // Arrow Rain Typhoon: hujan panah, makin lama makin rapat
        const g = u.rn, V = FU().st(R); g.t = (u.hold ? u.hold.t : g.t); g.acc += dt * (5 + 2.2 * g.t * 1.4);
        for (let n = 0; g.acc >= 1 && n < 3; n++, g.acc--) {
          const a = rnd(0, PI2), r = Math.sqrt(Math.random()) * g.r, x = g.x + cos(a) * r, y = g.y + sin(a) * r;
          FU().add(V, { k: 'line', x1: x - 14, y1: y - 90, x2: x, y2: y, w: 4, life: .16, c: AW });
          FU().later(V, .14, () => { FU().ring(V, x, y, 3, 22, .2, AC, 2); FU().spark(V, x, y, 3, AW, {}); inCircle(R, x, y, 24).forEach((m) => strike(R, m, .22, { n: 2, c: AC })); });
        }
      }
      if (u.tn) {                                                                   // Gale Force Tempest: bergerak perlahan, menyapu & memutar musuh
        const g = u.tn, V = FU().st(R); if (!(u.tm.form > 0)) { u.tn = null; return; }
        const nx = g.x + cos(g.a) * 55 * dt, ny = g.y + sin(g.a) * 55 * dt; if (C().walk(R, nx, ny)) { g.x = nx; g.y = ny; }
        g.tk -= dt; g.ph += dt * 9;
        for (const m of alive(R)) {
          const dx = g.x - m.x, dy = g.y - m.y, d = hyp(dx, dy); if (d > 105 || d < 6) continue; const w = m.isBoss ? .3 : 1;
          C().move(R, m, (dx / d * 80 + -dy / d * 140) * dt * w, (dy / d * 80 + dx / d * 140) * dt * w, m.r - 2); m.slow = Math.max(m.slow || 0, .4);
        }
        if (g.tk <= 0) { g.tk = .3; inCircle(R, g.x, g.y, 100).forEach((m) => strike(R, m, .4, { n: 3, c: AW })); }
        if (Math.random() < dt * 40) { const a = rnd(0, PI2), r = rnd(20, 95); FU().spark(V, g.x + cos(a) * r, g.y + sin(a) * r * .8, 1, AW, { a: a + PI / 2, sp: .2, v0: 80, v1: 180, sz: 1.2 }); }
      }
    },
    draw(ctx, R, cx, cy, u) {
      const t = R.t;
      if (u.rn) {
        const g = u.rn, gx = g.x - cx, gy = g.y - cy; ctx.save(); ctx.fillStyle = rgba('111,224,176', .1 + .05 * Math.min(1, g.t / 5)); ctx.beginPath(); ctx.arc(gx, gy, g.r, 0, PI2); ctx.fill();
        ctx.setLineDash([9, 7]); ctx.lineDashOffset = -t * 50; ctx.strokeStyle = AW; ctx.lineWidth = 3; ctx.shadowColor = AC; ctx.shadowBlur = 12; ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `${g.t.toFixed(1)}s  badai +${Math.round(Math.min(5, g.t) * 5)}%`; ctx.strokeText(tx, gx, gy - g.r - 8); ctx.fillText(tx, gx, gy - g.r - 8); ctx.restore();
      }
      if (u.tn) {
        const g = u.tn, gx = g.x - cx, gy = g.y - cy; ctx.save(); ctx.shadowColor = AC; ctx.shadowBlur = 14;
        for (let i = 0; i < 9; i++) { const k = i / 8, y = gy + 70 - k * 150, rw = 20 + k * 62, off = sin(g.ph + i * .9) * 10; ctx.strokeStyle = rgba('191,245,255', .75 - k * .35); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(gx + off, y, rw, rw * .28, 0, 0, PI2); ctx.stroke(); }
        ctx.restore();
      }
    },
    skills: {
      z: Object.assign(toggleSk('Wind Infusion', '🌬️', AC, 'WIND'), {                // panah menembus semua musuh sejalur, -1% Stamina / tembakan
        press(R, aim, u, k) { if (!u.on[k] && u.rs < 5) { fl(R, R.p.x, R.p.y - 28, 'Stamina kurang', '#aaa'); return false; } u.on[k] = !u.on[k]; D.FX.buffFx(R, AC); fl(R, R.p.x, R.p.y - 28, `WIND ${u.on[k] ? 'ON' : 'OFF'}`, AC); } }),
      x: { n: 'Tempest Reposition', i: '🌪️', type: 'cast', cd: 9,
        press(R, aim, u) {
          const u2 = FU(), V = u2.st(R), a = aim.ang, s = R.s;
          dashAlong(R, a + PI, 210); R.inv = Math.max(R.inv, .6); R.atkT = Math.max(R.atkT, .4);          // lompat mundur (kiting)
          u2.ring(V, R.p.x, R.p.y, 6, 60, .3, AW, 4, true); u2.spark(V, R.p.x, R.p.y, 14, AW, { a: a + PI, sp: .7 });
          D.Cine.on('tempest', { bars: .8, zoom: .07, vig: .5 }); u.tm.cine = .9; u.cineOn = true; D.Uniq.slowmo(.55, .3); D.Cine.flash('#bff5ff', .2);   // cinematic slow-motion singkat
          u.tm.frost = 1.2;                                                                                  // panah es → Slow
          for (let i = -1; i <= 1; i++) V.pj.push({ k: 'arrow', x: R.p.x + cos(a) * 20, y: R.p.y + sin(a) * 20, a: a + i * .17, spd: 1150, life: (s.range + 260) / 1150, mult: 1.2, big: true, pierce: false, rad: 8, c: '#8fe3ff', at: 'frost', hit: [], t: 0 });
          fl(R, R.p.x, R.p.y - 30, 'TEMPEST REPOSITION!', AW);
        } },
      c: { n: 'Arrow Rain Typhoon', i: '🌧️', type: 'hold', cd: 14, max: 5,
        press(R, aim, u) {
          const p = clampPt(R, aim, 330), V = FU().st(R); u.rn = { x: p.x, y: p.y, r: 125, t: 0, acc: 0 };
          for (let i = 0; i < 16; i++) { const a = i * PI2 / 16; FU().add(V, { k: 'line', x1: R.p.x + cos(a) * 22, y1: R.p.y + sin(a) * 22, x2: R.p.x + cos(a) * 22, y2: R.p.y - 60 - 40 * sin(i), w: 3, life: .3, c: AW }); }   // panah melingkar ke udara
          FU().ring(V, R.p.x, R.p.y, 6, 60, .3, AC, 3, true); fl(R, p.x, p.y - 30, 'ARROW RAIN TYPHOON', AC); R.atkT = Math.max(R.atkT, .3);
        },
        hold(R, dt, h, u) { if (u.rn) u.rn.t = h.t; },
        release(R, h, u) {                                   // ledakan badai pungkasan: 3× ATK, +5% per detik hold
          const g = u.rn; u.rn = null; if (!g) return; const u2 = FU(), V = u2.st(R), mult = 3 * (1 + .05 * Math.min(5, h.t)), r = g.r * 1.1;
          burst(R, g.x, g.y, r, AC, true); u2.ring(V, g.x, g.y, 10, r * 1.3, .5, AW, 8, true);
          const hit = inCircle(R, g.x, g.y, r); hit.forEach((m) => { strike(R, m, mult, { kb: 18, c: AW, n: 14 }); m.slow = Math.max(m.slow || 0, 2); });
          V.shk = Math.max(V.shk, 9); if (hit.length) u2.hitstop(R, .08); D.Cine.flash(AW, .18); fl(R, g.x, g.y - 34, `BADAI ×${mult.toFixed(2)}`, GOLD);
        } },
      v: (() => {
        const v = formSk('Gale Force Tempest', '🌪️', AC, 85, 12, 'GALE FORCE TEMPEST!'), p0 = v.press;   // AS +100%, semua tembakan crit, badai raksasa
        v.press = (R, aim, u) => { p0(R, aim, u); u.tn = { x: R.p.x + cos(aim.ang) * 60, y: R.p.y + sin(aim.ang) * 60, a: aim.ang, tk: .2, ph: 0 }; };
        return v;
      })()
    }
  };
  /* ---------- FIGHTER — Frostflake Sword (Freezing) ----------
     Pasif Freezing : tiap stack +5% damage diterima musuh (maks 10). Penuh → Freezing State 5 dtk (+55% damage, musuh beku/stop),
                      lalu cooldown 2.5 dtk sebelum bisa kena stack lagi.
     MODE BIASA
     Z  Frostbite   : 5 charge. Tap = dash tebas ×2 + beku 2 dtk → pecah (crit) +1 stack. Tahan (butuh 5 charge) = 10 tebasan + final ×10 crit + 10 stack.
     X  Doppelganger: toggle. Kembaran bergerak berlawanan arah (maks 300 dari player), meniru serangan & skill dengan ½ damage.
     C  Freezing Zone: cd 20, player diam, makin lama ditahan makin luas (maks 5 dtk). 2 stack/dtk; stack ke-10 di zona = ledakan 5× crit.
     V  Ice Age (cd 45): lompat → spike menusuk → area beku 5× crit, +1 ICE EMPEROR SHARD (maks 3).
        Shard 3/3 → TAHAN V = Ice Age + masuk ICE EMPEROR (shard terpakai).
     MODE ICE EMPEROR (100% crit, slow 10%, Doppelganger hilang & X terkunci)
     Z  Frostbite   : charge maks 10 (isi ulang 1/dtk). Tap = dash jauh. Tahan (5 charge) = moveset Emperor + 1 ULT STACK (maks 6).
     C  Ice Dash    : tap = dash (cd 3). Kena musuh → letterbox, damage 2× basic, beku seperti Z.
                      ULT 6/6 → TAHAN C = cutscene Absolute Zero: blitz semua musuh radius 500 (100% crit, damage basic) 10 dtk → ledakan 15× crit.
                      Setelah itu cooldown 999; cooldown di-reset saat kembali ke mode biasa. */
  const IC = '#8fe3ff', IC2 = '#d8f6ff', ICE_DUR = 60, CL_R = 300;   // CL_R = jarak maks Doppelganger dari player   // ICE_DUR = lama Ice Emperor (detik) — ubah di sini
  const SH_MAX = 3, US_MAX = 6, ULT_R = 500, ULT_DUR = 10, ULT_TICK = .2, E_DASH_CD = 3, E_ZMAX = 10, E_ZREGEN = 1;   // shard, ult stack, radius & lama ult, interval hit blitz, cd dash, charge Z & isi ulang di Emperor
  CK.push('iceage', 'edash', 'eult');
  const emp = (R) => S(R).tm.form > 0;
  const fzMul = (m) => { const f = m.fz; return !f ? 1 : f.st > 0 ? 1.55 : 1 + .05 * f.n; };
  const fst = (R, m, mult, o) => FU().strike(R, m, mult, o);
  const freeze = (m, t) => { if (m.dead) return; if (!m.isBoss) m.stun = Math.max(m.stun || 0, t); else m.slow = Math.max(m.slow || 0, t * .6); };
  const iceSlow = (m, t) => { if (m.dead || typeof m.spd !== 'number') return; if (!m._isl) { m._isl = true; m.spd *= .9; } m.isT = Math.max(m.isT || 0, t); };

  /* bungkus C().hit / C().trueHit sekali: musuh ber-stack menerima damage lebih besar */
  function hookDmg() {
    const c = C(); if (!c || c._frz) return; c._frz = true;
    for (const k of ['hit', 'trueHit']) {
      const o = c[k]; if (typeof o !== 'function') continue;
      c[k] = function (m, d, ...rest) { return o.call(this, m, (m && m.fz && typeof d === 'number') ? d * fzMul(m) : d, ...rest); };
    }
  }
  function addStack(R, m, n, zone, k) {
    if (!m || m.dead) return; const f = m.fz || (m.fz = { n: 0, st: 0, cd: 0 }); if (f.st > 0 || f.cd > 0) return;
    f.n = Math.min(10, f.n + n); const u = FU(), V = u.st(R);
    u.spark(V, m.x, m.y, 3, IC, { a: -PI / 2, sp: .8, v0: 30, v1: 90 });
    if (f.n < 10) return;
    if (zone) {                                            // Freezing Zone: meledak 5× crit, bukan freezing state
      f.n = 0; burst(R, m.x, m.y, 70, IC, true); u.ring(V, m.x, m.y, 6, 90, .35, '#fff', 4, true);
      fst(R, m, 5 * (k || 1), { fc: true, kb: 14, c: IC2, n: 14 }); fl(R, m.x, m.y - 28, 'FROST BLAST ×5', IC2); V.shk = Math.max(V.shk, 4);
    } else {                                               // Freezing State
      f.st = 5; freeze(m, 5); burst(R, m.x, m.y, 55, IC, false); fl(R, m.x, m.y - 28, 'FREEZING!', IC);
    }
  }
  function shatter(R, m) {
    const u = FU(), V = u.st(R), k = m.shK || 1; m.spk = 0;
    burst(R, m.x, m.y, 55, IC2, false); fst(R, m, 1.5 * k, { fc: true, n: 12, c: IC2 }); fl(R, m.x, m.y - 24, 'SHATTER', IC2); addStack(R, m, 1); V.shk = Math.max(V.shk, 3);
  }
  function dashP(R, P, ang, dist) {                        // dash untuk entitas apa pun (player / kembaran)
    const V = FU().st(R); V.gh.push({ x: P.x, y: P.y, a: ang, life: .4, max: .4, c: IC });
    FU().add(V, { k: 'line', x1: P.x, y1: P.y, x2: P.x + cos(ang) * dist, y2: P.y + sin(ang) * dist, w: 18, life: .25, c: IC });
    for (let d = 0; d < dist; d += 6) {
      const s = Math.min(6, dist - d), bx = P.x, by = P.y; C().move(R, P, cos(ang) * s, sin(ang) * s, 9);
      if (P.x === bx && P.y === by) break; if (d % 30 === 0) V.gh.push({ x: P.x, y: P.y, a: ang, life: .3, max: .3, c: IC });
    }
  }
  const arcAt = (R, P, main, ang, dir, span, r, th, life, c) => FU().add(FU().st(R), Object.assign({ k: 'arc', a: ang, dir, span, r, th, life, sw: .5, c }, main ? { fol: 1 } : { fol: 0, x: P.x, y: P.y }));

  /* ----- basic attack: tebas kiri → tebas kanan → cone AoE besar (+1 Freezing stack) ----- */
  function fSlash(R, P, ang, k, o, main) {
    const u = FU(), V = u.st(R), E = emp(R), dir = o.dir || 1, rng = (o.range || 74) * (E ? 1.3 : 1), span = o.span || 2.6, dur = Math.min(.26, R.s.cd * .9);
    if (main) V.sw = { k: 'slash', t: 0, dur, ang, dir, lunge: 8 };
    arcAt(R, P, main, ang, dir, span, rng + 10, E ? 46 : 32, dur * 1.7, E ? IC2 : IC);
    u.later(V, dur * .35, () => {
      const h = inCone(R, P.x, P.y, ang, rng, span / 2);
      h.forEach((m) => fst(R, m, (o.mult || 1.2) * k, { kb: 6, c: IC, ang }));
      if (h.length) u.spark(V, P.x + cos(ang) * rng * .8, P.y + sin(ang) * rng * .8, 8, IC, { a: ang, sp: .8 });
    });
  }
  function fCone(R, P, ang, k, o, main) {
    const u = FU(), V = u.st(R), E = emp(R), rng = (o.range || 135) * (E ? 1.3 : 1), half = o.half || 1.05;
    if (main) V.sw = { k: 'smash', t: 0, dur: .42, ang, lunge: 10 };
    arcAt(R, P, main, ang, 1, half * 2, rng + 10, 62, .45, IC2);
    u.later(V, .2, () => {
      for (let i = -3; i <= 3; i++) { const a = ang + i * half / 3.2, l = rng * rnd(.55, .95); u.add(V, { k: 'line', x1: P.x + cos(a) * 20, y1: P.y + sin(a) * 20, x2: P.x + cos(a) * l, y2: P.y + sin(a) * l, w: 12, life: .3, c: IC2 }); }
      const h = inCone(R, P.x, P.y, ang, rng, half);
      h.forEach((m) => { fst(R, m, (o.mult || 1.8) * k, { kb: 12, c: IC, n: 10, ang }); addStack(R, m, 1); });
      V.shk = Math.max(V.shk, 5); if (h.length && main) u.hitstop(R, .05);
    });
  }
  STEPS.fSlash = (R, ang, o) => { const u = S(R); u.fa = ang; fSlash(R, R.p, ang, 1, o, true); if (u.cl) fSlash(R, u.cl, ang + PI, .5, o, false); return 0; };
  STEPS.fCone = (R, ang, o) => { const u = S(R); u.fa = ang; fCone(R, R.p, ang, 1, o, true); if (u.cl) fCone(R, u.cl, ang + PI, .5, o, false); return 0; };

  /* ----- Z press: dash tebas ×2, musuh beku 2 dtk lalu pecah (crit) +1 stack. Ice Emperor: dash jauh, langsung Freezing State + spike es ----- */
  function fPress(R, P, ang, k, main) {
    const u = FU(), V = u.st(R), E = emp(R), len = E ? 330 : 210, hit = inLine(R, P.x, P.y, ang, len, 50);
    if (main) { V.sw = { k: 'thrust', t: 0, dur: .3, ang }; R.inv = Math.max(R.inv, .35); R.atkT = Math.max(R.atkT, .3); }
    dashP(R, P, ang, len);
    hit.forEach((m) => {
      if (m.dead) return; fst(R, m, 2 * k, { n: 8, c: IC, ang }); if (m.dead) return;
      freeze(m, 2); m.shT = 2; m.shK = k; m.spk = E ? 5 : 2; u.spark(V, m.x, m.y, 8, IC2, { sp: 1 });
      if (E) addStack(R, m, 10);
    });
    burst(R, P.x, P.y, 60, IC, false); V.shk = Math.max(V.shk, 3); if (hit.length && main) u.hitstop(R, .05);
  }
  /* ----- Z hold (5 charge): 10 tebasan + final ×10 crit + 10 stack. Ice Emperor: bawah→atas (spike) → AoE kiri multi-hit → final jauh ----- */
  function fFinal(R, P, ang, k, main, L) {
    const u = FU(), V = u.st(R), a = ang;
    if (main) V.sw = { k: 'smash', t: 0, dur: .45, ang: a, lunge: 16 };
    arcAt(R, P, main, a, 1, 1.6, L * .5, 70, .4, IC2);
    u.add(V, { k: 'line', x1: P.x, y1: P.y, x2: P.x + cos(a) * L, y2: P.y + sin(a) * L, w: 46, life: .3, c: IC });
    u.ring(V, P.x + cos(a) * L * .6, P.y + sin(a) * L * .6, 10, 90, .4, '#fff', 6, true);
    const h = inCone(R, P.x, P.y, a, L, .5);
    h.forEach((m) => { fst(R, m, 10 * k, { fc: true, kb: 26, c: IC2, n: 16, ang: a }); addStack(R, m, 10); });
    V.shk = Math.max(V.shk, 12); if (h.length) u.hitstop(R, .09); D.Cine.flash(IC2, .2); fl(R, P.x, P.y - 34, 'FROSTBITE ×10', '#fff');
  }
  function fHold(R, P, ang, k, main) {
    const u = FU(), V = u.st(R), E = emp(R), T = E ? 1.5 : 1.25;
    if (main) {
      R.inv = Math.max(R.inv, T + .2); R.atkT = Math.max(R.atkT, T); S(R).tm.zh = T; const us = S(R); us.zv = 5; us.zvT = .05 + 5 * .18 + .1;
      for (let i = 0; i < 5; i++) u.later(V, .05 + i * .18, () => {          // detak jantung: tiap charge diambil → layar invert 2× (lub-dub)
        us.zv = 4 - i; D.Cine.invert(.07); u.later(V, .12, () => D.Cine.invert(.05));
        u.ring(V, R.p.x, R.p.y, 10, 64, .25, '#fff', 3, true); V.shk = Math.max(V.shk, 2.5);
      });
    }
    if (!E) {
      for (let i = 0; i < 10; i++) u.later(V, .05 + i * .09, () => {
        const a = ang + i * .9, dir = i % 2 ? -1 : 1;
        if (main) V.sw = { k: 'flurry', t: 0, dur: .2, ang: a, lunge: 0 };
        arcAt(R, P, main, a, dir, 3.2, 112, 34, .22, i % 2 ? IC : IC2);
        const h = inCircle(R, P.x, P.y, 108); h.forEach((m) => fst(R, m, k, { kb: 3, c: IC, n: 4 }));
        u.spark(V, P.x + cos(a) * 80, P.y + sin(a) * 80, 4, IC2, { a, sp: .6 });
      });
      u.later(V, 1.07, () => fFinal(R, P, ang, k, main, 270));
    } else {
      u.later(V, 0, () => {                                // slash bawah
        if (main) V.sw = { k: 'smash', t: 0, dur: .25, ang, lunge: 8 }; arcAt(R, P, main, ang, 1, 2.2, 100, 40, .25, IC2);
        inCone(R, P.x, P.y, ang, 96, 1.1).forEach((m) => fst(R, m, 1.5 * k, { kb: 6, c: IC, n: 6, ang }));
      });
      u.later(V, .22, () => {                              // slash atas + spike es pendek ke depan
        if (main) V.sw = { k: 'slash', t: 0, dur: .25, ang, dir: -1, lunge: 8 }; arcAt(R, P, main, ang, -1, 2.2, 100, 40, .25, IC2);
        for (let i = 1; i <= 5; i++) { const x = P.x + cos(ang) * (22 + i * 20), y = P.y + sin(ang) * (22 + i * 20); u.add(V, { k: 'line', x1: x, y1: y + 6, x2: x + cos(ang) * 6, y2: y - 30 - i * 3, w: 12, life: .4, c: IC }); }
        inCone(R, P.x, P.y, ang, 96, 1.1).forEach((m) => fst(R, m, 1.5 * k, { kb: 4, c: IC, n: 6, ang }));
        inLine(R, P.x, P.y, ang, 130, 60).forEach((m) => fst(R, m, k, { c: IC2, n: 5 }));
      });
      for (let i = 0; i < 4; i++) u.later(V, .5 + i * .08, () => {   // slash kiri besar, multi-hit
        const a = ang - PI / 2; if (main && !i) V.sw = { k: 'flurry', t: 0, dur: .35, ang: a, lunge: 0 };
        if (!i) arcAt(R, P, main, a, -1, 4.2, 150, 60, .35, IC);
        inCone(R, P.x, P.y, a, 150, 1.9).forEach((m) => fst(R, m, 1.2 * k, { kb: 5, c: IC, n: 5 }));
      });
      u.later(V, 1.0, () => fFinal(R, P, ang, k, main, 380));
    }
  }

  /* ----- Ice Emperor: Ice Dash (C) ----- */
  function eDash(R, u, ang) {
    const P = R.p, V = FU().st(R), len = 300, hit = inLine(R, P.x, P.y, ang, len, 60);
    u.fa = ang; V.sw = { k: 'thrust', t: 0, dur: .3, ang }; R.inv = Math.max(R.inv, .4); R.atkT = Math.max(R.atkT, .3);
    dashP(R, P, ang, len);
    hit.forEach((m) => {
      if (m.dead) return; fst(R, m, 2, { n: 10, c: IC2, ang, kb: 8 }); if (m.dead) return;
      freeze(m, 2); m.shT = 2; m.shK = 1; m.spk = 5; FU().spark(V, m.x, m.y, 8, IC2, { sp: 1 });     // beku → pecah seperti Z
    });
    burst(R, P.x, P.y, 60, IC, false); V.shk = Math.max(V.shk, 3);
    if (hit.length) {                                                               // kena musuh → letterbox sesaat
      D.Cine.on('edash', { bars: 1, zoom: .08, vig: .6 }); u.tm.cine = Math.max(u.tm.cine || 0, .7); u.cineOn = true;
      FU().hitstop(R, .07); D.Cine.flash(IC2, .15); fl(R, P.x, P.y - 34, 'ICE DASH', '#fff');
    }
  }
  /* ----- Ice Emperor: ULT Absolute Zero (cutscene blitz 10 dtk → ledakan 15× crit) ----- */
  function startUlt(R, u) {
    const V = FU().st(R); u.ub = { t: 0, tk: 0 }; R.inv = Math.max(R.inv, ULT_DUR + .5); R.atkT = Math.max(R.atkT, .5);
    D.Cine.on('eult', { bars: 1, zoom: .14, vig: .85 }); u.tm.cine = 1; u.cineOn = true; D.Cine.flash(IC2, .4); D.FX.buffFx(R, IC);
    burst(R, R.p.x, R.p.y, ULT_R, IC, true); FU().ring(V, R.p.x, R.p.y, 10, ULT_R, .6, '#fff', 6, true); fl(R, R.p.x, R.p.y - 40, 'ABSOLUTE ZERO', '#fff');
  }
  function endUlt(R, u, boom) {
    D.Cine.off('eult'); const b = u.ub; u.ub = null; u.us = 0; if (!boom || !b) return;
    const V = FU().st(R), P = R.p, h = inCircle(R, P.x, P.y, ULT_R);
    for (let i = 0; i < 4; i++) FU().ring(V, P.x, P.y, 10, ULT_R * (.5 + i * .25), .35 + i * .1, i % 2 ? '#fff' : IC, 8, true);
    burst(R, P.x, P.y, ULT_R, IC2, true);
    h.forEach((m) => { fst(R, m, 15, { fc: true, kb: 30, c: IC2, n: 20 }); burst(R, m.x, m.y, 60, IC, false); });                  // 15× crit
    V.shk = Math.max(V.shk, 22); if (h.length) FU().hitstop(R, .15); D.Cine.flash('#fff', .5); D.Cine.invert(.25); fl(R, P.x, P.y - 40, 'ABSOLUTE ZERO ×15', '#fff');
  }
  function tickUlt(R, dt, u) {
    const b = u.ub, V = FU().st(R), P = R.p;
    if (R.done) { endUlt(R, u, false); return; }
    b.t += dt; u.tm.form = Math.max(u.tm.form, 1); u.tm.cine = Math.max(u.tm.cine || 0, .3); u.cineOn = true; R.inv = Math.max(R.inv, .3); R.atkT = Math.max(R.atkT, .2);
    b.tk -= dt;
    if (b.tk <= 0) {                                                                // blitz: tiap denyut semua musuh di radius kena basic attack 100% crit
      b.tk = ULT_TICK; const T = inCircle(R, P.x, P.y, ULT_R);
      T.forEach((m, i) => {
        if (m.dead) return; const a = rnd(0, PI2), L = 70;
        if (i < 10) FU().add(V, { k: 'line', x1: m.x - cos(a) * L, y1: m.y - sin(a) * L, x2: m.x + cos(a) * L, y2: m.y + sin(a) * L, w: 10, life: .18, c: Math.random() < .5 ? IC2 : '#fff' });
        fst(R, m, 1, { fc: true, n: 5, c: IC2, ang: a });
      });
      if (T.length) { V.shk = Math.max(V.shk, 3); u.fa = rnd(0, PI2); V.sw = { k: 'flurry', t: 0, dur: .18, ang: u.fa, lunge: 0 }; }
    }
    if (b.t >= ULT_DUR) endUlt(R, u, true);
  }

  /* ----- Ice Age: enter=true → versi Emperor (tahan V saat shard 3/3) ----- */
  function iceAge(R, ang, u, enter) {
    const u2 = FU(), V = u2.st(R), x = R.p.x, y = R.p.y;
    if (enter) u.shards = 0;
    u.tm.jump = .75; R.inv = Math.max(R.inv, 1.1); R.atkT = Math.max(R.atkT, .8); V.sw = { k: 'raise', t: 0, dur: .5, ang };
    D.Cine.on('iceage', { bars: 1, zoom: .1, vig: .7 }); u.tm.cine = 1.6; u.cineOn = true; D.FX.buffFx(R, IC); fl(R, x, y - 34, enter ? 'ICE EMPEROR' : 'ICE AGE', IC);
    u2.add(V, { k: 'line', x1: x, y1: y - 260, x2: x, y2: y - 90, w: 30, life: .5, c: IC2 }); u2.ring(V, x, y, 8, 80, .5, IC, 4, true);
    u2.later(V, .55, () => {
      const r = 190; u2.add(V, { k: 'line', x1: x, y1: y - 260, x2: x, y2: y, w: 40, life: .35, c: IC2 });
      for (let i = 0; i < 16; i++) { const a = i * PI2 / 16, l = rnd(110, 190); u2.add(V, { k: 'line', x1: x, y1: y, x2: x + cos(a) * l, y2: y + sin(a) * l * .7, w: 10, life: .6, c: i % 2 ? IC : IC2 }); }
      burst(R, x, y, r, IC, true); for (let i = 0; i < 3; i++) u2.ring(V, x, y, 10, r * (1 + i * .25), .4 + i * .12, i % 2 ? '#fff' : IC, 7, true);
      const h = inCircle(R, x, y, r); h.forEach((m) => { fst(R, m, 5, { fc: true, kb: 18, c: IC2, n: 16 }); addStack(R, m, 10); });   // 5× CRIT + Freezing State
      u.iceA = { x, y, r, t: 4 }; V.shk = Math.max(V.shk, 16); if (h.length) u2.hitstop(R, .1); D.Cine.flash(IC2, .4);
      if (enter) {                                                                  // masuk Ice Emperor
        u.tm.form = ICE_DUR; u.mode = 'e'; u.cl = null; u.on.x = false; u.cd.c = 0; u.cd.x = 0; u.us = 0; u.zc = E_ZMAX; u.zt = 0; u.nc = 0;
        fl(R, x, y - 40, 'ICE EMPEROR!', '#fff');
      } else if (!emp(R)) { u.shards = Math.min(SH_MAX, (u.shards || 0) + 1); fl(R, x, y - 40, `ICE EMPEROR SHARD ${u.shards}/${SH_MAX}`, '#fff'); }
    });
  }
  const uo = () => (D.run && D.run.u) || {};
  const vHold = (u) => (u.shards || 0) >= SH_MAX && !(u.tm && u.tm.form > 0);      // V jadi tipe 'hold' saat shard penuh & belum Emperor

  /* ---------- definisi skill ---------- */
  const zPress = (R, aim, u) => {
    if (u.zc === undefined) { u.zc = 5; u.zt = 0; }
    if (u.zc < 1) { fl(R, R.p.x, R.p.y - 28, 'Charge habis', '#aaa'); return false; }
    u.zang = aim.ang; if (u.hold) u.hold.aim = aim.ang;
  };
  const zStatus = (R, u) => `${u.zc === undefined ? 5 : u.zc}/${u.tm.form > 0 ? E_ZMAX : 5}`;
  const V_SK = {
    n: 'Ice Age', i: '👑', cd: 45,
    get type() { return vHold(uo()) ? 'hold' : 'cast'; },                            // shard 3/3 → tahan untuk masuk Emperor
    status: (R, u) => (u.tm.form > 0 ? Math.ceil(u.tm.form) + 's' : (u.shards >= SH_MAX ? '◆3 HOLD' : `◆${u.shards || 0}/${SH_MAX}`)),
    max: .6,
    press(R, aim, u) { if (vHold(u)) { u.vang = aim.ang; return; } iceAge(R, aim.ang, u, false); },
    release(R, h, u) { iceAge(R, h.aim != null ? h.aim : (u.vang || 0), u, vHold(u) && h.t >= .59); }   // lepas cepat = Ice Age biasa · tahan penuh = Emperor
  };
  const NSK = {
    z: { n: 'Frostbite', i: '❄️', type: 'hold', cd: .3, max: .9, status: zStatus, press: zPress,
      release(R, h, u) {
        const ang = h.aim != null ? h.aim : (u.zang || 0), was = u.zc; u.fa = ang;
        if (was >= 5 && h.t >= .35) {                    // HOLD: pakai 5 charge
          u.zc = 0; u.zt = 5; fl(R, R.p.x, R.p.y - 30, 'FROSTBITE — HOLD', IC);
          fHold(R, R.p, ang, 1, true); if (u.cl) fHold(R, u.cl, ang + PI, .5, false);
        } else {                                         // PRESS: 1 charge
          u.zc = was - 1; if (was >= 5) u.zt = 2;
          fPress(R, R.p, ang, 1, true); if (u.cl) fPress(R, u.cl, ang + PI, .5, false);
        }
      } },
    x: { n: 'Doppelganger', i: '👥', type: 'toggle', cd: .5,
      press(R, aim, u) {
        const V = FU().st(R);
        if (u.cl) { FU().ring(V, u.cl.x, u.cl.y, 6, 50, .3, IC, 3, true); u.cl = null; u.on.x = false; fl(R, R.p.x, R.p.y - 28, 'DOPPELGANGER OFF', IC); return; }
        u.cl = { x: R.p.x, y: R.p.y, px: R.p.x, py: R.p.y, face: aim.ang + PI }; u.fa = aim.ang; u.on.x = true;
        burst(R, R.p.x, R.p.y, 60, IC, false); D.FX.buffFx(R, IC); fl(R, R.p.x, R.p.y - 28, 'DOPPELGANGER ON', IC);
      } },
    c: { n: 'Freezing Zone', i: '🌨️', type: 'hold', cd: 20, max: 5,
      press(R, aim, u) { u.fz = { t: 0, r: 70 }; burst(R, R.p.x, R.p.y, 80, IC, true); fl(R, R.p.x, R.p.y - 30, 'FREEZING ZONE', IC); R.atkT = Math.max(R.atkT, .3); },
      hold(R, dt, h, u) { if (u.fz) { u.fz.t = h.t; u.fz.r = 70 + 40 * h.t; } },   // radius 70 → 270 (5 dtk)
      release(R, h, u) { const z = u.fz; u.fz = null; if (!z) return; FU().ring(FU().st(R), R.p.x, R.p.y, 10, z.r * 1.1, .4, '#fff', 5, true); fl(R, R.p.x, R.p.y - 30, 'ZONE END', IC); } },
    v: V_SK
  };
  const ESK = {
    z: { n: 'Frostbite', i: '❄️', type: 'hold', cd: .3, max: .9, status: zStatus, press: zPress,
      release(R, h, u) {
        const ang = h.aim != null ? h.aim : (u.zang || 0), was = u.zc; u.fa = ang;
        if (was >= 5 && h.t >= .35) {                    // HOLD: 5 charge → moveset Emperor + 1 ULT STACK
          u.zc = was - 5; u.zt = E_ZREGEN; fl(R, R.p.x, R.p.y - 30, 'FROSTBITE — HOLD', IC);
          fHold(R, R.p, ang, 1, true);
          if (u.us < US_MAX) { u.us++; fl(R, R.p.x, R.p.y - 52, u.us >= US_MAX ? 'ULTIMATE READY! (tahan C)' : `ULT STACK ${u.us}/${US_MAX}`, '#ffd54a'); D.FX.buffFx(R, '#ffd54a'); }
        } else { u.zc = was - 1; fPress(R, R.p, ang, 1, true); }
      } },
    x: { n: 'Doppelganger', i: '👥', type: 'cast', cd: .5, block: () => true, press() { return false; } },   // hilang saat Emperor
    c: { n: 'Ice Dash', i: '💨', type: 'hold', max: .45,
      get n() { return (uo().us || 0) >= US_MAX ? 'Absolute Zero' : 'Ice Dash'; },
      get i() { return (uo().us || 0) >= US_MAX ? '🌌' : '💨'; },
      get cd() { return uo().nc || E_DASH_CD; },
      status: (R, u) => `★${u.us || 0}/${US_MAX}`,
      press(R, aim, u) {
        if (u.ub) return false;
        if ((u.us || 0) < US_MAX) { eDash(R, u, aim.ang); u.cd.c = E_DASH_CD; return false; }   // stack belum penuh → dash langsung
        u.cang = aim.ang;                                                                   // 6/6 → tunggu: tap = dash, tahan = ULT
      },
      release(R, h, u) {
        if (h.t >= .44 && u.us >= US_MAX) { startUlt(R, u); u.nc = 999; }                  // cooldown 999 (reset saat keluar Emperor)
        else { eDash(R, u, h.aim != null ? h.aim : (u.cang || 0)); u.nc = E_DASH_CD; }
      } },
    v: V_SK
  };

  D.UNIQ.u_frost = {
    id: 'u_frost', col: IC, rgb: '120,215,255', aura: 70,
    pattern: [
      { t: 'fSlash', dir: 1, mult: 1.2, range: 74, span: 2.6 },
      { t: 'fSlash', dir: -1, mult: 1.2, range: 74, span: 2.6 },
      { t: 'fCone', mult: 1.8, range: 135, half: 1.05 }
    ],
    mods: (R, u) => ({ crit: u.tm.form > 0 ? 100 : 0, spd: u.tm.form > 0 ? 1.15 : 1, root: !!u.fz || !!u.ub || u.tm.jump > 0 || u.tm.zh > 0 }),
    onStrike(R, m) { if (emp(R)) iceSlow(m, 2); },         // Ice Emperor: slow 10%
    tick(R, dt, u) {
      hookDmg(); const V = FU().st(R);
      const E = emp(R), zmax = E ? E_ZMAX : 5;
      if (u.zc === undefined) { u.zc = 5; u.zt = 0; }
      if (u.shards === undefined) u.shards = 0; if (u.us === undefined) u.us = 0;
      if (!u.hold) u.mode = E ? 'e' : 'n';                                          // set skill: biasa / Emperor
      if (u.wasE && !E) {                                                           // keluar Emperor: reset cooldown C, stack ult, charge Z
        u.cd.c = 0; u.nc = 0; u.us = 0; if (u.ub) endUlt(R, u, false); u.zc = Math.min(u.zc, 5); D.Cine.off('edash'); fl(R, R.p.x, R.p.y - 30, 'EMPEROR END', IC);
      }
      u.wasE = E; if (u.ub) tickUlt(R, dt, u);
      if (u.zc < zmax) { u.zt -= dt; if (u.zt <= 0) { u.zc++; u.zt = E ? E_ZREGEN : 2; } }   // recharge Z: biasa 1/2 dtk · Emperor 1/dtk (maks 10)
      for (const m of R.mobs) {                                                     // status Freezing tiap musuh
        if (m.dead) continue;
        if (m._isl) { m.isT -= dt; if (m.isT <= 0) { m.spd /= .9; m._isl = false; } }
        if (m.spk > 0) m.spk -= dt;
        if (m.shT > 0) { m.shT -= dt; if (m.shT <= 0) shatter(R, m); if (m.dead) continue; }
        const f = m.fz; if (!f) continue;
        if (f.st > 0) { f.st -= dt; freeze(m, Math.max(.05, f.st)); if (f.st <= 0) { f.n = 0; f.cd = 2.5; } }
        else if (f.cd > 0) f.cd -= dt;
      }
      if (u.cl) {                                                                   // Doppelganger: gerak berlawanan, maks 60 dari player
        const c = u.cl, dx = -(R.p.x - c.px), dy = -(R.p.y - c.py); c.px = R.p.x; c.py = R.p.y;
        const n = Math.max(1, Math.ceil(hyp(dx, dy) / 6)); for (let i = 0; i < n; i++) C().move(R, c, dx / n, dy / n, 9);
        const d = hyp(c.x - R.p.x, c.y - R.p.y);
        if (d > CL_R) { const nx = R.p.x + (c.x - R.p.x) / d * CL_R, ny = R.p.y + (c.y - R.p.y) / d * CL_R; if (walkOk(R, nx, ny)) { c.x = nx; c.y = ny; } else { c.x = R.p.x; c.y = R.p.y; } }
        c.face = (u.fa || 0) + PI;
      }
      if (u.fz) {                                                                   // Freezing Zone (player + kembaran)
        const z = u.fz, inz = new Map();
        for (const [P, k] of [[R.p, 1]].concat(u.cl ? [[u.cl, .5]] : [])) inCircle(R, P.x, P.y, z.r).forEach((m) => { if (!inz.has(m) || inz.get(m) < k) inz.set(m, k); });
        inz.forEach((k, m) => { m.fzA = (m.fzA || 0) + 2 * dt; while (m.fzA >= 1) { m.fzA -= 1; addStack(R, m, 1, true, k); } });
        if (Math.random() < dt * 45) { const a = rnd(0, PI2), r = rnd(z.r * .3, z.r); FU().spark(V, R.p.x + cos(a) * r, R.p.y + sin(a) * r * .8, 1, Math.random() < .5 ? IC : IC2, { a: -PI / 2 + rnd(-.8, .8), sp: .3, v0: 15, v1: 60, sz: 1.6 }); }
      }
      if (u.zvT > 0) u.zvT -= dt;
      if (u.iceA) { u.iceA.t -= dt; if (u.iceA.t <= 0) u.iceA = null; }
      if (u.tm.form > 0) {                                                          // aura es Ice Emperor
        if (Math.random() < dt * 35) FU().spark(V, R.p.x + rnd(-60, 60), R.p.y + rnd(-34, 34), 1, Math.random() < .5 ? IC : '#fff', { a: PI / 2, sp: .4, v0: 15, v1: 60, sz: 1.4 });
        u.auraT = (u.auraT || 0) - dt; if (u.auraT <= 0) { u.auraT = .4; inCircle(R, R.p.x, R.p.y, 90).forEach((m) => iceSlow(m, 1)); }
      }
    },
    draw(ctx, R, cx, cy, u) {
      const t = R.t, px = R.p.x - cx, py = R.p.y - cy;
      for (const m of R.mobs) {                                                     // blok es + stack di atas musuh
        if (m.dead || !m.fz) continue; const f = m.fz, x = m.x - cx, y = m.y - cy;
        if (f.st > 0 || m.spk > 0) {
          ctx.save(); ctx.fillStyle = 'rgba(150,225,255,.35)'; ctx.strokeStyle = 'rgba(216,246,255,.95)'; ctx.lineWidth = 2; ctx.shadowColor = IC; ctx.shadowBlur = 10;
          ctx.beginPath(); ctx.arc(x, y, m.r + 4, 0, PI2); ctx.fill(); ctx.stroke();
          for (let i = 0; i < 8; i++) { const a = i * PI / 4 + .3, r0 = m.r + 2, r1 = m.r + 10 + (i % 2) * 7; ctx.beginPath(); ctx.moveTo(x + cos(a - .13) * r0, y + sin(a - .13) * r0); ctx.lineTo(x + cos(a) * r1, y + sin(a) * r1); ctx.lineTo(x + cos(a + .13) * r0, y + sin(a + .13) * r0); ctx.closePath(); ctx.fillStyle = 'rgba(216,246,255,.85)'; ctx.fill(); }
          ctx.restore();
        }
        if (f.n > 0 && !(f.st > 0)) { ctx.save(); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = f.n >= 7 ? '#fff' : IC; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; const tx = `❄${f.n}`; ctx.strokeText(tx, x, y - m.r - 22); ctx.fillText(tx, x, y - m.r - 22); ctx.restore(); }
      }
      if (u.iceA) {                                                                 // area beku Ice Age
        const a = u.iceA, k = Math.min(1, a.t / 1), g = ctx.createRadialGradient(a.x - cx, a.y - cy, 0, a.x - cx, a.y - cy, a.r);
        g.addColorStop(0, 'rgba(216,246,255,' + (.45 * k) + ')'); g.addColorStop(1, 'rgba(120,200,255,' + (.12 * k) + ')');
        ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x - cx, a.y - cy, a.r, 0, PI2); ctx.fill(); ctx.strokeStyle = 'rgba(216,246,255,' + k + ')'; ctx.lineWidth = 3; ctx.shadowColor = IC; ctx.shadowBlur = 12; ctx.stroke(); ctx.restore();
      }
      if (u.fz) {                                                                   // Freezing Zone: asap dingin, makin luas
        const z = u.fz, g = ctx.createRadialGradient(px, py, 0, px, py, z.r); g.addColorStop(0, 'rgba(216,246,255,.28)'); g.addColorStop(1, 'rgba(120,200,255,.08)');
        ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, z.r, 0, PI2); ctx.fill();
        ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = 'rgba(216,246,255,.95)'; ctx.lineWidth = 3; ctx.shadowColor = IC; ctx.shadowBlur = 12; ctx.stroke();
        ctx.setLineDash([]); ctx.shadowBlur = 0; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `${z.t.toFixed(1)}s / 5s  ·  radius ${Math.round(z.r)}`; ctx.strokeText(tx, px, py - z.r - 8); ctx.fillText(tx, px, py - z.r - 8); ctx.restore();
        if (u.cl) { ctx.save(); ctx.strokeStyle = 'rgba(216,246,255,.5)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(u.cl.x - cx, u.cl.y - cy, z.r, 0, PI2); ctx.stroke(); ctx.restore(); }
      }
      if (u.cl) {                                                                   // model kembaran
        const c = u.cl; ctx.save(); ctx.globalAlpha = .6 + .1 * sin(t * 6); ctx.shadowColor = IC; ctx.shadowBlur = 12;
        if (D.drawCursor) D.drawCursor(ctx, c.x - cx, c.y - cy, c.face || 0, IC); ctx.restore();
        ctx.save(); ctx.strokeStyle = 'rgba(143,227,255,.35)'; ctx.setLineDash([3, 5]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(c.x - cx, c.y - cy); ctx.stroke(); ctx.restore();
      }
      if (u.hold && u.hold.k === 'z') {                                             // indikator arah Frostbite + penanda siap Hold
        const k = Math.min(1, u.hold.t / .35), a = u.hold.aim != null ? u.hold.aim : (u.zang || 0), ready = u.hold.t >= .35 && u.zc >= 5;
        ctx.save(); ctx.strokeStyle = ready ? 'rgba(255,213,74,.95)' : 'rgba(143,227,255,.8)'; ctx.lineWidth = 3; ctx.shadowColor = IC; ctx.shadowBlur = 10; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + cos(a) * (ready ? 270 : 210), py + sin(a) * (ready ? 270 : 210)); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(px, py, 36, -PI / 2, -PI / 2 + PI2 * k); ctx.stroke(); ctx.restore();
      }
      { const zn = u.tm.form > 0 ? E_ZMAX : 5, st = 7.5 * 5 / zn * (zn > 5 ? 1.5 : 1), w = Math.min(6, st - 1.5), x0 = px - (zn * st) / 2 + (st - w) / 2;
        ctx.save(); for (let i = 0; i < zn; i++) { ctx.fillStyle = i < (u.zvT > 0 ? u.zv : (u.zc === undefined ? 5 : u.zc)) ? IC : 'rgba(0,0,0,.55)'; ctx.fillRect(x0 + i * st, py + 24, w, 4); } ctx.restore(); }   // pip charge Z (5 / 10)
      { ctx.save(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center';                                                    // pip shard (◆) & ult stack (★)
        if (u.tm.form > 0) { for (let i = 0; i < US_MAX; i++) { ctx.fillStyle = i < (u.us || 0) ? '#ffd54a' : 'rgba(0,0,0,.55)'; ctx.fillText('★', px - 25 + i * 10, py + 40); } }
        else if (u.shards > 0) { for (let i = 0; i < SH_MAX; i++) { ctx.fillStyle = i < u.shards ? IC2 : 'rgba(0,0,0,.55)'; ctx.fillText('◆', px - 10 + i * 10, py + 40); } }
        ctx.restore(); }
      if (u.hold && u.hold.k === 'v' && vHold(u)) {                                 // ring hold V → Ice Emperor
        const k = Math.min(1, u.hold.t / .6); ctx.save(); ctx.strokeStyle = k >= 1 ? '#ffd54a' : IC2; ctx.lineWidth = 4; ctx.shadowColor = IC; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(px, py, 44, -PI / 2, -PI / 2 + PI2 * k); ctx.stroke(); ctx.restore();
      }
      if (u.hold && u.hold.k === 'c' && u.tm.form > 0 && u.us >= US_MAX) {          // ring hold C → Absolute Zero
        const k = Math.min(1, u.hold.t / .45); ctx.save(); ctx.strokeStyle = k >= 1 ? '#ffd54a' : '#fff'; ctx.lineWidth = 4; ctx.shadowColor = IC; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(px, py, 44, -PI / 2, -PI / 2 + PI2 * k); ctx.stroke(); ctx.restore();
      }
      if (u.ub) {                                                                   // area blitz Absolute Zero
        const k = u.ub.t / ULT_DUR; ctx.save(); ctx.fillStyle = 'rgba(216,246,255,.08)'; ctx.beginPath(); ctx.arc(px, py, ULT_R, 0, PI2); ctx.fill();
        ctx.setLineDash([12, 8]); ctx.lineDashOffset = -t * 60; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.shadowColor = IC; ctx.shadowBlur = 14; ctx.stroke(); ctx.setLineDash([]);
        ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
        const tx = `ABSOLUTE ZERO ${(ULT_DUR - u.ub.t).toFixed(1)}s`; ctx.strokeText(tx, px, py - 60); ctx.fillText(tx, px, py - 60); ctx.restore();
      }
    },
    /* skill berganti per mode (u.mode 'n' biasa / 'e' Ice Emperor). Engine & mobile.js membaca d.skills[k] → getter */
    get skills() { return uo().mode === 'e' ? ESK : NSK; }
  };
  /* Item + resep. buy:false = tidak dijual biasa; dibuat lewat Shop → Unique (craft: bahan + Gold) atau code TESTER.
     Frost Essence belum ada di game → resep sementara hanya Jantung Golem + Gold. Tambah bahan: recipe:{ heart:25, frost:100 } setelah D.MATS.frost dibuat. */
  D.registerUnique({ id: 'u_frost', role: 'fighter', name: 'Frostflake Sword', icon: '❄️', wtype: 'sword', atk: 250, cd: .6, price: 50000, buy: false, recipe: { heart: 25 }, passive: {},
    desc: 'Pasif Freezing (stack +5% dmg diterima, 10 stack = Freezing State) · Z Frostbite · X Doppelganger · C Freezing Zone · V Ice Age (+Shard, 3 shard & tahan V → Ice Emperor: Ice Dash & Absolute Zero)' });
  /* ---------- MAGE — Necros (Necromancer / Soul Reaper) ----------
     Basic (Necromancer): combo 3 klik: cast(1) bola api roh → cast(2) bola api roh → cast(3) bola api besar (meledak + area molotov flat 20/dtk 2 dtk). Range 230.
     Hold basic         : laser api (range 200), DoT flat 50/dtk (kena pengali stack), maks 5 dtk. Kena tembok/musuh → menyebar. Ledakan crit di ujung HANYA kalau ditahan sampai 5 dtk penuh.
     Pasif Undead Entanglement : tiap kill +1 stack (maks 100). Tiap 5 stack: DoT +25% & +1% crit. Stack 100 → 60 dtk → turun 5/dtk.
     NECROMANCER  Z Flaming Death (hold maks 10 dtk, cd 10; 1% HP musuh/dtk + DoT flat 20/dtk) · X Revive (cd 60; tiap kill = 1 soul, maks 10 → summon semua jadi undead di graveyard radius 150) · C Soul Blitz (5 charge, 5 dtk/charge) · V = tukar form Necromancer ⇄ Soul Reaper (bebas, tanpa durasi, cd tukar 5 dtk)
     SOUL REAPER  crit 80% flat · basic = slash impact crit · Z Soul Harvesting (cd 8, hold = bidik, lepas = tarik) · X Necro Orb (cd 15, maks 3 orb, 1 orb = 2 basic) · C Soul Resonance (cd 20, hold = bidik target, lepas = cast, +1 stack) · hold C lama (3 stack, cd 120) = Soul Shockwave 10 dtk
     Angka "x/detik" dari skill/basic = damage FLAT per detik (N_FLAT_*); "Nx damage" = pengali ATK. Ubah angka di konstanta N_* di bawah. */
  const NG = '#62ff8a', NG2 = '#c8ffd8', NF = '#ff7a3a', NF2 = '#ffd08a';
  const N_SOUL_MAX = 10, N_GRAVE_R = 150, N_REV_T = 45, N_SWAP_CD = 5, N_FLAT_ZONE = 20, N_FLAT_LASER = 50, N_FLAME_PCT = .01, N_ULT_HOLD = .6, N_LZ_MULT = 6, N_RES_R = 450, N_FLAT_FLAME = 100, N_FLAT_DOT = 20, N_ORB_MAX = 3, N_ORB_HITS = 2, N_STK_MAX = 100, N_STK_HOLD = 60, N_STK_DECAY = 5;
  CK.push('sres', 'sws');
  const NB = (R) => R.s.atk * (R.u && R.u.m ? R.u.m.atk : 1);                        // ATK efektif (termasuk buff undead / form)
  const nDot = (u) => 1 + .25 * Math.floor((u.stk || 0) / 5);                        // pengali DoT dari stack pasif
  const nDmg = (R, m, d, c) => { const n0 = R.ft.length; C().hit(m, d, false); const f = R.ft[n0]; if (f) { f.c = c; f.x += rnd(-8, 8); } m.hf = .06; };
  const nBurn = (R, u, m, dur, c) => { if (!m.dead) (m.sts = m.sts || {}).burn = { t: dur, tick: .5, dps: N_FLAT_DOT * nDot(u), c }; };   // DoT flat 20/dtk × pengali stack
  const orbBuff = (R, u) => {                                                         // Necro Orb: 1 orb = 5 basic attack (+150% dmg, +150% crit dmg)
    const o = u.orbs && u.orbs[0]; if (!o) return null; o.n--;
    if (o.n <= 0) { u.orbs.shift(); burst(R, R.p.x, R.p.y - 20, 40, NG, false); fl(R, R.p.x, R.p.y - 36, 'ORB POOF', NG2); }
    return { k: 2.5, cm: R.s.critMul + 1.5 };
  };

  /* ----- Necromancer: proyektil api roh ----- */
  function nShot(R, ang, big) {
    const u = S(R), sp = big ? 430 : 700; (u.bs = u.bs || []).push({ x: R.p.x + cos(ang) * 22, y: R.p.y + sin(ang) * 22, a: ang, big, spd: sp, life: 230 / sp, r: big ? 13 : 7, t: 0 });
  }
  function nBoom(R, u, q) {
    const V = FU().st(R), r = 85; burst(R, q.x, q.y, r, NF, true);
    inCircle(R, q.x, q.y, r).forEach((m) => strike(R, m, 1.6, { kb: 10, n: 10, c: NF }));
    (u.zn = u.zn || []).push({ x: q.x, y: q.y, r, t: 2, tk: 0 }); V.shk = Math.max(V.shk, 4);          // area molotov 2 dtk
  }
  STEPS.nSpirit = (R, ang) => { const u = FU(), V = u.st(R); V.sw = { k: 'cast', t: 0, dur: .4, wu: .1, ang, big: false }; u.later(V, .1, () => nShot(R, ang, false)); return 0; };
  STEPS.nBig = (R, ang) => { const u = FU(), V = u.st(R); V.sw = { k: 'cast', t: 0, dur: .55, wu: .2, ang, big: true }; u.later(V, .2, () => { nShot(R, ang, true); V.shk = Math.max(V.shk, 2); }); return .2; };
  /* ----- Soul Reaper: slash impact crit ----- */
  STEPS.rSlash = (R, ang) => {
    const u = FU(), V = u.st(R), U = S(R), dur = Math.min(.26, R.s.cd * .9), dir = (U.rd = -(U.rd || -1)), b = orbBuff(R, U);
    V.sw = { k: 'slash', t: 0, dur, ang, dir, lunge: 10 }; u.add(V, { k: 'arc', fol: 1, a: ang, dir, span: 2.6, r: 125, th: 40, life: dur * 1.7, sw: .5, c: NG });
    u.later(V, dur * .35, () => {
      const h = inCone(R, R.p.x, R.p.y, ang, 115, 1.3);
      h.forEach((m) => strike(R, m, 1.3 * (b ? b.k : 1), { fc: true, cm: b ? b.cm : undefined, kb: 8, n: 10, c: NG, ang }));
      if (h.length) { u.ring(V, R.p.x + cos(ang) * 90, R.p.y + sin(ang) * 90, 6, 46, .22, NG2, 4, true); V.shk = Math.max(V.shk, 3); u.hitstop(R, .04); }
    });
    return 0;
  };

  /* ----- laser api (Hold basic) ----- */
  function laserEnd(R, P, a, max) {
    let len = max, wall = false, hit = null;
    for (let d = 14; d <= max; d += 8) {
      const x = P.x + cos(a) * d, y = P.y + sin(a) * d;
      if (!C().walk(R, x, y)) { len = d - 8; wall = true; break; }
      for (const m of R.mobs) if (!m.dead && hyp(m.x - x, m.y - y) < m.r + 6) { hit = m; break; }
      if (hit) { len = d; break; }
    }
    return { x: P.x + cos(a) * len, y: P.y + sin(a) * len, len: Math.max(10, len), spread: wall || !!hit };
  }
  const HA_N = {
    th: .3, max: 5,
    start(R, u, c) { c.tk = 0; fl(R, R.p.x, R.p.y - 30, 'FIRE LASER', NF); },
    tick(R, dt, u, c) {
      const P = R.p, a = c.ang, e = (c.e = laserEnd(R, P, a, 200)), V = FU().st(R); c.tk -= dt;
      if (c.tk <= 0) {                                                                // DoT flat 50 / dtk × pengali stack
        c.tk = .25; const T = new Set(inLine(R, P.x, P.y, a, e.len, 26)); if (e.spread) inCircle(R, e.x, e.y, 75).forEach((m) => T.add(m));
        T.forEach((m) => { nDmg(R, m, N_FLAT_LASER * .25 * nDot(u), NF); FU().spark(V, m.x, m.y, 2, NF2, { sp: 1 }); });
      }
      if (Math.random() < dt * 40) FU().spark(V, e.x, e.y, 2, Math.random() < .5 ? NF : NF2, { v0: 40, v1: 160, sz: 1.5 });
    },
    release(R, u, c) {
      const P = R.p;
      if (c.k < 1) { fl(R, P.x, P.y - 30, 'LASER OFF', NF2); return; }                // lepas sebelum 5 dtk → tidak ada burst
      const e = c.e || laserEnd(R, P, c.ang, 200);
      u.lz = { ex: e.x, ey: e.y, a: c.ang, t: 0, dur: .7, mult: N_LZ_MULT }; R.atkT = Math.max(R.atkT, .7); fl(R, P.x, P.y - 30, 'LASER BURST', NF2);
    },
    draw(ctx, R, cx, cy, u, c) {
      if (!c.e) return; const px = R.p.x - cx, py = R.p.y - cy, e = c.e, ex = e.x - cx, ey = e.y - cy;
      ctx.save(); ctx.lineCap = 'round'; ctx.shadowColor = NF; ctx.shadowBlur = 16;
      ctx.strokeStyle = 'rgba(255,122,58,.55)'; ctx.lineWidth = 16; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = 5; ctx.stroke();
      if (e.spread) { const pa = c.ang + PI / 2; ctx.strokeStyle = 'rgba(255,122,58,.8)'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(ex + cos(pa) * 70, ey + sin(pa) * 70); ctx.lineTo(ex - cos(pa) * 70, ey - sin(pa) * 70); ctx.stroke(); }
      ctx.restore();
    }
  };

  /* ----- Soul Resonance (C press, Reaper) & Soul Shockwave (C hold) ----- */
  function resonance(R, u, tgt) {
    if (!tgt) { fl(R, R.p.x, R.p.y - 28, 'Tidak ada target', '#aaa'); return false; }
    u.rs = { t: 0, tgt, n: 0, a0: rnd(0, PI2), b: orbBuff(R, u) }; u.sr = Math.min(3, (u.sr || 0) + 1); stunMob(tgt, 3.5);
    D.Cine.on('sres', { bars: 1, zoom: .12, vig: .7 }); u.tm.cine = 1; u.cineOn = true; R.inv = Math.max(R.inv, 3); R.atkT = Math.max(R.atkT, 2.5);
    D.FX.buffFx(R, NG); fl(R, R.p.x, R.p.y - 36, `SOUL RESONANCE ${u.sr}/3`, NG2); return true;
  }
  function tickRes(R, dt, u) {
    const b = u.rs, V = FU().st(R), T = b.tgt; b.t += dt; u.tm.cine = Math.max(u.tm.cine || 0, .3); u.cineOn = true; R.inv = Math.max(R.inv, .3); R.atkT = Math.max(R.atkT, .2);
    while (b.n < 10 && b.t >= .6 + b.n * .14) {
      const a = b.a0 + b.n / 10 * PI2, cx = T.x + cos(a) * 70, cy = T.y + sin(a) * 70;
      if (!T.dead) {
        FU().add(V, { k: 'line', x1: cx, y1: cy, x2: T.x - cos(a) * 40, y2: T.y - sin(a) * 40, w: 12, life: .2, c: NG2 });
        strike(R, T, 2 * (b.b ? b.b.k : 1), { cm: b.b ? b.b.cm : undefined, n: 8, c: NG, ang: a + PI }); V.shk = Math.max(V.shk, 3);
      }
      b.n++; if (T.dead) b.n = 10;
    }
    if (b.n >= 10 && b.t >= .6 + 10 * .14 + .3) { u.rs = null; D.Cine.off('sres'); }
  }
  function startWave(R, u, ang) {
    u.sw = { t: 0, ang, tk: 0 }; u.sr = 0; D.Cine.on('sws', { bars: 1, zoom: .1, vig: .8 }); u.tm.cine = 1; u.cineOn = true; R.inv = Math.max(R.inv, 10.5); R.atkT = Math.max(R.atkT, .5);
    FU().st(R).sw = { k: 'smash', t: 0, dur: .6, ang, lunge: 14 }; D.Cine.flash(NG2, .35); D.FX.buffFx(R, NG); fl(R, R.p.x, R.p.y - 40, 'SOUL SHOCKWAVE', NG2);
  }
  function tickWave(R, dt, u) {
    const w = u.sw, P = R.p, V = FU().st(R); w.t += dt; w.tk -= dt; u.tm.cine = Math.max(u.tm.cine || 0, .3); u.cineOn = true; R.inv = Math.max(R.inv, .3); R.atkT = Math.max(R.atkT, .2);
    if (w.tk <= 0) {                                                                  // 3× crit damage / dtk
      w.tk = .25; const h = inLine(R, P.x, P.y, w.ang, 460, 130);
      h.forEach((m) => strike(R, m, .75, { fc: true, kb: 4, n: 8, c: NG, ang: w.ang }));
      FU().ring(V, P.x + cos(w.ang) * 60, P.y + sin(w.ang) * 60, 10, 90, .35, NG, 5, true); V.shk = Math.max(V.shk, 4); if (h.length) FU().hitstop(R, .03);
    }
    if (w.t >= 10 || R.done) { u.sw = null; D.Cine.off('sws'); }
  }

  /* ----- skill helper ----- */
  const svCd = (R, u, m) => { u.sv = u.sv || {}; u.sv[m] = { z: u.cd.z, x: u.cd.x, c: u.cd.c, nc: u.nc, t: R.t }; };      // cooldown Z/X/C disimpan per form
  const ldCd = (R, u, m) => { const s = u.sv && u.sv[m], el = s ? R.t - s.t : 0; for (const k of ['z', 'x', 'c']) u.cd[k] = s ? Math.max(0, s[k] - el) : 0; u.nc = s ? s.nc : 0; };
  const nZStat = (R, u) => '';

  function selRes(R, ang) {                                                         // target Soul Resonance: musuh terdekat ke arah bidik (±0.5 rad, ≤ N_RES_R)
    let t = null, bs = 1e9;
    for (const m of alive(R)) { const dx = m.x - R.p.x, dy = m.y - R.p.y, d = hyp(dx, dy); if (d > N_RES_R) continue; const da = Math.abs(adiff(atan2(dy, dx), ang)); if (da > .5) continue; const sc = da * 300 + d * .3; if (sc < bs) { bs = sc; t = m; } }
    return t;
  }
  function holo(ctx, px, py, a, len, w, c, lab, t) {                                // indikator holografik persegi panjang
    ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = c.f; ctx.fillRect(0, -w / 2, len, w);
    ctx.strokeStyle = c.s; ctx.lineWidth = 2; ctx.shadowColor = c.s; ctx.shadowBlur = 8; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40; ctx.strokeRect(0, -w / 2, len, w); ctx.setLineDash([]);
    ctx.globalAlpha = .3; for (let x = 12; x < len; x += 14) { ctx.beginPath(); ctx.moveTo(x, -w / 2); ctx.lineTo(x, w / 2); ctx.stroke(); } ctx.restore();
    ctx.save(); ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3;
    const x = px + cos(a) * (len + 22), y = py + sin(a) * (len + 22); ctx.strokeText(lab, x, y); ctx.fillText(lab, x, y); ctx.restore();
  }
  const HG = { f: 'rgba(98,255,138,.14)', s: 'rgba(98,255,138,.95)' }, HY = { f: 'rgba(255,213,74,.16)', s: 'rgba(255,213,74,.95)' };
  const NV = {                                                                          // V: tukar form Necromancer ⇄ Soul Reaper (tanpa batas waktu)
    n: 'Soul Reaper', i: '💀', type: 'cast', cd: N_SWAP_CD,
    get n() { return uo().tm && uo().tm.form > 0 ? 'Necromancer' : 'Soul Reaper'; },
    get i() { return uo().tm && uo().tm.form > 0 ? '🔥' : '💀'; },
    status: (R, u) => (u.tm.form > 0 ? 'REAPER' : 'NECRO'),
    press(R, aim, u) {
      const toN = u.tm.form > 0; u.tm.form = toN ? 0 : 1e9; const c = toN ? NF : NG;
      D.FX.buffFx(R, c); burst(R, R.p.x, R.p.y, 130, c, true); D.Cine.flash(toN ? NF2 : NG2, .3); V_shk(R, 8);
      if (!toN) fl(R, R.p.x, R.p.y - 34, 'SOUL REAPER', NG2);
    }
  };
  const V_shk = (R, n) => { const V = FU().st(R); V.shk = Math.max(V.shk, n); };
  const NK_N = {
    z: { n: 'Flaming Death', i: '🔥', type: 'hold', cd: 10, max: 10,
      press(R, aim, u) { u.zang = aim.ang; if (u.hold) u.hold.aim = aim.ang; },
      hold(R, dt, h, u) {
        const a = h.aim != null ? h.aim : (u.zang || 0), P = R.p, V = FU().st(R); u.zang = a; R.atkT = Math.max(R.atkT, .15); h.tk = (h.tk || 0) - dt;
        FU().spark(V, P.x + cos(a) * 20, P.y + sin(a) * 20, 2, Math.random() < .5 ? NF : NF2, { a, sp: .5, v0: 150, v1: 360, l: 1.2, sz: 1.3 });
        if (h.tk <= 0) {                                                              // 1% HP musuh / dtk (dummy: flat 100) + DoT flat 20 / dtk
          h.tk = .2; inCone(R, P.x, P.y, a, 170, .5).forEach((m) => { nDmg(R, m, (m.dummy ? N_FLAT_FLAME : m.max * N_FLAME_PCT) * .2, NF); FU().spark(V, m.x, m.y, 2, NF2, { sp: 1 }); nBurn(R, u, m, 2.5, NF); });
        }
      },
      release(R, h, u) { fl(R, R.p.x, R.p.y - 28, 'FLAMING DEATH END', NF2); } },
    x: { n: 'Revive', i: '🧟', type: 'cast', cd: 60,
      status: (R, u) => `👻${(u.souls || []).length}/${N_SOUL_MAX}` + ((u.ud && u.ud.length) ? ` 🧟${u.ud.length}` : ''),
      press(R, aim, u) {                                                              // summon musuh yang sudah dibunuh (soul) di graveyard radius 150
        const P = R.p, so = u.souls || [];
        if (!so.length) { fl(R, P.x, P.y - 28, 'Belum ada soul', '#aaa'); return false; }
        u.ud = u.ud || [];
        so.forEach((s0) => {
          let x = P.x, y = P.y;
          for (let k = 0; k < 10; k++) { const a = rnd(0, PI2), r = Math.sqrt(Math.random()) * N_GRAVE_R, nx = P.x + cos(a) * r, ny = P.y + sin(a) * r; if (walkOk(R, nx, ny)) { x = nx; y = ny; break; } }
          u.ud.push({ x, y, t: N_REV_T, cd: .5, i: s0.i }); burst(R, x, y, 40, NG, false);
        });
        u.gv = { x: P.x, y: P.y, t: 1.4, n: so.length }; FU().ring(FU().st(R), P.x, P.y, 10, N_GRAVE_R, .5, NG, 5, true);
        D.FX.buffFx(R, NG); fl(R, P.x, P.y - 34, `GRAVEYARD ×${so.length} · DMG +${u.ud.length * 10}%`, NG2); u.souls = [];
      } },
    c: { n: 'Soul Blitz', i: '⛓️', type: 'hold', cd: .3, max: 4,                          // tahan = indikator arah/jarak (100), lepas = dash
      status: (R, u) => `${u.cc === undefined ? 5 : u.cc}/5`,
      press(R, aim, u) {
        if (u.cc === undefined) { u.cc = 5; u.ct = 0; }
        if (u.cc < 1) { fl(R, R.p.x, R.p.y - 28, 'Charge habis', '#aaa'); return false; }
        u.cang = aim.ang; if (u.hold) u.hold.aim = aim.ang;
      },
      release(R, h, u) {
        if (u.cc < 1) return; const a = h.aim != null ? h.aim : (u.cang || 0);
        if (u.cc >= 5) u.ct = 5; u.cc--;
        const P = R.p, V = FU().st(R), hit = inLine(R, P.x, P.y, a, 100, 50); u.fa = a;
        R.inv = Math.max(R.inv, .35); R.atkT = Math.max(R.atkT, .25); V.sw = { k: 'thrust', t: 0, dur: .25, ang: a }; dashAlong(R, a, 100); burst(R, P.x, P.y, 50, NG, false);
        hit.forEach((m) => { if (m.dead || m.nch || m.ncd > 0) return; m.nch = { t: 5, tk: 0 }; fl(R, m.x, m.y - 26, 'SOUL CHAIN', NG); FU().spark(V, m.x, m.y, 8, NG, { sp: 1 }); });
      } },
    v: NV
  };
  const NK_R = {
    z: { n: 'Soul Harvesting', i: '🌾', type: 'hold', cd: 8, max: 4,                    // tahan = indikator (120×90), lepas = tarik
      press(R, aim, u) { u.zang = aim.ang; if (u.hold) u.hold.aim = aim.ang; },
      release(R, hd, u) {
        const P = R.p, V = FU().st(R), a = hd.aim != null ? hd.aim : (u.zang || 0); u.fa = a; R.atkT = Math.max(R.atkT, .5); V.sw = { k: 'smash', t: 0, dur: .45, ang: a, lunge: 6 };
        FU().add(V, { k: 'arc', fol: 1, a, dir: 1, span: 2.2, r: 135, th: 64, life: .45, sw: .5, c: NG });
        const h = inLine(R, P.x, P.y, a, 120, 90);
        h.forEach((m) => {
          strike(R, m, 3, { fc: true, n: 12, c: NG, ang: a }); if (m.dead || m.isBoss) return;
          for (let i = 0; i < 12; i++) { const dx = P.x + cos(a) * 34 - m.x, dy = P.y + sin(a) * 34 - m.y, d = hyp(dx, dy); if (d < 8) break; C().move(R, m, dx / d * Math.min(d, 8), dy / d * Math.min(d, 8), m.r - 2); }
        });
        burst(R, P.x + cos(a) * 70, P.y + sin(a) * 70, 70, NG, true); V.shk = Math.max(V.shk, 6); if (h.length) FU().hitstop(R, .06);
      } },
    x: { n: 'Necro Orb', i: '🟢', type: 'cast', cd: 15,
      status: (R, u) => ((u.orbs && u.orbs.length) ? `●${u.orbs.length}` : ''),
      press(R, aim, u) {
        u.orbs = u.orbs || []; if (u.orbs.length >= N_ORB_MAX) { fl(R, R.p.x, R.p.y - 28, 'Orb penuh', '#aaa'); return false; }
        u.orbs.push({ n: N_ORB_HITS }); D.FX.buffFx(R, NG); burst(R, R.p.x, R.p.y, 50, NG, false); fl(R, R.p.x, R.p.y - 30, `NECRO ORB ${u.orbs.length}/${N_ORB_MAX}`, NG2);
      } },
    c: { n: 'Soul Resonance', i: '👥', type: 'hold', max: 5,                          // tahan = bidik target; lepas = Resonance; tahan lama (3 stack) = Shockwave
      get n() { return (uo().sr || 0) >= 3 ? 'Soul Shockwave' : 'Soul Resonance'; },
      get i() { return (uo().sr || 0) >= 3 ? '🌊' : '👥'; },
      get cd() { return uo().nc || 20; },
      status: (R, u) => `◈${u.sr || 0}/3`,
      press(R, aim, u) { if (u.rs || u.sw) return false; u.cang = aim.ang; if (u.hold) u.hold.aim = aim.ang; },
      release(R, h, u) {
        const a = h.aim != null ? h.aim : (u.cang || 0);
        if (h.t >= N_ULT_HOLD && u.sr >= 3) { startWave(R, u, a); u.nc = 120; return; }
        if (!resonance(R, u, selRes(R, a))) { fl(R, R.p.x, R.p.y - 44, 'Arahkan ke musuh', '#aaa'); u.nc = .3; return; }
        u.nc = 20;
      } },
    v: NV
  };

  D.UNIQ.u_necros = {
    id: 'u_necros', col: NG, rgb: '98,255,138', aura: 60,
    get pattern() { return uo().mode === 'r' ? [{ t: 'rSlash' }] : [{ t: 'nSpirit' }, { t: 'nSpirit' }, { t: 'nBig' }]; },
    get holdAtk() { return uo().mode === 'r' ? null : HA_N; },
    get skills() { return uo().mode === 'r' ? NK_R : NK_N; },
    mods: (R, u) => { const re = u.tm.form > 0, n5 = Math.floor((u.stk || 0) / 5);
      return { atk: 1 + .1 * (u.ud ? u.ud.length : 0), crit: (re ? Math.max(0, 80 - R.s.crit) : 0) + n5, root: !!u.rs || !!u.sw }; },
    onKill(R, m, u) {                                                                  // Undead Entanglement
      if (!m.isBoss && !m.dummy) { u.souls = u.souls || []; if (u.souls.length < N_SOUL_MAX) u.souls.push({ i: m.i || '💀' }); }   // soul untuk Revive
      const was = Math.floor(u.stk || 0); u.stk = Math.min(N_STK_MAX, was + 1);
      if (u.stk >= N_STK_MAX && was < N_STK_MAX) { u.stT = N_STK_HOLD; u.dec = false; fl(R, R.p.x, R.p.y - 40, 'UNDEAD ENTANGLEMENT MAX', NG2); }
      else if (u.stk % 5 === 0) fl(R, R.p.x, R.p.y - 40, `ENTANGLEMENT ${u.stk}`, NG);
    },
    tick(R, dt, u) {
      hookKill(); const V = FU().st(R), P = R.p, re = u.tm.form > 0;
      if (u.cc === undefined) { u.cc = 5; u.ct = 0; } if (u.stk === undefined) u.stk = 0;
      if (u.wasR === undefined) u.wasR = false;
      if (re !== u.wasR) {                                                              // ganti form: simpan/muat cooldown Z X C per form
        svCd(R, u, u.wasR ? 'r' : 'n'); ldCd(R, u, re ? 'r' : 'n'); u.wasR = re;
        if (!re) { u.orbs = []; if (u.rs) { u.rs = null; D.Cine.off('sres'); } if (u.sw) { u.sw = null; D.Cine.off('sws'); } fl(R, P.x, P.y - 30, 'NECROMANCER', NF2); }
        if (u.ch || u.ad) D.Uniq.cancelCh(R, u);
      }
      if (!u.hold) u.mode = re ? 'r' : 'n';
      if (R.done && (u.rs || u.sw)) { u.rs = u.sw = null; D.Cine.off('sres'); D.Cine.off('sws'); }
      /* stack pasif */
      if (u.stk >= N_STK_MAX && !u.dec) { u.stT -= dt; if (u.stT <= 0) u.dec = true; }
      if (u.dec) { u.stk = Math.max(0, u.stk - N_STK_DECAY * dt); if (u.stk <= 0) u.dec = false; }
      /* charge Soul Blitz */
      if (u.cc < 5) { u.ct -= dt; if (u.ct <= 0) { u.cc++; u.ct = 5; } }
      /* proyektil api roh */
      for (const q of (u.bs || [])) {
        q.t += dt; const st = q.spd * dt, n = Math.max(1, Math.ceil(st / 8)); let end = false;
        for (let i = 0; i < n && !end; i++) {
          q.x += cos(q.a) * st / n; q.y += sin(q.a) * st / n;
          if (!C().walk(R, q.x, q.y)) { end = true; break; }
          for (const m of R.mobs) if (!m.dead && hyp(m.x - q.x, m.y - q.y) < m.r + q.r) { q.hit = m; end = true; break; }
        }
        if (Math.random() < dt * 40) FU().spark(V, q.x, q.y, 1, Math.random() < .5 ? NF : NF2, { v0: 10, v1: 50, sz: q.big ? 2 : 1.3 });
        if (q.t >= q.life) end = true;
        if (end) { q.dead = true; if (q.big) nBoom(R, u, q); else { burst(R, q.x, q.y, 24, NF, false); if (q.hit) strike(R, q.hit, .6, { n: 5, c: NF2, ang: q.a }); } }
      }
      if (u.bs) u.bs = u.bs.filter((q) => !q.dead);
      /* area molotov */
      for (const z of (u.zn || [])) {
        z.t -= dt; z.tk -= dt;
        if (z.tk <= 0) { z.tk = .5; inCircle(R, z.x, z.y, z.r).forEach((m) => nDmg(R, m, N_FLAT_ZONE * .5 * nDot(u), NF)); }
        if (Math.random() < dt * 30) { const a = rnd(0, PI2), r = rnd(0, z.r); FU().spark(V, z.x + cos(a) * r, z.y + sin(a) * r * .8, 1, Math.random() < .5 ? NF : NF2, { a: -PI / 2, sp: .3, v0: 20, v1: 70, sz: 1.5 }); }
      }
      if (u.zn) u.zn = u.zn.filter((z) => z.t > 0);
      /* laser burst (afterward effect) */
      if (u.lz) {
        const l = u.lz; l.t += dt;
        if (l.t >= l.dur) {
          const r = 110; burst(R, l.ex, l.ey, r, NF, true); FU().ring(V, l.ex, l.ey, 10, r * 1.2, .4, '#fff', 6, true);
          const h = inCircle(R, l.ex, l.ey, r); h.forEach((m) => strike(R, m, l.mult, { fc: true, kb: 14, n: 14, c: NF2 }));
          V.shk = Math.max(V.shk, 10); if (h.length) FU().hitstop(R, .07); u.lz = null;
        }
      }
      if (u.gv) { u.gv.t -= dt; if (u.gv.t <= 0) u.gv = null; }
      /* undead */
      if (u.ud) {
        for (const a of u.ud) {
          a.t -= dt; a.cd -= dt; const tg = nearest(R, a.x, a.y, 240), tx = tg ? tg.x : P.x, ty = tg ? tg.y : P.y, d = hyp(tx - a.x, ty - a.y), stop = tg ? 22 : 46;
          if (!tg && hyp(P.x - a.x, P.y - a.y) > 420) { a.x = P.x; a.y = P.y; }
          else if (d > stop) { const s = 150 * dt; C().move(R, a, (tx - a.x) / d * s, (ty - a.y) / d * s, 9); }
          if (tg && d < 32 && a.cd <= 0) { a.cd = .9; nDmg(R, tg, NB(R) * .5, NG); FU().spark(V, tg.x, tg.y, 5, NG, { sp: 1 }); }
        }
        u.ud = u.ud.filter((a) => a.t > 0);
      }
      /* Soul Chain */
      for (const m of R.mobs) {
        if (m.ncd > 0) m.ncd -= dt; const c = m.nch; if (!c) continue; if (m.dead) { m.nch = null; continue; }
        c.t -= dt; c.tk -= dt;
        if (c.tk <= 0) { c.tk = .5; const d = Math.min(m.max * .025, NB(R) * 2); C().trueHit(m, d); R.hp = Math.min(R.s.hp, R.hp + d); }   // lifesteal 5% HP musuh / dtk
        if (c.t <= 0 || hyp(m.x - P.x, m.y - P.y) > 200) { m.nch = null; m.ncd = 5; }
      }
      if (u.rs) tickRes(R, dt, u);
      if (u.sw) tickWave(R, dt, u);
    },
    draw(ctx, R, cx, cy, u) {
      const t = R.t, px = R.p.x - cx, py = R.p.y - cy;
      ctx.save();
      for (const z of (u.zn || [])) {                                                   // area molotov
        const k = Math.min(1, z.t / .6), g = ctx.createRadialGradient(z.x - cx, z.y - cy, 0, z.x - cx, z.y - cy, z.r);
        g.addColorStop(0, `rgba(255,208,138,${.4 * k})`); g.addColorStop(1, `rgba(255,90,30,${.15 * k})`);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(z.x - cx, z.y - cy, z.r, 0, PI2); ctx.fill();
      }
      for (const q of (u.bs || [])) {                                                   // bola api
        ctx.shadowColor = NF; ctx.shadowBlur = 14; ctx.fillStyle = q.big ? NF : NF2; ctx.beginPath(); ctx.arc(q.x - cx, q.y - cy, q.r + sin(t * 30) * 1.2, 0, PI2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x - cx, q.y - cy, q.r * .45, 0, PI2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      for (const m of R.mobs) if (m.nch && !m.dead) {                                   // rantai jiwa
        ctx.strokeStyle = 'rgba(98,255,138,.85)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t * 40; ctx.shadowColor = NG; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(m.x - cx, m.y - cy); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '10px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = NG2; ctx.fillText(m.nch.t.toFixed(1) + 's', m.x - cx, m.y - cy - m.r - 14);
      }
      ctx.shadowBlur = 0;
      if (u.gv) {                                                                       // graveyard: lingkaran + nisan
        const g = u.gv, k = Math.min(1, g.t / .6); ctx.globalAlpha = k; ctx.strokeStyle = NG; ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.shadowColor = NG; ctx.shadowBlur = 12;
        ctx.fillStyle = 'rgba(98,255,138,.08)'; ctx.beginPath(); ctx.arc(g.x - cx, g.y - cy, N_GRAVE_R, 0, PI2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]); ctx.shadowBlur = 0;
        ctx.font = '16px sans-serif'; ctx.textAlign = 'center'; for (let i = 0; i < 8; i++) { const a = i * PI2 / 8 + .3; ctx.fillText('🪦', g.x - cx + cos(a) * N_GRAVE_R * .85, g.y - cy + sin(a) * N_GRAVE_R * .85 + 6); }
        ctx.globalAlpha = 1;
      }
      for (const a of (u.ud || [])) {                                                   // undead
        ctx.globalAlpha = a.t < 3 ? .4 + .3 * sin(t * 14) : .9; ctx.strokeStyle = NG; ctx.lineWidth = 2; ctx.shadowColor = NG; ctx.shadowBlur = 10;
        ctx.beginPath(); ctx.arc(a.x - cx, a.y - cy, 13, 0, PI2); ctx.stroke(); ctx.shadowBlur = 0; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(a.i, a.x - cx, a.y - cy + 6);
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < (u.orbs ? u.orbs.length : 0); i++) {                          // Necro Orb mengorbit
        const a = t * 2.2 + i * PI2 / 3, ox = px + cos(a) * 30, oy = py + sin(a) * 14 - 8;
        ctx.fillStyle = NG; ctx.shadowColor = NG; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(ox, oy, 6, 0, PI2); ctx.fill();
        ctx.shadowBlur = 0; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#04210e'; ctx.fillText(u.orbs[i].n, ox, oy + 3);
      }
      if (u.hold && u.hold.k === 'z' && !(u.tm.form > 0)) {                             // cone Flaming Death
        const a = u.hold.aim != null ? u.hold.aim : (u.zang || 0);
        ctx.fillStyle = 'rgba(255,122,58,.18)'; ctx.strokeStyle = 'rgba(255,208,138,.9)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, 170, a - .5, a + .5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(`${u.hold.t.toFixed(1)}s / 10s`, px, py - 28);
      }
      if (u.hold && (u.hold.k === 'c' || u.hold.k === 'z')) {                           // indikator holografik skill hold
        const h = u.hold, a = h.aim != null ? h.aim : (u.zang || u.cang || 0), re = u.tm.form > 0;
        if (!re && h.k === 'c') holo(ctx, px, py, a, 100, 50, HG, '100', t);                  // Soul Blitz
        else if (re && h.k === 'z') holo(ctx, px, py, a, 120, 90, HG, '120 × 90', t);         // Soul Harvesting
        else if (re && h.k === 'c') {
          if (h.t >= N_ULT_HOLD && u.sr >= 3) holo(ctx, px, py, a, 460, 130, HY, 'SOUL SHOCKWAVE', t);
          else {                                                                           // Soul Resonance: kipas bidik + target terpilih
            ctx.save(); ctx.fillStyle = HG.f; ctx.strokeStyle = HG.s; ctx.lineWidth = 2; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 40;
            ctx.beginPath(); ctx.moveTo(px, py); ctx.arc(px, py, N_RES_R, a - .5, a + .5); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
            const T = selRes(R, a); if (T) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(T.x - cx, T.y - cy, 70, 0, PI2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(T.x - cx, T.y - cy); ctx.stroke(); }
            ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText(T ? 'TARGET' : 'tidak ada target', px + cos(a) * 80, py + sin(a) * 80); ctx.restore();
          }
        }
      }
      if (u.lz) {                                                                       // laser membesar sebelum meledak
        const l = u.lz, k = Math.min(1, l.t / l.dur); ctx.lineCap = 'round'; ctx.shadowColor = NF; ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(255,122,58,${.6 + .3 * k})`; ctx.lineWidth = 8 + 60 * k; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(l.ex - cx, l.ey - cy); ctx.stroke();
        ctx.strokeStyle = '#fff2c8'; ctx.lineWidth = 3 + 14 * k; ctx.stroke(); ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(l.ex - cx, l.ey - cy, 110 * k, 0, PI2); ctx.stroke();
      }
      if (u.rs) {                                                                       // 10 duplikat jiwa holografik
        const b = u.rs, T = b.tgt;
        for (let i = 0; i < 10; i++) {
          const a = b.a0 + i / 10 * PI2, x = T.x + cos(a) * 70 - cx, y = T.y + sin(a) * 70 - cy, fl2 = i < b.n && b.t - (.6 + i * .14) < .2;
          ctx.save(); ctx.globalAlpha = Math.min(1, b.t / .5) * (fl2 ? .95 : .5 + .1 * sin(t * 10 + i)); ctx.shadowColor = NG; ctx.shadowBlur = 12;
          if (D.drawCursor) D.drawCursor(ctx, x, y, a + PI, NG); else { ctx.fillStyle = NG; ctx.beginPath(); ctx.arc(x, y, 8, 0, PI2); ctx.fill(); } ctx.restore();
        }
        ctx.strokeStyle = 'rgba(98,255,138,.4)'; ctx.setLineDash([4, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(T.x - cx, T.y - cy, 70, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
      }
      if (u.sw) {                                                                       // Soul Shockwave
        const w = u.sw, a = w.ang; ctx.save(); ctx.translate(px, py); ctx.rotate(a);
        for (let i = 0; i < 4; i++) { const k = ((t * 1.6 + i / 4) % 1); ctx.globalAlpha = (1 - k) * .7; ctx.strokeStyle = i % 2 ? NG : NG2; ctx.lineWidth = 8; ctx.shadowColor = NG; ctx.shadowBlur = 14;
          ctx.beginPath(); ctx.ellipse(40 + k * 420, 0, 14 + k * 30, 40 + k * 70, 0, -PI / 2, PI / 2); ctx.stroke(); }
        ctx.restore();
      }
      ctx.restore();
      if (u.hold && u.hold.k === 'c' && u.tm.form > 0 && (u.sr || 0) >= 3) {          // ring hold C → Shockwave
        const k = Math.min(1, u.hold.t / N_ULT_HOLD); ctx.save(); ctx.strokeStyle = k >= 1 ? '#ffd54a' : NG2; ctx.lineWidth = 4; ctx.shadowColor = NG; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(px, py, 44, -PI / 2, -PI / 2 + PI2 * k); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.font = '10px sans-serif'; ctx.textAlign = 'center';             // pip: charge blitz, stack pasif, resonance
      if (u.tm.form > 0) { for (let i = 0; i < 3; i++) { ctx.fillStyle = i < (u.sr || 0) ? NG2 : 'rgba(0,0,0,.55)'; ctx.fillText('◈', px - 10 + i * 10, py + 40); } }
      else { for (let i = 0; i < 5; i++) { ctx.fillStyle = i < (u.cc === undefined ? 5 : u.cc) ? NG : 'rgba(0,0,0,.55)'; ctx.fillRect(px - 17 + i * 7.5, py + 24, 6, 4); } }
      ctx.fillStyle = u.stk >= N_STK_MAX ? '#ffd54a' : NG2; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 3; const tx = `☠${Math.floor(u.stk || 0)} 👻${(u.souls || []).length}` + (u.stk >= N_STK_MAX && !u.dec ? ` ${Math.ceil(u.stT)}s` : u.dec ? '↓' : '');
      ctx.strokeText(tx, px, py + 52); ctx.fillText(tx, px, py + 52); ctx.restore();
    }
  };
  /* hook kill: PA.onKill dipanggil dungeon.js tiap musuh mati → teruskan ke Unique aktif (sekali pasang) */
  function hookKill() {
    const P = D.PA; if (!P || P._nk) return; P._nk = true; const o = P.onKill;
    P.onKill = function (R, m, ...r) { o.call(this, R, m, ...r); const d = cur(); if (d && d.onKill && R.u) d.onKill(R, m, R.u); };
  }
  D.registerUnique({ id: 'u_necros', role: 'mage', name: 'Necros', icon: '💀', wtype: 'wand', atk: 100, cd: .7, price: 30000, buy: false, recipe: { relic: 10, bone: 40 }, passive: {},
    desc: 'Pasif Undead Entanglement · basic bola api roh + Hold laser · Z Flaming Death · X Revive · C Soul Blitz · V Soul Reaper (Harvesting · Necro Orb · Soul Resonance/Shockwave)' });

  D.canCraftUnique = (p, id) => { const it = D.ITEMS[id]; return !!(it && it.recipe && !p.inventory.items.includes(id) && D.canUse(it, p).ok && p.gold >= it.price && Object.entries(it.recipe).every(([m, q]) => (p.inventory.mats[m] || 0) >= q)); };
  D.craftUnique = (p, id) => {
    if (!D.canCraftUnique(p, id)) return false; const it = D.ITEMS[id];
    for (const [m, q] of Object.entries(it.recipe)) p.inventory.mats[m] -= q;
    p.gold -= it.price; p.inventory.items.push(id); D.save(); return true;
  };
})(window.DSB);
