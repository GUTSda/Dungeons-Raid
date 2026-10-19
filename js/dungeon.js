/* dungeon.js — engine eksplorasi, boss arena, penalty drop 50% kumulatif, mode job (Slayer/Boar) & Trial */
(function (D) {
  const T = 32;
  D.T = T;
  D.input = { dx: 0, dy: 0 };

  D.MOBS = {
    slime: { n: 'Slime', i: '🟢', hp: 28, atk: 5, def: 0, spd: .9, exp: 7, gold: [1, 4], drops: { slime: .6 } },
    bat: { n: 'Kelelawar', i: '🦇', hp: 20, atk: 6, def: 0, spd: 1.7, exp: 8, gold: [1, 4], drops: { bone: .2 } },
    skeleton: { n: 'Skeleton', i: '💀', hp: 40, atk: 8, def: 2, spd: 1.1, exp: 12, gold: [3, 7], drops: { bone: .7, stone: .3 } },
    zombie: { n: 'Zombie', i: '🧟', hp: 90, atk: 14, def: 4, spd: .8, exp: 24, gold: [6, 12], drops: { bone: .6, iron: .2 } },
    wraith: { n: 'Wraith', i: '👻', hp: 70, atk: 18, def: 2, spd: 1.5, exp: 28, gold: [7, 14], drops: { iron: .3, slime: .3 } },
    imp: { n: 'Imp', i: '😈', hp: 150, atk: 26, def: 6, spd: 1.5, exp: 48, gold: [12, 24], drops: { ember: .35 } },
    magma: { n: 'Magma Cube', i: '🟧', hp: 220, atk: 32, def: 10, spd: 1, exp: 64, gold: [15, 30], drops: { ember: .5, goldore: .2 } },
    boar: { n: 'Babi Liar', i: '🐗', hp: 35, atk: 6, def: 1, spd: 1.4, exp: 6, gold: [3, 8], drops: { meat: .9, tusk: .3 } }
  };

  /* ===== DUNGEON TUNGGAL — level tak terbatas. Semua angka balance ada di blok ini. ===== */
  D.DUNGEON = { n: 'Dungeon Abadi', i: '🌀', escortChance: .10, escortPity: 10 };
  const BOSSES = [ // pengali relatif terhadap boss dasar level itu
    { id: 'golem',   n: 'Mossback Golem',   i: '🗿', hp: 1,   atk: .9,  def: 1,   spd: 1 },
    { id: 'lich',    n: 'Lich Warden',      i: '☠️', hp: .9,  atk: 1.2, def: .9,  spd: 1.1 },
    { id: 'warlord', n: 'Infernal Warlord', i: '👹', hp: 1.1, atk: 1.2, def: 1.2, spd: 1.15 }
  ];
  /* Level spesial: D.LEVEL_HOOKS[7] = (R, cfg, mul) => { ...ubah R.mobs / R.props / R.boss / R.def... } — dipanggil setelah level dibuat */
  D.LEVEL_HOOKS = {};
  D.lvMul = (lv) => ({ hp: Math.pow(1.08, lv - 1), atk: Math.pow(1.06, lv - 1), def: 1 + .05 * (lv - 1), rew: 1 + .12 * (lv - 1) });
  D.levelCfg = function (lv) {
    const band = lv < 5 ? 0 : lv < 10 ? 1 : lv < 15 ? 2 : 3, rew = D.lvMul(lv).rew, sc = (a) => [Math.round(a[0] * rew), Math.round(a[1] * rew)];
    const chest = [{ stone: [3, 8], bone: [1, 4], copper: [1, 3] }, { bone: [3, 7], iron: [2, 5], slime: [1, 3] }, { ember: [1, 3], goldore: [1, 3], iron: [3, 6] }, { ember: [2, 4], goldore: [2, 3], iron: [3, 6] }][band];
    return { lv, band, w: 50 + Math.min(12, lv), h: 36 + Math.min(8, lv >> 1), rooms: Math.min(14, 9 + ((lv / 3) | 0)), perRoom: [3, 5],
      mobs: [['slime', 'bat', 'skeleton'], ['skeleton', 'zombie', 'wraith', 'bat'], ['zombie', 'wraith', 'imp', 'skeleton'], ['wraith', 'imp', 'magma', 'zombie']][band],
      floor: ['#3b3f36', '#2f3340', '#40302c', '#352f40'][band], chest: Object.assign({}, chest, { gold: sc([25, 60]) }) };
  };
  /* Loot boss per level (dikali 0.5^kematian saat boss) */
  D.bossLoot = (lv) => { const b = lv < 5 ? 0 : lv < 10 ? 1 : lv < 15 ? 2 : 3, ti = lv < 5 ? 1 : lv < 10 ? 2 : lv < 20 ? 3 : 4;
    return [{ t: 'mat', id: ['heart', 'relic', 'core', 'core'][b], q: 1 + ((lv / 10) | 0), c: 1 }, { t: 'rgear', ti, c: .3 }, { t: 'unique', c: Math.min(.2, .03 + .01 * lv) }]; };

  /* ===== Escort Of Heroes: Aspect per role (buff selama run). mods: atk/def = %, aspd = attack speed %, spd = kecepatan jalan % ===== */
  D.ASPECTS = {
    fighter:  { name: 'Aspect Of Ares',    c: '#d1503f', g: '#ff7a5a', mods: { atk: .25, def: .25 },  txt: 'ATK +25% · DEF +25%' },
    assassin: { name: 'Aspect Of Hermes',  c: '#e8b94a', g: '#fff0a0', mods: { atk: .25, spd: .20 },  txt: 'ATK +25% · Speed +20%' },
    tank:     { name: 'Aspect Of Hades',   c: '#0c0c12', g: '#9a86c8', mods: { def: .50 },            txt: 'DEF +50%' },
    mage:     { name: 'Aspect Of Hecate',  c: '#9b59b6', g: '#d79cff', mods: { atk: .25, aspd: .25 }, txt: 'ATK +25% · Attack Speed +25%' },
    archer:   { name: 'Aspect Of Artemis', c: '#6fae3c', g: '#b6f27a', mods: { aspd: .30, spd: .15 }, txt: 'Attack Speed +30% · Speed +15%' }
  };
  /* ===== Enchantment (permanen, disimpan di save). Satu-satunya sumber: Enchantment Table di level .5 ===== */
  D.ENCHANT = { dmg: { n: 'Damage', i: '🗡️', v: [.02, .04, .06, .08, .10] } };
  D.enchantDmg = (p) => { const l = (p.enchant && p.enchant.dmg) || 0; return l ? D.ENCHANT.dmg.v[l - 1] : 0; };
  /* Stat run = stat dasar + Aspect + Enchant. Dipanggil ulang saat level up / dapat buff. */
  D.refreshStats = function (R) {
    const p = D.state, s = D.calcStats(p), a = (R.aspect && R.aspect.mods) || {}, e = D.enchantDmg(p);
    s.atk = Math.round(s.atk * (1 + (a.atk || 0)) * (1 + e)); s.def = Math.round(s.def * (1 + (a.def || 0)));
    s.cd = s.cd / (1 + (a.aspd || 0)); s.spd = s.spd * (1 + (a.spd || 0)); R.s = s;
  };
  D.TRIALS = {
    /* Soul Trial: lawan dirimu sendiri (role, ATK, DEF, kecepatan = punyamu). Pola per role ada di boss.js (soul_<role>) */
    2: { n: 'Soul Trial', i: '👤', soul: true, hp: 50000, exp: 0, gold: [0, 0], id: 'trial2' },
    3: { n: 'Trial of Valor', i: '🦾', hp: 2600, atk: 34, def: 9, spd: 1.2, exp: 0, gold: [0, 0], id: 'trial3', pat: 'warlord' },
    4: { n: 'Apex Trial', i: '🐲', hp: 7000, atk: 58, def: 18, spd: 1.3, exp: 0, gold: [0, 0], id: 'trial4', pat: ['lich', 'warlord'] }
  };

  D.run = null;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /* ---------- Map generation ---------- */
  function genDungeon(def) {
    const w = def.w, h = def.h, m = new Uint8Array(w * h), rooms = [];
    for (let i = 0; i < 400 && rooms.length < def.rooms; i++) {
      const rw = D.rand(5, 9), rh = D.rand(5, 8), x = D.rand(2, w - rw - 3), y = D.rand(2, h - rh - 3);
      if (rooms.some(r => x < r.x + r.w + 2 && x + rw + 2 > r.x && y < r.y + r.h + 2 && y + rh + 2 > r.y)) continue;
      rooms.push({ x, y, w: rw, h: rh, cx: x + (rw >> 1), cy: y + (rh >> 1) });
    }
    const carve = (x, y) => { m[y * w + x] = 1; };
    rooms.forEach(r => { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y); });
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      for (let x = Math.min(a.cx, b.cx); x <= Math.max(a.cx, b.cx); x++) { carve(x, a.cy); carve(x, a.cy + 1); }
      for (let y = Math.min(a.cy, b.cy); y <= Math.max(a.cy, b.cy); y++) { carve(b.cx, y); carve(b.cx + 1, y); }
    }
    return { m, w, h, rooms };
  }
  function genOpen(w, h) {
    const m = new Uint8Array(w * h).fill(1);
    for (let x = 0; x < w; x++) { m[x] = 0; m[(h - 1) * w + x] = 0; }
    for (let y = 0; y < h; y++) { m[y * w] = 0; m[y * w + w - 1] = 0; }
    for (let i = 0; i < w * h / 25; i++) m[D.rand(2, h - 3) * w + D.rand(2, w - 3)] = 0;
    for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) m[y * w + x] = 1; // spawn aman
    return { m, w, h, rooms: [] };
  }
  const mk = (id, x, y, over) => {
    const b = D.MOBS[id], m = Object.assign({ id, i: b.i, n: b.n, hp: b.hp, max: b.hp, atk: b.atk, def: b.def, spd: b.spd, x, y, cd: 0, r: 11, aggro: 190 }, over || {});
    m.exp = b.exp; m.gold = b.gold; m.drops = b.drops; return m;
  };
  const walk = (R, x, y) => { const tx = Math.floor(x / T), ty = Math.floor(y / T); return tx >= 0 && ty >= 0 && tx < R.w && ty < R.h && R.m[ty * R.w + tx] === 1; };
  const free = (R, x, y, r) => walk(R, x - r, y - r) && walk(R, x + r, y - r) && walk(R, x - r, y + r) && walk(R, x + r, y + r);
  function move(R, e, dx, dy, r) {
    if (free(R, e.x + dx, e.y, r)) e.x += dx;
    if (free(R, e.x, e.y + dy, r)) e.y += dy;
  }
  function randFloor(R, far) {
    for (let i = 0; i < 200; i++) {
      const x = D.rand(1, R.w - 2) * T + 16, y = D.rand(1, R.h - 2) * T + 16;
      if (free(R, x, y, 10) && (!far || dist({ x, y }, R.p) > far)) return { x, y };
    }
    return { x: R.p.x + 120, y: R.p.y };
  }

  /* ---------- Run lifecycle ---------- */
  D.startRun = function (kind, id) {
    const p = D.state; let R;
    if (kind === 'dungeon') {
      if (!(p.inventory.keys.dungeon > 0)) return false;
      p.inventory.keys.dungeon--;                   // Key dipakai saat MASUK; level berikutnya lewat portal, tanpa key
      R = { kind, id: 'dungeon', def: { n: 'Level 1', floor: '#000' }, mobs: [], chests: [], proj: [], fx: [], ft: [], props: [], p: { x: 0, y: 0 },
            lv: 1, half: false, sub: '', pity: 0, escortSeen: false };
      p.bossDeathCount = {}; p.activeBuffs = [];
    } else if (kind === 'trial') {
      R = { kind, id, def: { n: D.TRIALS[id].n, floor: '#33363f' }, mobs: [], chests: [], proj: [], fx: [], ft: [], p: { x: 0, y: 0 } };   // p wajib ada (dulu hilang → trial crash)
    } else if (kind === 'training') {
      R = D.Train.make();                           // Training Room (js/training.js)
    } else { // job_slayer | job_boar
      const g = genOpen(44, 30); R = Object.assign({ kind, id: kind, def: { n: kind === 'job_boar' ? 'Padang Babi Liar' : 'Goa Slayer', floor: kind === 'job_boar' ? '#3c5a2e' : '#3b3f36' }, mobs: [], chests: [], proj: [], fx: [], ft: [], spawnT: 0 }, g);
      R.ex = new Uint8Array(g.w * g.h).fill(1); R.p = { x: 4 * T, y: 4 * T }; R.start = { x: R.p.x, y: R.p.y };
    }
    R.p.r = 9; R.aspect = null; R.tele = []; R.smoke = []; R.smk = 0; R.pop = null; if (!R.props) R.props = []; D.refreshStats(R); R.hp = R.s.hp; R.atkT = 0; R.skT = 0; R.inv = 0; R.shield = 0; R.deaths = 0; R.t = 0;
    R.dsT = 0; R.sp2T = 0; D.PA.init(R); R.dash = null; R.bf = { atk: { t: 0, m: 1 }, def: { t: 0, m: 1 }, ls: { t: 0, m: 0 } };
    R.arena = false; R.boss = null; R.done = null; R.earn = { gold: 0, exp: 0, mats: {} }; R.msg = '';
    D.run = R;
    if (kind === 'trial') enterArena(); else if (kind === 'dungeon') buildLevel(R, 1); else if (kind.startsWith('job')) fillJob(R, true); else if (kind === 'training') D.Train.fill(R);
    return true;
  };
  const mkL = (id, x, y, mul) => { const m = mk(id, x, y); m.hp = m.max = Math.round(m.hp * mul.hp); m.atk = Math.round(m.atk * mul.atk); m.def = Math.round(m.def * mul.def);
    m.exp = Math.round(m.exp * mul.rew); m.gold = [Math.round(m.gold[0] * mul.rew), Math.round(m.gold[1] * mul.rew)]; return m; };
  D.levelLabel = (R) => R.kind !== 'dungeon' ? R.def.n : R.half ? `Level ${R.lv}.5 · ${R.sub}` : `Level ${R.lv}`;

  /* Level reguler: map acak, mob scaling, boss acak di room terakhir (tanpa pintu), Trader tiap level genap */
  function buildLevel(R, lv) {
    D.PA.field(R);
    const cfg = D.levelCfg(lv), mul = D.lvMul(lv), g = genDungeon(cfg), rs = g.rooms, lastI = rs.length - 1;
    Object.assign(R, { m: g.m, w: g.w, h: g.h, rooms: rs, lv, half: false, sub: '', deaths: 0, mobs: [], chests: [], proj: [], props: [], boss: null, tele: [], arena: false, dash: null, ex: new Uint8Array(g.w * g.h) });
    R.def = { n: `Level ${lv}`, floor: cfg.floor, chest: cfg.chest };
    const r0 = rs[0], pv = rs[Math.max(0, lastI - 1)];
    R.start = { x: r0.cx * T + 16, y: r0.cy * T + 16 }; R.p.x = R.start.x; R.p.y = R.start.y; R.cp = { x: pv.cx * T + 16, y: pv.cy * T + 16 };
    const tr = lv % 2 === 0 && lastI > 2 ? D.rand(1, lastI - 1) : -1;
    const rp = (r) => ({ x: (r.x + D.rand(1, r.w - 2)) * T + 16, y: (r.y + D.rand(1, r.h - 2)) * T + 16 });
    rs.forEach((r, i) => {
      if (i === 0) return;
      if (i === lastI) {
        const bd = BOSSES[D.rand(0, BOSSES.length - 1)], hp = Math.round(600 * bd.hp * Math.pow(1.12, lv - 1)), rw = 1 + .35 * (lv - 1), x = r.cx * T + 16, y = r.cy * T + 16;
        R.boss = { isBoss: true, id: bd.id, n: bd.n, i: bd.i, hp, max: hp, atk: Math.round(14 * bd.atk * Math.pow(1.07, lv - 1)), def: Math.round(3 * bd.def * mul.def), spd: bd.spd,
                   x, y, hx: x, hy: y, cd: 0, r: 20, aggro: 300, eng: false, pat: bd.id, face: Math.PI, exp: Math.round(150 * rw), gold: [Math.round(150 * rw), Math.round(250 * rw)] };
        R.mobs.push(R.boss); return;
      }
      if (i === tr) { R.props.push({ k: 'trader', x: r.cx * T + 16, y: r.cy * T + 16, stock: genStock(lv) }); return; }   // room trader aman: tanpa mob
      for (let k = D.rand(cfg.perRoom[0], cfg.perRoom[1]); k--;) { const q = rp(r); R.mobs.push(mkL(cfg.mobs[D.rand(0, cfg.mobs.length - 1)], q.x, q.y, mul)); }
      if (Math.random() < .7) { const q = rp(r); R.chests.push({ x: q.x, y: q.y, open: false }); }
    });
    if (R.v) R.v.pj = [];
    const hk = D.LEVEL_HOOKS[lv]; if (hk) hk(R, cfg, mul);
    R.inv = 1; R.msg = tr >= 0 ? `Level ${lv} — ada Pedagang di dungeon ini` : `Level ${lv} — kalahkan boss di ujung dungeon`;
  }
  /* Level .5: sama di semua level, tanpa musuh. Pertama kali = Escort Of Heroes (patung Aspect). Setelahnya = Enchantment Table. */
  function buildHalf(R) {
    D.PA.field(R);
    const W = 21, H = 13, m = new Uint8Array(W * H), first = !R.escortSeen;
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) m[y * W + x] = 1;
    Object.assign(R, { m, w: W, h: H, rooms: [], half: true, mobs: [], chests: [], proj: [], props: [], boss: null, tele: [], arena: false, dash: null, ex: new Uint8Array(W * H).fill(1), pity: 0 });
    R.def = { n: `Level ${R.lv}.5`, floor: '#3a3552' };
    R.start = { x: 3 * T + 16, y: 6 * T + 16 }; R.p.x = R.start.x; R.p.y = R.start.y;
    R.props.push(first ? { k: 'statue', x: 10 * T + 16, y: 6 * T + 16 } : { k: 'table', x: 10 * T + 16, y: 6 * T + 16 }, { k: 'portal', x: 18 * T + 16, y: 6 * T + 16 });
    R.sub = first ? 'Escort Of Heroes' : 'Enchantment Table'; R.escortSeen = true; R.deaths = 0;
    if (R.v) R.v.pj = [];
    R.inv = 1; R.msg = first ? 'Seorang dewa menunggu. Dekati patung dan tekan E.' : 'Ruang tenang. Pakai Enchantment Table (E).';
  }
  /* Portal setelah boss / di level .5. Peluang level .5 = 10%, dijamin muncul 1× (Escort) dalam 10 level pertama. */
  function goNext(R) {
    if (R.half) { buildLevel(R, R.lv + 1); D.save(); return; }
    const c = D.DUNGEON;
    if ((!R.escortSeen && R.pity >= c.escortPity - 1) || Math.random() < c.escortChance) buildHalf(R);
    else { R.pity++; buildLevel(R, R.lv + 1); }
    D.save();
  }
  function genStock(lv) {
    const p = D.state, sc = 1 + .12 * (lv - 1), r = D.ROLES[p.role], ti = lv < 5 ? 1 : lv < 10 ? 2 : lv < 20 ? 3 : 4, st = [];
    st.push({ k: 'potion', i: '🧪', n: 'Ramuan Heal ×2', d: 'Pulihkan 40% HP (F)', price: Math.round(60 * sc) });
    for (const k of ['dmg', 'def']) st.push({ k: 'bpot', id: k, i: D.BUFFPOT[k].i, n: D.BUFFPOT[k].n, d: D.BUFFPOT[k].desc, price: Math.round(D.BUFFPOT[k].price * 1.5 * sc) });
    st.push({ k: 'full', i: '✨', n: 'Air Suci', d: 'Pulihkan HP penuh sekarang', price: Math.round(80 * sc) });
    const gear = r.weapons.map(w => `${w}_${ti}`).concat(`armor_${ti}`, `${r.offhand}_${ti}`).filter(id => D.ITEMS[id] && !p.inventory.items.includes(id));
    if (gear.length) { const it = D.ITEMS[gear[D.rand(0, gear.length - 1)]]; st.push({ k: 'gear', id: it.id, i: it.icon, n: it.name, d: D.itemStr(it) + (it.lv > 1 ? ` · Lv ${it.lv}` : ''), price: Math.round(it.price * 1.4) }); }
    return st;
  }
  D.traderBuy = function (i) {
    const R = D.run, p = D.state; if (!R || !R.pop || R.pop.type !== 'trader') return;
    const o = R.pop.prop.stock[i]; if (!o || o.sold || p.gold < o.price) return;
    p.gold -= o.price; o.sold = true;
    if (o.k === 'potion') p.inventory.potions += 2; else if (o.k === 'bpot') p.inventory.pots[o.id]++; else if (o.k === 'full') R.hp = R.s.hp; else if (o.k === 'gear') p.inventory.items.push(o.id);
    D.save();
  };
  D.closePop = function () { const R = D.run; if (R) R.pop = null; };
  D.nearProp = function () { const R = D.run; if (!R || !R.props) return null; let b = null, bd = 52; for (const q of R.props) { const d = dist(q, R.p); if (d < bd) { bd = d; b = q; } } return b; };
  function useProp(R, pr) {
    const p = D.state;
    if (pr.k === 'portal') return goNext(R);
    if (pr.k === 'trader') { R.pop = { type: 'trader', prop: pr }; return; }
    if (pr.k === 'statue') {
      if (pr.used) { R.msg = 'Berkat dewa sudah kamu terima.'; return; }
      pr.used = true; R.aspect = D.ASPECTS[p.role]; D.refreshStats(R); R.pop = { type: 'aspect' }; D.FX.buffFx(R, R.aspect.g); return;
    }
    if (pr.k === 'table') {
      const cur = p.enchant.dmg || 0;
      if (pr.used) { R.msg = 'Table ini sudah dipakai.'; return; }
      if (cur >= 5) { R.msg = 'Enchant Damage sudah Lv MAX.'; return; }
      pr.used = true; p.enchant.dmg = cur + 1; D.refreshStats(R); R.pop = { type: 'enchant', lv: cur + 1 }; D.FX.buffFx(R, '#8fc4ff'); D.save();
    }
  }
  function fillJob(R, all) {
    const lv = D.state.level, pool = R.kind === 'job_boar' ? ['boar'] : lv >= 10 ? ['skeleton', 'zombie', 'slime'] : ['slime', 'bat', 'skeleton'];
    while (R.mobs.filter(m => !m.dead).length < 12) { const q = randFloor(R, 200); R.mobs.push(mk(pool[D.rand(0, pool.length - 1)], q.x, q.y)); if (!all) break; }
  }
  function enterArena() {
    const R = D.run, bd = R.kind === 'trial' ? D.TRIALS[R.id] : R.def.boss;
    const g = genOpen(22, 15); for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) g.m[y * 22 + x] = 1;
    for (let i = 0; i < 22 * 15; i++) if (g.m[i] === 0 && i % 22 > 0 && i % 22 < 21 && i > 22 && i < 22 * 14) g.m[i] = 1; // arena bersih
    Object.assign(R, { m: g.m, w: 22, h: 15, arena: true, tele: [], mobs: [], chests: [], proj: [], door: null, ex: new Uint8Array(22 * 15).fill(1) });
    R.start = { x: 3 * T + 16, y: 7 * T + 16 }; R.p.x = R.start.x; R.p.y = R.start.y;
    const so = !!bd.soul, st = R.s, role = D.state.role;
    R.boss = { isBoss: true, id: bd.id, n: so ? `Soul of ${D.ROLES[role].label}` : bd.n, i: so ? D.ROLES[role].icon : bd.i, hp: bd.hp, max: bd.hp, atk: so ? st.atk : bd.atk, def: so ? st.def : bd.def, spd: so ? st.spd * .8 : bd.spd,
      x: 17 * T, y: 7 * T + 16, cd: 0, r: 20, aggro: 9999, eng: true, exp: bd.exp, gold: bd.gold, pat: so ? 'soul_' + role : bd.pat, soul: so ? role : null, face: Math.PI };
    R.mobs = [R.boss]; R.msg = `⚔ ${R.boss.n}!`;
  }

  /* ---------- Combat ---------- */
  const float = (x, y, t, c) => D.run.ft.push({ x, y, t: String(t), c: c || '#fff', life: .8 });
  function roll(mult, fc, cm) { const R = D.run, s = R.s, c = !!fc || Math.random() * 100 < s.crit + D.PA.critAdd(R); return { d: s.atk * (R.bf.atk.t > 0 ? R.bf.atk.m : 1) * D.PA.atkMul(R) * (mult || 1) * (.9 + Math.random() * .2) * (c ? (cm !== undefined ? cm : s.critMul) : 1), c }; }   // fc = paksa crit, cm = override pengali crit
  function hit(m, d, c) {
    if (m.dead) return;
    const R = D.run; if (m.weak > 0) d *= D.PA.weakMul(); const dmg = D.PA.trueDmg(R) ? Math.max(1, Math.round(d)) : Math.max(1, Math.round(d - m.def * .5)); m.hp -= dmg; float(m.x, m.y - 14, dmg, c ? '#ffd54a' : '#fff'); D.Dmg.add(dmg, c, m);   // → indikator damage + combo (js/dmgfx.js)
    { const ls = R.s.lifesteal + (R.bf.ls.t > 0 ? R.bf.ls.m : 0) + D.PA.lsExtra(R); if (ls) R.hp = Math.min(R.s.hp, R.hp + dmg * ls); }
    if (m.hp <= 0) kill(m);
  }
  /* true damage: abaikan DEF & pengurangan damage musuh (dipakai Black Hole & Vengeful Aegis) */
  function trueHit(m, d) { if (m.dead) return; const dmg = Math.max(1, Math.round(d)); m.hp -= dmg; float(m.x, m.y - 14, dmg, '#d79cff'); D.Dmg.add(dmg, false, m, 'true'); m.hf = .1; if (m.hp <= 0) kill(m); }
  function addExp(n) {
    const p = D.state; p.exp += n; R_().earn.exp += n;
    while (p.level < 60 && p.exp >= D.expFor(p.level)) { p.exp -= D.expFor(p.level); p.level++; const R = D.run; D.refreshStats(R); R.hp = R.s.hp; float(R.p.x, R.p.y - 24, 'LEVEL UP!', '#6fae3c'); }
  }
  const R_ = () => D.run;
  D.expFor = (lv) => Math.floor(40 * Math.pow(lv, 1.4));
  function kill(m) {
    const R = D.run, p = D.state; m.dead = true; p.stats.kills++; D.PA.onKill(R, m);
    if (m.isBoss) return bossDown(m);
    const g = D.rand(m.gold[0], m.gold[1]); D.addGold(g); R.earn.gold += g; addExp(m.exp);
    for (const [id, c] of Object.entries(m.drops)) if (Math.random() < c) { D.addMat(id); R.earn.mats[id] = (R.earn.mats[id] || 0) + 1; }
    if (R.kind.startsWith('job')) R.spawnT = 1.5;
  }
  function bossDown(b) {
    const R = D.run, p = D.state, loot = [], dun = R.kind === 'dungeon';
    R.proj = []; R.tele = []; if (!dun) R.mobs = [];
    if (R.kind === 'trial') { p.trials[+R.id] = true; R.done = { win: true, title: `${D.TRIALS[R.id].n} lulus!`, loot }; D.save(); return; }
    const mult = Math.pow(.5, R.deaths), g = D.rand(b.gold[0], b.gold[1]); D.addGold(g); addExp(b.exp);
    loot.push({ i: '🪙', t: `${g} Gold` });
    for (const l of D.bossLoot(R.lv)) {
      if (Math.random() >= l.c * mult) continue;              // ← PENALTY: chance × 0.5^kematian (per level)
      if (l.t === 'mat') { D.addMat(l.id, l.q); loot.push({ i: D.MATS[l.id].i, t: `${D.MATS[l.id].n} ×${l.q}` }); }
      else {
        const id = l.t === 'unique' ? `u_${p.role}` : D.roleGear(p, l.ti), it = D.ITEMS[id];
        if (it.unique && p.inventory.items.includes(id)) { D.addGold(it.price / 2); loot.push({ i: '🪙', t: `${it.name} (duplikat → ${it.price / 2} Gold)` }); }
        else if (!it.unique && p.inventory.items.includes(id)) { D.addGold(Math.round(it.price / 2)); loot.push({ i: '🪙', t: `${it.name} (duplikat → ${Math.round(it.price / 2)} Gold)` }); }
        else { p.inventory.items.push(id); loot.push({ i: it.icon, t: it.name }); }
      }
    }
    p.stats.depth = Math.max(p.stats.depth || 0, R.lv); p.activeBuffs = [];
    R.props.push({ k: 'portal', x: b.x, y: b.y });
    R.pop = { type: 'loot', title: `${b.n} dikalahkan!`, loot, note: (R.deaths ? `Mati ${R.deaths}× → drop chance ×${(mult * 100).toFixed(mult < .1 ? 1 : 0)}%` : 'Tanpa kematian: drop chance penuh') + ' · Portal terbuka di tempat boss.' };
    R.msg = `Level ${R.lv} selesai! Masuk portal (E)`;
    D.save();
  }
  function hurt(raw, src) {
    const R = D.run, s = R.s, PA = D.PA; if (R.inv > 0 || R.done || PA.immune(R)) return;
    const df = s.def * (R.bf.def.t > 0 ? R.bf.def.m : 1) * PA.defMul(R);
    let d = Math.max(1, Math.round(raw - df * .6)) * (1 - s.dmgReduce) * (R.shield > 0 ? .4 : 1) * (R.bf.def.t > 0 ? .8 : 1) * PA.takenMul(R); d = Math.max(1, Math.round(d));
    R.hp -= d; R.inv = .35; float(R.p.x, R.p.y - 14, d, '#ff6b5a');
    if (s.thorns && src && !src.dead) hit(src, d * s.thorns * 5, false);
    PA.afterHurt(R, raw);                       // Tank T3: counter-damage
    if (PA.aethel(R)) return;                   // Assassin T4: selamat dari kematian
    if (R.hp <= 0) die();
  }
  function die() {
    const R = D.run, p = D.state; let spot = R.start; D.Boss.reset(R); D.PA.onDie(R);
    if (R.arena) { // Trial: respawn di Arena
      R.deaths++; const b = R.boss; if (!b.soul) b.hp = b.max; b.x = 17 * T; b.y = 7 * T + 16; b.ring = 3; R.proj = []; R.msg = b.soul ? 'Gugur! HP Soul tetap berkurang. Coba lagi.' : 'Gugur! Coba lagi.';
    } else if (R.kind === 'dungeon' && R.boss && !R.boss.dead && R.boss.eng) { // mati saat melawan boss: respawn dekat boss, boss pulih, drop ×0.5
      R.deaths++; const b = R.boss; p.bossDeathCount[b.id] = R.deaths;
      p.activeBuffs = [{ id: 'bossPenalty', name: `Death Penalty ×${Math.pow(.5, R.deaths) * 100}% drop`, dropMult: Math.pow(.5, R.deaths) }];
      b.hp = b.max; b.x = b.hx; b.y = b.hy; b.ring = 3; b.eng = false; R.proj = []; spot = R.cp;
      R.msg = `Kamu gugur! Respawn dekat boss. Drop Boss ×${Math.pow(.5, R.deaths) * 100}%`;
    } else R.msg = 'Gugur! Respawn di titik awal level.';
    R.p.x = spot.x; R.p.y = spot.y; R.hp = R.s.hp; R.inv = 1.5; R.shield = 0;
  }

  /* Dash: jarak beda per role (Mage/Tank pendek, Fighter/Archer sedang, Assassin terjauh). Ada i-frame singkat. */
  D.DASH = { mage: { d: 75, cd: 2.2 }, tank: { d: 75, cd: 2.2 }, fighter: { d: 125, cd: 2 }, archer: { d: 125, cd: 2 }, assassin: { d: 200, cd: 1.4 } };

  /* Skill terarah. type: point = area di titik bidikan | leap/dash = bergerak ke titik lalu hantam area | self = buff diri */
  D.SKILLS = {
    fighter:  { type: 'leap',  range: 150, rad: 80,  mult: 2.2 },
    mage:     { type: 'point', range: 240, rad: 120, mult: 2.6 },
    archer:   { type: 'point', range: 260, rad: 100, mult: 1.6 },
    tank:     { type: 'self',  range: 0,   rad: 70 },
    assassin: { type: 'dash',  range: 150, rad: 70,  mult: 2.2 }
  };
  /* Basic attack: animasi & hit per role ada di combatfx.js (combo, wind-up, projectile, VFX). Di sini hanya gerbang cooldown. */
  D._c = { hit, roll, move, walk, dist, hurt, trueHit };   // dibagikan ke combatfx.js
  D.attack = function (ax, ay) {
    const R = D.run; if (!R || R.done || R.pop || R.atkT > 0) return false;
    R.atkT = R.s.cd * D.Uniq.cdMul(R);
    D.FX.attack(R, Math.atan2(ay - R.p.y, ax - R.p.x));
    return true;
  };

  D.act = function (a, arg) {
    const R = D.run, p = D.state; if (!R || R.done || R.pop) return;
    if (a === 'potion' && p.inventory.potions > 0 && R.hp < R.s.hp) { p.inventory.potions--; R.hp = Math.min(R.s.hp, R.hp + R.s.hp * D.POTION.heal); float(R.p.x, R.p.y - 20, '+HP', '#6fae3c'); }
    if (a === 'dash' && !R.dash && !(R.dsT > 0) && !D.PA.rooted(R)) {
      if (D.PA.markDash(R)) return;                // Assassin T3: teleport ke musuh bertanda
      const ds = D.DASH[p.role], dd = ds.d * D.PA.dashMul(R), ang = (arg && arg.ang) || 0, cut = R.s.dashCd ? Math.max(.5, 1 - R.s.dashCd) : 1;
      R.dsT = ds.cd * cut; R.dash = { ax: Math.cos(ang), ay: Math.sin(ang), left: dd, spd: dd / (.09 + dd / 2500), ang };
      R.inv = Math.max(R.inv, .2); R.atkT = 0; D.FX.dash(R, ang, dd);
    }
    if (a === 'buff') {
      const bp = D.BUFFPOT[arg], pots = p.inventory.pots;
      if (bp && pots[arg] > 0) {
        pots[arg]--; if (arg === 'dmg') R.bf.atk = { t: bp.t, m: bp.m }; else R.bf.def = { t: bp.t, m: bp.m };
        float(R.p.x, R.p.y - 22, arg === 'dmg' ? 'ATK ↑' : 'DEF ↑', arg === 'dmg' ? '#ffb347' : '#8fc4ff'); D.FX.buffFx(R, arg === 'dmg' ? '#ff8a4a' : '#5aa0d8');
      }
    }
    if (a === 'spell2' && R.s.spell && !(R.sp2T > 0)) {
      R.sp2T = D.SPELL2[R.s.spell].cd; D.PA.onSkill(R); D.FX.spell(R, R.s.spell, R.s.spellPow, (arg && arg.ang) || 0);
    }
    if (a === 'interact') {
      const c = (R.chests || []).find(c => !c.open && dist(c, R.p) < 44);
      if (c) { c.open = true; const out = []; for (const [k, v] of Object.entries(R.def.chest)) { const n = D.rand(v[0], v[1]); if (Math.random() < (k === 'gold' ? 1 : .6)) { if (k === 'gold') { D.addGold(n); R.earn.gold += n; out.push(`${n}🪙`); } else { D.addMat(k, n); R.earn.mats[k] = (R.earn.mats[k] || 0) + n; out.push(`${n}${D.MATS[k].i}`); } } } R.msg = 'Peti: ' + out.join(' '); }
      else { const pr = D.nearProp(); if (pr) useProp(R, pr); }
    }
    if (a === 'skill' && R.skT <= 0) {
      const s = R.s, role = p.role, sk = D.SKILLS[role], near = R.mobs.filter(m => !m.dead), col = D.ROLES[role].color;
      const ang = arg ? Math.atan2(arg.y - R.p.y, arg.x - R.p.x) : 0, len = arg ? Math.min(sk.range, dist(arg, R.p)) : sk.range;
      const aoe = (cx, cy, rad, mult) => near.forEach(m => { if (Math.hypot(m.x - cx, m.y - cy) < rad) { const r = roll(mult); hit(m, r.d, r.c); } });
      R.skT = 8; D.PA.onSkill(R);
      if (sk.type === 'self') { R.fx.push({ x: R.p.x, y: R.p.y, rad: 20, life: .3, c: col }); R.shield = 4; R.hp = Math.min(s.hp, R.hp + s.hp * .15); }
      else {
        let tx = R.p.x + Math.cos(ang) * len, ty = R.p.y + Math.sin(ang) * len;
        if (sk.type !== 'point') { // leap / dash: maju searah bidikan sampai terhalang dinding
          for (let d = 0; d < len; d += 6) { const bx = R.p.x, by = R.p.y; move(R, R.p, Math.cos(ang) * 6, Math.sin(ang) * 6, 9); if (R.p.x === bx && R.p.y === by) break; }
          tx = R.p.x; ty = R.p.y; R.inv = .6;
        }
        R.fx.push({ x: tx, y: ty, rad: 20, life: .3, c: col }); aoe(tx, ty, sk.rad, sk.mult);
      }
    }
  };

  D.update = function (dt) {
    const R = D.run, s = R.s; if (!R || R.done || R.pop) return;
    if (R.hs > 0) { R.hs -= dt; dt *= .1; }   // hitstop: dunia hampir berhenti sesaat saat pukulan berat
    R.t += dt; R.atkT -= dt; R.skT -= dt; R.inv -= dt; R.shield -= dt; R.dsT -= dt; R.sp2T -= dt;
    for (const k in R.bf) R.bf[k].t -= dt;
    D.PA.update(R, dt); D.Uniq.update(R, dt);
    if (R.dash) { // dash: meluncur cepat searah, berhenti kalau menabrak dinding
      const k = R.dash, stp = Math.min(k.left, k.spd * dt), n = Math.max(1, Math.ceil(stp / 6));
      for (let i = 0; i < n; i++) { const bx = R.p.x, by = R.p.y; move(R, R.p, k.ax * stp / n, k.ay * stp / n, 9); if (R.p.x === bx && R.p.y === by) { k.left = 0; break; } }
      k.left -= stp; if (k.left <= .5) R.dash = null;
    } else {
      let { dx, dy } = D.input; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      if (!D.PA.rooted(R)) { const sm = s.spd * D.PA.spdMul(R); move(R, R.p, dx * sm * 60 * dt, dy * sm * 60 * dt, 9); }
    }
    if (R.ex && !R.arena && !R.half && R.kind === 'dungeon') {
      const cx = Math.floor(R.p.x / T), cy = Math.floor(R.p.y / T);
      for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) if (x >= 0 && y >= 0 && x < R.w && y < R.h && (x - cx) ** 2 + (y - cy) ** 2 <= 49) R.ex[y * R.w + x] = 1;
    }
    // musuh
    const aggroMul = D.state.role === 'tank' ? 1.5 : 1;
    for (const m of R.mobs) {
      if (m.dead) continue; m.cd -= dt; const d = dist(m, R.p); if (m.isBoss) { m.eng = R.arena || m.tauntT > 0 || d < m.aggro * aggroMul * 1.3; if (!(m.stun > 0)) D.Boss.update(R, m, dt, d); continue; }
      if (m.stun > 0) { D.MobAI.interrupt(R, m); continue; }      // stun: serangan yang sedang disiapkan dibatalkan
      if (R.pa.stealth > 0 || D.Uniq.ghost(R)) { D.MobAI.blind(R, m); continue; }    // player Stealth: musuh kehilangan jejak
      D.MobAI.update(R, m, dt, d, aggroMul);                      // pathfinding + aggro + serangan bertelegraf (js/mobai.js)
    }
    for (const q of R.proj) {
      q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt;
      if (!walk(R, q.x, q.y)) q.life = 0; else if (Math.hypot(q.x - R.p.x, q.y - R.p.y) < 13) { q.life = 0; hurt(q.dmg, null); }
    }
    R.proj = R.proj.filter(q => q.life > 0);
    if (R.aspect) { R.smk -= dt; if (R.smk <= 0) { R.smk = .07; R.smoke.push({ x: R.p.x + (Math.random() - .5) * 16, y: R.p.y + 6, vx: (Math.random() - .5) * 14, vy: -16 - Math.random() * 18, r: 5 + Math.random() * 5, life: 1, max: 1 }); } }
    for (const q of R.smoke) { q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; } R.smoke = R.smoke.filter(q => q.life > 0);
    D.Boss.tick(R, dt);
    if (R.kind === 'training') D.Train.update(R, dt);
    D.FX.update(R, dt);
    R.fx = R.fx.filter(f => (f.life -= dt) > 0); R.ft = R.ft.filter(f => ((f.life -= dt), (f.y -= 24 * dt), f.life > 0));
    if (R.kind.startsWith('job')) { R.spawnT -= dt; if (R.spawnT <= 0) { fillJob(R, false); R.spawnT = 2; } R.mobs = R.mobs.filter(m => !m.dead); }
    if (R.hp < R.s.hp && R.kind.startsWith('job')) R.hp = Math.min(R.s.hp, R.hp + R.s.hp * .004 * dt * 10);
  };

  D.leaveRun = function () {
    const p = D.state; p.activeBuffs = []; D.run = null; D.save();
  };
})(window.DSB);
