// Stage 7: edge cases — menu during/after scripts, viewport layouts (run with --landscape / --vp 360x640), save+reload+Continue.
import { mk } from './lib.mjs';
export default async (page, h) => {
  const q = mk(page, h, 's7');
  const tag = process.env.TAG || 'p';
  await h.wait(400);
  await q.shot(tag + '_title');
  await h.eval(() => G.debug.newGame());
  await h.wait(1600);
  // dialog open: try the menu key and the ☰ button — must not open over the script
  const W = await h.W();
  await h.key('Escape'); await h.wait(200);
  await h.tap(W - 16, 16); await h.wait(300);
  await q.shot(tag + '_opening_dialog');
  console.log('during script scene', await h.eval(() => G.debug.scene()), 'busy', await h.eval(() => G.ui.busy()));
  await q.pump({ maxMs: 90000 });
  await h.tap(W - 16, 16); await h.wait(500);
  console.log('after script scene', await h.eval(() => G.debug.scene()));
  await q.shot(tag + '_menu_after');
  // gear tab via keyboard right
  await h.key('ArrowRight'); await h.wait(300);
  await q.shot(tag + '_menu_gear');
  await h.key('Escape'); await h.wait(400);
  // mid-game layouts
  await q.load('s5');
  await q.shot(tag + '_harrowfield');
  await h.eval(() => G.debug.warp('harrowfield_lists', 8, 4)); await h.wait(700); await q.pump();
  await h.eval(() => { G.tournament.run('harrowfield_lists'); }); await h.wait(700);
  await q.shot(tag + '_lists_hall');
  await h.key('Escape'); await h.wait(500); await q.pump();
  await h.eval(() => { G.shop.open('harrowfield_armory'); }); await h.wait(700);
  await q.shot(tag + '_armory');
  await h.key('Escape'); await h.wait(500); await q.pump();
  await h.eval(() => { G.ui.say(['A long line of dialogue to check wrapping on small screens: Spur in rhythm, not in panic! Tap... tap... tap.'], { name: 'Sir Harold (old)', look: 'knight' }); }); await h.wait(1200);
  await q.shot(tag + '_dialog');
  await q.pump();
  // save in Harrowfield inn, reload, Continue
  await h.eval(() => G.debug.warp('harrowfield', 6, 25)); await h.wait(700); await q.pump();
  await q.enter(6, 24, 'harrowfield_inn');
  await q.talk(2, 3, { pump: { onScene: async () => { await h.wait(400); } } });
  const before = await h.eval(() => ({ map: G.state.map, x: G.state.x, y: G.state.y, gold: G.state.gold, inn: G.state.lastInn }));
  await page.reload();
  await page.waitForFunction(() => window.__SR_READY === true);
  await h.wait(600);
  await q.shot(tag + '_title_continue');
  const H = await h.H();
  // Continue button: first of two buttons near the bottom
  const pos = await h.eval(() => { const bh = 26; let by = G.H * 0.82 - (bh + 6); if (by + 2 * (bh + 6) > G.H - 10) by = G.H - 10 - 2 * (bh + 6); return by + 13; });
  await h.tap(W / 2, pos); await h.wait(1500);
  await q.pump();
  const after = await h.eval(() => ({ map: G.state.map, x: G.state.x, y: G.state.y, gold: G.state.gold, inn: G.state.lastInn, scene: G.debug.scene() }));
  console.log('before', JSON.stringify(before)); console.log('after ', JSON.stringify(after));
  await q.shot(tag + '_continued');
  void H;
};
