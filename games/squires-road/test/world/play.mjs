export default async (page, h) => {
  const st = () => h.eval(() => ({ map: G.state.map, x: G.state.x, y: G.state.y, dir: G.state.dir, steps: G.state.steps, lock: G.world.state.lock, scene: G.scenes.top().name, busy: G.ui.busy() }));
  await h.eval(() => { G.newGame(); Object.assign(G.state, { map: '__test', x: 6, y: 6, dir: 'down' }); G.world.start(); });
  await h.wait(500);
  console.log('start', JSON.stringify(await st()));
  await h.key('ArrowLeft', 40); await h.wait(200);
  console.log('nudge left (turn only)', JSON.stringify(await st()));
  await h.walk('ArrowLeft', 180); await h.wait(300);
  console.log('walk left', JSON.stringify(await st()));
  await h.walk('ArrowUp', 250); await h.wait(900);
  console.log('up into door', JSON.stringify(await st()));
  await h.shot('p01_house');
  // walk to counter & talk to keeper
  await h.walk('ArrowLeft', 380); await h.wait(300);
  await h.walk('ArrowUp', 100); await h.wait(200);
  console.log('before talk', JSON.stringify(await st()));
  await h.key('KeyZ'); await h.wait(700);
  await h.shot('p02_talk');
  console.log('talk', JSON.stringify(await st()));
  await h.key('KeyZ'); await h.wait(200); await h.key('KeyZ'); await h.wait(300);
  console.log('after talk', JSON.stringify(await st()));
  // chest in house at 6,2: go to 6,3 facing up
  await h.eval(() => G.debug.warp('__test_house', 6, 3)); await h.wait(800);
  await h.key('ArrowUp', 40); await h.wait(200);
  await h.key('KeyZ'); await h.wait(900); await h.shot('p03_chest');
  await h.key('KeyZ'); await h.wait(300);
  console.log('chest', JSON.stringify(await h.eval(() => ({ bag: G.state.bag, flags: G.state.flags }))));
  // trainer: hedge knight at 21,17 facing left, sight 4 -> walk down path col 18
  await h.eval(() => G.debug.warp('__test', 18, 14)); await h.wait(800);
  await h.walk('ArrowDown', 700); await h.wait(1200);
  await h.shot('p04_trainer');
  console.log('trainer', JSON.stringify(await st()));
  for (let i = 0; i < 6; i++) { await h.key('KeyZ'); await h.wait(400); }
  await h.wait(1500);
  console.log('after trainer', JSON.stringify(await st()), JSON.stringify(await h.eval(() => G.state.flags)));
  for (let i = 0; i < 4; i++) { await h.key('KeyZ'); await h.wait(400); }
  console.log('after trainer2', JSON.stringify(await st()));
  // encounters: walk back and forth in tall grass
  await h.eval(() => G.debug.warp('__test', 34, 3)); await h.wait(800);
  let got = false;
  for (let i = 0; i < 30 && !got; i++) {
    await h.walk(i % 2 ? 'ArrowLeft' : 'ArrowRight', 600);
    const s = await st();
    if (s.lock > 0) { got = true; await h.wait(300); await h.shot('p05_encounter'); }
  }
  console.log('encounter', got, JSON.stringify(await st()));
  await h.wait(2500);
  await h.shot('p06_after_enc');
  console.log('after enc', JSON.stringify(await st()), JSON.stringify(await h.eval(() => ({ xp: G.state.xp, gold: G.state.gold, hp: G.state.hp }))));
};
