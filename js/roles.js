/* roles.js — role, stat, restriction, jalur rank (Tier 1-4) */
(function (D) {
  D.ROLES = {
    fighter:  { label: 'Fighter',  icon: '⚔️', color: '#e0653a', weapons: ['sword', 'heavy'],          offhand: 'tome', range: 46,  base: { hp: 120, atk: 14, def: 5, spd: 2.0, crit: 5 },
                desc: 'Sword / Heavy Melee. Offhand: Tome (Spell ke-2). Tidak bisa Shield & Wand. Skill: Slam 360°.' },
    mage:     { label: 'Mage',     icon: '🔮', color: '#9b59b6', weapons: ['wand'],                    offhand: 'orb', range: 150, base: { hp: 80,  atk: 18, def: 2, spd: 2.0, crit: 5 },
                desc: 'Hanya Wand + Orb (perluas ledakan). Serangan area kecil. Skill: Arcane Blast.' },
    tank:     { label: 'Tank',     icon: '🛡️', color: '#3498db', weapons: ['sword'],                   offhand: 'shield',  range: 46,  base: { hp: 160, atk: 10, def: 9, spd: 1.8, crit: 3 },
                desc: 'Sword + Shield. Taunt (musuh agro lebih jauh). Skill: Bulwark.' },
    archer:   { label: 'Archer',   icon: '🏹', color: '#6fae3c', weapons: ['bow'],                     offhand: 'quiver', range: 190, base: { hp: 90,  atk: 15, def: 3, spd: 2.2, crit: 8 },
                desc: 'Bow + Quiver tipe panah (racun/es/api/petir). Skill: Volley.' },
    assassin: { label: 'Assassin', icon: '🗡️', color: '#c0392b', weapons: ['sword', 'light', 'dagger'], offhand: 'relic', range: 40,  base: { hp: 85,  atk: 13, def: 2, spd: 2.8, crit: 20 },
                desc: 'Light Sword & Dagger + Relic. Speed + Crit. Skill: Shadow Dash.' }
  };
  D.ROLE_ORDER = ['fighter', 'mage', 'tank', 'archer', 'assassin'];

  D.TIER_NAMES = {
    fighter:  ['Fighter', 'Warrior', 'Grand Warrior', 'Vanguard'],
    mage:     ['Mage', 'Archmage', 'Grand Mage', 'Magus'],
    tank:     ['Tank', 'Guardian', 'Grand Tank', 'Bulwark'],
    archer:   ['Archer', 'Marksman', 'Grand Archer', 'Windrunner'],
    assassin: ['Assassin', 'Shadowblade', 'Grand Shadowblade', 'Phantom']
  };
  D.TIER_MULT = [1, 1.35, 1.8, 2.5];
  D.tierName = (p) => D.TIER_NAMES[p.role][p.tier - 1];

  /* Syarat naik rank (key = tier tujuan) */
  D.ADVANCE = {
    2: { level: 10, depth: 5,  trial: 'Soul Trial' },
    3: { level: 25, depth: 15, trial: 'Trial of Valor' },
    4: { level: 40, depth: 30, trial: 'Apex Trial',
         quest: { desc: 'Hardcore Quest: serahkan 10 Ember Core & bunuh 150 monster', mats: { ember: 10 }, kills: 150 },
         ach:   { desc: 'Achievement: capai Dungeon Level 40 & kumpulkan 5.000 Gold seumur hidup' } }
  };

  D.advanceInfo = function (p) {
    const t = p.tier + 1, r = D.ADVANCE[t];
    if (!r) return null;
    const checks = [
      { ok: p.level >= r.level, label: `Level ${r.level} (sekarang ${p.level})` },
      { ok: (p.stats.depth || 0) >= r.depth, label: `Capai Dungeon Level ${r.depth} (terbaik ${p.stats.depth || 0})` }
    ];
    const base = checks.every(c => c.ok);
    checks.push({ ok: !!p.trials[t], label: `Lulus ${r.trial}` });
    if (r.quest) {
      const hasMats = Object.entries(r.quest.mats).every(([k, v]) => (p.inventory.mats[k] || 0) >= v);
      checks.push({ ok: hasMats && p.stats.kills >= r.quest.kills, label: `${r.quest.desc} (kill ${p.stats.kills}/${r.quest.kills})` });
      const ach = (p.stats.depth || 0) >= 40 && p.stats.goldEarned >= 5000;
      checks.push({ ok: ach, label: r.ach.desc });
    }
    return { tier: t, name: D.TIER_NAMES[p.role][t - 1], req: r, checks, canTrial: base && !p.trials[t], canAdvance: checks.every(c => c.ok) };
  };
  D.advance = function (p) {
    const i = D.advanceInfo(p); if (!i || !i.canAdvance) return false;
    if (i.req.quest) for (const [k, v] of Object.entries(i.req.quest.mats)) p.inventory.mats[k] -= v;
    p.tier = i.tier; return true;
  };
})(window.DSB);
