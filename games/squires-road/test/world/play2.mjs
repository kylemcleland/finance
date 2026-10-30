export default async (page, h) => {
  const st = () => h.eval(() => ({ map: G.state.map, x: G.state.x, y: G.state.y, dir: G.state.dir, lock: G.world.state.lock, scene: G.scenes.top().name, busy: G.ui.busy() }));
  await h.eval(() => { G.newGame(); G.state.flags._hint_move = true; Object.assign(G.state, { map: '__test', x: 5, y: 6, dir: 'up' }); G.world.start(); });
  await h.wait(400);
  await h.walk('ArrowUp', 420); await h.wait(900);
  console.log('door', JSON.stringify(await st()));
  await h.shot('q01_house');
  // tap on shopkeeper across counter: go to 2,5
  await h.eval(() => G.debug.warp('__test_house', 2, 5)); await h.wait(800);
  const sc = await h.eval(() => { const S = G.world.state; return { cx: S.camX, cy: S.camY }; });
  await h.tap(2 * 16 + 8 - sc.cx, 3 * 16 + 4 - sc.cy); await h.wait(700);
  console.log('tap keeper', JSON.stringify(await st()));
  await h.shot('q02_tapkeeper');
  await h.tap(150, 300); await h.wait(150); await h.tap(150, 300); await h.wait(300);
  console.log('after', JSON.stringify(await st()));
  // menu button
  const W = await h.W();
  await h.tap(W - 16, 16); await h.wait(600);
  await h.shot('q03_menu');
  console.log('menu', JSON.stringify(await st()));
  await h.tap(W - 22, 20); await h.wait(700);
  console.log('menu closed', JSON.stringify(await st()));
  // edge east
  await h.eval(() => G.debug.warp('__test', 37, 6)); await h.wait(800);
  await h.walk('ArrowRight', 700); await h.wait(900);
  console.log('edge', JSON.stringify(await st()));
  await h.shot('q04_field');
  await h.wait(3000);
  // sign via tap
  await h.eval(() => G.debug.warp('__test', 24, 8)); await h.wait(800);
  const sc2 = await h.eval(() => { const S = G.world.state; return { cx: S.camX, cy: S.camY }; });
  await h.tap(24 * 16 + 8 - sc2.cx, 7 * 16 + 8 - sc2.cy); await h.wait(800);
  await h.shot('q05_sign');
  console.log('sign', JSON.stringify(await st()));
};
