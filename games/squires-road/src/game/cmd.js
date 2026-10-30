// Core script commands (G.cmd). World/menus modules add more onto G.cmd.
(() => {
  const P = () => G.player;
  const c = {
    say: (text, o) => G.ui.say(text, o),
    ask: (text, choices, o) => G.ui.ask(text, choices, o),
    menu: (title, items, o) => G.ui.menu(title, items, o),
    flag: (name) => G.state.flags[name],
    setFlag: (name, v = true) => { G.state.flags[name] = v; },
    give(id, qty = 1, quiet) {
      P().give(id, qty);
      if (!quiet) {
        const it = G.items[id];
        G.sfx.play('coin');
        G.ui.toast(`Got ${qty > 1 ? qty + '× ' : ''}${it ? it.name : id}!`, '#ffe48a');
      }
    },
    take: (id, qty = 1) => P().take(id, qty),
    has: (id) => P().has(id),
    count: (id) => P().count(id),
    gold(n) {
      P().addGold(n);
      if (n > 0) G.ui.toast(`+${n} gold`, '#ffe48a');
      else if (n < 0) G.ui.toast(`${n} gold`, '#ffb08a');
    },
    canAfford: (n) => G.state.gold >= n,
    heal() { P().heal('full'); G.sfx.play('heal'); },
    xp(n) { const ups = P().gainXp(n); G.ui.toast(`+${Math.round(n)} XP`, '#9fd8ff'); return ups; },
    seal(discipline) {
      G.state.seals[discipline] = true;
      G.sfx.play('win');
      const names = { sword: 'Seal of the Blade', archery: 'Seal of the Arrow', joust: 'Seal of the Lance', grand: 'Crown of the Realm' };
      G.ui.toast(`You earned the ${names[discipline] || discipline}!`, '#ffe48a');
    },
    battle: (type, opts) => G.battle.start(type, opts),
    wait: (ms) => G.U.sleep(ms),
    toast: (t, col) => G.ui.toast(t, col),
    sfx: (n) => G.sfx.play(n),
    music: (n) => G.music.play(n),
    level: () => G.state.level,
    sealCount: () => Object.entries(G.state.seals).filter(([k, v]) => v && k !== 'grand').length,
    // Rewards for defeating roster enemies of a discipline (used by encounters + trainers).
    reward(kind, ids, mult = 1) {
      let xp = 0, gold = 0;
      for (const id of ids) {
        const r = G.roster[kind] && G.roster[kind][id];
        if (r) { xp += r.xp || 0; gold += r.gold || 0; }
      }
      xp = Math.round(xp * mult); gold = Math.round(gold * mult * G.U.rand(0.8, 1.2));
      if (gold) P().addGold(gold);
      const ups = P().gainXp(xp);
      G.ui.toast(`+${xp} XP${gold ? `  +${gold} gold` : ''}`, '#ffe48a');
      return { xp, gold, ups };
    },
  };
  G.cmd = c;
})();
