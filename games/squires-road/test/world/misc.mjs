export default async (page, h) => {
  await h.eval(() => { G.newGame(); G.state.flags._hint_move = true; Object.assign(G.state, { map: '__test_field', x: 3, y: 7, dir: 'down' }); G.world.start(); });
  await h.wait(3500);
  await h.shot('m01_field');
  await h.eval(() => G.debug.warp('__test', 3, 20)); await h.wait(900);
  await h.shot('m02_item');
  await h.walk('ArrowLeft', 500); await h.wait(600);
  await h.shot('m03_pick');
  console.log(JSON.stringify(await h.eval(() => G.state.bag)));
  for (let i = 0; i < 3; i++) { await h.key('KeyZ'); await h.wait(300); }
};
