// Static validator for content maps. Loads core util + data + content in a vm with a stub G.
// Usage: node test/content/validate.mjs [--print mapId|all] [--quiet]
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const src = join(root, 'src');
const args = process.argv.slice(2);
const printArg = args.includes('--print') ? args[args.indexOf('--print') + 1] : null;

const ctx = { console, Math, JSON, Object, Array, Set, Map, Promise, setTimeout };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
const load = (f) => vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
load(join(src, 'core', 'util.js'));
ctx.G.looks = {};
for (const d of ['data', 'content']) {
  const dir = join(src, d);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) if (f.endsWith('.js')) load(join(dir, f));
}
const G = ctx.G;
const L = G.content.lib;
const REQUIRED = ['thornbrook_stable', 'thornbrook', 'thornbrook_aldric', 'thornbrook_store', 'thornbrook_inn', 'thornbrook_pit', 'route1',
  'millbridge', 'millbridge_inn', 'millbridge_bowyer', 'millbridge_smith', 'millbridge_range', 'route2', 'harrowfield', 'harrowfield_inn',
  'harrowfield_stable', 'harrowfield_armory', 'harrowfield_lists', 'route3', 'bandit_camp', 'crownhold', 'crownhold_inn', 'crownhold_market',
  'crownhold_castle', 'crownhold_arena'];

const errs = [], warns = [];
const E = (m) => errs.push(m), W = (m) => warns.push(m);
const maps = {};
for (const id of Object.keys(G.maps)) {
  try { maps[id] = G.maps[id]; } catch (e) { E(`${id}: builder threw ${e.stack}`); }
}
for (const id of REQUIRED) if (!maps[id]) E(`missing required map ${id}`);

const walk = (m, x, y) => y >= 0 && y < m.tiles.length && x >= 0 && x < m.tiles[0].length && L.WALK.has(m.tiles[y][x]);
const inb = (m, x, y) => y >= 0 && y < m.tiles.length && x >= 0 && x < m.tiles[0].length;
const objAt = (m, x, y) => (m.npcs || []).some((n) => n.x === x && n.y === y && !n.cond) || (m.objects || []).some((o) => o.x === x && o.y === y);

for (const [id, m] of Object.entries(maps)) {
  if (m.id !== id) E(`${id}: id mismatch (${m.id})`);
  if (!m.name) W(`${id}: no name`);
  const t = m.tiles;
  if (!Array.isArray(t) || !t.length) { E(`${id}: no tiles`); continue; }
  const w = t[0].length;
  t.forEach((r, y) => {
    if (r.length !== w) E(`${id}: row ${y} length ${r.length} != ${w}`);
    for (const ch of r) if (!L.LEGAL.has(ch)) E(`${id}: illegal char '${ch}' in row ${y}`);
  });
  // outdoor maps must be closed except at warps
  if (m.outdoor) {
    for (let x = 0; x < w; x++) for (const y of [0, t.length - 1]) if (walk(m, x, y) && !(m.warps || []).some((p) => p.x === x && p.y === y)) E(`${id}: open border at ${x},${y} without warp`);
    for (let y = 0; y < t.length; y++) for (const x of [0, w - 1]) if (walk(m, x, y) && !(m.warps || []).some((p) => p.x === x && p.y === y)) E(`${id}: open border at ${x},${y} without warp`);
  }
  for (const p of m.warps || []) {
    if (!inb(m, p.x, p.y)) E(`${id}: warp out of bounds ${p.x},${p.y}`);
    else if (!walk(m, p.x, p.y)) E(`${id}: warp at ${p.x},${p.y} on solid '${t[p.y][p.x]}'`);
    const tm = maps[p.to];
    if (!tm) { E(`${id}: warp to missing map ${p.to}`); continue; }
    if (!walk(tm, p.tx, p.ty)) E(`${id}: warp ${p.x},${p.y} lands on non-walkable ${p.to} ${p.tx},${p.ty} '${tm.tiles[p.ty] && tm.tiles[p.ty][p.tx]}'`);
    if ((tm.warps || []).some((q) => q.x === p.tx && q.y === p.ty)) E(`${id}: warp ${p.x},${p.y} lands ON a warp in ${p.to}`);
    if (objAt(tm, p.tx, p.ty)) E(`${id}: warp ${p.x},${p.y} lands on an npc/object in ${p.to}`);
    // return warp: some warp in target back to this map landing within 2 tiles of this warp
    const back = (tm.warps || []).find((q) => q.to === id && Math.abs(q.tx - p.x) + Math.abs(q.ty - p.y) <= 2);
    if (!back) E(`${id}: warp ${p.x},${p.y} -> ${p.to} has no return warp nearby`);
    else if (Math.abs(back.x - p.tx) + Math.abs(back.y - p.ty) > 2) W(`${id}: return warp from ${p.to} is far from landing`);
  }
  // doors must have warps
  t.forEach((r, y) => { for (let x = 0; x < r.length; x++) if ((r[x] === 'd') && !(m.warps || []).some((p) => p.x === x && p.y === y)) E(`${id}: door at ${x},${y} without warp`); });
  for (const n of m.npcs || []) {
    if (!n.id) E(`${id}: npc without id`);
    if (!inb(m, n.x, n.y)) E(`${id}: npc ${n.id} out of bounds`);
    else if (!walk(m, n.x, n.y) && !n.onSolid) E(`${id}: npc ${n.id} on solid '${t[n.y][n.x]}' at ${n.x},${n.y}`);
    if (!n.script && !n.trainer) W(`${id}: npc ${n.id} has no script`);
    if (n.trainer && !n.trainer.flag) E(`${id}: trainer ${n.id} without flag`);
    if ((m.warps || []).some((p) => p.x === n.x && p.y === n.y)) E(`${id}: npc ${n.id} on a warp`);
  }
  const ids = new Set();
  for (const n of m.npcs || []) { if (ids.has(n.id)) E(`${id}: duplicate npc id ${n.id}`); ids.add(n.id); }
  for (const s of m.signs || []) {
    if (!inb(m, s.x, s.y)) E(`${id}: sign out of bounds`);
    else if (t[s.y][s.x] !== 'S') W(`${id}: sign at ${s.x},${s.y} not on S tile`);
    if (!s.text) E(`${id}: sign without text`);
  }
  t.forEach((r, y) => { for (let x = 0; x < r.length; x++) if (r[x] === 'S' && !(m.signs || []).some((s) => s.x === x && s.y === y)) W(`${id}: S tile at ${x},${y} has no sign`); });
  for (const o of m.objects || []) {
    if (!inb(m, o.x, o.y)) E(`${id}: object out of bounds`);
    else if (!walk(m, o.x, o.y)) E(`${id}: object ${o.id} on solid '${t[o.y][o.x]}'`);
    if (!o.id) E(`${id}: object without id`);
    if (o.item && !G.items[o.item]) E(`${id}: object ${o.id} unknown item ${o.item}`);
  }
  if (m.outdoor && m.encounters) for (const e of m.encounters) if (!e.enemies || !e.enemies.length) E(`${id}: bad encounter`);
}
// global unique object ids
const oids = new Map();
for (const [id, m] of Object.entries(maps)) for (const o of m.objects || []) { if (oids.has(o.id)) E(`object id ${o.id} duplicated in ${id} and ${oids.get(o.id)}`); oids.set(o.id, id); }

