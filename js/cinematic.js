/* cinematic.js — efek sinematik yang bisa dipakai skill mana pun:
     • letterbox  : bar hitam atas & bawah
     • zoom       : zoom halus ke tengah layar
     • vignette   : tepi layar menggelap
     • flash      : kilatan warna sesaat
     • invert     : warna layar dibalik sesaat (CSS filter pada canvas)
   Pakai:  D.Cine.on('kunci', { bars:1, zoom:.08, vig:.7 })  → mulai (transisi halus)
           D.Cine.off('kunci')                                → selesai
           D.Cine.invert(.3) / D.Cine.flash('#fff', .3)        → efek sesaat
   Beberapa sumber boleh aktif bersamaan (diambil nilai terbesar). Dipanggil dari game.js:
     update(dt) tiap frame · begin(ctx)/end(ctx) membungkus gambar dunia · overlay(ctx) paling akhir · unzoom() untuk koordinat mouse */
(function (D) {
  const src = {}, cur = { bars: 0, zoom: 0, vig: 0 }, st = { inv: 0, flash: 0, fmax: .3, fc: '#fff' };
  const BAR = 56;                                    // tinggi satu bar letterbox (px, di layar 960×540)
  let cv = null, sc = null;

  const Cine = (D.Cine = {
    cur,
    on(key, o) { src[key] = Object.assign({ bars: 1, zoom: .06, vig: .7 }, o); },
    off(key) { delete src[key]; },
    clear() { for (const k in src) delete src[k]; },
    invert(sec) { st.inv = Math.max(st.inv, sec || .25); },
    flash(c, sec) { st.fc = c || '#fff'; st.flash = st.fmax = sec || .3; },
    get active() { return cur.bars > .02; },

    update(dt) {
      if (!D.run) Cine.clear();
      let tb = 0, tz = 0, tv = 0;
      for (const k in src) { const s = src[k]; tb = Math.max(tb, s.bars); tz = Math.max(tz, s.zoom); tv = Math.max(tv, s.vig); }
      const k = Math.min(1, dt * 4.5);
      cur.bars += (tb - cur.bars) * k; cur.zoom += (tz - cur.zoom) * k; cur.vig += (tv - cur.vig) * k;
      if (!tb && cur.bars < .004) cur.bars = 0; if (!tz && cur.zoom < .0004) cur.zoom = 0; if (!tv && cur.vig < .004) cur.vig = 0;
      if (st.inv > 0) st.inv -= dt; if (st.flash > 0) st.flash -= dt;
      cv = cv || document.getElementById('cv'); sc = sc || document.getElementById('gameScaler');
      if (cv) cv.style.filter = st.inv > 0 && Math.floor(st.inv * 28) % 4 !== 3 ? 'invert(1)' : '';
      if (sc) sc.classList.toggle('cine', cur.bars > .25);             // HUD diredupkan saat sinematik
    },

    /* bungkus penggambaran dunia: zoom ke tengah layar */
    begin(ctx) { ctx.save(); const z = 1 + cur.zoom; if (z > 1.001) { ctx.translate(480, 270); ctx.scale(z, z); ctx.translate(-480, -270); } },
    end(ctx) { ctx.restore(); },
    /* koordinat layar (tanpa zoom) → koordinat setelah zoom dibatalkan (untuk posisi mouse di dunia) */
    unzoom(gx, gy) { const z = 1 + cur.zoom; return z > 1.001 ? { gx: (gx - 480) / z + 480, gy: (gy - 270) / z + 270 } : { gx, gy }; },

    /* lapisan terakhir: vignette + letterbox + flash */
    overlay(ctx) {
      if (cur.vig > .01) {
        const g = ctx.createRadialGradient(480, 270, 170, 480, 270, 620);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.55, `rgba(0,0,0,${.35 * cur.vig})`); g.addColorStop(1, `rgba(0,0,0,${.92 * cur.vig})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, 960, 540);
      }
      if (cur.bars > .004) { const h = BAR * cur.bars; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 960, h); ctx.fillRect(0, 540 - h, 960, h); }
      if (st.flash > 0) { ctx.save(); ctx.globalAlpha = Math.min(1, st.flash / st.fmax) * .75; ctx.fillStyle = st.fc; ctx.fillRect(0, 0, 960, 540); ctx.restore(); }
    }
  });
})(window.DSB);
