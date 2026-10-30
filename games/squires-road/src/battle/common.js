// Shared battle presentation (sword, joust, archery) so the three feel like one game:
// the VS intro bands, the VICTORY / DEFEATED outro, the control-hint pill, and a
// blur tracker. Runtime-only helpers: nothing here touches other modules at load.
(() => {
  const U = G.U;
  const TAU = Math.PI * 2;
  const GOLD = '#f2c14e', CREAM = '#fff3d6', INK = '#1a0f08';

  const BUI = {
    INTRO_T: 2.3,      // intro auto-advances after this
    INTRO_SKIP: 0.6,   // a tap skips it after this
    OUTRO_T: 4.0,      // outro auto-continues after this
    OUTRO_SKIP: 1.0,   // a tap continues after this
    HINT_T: 7,         // control hints show this long in the first round
    lastBlur: -1e9,    // performance.now() of the last focus loss / hide

    // Touch is the default presentation; keys only when the last input was a key.
    touch() {
      if (G.input.lastWasTouch) return true;
      if (BUI.keyUsed) return false;
      return 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
    },
    // true if the window lost focus in the last `ms` (a lost pointer is not a release).
    blurredWithin(ms = 400) { return performance.now() - BUI.lastBlur < ms; },

    // ------------------------------------------------------------------ intro
    // o = { title, you:{look, name, sub}, foe:{name, sub, portrait(ctx,x,y,s)}, footer }
    drawIntro(ctx, t, o) {
      const D = G.draw, W = G.W, H = G.H;
      const k = U.ease.outCubic(Math.min(1, t / 0.35));
      const outAt = (o.dur || BUI.INTRO_T) - 0.3;
      const out = t > outAt ? Math.min(1, (t - outAt) / 0.3) : 0;
      ctx.globalAlpha = 0.5 * (1 - out);
      D.rect(0, 0, W, H, '#000');
      ctx.globalAlpha = 1 - out;
      const bh = Math.round(U.clamp(H * 0.26, 44, 64));
      const cy = Math.round(H / 2);
      const ox1 = (1 - k) * -W - out * W, ox2 = (1 - k) * W + out * W;
      const band = (x, y, col) => {
        D.rect(x, y, W, bh, col);
        D.rect(x, y, W, 3, GOLD); D.rect(x, y + bh - 3, W, 3, GOLD);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        for (let i = -1; i < W / 14 + 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * 14, y + 3); ctx.lineTo(x + i * 14 + 7, y + 3); ctx.lineTo(x + i * 14 - 3, y + bh - 3); ctx.lineTo(x + i * 14 - 10, y + bh - 3); ctx.fill(); }
      };
      band(ox1, cy - bh - 6, '#2a4a8a');
      band(ox2, cy + 6, '#8a2a2a');
      const ps = bh - 14;
      const big = W >= 230 ? 11 : 9;
      // you (top band, from the left)
      const you = o.you || {};
      D.rrect(ox1 + 10, cy - bh + 1, ps, ps, 3, '#e9d3a4', '#21160f', 1.5);
      G.chars.portrait(ctx, you.look || G.state.look || 'hero', ox1 + 10, cy - bh + 1, ps);
      const nx = ox1 + ps + 18, maxW1 = W - ps - 26;
      D.text(fit(you.name || G.state.name || 'Squire', big, maxW1), nx, cy - bh / 2 - 12, { size: big, bold: true, color: '#ffffff', outline: '#10182a', outlineW: 3 });
      if (you.sub) D.text(fit(you.sub, 7, maxW1), nx, cy - bh / 2 + 4, { size: 7, color: '#d8e4ff' });
      // foe (bottom band, from the right)
      const foe = o.foe || {};
      const ex = ox2 + W - 10 - ps, ey = cy + 13;
      D.rrect(ex, ey, ps, ps, 3, '#e9d3a4', '#21160f', 1.5);
      if (foe.portrait) foe.portrait(ctx, ex, ey, ps);
      const nm = foe.name || '';
      const maxW2 = W - ps - 26;
      const ns = D.measure(nm, big) > maxW2 ? Math.max(7, Math.floor(big * maxW2 / D.measure(nm, big))) : big;
      D.text(fit(nm, ns, maxW2), ex - 8, cy + 6 + bh / 2 - 8, { size: ns, bold: true, align: 'right', color: '#ffffff', outline: '#2a1010', outlineW: 3 });
      if (foe.sub) D.text(fit(foe.sub, 7, maxW2), ex - 8, cy + 6 + bh / 2 + 6, { size: 7, align: 'right', color: '#ffd8d0' });
      // VS
      const vsk = U.clamp((t - 0.3) / 0.2, 0, 1);
      if (vsk > 0) {
        const s = 1 + (1 - U.ease.outBack(vsk)) * 1.5;
        D.text('VS', W / 2, cy, { size: Math.round(22 * s), align: 'center', baseline: 'middle', bold: true, color: '#ffe48a', outline: '#3a1a10', outlineW: 5 });
      }
      // title chip above, footer chip below
      chipText(ctx, o.title || 'Duel!', cy - bh - 26, 9, '#ffe48a');
      if (o.footer && t > 0.45) {
        ctx.globalAlpha = (1 - out) * U.clamp((t - 0.45) / 0.25, 0, 1);
        chipText(ctx, o.footer, cy + bh + 12, 7, CREAM);
      }
      if (o.quip && t > 0.8) {
        ctx.globalAlpha = (1 - out) * U.clamp((t - 0.8) / 0.25, 0, 1);
        const qy = cy + bh + (o.footer ? 32 : 12);
        const w = Math.min(W - 16, D.measure(o.quip, 7) + 18);
        const lines = D.measure(o.quip, 7) > W - 34 ? 2 : 1;
        D.rrect(W / 2 - w / 2, qy, w, 8 + lines * 9, 5, 'rgba(20,12,8,0.82)');
        D.text(o.quip, W / 2, qy + 4, { size: 7, align: 'center', color: '#ffffff', maxW: W - 34, lineH: 9 });
      }
      ctx.globalAlpha = 1;
    },

    // ------------------------------------------------------------------ banner
    // Big centre word ("FIGHT!", "CHARGE!", "END 2"). k = 0..1 through its life.
    drawShout(ctx, word, k, o = {}) {
      const D = G.draw, W = G.W, H = G.H;
      const s = k < 0.2 ? 2.2 - U.ease.outBack(k / 0.2) * 1.2 : 1 + (k - 0.2) * 0.1;
      ctx.globalAlpha = k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1;
      const size = Math.round(Math.min(26, W / 7) * s);
      D.text(word, W / 2, o.y ?? H * 0.45, { size, align: 'center', baseline: 'middle', bold: true, color: o.color || '#ffe48a', outline: '#3a1a10', outlineW: 5 });
      if (o.sub) D.text(o.sub, W / 2, (o.y ?? H * 0.45) + size * 0.75, { size: 8, align: 'center', baseline: 'middle', color: CREAM, outline: INK, outlineW: 2 });
      ctx.globalAlpha = 1;
    },

    // ------------------------------------------------------------------ outro
    // o = { won, sub, detail, rt (running time for the blink), y }
    drawOutro(ctx, pt, o) {
      const D = G.draw, W = G.W, H = G.H;
      const won = !!o.won;
      const y0 = o.y ?? H * 0.42;
      const k = Math.min(1, pt / 0.4);
      const size = Math.min(28, Math.floor(W / 7.5));
      const bandH = size + 50 + (o.detail ? 14 : 0);
      ctx.globalAlpha = 0.55 * k;
      D.rect(0, y0 - size - 4, W, bandH, won ? '#3a2a08' : '#200808');
      ctx.globalAlpha = k;
      D.rect(0, y0 - size - 4, W, 1.5, won ? GOLD : '#8a3a30');
      D.rect(0, y0 - size - 4 + bandH - 1.5, W, 1.5, won ? GOLD : '#8a3a30');
      ctx.globalAlpha = 1;
      const word = won ? 'VICTORY!' : 'DEFEATED';
      const tw = D.measure(word, size);
      let x = W / 2 - tw / 2;
      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        const lk = U.clamp((pt - i * 0.05) / 0.3, 0, 1);
        const bounce = won ? -Math.abs(Math.sin(pt * 4 + i * 0.6)) * 3 * lk : (1 - lk) * -20;
        ctx.globalAlpha = lk;
        D.text(ch, x, y0 - size * 0.35 + bounce - (1 - U.ease.outBack(lk)) * 16, { size, bold: true, baseline: 'middle', color: won ? '#ffe48a' : '#c8c0c0', outline: won ? '#3a1a10' : '#1a0a0a', outlineW: 5 });
        x += D.measure(ch, size);
      }
      ctx.globalAlpha = Math.min(1, pt);
      let y = y0 + size * 0.45;
      if (o.sub) { D.text(o.sub, W / 2, y, { size: 8, align: 'center', baseline: 'middle', color: CREAM, outline: INK, outlineW: 2, maxW: 0 }); y += 13; }
      if (o.detail) { D.text(o.detail, W / 2, y, { size: 9, bold: true, align: 'center', baseline: 'middle', color: '#ffe48a', outline: INK, outlineW: 2.5 }); y += 13; }
      if (pt > BUI.OUTRO_SKIP) {
        const rt = o.rt ?? pt;
        D.text('Tap to continue', W / 2, y + 2, { size: 7, align: 'center', baseline: 'middle', color: `rgba(255,243,214,${0.55 + 0.4 * Math.sin(rt * 5)})`, outline: INK, outlineW: 2 });
      }
      ctx.globalAlpha = 1;
    },

    // ------------------------------------------------------------------ hint
    // The one control-hint style: a dark pill with a gold edge, 7 px cream lines.
    // y = top of the pill (default: near the bottom of the screen).
    drawHint(ctx, lines, alpha, y) {
      if (alpha <= 0 || !lines || !lines.length) return null;
      const D = G.draw, W = G.W, H = G.H;
      let tw = 0;
      for (const l of lines) tw = Math.max(tw, D.measure(l, 7));
      const size = tw + 16 > W - 8 ? 6 : 7;
      if (size === 6) { tw = 0; for (const l of lines) tw = Math.max(tw, D.measure(l, 6)); }
      const w = Math.min(W - 8, tw + 16), h = 6 + lines.length * (size + 4);
      const py = y ?? H - h - 18;
      ctx.globalAlpha = alpha;
      D.rrect(W / 2 - w / 2, py, w, h, 6, 'rgba(25,15,8,0.82)', 'rgba(242,193,78,0.85)', 1);
      for (let i = 0; i < lines.length; i++) D.text(lines[i], W / 2, py + 3 + (size + 4) * (i + 0.5) + 0.5, { size, align: 'center', baseline: 'middle', color: i === 0 ? '#ffe48a' : CREAM });
      ctx.globalAlpha = 1;
      return { x: W / 2 - w / 2, y: py, w, h };
    },
  };

  // small dark chip with gold edge (titles / footers)
  function chipText(ctx, s, y, size, col) {
    const D = G.draw, W = G.W;
    const str = fit(s, size, W - 30);
    const tw = Math.min(W - 16, D.measure(str, size) + 22);
    D.rrect(W / 2 - tw / 2, y, tw, size + 8, 5, 'rgba(20,12,8,0.85)', GOLD, 1);
    D.text(str, W / 2, y + (size + 8) / 2 + 0.5, { size, align: 'center', baseline: 'middle', bold: true, color: col });
  }
  // truncate with an ellipsis to fit maxW
  function fit(s, size, maxW) {
    s = String(s);
    const D = G.draw;
    if (D.measure(s, size) <= maxW) return s;
    while (s.length > 3 && D.measure(s + '…', size) > maxW) s = s.slice(0, -1);
    return s + '…';
  }
  BUI.fit = fit;

  window.addEventListener('blur', () => { BUI.lastBlur = performance.now(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) BUI.lastBlur = performance.now(); });
  window.addEventListener('keydown', () => { BUI.keyUsed = true; });
  window.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') BUI.keyUsed = false; });

  G.BUI = BUI;
})();
