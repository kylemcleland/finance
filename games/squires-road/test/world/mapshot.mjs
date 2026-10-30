// Renders whole maps (static + animated layers) to PNGs at 3x. MAPS env: comma list (default all __test*)
import { writeFileSync } from 'node:fs';
export default async (page, h) => {
  const ids = process.env.MAPS ? process.env.MAPS.split(',') : await h.eval(() => Object.keys(G.maps).filter((k) => k.startsWith('__test')));
  const sc = Number(process.env.SCALE || 3);
  for (const id of ids) {
    const data = await h.eval(([id, sc]) => {
      const m = G.maps[id]; if (!m) return null;
      const mg = G.tiles.buildMap(Object.assign({ id }, m));
      const [c, x] = G.gfx.makeCanvas(mg.w * 16, mg.h * 16);
      G.tiles.drawMap(x, mg, 0, 0, mg.w * 16, mg.h * 16, 0.3);
      const [c2, x2] = G.gfx.makeCanvas(mg.w * 16 * sc, mg.h * 16 * sc);
      x2.imageSmoothingEnabled = false; x2.drawImage(c, 0, 0, c2.width, c2.height);
      return c2.toDataURL('image/png');
    }, [id, sc]);
    if (!data) { console.log('missing', id); continue; }
    const p = `${process.env.OUT || 'test/shots/world'}/map_${id}.png`;
    writeFileSync(p, Buffer.from(data.split(',')[1], 'base64'));
    console.log('map:', p);
  }
};
