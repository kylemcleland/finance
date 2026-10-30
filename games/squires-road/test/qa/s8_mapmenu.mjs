import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's8');
  await q.load('s5');
  const W = await h.W();
  await h.tap(W - 16, 16); await h.wait(500);
  await h.tap(167, 50); await h.wait(400);
  await q.shot('map_tab');
  await h.tap(132, 50); await h.wait(400);
  await q.shot('perks_tab');
};
