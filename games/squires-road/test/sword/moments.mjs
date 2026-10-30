import { BOT } from './bot.mjs';
async function until(h, fn, ms = 15000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await h.eval(fn)) return true; await h.wait(16); } return false; }
export default async function (page, h) {
  await h.eval(BOT);
  const start = (o, lvl, gear) => h.eval(({ o, lvl, gear }) => { G.newGame(); G.state.level = lvl; for (const g of gear) G.debug.equip(g); G.state.hp = G.player.maxHp(); window.__res = null; G.battle.start('sword', o).then((r) => (window.__res = r)); }, { o, lvl, gear });
  // white telegraph
  await start({ enemies: ['hedge_knight'], arena: 'road' }, 4, ['rusty_sword', 'buckler']);
  await until(h, () => { const b = G.battle.active; if (!b) return false; const e = b._s.enemies[0]; return e.state === 'windup' && e.st > e.wind * 0.5; });
  await h.shot('m_telegraph_white');
  await h.eval(() => G.debug.skipBattle(true)); await h.wait(1500);
  // red slam telegraph (troll)
  await start({ enemies: ['river_troll'], arena: 'field', boss: true }, 10, ['steel_sword', 'kite_shield']);
  await until(h, () => { const b = G.battle.active; if (!b) return false; const e = b._s.enemies[0]; return e.state === 'windup' && e.mv.col === 'r' && e.st > e.wind * 0.6; }, 30000);
  await h.shot('m_telegraph_red');
  await h.eval(() => G.debug.skipBattle(true)); await h.wait(1500);
  // parry flash + enemy open, with the skilled bot
  await start({ enemies: ['bram'], arena: 'pit', boss: true }, 6, ['iron_sword', 'buckler']);
  await h.wait(900);
  await h.eval('window.__startBot("skilled")');
  await until(h, () => { const b = G.battle.active; return b && b._s.stats.parries > 0; }, 30000);
  await h.wait(30);
  await h.shot('m_parry');
  await h.wait(350);
  await h.shot('m_parry_open');
  await until(h, () => { const b = G.battle.active; return b && b._s.enemies[0].phase2; }, 40000);
  await h.wait(250);
  await h.shot('m_phase2');
  await until(h, () => window.__res && true, 60000);
  console.log('bram', JSON.stringify(await h.eval(() => window.__res)));
  // boar charge lane & wall stun
  await start({ enemies: ['boar'], arena: 'forest' }, 3, ['rusty_sword']);
  await until(h, () => { const b = G.battle.active; if (!b) return false; const e = b._s.enemies[0]; return e.state === 'stun'; }, 30000);
  await h.wait(100);
  await h.shot('m_boar_stun');
  await h.eval(() => G.debug.skipBattle(true)); await h.wait(1500);
}
