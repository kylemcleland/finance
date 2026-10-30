// Stage 1: title → New Game → opening/tutorial → Cedric 1 → Thornbrook Pit Novice Cup (real UI).
import { mk } from './lib.mjs';
import { writeFileSync } from 'node:fs';
export default async (page, h) => {
  const q = mk(page, h, 's1');
  await h.wait(500);
  await q.shot('title');
  const W = await h.W(), H = await h.H();
  // tap New Game (touch)
  await h.tap(W / 2, H * 0.82 + 13);
  await h.wait(1500);
  await q.shot('wake');
  // opening: pump through dialogs & training battles
  await q.pump({ battleShot: 'training_battle', maxMs: 90000 });
  await q.shot('after_opening');
  await q.econ('after opening');
  // Hob tip
  await q.talk(10, 7);
  // chest
  await q.talk(11, 7);
  // leave stable
  await q.enter(6, 9, 'thornbrook');
  await h.wait(600);
  await q.shot('cedric_meet');
  const r = await q.pump({ battleShot: 'cedric_battle' });
  await q.econ('after cedric');
  await q.shot('after_cedric');
  // Maude's bread
  await q.talk(27, 16);
  // walk to the Pit door with touch drag for part of it
  await q.walkTo(20, 25);
  await q.shot('before_pit');
  await q.enter(20, 23, 'thornbrook_pit');
  await q.shot('pit_inside');
  // talk to Bram → hall UI
  await q.walkTo(7, 4);
  await q.interact();
  await q.pump({ onTourney: null });
  await h.wait(500);
  await q.shot('hall');
  // touch: tap first cup row then the Enter button
  // touch: tap the Novice row, then the big Enter button
  await h.tap(100, 70); await h.wait(300);
  await h.tap(100, 390); await h.wait(600);
  await q.shot('ladder');
  // Begin via touch on the primary button: find it by pressing Enter (keyboard) as fallback
  await q.cup(-1, { shot: 'novice', skipSelect: true });
  await q.pump();
  await q.shot('after_novice');
  await q.econ('after novice');
  // talk to Bram again → seal should be locked (level)
  await q.interact();
  await q.pump();
  await h.wait(400);
  await q.shot('hall_after_novice');
  await h.key('Escape'); await h.wait(500);
  await q.pump();
  await q.save('s1');
};
