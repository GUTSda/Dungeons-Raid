/* codes.js — Kode redeem (diisi lewat Settings ⚙). Tambah kode baru = tambah entri di D.CODES.
   Tiap fungsi menerima player (D.state) dan mengembalikan teks hasil. */
(function (D) {
  const bestWeapon = (p) => {
    let best = null, bs = -1;
    for (const it of Object.values(D.ITEMS)) {
      if (it.slot !== 'weapon' || !D.canUse(it, p).ok) continue;
      const sc = (it.atk || 0) * (1 + (it.crit || 0) / 100 * .8) / (it.cd || .7); if (sc > bs) { bs = sc; best = it; }
    }
    return best;
  };
  const bestOf = (p, slot) => {
    let best = null, bs = -1;
    for (const it of Object.values(D.ITEMS)) {
      if (it.slot !== slot || !D.canUse(it, p).ok) continue;
      const sc = (it.atk || 0) * 2 + (it.def || 0) * 2 + (it.hp || 0) * .5 + (it.crit || 0) * 2 + (it.passive ? 20 : 0) + (it.unique ? 40 : 0); if (sc > bs) { bs = sc; best = it; }
    }
    return best;
  };

  D.CODES = {
    /* TESTER: tier tertinggi, Lv 100, semua item, semua bahan, Gold besar, semua trial lulus */
    TESTER(p) {
      p.tier = 4; p.level = 100; p.exp = 0; p.gold = Math.max(p.gold, 9999999);
      for (const id of Object.keys(D.ITEMS)) if (!p.inventory.items.includes(id)) p.inventory.items.push(id);
      if (D.ITEMS.u_frost && !p.inventory.items.includes('u_frost')) p.inventory.items.push('u_frost');   // Frostflake Sword (Fighter) pasti didapat
      for (const id of Object.keys(D.MATS)) p.inventory.mats[id] = Math.max(p.inventory.mats[id] || 0, 999);
      p.inventory.keys.dungeon = Math.max(p.inventory.keys.dungeon || 0, 99); p.inventory.potions = Math.max(p.inventory.potions, 99);
      p.inventory.pots.dmg = Math.max(p.inventory.pots.dmg, 99); p.inventory.pots.def = Math.max(p.inventory.pots.def, 99);
      p.enchant.dmg = 5; p.trials = { 2: true, 3: true, 4: true }; p.tutorialDone = true;
      p.stats.depth = Math.max(p.stats.depth || 0, 40); p.stats.kills = Math.max(p.stats.kills, 150); p.stats.goldEarned = Math.max(p.stats.goldEarned, 5000);
      const w = bestWeapon(p), o = bestOf(p, 'offhand'), a = bestOf(p, 'armor');
      if (w) p.equipment.weapon = w.id;
      if (o) p.equipment.offhand = o.id; if (a) p.equipment.armor = a.id;
      const fz = D.ITEMS.u_frost; if (fz && p.role === 'fighter' && D.canUse(fz, p).ok) p.equipment.weapon = fz.id;   // Fighter: langsung pakai Frostflake Sword
      return `Mode TESTER aktif: ${D.tierName(p)} · Lv 100 · semua item terbuka.`;
    }
  };

  D.redeem = function (p, raw) {
    const code = String(raw || '').trim().toUpperCase();
    if (!code) return { ok: false, msg: 'Masukkan kode dulu.' };
    const fn = D.CODES[code]; if (!fn) return { ok: false, msg: 'Kode tidak valid.' };
    const msg = fn(p); D.save(); return { ok: true, msg };
  };
})(window.DSB);
