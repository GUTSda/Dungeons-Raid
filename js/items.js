/* items.js — material, equipment, kunci, Unique Item (TANPA gacha: semua dibeli langsung / drop terdefinisi) */
(function (D) {
  D.MATS = {
    stone: { n: 'Batu', p: 2, i: '🪨' }, copper: { n: 'Bijih Tembaga', p: 6, i: '🟠' },
    iron: { n: 'Bijih Besi', p: 14, i: '⛓️' }, goldore: { n: 'Bijih Emas', p: 38, i: '🟡' },
    wheat: { n: 'Gandum', p: 4, i: '🌾' }, meat: { n: 'Daging Babi', p: 9, i: '🥩' }, tusk: { n: 'Taring Babi', p: 16, i: '🦷' },
    bone: { n: 'Tulang', p: 5, i: '🦴' }, slime: { n: 'Lendir', p: 6, i: '🟢' }, ember: { n: 'Ember Core', p: 30, i: '🔥' },
    heart: { n: 'Jantung Golem', p: 60, i: '💚' }, relic: { n: 'Relik Kripta', p: 120, i: '🏺' }, core: { n: 'Inti Infernal', p: 250, i: '🌋' }
  };

  /* Dungeon Key (hanya satu): bisa dibeli ATAU di-craft dari bahan */
  D.KEYS = {
    dungeon: { n: 'Kunci Dungeon', price: 150, recipe: { stone: 10, bone: 5 } }
  };
  D.POTION = { price: 25, heal: 0.4 };
  /* Ramuan buff sementara (dipakai di dungeon: Z / X) */
  D.BUFFPOT = {
    dmg: { n: 'Ramuan Kekuatan', i: '💥', price: 45, t: 25, m: 1.35, desc: 'ATK +35% selama 25 detik' },
    def: { n: 'Ramuan Baja',     i: '🛡️', price: 45, t: 25, m: 1.6,  desc: 'DEF ×1.6 & damage diterima -20% selama 25 detik' }
  };

  const GT = [ // tier gear umum
    { n: 'Kayu', m: 1, p: 0, lv: 1 }, { n: 'Besi', m: 2, p: 70, lv: 1 }, { n: 'Baja', m: 3.6, p: 420, lv: 8 },
    { n: 'Mithril', m: 6, p: 2200, lv: 20 }, { n: 'Obsidian', m: 9.5, p: 9000, lv: 35 }
  ];
  const WT = {
    sword: { n: 'Pedang', i: '🗡️', a: 6, cd: .65, c: 0 }, heavy: { n: 'Greataxe', i: '🪓', a: 9, cd: .95, c: 0 },
    light: { n: 'Pedang Ringan', i: '⚔️', a: 4.5, cd: .5, c: 6 }, dagger: { n: 'Belati', i: '🔪', a: 3.5, cd: .4, c: 10 },
    wand: { n: 'Tongkat', i: '🪄', a: 7, cd: .75, c: 0 }, bow: { n: 'Busur', i: '🏹', a: 6.5, cd: .7, c: 0 }
  };
  D.ITEMS = {};
  const add = (it) => (D.ITEMS[it.id] = Object.assign({ buy: true, lv: 1, rarity: 'common' }, it));

  GT.forEach((g, ti) => {
    const buy = g.p > 0, r = ['common', 'common', 'rare', 'epic', 'legendary'][ti];
    for (const [k, w] of Object.entries(WT))
      add({ id: `${k}_${ti}`, name: `${w.n} ${g.n}`, icon: w.i, slot: 'weapon', wtype: k, atk: Math.round(w.a * g.m), crit: Math.round(w.c * (1 + ti * .2)), cd: w.cd, price: g.p, lv: g.lv, buy, rarity: r });
    add({ id: `shield_${ti}`, name: `Perisai ${g.n}`, icon: '🛡️', slot: 'offhand', wtype: 'shield', def: Math.round(3 * g.m), hp: Math.round(10 * g.m), price: g.p, lv: g.lv, buy, rarity: r });
    add({ id: `armor_${ti}`, name: `Armor ${g.n}`, icon: '🥋', slot: 'armor', def: Math.round(2 * g.m), hp: Math.round(15 * g.m), price: Math.round(g.p * 1.2), lv: g.lv, buy, rarity: r });
  });

  /* ===== OFFHAND tiap role (Tank = Shield di atas). id = `${wtype}_${tier}` ===== */
  const OHN = {
    orb:    { i: '🔮', n: ['Orb Kusam', 'Orb Arkana', 'Orb Astral', 'Orb Nova', 'Orb Singularitas'] },
    relic:  { i: '🧿', n: ['Relik Retak', 'Relik Bayangan', 'Relik Taring', 'Relik Pemburu', 'Relik Void'] },
    quiver: { i: '🎯', n: ['Quiver Kulit', 'Panah Racun', 'Panah Es', 'Panah Api', 'Panah Petir'] },
    tome:   { i: '📖', n: ['Tome Prajurit', 'Tome Zirah', 'Tome Api', 'Tome Gempa', 'Tome Amukan'] }
  };
  const SPLASH = [0, .12, .25, .4, .6], CMUL = [.05, .1, .2, .3, .45], DCD = [0, .1, .15, .2, .3];
  const ARW = [null, 'poison', 'frost', 'fire', 'thunder'], ARD = ['', 'Racun: DOT 45% ATK / 4 dtk', 'Es: musuh melambat', 'Api: bakar 80% ATK / 3 dtk', 'Petir: menyambar 2 musuh lain'];
  const SPL = ['warcry', 'ironskin', 'firewave', 'quake', 'bloodrage'], SPN = ['War Cry (ATK+)', 'Ironskin (DEF+ & heal)', 'Flame Wave (AoE + bakar)', 'Quake (3 gelombang + slow)', 'Bloodrage (ATK+ & lifesteal)'];
  const pc = (v) => Math.round(v * 100);
  GT.forEach((g, ti) => {
    const m = g.m, base = { slot: 'offhand', price: g.p, lv: g.lv, buy: g.p > 0, rarity: ['common', 'common', 'rare', 'epic', 'legendary'][ti] };
    add(Object.assign({ id: `orb_${ti}`, name: OHN.orb.n[ti], icon: OHN.orb.i, wtype: 'orb', atk: Math.round(3 * m), crit: Math.round(2 + ti * 1.5),
      passive: SPLASH[ti] ? { splash: SPLASH[ti] } : {}, desc: SPLASH[ti] ? `Ledakan +${pc(SPLASH[ti])}%` : '' }, base));
    add(Object.assign({ id: `relic_${ti}`, name: OHN.relic.n[ti], icon: OHN.relic.i, wtype: 'relic', crit: 3 + 2 * ti, hp: Math.round(5 * m),
      passive: { critMul: CMUL[ti], dashCd: DCD[ti] }, desc: `Crit dmg +${pc(CMUL[ti])}%${DCD[ti] ? ` · Dash CD -${pc(DCD[ti])}%` : ''}` }, base));
    add(Object.assign({ id: `quiver_${ti}`, name: OHN.quiver.n[ti], icon: OHN.quiver.i, wtype: 'quiver', atk: Math.round(2.5 * m), crit: 1 + ti,
      arrow: ARW[ti], desc: ARD[ti] }, base));
    add(Object.assign({ id: `tome_${ti}`, name: OHN.tome.n[ti], icon: OHN.tome.i, wtype: 'tome', atk: Math.round(2 * m), def: Math.round(1.5 * m), hp: Math.round(8 * m),
      spell: SPL[ti], sp: 1 + .2 * ti, desc: `Spell 2 (R): ${SPN[ti]}` }, base));
  });

  /* ===== UNIQUE ITEMS (eksklusif per Role, pasif khusus) =====
     Passive didukung: lifesteal, thorns, dmgReduce, critMul. Tambah via D.registerUnique({...}) */
  D.registerUnique = (u) => add(Object.assign({ unique: true, rarity: 'unique', lv: 20, slot: 'weapon' }, u));
  [
    { id: 'u_fighter',  role: 'fighter',  name: 'Ironwill Greataxe',  icon: '🪓', wtype: 'heavy',  atk: 48, hp: 40,  cd: .9,  price: 7500, passive: { lifesteal: .08 }, desc: 'Lifesteal 8% · Unique: combo 4 hit Heavy Impact + Hold Charge Slash + skill Z/X/C/V' },
    { id: 'u_mage',     role: 'mage',     name: 'Embercall Staff',    icon: '🪄', wtype: 'wand',   atk: 54, crit: 10, cd: .7,  price: 7500, passive: { critMul: .6 },   desc: 'Crit damage +60% · Unique: combo 4 hit Catalyst + Hold Flame Dash Blast + skill Z/X/C/V' },
    { id: 'u_tank',     role: 'tank',     name: 'Bastion Aegis',      icon: '🛡️', wtype: 'shield', slot: 'offhand', def: 30, hp: 120, price: 7500, passive: { dmgReduce: .15, thorns: .1 }, desc: 'Damage diterima -15%, pantulkan 10% · Unique: combo 4 hit Shield-Breaker + Hold Absolute Guard + skill Z/X/C/V' },
    { id: 'u_archer',   role: 'archer',   name: 'Windpiercer Bow',    icon: '🏹', wtype: 'bow',    atk: 46, crit: 12, cd: .62, price: 7500, passive: { lifesteal: .04 }, desc: 'Lifesteal 4%, crit +12% · Unique: combo 4 hit Acrobatic + Hold Focus Lock On + skill Z/X/C/V' },
    { id: 'u_assassin', role: 'assassin', name: 'Dragonfang Dagger',  icon: '🔪', wtype: 'dagger', atk: 34, crit: 25, cd: .35, price: 7500, passive: { critMul: .5 },   desc: 'Crit +25%, crit damage +50% · Unique: pola serangan api + skill Z/X/C/V' }
    /* TEMPLATE slot kosong: D.registerUnique({ id:'u_xxx', role:'fighter', name:'...', wtype:'sword', atk:0, price:0, passive:{}, desc:'' }) */
  ].forEach(D.registerUnique);

  D.itemStr = (it) => [it.atk && `ATK ${it.atk}`, it.def && `DEF ${it.def}`, it.hp && `HP ${it.hp}`, it.crit && `CRIT ${it.crit}%`, it.desc].filter(Boolean).join(' · ');

  /* Aturan restriksi role */
  D.canUse = function (it, p) {
    const r = D.ROLES[p.role];
    if (it.role && it.role !== p.role) return { ok: false, why: `Eksklusif ${D.ROLES[it.role].label}` };
    if (it.slot === 'weapon' && !r.weapons.includes(it.wtype)) return { ok: false, why: `${r.label} tidak bisa pakai ${it.wtype}` };
    if (it.slot === 'offhand' && it.wtype !== r.offhand) return { ok: false, why: `${r.label} tidak bisa pakai ${it.wtype}` };
    if (p.level < it.lv) return { ok: false, why: `Butuh Lv ${it.lv}` };
    return { ok: true };
  };
  D.giveStarter = function (p) {
    const r = D.ROLES[p.role], w = { fighter: 'sword', mage: 'wand', tank: 'sword', archer: 'bow', assassin: 'dagger' }[p.role];
    p.inventory.items.push(`${w}_0`, 'armor_0'); p.equipment.weapon = `${w}_0`; p.equipment.armor = 'armor_0';
    { const oh = `${r.offhand}_0`; p.inventory.items.push(oh); p.equipment.offhand = oh; }
  };
  D.equip = function (p, id) {
    const it = D.ITEMS[id]; if (!it || !D.canUse(it, p).ok || !p.inventory.items.includes(id)) return false;
    p.equipment[it.slot] = id; return true;
  };
  /* Drop gear sesuai role (untuk loot boss) */
  D.roleGear = function (p, ti) {
    const r = D.ROLES[p.role], list = r.weapons.map(w => `${w}_${ti}`).concat(`armor_${ti}`, `${r.offhand}_${ti}`);
    return list[D.rand(0, list.length - 1)];
  };

  D.calcStats = function (p) {
    const r = D.ROLES[p.role], lf = 1 + .1 * (p.level - 1), tm = D.TIER_MULT[p.tier - 1];
    const s = { hp: r.base.hp * lf * tm, atk: r.base.atk * lf * tm, def: r.base.def * lf * tm, spd: r.base.spd, crit: r.base.crit,
                lifesteal: 0, thorns: 0, dmgReduce: 0, critMul: 1.8, cd: .7, range: r.range, splash: 0, dashCd: 0, arrow: null, spell: null, spellPow: 1 };
    for (const slot of ['weapon', 'offhand', 'armor']) {
      const it = D.ITEMS[p.equipment[slot]]; if (!it) continue;
      s.atk += it.atk || 0; s.def += it.def || 0; s.hp += it.hp || 0; s.crit += it.crit || 0;
      if (slot === 'weapon') s.cd = it.cd || .7;
      for (const [k, v] of Object.entries(it.passive || {})) s[k] += v;
    }
    const oh = D.ITEMS[p.equipment.offhand]; if (oh) { s.arrow = oh.arrow || null; s.spell = oh.spell || null; s.spellPow = oh.sp || 1; }
    ['hp', 'atk', 'def'].forEach(k => (s[k] = Math.round(s[k])));
    return s;
  };
})(window.DSB);
