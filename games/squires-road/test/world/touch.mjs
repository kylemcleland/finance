export default async (page, h) => {
  const st = () => h.eval(() => ({ x: G.state.x, y: G.state.y, dir: G.state.dir, steps: G.state.steps }));
  await h.eval(() => { G.newGame(); G.state.flags._hint_move = true; Object.assign(G.state, { map: '__test', x: 4, y: 20, dir: 'down' }); G.world.start(); });
  await h.wait(600);
  const sc = await h.eval(() => G.gfx.scale);
  const m = page.mouse;
  // nudge left briefly -> turn only
  await m.move(40 * sc, 300 * sc); await m.down(); await m.move(28 * sc, 300 * sc, { steps: 2 }); await h.wait(50); await m.up(); await h.wait(300);
  console.log('nudge', JSON.stringify(await st()));
  // full push down (run) 1s
  await m.move(40 * sc, 200 * sc); await m.down(); await m.move(70 * sc, 200 * sc, { steps: 3 });
  await h.wait(1000); await m.up(); await h.wait(300);
  console.log('run 1s', JSON.stringify(await st()));
  // half push up (walk) 1s
  await m.move(40 * sc, 200 * sc); await m.down(); await m.move(25 * sc, 200 * sc, { steps: 3 });
  await h.wait(1000); await h.shot('t01_stick'); await m.up(); await h.wait(300);
  console.log('walk 1s', JSON.stringify(await st()));
  // trainer bubble: put player in sight line
  await h.eval(() => G.debug.warp('__test', 17, 16)); await h.wait(700);
  await h.key('ArrowDown', 200); await h.wait(450);
  await h.shot('t02_bubble');
};
