export default async (page, h) => {
  const m = process.env.MAP;
  const r = await h.eval((m) => G.maps[m].tiles, m);
  const [x0, y0, x1, y1] = (process.env.R || '0,0,999,999').split(',').map(Number);
  r.slice(y0, y1 + 1).forEach((row, i) => console.log(String(y0 + i).padStart(2), row.slice(x0, x1 + 1)));
};
