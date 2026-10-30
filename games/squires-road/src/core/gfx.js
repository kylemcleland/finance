// Core: canvas setup, logical resolution, drawing helpers.
(() => {
  const MIN_SHORT = 180; // short side in logical px, at least
  const FONT = '"Trebuchet MS", "Segoe UI", Verdana, system-ui, sans-serif';

  const canvas = document.createElement('canvas');
  canvas.id = 'game';
  const ctx = canvas.getContext('2d', { alpha: false });

  const gfx = {
    canvas, ctx, scale: 1, dpr: 1, cssW: 0, cssH: 0,
    mount() {
      document.body.appendChild(canvas);
      window.addEventListener('resize', () => gfx.resize());
      window.addEventListener('orientationchange', () => setTimeout(() => gfx.resize(), 100));
      gfx.resize();
    },
    resize() {
      const vv = window.visualViewport;
      const cssW = Math.floor(vv ? vv.width : window.innerWidth);
      const cssH = Math.floor(vv ? vv.height : window.innerHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const short = Math.min(cssW, cssH);
      // Integer CSS scale so pixel art stays crisp; never below 1.
      let scale = Math.max(1, Math.floor(short / MIN_SHORT));
      // Allow fractional scale on tiny screens / desktop very large ones.
      if (short / scale > MIN_SHORT * 1.6) scale = short / (MIN_SHORT * 1.25);
      gfx.cssW = cssW; gfx.cssH = cssH; gfx.dpr = dpr; gfx.scale = scale;
      canvas.style.width = cssW + 'px';
      canvas.style.height = cssH + 'px';
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      G.W = Math.ceil(cssW / scale);
      G.H = Math.ceil(cssH / scale);
      gfx.reset();
      if (G.scenes) for (const s of G.scenes.stack) s.resize && s.resize();
    },
    reset() {
      ctx.setTransform(gfx.scale * gfx.dpr, 0, 0, gfx.scale * gfx.dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    },
    toLogical(clientX, clientY) {
      const r = canvas.getBoundingClientRect();
      return { x: (clientX - r.left) / gfx.scale, y: (clientY - r.top) / gfx.scale };
    },
    // Offscreen canvas helper.
    makeCanvas(w, h) {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      return [c, x];
    },
  };
  G.gfx = gfx;
  G.FONT = FONT;

  const draw = {
    font(size = 8, bold = false) {
      return `${bold ? 'bold ' : ''}${size}px ${FONT}`;
    },
    text(str, x, y, o = {}) {
      const size = o.size || 8;
      ctx.font = draw.font(size, o.bold !== false && size <= 10 ? true : !!o.bold);
      ctx.textAlign = o.align || 'left';
      ctx.textBaseline = o.baseline || 'top';
      str = String(str);
      if (o.maxW) {
        const lines = G.U.wrapText(ctx, str, o.maxW);
        const lh = o.lineH || size * 1.25;
        lines.forEach((ln, i) => draw.text(ln, x, y + i * lh, { ...o, maxW: 0 }));
        return lines.length * lh;
      }
      if (o.outline) {
        ctx.lineWidth = o.outlineW || Math.max(1.5, size / 5);
        ctx.strokeStyle = o.outline;
        ctx.lineJoin = 'round';
        ctx.strokeText(str, x, y);
      }
      if (o.shadow) {
        ctx.fillStyle = o.shadow === true ? 'rgba(0,0,0,0.45)' : o.shadow;
        ctx.fillText(str, x + 0.75, y + 0.75);
      }
      ctx.fillStyle = o.color || G.PAL.ink;
      ctx.fillText(str, x, y);
      return size * 1.25;
    },
    measure(str, size = 8, bold = true) {
      ctx.font = draw.font(size, bold);
      return ctx.measureText(String(str)).width;
    },
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
    rrect(x, y, w, h, r, fill, stroke, lw = 1) {
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    },
    circle(x, y, r, fill, stroke, lw = 1) {
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    },
    line(x1, y1, x2, y2, color, lw = 1) {
      ctx.beginPath();
      ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
      ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round';
      ctx.stroke();
    },
    shadow(x, y, w, alpha = 0.28) {
      ctx.fillStyle = `rgba(0,0,0,${alpha})`;
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, w / 5, 0, 0, Math.PI * 2);
      ctx.fill();
    },
    bar(x, y, w, h, frac, fg, bg = 'rgba(0,0,0,0.45)', border = '#1a120c') {
      frac = G.U.clamp(frac, 0, 1);
      ctx.fillStyle = border;
      ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
      ctx.fillStyle = bg;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = fg;
      ctx.fillRect(x, y, Math.round(w * frac * 2) / 2, h);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, y, Math.round(w * frac * 2) / 2, Math.max(1, h / 3));
    },
    // Standard parchment panel.
    panel(x, y, w, h, o = {}) {
      const P = G.PAL;
      draw.rrect(x + 1, y + 2, w, h, 4, 'rgba(0,0,0,0.35)');
      draw.rrect(x, y, w, h, 4, o.fill || P.paper, o.edge || P.edge, 2);
      draw.rrect(x + 3, y + 3, w - 6, h - 6, 2, null, o.inner || P.paperDark, 1);
    },
    // Immediate-mode button. Returns true when tapped this frame.
    button(x, y, w, h, label, o = {}) {
      const P = G.PAL;
      const disabled = !!o.disabled;
      const hit = disabled ? null : G.input.consumeTap({ x, y, w, h });
      const pressed = !disabled && G.input.pointerIn({ x, y, w, h });
      const base = disabled ? '#9b8f7d' : o.color || '#c9893c';
      const oy = pressed ? 1 : 0;
      draw.rrect(x, y + 2, w, h, 4, G.U.shade(base, -0.45));
      draw.rrect(x, y + oy, w, h - (pressed ? 1 : 0), 4, base, G.U.shade(base, -0.55), 1);
      draw.rrect(x + 2, y + oy + 1, w - 4, Math.max(2, h / 2 - 2), 3, 'rgba(255,255,255,0.18)');
      if (o.selected) draw.rrect(x - 1.5, y - 1.5 + oy, w + 3, h + 3, 5, null, '#fff3b0', 1.5);
      draw.text(label, x + w / 2, y + h / 2 + oy, {
        size: o.size || 8, align: 'center', baseline: 'middle',
        color: disabled ? '#e6dccb' : o.textColor || '#fffaf0', shadow: 'rgba(0,0,0,0.5)', bold: true,
      });
      if (hit) G.sfx && G.sfx.play('select');
      return !!hit;
    },
  };
  G.draw = draw;
})();
