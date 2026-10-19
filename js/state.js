/* state.js — global namespace, struktur data player, save/load */
window.DSB = window.DSB || {};
(function (D) {
  const KEY = 'dsb_save_v1';
  D.rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
  D.state = null;

  D.newPlayer = function (role) {
    return {
      role, tier: 1, level: 1, exp: 0, gold: 120,
      inventory: { items: [], mats: {}, keys: {}, potions: 2, pots: { dmg: 0, def: 0 } },
      equipment: { weapon: null, offhand: null, armor: null },
      activeBuffs: [],            // mis. {id:'bossPenalty', name, dropMult}
      bossDeathCount: {},         // {bossId: jumlah mati pada run aktif}
      cleared: {},                // {dungeonId:true}
      trials: {},                 // {tierTujuan:true}
      stats: { kills: 0, goldEarned: 0, depth: 0 },   // depth = level dungeon terdalam yang boss-nya dikalahkan
      enchant: { dmg: 0 },        // enchantment permanen (Enchantment Table)
      farm: [null, null, null, null, null, null], // timestamp tanam
      tutorialDone: false
    };
  };
  D.addGold = (n) => { D.state.gold += n; D.state.stats.goldEarned += n; };
  D.addMat = (id, n = 1) => { const m = D.state.inventory.mats; m[id] = (m[id] || 0) + n; };
  D.save = () => { try { localStorage.setItem(KEY, JSON.stringify(D.state)); } catch (e) {} };
  D.load = () => {
    try { const r = localStorage.getItem(KEY); if (r) { D.state = JSON.parse(r); const iv = D.state.inventory; iv.pots = Object.assign({ dmg: 0, def: 0 }, iv.pots);
      const s = D.state, k = iv.keys, c = s.cleared || {}; s.enchant = Object.assign({ dmg: 0 }, s.enchant);   // migrasi save lama
      s.stats.depth = Math.max(s.stats.depth || 0, c.cave ? 5 : 0, c.crypt ? 15 : 0, c.forge ? 30 : 0);
      if (k.cave || k.crypt || k.forge) { k.dungeon = (k.dungeon || 0) + (k.cave || 0) + (k.crypt || 0) + (k.forge || 0); delete k.cave; delete k.crypt; delete k.forge; }
      return true; } } catch (e) {}
    return false;
  };
  D.wipe = () => { try { localStorage.removeItem(KEY); } catch (e) {} D.state = null; };
})(window.DSB);
