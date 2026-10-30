// Stage 6: Route 3, Black Hugh's camp, Crownhold (captain, king), the Grand Tourney, knighting, credits, back to the world.
import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's6');
  await q.load('s5');
  const P = { win: true };
  await h.eval(() => G.debug.warp('harrowfield', 19, 2)); await h.wait(800); await q.pump();
  await q.enter(19, 0, 'route3');
  await q.shot('route3');
  await q.walkTo(12, 51, { pump: P });
  await q.walkTo(5, 45, { pump: P });
  await q.walkTo(16, 39, { pump: P });
  await q.talk(20, 45, { pump: P }); // shrine monk
  await q.walkTo(16, 31, { pump: P });
  await q.walkTo(9, 27, { pump: P });
  await q.econ('route3 mid');
  await q.enter(0, 26, 'bandit_camp');
  await q.shot('camp');
  await q.walkTo(22, 12, { pump: P });
  await q.walkTo(12, 12, { pump: P });
  await q.walkTo(7, 7, { pump: P });
  await q.talk(7, 5, { pump: P, battleShot: 'hugh' });
  await q.shot('after_hugh');
  await q.talk(8, 6, { pump: P }); // strongbox
  await q.talk(21, 7, { pump: P }); // captive
  await q.econ('after hugh');
  await q.walkTo(34, 12, { pump: P });
  await q.enter(35, 12, 'route3');
  // grind the Kingsroad grass until level 12 (wild encounters on route 3)
  for (let i = 0; i < 60; i++) {
    if (await h.eval(() => G.state.level >= 12)) break;
    await q.walkTo(i % 2 ? 5 : 7, 33, { pump: P });
  }
  await q.econ('after grind');
  await q.walkTo(9, 20, { pump: P });
  await q.walkTo(17, 11, { pump: P });
  await q.walkTo(12, 2, { pump: P });
  await q.econ('route3 end');
  await q.enter(12, 0, 'crownhold');
  await q.shot('crownhold');
  await q.talk(23, 13, { pump: P }); // captain: signet bounty
  await q.econ('after captain');
  // try the herald with everything
  await q.enter(19, 11, 'crownhold_castle');
  await q.talk(10, 3, { pump: P }); // king
  await q.talk(12, 9, { pump: P }); // herald → hall
  await h.wait(400);
  await q.shot('grand_hall');
  await q.cup(0, { shot: 'grand' });
  await q.pump({ win: true, maxMs: 120000, onCredits: async () => { if (!globalThis.__cr) { globalThis.__cr = 1; await q.shot('credits'); } } });
  await q.shot('after_credits');
  await q.econ('after grand');
  const st = await q.st();
  console.log('final', JSON.stringify(st), 'knighted', await h.eval(() => !!G.state.flags.knighted), await h.eval(() => G.state.look));
  // world still works: walk out of the castle
  await q.enter(10, 15, 'crownhold');
  await q.shot('free_roam');
  await q.save('s6');
};
