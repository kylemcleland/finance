// Harrowfield: the horse town. Stable (horses), the Lists (joust hall), armory, inn, and the Kingsroad gate north.
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];

  def('harrowfield', (L) => {
    const W = 38, H = 30;
    const g = L.grid(W, H, '.');
    g.border('T', 1);
    g.scatter(1, 1, W - 2, 3, 'T', 0.6, 401);
    g.scatter(1, H - 3, W - 2, 2, 'T', 0.5, 402);
    g.scatter(1, 5, 2, H - 6, 'T', 0.35, 403);
    g.scatter(W - 3, 5, 2, H - 6, 'T', 0.35, 404);
    g.scatter(2, 5, W - 4, H - 8, ':', 0.05, 405);
    // north wall + Kingsroad gate
    g.rect(16, 1, 7, 3, '.');
    g.hline(1, W - 2, 4, 'w');
    g.vline(19, 0, 4, '=');
    g.set(18, 4, '*'); g.set(20, 4, '*');
    g.stamp(16, 1, ['T     T']);
    // streets
    g.hline(0, W - 2, 16, '_', 2);
    g.vline(18, 5, 17, '=', 2);
    g.rect(15, 13, 10, 6, '=');
    g.set(21, 14, 'o');
    g.rect(1, 14, 3, 5, '.'); g.hline(0, 4, 16, '_', 2);
    // stable + paddock
    g.house(3, 7, 9, 5, { roof: 3, door: 4, win: [1, 7] });          // stable (7,11)
    g.vline(7, 12, 15, '_');
    g.frame(12, 6, 6, 6, 'f'); g.rect(13, 7, 4, 4, ','); g.set(14, 11, 'F');
    g.stamp(13, 7, ['h', 'h']);
    g.stamp(2, 12, ['hh']); g.set(11, 12, 'x');
    // the Lists
    g.house(22, 6, 14, 6, { roof: 3, door: 7 });                      // lists (29,11)
    g.set(24, 11, 'p'); g.set(33, 11, 'p'); g.set(26, 11, '*'); g.set(32, 11, '*');
    g.vline(29, 12, 15, '_');
    // south row
    g.hline(3, 30, 25, '_', 2);
    g.vline(12, 18, 26, '_', 2);
    g.house(3, 20, 8, 5, { roof: 3, door: 3, win: [1, 6] });         // inn (6,24)
    g.house(15, 20, 7, 5, { roof: 3, door: 3, win: [1, 5] });        // armory (18,24)
    // tilt yard
    g.frame(24, 19, 12, 6, 'f'); g.rect(25, 20, 10, 4, 's'); g.hline(26, 33, 22, '|'); g.set(29, 24, 'F');
    g.set(25, 20, 'p'); g.set(34, 20, 'p');
    // signs
    g.set(3, 13, 'S'); g.set(21, 3, 'S'); g.set(28, 12, 'S'); g.set(8, 12, 'S'); g.set(5, 25, 'S'); g.set(20, 25, 'S');
    g.set(23, 19, 'S');

    return {
      name: 'Harrowfield', music: 'town', outdoor: true,
      tiles: g.rows(),
      warps: [
        L.warp(0, 16, 'route2', 62, 14, 'left'),
        L.warp(0, 17, 'route2', 62, 15, 'left'),
        L.warp(19, 0, 'route3', 12, 58, 'up'),
        L.warp(7, 11, 'harrowfield_stable', 6, 8, 'up'),
        L.warp(29, 11, 'harrowfield_lists', 8, 10, 'up'),
        L.warp(6, 24, 'harrowfield_inn', 5, 7, 'up'),
        L.warp(18, 24, 'harrowfield_armory', 4, 6, 'up'),
      ],
      signs: [
        { x: 3, y: 13, text: 'HARROWFIELD\nHorse capital of the realm. Mind where you step. Seriously.' },
        { x: 21, y: 3, text: 'THE KINGSROAD\nNorth to Crownhold. Travellers need two Seals, by order of the Crown.' },
        { x: 28, y: 12, text: 'THE HARROWFIELD LISTS\nLady Rowena presiding. Lances to the left, egos to the right.' },
        { x: 8, y: 12, text: 'TOBIAS\'S STABLE\nHorses bought, sold and spoken to kindly.' },
        { x: 5, y: 25, text: 'THE NOSEBAG INN\n20 gold. Hay for horses, stew for people. Please don\'t mix them up.' },
        { x: 20, y: 25, text: 'HARROWFIELD ARMORY\nPlate, mail, lances. Dents hammered while you wait.' },
        { x: 23, y: 19, text: 'TILT YARD\nPractice jousts. Splinters free of charge.' },
      ],
      objects: [
        { x: 35, y: 14, type: 'chest', id: 'hf_chest_east', item: 'potion', qty: 2 },
        { x: 16, y: 7, type: 'chest', id: 'hf_paddock_carrot', item: 'herb', qty: 2 },
      ],
      npcs: [
        { id: 'gateguard', x: 19, y: 4, look: 'guard', dir: 'down', move: 'still', name: 'Gate Sergeant Holt', cond: () => !F('gate_open'), script: (c, npc) => G.content.story.gate(c, npc) },
        { id: 'gateguard2', x: 20, y: 3, look: 'guard', dir: 'down', move: 'still', name: 'Gate Sergeant Holt', cond: () => F('gate_open'), script: (c, npc) => G.content.story.gate(c, npc) },
        {
          id: 'clatter', x: 27, y: 21, look: 'knight', dir: 'down', move: 'still', name: 'Sir Clatterbottom',
          script: L.challenge({
            type: 'joust', need: 'joust', flag: 'beat_hf_clatter',
            opts: { opponent: 'joust_ned', title: 'Tilt Yard Bout' },
            intro: 'A practice tilt, friend? I am Sir Clatterbottom. You will soon learn why.',
            win: 'CLATTER! Yes. That is why. Well ridden! Take my purse.',
            lose: 'Ha! Still in the saddle, me! For once!',
            again: 'My bottom still clatters at the memory.',
            needText: 'No horse and lance? Tobias sells horses, and Rowena lends practice lances.',
            gold: 60,
          }),
        },
        { id: 'horsegirl', x: 16, y: 13, look: 'kidB', dir: 'down', move: 'wander', name: 'Molly', script: L.talk(['I\'m going to have a hundred horses when I grow up!', 'And name them ALL Buttercup!']) },
        { id: 'farrier', x: 13, y: 15, look: 'smith', dir: 'down', move: 'turn', name: 'Farrier Ned', script: L.talk(['A fast horse charges hard but wobbles your lance.', 'A steady horse is easier to aim from. Pick your poison.']) },
        { id: 'oldjouster', x: 25, y: 13, look: { skin: '#e9b98a', hair: '#cfcfcf', beard: '#dcdcdc', tunic: '#3b5fa8', pants: '#5a5a66', boots: '#2b2b33', cape: '#8a2f22' }, dir: 'down', move: 'turn', name: 'Sir Harold (old)', script: L.talk(['Spur in rhythm, not in panic! Tap... tap... tap.', 'Overspur and your lance waves like a wet noodle.', 'Aim for the gold boss on their shield. Strike as the ring closes.']) },
        {
          id: 'merchant', x: 31, y: 17, look: 'merchant', dir: 'left', move: 'turn', name: 'Guildmaster Pell',
          script: async (c, npc) => {
            if (F('beat_hugh') && !F('pell_reward')) {
              await L.say(c, npc, ['You beat Black Hugh?! He robbed my caravans for years!', 'The Merchants\' Guild thanks you. With money! Our favourite way to thank.']);
              c.gold(250); c.give('potion', 2); c.setFlag('pell_reward');
            } else if (F('beat_hugh')) await L.say(c, npc, 'Business is booming! The Kingsroad is safe again, thanks to you.');
            else await L.say(c, npc, ['Black Hugh\'s gang robs every caravan on the Kingsroad.', 'Whoever stops him would have the Guild\'s eternal gratitude. And purse.']);
          },
        },
        { id: 'gossip', x: 9, y: 26, look: 'villagerF', dir: 'up', move: 'wander', name: 'Gossipy Gwen', script: L.talk(() => F('beat_hugh') ? ['They say a squire from Thornbrook beat Black Hugh!', 'With a sword! And a buckler! And, I assume, a great deal of shouting!'] : ['Lady Rowena once unhorsed three knights in one afternoon.', 'Then she had tea. Very calm woman.']) },
      ],
    };
  });

  def('harrowfield_inn', (L) => {
    const g = L.room(12, 9, 'k', 5);
    g.stamp(1, 2, ['eekkllkkee', 'kkkkkkkkkk', 'vvvkkkvkkk', 'kkkkkkkkvk', 'kkkkkkkkkk', 'xkkkkkkkkh']);
    g.set(3, 1, '*'); g.set(8, 1, '*');
    return {
      name: 'The Nosebag Inn', music: 'town', outdoor: false, tiles: g.rows(),
      warps: [L.warp(5, 8, 'harrowfield', 6, 25, 'down')],
      npcs: [
        { id: 'innkeep', x: 2, y: 3, look: 'innkeep', dir: 'down', move: 'still', name: 'Hilda', script: async (c, npc) => { await L.say(c, npc, 'Bed and stew, 20 gold. Not hay. We had complaints.'); await c.inn(20); } },
        { id: 'groom', x: 7, y: 5, look: 'squire', dir: 'right', move: 'turn', name: 'Groom Pip', script: L.talk(['Iron Seat is the perk for staying on your horse.', 'Me, I just glue myself on. Works until you need the privy.']) },
        { id: 'bardh', x: 9, y: 6, look: 'bard', dir: 'up', move: 'turn', name: 'Lyle\'s Cousin Lyall', script: L.talk(['♪ Oh Rowena, fair Rowena, you knocked me off my steed... ♪', '♪ ...and now I sing in taverns, as you can see, indeed. ♪']) },
      ],
    };
  });

  def('harrowfield_stable', (L) => {
    const g = L.room(14, 10, 'k', 6);
    g.stamp(1, 2, ['hfkkfhhfkkfh', 'kfkkfkkfkkfk', 'kFkkFkkFkkFk', 'kkkkkkkkkkkk', 'vvvkkkkkkkhh', 'kkkkkkkkkkkx', 'xkkkkkkkkkkh']);
    return {
      name: 'Tobias\'s Stable', music: 'town', outdoor: false, tiles: g.rows(),
      warps: [L.warp(6, 9, 'harrowfield', 7, 12, 'down')],
      npcs: [
        { id: 'tobias', x: 2, y: 5, look: 'tobias', dir: 'down', move: 'still', name: 'Tobias, Stable Master', script: (c, npc) => G.content.story.tobias(c, npc) },
        { id: 'stablelad', x: 9, y: 7, look: 'child', dir: 'left', move: 'wander', name: 'Stable Lad', script: L.talk(['The Old Nag is slow, but she\'s never once bitten anyone.', 'The Destrier has bitten everyone. Twice. He\'s magnificent.']) },
      ],
    };
  });

  def('harrowfield_armory', (L) => {
    const g = L.room(10, 8, 'K', 4);
    g.stamp(1, 2, ['llxkkxll', 'KKKKKKKK', 'vvvKKKKK', 'KKKKKKKK', 'xKKKKKKx']);
    return {
      name: 'Harrowfield Armory', music: 'town', outdoor: false, tiles: g.rows(),
      warps: [L.warp(4, 7, 'harrowfield', 18, 25, 'down')],
      npcs: [
        { id: 'armorer', x: 2, y: 3, look: 'smith', dir: 'down', move: 'still', name: 'Armorer Brannoc', script: async (c, npc) => { await L.say(c, npc, ['Chainmail! Plate! Lances of ash and oak!', 'Armor soaks blows. Heavier armor, slower feet.']); await c.shop('harrowfield_armory'); } },
        { id: 'dentguy', x: 6, y: 5, look: 'knight', dir: 'left', move: 'turn', name: 'Dented Knight', script: L.talk(['I\'m waiting for my helmet to be un-dented.', 'Rowena did it. With her lance. On purpose.']) },
      ],
    };
  });

  def('harrowfield_lists', (L) => {
    const g = L.room(18, 12, 'a', 8, 'q');
    g.stamp(1, 2, ['p              p']);
    g.hline(3, 14, 6, '|');
    g.set(4, 1, '*'); g.set(13, 1, '*'); g.set(0, 6, '*'); g.set(17, 6, '*');
    g.stamp(1, 9, ['h', 'x']); g.stamp(16, 9, ['x', 'h']);
    return {
      name: 'Harrowfield Lists', music: 'tourney', outdoor: false, tiles: g.rows(),
      warps: [L.warp(8, 11, 'harrowfield', 29, 12, 'down')],
      npcs: [
        { id: 'rowena', x: 8, y: 3, look: 'rowena', dir: 'down', move: 'still', name: 'Lady Rowena', script: (c, npc) => G.content.story.rowena(c, npc) },
        { id: 'lspect1', x: 2, y: 4, look: 'noble', dir: 'right', move: 'turn', name: 'Noble Lady', script: L.talk(['The lance breaks are the best part. So many splinters!', 'I collect them. I have a whole jar.']) },
        { id: 'lspect2', x: 15, y: 8, look: 'squire', dir: 'left', move: 'turn', name: 'Squire Tod', script: L.talk(['Unhorsing your foe wins instantly!', 'Being unhorsed loses instantly. And hurts. Mostly the pride.']) },
      ],
    };
  });
})();
