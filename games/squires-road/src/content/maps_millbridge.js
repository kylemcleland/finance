// Millbridge: the river town with the mill, the Archery Range, bowyer, smith and inn.
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];

  def('millbridge', (L) => {
    const W = 36, H = 28;
    const g = L.grid(W, H, '.');
    g.border('T', 1);
    g.scatter(1, 1, W - 2, 2, 'T', 0.5, 201);
    g.scatter(1, H - 3, W - 2, 2, 'T', 0.5, 202);
    g.scatter(1, 1, 2, H - 2, 'T', 0.4, 203);
    g.scatter(W - 3, 1, 2, H - 2, 'T', 0.4, 204);
    g.scatter(2, 2, W - 4, H - 4, ':', 0.06, 205);
    g.rect(1, 12, 3, 5, '.'); g.rect(W - 4, 12, 3, 5, '.');
    // river
    g.vline(17, 0, H - 1, '~', 3);
    // road + cobbles + bridge
    g.hline(0, W - 1, 14, '_', 2);
    g.hline(8, 30, 14, '=', 2);
    g.rect(17, 14, 3, 2, 'B');
    // north-west: mill, inn, smith
    const mill = g.house(9, 2, 6, 5, { roof: 3, win: [1, 4] }); g.set(mill.x, mill.y, '#');
    g.stamp(15, 3, ['xx', 'xx', 'xx']);  // the great wheel
    g.house(2, 8, 6, 5, { roof: 3, door: 2, win: [0, 5] });   // inn (4,12)
    g.house(9, 9, 6, 4, { roof: 2, door: 2, win: [4] });       // smith (11,12)
    g.vline(4, 13, 13, '_'); g.vline(11, 13, 13, '_');
    g.stamp(15, 10, ['x', 'h']);
    g.stamp(9, 7, ['hh']);
    // north-east: the Range
    g.house(21, 3, 12, 6, { roof: 3, door: 6 });               // range (27,8)
    g.set(24, 8, 'p'); g.set(30, 8, 'p');
    g.vline(27, 9, 13, '_');
    g.stamp(21, 10, ['h  h', '    ']);
    // south-east: bowyer + cottage
    g.house(22, 18, 6, 5, { roof: 3, door: 3, win: [1] });     // bowyer (25,22)
    g.path([[25, 23], [21, 23], [21, 16]], '_', 1);
    const ct = g.house(29, 18, 5, 4, { roof: 2, win: [1, 3] }); g.set(ct.x, ct.y, 'W');
    // south-west: cottage, garden, fishing bank
    const ct2 = g.house(3, 19, 5, 4, { roof: 2, win: [1, 3] }); g.set(ct2.x, ct2.y, 'W');
    g.frame(9, 18, 6, 5, 'f'); g.rect(10, 19, 4, 3, ':'); g.set(11, 22, 'F');
    g.path([[11, 23], [8, 23], [8, 16]], '_', 1);
    // ford in the south
    g.rect(17, 24, 3, 1, ';');
    // signs
    g.set(2, 12, 'S'); g.set(26, 9, 'S'); g.set(24, 23, 'S'); g.set(16, 16, 'S'); g.set(12, 13, 'S'); g.set(5, 13, 'S');
    g.set(33, 12, 'S');

    return {
      name: 'Millbridge', music: 'town', outdoor: true,
      tiles: g.rows(),
      warps: [
        L.warp(0, 14, 'route1', 58, 12, 'left'),
        L.warp(0, 15, 'route1', 58, 13, 'left'),
        L.warp(W - 1, 14, 'route2', 1, 12, 'right'),
        L.warp(W - 1, 15, 'route2', 1, 13, 'right'),
        L.warp(4, 12, 'millbridge_inn', 5, 7, 'up'),
        L.warp(11, 12, 'millbridge_smith', 4, 6, 'up'),
        L.warp(27, 8, 'millbridge_range', 7, 10, 'up'),
        L.warp(25, 22, 'millbridge_bowyer', 4, 6, 'up'),
      ],
      signs: [
        { x: 2, y: 12, text: 'MILLBRIDGE\n"We grind it so you don\'t have to!"' },
        { x: 26, y: 9, text: 'MILLBRIDGE ARCHERY RANGE\nMaster: Wren. Bows required. Apples on heads NOT permitted.' },
        { x: 24, y: 23, text: 'FLETCH & DAUGHTERS, BOWYERS\nBows, strings, and very pointy sticks.' },
        { x: 16, y: 16, text: 'NO SWIMMING.\nThe river is busy.' },
        { x: 12, y: 13, text: 'IRONHAND IDA\'S SMITHY\nIf it\'s broke, I\'ll fix it. If it isn\'t, I\'ll hit it anyway.' },
        { x: 5, y: 13, text: 'THE DRUNKEN DUCK INN\nRooms 15 gold. Ducks sober.' },
        { x: 33, y: 12, text: 'EAST: Greenmeadow and Harrowfield.\nHorses ahead. Watch your step.' },
      ],
      objects: [
        { x: 32, y: 24, type: 'chest', id: 'mb_chest_garden', item: 'herb', qty: 2 },
        { x: 2, y: 3, type: 'chest', id: 'mb_chest_nw', item: 'potion', qty: 1 },
      ],
      npcs: [
        { id: 'miller', x: 12, y: 7, look: 'miller', dir: 'down', move: 'turn', name: 'Hamish the Miller', script: (c, npc) => G.content.story.miller(c, npc) },
        {
          id: 'crier', x: 23, y: 12, look: 'crier', dir: 'down', move: 'turn', name: 'Town Crier',
          script: L.talk(() => F('beat_hugh')
            ? ['HEAR YE! Black Hugh is BEATEN! By a squire! From a STABLE!', 'Free bread at the Duck! (Not really. But hooray!)']
            : ['HEAR YE! The Archery Novice Cup is open!', 'Contestants must bring a BOW. Last year a man brought a BOWL. It went poorly.']),
        },
        { id: 'gil', x: 16, y: 21, look: 'fisher', dir: 'right', move: 'still', name: 'Gil the Fisher', script: L.talk(['Wind pushes arrows like current pushes a float.', 'Aim a touch upwind. A touch! Not a shove.']) },
        { id: 'bess', x: 6, y: 16, look: 'kidB', dir: 'down', move: 'wander', name: 'Bess', script: L.talk(['Wren hit an apple off my head once!', 'Mum was cross. It was HER apple.']) },
        { id: 'odo', x: 29, y: 16, look: 'villagerM', dir: 'down', move: 'wander', name: 'Odo', script: L.talk(['Archery is about breath. Draw, settle, release.', 'Hold too long and your arms start shaking like a wet dog.']) },
        { id: 'grain', x: 13, y: 24, look: 'villagerF', dir: 'up', move: 'turn', name: 'Agnes', script: L.talk(['The flowers here grow on mill dust and gossip.', 'Mostly gossip. Did you hear Cedric of Vane passed through? Eleven ponies!']) },
        { id: 'mbguard', x: 33, y: 16, look: 'guard', dir: 'left', move: 'still', name: 'Guard Tibbs', script: L.talk(['Greenmeadow ahead. Hedge knights, bandits, and a troll under the old stone bridge.', 'The troll is optional. Strongly optional.']) },
      ],
    };
  });

  def('millbridge_inn', (L) => {
    const g = L.room(12, 9, 'k', 5);
    g.stamp(1, 2, ['eekkllkkee', 'kkkkkkkkkk', 'vvvkkvkkkk', 'kkkkkkkvkk', 'kkkkkkkkkk', 'xkkkkkkkkx']);
    g.set(3, 1, '*'); g.set(8, 1, '*');
    return {
      name: 'The Drunken Duck', music: 'town', outdoor: false, tiles: g.rows(),
      warps: [L.warp(5, 8, 'millbridge', 4, 13, 'down')],
      npcs: [
        { id: 'rosie', x: 2, y: 3, look: 'innkeep', dir: 'down', move: 'still', name: 'Rosie', script: async (c, npc) => { await L.say(c, npc, 'Room for the night? 15 gold, and the duck stays outside.'); await c.inn(15); } },
        { id: 'patron', x: 7, y: 4, look: 'archer', dir: 'down', move: 'turn', name: 'Tipsy Archer', script: L.talk(['Perks! Calm Breath stops the shakes. Windreader shows the drift.', 'I took Quick Draw. Now I miss twice as fast.']) },
        { id: 'duckman', x: 9, y: 6, look: 'monk', dir: 'left', move: 'still', name: 'Brother Quill', script: L.talk(['I have taken a vow of silence.', '...', 'It is not going well.']) },
      ],
    };
  });

  def('millbridge_bowyer', (L) => {
    const g = L.room(10, 8, 'k', 4);
    g.stamp(1, 2, ['llllkkll', 'kkkkkkkk', 'vvvkkkkx', 'kkkkkkkk', 'xkkkkkkx']);
    return {
      name: 'Fletch & Daughters', music: 'town', outdoor: false, tiles: g.rows(),
      warps: [L.warp(4, 7, 'millbridge', 25, 23, 'down')],
      npcs: [
        { id: 'fletch', x: 2, y: 3, look: 'archer', dir: 'down', move: 'still', name: 'Fletch', script: async (c, npc) => { await L.say(c, npc, ['Bows! Yew, ash, elm. Strung, waxed, ready.', 'A steadier bow sways less. A stronger one laughs at the wind.']); await c.shop('millbridge_bowyer'); } },
        { id: 'fdaughter', x: 6, y: 5, look: 'kidB', dir: 'left', move: 'turn', name: 'Fletch\'s Daughter', script: L.talk(['I made the fletching on every arrow in this shop!', 'Dad says I am the "& Daughters". There are seven of us.']) },
      ],
    };
  });

  def('millbridge_smith', (L) => {
    const g = L.room(10, 8, 'K', 4);
    g.stamp(1, 2, ['xx*kk*ll', 'KKKKKKKK', 'vvvKKvKK', 'KKKKKKKK', 'xKKKKKKx']);
    return {
      name: 'Ironhand Ida\'s Smithy', music: 'town', outdoor: false, tiles: g.rows(),
      warps: [L.warp(4, 7, 'millbridge', 11, 13, 'down')],
      npcs: [
        { id: 'ida', x: 2, y: 3, look: 'smith', dir: 'down', move: 'still', name: 'Ironhand Ida', script: async (c, npc) => { await L.say(c, npc, ['Swords, shields, mail. I hammer, you buy.', 'An iron sword hits near twice as hard as Aldric\'s rusty old pin.']); await c.shop('millbridge_smith'); } },
        { id: 'apprentice', x: 7, y: 5, look: 'squire', dir: 'left', move: 'turn', name: 'Apprentice Tam', script: L.talk(['Heavy weapons are slow but break guards.', 'A tower shield blocks nearly everything, but parrying with it is like waving a door.']) },
      ],
    };
  });

  def('millbridge_range', (L) => {
    const g = L.room(16, 12, 'a', 7, 'q');
    g.stamp(1, 2, ['p  h   h   h p']);
    g.set(4, 1, '*'); g.set(11, 1, '*');
    g.stamp(1, 9, ['x', 'x']); g.stamp(14, 9, ['l', 'x']);
    return {
      name: 'Millbridge Archery Range', music: 'tourney', outdoor: false, tiles: g.rows(),
      warps: [L.warp(7, 11, 'millbridge', 27, 9, 'down')],
      npcs: [
        {
          id: 'wren', x: 7, y: 6, look: 'wren', dir: 'down', move: 'still', name: 'Wren, Range Master',
          script: (c, npc) => G.content.story.hallMaster(c, npc, 'millbridge_range', async () => {
            if (L.hasBow()) { L.ensureEquipped('bow'); return true; }
            await L.say(c, npc, [
              'No bow? Then no contest. Rules are rules.',
              'Fletch sells bows across the river. Or ask Hamish the miller.',
              'He lost his arrows in Whisperwood. Find them and he\'ll owe you a big favour.',
            ]);
            c.setFlag('arrows_quest');
            return false;
          }),
        },
        { id: 'spect1', x: 2, y: 7, look: 'villagerM', dir: 'right', move: 'turn', name: 'Spectator', script: L.talk(['Wren once split an arrow with an arrow.', 'Then split THAT arrow. She owes the bowyer a fortune.']) },
        { id: 'spect2', x: 13, y: 8, look: 'archer', dir: 'left', move: 'turn', name: 'Retired Archer', script: L.talk(['Release before your arms start to shake.', 'The longer you hold after full draw, the more you sway.']) },
      ],
    };
  });
})();
