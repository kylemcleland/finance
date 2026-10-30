// Stage 5: Route 2 (trainers, Cedric 2 lose→win, horseshoe), Harrowfield (gate check, Tobias, Rowena, joust cups).
import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's5');
  await q.load('s4');
  await h.eval(() => G.debug.warp('millbridge', 33, 14));
  await h.wait(800); await q.pump();
  await q.enter(35, 14, 'route2');
  await q.shot('route2');
  // lose a wild fight in the wheat → blackout → wake at the Millbridge inn (rested there in stage 3)
  for (let i = 0; i < 40; i++) {
    const s0 = await q.st(); if (s0.map !== 'route2') break;
    await q.walkTo(i % 2 ? 14 : 18, 18, { pump: { win: false } });
  }
  const bo = await q.st();
  console.log('blackout woke at', bo.map, bo.x, bo.y, 'gold', bo.gold);
  await q.shot('blackout_inn');
  if (bo.map === 'millbridge_inn') { await q.enter(5, 8, 'millbridge'); await q.walkTo(34, 14); await q.enter(35, 14, 'route2'); }
  const P = { win: true };
  await q.walkTo(10, 8, { pump: P });
  await q.walkTo(22, 8, { pump: P });
  await q.walkTo(23, 12, { pump: P });
  await q.econ('r2 after west trainers');
  await q.walkTo(29, 13, { pump: P });
  // Cedric on the bridge: lose first
  await q.talk(31, 13, { pump: { win: false } });
  await q.shot('cedric2_lost');
  await q.econ('after losing cedric2');
  await q.talk(31, 13, { pump: { win: true } });
  await q.shot('cedric2_won');
  console.log('rival2', await h.eval(() => !!G.state.flags.rival2));
  await q.walkTo(40, 14, { pump: P });
  await q.walkTo(41, 17, { pump: P });
  await q.talk(48, 13, { pump: P }); // Huntress Mara (archery wager)
  await q.walkTo(52, 17, { pump: P });
  await q.walkTo(55, 15, { pump: P });
  // the horseshoe in the sheep pen
  await q.talk(59, 3, { pump: P });
  console.log('horseshoe', await h.eval(() => G.player.has('horseshoe')));
  await q.econ('r2 end');
  await q.walkTo(62, 14, { pump: P });
  await q.enter(63, 14, 'harrowfield');
  await q.shot('harrowfield');
  // gate check with fewer than 2 seals
  const seals = await h.eval(() => JSON.stringify(G.state.seals));
  await h.eval(() => { G.state.seals.archery = false; });
  await q.talk(19, 4);
  await q.shot('gate_blocked');
  await h.eval((s) => { G.state.seals = JSON.parse(s); }, seals);
  // Tobias: horseshoe → free horse
  await q.enter(7, 11, 'harrowfield_stable');
  await q.walkTo(2, 5); await q.interact();
  await q.pump({ onScene: async () => { await h.wait(400); await q.shot('stable_shop'); await h.key('Escape'); await h.wait(500); } });
  console.log('horse', await h.eval(() => G.state.equip.horse));
  await q.enter(6, 9, 'harrowfield');
  // armory: look at prices
  await q.enter(18, 24, 'harrowfield_armory');
  await q.walkTo(2, 3); await q.interact();
  await q.pump({ onScene: async () => { await h.wait(400); await q.shot('armory'); await h.key('Escape'); await h.wait(500); } });
  await q.enter(4, 7, 'harrowfield');
  // Rowena: letter, lance, lesson, then hall
  await q.enter(29, 11, 'harrowfield_lists');
  await q.walkTo(8, 3); await q.interact();
  await q.pump({ battleShot: 'tilt_lesson' });
  await h.wait(300);
  await q.shot('lists_hall');
  await q.cup(0, { shot: 'lists_novice' });
  await q.pump();
  await q.econ('after lists novice');
  await q.interact(); await q.pump();
  await q.cup(1, { shot: 'lists_seal' });
  await q.pump();
  await q.shot('after_rowena_seal');
  await q.econ('after lance seal');
  await q.enter(8, 11, 'harrowfield');
  // Clatterbottom practice tilt
  await q.talk(27, 21, { pump: P });
  // gate now opens
  await q.talk(19, 4);
  await q.shot('gate_open');
  console.log('gate', await h.eval(() => !!G.state.flags.gate_open));
  await q.econ('leaving harrowfield');
  await q.save('s5');
};
