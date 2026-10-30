// Tournament flow: hall list → ladder → rounds (skipBattle) → reward. HALL env picks hall.
export default async (page, h) => {
  const hall = process.env.HALL || 'thornbrook_pit';
  const lose = !!process.env.LOSE;
  await h.eval(() => {
    G.newGame();
    const s = G.state;
    s.level = 8; s.gold = 300; s.hp = 30;
    s.wins = { pit_novice: 1 };
    s.equip.weapon = 'rusty_sword'; s.equip.bow = 'short_bow'; s.equip.lance = 'practice_lance'; s.equip.horse = 'old_nag';
    s.seals.archery = true;
    window.__tr = undefined;
  });
  await h.eval((hall) => { G.tournament.run(hall).then((r) => (window.__tr = r)); }, hall);
  await h.wait(500);
  await h.shot('hall_' + hall);
  // pick 2nd cup (seal) via keyboard: down, down, enter → focus to enter in portrait
  if (process.env.GRAND) await h.eval(() => { Object.assign(G.state.seals, { sword: true, archery: true, joust: true }); G.state.level = 16; });
  const downs = +(process.env.DOWNS || 2);
  for (let i = 0; i < downs; i++) { await h.key('ArrowDown'); await h.wait(80); }
  await h.key('Enter'); await h.wait(300);
  await h.shot('hall_sel');
  // press Enter to activate focused (enter button in portrait); in landscape navigate right
  const focus = await h.eval(() => 0);
  await h.key('Enter'); await h.wait(400);
  await h.shot('ladder');
  await h.key('Enter'); await h.wait(500); // Begin
  await h.shot('card');
  let guard = 0;
  while (guard++ < 40) {
    const st = await h.eval(() => ({ top: G.scenes.top() && G.scenes.top().name, active: !!G.battle.active, done: window.__tr !== undefined }));
    if (st.done) break;
    if (st.active) {
      await h.wait(600);
      if (guard === 3) await h.shot('battle');
      await h.eval((lose) => G.debug.skipBattle(!lose), lose);
      await h.wait(1200);
      continue;
    }
    await h.shot('step_' + guard);
    await h.key('Enter'); await h.wait(700);
  }
  console.log('result', JSON.stringify(await h.eval(() => ({ r: window.__tr, gold: G.state.gold, lvl: G.state.level, wins: G.state.wins, ranks: G.state.ranks, seals: G.state.seals, bag: G.state.bag, hp: G.state.hp }))));
};
