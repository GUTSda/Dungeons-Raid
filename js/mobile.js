/* mobile.js — Kontrol sentuh: joystick kiri, ATK kanan (tahan + geser = bidik), tombol skill bulat dengan wheel arah + pie cooldown.
   Tersambung ke game lewat D.IO (jembatan di game.js) dan membaca cooldown ASLI dari D.run / D.Uniq.
   Layout dalam koordinat game 960×540 → ubah di fungsi build(). Pengaturan: D.Mob.settingsHTML() / D.Mob.bind(el). */
(function (D) {
  const LS = 'dsb_mobile', PI = Math.PI;
  const cfg = Object.assign({ mode: 'auto', op: .55, hud: .65, size: 1 }, (() => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(cfg)); } catch (e) {} };
  const coarse = () => (window.matchMedia ? matchMedia('(pointer:coarse)').matches : 'ontouchstart' in window);
  let touched = false;                                        // mode auto: begitu ada sentuhan nyata, kontrol menyala
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !touched) { touched = true; layout(); } }, true);
  const enabled = () => cfg.mode === 'on' || (cfg.mode === 'auto' && (coarse() || touched));

  const API = (D.Mob = { cfg, active: () => enabled() && shown });
  let shown = false;

  /* ===== CSS ===== */
  const st = document.createElement('style');
  st.textContent = `
  #mob{position:absolute;inset:0;z-index:30;pointer-events:none;display:none;touch-action:none;user-select:none;-webkit-user-select:none}
  #mob.on{display:block}
  #mob .ctl{position:absolute;border-radius:50%;pointer-events:auto;touch-action:none;opacity:var(--op,.55);-webkit-tap-highlight-color:transparent;
    display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-weight:bold;text-shadow:0 1px 3px #000;line-height:1;
    background:radial-gradient(circle at 35% 30%,rgba(120,130,108,.9),rgba(28,31,25,.92));border:3px solid rgba(225,235,205,.75)}
  #mob .ctl.press{filter:brightness(1.55);transform:scale(.93)}
  #mob .ctl.on2{border-color:#8fe36b;box-shadow:0 0 12px #8fe36b}
  #mob .ctl.lock{filter:grayscale(1)}
  #mob .ctl.hide{display:none}
  #mob .ico{position:relative;z-index:2;font-size:calc(var(--s)*.42);pointer-events:none}
  #mob .nm{position:relative;z-index:2;font-size:calc(var(--s)*.17);margin-top:2px;pointer-events:none;max-width:92%;white-space:nowrap;overflow:hidden;text-overflow:clip}
  #mob .cdp{position:absolute;inset:0;border-radius:50%;pointer-events:none;z-index:3;background:conic-gradient(rgba(0,0,0,.72) var(--a,0deg),transparent 0)}
  #mob .cdt{position:absolute;inset:0;z-index:4;display:none;align-items:center;justify-content:center;font-size:calc(var(--s)*.36);pointer-events:none;color:#fff}
  #mob .ctl.cool{border-color:rgba(130,130,130,.6)}#mob .ctl.cool .cdt{display:flex}#mob .ctl.cool .ico,#mob .ctl.cool .nm{opacity:.45}
  #mob .cnt{position:absolute;right:-2px;top:-2px;z-index:5;min-width:18px;height:18px;padding:0 4px;border-radius:9px;background:#000c;border:1px solid #fff8;font-size:11px;line-height:16px;text-align:center;pointer-events:none}
  #mob .joy{background:radial-gradient(circle,rgba(255,255,255,.1),rgba(255,255,255,.02));border:3px solid rgba(255,255,255,.4)}
  #mob .joy::before{content:"";position:absolute;inset:-34px;border-radius:50%}
  #mob .knob{position:absolute;width:46%;height:46%;left:27%;top:27%;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid #fff;pointer-events:none}
  #mob .wheel{position:absolute;border-radius:50%;pointer-events:none;border:2px dashed rgba(255,255,255,.9);background:rgba(255,255,255,.07);display:none;z-index:2}
  #mob .wheel i{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;left:50%;top:50%;border-radius:50%;background:#ffd54a;border:2px solid #fff}
  #mob .wheel.show{display:block}
  /* UI game: opacity diturunkan (slider di Settings) */
  .hud .l,.hud .r,.hud .bb,.hud .msg,#dmgfx,#trainPanel{opacity:var(--hud,.65)}
  #gameScaler.cine .hud .l,#gameScaler.cine .hud .r,#gameScaler.cine .hud .bb,#gameScaler.cine .hud .msg{opacity:.15}
  #dmgfx.live,#dmgfx.fin{opacity:var(--hud,.65)}
  /* HUD PC: tombol penting (Serang/Skill) di kanan, Dash/Spell/Ramuan/E kecil di tengah-bawah */
  .hud .btnsC{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);display:flex;gap:5px;opacity:.7;transition:opacity .2s}
  .hud .btnsC:hover{opacity:1}
  .hud .btnsC button{width:60px;height:42px;font-size:11px;line-height:1.15;padding:2px;margin:0;pointer-events:auto}
  .hud .help{left:50%;transform:translateX(-50%);bottom:56px;text-align:center}
  #pw{position:absolute;inset:0;pointer-events:none;z-index:25}
  #pw .pwo{position:absolute;width:74px;height:74px;margin:-37px 0 0 -37px;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:radial-gradient(circle at 35% 30%,rgba(100,110,92,.9),rgba(22,25,20,.92));border:3px solid rgba(225,235,205,.6);color:#fff;text-shadow:0 1px 3px #000;opacity:.85;transition:transform .08s}
  #pw .pwo span{font-size:28px;line-height:1}#pw .pwo small{font-size:10px;margin-top:2px}
  #pw .pwo.on{transform:scale(1.22);border-color:#ffd54a;box-shadow:0 0 18px #ffd54a;opacity:1}
  #pw .pwc{position:absolute;left:480px;top:270px;transform:translate(-50%,-50%);font-size:20px;font-weight:bold;color:#fff;text-shadow:0 2px 4px #000}
  /* tombol bawaan disembunyikan saat kontrol mobile aktif */
  body.mob .hud .btns,body.mob .hud .btnsC,body.mob .hud .btns2,body.mob .hud .btns3,body.mob .hud .help,body.mob .lbtns-l,body.mob .lbtns-r,body.mob .lhelp{display:none!important}
  body.mob .gear{opacity:.5}`;
  document.head.appendChild(st);

  /* ===== DOM ===== */
  const host = document.getElementById('gameScaler') || document.body;
  const root = document.createElement('div'); root.id = 'mob'; host.appendChild(root);
  const items = [];            // semua kontrol: { el, x0, y0, s0, side:'l'|'r', x, y, s, wheel, show:(R)=>bool }
  const ATK = { x: 872, y: 440, s: 96 };

  function add(o) {
    const el = document.createElement('div'); el.className = 'ctl ' + (o.cls || ''); el.innerHTML = o.html || '';
    root.appendChild(el);
    const c = Object.assign({ el, side: 'r', wr: 0 }, o); items.push(c);
    if (c.wr) { const w = document.createElement('div'); w.className = 'wheel'; w.innerHTML = '<i></i>'; root.appendChild(w); c.wheel = w; }
    return c;
  }
  const arc = (ang, r, o) => Object.assign({ x0: ATK.x + Math.cos(ang * PI / 180) * r, y0: ATK.y + Math.sin(ang * PI / 180) * r }, o);

  /* posisi + skala dari cfg.size, dihitung dari sudut layar masing-masing sisi */
  function layout() {
    const k = cfg.size;
    for (const c of items) {
      const ax = c.side === 'l' ? 0 : c.side === 'c' ? 480 : 960, ay = 540;
      c.s = c.s0 * k; c.x = ax + (c.x0 - ax) * k; c.y = ay + (c.y0 - ay) * k;
      c.el.style.cssText = `left:${c.x - c.s / 2}px;top:${c.y - c.s / 2}px;width:${c.s}px;height:${c.s}px;--s:${c.s}px;` + (c.el._d ? 'display:none;' : '');
      if (c.wheel) { const r = c.wr * k; c.wheel.style.cssText = `left:${c.x - r}px;top:${c.y - r}px;width:${r * 2}px;height:${r * 2}px`; }
    }
    root.style.setProperty('--op', cfg.op); document.documentElement.style.setProperty('--hud', cfg.hud);
  }

  /* ===== pointer generik (multi-touch aman, vektor dalam koordinat game) ===== */
  const TOG = (e) => D.IO.toGame(e.clientX, e.clientY);
  function bind(c, h) {
    const el = c.el; let pid = null;
    const vec = (e) => { const g = TOG(e); return { dx: g.gx - c.x, dy: g.gy - c.y }; };
    el.addEventListener('pointerdown', (e) => { if (pid !== null) return; if (c.scene === 'play' && !(D.IO.screen === 'play' && D.run)) { e.preventDefault(); return; } pid = e.pointerId; try { el.setPointerCapture(pid); } catch (x) {} e.preventDefault(); el.classList.add('press'); const v = vec(e); h.down && h.down(e, v, c); });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === pid) { const v = vec(e); h.move && h.move(e, v, c); } });
    const up = (e) => { if (e.pointerId !== pid) return; pid = null; el.classList.remove('press'); h.up && h.up(e, vec(e), c); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function wheelMove(c, v, max) {          // gerakkan titik wheel; return sudut (rad) atau null kalau belum cukup geser
    const l = Math.hypot(v.dx, v.dy), k = l > max ? max / l : 1;
    if (!c.wheel) return l > 18 ? Math.atan2(v.dy, v.dx) : null;
    c.wheel.classList.add('show'); c.wheel.firstChild.style.transform = `translate(${v.dx * k}px,${v.dy * k}px)`;
    return l > 18 ? Math.atan2(v.dy, v.dx) : null;
  }
  const wheelOff = (c) => { if (c.wheel) { c.wheel.classList.remove('show'); c.wheel.firstChild.style.transform = ''; } };

  /* ===== bangun kontrol ===== */
  /* joystick (kiri) */
  const joy = add({ side: 'l', x0: 112, y0: 424, s0: 132, cls: 'joy', html: '<div class="knob"></div>', scene: 'both' });
  let jActive = false;
  bind(joy, {
    down(e, v) { jActive = true; joyMove(v); },
    move(e, v) { joyMove(v); },
    up() { jActive = false; joy.el.firstChild.style.transform = ''; D.IO.stick(0, 0); }
  });
  function joyMove(v) {
    const R = joy.s / 2, l = Math.hypot(v.dx, v.dy), k = l > R ? R / l : 1, dx = v.dx * k, dy = v.dy * k;
    joy.el.firstChild.style.transform = `translate(${dx * .55}px,${dy * .55}px)`;
    const nx = dx / R, ny = dy / R, m = Math.hypot(nx, ny);
    if (m < .18) D.IO.stick(0, 0); else { const q = Math.min(1, (m - .18) / .55) / m; D.IO.stick(nx * q, ny * q); }
  }

  /* Inventori (hanya di lobby) */
  const invB = add({ side: 'l', x0: 58, y0: 292, s0: 50, html: '<span class="ico">🎒</span><span class="nm">INV</span>', scene: 'town' });
  bind(invB, { down() { D.IO.inv(); } });

  /* ATK + Interaksi jadi satu: dekat NPC / portal / peti / prop → tombol berubah jadi E (tap = interaksi). Selain itu = serang (tahan, geser = bidik).
     Di lobby tombol ini hanya aktif saat dekat target interaksi. */
  const atk = add({ x0: ATK.x, y0: ATK.y, s0: ATK.s, wr: 84, html: '<span class="ico">⚔</span><span class="nm">ATK</span>', scene: 'both' });
  atk.ic = atk.el.querySelector('.ico'); atk.nmEl = atk.el.querySelector('.nm');
  let atkPid = null, atkHeld = false, nearI = false, asInt = false;
  bind(atk, {
    down(e) {
      if (nearI) { asInt = true; D.IO.interact(); return; }
      asInt = false; if (!(D.IO.screen === 'play' && D.run)) return;
      atkPid = e.pointerId; atkHeld = true; D.IO.atk(atkPid);
    },
    move(e, v) { if (asInt || !atkHeld) return; const a = wheelMove(atk, v, 84); D.IO.atkAim(a); },
    up() { if (asInt) { asInt = false; return; } if (!atkHeld) return; atkHeld = false; wheelOff(atk); D.IO.atkEnd(atkPid); }
  });

  /* tombol aksi dengan wheel arah + pie cooldown */
  const act = {};
  function skillBtn(id, o) {
    const c = add(Object.assign({ scene: 'play', wr: 90, html: `<div class="cdp"></div><span class="ico"></span><span class="nm"></span><div class="cdt"></div>` }, o));
    c.ic = c.el.querySelector('.ico'); c.nmEl = c.el.querySelector('.nm'); c.pie = c.el.querySelector('.cdp'); c.cdt = c.el.querySelector('.cdt'); c.id = id; act[id] = c; return c;
  }
  const ROLE_ICO = { fighter: '💥', mage: '🔥', tank: '🛡️', archer: '🏹', assassin: '🌑' };

  /* Skill utama (bidik bawaan game: hologram + lingkaran batal kanan-atas) */
  skillBtn('skill', arc(180, 92, { s0: 68, nm: 'SKILL' }));
  bind(act.skill, {
    down(e, v, c) { D.IO.skillDown(e.pointerId, c.x, c.y); },
    move(e, v, c) { wheelMove(c, v, 90); },
    up(e, v, c) { wheelOff(c); }                              // cast / batal diurus game.js (pointerup global)
  });
  /* Dash & Spell 2 */
  skillBtn('dash', arc(216, 92, { s0: 60, nm: 'DASH', ic: '💨' }));
  skillBtn('spell', { side: 'c', x0: 446, y0: 504, s0: 50, nm: 'SPELL', ic: '📖' });
  for (const id of ['dash', 'spell']) {
    let ang = null; const c = act[id];
    bind(c, {
      move(e, v) { const a = wheelMove(c, v, 90); if (a !== null) ang = a; },
      up() { wheelOff(c); D.IO[id === 'dash' ? 'dash' : 'spell'](ang); ang = null; },
      down() { ang = null; }
    });
  }
  /* Skill Unique Z X C V */
  [['z', 190], ['x', 214], ['c', 238], ['v', 262]].forEach(([k, a]) => {
    const c = skillBtn('u' + k, arc(a, 164, { s0: 58, key: k })); let ang = null, pid = null;
    const hold = () => { const d = D.Uniq.cur(), sk = d && d.skills[k]; return !!(sk && sk.type === 'hold'); };
    bind(c, {
      down(e) { ang = null; pid = e.pointerId; if (hold()) D.IO.uniqHold(k, pid, null); },
      move(e, v) { const a = wheelMove(c, v, 90); if (a !== null) { ang = a; if (hold()) D.IO.ov(a); } },
      up() { wheelOff(c); if (hold()) D.IO.uniqEnd(); else D.IO.uniqCast(k, ang); ang = null; }
    });
  });
  /* Ramuan: tap = ramuan terakhir, tahan + geser = roda (Heal ↑ / ATK ↘ / DEF ↙), cooldown bersama 5 dtk */
  skillBtn('pot', { side: 'c', x0: 508, y0: 502, s0: 54, nm: 'F' });
  act.pot.el.insertAdjacentHTML('beforeend', '<span class="cnt"></span>'); act.pot.cnt = act.pot.el.querySelector('.cnt');
  bind(act.pot, {
    down(e) { D.IO.potDown(e.pointerId); },
    move(e, v) { D.IO.potVec(v.dx, v.dy); },
    up() { D.IO.potUp(); }
  });

  /* ===== loop: tampil/sembunyi, cooldown pie ===== */
  const peak = {};
  function cd(id, left, known) {
    if (!(left > 0)) { peak[id] = 0; return { left: 0, f: 0 }; }
    peak[id] = Math.max(peak[id] || 0, left, known || 0);
    return { left, f: Math.min(1, left / peak[id]) };
  }
  function setCd(c, r, lockLabel) {
    c.pie.style.setProperty('--a', (r.f * 360) + 'deg');
    const cool = r.left > .05; c.el.classList.toggle('cool', cool);
    c.cdt.textContent = cool ? (r.left >= 10 ? Math.ceil(r.left) : r.left.toFixed(1)) : '';
  }
  const setHTML = (el, v) => { if (el._v !== v) { el._v = v; el.textContent = v; } };
  const vis = (c, on) => { const d = !on; if (c.el._d !== d) { c.el._d = d; c.el.style.display = d ? 'none' : ''; if (c.wheel && d) wheelOff(c); } };

  function frame() {
    const can = document.getElementById('cv'), game = !!(can && can.style.display === 'block');
    const en = enabled(), on = en && game;
    document.body.classList.toggle('mob', en);
    if (on !== shown) { shown = on; root.classList.toggle('on', on); if (!on) { D.IO.stick(0, 0); if (atkHeld) { atkHeld = false; D.IO.atkEnd(atkPid); } } }
    if (on) {
      const R = D.run, scene = D.IO.screen === 'play' && R ? 'play' : 'town', busy = D.IO.busy();
      const p = D.state;
      for (const c of items) vis(c, !busy && (c.scene !== 'town' || scene === 'town'));
      /* mode tombol ATK: interaksi atau serang */
      if (!busy) {
        nearI = scene === 'town' ? !!(D.Lobby && D.Lobby.near()) : !!(D.nearProp() || (R.chests || []).some(q => !q.open && Math.hypot(q.x - R.p.x, q.y - R.p.y) < 44));
        setHTML(atk.ic, nearI ? 'E' : '⚔'); setHTML(atk.nmEl, nearI ? 'INTERAKSI' : 'ATK'); atk.el.classList.toggle('on2', nearI);
        atk.el.classList.toggle('lock', scene === 'town' && !nearI);
      }
      if (scene === 'town' && !busy) {
        const role = p.role, d = D.Uniq.cur();
        act.skill.ic.textContent = ROLE_ICO[role] || '✦'; setHTML(act.skill.nmEl, 'SKILL'); setHTML(act.dash.ic, '💨'); setHTML(act.dash.nmEl, 'DASH');
        vis(act.spell, role === 'fighter'); setHTML(act.spell.ic, '📖'); setHTML(act.spell.nmEl, 'R');
        for (const k of ['z', 'x', 'c', 'v']) { const c = act['u' + k]; vis(c, !!d); if (d && d.skills[k]) { const sk = d.skills[k]; setHTML(c.ic, sk.i); setHTML(c.nmEl, sk.n.length > 9 ? sk.n.slice(0, 8) + '…' : sk.n); } }
        const sel = D.IO.potSel(); setHTML(act.pot.nmEl, 'F'); setHTML(act.pot.ic, { heal: '🧪', dmg: '💥', def: '🛡️' }[sel]); setHTML(act.pot.cnt, String(D.IO.potCount(sel)));
        for (const id in act) { act[id].el.classList.add('lock'); act[id].el.classList.remove('cool', 'on2'); act[id].pie.style.setProperty('--a', '0deg'); }
      }
      if (scene === 'play' && R && !busy) {
        /* ATK ditahan lalu skill selesai → lanjutkan serangan */
        if (atkHeld && !D.IO.isAtk() && !D.IO.isAiming()) D.IO.atk(atkPid);
        const role = p.role;
        act.skill.ic.textContent = ROLE_ICO[role] || '✦'; setHTML(act.skill.nmEl, 'SKILL'); act.skill.ic.dataset.r = role;
        setCd(act.skill, cd('skill', R.skT, 8)); act.skill.el.classList.remove('lock'); act.dash.el.classList.remove('lock');
        setHTML(act.dash.ic, '💨'); setHTML(act.dash.nmEl, 'DASH'); setCd(act.dash, cd('dash', R.dsT));
        const hasSp = role === 'fighter';
        vis(act.spell, hasSp);
        if (hasSp) { setHTML(act.spell.ic, '📖'); setHTML(act.spell.nmEl, R.s.spell ? 'R' : 'no Tome'); const mx = R.s.spell && D.SPELL2[R.s.spell] ? D.SPELL2[R.s.spell].cd : 0; setCd(act.spell, cd('spell', R.sp2T, mx)); act.spell.el.classList.toggle('lock', !R.s.spell); }
        /* Unique */
        const sl = D.Uniq.slots(R), d = D.Uniq.cur(), u = sl && D.Uniq.S(R);
        for (const k of ['z', 'x', 'c', 'v']) {
          const c = act['u' + k], i = 'zxcv'.indexOf(k); vis(c, !!sl); if (!sl) continue;
          const s = sl[i], sk = d.skills[k];
          setHTML(c.ic, s.i); setHTML(c.nmEl, s.n.length > 9 ? s.n.slice(0, 8) + '…' : s.n);
          setCd(c, cd('u' + k, u.cd[k], sk.cd)); c.el.classList.toggle('on2', !!s.on); c.el.classList.toggle('lock', s.st === '🔒');
        }
        const sel = D.IO.potSel(), n = D.IO.potCount(sel);
        setHTML(act.pot.nmEl, 'F'); setHTML(act.pot.ic, { heal: '🧪', dmg: '💥', def: '🛡️' }[sel]); setHTML(act.pot.cnt, String(n)); setCd(act.pot, cd('pot', R.potT, 5)); act.pot.el.classList.toggle('lock', !n);
      }
    }
    requestAnimationFrame(frame);
  }
  layout(); requestAnimationFrame(frame);

  /* ===== UI pengaturan (disisipkan ke modal Settings oleh game.js) ===== */
  API.settingsHTML = () => `<div style="margin-top:12px;border-top:2px solid #4a5043;padding-top:10px">
    <h3 style="font-size:15px;margin-bottom:6px">📱 Kontrol Mobile</h3>
    <div class="row"><span class="nm">Kontrol sentuh</span><select id="msMode" class="set-in" style="text-transform:none;flex:0 0 150px">
      <option value="auto">Auto (deteksi)</option><option value="on">Selalu nyala</option><option value="off">Mati</option></select></div>
    <div class="row"><span class="nm">Opacity tombol</span><input id="msOp" type="range" min="20" max="100" style="flex:0 0 150px"></div>
    <div class="row"><span class="nm">Opacity HUD</span><input id="msHud" type="range" min="20" max="100" style="flex:0 0 150px"></div>
    <div class="row"><span class="nm">Ukuran tombol</span><input id="msSz" type="range" min="70" max="130" style="flex:0 0 150px"></div>
    <p class="dim">Deteksi: ${coarse() || touched ? 'layar sentuh' : 'mouse / keyboard'}</p></div>`;
  API.bind = (r) => {
    const q = (s) => (r || document).querySelector(s); if (!q('#msMode')) return;
    q('#msMode').value = cfg.mode; q('#msOp').value = cfg.op * 100; q('#msHud').value = cfg.hud * 100; q('#msSz').value = cfg.size * 100;
    q('#msMode').onchange = (e) => { cfg.mode = e.target.value; save(); };
    q('#msOp').oninput = (e) => { cfg.op = e.target.value / 100; save(); layout(); };
    q('#msHud').oninput = (e) => { cfg.hud = e.target.value / 100; save(); layout(); };
    q('#msSz').oninput = (e) => { cfg.size = e.target.value / 100; save(); layout(); };
  };
})(window.DSB);
