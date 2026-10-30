// Touch gestures: tutorial dummy via tap / hold / flick, then a parry by holding R during a telegraph.
export default async function (page, h) {
  const W = await h.W(), H = await h.H();
  const R = [W * 0.78, H * 0.6];
  await h.eval(() => { G.newGame(); window.__res = null; G.battle.start('sword', { enemies: ['dummy'], arena: 'practice', title: 'Training' }).then((r) => (window.__res = r)); });
  await h.wait(3200);
  const tut = () => h.eval(() => G.battle.active && G.battle.active._s.tut.stage);
  // walk up to dummy (left-zone drag held)
  const walk = async (ms) => {
    const [x, y] = [W * 0.25, H * 0.7];
    await page.mouse.move(x * 2, y * 2); await page.mouse.down();
    await page.mouse.move(x * 2, (y - 20) * 2, { steps: 4 });
    await h.wait(ms); await page.mouse.up();
  };
  await walk(1300);
  console.log('stage before', await tut());
  for (let i = 0; i < 3; i++) { await h.tap(...R); await h.wait(250); }
  await h.shot('touch_tut_strike');
  console.log('after taps', await tut());
  await h.hold(R[0], R[1], 800);
  console.log('after hold', await tut());
  await h.drag(R[0], R[1], R[0] + 40, R[1], 100);
  await h.wait(200);
  await h.shot('touch_tut_dodge');
  console.log('after flick', await tut());
  await h.wait(500);
  await walk(500);
  for (let i = 0; i < 40 && !(await h.eval(() => window.__res)); i++) { await h.tap(...R); await h.wait(200); if (i === 6) await h.shot('touch_tut_destroy'); }
  await h.wait(1600);
  await h.shot('touch_tut_victory');
  for (let i = 0; i < 10 && !(await h.eval(() => window.__res)); i++) { await h.tap(W / 2, H / 2); await h.wait(400); }
  console.log('dummy result', JSON.stringify(await h.eval(() => window.__res)));

  // Parry via touch hold right before a hit
  await h.eval(() => { G.newGame(); window.__res = null; G.battle.start('sword', { enemies: ['pit_tom'], arena: 'pit' }).then((r) => (window.__res = r)); });
  await h.wait(3300);
  let parried = 0;
  for (let tries = 0; tries < 300 && !parried; tries++) {
    const rem = await h.eval(() => { const s = G.battle.active._s; const e = s.enemies[0]; return e.state === 'windup' ? e.wind - e.st : 9; });
    if (rem < 0.16) {
      await page.mouse.move(R[0] * 2, R[1] * 2); await page.mouse.down();
      await h.wait(60);
      await h.shot('touch_parry');
      await h.wait(300); await page.mouse.up();
      parried = await h.eval(() => G.battle.active._s.stats.parries);
      console.log('parry attempt: parries=', parried, 'blocks=', await h.eval(() => G.battle.active._s.stats.blocks));
      if (!parried) await h.wait(300);
    } else await h.wait(16);
  }
  await h.eval(() => G.debug.skipBattle(false));
  await h.wait(1500);
  console.log('tom result', JSON.stringify(await h.eval(() => window.__res)));
}
