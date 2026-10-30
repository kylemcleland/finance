// Content helpers: a tiny tile-grid builder for maps, plus shared script helpers.
// Map files register maps lazily (getter on G.maps) so they only use this at runtime.
(() => {
  G.content = G.content || {};
  const L = {};

  // Tiles the player can stand on (mirror of DESIGN §8 legend).
  L.WALK = new Set(['.', ',', ':', '_', '=', 's', 'd', 'F', 'B', 'k', 'K', 'a', 'u', ';', 'g']);
  L.LEGAL = new Set('.,:_=~sTtrbfFw#^dWhxSBocCgkKnvelaqp|mu"*;'.split(''));

  class Grid {
    constructor(w, h, fill = '.') {
      this.w = w; this.h = h;
      this.a = [];
      for (let y = 0; y < h; y++) this.a.push(new Array(w).fill(fill));
    }
    in(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.in(x, y) ? this.a[y][x] : null; }
    set(x, y, ch) { if (this.in(x, y)) this.a[y][x] = ch; return this; }
    rect(x, y, w, h, ch) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, ch); return this; }
    frame(x, y, w, h, ch) {
      for (let i = 0; i < w; i++) { this.set(x + i, y, ch); this.set(x + i, y + h - 1, ch); }
      for (let j = 0; j < h; j++) { this.set(x, y + j, ch); this.set(x + w - 1, y + j, ch); }
      return this;
    }
    border(ch = 'T', t = 1) { for (let k = 0; k < t; k++) this.frame(k, k, this.w - 2 * k, this.h - 2 * k, ch); return this; }
    // Horizontal run x1..x2 (inclusive) at rows y..y+wd-1.
    hline(x1, x2, y, ch, wd = 1) { const a = Math.min(x1, x2), b = Math.max(x1, x2); return this.rect(a, y, b - a + 1, wd, ch); }
    // Vertical run y1..y2 (inclusive) at columns x..x+wd-1.
    vline(x, y1, y2, ch, wd = 1) { const a = Math.min(y1, y2), b = Math.max(y1, y2); return this.rect(x, a, wd, b - a + 1, ch); }
    // Orthogonal path through points (horizontal leg first), width wd.
    path(pts, ch = '_', wd = 2) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        this.hline(x1, x2, y1, ch, wd);
        this.vline(x2, y1, y2, ch, wd);
      }
      return this;
    }
    // Paste rows; spaces are transparent.
    stamp(x, y, rows) {
      rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] !== ' ') this.set(x + i, y + j, r[i]); });
      return this;
    }
    // Replace `on` tiles in a rect with ch at given density (deterministic).
    scatter(x, y, w, h, ch, dens, seed = 1, on = '.') {
      const rnd = G.U.rng(seed);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const r = rnd();
        if (r < dens && (on == null || this.get(x + i, y + j) === on)) this.set(x + i, y + j, ch);
      }
      return this;
    }
    // Rough ellipse blob.
    blob(cx, cy, rx, ry, ch, seed = 1, on = null, rough = 0.25) {
      const rnd = G.U.rng(seed * 7919 + 13);
      for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d <= 1 - rough + rnd() * rough * 2 && (on == null || on.includes(this.get(x, y)))) this.set(x, y, ch);
      }
      return this;
    }
    // Clear a rough corridor of `ch` (radius rad) around an orthogonal polyline.
    carve(pts, rad = 2, ch = '.', seed = 1, on = null) {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
        const pass = (ax, ay, bx, by) => {
          for (let y = Math.min(ay, by) - rad; y <= Math.max(ay, by) + 1 + rad; y++)
            for (let x = Math.min(ax, bx) - rad; x <= Math.max(ax, bx) + 1 + rad; x++)
              if (on == null || on.includes(this.get(x, y))) this.set(x, y, ch);
        };
        pass(x1, y1, x2, y1); pass(x2, y1, x2, y2);
      }
      pts.forEach(([x, y], i) => this.blob(x + 0.5, y + 0.5, rad + 2, rad + 1.5, ch, seed + i, on, 0.45));
      return this;
    }
    // House: roof rows on top, wall rows below, windows on wall rows, door on bottom row.
    house(x, y, w, h, o = {}) {
      const roofH = o.roof != null ? o.roof : Math.max(1, h - 2);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, j < roofH ? (o.roofCh || '^') : (o.wallCh || '#'));
      for (const wx of o.win || []) for (let j = roofH; j < h; j++) if (j === h - 1 || o.tallWin) this.set(x + wx, y + j, 'W');
      const dx = o.door != null ? o.door : Math.floor(w / 2);
      this.set(x + dx, y + h - 1, 'd');
      return { x: x + dx, y: y + h - 1 };
    }
    rows() { return this.a.map((r) => r.join('')); }
  }
  L.grid = (w, h, fill) => new Grid(w, h, fill);

  // Interior room: void outside, 2-row back wall, side walls, bottom wall with door.
  L.room = (w, h, floor = 'k', doorX = null, wall = 'n') => {
    const g = new Grid(w, h, floor);
    g.frame(0, 0, w, h, wall);
    g.hline(0, w - 1, 1, wall);
    const dx = doorX == null ? Math.floor(w / 2) : doorX;
    g.set(dx, h - 1, 'd');
    g.door = { x: dx, y: h - 1 };
    return g;
  };

  // Register a map lazily (getter) so building runs after every file has loaded.
  L.def = (id, fn) => {
    let m = null;
    Object.defineProperty(G.maps, id, {
      enumerable: true, configurable: true,
      get() {
        if (!m) {
          try { m = fn(L); m.id = id; } catch (e) {
            console.error('map build failed', id, e);
            m = { id, name: id, music: 'village', tiles: ['nnn', 'nkn', 'nnn'], warps: [], npcs: [] };
          }
        }
        return m;
      },
      set(v) { m = v; },
    });
  };

  // Build a map from its builder with a safe fallback (used by each file's inline def()).
  L.build = (id, fn) => {
    try { const m = fn(L); m.id = id; return m; } catch (e) {
      console.error('map build failed', id, e);
      return { id, name: id, music: 'village', tiles: ['nnn', 'nkn', 'nnn'], warps: [], npcs: [] };
    }
  };

  // Warp helpers.
  L.warp = (x, y, to, tx, ty, dir = 'down') => ({ x, y, to, tx, ty, dir });

  // ---------------------------------------------------------------- script helpers
  // Say as an NPC (uses its name + look for the portrait).
  L.say = (c, npc, lines) => c.say(lines, { name: npc && npc.name, look: npc && npc.look });
  L.talk = (lines) => async (c, npc) => { await L.say(c, npc, typeof lines === 'function' ? lines() : lines); };
  // Speaker shortcut for cutscenes.
  L.who = (name) => {
    const look = { Aldric: 'aldric', Cedric: 'cedric', Bram: 'bram', Wren: 'wren', Rowena: 'rowena', Varek: 'varek', 'Black Hugh': 'hugh' }[name] || name;
    return { name: name === 'Black Hugh' ? 'Black Hugh' : (name === 'Aldric' ? 'Sir Aldric' : name === 'Cedric' ? 'Cedric of Vane' : name === 'Rowena' ? 'Lady Rowena' : name), look };
  };
  L.line = (c, name, lines) => c.say(lines, L.who(name));

  L.flag = (n) => !!(G.state && G.state.flags && G.state.flags[n]);
  L.seals = () => {
    const s = (G.state && G.state.seals) || {};
    return ['sword', 'archery', 'joust'].filter((k) => s[k]).length;
  };
  L.refresh = () => { try { if (G.world && G.world.refresh) G.world.refresh(); } catch (e) { console.error(e); } };
  // Safely call an optional world command.
  L.call = async (c, name, ...args) => {
    try { if (typeof c[name] === 'function') return await c[name](...args); } catch (e) { console.error('cmd ' + name + ' failed', e); }
    return null;
  };
  L.hasBow = () => !!(G.state.equip.bow || Object.keys(G.state.bag).some((id) => G.items[id] && G.items[id].type === 'bow'));
  L.hasHorse = () => !!(G.state.equip.horse || Object.keys(G.state.bag).some((id) => G.items[id] && G.items[id].type === 'horse'));
  L.hasLance = () => !!(G.state.equip.lance || Object.keys(G.state.bag).some((id) => G.items[id] && G.items[id].type === 'lance'));
  // Make sure some item of a slot type is equipped (bag -> slot). Returns true if equipped.
  L.ensureEquipped = (type) => {
    const slot = G.slotOf[type];
    if (G.state.equip[slot]) return true;
    const ids = Object.keys(G.state.bag).filter((id) => G.items[id] && G.items[id].type === type);
    ids.sort((a, b) => (G.items[b].price || 0) - (G.items[a].price || 0));
    if (ids.length) { G.player.equip(ids[0]); return true; }
    return false;
  };
  L.giveEquip = (c, id) => { c.give(id, 1); if (!G.state.equip[G.slotOf[G.items[id].type]] || G.state.equip[G.slotOf[G.items[id].type]] === 'stick') G.player.equip(id); };

  // A non-sword challenge NPC (archery / joust) or a sword duel that should not black out.
  // o: { type, opts, flag, intro, win, lose, again, need, needText, xpMult, gold }
  L.challenge = (o) => async (c, npc) => {
    const S = (t) => L.say(c, npc, t);
    if (o.flag && L.flag(o.flag)) { await S(o.again || 'Good match, that was. My arm still aches.'); return; }
    if (o.need === 'bow' && !L.hasBow()) { await S(o.needText || 'No bow? Then you are no archer yet, friend.'); return; }
    if (o.need === 'joust' && !(L.hasHorse() && L.hasLance())) { await S(o.needText || 'Come back with a horse and a lance, and we will tilt!'); return; }
    if (o.need === 'bow') L.ensureEquipped('bow');
    if (o.need === 'joust') { L.ensureEquipped('horse'); L.ensureEquipped('lance'); }
    await S(o.intro);
    const ch = await c.ask('Accept the challenge?', ['Have at thee!', 'Not now']);
    if (ch !== 0) { await S(o.decline || 'Suit yourself. I will be here, practicing.'); return; }
    const r = await c.battle(o.type, Object.assign({ title: npc.name }, o.opts));
    if (r && r.won) {
      await S(o.win || 'Well struck! You earned this.');
      const ids = o.type === 'sword' ? o.opts.enemies : o.type === 'joust' ? [o.opts.opponent] : (o.opts.rivals || []);
      c.reward(o.type, ids, o.xpMult || 1);
      if (o.gold) c.gold(o.gold);
      if (o.flag) c.setFlag(o.flag);
    } else {
      await S(o.lose || 'Ha! Practice more, then come back.');
    }
    if (o.type === 'sword' && r && r.hp != null) G.player.setHp(Math.max(1, r.hp));
  };

  // Wild-fight helper for scripted sword fights that should count like encounters.
  L.fight = async (c, enemies, opts = {}) => {
    const r = await c.battle('sword', Object.assign({ enemies, arena: 'field', canFlee: false }, opts));
    if (r && r.won) {
      if (r.hp != null) G.player.setHp(Math.max(1, r.hp));
      return true;
    }
    return false;
  };

  G.content.lib = L;
})();
