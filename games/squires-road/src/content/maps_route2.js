// Route 2: Greenmeadow. Fields, farms, a river with a stone bridge (and a troll). Millbridge (west) to Harrowfield (east).
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];

  def('route2', (L) => {
    const W = 64, H = 26;
    const g = L.grid(W, H, '.');
    g.border('T', 1);
    g.scatter(1, 1, W - 2, 3, 'T', 0.45, 301);
    g.scatter(1, H - 4, W - 2, 3, 'T', 0.45, 302);
    g.scatter(2, 2, W - 4, H - 4, ':', 0.07, 303);
    g.scatter(2, 4, W - 4, H - 8, 'T', 0.025, 304);
    // farm fields (tall wheat = encounters)
    g.frame(3, 15, 10, 6, 'f'); g.rect(4, 16, 8, 4, ','); g.set(7, 15, 'F');
    g.frame(12, 2, 8, 4, 'f'); g.rect(13, 3, 6, 2, ','); g.set(15, 5, 'F');
    g.blob(16, 18, 4, 3, ',', 31, '.:');
    g.blob(26, 4, 3, 2, ',', 32, '.:');
    g.blob(36, 7, 4, 3, ',', 33, '.:');
    g.blob(47, 9, 3.5, 2.5, ',', 34, '.:');
    g.blob(57, 20, 4, 2, ',', 35, '.:');
    g.blob(45, 21, 3, 1.5, ',', 36, '.:');
    // hedgerows
    g.hline(36, 46, 3, 'b');
    g.frame(52, 2, 9, 7, 'f'); g.rect(53, 3, 7, 5, '.'); g.set(56, 8, 'F'); g.stamp(53, 3, ['hh', 'h']);
    // the river and its pool, the troll's sandbar
    g.vline(30, 0, H - 1, '~', 3);
    g.rect(28, 17, 7, 6, '~');
    g.rect(30, 18, 3, 3, 's');
    g.set(29, 19, ';'); g.set(28, 19, ';');
    // the road
    const P = [[0, 12], [10, 12], [10, 7], [22, 7], [22, 13], [40, 13], [40, 18], [52, 18], [52, 14], [W - 1, 14]];
    g.path(P, '_', 2);
    g.rect(30, 13, 3, 2, 'B');
    g.rect(1, 11, 2, 4, '.'); g.path([[0, 12], [3, 12]], '_', 2);
    g.rect(43, 15, 3, 3, '.'); g.rect(3, 2, 3, 3, '.');
    // decor and signs
    g.stamp(24, 10, ['r']); g.stamp(43, 11, ['rr']);
    g.set(3, 10, 'S'); g.set(28, 11, 'S'); g.set(60, 12, 'S'); g.set(21, 15, 'S');

    return {
      name: 'Greenmeadow', music: 'route', outdoor: true, arena: 'field',
      encounterRate: 0.09,
      encounters: [
        { enemies: ['bandit_thug'], w: 3 },
        { enemies: ['hedge_duelist'], w: 2 },
        { enemies: ['wolf_alpha'], w: 2 },
        { enemies: ['boar', 'boar'], w: 2 },
        { enemies: ['wolf', 'wolf', 'wolf'], w: 1 },
        { enemies: ['bandit', 'bandit'], w: 2 },
      ],
      tiles: g.rows(),
      warps: [
        L.warp(0, 12, 'millbridge', 34, 14, 'left'),
        L.warp(0, 13, 'millbridge', 34, 15, 'left'),
        L.warp(W - 1, 14, 'harrowfield', 1, 16, 'right'),
        L.warp(W - 1, 15, 'harrowfield', 1, 17, 'right'),
      ],
      signs: [
        { x: 3, y: 10, text: 'GREENMEADOW\nMind the cows. There are no cows. Mind them anyway.' },
        { x: 28, y: 11, text: 'OLD STONE BRIDGE\nTroll NOT under bridge. Troll is next to bridge. Different thing.' },
        { x: 60, y: 12, text: 'EAST: Harrowfield, home of the Lists.\nHorses have right of way.' },
        { x: 21, y: 15, text: 'Farmer Gale\'s wheat.\nIf you hear growling in the wheat, that is not the wheat.' },
      ],
      objects: [
        { x: 59, y: 3, type: 'chest', id: 'r2_horseshoe', item: 'horseshoe', qty: 1 },
        { x: 32, y: 18, type: 'chest', id: 'r2_troll_hoard', item: 'elixir', qty: 1 },
        { x: 4, y: 3, type: 'chest', id: 'r2_nw_tonic', item: 'potion', qty: 2 },
        { x: 5, y: 2, type: 'chest', id: 'r2_nw_gold', gold: 75 },
        { x: 47, y: 23, type: 'chest', id: 'r2_se_herbs', item: 'herb', qty: 3 },
      ],
      npcs: [
        {
          id: 'cedric', x: 31, y: 13, look: 'cedric', dir: 'left', move: 'still', name: 'Cedric of Vane',
          cond: () => F('rival1') && !F('rival2'),
          script: (c, npc) => G.content.story.rival2(c, npc),
        },
        {
          id: 'troll', x: 30, y: 19, look: { skin: '#7aa05a', hair: '#4a6a3a', hairStyle: 'spiky', tunic: '#6a5a3a', pants: '#4a3a2a', boots: '#3a2a1a', beard: '#5a7a4a' },
          dir: 'left', move: 'still', name: 'Grumbold the Troll', cond: () => !F('beat_troll'),
          script: (c, npc) => G.content.story.troll(c, npc),
        },
        {
          id: 'troll_sulk', x: 31, y: 20, look: { skin: '#7aa05a', hair: '#4a6a3a', hairStyle: 'spiky', tunic: '#6a5a3a', pants: '#4a3a2a', boots: '#3a2a1a', beard: '#5a7a4a' },
          dir: 'down', move: 'still', name: 'Grumbold the Troll', cond: () => F('beat_troll'),
          script: L.talk(['Grumbold sulks. Grumbold was going to be a bridge troll.', 'But the bridge said no. Bridge is very rude.']),
        },
        {
          id: 'prickle', x: 16, y: 9, look: { skin: '#f0c49a', hair: '#8a3a1a', hairStyle: 'long', tunic: '#6a7a3a', pants: '#4a4a40', boots: '#2b2b20', helmet: '#9a9a8a', plume: '#d07a8a' },
          dir: 'up', move: 'still', name: 'Dame Prickle',
          trainer: {
            sight: 4, flag: 'beat_r2_prickle',
            battle: { type: 'sword', opts: { enemies: ['hedge_duelist'], arena: 'field', title: 'Dame Prickle' } },
            intro: 'They call me Prickle because I am sharp. And because of the hedge incident.',
            win: 'Ow. You are sharper. Fine, take a prickle-purse.',
            lose: 'Prickled!',
          },
          script: L.talk('Feint, step, strike. Duelists punish wild swings.'),
        },
        {
          id: 'rolf', x: 26, y: 10, look: 'bandit', dir: 'left', move: 'still', name: 'Big Rolf',
          trainer: {
            sight: 4, flag: 'beat_r2_rolf',
            battle: { type: 'sword', opts: { enemies: ['bandit_thug'], arena: 'field', title: 'Big Rolf' } },
            intro: 'This is a toll road. The toll is: everything.',
            win: 'Okay, okay! It\'s a free road! Free road!',
            lose: 'Pleasure doing business!',
          },
          script: L.talk('I\'m Big Rolf. My brother is Small Rolf. He is bigger than me. Long story.'),
        },
        {
          id: 'puddle', x: 44, y: 16, look: 'hedgeKnight', dir: 'left', move: 'still', name: 'Sir Puddle',
          trainer: {
            sight: 4, flag: 'beat_r2_puddle',
            battle: { type: 'sword', opts: { enemies: ['hedge_knight', 'hedge_knight'], arena: 'field', title: 'Sir Puddle & Squire Drizzle' } },
            intro: 'Sir Puddle and his loyal squire Drizzle! Two against one is CHIVALROUS, actually!',
            win: 'Drizzle, we have been dried.',
            lose: 'Splash!',
          },
          script: L.talk('Fighting two at once? Keep moving so they line up. Never stand between them.'),
        },
        {
          id: 'mallory', x: 55, y: 12, look: { skin: '#e2ae80', hair: '#1a1a1a', tunic: '#2a2a3a', tunic2: '#d6453d', pants: '#1a1a2a', boots: '#111', hood: '#2a2a3a' },
          dir: 'down', move: 'still', name: 'The Masked Mallory',
          trainer: {
            sight: 3, flag: 'beat_r2_mallory',
            battle: { type: 'sword', opts: { enemies: ['hedge_duelist'], arena: 'field', title: 'The Masked Mallory' } },
            intro: 'Who am I? A mystery! A shadow! (It is Mallory.)',
            win: 'My mask! My identity is... still Mallory. Drat.',
            lose: 'Vanish! (I am still here.)',
          },
          script: L.talk('Nobody knows my true identity. Except everybody. Mallory\'s a small village.'),
        },
        {
          id: 'mara', x: 48, y: 13, look: 'archer', dir: 'down', move: 'turn', name: 'Huntress Mara',
          script: L.challenge({
            type: 'archery', need: 'bow', flag: 'beat_r2_mara',
            opts: { rivals: ['arch_lia'], tier: 1, title: 'Hunter\'s Wager' },
            intro: 'A bow on your back! Shoot against my apprentice Lia? Three ends, winner takes the purse.',
            win: 'Lia is sulking. That means you were good. Here!',
            lose: 'Ha! Lia will be insufferable now. Try again any time.',
            again: 'Lia still talks about your shooting. Mostly the swearing.',
            needText: 'No bow? Millbridge sells them. Then come shoot with us!',
            gold: 40,
          }),
        },
        { id: 'gale', x: 8, y: 14, look: 'farmer', dir: 'down', move: 'turn', name: 'Farmer Gale', script: L.talk(['Wolves in my wheat again!', 'Tall grass hides beasties. Walk the road if you want a quiet stroll.']) },
        {
          id: 'scarecrow', x: 14, y: 21, look: 'dummy', dir: 'down', move: 'still', name: 'Scarecrow',
          script: L.talk(['...', 'Psst. Tell my cousin Gerald in Thornbrook I said hello.', 'Also tell him he still owes me a hat.']),
        },
        {
          id: 'shepherd', x: 57, y: 6, look: 'villagerM', dir: 'left', move: 'wander', name: 'Old Tam',
          script: L.talk(() => F('horseshoe_returned') || G.player.has('horseshoe')
            ? ['Found Tobias\'s shoe? He\'ll be over the moon. Harrowfield stable, east.']
            : ['Tobias the stable master lost his lucky horseshoe out here.', 'Last I saw, it was glinting in my sheep pen. The sheep took no interest.']),
        },
      ],
      onEnter: async (c) => {
        if (F('rival1') && !F('rival2') && !F('cedric2_shout')) {
          c.setFlag('cedric2_shout');
          await c.wait(300);
          await c.say('A familiar, irritating voice drifts from the old stone bridge:\n"Is that the STABLE RAT? Come here, I want a word!"');
        }
      },
    };
  });
})();
