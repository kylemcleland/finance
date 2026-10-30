// Tournament halls and cups (DESIGN.md §9, §12).
// G.halls[hallId] = { name, discipline, master, masterLook, intro, cups:[cup] }
// cup = { id, name, tier, fee, minLevel, rounds:[{type, opts, label?}], reward:{gold, xp, item?, qty?, seal?},
//         repeatable, requires?:[cupId], needSeals?:[discipline], desc }
// XP is tuned above the §12 baseline (Novice 120, Squire 350, Knight 700, Seal 500) so a player who
// wins the cups reaches the Grand Tourney around level 14-16 instead of 11-12.
// tier: 'novice' | 'squire' | 'knight' | 'seal' | 'champion' | 'grand' — ranks[discipline] rises on the
// first win of each tier (see game/tournament.js). Rewards follow the §12 guidance; repeats pay half, no item.
(() => {
  const H = G.halls;
  const sword = (enemies, label, extra) => ({ type: 'sword', label, opts: { enemies: [].concat(enemies), arena: 'pit', ...extra } });
  const joust = (opponent, label, extra) => ({ type: 'joust', label, opts: { opponent, ...extra } });
  const arch = (rivals, tier, label, extra) => ({ type: 'archery', label, opts: { rivals: [].concat(rivals), tier, ...extra } });

  // ------------------------------------------------------------------ Thornbrook: Sword
  H.thornbrook_pit = {
    name: 'Thornbrook Sword Pit', discipline: 'sword', master: 'Bram the Pit Master', masterLook: 'bram',
    intro: 'Steel and sawdust! Prove yourself in the Pit.',
    cups: [
      {
        id: 'pit_novice', name: 'Novice Cup', tier: 'novice', fee: 0, minLevel: 1, repeatable: true,
        desc: 'Three village hopefuls. A fine first test.',
        rounds: [sword('pit_tom', 'Round 1'), sword('pit_meg', 'Round 2'), sword('pit_oswin', 'Final')],
        reward: { gold: 60, xp: 120, item: 'padded' },
      },
      {
        id: 'pit_seal', name: 'Seal of the Blade', tier: 'seal', fee: 0, minLevel: 4, repeatable: true, requires: ['pit_novice'],
        desc: 'Face Bram himself for the Seal of the Blade.',
        rounds: [sword('bram', 'Seal Bout', { boss: true, intro: 'Bram cracks his knuckles.' })],
        reward: { gold: 200, xp: 500, item: 'falchion', seal: 'sword' },
      },
      {
        id: 'pit_squire', name: 'Squire Cup', tier: 'squire', fee: 20, minLevel: 5, repeatable: true, requires: ['pit_novice'],
        desc: 'Squires from across the vale, hungry for glory.',
        rounds: [sword('pit_squire1', 'Round 1'), sword('pit_squire2', 'Round 2'), sword('pit_squire3', 'Final')],
        reward: { gold: 150, xp: 350, item: 'kite_shield' },
      },
      {
        id: 'pit_knight', name: 'Knight Cup', tier: 'knight', fee: 60, minLevel: 9, repeatable: true, requires: ['pit_squire'],
        desc: 'Sworn knights test their steel. Bring a good shield.',
        rounds: [sword('pit_knight1', 'Round 1'), sword('pit_knight2', 'Round 2'), sword('pit_knight3', 'Final')],
        reward: { gold: 400, xp: 700, item: 'steel_sword' },
      },
      {
        id: 'pit_legends', name: 'Pit of Legends', tier: 'champion', fee: 200, minLevel: 18, repeatable: true, requires: ['pit_knight', 'grand_tourney'],
        desc: 'Only for the Realm\'s champion. The Pit\'s greatest prize awaits.',
        rounds: [sword('pit_knight3', 'Round 1'), sword(['crown_knight1', 'crown_knight2'], 'Melee'), sword('gareth', 'Final', { boss: true })],
        reward: { gold: 900, xp: 1200, item: 'sunsteel' },
      },
    ],
  };

  // ------------------------------------------------------------------ Millbridge: Archery
  H.millbridge_range = {
    name: 'Millbridge Archery Range', discipline: 'archery', master: 'Wren the Archery Master', masterLook: 'wren',
    intro: 'Steady breath, true aim. Mind the wind.',
    cups: [
      {
        id: 'range_novice', name: 'Novice Cup', tier: 'novice', fee: 10, minLevel: 1, repeatable: true,
        desc: 'Two heats at the near butts. Beat the local lads.',
        rounds: [arch(['arch_tam', 'arch_lia'], 1, 'Heat'), arch('arch_bo', 1, 'Final')],
        reward: { gold: 60, xp: 120, item: 'potion', qty: 2 },
      },
      {
        id: 'range_seal', name: 'Seal of the Arrow', tier: 'seal', fee: 0, minLevel: 4, repeatable: true, requires: ['range_novice'],
        desc: 'Outshoot Wren for the Seal of the Arrow.',
        rounds: [arch('wren', 2, 'Seal Contest', { boss: true })],
        reward: { gold: 200, xp: 500, item: 'elven_bow', seal: 'archery' },
      },
      {
        id: 'range_squire', name: 'Squire Cup', tier: 'squire', fee: 20, minLevel: 5, repeatable: true, requires: ['range_novice'],
        desc: 'Longer range and gusty crosswinds.',
        rounds: [arch(['arch_squire1', 'arch_squire2'], 2, 'Heat'), arch('arch_squire3', 2, 'Final')],
        reward: { gold: 150, xp: 350, item: 'longbow' },
      },
      {
        id: 'range_knight', name: 'Knight Cup', tier: 'knight', fee: 60, minLevel: 9, repeatable: true, requires: ['range_squire'],
        desc: 'Moving targets at the far butts. Only the best place.',
        rounds: [arch('arch_knight1', 3, 'Semifinal'), arch(['arch_knight2', 'arch_squire3'], 3, 'Final')],
        reward: { gold: 400, xp: 700, item: 'chainmail' },
      },
    ],
  };

  // ------------------------------------------------------------------ Harrowfield: Joust
  H.harrowfield_lists = {
    name: 'Harrowfield Jousting Lists', discipline: 'joust', master: 'Lady Rowena', masterLook: 'rowena',
    intro: 'Lower your lance, keep your seat, and ride true!',
    cups: [
      {
        id: 'lists_novice', name: 'Novice Cup', tier: 'novice', fee: 10, minLevel: 1, repeatable: true,
        desc: 'Three green riders. Aim for the shield boss.',
        rounds: [joust('joust_ned', 'Round 1'), joust('joust_pip', 'Round 2'), joust('joust_hal', 'Final')],
        reward: { gold: 60, xp: 120, item: 'palfrey' },
      },
      {
        id: 'lists_seal', name: 'Seal of the Lance', tier: 'seal', fee: 0, minLevel: 6, repeatable: true, requires: ['lists_novice'],
        desc: 'Tilt against Lady Rowena for the Seal of the Lance.',
        rounds: [joust('rowena', 'Seal Bout', { boss: true })],
        reward: { gold: 200, xp: 500, item: 'ash_lance', seal: 'joust' },
      },
      {
        id: 'lists_squire', name: 'Squire Cup', tier: 'squire', fee: 20, minLevel: 7, repeatable: true, requires: ['lists_novice'],
        desc: 'Squires on proper warhorses. Hold your seat!',
        rounds: [joust('joust_squire1', 'Round 1'), joust('joust_squire2', 'Round 2'), joust('joust_squire3', 'Final')],
        reward: { gold: 150, xp: 350, item: 'oak_lance' },
      },
      {
        id: 'lists_knight', name: 'Knight Cup', tier: 'knight', fee: 60, minLevel: 10, repeatable: true, requires: ['lists_squire'],
        desc: 'Knights of the realm — and a certain lordling.',
        rounds: [joust('joust_knight1', 'Round 1'), joust('joust_knight2', 'Semifinal'), joust('cedric_joust', 'Final')],
        reward: { gold: 400, xp: 700, item: 'destrier' },
      },
    ],
  };

  // ------------------------------------------------------------------ Crownhold: Grand Tourney
  H.crownhold_grand = {
    name: 'The Grand Tourney', discipline: 'mixed', master: 'The King\'s Herald', masterLook: 'guard',
    intro: 'Hear ye! Only bearers of all three Seals may ride for the Crown.',
    cups: [
      {
        id: 'grand_tourney', name: 'Grand Tourney', tier: 'grand', fee: 0, minLevel: 12, repeatable: true,
        needSeals: ['sword', 'archery', 'joust'],
        desc: 'Melee, swords, the butts, and the joust final against Sir Varek the Undefeated.',
        rounds: [
          sword(['crown_knight1', 'crown_knight2'], 'Grand Melee', { arena: 'castle' }),
          sword('cedric3', 'Sword Semifinal', { arena: 'castle' }),
          sword('gareth', 'Sword Final', { arena: 'castle' }),
          arch(['grand_archer1', 'grand_archer2', 'cedric_archer'], 4, 'Archery Round'),
          joust('varek', 'Joust Final', { boss: true }),
        ],
        reward: { gold: 2000, xp: 2500, item: 'knight_blade', seal: 'grand' },
      },
    ],
  };

  // ------------------------------------------------------------------ Crownhold: Arena (grinding)
  H.crownhold_arena = {
    name: 'Crownhold Arena', discipline: 'mixed', master: 'Arena Marshal Osric', masterLook: 'knight',
    intro: 'Purses every day for those with the nerve.',
    cups: [
      {
        id: 'arena_sword', name: 'Steel Gauntlet', tier: 'champion', fee: 100, minLevel: 14, repeatable: true, requires: ['pit_knight'],
        desc: 'The King\'s own knights, one after another.',
        rounds: [sword('crown_knight1', 'Round 1', { arena: 'castle' }), sword('crown_knight2', 'Round 2', { arena: 'castle' }), sword('crown_knight3', 'Final', { arena: 'castle' })],
        reward: { gold: 600, xp: 900, item: 'heater_shield' },
      },
      {
        id: 'arena_archery', name: 'Golden Arrow', tier: 'champion', fee: 100, minLevel: 12, repeatable: true, requires: ['range_knight'],
        desc: 'Royal archers at the farthest butts, with gusting wind.',
        rounds: [arch(['grand_archer1', 'arch_knight2'], 4, 'Heat'), arch(['grand_archer2', 'cedric_archer'], 4, 'Final')],
        reward: { gold: 600, xp: 900, item: 'elixir', qty: 2 },
      },
      {
        id: 'arena_joust', name: 'Royal Lists', tier: 'champion', fee: 100, minLevel: 12, repeatable: true, requires: ['lists_knight'],
        desc: 'Lancers of the Crown on fresh destriers.',
        rounds: [joust('crown_lancer1', 'Semifinal'), joust('crown_lancer2', 'Final')],
        reward: { gold: 600, xp: 900, item: 'royal_lance' },
      },
      {
        id: 'arena_champion', name: 'Champion\'s Challenge', tier: 'champion', fee: 250, minLevel: 18, repeatable: true, requires: ['grand_tourney'],
        desc: 'Sir Varek, on foot, sword in hand. He wants his rematch.',
        rounds: [sword('varek_sword', 'Rematch', { arena: 'castle', boss: true })],
        reward: { gold: 1500, xp: 1500, item: 'plate' },
      },
    ],
  };
})();
