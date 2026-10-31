// In-page bot that plays sword battles. mode: 'skilled' (parries/dodges/strikes
// with timing) or 'masher' (walks in and spams strike). Prints results.
export const BOT = `
window.__startBot = (mode) => {
  const press = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code }));
  const release = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code }));
  const held = {};
  const hold = (k, on) => { if (on && !held[k]) { press(k); held[k] = 1; } else if (!on && held[k]) { release(k); held[k] = 0; } };
  const setDir = (dx, dy) => { hold('KeyA', dx < -0.35); hold('KeyD', dx > 0.35); hold('KeyW', dy < -0.35); hold('KeyS', dy > 0.35); };
  let seen = false, last = performance.now(), atkCd = 0, combo = 0, blockT = 0, dodgeQ = 0, dodgeDir = null;
  function remaining(e, P) {
    if (e.state === 'windup') {
      let r = e.wind - e.st;
      if (e.mv.dash) r += Math.max(0, Math.hypot(e.x - P.x, e.y - P.y) - 24) / e.mv.dash;
      return r;
    }
    if (e.state === 'attack' && e.mv.dash && !e.hitDone) return Math.max(0, Math.hypot(e.x - P.x, e.y - P.y) - 24) / e.mv.dash;
    return 99;
  }
  function tick(now) {
    const b = G.battle.active;
    if (!b || !b._s) {
      if (!seen) { requestAnimationFrame(tick); return; }
      setDir(0, 0); hold('KeyX', false); window.__botOn = false; return;
    }
    seen = true;
    requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000); last = now; atkCd -= dt; blockT -= dt;
    const s = b._s; const P = s.P;
    if (s.phase !== 'fight') { setDir(0, 0); hold('KeyX', false); return; }
    const es = s.enemies.filter((e) => !e.dead);
    if (!es.length) return;
    es.sort((a, c) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(c.x - P.x, c.y - P.y));
    const t = es[0];
    const d = Math.hypot(t.x - P.x, t.y - P.y);
    const reach = (P.weapon.reach || 20) + 6 + t.r;
    const toward = () => setDir((t.x - P.x) / d, (t.y - P.y) / d);
    if (mode === 'masher') {
      if (d > reach * 0.8) toward(); else setDir(0, 0);
      if (atkCd <= 0) { press('KeyZ'); release('KeyZ'); atkCd = 0.13; }
      return;
    }
    if (mode === 'hitrun') {
      // the exploit: pop in, get strikes off, back away, repeat (no blocking)
      window.__hr = window.__hr || { ph: 'in', t: 0, n: 0 };
      const hr = window.__hr; hr.t += dt;
      if (hr.ph === 'in') {
        if (d > reach * 0.8) toward();
        else { setDir(0, 0); if (atkCd <= 0) { press('KeyZ'); release('KeyZ'); atkCd = 0.18; hr.n++; } }
        if (hr.n >= 3 || hr.t > 2.5) { hr.ph = 'out'; hr.t = 0; hr.n = 0; }
      } else {
        setDir(-(t.x - P.x) / d, -(t.y - P.y) / d);
        if (hr.t > 0.9) { hr.ph = 'in'; hr.t = 0; }
      }
      return;
    }
    if (dodgeQ > 0) { dodgeQ--; if (dodgeQ === 0) { press('KeyC'); release('KeyC'); setDir(0, 0); } return; }
    let threat = null, rem = 99;
    for (const e of es) { const r = remaining(e, P); if (r < rem) { rem = r; threat = e; } }
    if (threat && rem < 1) {
      const td = Math.hypot(threat.x - P.x, threat.y - P.y);
      if (threat.mv.col === 'r') {
        if (rem < 0.2 && P.state !== 'dodge') {
          const a = Math.atan2(threat.y - P.y, threat.x - P.x) + (threat.mv.charge ? Math.PI / 2 : Math.PI * 0.85);
          setDir(Math.cos(a), Math.sin(a)); dodgeQ = 2; hold('KeyX', false);
        } else if (threat.mv.charge) setDir(0, 0);
        else { setDir(-(threat.x - P.x) / td, -(threat.y - P.y) / td); }
        return;
      }
      if (rem < 0.075 && td < 110) { hold('KeyX', true); blockT = 0.35; setDir(0, 0); return; }
      if (rem < 0.3) { setDir(0, 0); hold('KeyX', false); return; }
    }
    if (blockT > 0) return;
    hold('KeyX', false);
    if (d > reach * 0.85) { toward(); return; }
    setDir(0, 0);
    if (atkCd <= 0 && (P.state === 'free' || P.state === 'swing')) {
      press('KeyZ'); release('KeyZ');
      combo++;
      const open = t.open || t.state === 'stun';
      atkCd = combo % 3 === 0 && !open ? 0.75 : 0.16;
    }
  }
  window.__botOn = true;
  requestAnimationFrame(tick);
};
`;

const SHIELD = (L) => (L <= 2 ? null : L <= 7 ? 'buckler' : L <= 13 ? 'kite_shield' : 'heater_shield');
const WEAPON = (L) => (L <= 2 ? null : L <= 4 ? 'rusty_sword' : L <= 9 ? 'iron_sword' : 'steel_sword');
const ARMOR = (L) => (L <= 2 ? null : L <= 4 ? 'padded' : L <= 9 ? 'leather' : L <= 15 ? 'chainmail' : 'plate');

export async function fight(h, { level, enemies, mode, arena = 'pit', boss = false, timeout = 90000, shots }) {
  await h.eval(({ level, enemies, arena, boss, gear }) => {
    G.newGame();
    G.state.level = level;
    for (const id of gear) if (id) { G.player.give(id, 1); G.player.equip(id); }
    G.state.bag = {};
    G.state.hp = G.player.maxHp();
    window.__res = null;
    G.battle.start('sword', { enemies, arena, boss }).then((r) => (window.__res = r));
  }, { level, enemies, arena, boss, gear: [WEAPON(level), SHIELD(level), ARMOR(level)] });
  await h.wait(900);
  await h.eval(`window.__startBot(${JSON.stringify(mode)})`);
  const t0 = Date.now();
  let lastStats = null, n = 0;
  while (Date.now() - t0 < timeout) {
    await h.wait(500);
    const r = await h.eval(() => window.__res);
    const st = await h.eval(() => { const b = G.battle.active; return b && b._s ? { stats: b._s.stats, hp: Math.round(b._s.P.hp), ehp: b._s.enemies.map((e) => Math.max(0, Math.round(e.hp))) } : null; });
    if (st) lastStats = st;
    if (shots && n++ % shots.every === 0) await h.shot(`${shots.prefix}_${n}`);
    if (r) return { ...r, secs: Math.round((Date.now() - t0) / 1000), ...lastStats };
  }
  await h.eval(() => G.debug.skipBattle(false));
  return { timeout: true, ...lastStats };
}

export default async function (page, h) {
  await h.eval(BOT);
  const mode = process.env.MODE || 'skilled';
  const list = (process.env.FIGHTS || 'pit_tom:1').split(',');
  for (const f of list) {
    const [ids, L, arena] = f.split(':');
    const enemies = ids.split('+');
    const boss = enemies.some((id) => /bram|hugh|varek|gareth|cedric|troll/.test(id));
    const r = await fight(h, { level: +L, enemies, mode, arena: arena || 'pit', boss, shots: process.env.SHOTS ? { every: 6, prefix: `${ids}_${mode}` } : null });
    console.log(`${mode.padEnd(7)} L${L} vs ${ids.padEnd(22)} => ${JSON.stringify(r)}`);
    await h.wait(1500);
  }
}
