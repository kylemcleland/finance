export default async (page, h) => {
  const st = () => h.eval(() => ({ map: G.state.map, x: G.state.x, y: G.state.y, dir: G.state.dir, lock: G.world.state && G.world.state.lock, scene: G.scenes.top() && G.scenes.top().name, busy: G.ui.busy() }));
  await h.eval(() => localStorage.clear());
  await h.wait(300);
  await h.key('Enter'); await h.wait(1500);
  console.log('after title', JSON.stringify(await st()));
  await h.shot('o01');
  for (let i = 0; i < 80; i++) {
    const s = await st();
    if (s.scene && s.scene.startsWith('battle')) { await h.eval(() => G.debug.skipBattle(true)); await h.wait(1500); continue; }
    if (!s.busy && !s.lock) break;
    if (i === 6) await h.shot('o02');
    await h.key('KeyZ'); await h.wait(350);
  }
  console.log('after opening', JSON.stringify(await st()));
  await h.shot('o03');
  await h.walk('ArrowDown', 1500); await h.wait(300);
  await h.walk('ArrowLeft', 600); await h.wait(300);
  await h.walk('ArrowDown', 1500); await h.wait(1200);
  console.log('walked', JSON.stringify(await st()));
  await h.shot('o04');
  const fps = await h.eval(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (n < 120) requestAnimationFrame(f); else res(120000 / (performance.now() - t0)); }; requestAnimationFrame(f); }));
  console.log('fps', fps.toFixed(1));
};
