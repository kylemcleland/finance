// Human-ish bot: drags (L zone) to aim with lag/noise, spurs on the beat (Space),
// braces with timing noise. env OPP, GEAR=basic|good, SKILL=0..1 (aim/timing quality).
export default async (page, h) => {
  const opp = process.env.OPP || 'joust_ned';
  const gear = process.env.GEAR || 'basic';
  const skill = Number(process.env.SKILL || 0.6);
  await h.eval(({ opp, gear }) => {
    const g = gear === 'good' ? ['oak_lance', 'destrier', 'chainmail'] : ['practice_lance', 'old_nag'];
    for (const id of g) { G.player.give(id); G.player.equip(id); }
    if (gear === 'good') { G.state.perks = { steady_hand: 1, spurs: 1, iron_seat: 1 }; }
    window.__res = null;
    G.battle.start('joust', { opponent: opp }).then((r) => (window.__res = r));
  }, { opp, gear });
  const W = await h.W(), H = await h.H(), scale = await h.eval(() => G.gfx.scale);
  const dbg = () => h.eval(() => G.battle.active && G.battle.active.dbg());
  const noise = (a) => (Math.random() * 2 - 1) * a;
  let px = W * 0.25, py = H * 0.6, down = false;
  for (let iter = 0; iter < 4000; iter++) {
    const d = await dbg();
    const res = await h.eval(() => window.__res);
    if (res) { console.log(opp, gear, 'skill', skill, 'RESULT', JSON.stringify(res)); break; }
    if (!d) { await h.wait(50); continue; }
    if (d.phase === 'charge' || d.phase === 'ready') {
      if (!down) { px = W * 0.25; py = H * 0.6; await page.mouse.move(px * scale, py * scale); await page.mouse.down(); down = true; }
      // aim: move the reticle toward the shield (reaction-limited)
      const k = 0.25 + 0.35 * skill;
      const ex = (d.sh.x - d.ret.x) * k + noise(3 * (1 - skill)), ey = (d.sh.y - d.ret.y) * k + noise(3 * (1 - skill));
      px = Math.min(W / 2 - 2, Math.max(2, px + ex / 1.15)); py = Math.min(H - 2, Math.max(2, py + ey / 1.15));
      await page.mouse.move(px * scale, py * scale);
      if (d.phase === 'charge') {
        const toBeat = d.beatP - d.beatT;
        if (d.tti > 1.3 && d.s < 0.74 && (toBeat < 0.05 || d.beatT < 0.02)) await page.keyboard.press('Space');
        const err = noise(0.12 * (1 - skill) + 0.03);
        if (d.tti < 0.5 && d.tti < 0.03 + err && !d.brace) await page.keyboard.press('Space');
      }
    } else {
      if (down) { await page.mouse.up(); down = false; }
      if (d.phase === 'card' || d.phase === 'outro') {
        if (d.pt > 1.4) { console.log(' passes', JSON.stringify(d.passes.map((p) => [p.you, p.them, p.zone, p.unA ? 'UNA' : p.unB ? 'UNB' : ''].join('/')))); await page.keyboard.press('Enter'); await h.wait(300); }
      } else if (d.phase === 'intro') { await page.keyboard.press('Enter'); await h.wait(300); }
    }
    await h.wait(15);
  }
};
