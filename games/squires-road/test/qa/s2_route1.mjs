// Stage 2: pause menu, Aldric hint, Route 1 (encounters, trainers, blackout), lost arrows, into Millbridge.
import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's2');
  await q.load('s1');
  await q.shot('loaded');
  // pause menu via touch on the ☰ button
  const W = await h.W();
  await h.tap(W - 16, 16); await h.wait(600);
  await q.shot('pause_menu');
  console.log('scene', await h.eval(() => G.debug.scene()));
  await h.key('Escape'); await h.wait(500);
  console.log('scene after esc', await h.eval(() => G.debug.scene()));
  // leave pit, go see Aldric
  await q.enter(7, 11, 'thornbrook');
  await q.enter(17, 6, 'thornbrook_aldric');
  await q.talk(6, 4, { pump: { win: true } });
  await q.shot('aldric_hint');
  await q.enter(4, 7, 'thornbrook');
  // Gilda: open shop then leave with Escape
  await q.enter(6, 14, 'thornbrook_store');
  await q.walkTo(2, 4); await q.interact();
  const sc = await q.pump();
  console.log('shop scene', sc);
  await h.wait(400);
  await q.shot('gilda_shop');
  await h.key('Escape'); await h.wait(500);
  await q.pump();
  await q.enter(4, 7, 'thornbrook');
  // east exit
  await q.walkTo(31, 15, { avoidGrass: true });
  await q.shot('east_exit');
  await q.enter(33, 15, 'route1');
  await q.shot('route1_enter');
  // walk the route; wild battles get won (lose the 2nd one to test blackout)
  let fights = 0;
  const win = () => { fights++; return fights !== 3; };
  const pumpOpts = { win, battleShot: 'route1_battle' };
  // grind the grass patch south of the path until 3 fights (3rd lost → blackout)
  for (let i = 0; i < 40 && fights < 3; i++) {
    await q.walkTo(i % 2 ? 12 : 16, 9, { pump: pumpOpts });
    const s = await q.st(); if (s.map !== 'route1') break;
  }
  await h.wait(500);
  let s = await q.st();
  console.log('after grind', s.map, s.x, s.y, 'fights', fights);
  await q.shot('after_blackout');
  await q.econ('after blackout');
  // back to route 1
  if (s.map === 'thornbrook_stable') { await q.enter(6, 9, 'thornbrook'); }
  await q.walkTo(31, 15, { avoidGrass: true });
  await q.enter(33, 15, 'route1');
  const P = { win: true, battleShot: null };
  // north path; Sir Brambleby should spot us
  await q.walkTo(20, 6, { pump: P });
  await q.shot('after_hk1');
  await q.econ('after hk1');
  // lost arrows clearing
  await q.talk(27, 2, { pump: P });
  await q.shot('lost_arrows');
  console.log('has arrows', await h.eval(() => G.player.has('lost_arrows')));
  // south pocket + east
  await q.walkTo(31, 14, { pump: P });
  await q.walkTo(31, 9, { pump: P });
  await q.walkTo(44, 9, { pump: P });
  await q.walkTo(44, 16, { pump: P });
  await q.talk(49, 20, { pump: P }); // Old Moss heals
  await q.talk(50, 21, { pump: P }); // chest
  await q.walkTo(53, 13, { pump: P });
  await q.econ('route1 end');
  await q.enter(59, 12, 'millbridge');
  await q.shot('millbridge');
  await q.save('s2');
};
