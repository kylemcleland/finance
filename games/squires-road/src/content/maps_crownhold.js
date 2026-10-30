// Crownhold: the walled capital. Castle (king + Grand Tourney herald), market, arena, inn.
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];

  def('crownhold', (L) => {
    const W = 40, H = 42;
    const g = L.grid(W, H, '.');
    // city walls: battlement row on top of a wall face
    g.frame(0, 0, W, H, 'c'); g.frame(1, 1, W - 2, H - 2, 'c');
    g.hline(0, W - 1, 0, 'C'); g.hline(0, W - 1, H - 2, 'C');
    for (const [x, y] of [[0, 0], [W - 1, 0], [0, H - 2], [W - 1, H - 2]]) g.set(x, y, 'C');
    g.rect(19, H - 2, 2, 2, 'g');
    g.set(17, H - 2, '*'); g.set(22, H - 2, '*');
    g.scatter(2, 2, W - 4, H - 4, ':', 0.05, 701);
    // the castle
    g.rect(12, 2, 16, 10, 'c');
    g.hline(12, 27, 2, 'C');
    g.rect(12, 2, 2, 3, 'C'); g.rect(26, 2, 2, 3, 'C');
    g.set(16, 6, 'W'); g.set(23, 6, 'W'); g.set(16, 9, 'W'); g.set(23, 9, 'W');
    g.rect(19, 10, 2, 2, 'g');
    g.set(17, 11, 'p'); g.set(22, 11, 'p'); g.set(18, 11, '*'); g.set(21, 11, '*');
    // royal gardens (west) and barracks yard (east)
    g.scatter(3, 3, 8, 8, 'T', 0.18, 702, '.:');
    g.blob(7, 7, 2.5, 2, '~', 71); g.set(7, 9, ':');
    g.house(30, 3, 7, 5, { roof: 3, door: 3, win: [1, 5] }); g.set(33, 7, 'W');      // barracks (no door)
    g.stamp(30, 9, ['x h x']);
    // avenue, streets, plaza
    g.vline(18, 12, H - 3, '=', 4);
    g.hline(3, W - 4, 17, '=', 1);
    g.rect(8, 18, 24, 8, '=');
    g.rect(18, 21, 4, 2, '~');
    g.hline(3, W - 4, 26, '=', 1);
    g.hline(3, W - 4, 34, '=', 1);
    // north band: inn (west), houses (east)
    g.house(3, 12, 8, 5, { roof: 3, door: 3, win: [1, 6] });                       // inn (6,16)
    const h1 = g.house(28, 12, 4, 5, { roof: 3, win: [0] }); g.set(h1.x, h1.y, 'W');
    const h2 = g.house(33, 12, 4, 5, { roof: 3, win: [3] }); g.set(h2.x, h2.y, 'W');
    // market stalls west of the plaza, flowers east
    g.stamp(3, 19, ['m m', '   ', 'm m', '   ', 'm m']);
    g.stamp(33, 19, ['T:T', ':::', 'T:T', ':::', 'T:T']);
    // south band: market hall (west), arena (east)
    g.house(3, 27, 10, 6, { roof: 3, door: 4, win: [1, 8] });                       // market (7,32)
    g.vline(7, 33, 34, '=');
    g.house(25, 27, 12, 7, { roof: 3, door: 6, wallCh: 'w' });                      // arena (31,33)
    g.set(27, 33, 'p'); g.set(35, 33, 'p'); g.set(29, 33, '*'); g.set(33, 33, '*');
    // southern houses + trees
    const h3 = g.house(3, 35, 5, 4, { roof: 2, win: [1, 3] }); g.set(h3.x, h3.y, 'W');
    const h4 = g.house(9, 35, 5, 4, { roof: 2, win: [1, 3] }); g.set(h4.x, h4.y, 'W');
    const h5 = g.house(27, 35, 5, 4, { roof: 2, win: [1, 3] }); g.set(h5.x, h5.y, 'W');
    g.stamp(33, 35, ['T.T', '.:.', 'T.T']);
    g.stamp(15, 36, ['T', ':', 'T']); g.stamp(24, 36, ['T', ':', 'T']);
    // signs
    g.set(17, 38, 'S'); g.set(17, 13, 'S'); g.set(30, 34, 'S'); g.set(8, 33, 'S'); g.set(9, 16, 'S');

    return {
      name: 'Crownhold', music: 'castle', outdoor: true,
      tiles: g.rows(),
      warps: [
        L.warp(19, H - 1, 'route3', 12, 1, 'down'),
        L.warp(20, H - 1, 'route3', 13, 1, 'down'),
        L.warp(19, 11, 'crownhold_castle', 10, 14, 'up'),
        L.warp(20, 11, 'crownhold_castle', 10, 14, 'up'),
        L.warp(6, 16, 'crownhold_inn', 6, 8, 'up'),
        L.warp(7, 32, 'crownhold_market', 7, 8, 'up'),
        L.warp(31, 33, 'crownhold_arena', 9, 12, 'up'),
      ],
      signs: [
        { x: 17, y: 38, text: 'CROWNHOLD\nSeat of King Edmund the Reasonably Good. Please wipe your boots.' },
        { x: 17, y: 13, text: 'THE ROYAL CASTLE\nThe Grand Tourney herald receives challengers within.' },
        { x: 30, y: 34, text: 'CROWNHOLD ARENA\nKnight-class cups, all disciplines. Big purses, bigger bruises.' },
        { x: 8, y: 33, text: 'THE GRAND MARKET\nIf we don\'t sell it, you don\'t need it.' },
        { x: 9, y: 16, text: 'THE GILDED GOOSE INN\n30 gold. The goose is not real gold. Please stop asking.' },
      ],
      objects: [
        { x: 3, y: 4, type: 'chest', id: 'ch_garden_elixir', item: 'elixir', qty: 1 },
        { x: 36, y: 25, type: 'chest', id: 'ch_corner_tonics', item: 'potion', qty: 2 },
      ],
      npcs: [
        { id: 'gateguardA', x: 17, y: 39, look: 'guard', dir: 'right', move: 'still', name: 'Gate Guard', script: L.talk(['Welcome to Crownhold, traveller!', 'No brawling outside the Arena. Inside the Arena, brawl away!']) },
        { id: 'gateguardB', x: 22, y: 39, look: 'guard', dir: 'left', move: 'still', name: 'Gate Guard', script: L.talk(() => F('beat_hugh') ? ['You\'re the one who beat Black Hugh! Captain Brannigan wants to see you, by the castle.'] : ['Stand up straight! ...Sorry. Habit.']) },
        { id: 'captain', x: 23, y: 13, look: 'captain', dir: 'down', move: 'turn', name: 'Captain Brannigan', script: (c, npc) => G.content.story.captain(c, npc) },
        { id: 'cedric', x: 24, y: 30, look: 'cedric', dir: 'down', move: 'turn', name: 'Cedric of Vane', cond: () => F('rival1'), script: (c, npc) => G.content.story.rival3(c, npc) },
        { id: 'gareth', x: 28, y: 21, look: 'gareth', dir: 'left', move: 'turn', name: 'Sir Gareth', script: L.talk(() => G.state.seals.grand ? ['You beat me fair. I\'ll be ready next year. Bring friends.'] : ['I am Sir Gareth, sword champion of the Grand Tourney three years running.', 'If we meet in the sword round, do not hold back. I won\'t.']) },
        { id: 'jester', x: 12, y: 21, look: 'jester', dir: 'down', move: 'wander', name: 'Pipkin the Jester', script: L.talk(() => G.U.pick([['Why did the knight cross the road?', 'Because the brigands were on THIS side! Ha! ...Tough crowd.'], ['What do you call a knight who lost his horse?', 'Sir Walks-a-lot! Thank you, I\'m here all week.'], ['I juggled three swords once.', 'Now I juggle two swords and a hook. Long story.']])) },
        { id: 'urchin', x: 14, y: 24, look: 'kidA', dir: 'up', move: 'wander', name: 'Street Urchin', script: L.talk(['Wanna know a secret? Sir Varek has NEVER lost a joust.', 'Not ever! But he wobbles when you hit his shield boss. I seen it.']) },
        { id: 'flowergirl', x: 34, y: 20, look: 'kidB', dir: 'left', move: 'turn', name: 'Flower Girl', script: async (c, npc) => { if (!F('ch_flower')) { await L.say(c, npc, 'A flower for luck in the Tourney! And a herb, in case luck runs out.'); c.give('herb', 2); c.setFlag('ch_flower'); } else await L.say(c, npc, 'Good luck, squire!'); } },
        { id: 'scholar', x: 12, y: 14, look: 'priest', dir: 'down', move: 'turn', name: 'Royal Scholar', script: L.talk(['The Grand Tourney scales to a challenger\'s best discipline.', 'Sword round, archery round, then the joust final. Specialise wisely, but not too wisely.']) },
        { id: 'ratman', x: 36, y: 37, look: 'villagerM', dir: 'left', move: 'wander', name: 'Rat-catcher Rolo', script: L.talk(() => F('beat_hugh') ? ['Black Hugh beaten! Now if only someone would beat the rats.', 'I\'ve tried. They parry.'] : ['Rats in the cellars, brigands on the roads. Busy year.']) },
        { id: 'stall1', x: 4, y: 20, look: 'merchant', dir: 'right', move: 'still', name: 'Fruit Seller', script: async (c, npc) => { await L.say(c, npc, 'Fresh bread! Fresh herbs! Fresh-ish tonics!'); await c.shop('crownhold_market'); } },
        { id: 'stall2', x: 4, y: 22, look: 'baker', dir: 'right', move: 'still', name: 'Pie Man', script: L.talk(['Pies! Hot pies! ...Well. Warm pies. Room-temperature pies.', 'Hugh\'s gang used to steal all my pies. Not any more, if I have a say!']) },
      ],
    };
  });

  def('crownhold_inn', (L) => {
    const g = L.room(14, 10, 'k', 6);
    g.stamp(1, 2, ['eekkllllkkee', 'kkkkkkkkkkkk', 'vvvkkkvkkvkk', 'kkkkkkkkkkkk', 'kkkkvkkkkkvk', 'xkkkkkkkkkkx', 'hkkkkkkkkkkx']);
    g.set(3, 1, '*'); g.set(10, 1, '*');
    return {
      name: 'The Gilded Goose', music: 'castle', outdoor: false, tiles: g.rows(),
      warps: [L.warp(6, 9, 'crownhold', 6, 17, 'down')],
      npcs: [
        { id: 'innkeep', x: 2, y: 3, look: 'innkeep', dir: 'down', move: 'still', name: 'Madame Goosely', script: async (c, npc) => { await L.say(c, npc, 'The finest beds in Crownhold! 30 gold, feather pillows included.'); await c.inn(30); } },
        { id: 'lyle2', x: 8, y: 5, look: 'bard', dir: 'down', move: 'turn', name: 'Lyle the Bard', script: L.talk(() => G.state.seals.grand ? ['♪ The stable hand rose up and took the crown... ♪', '♪ ...well, not the CROWN crown. A knighthood. Still! ♪'] : ['I followed you from Thornbrook! For material!', 'Win the Tourney and I\'ll write you a ballad. Lose, and I\'ll write a comedy.']) },
        { id: 'oldknight', x: 11, y: 7, look: 'knight', dir: 'left', move: 'turn', name: 'Sir Roland (snoozing)', script: L.talk(['Zzz... parry... riposte... zzz...', '...more stew... zzz...']) },
        { id: 'lady', x: 4, y: 7, look: 'noble', dir: 'right', move: 'turn', name: 'Lady Isolde', script: L.talk(['I bet on Varek every year. Every year I win.', 'Do lose politely, dear. I have a new carriage to pay for.']) },
      ],
    };
  });

  def('crownhold_market', (L) => {
    const g = L.room(16, 10, 'K', 7);
    g.stamp(1, 2, ['llxKmmKKmmKxll', 'KKKKKKKKKKKKKK', 'vvvKKKKKKKKvvv', 'KKKKKKKKKKKKKK', 'KKKmKKKKKKmKKK', 'xKKKKKKKKKKKKx', 'hKKKKKKKKKKKKx']);
    return {
      name: 'The Grand Market', music: 'castle', outdoor: false, tiles: g.rows(),
      warps: [L.warp(7, 9, 'crownhold', 7, 33, 'down')],
      npcs: [
        { id: 'trader', x: 2, y: 3, look: 'merchant', dir: 'down', move: 'still', name: 'Master Trader Oswy', script: async (c, npc) => { await L.say(c, npc, ['Finest wares in the realm! Tonics, elixirs, longbows, lances.', 'Prices are high. So is quality! Mostly.']); await c.shop('crownhold_market'); } },
        { id: 'royalsmith', x: 13, y: 3, look: 'smith', dir: 'down', move: 'still', name: 'Royal Smith Hilde', script: async (c, npc) => { await L.say(c, npc, ['Steel longswords, heater shields, plate harness. Royal grade.', 'The Knight\'s Blade? Only for those who can afford it. Or earn it.']); await c.shop('crownhold_smith'); } },
        { id: 'shopper', x: 8, y: 6, look: 'maid', dir: 'up', move: 'wander', name: 'Castle Maid', script: L.talk(['The King\'s crown needs polishing again.', 'He keeps wearing it to the bath. Says it\'s "regal".']) },
      ],
    };
  });

  def('crownhold_castle', (L) => {
    const g = L.room(20, 16, 'K', 10);
    g.vline(9, 4, 14, 'k', 2);            // the long red carpet (wood) down the hall
    g.stamp(1, 2, ['p  l          l  p ']);
    g.stamp(8, 2, ['vvvv']);             // dais / throne
    g.set(9, 2, 'v'); g.set(10, 2, 'v');
    for (const y of [5, 8, 11]) { g.set(5, y, 'n'); g.set(14, y, 'n'); }
    g.set(4, 1, '*'); g.set(15, 1, '*'); g.set(0, 8, '*'); g.set(19, 8, '*');
    return {
      name: 'Crownhold Castle', music: 'castle', outdoor: false, tiles: g.rows(),
      warps: [L.warp(10, 15, 'crownhold', 19, 12, 'down')],
      npcs: [
        { id: 'king', x: 10, y: 3, look: 'king', dir: 'down', move: 'still', name: 'King Edmund', script: (c, npc) => G.content.story.king(c, npc) },
        { id: 'queen', x: 12, y: 3, look: 'queen', dir: 'down', move: 'still', name: 'Queen Matilda', script: L.talk(() => G.state.seals.grand ? ['A knight from a stable. How wonderful. The court is SO annoyed.'] : ['Edmund has been practising his knighting speech for weeks.', 'Do win, dear. He has nobody to use it on.']) },
        { id: 'princess', x: 7, y: 4, look: 'princess', dir: 'down', move: 'wander', name: 'Princess Elinor', script: L.talk(['Father won\'t let me joust. He says it\'s "unseemly".', 'I unhorsed my tutor with a broom yesterday. Very seemly.']) },
        { id: 'herald', x: 12, y: 9, look: 'herald', dir: 'left', move: 'turn', name: 'Royal Herald', script: (c, npc) => G.content.story.herald(c, npc) },
        { id: 'varek', x: 16, y: 7, look: 'varek', dir: 'left', move: 'still', name: 'Sir Varek', script: L.talk(() => G.state.seals.grand ? ['...You unhorsed me. Nobody unhorses me.', 'Find me in the Arena, if you want to try that with swords.'] : ['I am Varek. I have never been unhorsed.', 'You are... small. Come to the Grand Tourney. I will make it quick.']) },
        { id: 'cguard1', x: 8, y: 13, look: 'guard', dir: 'right', move: 'still', name: 'Royal Guard', script: L.talk('No running in the throne room. Also no jousting. We\'ve had incidents.') },
        { id: 'cguard2', x: 12, y: 13, look: 'guard', dir: 'left', move: 'still', name: 'Royal Guard', script: L.talk('The herald by the pillar enters challengers in the Grand Tourney.') },
        { id: 'aldric_c', x: 6, y: 9, look: 'aldric', dir: 'right', move: 'still', name: 'Sir Aldric', cond: () => F('knighted'), script: L.talk(['A knight! MY squire, a knight!', 'Gerald the dummy sends his regards. I asked him. He said nothing, which means yes.']) },
      ],
    };
  });

  def('crownhold_arena', (L) => {
    const g = L.room(20, 14, 'a', 9, 'q');
    g.hline(1, 18, 2, 'q');
    g.stamp(1, 3, ['p                p']);
    g.set(5, 1, '*'); g.set(14, 1, '*'); g.set(0, 7, '*'); g.set(19, 7, '*');
    g.stamp(1, 11, ['x', 'h']); g.stamp(18, 11, ['h', 'x']);
    return {
      name: 'Crownhold Arena', music: 'tourney', outdoor: false, tiles: g.rows(),
      warps: [L.warp(9, 13, 'crownhold', 31, 34, 'down')],
      npcs: [
        { id: 'arenamaster', x: 9, y: 4, look: 'captain', dir: 'down', move: 'still', name: 'Arena Master Kord', script: (c, npc) => G.content.story.hallMaster(c, npc, 'crownhold_arena') },
        { id: 'varek_a', x: 15, y: 6, look: 'varek', dir: 'left', move: 'still', name: 'Sir Varek', cond: () => !!G.state.seals.grand, script: (c, npc) => G.content.story.varekRematch(c, npc) },
        { id: 'aspect1', x: 2, y: 7, look: 'villagerM', dir: 'right', move: 'turn', name: 'Gambler', script: L.talk(['Knight cups pay the best gold in the realm.', 'And you can enter them again and again! My bookie loves you.']) },
        { id: 'aspect2', x: 17, y: 10, look: 'noble', dir: 'left', move: 'turn', name: 'Duchess Ermine', script: L.talk(['The Grand Tourney itself is held by the herald in the castle.', 'Here, it\'s just glory and gold. My two favourite things.']) },
      ],
    };
  });
})();
