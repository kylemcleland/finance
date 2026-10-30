export default async function (page, h) {
  const res = () => h.eval(() => window.__res);
  const start = (o) => h.eval((o) => { window.__res = null; G.battle.start('sword', o).then((r) => (window.__res = r)); }, o);
  // 1. intro line + boss music, then noDeath loss
  await h.eval(() => { G.newGame(); G.state.hp = 40; });
  await start({ enemies: ['cedric1'], arena: 'pit', intro: 'Ha! A stable boy with a stick? Have at you!', noDeath: true, title: 'Rival!' });
  await h.wait(1500);
  await h.shot('feat_intro_line');
  await h.tap(100, 300); await h.wait(300); await h.tap(100, 300);
  await h.wait(900);
  await h.shot('feat_vs');
  await h.wait(1800);
  await h.eval(() => { const s = G.battle.active._s; s.P.hp = 1; });
  for (let i = 0; i < 80 && !(await res()); i++) {
    await h.wait(250);
    if (i === 14) await h.shot('feat_defeat');
    if (i > 16) await h.tap(100, 300);
  }
  console.log('noDeath result', JSON.stringify(await res()));

  // 2. potion button + Run button
  await h.eval(() => { G.newGame(); G.state.bag = { bread: 2, herb: 1 }; G.state.hp = 10; });
  await start({ enemies: ['wolf', 'wolf'], arena: 'forest', canFlee: true });
  await h.wait(3400);
  await h.tap(15, 14);
  await h.wait(150);
  await h.shot('feat_potion');
  console.log('after potion hp', await h.eval(() => [Math.round(G.battle.active._s.P.hp), JSON.stringify(G.state.bag)]));
  const W = await h.W();
  await h.tap(W - 20, 12);
  await h.wait(1500);
  console.log('flee result', JSON.stringify(await res()));

  // 3. perks: whirlwind spin with keyboard hold-release, riposte etc.
  await h.eval(() => { G.newGame(); for (const p of ['parry_master', 'riposte', 'whirlwind', 'second_wind', 'blade_dancer']) G.state.perks[p] = true; G.state.level = 6; G.debug.equip('iron_sword'); G.debug.equip('kite_shield'); G.state.hp = G.player.maxHp(); });
  await start({ enemies: ['bandit', 'bandit', 'wolf'], arena: 'road' });
  await h.wait(3600);
  await page.keyboard.down('KeyX'); await h.wait(800);
  await h.shot('feat_whirl_charge');
  await page.keyboard.up('KeyX'); await h.wait(120);
  await h.shot('feat_whirl_spin');
  await h.wait(600);
  // 4. rotate to landscape mid battle
  await page.setViewportSize({ width: 844, height: 390 });
  await h.wait(700);
  await h.shot('feat_rotated');
  await page.setViewportSize({ width: 390, height: 844 });
  await h.wait(500);
  await h.shot('feat_rotated_back');
  await h.eval(() => G.debug.skipBattle(true));
  await h.wait(1200);
  console.log('perk result', JSON.stringify(await res()));
}
