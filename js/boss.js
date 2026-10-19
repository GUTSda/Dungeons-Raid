/* boss.js — AI boss BERTELEGRAF. Semua boss (dungeon, trial, Soul Trial) menyerang lewat indikator merah ala skill player:
   garis putus-putus = batas area, isian bertambah = waktu sampai kena. Keluar area / Dash (i-frame) sebelum penuh = aman.
   Pola berurutan (bukan acak) + jeda antar serangan, jadi bisa dihafal. Tambah pola baru = tambah fungsi di D.BOSS_PATTERNS. */
(function (D) {
  const PI = Math.PI, PI2 = PI * 2, cos = Math.cos, sin = Math.sin, atan2 = Math.atan2, hyp = Math.hypot;
  const adiff = (a, b) => (((a - b + PI) % PI2) + PI2) % PI2 - PI;
  const C = () => D._c, RED = '#ff5a4a';
  const W = (m, b) => b * (m.hp < m.max * .5 ? .85 : 1);          // fase 2 (<50% HP): telegraf 15% lebih singkat
  const ang = (R, m) => atan2(R.p.y - m.y, R.p.x - m.x);

  /* ---- pembuat indikator. shape: circle | cone | line | ring(donut) | pulse(hanya penanda) ---- */
  const tele = (R, m, o) => R.tele.push(Object.assign({ t: 0, wind: 1, dmg: 1, src: m, c: RED }, o));
  const circ = (R, m, x, y, r, wind, dmg, go) => tele(R, m, { shape: 'circle', x, y, r, wind: W(m, wind), dmg, go });
  const cone = (R, m, a, r, span, wind, dmg, go) => { m.face = a; tele(R, m, { shape: 'cone', x: m.x, y: m.y, a, r, span, wind: W(m, wind), dmg, go }); };
  const line = (R, m, a, len, w, wind, dmg, go) => { m.face = a; tele(R, m, { shape: 'line', x: m.x, y: m.y, a, len, w, wind: W(m, wind), dmg, go }); };
  const donut = (R, m, r0, r1, wind, dmg) => tele(R, m, { shape: 'ring', x: m.x, y: m.y, r0, r1, wind: W(m, wind), dmg });
  const pulse = (R, m, r, wind, go) => tele(R, m, { shape: 'pulse', x: m.x, y: m.y, r, wind: W(m, wind), dmg: 0, go });

  /* ---- gerakan boss saat serangan mendarat ---- */
  const dashTo = (R, m, a, len) => () => { for (let d = 0; d < len; d += 8) { const bx = m.x, by = m.y; C().move(R, m, cos(a) * 8, sin(a) * 8, m.r - 2); if (m.x === bx && m.y === by) break; } };
  const blink = (R, m, x, y) => () => {
    for (const f of [1, .75, .5, .25]) { const tx = m.x + (x - m.x) * f, ty = m.y + (y - m.y) * f;
      if (C().walk(R, tx, ty) && C().walk(R, tx + 10, ty) && C().walk(R, tx - 10, ty) && C().walk(R, tx, ty + 10) && C().walk(R, tx, ty - 10)) { m.x = tx; m.y = ty; return; } }
  };
  const bullets = (R, m) => () => { const n = m.hp < m.max * .5 ? 14 : 10; for (let i = 0; i < n; i++) { const a = i / n * PI2 + R.t; R.proj.push({ x: m.x, y: m.y, vx: cos(a) * 130, vy: sin(a) * 130, dmg: m.atk * .7, life: 4 }); } };
  const ringPat = (R, m, S) => { S(0, () => pulse(R, m, 80, 1.0, bullets(R, m))); return 1.5; };   // peluru melingkar (dulu tanpa peringatan)

  /* ---- pola. Tiap fungsi: (R, m, S) → S(detik, aksi) lalu return total durasi ---- */
  const at = (R, m) => ang(R, m), pp = (R) => R.p;
  const P = D.BOSS_PATTERNS = {
    /* Soul Trial: meniru serangan basic & skill player per role */
    soul_fighter: [
      (R, m, S) => { for (const t of [0, 1.05]) S(t, () => { const a = at(R, m); cone(R, m, a, 80, 1.0, .85, 1, dashTo(R, m, a, 20)); }); return 2.3; },        // tebasan kiri-kanan
      (R, m, S) => { S(0, () => { const x = pp(R).x, y = pp(R).y; circ(R, m, x, y, 82, 1.1, 2.2, blink(R, m, x, y)); }); return 1.7; },                       // skill: Slam (leap)
      (R, m, S) => { S(0, () => { const a = at(R, m); cone(R, m, a, 96, 1.1, 1.05, 1.6, dashTo(R, m, a, 26)); });                                              // overhead smash + shockwave
                     S(1.2, () => { const a = m.face; circ(R, m, m.x + cos(a) * 70, m.y + sin(a) * 70, 70, .7, 1.2); }); return 2.2; }
    ],
    soul_mage: [
      (R, m, S) => { for (const t of [0, 1.1]) S(t, () => line(R, m, at(R, m), 400, 30, .9, 1.2)); return 2.3; },                                              // orb
      (R, m, S) => { for (let i = 0; i < 3; i++) S(i * .8, () => circ(R, m, pp(R).x, pp(R).y, 72, .95, 1.8)); return 3.4; },                                     // ledakan area
      (R, m, S) => { S(0, () => circ(R, m, pp(R).x, pp(R).y, 125, 1.4, 2.6)); return 2.0; }                                                                    // skill: Arcane Blast
    ],
    soul_tank: [
      (R, m, S) => { for (const t of [0, 1.0]) S(t, () => { const a = at(R, m); cone(R, m, a, 66, .95, .8, 1, dashTo(R, m, a, 14)); }); return 2.1; },
      (R, m, S) => { S(0, () => { const a = at(R, m); line(R, m, a, 125, 36, .8, 1.2, dashTo(R, m, a, 30)); });                                                // tusukan lalu shield bash
                     S(1.0, () => { const a = m.face; circ(R, m, m.x + cos(a) * 70, m.y + sin(a) * 70, 72, .95, 1.5); }); return 2.3; },
      (R, m, S) => { S(0, () => circ(R, m, m.x, m.y, 88, 1.1, 1.8)); return 1.7; }                                                                             // skill: Bulwark
    ],
    soul_archer: [
      (R, m, S) => { for (const t of [0, 1.0]) S(t, () => line(R, m, at(R, m), 440, 22, .85, 1.1)); return 2.2; },                                             // panah
      (R, m, S) => { S(0, () => { const a = at(R, m); for (const k of [-.3, 0, .3]) line(R, m, a + k, 420, 22, 1.0, 1); }); return 1.6; },                       // 3 panah menyebar
      (R, m, S) => { for (let i = 0; i < 5; i++) S(i * .3, () => { const a = i * PI2 / 5 + R.t; circ(R, m, pp(R).x + cos(a) * 90, pp(R).y + sin(a) * 90, 95, 1.0, 1.3); }); return 3.0; },   // skill: Volley
      (R, m, S) => { S(0, () => line(R, m, at(R, m), 460, 38, 1.2, 2)); return 1.8; }                                                                          // panah tembus
    ],
    soul_assassin: [
      (R, m, S) => { S(0, () => { const a = at(R, m), L = Math.min(260, hyp(R.p.x - m.x, R.p.y - m.y) + 60); line(R, m, a, L, 44, .8, 1.3, dashTo(R, m, a, L)); });
                     S(1.0, () => cone(R, m, at(R, m), 72, 1.0, .7, 1.3)); return 1.9; },
      (R, m, S) => { for (let i = 0; i < 3; i++) S(i * .65, () => { const x = pp(R).x, y = pp(R).y; circ(R, m, x, y, 66, .75, 1.2, blink(R, m, x, y)); }); return 2.8; },   // tebasan beruntun
      (R, m, S) => { S(0, () => { const x = pp(R).x, y = pp(R).y; circ(R, m, x, y, 76, 1.0, 2.0, blink(R, m, x, y)); }); return 1.5; }                         // skill: Shadow Dash
    ],
    /* Boss dungeon */
    golem: [
      (R, m, S) => { S(0, () => circ(R, m, m.x, m.y, 95, 1.0, 1.5)); return 1.6; },
      (R, m, S) => { S(0, () => cone(R, m, at(R, m), 150, .8, 1.1, 1.8)); return 1.7; },
      (R, m, S) => { for (let i = 0; i < 3; i++) S(i * .7, () => circ(R, m, pp(R).x, pp(R).y, 62, 1.0, 1.3)); return 3.0; },
      (R, m, S) => { S(0, () => donut(R, m, 70, 155, 1.3, 1.6)); return 1.9; }                      // aman di tengah atau di luar cincin
    ],
    lich: [
      (R, m, S) => { S(0, () => { const a = at(R, m); for (const k of [-.35, 0, .35]) line(R, m, a + k, 400, 26, 1.0, 1); }); return 1.6; },
      (R, m, S) => { for (let i = 0; i < 4; i++) S(i * .4, () => circ(R, m, pp(R).x + (Math.random() - .5) * 100, pp(R).y + (Math.random() - .5) * 100, 66, 1.1, 1.2)); return 3.0; },
      ringPat
    ],
    warlord: [
      (R, m, S) => { S(0, () => { const a = at(R, m); line(R, m, a, 300, 46, 1.0, 1.8, dashTo(R, m, a, 300)); }); return 1.6; },
      (R, m, S) => { S(0, () => cone(R, m, at(R, m), 135, 1.5, 1.1, 1.5)); return 1.7; },
      (R, m, S) => { S(0, () => circ(R, m, pp(R).x, pp(R).y, 105, 1.1, 1.7)); S(.7, () => circ(R, m, pp(R).x, pp(R).y, 105, 1.1, 1.7)); return 2.3; },
      ringPat
    ]
  };
  const KEEP = { soul_fighter: 60, soul_tank: 60, soul_assassin: 55, soul_mage: 200, soul_archer: 230, golem: 70, lich: 190, warlord: 70 };
  const list = (m) => [].concat(m.pat).reduce((a, k) => a.concat(P[k] || []), []);

  /* ---- geometri kena-tidak ---- */
  function inside(o, p) {
    const dx = p.x - o.x, dy = p.y - o.y, d = hyp(dx, dy), pr = 9;
    if (o.shape === 'circle') return d < o.r + pr;
    if (o.shape === 'cone') return d < o.r + pr && (d < 14 || Math.abs(adiff(atan2(dy, dx), o.a)) < o.span + pr / Math.max(d, 1));
    if (o.shape === 'line') { const al = dx * cos(o.a) + dy * sin(o.a), pe = Math.abs(-dx * sin(o.a) + dy * cos(o.a)); return al > -pr && al < o.len + pr && pe < o.w / 2 + pr; }
    if (o.shape === 'ring') return d + pr > o.r0 && d - pr < o.r1;
    return false;
  }
  function resolve(R, o) {
    const m = o.src; if (m.dead) return;
    if (o.go) o.go();
    const fx = (f) => R.fx.push(Object.assign({ life: .3, c: '#ff6a5a' }, f));
    if (o.shape === 'line') fx({ x1: o.x, y1: o.y, x2: o.x + cos(o.a) * o.len, y2: o.y + sin(o.a) * o.len, life: .2 });
    else if (o.shape === 'cone') { fx({ x1: o.x, y1: o.y, x2: o.x + cos(o.a) * o.r, y2: o.y + sin(o.a) * o.r, life: .2 }); fx({ x: o.x + cos(o.a) * o.r * .6, y: o.y + sin(o.a) * o.r * .6, rad: 1 }); }
    else if (o.shape !== 'pulse') fx({ x: o.x, y: o.y, rad: 1 });
    if (o.dmg > 0 && R.v) R.v.shk = Math.max(R.v.shk || 0, o.dmg > 1.5 ? 7 : 4);
    if (o.dmg > 0 && inside(o, R.p)) C().hurt(m.atk * o.dmg, m);
  }

  D.Boss = {
    tick(R, dt) {
      if (!R.tele || !R.tele.length) return; const keep = [];
      for (const o of R.tele) { o.t += dt; if (o.t < o.wind) keep.push(o); else resolve(R, o); }
      R.tele = keep;
    },
    update(R, m, dt, d) {
      if (m.pi === undefined) m.pi = 0;                       // indeks pola: harus selalu ada, termasuk saat boss belum engaged
      if (!m.eng) { m.seq = null; m.cdT = 1.5; return; }
      if (m.cdT === undefined) m.cdT = 1.5;
      if (m.seq) {
        const q = m.seq; q.t += dt; while (q.q.length && q.q[0].t <= q.t) q.q.shift().fn();
        if (q.t >= q.dur) { m.seq = null; m.cdT = m.hp < m.max * .5 ? .9 : 1.4; }
        return;
      }
      m.face = D.turnAngle(m.face || 0, ang(R, m), dt * 8);
      const keep = KEEP[[].concat(m.pat)[0]] || 60, spd = m.spd * (m.slow > 0 ? .55 : 1);
      if (d > keep + 18) D.MobAI.approach(R, m, dt, spd); else if (keep > 120 && d < keep - 60) D.MobAI.retreat(R, m, dt, spd);   // pathfinding (js/mobai.js)
      m.cdT -= dt; if (m.cdT > 0) return;
      const L = list(m); if (!L.length) return;
      const q = [], dur = L[m.pi++ % L.length](R, m, (t, fn) => q.push({ t, fn })); q.sort((a, b) => a.t - b.t); m.seq = { t: 0, q, dur };
    },
    reset(R) { R.tele = []; if (R.boss) { R.boss.seq = null; R.boss.cdT = 1.5; } }
  };
})(window.DSB);
