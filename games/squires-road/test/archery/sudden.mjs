// Force a tie after the last end to exercise sudden death; also checks debugEnd.
export default async (page, h) => {
  await h.eval(() => {
    G.player.give('longbow'); G.player.equip('longbow');
    window.__res = null;
    G.battle.start('archery', { rivals: ['grand_archer1', 'arch_knight1'], tier: Number(window.TIER || 4), title: 'Grand Tourney' }).then((r) => (window.__res = r));
  });
  await h.wait(4500);
  for (let i = 0; i < 60; i++) {
    const st = await h.eval(() => (G.battle.active ? G.battle.active._dbg.get() : null));
    if (!st) break;
    if (st.phase === 'aim') {
      await page.keyboard.down('Space'); await h.wait(1400);
      await h.eval(() => { const s = G.battle.active._dbg; s.set({ aimX: s.comp().x, aimY: 0 }); });
      await h.wait(150);
      if (st.end === 2 && st.arrowIdx === 0) await h.shot('s_final_end');
      if (st.sudden) await h.shot('s_sd_aim');
      await page.keyboard.up('Space'); await h.wait(2700);
    } else if (st.phase === 'board' || st.phase === 'sdboard') {
      if (st.phase === 'board' && st.end === 2) await h.eval(() => { const d = G.battle.active._dbg; const g = d.get(); for (const r of d.rivals()) r.total = Math.min(r.total, g.myTotal - 1); d.rivals()[0].total = g.myTotal; });
      await h.wait(3000);
      if (st.end === 2 || st.phase === 'sdboard') await h.shot('s_' + st.phase);
      await h.key('Space', 80); await h.wait(600);
      const p2 = await h.eval(() => G.battle.active && G.battle.active._dbg.get().phase);
      if (p2 === 'sdcard') await h.shot('s_sdcard');
      await h.wait(1200);
    } else if (st.phase === 'outro') { await h.wait(1500); await h.shot('s_outro'); await h.wait(4000); }
    else await h.wait(400);
  }
  await h.wait(1200);
  console.log('result', JSON.stringify(await h.eval(() => window.__res)));
};
