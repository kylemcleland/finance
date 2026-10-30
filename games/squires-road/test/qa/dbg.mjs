import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 'dbg');
  await q.load('s5');
  await h.eval(() => G.debug.warp('harrowfield', 29, 12)); await h.wait(800); await q.pump();
  await q.enter(29, 11, 'harrowfield_lists');
  console.log(JSON.stringify(await q.st()));
  console.log(JSON.stringify(await q.walkTo(8, 4)));
  await q.interact();
  console.log(JSON.stringify(await q.st()));
  await q.shot('dbg');
};
