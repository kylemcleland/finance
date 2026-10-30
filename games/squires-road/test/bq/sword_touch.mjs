// Sword: every gesture through real multi-touch.
export default async function (page, h) {
  const W = await h.W(), H = await h.H();
  const R = [W * 0.78, H * 0.62], Lc = [W * 0.22, H * 0.7];
  const S = () => h.eval(() => { const s = G.battle.active && G.battle.active._s; if (!s) return null; const P = s.P; return { st: P.state, sw: P.sw && P.sw.i, sta: Math.round(P.sta), hp: Math.round(P.hp), x: Math.round(P.x), y: Math.round(P.y), tut: s.tut && s.tut.stage, phase: s.phase, stats: s.stats }; });
  const log = async (l) => console.log(l, JSON.stringify(await S()));
  // record every player state transition in-page
  await h.eval(() => {
    window.__trace = [];
    let last = '';
    const tick = () => { const a = G.battle.active; const s = a && a._s; if (s) { const k = s.P.state + (s.P.sw ? ':' + s.P.sw.i + (s.P.sw.spin ? 'spin' : '') : ''); if (k !== last) { window.__trace.push(k); last = k; } } requestAnimationFrame(tick); };
    tick();
  });
  const trace = async (lbl) => { console.log(lbl, (await h.eval(() => { const t = window.__trace; window.__trace = []; return t; })).join(' > ')); };

  await h.eval(() => { G.newGame(); });
  await h.battle('sword', { enemies: ['dummy'], arena: 'practice', title: 'Training' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'intro');
  await h.wait(500);
  await h.shot('sw_intro');
  await h.tap(...R); // skip intro
  await h.until(() => G.battle.active._s.phase === 'fight');
  await h.wait(300);
  await h.shot('sw_tut0');
  // two thumbs: walk up (L held) while tapping strikes (R)
  await h.touch.down(1, Lc[0], Lc[1]);
  await h.touch.move(1, Lc[0], Lc[1] - 25);
  await h.wait(900);
  await trace('walk');
  for (let i = 0; i < 3; i++) { await h.tap(R[0], R[1], 50, 2); await h.wait(140); }
  await h.touch.up(1);
  await h.wait(600);
  await trace('combo while moving');
  await log('after combo');
  await h.hold(R[0], R[1], 700, 2);
  await trace('hold');
  await log('after hold');
  await h.drag(R[0], R[1], R[0] + 40, R[1], 90, 2);
  await h.wait(500);
  await trace('flick');
  await log('after flick');
  // sloppy taps: drift 9px during the tap, should still strike
  await h.wait(600);
  for (let i = 0; i < 3; i++) { await h.drag(R[0], R[1], R[0] + 9, R[1] + 4, 60, 2); await h.wait(450); }
  await trace('sloppy taps');
  await h.shot('sw_tut3');
  for (let i = 0; i < 30 && !(await h.res()); i++) {
    const st = await S(); if (!st || st.phase !== 'fight') break;
    await h.tap(R[0], R[1], 50, 2); await h.wait(220);
  }
  await h.wait(1800);
  await h.shot('sw_victory');
  for (let i = 0; i < 10 && !(await h.res()); i++) { await h.tap(W / 2, H / 2); await h.wait(300); }
  console.log('dummy result', JSON.stringify(await h.res()), 'doneN', await h.eval(() => window.__doneN));
}
