// Sword battle art: arenas, creature sprites, weapons, shields, portraits.
// All procedural pixel art. Used at runtime by battle/sword.js via G.SW.art.
(() => {
  G.SW = G.SW || {};
  const U = G.U;
  const OUT = '#21160f';
  const cache = new Map();

  // ------------------------------------------------------------ sprite cache
  // paint(px) draws at 1x; result is outlined like G.chars sprites.
  function sprite(key, w, h, paint) {
    let c = cache.get(key);
    if (c) return c;
    const [raw, rx] = G.gfx.makeCanvas(w + 2, h + 2);
    const px = (col, x, y, ww = 1, hh = 1) => { if (!col) return; rx.fillStyle = col; rx.fillRect(x + 1, y + 1, ww, hh); };
    paint(px);
    const [sil, sx] = G.gfx.makeCanvas(w + 2, h + 2);
    sx.drawImage(raw, 0, 0);
    sx.globalCompositeOperation = 'source-in';
    sx.fillStyle = OUT; sx.fillRect(0, 0, w + 2, h + 2);
    const [out, ox] = G.gfx.makeCanvas(w + 2, h + 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) ox.drawImage(sil, dx, dy);
    ox.drawImage(raw, 0, 0);
    cache.set(key, out);
    return out;
  }
  function tinted(key, base, col) {
    const k = key + '|' + col;
    let c = cache.get(k);
    if (c) return c;
    let fx;
    [c, fx] = G.gfx.makeCanvas(base.width, base.height);
    fx.drawImage(base, 0, 0);
    fx.globalCompositeOperation = 'source-in';
    fx.fillStyle = col; fx.fillRect(0, 0, c.width, c.height);
    cache.set(k, c);
    return c;
  }

  // ------------------------------------------------------------ creatures
  const PALS = {
    wolf: { fur: '#8d929b', dark: '#5b606a', light: '#c9cdd4', eye: '#f2c14e' },
    wolf_alpha: { fur: '#4a4650', dark: '#2a2630', light: '#8a8494', eye: '#ff5a3a' },
    boar: { fur: '#7a5434', dark: '#4e331d', light: '#9a7454', snout: '#c98f7a' },
    troll: { skin: '#6f8f5a', dark: '#4f6a3e', light: '#8fae74', cloth: '#6a4a2a', hair: '#3a3a2a' },
  };

  function paintWolf(px, p, pose, f) {
    const crouch = pose === 'windup', leap = pose === 'attack', stun = pose === 'stun';
    const by = crouch ? 6 : leap ? 4 : 5;
    const l = pose === 'walk' ? [0, 1, 0, -1][f & 3] : 0;
    // tail
    px(p.dark, 1, by - 1 + (crouch ? 1 : 0), 3, 2); px(p.fur, 3, by, 2, 2); px(p.light, 0, by - 2 + (crouch ? 1 : 0), 2, 1);
    // body
    px(p.fur, 4, by, 14, 5);
    px(p.dark, 5, by, 12, 1);
    px(p.dark, 6, by + 1, 3, 1); px(p.dark, 11, by + 1, 2, 1);
    px(p.light, 6, by + 4, 10, 1);
    // legs
    const lh = crouch ? 3 : 4;
    if (leap) {
      px(p.dark, 2, by + 3, 4, 2); px(p.fur, 16, by + 3, 4, 2);
      px(p.dark, 4, by + 4, 3, 2); px(p.fur, 15, by + 4, 3, 2);
    } else {
      px(p.dark, 5 + l, by + 5, 2, lh); px(p.fur, 8 - l, by + 5, 2, lh);
      px(p.dark, 13 + l, by + 5, 2, lh); px(p.fur, 16 - l, by + 5, 2, lh);
    }
    // head
    const hx = 16, hy = by - 3 + (crouch ? 1 : 0);
    px(p.fur, hx, hy, 5, 5); px(p.light, hx + 1, hy + 3, 4, 2);
    px(p.dark, hx + 1, hy - 2, 1, 2); px(p.dark, hx + 3, hy - 2, 1, 2); px(p.fur, hx + 2, hy - 1, 1, 1);
    px(p.fur, hx + 5, hy + 2, 3, 2); px('#1d1410', hx + 7, hy + 2, 1, 1);
    if (leap || crouch) { px('#7a1f1f', hx + 5, hy + 4, 3, 1); px('#f4ecd8', hx + 5, hy + 4, 1, 1); px('#f4ecd8', hx + 7, hy + 4, 1, 1); px(p.light, hx + 5, hy + 5, 3, 1); }
    if (stun) { px('#1d1410', hx + 2, hy + 1, 1, 1); px('#1d1410', hx + 4, hy + 1, 1, 1); px('#1d1410', hx + 3, hy + 2, 1, 1); }
    else px(p.eye, hx + 3, hy + 1, 1, 1);
    if (p === PALS.wolf_alpha) { px('#c9cdd4', hx + 2, hy, 1, 3); } // scar
  }

  function paintBoar(px, p, pose, f) {
    const crouch = pose === 'windup', stun = pose === 'stun';
    const l = pose === 'walk' || pose === 'attack' ? [0, 1, 0, -1][f & 3] : 0;
    const by = crouch ? 1 : 0;
    // tail
    px(p.dark, 2, 4 + by, 1, 2); px(p.dark, 1, 3 + by, 1, 1);
    // body
    px(p.fur, 4, 3 + by, 13, 1); px(p.fur, 3, 4 + by, 16, 7); px(p.fur, 4, 11 + by, 14, 1);
    px(p.dark, 4, 2 + by, 12, 2);
    for (let i = 0; i < 6; i++) px(p.dark, 5 + i * 2, 1 + by, 1, 1);
    px(p.light, 6, 10 + by, 10, 1);
    px(p.dark, 6, 5 + by, 2, 1); px(p.dark, 11, 6 + by, 2, 1);
    // legs
    const lh = crouch ? 2 : 3;
    px(p.dark, 5 + l, 12 + by, 2, lh); px(p.dark, 8 - l, 12 + by, 2, lh); px(p.dark, 14 + l, 12 + by, 2, lh); px(p.dark, 17 - l, 12 + by, 2, lh);
    // head
    px(p.fur, 17, 4 + by, 5, 6); px(p.dark, 17, 2 + by, 2, 2);
    px(p.snout, 21, 6 + by, 3, 3); px('#3a1f1f', 23, 7 + by, 1, 1);
    px('#f4ecd8', 20, 9 + by, 1, 2); px('#f4ecd8', 21, 10 + by, 1, 1); px('#f4ecd8', 22, 5 + by, 1, 1);
    if (stun) { px('#1d1410', 18, 5 + by, 1, 1); px('#1d1410', 20, 5 + by, 1, 1); px('#1d1410', 19, 6 + by, 1, 1); }
    else px(crouch ? '#ff5a3a' : '#1d1410', 19, 5 + by, 1, 1);
  }

  function paintTroll(px, p, view, pose, f) {
    const l = pose === 'walk' ? [0, 1, 0, -1][f & 3] : 0;
    const raise = pose === 'windup';
    const sk = p.skin, dk = p.dark, lt = p.light;
    if (view === 'side') {
      px(dk, 8 + l, 21, 4, 5); px(sk, 11 - l, 21, 4, 5); px(dk, 7 + l, 26, 6, 2); px(dk, 10 - l, 26, 6, 2);
      px(p.cloth, 6, 18, 11, 4); px(U.shade(p.cloth, -0.3), 6, 21, 11, 1);
      px(sk, 5, 9, 12, 10); px(lt, 10, 12, 6, 6); px(dk, 5, 9, 3, 9);
      px(sk, 11, 2, 9, 9); px(dk, 11, 4, 9, 1); px('#f2e24e', 17, 5, 1, 1); px(dk, 19, 6, 2, 2);
      px('#3a1f1f', 15, 9, 4, 1); px('#f4ecd8', 18, 8, 1, 1); px(p.hair, 11, 1, 6, 2);
      if (raise) { px(sk, 12, 3, 3, 8); px(dk, 12, 1, 3, 2); }
      else { px(sk, 12, 11, 3, 10); px(dk, 12, 21, 3, 2); }
      return;
    }
    px(dk, 6 + l, 22, 4, 4); px(dk, 12 - l, 22, 4, 4); px(U.shade(dk, -0.3), 5 + l, 26, 5, 2); px(U.shade(dk, -0.3), 12 - l, 26, 5, 2);
    px(p.cloth, 5, 19, 12, 4); px(U.shade(p.cloth, -0.3), 5, 22, 12, 1);
    px(sk, 4, 10, 14, 10);
    if (view === 'down') { px(lt, 7, 13, 8, 6); px(dk, 10, 12, 2, 1); }
    else { px(dk, 6, 11, 10, 2); px(dk, 10, 13, 2, 6); }
    // arms
    if (raise) { px(sk, 1, 3, 3, 10); px(sk, 18, 3, 3, 10); px(dk, 1, 1, 3, 2); px(dk, 18, 1, 3, 2); }
    else { px(sk, 1, 11, 3, 10); px(sk, 18, 11, 3, 10); px(dk, 1, 21, 3, 2); px(dk, 18, 21, 3, 2); }
    // head
    px(sk, 6, 2, 10, 9);
    if (view === 'down') {
      px(dk, 6, 4, 10, 1);
      px('#f2e24e', 8, 5, 1, 1); px('#f2e24e', 13, 5, 1, 1);
      px(dk, 10, 6, 2, 2); px('#3a1f1f', 8, 9, 6, 1);
      px('#f4ecd8', 8, 8, 1, 1); px('#f4ecd8', 13, 8, 1, 1);
      px(dk, 4, 4, 2, 3); px(dk, 16, 4, 2, 3);
    } else px(dk, 6, 7, 10, 4);
    px(p.hair, 8, 1, 6, 2);
  }

  function paintDummy(px) {
    px('#5e3b1f', 4, 22, 8, 2);
    px('#7a5230', 7, 12, 2, 10);
    px('#7a5230', 0, 9, 16, 2); px('#5e3b1f', 0, 10, 16, 1);
    px('#c9a36a', 4, 7, 8, 9); px('#b08a52', 4, 15, 8, 1); px('#8a6a3a', 7, 8, 1, 7);
    px('#d6453d', 5, 10, 6, 4); px('#f4ecd8', 6, 11, 4, 2); px('#d6453d', 7, 11, 2, 2);
    px('#e6c75a', 3, 15, 1, 2); px('#e6c75a', 5, 16, 1, 2); px('#e6c75a', 10, 16, 1, 2); px('#e6c75a', 12, 15, 1, 2);
    px('#e6c75a', 0, 8, 1, 1); px('#e6c75a', 15, 8, 1, 1); px('#e6c75a', 0, 11, 1, 2); px('#e6c75a', 15, 11, 1, 2);
    px('#d9b77a', 5, 1, 6, 6); px('#b08a52', 5, 6, 6, 1);
    px('#5e3b1f', 6, 3, 1, 1); px('#5e3b1f', 9, 3, 1, 1); px('#5e3b1f', 7, 5, 2, 1);
    px('#8a6a3a', 6, 7, 4, 1); px('#e6c75a', 7, 0, 2, 1);
  }

  const CREATURES = {
    wolf: { w: 24, h: 15, side: true, r: 9 },
    wolf_alpha: { w: 24, h: 15, side: true, r: 10 },
    boar: { w: 24, h: 15, side: true, r: 10 },
    troll: { w: 22, h: 28, side: false, r: 13 },
    dummy: { w: 16, h: 24, side: false, r: 7 },
  };

  function creatureCanvas(kind, view, pose, f) {
    const spec = CREATURES[kind];
    const key = `cr:${kind}:${view}:${pose}:${f}`;
    return [key, sprite(key, spec.w, spec.h, (px) => {
      if (kind === 'wolf' || kind === 'wolf_alpha') paintWolf(px, PALS[kind], pose, f);
      else if (kind === 'boar') paintBoar(px, PALS.boar, pose, f);
      else if (kind === 'troll') paintTroll(px, PALS.troll, view, pose, f);
      else paintDummy(px);
    })];
  }

  // Draw a creature anchored bottom-center at (x,y). o: {ang, pose, frame, scale, flash, flashA, alpha, rot, shadow}
  function creature(ctx, kind, x, y, o = {}) {
    const spec = CREATURES[kind] || CREATURES.wolf;
    const s = o.scale || 2;
    const ang = o.ang || 0;
    let view = 'down', flip = false;
    if (spec.side) { flip = Math.cos(ang) < 0; view = 'side'; }
    else if (kind === 'troll') {
      const c = Math.cos(ang), sn = Math.sin(ang);
      if (Math.abs(c) > Math.abs(sn) * 1.2) { view = 'side'; flip = c < 0; } else view = sn < 0 ? 'up' : 'down';
    }
    const pose = o.pose || 'idle';
    const f = pose === 'walk' || pose === 'attack' ? (o.frame || 0) & 3 : 0;
    const [key, c] = creatureCanvas(kind, view, pose, f);
    const w = c.width * s, h = c.height * s;
    if (o.shadow !== false) G.draw.shadow(x, y - s, spec.w * s * 0.75);
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    if (o.rot) { ctx.translate(0, -h / 2); ctx.rotate(o.rot); ctx.translate(0, h / 2); }
    if (flip) ctx.scale(-1, 1);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    ctx.drawImage(c, -w / 2, -h + s, w, h);
    if (o.flash) {
      ctx.globalAlpha = (o.alpha != null ? o.alpha : 1) * (o.flashA != null ? o.flashA : 1);
      ctx.drawImage(tinted(key, c, o.flash), -w / 2, -h + s, w, h);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------ weapons
  // w: {kind:'sword'|'stick'|'axe'|'club'|'none', len, color}
  function weapon(ctx, w, x, y, ang, o = {}) {
    if (!w || w.kind === 'none') return;
    const L = w.len;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const R = (c, a, b, ww, hh) => { ctx.fillStyle = c; ctx.fillRect(a, b, ww, hh); };
    const outline = (fn) => { ctx.fillStyle = OUT; fn(true); };
    if (w.kind === 'stick') {
      R(OUT, -3, -2.2, L + 5, 4.4);
      R('#9a6a3a', -2, -1.2, L + 3, 2.4); R('#c08a4a', -2, -1.2, L + 3, 0.8); R('#6a4a2a', L * 0.5, -1.2, 1.5, 2.4);
    } else if (w.kind === 'club') {
      R(OUT, -3, -2, L * 0.5 + 2, 4); R(OUT, L * 0.4, -3.6, L * 0.65 + 1, 7.2);
      R('#7a5230', -2, -1, L * 0.5, 2);
      R('#8a5a32', L * 0.4 + 1, -2.6, L * 0.65 - 1, 5.2); R('#a8743f', L * 0.4 + 1, -2.6, L * 0.65 - 1, 1.2);
      R('#c8ccd6', L * 0.6, -3.2, 1.5, 1.5); R('#c8ccd6', L * 0.85, 1.6, 1.5, 1.5);
    } else if (w.kind === 'axe') {
      R(OUT, -3, -2, L + 4, 4);
      R('#7a5230', -2, -1, L + 2, 2); R('#a8743f', -2, -1, L + 2, 0.7);
      ctx.fillStyle = OUT;
      ctx.beginPath(); ctx.moveTo(L - 6, -1); ctx.lineTo(L - 8, -9); ctx.lineTo(L + 2, -10); ctx.lineTo(L + 1, -1); ctx.closePath(); ctx.fill();
      ctx.fillStyle = w.color || '#9aa0aa';
      ctx.beginPath(); ctx.moveTo(L - 5, -1.5); ctx.lineTo(L - 6.8, -8); ctx.lineTo(L + 1, -8.8); ctx.lineTo(L, -1.5); ctx.closePath(); ctx.fill();
      R('#e6eaf0', L - 6.5, -8.5, 7.5, 1.2);
    } else {
      // sword
      const col = w.color || '#c8ccd6';
      R(OUT, -5, -2, 6, 4); R(OUT, 0, -4.2, 3, 8.4); R(OUT, 2, -2.2, L, 4.4);
      ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(L + 1, -2.2); ctx.lineTo(L + 5, 0); ctx.lineTo(L + 1, 2.2); ctx.fill();
      R('#5a3a20', -4, -1, 4, 2); R('#f2c14e', -5, -1.3, 1.4, 2.6);
      R('#c9a050', 0.5, -3.4, 2, 6.8);
      R(col, 2.5, -1.4, L - 1, 2.8);
      ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(L + 1, -1.4); ctx.lineTo(L + 4, 0); ctx.lineTo(L + 1, 1.4); ctx.fill();
      R('rgba(255,255,255,0.75)', 3, -1.4, L - 2, 0.9);
      R('rgba(0,0,0,0.18)', 3, 0.6, L - 2, 0.8);
      if (o.glow) { R(o.glow, 2, -2.5, L + 3, 5); }
    }
    ctx.restore();
  }

  // Shield seen in 3/4 view: face drawn squashed by viewing angle.
  // s: {shape:'round'|'kite'|'tower', color, w}
  function shield(ctx, s, x, y, ang, raised) {
    if (!s) return;
    const back = Math.sin(ang) < -0.35; // facing away: we see the back
    const sq = 0.4 + 0.6 * Math.abs(Math.sin(ang));
    const w = s.w * sq, h = s.h;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    const rim = back ? '#5e3b1f' : U.shade(s.color, -0.45);
    const face = back ? '#7a5230' : s.color;
    ctx.fillStyle = OUT;
    if (s.shape === 'round') {
      ctx.beginPath(); ctx.ellipse(0, 0, w / 2 + 1, h / 2 + 1, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = rim; ctx.beginPath(); ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = face; ctx.beginPath(); ctx.ellipse(0, 0, w / 2 - 1, h / 2 - 1, 0, 0, Math.PI * 2); ctx.fill();
      if (!back) { ctx.fillStyle = '#d8dce6'; ctx.beginPath(); ctx.ellipse(0, 0, Math.max(1, w / 6), h / 6, 0, 0, Math.PI * 2); ctx.fill(); }
    } else {
      const path = (k) => {
        ctx.beginPath();
        const hw = w / 2 + k, hh = h / 2 + k;
        if (s.shape === 'kite') { ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(hw, hh * 0.15); ctx.lineTo(0, hh); ctx.lineTo(-hw, hh * 0.15); }
        else { ctx.moveTo(-hw, -hh); ctx.lineTo(hw, -hh); ctx.lineTo(hw, hh * 0.7); ctx.lineTo(0, hh); ctx.lineTo(-hw, hh * 0.7); }
        ctx.closePath();
      };
      path(1); ctx.fill();
      ctx.fillStyle = rim; path(0); ctx.fill();
      ctx.fillStyle = face; path(-1.2); ctx.fill();
      if (!back) {
        ctx.fillStyle = s.trim || '#f2c14e';
        ctx.fillRect(-0.6, -h / 2 + 1.5, 1.2, h - 4);
        ctx.fillRect(-w / 2 + 1.5, -h / 2 + h * 0.3, w - 3, 1.2);
      }
    }
    if (raised && !back) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-w / 2 + 1, -h / 2 + 1, Math.max(1, w * 0.3), 1.2); }
    ctx.restore();
  }

  function shieldVis(item, color) {
    if (!item) return null;
    if (item === true) return { shape: 'kite', color: color || '#6a7a8a', w: 12, h: 15 };
    const id = item.id || '';
    if (id === 'buckler') return { shape: 'round', color: item.color || '#9a6a3a', w: 11, h: 11, trim: '#c9a050' };
    if (id === 'tower_shield') return { shape: 'tower', color: item.color || '#7a7f8a', w: 15, h: 19 };
    return { shape: 'kite', color: item.color || '#3b6fc4', w: 12, h: 15 };
  }

  // ------------------------------------------------------------ misc shapes
  function star(ctx, x, y, r, col, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = col;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 ? r * 0.38 : r;
      const a = (i / 8) * Math.PI * 2;
      ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function creatureKind(look) {
    return typeof look === 'string' && CREATURES[look] ? look : null;
  }

  function portrait(ctx, look, x, y, size) {
    const k = creatureKind(look);
    if (!k) { G.chars.portrait(ctx, look, x, y, size); return; }
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, size, size); ctx.clip();
    const spec = CREATURES[k];
    const s = (size * 1.15) / (spec.w + 2);
    if (spec.side) creature(ctx, k, x + size * 0.38, y + size * 0.95, { scale: s, ang: 0, shadow: false });
    else creature(ctx, k, x + size / 2, y + size * (k === 'troll' ? 1.6 : 1.4), { scale: s * (k === 'troll' ? 1.3 : 1.1), shadow: false });
    ctx.restore();
  }

  // ------------------------------------------------------------ arenas
  // A = feet bounds, F = floor rect. Returns cached canvas W×H.
  function arena(kind, W, H, F) {
    const key = `arena:${kind}:${W}x${H}:${F.x0},${F.y0},${F.x1},${F.y1}`;
    let c = cache.get(key);
    if (c) return c;
    for (const k of cache.keys()) if (k.startsWith('arena:')) cache.delete(k);
    let x;
    [c, x] = G.gfx.makeCanvas(W, H);
    const P = (col, a, b, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const rnd = U.rng(1234 + W * 7 + H);
    const noise = (rx0, ry0, rx1, ry1, base, cols, cell = 2, seed = 0) => {
      P(base, rx0, ry0, rx1 - rx0, ry1 - ry0);
      for (let yy = ry0; yy < ry1; yy += cell) for (let xx = rx0; xx < rx1; xx += cell) {
        const h = U.hash2(((xx / cell) | 0) + seed * 101, ((yy / cell) | 0) + seed * 37);
        for (const [th, col] of cols) if (h < th) { P(col, xx, yy, cell, cell); break; }
      }
    };
    const fw = F.x1 - F.x0, fh = F.y1 - F.y0;
    const builders = {
      pit() {
        P('#2e1d12', 0, 0, W, H);
        // stands rows behind the crowd
        for (let r = 0; r * 8 < F.y0; r++) { P(r % 2 ? '#4a3020' : '#3a2618', 0, r * 8, W, 8); P('#5a3a24', 0, r * 8 + 7, W, 1); }
        noise(F.x0, F.y0, F.x1, F.y1, '#d8b47a', [[0.12, '#c9a46a'], [0.2, '#cfab70'], [0.9, '#d8b47a'], [0.97, '#e4c38b'], [1, '#b8925a']]);
        // raked ring
        x.strokeStyle = 'rgba(150,110,60,0.35)'; x.lineWidth = 1;
        const cx = W / 2, cy = (F.y0 + F.y1) / 2;
        const rr = Math.min(fw * 0.42, fh * 0.55);
        for (const k of [1, 1.07]) { x.beginPath(); x.ellipse(cx, cy, rr * k, rr * k * 0.72, 0, 0, Math.PI * 2); x.stroke(); }
        x.fillStyle = 'rgba(150,110,60,0.18)'; x.beginPath(); x.ellipse(cx, cy, 6, 4, 0, 0, 7); x.fill();
        // wall face along the top
        const wy = F.y0 - 12;
        for (let px = 0; px < W; px += 6) { P('#8a5a32', px, wy, 6, 12); P('#5e3b1f', px, wy, 1, 12); P('#a06a3a', px + 1, wy + 1, 2, 10); }
        P('#a8743f', 0, wy - 2, W, 3); P('#6a4022', 0, wy + 11, W, 1);
        P('rgba(0,0,0,0.25)', F.x0, F.y0, fw, 4);
        // side + bottom palisades
        const pal = (px, py, w, h) => { P('#7a4b2a', px, py, w, h); };
        pal(0, wy, F.x0, H); pal(F.x1, wy, W - F.x1, H); pal(0, F.y1, W, H - F.y1);
        for (let py = wy; py < H; py += 7) { P('#a8743f', 0, py, F.x0, 2); P('#a8743f', F.x1, py, W - F.x1, 2); }
        for (let px = 0; px < W; px += 7) P('#a8743f', px, F.y1, 2, H - F.y1);
        P('#5e3b1f', F.x0 - 1, wy, 1, H); P('#5e3b1f', F.x1, wy, 1, H); P('#5e3b1f', 0, F.y1, W, 1);
      },
      field() {
        noise(0, 0, W, H, '#5a9a3c', [[0.2, '#4f8a37'], [0.3, '#4a8233']], 2, 3);
        noise(F.x0, F.y0, F.x1, F.y1, '#6db04a', [[0.1, '#62a142'], [0.18, '#66a845'], [0.93, '#6db04a'], [1, '#7bbd56']]);
        for (let i = 0; i < (fw * fh) / 260; i++) {
          const fx = F.x0 + rnd() * fw, fy = F.y0 + rnd() * fh;
          if (rnd() < 0.55) { P('#4f8a37', fx, fy, 1, 2); P('#4f8a37', fx + 2, fy, 1, 2); P('#4f8a37', fx + 1, fy + 1, 1, 1); continue; }
          const col = U.pick(['#ffffff', '#f2c14e', '#e86aa0', '#9fd8ff']);
          P(col, fx - 1, fy, 3, 1); P(col, fx, fy - 1, 1, 3); P('#f2c14e', fx, fy, 1, 1);
        }
        hedge();
      },
      forest() {
        noise(0, 0, W, H, '#2f5a26', [[0.3, '#284e20']], 2, 5);
        noise(F.x0, F.y0, F.x1, F.y1, '#5a9440', [[0.12, '#4f8738'], [0.2, '#53893b'], [0.94, '#5a9440'], [1, '#669f4a']], 2, 2);
        for (let i = 0; i < (fw * fh) / 300; i++) {
          const fx = F.x0 + rnd() * fw, fy = F.y0 + rnd() * fh;
          const r = rnd();
          if (r < 0.5) P(U.pick(['#a8743f', '#c98a3a', '#8a5a2a']), fx, fy, 2, 1);
          else if (r < 0.58) { P('#e8dcc8', fx, fy, 3, 1); P('#d6453d', fx, fy - 2, 3, 2); P('#fff', fx + 1, fy - 2, 1, 1); }
          else if (r < 0.75) { P('#3f7a32', fx, fy, 1, 2); P('#3f7a32', fx + 2, fy, 1, 2); }
        }
        const tree = (tx, ty, r) => {
          P('#5e3b1f', tx - 2, ty - 2, 4, 8);
          x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(tx, ty + 6, r, r * 0.35, 0, 0, 7); x.fill();
          for (const [dy, rr, col] of [[0, r, '#1f4a1c'], [-2, r * 0.85, '#2f6b2a'], [-4, r * 0.6, '#3f8a35'], [-6, r * 0.3, '#5aa848']]) {
            x.fillStyle = col; x.beginPath(); x.arc(tx - (r - rr) * 0.3, ty - r * 0.6 + dy, rr, 0, 7); x.fill();
          }
        };
        for (let tx = -4; tx < W + 10; tx += 13) tree(tx + rnd() * 4, F.y0 - 10 - rnd() * 6, 10 + rnd() * 4);
        for (let ty = F.y0; ty < H + 10; ty += 18) { tree(F.x0 - 6 + rnd() * 3, ty + rnd() * 5, 8 + rnd() * 3); tree(F.x1 + 6 - rnd() * 3, ty + rnd() * 5, 8 + rnd() * 3); }
        for (let tx = 8; tx < W; tx += 18) tree(tx + rnd() * 6, H + 4, 9);
      },
      road() {
        noise(0, 0, W, H, '#5f9f42', [[0.15, '#55923b'], [0.95, '#5f9f42'], [1, '#6eae50']], 2, 7);
        const vert = H > W;
        const rw = (vert ? fw : fh) * 0.62;
        const r0 = vert ? W / 2 - rw / 2 : (F.y0 + F.y1) / 2 - rw / 2;
        if (vert) noise(r0, 0, r0 + rw, H, '#b48a58', [[0.12, '#a57c4c'], [0.9, '#b48a58'], [1, '#c49a68']], 2, 9);
        else noise(0, r0, W, r0 + rw, '#b48a58', [[0.12, '#a57c4c'], [0.9, '#b48a58'], [1, '#c49a68']], 2, 9);
        // ragged edges + ruts
        for (let t = 0; t < (vert ? H : W); t += 2) {
          const j1 = (U.hash2(t, 3) * 3) | 0, j2 = (U.hash2(t, 9) * 3) | 0;
          if (vert) { P('#5f9f42', r0 - 1, t, j1, 2); P('#5f9f42', r0 + rw - j2 + 1, t, j2, 2); P('#9a7044', r0 + rw * 0.3, t, 2, 2); P('#9a7044', r0 + rw * 0.7, t, 2, 2); }
          else { P('#5f9f42', t, r0 - 1, 2, j1); P('#5f9f42', t, r0 + rw - j2 + 1, 2, j2); P('#9a7044', t, r0 + rw * 0.3, 2, 2); P('#9a7044', t, r0 + rw * 0.7, 2, 2); }
        }
        for (let i = 0; i < 40; i++) {
          const px = vert ? r0 + rnd() * rw : rnd() * W, py = vert ? rnd() * H : r0 + rnd() * rw;
          P('#8a8478', px, py, 2, 1); P('#c9c0b0', px, py, 1, 1);
        }
        // border rocks & bushes
        const rock = (rx, ry) => { P(OUT, rx - 1, ry - 1, 9, 7); P('#8a8478', rx, ry, 7, 5); P('#a8a294', rx + 1, ry, 4, 2); P('#6a6458', rx, ry + 4, 7, 1); };
        const bush = (bx, by) => { x.fillStyle = OUT; x.beginPath(); x.arc(bx, by, 6, 0, 7); x.fill(); x.fillStyle = '#3f7a32'; x.beginPath(); x.arc(bx, by, 5, 0, 7); x.fill(); P('#5aa848', bx - 2, by - 3, 3, 2); };
        for (let px = 4; px < W; px += 14) (rnd() < 0.5 ? rock : bush)(px, F.y0 - 8 + rnd() * 3);
        for (let py = F.y0; py < H; py += 16) { (rnd() < 0.5 ? rock : bush)(F.x0 - 5, py); (rnd() < 0.5 ? rock : bush)(F.x1 + 3, py + 6); }
        for (let px = 10; px < W; px += 16) bush(px, H + 1);
        // milestone
        P(OUT, W - 30, F.y0 - 26, 10, 16); P('#a8a294', W - 29, F.y0 - 25, 8, 14); P('#6a6458', W - 27, F.y0 - 21, 4, 1);
      },
      castle() {
        // stone tile floor
        P('#6e685e', 0, 0, W, H);
        const T = 16;
        for (let ty = F.y0; ty < F.y1; ty += T / 2) {
          const row = ((ty - F.y0) / (T / 2)) | 0;
          for (let tx = F.x0 - (row % 2 ? T / 2 : 0); tx < F.x1; tx += T) {
            const h = U.hash2(tx, ty);
            const col = h < 0.3 ? '#928c80' : h < 0.7 ? '#9a9488' : '#a49e92';
            P(col, tx + 1, ty + 1, T - 1, T / 2 - 1);
            P('rgba(255,255,255,0.12)', tx + 1, ty + 1, T - 1, 1);
            if (h > 0.9) { P('#7a7468', tx + 4, ty + 3, 3, 1); P('#7a7468', tx + 6, ty + 4, 2, 1); }
          }
        }
        // red carpet ring
        x.strokeStyle = 'rgba(160,30,40,0.35)'; x.lineWidth = 3;
        const cr = Math.min(fw * 0.36, fh * 0.5);
        x.beginPath(); x.ellipse(W / 2, (F.y0 + F.y1) / 2, cr, cr * 0.72, 0, 0, 7); x.stroke();
        x.strokeStyle = 'rgba(242,193,78,0.25)'; x.lineWidth = 1;
        x.beginPath(); x.ellipse(W / 2, (F.y0 + F.y1) / 2, cr - 3, cr * 0.72 - 3, 0, 0, 7); x.stroke();
        // top wall face + crenellations
        const wy = F.y0 - 16;
        P('#7a7468', 0, 0, W, F.y0);
        for (let by = 6; by < F.y0; by += 6) for (let bx = (by / 6) % 2 ? -6 : 0; bx < W; bx += 12) { P('#6a645a', bx, by, 1, 6); P('#6a645a', bx, by, 12, 1); P('rgba(255,255,255,0.08)', bx + 1, by + 1, 10, 1); }
        for (let bx = 0; bx < W; bx += 12) { P('#8a8478', bx, 0, 7, 6); P('#5a544a', bx + 7, 0, 5, 6); }
        P('#5a544a', 0, F.y0 - 2, W, 2);
        P('rgba(0,0,0,0.3)', F.x0, F.y0, fw, 5);
        // side walls (tops)
        P('#8a8478', 0, wy, F.x0, H); P('#8a8478', F.x1, wy, W - F.x1, H); P('#8a8478', 0, F.y1, W, H - F.y1);
        for (let py = wy; py < H; py += 8) { P('#6a645a', 0, py, F.x0, 1); P('#6a645a', F.x1, py, W - F.x1, 1); }
        for (let px = 0; px < W; px += 8) P('#6a645a', px, F.y1, 1, H - F.y1);
        P('#4a443a', F.x0 - 1, wy, 1, H); P('#4a443a', F.x1, wy, 1, H); P('#4a443a', 0, F.y1, W, 1);
      },
      practice() {
        noise(0, 0, W, H, '#6aa94a', [[0.15, '#5f9c42'], [0.95, '#6aa94a'], [1, '#78b656']], 2, 11);
        noise(F.x0, F.y0, F.x1, F.y1, '#72b350', [[0.1, '#66a745'], [0.95, '#72b350'], [1, '#82c160']], 2, 12);
        // worn dirt ring
        const cx = W / 2, cy = (F.y0 + F.y1) / 2, rx = Math.min(fw * 0.44, fh * 0.6), ry = Math.min(rx * 0.8, fh * 0.42);
        for (let yy = F.y0; yy < F.y1; yy += 2) for (let xx = F.x0; xx < F.x1; xx += 2) {
          const d = ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2;
          const h = U.hash2(xx, yy);
          if (d < 0.85 || (d < 1.05 && h < (1.05 - d) * 5)) P(h < 0.15 ? '#a8824f' : h > 0.92 ? '#c8a26f' : '#b8925f', xx, yy, 2, 2);
        }
        // top: cottage wall, hay, weapon rack
        P('#8a7a66', 0, 0, W, F.y0 - 8);
        for (let by = 2; by < F.y0 - 8; by += 5) for (let bx = (by / 5) % 2 ? -5 : 0; bx < W; bx += 10) P('#6e6050', bx, by, 10, 1), P('#6e6050', bx, by, 1, 5);
        P('#5a3a20', W * 0.2, 6, 14, 12); P('#9fd8ff', W * 0.2 + 2, 8, 10, 8); P('#5a3a20', W * 0.2 + 6, 8, 2, 8); P('#5a3a20', W * 0.2 + 2, 11, 10, 2);
        const hay = (hx, hy) => { P(OUT, hx - 1, hy - 1, 16, 11); P('#e6c75a', hx, hy, 14, 9); P('#c9a43a', hx, hy + 3, 14, 1); P('#c9a43a', hx, hy + 6, 14, 1); P('#f4e08a', hx + 1, hy, 12, 1); };
        hay(W - 26, F.y0 - 20); hay(W - 40, F.y0 - 16);
        // rack
        const rx0 = W * 0.5 - 12;
        P('#5e3b1f', rx0, F.y0 - 22, 24, 2); P('#5e3b1f', rx0 + 1, F.y0 - 22, 2, 14); P('#5e3b1f', rx0 + 21, F.y0 - 22, 2, 14);
        for (let i = 0; i < 4; i++) { P('#c8ccd6', rx0 + 5 + i * 4, F.y0 - 26, 1, 16); P('#c9a050', rx0 + 4 + i * 4, F.y0 - 13, 3, 1); }
        fence();
      },
    };
    function hedge() {
      const top = F.y0 - 6;
      const bump = (bx, by, r) => { x.fillStyle = OUT; x.beginPath(); x.arc(bx, by, r + 1, 0, 7); x.fill(); x.fillStyle = '#3f7a32'; x.beginPath(); x.arc(bx, by, r, 0, 7); x.fill(); x.fillStyle = '#4f8f3c'; x.beginPath(); x.arc(bx - r * 0.3, by - r * 0.3, r * 0.5, 0, 7); x.fill(); };
      for (let bx = -2; bx < W + 8; bx += 9) bump(bx, top + (U.hash2(bx, 1) * 3), 7);
      for (let by = top; by < H + 8; by += 9) { bump(F.x0 - 5, by, 6); bump(F.x1 + 5, by + 4, 6); }
      for (let bx = 0; bx < W + 8; bx += 9) bump(bx, H + 2, 6);
      // distant meadow
      for (let i = 0; i < 18; i++) { const fx = rnd() * W, fy = rnd() * (top - 10); P(U.pick(['#ffffff', '#f2c14e', '#e86aa0']), fx, fy, 1, 1); }
    }
    function fence() {
      const rail = (x0, y0, x1, y1) => { x.strokeStyle = OUT; x.lineWidth = 3; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); x.strokeStyle = '#a8743f'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
      const post = (px, py) => { P(OUT, px - 2, py - 9, 5, 11); P('#8a5a32', px - 1, py - 8, 3, 9); P('#b07a42', px - 1, py - 8, 3, 1); };
      const ty = F.y0 - 3, by = F.y1 + 4;
      rail(0, ty - 5, W, ty - 5); rail(0, ty - 2, W, ty - 2);
      rail(0, by - 5, W, by - 5); rail(0, by - 2, W, by - 2);
      rail(F.x0 - 3, ty, F.x0 - 3, by); rail(F.x1 + 3, ty, F.x1 + 3, by);
      for (let px = 2; px < W; px += 16) { post(px, ty); post(px, by); }
      for (let py = ty + 16; py < by; py += 16) { post(F.x0 - 3, py); post(F.x1 + 3, py); }
    }
    (builders[kind] || builders.field)();
    cache.set(key, c);
    return c;
  }

  // Animated arena details drawn every frame on top of the cached floor.
  function arenaFx(ctx, kind, W, H, F, t, cheer, crowd) {
    if (kind === 'pit' && crowd) {
      for (const p of crowd) {
        const amp = 0.6 + cheer * 2.5;
        const by = p.y - Math.max(0, Math.sin(t * (6 + p.s * 4) + p.ph)) * amp;
        ctx.fillStyle = p.shirt; ctx.fillRect(p.x - 2.5, by + 1, 5, 4);
        if (cheer > 0.3 && p.s > 0.4) { ctx.fillRect(p.x - 3.5, by - 3, 1, 4); ctx.fillRect(p.x + 2.5, by - 3, 1, 4); }
        ctx.fillStyle = p.skin; ctx.fillRect(p.x - 1.5, by - 2, 3, 3);
        if (p.hat) { ctx.fillStyle = p.hat; ctx.fillRect(p.x - 2, by - 3, 4, 1.5); }
      }
      // pennants on the wall rail
      const wy = F.y0 - 14;
      for (let px = 6; px < W; px += 16) {
        const sw = Math.sin(t * 3 + px) * 1;
        ctx.fillStyle = (px / 16) % 2 < 1 ? '#d6453d' : '#3f7fd1';
        ctx.beginPath(); ctx.moveTo(px, wy); ctx.lineTo(px + 7, wy); ctx.lineTo(px + 3.5 + sw, wy + 6); ctx.fill();
      }
    } else if (kind === 'castle') {
      const n = Math.max(2, Math.floor(W / 60));
      for (let i = 0; i < n; i++) {
        const by = Math.max(8, F.y0 - 34);
        const bx = ((i + 0.5) * W) / n - 6;
        const bh = Math.min(20, F.y0 - 14 - by + 8);
        ctx.fillStyle = OUT; ctx.fillRect(bx - 2, by - 2, 16, 2);
        for (let r = 0; r < bh; r += 2) {
          const sw = Math.sin(t * 2.2 + i + r * 0.25) * (r / bh) * 1.6;
          ctx.fillStyle = '#a8262e'; ctx.fillRect(bx + sw, by + r, 12, 2);
          ctx.fillStyle = '#f2c14e'; ctx.fillRect(bx + sw, by + r, 1, 2); ctx.fillRect(bx + 11 + sw, by + r, 1, 2);
        }
        const sw = Math.sin(t * 2.2 + i + bh * 0.25) * 1.6;
        ctx.fillStyle = '#a8262e'; ctx.beginPath(); ctx.moveTo(bx + sw, by + bh); ctx.lineTo(bx + 12 + sw, by + bh); ctx.lineTo(bx + 6 + sw, by + bh + 5); ctx.fill();
        star(ctx, bx + 6 + sw * 0.5, by + bh * 0.45, 3, '#f2c14e', 0);
        // torch between banners
        if (i < n - 1) {
          const tx = ((i + 1) * W) / n, ty = F.y0 - 14;
          ctx.fillStyle = '#4a3020'; ctx.fillRect(tx - 1, ty, 2, 6);
          const fl = Math.sin(t * 17 + i * 3) * 0.8;
          ctx.fillStyle = '#f08a2a'; ctx.beginPath(); ctx.ellipse(tx, ty - 2, 2.5, 4 + fl, 0, 0, 7); ctx.fill();
          ctx.fillStyle = '#ffe48a'; ctx.beginPath(); ctx.ellipse(tx, ty - 1, 1.2, 2 + fl * 0.5, 0, 0, 7); ctx.fill();
        }
      }
    } else if (kind === 'forest') {
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.12 + i * 0.37) % 1;
        const lx = ((i * 71) % W) + Math.sin(t * 1.5 + i) * 10, ly = F.y0 - 10 + ph * (H - F.y0);
        ctx.globalAlpha = Math.min(1, (1 - ph) * 3);
        ctx.fillStyle = i % 2 ? '#c98a3a' : '#a8743f';
        ctx.fillRect(lx, ly, 2, 1); ctx.fillRect(lx + 1, ly + 1, 1, 1);
      }
      ctx.globalAlpha = 1;
    } else if (kind === 'field') {
      for (let i = 0; i < 2; i++) {
        const bx = W * (0.3 + 0.4 * i) + Math.sin(t * 0.7 + i * 2) * W * 0.25, by = F.y0 + 20 + Math.sin(t * 0.9 + i) * 20 + i * (H - F.y0) * 0.5;
        const fl = Math.sin(t * 18 + i) > 0 ? 2 : 1;
        ctx.fillStyle = i ? '#f2c14e' : '#ffffff';
        ctx.fillRect(bx - fl, by, fl, 2); ctx.fillRect(bx + 1, by, fl, 2);
        ctx.fillStyle = OUT; ctx.fillRect(bx, by, 1, 2);
      }
    } else if (kind === 'practice') {
      const fx = W - 12, fy = 4;
      ctx.fillStyle = '#5e3b1f'; ctx.fillRect(fx, fy, 1, 22);
      for (let r = 0; r < 6; r++) { const sw = Math.sin(t * 4 + r * 0.6) * r * 0.3; ctx.fillStyle = r % 2 ? '#3f7fd1' : '#f2e6c8'; ctx.fillRect(fx - 10 + sw, fy + 1 + r, 10, 1); }
    }
  }

  function makeCrowd(W, F) {
    const rnd = U.rng(77 + W);
    const out = [];
    const rows = [];
    for (let y = 5; y < F.y0 - 15; y += 8) rows.push(y);
    for (const ry of rows) for (let px = 4 + (ry % 2) * 3; px < W - 2; px += 7) {
      if (rnd() < 0.12) continue;
      out.push({
        x: px + rnd() * 2, y: ry, s: rnd(), ph: rnd() * 6,
        skin: U.pick(['#f1c27d', '#e0ac69', '#c68642', '#f5cfa8', '#8d5524']),
        shirt: U.pick(['#d6453d', '#3f7fd1', '#5bb04a', '#f2c14e', '#8a5ac8', '#e07a3a', '#e8e8e8']),
        hat: rnd() < 0.25 ? U.pick(['#6a2f8a', '#3a2a1a', '#a8262e']) : null,
      });
    }
    return out;
  }

  G.SW.art = { creature, creatureKind, CREATURES, weapon, shield, shieldVis, star, portrait, arena, arenaFx, makeCrowd };
})();
