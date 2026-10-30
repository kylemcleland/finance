// Stage 3: Millbridge — Wren without a bow, the miller's quest, shops, the inn, archery cups (lose once), the seal.
import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's3');
  await q.load('s2');
  // Range first, without a bow: Wren should point at the miller / bowyer
  await q.enter(27, 8, 'millbridge_range');
  await q.talk(7, 6);
  await q.shot('wren_nobow');
  await q.enter(7, 11, 'millbridge');
  // miller
  await q.talk(12, 7);
  await q.shot('miller');
  console.log('bow', await h.eval(() => G.state.equip.bow));
  // smith: look at prices
  await q.enter(11, 12, 'millbridge_smith');
  await q.walkTo(2, 4); await q.interact();
  console.log('scene', await q.pump());
  await h.wait(400); await q.shot('smith_shop');
  await h.key('Escape'); await h.wait(400); await q.pump();
  await q.enter(4, 7, 'millbridge');
  // inn: rest (sets lastInn)
  await q.enter(4, 12, 'millbridge_inn');
  await q.walkTo(2, 4); await q.interact();
  await q.pump({ onScene: async () => { await h.wait(500); } });
  console.log('lastInn', JSON.stringify(await h.eval(() => G.state.lastInn)));
  await q.econ('after inn');
  await q.enter(5, 8, 'millbridge');
  // range: novice cup, lose the first attempt in round 2, then win
  await q.enter(27, 8, 'millbridge_range');
  await q.walkTo(7, 7); await q.interact();
  await q.pump();
  await q.shot('range_hall');
  await q.cup(0, { shot: 'range_novice_lose', win: (n) => n !== 2 });
  await q.pump();
  await q.shot('after_elim');
  await q.econ('after elim');
  await q.interact(); await q.pump();
  await q.cup(0, { shot: 'range_novice_win' });
  await q.pump();
  await q.econ('after range novice');
  await q.interact(); await q.pump();
  await q.cup(1, { shot: 'range_seal' });
  await q.pump();
  await q.shot('after_range_seal');
  await q.econ('after range seal');
  await q.enter(7, 11, 'millbridge');
  await q.save('s3');
};
