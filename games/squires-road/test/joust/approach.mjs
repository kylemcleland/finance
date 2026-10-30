// Captures the approach at several distances (pass 1), aiming with keys, then brace.
export default async (page, h) => {
  const opp = process.env.OPP || 'joust_ned';
  await h.eval((opp) => {
    G.player.give('practice_lance'); G.player.equip('practice_lance');
    G.player.give('old_nag'); G.player.equip('old_nag');
    window.__res = null;
    G.battle.start('joust', { opponent: opp, title: 'Test' }).then((r) => (window.__res = r));
  }, opp);
  const W = await h.W(), H = await h.H();
  const dbg = () => h.eval(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg());
  for (let i = 0; i < 100; i++) { const d = await dbg(); if (d && d.phase === 'ready') break; await h.tap(W * 0.75, H * 0.5); await h.wait(200); }
  await h.wait(1600);
  await h.shot('a0-salute');
  for (let i = 0; i < 200; i++) { const d = await dbg(); if (d.phase === 'charge') break; await h.wait(40); }
  const marks = [40, 22, 12, 8, 6];
  let mi = 0;
  for (let i = 0; i < 800; i++) {
    const d = await dbg();
    if (!d || d.phase !== 'charge') break;
    if (d.tti > 1.25 && d.s < 0.74) await h.tap(W * 0.8, H * 0.5);
    const dx = d.sh.x - d.ax, dy = d.sh.y - d.ay;
    if (Math.abs(dx) > 1.5) await page.keyboard.down(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
    if (Math.abs(dy) > 1.5) await page.keyboard.down(dy > 0 ? 'ArrowDown' : 'ArrowUp');
    await h.wait(20);
    for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) await page.keyboard.up(k);
    if (mi < marks.length && d.gap < marks[mi]) { await h.shot(`a${mi + 1}-gap${marks[mi]}`); mi++; }
    if (d.tti < 0.05 && !d.brace) await page.keyboard.press('Space');
  }
  for (const ms of [60, 300, 700, 1500, 2600]) { await h.wait(ms === 60 ? 60 : 300); await h.shot(`b-after-${ms}`); }
  console.log(JSON.stringify((await dbg()).result));
};
