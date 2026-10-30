// Core: scene stack + screen transitions.
(() => {
  const stack = [];
  let fadeA = 0, fadeColor = '#000', flashT = 0, flashN = 0;

  const scenes = {
    stack,
    top: () => stack[stack.length - 1] || null,
    push(s) {
      stack.push(s);
      s.enter && s.enter();
      return s;
    },
    pop() {
      const s = stack.pop();
      s && s.exit && s.exit();
      const t = scenes.top();
      t && t.resume && t.resume();
      return s;
    },
    remove(s) {
      const i = stack.indexOf(s);
      if (i < 0) return;
      stack.splice(i, 1);
      s.exit && s.exit();
      if (i === stack.length) { const t = scenes.top(); t && t.resume && t.resume(); }
    },
    replace(s) {
      while (stack.length) { const o = stack.pop(); o.exit && o.exit(); }
      return scenes.push(s);
    },
    // Fade to color, run fn (may be async), fade back in.
    async fade(fn, o = {}) {
      const ms = o.ms || 280;
      fadeColor = o.color || '#000';
      await tween((t) => (fadeA = t), ms);
      fadeA = 1;
      if (fn) await fn();
      await tween((t) => (fadeA = 1 - t), ms);
      fadeA = 0;
    },
    async fadeOut(o = {}) { fadeColor = o.color || '#000'; await tween((t) => (fadeA = t), o.ms || 280); fadeA = 1; },
    async fadeIn(o = {}) { await tween((t) => (fadeA = 1 - t), o.ms || 280); fadeA = 0; },
    // Pokemon-style battle intro flashes.
    flash(times = 3) {
      flashN = times; flashT = 0;
      return new Promise((r) => G.timers.add(times * 160, r));
    },
    update(dt) {
      const t = scenes.top();
      if (t) t.update(dt);
      if (flashN > 0) { flashT += dt; if (flashT >= flashN * 0.16) flashN = 0; }
    },
    draw(ctx) {
      // find lowest scene that must be drawn
      let i = stack.length - 1;
      while (i > 0 && stack[i].opaque === false) i--;
      for (; i < stack.length; i++) {
        G.gfx.reset();
        ctx.save();
        try { stack[i].draw(ctx); } catch (e) { console.error('draw error in', stack[i].name, e); }
        ctx.restore();
      }
      G.gfx.reset();
    },
    drawOverlay(ctx) {
      if (flashN > 0) {
        const ph = (flashT / 0.16) % 1;
        if (ph < 0.5) { ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, G.W, G.H); }
        else { ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, G.W, G.H); }
      }
      if (fadeA > 0) {
        ctx.globalAlpha = G.U.clamp(fadeA, 0, 1);
        ctx.fillStyle = fadeColor;
        ctx.fillRect(0, 0, G.W, G.H);
        ctx.globalAlpha = 1;
      }
    },
  };

  // tween helper on game time
  const tweens = [];
  function tween(fn, ms) {
    return new Promise((res) => tweens.push({ fn, t: 0, d: ms / 1000, res }));
  }
  scenes.tween = tween;
  scenes.updateTweens = (dt) => {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.d);
      tw.fn(k);
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
  };
  G.scenes = scenes;
})();
