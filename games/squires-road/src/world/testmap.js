// World: developer test maps. G.maps.__test uses every legend tile, every NPC
// move type, a trainer, a sign, chests, an item, warps into interiors, tall
// grass with encounters, and an east edge into __test_field.
(() => {
  const R = (...parts) => parts.join('');
  G.maps.__test = {
    id: '__test', name: 'Testbrook', music: 'village', outdoor: true, encounterRate: 0.12,
    encounters: [{ enemies: ['wolf'], w: 3 }, { enemies: ['boar'], w: 2 }, { enemies: ['bandit', 'bandit'], w: 1 }],
    tiles: [
      'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
      R('T', 't.......t..', '.', 'CCCCCCCCCC', '....tt...', ',,,,,,t', 'T'),
      R('T', '..^^^^^....', '.', 'cc*cccc*cc', '.........', ',,,,,,,', 'T'),
      R('T', '..^^^^^....', '.', 'ccccggcccc', '..:::....', ',,,,,,,', 'T'),
      R('T', '..#WdW#....', '.', '==========', '..:::....', ',,,,,,,', 'T'),
      R('T', '...._......', '.', '=o====p===', '.........', ',,,,,,,', 'T'),
      R('T', '...._______', '_', '==========', '_________', '_______', '_'),
      R('T', '...........', '.', '=mmm==mm==', '.S.......', ',,,,,,,', 'T'),
      R('T', '.fffFfff...', '.', '==========', '...h.x...', ',,,,,,,', 'T'),
      R('T', '.f:::::f...', '.', '....__....', '...hxx...', ',,,,,,,', 'T'),
      R('T', '.f::b::f...', '.', '....__....', '.........', ',,,,,,,', 'T'),
      R('T', '.f:::::f...', '.', '....__....', '..r..b...', '.......', 'T'),
      R('T', '.fffffff...', '.', '....__....', '.........', '...t...', 'T'),
      R('T', '...........', '.', 'wwww__wwww', '......:::.......', 'T'),
      R('T', '.ssssssss..', '.', '....__....', '..t..........t..', 'T'),
      R('T', '.ss~~~~ss..', '.', '....__....', '..p..........p..', 'T'),
      R('T', '.ss~~~~~s..', '.', '....__....', 'qqqqqqqqqqqqqqqq', 'T'),
      R('T', '..ss~~ss...', '.', '....__....', 'qqqqqqqqqqqqqqqq', 'T'),
      R('T', '...s~~s....', '.', '....__....', 'qqaaaaaaaaaaaaqq', 'T'),
      R('T', 'T..s~~s..T.', '.', '....__....', 'qqa||||||||||aqq', 'T'),
      R('T', '____BB_____', '_', '______....', 'qqaaaaaaaaaaaaqq', 'T'),
      R('T', '...s~~s....', '.', '....__....', 'qqaaaaaaaaaaaaqq', 'T'),
      R('T', '..t.~~.t...', '.', '....__....', 'qqqqqqqaaqqqqqqq', 'T'),
      R('T', '...r~~.....', '.', '....______', '_________.......', 'T'),
      R('T', '....;;.....', '.', '..........', '....bb....rr....', 'T'),
      R('T', '...s~~s....', '.', '...T..T...', '...............t', 'T'),
      R('T', '..s~~~~s...', '.', '..........', '..T..........T..', 'T'),
      R('T', '.ss~~~~ss..', '.', '.tt....tt.', '......xx.......t', 'T'),
      R('T', '.s~~~~~~s..', '.', '..........', '....T....T......', 'T'),
      R('T', 'TT~~~~~~TTT', 'T', 'TTTTTTTTTT', 'TTTTTTTTTTTTTTTT', 'T'),
    ],
    warps: [
      { x: 5, y: 4, to: '__test_house', tx: 4, ty: 6, dir: 'up' },
      { x: 17, y: 3, to: '__test_hall', tx: 5, ty: 7, dir: 'up' },
      { x: 18, y: 3, to: '__test_hall', tx: 6, ty: 7, dir: 'up' },
    ],
    edges: { east: { to: '__test_field', offset: 1 } },
    signs: [{ x: 24, y: 7, text: 'TESTBROOK\nWhere every tile comes to be tested.' }],
    objects: [
      { x: 10, y: 1, type: 'chest', id: 'c1', item: 'herb', qty: 2 },
      { x: 1, y: 20, type: 'item', id: 'i1', item: 'bread' },
      { x: 37, y: 28, type: 'chest', id: 'c2', item: 'gold', qty: 25 },
    ],
    npcs: [
      { id: 'guard', x: 16, y: 4, look: 'guard', dir: 'down', move: 'still', name: 'Guard',
        script: async (c, npc) => { await c.say('The castle hall is through that gate. Mind the torches.', { name: npc.name, look: npc.look }); } },
      { id: 'elder', x: 27, y: 10, look: 'elder', dir: 'down', move: 'turn', name: 'Elder Moss',
        script: async (c, npc) => {
          const who = { name: npc.name, look: npc.look };
          const i = await c.ask('Shall I show you a trick, young one?', ['Yes', 'No'], who);
          if (i !== 0) { await c.say('Another time, then.', who); return; }
          await c.shake(400);
          await c.walkNpc('elder', 'LLRR');
          c.faceNpc('elder', 'player');
          await c.say('Hah! These old legs still work.', who);
        } },
      { id: 'maid', x: 9, y: 10, look: 'villagerF', dir: 'down', move: 'wander', name: 'Bess',
        script: async (c, npc) => { await c.say('Lovely flowers this year, aren\'t they?', { name: npc.name, look: npc.look }); } },
      { id: 'kid', x: 21, y: 6, look: 'child', dir: 'left', move: 'wander', name: 'Pip',
        script: async (c, npc) => { await c.say('I\'m gonna be a knight someday!', { name: npc.name, look: npc.look }); } },
      { id: 'hedge', x: 21, y: 17, look: 'hedgeKnight', dir: 'left', move: 'still', name: 'Hedge Knight',
        trainer: { sight: 4, flag: 'beat_test_hedge', battle: { type: 'sword', opts: { enemies: ['hedge_knight'] } },
          intro: 'Halt! None pass without crossing swords with me!', win: 'Well fought. The road is yours.', lose: 'Train harder, squire.' },
        script: async (c, npc) => { await c.say('You fight well for a stable hand.', { name: npc.name, look: npc.look }); } },
      { id: 'ghost', x: 11, y: 13, look: 'monk', dir: 'down', move: 'still', name: 'Hooded Monk', cond: () => !G.state.flags.test_monk_gone,
        script: async (c, npc) => {
          await c.say('I was never here...', { name: npc.name, look: npc.look });
          await c.walkNpc('ghost', 'DD');
          c.showNpc('ghost', false);
          c.setFlag('test_monk_gone');
        } },
    ],
  };

  G.maps.__test_house = {
    id: '__test_house', name: 'Testbrook', music: 'town', outdoor: false,
    tiles: [
      'nnnnnnnnnn',
      'nnWnn*nWnn',
      'kllkkkkkek',
      'kkkkkkkkkk',
      'kvvvkkkkkk',
      'kkkkkkkkkk',
      'kkkkkkkkuk',
      'kkkkdkkkkk',
    ],
    warps: [{ x: 4, y: 7, to: '__test', tx: 5, ty: 5, dir: 'down' }, { x: 8, y: 6, to: '__test_hall', tx: 9, ty: 5, dir: 'down' }],
    npcs: [
      { id: 'keeper', x: 2, y: 3, look: 'merchant', dir: 'down', move: 'still', name: 'Shopkeep',
        script: async (c, npc) => { await c.say('Welcome! Nothing for sale in the test house, sorry.', { name: npc.name, look: npc.look }); } },
    ],
    objects: [{ x: 6, y: 2, type: 'chest', id: 'c3', item: 'potion' }],
  };

  G.maps.__test_hall = {
    id: '__test_hall', name: 'Test Hall', music: 'castle', outdoor: false,
    tiles: [
      '""""""""""""',
      '"cccccccccc"',
      '"c*cccccc*c"',
      '"KKKKKKKKKK"',
      '"KKKKKKKKuK"',
      '"KKKKKKKKKK"',
      '"KKKKKKKKKK"',
      '"KKKKKKKKKK"',
      '"KKKKddKKKK"',
      '""""""""""""',
    ],
    warps: [
      { x: 5, y: 8, to: '__test', tx: 17, ty: 4, dir: 'down' },
      { x: 6, y: 8, to: '__test', tx: 18, ty: 4, dir: 'down' },
      { x: 9, y: 4, to: '__test_house', tx: 8, ty: 5, dir: 'up' },
    ],
    npcs: [
      { id: 'archer', x: 3, y: 4, look: 'archer', dir: 'right', move: 'still', name: 'Bowman',
        trainer: { sight: 3, flag: 'beat_test_archer', battle: { type: 'archery', opts: { rivals: ['arch_tam'], tier: 1 } },
          intro: 'Let us see your aim!', win: 'A fine shot!', lose: 'Practice makes perfect.', xp: 30, gold: 20 } },
    ],
  };

  G.maps.__test_field = {
    id: '__test_field', name: 'Test Meadow', music: 'route', outdoor: true, encounterRate: 0.15,
    encounters: [{ enemies: ['wolf'], w: 1 }],
    tiles: [
      'tttttttttttttttttttt',
      't....,,,,,,.......tt',
      't...,,,,,,,,..r...tt',
      't...,,,,,,,,......tt',
      't....,,,,,,....::..t',
      't..........b...::..t',
      't..................t',
      '_________________..t',
      't........_.........t',
      't.,,,,..._....T....t',
      't.,,,,,.._.........t',
      't..,,,..._.....T...t',
      't........_.........t',
      'tttttttttttttttttttt',
    ],
    edges: { west: { to: '__test', offset: -1 } },
    npcs: [
      { id: 'lass', x: 12, y: 8, look: 'villagerF', dir: 'left', move: 'still', name: 'Lass Ada',
        trainer: { sight: 3, flag: 'beat_test_lass', battle: { type: 'sword', opts: { enemies: ['bandit'] } },
          intro: 'You look strong! Fight me!', win: 'Aww, I lost!' } },
    ],
  };
})();
