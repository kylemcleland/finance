export default async (page, h) => {
  const st = () => h.eval(() => ({ map: G.state.map, x: G.state.x, y: G.state.y, lock: G.world.state && G.world.state.lock, scene: G.scenes.top() && G.scenes.top().name, busy: G.ui.busy(), hp: G.state.hp, xp: G.state.xp, gold: G.state.gold, lvl: G.state.level }));
  const waitScene = async (pred, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { const s = await st(); if (pred(s)) return s; await h.wait(150); } return st(); };
  const clear = async () => { for (let i = 0; i < 30; i++) { const s = await st(); if (!s.busy && !s.lock) return; if (s.busy) await h.key('KeyZ'); await h.wait(250); } };
  await h.eval(() => { G.newGame(); G.state.flags._hint_move = true; G.state.gold = 100; Object.assign(G.state, { map: '__test', x: 18, y: 15, dir: 'down' }); G.world.start(); });
  await h.wait(500);
  // trainer: win
  await h.walk('ArrowDown', 500);
  let s;
  for (let i = 0; i < 60; i++) { s = await st(); if (s.scene === 'battle-sword') break; if (s.busy) await h.key('KeyZ'); await h.wait(300); }
  console.log('trainer battle', s.scene);
  await h.wait(800); await h.shot('b01_battle');
  await h.eval(() => G.debug.skipBattle(true));
  s = await waitScene((s) => s.scene === 'world' && s.busy, 15000);
  await h.shot('b02_win');
  await clear();
  console.log('after win', JSON.stringify(await st()), 'flag', await h.eval(() => G.state.flags.beat_test_hedge));
  // wild: lose -> blackout
  await h.eval(() => { G.state.lastInn = { map: '__test_house', x: 4, y: 5 }; G.world.state.noEnc = 0; G.world.state.map.encounterRate = 1; });
  await h.eval(() => G.debug.warp('__test', 34, 3)); await h.wait(700);
  await h.eval(() => { G.world.state.noEnc = 0; });
  await h.walk('ArrowRight', 220);
  s = await waitScene((s) => s.scene === 'battle-sword');
  console.log('wild battle', s.scene);
  await h.wait(800);
  await h.eval(() => G.debug.skipBattle(false));
  s = await waitScene((s) => s.scene === 'world' && s.busy);
  await h.shot('b03_blackout');
  await clear(); await h.wait(500); await clear();
  console.log('after loss', JSON.stringify(await st()));
  await h.eval(() => { G.maps.__test.encounterRate = 0.12; });
};
