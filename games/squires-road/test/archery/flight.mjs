// Screens of arrow flight + shaking + perks.
export default async (page, h) => {
  const tier = Number(process.env.TIER || 1);
  const perks = process.env.PERKS || '';
  await h.eval(([tier, perks]) => {
    G.player.give('hunting_bow'); G.player.equip('hunting_bow');
    for (const p of perks.split(',').filter(Boolean)) G.state.perks[p] = true;
    G.battle.start('archery', { rivals: ['wren', 'cedric_archer'], tier, title: 'Seal of the Arrow', boss: true });
  }, [tier, perks]);
  await h.wait(4500);
  await page.keyboard.down('Space');
  await h.wait(1300);
  await h.shot('g_full');
  await h.wait(4800);
  await h.shot('g_shake');
  await page.keyboard.up('Space');
  for (const ms of [80, 120, 150]) { await h.wait(ms); await h.shot('g_fl_' + ms); }
  await h.wait(1500);
  await page.keyboard.down('Space'); await h.wait(250); await page.keyboard.up('Space');
  await h.wait(1200);
  await h.shot('g_weak');
};
