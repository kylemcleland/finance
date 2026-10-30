// Route 3: the Kingsroad (Harrowfield north to Crownhold), plus Black Hugh's bandit camp off to the west.
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];
  const brigandLook = 'brigand';

  def('route3', (L) => {
    const W = 26, H = 60;
    const g = L.grid(W, H, 't');
    g.scatter(0, 0, W, H, 'T', 0.3, 501, 't');
    g.scatter(0, 0, W, H, 'r', 0.08, 502, 't');
    const P = [[12, H - 1], [12, 50], [5, 50], [5, 40], [16, 40], [16, 30], [9, 30], [9, 20], [17, 20], [17, 10], [12, 10], [12, 0]];
    g.carve(P, 3, '.', 51);
    // side path west to the bandit camp
    const B = [[9, 26], [0, 26]];
    g.carve(B, 1, '.', 61);
    // pockets
    g.rect(19, 44, 4, 4, '.'); g.hline(18, 19, 46, '.');         // east shrine nook
    g.rect(2, 13, 4, 4, '.'); g.vline(4, 16, 18, '.');             // west lookout
    g.rect(20, 3, 4, 3, '.');                                      // north-east nook
    g.border('t', 1);
    // texture
    g.scatter(1, 1, W - 2, H - 2, 'r', 0.05, 511, '.');
    g.scatter(1, 1, W - 2, H - 2, ':', 0.05, 512, '.');
    for (const [x, y, rx, ry, s] of [[8, 54, 3, 2, 1], [3, 45, 2, 3, 2], [20, 36, 2.5, 3, 3], [5, 33, 2.5, 2, 4], [14, 24, 2, 2, 5], [21, 16, 2.5, 2.5, 6], [6, 8, 3, 2, 7], [3, 25, 2, 1, 8]])
      g.blob(x, y, rx, ry, ',', s, '.:');
    g.blob(20, 26, 3, 2.5, '~', 9, '.,:r');                       // tarn
    g.path(P, '=', 2);
    g.path(B, '_', 2);
    // re-open the pockets after texturing
    g.rect(17, 43, 6, 5, '.'); g.set(18, 43, 'p'); g.set(22, 43, 'p'); g.set(20, 43, '*'); g.set(17, 47, 'r');
    g.rect(2, 13, 4, 4, '.'); g.hline(4, 8, 18, '.'); g.vline(4, 16, 18, '.');
    g.rect(20, 3, 4, 3, '.'); g.hline(16, 20, 4, '.');
    g.set(14, 56, 'S'); g.set(7, 24, 'S'); g.set(14, 4, 'S'); g.set(18, 33, 'S');

    return {
      name: 'The Kingsroad', music: 'route', outdoor: true, arena: 'road',
      encounterRate: 0.1,
      encounters: [
        { enemies: ['brigand'], w: 4 },
        { enemies: ['brigand_brute'], w: 2 },
        { enemies: ['brigand', 'brigand'], w: 2 },
        { enemies: ['rogue_knight'], w: 1 },
        { enemies: ['wolf_alpha', 'wolf_alpha'], w: 1 },
      ],
      tiles: g.rows(),
      warps: [
        L.warp(12, H - 1, 'harrowfield', 19, 1, 'down'),
        L.warp(13, H - 1, 'harrowfield', 19, 1, 'down'),
        L.warp(12, 0, 'crownhold', 19, 39, 'up'),
        L.warp(13, 0, 'crownhold', 20, 39, 'up'),
        L.warp(0, 26, 'bandit_camp', 34, 12, 'left'),
        L.warp(0, 27, 'bandit_camp', 34, 13, 'left'),
      ],
      signs: [
        { x: 14, y: 56, text: 'THE KINGSROAD\nCrownhold, north. Brigands, everywhere. Enjoy your trip!' },
        { x: 7, y: 24, text: 'WEST: Nothing. Definitely not a bandit camp.\n- Signed, Not A Bandit' },
        { x: 14, y: 4, text: 'CROWNHOLD AHEAD\nSeat of the King. Home of the Grand Tourney.' },
        { x: 18, y: 33, text: 'WANTED: BLACK HUGH\nFor robbery, extortion, and stealing a bishop\'s socks.' },
      ],
      objects: [
        { x: 21, y: 44, type: 'chest', id: 'r3_shrine_elixir', item: 'elixir', qty: 1 },
        { x: 3, y: 14, type: 'chest', id: 'r3_lookout_tonics', item: 'potion', qty: 3 },
        { x: 2, y: 13, type: 'chest', id: 'r3_lookout_gold', gold: 150 },
        { x: 22, y: 4, type: 'chest', id: 'r3_ne_herbs', item: 'herb', qty: 4 },
      ],
      npcs: [
        {
          id: 'sal', x: 9, y: 47, look: brigandLook, dir: 'down', move: 'still', name: 'Scarface Sal',
          trainer: { sight: 4, flag: 'beat_r3_sal', battle: { type: 'sword', opts: { enemies: ['brigand'], arena: 'road', title: 'Scarface Sal' } }, intro: 'Nice boots. I\'ll be taking those, and the feet if they\'re attached.', win: 'Keep the boots! Keep the feet! Just stop hitting!', lose: 'Size nine. Perfect.' },
          script: L.talk('I got this scar shaving. Don\'t tell anyone.'),
        },
        {
          id: 'bob', x: 19, y: 38, look: { skin: '#c99a70', hair: '#2a1a10', hairStyle: 'bald', beard: '#2a1a10', tunic: '#5a2a1a', pants: '#2a2a1a', boots: '#1a1a10' }, dir: 'left', move: 'still', name: 'Bonecrusher Bob',
          trainer: { sight: 4, flag: 'beat_r3_bob', battle: { type: 'sword', opts: { enemies: ['brigand_brute'], arena: 'road', title: 'Bonecrusher Bob' } }, intro: 'BOB CRUSH BONES. BOB CRUSH YOURS.', win: 'Bob... crushed. Bob go home now.', lose: 'CRUNCH.' },
          script: L.talk('Bob only crush bones of bad people now. Bob turning over new leaf. Bob also crush leaf.'),
        },
        {
          id: 'mordred', x: 12, y: 33, look: { skin: '#e2ae80', hair: '#1a1a1a', tunic: '#3a1a3a', tunic2: '#8a8a9a', pants: '#2a2a33', boots: '#111', helmet: '#3a3a44', plume: '#5a1a5a' }, dir: 'down', move: 'still', name: 'Sir Mordrake the Mildly Evil',
          trainer: { sight: 5, flag: 'beat_r3_mordrake', battle: { type: 'sword', opts: { enemies: ['rogue_knight'], arena: 'road', title: 'Sir Mordrake' } }, intro: 'I am Sir Mordrake! I kick puppies! Well. I glare at them. Sternly.', win: 'Curses! Mildly!', lose: 'Evil triumphs! Mildly!' },
          script: L.talk('Being mildly evil is exhausting. You have to be bad, but not TOO bad.'),
        },
        {
          id: 'gallop', x: 10, y: 21, look: 'knight', dir: 'down', move: 'turn', name: 'Sir Gallop of the Patrol',
          script: L.challenge({
            type: 'joust', need: 'joust', flag: 'beat_r3_gallop',
            opts: { opponent: 'crown_lancer1', title: 'Roadside Tilt' },
            intro: 'Hail! The Crown Patrol tilts with every traveller of worth. A pass or three?',
            win: 'Unhorsed by a squire! The Patrol salutes you. Take this.',
            lose: 'Well tilted! Not well enough. Again some time!',
            again: 'My horse still won\'t look at me.',
            gold: 120,
          }),
        },
        {
          id: 'robyn', x: 21, y: 15, look: { skin: '#f0c9a0', hair: '#b8642a', hairStyle: 'long', tunic: '#3a6a2a', pants: '#4a5a2a', boots: '#3a2a18', hat: '#2a5a1a', plume: '#d6453d' }, dir: 'left', move: 'turn', name: 'Robyn Hoodwink',
          script: L.challenge({
            type: 'archery', need: 'bow', flag: 'beat_r3_robyn',
            opts: { rivals: ['grand_archer1'], tier: 3, title: 'Forest Wager' },
            intro: 'I rob from the rich and give to... well, me. Shoot against me! Winner takes the pot.',
            win: 'Robbed! By an honest archer! The shame! Here, your winnings.',
            lose: 'Ha! Robbed you fair and square.',
            again: 'Don\'t tell my merry men about this. They\'re not that merry about it.',
            gold: 150,
          }),
        },
        {
          id: 'monk', x: 20, y: 45, look: 'monk', dir: 'left', move: 'still', name: 'Brother Ambrose',
          script: async (c, npc) => {
            await L.say(c, npc, ['Rest at the shrine, traveller. The road is long and the brigands are rude.']);
            c.heal();
            await L.say(c, npc, ['Your wounds are mended. Go with grace. Or at least with a good shield.']);
          },
        },
        { id: 'pilgrim', x: 14, y: 52, look: 'villagerF', dir: 'up', move: 'wander', name: 'Pilgrim Ada', script: L.talk(['I\'m walking to Crownhold to see the Grand Tourney!', 'It takes nine days. I should have bought a horse.']) },
        { id: 'scout', x: 5, y: 14, look: 'guard', dir: 'down', move: 'turn', name: 'Lookout Fenn', script: L.talk(() => F('beat_hugh') ? ['Black Hugh beaten! I can finally take a nap. Up here. On duty.'] : ['From up here you can see smoke to the west. Black Hugh\'s camp.', 'Brigands, a big palisade, and Hugh himself. Bring tonics. Lots.']) },
        { id: 'patrol', x: 15, y: 8, look: 'guard', dir: 'down', move: 'turn', name: 'Crown Patrolman', script: L.talk(['Crownhold\'s just north. The Grand Tourney needs all three Seals.', 'Sword round, archery round, joust final against Sir Varek the Undefeated.']) },
      ],
    };
  });

  def('bandit_camp', (L) => {
    const W = 36, H = 26;
    const g = L.grid(W, H, 't');
    g.scatter(0, 0, W, H, 'T', 0.25, 601, 't');
    g.rect(2, 2, 24, 22, '.');                    // clearing
    g.carve([[25, 12], [W - 1, 12]], 2, '.', 62);  // approach
    g.border('t', 1);
    g.blob(29, 8, 3, 2, ',', 63, '.'); g.blob(30, 17, 3, 2.5, ',', 64, '.');
    // palisade
    g.frame(3, 3, 21, 19, 'f');
    g.set(23, 12, 'F'); g.set(23, 13, 'F');
    g.hline(24, W - 1, 12, '_', 2);
    // tents (roof-only), crates, fires, the boss dais
    const tent = (x, y) => { const d = g.house(x, y, 3, 2, { roof: 2 }); g.set(d.x, d.y, '^'); };
    tent(6, 15); tent(11, 17); tent(16, 15); tent(17, 5); tent(12, 5);
    g.set(13, 12, '*'); g.set(8, 10, '*'); g.set(19, 10, '*');
    g.stamp(4, 4, ['xx', 'x ', '  ', 'h']);
    g.stamp(20, 18, [' xx', 'xxh']);
    g.rect(5, 4, 5, 3, 's'); g.set(5, 4, 'p'); g.set(9, 4, 'p');
    g.hline(14, 22, 12, '_', 2);
    g.set(26, 10, 'S');

    return {
      name: 'Black Hugh\'s Camp', music: 'boss', outdoor: true, arena: 'road',
      encounterRate: 0.1,
      encounters: [{ enemies: ['brigand'], w: 3 }, { enemies: ['brigand', 'brigand'], w: 1 }],
      tiles: g.rows(),
      warps: [
        L.warp(W - 1, 12, 'route3', 1, 26, 'right'),
        L.warp(W - 1, 13, 'route3', 1, 27, 'right'),
      ],
      signs: [{ x: 26, y: 10, text: 'KEEP OUT\nThis means you. Unless you are a bandit. Then come in, the stew is on.' }],
      objects: [
        { x: 4, y: 6, type: 'chest', id: 'bc_hoard_elixir', item: 'elixir', qty: 2 },
        { x: 8, y: 6, type: 'chest', id: 'bc_strongbox', gold: 300 },
        { x: 21, y: 4, type: 'chest', id: 'bc_loot_tonics', item: 'potion', qty: 3 },
        { x: 4, y: 20, type: 'chest', id: 'bc_loot_herbs', item: 'herb', qty: 3 },
      ],
      npcs: [
        { id: 'hugh', x: 7, y: 5, look: 'hugh', dir: 'down', move: 'still', name: 'Black Hugh', cond: () => !F('beat_hugh'), script: (c, npc) => G.content.story.hugh(c, npc) },
        { id: 'hugh_tied', x: 7, y: 5, look: 'hugh', dir: 'down', move: 'still', name: 'Black Hugh (tied up)', cond: () => F('beat_hugh'), script: L.talk(['Mmmph! MMMPH!', '(He seems to be saying "the knots are very good". Thank Aldric\'s stable days.)']) },
        {
          id: 'bcb1', x: 18, y: 12, look: brigandLook, dir: 'right', move: 'still', name: 'Gatewatch Gorm', cond: () => !F('beat_hugh'),
          trainer: { sight: 4, flag: 'beat_bc_gorm', battle: { type: 'sword', opts: { enemies: ['brigand', 'brigand'], arena: 'road', title: 'Gorm & Gilly' } }, intro: 'Oi! Gilly! Intruder! Get the pointy things!', win: 'Hugh\'s gonna be so cross...', lose: 'Into the stew pot with you!' },
          script: L.talk('I just work here. The dental plan is terrible.'),
        },
        {
          id: 'bcb2', x: 11, y: 9, look: { skin: '#c99a70', hair: '#2a1a10', hairStyle: 'bald', beard: '#5a3a1a', tunic: '#3a3a2a', pants: '#2a2a1a', boots: '#1a1a10' }, dir: 'down', move: 'still', name: 'Big Maggie', cond: () => !F('beat_hugh'),
          trainer: { sight: 3, flag: 'beat_bc_maggie', battle: { type: 'sword', opts: { enemies: ['brigand_brute'], arena: 'road', title: 'Big Maggie' } }, intro: 'Hugh\'s napping. Nobody disturbs Hugh\'s nap. NOBODY.', win: 'Fine. Disturb him. See what happens. (Please beat him.)', lose: 'Shhh. Nap time.' },
          script: L.talk('Between you and me, Hugh snores like a bear with a cold.'),
        },
        {
          id: 'bcb3', x: 16, y: 18, look: brigandLook, dir: 'up', move: 'still', name: 'Sneaky Pete', cond: () => !F('beat_hugh'),
          trainer: { sight: 3, flag: 'beat_bc_pete', battle: { type: 'sword', opts: { enemies: ['rogue_knight'], arena: 'road', title: 'Sneaky Pete' } }, intro: 'You didn\'t see me. ...You did? Drat.', win: 'I\'ll sneak away now. Quietly.', lose: 'Sneak attack!' },
          script: L.talk('I\'m not here.'),
        },
        {
          id: 'captive', x: 21, y: 7, look: 'merchant', dir: 'left', move: 'still', name: 'Captive Merchant',
          script: async (c, npc) => {
            if (F('beat_hugh') && !F('captive_freed')) {
              await L.say(c, npc, ['You beat Black Hugh! I\'m free!', 'Take this, from my hidden boot purse. Hugh never thought to check the boot.']);
              c.gold(200); c.setFlag('captive_freed');
            } else if (F('captive_freed')) await L.say(c, npc, 'I\'m staying a bit. The stew is honestly very good.');
            else await L.say(c, npc, ['Psst! They took my wagon and my dignity!', 'Black Hugh sits on his dais up north-west. Please, beat him!']);
          },
        },
      ],
    };
  });
})();
