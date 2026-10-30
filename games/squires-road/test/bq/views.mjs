// Screenshot each battle at the current viewport: intro, hints, action/telegraph, outro. env TAG
export default async function (page, h) {
  const tag = process.env.TAG || 'p';
  const W = await h.W(), H = await h.H();
  console.log('logical', W, H);
  await h.eval(() => { G.newGame(); G.state.bag = { bread: 2 }; for (const id of ['practice_lance', 'old_nag', 'short_bow']) { G.player.give(id); G.player.equip(id); } });
  // sword: boss with hint + telegraph
  await h.battle('sword', { enemies: ['bram'], arena: 'pit', boss: true, title: 'Seal Bout' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'intro');
  await h.wait(900); await h.shot(`v_${tag}_sw_intro`);
  await h.until(() => G.battle.active._s.phase === 'fight');
  await h.eval(() => { const s = G.battle.active._s; s.P.hp = s.P.maxHp = 999; });
  await h.wait(1200); await h.shot(`v_${tag}_sw_hint`);
  await h.until(() => { const e = G.battle.active._s.enemies[0]; return e.state === 'windup' && e.st > e.wind * 0.6; }, 15000);
  await h.shot(`v_${tag}_sw_tele`);
  await h.eval(() => G.debug.skipBattle(true));
  await h.until(() => window.__res, 8000);
  // sword pack with Run button
  await h.battle('sword', { enemies: ['wolf', 'wolf', 'bandit'], arena: 'forest', canFlee: true });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight');
  await h.wait(1500); await h.shot(`v_${tag}_sw_pack`);
  await h.eval(() => { const s = G.battle.active._s; for (const e of s.enemies) e.hp = 0.1; });
  await h.eval(() => { const a = G.battle.active; a._s.enemies.forEach((e) => { e.dead = true; }); });
  await h.eval(() => G.debug.skipBattle(false));
  await h.until(() => window.__res, 8000);
  // joust
  await h.battle('joust', { opponent: 'rowena', title: 'Seal of the Lance' });
  await h.until(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg().phase === 'intro');
  await h.wait(900); await h.shot(`v_${tag}_jo_intro`);
  await h.until(() => G.battle.active.dbg().phase === 'charge', 8000);
  await h.wait(600); await h.shot(`v_${tag}_jo_charge`);
  await h.until(() => G.battle.active.dbg().tti < 0.6, 15000);
  await h.shot(`v_${tag}_jo_ring`);
  await h.until(() => G.battle.active.dbg().phase === 'card', 15000);
  await h.wait(800); await h.shot(`v_${tag}_jo_card`);
  await h.eval(() => G.debug.skipBattle(false));
  await h.until(() => window.__res, 8000);
  // archery
  await h.battle('archery', { rivals: ['arch_tam', 'arch_lia', 'arch_bo'], tier: 3, title: 'Squire Cup' });
  await h.until(() => G.battle.active && G.battle.active._dbg && G.battle.active._dbg.get().phase === 'aim', 9000);
  await h.wait(700); await h.shot(`v_${tag}_ar_hint`);
  await h.touch.down(2, W * 0.8, H * 0.6); await h.wait(1300); await h.shot(`v_${tag}_ar_draw`); await h.touch.up(2);
  await h.until(() => G.battle.active._dbg.get().phase === 'hit', 5000);
  await h.wait(300); await h.shot(`v_${tag}_ar_hit`);
  await h.eval(() => G.debug.skipBattle(true));
  await h.until(() => window.__res, 8000);
  console.log('done', JSON.stringify(await h.res()));
}
