// Integration smoke test: new game → opening → every map → every battle type → menus.
// Run: node test/run.mjs --script test/smoke.mjs [--outdir test/shots/smoke]
export default async (page, h) => {
  const problems = [];
  // Advance dialogs/asks with the keyboard (asks pick option 0) and auto-win battles.
  async function autopilot(ms = 4000, { win = true } = {}) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      const st = await page.evaluate(() => ({
        busy: G.ui.busy(), battle: !!G.battle.active, scene: G.debug.scene(),
      }));
      if (st.battle) { await h.wait(500); await page.evaluate((w) => G.debug.skipBattle(w), win); await h.wait(900); continue; }
      if (st.busy) { await h.key('Enter', 40); await h.wait(120); continue; }
      await h.wait(150);
      const again = await page.evaluate(() => G.ui.busy() || !!G.battle.active);
      if (!again) { await h.wait(500); if (!(await page.evaluate(() => G.ui.busy() || !!G.battle.active))) return; }
    }
  }

  await h.shot('00-title');
  await page.evaluate(() => { localStorage.clear(); });
  const W = await h.W(), H = await h.H();
  // New Game button sits around 82% height
  await page.evaluate(() => G.input.events.length = 0);
  await page.evaluate(() => { G.newGame(); G.save(); G.world.start(); });
  await h.wait(800);
  await h.shot('01-start');
  console.log('opening...'); await autopilot(30000); console.log('opening done');
  await h.shot('02-after-opening');
  const st = await page.evaluate(() => ({ map: G.state.map, flags: G.state.flags, equip: G.state.equip, level: G.state.level }));
  console.log('after opening:', JSON.stringify(st));

  // Validate + visit every map
  const maps = await page.evaluate(() => Object.keys(G.maps).filter((m) => !m.startsWith('__')));
  console.log('maps:', maps.join(', '));
  for (const id of maps) {
    const issues = await page.evaluate((id) => (G.world.validate ? G.world.validate(G.maps[id]) : []), id);
    if (issues.length) problems.push(`${id}: ${issues.slice(0, 5).join(' | ')}`);
    const spot = await page.evaluate((id) => {
      const m = G.maps[id];
      const w = m.warps && m.warps[0];
      // land next to the first warp if possible, else center
      if (w) {
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const x = w.x + dx, y = w.y + dy;
          const row = m.tiles[y];
          if (row && row[x] && !(G.tiles && G.tiles.isSolid && G.tiles.isSolid(row[x]))) return [x, y];
        }
      }
      return [Math.floor(m.tiles[0].length / 2), Math.floor(m.tiles.length / 2)];
    }, id);
    await page.evaluate(([id, x, y]) => G.debug.warp(id, x, y), [id, ...spot]);
    await h.wait(900);
    await autopilot(3000);
    await h.shot('map-' + id); console.log('map', id);
  }

  // Battles
  await page.evaluate(() => {
    for (const id of ['iron_sword', 'kite_shield', 'practice_lance', 'old_nag', 'hunting_bow']) { G.player.give(id); G.player.equip(id); }
    G.player.give('herb', 3);
  });
  const battles = [
    ['sword', { enemies: ['wolf', 'wolf'], arena: 'forest', canFlee: true }],
    ['sword', { enemies: ['bram'], arena: 'pit', boss: true, title: 'Seal Bout' }],
    ['joust', { opponent: 'joust_ned' }],
    ['archery', { rivals: ['arch_tam', 'arch_lia'], tier: 1 }],
  ];
  for (const [type, opts] of battles) {
    page.evaluate(([t, o]) => { window.__res = null; G.battle.start(t, o).then((r) => (window.__res = r)); }, [type, opts]);
    await h.wait(2500);
    await h.shot(`battle-${type}-${opts.arena || opts.opponent || 'x'}`);
    await page.evaluate(() => G.debug.skipBattle(true));
    await h.wait(1500);
    await autopilot(3000);
    const r = await page.evaluate(() => window.__res);
    if (!r) problems.push(`${type} battle did not resolve`);
  }

  // Menus
  page.evaluate(() => G.menus && G.menus.open());
  await h.wait(600);
  await h.shot('menu');
  await h.key('Escape'); await h.wait(400);
  page.evaluate(() => G.cmd.shop && G.cmd.shop('thornbrook_store'));
  await h.wait(600);
  await h.shot('shop');
  await h.key('Escape'); await h.wait(300); await h.key('Escape'); await h.wait(300);
  page.evaluate(() => G.cmd.tournament && G.cmd.tournament('thornbrook_pit'));
  await h.wait(600);
  await h.shot('hall');
  await h.key('Escape'); await h.wait(300); await h.key('Escape');

  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'smoke: no problems');
  if (problems.length) h.errors.push(...problems.map((p) => '[smoke] ' + p));
};
