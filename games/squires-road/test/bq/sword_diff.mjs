// Difficulty sweep. Modes: novice (first-time phone player: reacts late or not at all, mashes),
// masher, skilled (from test/sword/bot.mjs). env MODE, FIGHTS "id+id:L:arena,...", N repeats
import { BOT, fight } from '../sword/bot.mjs';
const NOVICE = `
window.__startNovice = () => {
  const press = (c) => window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
  const release = (c) => window.dispatchEvent(new KeyboardEvent('keyup', { code: c }));
  const held = {};
  const hold = (k, on) => { if (on && !held[k]) { press(k); held[k] = 1; } else if (!on && held[k]) { release(k); held[k] = 0; } };
  const setDir = (dx, dy) => { hold('KeyA', dx < -0.35); hold('KeyD', dx > 0.35); hold('KeyW', dy < -0.35); hold('KeyS', dy > 0.35); };
  let seen = false, last = performance.now(), atkCd = 0, blockT = 0, plan = null;
  function tick(now) {
    const b = G.battle.active;
    if (!b || !b._s) { if (!seen) { requestAnimationFrame(tick); return; } setDir(0, 0); hold('KeyX', false); return; }
    seen = true; requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; atkCd -= dt; blockT -= dt;
    const s = b._s, P = s.P;
    if (s.phase !== 'fight') { setDir(0, 0); hold('KeyX', false); return; }
    const es = s.enemies.filter((e) => !e.dead); if (!es.length) return;
    es.sort((a, c) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(c.x - P.x, c.y - P.y));
    const t = es[0], d = Math.hypot(t.x - P.x, t.y - P.y), reach = (P.weapon.reach || 20) + 6 + t.r;
    // react to a windup: decide once per windup. 55% try to block at a sloppy moment, reds dodged 35%.
    const w = es.find((e) => e.state === 'windup');
    if (w && (!plan || plan.e !== w || plan.st > w.st)) {
      const red = w.mv.col === 'r';
      plan = { e: w, st: w.st, act: red ? (Math.random() < 0.35 ? 'dodge' : 'none') : (Math.random() < 0.55 ? 'block' : 'none'), lead: 0.03 + Math.random() * 0.4 };
    }
    if (plan && plan.e.state === 'windup') {
      plan.st = plan.e.st;
      const rem = plan.e.wind - plan.e.st;
      if (plan.act === 'block' && rem < plan.lead) { hold('KeyX', true); blockT = 0.45; setDir(0, 0); return; }
      if (plan.act === 'dodge' && rem < 0.25) { const a = Math.atan2(plan.e.y - P.y, plan.e.x - P.x) + Math.PI / 2; setDir(Math.cos(a), Math.sin(a)); press('KeyC'); release('KeyC'); plan.act = 'done'; return; }
    }
    if (blockT > 0) return;
    hold('KeyX', false);
    if (d > reach * 0.8) { setDir((t.x - P.x) / d, (t.y - P.y) / d); return; }
    setDir(0, 0);
    if (atkCd <= 0) { press('KeyZ'); release('KeyZ'); atkCd = 0.18 + Math.random() * 0.25; }
  }
  requestAnimationFrame(tick);
};`;
export default async function (page, h) {
  await h.eval(BOT); await h.eval(NOVICE);
  const mode = process.env.MODE || 'novice';
  const N = Number(process.env.N || 3);
  const list = (process.env.FIGHTS || 'pit_tom:2').split(',');
  if (mode === 'novice') await h.eval(() => { window.__startBot = () => window.__startNovice(); });
  for (const f of list) {
    const [ids, L, arena] = f.split(':');
    const enemies = ids.split('+');
    const boss = enemies.some((id) => /bram|hugh|varek|gareth|cedric[23]|troll/.test(id));
    let wins = 0; const hps = [], secs = [];
    for (let i = 0; i < N; i++) {
      const r = await fight(h, { level: +L, enemies, mode, arena: arena || 'pit', boss, timeout: 120000 });
      if (r.won) wins++;
      hps.push(r.won ? r.hp : -(r.ehp || []).reduce((a, b) => a + b, 0)); secs.push(r.secs);
      await h.wait(1200);
    }
    console.log(`${mode.padEnd(7)} L${L} ${ids.padEnd(20)} wins ${wins}/${N}  hpLeft(+)/foeHpLeft(-) ${hps.join(',')}  secs ${secs.join(',')}`);
  }
}
