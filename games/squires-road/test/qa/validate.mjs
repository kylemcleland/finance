export default async (page, h) => {
  await h.eval(() => G.debug.newGame());
  await h.wait(300);
  const r = await h.eval(() => G.debug.validateAll());
  console.log(JSON.stringify(r, null, 1));
  // reachability: BFS from each warp landing over walkable tiles; list warps/npcs unreachable
  const rep = await h.eval(() => {
    const out = {};
    const solid = (c) => G.tiles.solid(c);
    for (const id in G.maps) {
      const m = G.maps[id]; const rows = m.tiles; const H = rows.length, W = rows[0].length;
      const npcs = new Set((m.npcs || []).filter(n => !n.cond || true).map(n => n.x + ',' + n.y));
      const objs = new Set((m.objects || []).map(o => o.x + ',' + o.y));
      // starting points: warp targets into this map from other maps
      const starts = [];
      for (const oid in G.maps) for (const w of G.maps[oid].warps || []) if (w.to === id) starts.push([w.tx, w.ty]);
      if (!starts.length) continue;
      const seen = new Set(); const q = [];
      for (const s of starts) { q.push(s); seen.add(s + ''); }
      while (q.length) {
        const [x, y] = q.shift();
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
          const nx = x+dx, ny = y+dy; const k = nx+','+ny;
          if (nx<0||ny<0||nx>=W||ny>=H||seen.has(k)) continue;
          if (solid(rows[ny][nx]) || objs.has(k)) continue;
          seen.add(k); q.push([nx, ny]);
        }
      }
      const probs = [];
      for (const w of m.warps || []) if (!seen.has(w.x+','+w.y)) probs.push('warp unreachable '+w.x+','+w.y+'->'+w.to);
      const adj = (x,y) => [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => seen.has((x+dx)+','+(y+dy)));
      const adj2 = (x,y) => [[2,0],[-2,0],[0,2],[0,-2]].some(([dx,dy]) => seen.has((x+dx)+','+(y+dy)));
      for (const n of m.npcs || []) if (!adj(n.x, n.y) && !adj2(n.x,n.y)) probs.push('npc unreachable '+n.id);
      for (const o of m.objects || []) if (!adj(o.x, o.y)) probs.push('obj unreachable '+o.id);
      for (const s of m.signs || []) if (!adj(s.x, s.y)) probs.push('sign unreachable '+s.x+','+s.y);
      if (probs.length) out[id] = probs;
    }
    return out;
  });
  console.log('REACH', JSON.stringify(rep, null, 1));
};
