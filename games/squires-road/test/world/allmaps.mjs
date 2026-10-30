import { writeFileSync } from 'node:fs';
export default async (page, h) => {
  const ids = await h.eval(() => Object.keys(G.maps).filter((k) => !k.startsWith('__')));
  console.log('maps:', ids.join(' '));
  const probs = await h.eval(() => G.debug.validateAll());
  console.log(JSON.stringify(probs, null, 1));
  const t0 = Date.now();
  for (const id of ids) {
    const r = await h.eval((id) => {
      const t = performance.now();
      const m = G.maps[id];
      const mg = G.tiles.buildMap(m);
      const bt = performance.now() - t;
      const [c, x] = G.gfx.makeCanvas(mg.w * 16, mg.h * 16);
      G.tiles.drawMap(x, mg, 0, 0, mg.w * 16, mg.h * 16, 0.3);
      for (const n of m.npcs || []) G.chars.draw(x, n.look || 'villagerM', n.dir || 'down', 0, n.x * 16 + 8, n.y * 16 + 16);
      return { url: c.toDataURL('image/png'), w: mg.w, h: mg.h, bt: Math.round(bt) };
    }, id);
    writeFileSync(`test/shots/world/maps/${id}.png`, Buffer.from(r.url.split(',')[1], 'base64'));
    console.log(id, r.w + 'x' + r.h, 'build ms', r.bt);
  }
};
