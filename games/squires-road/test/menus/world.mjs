// Integration over the real overworld: ☰ menu, shop, tournament with real battles.
export default async (page, h) => {
  await h.eval(() => { G.newGame(); G.state.map = 'thornbrook'; G.state.x = 10; G.state.y = 10; G.world.start(); });
  await h.wait(800);
  const W = await h.W();
  await h.tap(W - 16, 17); await h.wait(500);
  await h.shot('w_menu');
  await h.key('Escape'); await h.wait(400);
  console.log('top after esc:', await h.eval(() => G.scenes.top().name));
  await h.eval(() => { G.state.gold = 200; window.__s = G.cmd.shop('thornbrook_store'); });
  await h.wait(500); await h.shot('w_shop');
  await h.key('Escape'); await h.wait(400);
  await h.eval(() => { G.state.equip.weapon = 'rusty_sword'; window.__tr = undefined; G.cmd.tournament('thornbrook_pit').then((r) => (window.__tr = r)); });
  await h.wait(500); await h.shot('w_hall');
  await h.key('Enter'); await h.wait(150); await h.key('Enter'); await h.wait(300); await h.key('Enter'); await h.wait(400); await h.key('Enter'); await h.wait(300);
  let g = 0;
  while (g++ < 30) {
    const st = await h.eval(() => ({ active: !!G.battle.active, done: window.__tr !== undefined }));
    if (st.done) break;
    if (st.active) { await h.wait(1500); if (g < 4) await h.shot('w_battle' + g); await h.eval(() => G.debug.skipBattle(true)); await h.wait(1300); continue; }
    await h.key('Enter'); await h.wait(700);
    if (g % 3 === 0) await h.shot('w_step' + g);
  }
  await h.wait(500);
  await h.shot('w_after');
  console.log('result', JSON.stringify(await h.eval(() => ({ r: window.__tr, top: G.scenes.top().name, music: G.music.current, wins: G.state.wins, ranks: G.state.ranks, bag: G.state.bag }))));
};
