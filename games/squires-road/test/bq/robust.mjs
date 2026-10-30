// Robustness: focus loss mid-gesture, rotation mid-battle, debugEnd in every phase, done exactly once.
export default async function (page, h) {
  let W = await h.W(), H = await h.H();
  const blur = () => h.eval(() => { window.dispatchEvent(new Event('blur')); });
  await h.eval(() => { G.newGame(); G.state.bag = { bread: 1 }; for (const id of ['practice_lance', 'old_nag', 'short_bow']) { G.player.give(id); G.player.equip(id); } });
  await h.eval(() => { window.__allDone = []; const o = G.battle.start; G.battle.start = async function (t, op) { const r = await o.call(this, t, op); window.__allDone.push(t); return r; }; });

  // sword: hold R, lose focus, finger never lifts -> must not get stuck blocking; next tap strikes
  await h.battle('sword', { enemies: ['pit_tom'], arena: 'pit' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight', 8000);
  await h.touch.down(2, W * 0.8, H * 0.6); await h.wait(400);
  console.log('sword holding:', await h.eval(() => G.battle.active._s.P.state));
  await blur();
  await h.wait(200);
  console.log('sword after blur:', await h.eval(() => G.battle.active._s.P.state));
  await h.touch.up(2); // the browser may still send the lift later; harmless
  await h.wait(100);
  await h.eval(() => { window.__sw = []; });
  await h.tap(W * 0.8, H * 0.6, 50, 3); await h.wait(60);
  console.log('sword strike after blur:', await h.eval(() => { const P = G.battle.active._s.P; return P.state + (P.sw ? ':' + P.sw.i : ''); }));
  // keyboard block stuck after blur
  await h.page.keyboard.down('KeyX'); await h.wait(300); await blur(); await h.wait(150);
  console.log('sword key-block after blur:', await h.eval(() => G.battle.active._s.P.state));
  await h.page.keyboard.up('KeyX');
  // rotate mid-fight twice
  await h.setVp(844, 390); await h.wait(400); await h.shot('rb_sword_rot');
  await h.setVp(390, 844); await h.wait(300);
  // debugEnd twice -> done once
  await h.eval(() => { G.debug.skipBattle(true); G.battle.active && G.battle.active.debugEnd(false); });
  await h.until(() => window.__res, 6000);
  console.log('sword res', JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN));

  // sword: debugEnd during the intro, during the outro
  for (const when of ['intro', 'outro']) {
    await h.battle('sword', { enemies: ['wolf'], arena: 'forest', canFlee: true });
    await h.until(() => G.battle.active && G.battle.active._s.phase === 'intro', 8000);
    if (when === 'outro') { await h.until(() => G.battle.active._s.phase === 'fight', 8000); await h.eval(() => { const s = G.battle.active._s; s.enemies[0].hp = 1; }); await h.eval(() => G.battle.active._s.enemies[0].hp = 0); }
    if (when === 'outro') { await h.eval(() => { const s = G.battle.active._s; s.P.hp = 0.0001; }); await h.until(() => true); }
    await h.eval(() => G.debug.skipBattle(true));
    await h.until(() => window.__res, 6000);
    console.log('sword', when, JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN));
  }
  // sword Run button, then try to tap Run again during the flee
  await h.battle('sword', { enemies: ['wolf', 'wolf'], arena: 'forest', canFlee: true });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight', 8000);
  W = await h.W();
  await h.tap(W - 24, 14, 60, 4); await h.wait(100); await h.tap(W - 24, 14, 60, 4);
  await h.until(() => window.__res, 6000);
  await h.wait(500);
  console.log('sword run', JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN));

  // joust: blur mid charge, rotate, then debugEnd in card phase
  await h.battle('joust', { opponent: 'joust_ned' });
  await h.until(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg().phase === 'charge', 9000);
  await h.touch.down(1, 40, 300); await h.touch.move(1, 50, 290); await blur(); await h.touch.up(1);
  await h.setVp(844, 390); await h.wait(500); await h.shot('rb_joust_rot');
  const d = await h.eval(() => G.battle.active.dbg());
  console.log('joust after rotate W,H', d.W, d.H, 'ret', Math.round(d.ret.x), Math.round(d.ret.y));
  await h.setVp(390, 844);
  await h.eval(() => { G.debug.skipBattle(true); G.debug.skipBattle(false); });
  await h.until(() => window.__res, 6000);
  console.log('joust res', JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN));

  // archery: draw, lose focus -> arrow must NOT be loosed; rotate during the board; debugEnd
  await h.battle('archery', { rivals: ['arch_tam'], tier: 1 });
  await h.until(() => G.battle.active && G.battle.active._dbg && G.battle.active._dbg.get().phase === 'aim', 9000);
  W = await h.W(); H = await h.H();
  await h.touch.down(2, W * 0.8, H * 0.6); await h.wait(700);
  await blur(); await h.wait(150);
  const a = await h.eval(() => G.battle.active._dbg.get());
  console.log('archery after blur phase', a.phase, 'arrowIdx', a.arrowIdx, 'power', a.power.toFixed(2));
  await h.touch.up(2);
  await h.setVp(844, 390); await h.wait(400); await h.shot('rb_arch_rot');
  await h.setVp(390, 844); await h.wait(300);
  await h.eval(() => { G.debug.skipBattle(false); G.debug.skipBattle(true); });
  await h.until(() => window.__res, 6000);
  await h.wait(800);
  console.log('archery res', JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN), 'all', await h.eval(() => window.__allDone.join(',')));
  console.log('scenes', await h.eval(() => G.scenes.stack.map((s) => s.name).join(',')));
}
