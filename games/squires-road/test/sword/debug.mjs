export default async function (page, h) {
  await h.eval(() => { G.battle.start('sword', { enemies: [process_enemy()], arena: 'pit' }); function process_enemy(){return 'pit_tom';} });
  for (let i = 0; i < 10; i++) {
    await h.wait(500);
    console.log(JSON.stringify(await h.eval(() => { const b = G.battle.active; if (!b) return null; const s = b._s; const e = s.enemies[0]; return { ph: s.phase, T: s.T.toFixed(2), st: e.state, cd: e.cd.toFixed(2), x: e.x.toFixed(1), y: e.y.toFixed(1), vx: e.vx, vy: e.vy, px: s.P.x.toFixed(1), py: s.P.y.toFixed(1), php: s.P.hp, tok: !!s.token }; })));
  }
}
