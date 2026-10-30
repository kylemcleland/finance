// Archery via real multi-touch: R thumb holds to draw, L thumb drags to aim at the same time, release R to loose.
// env RIVALS (comma), TIER, SKILL 0..1, SHOTS=1
export default async (page, h) => {
  const rivals = (process.env.RIVALS || 'arch_tam').split(',');
  const tier = Number(process.env.TIER || 1);
  const skill = Number(process.env.SKILL ?? 0.5);
  const shots = !!process.env.SHOTS;
  await h.eval(() => { G.newGame(); G.player.give('short_bow'); G.player.equip('short_bow'); });
  await h.battle('archery', { rivals, tier, title: 'Novice Cup' });
  const W = await h.W(), H = await h.H();
  const dbg = () => h.eval(() => { const a = G.battle.active; if (!a || !a._dbg) return null; const g = a._dbg.get(); g.comp = a._dbg.comp(); return g; });
  const noise = (a) => (Math.random() * 2 - 1) * a;
  let n = 0, boardShots = 0;
  for (let iter = 0; iter < 3000; iter++) {
    const res = await h.res();
    if (res) { console.log('RESULT', JSON.stringify(res), 'doneN', await h.eval(() => window.__doneN)); break; }
    const d = await dbg();
    if (!d) { await h.wait(40); continue; }
    if (d.phase === 'intro') { if (shots && n === 0) { await h.wait(1200); await h.shot('ar_intro'); n++; } await h.tap(W * 0.75, H * 0.5); await h.wait(300); continue; }
    if (d.phase === 'aim') {
      // R thumb down: start drawing; L thumb drags the aim toward the wind-compensated point meanwhile
      await h.touch.down(2, W * 0.78, H * 0.62);
      const tx = d.comp.x + noise(0.25 * (1 - skill)), ty = d.comp.y + noise(0.2 * (1 - skill));
      let lx = W * 0.25, ly = H * 0.65;
      await h.touch.down(1, lx, ly);
      for (let k = 0; k < 40; k++) {
        const c = await dbg(); if (!c || c.phase !== 'aim') break;
        const mPerPx = await h.eval(() => 1); // relative: just step until close
        const ex = tx - c.aimX, ey = ty - c.aimY;
        if (Math.abs(ex) < 0.03 && Math.abs(ey) < 0.03 && c.power >= 1) break;
        lx += U_clamp(ex * 60, -6, 6); ly -= U_clamp(ey * 60, -6, 6);
        await h.touch.move(1, lx, ly);
        if (shots && k === 12 && iter < 30) await h.shot('ar_draw');
        await h.wait(30);
      }
      await h.touch.up(1);
      await h.touch.up(2);
      await h.wait(200);
      continue;
    }
    if (d.phase === 'hit' && shots && d.arrowIdx === 0 && d.end === 0) { await h.shot('ar_hit'); }
    if (d.phase === 'board') {
      if (shots && boardShots < 2) { await h.wait(boardShots ? 900 : 350); await h.shot('ar_board' + boardShots); boardShots++; continue; }
      await h.wait(400); await h.tap(W * 0.75, H * 0.5); await h.wait(200); continue;
    }
    if (d.phase === 'outro') { if (shots) { await h.wait(1500); await h.shot('ar_outro'); } await h.tap(W * 0.75, H * 0.5); await h.wait(400); continue; }
    if (d.phase === 'sdboard') { await h.wait(600); await h.tap(W * 0.75, H * 0.5); continue; }
    await h.wait(60);
  }
  function U_clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
};
