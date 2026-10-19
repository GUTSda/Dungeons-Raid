/* economy.js — Jobs (Farming, Mining) + Shop + Crafting. Slayer & Boar berjalan di engine (dungeon.js) */
(function (D) {
  const FARM_MS = 8000;
  D.farmReady = (p, i) => p.farm[i] && Date.now() - p.farm[i] >= FARM_MS;
  D.farmProgress = (p, i) => (p.farm[i] ? Math.min(1, (Date.now() - p.farm[i]) / FARM_MS) : 0);
  D.farmAct = function (p, i) {
    if (!p.farm[i]) { p.farm[i] = Date.now(); return 'Gandum ditanam.'; }
    if (!D.farmReady(p, i)) return 'Belum matang.';
    const n = D.rand(2, 4); D.addMat('wheat', n); p.farm[i] = null; return `Panen +${n} 🌾`;
  };
  /* Mining: klik batu sampai durability habis */
  D.mineNew = () => ({ hp: 8 });
  D.mineHit = function (rock) {
    rock.hp -= 1; if (rock.hp > 0) return null;
    const roll = Math.random() * 100, id = roll < 55 ? 'stone' : roll < 80 ? 'copper' : roll < 95 ? 'iron' : 'goldore';
    const n = id === 'stone' ? D.rand(2, 4) : D.rand(1, 2); D.addMat(id, n); rock.hp = 8; return { id, n };
  };

  D.buyItem = function (p, id) {
    const it = D.ITEMS[id];
    if (!it || !it.buy || p.gold < it.price || p.inventory.items.includes(id)) return false;
    p.gold -= it.price; p.inventory.items.push(id); return true;
  };
  D.buyKey = (p, k) => { const c = D.KEYS[k].price; if (p.gold < c) return false; p.gold -= c; p.inventory.keys[k] = (p.inventory.keys[k] || 0) + 1; return true; };
  D.buyPotion = (p) => { if (p.gold < D.POTION.price) return false; p.gold -= D.POTION.price; p.inventory.potions++; return true; };
  D.buyBuff = (p, k) => { const b = D.BUFFPOT[k]; if (!b || p.gold < b.price) return false; p.gold -= b.price; p.inventory.pots[k]++; return true; };
  D.sell = function (p, id, all) {
    const have = p.inventory.mats[id] || 0, n = all ? have : Math.min(1, have); if (!n) return 0;
    p.inventory.mats[id] -= n; D.addGold(n * D.MATS[id].p); return n;
  };
  D.canCraft = (p, k) => Object.entries(D.KEYS[k].recipe).every(([m, q]) => (p.inventory.mats[m] || 0) >= q);
  D.craftKey = function (p, k) {
    if (!D.canCraft(p, k)) return false;
    for (const [m, q] of Object.entries(D.KEYS[k].recipe)) p.inventory.mats[m] -= q;
    p.inventory.keys[k] = (p.inventory.keys[k] || 0) + 1; return true;
  };
})(window.DSB);
