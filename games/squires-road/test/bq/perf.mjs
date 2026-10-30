// Per-frame cost of update+draw for each battle in a busy moment (ms: median / p95 / max).
import { BOT } from '../sword/bot.mjs';
export default async function (page, h) {
  await h.eval(BOT);
  await h.eval(() => {
    const su = G.scenes.update.bind(G.scenes), sd = G.scenes.draw.bind(G.scenes);
    window.__ft = [];
    let a = 0;
    G.scenes.update = (dt) => { a = performance.now(); su(dt); };
    G.scenes.draw = (c) => { sd(c); if (G.battle.active) window.__ft.push(performance.now() - a); };
  });
  const stat = async (lbl) => {
    const f = await h.eval(() => { const f = window.__ft.slice().sort((x, y) => x - y); window.__ft = []; return f; });
    const q = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))].toFixed(2);
    console.log(lbl.padEnd(14), 'frames', f.length, 'median', q(0.5), 'p95', q(0.95), 'max', f[f.length - 1].toFixed(2));
  };
  await h.eval(() => { G.newGame(); G.state.level = 6; for (const id of ['iron_sword', 'practice_lance', 'old_nag', 'short_bow']) { G.player.give(id); G.player.equip(id); } });
  await h.battle('sword', { enemies: ['wolf', 'wolf', 'bandit', 'boar'], arena: 'pit' });
  await h.until(() => G.battle.active && G.battle.active._s.phase === 'fight', 8000);
  await h.eval(() => { G.battle.active._s.P.hp = G.battle.active._s.P.maxHp = 9999; window.__ft = []; window.__startBot('skilled'); });
  await h.wait(8000); await stat('sword pack');
  await h.eval(() => G.debug.skipBattle(true)); await h.until(() => window.__res, 6000);
  await h.battle('joust', { opponent: 'joust_ned' });
  await h.until(() => G.battle.active && G.battle.active.dbg && G.battle.active.dbg().phase === 'charge', 9000);
  await h.eval(() => { window.__ft = []; });
  await h.wait(6000); await stat('joust charge');
  await h.eval(() => G.debug.skipBattle(true)); await h.until(() => window.__res, 6000);
  await h.battle('archery', { rivals: ['arch_tam', 'arch_lia', 'arch_bo'], tier: 4 });
  await h.until(() => G.battle.active && G.battle.active._dbg && G.battle.active._dbg.get().phase === 'aim', 9000);
  await h.eval(() => { window.__ft = []; });
  const W = await h.W(), H = await h.H();
  await h.touch.down(2, W * 0.8, H * 0.6); await h.wait(5000); await h.touch.up(2); await h.wait(1500);
  await stat('archery aim');
  await h.eval(() => G.debug.skipBattle(true)); await h.until(() => window.__res, 6000); await h.wait(500);
}
