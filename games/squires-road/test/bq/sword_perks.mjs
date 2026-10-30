// Perks + potion via touch: whirlwind hold-release, riposte after a touch parry, second_wind, blade_dancer.
export default async function (page, h) {
  const W = await h.W(), H = await h.H();
  const R = [W * 0.78, H * 0.62];
  const s = (fn) => h.eval(fn);
  await s(() => { G.newGame(); for (const p of ['parry_master', 'riposte', 'whirlwind', 'second_wind', 'blade_dancer']) G.state.perks[p] = true; G.state.level = 6; G.debug.equip('iron_sword'); G.debug.equip('kite_shield'); G.state.hp = 20; G.state.bag = { bread: 2 }; });
  await h.battle('sword', { enemies: ['pit_squire1'], arena: 'pit' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight', 8000);
  await h.wait(400);
  await h.shot('pk_hint');
  // potion button (tap, L zone)
  const hp0 = await s(() => Math.round(G.battle.active._s.P.hp));
  await h.tap(16, 15, 60, 5); await h.wait(150);
  console.log('potion: hp', hp0, '->', await s(() => Math.round(G.battle.active._s.P.hp)), 'bag', await s(() => JSON.stringify(G.state.bag)));
  await h.wait(800);
  // blade_dancer: dodge cost and iframes
  const sta0 = await s(() => G.battle.active._s.P.sta);
  await h.drag(R[0], R[1], R[0] - 40, R[1], 90, 2);
  await h.wait(30);
  console.log('blade_dancer: dodge cost', (sta0 - await s(() => G.battle.active._s.P.sta)).toFixed(1), '(base 20, perk 14)');
  await h.wait(700);
  // whirlwind: hold 800 ms then release
  await s(() => { window.__spin = false; const tick = () => { const a = G.battle.active; if (!a) return; const P = a._s.P; if (P.sw && P.sw.spin) window.__spin = true; requestAnimationFrame(tick); }; tick(); });
  await h.touch.down(2, R[0], R[1]); await h.wait(850);
  await h.shot('pk_whirl_charge');
  await h.touch.up(2); await h.wait(150);
  await h.shot('pk_whirl_spin');
  console.log('whirlwind spin happened:', await s(() => window.__spin));
  await h.wait(800);
  // riposte: parry by touch, then a quick tap strike
  await s(() => { const st = G.battle.active._s; st.P.hp = st.P.maxHp; st.enemies[0].hp = st.enemies[0].maxHp = 9999; });
  let done = false;
  for (let i = 0; i < 12 && !done; i++) {
    await h.until(() => { const st = G.battle.active._s, e = st.enemies[0]; return e.state === 'windup' && e.mv.col === 'w' && !e.mv.throw && e.wind - e.st < 0.1 && st.P.state === 'free'; }, 15000);
    const p0 = await s(() => G.battle.active._s.stats.parries);
    await h.touch.down(2, R[0], R[1]); await h.wait(260); await h.touch.up(2);
    await h.wait(60);
    const p1 = await s(() => G.battle.active._s.stats.parries);
    if (p1 > p0) {
      const before = await s(() => ({ hp: G.battle.active._s.enemies[0].hp, rip: G.battle.active._s.P.riposte > G.battle.active._s.T }));
      await h.tap(R[0], R[1], 50, 2);
      await h.until(() => { const P = G.battle.active._s.P; return P.state !== 'swing'; }, 2000);
      await h.wait(400);
      const after = await s(() => ({ hp: G.battle.active._s.enemies[0].hp, rip: G.battle.active._s.P.riposte, atk: G.battle.active._s.P.atk, def: G.battle.active._s.enemies[0].def }));
      const exp = after.atk * 2.5 * 1.5 - after.def;
      console.log('riposte: armed', before.rip, 'dmg', before.hp - after.hp, 'expected ~', Math.round(exp), '(2.5x * open 1.5x)', 'consumed', after.rip === 0);
      done = true;
    } else await h.wait(600);
  }
  // second_wind: land hits at low stamina & hp
  await s(() => { const st = G.battle.active._s; st.P.hp = 30; st.P.sta = 10; st.P.swHeal = 0; });
  const sw0 = await s(() => ({ hp: G.battle.active._s.P.hp, sta: G.battle.active._s.P.sta, landed: G.battle.active._s.stats.landed }));
  for (let i = 0; i < 12; i++) { await h.tap(R[0], R[1], 50, 2); await h.wait(260); }
  const sw1 = await s(() => ({ hp: G.battle.active._s.P.hp, sta: G.battle.active._s.P.sta, landed: G.battle.active._s.stats.landed, swHeal: G.battle.active._s.P.swHeal }));
  console.log('second_wind: landed', sw1.landed - sw0.landed, 'hp', Math.round(sw0.hp), '->', Math.round(sw1.hp), 'healed total', sw1.swHeal, '(cap 30)', 'sta', Math.round(sw0.sta), '->', Math.round(sw1.sta));
  await s(() => G.debug.skipBattle(true));
  await h.until(() => window.__res, 6000);
  console.log('res', JSON.stringify(await h.res()));
}
