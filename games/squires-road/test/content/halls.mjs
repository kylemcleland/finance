// Walk out of the stable through the door, then talk to hall masters (tournament UI) and check the Range bow gate.
export default async function (page, h) {
  await h.eval(() => { G.newGame(); Object.assign(G.state.flags, { opening: 1, met_aldric: 1, trained: 1, rival1: 1 }); G.world.start(); return 0; });
  await h.wait(800);
  // stable (3,3) -> walk right 3, down 6 onto the door (6,9)
  await h.walk('ArrowRight', 650); await h.walk('ArrowDown', 1700); await h.wait(900);
  console.log('after walk', await h.eval(() => [G.state.map, G.state.x, G.state.y]));
  await h.shot('walk_out');
  // Bram: talk via script, screenshot the hall UI
  await h.eval(() => { G.debug.warp('thornbrook_pit', 7, 4); return 0; }); await h.wait(800);
  await h.eval(() => { G.world.state.player.dir = 'up'; return 0; });
  await h.key('KeyZ'); await h.wait(600);
  for (let i = 0; i < 8 && await h.eval(() => G.ui.busy()); i++) { await h.key('KeyZ'); await h.wait(300); }
  await h.wait(800); await h.shot('pit_hall');
  console.log('scene', await h.eval(() => G.debug.scene()));
  for (let i = 0; i < 4; i++) { await h.key('Escape'); await h.wait(300); }
  await h.wait(600);
  await h.eval(() => { G.debug.warp('millbridge_range', 7, 7); return 0; }); await h.wait(800);
  await h.eval(() => { G.world.state.player.dir = 'up'; return 0; });
  await h.key('KeyZ'); await h.wait(700); await h.shot('range_nobow');
  for (let i = 0; i < 8 && await h.eval(() => G.ui.busy()); i++) { await h.key('KeyZ'); await h.wait(300); }
  console.log('arrows_quest', await h.eval(() => !!G.state.flags.arrows_quest), 'scene', await h.eval(() => G.debug.scene()));
}
