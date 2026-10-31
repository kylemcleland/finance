export default async (page, h) => {
  await h.eval(() => { G.newGame(); G.state.flags.joust_howto = 2; for (const id of ['practice_lance', 'old_nag']) { G.player.give(id); G.player.equip(id); } G.battle.start('joust', { opponent: 'joust_ned' }); });
  await h.wait(4200); await h.key('Enter'); await h.wait(2800);
  const W = await h.W(), H = await h.H();
  for (let i = 0; i < 10; i++) { await h.tap(W * 0.8, H * 0.7); await h.wait(300); }
  for (let i = 0; i < 24; i++) { await h.wait(110); await h.shot('s' + String(i).padStart(2, '0')); }
};
