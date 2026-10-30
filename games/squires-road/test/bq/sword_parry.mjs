// Parry sweep: press R (real touch) at a chosen time before the foe's windup ends, hold, release.
// Reports parry / block / hit per lead time. env FOE (default pit_tom), N trials
export default async function (page, h) {
  const foe = process.env.FOE || 'pit_tom';
  const N = Number(process.env.N || 14);
  const W = await h.W(), H = await h.H();
  const R = [W * 0.78, H * 0.62];
  await h.eval(() => { G.newGame(); });
  await h.battle('sword', { enemies: [foe], arena: 'pit' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight', 8000);
  const leads = [0.32, 0.26, 0.2, 0.15, 0.1, 0.05, 0.0];
  const out = {};
  for (let n = 0; n < N; n++) {
    const lead = leads[n % leads.length];
    await h.eval(() => { const s = G.battle.active._s; s.P.hp = s.P.maxHp = 999; s.P.sta = s.P.maxSta; s.enemies[0].hp = s.enemies[0].maxHp; });
    const ok = await h.until((lead) => { const s = G.battle.active._s; const e = s.enemies[0]; return e.state === 'windup' && !e.mv.col !== 'r' && e.mv.col === 'w' && e.wind - e.st <= lead && s.P.state === 'free'; }, 15000, lead);
    if (!ok) { console.log('no windup'); continue; }
    const before = await h.eval(() => ({ ...G.battle.active._s.stats }));
    await h.touch.down(2, R[0], R[1]);
    await h.wait(380);
    await h.touch.up(2);
    await h.wait(250);
    const after = await h.eval(() => ({ ...G.battle.active._s.stats }));
    const r = after.parries > before.parries ? 'parry' : after.blocks > before.blocks ? 'block' : after.taken > before.taken ? 'hit' : 'none';
    (out[lead] = out[lead] || []).push(r);
    await h.wait(900);
  }
  for (const k of Object.keys(out).sort()) console.log(foe, 'lead', k, out[k].join(','));
  await h.eval(() => G.debug.skipBattle(false));
  await h.wait(1500);
  console.log('result', JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN));
}
