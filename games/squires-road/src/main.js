// Boot, main loop, title screen, debug hooks.
(() => {
  const D = G.draw;
  const params = new URLSearchParams(location.search);
  G.DEBUG = params.has('debug');

  // ---------------------------------------------------------------- loop
  let last = performance.now(), fps = 60, fpsAcc = 0, fpsN = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    G.time += dt;
    if (G.state) G.state.playTime = (G.state.playTime || 0) + dt;
    const ctx = G.gfx.ctx;
    try {
      G.input.poll();
      G.timers.update(dt);
      G.scenes.updateTweens(dt);
      G.ui.update(dt);
      G.scenes.update(dt);
    } catch (e) { console.error('update error', e); }
    G.gfx.reset();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, G.W, G.H);
    G.scenes.draw(ctx);
    try { G.ui.draw(ctx); } catch (e) { console.error('ui draw error', e); }
    G.scenes.drawOverlay(ctx);
    if (G.DEBUG) D.text(`${fps.toFixed(0)} fps  ${G.W}x${G.H}`, 2, G.H - 10, { size: 7, color: '#0f0', shadow: true });
    G.input.endFrame();
  }

  // ---------------------------------------------------------------- title
  function titleScene() {
    let t = 0;
    const hasSave = G.hasSave();
    const stars = Array.from({ length: 40 }, () => [Math.random(), Math.random() * 0.5, Math.random()]);
    const knights = [];
    return {
      name: 'title',
      enter() { G.music.play('title'); },
      update(dt) {
        t += dt;
        if (Math.random() < dt * 0.6) knights.push({ x: -20, y: 0.72 + Math.random() * 0.08, s: 25 + Math.random() * 20, f: 0 });
        for (const k of knights) { k.x += k.s * dt; k.f += dt * 8; }
        for (let i = knights.length - 1; i >= 0; i--) if (knights[i].x > G.W + 30) knights.splice(i, 1);
        if (!G.ui.busy() && G.input.pressed('a') && !G.input.events.some((e) => e.type === 'tap')) start(hasSave);
      },
      draw(ctx) {
        const W = G.W, H = G.H;
        // sky
        const g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#1b1640'); g.addColorStop(0.45, '#7a3f6a'); g.addColorStop(0.7, '#f08a4b'); g.addColorStop(1, '#f6c46a');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (const s of stars) { ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s[2] * 10); D.rect(s[0] * W, s[1] * H, 1, 1, '#fff'); }
        ctx.globalAlpha = 1;
        // sun
        D.circle(W / 2, H * 0.66, Math.min(W, H) * 0.22, 'rgba(255,220,140,0.55)');
        // castle silhouette
        const cy = H * 0.66;
        ctx.fillStyle = '#3a1f3a';
        const cw = Math.min(W * 0.8, 260), cx = W / 2 - cw / 2;
        ctx.fillRect(cx + cw * 0.15, cy - 40, cw * 0.7, 40);
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = '#3a1f3a';
          const tx = cx + cw * (0.08 + i * 0.27);
          ctx.fillRect(tx, cy - 62 - (i % 3 === 1 ? 12 : 0), 18, 62 + (i % 3 === 1 ? 12 : 0));
          for (let b = 0; b < 3; b++) ctx.fillRect(tx + b * 7, cy - 66 - (i % 3 === 1 ? 12 : 0), 4, 4);
          ctx.beginPath(); ctx.moveTo(tx + 9, cy - 82 - (i % 3 === 1 ? 12 : 0)); ctx.lineTo(tx + 9, cy - 66 - (i % 3 === 1 ? 12 : 0)); ctx.strokeStyle = '#3a1f3a'; ctx.stroke();
          D.rect(tx + 9, cy - 82 - (i % 3 === 1 ? 12 : 0), 7, 4, '#d6453d');
        }
        // hills
        ctx.fillStyle = '#2a3a2a';
        ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W; x += 8) ctx.lineTo(x, cy + 6 + Math.sin(x * 0.03) * 6);
        ctx.lineTo(W, H); ctx.fill();
        ctx.fillStyle = '#1f2c1f';
        ctx.fillRect(0, H * 0.78, W, H);
        // riding knights silhouettes
        for (const k of knights) G.chars.draw(ctx, 'knight', 'right', Math.floor(k.f) % 3, k.x, k.y * H + 20, 1, { shadow: false });
        // title
        const ty = Math.min(H * 0.2, 70);
        const bounce = Math.sin(t * 2) * 2;
        D.text("SQUIRE'S", W / 2, ty + bounce, { size: 22, align: 'center', bold: true, color: '#ffe48a', outline: '#3a1a10', outlineW: 4 });
        D.text('ROAD', W / 2, ty + 24 + bounce, { size: 30, align: 'center', bold: true, color: '#ffd04a', outline: '#3a1a10', outlineW: 5 });
        D.text('a tournament tale', W / 2, ty + 60, { size: 8, align: 'center', color: '#fff3d6', shadow: true });
        // buttons
        const bw = 120, bh = 26;
        let by = H * 0.82 - (hasSave ? bh + 6 : 0);
        if (by + (hasSave ? 2 : 1) * (bh + 6) > H - 10) by = H - 10 - (hasSave ? 2 : 1) * (bh + 6);
        if (hasSave) {
          if (D.button(W / 2 - bw / 2, by, bw, bh, 'Continue', { size: 10, color: '#c9893c' })) start(true);
          by += bh + 6;
        }
        if (D.button(W / 2 - bw / 2, by, bw, bh, 'New Game', { size: 10, color: hasSave ? '#8a6a4a' : '#c9893c' })) {
          if (hasSave) {
            G.ui.ask('Start a new journey? Your old save will be overwritten.', ['New game', 'Cancel']).then((i) => { if (i === 0) start(false); });
          } else start(false);
        }
        D.text('v1 • tap to play', W - 4, H - 10, { size: 6, align: 'right', color: 'rgba(255,255,255,0.6)' });
      },
    };
  }

  let starting = false;
  async function start(cont) {
    if (starting) return;
    starting = true;
    G.sfx.play('confirm');
    if (cont && G.load()) { /* loaded */ } else { G.newGame(); G.save(); }
    await G.scenes.fadeOut({ ms: 400 });
    if (G.world && G.world.start) G.world.start();
    else G.ui.toast('World module missing!', '#f88');
    G.scenes.fadeIn({ ms: 400 });
    starting = false;
  }
  G.game = G.game || {};
  G.game.title = () => G.scenes.replace(titleScene());

  // ---------------------------------------------------------------- debug
  Object.assign(G.debug, {
    newGame() { G.newGame(); if (G.world) G.world.start(); },
    warp(map, x, y) { if (G.cmd.warp) return G.cmd.warp(map, x, y, 'down'); },
    give(id, q = 1) { G.player.give(id, q); },
    equip(id) { G.player.give(id, 1); G.player.equip(id); },
    setLevel(n) { G.state.level = n; G.state.perkPoints += n - 1; G.player.heal('full'); },
    gold(n) { G.state.gold += n; },
    skipBattle(won = true) {
      const b = G.battle.active;
      if (b && b.debugEnd) b.debugEnd(won);
      else console.warn('no active battle with debugEnd');
    },
    state: () => G.state,
    scene: () => G.scenes.top() && G.scenes.top().name,
    flag(n, v = true) { G.state.flags[n] = v; },
  });

  // ---------------------------------------------------------------- boot
  function boot() {
    G.gfx.mount();
    G.input.attach(G.gfx.canvas);
    G.game.title();
    requestAnimationFrame((t) => { last = t; frame(t); });
    window.__SR_READY = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