// reachability via BFS (walkable tiles + warps; npcs ignored)
const seen = new Set();
const key = (m, x, y) => `${m}:${x},${y}`;
const q = [['thornbrook_stable', 3, 3]];
if (maps.thornbrook_stable && !walk(maps.thornbrook_stable, 3, 3)) E('thornbrook_stable (3,3) not walkable');
const mapsSeen = new Set();
while (q.length) {
  const [mid, x, y] = q.pop();
  const m = maps[mid];
  if (!m || !walk(m, x, y)) continue;
  const k = key(mid, x, y);
  if (seen.has(k)) continue;
  seen.add(k); mapsSeen.add(mid);
  const wp = (m.warps || []).find((p) => p.x === x && p.y === y);
  if (wp) { q.push([wp.to, wp.tx, wp.ty]); continue; }
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) q.push([mid, x + dx, y + dy]);
}
for (const id of Object.keys(maps)) if (!mapsSeen.has(id)) E(`map ${id} not reachable from thornbrook_stable`);
// every npc / object / sign reachable (adjacent tile reachable)
for (const [id, m] of Object.entries(maps)) {
  const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has(key(id, x + dx, y + dy)));
  for (const n of m.npcs || []) if (!near(n.x, n.y)) W(`${id}: npc ${n.id} at ${n.x},${n.y} unreachable`);
  for (const o of m.objects || []) if (!near(o.x, o.y)) E(`${id}: object ${o.id} at ${o.x},${o.y} unreachable`);
  for (const s of m.signs || []) if (!near(s.x, s.y)) W(`${id}: sign at ${s.x},${s.y} unreachable`);
}

if (printArg) {
  for (const id of printArg === 'all' ? Object.keys(maps) : printArg.split(',')) {
    const m = maps[id]; if (!m) continue;
    const g = m.tiles.map((r) => r.split(''));
    for (const n of m.npcs || []) if (g[n.y]) g[n.y][n.x] = '@';
    for (const o of m.objects || []) if (g[o.y]) g[o.y][o.x] = '$';
    for (const p of m.warps || []) if (g[p.y] && g[p.y][p.x] !== 'd' && g[p.y][p.x] !== 'g') g[p.y][p.x] = '>';
    console.log(`\n== ${id} (${m.tiles[0].length}x${m.tiles.length}) ${m.name}`);
    console.log('   ' + Array.from({ length: g[0].length }, (_, i) => i % 10).join(''));
    g.forEach((r, y) => console.log(String(y).padStart(2) + ' ' + r.join('')));
  }
}
const n = Object.keys(maps).length;
for (const w of warns) console.log('warn:', w);
for (const e of errs) console.log('ERROR:', e);
console.log(`${n} maps, ${errs.length} errors, ${warns.length} warnings`);
process.exit(errs.length ? 1 : 0);
