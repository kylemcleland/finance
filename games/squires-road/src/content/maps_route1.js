// Route 1: Whisperwood. A winding forest path from Thornbrook (west) to Millbridge (east).
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];

  def('route1', (L) => {
    const W = 60, H = 24;
    const g = L.grid(W, H, 't');
    g.scatter(0, 0, W, H, 'T', 0.35, 101, 't');
    const P = [[0, 10], [9, 10], [9, 5], [21, 5], [21, 15], [31, 15], [31, 8], [44, 8], [44, 17], [52, 17], [52, 12], [W - 1, 12]];
    g.carve(P, 2, '.', 7);
    // side pockets
    g.rect(25, 1, 5, 3, '.');                    // lost arrows clearing (north)
    g.vline(4, 13, 17, '.'); g.rect(2, 17, 5, 4, '.'); // hidden hollow (south-west)
    g.rect(46, 19, 6, 3, '.');                    // hermit's camp
    g.rect(55, 2, 3, 3, '.'); g.vline(56, 5, 9, '.');   // north-east nook
    g.border('t', 1);
    // tall grass, flowers, bushes, rocks
    for (const [x, y, rx, ry, s] of [[14, 8.5, 3, 1.8, 1], [26, 11, 2.5, 3, 2], [35, 13, 2.5, 3, 3], [49, 5, 3.5, 2, 4], [56, 17, 2.5, 2.5, 5], [5, 12, 2.5, 1.5, 6], [16, 2.5, 3, 1.2, 7]])
      g.blob(x, y, rx, ry, ',', s, '.');
    g.scatter(1, 1, W - 2, H - 2, ':', 0.06, 111, '.');
    g.scatter(1, 1, W - 2, H - 2, 'b', 0.03, 112, '.');
    g.scatter(1, 1, W - 2, H - 2, 'r', 0.02, 113, '.');
    // the stream and its bridge
    g.vline(38, 0, H - 1, '~', 2);
    g.path(P, '_', 2);
    g.rect(38, 8, 2, 2, 'B');
    // decor
    g.stamp(26, 1, ['b b', '   ']);
    g.set(48, 20, '*');
    g.stamp(2, 17, ['r   r']);
    g.set(3, 8, 'S'); g.set(57, 10, 'S'); g.set(36, 7, 'S');

    return {
      name: 'Whisperwood', music: 'route', outdoor: true, arena: 'forest',
      encounterRate: 0.08,
      encounters: [
        { enemies: ['wolf'], w: 4 },
        { enemies: ['boar'], w: 3 },
        { enemies: ['bandit'], w: 2 },
        { enemies: ['wolf', 'wolf'], w: 1 },
        { enemies: ['wolf_alpha'], w: 1 },
      ],
      tiles: g.rows(),
      warps: [
        L.warp(0, 10, 'thornbrook', 32, 15, 'left'),
        L.warp(0, 11, 'thornbrook', 32, 16, 'left'),
        L.warp(W - 1, 12, 'millbridge', 1, 14, 'right'),
        L.warp(W - 1, 13, 'millbridge', 1, 15, 'right'),
      ],
      signs: [
        { x: 3, y: 8, text: 'WHISPERWOOD\nPlease do not feed the wolves. They are not hungry for bread.' },
        { x: 57, y: 10, text: 'EAST: Millbridge.\n"We grind it so you don\'t have to!"' },
        { x: 36, y: 7, text: 'Bridge toll: one (1) compliment.\nThe bridge is lovely. Thank you.' },
      ],
      objects: [
        { x: 27, y: 2, type: 'chest', id: 'r1_lost_arrows', item: 'lost_arrows', qty: 1 },
        { x: 4, y: 18, type: 'chest', id: 'r1_hollow_tonic', item: 'potion', qty: 1 },
        { x: 3, y: 19, type: 'chest', id: 'r1_hollow_gold', gold: 40 },
        { x: 56, y: 3, type: 'chest', id: 'r1_nook_herbs', item: 'herb', qty: 2 },
        { x: 50, y: 21, type: 'chest', id: 'r1_camp_bread', item: 'bread', qty: 2 },
      ],
      npcs: [
        {
          id: 'woodcutter', x: 6, y: 8, look: 'farmer', dir: 'down', move: 'turn', name: 'Woodcutter Alf',
          script: L.talk(() => F('arrows_returned') || G.player.has('lost_arrows')
            ? ['Chop chop. That is my whole personality.']
            : ['The miller\'s cart tipped over by the old stumps up north.', 'Arrows everywhere! He picked most up. Not all.']),
        },
        {
          id: 'hk1', x: 17, y: 3, look: 'hedgeKnight', dir: 'down', move: 'still', name: 'Sir Brambleby',
          trainer: {
            sight: 4, flag: 'beat_r1_hk1',
            battle: { type: 'sword', opts: { enemies: ['hedge_knight'], arena: 'forest', title: 'Sir Brambleby' } },
            intro: 'Halt! None pass Sir Brambleby without a duel! Well, most do. I nap a lot.',
            win: 'Yield! I yield! Take my purse, it is mostly buttons.',
            lose: 'Ha! Back to the hay with you!',
          },
          script: L.talk('A hedge knight\'s life: sleeping in hedges. It is in the name.'),
        },
        {
          id: 'band1', x: 34, y: 12, look: 'bandit', dir: 'left', move: 'still', name: 'Nicky Knives',
          trainer: {
            sight: 4, flag: 'beat_r1_band1',
            battle: { type: 'sword', opts: { enemies: ['bandit'], arena: 'forest', title: 'Nicky Knives' } },
            intro: 'Your money or your life! ...Or, like, half your money?',
            win: 'Ow! Fine! I only had the one knife anyway.',
            lose: 'Thanks for the donation!',
          },
          script: L.talk('I\'m thinking of a career change. Maybe juggling. I already own the knife.'),
        },
        {
          id: 'hk2', x: 47, y: 11, look: 'hedgeKnight', dir: 'left', move: 'still', name: 'Sir Wobbleton',
          trainer: {
            sight: 4, flag: 'beat_r1_hk2',
            battle: { type: 'sword', opts: { enemies: ['hedge_knight'], arena: 'forest', title: 'Sir Wobbleton' } },
            intro: 'I am Sir Wobbleton, terror of the hedgerow! Have at you!',
            win: 'I wobbled. I always wobble. It is in my name, really.',
            lose: 'The hedgerow remains terrorised!',
          },
          script: L.talk('Tip: a dodge-roll at the right moment beats any shield.'),
        },
        {
          id: 'moss', x: 49, y: 20, look: 'hermit', dir: 'left', move: 'still', name: 'Old Moss',
          script: async (c, npc) => {
            await L.say(c, npc, ['Sit by my fire, little squire. Rest your bones.']);
            c.heal();
            await L.say(c, npc, G.U.pick([
              ['Wolves bite fast but bruise easy. Parry them, then strike thrice.', 'Boars charge in a line. Roll sideways. Let them kiss a tree.'],
              ['Every level brings a perk point. Spend them in the menu.', 'Riposte after a parry hits like a falling oak.'],
              ['I have lived in this wood forty years.', 'The squirrels pay rent in acorns. I am very rich, in acorns.'],
            ]));
          },
        },
      ],
    };
  });
})();
