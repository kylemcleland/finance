export default async (page, h) => {
  await h.eval(() => { G.newGame(); for (const id of ['practice_lance', 'old_nag']) { G.player.give(id); G.player.equip(id); } G.battle.start('joust', { opponent: 'joust_ned' }); });
  await h.wait(4500); await h.shot('j1-howto');
  await h.key('Enter'); await h.wait(1500); await h.shot('j2-ready');
  const W = await h.W(), H = await h.H();
  // spur on and off for a while, screenshot through the steps
  for (let i = 0; i < 40; i++) {
    await h.tap(W * 0.8, H * 0.7); await h.wait(230);
    const st = await h.eval(() => G.battle.active && G.battle.active._s ? 1 : 0);
    if (i === 6) await h.shot('j3-spur');
  }
  await h.shot('j4-later');
  await h.wait(600); await h.shot('j5-later2');
};
