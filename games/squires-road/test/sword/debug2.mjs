import { BOT, fight } from './bot.mjs';
export default async function (page, h) {
  await h.eval(BOT);
  const r1 = await fight(h, { level: 1, enemies: ['pit_tom'], mode: 'skilled' });
  console.log('1', JSON.stringify(r1));
  await h.wait(1500);
  const p = (async () => { for (let i = 0; i < 12; i++) { await h.wait(700); console.log(JSON.stringify(await h.eval(() => { const b = G.battle.active; if (!b) return 'none'; const s = b._s; return { ph: s.phase, st: s.P.state, sw: s.P.sw && s.P.sw.ph, keyB: s.P.keyB, press: s.P.press, sta: Math.round(s.P.sta), x: Math.round(s.P.x), y: Math.round(s.P.y), e: s.enemies[0].state, ex: Math.round(s.enemies[0].x), ey: Math.round(s.enemies[0].y), keys: [...'WASDXZC'].map(k=>G.input.keyDown('Key'+k)?k:'').join(''), stick: G.input.stick.mag, bot: window.__botOn }; }))); } })();
  const r2 = await fight(h, { level: 1, enemies: ['pit_tom'], mode: 'skilled', timeout: 10000 });
  await p;
  console.log('2', JSON.stringify(r2));
}
