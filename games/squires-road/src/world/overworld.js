// World: overworld scene, grid movement, NPCs, trainers, encounters, warps,
// script commands and HUD (DESIGN.md §8, §12).
(() => {
  const TS = 16;
  const U = G.U;
  const DX = { up: 0, down: 0, left: -1, right: 1 };
  const DY = { up: -1, down: 1, left: 0, right: 0 };
  const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
  const PATHDIR = { U: 'up', D: 'down', L: 'left', R: 'right', u: 'up', d: 'down', l: 'left', r: 'right' };
  const DIR4 = ['up', 'down', 'left', 'right'];
  const WALK_SPEED = 5, RUN_SPEED = 8, NPC_SPEED = 3.6, SCRIPT_SPEED = 4.5;

  const W = (G.world = G.world || {});
  let S = null;           // runtime state of the current overworld
  const gfxCache = {};    // mapId -> built tile gfx
  let hiddenOverride = {}; // npcId -> bool (showNpc), reset per map entry

  // ------------------------------------------------------------------ helpers
  const safe = (fn, fallback) => { try { return fn(); } catch (e) { console.error('world: callback error', e); return fallback; } };
  function fallbackMap() {
    return {
      id: '__fallback', name: 'Nowhere', outdoor: true, music: 'route',
      tiles: ['TTTTTTTTT', 'T.......T', 'T.......T', 'T.......T', 'T.......T', 'TTTTTTTTT'],
    };
  }
  function getMap(id) {
    let m = G.maps[id];
    if (!m || !Array.isArray(m.tiles) || !m.tiles.length) {
      if (id !== '__test') console.warn('world: missing map', id, '- falling back');
      m = G.maps.__test || fallbackMap();
    }
    if (!m.id) m.id = id;
    return m;
  }
  function gfxFor(map) {
    let g = gfxCache[map.id];
    if (!g || g.map !== map || g.src !== map.tiles) {
      g = G.tiles.buildMap(map);
      g.src = map.tiles;
      gfxCache[map.id] = g;
    }
    return g;
  }

  // Pre-rendered character frames per entity (avoids per-frame JSON keys in G.chars).
  function lookFrames(look) {
    const fr = {};
    for (const d of DIR4) fr[d] = [null, null, null];
    return { look, fr };
  }
  function charFrame(e, dir, f) {
    const lf = e.lf;
    let c = lf.fr[dir][f];
    if (!c) { c = G.chars.frame(lf.look, dir, f); lf.fr[dir][f] = c; }
    return c;
  }
  let shadowSprite = null;
  function getShadow() {
    if (shadowSprite) return shadowSprite;
    let x;
    [shadowSprite, x] = G.gfx.makeCanvas(14, 5);
    x.fillStyle = 'rgba(0,0,0,0.28)';
    x.beginPath(); x.ellipse(7, 2.5, 6, 2.2, 0, 0, Math.PI * 2); x.fill();
    return shadowSprite;
  }
  let bubbleSprite = null;
  function getBubble() {
    if (bubbleSprite) return bubbleSprite;
    let x;
    [bubbleSprite, x] = G.gfx.makeCanvas(13, 15);
    x.fillStyle = '#2b1d14';
    x.fillRect(1, 0, 11, 12); x.fillRect(0, 1, 13, 10); x.fillRect(5, 12, 3, 2); x.fillRect(6, 14, 1, 1);
    x.fillStyle = '#ffffff';
    x.fillRect(2, 1, 9, 10); x.fillRect(1, 2, 11, 8); x.fillRect(6, 11, 1, 2);
    x.fillStyle = '#d6453d';
    x.fillRect(5, 2, 3, 5); x.fillRect(5, 8, 3, 2);
    return bubbleSprite;
  }
  let sparkleSprites = null;
  function getSparkles() {
    if (sparkleSprites) return sparkleSprites;
    sparkleSprites = [];
    for (let f = 0; f < 3; f++) {
      const [c, x] = G.gfx.makeCanvas(TS, TS);
      // a small item pouch with a twinkle
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(4, 13, 8, 2);
      x.fillStyle = '#2b1d14'; x.fillRect(4, 7, 8, 7); x.fillRect(5, 6, 6, 1);
      x.fillStyle = '#d6453d'; x.fillRect(5, 8, 6, 5);
      x.fillStyle = '#f08070'; x.fillRect(5, 8, 2, 2);
      x.fillStyle = '#f2c14e'; x.fillRect(5, 7, 6, 1);
      x.fillStyle = '#ffffff';
      const sx = [11, 3, 9][f], sy = [3, 5, 1][f];
      x.fillRect(sx, sy - 1, 1, 3); x.fillRect(sx - 1, sy, 3, 1);
      sparkleSprites.push(c);
    }
    return sparkleSprites;
  }
  const chestSprites = {};
  function getChest(open) {
    const k = open ? 1 : 0;
    if (chestSprites[k]) return chestSprites[k];
    const [c, x] = G.gfx.makeCanvas(TS, TS);
    const px = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    px('rgba(0,0,0,0.25)', 2, 14, 13, 2);
    px('#2b1d14', 1, 4, 14, 11);
    px('#a8622e', 2, 9, 12, 5);
    px('#7a4420', 2, 13, 12, 1);
    if (!open) {
      px('#c47a3a', 2, 5, 12, 4);
      px('#e0a060', 2, 5, 12, 1);
      px('#2b1d14', 1, 8, 14, 1);
      px('#f2c14e', 7, 7, 2, 3); px('#8a6a1a', 7, 9, 2, 1);
    } else {
      px('#2b1d14', 1, 1, 14, 5);
      px('#7a4420', 2, 2, 12, 3);
      px('#3a2010', 2, 5, 12, 4);
      px('#f2c14e', 4, 6, 2, 1); px('#fff0a0', 8, 6, 1, 1);
    }
    px('#f2c14e', 2, 9, 1, 5); px('#f2c14e', 13, 9, 1, 5);
    chestSprites[k] = c;
    return c;
  }

  let forestPat = null;
  function forestPattern(ctx) {
    if (forestPat) return forestPat;
    const [c, x] = G.gfx.makeCanvas(32, 32);
    x.fillStyle = '#2f6a34'; x.fillRect(0, 0, 32, 32);
    const mc = { tiles: ['tTtTtT', 'TtTtTt', 'tTtTtT', 'TtTtTt', 'tTtTtT', 'TtTtTt'], tx: 2, ty: 2, outdoor: true };
    const tile = (ch, px, py, tx, ty) => { mc.tx = tx; mc.ty = ty; G.tiles.draw(x, ch, px, py, mc); };
    tile('t', 0, -8, 2, 2); tile('T', 16, -4, 1, 2); tile('t', 0, 8, 2, 4); tile('T', 16, 12, 3, 2); tile('t', 0, 24, 2, 2); tile('T', 16, 28, 1, 2);
    x.fillStyle = 'rgba(10,30,10,0.3)'; x.fillRect(0, 0, 32, 32);
    forestPat = ctx.createPattern(c, 'repeat');
    return forestPat;
  }

  // ------------------------------------------------------------------ particles (pooled)
  const PN = 64;
  const parts = [];
  for (let i = 0; i < PN; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, col: '#fff', g: 0, s: 1 });
  function spawn(x, y, vx, vy, life, col, g = 0, s = 1) {
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (p.on) continue;
      p.on = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = life; p.max = life; p.col = col; p.g = g; p.s = s;
      return;
    }
  }

  // ------------------------------------------------------------------ entities
  function makeEnt(look, x, y, dir) {
    return {
      lf: lookFrames(look), x, y, fx: x, fy: y, px: x * TS, py: y * TS, dir: dir || 'down',
      moving: false, t: 0, dur: 0.2, parity: 0, resolve: null, visible: true, bubble: 0, hop: 0,
    };
  }
  function startMove(e, dir, speed) {
    e.dir = dir;
    e.fx = e.x; e.fy = e.y;
    e.x += DX[dir]; e.y += DY[dir];
    e.t = 0; e.dur = 1 / speed; e.moving = true;
    e.parity ^= 1;
  }
  function updateEnt(e, dt) {
    if (!e.moving) return false;
    e.t += dt;
    const k = Math.min(1, e.t / e.dur);
    e.px = (e.fx + (e.x - e.fx) * k) * TS;
    e.py = (e.fy + (e.y - e.fy) * k) * TS;
    if (k >= 1) {
      e.moving = false;
      e.fx = e.x; e.fy = e.y;
      if (e.resolve) { const r = e.resolve; e.resolve = null; r(); }
      return true;
    }
    return false;
  }
  function entFrame(e) {
    if (!e.moving) return 0;
    const k = e.t / e.dur;
    return k < 0.5 ? (e.parity ? 1 : 2) : 0;
  }
  function moveAwait(e, dir, speed) {
    return new Promise((res) => {
      startMove(e, dir, speed);
      e.resolve = res;
    });
  }
  function place(e, x, y) { e.x = e.fx = x; e.y = e.fy = y; e.px = x * TS; e.py = y * TS; e.moving = false; }

  // ------------------------------------------------------------------ map queries
  function inBounds(x, y) { return x >= 0 && y >= 0 && x < S.w && y < S.h; }
  function tileAt(x, y) { return inBounds(x, y) ? S.rows[y][x] || '.' : '"'; }
  function tileSolid(x, y) {
    if (!inBounds(x, y)) return true;
    return G.tiles.solid(S.rows[y][x] || '.');
  }
  function objAt(x, y) {
    for (let i = 0; i < S.objects.length; i++) { const o = S.objects[i]; if (o.x === x && o.y === y && !o.gone) return o; }
    return null;
  }
  function npcAt(x, y, except) {
    for (let i = 0; i < S.npcs.length; i++) {
      const n = S.npcs[i];
      if (!n.visible || n === except) continue;
      if ((n.x === x && n.y === y) || (n.moving && n.fx === x && n.fy === y)) return n;
    }
    return null;
  }
  function signAt(x, y) {
    const s = S.map.signs;
    if (!s) return null;
    for (let i = 0; i < s.length; i++) if (s[i].x === x && s[i].y === y) return s[i];
    return null;
  }
  function warpAt(x, y) {
    const w = S.map.warps;
    if (!w) return null;
    for (let i = 0; i < w.length; i++) if (w[i].x === x && w[i].y === y) return w[i];
    return null;
  }
  function blocked(x, y, forNpc) {
    if (tileSolid(x, y)) return true;
    const o = objAt(x, y);
    if (o && o.type === 'chest') return true;
    if (o && forNpc) return true;
    if (npcAt(x, y, forNpc)) return true;
    if (forNpc) {
      const p = S.player;
      if ((p.x === x && p.y === y) || (p.fx === x && p.fy === y)) return true;
    }
    return false;
  }
  const flagOf = (o) => 'chest_' + S.map.id + '_' + (o.id != null ? o.id : o.x + '_' + o.y);

  // ------------------------------------------------------------------ map entry
  function enterMap(mapId, x, y, dir) {
    const map = getMap(mapId);
    hiddenOverride = {};
    S.map = map;
    S.mapGfx = gfxFor(map);
    S.rows = map.tiles; S.w = S.mapGfx.w; S.h = S.mapGfx.h;
    S.objects = (map.objects || []).map((o) => Object.assign({ gone: false, open: false, bounce: 0 }, o));
    S.npcs = (map.npcs || []).map((d) => makeNpc(d));
    const p = S.player;
    if (!inBounds(x, y) || (tileSolid(x, y) && !(map.warps || []).some((w) => w.x === x && w.y === y))) {
      const f = findOpen(x | 0, y | 0);
      if (!inBounds(x, y)) console.warn('world: start position out of bounds', mapId, x, y);
      x = f.x; y = f.y;
    }
    place(p, x, y);
    p.dir = dir || p.dir || 'down';
    S.walking = false; S.turnT = 0;
    G.state.map = map.id; G.state.x = x; G.state.y = y; G.state.dir = p.dir;
    S.noEnc = 4;
    S.rustle.length = 0;
    W.refresh();
    snapCamera();
    if (map.music) G.music.play(map.music);
    if (map.outdoor !== false && map.name && map.name !== S.lastOutdoorName) {
      S.lastOutdoorName = map.name;
      S.banner = { text: map.name, t: 0 };
    }
  }
  function findOpen(x, y) {
    for (let r = 0; r < 30; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx, ny = y + dy;
        if (inBounds(nx, ny) && !tileSolid(nx, ny) && !objAt(nx, ny) && !warpAt(nx, ny)) return { x: nx, y: ny };
      }
    }
    return { x: 0, y: 0 };
  }
  function makeNpc(d) {
    const n = Object.create(d);
    const e = makeEnt(d.look || 'villagerM', d.x, d.y, d.dir || 'down');
    Object.assign(n, e);
    n.def = d; n.home = { x: d.x, y: d.y }; n.timer = U.rand(0.8, 3); n.engaged = false; n.scripted = 0;
    return n;
  }
  async function runOnEnter() {
    const m = S.map;
    if (m && typeof m.onEnter === 'function') await runScript(m.onEnter);
  }

  // ------------------------------------------------------------------ scripts
  async function runScript(fn, ...args) {
    if (typeof fn !== 'function') return;
    const st = S;
    st.lock++;
    try { await fn(G.cmd, ...args); } catch (e) { console.error('world: script error', e); }
    finally {
      st.lock = Math.max(0, st.lock - 1);
      if (S === st) W.refresh();
    }
  }
  const locked = () => !S || S.lock > 0 || G.ui.busy();

  // ------------------------------------------------------------------ warps & edges
  async function doWarp(mapId, x, y, dir, o = {}) {
    if (!S) {
      Object.assign(G.state, { map: mapId, x, y, dir: dir || G.state.dir });
      W.start();
      return;
    }
    const st = S;
    st.lock++;
    try {
      if (!o.silent) G.sfx.play('door');
      st.player.moving = false;
      await G.scenes.fade(() => {
        enterMap(mapId, x, y, dir || st.player.dir);
        G.save();
      }, { ms: o.ms || 220 });
    } finally { st.lock = Math.max(0, st.lock - 1); }
    await runOnEnter();
  }
  function edgeFor(dir) {
    const e = S.map.edges;
    if (!e) return null;
    const side = dir === 'up' ? 'north' : dir === 'down' ? 'south' : dir === 'left' ? 'west' : 'east';
    const ed = e[side];
    if (!ed || !ed.to || !G.maps[ed.to]) return null;
    const tm = G.maps[ed.to];
    const th = tm.tiles.length, tw = tm.tiles[0].length;
    const p = S.player, off = ed.offset || 0;
    let tx = p.x, ty = p.y;
    if (side === 'north') { tx = p.x + off; ty = th - 1; }
    if (side === 'south') { tx = p.x + off; ty = 0; }
    if (side === 'west') { tx = tw - 1; ty = p.y + off; }
    if (side === 'east') { tx = 0; ty = p.y + off; }
    return { to: ed.to, x: U.clamp(tx, 0, tw - 1), y: U.clamp(ty, 0, th - 1) };
  }

  // ------------------------------------------------------------------ interaction
  function facedTile() {
    const p = S.player;
    return { x: p.x + DX[p.dir], y: p.y + DY[p.dir] };
  }
  async function interactAt(x, y) {
    const p = S.player;
    let n = npcAt(x, y);
    // talk across counters
    if (!n && G.tiles.defs[tileAt(x, y)] && G.tiles.defs[tileAt(x, y)].counter) n = npcAt(x + DX[p.dir], y + DY[p.dir]);
    if (n) return talkTo(n);
    const s = signAt(x, y);
    if (s) { G.sfx.play('select'); return runScript(async (c) => { await c.say(s.text); }); }
    const o = objAt(x, y);
    if (o) return openObject(o);
    const w = warpAt(x, y);
    if (w && G.tiles.defs[tileAt(x, y)] && G.tiles.defs[tileAt(x, y)].door) return doWarp(w.to, w.tx, w.ty, w.dir);
    if (tileAt(x, y) === 'S') return runScript(async (c) => { await c.say('The sign is too weathered to read.'); });
    return false;
  }
  async function talkTo(n) {
    const p = S.player;
    S.lock++;
    try {
      while (n.moving) await U.sleep(16);
      const dx = p.x - n.x, dy = p.y - n.y;
      n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (n.trainer && !(n.trainer.flag && G.state.flags[n.trainer.flag])) {
        await trainerBattle(n);
      } else if (typeof n.script === 'function') {
        await runScript(n.script, n);
      } else if (n.trainer) {
        await runScript(async (c) => c.say(n.trainer.after || n.trainer.win || '...', { name: n.name, look: n.look }));
      } else if (n.text) {
        await runScript(async (c) => c.say(n.text, { name: n.name, look: n.look }));
      }
    } finally { S.lock = Math.max(0, S.lock - 1); W.refresh(); }
  }
  async function openObject(o) {
    const fl = flagOf(o);
    if (o.type === 'item') return pickup(o);
    if (o.type !== 'chest') return;
    await runScript(async (c) => {
      if (G.state.flags[fl]) { await c.say('The chest is empty.'); return; }
      G.sfx.play('door');
      o.bounce = 1;
      await c.wait(250);
      G.state.flags[fl] = true;
      await grant(c, o);
    });
  }
  async function grant(c, o) {
    const qty = o.qty || 1;
    if (o.gold || o.item === 'gold') {
      const g = o.gold || qty;
      G.player.addGold(g);
      await c.say(`Found ${g} gold!`);
    } else if (o.item) {
      const it = G.items[o.item];
      c.give(o.item, qty, true);
      G.sfx.play('coin');
      await c.say(`Found ${qty > 1 ? qty + '× ' : ''}${it ? it.name : o.item}!`);
    }
    G.save();
  }
  async function pickup(o) {
    const fl = flagOf(o);
    if (G.state.flags[fl] || o.gone) return;
    o.gone = true;
    G.state.flags[fl] = true;
    for (let i = 0; i < 8; i++) spawn(o.x * TS + 8, o.y * TS + 8, U.rand(-30, 30), U.rand(-50, -10), 0.5, '#fff6b0', 60, 1);
    await runScript(async (c) => grant(c, o));
  }

  // ------------------------------------------------------------------ trainers
  function trainerSees(n) {
    const tr = n.trainer;
    if (!tr || !n.visible || n.moving || n.engaged || (tr.flag && G.state.flags[tr.flag])) return 0;
    const p = S.player, sight = tr.sight != null ? tr.sight : 4;
    let x = n.x, y = n.y;
    for (let i = 1; i <= sight; i++) {
      x += DX[n.dir]; y += DY[n.dir];
      if (p.x === x && p.y === y) return i;
      if (tileSolid(x, y) || npcAt(x, y) || (objAt(x, y) && objAt(x, y).type === 'chest')) return 0;
    }
    return 0;
  }
  function checkTrainers() {
    for (let i = 0; i < S.npcs.length; i++) {
      const n = S.npcs[i];
      if (!n.trainer) continue;
      const d = trainerSees(n);
      if (d) { spotted(n, d); return true; }
      if (n.engaged && n.engagedCooldown && !inLine(n)) { n.engaged = false; n.engagedCooldown = false; }
    }
    return false;
  }
  function inLine(n) {
    const p = S.player;
    const dx = p.x - n.x, dy = p.y - n.y;
    const sight = n.trainer.sight != null ? n.trainer.sight : 4;
    return (dx === 0 && Math.sign(dy) === DY[n.dir] && Math.abs(dy) <= sight) || (dy === 0 && Math.sign(dx) === DX[n.dir] && Math.abs(dx) <= sight);
  }
  async function spotted(n, dist) {
    n.engaged = true;
    S.lock++;
    try {
      G.sfx.play('alert');
      n.bubble = 0.001;
      await U.sleep(750);
      n.bubble = 0;
      for (let i = 1; i < dist; i++) await moveAwait(n, n.dir, SCRIPT_SPEED);
      S.player.dir = OPP[n.dir]; G.state.dir = S.player.dir;
      await trainerBattle(n);
    } catch (e) { console.error('world: trainer error', e); }
    finally { S.lock = Math.max(0, S.lock - 1); W.refresh(); }
  }
  async function trainerBattle(n) {
    const tr = n.trainer;
    const c = G.cmd;
    const who = { name: n.name, look: n.look };
    const b = tr.battle || { type: 'sword', opts: {} };
    const type = b.type || 'sword';
    const opts = Object.assign({ title: n.name || 'Challenger' }, b.opts || {});
    n.engaged = true;
    S.lock++;
    try {
      if (type === 'joust' && (!G.state.equip.lance || !G.state.equip.horse)) {
        await c.say(tr.needGear || 'Come back when you have a horse and a lance, squire!', who);
        n.engagedCooldown = true;
        return;
      }
      if (tr.intro) await c.say(tr.intro, who);
      const res = (await G.battle.start(type, opts)) || { won: false };
      if (type === 'sword' && res.hp != null && !res.fled) G.player.setHp(res.hp);
      if (res.won && !res.fled) {
        if (tr.flag) c.setFlag(tr.flag);
        if (tr.win) await c.say(tr.win, who);
        if (tr.xp || tr.gold) {
          if (tr.xp) c.xp(tr.xp);
          if (tr.gold) c.gold(tr.gold);
        } else {
          const ids = type === 'sword' ? opts.enemies || [] : type === 'joust' ? [opts.opponent] : opts.rivals || [];
          c.reward(type, ids.filter(Boolean));
        }
        G.save();
        n.engagedCooldown = true;
      } else {
        if (tr.lose) await c.say(tr.lose, who);
        n.engagedCooldown = true;
        if (type === 'sword') {
          if (opts.noDeath) G.player.setHp(Math.max(1, res.hp || 1));
          else await G.game.blackout();
        }
      }
    } catch (e) { console.error('world: trainer battle error', e); }
    finally { S.lock = Math.max(0, S.lock - 1); }
  }

  // ------------------------------------------------------------------ wild encounters
  function rollEncounter() {
    const m = S.map;
    if (!m.encounters || !m.encounters.length) return false;
    if (S.noEnc > 0) return false;
    const rate = m.encounterRate != null ? m.encounterRate : 0.1;
    if (!U.chance(rate)) return false;
    const pick = U.weighted(m.encounters);
    if (!pick || !pick.enemies || !pick.enemies.length) return false;
    wildBattle(pick.enemies.slice());
    return true;
  }
  function wildTitle(enemies) {
    const name = (id) => (G.roster.sword[id] && G.roster.sword[id].name) || id.replace(/_/g, ' ');
    const first = name(enemies[0]);
    if (enemies.length === 1) return `A wild ${first} appears!`;
    const plural = (n) => (/(wolf)$/i.test(n) ? n.replace(/f$/i, 'ves') : /[sxz]$|ch$|sh$/i.test(n) ? n + 'es' : /[^aeiou]y$/i.test(n) ? n.slice(0, -1) + 'ies' : n + 's');
    if (enemies.every((e) => e === enemies[0])) return `${enemies.length} ${plural(first)} attack!`;
    return `${first} and company attack!`;
  }
  async function wildBattle(enemies) {
    const st = S;
    st.lock++;
    try {
      st.player.bubble = 0.001;
      G.sfx.play('alert');
      await U.sleep(550);
      st.player.bubble = 0;
      const res = (await G.battle.start('sword', { enemies, arena: st.map.arena || 'field', canFlee: true, title: wildTitle(enemies) })) || { won: false };
      st.noEnc = 4;
      if (res.fled) { if (res.hp != null) G.player.setHp(res.hp); }
      else if (res.won) {
        if (res.hp != null) G.player.setHp(res.hp);
        G.cmd.reward('sword', enemies);
        G.save();
      } else {
        await G.game.blackout();
      }
    } catch (e) { console.error('world: encounter error', e); }
    finally { st.lock = Math.max(0, st.lock - 1); if (S === st) W.refresh(); }
  }

  // ------------------------------------------------------------------ player movement
  function wantRun() {
    const s = G.input.stick;
    return (s.active && s.mag > 0.9) || G.input.down('c');
  }
  function tryStep(dir) {
    const p = S.player;
    p.dir = dir;
    const nx = p.x + DX[dir], ny = p.y + DY[dir];
    if (!inBounds(nx, ny)) {
      const ed = edgeFor(dir);
      if (ed) { S.walking = false; edgeWarp(ed, dir); return; }
      bump(); return;
    }
    if (blocked(nx, ny)) { bump(); return; }
    S.bumpT = 0;
    const run = wantRun();
    S.running = run;
    startMove(p, dir, run ? RUN_SPEED : WALK_SPEED);
    S.walking = true;
  }
  async function edgeWarp(ed, dir) {
    const st = S;
    st.lock++;
    try {
      await G.scenes.fade(() => { enterMap(ed.to, ed.x, ed.y, dir); G.save(); }, { ms: 200 });
    } finally { st.lock = Math.max(0, st.lock - 1); }
    await runOnEnter();
  }
  function bump() {
    const p = S.player;
    if (S.bumpT <= 0) {
      G.sfx.play('bump');
      S.bumpT = 0.38;
      p.parity ^= 1;
    }
    S.bumpAnim = 0.2;
  }
  function onPlayerArrive() {
    const p = S.player;
    G.state.x = p.x; G.state.y = p.y; G.state.dir = p.dir;
    G.state.steps = (G.state.steps || 0) + 1;
    if (S.noEnc > 0) S.noEnc--;
    if (!G.state.flags._hint_move && G.state.steps >= 6) { G.state.flags._hint_move = true; S.hintFade = 1; }
    if ((G.state.steps & 1) === 0) G.sfx.play('step');
    if (S.running && U.chance(0.5)) spawn(p.px + 8, p.py + 15, -DX[p.dir] * 15, -8, 0.35, 'rgba(220,200,160,0.8)', 0, 2);
    const ch = tileAt(p.x, p.y);
    if (G.tiles.defs[ch] && G.tiles.defs[ch].tallGrass) {
      rustle(p.x, p.y);
    }
    const o = objAt(p.x, p.y);
    if (o && o.type === 'item') { S.walking = false; pickup(o); return; }
    const w = warpAt(p.x, p.y);
    if (w) { S.walking = false; doWarp(w.to, w.tx, w.ty, w.dir); return; }
    if (checkTrainers()) { S.walking = false; return; }
    if (G.tiles.defs[ch] && G.tiles.defs[ch].tallGrass && rollEncounter()) { S.walking = false; }
  }
  function rustle(x, y) {
    G.sfx.play('bush');
    S.rustle.push({ x, y, t: 0 });
    if (S.rustle.length > 6) S.rustle.shift();
    for (let i = 0; i < 4; i++) spawn(x * TS + U.rand(3, 13), y * TS + U.rand(6, 12), U.rand(-25, 25), U.rand(-45, -20), U.rand(0.4, 0.7), i & 1 ? '#7ed65a' : '#2f8238', 120, 1);
  }

  function updatePlayer(dt) {
    const p = S.player;
    if (S.bumpT > 0) S.bumpT -= dt;
    if (S.bumpAnim > 0) S.bumpAnim -= dt;
    if (p.moving) {
      if (updateEnt(p, dt)) {
        if (!p.scripted) onPlayerArrive();
      } else return;
    }
    if (p.moving || locked()) { S.walking = false; return; }
    if (S.pendingTrainer) return;
    if (checkTrainers()) return;
    const d = G.input.dir4();
    if (!d) { S.walking = false; S.turnT = 0; return; }
    if (d !== p.dir && !S.walking) {
      p.dir = d; G.state.dir = d;
      S.turnT = 0.1;
      return;
    }
    if (S.turnT > 0) { S.turnT -= dt; if (S.turnT > 0) return; }
    tryStep(d);
  }

  // ------------------------------------------------------------------ NPC AI
  function updateNpcs(dt) {
    const frozen = S.lock > 0 || G.ui.busy();
    for (let i = 0; i < S.npcs.length; i++) {
      const n = S.npcs[i];
      if (!n.visible) continue;
      if (n.moving) { updateEnt(n, dt); continue; }
      if (n.bubble > 0) n.bubble += dt;
      if (frozen || n.scripted || n.engaged) continue;
      n.timer -= dt;
      if (n.timer > 0) continue;
      const mv = n.move || 'still';
      if (mv === 'turn') {
        n.dir = U.pick(DIR4);
        n.timer = U.rand(1.2, 3.5);
      } else if (mv === 'wander') {
        n.timer = U.rand(1.0, 3.2);
        const dir = U.pick(DIR4);
        const nx = n.x + DX[dir], ny = n.y + DY[dir];
        if (Math.abs(nx - n.home.x) <= 2 && Math.abs(ny - n.home.y) <= 2 && !blocked(nx, ny, n) && !warpAt(nx, ny)) startMove(n, dir, NPC_SPEED);
        else n.dir = dir;
      } else n.timer = 9999;
    }
  }

  // ------------------------------------------------------------------ camera
  function camTarget(out) {
    const p = S.player;
    const mw = S.w * TS, mh = S.h * TS;
    let cx = p.px + 8 - G.W / 2, cy = p.py + 8 - G.H / 2 - 4;
    if (mw <= G.W) cx = (mw - G.W) / 2; else cx = U.clamp(cx, 0, mw - G.W);
    if (mh <= G.H) cy = (mh - G.H) / 2; else cy = U.clamp(cy, 0, mh - G.H);
    out.x = cx; out.y = cy;
  }
  const tmpCam = { x: 0, y: 0 };
  function snapCamera() { camTarget(tmpCam); S.cam.x = tmpCam.x; S.cam.y = tmpCam.y; }
  function updateCamera(dt) {
    camTarget(tmpCam);
    const k = 1 - Math.exp(-dt * 14);
    S.cam.x += (tmpCam.x - S.cam.x) * k;
    S.cam.y += (tmpCam.y - S.cam.y) * k;
    if (Math.abs(tmpCam.x - S.cam.x) < 0.05) S.cam.x = tmpCam.x;
    if (Math.abs(tmpCam.y - S.cam.y) < 0.05) S.cam.y = tmpCam.y;
  }

  // ------------------------------------------------------------------ input (interact, taps, menu)
  function menuRect(r) {
    r.x = G.W - 30; r.y = 3; r.w = 28; r.h = 28;
    return r;
  }
  const mRect = { x: 0, y: 0, w: 0, h: 0 };
  function openMenu() {
    if (!G.menus || typeof G.menus.open !== 'function') { G.ui.toast('Menu coming soon'); return; }
    G.sfx.play('select');
    S.lock++;
    const st = S;
    let r;
    try { r = G.menus.open(); } catch (e) { console.error('world: menu error', e); }
    Promise.resolve(r).catch((e) => console.error('world: menu error', e)).finally(() => {
      st.lock = Math.max(0, st.lock - 1);
      if (S === st) W.refresh();
    });
  }
  function handleInput() {
    const inp = G.input;
    if (G.input.consumeTap(menuRect(mRect))) { if (!locked() && !S.player.moving) openMenu(); return; }
    if (locked() || S.player.moving) return;
    if (inp.pressed('menu')) { openMenu(); return; }
    // tap directly on an adjacent NPC / sign / chest
    const evs = inp.events;
    for (let i = 0; i < evs.length; i++) {
      const e = evs[i];
      if (e.type !== 'tap') continue;
      const wx = e.x + S.camX, wy = e.y + S.camY;
      const hit = tapTarget(wx, wy);
      if (hit) {
        inp.consumeTap({ x: e.x - 0.5, y: e.y - 0.5, w: 1, h: 1 });
        const p = S.player;
        const dx = hit.x - p.x, dy = hit.y - p.y;
        p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        G.state.dir = p.dir;
        interactAt(hit.x, hit.y);
        return;
      }
    }
    if (inp.pressed('a')) {
      const f = facedTile();
      interactAt(f.x, f.y);
    }
  }
  const tapHit = { x: 0, y: 0 };
  function tapTarget(wx, wy) {
    const p = S.player;
    // NPC sprite bounds (taller than a tile)
    for (let i = 0; i < S.npcs.length; i++) {
      const n = S.npcs[i];
      if (!n.visible) continue;
      if (wx >= n.px - 2 && wx < n.px + 18 && wy >= n.py - 8 && wy < n.py + 17) {
        const d = Math.abs(n.x - p.x) + Math.abs(n.y - p.y);
        const across = d === 2 && (n.x === p.x || n.y === p.y) && G.tiles.defs[tileAt((n.x + p.x) / 2, (n.y + p.y) / 2)] && G.tiles.defs[tileAt((n.x + p.x) / 2, (n.y + p.y) / 2)].counter;
        if (d === 1) { tapHit.x = n.x; tapHit.y = n.y; return tapHit; }
        if (across) { tapHit.x = (n.x + p.x) / 2; tapHit.y = (n.y + p.y) / 2; return tapHit; }
      }
    }
    const tx = Math.floor(wx / TS), ty = Math.floor(wy / TS);
    if (Math.abs(tx - p.x) + Math.abs(ty - p.y) === 1 && (signAt(tx, ty) || tileAt(tx, ty) === 'S' || (objAt(tx, ty) && objAt(tx, ty).type === 'chest'))) {
      tapHit.x = tx; tapHit.y = ty; return tapHit;
    }
    return null;
  }

  // ------------------------------------------------------------------ scene
  function makeScene() {
    return {
      name: 'world',
      update(dt) {
        if (!S) return;
        S.t += dt;
        handleInput();
        updatePlayer(dt);
        updateNpcs(dt);
        for (let i = 0; i < S.objects.length; i++) if (S.objects[i].bounce > 0) S.objects[i].bounce = Math.max(0, S.objects[i].bounce - dt * 3);
        for (let i = S.rustle.length - 1; i >= 0; i--) { S.rustle[i].t += dt; if (S.rustle[i].t > 0.35) S.rustle.splice(i, 1); }
        for (let i = 0; i < PN; i++) {
          const q = parts[i];
          if (!q.on) continue;
          q.life -= dt;
          if (q.life <= 0) { q.on = false; continue; }
          q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        }
        if (S.shakeT > 0) S.shakeT -= dt;
        if (S.banner) { S.banner.t += dt; if (S.banner.t > 3) S.banner = null; }
        if (S.hintFade > 0 && G.state.flags._hint_move) S.hintFade = Math.max(0, S.hintFade - dt * 0.7);
        updateCamera(dt);
      },
      draw(ctx) { if (S) drawWorld(ctx); },
      resize() { if (S) snapCamera(); },
      resume() { if (S) W.refresh(); },
    };
  }

  // ------------------------------------------------------------------ drawing
  const dl = []; // y-sorted draw list (reused)
  function drawEnt(ctx, e, camX, camY, q) {
    const sx = Math.round((e.px + 8 - camX) * q) / q, sy = Math.round((e.py + 16 - camY) * q) / q;
    let f = entFrame(e);
    if (e === S.player && !e.moving && S.bumpAnim > 0) f = e.parity ? 1 : 2;
    const c = charFrame(e, e.dir, f);
    ctx.drawImage(getShadow(), sx - 7, sy - 3.5);
    const w = c.width, h = c.height;
    ctx.drawImage(c, sx - w / 2, sy - h + 1 - (e.hop || 0));
    // tall grass covers the feet
    const tx = e.moving ? (e.t / e.dur < 0.5 ? e.fx : e.x) : e.x;
    const ty = e.moving ? (e.t / e.dur < 0.5 ? e.fy : e.y) : e.y;
    if (inBounds(tx, ty) && S.rows[ty][tx] === ',') {
      let jig = 0;
      for (let i = 0; i < S.rustle.length; i++) if (S.rustle[i].x === tx && S.rustle[i].y === ty) jig = Math.sin(S.rustle[i].t * 40) > 0 ? 1 : -1;
      ctx.drawImage(G.tiles.grassFront(), Math.round((tx * TS - camX) * q) / q + jig, Math.round((ty * TS - camY) * q) / q);
    }
  }
  function drawWorld(ctx) {
    const q = G.gfx.scale * G.gfx.dpr;
    let camX = S.cam.x, camY = S.cam.y;
    if (S.shakeT > 0) { camX += U.rand(-2, 2); camY += U.rand(-2, 2); }
    camX = Math.round(camX * q) / q; camY = Math.round(camY * q) / q;
    S.camX = camX; S.camY = camY;
    const mw = S.w * TS, mh = S.h * TS;
    if (camX < 0 || camY < 0 || camX + G.W > mw || camY + G.H > mh) {
      if (S.map.outdoor === false) { ctx.fillStyle = '#0b0806'; ctx.fillRect(0, 0, G.W, G.H); }
      else {
        // outdoor maps smaller than the view sit in a dense forest
        const pat = forestPattern(ctx);
        const ox = ((-camX % 32) + 32) % 32 - 32, oy = ((-camY % 32) + 32) % 32 - 32;
        ctx.save(); ctx.translate(ox, oy); ctx.fillStyle = pat; ctx.fillRect(0, 0, G.W + 64, G.H + 64); ctx.restore();
      }
    }
    G.tiles.drawMap(ctx, S.mapGfx, camX, camY, G.W, G.H, S.t);
    // rustling grass tiles redraw with a jiggle
    for (let i = 0; i < S.rustle.length; i++) {
      const r = S.rustle[i];
      const off = Math.sin(r.t * 50) * (1 - r.t / 0.35) * 1.5;
      ctx.drawImage(G.tiles.grassFull(), r.x * TS - camX + off, r.y * TS - camY);
    }
    // ground objects
    const sp = getSparkles();
    for (let i = 0; i < S.objects.length; i++) {
      const o = S.objects[i];
      const sx = o.x * TS - camX, sy = o.y * TS - camY;
      if (sx < -TS || sy < -TS || sx > G.W || sy > G.H) continue;
      if (o.type === 'chest') {
        const open = !!G.state.flags[flagOf(o)];
        ctx.drawImage(getChest(open), sx, sy - Math.sin(o.bounce * Math.PI) * 3);
      } else if (o.type === 'item' && !o.gone && !G.state.flags[flagOf(o)]) {
        const f = Math.floor(S.t * 4 + o.x) % 3;
        ctx.drawImage(sp[f], sx, sy + (Math.sin(S.t * 3 + o.x) > 0 ? 0 : -1));
      }
    }
    // entities, y-sorted
    dl.length = 0;
    dl.push(S.player);
    for (let i = 0; i < S.npcs.length; i++) if (S.npcs[i].visible) dl.push(S.npcs[i]);
    for (let i = 1; i < dl.length; i++) {
      const e = dl[i];
      let j = i - 1;
      while (j >= 0 && dl[j].py > e.py) { dl[j + 1] = dl[j]; j--; }
      dl[j + 1] = e;
    }
    for (let i = 0; i < dl.length; i++) {
      const e = dl[i];
      if (e.px - camX < -24 || e.px - camX > G.W + 8 || e.py - camY < -8 || e.py - camY > G.H + 24) continue;
      drawEnt(ctx, e, camX, camY, q);
    }
    // bubbles
    for (let i = 0; i < dl.length; i++) {
      const e = dl[i];
      if (!(e.bubble > 0)) continue;
      const k = Math.min(1, e.bubble / 0.15);
      const s = U.ease.outBack(k);
      const b = getBubble();
      const bw = 13 * s, bh = 15 * s;
      ctx.drawImage(b, e.px + 8 - camX - bw / 2, e.py - 8 - camY - bh + 15 * (1 - s) * 0.5, bw, bh);
    }
    for (let i = 0; i < PN; i++) {
      const p = parts[i];
      if (!p.on) continue;
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 2);
      ctx.fillStyle = p.col;
      ctx.fillRect(p.x - camX, p.y - camY, p.s, p.s);
    }
    ctx.globalAlpha = 1;
    drawHud(ctx);
  }

  // ------------------------------------------------------------------ HUD
  const hud = { hp: -1, max: -1, gold: -1, lvl: -1, armor: null, goldStr: '', lvlStr: '' };
  function refreshHud() {
    const s = G.state;
    if (hud.hp !== s.hp || hud.lvl !== s.level || hud.armor !== s.equip.armor || hud.gold !== s.gold) {
      hud.hp = s.hp; hud.lvl = s.level; hud.armor = s.equip.armor; hud.gold = s.gold;
      hud.max = G.player.maxHp();
      hud.goldStr = String(s.gold);
      hud.lvlStr = 'Lv' + s.level;
    }
  }
  function drawHud(ctx) {
    const D = G.draw;
    refreshHud();
    // stat plate
    const x = 4, y = 4, w = 92, h = 26;
    D.rrect(x + 1, y + 2, w, h, 4, 'rgba(0,0,0,0.3)');
    D.rrect(x, y, w, h, 4, 'rgba(43,29,20,0.82)', '#c9893c', 1);
    D.text(hud.lvlStr, x + 5, y + 4, { size: 7, color: '#ffe48a', bold: true });
    D.text('HP', x + 26, y + 4, { size: 7, color: '#ffb0a0', bold: true });
    const frac = hud.max > 0 ? hud.hp / hud.max : 0;
    D.bar(x + 39, y + 5, 47, 5, frac, frac > 0.5 ? '#5bd04a' : frac > 0.2 ? '#f2c14e' : '#e0473c');
    // coin
    D.circle(x + 9, y + 18.5, 3.5, '#f2c14e', '#8a6a1a', 1);
    ctx.fillStyle = '#fff4b0'; ctx.fillRect(x + 7.5, y + 16.5, 1.2, 1.2);
    D.text(hud.goldStr, x + 16, y + 14.5, { size: 7, color: '#fff3d6', bold: true });
    D.text(hud.hp + '/' + hud.max, x + w - 6, y + 14.5, { size: 6, color: '#e8d8c0', align: 'right' });
    // menu button
    const r = menuRect(mRect);
    const pressed = G.input.pointerIn(r);
    const bx = r.x + 2, by = r.y + 1 + (pressed ? 1 : 0), bs = 24;
    D.rrect(bx, r.y + 3, bs, bs, 5, 'rgba(0,0,0,0.35)');
    D.rrect(bx, by, bs, bs, 5, 'rgba(43,29,20,0.82)', '#c9893c', 1);
    ctx.fillStyle = '#ffe9b8';
    for (let i = 0; i < 3; i++) ctx.fillRect(bx + 6, by + 7 + i * 4.5, 12, 2);
    // location banner
    if (S.banner) {
      const t = S.banner.t;
      const k = t < 0.35 ? U.ease.outCubic(t / 0.35) : t > 2.5 ? 1 - U.ease.inQuad((t - 2.5) / 0.5) : 1;
      const bw = Math.min(G.W - 24, Math.max(110, D.measure(S.banner.text, 10) + 30));
      const bxx = Math.round((G.W - bw) / 2), byy = Math.round(36 - 50 * (1 - k));
      D.rrect(bxx + 1, byy + 2, bw, 22, 3, 'rgba(0,0,0,0.35)');
      D.rrect(bxx, byy, bw, 22, 3, '#a8703e', '#2b1d14', 1.5);
      D.rrect(bxx + 2, byy + 2, bw - 4, 18, 2, '#c98a52', '#7e4d28', 1);
      ctx.fillStyle = '#7e4d28';
      ctx.fillRect(bxx + 5, byy + 5, 2, 2); ctx.fillRect(bxx + bw - 7, byy + 5, 2, 2);
      ctx.fillRect(bxx + 5, byy + 15, 2, 2); ctx.fillRect(bxx + bw - 7, byy + 15, 2, 2);
      D.text(S.banner.text, G.W / 2, byy + 11.5, { size: 10, align: 'center', baseline: 'middle', color: '#fff6dc', shadow: 'rgba(60,30,10,0.8)', bold: true });
    }
    // first-time hint
    if (!G.state.flags._hint_move || S.hintFade > 0) {
      if (S.lock > 0 || G.ui.busy()) S.hintShow = 0;
      else S.hintShow = Math.min(1, (S.hintShow || 0) + 1 / 30);
      const a = (G.state.flags._hint_move ? S.hintFade : 1) * S.hintShow;
      if (a > 0.01) {
        ctx.globalAlpha = a;
        const msg = 'Left thumb: move • Tap right: talk/interact • ☰ menu';
        const tw = Math.min(G.W - 16, D.measure(msg, 7) + 16);
        const lines = tw < D.measure(msg, 7) + 16 ? 2 : 1;
        const hh = lines === 2 ? 26 : 16;
        const hy = G.H - hh - 8;
        D.rrect(G.W / 2 - tw / 2, hy, tw, hh, 6, 'rgba(25,15,8,0.72)', 'rgba(255,228,138,0.6)', 1);
        if (lines === 1) D.text(msg, G.W / 2, hy + 8.5, { size: 7, align: 'center', baseline: 'middle', color: '#fff3d6' });
        else {
          D.text('Left thumb: move • Tap right: talk', G.W / 2, hy + 8, { size: 7, align: 'center', baseline: 'middle', color: '#fff3d6' });
          D.text('☰ opens the menu', G.W / 2, hy + 18, { size: 7, align: 'center', baseline: 'middle', color: '#fff3d6' });
        }
        ctx.globalAlpha = 1;
      }
    }
    if (G.DEBUG) {
      const p = S.player;
      D.text(`${S.map.id} ${p.x},${p.y} ${tileAt(p.x, p.y)}`, 4, y + h + 4, { size: 7, color: '#0f0', shadow: true });
    }
    G.input.drawStick(ctx);
  }

  // ------------------------------------------------------------------ validation
  function validate(map) {
    const out = [];
    if (!map || !Array.isArray(map.tiles) || !map.tiles.length) return ['map has no tiles'];
    const rows = map.tiles, h = rows.length, w = rows[0].length;
    const id = map.id || '?';
    rows.forEach((r, y) => {
      if (typeof r !== 'string') { out.push(`${id}: row ${y} is not a string`); return; }
      if (r.length !== w) out.push(`${id}: row ${y} has length ${r.length}, expected ${w}`);
      for (let x = 0; x < r.length; x++) if (!G.tiles.known(r[x])) out.push(`${id}: unknown tile '${r[x]}' at ${x},${y}`);
    });
    const ch = (x, y) => (y >= 0 && y < h && x >= 0 && x < (rows[y] || '').length ? rows[y][x] : null);
    const oob = (x, y) => ch(x, y) == null;
    const solidAt = (x, y) => { const c = ch(x, y); return c != null && G.tiles.solid(c); };
    for (const wp of map.warps || []) {
      if (oob(wp.x, wp.y)) out.push(`${id}: warp at ${wp.x},${wp.y} is out of bounds`);
      else if (solidAt(wp.x, wp.y)) out.push(`${id}: warp at ${wp.x},${wp.y} is on solid '${ch(wp.x, wp.y)}'`);
      const tm = G.maps[wp.to];
      if (!tm) out.push(`${id}: warp at ${wp.x},${wp.y} targets missing map '${wp.to}'`);
      else if (Array.isArray(tm.tiles)) {
        const tc = tm.tiles[wp.ty] && tm.tiles[wp.ty][wp.tx];
        if (tc == null) out.push(`${id}: warp at ${wp.x},${wp.y} → ${wp.to} ${wp.tx},${wp.ty} is out of bounds`);
        else if (G.tiles.solid(tc)) out.push(`${id}: warp at ${wp.x},${wp.y} → ${wp.to} ${wp.tx},${wp.ty} lands on solid '${tc}'`);
      }
    }
    const ids = {};
    for (const n of map.npcs || []) {
      if (n.id) { if (ids[n.id]) out.push(`${id}: duplicate npc id '${n.id}'`); ids[n.id] = 1; }
      if (oob(n.x, n.y)) out.push(`${id}: npc '${n.id}' at ${n.x},${n.y} is out of bounds`);
      else if (solidAt(n.x, n.y) && !'dg'.includes(ch(n.x, n.y))) out.push(`${id}: npc '${n.id}' at ${n.x},${n.y} is on solid '${ch(n.x, n.y)}'`);
      if (n.trainer && n.trainer.battle && !['sword', 'joust', 'archery'].includes(n.trainer.battle.type)) out.push(`${id}: trainer '${n.id}' has unknown battle type`);
    }
    for (const o of map.objects || []) {
      if (oob(o.x, o.y)) out.push(`${id}: object '${o.id}' at ${o.x},${o.y} is out of bounds`);
      else if (solidAt(o.x, o.y)) out.push(`${id}: object '${o.id}' at ${o.x},${o.y} is on solid '${ch(o.x, o.y)}'`);
      if (o.item && o.item !== 'gold' && G.items && !G.items[o.item]) out.push(`${id}: object '${o.id}' gives unknown item '${o.item}'`);
    }
    for (const s of map.signs || []) if (oob(s.x, s.y)) out.push(`${id}: sign at ${s.x},${s.y} is out of bounds`);
    for (const side of ['north', 'south', 'east', 'west']) {
      const e = map.edges && map.edges[side];
      if (e && !G.maps[e.to]) out.push(`${id}: ${side} edge targets missing map '${e.to}'`);
    }
    if (map.encounters && Object.keys(G.roster.sword).length) {
      for (const enc of map.encounters) for (const en of enc.enemies || []) if (!G.roster.sword[en]) out.push(`${id}: encounter enemy '${en}' not in sword roster`);
    }
    return out;
  }

  // ------------------------------------------------------------------ commands (G.cmd)
  function findNpc(id) {
    if (!S) return null;
    for (let i = 0; i < S.npcs.length; i++) if (S.npcs[i].id === id) return S.npcs[i];
    return null;
  }
  async function walkEnt(e, path, speed) {
    e.scripted = (e.scripted || 0) + 1;
    try {
      for (const ch of String(path || '')) {
        const d = PATHDIR[ch];
        if (!d) continue;
        while (e.moving) await U.sleep(16);
        await moveAwait(e, d, speed);
      }
    } finally { e.scripted--; }
  }
  const worldCmds = {
    warp: (mapId, x, y, dir) => doWarp(mapId, x, y, dir),
    async walkPlayer(path) {
      if (!S) return;
      const p = S.player;
      await walkEnt(p, path, SCRIPT_SPEED);
      G.state.x = p.x; G.state.y = p.y; G.state.dir = p.dir;
    },
    async walkNpc(id, path) {
      const n = findNpc(id);
      if (!n) { console.warn('world: walkNpc unknown npc', id); return; }
      await walkEnt(n, path, SCRIPT_SPEED);
    },
    faceNpc(id, dir) {
      const n = findNpc(id);
      if (!n) return;
      if (dir === 'player' && S) { const p = S.player; const dx = p.x - n.x, dy = p.y - n.y; dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
      if (DX[dir] != null) n.dir = dir;
    },
    facePlayer(dir) {
      if (!S) return;
      const p = S.player;
      const n = findNpc(dir);
      if (n) { const dx = n.x - p.x, dy = n.y - p.y; dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); }
      if (DX[dir] != null) { p.dir = dir; G.state.dir = dir; }
    },
    showNpc(id, on = true) {
      hiddenOverride[id] = !!on;
      W.refresh();
    },
    shake(ms = 400) {
      if (S) S.shakeT = ms / 1000;
      G.sfx.play('thud');
      return U.sleep(ms);
    },
    npc: (id) => findNpc(id),
    emote(id, ms = 700) { // "!" bubble over an npc (or 'player')
      const e = id === 'player' ? S && S.player : findNpc(id);
      if (!e) return Promise.resolve();
      e.bubble = 0.001; G.sfx.play('alert');
      return U.sleep(ms).then(() => { e.bubble = 0; });
    },
  };
  function installCmds() { if (G.cmd) Object.assign(G.cmd, worldCmds); }
  installCmds();

  // ------------------------------------------------------------------ public API
  W.refresh = () => {
    if (!S) return;
    for (let i = 0; i < S.npcs.length; i++) {
      const n = S.npcs[i];
      const ov = hiddenOverride[n.id];
      n.visible = ov != null ? ov : typeof n.def.cond === 'function' ? !!safe(n.def.cond, true) : true;
    }
  };
  W.validate = validate;
  W.start = () => {
    installCmds();
    S = {
      map: null, mapGfx: null, rows: null, w: 0, h: 0, npcs: [], objects: [],
      player: makeEnt(G.state.look || 'hero', 0, 0, G.state.dir || 'down'),
      cam: { x: 0, y: 0 }, camX: 0, camY: 0, t: 0, lock: 0, walking: false, turnT: 0, bumpT: 0, bumpAnim: 0,
      running: false, noEnc: 4, rustle: [], shakeT: 0, banner: null, lastOutdoorName: null, hintFade: 0,
    };
    S.playerLook = G.state.look;
    const scene = makeScene();
    W.scene = scene;
    G.scenes.replace(scene);
    enterMap(G.state.map || 'thornbrook_stable', G.state.x | 0, G.state.y | 0, G.state.dir);
    if (G.DEBUG) {
      for (const id in G.maps) {
        const probs = validate(Object.assign({ id }, G.maps[id]));
        if (probs.length) console.warn(`[world] map '${id}' problems:\n  ` + probs.join('\n  '));
      }
    }
    runOnEnter();
    return scene;
  };
  // keep the player's look in sync with G.state.look (menus may change it)
  W.updateLook = () => { if (S) { S.player.lf = lookFrames(G.state.look || 'hero'); S.playerLook = G.state.look; } };
  Object.defineProperty(W, 'state', { get: () => S, configurable: true });
  W.player = () => S && S.player;
  W.busy = () => locked();
  W.tileAt = (x, y) => (S ? tileAt(x, y) : null);

  // Look sync check piggybacks on refresh to avoid per-frame cost.
  const baseRefresh = W.refresh;
  W.refresh = () => {
    if (S && S.playerLook !== G.state.look) W.updateLook();
    baseRefresh();
  };

  G.debug.world = () => S;
  G.debug.validateAll = () => {
    const all = {};
    for (const id in G.maps) { const p = validate(Object.assign({ id }, G.maps[id])); if (p.length) all[id] = p; }
    return all;
  };
})();
