// Checks L-drag aim, arrow-key aim, tap-doesn't-waste-arrow, debugEnd.
export default async (page, h) => {
  await h.eval(() => { window.__res = null; G.battle.start('archery', { rivals: ['arch_tam'], tier: 1, boss: true }).then((r) => (window.__res = r)); });
  await h.wait(4500);
  const W = await h.W(), H = await h.H();
  const get = () => h.eval(() => G.battle.active._dbg.get());
  const a0 = await get();
  await h.drag(W * 0.25, H * 0.6, W * 0.25 + 20, H * 0.6 - 10, 300);
  const a1 = await get();
  console.log('drag aim', a0.aimX.toFixed(3), a0.aimY.toFixed(3), '->', a1.aimX.toFixed(3), a1.aimY.toFixed(3));
  await h.walk('ArrowLeft', 400);
  const a2 = await get();
  console.log('key aim', a2.aimX.toFixed(3));
  // quick tap on right: should not loose an arrow (power < 0.08 cancels) unless held
  await h.tap(W * 0.75, H * 0.5);
  await h.wait(300);
  console.log('after tap phase', (await get()).phase, 'music', await h.eval(() => G.music.current));
  // touch draw: hold right with mouse, drag left simultaneously isn't possible with one mouse; just hold
  await h.hold(W * 0.75, H * 0.5, 1200);
  await h.wait(200);
  console.log('after hold phase', (await get()).phase);
  await h.wait(2500);
  await h.eval(() => G.debug.skipBattle(true));
  await h.wait(1500);
  console.log('result', JSON.stringify(await h.eval(() => window.__res)), 'scene', await h.eval(() => G.debug.scene()));
};
