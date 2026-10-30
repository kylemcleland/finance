// Visual tour: start a new game, skip the story flags, warp to each map and screenshot it.
// node test/run.mjs --html test/content.html --outdir test/shots/content --script test/content/tour.mjs
// Env: MAPS=id1,id2 to limit; SPOTS='map:x:y,...' for custom positions.
export default async function (page, h) {
  await h.wait(500);
  await h.eval(() => { G.newGame(); Object.assign(G.state.flags, { opening: true, met_aldric: true, trained: true, rival1: true, cedric2_shout: true }); G.world.start(); });
  await h.wait(600);
  const probs = await h.eval(() => G.debug.validateAll ? G.debug.validateAll() : 'no validateAll');
  console.log('world.validateAll:', JSON.stringify(probs, null, 1));
  const ids = process.env.MAPS ? process.env.MAPS.split(',') : await h.eval(() => Object.keys(G.maps).filter((k) => !k.startsWith('test')));
  const spots = {};
  for (const s of (process.env.SPOTS || '').split(',').filter(Boolean)) { const [m, x, y] = s.split(':'); spots[m] = [+x, +y]; }
  for (const id of ids) {
    const pos = spots[id] || await h.eval((id) => {
      const m = G.maps[id];
      const w = (m.warps || [])[0];
      if (!m.outdoor) return [w ? w.x : 3, w ? w.y - 2 : 3];
      return [Math.floor(m.tiles[0].length / 2), Math.floor(m.tiles.length / 2)];
    }, id);
    await h.eval(([id, x, y]) => G.debug.warp(id, x, y), [id, pos[0], pos[1]]);
    await h.wait(900);
    // dismiss any onEnter dialog
    for (let i = 0; i < 4; i++) { if (await h.eval(() => G.ui.busy())) { await h.key('KeyZ'); await h.wait(250); } }
    await h.shot(id);
  }
}
