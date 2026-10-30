// Outro / defeat consistency shots for all three battles.
export default async function (page, h) {
  await h.eval(() => { G.newGame(); for (const id of ['practice_lance', 'old_nag', 'short_bow']) { G.player.give(id); G.player.equip(id); } });
  await h.battle('sword', { enemies: ['pit_tom'], arena: 'pit' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight', 8000);
  await h.eval(() => { const s = G.battle.active._s; s.P.hp = 1; s.P.def = -99; });
  await h.until(() => G.battle.active._s.phase === 'outro', 20000); await h.wait(1300); await h.shot('o_sword_defeat');
  await h.until(() => window.__res, 8000);
  await h.battle('joust', { opponent: 'joust_ned' });
  await h.until(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg().phase === 'charge', 9000);
  await h.eval(() => { G.battle.active.force = { you: 0, them: 2, unB: true }; });
  await h.until(() => G.battle.active.dbg().phase === 'resolve', 20000); await h.wait(1600); await h.shot('o_joust_unhorsed');
  await h.until(() => G.battle.active.dbg().phase === 'outro', 9000); await h.wait(1300); await h.shot('o_joust_defeat');
  await h.until(() => window.__res, 8000);
  await h.battle('archery', { rivals: ['wren'], tier: 2 });
  await h.until(() => G.battle.active && G.battle.active._dbg && G.battle.active._dbg.get().phase === 'aim', 9000);
  // shoot 9 weak arrows quickly by touch (taps under 0.2s don't loose; hold 0.3s = weak arrow)
  const W = await h.W(), H = await h.H();
  for (let i = 0; i < 90; i++) {
    const p = await h.eval(() => G.battle.active && G.battle.active._dbg && G.battle.active._dbg.get().phase);
    if (!p || p === 'outro') break;
    if (p === 'aim') await h.hold(W * 0.8, H * 0.6, 300, 2); else await h.tap(W * 0.8, H * 0.6);
    await h.wait(350);
  }
  await h.until(() => G.battle.active && G.battle.active._dbg.get().phase === 'outro', 9000); await h.wait(1300); await h.shot('o_arch_defeat');
  await h.until(() => window.__res, 8000);
  console.log(JSON.stringify(await h.res()));
}
