/* game.js — UI, tutorial, render loop, input, scaler (base architecture dari game lama: 960×540 + rotate hint + loop) */
(function (D) {
  const $ = (s) => document.querySelector(s), ui = $('#ui'), cv = $('#cv'), ctx = cv.getContext('2d'), T = D.T;
  const U = { screen: 'role', tab: 'weapon', all: false, mine: D.mineNew(), tut: 0, modal: null };
  const fmt = (n) => Math.floor(n).toLocaleString('id-ID');
  const P = () => D.state;

  /* ---------- scaler (dari game lama) ---------- */
  let rotated = false, Tf = { rot: false, s: 1, a: 0, b: 0 };
  function scale() {
    const w = innerWidth, h = innerHeight, sc = $('#gameScaler');
    rotated = h > w; // portrait → putar otomatis jadi landscape
    if (!rotated) { const s = Math.min(w / 960, h / 540); Tf = { rot: false, s, a: (w - 960 * s) / 2, b: (h - 540 * s) / 2 }; sc.style.transform = `translate(${(w - 960 * s) / 2}px,${(h - 540 * s) / 2}px) scale(${s})`; }
    else { const s = Math.min(h / 960, w / 540); Tf = { rot: true, s, a: (w + 540 * s) / 2, b: (h - 960 * s) / 2 }; sc.style.transform = `translate(${(w + 540 * s) / 2}px,${(h - 960 * s) / 2}px) rotate(90deg) scale(${s})`; }
  }
  addEventListener('orientationchange', () => setTimeout(scale, 100));
  // coba kunci landscape + fullscreen saat sentuhan pertama (jika didukung browser)
  addEventListener('pointerdown', function f() {
    removeEventListener('pointerdown', f);
    try { const r = document.documentElement.requestFullscreen; r && r.call(document.documentElement).then(() => screen.orientation.lock('landscape')).catch(() => {}); } catch (e) {}
  }, { once: true });
  addEventListener('resize', scale); scale();
  function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => (t.style.display = 'none'), 1800); }

  /* ---------- helpers UI ---------- */
  const topbar = () => {
    const p = P(), s = D.calcStats(p);
    return `<div class="top"><b>${D.ROLES[p.role].icon} ${D.tierName(p)}</b><span>Lv ${p.level} <span class="dim">(${p.exp}/${D.expFor(p.level)})</span></span>
    <span>❤ ${s.hp}</span><span>⚔ ${s.atk}</span><span>🛡 ${s.def}</span><span>🎯 ${s.crit}%</span><span class="gold" style="margin-left:auto">🪙 ${fmt(p.gold)}</span></div>`;
  };
  const back = `<button data-a="go:town">⬅ Kembali ke Lobby</button>`;
  const itemRow = (it, right) => `<div class="row"><span style="font-size:20px">${it.icon}</span><span class="nm"><b class="${it.rarity}">${it.name}</b><br><span class="dim">${D.itemStr(it)}${it.lv > 1 ? ' · Lv ' + it.lv : ''}</span></span>${right}</div>`;
  const matsStr = (m) => Object.entries(m).map(([k, v]) => `${D.MATS[k].i}${v}`).join(' ') || '-';

  /* ---------- screens ---------- */
  const S = {};
  const ROLE_PLAY = {
    fighter: 'Petarung jarak dekat dengan HP tebal. Tebas pakai Sword atau Heavy, lalu bersihkan kerumunan dengan skill Slam 360°.',
    mage: 'Menyerang dari jarak menengah pakai Wand dengan damage area kecil. HP tipis, jadi jaga jarak. Skill: Arcane Blast.',
    tank: 'Sword + Shield. Menarik agro musuh dari jarak lebih jauh dan paling tahan pukul. Skill: Bulwark.',
    archer: 'Menembak dari jarak terjauh pakai Bow. Kiting musuh sambil terus bergerak. Skill: Volley.',
    assassin: 'Paling cepat dengan crit tinggi, tapi rapuh. Masuk, habisi, kabur. Skill: Shadow Dash.'
  };
  S.role = () => `<div class="rs"><div class="stage">${D.ROLE_ORDER.map(k => { const r = D.ROLES[k], b = r.base;
    return `<div class="p" style="--c:${r.color}" data-a="pick:${k}"><div class="bg" style="background-image:url(img/${k}_bg.jpg)"></div><div class="ch" style="background-image:url(img/${k}.png)"></div><div class="nm">${r.label}</div><div class="info"><p class="pl">${ROLE_PLAY[k]}</p>
    <div class="st"><span>HP <b>${b.hp}</b></span><span>ATK <b>${b.atk}</b></span><span>DEF <b>${b.def}</b></span><span>CRIT <b>${b.crit}%</b></span><span>SPD <b>${b.spd}</b></span></div></div></div>`; }).join('')}</div></div>`;

  S.town = () => topbar() + `<div class="lhud">
    <button class="gear" data-a="set" title="Settings">⚙</button>
    <div class="lbtns-l"><button data-a="go:inv">🎒 Inventori (I)</button></div>
    <div class="lbtns-r"><button class="pri" data-a="lint">E<br>Bicara</button></div></div>` + (U.vn ? vnHtml() : '');

  S.jobs = () => topbar() + `<div class="body"><h2>⛏ Pekerjaan</h2>${back}<div class="grid g2" style="margin-top:8px">
    <div class="card"><h3>⚔ Slayer (Goa)</h3><p class="dim">Bunuh monster yang terus respawn. Gold + bahan.</p><button class="pri" data-a="job:job_slayer">Mulai</button></div>
    <div class="card"><h3>🐗 Wild Boar Hunting</h3><p class="dim">Berburu babi liar → Daging & Taring (jual di Shop).</p><button class="pri" data-a="job:job_boar">Mulai</button></div>
    <div class="card"><h3>🌾 Farming</h3><p class="dim">Tanam & panen Gandum (8 detik).</p><button class="pri" data-a="go:farm">Mulai</button></div>
    <div class="card"><h3>🪨 Mining</h3><p class="dim">Pukul batu → Batu, Tembaga, Besi, Emas.</p><button class="pri" data-a="go:mine">Mulai</button></div></div></div>`;

  S.farm = () => { const p = P(); return topbar() + `<div class="body"><h2>🌾 Farming</h2><button data-a="go:jobs">⬅ Pekerjaan</button><p class="dim">Gandum: ${p.inventory.mats.wheat || 0}</p>
    <div class="grid g3" style="margin-top:8px">${p.farm.map((t, i) => { const rd = D.farmReady(p, i); return `<div class="card plot" data-a="farm:${i}">${!t ? '🟫 <span class="dim" style="font-size:12px">Tanam</span>' : rd ? '🌾 <b style="font-size:12px;color:var(--grass)">Panen!</b>' : `🌱<div class="bar" style="width:80px"><i style="width:${D.farmProgress(p, i) * 100}%"></i></div>`}</div>`; }).join('')}</div></div>`; };

  S.mine = () => topbar() + `<div class="body"><h2>🪨 Mining</h2><button data-a="go:jobs">⬅ Pekerjaan</button>
    <div class="card" style="text-align:center;margin-top:10px"><div style="font-size:90px;cursor:pointer" data-a="mine">⛏🪨</div>
    <div class="bar" style="width:240px;margin:6px auto"><i style="width:${U.mine.hp / 8 * 100}%"></i></div><p class="dim">Klik batu! ${U.last || ''}</p><p>${matsStr(P().inventory.mats)}</p></div></div>`;

  S.shop = () => {
    const p = P(), tabs = { weapon: 'Senjata', armor: 'Armor/Offhand', unique: 'Unique', keys: 'Dungeon Key', supply: 'Suplai', sell: 'Jual Bahan', craft: 'Craft Key' };
    let b = '';
    const all = Object.values(D.ITEMS);
    const gear = (list) => list.filter(it => it.buy && (U.all || D.canUse(it, p).ok || p.level < it.lv && !D.canUse(it, p).why.includes('tidak') && !D.canUse(it, p).why.includes('Eksklusif'))).map(it => {
      const own = p.inventory.items.includes(it.id), c = D.canUse(it, p);
      return itemRow(it, `${c.ok ? '' : `<span class="no">${c.why}</span>`}<span class="gold">${fmt(it.price)}🪙</span><button data-a="buy:${it.id}" ${own || p.gold < it.price ? 'disabled' : ''}>${own ? 'Dimiliki' : 'Beli'}</button>`);
    }).join('') || '<p class="dim">Tidak ada.</p>';
    if (U.tab === 'weapon') b = gear(all.filter(i => i.slot === 'weapon' && !i.unique));
    if (U.tab === 'armor') b = gear(all.filter(i => (i.slot === 'armor' || i.slot === 'offhand') && !i.unique));
    if (U.tab === 'unique') b = gear(all.filter(i => i.unique)) + all.filter(i => i.unique && i.recipe && (U.all || D.canUse(i, p).ok)).map(it => {
      const own = p.inventory.items.includes(it.id), c = D.canUse(it, p), need = Object.entries(it.recipe).map(([m, q]) => `${D.MATS[m].i}${q} (${p.inventory.mats[m] || 0})`).join(' ');
      return itemRow(it, `${c.ok ? '' : `<span class="no">${c.why}</span>`}<span class="dim">Craft: ${need} + </span><span class="gold">${fmt(it.price)}🪙</span><button data-a="ucraft:${it.id}" ${own || !D.canCraftUnique(p, it.id) ? 'disabled' : ''}>${own ? 'Dimiliki' : 'Craft'}</button>`);
    }).join('');
    if (U.tab === 'keys') b = Object.entries(D.KEYS).map(([k, v]) => `<div class="row"><span style="font-size:20px">🗝</span><span class="nm"><b>${v.n}</b> <span class="dim">(punya ${p.inventory.keys[k] || 0}) · ${D.DUNGEON.n}</span></span><span class="gold">${fmt(v.price)}🪙</span><button data-a="key:${k}" ${p.gold < v.price ? 'disabled' : ''}>Beli</button></div>`).join('');
    if (U.tab === 'supply') b = `<div class="row"><span style="font-size:20px">🧪</span><span class="nm"><b>Ramuan Heal</b> <span class="dim">(punya ${p.inventory.potions}) · pulihkan 40% HP · tombol F</span></span><span class="gold">${D.POTION.price}🪙</span><button data-a="potion" ${p.gold < D.POTION.price ? 'disabled' : ''}>Beli</button></div>`
      + Object.entries(D.BUFFPOT).map(([k, v]) => `<div class="row"><span style="font-size:20px">${v.i}</span><span class="nm"><b>${v.n}</b> <span class="dim">(punya ${p.inventory.pots[k]}) · ${v.desc} · tombol ${k === 'dmg' ? 'G' : 'H'}</span></span><span class="gold">${v.price}🪙</span><button data-a="bpot:${k}" ${p.gold < v.price ? 'disabled' : ''}>Beli</button></div>`).join('');
    if (U.tab === 'sell') b = Object.entries(p.inventory.mats).filter(([, v]) => v > 0).map(([k, v]) => `<div class="row"><span style="font-size:20px">${D.MATS[k].i}</span><span class="nm"><b>${D.MATS[k].n}</b> ×${v}</span><span class="gold">${D.MATS[k].p}🪙/pcs</span><button data-a="sell:${k}:0">Jual 1</button><button data-a="sell:${k}:1">Jual Semua</button></div>`).join('') || '<p class="dim">Belum punya bahan. Kerjakan pekerjaan dulu!</p>';
    if (U.tab === 'craft') b = Object.entries(D.KEYS).map(([k, v]) => `<div class="row"><span style="font-size:20px">🗝</span><span class="nm"><b>${v.n}</b><br><span class="dim">Butuh: ${Object.entries(v.recipe).map(([m, q]) => `${D.MATS[m].i}${q} (${p.inventory.mats[m] || 0})`).join(' ')}</span></span><button class="pri" data-a="craft:${k}" ${D.canCraft(p, k) ? '' : 'disabled'}>Craft</button></div>`).join('');
    return topbar() + `<div class="body"><h2>🛒 Shop</h2>${back}<div class="tabs" style="margin-top:6px">${Object.entries(tabs).map(([k, v]) => `<button class="${U.tab === k ? 'on' : ''}" data-a="tab:${k}">${v}</button>`).join('')}
    ${['weapon', 'armor', 'unique'].includes(U.tab) ? `<button data-a="all">${U.all ? '☑' : '☐'} Tampilkan semua role</button>` : ''}</div>${b}</div>`;
  };

  S.inv = () => {
    const p = P(), eq = Object.entries(p.equipment).map(([s, id]) => `<span class="card" style="display:inline-block;margin:2px">${s}: <b>${id ? D.ITEMS[id].name : '-'}</b></span>`).join('');
    const owned = p.inventory.items.map(id => D.ITEMS[id]).map(it => { const c = D.canUse(it, p), on = p.equipment[it.slot] === it.id;
      return itemRow(it, `${c.ok ? '' : `<span class="no">${c.why}</span>`}<button data-a="equip:${it.id}" ${!c.ok || on ? 'disabled' : ''}>${on ? 'Terpasang' : 'Equip'}</button>`); }).join('');
    return topbar() + `<div class="body"><h2>🎒 Inventori</h2>${back}<div style="margin:6px 0">${eq}</div>
    <p>Kunci: ${Object.entries(D.KEYS).map(([k, v]) => `🗝${v.n} ×${p.inventory.keys[k] || 0}`).join(' · ')} · 🧪 ×${p.inventory.potions} · 💥 ×${p.inventory.pots.dmg} · 🛡 ×${p.inventory.pots.def}</p><p>Bahan: ${matsStr(p.inventory.mats)}</p>
    <p>Enchant: 🗡️ Damage Lv ${p.enchant.dmg}/5 (+${Math.round(D.enchantDmg(p) * 100)}% ATK)</p><p>Buff aktif: ${p.activeBuffs.map(b => b.name).join(', ') || '-'}</p><div style="margin-top:8px">${owned}</div></div>`;
  };

  S.dungeon = () => { const p = P(), d = D.DUNGEON, k = p.inventory.keys.dungeon || 0; return topbar() + `<div class="body"><h2>${d.i} ${d.n}</h2>${back}<p class="dim" style="margin:6px 0">Satu dungeon, level tak terbatas. Tiap level punya boss acak di ujung map; kalahkan untuk membuka portal ke level berikutnya. Key hanya terpakai saat masuk. Mati saat melawan boss: respawn dekat boss, <b>drop chance Boss ×50% per kematian</b> di level itu.</p>
    <div class="card" style="max-width:420px"><h3>Level terdalam: ${p.stats.depth || 0}</h3><p class="dim">Kunci Dungeon: ${k}<br>Enchant Damage: Lv ${p.enchant.dmg} / 5</p>
    <button class="pri" data-a="dun:dungeon" ${k > 0 ? '' : 'disabled'}>Masuk (Level 1)</button><button data-a="craftgo:dungeon">Beli/Craft Key</button></div></div>`; };

  S.rank = () => { const p = P(), i = D.advanceInfo(p);
    return topbar() + `<div class="body"><h2>👑 Rank Hall</h2>${back}<p style="margin:8px 0">Rank saat ini: <b>${D.tierName(p)}</b> (Tier ${p.tier})</p>${D.PA.html(p)}` + (!i ? '<p class="gold">Kamu sudah di Apex Rank!</p>' :
      `<div class="card"><h3>Menuju: ${i.name} (Tier ${i.tier})</h3>${i.checks.map(c => `<div class="chk ${c.ok ? 'ok' : 'no'}">${c.ok ? '✔' : '✖'} ${c.label}</div>`).join('')}
      <div style="margin-top:8px"><button data-a="trial:${i.tier}" ${i.canTrial ? '' : 'disabled'}>⚔ Mulai ${i.req.trial}</button><button class="pri" data-a="adv" ${i.canAdvance ? '' : 'disabled'}>Naik Rank</button></div></div>`) + '</div>'; };

  /* ---------- tutorial ---------- */
  const TUT = [
    ['1. Bergerak', 'Gerak dengan <b>WASD / Panah</b> atau sentuh &amp; geser layar. Karaktermu adalah <b>kursor panah</b>: ujung runcingnya menunjukkan arah hadapmu. Tekan <b>E</b> untuk bicara dengan NPC atau masuk portal.'],
    ['2. Role Awal', 'Role menentukan senjata. Fighter: Sword/Heavy. Mage: Wand. Tank: Sword+Shield. Archer: Bow. Assassin: Light Sword/Dagger. Unique Item eksklusif per role.'],
    ['3. Pekerjaan', 'Bicara dengan <b>Rena</b> (Mandor) untuk cari Gold: Slayer & Babi Liar (bertarung), Farming (Gandum), Mining (ore). Hasilnya dijual ke <b>Bram</b> → Jual Bahan.'],
    ['4. Toko', 'Beli senjata/armor sesuai role dari <b>Bram</b>, lalu Equip di Inventori (tombol I). Semua item dibeli langsung — tidak ada gacha atau pity.'],
    ['5. Dungeon & Rank', 'Masuk <b>Portal Dungeon</b> (butuh Key: beli / craft dari bahan). Jelajahi, buka peti (E), kalahkan boss di ujung map, lalu masuk portal ke level berikutnya. Tiap 2 level ada Pedagang. Kadang kamu terlempar ke level .5: ada patung Aspect (buff sesuai role) dan Enchantment Table. Mati di Boss = respawn dekat boss, drop Boss ×50% per kematian. Naik tier lewat <b>Gareth</b> di Rank Hall.'],
    ['6. Bertarung', '<b>Klik kiri</b> (boleh ditahan) untuk menyerang ke arah mouse. <b>Tahan Spasi</b> atau tombol Skill untuk membidik: hologram biru menunjukkan jangkauan, geser mouse untuk arah, lepas untuk cast. Mau batal? Lepas di lingkaran ⭕ kanan atas (berubah merah) atau klik kanan. Di HP: tahan tombol Skill lalu geser jari. <b>Shift</b> = Dash (Mage/Tank pendek, Fighter/Archer sedang, Assassin terjauh). <b>Tahan F</b> = roda ramuan (Heal / ATK / DEF): geser mouse ke pilihan lalu lepas. Tap F = ramuan terakhir dipakai. Semua ramuan berbagi cooldown 5 detik. <b>G/H</b> = pintasan ramuan ATK/DEF. <b>R</b> = Spell ke-2 Fighter (butuh Tome). Pegang <b>Unique Item</b> → dapat pola serangan khusus + 4 skill terpisah di <b>Z X C V</b> (V = Ultimate); skill Spasi tetap berlaku untuk semua senjata. <b>Serangan boss selalu punya indikator merah</b>: area terisi penuh = serangan mendarat. Keluar dari area atau Dash sebelum penuh.']
  ];
  function tutorial() {
    const [t, d] = TUT[U.tut], last = U.tut === TUT.length - 1;
    return `<div class="modal"><div class="card"><h2>📖 ${t}</h2><p>${d}</p><div style="margin-top:12px;text-align:right">${last ? '<button class="pri" data-a="tutend">Mulai Bermain</button>' : `<button data-a="tutskip">Lewati</button><button class="pri" data-a="tut:${U.tut + 1}">Lanjut</button>`}</div></div></div>`;
  }

  /* ---------- play HUD ---------- */
  function hud() {
    const R = D.run, p = P();
    return `<div class="hud"><div class="l"><div>${D.ROLES[p.role].icon} Lv ${p.level} — HP <span id="hpt"></span></div><div class="bar hp"><i id="hpb"></i></div><div id="asp" style="margin-top:3px"></div><div class="dim" id="buff"></div><div class="dim" id="pas" style="color:#e8b94a"></div></div>
    <div class="r"><span id="lvl"></span><br><span id="earn"></span><br><button data-a="exit">Keluar</button></div>
    <div class="bb" id="bossw" style="display:none"><span id="bossn"></span><div class="bar bossbar"><i id="bossb"></i></div></div>
    <div class="msg" id="msg"></div>
    <div class="btns3" id="uq">${['z', 'x', 'c', 'v'].map(k => `<button data-uk="${k}" id="uq_${k}" style="display:none"></button>`).join('')}</div>
    <div class="btnsC"><button data-a="dsh">💨 Shift<br><span id="dsc"></span></button>${p.role === 'fighter' ? '<button data-a="sp2">📖 R<br><span id="spc"></span></button>' : ''}<button data-a="pot" id="potb"><span id="poti">🧪</span> F <span id="potc"></span><br><span id="potd"></span></button><button data-a="int">E<br>Interaksi</button></div>
    <div class="btns"><button class="pri" id="btnAtk">⚔<br>Serang</button><button class="pri" id="btnSkl">Skill<br><span id="skc"></span></button></div><div id="pw"></div>
    <div id="done"></div><div id="pop"></div></div>`;
  }
  function doneModal(d) {
    return `<div class="modal"><div class="card"><h2>${d.win ? '🏆' : ''} ${d.title}</h2><p class="dim">${d.note || ''}</p><div style="margin:8px 0">${d.loot.map(l => `<div class="row">${l.i} ${l.t}</div>`).join('')}</div><button class="pri" data-a="exit">Kembali ke Lobby</button></div></div>`;
  }

  /* teks Aspect dengan efek asap (CSS, lihat style.css) */
  const smokeText = (a, big) => `<span class="aspect${big ? ' big' : ''}" style="--c:${a.c};--g:${a.g}"><span class="aspect-t">${a.name}</span>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<i style="--x:${6 + i * 12}%;--d:${(i * .33).toFixed(2)}s;--dx:${(i % 2 ? 1 : -1) * (6 + i * 2)}px"></i>`).join('')}</span>`;
  function popModal(o) {
    const p = P(), R = D.run;
    if (o.type === 'aspect') { const a = R.aspect; return `<div class="modal"><div class="card" style="text-align:center;padding:26px"><p class="dim">Escort Of Heroes</p><div style="margin:18px 0 10px">${smokeText(a, true)}</div><p>${a.txt}</p><p class="dim" style="margin:6px 0 14px">Berlaku sampai kamu keluar dari dungeon.</p><button class="pri" data-a="popok">Terima Berkat</button></div></div>`; }
    if (o.type === 'enchant') return `<div class="modal"><div class="card" style="text-align:center;padding:24px"><h2>✨ Enchantment</h2><p>🗡️ Damage <b>Lv ${o.lv}</b> / 5</p><p class="gold">ATK +${Math.round(D.ENCHANT.dmg.v[o.lv - 1] * 100)}% (permanen)</p><button class="pri" style="margin-top:12px" data-a="popok">Lanjut</button></div></div>`;
    if (o.type === 'loot') return `<div class="modal"><div class="card"><h2>🏆 ${o.title}</h2><p class="dim">${o.note || ''}</p><div style="margin:8px 0">${o.loot.map(l => `<div class="row">${l.i} ${l.t}</div>`).join('')}</div><button class="pri" data-a="popok">Lanjut</button></div></div>`;
    if (o.type === 'trader') return `<div class="modal"><div class="card"><h2>🧙 Pedagang Dungeon <span class="gold" style="float:right">🪙 ${fmt(p.gold)}</span></h2><p class="dim">Barang pedagang ini hanya ada di level ini.</p>${o.prop.stock.map((s, i) => `<div class="row"><span style="font-size:20px">${s.i}</span><span class="nm"><b>${s.n}</b><br><span class="dim">${s.d}</span></span><span class="gold">${fmt(s.price)}🪙</span><button data-a="tbuy:${i}" ${s.sold || p.gold < s.price ? 'disabled' : ''}>${s.sold ? 'Terjual' : 'Beli'}</button></div>`).join('')}<div style="text-align:right;margin-top:8px"><button class="pri" data-a="popok">Tutup</button></div></div></div>`;
    return '';
  }

  /* ---------- Settings (⚙): kode, tutorial, reset ---------- */
  function settings() {
    const m = U.codeMsg;
    return `<div class="modal"><div class="card" style="width:420px"><h2>⚙ Settings</h2>
    <div class="dim" style="margin-bottom:4px">Kode</div>
    <div style="display:flex;gap:6px"><input id="codeIn" class="set-in" type="text" maxlength="24" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Masukkan kode"><button class="pri" style="margin:0" data-a="redeem">Pakai</button></div>
    <p class="${m && m.ok ? 'chk ok' : 'chk no'}" style="min-height:20px;margin-top:6px">${m ? m.msg : ''}</p>
    ${D.Mob ? D.Mob.settingsHTML() : ''}<div style="margin-top:10px"><button data-a="tut:0">📖 Tutorial</button><button class="dng" data-a="reset">Reset Save</button></div>
    <div style="text-align:right;margin-top:10px"><button class="pri" data-a="setx">Tutup</button></div></div></div>`;
  }
  function redeemCode() {
    const i = $('#codeIn'); U.codeMsg = D.redeem(P(), i ? i.value : ''); if (U.codeMsg.ok) toast(U.codeMsg.msg); render();
  }

  /* ---------- render & actions ---------- */
  function render() {
    const live = U.screen === 'play' || U.screen === 'town';
    ui.className = live ? 'play' : ''; cv.style.display = live ? 'block' : 'none';
    ui.innerHTML = (U.screen === 'play' ? hud() : S[U.screen]()) + (U.modal === 'tut' ? tutorial() : '') + (U.modal === 'set' ? settings() : '');
    if (U.modal === 'set') setTimeout(() => { const i = $('#codeIn'); if (i && !(D.Mob && D.Mob.active())) i.focus(); D.Mob && D.Mob.bind(ui); });
    if (U.vn && U.vn.done) vnDone();
  }
  const go = (s) => { if (s === 'train') { if (D.startRun('training')) { U.aim = U.atk = null; U.screen = 'play'; render(); } return; } U.screen = s; if (s === 'town') D.save(); render(); };

  /* ---------- pemilihan role: hover/inspect + animasi zoom → blackout → fade ke lobby ---------- */
  const noHover = () => matchMedia('(hover:none)').matches;
  const inspect = (el) => { const rs = el && el.closest('.rs'); if (!rs) return; rs.classList.add('has-insp'); rs.querySelectorAll('.p').forEach(n => n.classList.toggle('insp', n === el)); };
  document.addEventListener('mouseover', (e) => { if (U.picking || noHover()) return; const el = e.target.closest && e.target.closest('.rs .p'); if (el) inspect(el); });
  document.addEventListener('mouseout', (e) => {
    if (U.picking || noHover()) return; const rs = e.target.closest && e.target.closest('.rs'); if (!rs) return;
    if (e.relatedTarget && rs.contains(e.relatedTarget)) return;
    rs.classList.remove('has-insp'); rs.querySelectorAll('.p').forEach(n => n.classList.remove('insp'));
  });
  function pickRole(el, role) {
    if (U.picking) return;
    if (noHover() && !el.classList.contains('insp')) { inspect(el); return; } // layar sentuh: tap 1 = inspect, tap 2 = pilih
    U.picking = true;
    const rs = el.closest('.rs'), fade = $('#fade'), txt = $('#pickTxt');
    inspect(el); rs.classList.add('picking');
    fade.style.transition = 'opacity .8s ease'; fade.style.opacity = 1;          // langsung blackout
    setTimeout(() => txt.classList.add('on'), 800);                               // tulisan muncul di atas layar hitam
    setTimeout(() => txt.classList.remove('on'), 2400);
    setTimeout(() => {
      D.state = D.newPlayer(role); D.giveStarter(D.state); U.tut = 0; go('town');
      void fade.offsetWidth; fade.style.transition = 'opacity 2.4s ease-in-out'; fade.style.opacity = 0;   // fade in perlahan ke lobby
      setTimeout(() => { U.picking = false; U.modal = 'tut'; render(); }, 2500);
    }, 3000);
  }
  { const sc = $('#gameScaler'); const f = document.createElement('div'); f.id = 'fade'; const t = document.createElement('div'); t.id = 'pickTxt'; t.textContent = 'ROLE TERPILIH'; sc.appendChild(f); sc.appendChild(t); }

  /* ---------- lobby: interaksi & dialog visual novel ---------- */
  function lobbyInteract() {
    if (U.vn || U.modal || U.picking) return;
    const t = D.Lobby.near();
    if (!t) { toast('Dekati NPC atau Portal, lalu tekan E'); return; }
    if (t.type === 'npc') vnOpen(t.id); else go('dungeon');
  }
  function vnEnter() { const v = U.vn, nd = D.NPCS[v.id].nodes[v.node]; v.text = typeof nd.t === 'function' ? nd.t(P()) : nd.t; v.shown = 0; v.done = false; }
  function vnOpen(id) { U.vn = { id, node: D.NPCS[id].start }; vnEnter(); render(); }
  function vnClose() { U.vn = null; render(); }
  function vnHtml() {
    const v = U.vn, n = D.NPCS[v.id], ch = n.nodes[v.node].ch || [];
    return `<div class="vn" data-a="vnclick" style="--c:${n.color}"><div class="vn-portrait">${n.icon}</div><div class="vn-stack">
      <div class="vn-choices hid" id="vnch">${ch.map((c, i) => `<button data-a="vnc:${i}">${i + 1}. ${c.t}</button>`).join('')}</div>
      <div class="vn-box"><div class="vn-name">${n.name}<small>${n.title}</small></div><div class="vn-text" id="vnt"></div><div class="vn-next" id="vnn">▼</div></div></div></div>`;
  }
  function vnDone() {
    const v = U.vn; if (!v) return; v.done = true; v.shown = v.text.length;
    const t = $('#vnt'), c = $('#vnch'), nx = $('#vnn'), hasCh = (D.NPCS[v.id].nodes[v.node].ch || []).length > 0;
    if (t) t.textContent = v.text; if (c) c.classList.remove('hid'); if (nx) nx.style.visibility = hasCh ? 'hidden' : 'visible';
  }
  function vnTick(dt) {
    const v = U.vn; if (!v || v.done) return;
    v.shown = Math.min(v.text.length, v.shown + dt * 55); const t = $('#vnt'); if (t) t.textContent = v.text.slice(0, Math.floor(v.shown));
    if (v.shown >= v.text.length) vnDone();
  }
  function vnAdvance() {
    const v = U.vn; if (!v) return; if (!v.done) { vnDone(); return; }
    const nd = D.NPCS[v.id].nodes[v.node]; if (nd.ch && nd.ch.length) return;
    if (nd.next) { v.node = nd.next; vnEnter(); render(); } else vnClose();
  }
  function vnChoose(i) {
    const v = U.vn; if (!v) return; if (!v.done) { vnDone(); return; }
    const c = (D.NPCS[v.id].nodes[v.node].ch || [])[i]; if (!c) return;
    if (c.go) { U.vn = null; go(c.go); } else if (c.n) { v.node = c.n; vnEnter(); render(); } else vnClose();
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]'); if (!el) return;
    const [a, x, y] = el.dataset.a.split(':'), p = P();
    switch (a) {
      case 'go': go(x); return;
      case 'set': U.modal = 'set'; U.codeMsg = null; render(); return;
      case 'setx': U.modal = null; render(); return;
      case 'mobedit': U.modal = null; render(); D.Mob && D.Mob.edit(true); return;          // editor posisi & ukuran tombol (js/mobile.js)
      case 'redeem': redeemCode(); return;
      case 'lint': lobbyInteract(); return;
      case 'vnclick': vnAdvance(); return;
      case 'vnc': vnChoose(+x); return;
      case 'pick': pickRole(el, x); return;
      case 'tut': U.modal = 'tut'; U.tut = +x; break;
      case 'tutskip': case 'tutend': U.modal = null; p.tutorialDone = true; D.save(); break;
      case 'reset': if (confirm('Hapus save & mulai dari awal?')) { D.wipe(); go('role'); } return;
      case 'job': D.startRun(x); U.screen = 'play'; break;
      case 'farm': toast(D.farmAct(p, +x)); break;
      case 'mine': { const r = D.mineHit(U.mine); U.last = r ? `+${r.n} ${D.MATS[r.id].n}` : ''; if (r) toast(U.last); break; }
      case 'tab': U.tab = x; break;
      case 'all': U.all = !U.all; break;
      case 'buy': D.buyItem(p, x) && toast('Dibeli!'); break;
      case 'key': D.buyKey(p, x) && toast('Key dibeli'); break;
      case 'potion': D.buyPotion(p); break;
      case 'bpot': D.buyBuff(p, x) && toast('Dibeli!'); break;
      case 'sell': { const n = D.sell(p, x, +y); n && toast(`Terjual ${n}`); break; }
      case 'craft': D.craftKey(p, x) && toast('Key di-craft!'); break;
      case 'ucraft': D.craftUnique(p, x) ? toast('Unique di-craft!') : toast('Bahan / Gold kurang'); break;
      case 'craftgo': U.tab = 'keys'; U.screen = 'shop'; break;
      case 'equip': D.equip(p, x); break;
      case 'dun': if (D.startRun('dungeon', x)) U.screen = 'play'; break;
      case 'trial': D.startRun('trial', +x); U.screen = 'play'; break;
      case 'adv': if (D.advance(p)) toast('Rank naik! 🎉'); break;
      case 'popok': D.closePop(); break;
      case 'tbuy': D.traderBuy(+x); break;
      case 'exit': D.leaveRun(); U.aim = U.atk = null; U.screen = 'town'; break;
      case 'pot': potUse(U.potSel || 'heal'); return;
      case 'int': D.act('interact'); return;
      case 'skl': D.act('skill'); return;
      case 'dsh': dashPress(); return;
      case 'bd': potUse('dmg'); return;
      case 'bf': potUse('def'); return;
      case 'sp2': spellPress(); return;
    }
    D.save(); render();
  });
  setInterval(() => { if (U.screen === 'farm') render(); }, 1000);

  /* ---------- input ---------- */
  const keys = {};
  addEventListener('keydown', (e) => {
    if (U.screen === 'town' && U.modal === 'set') { if (e.code === 'Escape') { U.modal = null; render(); } else if (e.code === 'Enter') redeemCode(); return; }   // sedang mengetik kode
    keys[e.code] = true;
    if (U.screen === 'town') {
      if (e.repeat || U.modal || U.picking) return;
      if (U.vn) {
        if (['Space', 'Enter', 'KeyE'].includes(e.code)) { vnAdvance(); e.preventDefault(); }
        else if (/^Digit[1-9]$/.test(e.code)) vnChoose(+e.code.slice(5) - 1);
        else if (e.code === 'Escape') vnClose();
        return;
      }
      if (e.code === 'KeyE') lobbyInteract(); else if (e.code === 'KeyI') go('inv');
      return;
    }
    if (U.screen !== 'play') return;
    if (D.run && D.run.pop) { if (!e.repeat && (e.code === 'Escape' || e.code === 'Enter' || e.code === 'KeyE')) { D.closePop(); render(); } return; }
    if (e.code === 'Space') { if (!e.repeat) aimStart({ pointerId: 'key', pointerType: 'mouse' }); e.preventDefault(); } if (e.code === 'Escape') { U.aim = null; U.pw = null; } if (e.code === 'KeyE') D.act('interact'); if (e.code === 'KeyF' && !e.repeat) potDown('key', 'key'); if (e.code === 'KeyG' && !e.repeat) potUse('dmg'); if (e.code === 'KeyH' && !e.repeat) potUse('def');
    if (!e.repeat && UK[e.code]) uniqPress(UK[e.code]);
    if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) dashPress(); if (e.code === 'KeyR' && !e.repeat) spellPress();
  });
  addEventListener('keyup', (e) => { keys[e.code] = false; if (e.code === 'KeyF') potEnd(); if (UK[e.code]) D.Uniq.release(UK[e.code]); if (e.code === 'Space' && U.aim && U.aim.pid === 'key') aimEnd(); });
  let stick = null;
  /* posisi pointer dalam koordinat game (960×540), sudah memperhitungkan scale & rotasi layar */
  const M = { gx: 480, gy: 270 }, CC = { x: 878, y: 215, r: 42 };   // CC = lingkaran batal skill (kanan atas)
  const toGame = (cx, cy) => (Tf.rot ? { gx: (cy - Tf.b) / Tf.s, gy: (Tf.a - cx) / Tf.s } : { gx: (cx - Tf.a) / Tf.s, gy: (cy - Tf.b) / Tf.s });
  function setM(e) { if (U.aim && U.aim.src === 'touch' && U.aim.pid !== e.pointerId) return; const g = toGame(e.clientX, e.clientY); M.gx = g.gx; M.gy = g.gy; }
  const mouseWorld = () => { const z = D.Cine.unzoom(M.gx, M.gy); return { x: z.gx + (D.cam ? D.cam.x : 0), y: z.gy + (D.cam ? D.cam.y : 0) }; };
  function mobilePoint() { // tombol Serang (sentuh): bidik musuh terdekat, kalau tidak ada → arah hadap
    const R = D.run; { const oa = U.ov != null ? U.ov : U.atkAng; if (oa != null) return { x: R.p.x + Math.cos(oa) * 100, y: R.p.y + Math.sin(oa) * 100 }; }
    let t = null, bd = R.s.range + 60;
    for (const m of R.mobs) if (!m.dead) { const d = Math.hypot(m.x - R.p.x, m.y - R.p.y); if (d < bd) { bd = d; t = m; } }
    return t ? { x: t.x, y: t.y } : { x: R.p.x + Math.cos(U.face || 0) * 60, y: R.p.y + Math.sin(U.face || 0) * 60 };
  }
  /* ----- bidik skill: tahan → geser → lepas (cast) / lepas di lingkaran batal (cancel) ----- */
  function aimStart(e) {
    const R = D.run; if (!R || R.done || U.aim) return;
    if (R.skT > 0) { toast('Skill belum siap'); return; }
    const touch = e.pointerType === 'touch'; let o = null;
    if (touch) { const r = $('#btnSkl').getBoundingClientRect(); o = toGame(r.left + r.width / 2, r.top + r.height / 2); }
    U.atk = null; U.aim = { pid: e.pointerId, src: touch ? 'touch' : 'mouse', o, cancel: false, ult: D.PA.ultReady(R) };
  }
  function aimTarget() {
    const R = D.run, sk = D.SKILLS[P().role], a = U.aim; let ang, len;
    if (a.src === 'mouse') { const w = mouseWorld(), vx = w.x - R.p.x, vy = w.y - R.p.y; ang = Math.atan2(vy, vx); len = Math.hypot(vx, vy); }
    else { const vx = M.gx - a.o.gx, vy = M.gy - a.o.gy, l = Math.hypot(vx, vy); if (l > 14) { ang = Math.atan2(vy, vx); len = Math.min(1, l / 90) * sk.range; } else { ang = U.face || 0; len = sk.range; } }
    len = sk.type === 'self' ? 0 : Math.min(len, sk.range);
    return { x: R.p.x + Math.cos(ang) * len, y: R.p.y + Math.sin(ang) * len, ang, len };
  }
  function aimEnd() {
    const a = U.aim; if (!a) return; const R = D.run, t = aimTarget();
    a.cancel = Math.hypot(M.gx - CC.x, M.gy - CC.y) < CC.r; U.aim = null;
    if (a.ult) { if (a.cancel) D.PA.ultCancel(R); else D.PA.ultRelease(R); return; }   // Mage T3: lepas = black hole meledak
    if (!a.cancel && R && !R.done) { D.act('skill', t); U.fa = t.ang; U.fh = .35; }
  }
  function combatInput() {
    const R = D.run; if (!R || R.done) { U.aim = null; U.atk = null; D.Uniq.atkCancel(); return; }
    if (U.aim) { D.Uniq.atkCancel(); const t = aimTarget(); U.aim.cancel = Math.hypot(M.gx - CC.x, M.gy - CC.y) < CC.r; U.fa = t.ang; U.fh = .15;
      if (U.aim.ult && D.PA.ultHold(R, t.x, t.y) === 'done') U.aim = null; return; }
    if (U.atk) { const w = U.atk === 'mouse' ? mouseWorld() : mobilePoint(); U.fa = Math.atan2(w.y - R.p.y, w.x - R.p.x); U.fh = .3; if (D.Uniq.hasHold()) D.Uniq.atkDown(w.x, w.y); else D.attack(w.x, w.y); }   // Unique dgn Hold Attack: tap = serang, tahan = charge
    else D.Uniq.atkUp();
  }
  document.addEventListener('pointerdown', (e) => {
    setM(e); if (U.screen !== 'play') return;
    const ub = e.target.closest && e.target.closest('[data-uk]'); if (ub) { e.preventDefault(); U.ukPid = e.pointerId; U.ukKey = ub.dataset.uk; uniqPress(U.ukKey); return; }
    const b = e.target.closest && e.target.closest('#btnSkl, #btnAtk'); if (!b) return; e.preventDefault();
    if (b.id === 'btnSkl') aimStart(e); else if (!U.aim) { U.atk = 'btn'; U.atkPid = e.pointerId; }
  });
  cv.addEventListener('pointerdown', (e) => {
    setM(e);
    if (U.screen === 'play' && e.pointerType === 'mouse') { if (e.button === 0 && !U.aim) U.atk = 'mouse'; return; }   // mouse = serang; sentuh = joystick
    if (D.Mob && D.Mob.active()) return;   // kontrol mobile (js/mobile.js) punya joystick sendiri
    stick = { x: e.clientX, y: e.clientY, id: e.pointerId };
  });
  addEventListener('contextmenu', (e) => { if (U.screen === 'play') { e.preventDefault(); U.aim = null; } });
  addEventListener('blur', () => { U.pw = null; U.aim = null; U.atk = null; D.Uniq.releaseAll(); });
  addEventListener('pointermove', (e) => { setM(e); if (stick && e.pointerId === stick.id) { let dx = e.clientX - stick.x, dy = e.clientY - stick.y; if (rotated) { const t = dx; dx = dy; dy = -t; } const l = Math.hypot(dx, dy); keys._sx = l > 12 ? dx / Math.max(l, 50) : 0; keys._sy = l > 12 ? dy / Math.max(l, 50) : 0; } });
  addEventListener('pointerup', (e) => {
    if (U.ukKey && U.ukPid === e.pointerId) { D.Uniq.release(U.ukKey); U.ukKey = null; }
    if (e.pointerType === 'mouse' && U.atk === 'mouse') U.atk = null;
    if (U.atk === 'btn' && U.atkPid === e.pointerId) U.atk = null;
    if (U.aim && U.aim.pid === e.pointerId) aimEnd();
    if (stick && e.pointerId === stick.id) { stick = null; keys._sx = keys._sy = 0; }
  });
  addEventListener('pointercancel', (e) => {
    if (U.ukKey && U.ukPid === e.pointerId) { D.Uniq.release(U.ukKey); U.ukKey = null; }
    if (U.atk === 'btn' && U.atkPid === e.pointerId) U.atk = null; if (U.aim && U.aim.pid === e.pointerId) U.aim = null;
    if (stick && e.pointerId === stick.id) { stick = null; keys._sx = keys._sy = 0; }
  });
  /* ----- Skill Unique Item (Z X C V): hanya aktif kalau pegang senjata/offhand Unique ----- */
  const UK = { KeyZ: 'z', KeyX: 'x', KeyC: 'c', KeyV: 'v' };
  function uniqPress(k) {
    const R = D.run; if (!R || R.done || R.pop || !D.Uniq.cur()) return;
    const w = (noHover() || U.ov != null) ? mobilePoint() : mouseWorld(), ang = Math.atan2(w.y - R.p.y, w.x - R.p.x);
    if (D.Uniq.press(k, { x: w.x, y: w.y, ang })) { U.fa = ang; U.fh = .3; }
  }
  /* Dash: arah = input gerak; kalau diam → arah mouse (PC) / arah hadap (HP). Spell 2 selalu ke arah bidik. */
  const mouseAng = () => { const R = D.run, w = mouseWorld(); return Math.atan2(w.y - R.p.y, w.x - R.p.x); };
  function dashPress(a) {
    const R = D.run; if (!R || R.done || R.dash || R.dsT > 0) return;
    const l = Math.hypot(D.input.dx, D.input.dy), ang = a != null ? a : l > .12 ? Math.atan2(D.input.dy, D.input.dx) : noHover() ? (U.face || 0) : mouseAng();
    D.act('dash', { ang }); U.fa = ang; U.fh = .25;
  }
  function spellPress(a) {
    const R = D.run; if (!R || R.done) return;
    if (!R.s.spell) { toast('Spell 2: pasang Tome (khusus Fighter) di Inventori'); return; }
    if (R.sp2T > 0) return;
    const ang = a != null ? a : noHover() ? (U.face || 0) : mouseAng(); D.act('spell2', { ang }); U.fa = ang; U.fh = .3;
  }

  /* ----- Ramuan: roda (tahan F / tahan tombol) + cooldown bersama 5 detik ----- */
  const POT_CD = 5, PO = [{ k: 'heal', i: '🧪', n: 'Heal', a: -90 }, { k: 'dmg', i: '💥', n: 'ATK', a: 30 }, { k: 'def', i: '🛡️', n: 'DEF', a: 150 }];
  const potCount = (k) => { const iv = P().inventory; return k === 'heal' ? iv.potions : iv.pots[k]; };
  function potUse(k) {
    const R = D.run; if (!R || R.done || R.pop) return false; U.potSel = k;
    if (R.potT > 0) { toast('Ramuan cooldown ' + Math.ceil(R.potT) + ' dtk'); return false; }
    if (!potCount(k)) { toast('Ramuan habis'); return false; }
    if (k === 'heal') { if (R.hp >= R.s.hp) { toast('HP sudah penuh'); return false; } D.act('potion'); } else D.act('buff', k);
    R.potT = POT_CD; return true;
  }
  function potDown(src, pid) { const R = D.run; if (!R || R.done || R.pop || U.pw) return; U.pw = { src, pid, t: 0, open: false, sel: U.potSel || 'heal' }; }
  function potPick(dx, dy) {
    if (!U.pw || Math.hypot(dx, dy) < 24) return; const a = Math.atan2(dy, dx); let best = PO[0], bd = 9;
    for (const o of PO) { const d = Math.abs((((a - o.a * Math.PI / 180 + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI) - Math.PI); if (d < bd) { bd = d; best = o; } }
    U.pw.sel = best.k;
  }
  function uniqAimTick() { const R = D.run; if (!R || !R.u || !R.u.hold || !D.Uniq.aimHold) return; const w = (noHover() || U.ov != null) ? mobilePoint() : mouseWorld(); D.Uniq.aimHold(Math.atan2(w.y - R.p.y, w.x - R.p.x)); }   // skill Hold ikut arah bidik terkini
  function potTick(rdt) { const w = U.pw; if (!w) return; w.t += rdt; if (w.t > .22) w.open = true; if (w.open && w.src === 'key') potPick(M.gx - 480, M.gy - 270); }
  function potEnd() { const w = U.pw; U.pw = null; if (w) potUse(w.open ? w.sel : (U.potSel || 'heal')); }
  function potUI() {
    const R = D.run, sel = U.pw && U.pw.open ? U.pw.sel : (U.potSel || 'heal'), o = PO.find(x => x.k === sel), cd = R.potT > 0 ? Math.ceil(R.potT) + 's' : '';
    const b = $$('potb'); if (b) { $$('poti').textContent = o.i; $$('potc').textContent = '(' + potCount(sel) + ')'; $$('potd').textContent = cd || 'Siap'; }
    const w = $$('pw'); if (!w) return;
    if (!(U.pw && U.pw.open)) { if (w._h) { w._h = ''; w.innerHTML = ''; } return; }
    const h = PO.map(x => `<div class="pwo${x.k === sel ? ' on' : ''}" style="left:${480 + Math.cos(x.a * Math.PI / 180) * 84}px;top:${270 + Math.sin(x.a * Math.PI / 180) * 84}px"><span>${x.i}</span><small>${x.n} ×${potCount(x.k)}</small></div>`).join('') + `<div class="pwc">${cd}</div>`;
    if (w._h !== h) { w._h = h; w.innerHTML = h; }
  }
  function faceUpdate(dt) {
    if (U.fh > 0) { U.fh -= dt; U.ft = U.fa; }          // sedang menyerang / membidik → hadap ke bidikan
    else { const l = Math.hypot(D.input.dx, D.input.dy); if (l > .12) U.ft = Math.atan2(D.input.dy, D.input.dx); }
    U.face = D.turnAngle(U.face || 0, U.ft || 0, dt * 16);
  }
  function readInput() {
    let dx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), dy = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    D.input.dx = dx || keys._sx || 0; D.input.dy = dy || keys._sy || 0;
  }

  /* ---------- draw ---------- */
  function draw() {
    const R = D.run; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 960, 540);
    D.Cine.begin(ctx);                                                      // zoom sinematik (js/cinematic.js)
    ctx.save(); { const sk = D.FX.shake(R); ctx.translate(sk.x, sk.y); }   // screen shake
    const cx = R.w * T < 960 ? -(960 - R.w * T) / 2 : Math.max(0, Math.min(R.w * T - 960, R.p.x - 480)), cy = R.h * T < 540 ? -(540 - R.h * T) / 2 : Math.max(0, Math.min(R.h * T - 540, R.p.y - 270));
    D.cam = { x: cx, y: cy };
    const x0 = Math.max(0, Math.floor(cx / T)), x1 = Math.min(R.w - 1, Math.ceil((cx + 960) / T)), y0 = Math.max(0, Math.floor(cy / T)), y1 = Math.min(R.h - 1, Math.ceil((cy + 540) / T));
    const pr = { x: R.p.x, y: R.p.y }, vis = (x, y) => (R.arena || R.kind !== 'dungeon' || R.half) ? true : Math.hypot(x - pr.x, y - pr.y) < 7 * T;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * R.w + x; if (!R.ex[i]) continue;
      const px = x * T - cx, py = y * T - cy, v = vis(x * T + 16, y * T + 16);
      if (R.m[i]) { ctx.fillStyle = (x + y) & 1 ? R.def.floor : shade(R.def.floor); ctx.fillRect(px, py, T, T); }
      else { ctx.fillStyle = '#1b1d18'; ctx.fillRect(px, py, T, T); ctx.fillStyle = '#2c2f27'; ctx.fillRect(px, py, T, 4); }
      if (!v) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(px, py, T, T); }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '22px serif';
    drawProps(R, cx, cy); drawTele(R, cx, cy);
    for (const c of R.chests) if (R.ex[Math.floor(c.y / T) * R.w + Math.floor(c.x / T)]) ctx.fillText(c.open ? '📭' : '🎁', c.x - cx, c.y - cy);
    for (const m of R.mobs) { if (m.dead || !vis(m.x, m.y)) continue; if (m.soul) { soulDraw(m, cx, cy); continue; } ctx.font = (m.isBoss ? 44 : 22 * (m.seq && m.cast ? 1 + .25 * Math.min(1, m.seq.t / Math.max(.3, m.seq.dur)) : 1)) + 'px serif'; ctx.fillText(m.i, m.x - cx + (m.hf > 0 ? (Math.random() - .5) * 4 : 0), m.y - cy);
      if (m.cast && !m.isBoss) { ctx.font = 'bold 11px sans-serif'; ctx.fillStyle = '#ffc9a8'; ctx.fillText(m.cast, m.x - cx, m.y - cy - 28); }
      if (m.hf > 0) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(m.x - cx, m.y - cy, m.r + 3, 0, 7); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; }
      if (!m.isBoss) { ctx.fillStyle = '#300'; ctx.fillRect(m.x - cx - 12, m.y - cy - 18, 24, 3); ctx.fillStyle = '#d1503f'; ctx.fillRect(m.x - cx - 12, m.y - cy - 18, 24 * m.hp / m.max, 3); } }
    for (const q of R.smoke) { const a = q.life / q.max, rr = q.r * (2 - a), gx = q.x - cx, gy = q.y - cy, gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
      gr.addColorStop(0, rgba(R.aspect.c, .55 * a)); gr.addColorStop(1, rgba(R.aspect.c, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(gx, gy, rr, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ff7a3a'; for (const q of R.proj) { ctx.beginPath(); ctx.arc(q.x - cx, q.y - cy, 5, 0, 7); ctx.fill(); }
    for (const f of R.fx) { ctx.strokeStyle = f.c; ctx.lineWidth = 3; ctx.globalAlpha = Math.min(1, f.life * 4); ctx.beginPath(); if (f.rad) ctx.arc(f.x - cx, f.y - cy, (1 - f.life * 3) * 120 + 20, 0, 7); else { ctx.moveTo(f.x1 - cx, f.y1 - cy); ctx.lineTo(f.x2 - cx, f.y2 - cy); } ctx.stroke(); ctx.globalAlpha = 1; }
    D.PA.draw(ctx, R, cx, cy); D.Uniq.draw(ctx, R, cx, cy); drawAim(cx, cy);
    ctx.globalAlpha = (R.inv > 0 && ((R.t * 20) | 0) % 2 ? .4 : 1) * D.PA.alpha(R); D.FX.draw(ctx, R, cx, cy, U.face || 0, D.ROLES[P().role].color);
    if (R.shield > 0) { ctx.strokeStyle = '#5aa0d8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(R.p.x - cx, R.p.y - cy, 20, 0, 7); ctx.stroke(); } ctx.globalAlpha = 1;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; for (const f of R.ft) { ctx.font = f.big ? 'bold 21px sans-serif' : 'bold 14px sans-serif'; ctx.strokeText(f.t, f.x - cx, f.y - cy); ctx.fillStyle = f.c; ctx.fillText(f.t, f.x - cx, f.y - cy); }
    ctx.restore(); D.Cine.end(ctx);
    if (R.kind === 'dungeon' && !R.arena && !R.half) { // minimap
      const k = 2, ox = 960 - R.w * k - 12, oy = 70; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(ox - 2, oy - 2, R.w * k + 4, R.h * k + 4);
      for (let y = 0; y < R.h; y++) for (let x = 0; x < R.w; x++) if (R.ex[y * R.w + x] && R.m[y * R.w + x]) { ctx.fillStyle = '#6b7263'; ctx.fillRect(ox + x * k, oy + y * k, k, k); }
      for (const q of R.props) if (R.ex[Math.floor(q.y / T) * R.w + Math.floor(q.x / T)]) { ctx.fillStyle = q.k === 'trader' ? '#e8b94a' : '#8a5cff'; ctx.fillRect(ox + q.x / T * k - 1, oy + q.y / T * k - 1, 4, 4); }
      ctx.fillStyle = '#7bbf45'; ctx.fillRect(ox + R.p.x / T * k - 1, oy + R.p.y / T * k - 1, 4, 4);
    }
    if (U.aim) drawCancel();
    D.Cine.overlay(ctx);                                                    // vignette + letterbox + flash (paling atas)
  }
  /* indikator skill: hologram biru (merah saat akan dibatalkan). Hanya jarak/area, tanpa angka damage. */
  const rgba = (h, a) => { const n = parseInt(h.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const plate = (t, x, y, fg) => { ctx.font = 'bold 11px sans-serif'; const w = ctx.measureText(t).width + 12; ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - w / 2, y - 9, w, 18); ctx.fillStyle = fg; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1); };
  function puffs(x, y, col, t, n, h) { for (let i = 0; i < n; i++) { const ph = (t * .45 + i / n) % 1, px = x + Math.sin(t * 2 + i * 2.3) * 10, py = y - ph * h, rr = 6 + ph * 14, gr = ctx.createRadialGradient(px, py, 0, px, py, rr);
    gr.addColorStop(0, rgba(col, .5 * (1 - ph))); gr.addColorStop(1, rgba(col, 0)); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(px, py, rr, 0, 7); ctx.fill(); } }
  /* patung Aspect, Enchantment Table, Pedagang, Portal */
  function drawProps(R, cx, cy) {
    const t = performance.now() / 1000;
    for (const q of R.props) {
      if (!R.ex[Math.floor(q.y / T) * R.w + Math.floor(q.x / T)]) continue;
      const x = q.x - cx, y = q.y - cy; ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      if (q.k === 'statue') {
        const a = D.ASPECTS[P().role]; ctx.fillStyle = '#4a4f58'; ctx.fillRect(x - 22, y + 8, 44, 14); ctx.fillStyle = '#5d636d'; ctx.fillRect(x - 16, y - 2, 32, 12);
        ctx.shadowColor = a.g; ctx.shadowBlur = q.used ? 6 : 24; ctx.font = '46px serif'; ctx.globalAlpha = q.used ? .55 : 1; ctx.fillText(D.ROLES[P().role].icon, x, y - 20 + Math.sin(t * 2) * 2);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0; puffs(x, y - 8, a.c === '#0c0c12' ? '#1a1a22' : a.c, t, 6, 70); plate(q.used ? 'Patung (sudah menerima berkat)' : a.name, x, y + 34, a.g);
      } else if (q.k === 'table') {
        ctx.fillStyle = '#3d2f5a'; ctx.fillRect(x - 24, y - 4, 48, 22); ctx.fillStyle = '#6f56a8'; ctx.fillRect(x - 28, y - 10, 56, 10);
        ctx.shadowColor = '#8fc4ff'; ctx.shadowBlur = q.used ? 4 : 18; ctx.font = '26px serif'; ctx.globalAlpha = q.used ? .5 : 1; ctx.fillText('📖', x, y - 20 + Math.sin(t * 3) * 2); ctx.globalAlpha = 1;
        ctx.shadowBlur = 0; plate('Enchantment Table', x, y + 34, '#8fc4ff');
      } else if (q.k === 'trader') {
        ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x, y + 12, 14, 5, 0, 0, 7); ctx.fill(); ctx.font = '34px serif'; ctx.fillText('🧙', x, y + Math.sin(t * 2) * 1.5); plate('Pedagang', x, y - 28, '#e8b94a');
      } else if (q.k === 'portal') {
        ctx.shadowColor = '#8a5cff'; ctx.shadowBlur = 20; ctx.lineWidth = 3;
        for (let i = 0; i < 3; i++) { const a0 = t * (1.4 + i * .35) * (i % 2 ? -1 : 1); ctx.strokeStyle = i % 2 ? '#6fe0ff' : '#b08aff'; ctx.beginPath(); ctx.ellipse(x, y - 4, 16 + i * 4, 26 + i * 3, 0, a0, a0 + Math.PI * 1.3); ctx.stroke(); }
        ctx.shadowBlur = 0; plate(R.half ? `Ke Level ${R.lv + 1}` : 'Portal', x, y + 38, '#d8c8ff');
      }
      ctx.restore();
    }
  }
  /* indikator serangan boss: garis putus-putus + isian yang membesar; putih = sebentar lagi mendarat */
  function drawTele(R, cx, cy) {
    const T0 = performance.now() / 1000;
    for (const o of R.tele) {
      const p = Math.min(1, o.t / o.wind), x = o.x - cx, y = o.y - cy, hot = p > .82;
      ctx.save(); ctx.lineWidth = 2; ctx.shadowBlur = 12; ctx.shadowColor = 'rgba(255,70,70,.9)'; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -T0 * 30;
      ctx.strokeStyle = hot ? 'rgba(255,255,255,.95)' : 'rgba(255,90,90,.95)';
      const base = 'rgba(255,60,60,.10)', fill = `rgba(255,${hot ? 140 : 60},${hot ? 120 : 60},${.2 + .25 * p})`;
      if (o.shape === 'circle') { ctx.fillStyle = base; ctx.beginPath(); ctx.arc(x, y, o.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, o.r * p, 0, 7); ctx.fill(); }
      else if (o.shape === 'cone') { for (const [rr, f, s] of [[o.r, base, 1], [o.r * p, fill, 0]]) { ctx.fillStyle = f; ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, rr, o.a - o.span, o.a + o.span); ctx.closePath(); ctx.fill(); if (s) ctx.stroke(); } }
      else if (o.shape === 'line') { ctx.translate(x, y); ctx.rotate(o.a); ctx.fillStyle = base; ctx.fillRect(0, -o.w / 2, o.len, o.w); ctx.strokeRect(0, -o.w / 2, o.len, o.w); ctx.fillStyle = fill; ctx.fillRect(0, -o.w / 2, o.len * p, o.w); }
      else if (o.shape === 'ring') { ctx.beginPath(); ctx.arc(x, y, o.r1, 0, 7); ctx.arc(x, y, o.r0, 0, 7, true); ctx.fillStyle = fill; ctx.fill('evenodd'); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, o.r0, 0, 7); ctx.stroke(); }
      else if (o.shape === 'pulse') { ctx.beginPath(); ctx.arc(x, y, o.r * (.3 + .7 * p), 0, 7); ctx.stroke(); }
      ctx.restore();
    }
  }
  /* Soul = kursor dirimu sendiri, diperbesar, berselimut aura ungu */
  function soulDraw(m, cx, cy) {
    const x = m.x - cx, y = m.y - cy, t = performance.now() / 1000, g = ctx.createRadialGradient(x, y, 4, x, y, 50);
    g.addColorStop(0, 'rgba(190,150,255,.38)'); g.addColorStop(1, 'rgba(190,150,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 50 + Math.sin(t * 3) * 3, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(x, y); ctx.scale(1.9, 1.9); ctx.globalAlpha = .92; D.drawCursor(ctx, 0, 0, m.face || 0, D.ROLES[m.soul].color); ctx.restore();
    if (m.hf > 0) { ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.fill(); }
  }
  function drawAim(cx, cy) {
    const R = D.run, a = U.aim; if (!a) return;
    const sk = D.SKILLS[P().role], t = aimTarget(), col = a.cancel ? '255,77,77' : '80,190,255', T0 = performance.now() / 1000;
    const px = R.p.x - cx, py = R.p.y - cy, tx = t.x - cx, ty = t.y - cy;
    ctx.save(); ctx.lineWidth = 2; ctx.shadowBlur = 14; ctx.shadowColor = `rgba(${col},.9)`; ctx.strokeStyle = `rgba(${col},.95)`; ctx.fillStyle = `rgba(${col},.16)`;
    ctx.setLineDash([8, 6]); ctx.lineDashOffset = -T0 * 30;
    if (sk.type !== 'self') {
      ctx.globalAlpha = .4; ctx.beginPath(); ctx.arc(px, py, sk.range, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;   // jangkauan maksimum
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(tx, ty); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(tx, ty, sk.rad, 0, 7); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.globalAlpha = .7; ctx.beginPath(); ctx.arc(tx, ty, sk.rad * (.4 + .12 * Math.sin(T0 * 4)), 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(tx - 7, ty); ctx.lineTo(tx + 7, ty); ctx.moveTo(tx, ty - 7); ctx.lineTo(tx, ty + 7); ctx.stroke();
    ctx.restore();
  }
  function drawCancel() {
    const red = U.aim.cancel, col = red ? '255,77,77' : '80,190,255', t = performance.now() / 1000;
    ctx.save(); ctx.shadowColor = `rgba(${col},.9)`; ctx.shadowBlur = 16; ctx.fillStyle = `rgba(${col},.18)`; ctx.strokeStyle = `rgba(${col},.95)`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(CC.x, CC.y, CC.r, 0, 7); ctx.fill(); ctx.stroke();
    ctx.setLineDash([6, 6]); ctx.lineDashOffset = -t * 24; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(CC.x, CC.y, CC.r - 9, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(CC.x - 11, CC.y - 11); ctx.lineTo(CC.x + 11, CC.y + 11); ctx.moveTo(CC.x + 11, CC.y - 11); ctx.lineTo(CC.x - 11, CC.y + 11); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = `rgb(${col})`; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(red ? 'LEPAS = BATAL' : 'BATAL', CC.x, CC.y + CC.r + 16);
    ctx.restore();
  }
  const shade = (c) => { const n = parseInt(c.slice(1), 16); return '#' + ((((n >> 16) & 255) * .88 | 0) << 16 | (((n >> 8) & 255) * .88 | 0) << 8 | ((n & 255) * .88 | 0)).toString(16).padStart(6, '0'); };
  const $$ = (id) => document.getElementById(id);
  function hudUpdate() {
    const R = D.run, b = R.boss && !R.boss.dead && (R.arena || R.boss.eng) ? R.boss : null, p = P();
    $$('hpt').textContent = `${Math.ceil(R.hp)}/${R.s.hp}`; $$('hpb').style.width = (R.hp / R.s.hp * 100) + '%';
    $$('buff').textContent = p.activeBuffs.map(x => '☠ ' + x.name).join(' ') + (R.bf.atk.t > 0 ? ' ⚔ATK ' + Math.ceil(R.bf.atk.t) + 's' : '') + (R.bf.def.t > 0 ? ' 🛡DEF ' + Math.ceil(R.bf.def.t) + 's' : '') + (R.bf.ls.t > 0 ? ' 🩸LS ' + Math.ceil(R.bf.ls.t) + 's' : '');
    $$('earn').textContent = `+${fmt(R.earn.gold)}🪙 +${R.earn.exp}xp`; potUI();
    $$('dsc').textContent = R.dsT > 0 ? R.dsT.toFixed(1) + 's' : 'Siap'; if ($$('spc')) $$('spc').textContent = !R.s.spell ? 'no Tome' : R.sp2T > 0 ? Math.ceil(R.sp2T) + 's' : 'Siap'; $$('skc').textContent = R.skT > 0 ? Math.ceil(R.skT) + 's' : 'Siap';
    $$('msg').textContent = R.msg; $$('bossw').style.display = b ? 'block' : 'none'; if (b) { $$('bossn').textContent = `${b.n} — ${fmt(b.hp)} / ${fmt(b.max)}`; $$('bossb').style.width = (b.hp / b.max * 100) + '%'; }
    { const sl = D.Uniq.slots(R); ['z', 'x', 'c', 'v'].forEach((k, i) => { const b = $$('uq_' + k); if (!b) return; if (!sl) { b.style.display = 'none'; return; }
        b.style.display = ''; const s = sl[i], h = `${s.i} ${k.toUpperCase()}<br><span style="font-size:10px">${s.n}</span><br>${s.st}`; if (b._h !== h) { b._h = h; b.innerHTML = h; } b.style.background = s.on ? '#4d7a2c' : ''; }); }
    $$('lvl').textContent = D.levelLabel(R); $$('pas').textContent = D.PA.hud(R);
    { const np = !R.pop && D.nearProp(); if (np) $$('msg').textContent = np.k === 'portal' ? (R.half ? `E: Lanjut ke Level ${R.lv + 1}` : 'E: Masuk Portal') : np.k === 'trader' ? 'E: Dagang dengan Pedagang' : np.k === 'statue' ? (np.used ? '' : 'E: Terima berkat dewa') : (np.used ? '' : 'E: Pakai Enchantment Table'); }
    if (R.aspect && !$$('asp').innerHTML) $$('asp').innerHTML = smokeText(R.aspect);
    if (R.pop && !$$('pop').innerHTML) $$('pop').innerHTML = popModal(R.pop); else if (!R.pop && $$('pop').innerHTML) $$('pop').innerHTML = '';
    if (R.done && !$$('done').innerHTML) $$('done').innerHTML = doneModal(R.done);
  }

  let last = performance.now();
  function loop(now) {
    const rdt = Math.min(.05, (now - last) / 1000); last = now; D.Cine.update(rdt); const dt = rdt * D.Uniq.timeScale(rdt);   // timeScale: slow-motion Unique (Archer X)
    if (U.screen === 'play' && D.run) { if (D.run.potT > 0) D.run.potT -= dt; potTick(rdt); uniqAimTick(); readInput(); combatInput(); faceUpdate(dt); D.update(dt); draw(); hudUpdate(); }
    else if (U.screen === 'town' && D.state) {
      readInput(); const busy = U.vn || U.modal || U.picking, L = D.Lobby;
      L.update(dt, busy ? { dx: 0, dy: 0 } : D.input, D.ROLES[P().role].base.spd);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 960, 540); L.draw(ctx, now / 1000, D.ROLES[P().role].color, !busy); vnTick(dt);
    }
    requestAnimationFrame(loop);
  }

  /* ---------- jembatan untuk js/mobile.js (kontrol sentuh) ---------- */
  D.IO = {
    toGame, get screen() { return U.screen; },
    busy: () => !!(U.vn || U.modal || U.picking || (D.run && (D.run.pop || D.run.done))),
    stick(x, y) { keys._sx = x; keys._sy = y; },
    atk(pid) { if (U.aim) return; U.atk = 'btn'; U.atkPid = pid; },
    atkAim(a) { U.atkAng = a; },
    atkEnd(pid) { if (U.atk === 'btn' && U.atkPid === pid) U.atk = null; U.atkAng = null; },
    isAtk: () => U.atk === 'btn', isAiming: () => !!U.aim,
    skillDown(pid, gx, gy) {                       // sama dengan aimStart(), tapi titik asal wheel = pusat tombol (koordinat game)
      const R = D.run; if (!R || R.done || U.aim) return false;
      if (R.skT > 0) { toast('Skill belum siap'); return false; }
      U.atk = null; U.aim = { pid, src: 'touch', o: { gx, gy }, cancel: false, ult: D.PA.ultReady(R) }; return true;
    },
    ov(a) { U.ov = a; },
    uniqCast(k, a) { U.ov = a; uniqPress(k); U.ov = null; },
    uniqHold(k, pid, a) { U.ov = a; U.ukPid = pid; U.ukKey = k; uniqPress(k); },
    uniqEnd() { U.ov = null; },
    dash: (a) => dashPress(a), spell: (a) => spellPress(a),
    potDown: (pid) => potDown('touch', pid), potVec: (dx, dy) => potPick(dx, dy), potUp: () => potEnd(), potSel: () => U.potSel || 'heal', potCount,
    inv() { if (U.screen === 'town' && !U.vn && !U.modal && !U.picking) go('inv'); },
    interact() { if (U.screen === 'town') lobbyInteract(); else D.act('interact'); }
  };
  /* ---------- boot ---------- */
  if (D.load()) { U.screen = 'town'; D.state.activeBuffs = []; } else U.screen = 'role';
  render(); requestAnimationFrame(loop);
})(window.DSB);
