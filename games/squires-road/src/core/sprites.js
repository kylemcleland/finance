// Core: procedural pixel characters (16x20 frames, auto-outlined, cached).
(() => {
  const FW = 16, FH = 20;
  const cache = new Map();

  const DEF = {
    skin: '#f1c27d', hair: '#6b3e1f', hairStyle: 'short', tunic: '#3b7dd8',
    pants: '#5a4632', boots: '#3a2616', belt: '#2d1c10',
  };

  // Paint one frame (unoutlined) into ctx at 0,0.
  function paint(x, L, dir, frame) {
    const px = (c, X, Y, W = 1, H = 1) => { if (!c) return; x.fillStyle = c; x.fillRect(X, Y, W, H); };
    const sh = G.U.shade;
    const tunicD = sh(L.tunic, -0.25);
    const step = frame === 0 ? 0 : frame === 1 ? 1 : -1;
    const bob = frame === 0 ? 0 : 1; // body dips while walking
    const side = dir === 'left' || dir === 'right';

    // --- cape behind (front/side views) ---
    if (L.cape && dir !== 'up') {
      px(sh(L.cape, -0.2), side ? 3 : 3, 10 + bob, side ? 4 : 10, 7);
    }

    // --- legs ---
    if (!L.dress) {
      if (side) {
        px(L.pants, 6 + step, 15, 2, 3); px(L.boots, 6 + step, 18, 3, 2);
        px(sh(L.pants, -0.2), 8 - step, 15, 2, 3); px(sh(L.boots, -0.2), 8 - step, 18, 3, 2);
      } else {
        const l = step === 1 ? -1 : 0, r = step === -1 ? -1 : 0;
        px(L.pants, 5, 15 + l, 3, 3); px(L.boots, 5, 18 + l, 3, 2 - (l ? 0 : 0));
        px(L.pants, 8, 15 + r, 3, 3); px(L.boots, 8, 18 + r, 3, 2);
      }
    } else {
      // dress / robe down to feet
      px(L.tunic2 || L.tunic, side ? 5 : 4, 14 + bob, side ? 6 : 8, 5 - bob);
      px(L.boots, side ? 6 + step : 5, 19, 2, 1); px(L.boots, side ? 8 - step : 9, 19, 2, 1);
    }

    // --- body / tunic ---
    const by = 10 + bob;
    if (side) {
      px(L.tunic, 5, by, 6, 6);
      px(tunicD, 5, by + 4, 6, 1);
      px(L.belt, 5, by + 4, 6, 1);
      if (L.apron) px(L.apron, dir === 'right' ? 8 : 5, by + 1, 3, 5);
      // arm swing
      px(tunicD, 7 + step, by + 1, 2, 4); px(L.skin, 7 + step, by + 5, 2, 1);
    } else {
      px(L.tunic, 4, by, 8, 6);
      px(L.tunic2 || tunicD, dir === 'down' ? 7 : 4, by, dir === 'down' ? 2 : 8, dir === 'down' ? 4 : 0);
      px(L.belt, 4, by + 4, 8, 1);
      if (L.apron && dir === 'down') px(L.apron, 5, by + 1, 6, 5);
      // arms
      px(tunicD, 3, by + (step === 1 ? 0 : 1), 1, 4); px(L.skin, 3, by + (step === 1 ? 4 : 5), 1, 1);
      px(tunicD, 12, by + (step === -1 ? 0 : 1), 1, 4); px(L.skin, 12, by + (step === -1 ? 4 : 5), 1, 1);
    }
    if (L.cape && dir === 'up') px(L.cape, 3, by - 1, 10, 8);

    // --- head ---
    const hy = 1 + bob;
    const hair = L.hair, hs = L.hairStyle || 'short';
    if (side) {
      px(L.skin, 4, hy + 2, 8, 7);
      const front = dir === 'right';
      // hair cap and back of head
      if (hs !== 'bald') {
        px(hair, 4, hy, 8, 3);
        px(hair, front ? 4 : 9, hy + 2, 3, hs === 'long' ? 8 : 5);
        if (hs === 'spiky') { px(hair, 5, hy - 1, 1, 1); px(hair, 8, hy - 1, 1, 1); px(hair, 10, hy, 2, 1); }
      }
      px('#1d1410', front ? 10 : 5, hy + 4, 1, 2); // eye
      if (L.beard) px(L.beard, front ? 8 : 4, hy + 7, 4, 2);
    } else if (dir === 'down') {
      px(L.skin, 3, hy + 2, 10, 7);
      if (hs !== 'bald') {
        px(hair, 3, hy, 10, 3);
        px(hair, 3, hy + 2, 1, hs === 'long' ? 9 : 4); px(hair, 12, hy + 2, 1, hs === 'long' ? 9 : 4);
        px(hair, 4, hy + 3, 2, 1);
        if (hs === 'spiky') { px(hair, 4, hy - 1, 2, 1); px(hair, 7, hy - 1, 2, 1); px(hair, 10, hy - 1, 2, 1); }
      }
      px('#1d1410', 5, hy + 4, 1, 2); px('#1d1410', 10, hy + 4, 1, 2);
      px('rgba(255,120,120,0.35)', 4, hy + 6, 1, 1); px('rgba(255,120,120,0.35)', 11, hy + 6, 1, 1);
      if (L.beard) { px(L.beard, 4, hy + 7, 8, 2); px(L.beard, 5, hy + 9, 6, 1); }
    } else {
      px(L.skin, 3, hy + 2, 10, 7);
      if (hs !== 'bald') {
        px(hair, 3, hy, 10, 8);
        if (hs === 'long') px(hair, 3, hy + 8, 10, 3);
        if (hs === 'spiky') { px(hair, 4, hy - 1, 2, 1); px(hair, 7, hy - 1, 2, 1); px(hair, 10, hy - 1, 2, 1); }
      }
    }
    // --- headgear ---
    if (L.hood) {
      const hd = sh(L.hood, -0.2);
      if (side) { px(L.hood, 4, hy - 1, 8, 4); px(L.hood, dir === 'right' ? 4 : 9, hy + 2, 3, 7); }
      else if (dir === 'down') { px(L.hood, 2, hy - 1, 12, 4); px(L.hood, 2, hy + 2, 2, 8); px(L.hood, 12, hy + 2, 2, 8); }
      else px(L.hood, 2, hy - 1, 12, 11);
      px(hd, 2, hy + 9, 12, 1);
    }
    if (L.helmet) {
      const m = L.helmet, md = sh(m, -0.3), ml = sh(m, 0.35);
      if (side) {
        px(m, 3, hy - 1, 10, 9); px(ml, 4, hy, 3, 2);
        px('#151515', dir === 'right' ? 8 : 3, hy + 4, 5, 1);
      } else if (dir === 'down') {
        px(m, 2, hy - 1, 12, 10); px(ml, 4, hy, 3, 2);
        px('#151515', 4, hy + 4, 8, 1); px(md, 7, hy + 5, 2, 4);
      } else { px(m, 2, hy - 1, 12, 10); px(ml, 9, hy, 3, 2); }
      if (L.plume) { px(L.plume, side ? 6 : 6, hy - 4, 4, 3); px(sh(L.plume, -0.3), side ? (dir === 'right' ? 4 : 10) : 7, hy - 3, 2, 3); }
    }
    if (L.hat) {
      const hd = sh(L.hat, -0.3);
      px(hd, 1, hy + 2, 14, 1); px(L.hat, 4, hy - 1, 8, 3); px(hd, 4, hy + 1, 8, 1);
    }
    if (L.crown) {
      px('#f2c14e', 4, hy - 2, 8, 2); px('#f2c14e', 4, hy - 3, 1, 1); px('#f2c14e', 7, hy - 3, 2, 1); px('#f2c14e', 11, hy - 3, 1, 1);
      px('#d6453d', 7, hy - 1, 2, 1);
    }
  }

  const keyCache = new WeakMap();
  function key(L, dir, frame) {
    let k = keyCache.get(L);
    if (!k) { k = JSON.stringify(L); keyCache.set(L, k); }
    return k + dir + frame;
  }

  function build(L, dir, frame) {
    const [raw, rx] = G.gfx.makeCanvas(FW + 2, FH + 2);
    const realDir = dir === 'left' ? 'right' : dir;
    rx.save();
    rx.translate(1, 1);
    paint(rx, L, realDir, frame);
    rx.restore();
    // outline: silhouette in dark, offset 4 ways
    const [out, ox] = G.gfx.makeCanvas(FW + 2, FH + 2);
    const [sil, sx] = G.gfx.makeCanvas(FW + 2, FH + 2);
    sx.drawImage(raw, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = L.outline || '#21160f';
    sx.fillRect(0, 0, FW + 2, FH + 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ox.drawImage(sil, dx, dy);
    ox.drawImage(raw, 0, 0);
    if (dir === 'left') {
      const [fl, fx] = G.gfx.makeCanvas(FW + 2, FH + 2);
      fx.translate(FW + 2, 0); fx.scale(-1, 1); fx.drawImage(out, 0, 0);
      return fl;
    }
    return out;
  }

  const fullCache = new WeakMap();
  function resolve(look) {
    if (!look) return DEF;
    if (typeof look === 'string') look = G.looks[look] || DEF;
    if (look.__full) return look;
    let f = fullCache.get(look);
    if (!f) { f = Object.assign({ __full: true }, DEF, look); fullCache.set(look, f); }
    return f;
  }

  G.chars = {
    FW, FH,
    resolve,
    frame(look, dir = 'down', frame = 0) {
      const L = resolve(look);
      const k = key(L, dir, frame);
      let c = cache.get(k);
      if (!c) { c = build(L, dir, frame); cache.set(k, c); }
      return c;
    },
    // Draw anchored bottom-center at (x, y).
    draw(ctx, look, dir, frame, x, y, scale = 1, o = {}) {
      const c = G.chars.frame(look, dir, frame);
      const w = (FW + 2) * scale, h = (FH + 2) * scale;
      if (o.shadow !== false) G.draw.shadow(x, y - 1 * scale, 11 * scale);
      if (o.flash) {
        // white flash on hit (cached per frame+color)
        const fc = o.flash === true ? '#ffffff' : o.flash;
        const fk = key(resolve(look), dir, frame) + '|flash' + fc;
        let f = cache.get(fk);
        if (!f) {
          let fx;
          [f, fx] = G.gfx.makeCanvas(FW + 2, FH + 2);
          fx.drawImage(c, 0, 0);
          fx.globalCompositeOperation = 'source-in';
          fx.fillStyle = fc;
          fx.fillRect(0, 0, FW + 2, FH + 2);
          cache.set(fk, f);
        }
        ctx.drawImage(f, Math.round(x - w / 2), Math.round(y - h + scale), w, h);
        return;
      }
      if (o.alpha != null) ctx.globalAlpha = o.alpha;
      ctx.drawImage(c, Math.round(x - w / 2), Math.round(y - h + scale), w, h);
      ctx.globalAlpha = 1;
    },
    // Head-and-shoulders portrait (for dialogs/brackets), size px square.
    portrait(ctx, look, x, y, size = 24) {
      const c = G.chars.frame(look, 'down', 0);
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
      const s = size / 13;
      ctx.drawImage(c, x + size / 2 - (FW + 2) * s / 2, y - 0.5 * s, (FW + 2) * s, (FH + 2) * s);
      ctx.restore();
    },
  };

  // Presets used by content. Anyone may add more: G.looks.foo = {...}
  G.looks = {
    hero: { skin: '#f1c27d', hair: '#7a4a24', hairStyle: 'spiky', tunic: '#5f8f3a', pants: '#6a4b2e', boots: '#3b2615' },
    heroKnight: { skin: '#f1c27d', hair: '#7a4a24', hairStyle: 'spiky', tunic: '#3b6fc4', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', cape: '#b23a3a' },
    aldric: { skin: '#e8b98a', hair: '#d8d8d8', hairStyle: 'short', beard: '#e2e2e2', tunic: '#7d6b52', pants: '#4a3b2a', boots: '#2e2015', cape: '#5a2e2e' },
    cedric: { skin: '#f7d2a6', hair: '#f0d264', hairStyle: 'short', tunic: '#7b3fb5', tunic2: '#f2c14e', pants: '#2f2f3f', boots: '#1d1d26', cape: '#4b2a7a' },
    bram: { skin: '#c98e5d', hair: '#2a1a10', hairStyle: 'bald', beard: '#2a1a10', tunic: '#8a2f22', pants: '#3a2c20', boots: '#1f150e' },
    wren: { skin: '#f0c9a0', hair: '#c2552c', hairStyle: 'long', tunic: '#3f7a3a', pants: '#5a4630', boots: '#3a2a18', hood: '#2f5e2b' },
    rowena: { skin: '#f4d0b0', hair: '#3b2414', hairStyle: 'long', tunic: '#c43c3c', tunic2: '#f2e6c8', pants: '#5a5a66', boots: '#2b2b33', helmet: null },
    varek: { skin: '#d9a77a', hair: '#151515', hairStyle: 'short', tunic: '#1f1f28', tunic2: '#a8a8b8', pants: '#151519', boots: '#0d0d10', helmet: '#4a4a58', plume: '#8a1f1f', cape: '#2a0f0f' },
    hugh: { skin: '#c99a70', hair: '#111', hairStyle: 'short', beard: '#111', tunic: '#2a2a2a', pants: '#3a2a1a', boots: '#1a120a', hood: '#1e1e1e' },
    villagerM: { skin: '#e9b98a', hair: '#4a2c16', tunic: '#a8743a', pants: '#5a4a38', boots: '#33251a' },
    villagerF: { skin: '#f5cfa8', hair: '#8a4a20', hairStyle: 'long', tunic: '#d07a8a', dress: true, tunic2: '#b75e70', boots: '#4a3020' },
    elder: { skin: '#e3b48a', hair: '#cfcfcf', hairStyle: 'bald', beard: '#dcdcdc', tunic: '#5a6e8a', dress: true, tunic2: '#4a5a72', boots: '#33302a' },
    child: { skin: '#f5cfa8', hair: '#d9a54a', hairStyle: 'spiky', tunic: '#e07a3a', pants: '#4a5a8a', boots: '#3a2a1a' },
    merchant: { skin: '#e2ae80', hair: '#5a3a1a', hat: '#6a2f8a', tunic: '#d9b45a', apron: '#f0e6d0', pants: '#4a3a2a', boots: '#2e2016' },
    smith: { skin: '#c98e5d', hair: '#1a1a1a', hairStyle: 'short', beard: '#1a1a1a', tunic: '#5a5a5a', apron: '#6a4022', pants: '#3a2c20', boots: '#1f150e' },
    innkeep: { skin: '#f0c49a', hair: '#9a5a2a', hairStyle: 'long', tunic: '#5aa06a', dress: true, apron: '#f4ecd8', tunic2: '#4a8a58', boots: '#3a2a1a' },
    guard: { skin: '#e2ae80', hair: '#3a2a1a', tunic: '#9a2f2f', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#9aa0aa' },
    knight: { skin: '#e2ae80', hair: '#3a2a1a', tunic: '#3b5fa8', tunic2: '#e8e8e8', pants: '#5a5a66', boots: '#2b2b33', helmet: '#b8bcc6', plume: '#3b5fa8' },
    hedgeKnight: { skin: '#d9a77a', hair: '#5a3a1a', tunic: '#5a6a3a', pants: '#4a4a40', boots: '#2b2b20', helmet: '#8a8a7a' },
    bandit: { skin: '#d9a77a', hair: '#2a1a10', tunic: '#5a3a2a', pants: '#3a2a1a', boots: '#1f150e', hood: '#3a2a20' },
    archer: { skin: '#f0c9a0', hair: '#6a4a2a', tunic: '#4a7a3a', pants: '#5a4630', boots: '#3a2a18', hat: '#3f6a2f' },
    squire: { skin: '#f1c27d', hair: '#a0602a', tunic: '#c08a3a', pants: '#5a4632', boots: '#3a2616' },
    monk: { skin: '#e9b98a', hair: '#6b4a2a', hairStyle: 'bald', tunic: '#7a5a3a', dress: true, tunic2: '#6a4a2a', hood: '#6a4a2a', boots: '#3a2a1a' },
    noble: { skin: '#f7d2a6', hair: '#2a1a10', hairStyle: 'long', tunic: '#2a5aa0', tunic2: '#f2c14e', dress: true, boots: '#2a1a10', crown: false },
    king: { skin: '#e9b98a', hair: '#c0c0c0', beard: '#d0d0d0', tunic: '#8a1f2f', tunic2: '#f2c14e', cape: '#5a1020', pants: '#3a2a4a', boots: '#2a1a2a', crown: true },
    dummy: { skin: '#c9a36a', hair: '#c9a36a', hairStyle: 'bald', tunic: '#b08a52', pants: '#8a6a3a', boots: '#6a4a2a', outline: '#3a2810' },
  };
})();
