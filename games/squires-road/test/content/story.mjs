// End-to-end story test: opening, rival 1, miller quest, gate, Hugh, captain, knighting + credits.
// node test/run.mjs --html test/content.html --outdir test/shots/story --script test/content/story.mjs
export default async function (page, h) {
  const log = (...a) => console.log('[story]', ...a);
  // Pump dialogs/battles until the page-side promise window.__done is set (or timeout).
  async function pump(maxMs = 60000, shots = {}) {
    const t0 = Date.now();
    let n = 0;
    while (Date.now() - t0 < maxMs) {
      const st = await h.eval(() => ({ done: !!window.__done, busy: G.ui.busy(), battle: !!(G.battle.active), scene: G.debug.scene() }));
      if (st.done && !st.busy && !st.battle) return true;
      if (shots[n]) await h.shot(shots[n]);
      n++;
      if (st.battle) { await h.wait(700); await h.eval(() => G.debug.skipBattle(true)); await h.wait(900); continue; }
      if (st.scene === 'credits') { await h.page.keyboard.down('KeyZ'); await h.wait(400); await h.page.keyboard.up('KeyZ'); continue; }
      if (st.scene && st.scene.startsWith('tourn')) { await h.key('Escape'); await h.wait(300); continue; }
      if (st.busy) await h.key('KeyZ', 60);
      await h.wait(160);
    }
    log('pump timeout');
    return false;
  }
  const run = async (code, label, shots) => {
    await h.eval(`window.__done=false; (async () => { try { ${code} } catch (e) { console.error('story test script error', e); } window.__done = true; })(); 0`);
    const ok = await pump(90000, shots);
    log(label, ok ? 'ok' : 'TIMEOUT');
  };
  await h.wait(400);
  // 1. Opening (runs from the stable onEnter)
  await h.eval(() => { window.__done = false; G.debug.newGame(); });
  await h.wait(1200);
  await h.shot('01_wake');
  await h.eval(() => { (async () => { while (!G.state.flags.trained || G.ui.busy() || (G.world.state && G.world.state.lock)) await G.U.sleep(100); window.__done = true; })(); return 0; });
  await pump(90000, { 12: '02_aldric', 30: '03_lesson' });
  log('opening flags', await h.eval(() => JSON.stringify({ t: G.state.flags.trained, w: G.state.equip.weapon, s: G.state.equip.shield })));
  await h.shot('04_after_opening');
  // 2. Rival 1 in Thornbrook
  await run(`await G.debug.warp('thornbrook', 7, 7); while (G.world.state.lock) await G.U.sleep(100);`, 'rival1', { 3: '05_cedric' });
  log('rival1', await h.eval(() => !!G.state.flags.rival1));
  await h.shot('06_thornbrook');
  // 3. Miller quest
  await run(`await G.debug.warp('millbridge', 12, 8); G.player.give('lost_arrows'); await G.content.story.miller(G.cmd, G.maps.millbridge.npcs.find(n=>n.id==='miller'));`, 'miller');
  log('bow', await h.eval(() => G.state.equip.bow), 'arrows_returned', await h.eval(() => !!G.state.flags.arrows_returned));
  // 4. Horseshoe + Rowena lesson
  await run(`await G.debug.warp('harrowfield_stable', 3, 5); G.player.give('horseshoe'); await G.content.story.tobias(G.cmd, G.maps.harrowfield_stable.npcs[0]);`, 'tobias');
  log('horse', await h.eval(() => G.state.equip.horse));
  await run(`await G.debug.warp('harrowfield_lists', 8, 4); await G.content.story.rowena(G.cmd, G.maps.harrowfield_lists.npcs[0]);`, 'rowena');
  log('lance', await h.eval(() => G.state.equip.lance), 'lesson', await h.eval(() => !!G.state.flags.tilt_lesson));
  // 5. Gate with 2 seals
  await run(`G.state.seals.sword = true; G.state.seals.archery = true; await G.debug.warp('harrowfield', 19, 5); await G.content.story.gate(G.cmd, G.maps.harrowfield.npcs[0]);`, 'gate');
  await h.shot('07_gate_open');
  log('gate_open', await h.eval(() => !!G.state.flags.gate_open));
  // 6. Hugh + captain
  await run(`await G.debug.warp('bandit_camp', 7, 6); await G.content.story.hugh(G.cmd, G.maps.bandit_camp.npcs[0]);`, 'hugh');
  log('signet', await h.eval(() => G.player.has('signet')));
  await run(`await G.debug.warp('crownhold', 23, 14); await G.content.story.captain(G.cmd, G.maps.crownhold.npcs.find(n=>n.id==='captain'));`, 'captain');
  // 7. Knighting + credits
  await run(`G.state.seals.joust = true; G.state.seals.grand = true; await G.debug.warp('crownhold_castle', 10, 5); await G.content.story.king(G.cmd, G.maps.crownhold_castle.npcs[0]);`, 'knighting', { 25: '08_knighting', 45: '09_credits', 70: '10_credits_more' });
  log('knighted', await h.eval(() => !!G.state.flags.knighted), 'look', await h.eval(() => G.state.look), 'scene', await h.eval(() => G.debug.scene()));
  await h.shot('11_after_credits');
}
