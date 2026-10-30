// Joust via real multi-touch: L thumb drags the lance, R thumb taps spurs and the brace.
// env OPP (default quintain_squire), SKILL 0..1, GEAR basic|good, SHOTS=1, SPURS=beat|mash|none
export default async (page, h) => {
  const opp = process.env.OPP || 'quintain_squire';
  const skill = Number(process.env.SKILL ?? 0.5);
  const gear = process.env.GEAR || 'basic';
  const spurMode = process.env.SPURS || 'beat';
  const shots = !!process.env.SHOTS;
  const runs = Number(process.env.RUNS || 1);
  await h.eval((gear) => {
    G.newGame();
    const g = gear === 'good' ? ['oak_lance', 'destrier', 'chainmail'] : ['practice_lance', 'old_nag'];
    for (const id of g) { G.player.give(id); G.player.equip(id); }
  }, gear);
  const W = await h.W(), H = await h.H();
  const noise = (a) => (Math.random() * 2 - 1) * a;
  let wins = 0;
  for (let run = 0; run < runs; run++) {
    await h.battle('joust', { opponent: opp, title: 'Tilting Lesson' });
    let px = W * 0.25, py = H * 0.6, down = false, shotN = 0, lastSpur = 0;
    const R = [W * 0.8, H * 0.7];
    for (let iter = 0; iter < 5000; iter++) {
      const res = await h.res();
      if (res) { console.log(opp, 'skill', skill, 'RESULT', JSON.stringify(res), 'doneN', await h.eval(() => window.__doneN)); if (res.won) wins++; break; }
      const d = await h.eval(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg());
      if (!d) { await h.wait(40); continue; }
      if (d.phase === 'charge' || d.phase === 'ready') {
        if (!down) { px = W * 0.25; py = H * 0.6; await h.touch.down(1, px, py); down = true; }
        const k = 0.2 + 0.4 * skill;
        const ex = (d.sh.x - d.ret.x) * k + noise(4 * (1 - skill)), ey = (d.sh.y - d.ret.y) * k + noise(4 * (1 - skill));
        px = Math.min(W / 2 - 2, Math.max(2, px + ex / 1.15)); py = Math.min(H - 2, Math.max(2, py + ey / 1.15));
        await h.touch.move(1, px, py);
        if (d.phase === 'charge') {
          const now = Date.now();
          if (d.tti > 1.3 && spurMode !== 'none') {
            const toBeat = d.beatP - d.beatT;
            const want = spurMode === 'mash' ? now - lastSpur > 120 : (d.s < 0.74 && (toBeat < 0.06 || d.beatT < 0.03) && now - lastSpur > 200);
            if (want) { lastSpur = now; await h.tap(R[0] + noise(10), R[1] + noise(10), 40, 2); }
          }
          const err = noise(0.14 * (1 - skill) + 0.04);
          if (d.tti < 0.5 && d.tti < 0.04 + err && !d.brace) await h.tap(R[0], R[1], 40, 2);
          if (shots && d.tti < 0.3 && shotN === 0) { shotN++; await h.shot('jo_ring'); }
          if (shots && d.tti > 2 && d.tti < 2.2 && shotN === 0) await h.shot('jo_charge');
        }
        if (shots && d.phase === 'ready' && d.pt > 1.6 && d.pt < 1.75 && d.passN === 1) await h.shot('jo_ready');
      } else {
        if (down) { await h.touch.up(1); down = false; }
        if (d.phase === 'resolve' && shots && d.pt > 0.7 && d.pt < 0.85) await h.shot('jo_resolve' + d.passN);
        if (d.phase === 'card' || d.phase === 'outro' || d.phase === 'intro') {
          if (shots && d.phase === 'intro' && d.pt > 0.8 && d.pt < 1.0) await h.shot('jo_intro');
          if (shots && d.phase === 'card' && d.pt > 0.7 && d.pt < 0.9) await h.shot('jo_card');
          if (shots && d.phase === 'outro' && d.pt > 1.3 && d.pt < 1.5) await h.shot('jo_outro');
          if (d.pt > 1.6) { await h.tap(W * 0.75, H * 0.5); await h.wait(250); }
        }
      }
      await h.wait(12);
    }
  }
  console.log('wins', wins, '/', runs);
};
