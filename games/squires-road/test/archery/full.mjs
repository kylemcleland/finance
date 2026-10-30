// Full contest with keyboard only. SKILL=1 aims with wind compensation via debug hook.
export default async (page, h) => {
  const tier = Number(process.env.TIER || 1);
  const perks = process.env.PERKS || '';
  const skill = process.env.SKILL === '1';
  const rivals = (process.env.RIVALS || 'arch_tam,arch_lia').split(',');
  await h.eval(([tier, perks, rivals]) => {
    G.player.give(process_bow()); G.player.equip(process_bow());
    function process_bow() { return 'hunting_bow'; }
    for (const p of perks.split(',').filter(Boolean)) G.state.perks[p] = true;
    window.__res = null;
    G.battle.start('archery', { rivals, tier, title: 'Test Cup' }).then((r) => (window.__res = r));
  }, [tier, perks, rivals]);
  await h.wait(4500);
  let shots = 0;
  for (let i = 0; i < 150; i++) {
    const st = await h.eval(() => (G.battle.active ? G.battle.active._dbg.get() : null));
    if (!st) break;
    if (st.phase === 'aim') {
      await page.keyboard.down('Space');
      await h.wait(1100);
      if (skill) await h.eval(() => { const s = G.battle.active._dbg; const g = s.get(); s.set({ aimX: s.comp().x, aimY: s.comp().y }); });
      if (shots === 1) await h.shot('f_aim_' + shots);
      await h.wait(300);
      await page.keyboard.up('Space');
      shots++;
      await h.wait(400);
      if (shots === 2) await h.shot('f_flight');
      await h.wait(2200);
    } else if (st.phase === 'board' || st.phase === 'sdboard') {
      await h.wait(2600);
      if (st.end === 2 || st.phase === 'sdboard') await h.shot('f_board_' + st.end + st.phase);
      await h.key('Space', 80);
      await h.wait(1800);
    } else if (st.phase === 'outro') {
      await h.wait(1200);
      await h.shot('f_outro');
      await h.wait(4000);
    } else await h.wait(500);
  }
  await h.wait(1500);
  console.log('result', JSON.stringify(await h.eval(() => window.__res)));
};
