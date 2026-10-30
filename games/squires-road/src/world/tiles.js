// World: tile art (DESIGN.md §8). Procedural 16x16 pixel tiles, auto-tiled by
// neighbors, cached by signature, pre-rendered into map chunks. Animated tiles
// (water, ford, flowers, torches) are drawn per frame from cached frames.
(() => {
  const T = 16;
  const U = G.U;
  const sh = (c, a) => U.shade(c, a);

  // ------------------------------------------------------------------ palette
  const C = {
    grass: '#7ccc58', grassD: '#62b24a', grassL: '#a4e27c', grassDD: '#4c9640',
    tall: '#4aa846', tallD: '#2f8238', tallL: '#7ed65a', tallDD: '#23662c',
    dirt: '#d9b070', dirtD: '#c09456', dirtL: '#e8c68c', dirtDD: '#9e7844',
    cob: '#c9bca6', cobD: '#9a8c76', cobL: '#e6dccb', mortar: '#857862',
    sand: '#f2da9c', sandD: '#ddc282', sandL: '#fcecc0',
    arena: '#ecd090', arenaD: '#d4b474', arenaL: '#f8e4b0',
    water: '#4f9ee6', waterD: '#3b80cf', waterL: '#92d4ff', waterDD: '#2d64a8', foam: '#f4fcff',
    ford: '#7cc0ea', fordD: '#5ea6d8', fordL: '#b4e4ff',
    trunk: '#7d4c2a', trunkD: '#56331b',
    leaf: '#4caa48', leafD: '#2f8238', leafL: '#86d860', leafDD: '#1d5a2c',
    pine: '#2f8a58', pineD: '#1d6440', pineL: '#52b476', pineDD: '#134a2e',
    rock: '#aea79c', rockD: '#7e776e', rockL: '#d8d2c6', rockDD: '#57524b',
    wood: '#b07440', woodD: '#7e4d28', woodL: '#d69a5c', woodDD: '#55331b',
    plaster: '#f4e4c0', plasterD: '#dcc69a', plasterL: '#fff4da', timber: '#8a5430', timberD: '#5e3820',
    stone: '#b8b6bc', stoneD: '#8a8892', stoneL: '#dcdae0', stoneDD: '#5e5c68',
    floor: '#d89c5e', floorD: '#b87c44', floorL: '#eab47a', floorDD: '#8e5c30',
    sfloor: '#d4c6aa', sfloorD: '#ab9c82', sfloorL: '#ebe2cc',
    iwall: '#efd4a0', iwallD: '#d8b880', iwallS: '#e4c48c', wains: '#a86c3a', wainsD: '#7a4a24', wainsL: '#c88a52',
    outline: '#2b1d14', shadow: 'rgba(30,20,10,0.22)', void: '#0b0806',
    glass: '#7fc4f0', glassD: '#4c8ac8', glassL: '#dff4ff',
  };
  const ROOFS0 = [
    { b: '#d6553e', d: '#a83a2c', l: '#f08060', dd: '#7a2820' }, // red
    { b: '#4f80d2', d: '#3a5fa8', l: '#7aa6ec', dd: '#28427a' }, // blue
    { b: '#4fa25c', d: '#367c44', l: '#78c87e', dd: '#245a30' }, // green
    { b: '#b8763c', d: '#8a522a', l: '#dc9a5c', dd: '#5e3820' }, // brown
    { b: '#9a5ab8', d: '#74408c', l: '#bc84d6', dd: '#4e2a60' }, // plum
  ];
  const ROOFS = [ROOFS0[0], ROOFS0[1], ROOFS0[3], ROOFS0[2], ROOFS0[0], ROOFS0[1], ROOFS0[4]];
  const AWNINGS = [['#d6453d', '#fff4e0'], ['#3f7fd1', '#fff4e0'], ['#4f9a4a', '#fff4e0'], ['#e0a030', '#fff4e0']];
  const BANNERS = ['#c43c3c', '#3b5fa8', '#3f8a46', '#7b3fb5'];

  // ------------------------------------------------------------------ legend
  const DEFS = {};
  const def = (ch, name, solid, o = {}) => (DEFS[ch] = Object.assign({ ch, name, solid }, o));
  def('.', 'grass', false, { ground: true });
  def(',', 'tall grass', false, { ground: true, tallGrass: true });
  def(':', 'flowers', false, { ground: true, anim: true });
  def('_', 'dirt path', false, { ground: true });
  def('=', 'cobblestone', false, { ground: true });
  def('~', 'water', true, { anim: true, water: true });
  def('s', 'sand', false, { ground: true });
  def('T', 'tree', true);
  def('t', 'pine tree', true);
  def('r', 'rock', true);
  def('b', 'bush', true);
  def('f', 'fence', true);
  def('F', 'fence gate', false);
  def('w', 'stone wall', true, { wall: true });
  def('#', 'house wall', true, { wall: true });
  def('^', 'roof', true);
  def('d', 'door', false, { door: true });
  def('W', 'window wall', true, { wall: true });
  def('h', 'hay bale', true);
  def('x', 'crate/barrel', true);
  def('S', 'sign', true, { interact: true });
  def('B', 'bridge', false);
  def('o', 'well', true);
  def('c', 'castle wall', true, { wall: true });
  def('C', 'castle battlement', true, { wall: true });
  def('g', 'castle gate', false, { door: true });
  def('k', 'wooden floor', false, { ground: true });
  def('K', 'stone floor', false, { ground: true });
  def('n', 'interior wall', true, { wall: true });
  def('v', 'counter', true, { counter: true });
  def('e', 'bed', true);
  def('l', 'bookshelf', true);
  def('a', 'arena sand', false, { ground: true });
  def('q', 'arena stands', true, { wall: true });
  def('|', 'tilt barrier', true);
  def('p', 'banner pole', true);
  def('m', 'market stall', true);
  def('u', 'stairs', false);
  def('"', 'void', true);
  def('*', 'torch', true, { anim: true });
  def(';', 'shallow ford', false, { anim: true, water: true });

  const GROUNDS = '.,:_=skKa';
  const GRASSY = '.,:';
  const isGrassy = (g) => g === '.' || g === ',' || g === ':';
  const WATERY = '~;B';
  const HOUSE = '#Wd';
  const HOUSEADJ = '#Wd*p';
  const CASTLE = 'cCg';
  const TALLSOLID = '#Wcwnq^l';
  const STRUCT = '#Wd^cCgnwq"';
  const CASTLEISH = 'cCgd*';

  // ------------------------------------------------------------------ painting core
  let X = null; // ctx being painted
  const px = (c, x, y, w = 1, h = 1) => { X.fillStyle = c; X.fillRect(x, y, w, h); };
  // cell under construction
  const cell = { rows: null, w: 0, h: 0, tx: 0, ty: 0, ch: '.', g: '.', v: 0, extra: 0, info: null, outdoor: true };
  const at = (dx, dy) => {
    const x = cell.tx + dx, y = cell.ty + dy;
    if (x < 0 || y < 0 || x >= cell.w || y >= cell.h) return cell.ch;
    return cell.rows[y][x] || '.';
  };
  const gAt = (dx, dy) => {
    const x = cell.tx + dx, y = cell.ty + dy;
    if (!cell.info || x < 0 || y < 0 || x >= cell.w || y >= cell.h) return cell.g;
    const raw = cell.rows[y][x];
    if (STRUCT.indexOf(raw) >= 0) return raw;
    return cell.info.ground[y * cell.w + x];
  };
  const inSet = (set, ch) => set.indexOf(ch) >= 0;
  let rnd = Math.random;
  const seed = (n) => { rnd = U.rng(n); };
  const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));

  // pixel blob: fn(dx, dy, nd) -> color|null, nd = normalized distance
  function blob(cx, cy, rx, ry, fn) {
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++) {
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        const nd = Math.sqrt(dx * dx + dy * dy);
        const col = fn(dx, dy, nd, x, y);
        if (col) px(col, x, y);
      }
    }
  }

  // ------------------------------------------------------------------ grounds
  function grass(v) {
    px(C.grass, 0, 0, T, T);
    seed(1000 + v * 13);
    // GBA-style tufts
    const n = 3 + (v % 3);
    for (let i = 0; i < n; i++) {
      const x = ri(1, 12), y = ri(2, 13);
      px(C.grassD, x, y + 1); px(C.grassD, x + 1, y + 2); px(C.grassD, x + 2, y + 1);
      px(C.grassL, x + 1, y);
    }
    if (v === 7) { px('#fff8e0', 4, 5); px('#fff8e0', 3, 6); px('#fff8e0', 5, 6); px('#f2c14e', 4, 6); }
    if (v === 6) { px(C.rockL, 11, 11, 2, 1); px(C.rockD, 11, 12, 2, 1); }
  }
  // Hand-drawn 8x8 tuft: ' ' clear, k darkest, d dark, m mid, l light
  const TUFT = [
    '   l    ',
    '  lm  l ',
    ' lmd lm ',
    'lmdd lmd',
    'mdkdlmdk',
    'dkdmmdkd',
    'kdkddkdk',
    ' kkkkkk ',
  ];
  function tuft(ox, oy, clipY) {
    const col = { k: C.tallDD, d: C.tallD, m: C.tall, l: C.tallL };
    for (let y = 0; y < 8; y++) {
      if (oy + y < clipY) continue;
      const r = TUFT[y];
      for (let x = 0; x < 8; x++) { const c = r[x]; if (c !== ' ') px(col[c], ox + x, oy + y); }
    }
  }
  function tallGrass(front) {
    if (!front) { px('#5cb44c', 0, 0, T, T); px(C.tallD, 0, 7, T, 1); px(C.tallD, 0, 15, T, 1); }
    const clip = front ? 9 : -99;
    tuft(0, 0, clip); tuft(8, 0, clip); tuft(-4, 8, clip); tuft(4, 8, clip); tuft(12, 8, clip);
  }

  function dirt(v) {
    px(C.dirt, 0, 0, T, T);
    seed(2000 + v * 7);
    for (let i = 0; i < 4; i++) { const x = ri(1, 14), y = ri(1, 14); px(C.dirtD, x, y); if (i & 1) px(C.dirtL, x + 1, y - 1 < 0 ? 0 : y - 1); }
    if (v > 5) { px(C.dirtDD, 6, 9, 2, 1); px(C.dirtL, 6, 8, 2, 1); }
  }
  function sand(v, base = C.sand, d = C.sandD, l = C.sandL) {
    px(base, 0, 0, T, T);
    seed(3000 + v * 5);
    for (let i = 0; i < 6; i++) px(rnd() < 0.5 ? d : l, ri(0, 15), ri(0, 15));
  }
  function arenaSand(v) {
    sand(v, C.arena, C.arenaD, C.arenaL);
    // rake arcs
    seed(3100 + v);
    if (v < 4) {
      const y = ri(3, 11);
      for (let x = 1; x < 15; x++) px(C.arenaD, x, y + Math.round(Math.sin(x * 0.45 + v) * 1.2));
    }
  }
  function cobble(v) {
    px(C.mortar, 0, 0, T, T);
    seed(4000 + v * 3);
    for (let r = 0; r < 4; r++) {
      const off = r & 1 ? 3 : 0;
      for (let c = -1; c < 4; c++) {
        const x = c * 5 + off - (r === 2 ? 1 : 0), y = r * 4;
        const k = rnd();
        const base = k < 0.25 ? C.cobD : k > 0.8 ? '#d8ccb6' : C.cob;
        px(base, x + 1, y, 3, 3); px(base, x, y + 1, 5, 1);
        px(C.cobL, x + 1, y, 2, 1);
        px(sh(base, -0.15), x + 1, y + 2, 3, 1);
      }
    }
  }

  function woodFloor(v) {
    px(C.floor, 0, 0, T, T);
    for (let r = 0; r < 4; r++) {
      const y = r * 4;
      px(r & 1 ? C.floorL : C.floor, 0, y, T, 3);
      px(C.floorD, 0, y + 3, T, 1);
      const j = ((r * 5 + v * 3) % 12) + 2;
      px(C.floorDD, j, y, 1, 3);
    }
    seed(5000 + v);
    px(C.floorD, ri(1, 13), ri(0, 3) * 4 + 1, 2, 1);
  }
  function stoneFloor(v) {
    px(C.sfloorD, 0, 0, T, T);
    for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) {
      px(C.sfloor, x + 1, y + 1, 6, 6);
      px(C.sfloorL, x + 1, y + 1, 6, 1); px(C.sfloorL, x + 1, y + 1, 1, 6);
    }
    if (v === 3) { px(C.sfloorD, 3, 4, 2, 1); px(C.sfloorD, 4, 5, 1, 1); }
  }
  function waterBase() { px(C.water, 0, 0, T, T); }

  // grass fringe intruding onto a non-grass ground from grassy neighbors
  function fringe(rim) {
    const up = isGrassy(gAt(0, -1)), dn = isGrassy(gAt(0, 1)), lf = isGrassy(gAt(-1, 0)), rt = isGrassy(gAt(1, 0));
    const P = 'XXXX'; void P;
    if (up) { px(C.grass, 0, 0, T, 1); for (let x = 0; x < T; x += 3) px(C.grass, x, 1, 2, 1); for (let x = 1; x < T; x += 4) px(C.grassD, x, 1); if (rim) px(rim, 0, 2, T, 0); }
    if (dn) { px(C.grass, 0, 15, T, 1); for (let x = 1; x < T; x += 3) px(C.grass, x, 14, 2, 1); for (let x = 2; x < T; x += 5) px(C.grassL, x, 14); }
    if (lf) { px(C.grass, 0, 0, 1, T); for (let y = 0; y < T; y += 3) px(C.grass, 1, y, 1, 2); }
    if (rt) { px(C.grass, 15, 0, 1, T); for (let y = 1; y < T; y += 3) px(C.grass, 14, y, 1, 2); }
    // rounded outer corners
    if (up && lf) { px(C.grass, 0, 0, 3, 2); px(C.grass, 0, 0, 2, 3); }
    if (up && rt) { px(C.grass, 13, 0, 3, 2); px(C.grass, 14, 0, 2, 3); }
    if (dn && lf) { px(C.grass, 0, 14, 3, 2); px(C.grass, 0, 13, 2, 3); }
    if (dn && rt) { px(C.grass, 13, 14, 3, 2); px(C.grass, 14, 13, 2, 3); }
    // inner corners (diagonal grass only)
    if (!up && !lf && isGrassy(gAt(-1, -1))) px(C.grass, 0, 0, 1, 1);
    if (!up && !rt && isGrassy(gAt(1, -1))) px(C.grass, 15, 0, 1, 1);
    if (!dn && !lf && isGrassy(gAt(-1, 1))) px(C.grass, 0, 15, 1, 1);
    if (!dn && !rt && isGrassy(gAt(1, 1))) px(C.grass, 15, 15, 1, 1);
  }

  // shadow on ground cast by a tall solid directly above
  function topShadow() {
    const a = at(0, -1);
    if (inSet(TALLSOLID, a) || a === 'T' || a === 't') {
      X.fillStyle = 'rgba(40,24,10,0.22)';
      X.fillRect(0, 0, T, a === 'T' || a === 't' ? 1 : 3);
    }
  }

  function paintGround(g, v) {
    switch (g) {
      case '.': case ':': grass(v); break;
      case ',': tallGrass(false); break;
      case '_': dirt(v); fringe(); break;
      case '=': cobble(v); fringe(); break;
      case 's': sand(v); fringe(); break;
      case 'a': arenaSand(v); break;
      case 'k': woodFloor(v); break;
      case 'K': stoneFloor(v); break;
      case '~': case ';': waterBase(); break;
      default: grass(v);
    }
    topShadow();
  }

  // ------------------------------------------------------------------ objects
  function groundShadow(cx, cy, rx, ry) {
    X.fillStyle = 'rgba(20,40,10,0.28)';
    X.beginPath(); X.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); X.fill();
  }
  function tree(v) {
    groundShadow(8.5, 14, 6.5, 2);
    px(C.trunkD, 6, 11, 4, 4); px(C.trunk, 7, 11, 2, 4);
    const wob = v * 0.7;
    blob(8, 7, 7.2, 6.6, (dx, dy, nd) => {
      const ang = Math.atan2(dy, dx);
      const r = 1 + 0.06 * Math.sin(ang * 6 + wob);
      if (nd > r) return null;
      if (nd > r - 0.16) return C.leafDD;
      const lit = -dx * 0.6 - dy * 0.8;
      if (lit > 0.55 && nd < 0.75) return C.leafL;
      if (lit < -0.35) return C.leafD;
      return C.leaf;
    });
    // leaf cluster details
    px(C.leafD, 4, 7, 2, 1); px(C.leafD, 9, 4, 2, 1); px(C.leafD, 10, 9, 2, 1); px(C.leafD, 6, 10, 2, 1);
    px(C.leafL, 5, 3, 2, 1); px(C.leafL, 3, 5, 1, 2);
    if (v === 5) { px('#e04a3a', 10, 6, 2, 2); px('#e04a3a', 5, 9, 2, 2); px('#ffb0a0', 10, 6); px('#ffb0a0', 5, 9); }
  }
  function pine(v) {
    groundShadow(8.5, 14.5, 5.5, 1.6);
    px(C.trunkD, 7, 12, 2, 3);
    const tiers = [[1, 5, 3], [4, 6, 2], [7, 7, 1]]; // y, halfwidth
    for (let t = 2; t >= 0; t--) {
      const ty = 1 + t * 3.5;
      const hw = 3 + t * 2;
      for (let y = 0; y < 5; y++) {
        const w = Math.round((hw * (y + 1)) / 5);
        const yy = Math.round(ty + y);
        px(C.pineDD, 8 - w - 1, yy, w * 2 + 2, 1);
        px(C.pine, 8 - w, yy, w * 2, 1);
        px(C.pineD, 8, yy, w, 1);
        if (y > 0) px(C.pineL, 8 - w, yy, 1, 1);
      }
    }
    void tiers; void v;
    px(C.pineL, 7, 1, 1, 1);
  }
  function bush(v) {
    groundShadow(8.5, 14, 6.5, 1.8);
    blob(8, 9.5, 7, 5.5, (dx, dy, nd) => {
      const r = 1 + 0.07 * Math.sin(Math.atan2(dy, dx) * 5);
      if (nd > r) return null;
      if (nd > r - 0.2) return C.leafDD;
      const lit = -dx * 0.5 - dy * 0.8;
      if (lit > 0.5) return C.leafL;
      if (lit < -0.4) return C.leafD;
      return '#58b44e';
    });
    if (v & 1) { px('#e8505a', 5, 8); px('#e8505a', 10, 10); px('#e8505a', 8, 7); px('#e8505a', 11, 7); }
    else { px(C.leafL, 6, 7, 2, 1); px(C.leafD, 9, 11, 2, 1); }
  }
  function rock(v) {
    groundShadow(8.5, 14, 6.5, 2);
    blob(8, 9, 7, 6, (dx, dy, nd) => {
      const r = 1 + 0.1 * Math.sin(Math.atan2(dy, dx) * 3 + v);
      if (nd > r || dy > 0.95) return null;
      if (nd > r - 0.17) return C.rockDD;
      const lit = -dx * 0.6 - dy * 0.8;
      if (lit > 0.45) return C.rockL;
      if (lit < -0.3) return C.rockD;
      return C.rock;
    });
    px(C.rockD, 6, 8, 3, 1); px(C.rockD, 9, 9, 1, 2); px(C.rockL, 5, 5, 2, 1);
  }
  function hay() {
    groundShadow(8.5, 14.5, 7.5, 1.6);
    px('#7a5418', 0, 3, 16, 12);
    px('#f2cc5a', 1, 4, 14, 4);   // top face
    px('#fff0a0', 2, 4, 12, 1);
    px('#dca838', 1, 8, 14, 6);   // front face
    px('#b88424', 1, 13, 14, 1);
    for (let x = 2; x < 15; x += 3) { px('#c89430', x, 9, 1, 3); px('#f6d870', x + 1, 5, 1, 2); }
    px('#8a5a1a', 4, 4, 1, 10); px('#8a5a1a', 11, 4, 1, 10); // twine
    px('#c08030', 4, 4, 1, 1); px('#c08030', 11, 4, 1, 1);
    px('#f6d870', 0, 2, 2, 1); px('#f6d870', 14, 3, 2, 1); // stray straw
  }

  function crate(v) {
    groundShadow(8.5, 14.5, 7, 1.6);
    if (v & 1) { // barrel
      px(C.outline, 2, 2, 12, 13);
      px(C.wood, 3, 3, 10, 11); px(C.woodL, 4, 3, 2, 11); px(C.woodD, 11, 3, 2, 11);
      px('#6a6a72', 3, 5, 10, 1); px('#6a6a72', 3, 11, 10, 1);
      px(C.woodD, 3, 2, 10, 2); px(C.woodDD, 4, 2, 8, 1);
      px(C.outline, 2, 14, 12, 1);
    } else { // crate
      px(C.outline, 1, 2, 14, 13);
      px(C.wood, 2, 3, 12, 11);
      px(C.woodL, 2, 3, 12, 1); px(C.woodD, 2, 13, 12, 1);
      px(C.woodD, 2, 3, 1, 11); px(C.woodD, 13, 3, 1, 11);
      for (let i = 0; i < 10; i++) { px(C.woodD, 3 + i, 4 + i, 1, 1); px(C.woodD, 12 - i, 4 + i, 1, 1); }
      px(C.woodL, 3, 8, 10, 0);
    }
  }
  function sign() {
    groundShadow(8.5, 14.5, 4, 1.4);
    px(C.woodDD, 7, 9, 2, 6);
    px(C.outline, 1, 2, 14, 9);
    px(C.wood, 2, 3, 12, 7); px(C.woodL, 2, 3, 12, 1); px(C.woodD, 2, 9, 12, 1);
    px(C.woodDD, 4, 5, 8, 1); px(C.woodDD, 4, 7, 6, 1);
  }
  function well() {
    groundShadow(8.5, 14.5, 7, 1.6);
    // stone cylinder
    px(C.outline, 1, 7, 14, 8);
    px(C.stone, 2, 8, 12, 6);
    for (let x = 2; x < 14; x += 4) px(C.stoneD, x, 8, 1, 6);
    px(C.stoneD, 2, 11, 12, 1); px(C.stoneL, 2, 8, 12, 1);
    // rim + water
    blob(8, 7.5, 6.5, 2.6, (dx, dy, nd) => (nd > 1 ? null : nd > 0.7 ? C.stoneL : dy < 0 ? '#1d3a5a' : '#2d5a8a'));
    px(C.waterL, 9, 7, 2, 1);
    // posts + roof
    px(C.woodDD, 2, 1, 1, 7); px(C.woodDD, 13, 1, 1, 7);
    px('#a83a2c', 1, 0, 14, 2); px('#d6553e', 2, 0, 12, 1);
    px(C.woodDD, 3, 3, 10, 1); px('#6a6a72', 8, 4, 1, 2); px(C.wood, 7, 5, 3, 2);
  }
  function fence(gate) {
    const L = inSet('fF', at(-1, 0)), R = inSet('fF', at(1, 0));
    const Up = inSet('fF', at(0, -1)), Dn = inSet('fF', at(0, 1));
    const vertical = (Up || Dn) && !(L || R);
    if (gate) {
      if (vertical) { // posts top & bottom
        px(C.woodDD, 6, 0, 4, 3); px(C.wood, 7, 0, 2, 2);
        px(C.woodDD, 6, 13, 4, 3); px(C.wood, 7, 13, 2, 2);
      } else {
        groundShadow(2, 14, 2, 1); groundShadow(14, 14, 2, 1);
        px(C.outline, 0, 4, 3, 11); px(C.wood, 0, 5, 2, 9); px(C.woodL, 0, 5, 2, 1);
        px(C.outline, 13, 4, 3, 11); px(C.wood, 14, 5, 2, 9); px(C.woodL, 14, 5, 2, 1);
        px('#6a6a72', 2, 7, 1, 2);
      }
      return;
    }
    if (vertical) {
      px('rgba(30,20,10,0.25)', 9, 0, 1, T);
      px(C.outline, 5, 0, 1, T); px(C.outline, 10, 0, 1, T);
      px(C.wood, 6, 0, 4, T); px(C.woodL, 6, 0, 1, T); px(C.woodD, 9, 0, 1, T);
      px(C.outline, 5, 6, 6, 1); px(C.woodD, 6, 7, 4, 1);
      return;
    }
    groundShadow(8, 14.5, 3, 1);
    // rails
    const rx0 = L ? 0 : 6, rx1 = R ? 16 : 10;
    for (const ry of [5, 10]) {
      px(C.outline, rx0, ry - 1, rx1 - rx0, 4);
      px(C.wood, rx0, ry, rx1 - rx0, 2); px(C.woodL, rx0, ry, rx1 - rx0, 1);
    }
    // post
    px(C.outline, 5, 2, 6, 13);
    px(C.wood, 6, 3, 4, 11); px(C.woodL, 6, 3, 1, 11); px(C.woodD, 9, 3, 1, 11);
    px(C.woodL, 6, 2, 4, 1);
    if (Up) { px(C.outline, 5, 0, 6, 3); px(C.wood, 6, 0, 4, 3); }
    if (Dn) { px(C.outline, 5, 14, 6, 2); px(C.wood, 6, 14, 4, 2); }
  }

  // ------------------------------------------------------------------ buildings
  function roof() {
    const R = ROOFS[cell.extra % ROOFS.length];
    const up = at(0, -1) === '^', dn = at(0, 1) === '^', lf = at(-1, 0) === '^', rt = at(1, 0) === '^';
    const base = !up ? R.l : !dn ? R.d : R.b;
    const hi = !up ? sh(R.l, 0.25) : R.l;
    const lo = !up ? R.b : R.d;
    if (!up && (!lf || !rt)) paintGround(cell.g, cell.v); // hip corners show ground behind
    const cut = (x, y) => !up && ((!lf && x + y < 6) || (!rt && (15 - x) + y < 6));
    for (let y = 0; y < T; y++) {
      const r = y & 3;
      const row = r === 3 ? lo : r === 0 ? hi : base;
      for (let x = 0; x < T; x++) {
        if (cut(x, y)) continue;
        const off = ((y >> 2) + cell.ty) & 1 ? 0 : 4;
        let c = row;
        if (r !== 3 && (x - off + 16) % 8 === 0) c = lo;
        px(c, x, y);
      }
    }
    if (!up) { // ridge cap
      for (let x = 0; x < T; x++) { if (cut(x, 0)) continue; px(R.dd, x, 0); if (!cut(x, 1)) px(sh(R.l, 0.4), x, 1); }
      // hip trim along the diagonal
      if (!lf) for (let i = 0; i < 6; i++) { px(R.dd, 5 - i, i); px(R.dd, 6 - i, i); }
      if (!rt) for (let i = 0; i < 6; i++) { px(R.dd, 10 + i, i); px(R.dd, 9 + i, i); }
    }
    if (!dn) { // eaves overhang
      px(R.d, 0, 12, T, 2); px(R.dd, 0, 14, T, 2); px(sh(R.dd, -0.35), 0, 15, T, 1);
      for (let x = (cell.tx & 1) * 2; x < T; x += 4) px(sh(R.d, 0.15), x, 12, 2, 1);
    }
    if (!lf) { px(R.dd, 0, up ? 0 : 6, 1, up ? T : 10); px(sh(R.l, 0.2), 1, up ? 0 : 5, 1, up ? T : 11); }
    if (!rt) { px(R.dd, 15, up ? 0 : 6, 1, up ? T : 10); px(R.dd, 14, up ? 0 : 5, 1, up ? T : 11); }
    // chimney on a few ridge tiles
    if (!up && lf && rt && cell.v === 3) {
      px(C.outline, 9, 0, 6, 9); px('#b0503a', 10, 0, 4, 8); px('#d0705a', 10, 0, 4, 1);
      px('#8a3a2a', 10, 3, 4, 1); px('#8a3a2a', 12, 5, 1, 2); px('#3a2a2a', 10, 0, 4, 1);
    }
  }

  function houseWallBase(interior) {
    if (interior) { interiorWall(); return; }
    const up = at(0, -1), dn = at(0, 1);
    const lf = inSet(HOUSEADJ, at(-1, 0)), rt = inSet(HOUSEADJ, at(1, 0));
    px(C.plaster, 0, 0, T, T);
    seed(6000 + cell.v);
    for (let i = 0; i < 3; i++) px(C.plasterD, ri(1, 14), ri(3, 12));
    if (up === '^') { px('rgba(60,30,10,0.35)', 0, 0, T, 3); px('rgba(60,30,10,0.15)', 0, 3, T, 2); }
    else if (!inSet(HOUSEADJ, up)) { px(C.timberD, 0, 0, T, 1); px(C.timber, 0, 1, T, 2); }
    if (!inSet(HOUSEADJ, dn)) { // foundation
      px(C.stoneD, 0, 12, T, 4); px(C.stone, 0, 12, T, 1);
      for (let x = (cell.tx & 1) * 3; x < T; x += 6) px(C.stoneDD, x, 13, 1, 3);
      px(C.stoneDD, 0, 15, T, 1);
    }
    if (!lf) { px(C.timberD, 0, 0, 1, T); px(C.timber, 1, 0, 2, T - 4); }
    if (!rt) { px(C.timber, 13, 0, 2, T - 4); px(C.timberD, 15, 0, 1, T); }
  }
  function houseWall() { houseWallBase(isInteriorCtx()); }
  function isInteriorCtx() {
    return at(-1, 0) === 'n' || at(1, 0) === 'n' || at(0, -1) === 'n' || at(0, 1) === 'n' || !cell.outdoor;
  }
  function windowWall() {
    if (inSet('cC', at(-1, 0)) || inSet('cC', at(1, 0)) || inSet('cC', at(0, -1)) || inSet('cC', at(0, 1))) {
      // arched castle window
      castleWall(true);
      px(C.outline, 4, 3, 8, 10);
      px(C.stoneL, 5, 2, 6, 1); px(C.stoneL, 3, 4, 1, 9); px(C.stoneL, 12, 4, 1, 9);
      px('#2a2440', 5, 4, 6, 8); px('#2a2440', 6, 3, 4, 1);
      px('#ffd070', 5, 8, 6, 4); px('#ffe9a8', 5, 8, 6, 1);   // warm light inside
      px(C.outline, 7, 3, 2, 9); px(C.outline, 5, 7, 6, 1);
      px(C.stoneD, 3, 13, 10, 1); px(C.stoneL, 3, 12, 10, 1);
      return;
    }
    const interior = isInteriorCtx();
    houseWallBase(interior);
    const y0 = interior ? 3 : 3;
    px(C.outline, 3, y0, 10, 8);
    px(C.woodD, 3, y0, 10, 8);
    px(C.glass, 4, y0 + 1, 8, 6);
    px(C.glassD, 4, y0 + 4, 8, 3);
    px(C.glassL, 5, y0 + 1, 2, 1); px(C.glassL, 4, y0 + 2, 1, 2);
    px(C.woodD, 7, y0 + 1, 2, 6); px(C.woodD, 4, y0 + 3, 8, 1);
    if (interior) { // curtains
      px('#c84a4a', 3, y0, 2, 9); px('#c84a4a', 11, y0, 2, 9); px('#e87070', 3, y0, 1, 9);
    } else { // flower box
      px(C.woodDD, 2, y0 + 8, 12, 3); px(C.wood, 3, y0 + 8, 10, 1);
      const fl = ['#e8505a', '#f2c14e', '#f070b0'][cell.v % 3];
      for (let x = 3; x < 13; x += 3) { px('#3f8a3a', x, y0 + 7, 2, 1); px(fl, x, y0 + 6, 2, 1); }
    }
  }
  function door() {
    const lf = at(-1, 0), rt = at(1, 0), dn = at(0, 1);
    const ctxCh = inSet(HOUSE, lf) ? lf : inSet(HOUSE, rt) ? rt : inSet('cCw', lf) ? lf : inSet('cCw', rt) ? rt
      : (lf === 'n' || rt === 'n') ? 'n' : (lf === 'q' || rt === 'q') ? 'q' : null;
    if (ctxCh === '#' || ctxCh === 'W') {
      if (isInteriorCtx()) { interiorWall(); doorway(); return; }
      houseWallBase(false);
      px(C.outline, 2, 2, 12, 14);
      px(C.timber, 3, 3, 10, 13);
      px(C.wood, 4, 4, 8, 12);
      px(C.woodL, 4, 4, 8, 1);
      px(C.woodD, 6, 5, 1, 11); px(C.woodD, 9, 5, 1, 11);
      px(C.outline, 3, 2, 1, 1); px(C.outline, 12, 2, 1, 1);
      px('#f2c14e', 10, 10, 1, 2); px('#8a6a1a', 10, 12, 1, 1);
      px(C.stoneL, 2, 15, 12, 1);
      return;
    }
    if (ctxCh === 'c' || ctxCh === 'C' || ctxCh === 'w') {
      if (ctxCh === 'w') stoneWall(); else castleWall(true);
      px(C.outline, 2, 3, 12, 13);
      blob(8, 7, 5.5, 4.5, (dx, dy, nd) => (dy < 0 && nd <= 1 ? C.outline : null));
      px(C.woodD, 3, 5, 10, 11);
      blob(8, 7, 4.6, 3.7, (dx, dy, nd) => (dy < 0 && nd <= 1 ? C.woodD : null));
      for (let x = 4; x < 13; x += 3) px(C.wood, x, 5, 2, 11);
      px('#6a6a72', 3, 8, 10, 1); px('#6a6a72', 3, 12, 10, 1);
      px('#f2c14e', 10, 10, 1, 1);
      return;
    }
    if (ctxCh === 'n') { interiorWall(); doorway(); return; }
    if (ctxCh === 'q') { stands(); px(C.outline, 2, 2, 12, 14); px('#2a1c14', 3, 3, 10, 13); px('#c43c3c', 3, 3, 10, 2); return; }
    // free-standing / floor exit: a doormat on the ground
    paintGround(cell.g, cell.v);
    if (cell.outdoor && dn !== '"') {
      px(C.outline, 2, 2, 12, 14); px(C.wood, 3, 3, 10, 13); px(C.woodD, 6, 4, 1, 12); px(C.woodD, 9, 4, 1, 12);
      px('#f2c14e', 10, 10, 1, 2);
    } else {
      px('#7a2a2a', 1, 4, 14, 10); px('#b83c3c', 2, 5, 12, 8); px('#d8605a', 2, 5, 12, 1);
      px('#f2c14e', 3, 7, 10, 1); px('#f2c14e', 3, 10, 10, 1);
      for (let x = 2; x < 14; x += 2) { px('#e8d8b0', x, 3); px('#e8d8b0', x, 14); }
    }
  }
  function doorway() {
    px(C.outline, 3, 2, 10, 14);
    px('#2a1810', 4, 3, 8, 13);
    px('#4a2c1a', 4, 3, 8, 2);
    px(C.wainsD, 2, 2, 1, 14); px(C.wainsD, 13, 2, 1, 14);
  }

  function castleWall(noBattlement) {
    const up = at(0, -1);
    px(C.stoneD, 0, 0, T, T);
    // big blocks 8x5, staggered
    for (let r = 0; r < 4; r++) {
      const y = r * 4;
      const off = (r + cell.ty * 4) & 1 ? 4 : 0;
      for (let x = -off; x < T; x += 8) {
        px(C.stone, x + 1, y, 6, 3);
        px(C.stoneL, x + 1, y, 6, 1);
        px(C.stoneDD, x, y + 3, 8, 1);
      }
    }
    if (cell.v === 2 && at(0, 1) === 'c' && up === 'c') { // arrow slit
      px(C.stoneDD, 7, 4, 2, 8); px('#1a1418', 7, 5, 2, 6); px(C.stoneL, 6, 4, 1, 8);
    }
    if (!noBattlement && !inSet(CASTLE + '*', up) && !(up === '"' && !cell.outdoor)) {
      // merlons and crenels
      px(C.stoneDD, 0, 0, T, 5);
      const m = (cell.tx & 1) ? [[1, 6]] : [[1, 6], [9, 6]];
      void m;
      for (const mx of [1, 9]) {
        px(C.outline, mx - 1, 0, 8, 5);
        px(C.stone, mx, 0, 6, 4); px(C.stoneL, mx, 0, 6, 1); px(C.stoneD, mx + 5, 1, 1, 3);
      }
      px(C.outline, 0, 4, T, 1);
    }
    const lf = at(-1, 0), rt = at(1, 0);
    if (!inSet(CASTLEISH, lf)) { px(C.stoneDD, 0, 0, 1, T); px(C.stoneL, 1, 0, 1, T); }
    if (!inSet(CASTLEISH, rt)) px(C.outline, 15, 0, 1, T);
    if (!inSet(CASTLEISH, at(0, 1))) px(C.stoneDD, 0, 14, T, 2);
  }
  function battlement() {
    const up = inSet(CASTLE, at(0, -1)), dnCh = at(0, 1), dn = inSet(CASTLE, dnCh);
    const lf = inSet(CASTLE + '*', at(-1, 0)), rt = inSet(CASTLE + '*', at(1, 0));
    if (!up && (dnCh === 'c' || dnCh === 'g' || dnCh === '*')) {
      // front-facing crenellated top: merlons with shadowed crenels
      paintGround(cell.g, cell.v);
      px('#4c4a56', 0, 4, T, 6);                     // walkway shadow seen through crenels
      px(C.stoneD, 0, 9, T, 7);
      for (let x = (cell.ty & 1) * 4; x < T; x += 8) px(C.stoneDD, x, 12, 1, 4);
      px(C.stoneDD, 0, 11, T, 1);
      px(C.stoneL, 0, 9, T, 1);
      for (const mx of [1, 9]) {
        px(C.outline, mx - 1, 0, 8, 10);
        px(C.stone, mx, 1, 6, 9); px(C.stoneL, mx, 1, 6, 2); px(C.stoneD, mx + 5, 3, 1, 7);
        px(C.stoneD, mx, 6, 5, 1);
      }
      if (!lf) { px(C.outline, 0, 0, 1, T); }
      if (!rt) { px(C.outline, 15, 0, 1, T); }
      return;
    }
    // walkway flagstones (thick wall seen from above)
    px(C.stoneD, 0, 0, T, T);
    for (const [x, y] of [[0, 0], [8, 0], [0, 8], [8, 8]]) { px(C.stone, x + 1, y + 1, 7, 7); px(C.stoneL, x + 1, y + 1, 7, 1); }
    const merlonRow = (y) => {
      px(C.outline, 0, y, T, 6);
      for (const mx of [0, 8]) { px(C.stone, mx + 1, y, 6, 5); px(C.stoneL, mx + 1, y, 6, 1); px(C.stoneD, mx + 6, y + 1, 1, 4); }
      px(C.stoneDD, 0, y + 5, T, 1);
    };
    const merlonCol = (x) => {
      px(C.outline, x, 0, 5, T);
      for (const my of [0, 8]) { px(C.stone, x, my + 1, 4, 6); px(C.stoneL, x, my + 1, 4, 1); }
    };
    if (!up) merlonRow(0);
    if (!dn) merlonRow(10);
    if (!lf) merlonCol(0);
    if (!rt) merlonCol(11);
  }

  function gate() {
    const lf = at(-1, 0) === 'g', rt = at(1, 0) === 'g';
    castleWall(true);
    // arch: ellipse centered on the gate opening (spans a run of g tiles)
    let run0 = 0, run1 = 0;
    while (at(run0 - 1, 0) === 'g' && run0 > -4) run0--;
    while (at(run1 + 1, 0) === 'g' && run1 < 4) run1++;
    const cx = ((run0 + run1 + 1) * 16) / 2;          // in local px
    const rx = ((run1 - run0 + 1) * 16) / 2 - 2.5, ry = 6;
    const cy = 7;
    for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
      const inside = Math.abs(x + 0.5 - cx) <= rx && (y >= cy || dx * dx + dy * dy <= 1);
      const dx2 = (x + 0.5 - cx) / (rx + 2.5), dy2 = (y + 0.5 - cy) / (ry + 2.5);
      const ring = !inside && (Math.abs(x + 0.5 - cx) <= rx + 2.5) && (y >= cy ? false : dx2 * dx2 + dy2 * dy2 <= 1);
      if (inside) px(y < 9 ? '#1a1418' : '#241a20', x, y);
      else if (ring) px(((x + y) % 4 === 0) ? C.stoneDD : C.stoneL, x, y);
      else if (y >= cy && Math.abs(x + 0.5 - cx) <= rx + 2.5) px(((y % 4) === 0) ? C.stoneDD : C.stoneL, x, y); // jambs
    }
    // raised portcullis teeth
    for (let x = 1; x < T; x += 3) {
      if (Math.abs(x + 0.5 - cx) > rx - 1) continue;
      px('#6a6874', x, 3, 1, 5); px('#9a98a2', x, 8, 1, 1);
    }
    for (let x = 0; x < T; x++) if (Math.abs(x + 0.5 - cx) <= rx - 1) px('#6a6874', x, 5, 1, 1);
    // floor visible through the gate
    for (let x = 0; x < T; x++) if (Math.abs(x + 0.5 - cx) <= rx) { px(C.cobD, x, 13, 1, 3); if ((x + 1) % 4 < 2) px(C.cob, x, 14, 1, 1); }
    void lf; void rt;
  }

  function stoneWall() {
    const up = at(0, -1) === 'w';
    px(C.mortar, 0, 0, T, T);
    seed(7000 + cell.v);
    // irregular fieldstones
    let y = up ? 0 : 4;
    while (y < T) {
      const hgt = ri(3, 5);
      let x = -ri(0, 3);
      while (x < T) {
        const w = ri(4, 7);
        const col = rnd() < 0.35 ? C.rockD : C.rock;
        px(col, x + 1, y + 1, w - 1, hgt - 1);
        px(C.rockL, x + 1, y + 1, w - 2, 1);
        x += w;
      }
      y += hgt;
    }
    if (!up) { px(C.rockDD, 0, 0, T, 5); px(C.stoneL, 0, 0, T, 3); px(C.stone, 0, 3, T, 1); for (let x = 3; x < T; x += 5) px(C.stoneD, x, 0, 1, 3); }
    if (at(0, 1) !== 'w') px(C.rockDD, 0, 15, T, 1);
    // wall-mounted torches/banners and doors continue the wall: no edge seam beside them
    if (!inSet('wd*p', at(-1, 0))) px(C.rockDD, 0, 0, 1, T);
    if (!inSet('wd*p', at(1, 0))) px(C.rockDD, 15, 0, 1, T);
  }

  // ------------------------------------------------------------------ interiors
  function interiorWall() {
    const dn = at(0, 1), dn2 = at(0, 2), up = at(0, -1);
    const wallBelow = inSet('nW#l*', dn) || dn === '"';
    if (!wallBelow || dn === 'l') {
      // lower face: wallpaper top half + wainscot
      px(C.iwall, 0, 0, T, 7);
      for (let x = 1; x < T; x += 4) px(C.iwallS, x, 0, 2, 7);
      px(C.wainsD, 0, 7, T, 1); px(C.wainsL, 0, 8, T, 1);
      px(C.wains, 0, 9, T, 5);
      px(C.wainsD, 3, 10, 1, 3); px(C.wainsD, 11, 10, 1, 3);
      px(C.wainsL, 4, 10, 1, 3); px(C.wainsL, 12, 10, 1, 3);
      px(C.wainsD, 0, 14, T, 2);
      if (inSet('nW*', up)) return;
      px(C.timberD, 0, 0, T, 2);
      return;
    }
    if (!(inSet('nW#*', dn2) || dn2 === '"') || at(0, 2) === 'l') {
      // upper face: wallpaper with stripes, top molding when exposed
      px(C.iwall, 0, 0, T, T);
      for (let x = 1; x < T; x += 4) px(C.iwallS, x, 0, 2, T);
      if (!inSet('nW*', up)) { px(C.timberD, 0, 0, T, 3); px(C.timber, 0, 1, T, 1); }
      return;
    }
    // wall top (thickness, seen from above)
    px('#5e3a22', 0, 0, T, T);
    px('#7a4e2e', 1, 1, 14, 14);
    px('#6a4428', 0, 7, T, 1);
  }
  function counter() {
    const lf = at(-1, 0) === 'v', rt = at(1, 0) === 'v', up = at(0, -1) === 'v', dn = at(0, 1) === 'v';
    const top = up ? 0 : 2;
    px(C.outline, lf ? 0 : 1, top, (rt ? 16 : 15) - (lf ? 0 : 1), (dn ? 16 : 14) - top);
    px(C.woodL, lf ? 0 : 2, top + 1, (rt ? 16 : 14) - (lf ? 0 : 2), (dn ? 15 : 9) - top);
    px('#e8b47a', lf ? 0 : 2, top + 1, (rt ? 16 : 14) - (lf ? 0 : 2), 1);
    if (!dn) {
      px(C.wood, lf ? 0 : 2, 10, (rt ? 16 : 14) - (lf ? 0 : 2), 3);
      px(C.woodD, lf ? 0 : 2, 12, (rt ? 16 : 14) - (lf ? 0 : 2), 1);
      if (!lf) px(C.woodD, 2, 10, 1, 3);
      if (!rt) px(C.woodD, 13, 10, 1, 3);
    }
    if (cell.v === 1) { px('#e8e0d0', 5, 4, 4, 3); px('#c8a050', 6, 5, 2, 1); } // mug/plate
    if (cell.v === 4) { px('#f2c14e', 9, 5, 2, 2); px('#fff0a0', 9, 5, 1, 1); }  // coins
  }
  function bed(v) {
    px(C.outline, 1, 0, 14, 16);
    px(C.woodD, 2, 0, 12, 2);
    px('#f6f2ea', 3, 2, 10, 4); px('#dcd6ca', 3, 5, 10, 1);
    const q = ['#c84a4a', '#3f6fc4', '#4f9a4a'][v % 3];
    px(q, 2, 6, 12, 9); px(sh(q, 0.2), 2, 6, 12, 1);
    px(sh(q, -0.2), 4, 9, 8, 1); px(sh(q, -0.2), 4, 12, 8, 1); px(sh(q, -0.2), 7, 7, 2, 7);
    px(C.woodD, 2, 15, 12, 1);
  }
  function bookshelf(v) {
    px(C.outline, 0, 0, T, T);
    px(C.woodD, 1, 0, 14, 15);
    seed(8000 + v);
    const cols = ['#c84a4a', '#3f6fc4', '#4f9a4a', '#e0a030', '#7b3fb5', '#e8e0d0', '#8a5430'];
    for (const sy of [1, 6, 11]) {
      px(C.woodDD, 2, sy, 12, 4);
      let x = 2;
      while (x < 14) {
        const w = ri(1, 2), h = ri(3, 4);
        const c = cols[ri(0, cols.length - 1)];
        if (rnd() < 0.15) { x += 2; continue; }
        px(c, x, sy + 4 - h, Math.min(w, 14 - x), h);
        px(sh(c, 0.3), x, sy + 4 - h, 1, 1);
        x += w;
      }
      px(C.wood, 1, sy + 4, 14, 1);
    }
  }
  function stairs() {
    const g = cell.g;
    paintGround(g === 'k' || g === 'K' ? g : 'K', cell.v);
    px(C.outline, 1, 0, 14, 16);
    for (let i = 0; i < 4; i++) {
      const y = i * 4;
      const c = sh(C.sfloor, -0.08 * (3 - i));
      px(c, 2, y, 12, 3); px(sh(c, 0.25), 2, y, 12, 1); px(sh(c, -0.35), 2, y + 3, 12, 1);
    }
    px(C.wood, 1, 0, 1, 16); px(C.wood, 14, 0, 1, 16);
  }
  function voidTile() { px(C.void, 0, 0, T, T); }

  // ------------------------------------------------------------------ festive
  function stands() {
    const up = at(0, -1) === 'q', dn = at(0, 1) === 'q';
    seed(9000 + cell.tx * 7 + cell.ty * 13);
    if (!dn) {
      // front railing draped with cloth + bunting
      px('#6a4426', 0, 0, T, T);
      crowdRow(0);
      const stripe = (cell.tx & 1) ? '#c43c3c' : '#f2c14e';
      px(C.outline, 0, 6, T, 10);
      px(stripe, 0, 7, T, 8);
      px(sh(stripe, -0.2), 0, 13, T, 2);
      px(sh(stripe, 0.25), 0, 7, T, 1);
      // emblem on red
      if (cell.tx & 1) { px('#f2c14e', 6, 9, 4, 3); px('#c43c3c', 7, 10, 2, 1); }
      // bunting triangles
      for (let i = 0; i < 4; i++) {
        const col = ['#3f7fd1', '#f2c14e', '#d6453d', '#5bb04a'][(i + cell.tx) % 4];
        px(col, i * 4, 6, 3, 1); px(col, i * 4 + 1, 7, 1, 2);
      }
      px('#2b1d14', 0, 5, T, 1);
      return;
    }
    // benches with crowd
    px('#7a5030', 0, 0, T, T);
    if (!up) {
      // back wall with pennant poles
      px('#5a3820', 0, 0, T, 7);
      px('#8a5a34', 0, 6, T, 1);
      px('#d8d0c0', 3, 0, 1, 6);
      const pc = BANNERS[(cell.tx >> 1) % BANNERS.length];
      px(pc, 4, 0, 5, 2); px(pc, 4, 2, 3, 1); px(pc, 4, 3, 1, 1);
      crowdRow(9);
      return;
    }
    crowdRow(1); crowdRow(9);
  }
  function crowdRow(y) {
    px('#9a6a40', 0, y + 5, T, 2); px('#b88052', 0, y + 5, T, 1);
    const skins = ['#f1c27d', '#e0a878', '#c98e5d', '#f5d0a8', '#a87048'];
    const shirts = ['#d6453d', '#3f7fd1', '#5bb04a', '#f2c14e', '#7b3fb5', '#e07a3a', '#e8e0d0'];
    const hairs = ['#3a2414', '#7a4a24', '#d9a54a', '#1a1a1a', '#a0602a', '#d8d8d8'];
    for (let i = 0; i < 3; i++) {
      if (rnd() < 0.15) continue;
      const x = i * 5 + ri(0, 2);
      const shirt = shirts[ri(0, shirts.length - 1)];
      px(shirt, x, y + 3, 4, 3);
      px(skins[ri(0, skins.length - 1)], x + 1, y, 2, 3);
      px(hairs[ri(0, hairs.length - 1)], x + 1, y, 2, 1);
      if (rnd() < 0.3) { px(skins[0], x - 1 + (rnd() < 0.5 ? 0 : 5), y - 1, 1, 3); } // waving arm
    }
  }
  function tilt() {
    const vert = at(0, -1) === '|' || at(0, 1) === '|';
    const lf = at(-1, 0) === '|', rt = at(1, 0) === '|';
    if (vert) {
      px('rgba(40,20,10,0.25)', 10, 0, 2, T);
      px(C.outline, 5, 0, 6, T);
      for (let y = 0; y < T; y += 4) { px('#e8e0d0', 6, y, 4, 2); px('#c43c3c', 6, y + 2, 4, 2); }
      px('rgba(255,255,255,0.3)', 6, 0, 1, T);
      return;
    }
    groundShadow(8, 13, 8, 1.6);
    px(C.outline, lf ? 0 : 1, 5, (rt ? 16 : 15) - (lf ? 0 : 1), 7);
    for (let x = 0; x < T; x += 4) { px('#e8e0d0', x, 6, 2, 5); px('#c43c3c', x + 2, 6, 2, 5); }
    if (!lf) px(C.outline, 0, 0, 2, 0);
    px('rgba(255,255,255,0.35)', 0, 6, T, 1);
    px(C.woodD, 2, 11, 2, 4); px(C.woodD, 12, 11, 2, 4);
  }
  function bannerPole(v) {
    const lf = at(-1, 0), rt = at(1, 0);
    const wallCh = inSet('#Wcwn', lf) ? lf : inSet('#Wcwn', rt) ? rt : null;
    const c = BANNERS[v % BANNERS.length];
    if (wallCh) {
      // hanging wall banner
      const save = cell.ch; cell.ch = wallCh === 'W' ? '#' : wallCh;
      if (cell.ch === 'n') interiorWall(); else if (cell.ch === 'c') castleWall(true); else if (cell.ch === 'w') stoneWall(); else houseWallBase(!cell.outdoor);
      cell.ch = save;
      px(C.outline, 3, 1, 10, 1); px('#d8b050', 3, 1, 10, 1); px(C.outline, 3, 2, 10, 1);
      px(C.outline, 4, 2, 8, 12);
      px(c, 5, 2, 6, 10); px(sh(c, 0.2), 5, 2, 6, 1); px(sh(c, -0.25), 10, 3, 1, 9);
      px(c, 5, 12, 2, 1); px(c, 9, 12, 2, 1); px(c, 5, 13, 1, 1); px(c, 10, 13, 1, 1);
      px('#f2c14e', 7, 5, 2, 3); px('#f2c14e', 6, 6, 4, 1);
      return;
    }
    groundShadow(8, 14.5, 3, 1);
    px(C.outline, 7, 1, 3, 15); px('#d8d0c0', 8, 2, 1, 13);
    px('#f2c14e', 7, 0, 3, 2); px('#fff0a0', 8, 0, 1, 1);
    px(C.outline, 9, 2, 6, 10);
    px(c, 10, 3, 4, 8); px(sh(c, 0.2), 10, 3, 4, 1);
    px(c, 10, 11, 1, 1); px(c, 13, 11, 1, 1);
    px('#f2c14e', 11, 5, 2, 3); px(sh(c, -0.25), 13, 3, 1, 8);
  }

  function stall() {
    // awning color shared by a run of stalls
    const pal = AWNINGS[cell.extra % AWNINGS.length];
    const lf = at(-1, 0) === 'm', rt = at(1, 0) === 'm';
    // goods counter
    px(C.outline, lf ? 0 : 1, 8, (rt ? 16 : 15) - (lf ? 0 : 1), 8);
    px(C.wood, lf ? 0 : 2, 9, (rt ? 16 : 14) - (lf ? 0 : 2), 6);
    px(C.woodL, lf ? 0 : 2, 9, (rt ? 16 : 14) - (lf ? 0 : 2), 1);
    const goods = [['#e04a3a', '#ff9080'], ['#f2c14e', '#fff0a0'], ['#5bb04a', '#a0e080'], ['#d8a060', '#f0d0a0']][cell.v % 4];
    for (let x = 3; x < 13; x += 3) { px(goods[0], x, 10, 2, 2); px(goods[1], x, 10, 1, 1); }
    if (!lf) px(C.woodDD, 1, 2, 1, 13);
    if (!rt) px(C.woodDD, 14, 2, 1, 13);
    // awning
    px(C.outline, 0, 0, T, 8);
    for (let x = 0; x < T; x += 4) { px(pal[0], x, 0, 2, 7); px(pal[1], x + 2, 0, 2, 7); }
    px('rgba(255,255,255,0.25)', 0, 0, T, 1);
    // scalloped edge
    for (let x = 0; x < T; x += 4) { px(pal[0], x, 7, 2, 1); px(pal[1], x + 2, 7, 2, 1); px(C.outline, x, 8, 4, 0); }
    for (let x = 1; x < T; x += 4) px(C.outline, x + 1, 7, 1, 1);
  }
  function bridge() {
    const wUp = inSet('~;', at(0, -1)), wDn = inSet('~;', at(0, 1));
    const horiz = wUp || wDn || ((at(-1, 0) === 'B' || at(1, 0) === 'B') && !(at(0, -1) === 'B' || at(0, 1) === 'B'));
    px(C.waterD, 0, 0, T, T);
    if (horiz) {
      for (let x = 0; x < T; x += 4) { px(C.woodL, x, 2, 3, 12); px(C.woodD, x + 3, 2, 1, 12); }
      px(C.woodDD, 0, 0, T, 2); px(C.wood, 0, 0, T, 1);
      px(C.woodDD, 0, 14, T, 2); px(C.wood, 0, 14, T, 1);
      px(C.woodDD, 0, 15, T, 1);
      if (at(-1, 0) !== 'B') { px(C.woodDD, 0, 0, 2, 3); px(C.woodDD, 0, 13, 2, 3); }
      if (at(1, 0) !== 'B') { px(C.woodDD, 14, 0, 2, 3); px(C.woodDD, 14, 13, 2, 3); }
    } else {
      for (let y = 0; y < T; y += 4) { px(C.woodL, 2, y, 12, 3); px(C.woodD, 2, y + 3, 12, 1); }
      px(C.woodDD, 0, 0, 2, T); px(C.wood, 0, 0, 1, T);
      px(C.woodDD, 14, 0, 2, T); px(C.wood, 15, 0, 1, T);
      if (at(0, -1) !== 'B') { px(C.woodDD, 0, 0, 3, 2); px(C.woodDD, 13, 0, 3, 2); }
      if (at(0, 1) !== 'B') { px(C.woodDD, 0, 14, 3, 2); px(C.woodDD, 13, 14, 3, 2); }
    }
  }
  function torchBase() {
    // wall-mounted if beside/above a wall, else standing post
    const lf = at(-1, 0), rt = at(1, 0), up = at(0, -1);
    const wallCh = inSet('ncw#', lf) ? lf : inSet('ncw#', rt) ? rt : inSet('ncw#', up) ? up : null;
    if (wallCh) {
      const save = cell.ch; cell.ch = wallCh;
      if (wallCh === 'n') interiorWall(); else if (wallCh === 'c') castleWall(); else if (wallCh === 'w') stoneWall(); else houseWallBase(false);
      cell.ch = save;
      px(C.outline, 6, 8, 4, 5); px('#5a5862', 7, 8, 2, 4); px('#8a8892', 5, 12, 6, 1);
      px(C.woodDD, 7, 5, 2, 4);
    } else {
      groundShadow(8, 14.5, 3.5, 1.2);
      px(C.outline, 6, 6, 4, 10); px(C.woodD, 7, 6, 2, 9); px(C.wood, 7, 6, 1, 9);
      px('#5a5862', 5, 5, 6, 2);
    }
  }

  // ------------------------------------------------------------------ dispatch
  // object chars that sit on a ground
  const ON_GROUND = 'TtrbfFhxSop|m*euvlB';
  function paintCell(ch) {
    const v = cell.v;
    if (inSet(ON_GROUND, ch) && ch !== 'B' && ch !== 'l' && ch !== 'v' && ch !== 'e' && ch !== 'u') paintGround(cell.g, v);
    if (ch === 'v' || ch === 'e') { paintGround(cell.g === '.' && !cell.outdoor ? 'k' : cell.g, v); }
    switch (ch) {
      case '.': grass(v); topShadow(); break;
      case ':': grass(v); topShadow(); break; // flowers drawn animated on top
      case ',': tallGrass(false); topShadow(); break;
      case '_': case '=': case 's': case 'a': case 'k': case 'K': paintGround(ch, v); break;
      case '~': case ';': waterBase(); break;
      case 'T': tree(v); break;
      case 't': pine(v); break;
      case 'r': rock(v); break;
      case 'b': bush(v); break;
      case 'f': fence(false); break;
      case 'F': fence(true); break;
      case 'w': stoneWall(); break;
      case '#': houseWall(); break;
      case 'W': windowWall(); break;
      case '^': roof(); break;
      case 'd': door(); break;
      case 'h': hay(); break;
      case 'x': crate(v); break;
      case 'S': sign(); break;
      case 'B': bridge(); break;
      case 'o': well(); break;
      case 'c': castleWall(); break;
      case 'C': battlement(); break;
      case 'g': gate(); break;
      case 'n': interiorWall(); break;
      case 'v': counter(); break;
      case 'e': bed(v); break;
      case 'l': bookshelf(v); break;
      case 'q': stands(); break;
      case '|': tilt(); break;
      case 'p': bannerPole(v); break;
      case 'm': stall(); break;
      case 'u': stairs(); break;
      case '"': voidTile(); break;
      case '*': torchBase(); break;
      default: grass(v);
    }
  }

  // ------------------------------------------------------------------ map prep
  function prepare(map) {
    const rows = map.tiles || [];
    const h = rows.length, w = rows.reduce((m, r) => Math.max(m, r.length), 0);
    const outdoor = map.outdoor !== false && !(map.outdoor == null && /[nkK]/.test(rows.join('')) && !/[.,]/.test(rows.join('')));
    const N = w * h;
    const ground = new Array(N);
    const extra = new Uint8Array(N);
    const chAt = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : rows[y][x] || '.');
    // ground pass
    const defG = outdoor ? '.' : 'k';
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, ch = chAt(x, y);
        if (GROUNDS.indexOf(ch) >= 0) { ground[i] = ch; continue; }
        if (ch === '~' || ch === ';') { ground[i] = ch; continue; }
        if (pass === 0) ground[i] = null;
        if (ground[i]) continue;
        // pick most common ground among neighbors
        let best = null, bestN = 0;
        const cnt = {};
        for (const [dx, dy] of [[0, 1], [0, -1], [-1, 0], [1, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
          const c = chAt(x + dx, y + dy);
          let gch = c && GROUNDS.indexOf(c) >= 0 ? c : (pass > 0 && c ? ground[(y + dy) * w + x + dx] : null);
          if (!gch || gch === '~' || gch === ';') continue;
          if (gch === ',' || gch === ':') gch = '.';
          cnt[gch] = (cnt[gch] || 0) + (dx && dy ? 1 : 2);
          if (cnt[gch] > bestN) { bestN = cnt[gch]; best = gch; }
        }
        if (best) ground[i] = best;
        else if (pass === 2) ground[i] = defG;
      }
    }
    for (let i = 0; i < N; i++) if (!ground[i]) ground[i] = defG;
    // region colors for roofs and market stalls
    const seen = new Uint8Array(N);
    let regionN = 0;
    const seedBase = hashStr(map.id || 'map');
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ch = chAt(x, y);
      if ((ch !== '^' && ch !== 'm') || seen[y * w + x]) continue;
      const stack = [[x, y]];
      const cells = [];
      seen[y * w + x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push(cy * w + cx);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (chAt(nx, ny) === ch && !seen[ny * w + nx]) { seen[ny * w + nx] = 1; stack.push([nx, ny]); }
        }
      }
      const col = map.roofColors && ch === '^' && map.roofColors[regionN] != null
        ? map.roofColors[regionN]
        : Math.floor(U.hash2(seedBase + regionN * 17, x * 3 + y * 5) * 1000) + regionN;
      regionN++;
      for (const i of cells) extra[i] = col % 251;
    }
    return { w, h, rows, ground, extra, outdoor };
  }
  function hashStr(s) { let hh = 7; for (let i = 0; i < s.length; i++) hh = (hh * 31 + s.charCodeAt(i)) | 0; return Math.abs(hh) % 10007; }

  // Signature of everything a tile's art depends on (for sprite caching).
  function setCell(info, x, y) {
    cell.rows = info.rows; cell.w = info.w; cell.h = info.h; cell.info = info; cell.outdoor = info.outdoor;
    cell.tx = x; cell.ty = y;
    cell.ch = info.rows[y][x] || '.';
    if (!DEFS[cell.ch]) cell.ch = '.';
    cell.g = info.ground[y * info.w + x];
    cell.v = Math.floor(U.hash2(x, y) * 8);
    cell.extra = info.extra[y * info.w + x];
  }
  function aboveClass() {
    const a = at(0, -1);
    return inSet(TALLSOLID, a) ? 'S' : a === 'T' || a === 't' ? 'T' : '-';
  }
  function groundSig(g) {
    let s = g + cell.v + aboveClass();
    if (g === '_' || g === '=' || g === 's') {
      let b = 0;
      if (isGrassy(gAt(0, -1))) b |= 1; if (isGrassy(gAt(0, 1))) b |= 2; if (isGrassy(gAt(-1, 0))) b |= 4; if (isGrassy(gAt(1, 0))) b |= 8;
      if (isGrassy(gAt(-1, -1))) b |= 16; if (isGrassy(gAt(1, -1))) b |= 32; if (isGrassy(gAt(-1, 1))) b |= 64; if (isGrassy(gAt(1, 1))) b |= 128;
      s += b;
    }
    return s;
  }
  function signature() {
    const ch = cell.ch;
    switch (ch) {
      case '.': case ':': return ch + cell.v + aboveClass();
      case ',': return ',' + aboveClass();
      case '_': case '=': case 's': case 'a': case 'k': case 'K': return 'G' + groundSig(ch);
      case '~': case ';': return '~';
      case '"': return '"';
      case 'T': case 't': case 'r': case 'b': case 'h': case 'x': case 'S': case 'o': case 'p':
        return ch + cell.v + '|' + groundSig(cell.g);
      case 'f': case 'F': {
        let b = 0;
        if (inSet('fF', at(-1, 0))) b |= 1; if (inSet('fF', at(1, 0))) b |= 2; if (inSet('fF', at(0, -1))) b |= 4; if (inSet('fF', at(0, 1))) b |= 8;
        return ch + b + '|' + groundSig(cell.g);
      }
    }
    let s = ch + cell.g + cell.v + '|' + cell.extra + '|' + (cell.tx & 1) + (cell.ty & 1) + (cell.outdoor ? 'o' : 'i');
    for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += at(dx, dy);
    s += groundSig(cell.g);
    if (ch === 'q') s += cell.tx + ',' + cell.ty; // crowds are unique
    return s;
  }

  const spriteCache = new Map();
  function cellSprite() {
    const key = signature();
    let c = spriteCache.get(key);
    if (c) return c;
    let x;
    [c, x] = G.gfx.makeCanvas(T, T);
    const prev = X; X = x;
    try { paintCell(cell.ch); } catch (e) { console.error('tile paint error', cell.ch, e); }
    X = prev;
    if (spriteCache.size > 6000) spriteCache.clear();
    spriteCache.set(key, c);
    return c;
  }

  // ------------------------------------------------------------------ animated frames
  const NF = 4;
  const animCache = new Map();
  function animFrame(key, paint) {
    let c = animCache.get(key);
    if (c) return c;
    let x;
    [c, x] = G.gfx.makeCanvas(T, T);
    const prev = X; X = x;
    try { paint(); } catch (e) { console.error('anim paint error', key, e); }
    X = prev;
    animCache.set(key, c);
    return c;
  }
  function waterMask(info, x, y) {
    const land = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= info.w || ny >= info.h) return false;
      return WATERY.indexOf(info.rows[ny][nx]) < 0;
    };
    let m = 0;
    if (land(0, -1)) m |= 1; if (land(1, 0)) m |= 2; if (land(0, 1)) m |= 4; if (land(-1, 0)) m |= 8;
    if (!(m & 9) && land(-1, -1)) m |= 16;
    if (!(m & 3) && land(1, -1)) m |= 32;
    if (!(m & 6) && land(1, 1)) m |= 64;
    if (!(m & 12) && land(-1, 1)) m |= 128;
    return m;
  }
  function paintWater(mask, variant, f, ford) {
    const base = ford ? C.ford : C.water, dk = ford ? C.fordD : C.waterD, lt = ford ? C.fordL : C.waterL;
    px(base, 0, 0, T, T);
    // depth bands
    px(dk, 0, 10 + (variant & 1), T, 1);
    // shimmer streaks drifting
    const sx = (f * 2 + variant * 5) % 16;
    const ph = f & 1;
    px(lt, (sx + 2) % 14, 3 + variant, 3, 1);
    px(lt, (sx + 9) % 13, 9 - variant + ph, 2 + ph, 1);
    px(dk, (sx + 5) % 12, 6 + ph, 4, 1);
    if (ford) {
      // stepping stones
      for (const [x, y] of [[3, 4], [10, 9]]) {
        px(C.rockDD, x - 1, y, 5, 3); px(C.rock, x, y - 1 + 0, 3, 3); px(C.rockL, x, y - 1, 2, 1);
        px(C.foam, x - 2 + (f & 1), y + 2, 1, 1); px(C.foam, x + 3 - (f & 1), y + 2, 1, 1);
      }
    }
    // shore: dark bank line + animated foam
    const fo = f % 4;
    const foamRow = (horiz, pos, inward) => {
      for (let i = 0; i < T; i++) {
        const on = ((i + fo * 2) % 6) < 4;
        const p2 = pos + inward * (on ? 1 : 2);
        if (horiz) { px(C.waterDD, i, pos, 1, 1); if (on) px(C.foam, i, pos + inward); else px(lt, i, p2); }
        else { px(C.waterDD, pos, i, 1, 1); if (on) px(C.foam, pos + inward, i); else px(lt, p2, i); }
      }
    };
    if (mask & 1) foamRow(true, 0, 1);
    if (mask & 4) foamRow(true, 15, -1);
    if (mask & 8) foamRow(false, 0, 1);
    if (mask & 2) foamRow(false, 15, -1);
    const cornerFoam = (x, y, dx, dy) => { px(C.waterDD, x, y); px(C.foam, x + dx, y); px(C.foam, x, y + dy); if (fo & 1) px(C.foam, x + dx, y + dy); };
    if (mask & 16) cornerFoam(0, 0, 1, 1);
    if (mask & 32) cornerFoam(15, 0, -1, 1);
    if (mask & 64) cornerFoam(15, 15, -1, -1);
    if (mask & 128) cornerFoam(0, 15, 1, -1);
  }
  function paintFlowers(v, f) {
    seed(1200 + v * 31);
    const cols = [['#f05a5a', '#ffd0d0'], ['#fff8e8', '#f2c14e'], ['#f6d040', '#fff8c0'], ['#f080c0', '#ffd0f0'], ['#8ab0ff', '#e0ecff']];
    const sway = [0, 1, 0, -1][f];
    const spots = [[3, 4], [10, 2], [6, 10], [12, 11]];
    for (let i = 0; i < spots.length; i++) {
      if (i === 3 && (v & 1)) continue;
      const [x, y] = spots[i];
      const [c, cc] = cols[(v + i * 2) % cols.length];
      const s = (i & 1) ? -sway : sway;
      px('#3f8a3a', x + 1, y + 3, 1, 2);
      px(C.grassD, x, y + 5, 3, 1);
      const hx = x + s;
      px(c, hx + 1, y, 1, 1); px(c, hx, y + 1, 1, 1); px(c, hx + 2, y + 1, 1, 1); px(c, hx + 1, y + 2, 1, 1);
      px(cc, hx + 1, y + 1, 1, 1);
    }
  }
  function paintFlame(f, wall) {
    const by = wall ? 5 : 6;
    const shapes = [
      [[7, by - 4, 2, 4], [6, by - 2, 4, 2], [8, by - 5, 1, 1]],
      [[7, by - 5, 2, 5], [6, by - 2, 4, 2], [7, by - 6, 1, 1]],
      [[6, by - 4, 3, 4], [7, by - 2, 3, 2], [6, by - 5, 1, 1]],
      [[7, by - 4, 3, 4], [6, by - 2, 4, 2], [9, by - 5, 1, 1]],
    ][f];
    for (const [x, y, w, h] of shapes) px('#e8502a', x - 1, y, w + 2, h);
    for (const [x, y, w, h] of shapes) px('#f8a030', x, y, w, h);
    px('#fff4a0', 7, by - 2, 2, 2);
  }
  let glow = null;
  function getGlow() {
    if (glow) return glow;
    let x;
    [glow, x] = G.gfx.makeCanvas(48, 48);
    const g = x.createRadialGradient(24, 24, 2, 24, 24, 24);
    g.addColorStop(0, 'rgba(255,200,90,0.45)'); g.addColorStop(0.5, 'rgba(255,150,50,0.15)'); g.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = g; x.fillRect(0, 0, 48, 48);
    return glow;
  }

  // ------------------------------------------------------------------ map gfx (chunks)
  const CH = 16; // chunk size in tiles
  function buildMap(map) {
    const info = prepare(map);
    const cw = Math.ceil(info.w / CH), chh = Math.ceil(info.h / CH);
    const chunks = [];
    for (let cy = 0; cy < chh; cy++) for (let cx = 0; cx < cw; cx++) {
      const x0 = cx * CH, y0 = cy * CH;
      const tw = Math.min(CH, info.w - x0), th = Math.min(CH, info.h - y0);
      const [can, cx2] = G.gfx.makeCanvas(tw * T, th * T);
      const anims = [];
      for (let y = y0; y < y0 + th; y++) for (let x = x0; x < x0 + tw; x++) {
        setCell(info, x, y);
        cx2.drawImage(cellSprite(), (x - x0) * T, (y - y0) * T);
        const ch = cell.ch;
        if (ch === '~' || ch === ';') anims.push(y * info.w + x, 0, waterMask(info, x, y));
        else if (ch === ':') anims.push(y * info.w + x, 1, cell.v);
        else if (ch === '*') {
          const wallMounted = inSet('ncw#', at(-1, 0)) || inSet('ncw#', at(1, 0)) || inSet('ncw#', at(0, -1));
          anims.push(y * info.w + x, 2, wallMounted ? 1 : 0);
        }
      }
      chunks.push({ x0, y0, tw, th, canvas: can, anims: Int32Array.from(anims) });
    }
    return { info, w: info.w, h: info.h, cw, chh, chunks, map };
  }

  function drawAnim(ctx, kind, data, idx, sx, sy, t, w) {
    const tx = idx % w, ty = (idx - tx) / w;
    if (kind === 0) {
      const ford = mapRowsCur && mapRowsCur[ty][tx] === ';';
      const variant = (tx * 7 + ty * 3) & 1;
      const f = (Math.floor(t * 3.2 + (tx + ty) * 0.25)) % NF;
      const key = (ford ? 100000 : 0) + data * 100 + variant * 10 + f;
      let c = animCache.get(key);
      if (!c) c = animFrame(key, () => paintWater(data, variant, f, ford));
      ctx.drawImage(c, sx, sy);
    } else if (kind === 1) {
      const f = Math.floor(t * 2.5 + tx * 0.7 + ty * 0.3) % NF;
      const key = 200000 + data * 10 + f;
      let c = animCache.get(key);
      if (!c) c = animFrame(key, () => paintFlowers(data, f));
      ctx.drawImage(c, sx, sy);
    } else if (kind === 2) {
      const f = Math.floor(t * 9 + tx * 1.3 + ty) % NF;
      const g = getGlow();
      const a = 0.75 + 0.25 * Math.sin(t * 13 + tx);
      ctx.globalAlpha = a;
      ctx.drawImage(g, sx - 16, sy - 20 + (data ? -1 : 0));
      ctx.globalAlpha = 1;
      const key = 300000 + data * 10 + f;
      let c = animCache.get(key);
      if (!c) c = animFrame(key, () => paintFlame(f, !!data));
      ctx.drawImage(c, sx, sy);
    }
  }
  let mapRowsCur = null;

  // Draw a built map: view rect in world px (camX, camY, vw, vh), at screen offset 0,0.
  function drawMap(ctx, mg, camX, camY, vw, vh, t) {
    mapRowsCur = mg.info.rows;
    const cpx = CH * T;
    const c0 = Math.max(0, Math.floor(camX / cpx)), c1 = Math.min(mg.cw - 1, Math.floor((camX + vw) / cpx));
    const r0 = Math.max(0, Math.floor(camY / cpx)), r1 = Math.min(mg.chh - 1, Math.floor((camY + vh) / cpx));
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const ch = mg.chunks[cy * mg.cw + cx];
      ctx.drawImage(ch.canvas, ch.x0 * T - camX, ch.y0 * T - camY);
    }
    const tx0 = Math.floor(camX / T) - 1, tx1 = Math.ceil((camX + vw) / T) + 1;
    const ty0 = Math.floor(camY / T) - 1, ty1 = Math.ceil((camY + vh) / T) + 1;
    const w = mg.w;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const a = mg.chunks[cy * mg.cw + cx].anims;
      for (let i = 0; i < a.length; i += 3) {
        const idx = a[i];
        const tx = idx % w, ty = (idx - tx) / w;
        if (tx < tx0 || tx > tx1 || ty < ty0 || ty > ty1) continue;
        drawAnim(ctx, a[i + 1], a[i + 2], idx, tx * T - camX, ty * T - camY, t, w);
      }
    }
  }

  // ------------------------------------------------------------------ sprites for the overworld
  let grassFront = null, grassFull = null;
  function getGrassFront() {
    if (grassFront) return grassFront;
    let x;
    [grassFront, x] = G.gfx.makeCanvas(T, T);
    const prev = X; X = x; tallGrass(true); X = prev;
    return grassFront;
  }
  function getGrassFull() {
    if (grassFull) return grassFull;
    let x;
    [grassFull, x] = G.gfx.makeCanvas(T, T);
    const prev = X; X = x; tallGrass(false); X = prev;
    return grassFull;
  }

  // Slow path: draw a single tile anywhere (e.g. map previews). mapCtx: {tiles, tx, ty, outdoor} optional.
  function drawTile(ctx, ch, x, y, mapCtx) {
    let info;
    if (mapCtx && mapCtx.tiles) {
      info = mapCtx.__info || (mapCtx.__info = prepare({ tiles: mapCtx.tiles, outdoor: mapCtx.outdoor, id: mapCtx.id }));
      setCell(info, mapCtx.tx, mapCtx.ty);
    } else {
      info = { w: 1, h: 1, rows: [ch], ground: [GROUNDS.indexOf(ch) >= 0 ? ch : '.'], extra: [0], outdoor: true };
      setCell(info, 0, 0);
    }
    ctx.drawImage(cellSprite(), x, y);
    if (ch === ':' || ch === '~' || ch === ';' || ch === '*') {
      const prevRows = mapRowsCur; mapRowsCur = info.rows;
      const kind = ch === ':' ? 1 : ch === '*' ? 2 : 0;
      const data = kind === 0 ? waterMask(info, cell.tx, cell.ty) : kind === 1 ? cell.v : 0;
      drawAnim(ctx, kind, data, cell.ty * info.w + cell.tx, x, y, G.time, info.w);
      mapRowsCur = prevRows;
    }
  }

  G.tiles = {
    T, defs: DEFS, C,
    solid: (ch) => { const d = DEFS[ch]; return d ? d.solid : false; },
    known: (ch) => !!DEFS[ch],
    draw: drawTile,
    buildMap, drawMap, prepare,
    grassFront: getGrassFront, grassFull: getGrassFull,
    clearCache() { spriteCache.clear(); animCache.clear(); },
  };
})();
