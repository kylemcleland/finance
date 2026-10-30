// Stage 4: buy the iron sword at Ida's, walk back west to Thornbrook, win the Seal of the Blade, Aldric's letter.
import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's4');
  await q.load('s3');
  await q.enter(11, 12, 'millbridge_smith');
  await q.walkTo(2, 4); await q.interact();
  await q.pump();
  await h.wait(500);
  // touch: first row is Iron Sword (selected by default) → tap the buy button area via keyboard Enter on focus
  const W = await h.W(), H = await h.H();
  await h.tap(W / 2, H - 30); await h.wait(600);
  await q.shot('buy_iron');
  await q.pump(); // equip prompt → first option (Equip now)
  await h.wait(300);
  await q.shot('after_buy');
  await h.key('Escape'); await h.wait(500); await q.pump();
  await q.econ('after iron sword');
  await q.enter(4, 7, 'millbridge');
  // walk west home along Route 1 (exits must lead back)
  await q.enter(0, 14, 'route1');
  await q.walkTo(1, 10, { avoidGrass: true });
  await q.enter(0, 10, 'thornbrook');
  await q.shot('back_home');
  await q.enter(20, 23, 'thornbrook_pit');
  await q.walkTo(7, 4); await q.interact();
  await q.pump();
  await q.cup(1, { shot: 'bram_seal' });
  await q.pump();
  await q.shot('after_bram');
  await q.econ('after bram');
  await q.enter(7, 11, 'thornbrook');
  await q.enter(17, 6, 'thornbrook_aldric');
  await q.talk(6, 4);
  console.log('letter', await h.eval(() => G.player.has('letter')));
  await q.enter(4, 7, 'thornbrook');
  await q.save('s4');
};
