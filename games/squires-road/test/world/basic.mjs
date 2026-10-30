export default async (page, h) => {
  await h.eval(() => { G.newGame(); Object.assign(G.state, { map: '__test', x: 6, y: 6, dir: 'down' }); G.world.start(); });
  await h.wait(600);
  await h.shot('01_start');
  for (const [x, y, n] of [[17, 8, '02_plaza'], [8, 18, '03_river'], [30, 20, '04_arena'], [34, 5, '05_grass'], [20, 23, '06_south']]) {
    await h.eval(([x, y]) => { const S = G.world.state; S.player.x = S.player.fx = x; S.player.y = S.player.fy = y; S.player.px = x * 16; S.player.py = y * 16; }, [x, y]);
    await h.wait(700);
    await h.shot(n);
  }
  const probs = await h.eval(() => G.debug.validateAll());
  console.log(JSON.stringify(probs, null, 1));
};
