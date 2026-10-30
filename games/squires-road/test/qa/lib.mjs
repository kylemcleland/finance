import { writeFileSync, readFileSync } from 'node:fs';
// QA driver helpers: real keyboard/touch input against the overworld, with page-side pathfinding.
export function mk(page, h, tag = 'qa') {
  const log = (...a) => console.log(`[${tag}]`, ...a);
  const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
  let shotN = 0;
  const shot = (name) => h.shot(String(++shotN).padStart(3, '0') + '_' + name);

  const st = () => h.eval(() => {
    const S = G.world && G.world.state;
    return {
      scene: G.debug.scene(), busy: G.ui.busy(), battle: !!G.battle.active, lock: S ? S.lock : 0,
      map: G.state.map, x: S && S.player.x, y: S && S.player.y, moving: S && S.player.moving, dir: S && S.player.dir,
      hp: G.state.hp, gold: G.state.gold, lvl: G.state.level, xp: G.state.xp,
      text: (() => { try { const d = G.ui._dlg || null; return d ? String(d.text || '') : ''; } catch (e) { return ''; } })(),
    };
  });

  // Pump dialogs / battles until the world is idle. opts.win: battle outcome; opts.onTourney(stateFn)
  async function pump(opts = {}) {
    const win = opts.win !== undefined ? opts.win : true;
    const t0 = Date.now();
    let idle = 0, battles = 0;
    while (Date.now() - t0 < (opts.maxMs || 60000)) {
      const s = await st();
      if (s.battle) {
        battles++;
        await h.wait(opts.battleWait || 500);
        if (opts.battleShot && battles === 1) await shot(opts.battleShot);
        const w = typeof win === 'function' ? win(battles) : win;
        await h.eval((w) => G.debug.skipBattle(w), w);
        await h.wait(900); idle = 0; continue;
      }
      if (s.busy) { await h.key('KeyZ', 50); await h.wait(140); idle = 0; continue; }
      if (s.scene === 'credits') { if (opts.onCredits) await opts.onCredits(); await page.keyboard.down('KeyZ'); await h.wait(500); await page.keyboard.up('KeyZ'); idle = 0; continue; }
      if (s.scene === 'tournament') { if (opts.onTourney) { await opts.onTourney(); idle = 0; continue; } return 'tournament'; }
      if (s.scene && s.scene !== 'world') { if (opts.onScene) { await opts.onScene(s.scene); idle = 0; continue; } return s.scene; }
      if (s.lock > 0) { await h.wait(150); idle = 0; continue; }
      if (++idle >= 3) return 'idle';
      await h.wait(120);
    }
    log('pump timeout');
    return 'timeout';
  }

  // Path from the player to (tx,ty) (or a tile next to it if blocked). Returns array of dirs, or null.
  const plan = (tx, ty, avoidGrass) => h.eval(([tx, ty, avoidGrass]) => {
    const S = G.world.state; const p = S.player;
    const solid = (x, y) => x < 0 || y < 0 || x >= S.w || y >= S.h || G.tiles.solid(S.rows[y][x]);
    const occ = (x, y) => S.npcs.some((n) => n.visible && n.x === x && n.y === y) || S.objects.some((o) => o.type === 'chest' && o.x === x && o.y === y);
    const warp = (x, y) => (S.map.warps || []).some((w) => w.x === x && w.y === y);
    const goalBlocked = solid(tx, ty) || occ(tx, ty);
    const goals = new Set();
    if (!goalBlocked) goals.add(tx + ',' + ty);
    else for (const [dx, dy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) goals.add((tx + dx) + ',' + (ty + dy));
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
    const prev = new Map(); const start = p.x + ',' + p.y; prev.set(start, null);
    const q = [[p.x, p.y]]; let found = null;
    while (q.length) {
      const [x, y] = q.shift(); const k = x + ',' + y;
      if (goals.has(k)) { found = k; break; }
      for (const d in D) {
        const nx = x + D[d][0], ny = y + D[d][1], nk = nx + ',' + ny;
        if (prev.has(nk) || solid(nx, ny) || occ(nx, ny)) continue;
        if (warp(nx, ny) && !goals.has(nk)) continue;
        if (avoidGrass && S.rows[ny][nx] === ',' && !goals.has(nk)) { /* allow but deprioritise: skip */ continue; }
        prev.set(nk, [k, d]); q.push([nx, ny]);
      }
    }
    if (!found) return null;
    const dirs = []; let k = found;
    while (prev.get(k)) { const [pk, d] = prev.get(k); dirs.unshift(d); k = pk; }
    if (goalBlocked) { const [fx, fy] = found.split(',').map(Number); dirs.push(tx > fx ? 'right' : tx < fx ? 'left' : ty > fy ? 'down' : 'up'); dirs.face = true; }
    return { dirs, face: goalBlocked };
  }, [tx, ty, avoidGrass]);

  // Walk with arrow keys. Interruptions (battles, trainers, dialogs) get pumped, then we re-plan.
  async function walkTo(tx, ty, opts = {}) {
    const startMap = (await st()).map;
    for (let attempt = 0; attempt < 40; attempt++) {
      let s = await st();
      if (s.map !== startMap) return s;
      let pl = await plan(tx, ty, opts.avoidGrass);
      if (!pl && opts.avoidGrass) pl = await plan(tx, ty, false);
      for (let r = 0; r < 4 && !pl; r++) { await h.wait(800); pl = await plan(tx, ty, false); } // wandering NPCs move
      if (!pl) { log('no path to', tx, ty, 'from', s.x, s.y, 'on', s.map); return s; }
      const { dirs, face } = pl;
      if (!dirs.length) return s;
      let interrupted = false;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        const last = i === dirs.length - 1;
        if (face && last) { // just turn to face
          s = await st();
          if (s.dir !== d) { await h.key(KEY[d], 60); await h.wait(120); }
          return await st();
        }
        const before = await st();
        await page.keyboard.down(KEY[d]);
        let moved = false;
        for (let k = 0; k < 60; k++) {
          await h.wait(25);
          const n = await st();
          if (n.x !== before.x || n.y !== before.y || n.map !== before.map) { moved = true; break; }
          if (n.lock > 0 || n.busy || n.battle) break;
        }
        await page.keyboard.up(KEY[d]);
        // let the step finish
        for (let k = 0; k < 20; k++) { const n = await st(); if (!n.moving) break; await h.wait(20); }
        await h.wait(30);
        const n = await st();
        if (n.map !== before.map) return n;
        if (n.lock > 0 || n.busy || n.battle || !moved) {
          if (opts.onInterrupt) await opts.onInterrupt(n);
          await pump(opts.pump || {});
          interrupted = true; break;
        }
      }
      if (!interrupted) return await st();
    }
    log('walkTo gave up', tx, ty);
    return await st();
  }

  async function interact() { await h.key('Enter', 60); await h.wait(250); }
  // Walk next to something, face it, press Enter, pump.
  async function talk(tx, ty, opts = {}) {
    await walkTo(tx, ty, opts);
    await interact();
    return pump(opts.pump || opts);
  }
  // Walk onto a warp tile (door) and wait for the map change.
  async function enter(tx, ty, toMap, opts = {}) {
    const s0 = await st();
    await walkTo(tx, ty, opts);
    let s = await st();
    for (let i = 0; i < 40 && s.map === s0.map; i++) { await h.wait(100); s = await st(); }
    await h.wait(350);
    await pump(opts.pump || {});
    s = await st();
    if (toMap && s.map !== toMap) log('!! expected map', toMap, 'got', s.map, s.x, s.y);
    return s;
  }
  async function econ(label) {
    const e = await h.eval(() => ({ lvl: G.state.level, xp: G.state.xp, gold: G.state.gold, hp: G.state.hp, max: G.player.maxHp(), equip: G.state.equip, bag: G.state.bag, ranks: G.state.ranks, seals: G.state.seals }));
    log('ECON', label, `L${e.lvl} xp${e.xp} ${e.gold}g hp${e.hp}/${e.max}`, JSON.stringify(e.equip), JSON.stringify(e.bag), 'ranks', JSON.stringify(e.ranks));
    return e;
  }
  // Run a cup in the current hall scene. idx: cup index in the list. Uses taps on the cup row + Enter button.
  async function cup(idx, opts = {}) {
    await h.wait(400);
    // keyboard: move focus down to the cup and pick it, then Enter on the enter button
    if (idx >= 0) {
      // touch: tap the cup row (portrait layout), which also focuses the Enter button
      await h.tap(100, 70 + 34 * idx); await h.wait(300);
      if (opts.shot) await shot(opts.shot + '_sel');
      await h.key('Enter'); await h.wait(500);
    }
    if (opts.shot) await shot(opts.shot + '_ladder');
    let n = 0, battles = 0, sawReward = false;
    while (n++ < 80) {
      const s = await st();
      if (s.battle) {
        battles++;
        await h.wait(600);
        const w = typeof opts.win === 'function' ? opts.win(battles) : opts.win !== undefined ? opts.win : true;
        await h.eval((w) => G.debug.skipBattle(w), w);
        await h.wait(1200); continue;
      }
      if (s.scene !== 'tournament') break;
      const mode = await h.eval(() => { const t = G.scenes.top(); return t && t._mode ? t._mode : null; });
      if (opts.shot && n === 3) await shot(opts.shot + '_card');
      await h.key('Enter'); await h.wait(600);
      if (n > 4 && opts.shot && !sawReward) { sawReward = true; }
    }
    return battles;
  }
  const save = (name) => h.eval(() => JSON.stringify(G.state)).then((j) => { writeFileSync(new URL('./state_' + name + '.json', import.meta.url), j); });
  async function load(name) {
    const j = readFileSync(new URL('./state_' + name + '.json', import.meta.url), 'utf8');
    await h.eval((j) => { localStorage.setItem('squires_road_save_v1', j); G.load(); G.world.start(); }, j);
    await h.wait(800);
    await pump();
  }
  return { cup, save, load, log, st, pump, plan, walkTo, interact, talk, enter, shot, econ, KEY };
}
