// Basic flow: intro → draw → loose → hit → … → scoreboard.
export default async (page, h) => {
  const tier = Number(process.env.TIER || 1);
  const perks = process.env.PERKS || '';
  await h.eval(([tier, perks]) => {
    G.player.give('hunting_bow'); G.player.equip('hunting_bow');
    for (const p of perks.split(',').filter(Boolean)) G.state.perks[p] = true;
    window.__res = null;
    G.battle.start('archery', { rivals: ['arch_tam', 'arch_lia', 'arch_bo'], tier, title: 'Novice Cup' }).then((r) => (window.__res = r));
  }, [tier, perks]);
  await h.wait(1500);
  await h.shot('01_intro');
  await h.wait(2600);
  await h.shot('02_aim');
  const W = await h.W(), H = await h.H();
  const sc = await h.eval(() => G.gfx.scale);
  const rx = W * 0.75 * sc, ry = H * 0.6 * sc;
  for (let a = 0; a < 3; a++) {
    await page.mouse.move(rx, ry); await page.mouse.down();
    await h.wait(400);
    if (a === 0) await h.shot('03_drawing');
    await h.wait(900);
    if (a === 0) await h.shot('04_full');
    if (a === 2) { await h.wait(4500); await h.shot('05_shaking'); }
    await page.mouse.up();
    await h.wait(250);
    if (a === 0) await h.shot('06_flight');
    await h.wait(500);
    if (a === 0) await h.shot('07_hit');
    await h.wait(1600);
  }
  await h.wait(800);
  await h.shot('08_board');
  await h.wait(2500);
  await h.shot('09_board_done');
  console.log(JSON.stringify(await h.eval(() => G.battle.active && G.battle.active._dbg.get())));
};
