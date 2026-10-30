// Sword roster (DESIGN.md §7a, §12). Stats are derived from the target player
// level so balance stays consistent: `hits` = average player hits (with the
// expected gear at that level) to beat it, `kills` = clean enemy hits needed to
// beat the player. Explicit hp/dmg override the formula.
(() => {
  const R = G.roster.sword;

  // Expected player numbers at level L (stick L1-2, rusty L3-4, iron L5-9, steel L10+).
  const atkAt = (L) => (L <= 2 ? 4 : L <= 4 ? 7 : L <= 9 ? 11 : 18) * (1 + 0.02 * (L - 1)) * 1.17;
  const hpAt = (L) => 40 + 8 * (L - 1) + (L <= 2 ? 0 : L <= 4 ? 6 : L <= 9 ? 12 : L <= 15 ? 20 : 35);
  const pdefAt = (L) => (L <= 2 ? 0 : L <= 4 ? 1 : L <= 9 ? 2 : L <= 15 ? 4 : 7);
  const xpW = (L) => Math.round(5 + 3 * Math.pow(L, 1.2));
  const goldW = (L) => Math.round(2 + 2 * L);

  function add(id, L, o) {
    const def = o.def ?? Math.floor((L - 1) / 4);
    const per = Math.max(1, atkAt(L) - def);
    const hits = o.hits ?? 8, kills = o.kills ?? 7;
    const mult = o.boss ? 3 : o.cup ? 1.5 : 1;
    R[id] = {
      id, level: L,
      name: o.name, title: o.title || '',
      look: o.look,
      hp: o.hp ?? Math.round(per * hits),
      dmg: o.dmg ?? Math.round(hpAt(L) / kills + pdefAt(L)),
      def,
      speed: o.speed ?? +(0.95 + L * 0.013).toFixed(2),
      ai: o.ai, weapon: o.weapon || 'short', shield: !!o.shield,
      aggression: o.aggression ?? 0.55,
      xp: o.xp ?? Math.round(xpW(L) * mult),
      gold: o.gold ?? Math.round(goldW(L) * mult),
      boss: !!o.boss,
      tele: o.tele, // optional telegraph-length multiplier (bigger = slower, kinder)
      wcolor: o.wcolor, scolor: o.scolor,
    };
  }

  // Custom looks (human). Creatures use the strings 'wolf', 'wolf_alpha', 'boar', 'troll', 'dummy'.
  const L = {
    thug: { skin: '#d9a77a', hair: '#2a1a10', hairStyle: 'bald', beard: '#3a2414', tunic: '#6a4a2a', tunic2: '#4a3020', pants: '#3a2a1a', boots: '#1f150e' },
    duelist: { skin: '#f0c9a0', hair: '#3a2414', hairStyle: 'long', tunic: '#2f6a5a', tunic2: '#e8d8a8', pants: '#3a3a30', boots: '#22201a', hat: '#2a4a40' },
    tom: { skin: '#e9b98a', hair: '#8a5a2a', hairStyle: 'short', tunic: '#9a6a3a', apron: '#6a4022', pants: '#5a4632', boots: '#33251a' },
    meg: { skin: '#f5cfa8', hair: '#c2552c', hairStyle: 'spiky', tunic: '#7a2f3a', pants: '#4a3a2a', boots: '#2a1a10' },
    oswin: { skin: '#e2ae80', hair: '#5a3a1a', tunic: '#5a5a66', tunic2: '#9a9aa8', pants: '#3a3a44', boots: '#22222a', helmet: '#8a8f99' },
    squireA: { skin: '#f1c27d', hair: '#4a2c16', tunic: '#3f6a9a', tunic2: '#d8c890', pants: '#4a4032', boots: '#2b2016' },
    squireB: { skin: '#f5cfa8', hair: '#d9a54a', hairStyle: 'long', tunic: '#8a3f7a', tunic2: '#e8d8a8', pants: '#3a2f3a', boots: '#221a22' },
    squireC: { skin: '#d9a77a', hair: '#2a1a10', tunic: '#7a6a2a', tunic2: '#c9b45a', pants: '#4a4a40', boots: '#2b2b20', helmet: '#9a9488' },
    brannoc: { skin: '#e2ae80', hair: '#3a2a1a', tunic: '#2f5a3a', tunic2: '#e8e8e8', pants: '#4a4a55', boots: '#2b2b33', helmet: '#a8acb6', plume: '#2f8a4a' },
    halden: { skin: '#c98e5d', hair: '#5a3a1a', hairStyle: 'bald', beard: '#7a4a24', tunic: '#7a3a1a', tunic2: '#c9a050', pants: '#3a2a1a', boots: '#1f150e', helmet: '#7a7f8a' },
    ysolde: { skin: '#f4d0b0', hair: '#e8e0d0', hairStyle: 'long', tunic: '#3a3a7a', tunic2: '#c0c8e8', pants: '#3a3a4a', boots: '#22222e', cape: '#5a5aa0' },
    brigand: { skin: '#d9a77a', hair: '#1a1a1a', tunic: '#4a2a2a', pants: '#2a2020', boots: '#1a1010', hood: '#2a1a1a' },
    brute: { skin: '#b07a50', hair: '#1a1a1a', hairStyle: 'bald', beard: '#1a1a1a', tunic: '#3a3a3a', tunic2: '#6a2a2a', pants: '#2a2020', boots: '#141010' },
    rogue: { skin: '#d9a77a', hair: '#1a1a1a', tunic: '#2a2a30', tunic2: '#6a1a1a', pants: '#1f1f24', boots: '#101014', helmet: '#3a3a44', plume: '#6a1a1a', cape: '#3a1010' },
    crownA: { skin: '#e2ae80', hair: '#3a2a1a', tunic: '#8a1f2f', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#c8ccd6', plume: '#f2c14e', cape: '#5a1020' },
    crownB: { skin: '#f0c9a0', hair: '#6a4a2a', tunic: '#8a1f2f', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#c8ccd6', plume: '#ffffff' },
    crownC: { skin: '#c98e5d', hair: '#1a1a1a', tunic: '#8a1f2f', tunic2: '#f2c14e', pants: '#3a3a44', boots: '#22222a', helmet: '#9aa0aa', plume: '#8a1f2f', cape: '#3a0a14' },
    cedric3: { skin: '#f7d2a6', hair: '#f0d264', hairStyle: 'short', tunic: '#7b3fb5', tunic2: '#f2c14e', pants: '#2f2f3f', boots: '#1d1d26', cape: '#4b2a7a', helmet: '#d8dce6', plume: '#f2c14e' },
    gareth: { skin: '#e9b98a', hair: '#a0602a', beard: '#a0602a', tunic: '#2a5aa0', tunic2: '#f2c14e', pants: '#4a4a55', boots: '#2b2b33', helmet: '#d8dce6', plume: '#2a5aa0', cape: '#1a3a7a' },
    aldric: { skin: '#e8b98a', hair: '#d8d8d8', hairStyle: 'short', beard: '#e2e2e2', tunic: '#7d6b52', tunic2: '#a89878', pants: '#4a3b2a', boots: '#2e2015', cape: '#5a2e2e' },
  };

  // ---- Training & rivals ----
  add('dummy', 1, { name: 'Training Dummy', look: 'dummy', ai: 'dummy', hp: 26, dmg: 0, def: 0, weapon: 'none', xp: 5, gold: 0, aggression: 0 });
  add('aldric_spar', 1, { name: 'Sir Aldric', title: 'Retired Knight', look: L.aldric, ai: 'knight', weapon: 'long', shield: true, hits: 9, kills: 11, aggression: 0.3, speed: 0.9, tele: 1.6, wcolor: '#c8ccd6', scolor: '#7a4a2a' });
  add('cedric1', 1, { name: 'Cedric of Vane', title: 'Lordling', look: 'cedric', ai: 'duelist', weapon: 'long', hits: 10, kills: 6, aggression: 0.6, speed: 0.95, wcolor: '#f0f4ff' });
  add('cedric2', 8, { name: 'Cedric of Vane', title: 'Rival', look: 'cedric', ai: 'duelist', weapon: 'long', hits: 16, kills: 5, aggression: 0.75, wcolor: '#f0f4ff', boss: true });
  add('cedric3', 17, { name: 'Cedric of Vane', title: 'Knight-Errant', look: L.cedric3, ai: 'champion', weapon: 'long', hits: 18, kills: 5, aggression: 0.75, wcolor: '#ffe48a', boss: true });

  // ---- Route 1 wilds ----
  add('wolf', 2, { name: 'Grey Wolf', look: 'wolf', ai: 'wolf', weapon: 'fangs', hits: 5, kills: 9, speed: 1.05, aggression: 0.6 });
  add('wolf_alpha', 4, { name: 'Alpha Wolf', look: 'wolf_alpha', ai: 'wolf', weapon: 'fangs', hits: 9, kills: 6, speed: 1.12, aggression: 0.75 });
  add('boar', 3, { name: 'Wild Boar', look: 'boar', ai: 'boar', weapon: 'tusks', hits: 8, kills: 5, aggression: 0.5 });
  add('bandit', 3, { name: 'Bandit', look: 'bandit', ai: 'bandit', weapon: 'short', hits: 7, kills: 7, aggression: 0.55 });
  add('bandit_thug', 5, { name: 'Bandit Thug', look: L.thug, ai: 'brawler', weapon: 'club', hits: 9, kills: 6, aggression: 0.6 });
  add('hedge_knight', 4, { name: 'Hedge Knight', look: 'hedgeKnight', ai: 'knight', weapon: 'long', shield: true, hits: 9, kills: 7, scolor: '#6a7a4a' });
  add('hedge_duelist', 6, { name: 'Hedge Duelist', look: L.duelist, ai: 'duelist', weapon: 'long', hits: 9, kills: 6, aggression: 0.6 });

  // ---- Thornbrook Sword Pit ----
  add('pit_tom', 2, { name: 'Tom the Tanner', look: L.tom, ai: 'brawler', weapon: 'club', hits: 7, kills: 8, aggression: 0.45, cup: true });
  add('pit_meg', 3, { name: 'Mad Meg', look: L.meg, ai: 'brawler', weapon: 'short', hits: 7, kills: 7, speed: 1.1, aggression: 0.8, cup: true });
  add('pit_oswin', 4, { name: 'Oswin Ironside', look: L.oswin, ai: 'knight', weapon: 'short', shield: true, hits: 8, kills: 7, cup: true, scolor: '#7a7f8a' });
  add('pit_squire1', 5, { name: 'Squire Alan', look: L.squireA, ai: 'brawler', weapon: 'long', hits: 9, kills: 7, cup: true });
  add('pit_squire2', 6, { name: 'Squire Bess', look: L.squireB, ai: 'duelist', weapon: 'short', hits: 9, kills: 7, cup: true });
  add('pit_squire3', 7, { name: 'Squire Rolf', look: L.squireC, ai: 'knight', weapon: 'long', shield: true, hits: 10, kills: 6, cup: true, scolor: '#9a8a3a' });
  add('pit_knight1', 9, { name: 'Sir Brannoc', look: L.brannoc, ai: 'knight', weapon: 'long', shield: true, hits: 10, kills: 6, cup: true, scolor: '#2f5a3a' });
  add('pit_knight2', 10, { name: 'Sir Halden the Ox', look: L.halden, ai: 'heavy', weapon: 'axe', hits: 11, kills: 5, speed: 0.95, cup: true });
  add('pit_knight3', 12, { name: 'Dame Ysolde', look: L.ysolde, ai: 'duelist', weapon: 'long', hits: 11, kills: 6, aggression: 0.7, cup: true, wcolor: '#e8f0ff' });
  add('bram', 6, { name: 'Bram', title: 'Pit Master', look: 'bram', ai: 'champion', weapon: 'axe', hits: 16, kills: 5, aggression: 0.65, boss: true });

  // ---- Route 2 / Route 3 ----
  add('river_troll', 10, { name: 'River Troll', look: 'troll', ai: 'heavy', weapon: 'club', hits: 18, kills: 4, speed: 0.9, aggression: 0.55, boss: true });
  add('brigand', 12, { name: 'Brigand', look: L.brigand, ai: 'bandit', weapon: 'short', hits: 8, kills: 7, aggression: 0.6 });
  add('brigand_brute', 14, { name: 'Brigand Brute', look: L.brute, ai: 'heavy', weapon: 'axe', hits: 11, kills: 5 });
  add('rogue_knight', 15, { name: 'Rogue Knight', look: L.rogue, ai: 'knight', weapon: 'long', shield: true, hits: 11, kills: 6, aggression: 0.65, scolor: '#2a2a30' });
  add('black_hugh', 16, { name: 'Black Hugh', title: 'Bandit King', look: 'hugh', ai: 'champion', weapon: 'axe', hits: 20, kills: 5, aggression: 0.75, boss: true });

  // ---- Crownhold / Grand Tourney ----
  add('crown_knight1', 16, { name: 'Sir Aldous', title: 'Crown Knight', look: L.crownA, ai: 'knight', weapon: 'long', shield: true, hits: 11, kills: 6, cup: true, scolor: '#8a1f2f' });
  add('crown_knight2', 18, { name: 'Sir Selwyn', title: 'Crown Knight', look: L.crownB, ai: 'duelist', weapon: 'long', hits: 12, kills: 6, aggression: 0.7, cup: true });
  add('crown_knight3', 20, { name: 'Sir Morrow', title: 'Crown Knight', look: L.crownC, ai: 'heavy', weapon: 'axe', hits: 13, kills: 5, cup: true });
  add('gareth', 18, { name: 'Sir Gareth the Bold', title: 'Champion of Crownhold', look: L.gareth, ai: 'champion', weapon: 'long', hits: 20, kills: 5, aggression: 0.75, boss: true, wcolor: '#f0f4ff' });
  add('varek_sword', 20, { name: 'Sir Varek', title: 'the Undefeated', look: 'varek', ai: 'champion', weapon: 'long', hits: 24, kills: 4, aggression: 0.85, boss: true, wcolor: '#d8dcff' });
})();
