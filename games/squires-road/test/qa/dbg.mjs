import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 'dbg');
  await q.load('s5');
  await h.eval(() => G.debug.warp('route2', 55, 15)); await h.wait(800); await q.pump();
  console.log(JSON.stringify(await q.plan(59, 3, false)));
  console.log(await h.eval(() => { const S = G.world.state; return JSON.stringify(S.npcs.filter(n=>n.visible).map(n=>[n.id,n.x,n.y])) + ' F solid ' + G.tiles.solid('F'); }));
};
