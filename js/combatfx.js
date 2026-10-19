/* combatfx.js — Basic attack per role: combo 3 hit, wind-up, slash arc, projectile, partikel, hitstop, screen shake.
   Alur: D.attack (dungeon.js) → FX.attack | D.update → FX.update | draw() (game.js) → FX.draw & FX.shake
   Semua state animasi disimpan di R.v sehingga otomatis bersih tiap run baru. */
(function (D) {
  const PI = Math.PI, PI2 = PI * 2, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2;
  const FX = (D.FX = {});
  const rnd = (a, b) => a + Math.random() * (b - a), cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const E = { out: (p) => 1 - Math.pow(1 - p, 3), in: (p) => p * p * p, io: (p) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2) };
  const adiff = (a, b) => (((a - b + PI) % PI2) + PI2) % PI2 - PI;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const C = () => D._c;
  const st = (R) => R.v || (R.v = { fx: [], pt: [], pj: [], gh: [], sq: [], sw: null, cb: { i: 0, t: -9 }, shk: 0, acc: 0 });
  const later = (V, t, fn) => V.sq.push({ t, fn });
  const add = (V, o) => { o.max = o.life; V.fx.push(o); return o; };
  const ring = (V, x, y, r0, r1, life, c, w, flat) => add(V, { k: 'ring', x, y, r0, r1, life, c, w, flat });
  const flash = (V, x, y, r, life, c) => add(V, { k: 'flash', x, y, r, life, c });
  const roleCol = () => D.ROLES[D.state.role].color;
  const hitstop = (R, t) => { R.hs = Math.max(R.hs || 0, t); };

  function spark(V, x, y, n, c, o = {}) {
    if (V.pt.length > 450) return;
    for (let i = 0; i < n; i++) {
      const a = o.a === undefined ? rnd(0, PI2) : o.a + rnd(-(o.sp || .7), o.sp || .7), v = rnd(o.v0 || 70, o.v1 || 240), l = rnd(.18, .4) * (o.l || 1);
      V.pt.push({ x, y, vx: cos(a) * v, vy: sin(a) * v, life: l, max: l, s: rnd(1.5, 3.2) * (o.sz || 1), c, dr: o.dr || 5 });
    }
  }

  /* ---------- info senjata (untuk visual) ---------- */
  const wtype = () => { const it = D.ITEMS[D.state.equipment.weapon]; return it ? it.wtype : ({ fighter: 'sword', mage: 'wand', tank: 'sword', archer: 'bow', assassin: 'dagger' })[D.state.role]; };
  const TIERC = ['#b08a5a', '#c8ccd2', '#9fc4e8', '#6fe0c8', '#a070ff'];
  const bladeCol = () => { const id = D.state.equipment.weapon || '', m = /_(\d)$/.exec(id); return id.startsWith('u_') ? '#ff9a5a' : TIERC[m ? +m[1] : 0]; };

  /* ---------- targeting ---------- */
  const ang2 = (R, m) => atan2(m.y - R.p.y, m.x - R.p.x);
  function pick(R, ang, range, cone) {
    let t = null, bd = range + 12;
    for (const m of R.mobs) {
      if (m.dead) continue; const d = dist(m, R.p) - m.r; if (d >= bd) continue;
      if (Math.abs(adiff(ang2(R, m), ang)) <= cone || d < 14) { bd = d; t = m; }
    }
    return t;
  }
  const inArc = (R, ang, range, cone) => R.mobs.filter((m) => { if (m.dead) return false; const d = dist(m, R.p) - m.r; return d < range && (d < 14 || Math.abs(adiff(ang2(R, m), ang)) <= cone); });

  /* satu pukulan: damage + spark + knockback + flash musuh + angka damage acak posisi */
  function strike(R, m, mult, o = {}) {
    if (!m || m.dead) return null;
    const V = R.v, r = C().roll(mult, o.fc, o.cm), n0 = R.ft.length;
    C().hit(m, r.d, r.c); D.Uniq.onStrike(R, m, r);                  // Unique: efek tambahan tiap pukulan (mis. burn)
    const f = R.ft[n0]; if (f) { f.x += rnd(-12, 12); f.y += rnd(-8, 4); if (r.c) f.big = true; }
    m.hf = .12;
    const a = o.ang !== undefined ? o.ang : ang2(R, m);
    spark(V, m.x, m.y, (o.n || 6) + (r.c ? 6 : 0), r.c ? '#ffd54a' : (o.c || '#fff'), { a, sp: .9 });
    if (o.kb && !m.dead && !m.isBoss) C().move(R, m, cos(a) * o.kb, sin(a) * o.kb, m.r - 2);
    if (r.c) { V.shk = Math.max(V.shk, 2); D.PA.onCrit(R); }
    return r;
  }

  /* =====================  SERANGAN PER ROLE  ===================== */
  function fighter(R, ang, n) {
    const V = R.v, s = R.s, col = roleCol(), rng = s.range + 12;
    if (n < 2) { // tebasan kiri-kanan bergantian
      const dir = n ? -1 : 1, dur = Math.min(.24, s.cd * .9);
      V.sw = { k: 'slash', t: 0, dur, ang, dir, lunge: 8 };
      add(V, { k: 'arc', fol: 1, a: ang, dir, span: 2.6, r: rng + 10, th: 28, life: dur * 1.6, sw: .5, c: col });
      later(V, dur * .35, () => { const h = inArc(R, ang, rng, 1.2); h.forEach((m) => strike(R, m, 1, { kb: 6, c: col, ang })); D.PA.landed(R, h.length); });
    } else { // overhead smash + shockwave
      const dur = Math.min(.4, s.cd);
      V.sw = { k: 'smash', t: 0, dur, ang, lunge: 14 };
      later(V, dur * .6, () => {
        const x = R.p.x + cos(ang) * rng * .75, y = R.p.y + sin(ang) * rng * .75, h = inArc(R, ang, rng + 14, 1.5);
        add(V, { k: 'arc', fol: 1, a: ang - .8, dir: 1, span: 3, r: rng + 24, th: 44, life: .34, sw: .3, c: col });
        ring(V, x, y, 10, 100, .38, col, 7, true); ring(V, x, y, 4, 60, .25, '#fff', 3, true); flash(V, x, y, 46, .16, col);
        spark(V, x, y, 16, '#d9cba0', { v0: 60, v1: 260 }); spark(V, x, y, 8, col);
        h.forEach((m) => strike(R, m, 1.3, { kb: 18, n: 9, c: col })); D.PA.landed(R, h.length);
        V.shk = Math.max(V.shk, 7); if (h.length) hitstop(R, .06);
      });
    }
  }

  function tank(R, ang, n) {
    const V = R.v, s = R.s, col = roleCol(), rng = s.range + 12;
    if (n === 0) { // tebasan pendek
      const dir = Math.floor(V.cb.i / 3) % 2 ? -1 : 1, dur = Math.min(.24, s.cd * .9);
      V.sw = { k: 'slash', t: 0, dur, ang, dir, lunge: 6 };
      add(V, { k: 'arc', fol: 1, a: ang, dir, span: 1.9, r: rng + 4, th: 22, life: dur * 1.6, sw: .5, c: col });
      later(V, dur * .35, () => inArc(R, ang, rng, 1.0).forEach((m) => strike(R, m, 1, { kb: 5, c: col, ang })));
    } else if (n === 1) { // tusukan lurus
      const dur = Math.min(.26, s.cd * .9);
      V.sw = { k: 'thrust', t: 0, dur, ang };
      later(V, dur * .42, () => {
        const x0 = R.p.x + cos(ang) * 14, y0 = R.p.y + sin(ang) * 14, x1 = R.p.x + cos(ang) * (rng + 30), y1 = R.p.y + sin(ang) * (rng + 30);
        add(V, { k: 'line', x1: x0, y1: y0, x2: x1, y2: y1, w: 16, life: .2, c: col }); ring(V, x1, y1, 4, 26, .2, '#fff', 3);
        inArc(R, ang, rng + 10, .45).forEach((m) => strike(R, m, 1.1, { kb: 9, c: col, ang }));
      });
    } else { // shield bash + knockback besar
      const dur = Math.min(.36, s.cd);
      V.sw = { k: 'bash', t: 0, dur, ang };
      later(V, dur * .5, () => {
        const x = R.p.x + cos(ang) * rng * .8, y = R.p.y + sin(ang) * rng * .8, h = inArc(R, ang, rng + 8, .9);
        ring(V, x, y, 8, 84, .34, col, 6, true); ring(V, x, y, 3, 46, .22, '#fff', 3, true); flash(V, x, y, 40, .14, col);
        spark(V, x, y, 12, '#cfe6ff', { a: ang, sp: 1.1 });
        h.forEach((m) => strike(R, m, 1.2, { kb: 24, n: 8, c: col, ang }));
        V.shk = Math.max(V.shk, 5); if (h.length) hitstop(R, .05);
      });
    }
  }

  function mage(R, ang, n) { // charge orb di ujung tongkat → lepas → ledakan area
    const V = R.v, s = R.s, oc = D.PA.mageCast(R), big = n === 2 || oc, wu = Math.min(big ? .36 : .26, s.cd * .55), col = roleCol();
    V.sw = { k: 'cast', t: 0, dur: wu + .16, wu, ang, big };
    later(V, wu, () => {
      const x = R.p.x + cos(ang) * 40, y = R.p.y + sin(ang) * 40, t = pick(R, ang, s.range, .5), a = t ? atan2(t.y - y, t.x - x) : ang, spd = big ? 540 : 680;
      V.pj.push({ k: 'orb', x, y, a, spd, tgt: t, life: (s.range + 90) / spd, mult: (big ? 1.5 : 1) * (oc ? 1.4 : 1), big, oc, rad: big ? 12 : 9, c: col, hit: [], t: 0 });
      ring(V, x, y, 4, big ? 44 : 28, .22, '#e6d0ff', 3); flash(V, x, y, 24, .12, '#fff'); spark(V, x, y, 8, '#d8b8ff', { a, sp: .5 });
    });
  }

  function archer(R, ang, n) { // tarik tali busur → lepas → panah ber-trail (tembakan ke-3 menembus)
    const V = R.v, s = R.s, big = n === 2, wu = Math.min(big ? .28 : .13, s.cd * .45), col = roleCol();
    V.sw = { k: 'draw', t: 0, dur: wu + .14, wu, ang, big };
    later(V, wu, () => {
      const t = pick(R, ang, s.range, .45), a = t ? ang2(R, t) : ang, x = R.p.x + cos(a) * 20, y = R.p.y + sin(a) * 20, spd = big ? 1250 : 1000;
      const mkA = (aa) => ({ k: 'arrow', x, y, a: aa, spd, life: (s.range + 90) / spd, mult: big ? 1.4 : 1, big, pierce: big, rad: big ? 9 : 6, c: s.arrow ? ARROWC[s.arrow] : big ? '#ffe28a' : col, at: s.arrow, hit: [], t: 0 });
      V.pj.push(mkA(a));
      if (D.PA.multi()) { V.pj.push(mkA(a - .2), mkA(a + .2)); R.ft.push({ x: R.p.x, y: R.p.y - 26, t: 'MULTI-SHOT', c: '#b6f27a', life: .8 }); }   // Archer T3
      spark(V, x, y, big ? 10 : 5, '#fff', { a, sp: .4, v0: 120, v1: 320 });
      if (big) { ring(V, x, y, 4, 34, .2, '#ffe28a', 3); V.shk = Math.max(V.shk, 2.5); }
    });
  }

  function assassin(R, ang, n) { // tebasan 1 & 2: biasa & bersih. Tebasan 3: baru kencang ala Vergil
    const V = R.v, s = R.s, col = roleCol(), rng = s.range + 12, tgt = pick(R, ang, s.range + 14, 1.2);
    const last = tgt ? { x: tgt.x, y: tgt.y } : { x: R.p.x + cos(ang) * 28, y: R.p.y + sin(ang) * 28 };
    const cen = () => { if (tgt && !tgt.dead) { last.x = tgt.x; last.y = tgt.y; } return last; };
    const cut = (L, w, a, life) => { const c = cen(); add(V, { k: 'line', x1: c.x - cos(a) * L / 2, y1: c.y - sin(a) * L / 2, x2: c.x + cos(a) * L / 2, y2: c.y + sin(a) * L / 2, w, life, c: col }); };
    const ghost = (x, y, a) => V.gh.push({ x, y, a, life: .28, max: .28, c: col });
    if (n < 2) {
      const dir = n ? -1 : 1, dur = Math.min(.24, s.cd * .9);
      V.sw = { k: 'slash', t: 0, dur, ang, dir, lunge: 9 };
      if (tgt && dist(tgt, R.p) - tgt.r > 22) { ghost(R.p.x, R.p.y, ang); C().move(R, R.p, cos(ang) * 14, sin(ang) * 14, 9); }
      add(V, { k: 'arc', fol: 1, a: ang, dir, span: 2.2, r: rng + 8, th: 18, life: dur * 1.5, sw: .5, c: col });
      later(V, dur * .35, () => { if (tgt && !tgt.dead) strike(R, tgt, 1, { n: 5, c: col, kb: 3, ang }); });
    } else { // dash menembus musuh, tebasan beruntun muncul, ditutup silang X
      R.atkT = Math.max(R.atkT, .45);
      V.sw = { k: 'finish', t: 0, dur: .5, ang, lunge: 0 };
      const a2 = tgt ? ang2(R, tgt) : ang, total = tgt ? dist(tgt, R.p) + tgt.r + 36 : 60;
      ghost(R.p.x, R.p.y, a2);
      for (let d = 0; d < Math.min(total, 150); d += 6) {
        const bx = R.p.x, by = R.p.y; C().move(R, R.p, cos(a2) * 6, sin(a2) * 6, 9);
        if (R.p.x === bx && R.p.y === by) break; if (d % 24 === 0) ghost(R.p.x, R.p.y, a2);
      }
      R.inv = Math.max(R.inv, .3);
      for (let i = 0; i < 5; i++) later(V, .1 + i * .045, () => {
        cut(rnd(80, 120), 8, rnd(0, PI), .16);
        if (tgt && !tgt.dead) strike(R, tgt, .2, { n: 2, c: col, ang: a2 });
      });
      later(V, .43, () => {
        const c = cen(); cut(150, 14, a2 + PI / 4, .3); cut(150, 14, a2 - PI / 4, .3);
        ring(V, c.x, c.y, 6, 90, .35, '#fff', 4); flash(V, c.x, c.y, 56, .18, col); spark(V, c.x, c.y, 18, '#fff', { v0: 90, v1: 300 });
        const h = R.mobs.filter((m) => !m.dead && Math.hypot(m.x - c.x, m.y - c.y) < 60);
        h.forEach((m) => strike(R, m, .6, { n: 6, c: col, kb: 10 }));
        V.shk = Math.max(V.shk, 6); if (h.length) hitstop(R, .07);
      });
    }
  }
  const ROLE = { fighter, tank, mage, archer, assassin };
  FX.role = ROLE;                                  // dipakai unique.js (mis. combo basic attack normal setelah teleport)

  FX.attack = function (R, ang) {
    const V = st(R), cb = V.cb;
    if (R.t - cb.t > R.s.cd + .7) cb.i = 0;     // combo putus kalau jeda terlalu lama
    const n = cb.i % 3; cb.i++; cb.t = R.t;
    if (!D.PA.overrideAttack(R, ang) && !D.Uniq.attack(R, ang)) ROLE[D.state.role](R, ang, n);   // Unique Item punya pola sendiri (js/unique.js)   // pasif tier bisa mengganti basic attack (Dash Strike / Adrenaline AoE)
    D.PA.afterAttack(R, ang);
  };

  /* =====================  POSE (animasi badan & senjata)  ===================== */
  function pose(R, face) {
    const V = st(R), sw = V.sw, role = D.state.role, wt = wtype();
    const o = { a: face + 1.35, off: 8, pull: 0, lx: 0, ly: 0, sh: role === 'tank' ? { a: face - 1.05, r: 15, span: .62 } : null, orb: null };
    if (wt === 'wand') { o.a = face + .85; o.off = 6; } else if (wt === 'bow') { o.a = face; o.off = 14; }
    o.a += sin(R.t * 3) * .04;
    if (!sw) return o;
    const A = sw.ang, p = cl(sw.t / sw.dur), lg = (e) => { o.lx = cos(A) * e; o.ly = sin(A) * e; };
    switch (sw.k) {
      case 'slash': o.a = A + sw.dir * (-1.3 + 2.6 * E.out(p)); lg(sw.lunge * sin(p * PI)); break;
      case 'smash':
        if (p < .4) { o.a = A - 1.9 - .7 * E.out(p / .4) + sin(sw.t * 55) * .03; lg(-3 * p / .4); }
        else { const u = cl((p - .4) / .2); o.a = A - 2.6 + 2.6 * E.in(u); lg(sw.lunge * E.out(u) * (1 - cl((p - .6) / .4) * .6)); }
        break;
      case 'thrust': o.a = A; o.off = p < .35 ? 8 - 10 * E.out(p / .35) : p < .55 ? -2 + 38 * E.out((p - .35) / .2) : 36 - 28 * E.io((p - .55) / .45); lg(p > .35 && p < .6 ? 8 : 0); break;
      case 'bash': {
        const r = p < .35 ? 15 - 8 * E.out(p / .35) : p < .55 ? 7 + 27 * E.out((p - .35) / .2) : 34 - 19 * E.io((p - .55) / .45);
        o.sh = { a: A, r, span: .8 }; o.a = A + 1.25; lg(p > .35 && p < .65 ? 10 : 0); break;
      }
      case 'cast':
        if (sw.t < sw.wu) { const q = sw.t / sw.wu; o.a = A + (1 - E.out(q)) * .9; o.off = 6; o.orb = { x: R.p.x + cos(o.a) * 40, y: R.p.y + sin(o.a) * 40, r: (sw.big ? 12 : 8) * E.out(q) + 1, q }; }
        else { o.a = A; lg(-5 * (1 - (sw.t - sw.wu) / (sw.dur - sw.wu))); }
        break;
      case 'draw':
        if (sw.t < sw.wu) { const q = E.out(sw.t / sw.wu); o.a = A; o.pull = q; o.off = 14 - 3 * q; lg(-2 * q); }
        else { const q = (sw.t - sw.wu) / (sw.dur - sw.wu); o.a = A; o.pull = -.2 * sin(q * 28) * (1 - q); lg(-4 * (1 - q)); }
        break;
      case 'raise': o.a = A - 2.1 + .2 * sin(sw.t * 30); break;
      case 'flurry': case 'finish': o.a = A + sin(sw.t * 80) * 1.4; lg((sw.lunge || 0) * sin(p * PI)); break;
    }
    return o;
  }

  /* =====================  UPDATE  ===================== */
  function impact(R, q, m) {
    const V = R.v;
    if (q.k === 'orb') {
      q.life = 0; q.done = true;
      const sp = 1 + R.s.splash, rad = (q.big ? 74 : 50) * sp * (q.oc ? 1.7 : 1), c = q.oc ? '#7fe9ff' : q.c;
      if (m) strike(R, m, q.mult, { n: 8, c, ang: q.a });
      R.mobs.forEach((o) => { if (o !== m && !o.dead && Math.hypot(o.x - q.x, o.y - q.y) < rad) strike(R, o, q.mult * .6 * sp, { n: 4, c, kb: 5 }); });
      ring(V, q.x, q.y, 6, rad, .3, c, 5); ring(V, q.x, q.y, 3, rad * .6, .22, '#fff', 2); flash(V, q.x, q.y, rad * .7, .16, c);
      spark(V, q.x, q.y, q.big ? 24 : 14, '#d8b8ff', { v0: 60, v1: 260 }); spark(V, q.x, q.y, 8, '#fff');
      V.shk = Math.max(V.shk, q.big ? 4 : 1.2); if (m && q.big) hitstop(R, .04);
    } else if (m) {
      q.hit.push(m); strike(R, m, q.mult, { n: 6, c: q.c, kb: q.big ? 10 : 4, ang: q.a }); flash(V, m.x, m.y, 18, .1, q.c);
      if (q.at) status(R, m, q.at, q);
      if (q.big) hitstop(R, .03);
      if (!q.pierce) { q.life = 0; q.done = true; }
    } else { spark(V, q.x, q.y, 5, '#ccc', { a: q.a + PI, sp: .8 }); q.life = 0; q.done = true; }
  }

  FX.update = function (R, dt) {
    const V = st(R);
    if (V.sw) {
      V.sw.t += dt;
      if (V.sw.k === 'cast' && V.sw.t < V.sw.wu) { // partikel tersedot ke orb
        V.acc += dt * 70;
        while (V.acc >= 1) {
          V.acc--; const o = pose(R, V.sw.ang).orb; if (!o || V.pt.length > 450) break;
          const a = rnd(0, PI2), r = rnd(26, 48);
          V.pt.push({ x: o.x + cos(a) * r, y: o.y + sin(a) * r, vx: 0, vy: 0, life: .3, max: .3, s: rnd(2, 3.4), c: Math.random() < .5 ? '#c9a0ff' : '#6fe0ff', att: 1 });
        }
      }
      if (V.sw.t >= V.sw.dur) V.sw = null;
    }
    V.sq.forEach((e) => (e.t -= dt));
    const due = V.sq.filter((e) => e.t <= 0); V.sq = V.sq.filter((e) => e.t > 0); due.forEach((e) => e.fn());

    for (const q of V.pj) {
      q.life -= dt; q.t += dt;
      if (q.k === 'orb' && q.tgt && !q.tgt.dead) q.a += cl(adiff(atan2(q.tgt.y - q.y, q.tgt.x - q.x), q.a), -10 * dt, 10 * dt);
      const n = Math.max(1, Math.ceil(q.spd * dt / 7)), step = q.spd * dt / n;
      for (let i = 0; i < n && !q.done; i++) {
        q.x += cos(q.a) * step; q.y += sin(q.a) * step;
        if (!C().walk(R, q.x, q.y)) { impact(R, q, null); break; }
        for (const m of R.mobs) {
          if (m.dead || q.hit.includes(m) || Math.hypot(m.x - q.x, m.y - q.y) > m.r + q.rad) continue;
          impact(R, q, m); if (q.done) break;
        }
      }
      if (!q.done && q.life <= 0) { q.done = true; if (q.k === 'orb') ring(V, q.x, q.y, 3, 22, .2, q.c, 2); }
      if (!q.done) spark(V, q.x, q.y, 1, q.c, { v0: 5, v1: 30, l: 1.2, sz: q.k === 'orb' ? 1.4 : .8, dr: 3 });
    }
    V.pj = V.pj.filter((q) => !q.done);

    for (const f of V.fx) f.life -= dt; V.fx = V.fx.filter((f) => f.life > 0);
    for (const g of V.gh) g.life -= dt; V.gh = V.gh.filter((g) => g.life > 0);
    for (const q of V.pt) {
      q.life -= dt;
      if (q.att) { const o = V.sw && V.sw.k === 'cast' ? pose(R, V.sw.ang).orb : null; if (o) { q.x += (o.x - q.x) * Math.min(1, 11 * dt); q.y += (o.y - q.y) * Math.min(1, 11 * dt); } else q.life = 0; }
      else { q.x += q.vx * dt; q.y += q.vy * dt; const d = Math.exp(-q.dr * dt); q.vx *= d; q.vy *= d; }
    }
    V.pt = V.pt.filter((q) => q.life > 0);
    for (const m of R.mobs) {
      if (m.hf > 0) m.hf -= dt;
      if (m.slow > 0) { m.slow -= dt; if (Math.random() < dt * 14) spark(V, m.x + rnd(-8, 8), m.y + rnd(-8, 8), 1, '#8fe3ff', { v0: 5, v1: 25, sz: 1.3 }); }
      if (m.sts && !m.dead) for (const k of Object.keys(m.sts)) {
        const e = m.sts[k]; e.t -= dt; e.tick -= dt;
        if (Math.random() < dt * 12) spark(V, m.x + rnd(-8, 8), m.y + rnd(-6, 6), 1, e.c, { a: -PI / 2, sp: .5, v0: 15, v1: 45, sz: 1.2 });
        if (e.tick <= 0) { e.tick += .5; dotHit(R, m, e.dps * .5, e.c); }
        if (e.t <= 0) delete m.sts[k];
        if (m.dead) break;
      }
    }
    if (R.dash) { // jejak bayangan selama dash
      V.dg = (V.dg || 0) - dt;
      if (V.dg <= 0) { const gl = D.state.role === 'assassin' ? .4 : .26; V.dg = .02; V.gh.push({ x: R.p.x, y: R.p.y, a: R.dash.ang, life: gl, max: gl, c: roleCol() }); spark(V, R.p.x, R.p.y, 2, roleCol(), { a: R.dash.ang + PI, sp: .6, v0: 30, v1: 120 }); }
    }
    if (R.bf) for (const [k, c] of [['atk', '#ff8a4a'], ['def', '#8fc4ff'], ['ls', '#d1303f']]) if (R.bf[k].t > 0 && Math.random() < dt * 9) spark(V, R.p.x + rnd(-12, 12), R.p.y + 8, 1, c, { a: -PI / 2, sp: .3, v0: 20, v1: 60, sz: 1.3 });
    V.shk = Math.max(0, V.shk - 45 * dt);
  };

  /* =====================  DASH / BUFF / SPELL / STATUS  ===================== */
  const ARROWC = { poison: '#7be04a', frost: '#8fe3ff', fire: '#ff7a3a', thunder: '#ffe85a' };
  const fl = (R, x, y, t, c) => R.ft.push({ x, y, t: String(t), c, life: .8 });
  function dotHit(R, m, d, c) { const n0 = R.ft.length; C().hit(m, d, false); const f = R.ft[n0]; if (f) { f.c = c; f.x += rnd(-8, 8); } m.hf = .06; }
  function status(R, m, kind, q) {
    const V = R.v, atk = R.s.atk, c = ARROWC[kind];
    if (kind === 'poison') (m.sts = m.sts || {}).poison = { t: 4, tick: .5, dps: atk * .45 / 4, c };
    else if (kind === 'fire') (m.sts = m.sts || {}).burn = { t: 3, tick: .5, dps: atk * .8 / 3, c };
    else if (kind === 'frost') { m.slow = 2.2; ring(V, m.x, m.y, 4, 24, .25, c, 2); }
    else if (kind === 'thunder') {
      R.mobs.filter((o) => o !== m && !o.dead && Math.hypot(o.x - m.x, o.y - m.y) < 100).sort((a, b) => dist(a, m) - dist(b, m)).slice(0, 2).forEach((o) => {
        add(V, { k: 'line', x1: m.x, y1: m.y, x2: o.x, y2: o.y, w: 7, life: .2, c }); spark(V, o.x, o.y, 6, c, {});
        strike(R, o, q.mult * .5, { n: 3, c });
      });
    }
  }
  FX.dash = function (R, ang, d) {
    const V = st(R), col = roleCol(), x = R.p.x, y = R.p.y, ex = x + cos(ang) * d, ey = y + sin(ang) * d, nx = -sin(ang), ny = cos(ang);
    V.sw = null; V.sq = [];   // dash membatalkan serangan yang sedang berjalan
    ring(V, x, y, 6, 40, .28, col, 4, true); flash(V, x, y, 28, .12, '#fff');
    spark(V, x, y, 8 + d / 12, col, { a: ang + PI, sp: .7, v0: 60, v1: 260 }); spark(V, x, y, 6, '#d9d2b8', { a: ang + PI, sp: 1, v0: 30, v1: 120 });
    for (let i = -1; i <= 1; i++) add(V, { k: 'line', x1: x + nx * i * 7, y1: y + ny * i * 7, x2: ex + nx * i * 7, y2: ey + ny * i * 7, w: i ? 3 : 6, life: .22 + d / 1500, c: col });
  };
  FX.buffFx = function (R, col) {
    const V = st(R); ring(V, R.p.x, R.p.y, 8, 70, .4, col, 5, true); flash(V, R.p.x, R.p.y, 34, .2, col);
    spark(V, R.p.x, R.p.y, 14, col, { a: -PI / 2, sp: 1.2, v0: 40, v1: 140 });
  };
  /* Spell ke-2 Fighter (dari Tome). Tier tome → spell berbeda, `pow` menguatkan efeknya. */
  D.SPELL2 = { warcry: { n: 'War Cry', cd: 14 }, ironskin: { n: 'Ironskin', cd: 16 }, firewave: { n: 'Flame Wave', cd: 12 }, quake: { n: 'Quake', cd: 15 }, bloodrage: { n: 'Bloodrage', cd: 18 } };
  FX.spell = function (R, id, pow, ang) {
    const V = st(R), P = R.p, s = R.s;
    V.sw = { k: 'raise', t: 0, dur: .35, ang };
    if (id === 'warcry') { R.bf.atk = { t: 6 + pow * 2, m: 1.25 + .05 * pow }; FX.buffFx(R, '#ff8a4a'); ring(V, P.x, P.y, 10, 120, .5, '#ff8a4a', 4, true); V.shk = Math.max(V.shk, 3); fl(R, P.x, P.y - 24, 'WAR CRY!', '#ff8a4a'); }
    else if (id === 'ironskin') { R.bf.def = { t: 8, m: 1.6 }; R.hp = Math.min(s.hp, R.hp + s.hp * .12); FX.buffFx(R, '#5aa0d8'); fl(R, P.x, P.y - 24, 'IRONSKIN +HP', '#8fc4ff'); }
    else if (id === 'bloodrage') { R.bf.atk = { t: 8, m: 1.35 + .05 * pow }; R.bf.ls = { t: 8, m: .12 + .03 * pow }; FX.buffFx(R, '#d1303f'); ring(V, P.x, P.y, 10, 110, .5, '#d1303f', 4, true); fl(R, P.x, P.y - 24, 'BLOODRAGE!', '#ff5a5a'); }
    else if (id === 'firewave') {
      later(V, .12, () => {
        ring(V, P.x, P.y, 10, 120, .4, '#ff7a3a', 7, true); ring(V, P.x, P.y, 4, 80, .3, '#ffd54a', 3, true); flash(V, P.x, P.y, 60, .2, '#ff7a3a');
        spark(V, P.x, P.y, 30, '#ff9a4a', { v0: 80, v1: 300 });
        const h = R.mobs.filter((m) => !m.dead && dist(m, P) - m.r < 115);
        h.forEach((m) => { strike(R, m, 2.2 * pow, { kb: 14, n: 10, c: '#ff7a3a' }); if (!m.dead) (m.sts = m.sts || {}).burn = { t: 3, tick: .5, dps: s.atk * .6 * pow / 3, c: '#ff7a3a' }; });
        V.shk = Math.max(V.shk, 4); if (h.length) hitstop(R, .04);
      });
    } else if (id === 'quake') {
      const done = new Set();
      [70, 110, 150].forEach((rad, i) => later(V, .1 + i * .15, () => {
        ring(V, P.x, P.y, rad * .4, rad, .35, '#d9cba0', 6, true); spark(V, P.x + cos(i * 2) * rad * .6, P.y + sin(i * 2) * rad * .6, 8, '#d9cba0', { v0: 40, v1: 200 });
        R.mobs.filter((m) => !m.dead && !done.has(m) && dist(m, P) - m.r < rad).forEach((m) => { done.add(m); strike(R, m, .9 * pow, { kb: 10, n: 7, c: '#d9cba0' }); m.slow = 2; });
        V.shk = Math.max(V.shk, 3 + i * 2);
      }));
    }
  };

  FX.u = { st, add, ring, flash, spark, strike, later, hitstop, inArc, pick };   // util visual untuk passives.js
  FX.shake = (R) => { const m = st(R).shk; return m > 0 ? { x: rnd(-m, m), y: rnd(-m, m) } : { x: 0, y: 0 }; };

  /* =====================  DRAW  ===================== */
  function blade(ctx, col, len, w) {
    ctx.fillStyle = '#6b4a2b'; ctx.fillRect(3, -1.6, 7, 3.2); ctx.fillStyle = '#c9a24a'; ctx.fillRect(9, -(w + 2.5), 3, 2 * (w + 2.5));
    ctx.beginPath(); ctx.moveTo(12, -w); ctx.lineTo(12 + len - 6, -w); ctx.lineTo(12 + len, 0); ctx.lineTo(12 + len - 6, w); ctx.lineTo(12, w); ctx.closePath();
    ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.moveTo(13, 0); ctx.lineTo(12 + len - 5, 0); ctx.stroke();
  }
  function weapon(ctx, x, y, a, wt, col, pull, glow) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.lineJoin = 'round';
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 10; }
    if (wt === 'sword') blade(ctx, col, 30, 2.8);
    else if (wt === 'light') blade(ctx, col, 26, 2.2);
    else if (wt === 'dagger') blade(ctx, col, 15, 2.2);
    else if (wt === 'heavy') {
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(3, -2, 36, 4);
      ctx.beginPath(); ctx.moveTo(26, -4); ctx.quadraticCurveTo(34, -22, 46, -14); ctx.quadraticCurveTo(40, 0, 46, 14); ctx.quadraticCurveTo(34, 22, 26, 4); ctx.closePath();
      ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1; ctx.stroke();
    } else if (wt === 'wand') {
      ctx.fillStyle = '#6b4a2b'; ctx.fillRect(2, -1.6, 30, 3.2);
      ctx.shadowColor = '#c9a0ff'; ctx.shadowBlur = 10; ctx.fillStyle = '#e6d0ff'; ctx.beginPath(); ctx.arc(34, 0, 4.5, 0, PI2); ctx.fill();
    } else if (wt === 'bow') {
      const ex = 2.2, ey = 18.2, sx = ex - pull * 14;
      ctx.lineCap = 'round'; ctx.strokeStyle = '#8a5a2b'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(-6, 0, 20, -1.15, 1.15); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex, -ey); ctx.lineTo(sx, 0); ctx.lineTo(ex, ey); ctx.stroke();
      if (pull > .02) {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sx, 0); ctx.lineTo(sx + 28, 0); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(sx + 33, 0); ctx.lineTo(sx + 26, -3); ctx.lineTo(sx + 26, 3); ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  }
  function shield(ctx, x, y, sh) {
    ctx.save(); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y, sh.r, sh.a - sh.span, sh.a + sh.span);
    ctx.lineWidth = 7; ctx.strokeStyle = '#223a5c'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = '#7fb2e5'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke(); ctx.restore();
  }
  function runeCircle(ctx, px, py, sw, t) {
    const q = sw.t < sw.wu ? sw.t / sw.wu : 1 - (sw.t - sw.wu) / (sw.dur - sw.wu), r = 24 + (sw.big ? 14 : 8);
    ctx.save(); ctx.translate(px, py + 12); ctx.scale(1, .45); ctx.globalAlpha = cl(q) * .85; ctx.lineWidth = 2; ctx.strokeStyle = '#c9a0ff'; ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 10;
    ctx.rotate(t * 2); ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.arc(0, 0, r, 0, PI2); ctx.stroke(); ctx.setLineDash([]);
    ctx.rotate(-t * 3.5); ctx.beginPath(); ctx.arc(0, 0, r * .62, 0, PI2); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = i * PI2 / 3; i ? ctx.lineTo(cos(a) * r * .62, sin(a) * r * .62) : ctx.moveTo(cos(a) * r * .62, sin(a) * r * .62); } ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
  function drawArc(ctx, f, X, Y, p) {
    const hp = E.out(cl(p / f.sw)), tp = E.in(cl((p - .2) / .8)); if (hp - tp < .02) return;
    const a0 = f.a - f.dir * f.span / 2, d = f.dir * f.span, N = 16, al = Math.min(1, (1 - p) * 2.2), out = [], in1 = [], in2 = [];
    for (let i = 0; i <= N; i++) {
      const a = a0 + d * (tp + (hp - tp) * i / N), th = f.th * Math.pow(Math.abs(sin(PI * i / N)), .8);
      out.push([X + cos(a) * f.r, Y + sin(a) * f.r]); in1.push([X + cos(a) * (f.r - th), Y + sin(a) * (f.r - th)]); in2.push([X + cos(a) * (f.r - th * .45), Y + sin(a) * (f.r - th * .45)]);
    }
    const path = (inn) => { ctx.beginPath(); out.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); for (let i = N; i >= 0; i--) ctx.lineTo(inn[i][0], inn[i][1]); ctx.closePath(); };
    ctx.globalAlpha = al * .7; ctx.fillStyle = f.c; ctx.shadowColor = f.c; ctx.shadowBlur = 16; path(in1); ctx.fill();
    ctx.globalAlpha = al; ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; path(in2); ctx.fill();
  }
  function drawLine(ctx, f, p, cx, cy) {
    const hp = cl(p / .22), x2 = f.x1 + (f.x2 - f.x1) * hp, y2 = f.y1 + (f.y2 - f.y1) * hp, w = f.w * (1 - p * p);
    let nx = -(y2 - f.y1), ny = x2 - f.x1; const l = Math.hypot(nx, ny) || 1, mx = (f.x1 + x2) / 2 - cx, my = (f.y1 + y2) / 2 - cy;
    const poly = (k) => { const ax = nx / l * w * k / 2, ay = ny / l * w * k / 2; ctx.beginPath(); ctx.moveTo(f.x1 - cx, f.y1 - cy); ctx.lineTo(mx + ax, my + ay); ctx.lineTo(x2 - cx, y2 - cy); ctx.lineTo(mx - ax, my - ay); ctx.closePath(); ctx.fill(); };
    ctx.globalAlpha = 1 - p; ctx.fillStyle = f.c; ctx.shadowColor = f.c; ctx.shadowBlur = 14; poly(1);
    ctx.fillStyle = '#fff'; ctx.shadowBlur = 0; poly(.4);
  }

  FX.draw = function (ctx, R, cx, cy, face, color) {
    const V = st(R), ga = ctx.globalAlpha, ps = pose(R, face), px = R.p.x - cx, py = R.p.y - cy, x = px + ps.lx, y = py + ps.ly;
    for (const g of V.gh) { ctx.globalAlpha = Math.max(0, g.life / g.max) * .5; D.drawCursor(ctx, g.x - cx, g.y - cy, g.a, g.c); }
    ctx.globalAlpha = ga;
    if (R.bf) { let i = 0; for (const [k, c] of [['atk', '#ff8a4a'], ['def', '#8fc4ff'], ['ls', '#d1303f']]) if (R.bf[k].t > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .5 + .25 * sin(R.t * 6); ctx.strokeStyle = c; ctx.lineWidth = 2; ctx.shadowColor = c; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.ellipse(px, py + 8, 17 + i * 4, 9 + i * 2, 0, 0, PI2); ctx.stroke(); ctx.restore(); i++;
    } }
    if (D.state.role === 'mage' && V.sw && V.sw.k === 'cast') runeCircle(ctx, px, py, V.sw, R.t);
    D.drawCursor(ctx, x, y, face, color);
    if (ps.sh) shield(ctx, x, y, ps.sh);
    weapon(ctx, x + cos(ps.a) * ps.off, y + sin(ps.a) * ps.off, ps.a, wtype(), bladeCol(), ps.pull, V.sw ? color : null);
    ctx.globalAlpha = 1;

    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    if (ps.orb) { // orb charge + cincin rune berputar
      const o = ps.orb, ox = o.x - cx, oy = o.y - cy, g = ctx.createRadialGradient(ox, oy, 0, ox, oy, o.r * 2.6);
      g.addColorStop(0, '#fff'); g.addColorStop(.25, '#c9a0ff'); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, o.r * 2.6, 0, PI2); ctx.fill();
      ctx.strokeStyle = '#e6d0ff'; ctx.lineWidth = 1.5; ctx.globalAlpha = .4 + .5 * o.q;
      ctx.setLineDash([4, 4]); ctx.lineDashOffset = -R.t * 40; ctx.beginPath(); ctx.arc(ox, oy, o.r + 7, 0, PI2); ctx.stroke();
      ctx.lineDashOffset = R.t * 55; ctx.beginPath(); ctx.arc(ox, oy, o.r + 13, 0, PI2); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const f of V.fx) {
      const p = 1 - f.life / f.max; ctx.save();
      if (f.k === 'arc') drawArc(ctx, f, f.fol ? px : f.x - cx, f.fol ? py : f.y - cy, p);
      else if (f.k === 'line') drawLine(ctx, f, p, cx, cy);
      else if (f.k === 'ring') {
        const r = f.r0 + (f.r1 - f.r0) * E.out(p); ctx.globalAlpha = 1 - p; ctx.strokeStyle = f.c; ctx.lineWidth = Math.max(.5, f.w * (1 - p)); ctx.shadowColor = f.c; ctx.shadowBlur = 10;
        ctx.beginPath(); if (f.flat) ctx.ellipse(f.x - cx, f.y - cy + 4, r, r * .55, 0, 0, PI2); else ctx.arc(f.x - cx, f.y - cy, r, 0, PI2); ctx.stroke();
      } else if (f.k === 'flash') {
        const X = f.x - cx, Y = f.y - cy, g = ctx.createRadialGradient(X, Y, 0, X, Y, f.r); g.addColorStop(0, '#fff'); g.addColorStop(.4, f.c); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.globalAlpha = 1 - p; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, f.r, 0, PI2); ctx.fill();
      }
      ctx.restore();
    }
    for (const q of V.pj) {
      const X = q.x - cx, Y = q.y - cy;
      if (q.k === 'orb') {
        const r = q.rad * (1 + .08 * sin(q.t * 40)), g = ctx.createRadialGradient(X, Y, 0, X, Y, r * 2.4);
        g.addColorStop(0, '#fff'); g.addColorStop(.25, q.c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r * 2.4, 0, PI2); ctx.fill();
      } else {
        const len = q.big ? 64 : 44, tx = X - cos(q.a) * len, ty = Y - sin(q.a) * len, lg = ctx.createLinearGradient(tx, ty, X, Y);
        lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, q.c);
        ctx.lineCap = 'round'; ctx.strokeStyle = lg; ctx.lineWidth = q.big ? 8 : 5; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(X, Y); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = q.big ? 3 : 2; ctx.beginPath(); ctx.moveTo(X - cos(q.a) * 22, Y - sin(q.a) * 22); ctx.lineTo(X, Y); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(X + cos(q.a) * 6, Y + sin(q.a) * 6); ctx.lineTo(X + cos(q.a + 2.6) * 5, Y + sin(q.a + 2.6) * 5); ctx.lineTo(X + cos(q.a - 2.6) * 5, Y + sin(q.a - 2.6) * 5); ctx.closePath(); ctx.fill();
      }
    }
    for (const q of V.pt) {
      const k = q.life / q.max; ctx.globalAlpha = cl(k); ctx.fillStyle = q.c;
      if (q.att) { ctx.beginPath(); ctx.arc(q.x - cx, q.y - cy, q.s * (.5 + .5 * k), 0, PI2); ctx.fill(); }
      else { const s = q.s * (.5 + .5 * k); ctx.fillRect(q.x - cx - s / 2, q.y - cy - s / 2, s, s); }
    }
    ctx.restore(); ctx.globalAlpha = 1;
  };
})(window.DSB);
