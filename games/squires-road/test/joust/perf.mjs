// Measures scene draw time during the charge.
export default async (page, h) => {
  await h.eval(() => {
    G.player.give('practice_lance'); G.player.equip('practice_lance');
    G.player.give('old_nag'); G.player.equip('old_nag');
    G.battle.start('joust', { opponent: 'varek', boss: true });
  });
  const W = await h.W(), H = await h.H();
  await h.wait(1500); await h.tap(W / 2, H / 2);
  await h.wait(3200);
  const r = await h.eval(() => new Promise((res) => {
    const sc = G.battle.active; const ctx = G.gfx.ctx; const times = [];
    let n = 0;
    const step = () => { const t0 = performance.now(); G.gfx.reset(); ctx.save(); sc.draw(ctx); ctx.restore(); times.push(performance.now() - t0); if (++n < 120) requestAnimationFrame(step); else res({ avg: times.reduce((a, b) => a + b) / times.length, max: Math.max(...times), phase: sc.dbg().phase, gap: sc.dbg().gap }); };
    step();
  }));
  console.log(JSON.stringify(r));
};
