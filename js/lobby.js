/* lobby.js — Lobby yang bisa dijelajahi: NPC (Toko, Pekerjaan, Rank Hall), Portal Dungeon, data dialog visual novel, kursor penanda arah */
(function (D) {
  const PI2 = Math.PI * 2;

  /* ---------- helper umum (dipakai juga oleh dungeon di game.js) ---------- */
  D.turnAngle = (f, t, k) => { const d = (((t - f + Math.PI) % PI2) + PI2) % PI2 - Math.PI; return f + d * Math.min(1, k); };
  /* Karakter = kursor mouse. Ujung runcing = arah hadap. */
  D.drawCursor = function (ctx, x, y, ang, color) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 10, 12, 5, 0, 0, PI2); ctx.fill();
    ctx.translate(x, y); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-9, -11); ctx.lineTo(-3, 0); ctx.lineTo(-9, 11); ctx.closePath();
    ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  };

  /* ---------- NPC + dialog ----------
     Node dialog: { t: teks | fn(player) , ch:[{t, n:'node'} | {t, go:'layar'} | {t, end:true}], next:'node' }
     - punya ch  → tampil pilihan ganda
     - tanpa ch  → klik lanjut ke `next`, atau tutup bila tidak ada next */
  D.NPCS = {
    shop: {
      id: 'shop', name: 'Bram', title: 'Pedagang', icon: '🧔', color: '#e8b94a', x: 150, y: 190, start: 'hi',
      nodes: {
        hi: { t: (p) => `Selamat datang, ${D.tierName(p)}! Semua barang di sini dibeli langsung. Tanpa gacha, tanpa pity. Mau lihat apa?`,
              ch: [{ t: '🛒 Lihat dagangan', go: 'shop' }, { t: 'Kenapa nggak ada gacha?', n: 'gacha' }, { t: 'Gimana cara dapat Gold?', n: 'gold' }, { t: 'Nanti saja.', end: true }] },
        gacha: { t: 'Aku pedagang jujur. Harga di papan itulah yang kamu bayar. Mau barang langka? Hajar boss dungeon, atau beli Unique Item langsung dari tokoku.', next: 'hi' },
        gold: { t: 'Kerjakan pekerjaan di tempat Mandor Rena, lalu jual hasilnya padaku lewat tab Jual Bahan. Bahan dari dungeon harganya jauh lebih mahal.', next: 'hi' }
      }
    },
    jobs: {
      id: 'jobs', name: 'Rena', title: 'Mandor', icon: '👷', color: '#5aa0d8', x: 480, y: 190, start: 'hi',
      nodes: {
        hi: { t: (p) => `Hei, ${D.ROLES[p.role].label}! Butuh Gold? Ada kerjaan buat siapa saja: bantai monster, berburu babi, bertani, atau menambang.`,
              ch: [{ t: '⛏ Lihat pekerjaan', go: 'jobs' }, { t: 'Kerjaan mana yang cocok buatku?', n: 'rec' }, { t: 'Nanti saja.', end: true }] },
        rec: { t: (p) => p.level < 5 ? 'Masih baru? Ambil Farming atau Mining dulu, aman dan nggak ada yang menggigit. Kalau sudah berani, coba Slayer di Goa.'
                       : p.level < 15 ? 'Slayer di Goa itu stabil buat Gold dan bahan. Babi Liar bagus kalau kamu butuh Daging dan Taring.'
                       : 'Di levelmu, Slayer masih yang paling cepat buat Gold. Tapi bahan dari dungeon lebih berharga, kamu pasti sudah tahu.', next: 'hi' }
      }
    },
    train: {
      id: 'train', name: 'Dorn', title: 'Instruktur', icon: '🥋', color: '#ff8a4a', x: 200, y: 370, start: 'hi',
      nodes: {
        hi: { t: (p) => `Mau menguji kekuatan ${D.tierName(p)}-mu? Di Training Room tidak ada yang menyerang balik. Pukul dummy sepuasnya dan lihat DPS-mu.`,
              ch: [{ t: '🎯 Masuk Training Room', go: 'train' }, { t: 'Apa saja yang bisa dites?', n: 'info' }, { t: 'Nanti saja.', end: true }] },
        info: { t: 'Ada dummy DEF 0, 30, dan 80, plus satu dummy yang bergerak buat ngetes proyektil. Panel statistik mencatat total damage, DPS, crit rate, dan hit terbesar. Combo-nya reset kalau 5 detik tidak kena apa-apa.', next: 'hi' }
      }
    },
    rank: {
      id: 'rank', name: 'Gareth', title: 'Penjaga Rank Hall', icon: '🎖️', color: '#b57edc', x: 810, y: 190, start: 'hi',
      nodes: {
        hi: { t: (p) => { const i = D.advanceInfo(p); return i ? `Rank-mu sekarang ${D.tierName(p)}. Menuju ${i.name}, kamu harus membuktikan diri dulu.` : `Rank-mu ${D.tierName(p)}, puncak tertinggi. Hormatku.`; },
              ch: [{ t: '👑 Buka Rank Hall', go: 'rank' }, { t: 'Apa syarat naik rank?', n: 'req' }, { t: 'Nanti saja.', end: true }] },
        req: { t: (p) => { const i = D.advanceInfo(p); return i ? 'Syaratmu:\n' + i.checks.map(c => (c.ok ? '✔ ' : '✖ ') + c.label).join('\n') : 'Tidak ada lagi yang perlu kamu buktikan.'; }, next: 'hi' }
      }
    }
  };

  /* ---------- peta ---------- */
  const BUILD = [
    { id: 'shop', x: 70, y: 56, w: 160, h: 96, roof: '#b5532f', label: 'TOKO' },
    { id: 'jobs', x: 400, y: 56, w: 160, h: 96, roof: '#3f7aa8', label: 'PEKERJAAN' },
    { id: 'rank', x: 730, y: 56, w: 160, h: 96, roof: '#7a4fa8', label: 'RANK HALL' }
  ];
  const TREES = [[40, 300], [40, 420], [100, 500], [250, 470], [380, 330], [640, 330], [600, 490], [930, 300], [930, 500], [905, 250]];
  const PATHS = [{ x: 32, y: 160, w: 896, h: 64 }, { x: 800, y: 224, w: 64, h: 128 }];
  const PORTAL = { x: 835, y: 400, r: 44 };
  const L = (D.Lobby = { p: { x: 480, y: 420, face: Math.PI / 2, t: Math.PI / 2 } });
  const NP = Object.values(D.NPCS);

  function blocked(x, y) {
    const r = 9;
    if (x - r < 20 || x + r > 940 || y - r < 68 || y + r > 522) return true;
    for (const b of BUILD) if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return true;
    for (const n of NP) if (Math.hypot(x - n.x, y - n.y) < r + 14) return true;
    for (const [tx, ty] of TREES) if (Math.hypot(x - tx, y - ty) < r + 12) return true;
    return false;
  }

  L.update = function (dt, inp, spd) {
    let { dx, dy } = inp; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    const s = spd * 60 * dt, p = L.p;
    if (!blocked(p.x + dx * s, p.y)) p.x += dx * s;
    if (!blocked(p.x, p.y + dy * s)) p.y += dy * s;
    if (l > .12) p.t = Math.atan2(dy, dx);
    p.face = D.turnAngle(p.face, p.t, dt * 16);
  };

  /* target interaksi terdekat: NPC atau Portal */
  L.near = function () {
    const p = L.p; let best = null, bd = 62;
    for (const n of NP) { const d = Math.hypot(p.x - n.x, p.y - n.y); if (d < bd) { bd = d; best = { type: 'npc', id: n.id, x: n.x, y: n.y - 54, text: `E · Bicara dengan ${n.name}` }; } }
    const dp = Math.hypot(p.x - PORTAL.x, p.y - PORTAL.y);
    if (dp < PORTAL.r + 22 && !best) best = { type: 'portal', x: PORTAL.x, y: PORTAL.y - 78, text: 'E · Masuk Portal Dungeon' };
    return best;
  };

  /* ---------- gambar ---------- */
  const FONT = '"Trebuchet MS","Segoe UI",sans-serif';
  function plate(ctx, text, x, y, bg, fg) {
    ctx.font = `bold 12px ${FONT}`; const w = ctx.measureText(text).width + 14;
    ctx.fillStyle = bg || 'rgba(0,0,0,.7)'; ctx.fillRect(x - w / 2, y - 10, w, 20);
    ctx.fillStyle = fg || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y + 1);
  }
  function building(ctx, b) {
    ctx.fillStyle = '#6b5a45'; ctx.fillRect(b.x, b.y + 30, b.w, b.h - 30);
    ctx.fillStyle = '#54463a'; ctx.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    ctx.fillStyle = '#5c4d3b'; for (let i = 1; i < 5; i++) ctx.fillRect(b.x + i * b.w / 5, b.y + 34, 2, b.h - 42);
    ctx.fillStyle = b.roof; ctx.beginPath(); ctx.moveTo(b.x - 10, b.y + 38); ctx.lineTo(b.x + b.w + 10, b.y + 38); ctx.lineTo(b.x + b.w - 14, b.y); ctx.lineTo(b.x + 14, b.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(b.x - 10, b.y + 34, b.w + 20, 4);
    ctx.fillStyle = '#2f241a'; ctx.fillRect(b.x + b.w / 2 - 18, b.y + b.h - 44, 36, 44);
    plate(ctx, b.label, b.x + b.w / 2, b.y + 56, '#3a2c1e', '#e8b94a');
  }
  function portal(ctx, t) {
    const { x, y } = PORTAL;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#4a4f58'; ctx.beginPath(); ctx.ellipse(0, 28, 56, 20, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = '#5d636d'; ctx.beginPath(); ctx.ellipse(0, 25, 46, 15, 0, 0, PI2); ctx.fill();
    ctx.fillStyle = 'rgba(110,70,255,.35)'; ctx.beginPath(); ctx.ellipse(0, -8, 26, 40, 0, 0, PI2); ctx.fill();
    ctx.shadowColor = '#8a5cff'; ctx.shadowBlur = 22; ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const a0 = t * (1.4 + i * .35) * (i % 2 ? -1 : 1);
      ctx.strokeStyle = i % 2 ? '#6fe0ff' : '#b08aff';
      ctx.beginPath(); ctx.ellipse(0, -8, 24 + i * 4 + Math.sin(t * 2 + i) * 2, 38 + i * 3, 0, a0, a0 + Math.PI * 1.3); ctx.stroke();
    }
    ctx.restore();
    plate(ctx, 'Portal Dungeon', x, y + 62, 'rgba(40,20,80,.85)', '#d8c8ff');
  }

  L.draw = function (ctx, t, color, showPrompt) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let y = 0; y < 17; y++) for (let x = 0; x < 30; x++) { ctx.fillStyle = (x + y) & 1 ? '#3f6a2c' : '#3b6528'; ctx.fillRect(x * 32, y * 32, 32, 32); }
    for (const r of PATHS) for (let y = r.y; y < r.y + r.h; y += 32) for (let x = r.x; x < r.x + r.w; x += 32) { ctx.fillStyle = ((x + y) >> 5) & 1 ? '#8f8a78' : '#858070'; ctx.fillRect(x, y, 32, 32); }
    ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(0, 0, 960, 4);
    BUILD.forEach(b => building(ctx, b));
    portal(ctx, t);
    // entitas diurutkan berdasarkan y agar tumpang-tindih terlihat benar
    const ents = TREES.map(([x, y]) => ({ y, d: () => { ctx.font = '40px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🌳', x, y - 10); } }));
    NP.forEach(n => ents.push({ y: n.y, d: () => {
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(n.x, n.y + 14, 14, 5, 0, 0, PI2); ctx.fill();
      ctx.font = '36px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(n.icon, n.x, n.y + Math.sin(t * 2 + n.x) * 1.5);
      plate(ctx, n.name, n.x, n.y - 30, 'rgba(0,0,0,.65)', n.color);
    } }));
    ents.push({ y: 372, d: () => { ctx.font = '30px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🎯', 250, 372); } });   // dummy hias di dekat Dorn
    ents.push({ y: L.p.y, d: () => D.drawCursor(ctx, L.p.x, L.p.y, L.p.face, color) });
    ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    if (showPrompt) { const n = L.near(); if (n) { const bob = Math.sin(t * 5) * 2; plate(ctx, n.text, n.x, n.y + bob, 'rgba(232,185,74,.95)', '#1a1a12'); } }
  };
})(window.DSB);
