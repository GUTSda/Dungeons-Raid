/* training.js — Training Room: arena aman (tidak ada musuh yang menyerang) berisi dummy untuk menguji damage.
   Statistik (total/DPS/crit/hit terbesar) ditampilkan oleh panel di dmgfx.js.
   Tambah dummy: tambah entri di DUMMIES. move:true = berpatroli naik-turun (buat menguji proyektil / aim). */
(function (D) {
  const T = 32, W = 28, H = 17;
  const DUMMIES = [
    { n: 'DEF 0',         def: 0,  tx: 18, ty: 4 },
    { n: 'DEF 30',        def: 30, tx: 18, ty: 8 },
    { n: 'DEF 80',        def: 80, tx: 18, ty: 12 },
    { n: 'Bergerak DEF 0', def: 0, tx: 23, ty: 8, move: true }
  ];
  /* Opsi: isi semua pasif otomatis (tersimpan). Dummy tidak bisa mati, jadi pasif berbasis kill tidak akan terisi kalau opsi ini OFF. */
  let full = true; try { const v = localStorage.getItem('dsb_train_full'); if (v !== null) full = v === '1'; } catch (e) {}
  D.Train = {
    get full() { return full; },
    setFull(v) { full = !!v; try { localStorage.setItem('dsb_train_full', full ? '1' : '0'); } catch (e) {} },
    make() {
      const m = new Uint8Array(W * H); for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) m[y * W + x] = 1;
      const p = { x: 4 * T + 16, y: 8 * T + 16 };
      return { kind: 'training', id: 'training', def: { n: 'Training Room', floor: '#3a3d44' }, mobs: [], chests: [], proj: [], fx: [], ft: [], props: [], m, w: W, h: H, rooms: [],
               ex: new Uint8Array(W * H).fill(1), p, start: { x: p.x, y: p.y }, spawnT: 0 };
    },
    fill(R) {
      for (const d of DUMMIES) {
        const x = d.tx * T + 16, y = d.ty * T + 16;
        R.mobs.push({ id: 'dummy', dummy: true, i: '🎯', n: 'Dummy', cast: d.n, hp: 1e12, max: 1e12, atk: 0, def: d.def, spd: 0, x, y, bx: x, by: y, mv: !!d.move, cd: 0, r: 14, aggro: 0, exp: 0, gold: [0, 0], drops: {} });
      }
      R.msg = 'Training Room: pukul dummy sepuasnya. Tidak ada yang menyerang balik.';
    },
    update(R, dt) {
      for (const m of R.mobs) {
        if (m.dead) continue;
        if (m.mv) { m.x = m.bx; m.y = m.by + Math.sin(R.t * 1.1) * 130; }                                   // patroli vertikal
        else { const k = Math.min(1, (dt || .016) * 2.5); m.x += (m.bx - m.x) * k; m.y += (m.by - m.y) * k; }   // habis ditarik Black Hole → pelan-pelan kembali
      }
      if (full) D.PA.fillAll(R);
    }
  };
})(window.DSB);
