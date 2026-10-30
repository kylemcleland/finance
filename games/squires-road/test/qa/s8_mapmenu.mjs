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
  await h.key('Escape'); await h.wait(400);
  // left-thumb drag: hold a virtual stick to the right for a moment
  const before = await q.st();
  const sc = await h.eval(() => G.gfx.scale);
  const H = await h.H();
  await page.mouse.move(40 * sc, (H - 80) * sc); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move((40 + i * 4) * sc, (H - 80) * sc); await h.wait(16); }
  await h.wait(700);
  await q.shot('stick_drag');
  await page.mouse.up(); await h.wait(300);
  const after = await q.st();
  console.log('drag moved from', before.x, before.y, 'to', after.x, after.y);
};
