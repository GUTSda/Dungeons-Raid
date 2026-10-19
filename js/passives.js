/* passives.js — Pasif tiap naik Rank (Tier 2-4) per role.
   Semua pasif KUMULATIF: Tier 3 otomatis punya pasif Tier 2, Tier 4 punya Tier 2+3.
   Semua angka balance ada di objek K di bawah. State per-run disimpan di R.pa (di-reset tiap run baru).
   Hook yang dipanggil engine:
     dungeon.js : init, field, update, onKill, onDie, onSkill, roll(critAdd/atkMul), hit(trueDmg/lsExtra), hurt(immune/defMul/takenMul/afterHurt/aethel),
                  move(rooted/spdMul), dash(markDash/dashMul)
     combatfx.js: overrideAttack, afterAttack, mageCast, multi, onCrit, FX.u (util visual)
     game.js    : ultReady/ultHold/ultRelease/ultCancel (Mage T3), draw, alpha, hud, html */
(function (D) {
  const PI = Math.PI, PI2 = PI * 2, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, hyp = Math.hypot;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const adiff = (a, b) => (((a - b + PI) % PI2) + PI2) % PI2 - PI;
  const PA = (D.PA = {});

  /* ===================== ANGKA BALANCE ===================== */
  const K = {
    mom:   { need: 5, stealth: 3, mul: 2.2, range: 300, cone: 1.1 },       // Assassin T2: Momentum Lethal
    mark:  { t: 10, range: 700 },                                           // Assassin T3: Death Mark Echo (mark hilang setelah 10 dtk)
    aeth:  { hp: .25, dur: 4, cd: 120, ls: .35 },                           // Assassin T4: Aethel Shift (ls = % damage jadi heal)
    adr:   { need: 20, area: Math.SQRT2, mul: 1.25 },                       // Fighter T2: area x1.41 radius = luas tepat 2x
    jug:   { per: .02, max: 10, reset: 10 },                                // Fighter T3: +2% DEF/stack, max 10 stack (=20%)
    wrath: { len: 150, wid: 100, mul: .5, kb: 36, stun: .6, heavyOnly: false }, // Fighter T4 (heavyOnly:true = hanya Greataxe)
    arc:   { every: 4, area: 1.7, mul: 1.4, skCut: 2, atkCut: .4 },         // Mage T2: cast ke-4 overcharged
    res:   { need: 50, mob: 5, boss: 20, mul: 5, grow: .05, radius: 140, time: 10, pull: 130, bossPull: 45, cine: { bars: 1, zoom: .07, vig: .9 } }, // Mage T3 (grow = +5% damage ledakan tiap detik ditahan)
    astral:{ cut: .5, atk: .10, spd: .05, t: 30 },                          // Mage T4
    bulw:  { hits: 20, n: 5, cut: .5 },                                     // Tank T2
    veng:  { ratio: .3, range: 220 },                                       // Tank T3: 30% damage masuk dibalikkan
    fort:  { hp: .5, taunt: 8, weak: 8, wmul: 1.5 },                        // Tank T4
    eagle: { max: 20 },                                                     // Archer T2: 1 stack = +1% crit
    multi: { chance: .1, spread: .2 },                                      // Archer T3
    gale:  { t: 2, spd: .5, dash: 1.1 }                                     // Archer T4
  };

  const has = (r, t) => D.state.role === r && D.state.tier >= t;
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);
  const C = () => D._c, U = () => D.FX.u;
  const col = () => D.ROLES[D.state.role].color;
  const fl = (R, x, y, t, c) => R.ft.push({ x, y, t: String(t), c: c || '#fff', life: .9 });

  /* ===================== LIFECYCLE ===================== */
  PA.init = (R) => { R.pa = { stk: 0, armed: false, stealth: 0, form: 0, aeCd: 0, adr: 0, jug: 0, jugT: 0, cast: 0, res: 0, full: false, bh: null, orbs: [], post: 0,
    hits: 0, barrier: 0, focus: 0, gale: 0, feed: false, ultLock: false }; };
  PA.field = (R) => { const a = R.pa; if (a) { a.bh = null; a.orbs = []; } D.Cine.off('ult'); };          // pindah level: bersihkan black hole & orb
  PA.onDie = (R) => { const a = R.pa; a.bh = null; a.stealth = 0; a.form = 0; a.hits = 0; a.barrier = 0; D.Cine.off('ult'); D.Uniq.reset(R); };

  PA.update = function (R, dt) {
    const a = R.pa; if (!a) return;
    for (const k of ['stealth', 'form', 'aeCd', 'post', 'gale', 'jugT']) if (a[k] > 0) a[k] -= dt;
    for (const m of R.mobs) { if (m.weak > 0) m.weak -= dt; if (m.tauntT > 0) m.tauntT -= dt; if (m.stun > 0) m.stun -= dt; if (m.mark > 0) m.mark -= dt; }
    if (has('fighter', 3) && a.jug >= K.jug.max && a.jugT <= 0) { a.jug = 0; fl(R, R.p.x, R.p.y - 24, 'Juggernaut reset', '#aaa'); }
    if (has('archer', 2) && a.focus && (hyp(D.input.dx, D.input.dy) > .12 || R.dash)) a.focus = 0;   // bergerak = reset Focus
    if (has('mage', 3)) {
      for (const o of a.orbs) {                      // orb mana melayang ke player
        o.t += dt; const dx = R.p.x - o.x, dy = R.p.y - o.y, d = hyp(dx, dy) || 1, sp = (60 + o.t * 320) * dt;
        if (d <= sp + 10) { o.got = true; a.res = Math.min(K.res.need, a.res + o.v); } else { o.x += dx / d * sp; o.y += dy / d * sp; }
      }
      a.orbs = a.orbs.filter((o) => !o.got && o.t < 20);
      if (a.res >= K.res.need && !a.full) { a.full = true; fl(R, R.p.x, R.p.y - 28, 'ULTIMATE SIAP!', '#d79cff'); }
      const b = a.bh;
      if (b) {
        if (a.feed) b.miss = 0; else b.miss += dt;
        if (b.miss > .12) { a.bh = null; D.Cine.off('ult'); }   // tombol dilepas paksa (Esc / klik kanan / blur) = batal
        else {
          b.t += dt;
          for (const m of R.mobs) {                  // tarik musuh ke pusat black hole
            if (m.dead) continue; const dx = b.x - m.x, dy = b.y - m.y, d = hyp(dx, dy);
            if (d > K.res.radius * 1.6 || d < 4) continue;
            const sp = Math.min(d, (m.isBoss ? K.res.bossPull : K.res.pull) * dt); C().move(R, m, dx / d * sp, dy / d * sp, m.r - 2);
          }
          if (b.t >= K.res.time) detonate(R);
        }
      }
    }
    if (!a.feed) a.ultLock = false; a.feed = false;
  };

  /* Training Room: dummy tidak bisa mati, jadi pasif yang butuh kill tidak pernah terisi. Fungsi ini mengisi SEMUA gauge pasif sesuai Rank. */
  PA.fillAll = function (R) {
    const a = R.pa; if (!a) return;
    if (has('assassin', 2) && !a.armed) { a.armed = true; a.stk = 0; }                  // Dash Strike siap
    if (has('fighter', 2)) a.adr = K.adr.need;                                           // Adrenaline penuh
    if (has('fighter', 3)) { a.jug = K.jug.max; a.jugT = K.jug.reset; }                  // Juggernaut maks & tidak reset
    if (has('mage', 2)) a.cast = K.arc.every - 1;                                        // cast berikutnya selalu Overcharged
    if (has('mage', 3)) { a.res = K.res.need; a.full = true; }                           // Resonance penuh → Ultimate siap
    if (has('tank', 2)) a.barrier = Math.max(a.barrier, K.bulw.n);                       // Barrier aktif
    if (has('archer', 2)) a.focus = K.eagle.max;                                         // Focus maks
  };

  PA.onKill = function (R, m) {
    const a = R.pa;
    if (has('assassin', 2)) {
      a.stk++;
      if (a.stk >= K.mom.need) { a.stk = 0; a.armed = true; a.stealth = K.mom.stealth; D.FX.buffFx(R, '#9a86c8'); fl(R, R.p.x, R.p.y - 26, 'STEALTH!', '#c9b8ff'); }
    }
    if (has('mage', 3) && a.res < K.res.need) a.orbs.push({ x: m.x, y: m.y, t: 0, v: m.isBoss ? K.res.boss : K.res.mob });
  };

  PA.onSkill = function (R) {
    const a = R.pa;
    if (has('fighter', 3)) { if (a.jug < K.jug.max) a.jug++; if (a.jug >= K.jug.max) a.jugT = K.jug.reset; }
    if (has('tank', 4)) {                              // skill: taunt SEMUA musuh + weakness
      let n = 0; for (const m of R.mobs) if (!m.dead) { m.tauntT = K.fort.taunt; m.weak = K.fort.weak; n++; }
      if (n) { fl(R, R.p.x, R.p.y - 28, 'TAUNT + WEAKNESS', '#8fc4ff'); D.FX.buffFx(R, '#8fc4ff'); }
    }
  };

  /* ===================== MODIFIER STAT ===================== */
  PA.weakMul = () => K.fort.wmul;                          // Weakness (Tank T4): musuh menerima 1.5x damage
  PA.critAdd = (R) => (has('archer', 2) ? R.pa.focus : 0) + D.Uniq.critAdd(R);
  PA.atkMul = (R) => (has('mage', 4) && R.pa.post > 0 ? 1 + K.astral.atk : 1) * D.Uniq.atkMul(R);
  PA.defMul = (R) => (has('fighter', 3) ? 1 + K.jug.per * R.pa.jug : 1);
  PA.spdMul = (R) => { const a = R.pa; let m = 1; if (has('archer', 4) && a.gale > 0) m += K.gale.spd; if (has('mage', 4) && a.post > 0) m += K.astral.spd; return m * D.Uniq.spdMul(R); };
  PA.dashMul = (R) => (has('archer', 4) && R.pa.gale > 0 ? K.gale.dash : 1);
  PA.rooted = (R) => !!(R.pa && R.pa.bh) || D.Uniq.rooted(R);                   // Mage channel: tidak bisa gerak / dash
  PA.immune = (R) => R.pa.form > 0;                         // Aethel Shift: kebal semua damage
  PA.trueDmg = (R) => R.pa.form > 0;                        // serangan jadi true damage
  PA.lsExtra = (R) => (R.pa.form > 0 ? K.aeth.ls : 0) + D.Uniq.lsExtra(R);
  PA.ccImmune = (R) => (has('tank', 4) && R.hp > R.s.hp * K.fort.hp) || D.Uniq.ccImmune(R);   // Tank T4: dipakai kalau nanti ada efek knockback/CC ke player
  PA.alpha = (R) => (R.pa.form > 0 ? .5 : R.pa.stealth > 0 ? .4 : 1);

  PA.takenMul = function (R) {
    const a = R.pa; let m = 1;
    if (has('tank', 2)) {
      if (a.barrier > 0) { a.barrier--; m *= K.bulw.cut; fl(R, R.p.x, R.p.y - 30, 'BARRIER', '#8fc4ff'); }
      else if (++a.hits >= K.bulw.hits) { a.hits = 0; a.barrier = K.bulw.n; D.FX.buffFx(R, '#5aa0d8'); fl(R, R.p.x, R.p.y - 30, 'BULWARK BARRIER!', '#8fc4ff'); }
    }
    if (has('mage', 4) && a.bh) m *= K.astral.cut;
    return m * D.Uniq.takenMul(R);
  };
  PA.afterHurt = function (R, raw) {                         // Tank T3: Vengeful Aegis
    D.Uniq.afterHurt(R, raw);                                // Unique: pantulan Iron Wall
    if (!has('tank', 3)) return;
    let t = null, bd = K.veng.range;
    for (const m of R.mobs) if (!m.dead) { const d = dist(m, R.p); if (d < bd) { bd = d; t = m; } }
    if (!t) return;
    const u = U(), V = u.st(R);
    u.add(V, { k: 'line', x1: R.p.x, y1: R.p.y, x2: t.x, y2: t.y, w: 8, life: .22, c: '#ffe9a0' }); u.spark(V, t.x, t.y, 6, '#ffe9a0', {});
    C().trueHit(t, raw * K.veng.ratio);
  };
  PA.aethel = function (R) {                                 // Assassin T4: selamat dari kematian
    if (!has('assassin', 4) || R.pa.aeCd > 0 || R.hp >= R.s.hp * K.aeth.hp) return false;
    const a = R.pa; a.form = K.aeth.dur; a.aeCd = K.aeth.cd; R.hp = Math.max(R.hp, R.s.hp * .1);
    D.FX.buffFx(R, '#7a5cff'); fl(R, R.p.x, R.p.y - 30, 'AETHEL SHIFT!', '#b9a4ff'); return true;
  };
  PA.onCrit = function (R) { if (has('archer', 4)) R.pa.gale = K.gale.t; };

  /* ===================== ASSASSIN ===================== */
  PA.dashStrike = function (R, ang) {          // Basic Attack berikutnya setelah stack-5: dash + crit pasti
    const a = R.pa; if (!has('assassin', 2) || !a.armed) return false;
    let t = null, bd = 1e9;
    for (const m of R.mobs) {
      if (m.dead) continue; const d = dist(m, R.p); if (d > K.mom.range) continue;
      const da = Math.abs(adiff(atan2(m.y - R.p.y, m.x - R.p.x), ang)); if (da > K.mom.cone) continue;
      const sc = d + da * 80; if (sc < bd) { bd = sc; t = m; }
    }
    if (!t) return false;
    const a2 = atan2(t.y - R.p.y, t.x - R.p.x), total = Math.max(0, dist(t, R.p) - (t.r + 16));
    for (let d = 0; d < total; d += 8) if (!C().walk(R, R.p.x + cos(a2) * d, R.p.y + sin(a2) * d)) return false;   // terhalang dinding
    const u = U(), V = u.st(R), c = col();
    V.gh.push({ x: R.p.x, y: R.p.y, a: a2, life: .35, max: .35, c });
    for (let d = 0; d < total; d += 6) {
      const s = Math.min(6, total - d), bx = R.p.x, by = R.p.y; C().move(R, R.p, cos(a2) * s, sin(a2) * s, 9);
      if (R.p.x === bx && R.p.y === by) break; if (d % 30 === 0) V.gh.push({ x: R.p.x, y: R.p.y, a: a2, life: .3, max: .3, c });
    }
    R.inv = Math.max(R.inv, .35); R.atkT = Math.max(R.atkT, .45); a.armed = false; a.stealth = 0;
    V.sw = { k: 'finish', t: 0, dur: .5, ang: a2, lunge: 0 };
    u.ring(V, R.p.x, R.p.y, 6, 48, .28, c, 4, true);
    u.later(V, .08, () => {
      if (!t.dead) u.strike(R, t, K.mom.mul, { fc: true, n: 16, c: '#fff', ang: a2 });
      const x = t.x, y = t.y;
      for (const k of [PI / 4, -PI / 4]) u.add(V, { k: 'line', x1: x - cos(a2 + k) * 75, y1: y - sin(a2 + k) * 75, x2: x + cos(a2 + k) * 75, y2: y + sin(a2 + k) * 75, w: 14, life: .3, c });
      u.ring(V, x, y, 6, 80, .3, '#fff', 4); u.flash(V, x, y, 50, .16, c); u.spark(V, x, y, 16, '#fff', { v0: 90, v1: 300 });
      V.shk = Math.max(V.shk, 6); u.hitstop(R, .06);
      if (!t.dead && has('assassin', 3)) { t.mark = K.mark.t; fl(R, t.x, t.y - 28, '☠ MARK', '#ff5a5a'); }
    });
    return true;
  };

  PA.markDash = function (R) {                 // Death Mark Echo: dash = teleport ke musuh bertanda
    if (!has('assassin', 3)) return false;
    let t = null, bd = K.mark.range;
    for (const m of R.mobs) if (!m.dead && m.mark > 0) { const d = dist(m, R.p); if (d < bd) { bd = d; t = m; } }
    if (!t) return false;
    const a2 = atan2(t.y - R.p.y, t.x - R.p.x), ox = R.p.x, oy = R.p.y; let ok = false;
    for (const off of [t.r + 18, t.r + 32, 0]) {
      const x = t.x - cos(a2) * off, y = t.y - sin(a2) * off;
      if (C().walk(R, x - 9, y - 9) && C().walk(R, x + 9, y - 9) && C().walk(R, x - 9, y + 9) && C().walk(R, x + 9, y + 9)) { R.p.x = x; R.p.y = y; ok = true; break; }
    }
    if (!ok) return false;
    const u = U(), V = u.st(R), c = col(), ds = D.DASH.assassin, cut = R.s.dashCd ? Math.max(.5, 1 - R.s.dashCd) : 1;
    V.sw = null; V.sq = [];
    u.add(V, { k: 'line', x1: ox, y1: oy, x2: R.p.x, y2: R.p.y, w: 10, life: .3, c });
    u.ring(V, ox, oy, 6, 46, .3, c, 4, true); u.ring(V, R.p.x, R.p.y, 6, 60, .32, '#ff5a5a', 4, true); u.flash(V, R.p.x, R.p.y, 36, .16, '#fff'); u.spark(V, R.p.x, R.p.y, 14, c, {});
    V.gh.push({ x: ox, y: oy, a: a2, life: .4, max: .4, c });
    R.dsT = ds.cd * cut; R.inv = Math.max(R.inv, .35); R.atkT = 0; R.dash = null; t.mark = 0;
    return true;
  };

  /* ===================== FIGHTER ===================== */
  PA.landed = function (R, n) { const a = R.pa; if (has('fighter', 2) && n > 0 && a.adr < K.adr.need) { a.adr++; if (a.adr >= K.adr.need) fl(R, R.p.x, R.p.y - 28, 'ADRENALINE PENUH!', '#ffd54a'); } };

  function slam(R, ang) {                      // AoE 2x luas, 100% crit, crit damage = 125% basic attack
    const u = U(), V = u.st(R), rng = (R.s.range + 12) * K.adr.area, c = '#ffd54a';
    V.sw = { k: 'smash', t: 0, dur: .4, ang, lunge: 16 };
    u.later(V, .24, () => {
      const x = R.p.x + cos(ang) * rng * .6, y = R.p.y + sin(ang) * rng * .6, h = u.inArc(R, ang, rng, 1.2);
      u.add(V, { k: 'arc', fol: 1, a: ang - .9, dir: 1, span: 3.2, r: rng + 16, th: 52, life: .4, sw: .3, c });
      u.ring(V, x, y, 10, rng * .9, .4, c, 8, true); u.ring(V, x, y, 4, rng * .5, .26, '#fff', 3, true); u.flash(V, x, y, 60, .18, c);
      u.spark(V, x, y, 20, '#fff2b0', { v0: 60, v1: 280 });
      h.forEach((m) => u.strike(R, m, K.adr.mul, { fc: true, cm: 1, kb: 20, n: 12, c }));
      V.shk = Math.max(V.shk, 8); if (h.length) u.hitstop(R, .07);
    });
  }
  function wrath(R, ang) {                     // Vanguard: gelombang kejut pendek, musuh kecil kocar-kacir
    const u = U(), V = u.st(R), c = col(), W = K.wrath;
    u.later(V, .14, () => {
      const ox = R.p.x, oy = R.p.y, ca = cos(ang), sa = sin(ang);
      u.add(V, { k: 'line', x1: ox + ca * 16, y1: oy + sa * 16, x2: ox + ca * W.len, y2: oy + sa * W.len, w: W.wid * .5, life: .28, c });
      u.ring(V, ox + ca * W.len * .6, oy + sa * W.len * .6, 8, 56, .3, c, 5, true);
      for (const m of R.mobs) {
        if (m.dead) continue; const dx = m.x - ox, dy = m.y - oy, al = dx * ca + dy * sa, pe = -dx * sa + dy * ca;
        if (al < 8 || al > W.len + m.r || Math.abs(pe) > W.wid / 2 + m.r) continue;
        u.strike(R, m, W.mul, { n: 5, c, ang });
        if (!m.dead && !m.isBoss) { const sc = ang + rnd(-.7, .7); for (let i = 0; i < 5; i++) C().move(R, m, cos(sc) * W.kb / 5, sin(sc) * W.kb / 5, m.r - 2); m.stun = W.stun; }
      }
    });
  }

  /* ===================== MAGE ===================== */
  PA.mageCast = function (R) {                 // dipanggil tiap lemparan wand; true = cast ke-4 (Overcharged)
    if (!has('mage', 2)) return false; const a = R.pa;
    if (++a.cast < K.arc.every) return false; a.cast = 0;
    if (R.skT > 0) R.skT = Math.max(0, R.skT - K.arc.skCut); R.atkT *= K.arc.atkCut;
    fl(R, R.p.x, R.p.y - 28, 'OVERCHARGED!', '#7fe9ff'); return true;
  };
  PA.ultReady = (R) => !!(R && R.pa && has('mage', 3) && R.pa.res >= K.res.need && R.skT <= 0 && !R.pa.ultLock);
  PA.ultHold = function (R, x, y) {            // dipanggil tiap frame selama Skill ditahan
    const a = R.pa; if (a.ultLock || (!a.bh && a.res < K.res.need)) return 'done';
    if (!a.bh) { a.bh = { x, y, t: 0, miss: 0 }; D.FX.buffFx(R, '#9b59b6'); D.Cine.on('ult', K.res.cine); D.Cine.flash('#9b59b6', .3); }   // cinematic: letterbox + vignette + zoom
    a.feed = true; a.bh.x = x; a.bh.y = y; return 'on';
  };
  PA.ultRelease = (R) => detonate(R);
  PA.ultCancel = (R) => { R.pa.bh = null; D.Cine.off('ult'); };
  function detonate(R) {
    const a = R.pa, b = a.bh; if (!b) return;
    D.Cine.off('ult'); D.Cine.flash('#fff', .35); D.Cine.invert(.15);
    a.bh = null; a.ultLock = true; a.res = 0; a.full = false; R.skT = 8;
    const grow = 1 + K.res.grow * Math.min(b.t, K.res.time), dmg = R.s.atk * (R.bf.atk.t > 0 ? R.bf.atk.m : 1) * PA.atkMul(R) * K.res.mul * grow, u = U(), V = u.st(R);   // 5x basic attack, true damage
    u.ring(V, b.x, b.y, 10, K.res.radius * 1.15, .45, '#b57edc', 9, true); u.ring(V, b.x, b.y, 4, K.res.radius * .6, .3, '#fff', 4, true);
    u.flash(V, b.x, b.y, K.res.radius * .9, .25, '#9b59b6'); u.spark(V, b.x, b.y, 34, '#d8b8ff', { v0: 80, v1: 340 });
    V.shk = Math.max(V.shk, 10); let n = 0;
    for (const m of R.mobs.slice()) if (!m.dead && hyp(m.x - b.x, m.y - b.y) < K.res.radius + m.r) { C().trueHit(m, dmg); n++; }
    if (n) u.hitstop(R, .08);
    if (has('mage', 4)) { a.post = K.astral.t; fl(R, R.p.x, R.p.y - 28, 'ASTRAL +10% DMG', '#d79cff'); }
  }

  /* ===================== ARCHER ===================== */
  PA.multi = () => has('archer', 3) && Math.random() < K.multi.chance;

  /* ===================== ATTACK HOOKS (combatfx.js) ===================== */
  PA.overrideAttack = function (R, ang) {
    const a = R.pa;
    if (has('assassin', 2) && a.armed && PA.dashStrike(R, ang)) return true;
    if (has('fighter', 2) && a.adr >= K.adr.need) { a.adr = 0; slam(R, ang); return true; }
    return false;
  };
  PA.afterAttack = function (R, ang) {
    const a = R.pa, wt = (D.ITEMS[D.state.equipment.weapon] || {}).wtype;
    if (has('assassin', 2) && a.stealth > 0) a.stealth = 0;
    if (has('archer', 2) && !R.dash && hyp(D.input.dx, D.input.dy) <= .12) a.focus = Math.min(K.eagle.max, a.focus + 1);
    if (has('fighter', 4) && (!K.wrath.heavyOnly || wt === 'heavy')) wrath(R, ang);
  };

  /* ===================== HUD / DRAW ===================== */
  PA.hud = function (R) {
    const a = R.pa; if (!a) return ''; const o = [], r = D.state.role, t = D.state.tier;
    if (r === 'assassin') {
      if (t >= 2) o.push(a.armed ? '⚡ Dash Strike SIAP' : `🗡 Momentum ${a.stk}/${K.mom.need}`);
      if (a.stealth > 0) o.push(`👤 Stealth ${a.stealth.toFixed(1)}s`);
      if (t >= 3) { const n = R.mobs.filter((m) => !m.dead && m.mark > 0).length; if (n) o.push(`☠ Mark ×${n} (Dash = teleport)`); }
      if (t >= 4) o.push(a.form > 0 ? `🌑 Aethel ${a.form.toFixed(1)}s` : a.aeCd > 0 ? `Aethel CD ${Math.ceil(a.aeCd)}s` : 'Aethel siap');
    } else if (r === 'fighter') {
      if (t >= 2) o.push(a.adr >= K.adr.need ? '🔥 Adrenaline PENUH (serangan AoE)' : `🔥 Adrenaline ${a.adr}/${K.adr.need}`);
      if (t >= 3) o.push(`🛡 Juggernaut +${Math.round(K.jug.per * a.jug * 100)}% DEF` + (a.jug >= K.jug.max ? ` (${Math.ceil(Math.max(0, a.jugT))}s)` : ''));
    } else if (r === 'mage') {
      if (t >= 2) o.push(a.cast === K.arc.every - 1 ? '✨ Overcharge SIAP' : `✨ Cast ${a.cast}/${K.arc.every}`);
      if (t >= 3) o.push(a.bh ? `🕳 Black Hole ${Math.max(0, K.res.time - a.bh.t).toFixed(1)}s` : PA.ultReady(R) ? '🌌 ULTIMATE siap (tahan Skill)' : `🔮 Resonance ${a.res}/${K.res.need}`);
      if (t >= 4 && a.post > 0) o.push(`🌠 Astral ${Math.ceil(a.post)}s`);
    } else if (r === 'tank') {
      if (t >= 2) o.push(a.barrier > 0 ? `🧱 Barrier ${a.barrier} hit` : `🧱 Hit ${a.hits}/${K.bulw.hits}`);
      if (t >= 4) o.push(PA.ccImmune(R) ? '🏰 Fortress aktif' : '🏰 Fortress mati (HP ≤50%)');
    } else if (r === 'archer') {
      if (t >= 2) o.push(`🎯 Focus ${a.focus}/${K.eagle.max} (+${a.focus}% crit)`);
      if (t >= 4 && a.gale > 0) o.push(`💨 Gale ${a.gale.toFixed(1)}s`);
    }
    return o.join(' · ');
  };

  PA.draw = function (ctx, R, cx, cy) {
    const a = R.pa; if (!a) return; const t = R.t, px = R.p.x - cx, py = R.p.y - cy;
    ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const m of R.mobs) if (!m.dead && m.mark > 0) {           // ☠ Death Mark
      const X = m.x - cx, Y = m.y - cy;
      ctx.save(); ctx.shadowColor = '#f33'; ctx.shadowBlur = 10; ctx.font = '16px serif'; ctx.fillText('☠', X, Y - (m.isBoss ? 38 : 26) + sin(t * 6) * 2);
      ctx.strokeStyle = 'rgba(255,60,60,.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, m.r + 5 + sin(t * 8), 0, PI2); ctx.stroke(); ctx.restore();
    }
    for (const o of a.orbs) {                                        // orb mana resonance
      const X = o.x - cx, Y = o.y - cy, g = ctx.createRadialGradient(X, Y, 0, X, Y, 9);
      g.addColorStop(0, '#fff'); g.addColorStop(.4, '#7fe9ff'); g.addColorStop(1, 'rgba(120,80,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, 9, 0, PI2); ctx.fill();
    }
    const b = a.bh;
    if (b) {                                                         // black hole
      const X = b.x - cx, Y = b.y - cy, r0 = K.res.radius, pu = 1 + .06 * sin(t * 10);
      ctx.save(); ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30; ctx.strokeStyle = 'rgba(190,130,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X, Y, r0, 0, PI2); ctx.stroke(); ctx.restore();
      const g = ctx.createRadialGradient(X, Y, 0, X, Y, r0 * .55 * pu); g.addColorStop(0, '#000'); g.addColorStop(.55, 'rgba(10,0,25,.95)'); g.addColorStop(1, 'rgba(120,60,200,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, r0 * .55 * pu, 0, PI2); ctx.fill();
      ctx.lineWidth = 3; for (let i = 0; i < 3; i++) { const a0 = t * (3 + i) * (i % 2 ? -1 : 1); ctx.strokeStyle = i % 2 ? '#6fe0ff' : '#c9a0ff'; ctx.beginPath(); ctx.arc(X, Y, r0 * (.25 + .12 * i), a0, a0 + PI * 1.2); ctx.stroke(); }
      ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif'; ctx.fillText(Math.max(0, K.res.time - b.t).toFixed(1) + 's  ·  ledakan ×' + (1 + K.res.grow * Math.min(b.t, K.res.time)).toFixed(2), X, Y - r0 - 10);
    }
    if (a.form > 0) { ctx.strokeStyle = 'rgba(140,100,255,.9)'; ctx.lineWidth = 3; ctx.shadowColor = '#7a5cff'; ctx.shadowBlur = 14; ctx.beginPath(); ctx.ellipse(px, py + 8, 20 + sin(t * 12) * 2, 11, 0, 0, PI2); ctx.stroke(); }
    if (has('tank', 4) && PA.ccImmune(R)) { ctx.strokeStyle = 'rgba(120,180,240,.5)'; ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.lineDashOffset = -t * 20; ctx.beginPath(); ctx.arc(px, py, 24, 0, PI2); ctx.stroke(); }
    ctx.restore();
  };

  /* ===================== INFO (Rank Hall) ===================== */
  const INFO = {
    assassin: {
      2: { n: 'Momentum Lethal', d: 'Tiap kill = 1 stack. Stack ke-5: Stealth singkat, Basic Attack berikutnya jadi Long-Range Dash Strike dengan crit pasti.' },
      3: { n: 'Death Mark Echo', d: 'Musuh yang kena Dash Strike diberi Mark ☠. Saat Dash, kamu langsung teleport ke musuh bertanda.' },
      4: { n: 'Aethel Shift', d: 'HP di bawah 25%: wujud bayangan 4 detik (kebal damage, serangan true damage + serap HP musuh). Cooldown 120 detik.' }
    },
    fighter: {
      2: { n: 'Adrenaline Flow', d: 'Tiap melee kena = +1 Adrenaline. Penuh (20): serangan berikutnya AoE area 2x, 100% crit, damage 125% basic attack.' },
      3: { n: 'Unstoppable Juggernaut', d: 'Tiap pakai skill +2% DEF (maks 20%). Di maks, 10 detik tanpa skill = reset ke 0.' },
      4: { n: 'Wrath of the Titan', d: 'Tiap tebasan memicu gelombang kejut pendek yang menyapu musuh di depan dan membuat monster kecil kocar-kacir.' }
    },
    mage: {
      2: { n: 'Arcane Resonance', d: 'Tiap 3 lemparan wand, mantra ke-4 jadi Overcharged: ledakan lebih luas & cooldown berkurang instan.' },
      3: { n: 'Magis Resonance', d: 'Musuh mati drop mana. Di 50, Skill jadi Ultimate: tahan untuk black hole di arah mouse (kamu diam), meledak 5x damage true setelah 10 detik / dilepas. Makin lama ditahan makin sakit (+5% damage ledakan tiap detik). Ada letterbox & vignette sinematik.' },
      4: { n: 'Astral Convergence', d: 'Saat Ultimate aktif damage diterima -50%. Setelah meledak: damage +10% & speed +5% selama 30 detik.' }
    },
    tank: {
      2: { n: 'Bulwark Barrier', d: 'Setelah kena hit 20x, damage diterima -50% untuk 5 serangan berikutnya.' },
      3: { n: 'Vengeful Aegis', d: '30% damage yang diterima dibalikkan sebagai counter-damage cahaya ke musuh terdekat.' },
      4: { n: 'Immovable Fortress', d: 'HP di atas 50%: kebal knockback/CC. Skill mentaunt semua musuh di dungeon & memberi Weakness (damage diterima musuh 1.5x).' }
    },
    archer: {
      2: { n: 'Eagle Eye Focus', d: 'Menembak sambil diam menambah stack (+1% crit rate, maks 20%). Bergerak mereset stack.' },
      3: { n: 'Multi-Shot Volley', d: 'Tiap tembakan punya peluang 10% berlipat jadi 3 anak panah.' },
      4: { n: 'Gale Step', d: 'Tiap critical hit: kecepatan gerak naik drastis 2 detik dan dash 10% lebih jauh.' }
    }
  };
  PA.INFO = INFO;
  PA.html = function (p) {
    const L = INFO[p.role]; if (!L) return '';
    return '<div class="card" style="margin:8px 0"><h3>✨ Pasif Rank</h3>' + [2, 3, 4].map((t) => { const on = p.tier >= t, it = L[t];
      return `<div class="row" style="${on ? '' : 'opacity:.55'}"><span>${on ? '✔' : '🔒'}</span><span class="nm"><b>${it.n}</b> <span class="dim">(${D.TIER_NAMES[p.role][t - 1]})</span><br><span class="dim">${it.d}</span></span></div>`; }).join('') + '</div>';
  };
})(window.DSB);
