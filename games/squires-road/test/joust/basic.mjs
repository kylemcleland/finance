// Full bout smoke: spur in rhythm, aim at the shield, brace at the ring.
export default async (page, h) => {
  await h.eval(() => {
    G.player.give('practice_lance'); G.player.equip('practice_lance');
    G.player.give('old_nag'); G.player.equip('old_nag');
    window.__res = null;
    G.battle.start('joust', { opponent: process_opp() , title: 'Novice Cup — Round 1' }).then((r) => (window.__res = r));
    function process_opp() { return new URLSearchParams(location.search).get('opp') || 'joust_ned'; }
  });
  await h.wait(1200);
  await h.shot('01-intro');
  const W = await h.W(), H = await h.H();
  const dbg = () => h.eval(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg());
  for (let pass = 0; pass < 5; pass++) {
    // wait for ready
    for (let i = 0; i < 100; i++) { const d = await dbg(); if (!d || d.phase === 'ready' || d.phase === 'outro') break; await h.page.mouse.click(W * 0.75 * 2, H * 0.5 * 2); await h.wait(300); }
    let d = await dbg();
    if (!d || d.phase === 'outro') break;
    await h.wait(800);
    if (pass === 0) await h.shot('02-ready');
    for (let i = 0; i < 400; i++) {
      d = await dbg();
      if (!d || d.phase !== 'ready') break;
      await h.wait(50);
    }
    // charge: spur when below the sweet zone, steer reticle toward shield using keys
    let shotTaken = 0;
    for (let i = 0; i < 600; i++) {
      d = await dbg();
      if (!d || d.phase !== 'charge') break;
      if (d.tti > 1.25 && d.s < 0.74) { await h.tap(W * 0.8, H * 0.5); }
      // steer via keyboard toward predicted shield
      const dx = d.sh.x - d.ax, dy = d.sh.y - d.ay;
      if (d.tti < 2.5) {
        if (Math.abs(dx) > 2) await h.page.keyboard.down(dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        if (Math.abs(dy) > 2) await h.page.keyboard.down(dy > 0 ? 'ArrowDown' : 'ArrowUp');
      }
      await h.wait(30);
      for (const k of ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp']) await h.page.keyboard.up(k);
      if (pass === 0 && shotTaken === 0 && d.gap < 45) { shotTaken = 1; await h.shot('03-charge'); }
      if (pass === 0 && shotTaken === 1 && d.tti < 0.9) { shotTaken = 2; await h.shot('04-ring'); }
      if (d.tti < 0.06 && !d.brace) { await h.page.keyboard.press('Space'); }
    }
    await h.wait(150);
    await h.shot(`05-impact-p${pass + 1}`);
    await h.wait(1300);
    await h.shot(`06-after-p${pass + 1}`);
    d = await dbg();
    console.log('pass', pass + 1, JSON.stringify(d && d.result));
    for (let i = 0; i < 60; i++) { d = await dbg(); if (!d || d.phase === 'card' || d.phase === 'outro') break; await h.wait(100); }
    await h.wait(400);
    await h.shot(`07-card-p${pass + 1}`);
    if (d && d.phase === 'outro') break;
    await h.tap(W / 2, H / 2);
  }
  await h.wait(1500);
  await h.shot('08-outro');
  await h.tap(W / 2, H / 2);
  await h.wait(1500);
  console.log('result', JSON.stringify(await h.eval(() => window.__res)));
};
