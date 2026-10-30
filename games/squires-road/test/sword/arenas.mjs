// Screenshot each arena with a different foe set (intro + mid-fight).
const SETS = [
  ['pit', ['pit_tom'], {}],
  ['field', ['wolf', 'wolf', 'wolf'], {}],
  ['forest', ['boar'], {}],
  ['road', ['bandit', 'bandit_thug'], { canFlee: true }],
  ['castle', ['gareth'], { boss: true, title: 'Grand Tourney — Sword' }],
  ['practice', ['dummy'], {}],
];
export default async function (page, h) {
  const only = process.env.ARENA;
  for (const [arena, enemies, extra] of SETS) {
    if (only && only !== arena) continue;
    await h.eval(({ arena, enemies, extra }) => {
      G.state.hp = G.player.maxHp();
      window.__res = null;
      G.battle.start('sword', Object.assign({ enemies, arena }, extra)).then((r) => (window.__res = r));
    }, { arena, enemies, extra });
    await h.wait(1300);
    await h.shot(`${arena}_intro`);
    await h.wait(1800);
    await h.shot(`${arena}_fight`);
    await h.wait(1500);
    await h.shot(`${arena}_fight2`);
    await h.eval(() => G.debug.skipBattle(true));
    await h.wait(1200);
    console.log(arena, JSON.stringify(await h.eval(() => window.__res)));
  }
}
