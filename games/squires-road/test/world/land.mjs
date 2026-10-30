export default async (page, h) => {
  await h.eval(() => { G.newGame(); Object.assign(G.state, { map: 'thornbrook', x: 16, y: 13, dir: 'down' }); G.state.flags.opening = true; G.world.start(); });
  await h.wait(800);
  await h.shot('l01');
  await h.walk('ArrowRight', 900);
  await h.wait(3200);
  await h.shot('l02');
  const fps = await h.eval(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (n < 120) requestAnimationFrame(f); else res(120000 / (performance.now() - t0)); }; requestAnimationFrame(f); }));
  // cost of one world draw
  const ms = await h.eval(() => { const s = G.world.scene; const t = performance.now(); for (let i = 0; i < 200; i++) s.draw(G.gfx.ctx); return (performance.now() - t) / 200; });
  console.log('fps', fps.toFixed(1), 'draw ms', ms.toFixed(3));
};
