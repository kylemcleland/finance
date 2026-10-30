// Quick views: salute inset, forced outcomes (unhorse them / unhorse you), card, outro.
// env FORCE=unA|unB|break, OPP=id
export default async (page, h) => {
  const opp = process.env.OPP || 'rowena';
  const force = process.env.FORCE || 'unA';
  await h.eval(({ opp, force }) => {
    G.player.give('practice_lance'); G.player.equip('practice_lance');
    G.player.give('old_nag'); G.player.equip('old_nag');
    window.__res = null;
    G.battle.start('joust', { opponent: opp, title: 'Seal of the Lance' }).then((r) => (window.__res = r));
    window.__force = force === 'unA' ? { unA: true, you: 2 } : force === 'unB' ? { unB: true, them: 2 } : force === 'break' ? { you: 3, them: 3 } : null;
  }, { opp, force });
  const W = await h.W(), H = await h.H();
  const dbg = () => h.eval(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg());
  await h.wait(1000);
  await h.shot('v0-intro');
  for (let i = 0; i < 100; i++) { const d = await dbg(); if (d && d.phase === 'ready') break; await h.tap(W * 0.75, H * 0.5); await h.wait(200); }
  await h.eval(() => { G.battle.active.force = window.__force; });
  await h.wait(1100);
  await h.shot('v1-salute');
  for (let i = 0; i < 200; i++) { const d = await dbg(); if (d.phase === 'charge') break; await h.wait(40); }
  for (let i = 0; i < 800; i++) {
    const d = await dbg();
    if (!d || d.phase !== 'charge') break;
    if (d.tti > 1.25 && d.s < 0.95) await h.tap(W * 0.8, H * 0.5);
    else await h.wait(30);
    if (d.tti < 0.06 && !d.brace) await page.keyboard.press('Space');
  }
  for (const n of [1, 2, 3, 4, 5, 6]) { await h.wait(400); await h.shot(`v2-res-${n}`); }
  for (let i = 0; i < 60; i++) { const d = await dbg(); if (!d || d.phase === 'card' || d.phase === 'outro') break; await h.wait(100); }
  await h.wait(1200);
  await h.shot('v3-card-or-outro');
  await h.tap(W / 2, H / 2);
  await h.wait(1500);
  console.log('result', JSON.stringify(await h.eval(() => window.__res)), JSON.stringify(await dbg()));
};
