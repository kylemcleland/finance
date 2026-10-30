// Touch masher: taps right zone ~6/s while walking at the foe. Should rarely parry.
export default async function (page, h) {
  const W = await h.W(), H = await h.H();
  for (const [id, L, gear] of [['pit_tom', 2, []], ['bram', 6, ['iron_sword', 'buckler', 'leather']]]) {
    await h.eval(({ id, L, gear }) => { G.newGame(); G.state.level = L; for (const g of gear) G.debug.equip(g); G.state.bag = {}; G.state.hp = G.player.maxHp(); window.__res = null; G.battle.start('sword', { enemies: [id], arena: 'pit', boss: id === 'bram' }).then((r) => (window.__res = r)); }, { id, L, gear });
    await h.wait(3300);
    for (let i = 0; i < 400 && !(await h.eval(() => window.__res)); i++) {
      const d = await h.eval(() => { const b = G.battle.active; if (!b) return 0; const s = b._s, e = s.enemies[0]; return Math.hypot(e.x - s.P.x, e.y - s.P.y); });
      if (d > 34) await h.eval(() => { /* nudge stick toward enemy via keys */ });
      await page.touchscreen.tap(W * 0.75 * 2, H * 0.6 * 2);
      await h.wait(110);
      if (d > 34) { await page.keyboard.down('KeyW'); await h.wait(60); await page.keyboard.up('KeyW'); }
    }
    console.log(id, JSON.stringify(await h.eval(() => window.__res)), JSON.stringify(await h.eval(() => (G.battle.active ? G.battle.active._s.stats : 'ended'))));
    await h.wait(1500);
  }
}
