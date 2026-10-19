/* dmgfx.js — Damage Indicator + Combo (kanan/kiri layar) + panel statistik Training Room.
   - Dipanggil dari dungeon.js lewat D.Dmg.add(dmg, crit, musuh, 'true'?) setiap musuh kena damage.
   - Combo naik tiap hit; kalau 5 detik (waktu game) tidak ada hit → combo reset & muncul ringkasan singkat.
   - Tiap hit: angka "pop" + goyang kiri/kanan. Makin besar hit (relatif terhadap hit terbesar di combo) / crit → makin kuat.
   - Tombol ⇄ memindah indikator kiri/kanan (tersimpan). Semua DOM & CSS dibuat dari file ini, tidak perlu ubah index.html selain <script>.
   Ubah tuning di blok KONFIG. */
(function (D) {
  /* ===== KONFIG ===== */
  const WIN = 5;                                   // detik jeda sebelum combo di-reset
  const TOP = 176;                                 // posisi vertikal indikator (px; di bawah minimap)
  const SIZE = .5;                                 // skala ukuran indikator (1 = ukuran lama, makin kecil makin ringkas)
  const z = (n) => Math.max(1, Math.round(n * SIZE));
  const TIERS = [[100, '#ff5a4a'], [50, '#ff8a4a'], [25, '#ffd54a'], [10, '#8fe36b'], [0, '#ffffff']];   // warna angka combo per jumlah hit
  const COL = { n: '#ffffff', crit: '#ffd54a', true: '#d79cff' };

  const fmt = (n) => Math.round(n).toLocaleString('id-ID');
  const $ = (s, r) => (r || document).querySelector(s);
  let side = 'r'; try { side = localStorage.getItem('dsb_dmgside') === 'l' ? 'l' : 'r'; } catch (e) {}

  /* ---------- DOM + CSS ---------- */
  const st = document.createElement('style');
  st.textContent = `
  #dmgfx{position:absolute;top:${TOP}px;width:${z(240)}px;z-index:20;pointer-events:none;font-family:"Trebuchet MS","Segoe UI",sans-serif;color:#fff;
    text-shadow:0 2px 0 #000,0 0 8px #000a;opacity:0;transition:opacity .25s;font-variant-numeric:tabular-nums}
  #dmgfx.r{right:12px;text-align:right;--o:right center}#dmgfx.l{left:12px;text-align:left;--o:left center}
  #dmgfx.live,#dmgfx.fin{opacity:1}
  #dmgfx .main{display:none}#dmgfx.live .main{display:block}
  #dmgfx .sum{display:none;font-size:${Math.max(10, z(13))}px;line-height:1.4;color:#ffe9a8;animation:dmFade 2.2s ease-out forwards}#dmgfx.fin:not(.live) .sum{display:block}
  #dmgfx .pv{transform-origin:var(--o);display:inline-block;will-change:transform}
  #dmLast{font-size:${z(44)}px;font-weight:900;line-height:1;min-height:${z(46)}px;letter-spacing:0}
  #dmTag{display:block;font-size:${Math.max(8, z(12))}px;font-style:normal;letter-spacing:2px;min-height:${z(15)}px;opacity:.95}
  #dmCombo{margin-top:${z(6)}px;line-height:1}#dmN{font-size:${z(50)}px;font-weight:900}#dmCombo small{font-size:${Math.max(8, z(16))}px;font-weight:bold;letter-spacing:2px;margin-left:4px;opacity:.9}
  #dmTot{font-size:${Math.max(9, z(15))}px;margin-top:2px;opacity:.95}#dmTot b{font-size:${Math.max(11, z(20))}px;color:#ffe9a8}
  #dmBar{height:${Math.max(4, z(8))}px;margin-top:${z(8)}px;background:#000a;border:1px solid #000;transform-origin:var(--o)}
  #dmB{display:block;height:100%;width:100%;background:linear-gradient(90deg,#ff6a3a,#ffd54a)}
  #dmFlip{position:absolute;top:-6px;${'right'}:0;pointer-events:auto;width:20px;height:18px;padding:0;margin:0;font-size:12px;line-height:1;opacity:.55}
  #dmgfx.l #dmFlip{right:auto;left:0}#dmFlip:hover{opacity:1}#dmgfx:not(.live) #dmFlip{display:none}
  @keyframes dmFade{0%,70%{opacity:1}100%{opacity:0}}
  #trainPanel{position:absolute;top:100px;width:208px;z-index:20;display:none;background:rgba(14,16,12,.82);border:3px solid #4a5043;border-top-color:#6b7263;border-left-color:#6b7263;padding:8px 10px;font-size:12px;line-height:1.55;color:#e6e4d8;font-variant-numeric:tabular-nums}
  #trainPanel.l{left:12px}#trainPanel.r{right:12px}#trainPanel.show{display:block}
  #trainPanel h4{font-size:13px;color:#e8b94a;margin-bottom:4px;letter-spacing:1px}
  #trainPanel .rw{display:flex;justify-content:space-between;gap:8px}#trainPanel .rw b{color:#fff}
  #trainPanel button{margin:6px 0 0;width:100%;font:inherit;font-size:12px;font-weight:bold;color:#e6e4d8;background:#7a2f27;border:3px solid #4a5043;border-top-color:#6b7263;border-left-color:#6b7263;padding:4px;cursor:pointer;pointer-events:auto}`;
  document.head.appendChild(st);

  const host = $('#gameScaler') || document.body;
  const root = document.createElement('div'); root.id = 'dmgfx';
  root.innerHTML = `<button id="dmFlip" title="Pindah kiri/kanan">⇄</button>
    <div class="main"><div class="pv" id="dmLastW"><span id="dmLast"></span><em id="dmTag"></em></div>
    <div id="dmCombo"><span class="pv" id="dmNW"><b id="dmN">0</b><small>HITS</small></span></div>
    <div id="dmTot"><span class="pv" id="dmTotW">TOTAL <b id="dmT">0</b></span></div><div id="dmBar"><i id="dmB"></i></div></div>
    <div class="sum" id="dmSum"></div>`;
  host.appendChild(root);
  const tp = document.createElement('div'); tp.id = 'trainPanel';
  tp.innerHTML = `<h4>🎯 TRAINING</h4>
    <div class="rw"><span>Total damage</span><b id="tpTot">0</b></div><div class="rw"><span>DPS (5 dtk)</span><b id="tpD5">0</b></div>
    <div class="rw"><span>DPS (combo)</span><b id="tpDC">0</b></div><div class="rw"><span>Hit terbesar</span><b id="tpMax">0</b></div>
    <div class="rw"><span>Rata-rata/hit</span><b id="tpAvg">0</b></div><div class="rw"><span>Crit rate</span><b id="tpCr">0%</b></div>
    <div class="rw"><span>Jumlah hit</span><b id="tpHit">0</b></div><div class="rw"><span>Combo terbaik</span><b id="tpBest">0</b></div>
    <button id="tpFull"></button><button id="tpReset">↺ Reset statistik</button>`;
  host.appendChild(tp);
  const E = (id) => document.getElementById(id);
  const el = { last: E('dmLast'), tag: E('dmTag'), n: E('dmN'), t: E('dmT'), bar: E('dmB'), sum: E('dmSum'), lastW: E('dmLastW'), nW: E('dmNW'), tW: E('dmTotW') };

  /* ---------- state ---------- */
  const C = { n: 0, total: 0, last: 0, start: 0, max: 0, disp: 0 };            // combo aktif
  const S = { total: 0, hits: 0, crits: 0, max: 0, best: 0, win: [] };         // statistik sesi (panel training)
  let run = null, finUntil = 0, panelT = 0;

  function sideApply() {
    root.classList.toggle('r', side === 'r'); root.classList.toggle('l', side === 'l');
    tp.classList.toggle('r', side === 'l'); tp.classList.toggle('l', side === 'r');      // panel training selalu di sisi berlawanan
  }
  sideApply();
  E('dmFlip').addEventListener('click', () => { side = side === 'r' ? 'l' : 'r'; try { localStorage.setItem('dsb_dmgside', side); } catch (e) {} sideApply(); });
  E('tpReset').addEventListener('click', () => { resetAll(); });
  E('tpFull').addEventListener('click', () => { D.Train.setFull(!D.Train.full); panel(); });

  function resetAll() {
    Object.assign(C, { n: 0, total: 0, last: 0, start: 0, max: 0, disp: 0 }); Object.assign(S, { total: 0, hits: 0, crits: 0, max: 0, best: 0, win: [] });
    root.classList.remove('live', 'fin'); finUntil = 0; panel();
  }
  function sync() { run = D.run; resetAll(); }                                   // run baru (dungeon / training / job) → mulai bersih

  /* ---------- animasi pop + goyang ---------- */
  function pop(node, sc, amp, ms) {
    if (!node.animate) return; if (node._a) node._a.cancel();
    const k = (Math.random() < .5 ? -1 : 1) * amp * SIZE; sc *= .7;
    node._a = node.animate([
      { transform: `translateX(0) scale(${1 + sc})` },
      { transform: `translateX(${-k}px) scale(${1 + sc * .75})`, offset: .18 },
      { transform: `translateX(${k}px) scale(${1 + sc * .5})`, offset: .38 },
      { transform: `translateX(${-k * .6}px) scale(${1 + sc * .25})`, offset: .58 },
      { transform: `translateX(${k * .3}px) scale(1.03)`, offset: .78 },
      { transform: 'translateX(0) scale(1)' }], { duration: ms, easing: 'ease-out' });
  }
  const tierCol = (n) => TIERS.find(([k]) => n >= k)[1];

  /* ---------- API dari dungeon.js ---------- */
  D.Dmg = {
    add(dmg, crit, m, kind) {
      const R = D.run; if (!R) return; if (R !== run) sync();
      const t = R.t; if (C.n > 0 && t - C.last > WIN) endCombo();
      if (C.n === 0) { C.start = t; C.max = 0; C.total = 0; C.disp = 0; finUntil = 0; root.classList.remove('fin'); }
      C.n++; C.total += dmg; C.last = t; if (dmg > C.max) C.max = dmg;
      S.total += dmg; S.hits++; if (crit) S.crits++; if (dmg > S.max) S.max = dmg; S.win.push([t, dmg]);
      root.classList.add('live');
      const k = kind === 'true' ? 'true' : crit ? 'crit' : 'n', ratio = C.max ? Math.min(1, dmg / C.max) : 1;
      el.last.textContent = fmt(dmg); el.last.style.color = COL[k]; el.tag.textContent = k === 'crit' ? 'CRITICAL' : k === 'true' ? 'TRUE DAMAGE' : ''; el.tag.style.color = COL[k];
      el.n.textContent = C.n; el.n.style.color = tierCol(C.n);
      const big = C.n % 10 === 0;                                                // kelipatan 10 hit = pop besar
      pop(el.lastW, .12 + .38 * ratio + (crit ? .15 : 0) + (kind === 'true' ? .1 : 0), 2 + 8 * ratio + (crit ? 3 : 0), 300);
      pop(el.nW, big ? .6 : .14, big ? 9 : 2.5, big ? 420 : 240);
      pop(el.tW, .08 + .12 * ratio, 1.5 + 3 * ratio, 260);                        // total naik → ikut bergoyang
    }
  };
  function endCombo() {
    if (C.n > 0) {
      S.best = Math.max(S.best, C.n);
      if (C.n >= 2) {
        el.sum.style.animation = 'none'; void el.sum.offsetWidth; el.sum.style.animation = '';
        el.sum.innerHTML = `COMBO SELESAI<br><b style="font-size:18px">${C.n} HITS</b><br>${fmt(C.total)} damage`;
        root.classList.add('fin'); finUntil = performance.now() + 2200;
      }
    }
    C.n = 0; root.classList.remove('live');
  }

  /* ---------- panel training ---------- */
  function panel() {
    const R = D.run, on = !!(R && R.kind === 'training'); tp.classList.toggle('show', on); if (!on) return;
    const t = R.t, w = S.win; while (w.length && t - w[0][0] > WIN) w.shift();
    const d5 = w.reduce((a, x) => a + x[1], 0) / WIN, dc = C.n ? C.total / Math.max(1, C.last - C.start) : 0;
    E('tpTot').textContent = fmt(S.total); E('tpD5').textContent = fmt(d5); E('tpDC').textContent = fmt(dc); E('tpMax').textContent = fmt(S.max);
    E('tpAvg').textContent = S.hits ? fmt(S.total / S.hits) : '0'; E('tpCr').textContent = S.hits ? Math.round(S.crits / S.hits * 100) + '%' : '0%';
    E('tpHit').textContent = S.hits; E('tpBest').textContent = Math.max(S.best, C.n);
    const f = E('tpFull'); f.textContent = D.Train.full ? '⚡ Pasif penuh: ON' : '⚡ Pasif penuh: OFF'; f.style.background = D.Train.full ? '#4d7a2c' : '#7a2f27';
  }

  /* ---------- loop sendiri (tidak perlu ubah game.js) ---------- */
  function frame(now) {
    const R = D.run; if (R !== run) { if (R) sync(); else { run = null; resetAll(); tp.classList.remove('show'); } }
    if (R) {
      if (C.n > 0) {
        const left = 1 - (R.t - C.last) / WIN;
        if (left <= 0) endCombo(); else {
          el.bar.style.width = (left * 100) + '%'; el.bar.style.filter = left < .3 ? 'brightness(.7)' : '';
          C.disp += (C.total - C.disp) * .35; if (C.total - C.disp < 1) C.disp = C.total; el.t.textContent = fmt(C.disp);      // angka total "berputar naik"
        }
      }
      if (root.classList.contains('fin') && now > finUntil) root.classList.remove('fin');
      if (now - panelT > 150) { panelT = now; panel(); }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})(window.DSB);
