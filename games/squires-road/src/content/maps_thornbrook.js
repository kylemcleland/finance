// Thornbrook: the starting village, the stable (opening), Aldric's cottage, store, inn and the Sword Pit.
(() => {
  const def = (id, fn) => { let m = null; Object.defineProperty(G.maps, id, { enumerable: true, configurable: true, get: () => m || (m = G.content.lib.build(id, fn)), set: (v) => { m = v; } }); };
  const F = (n) => !!G.state.flags[n];

  // ------------------------------------------------------------------ the stable (start)
  def('thornbrook_stable', (L) => {
    const g = L.room(14, 10, 'k', 6);
    g.stamp(1, 2, [
      'hhkkkkkfkkhh',
      'hkkkkkkfkkkS',
      'kkkkkkkFkkkk',
      'xkkkkkkfkkkh',
      'xkkkkkkfffFf',
      'kkkkkkkkkkkk',
      'hkkkkkkkkkkx',
    ]);
    return {
      name: 'Thornbrook Stable', music: 'village', outdoor: false,
      tiles: g.rows(),
      warps: [L.warp(6, 9, 'thornbrook', 7, 7, 'down')],
      signs: [{ x: 12, y: 3, text: "BUTTERCUP'S STALL.\nButtercup is out. Buttercup is always out." }],
      objects: [{ x: 11, y: 7, type: 'chest', id: 'tb_stable_bread', item: 'bread', qty: 2 }],
      npcs: [
        {
          id: 'aldric', x: 6, y: 8, look: 'aldric', dir: 'up', move: 'still', name: 'Sir Aldric',
          cond: () => F('opening') && !F('met_aldric'),
          script: L.talk(['Off you go, lad!']),
        },
        {
          id: 'hob', x: 10, y: 7, look: 'villagerM', dir: 'left', move: 'turn', name: 'Hob',
          script: async (c, npc) => {
            if (!F('trained')) return L.say(c, npc, 'Morning! You were talking to the hay again.');
            await L.say(c, npc, [
              "Mucking out stalls 'til I die. Living the dream.",
              'Tip: open the menu (top-right ☰) to eat bread, check gear and spend perk points.',
              'Me? I spent my perk points on "Sniffing". Very niche.',
            ]);
          },
        },
      ],
      onEnter: async (c) => { if (!F('met_aldric')) await G.content.story.opening(c); },
    };
  });

  // ------------------------------------------------------------------ the village
  def('thornbrook', (L) => {
    const W = 34, H = 28;
    const g = L.grid(W, H, '.');
    g.border('T', 1);
    g.scatter(1, 1, W - 2, 2, 'T', 0.55, 11);
    g.scatter(1, H - 3, W - 2, 2, 'T', 0.55, 12);
    g.scatter(1, 1, 2, H - 2, 'T', 0.45, 13);
    g.scatter(W - 3, 1, 2, H - 2, 'T', 0.45, 14);
    g.scatter(2, 2, W - 4, H - 4, ':', 0.05, 15);
    g.rect(29, 12, 4, 8, '.');
    // streets
    g.hline(2, 31, 7, '_', 2);          // street A (north row)
    g.hline(2, W - 1, 15, '_', 2);      // main road -> east exit
    g.hline(4, 29, 24, '_', 2);         // street C (south row)
    g.vline(12, 7, 25, '_', 2);         // centre lane
    g.rect(14, 9, 8, 6, '=');            // the square
    g.hline(12, 22, 15, '=', 2);
    g.set(17, 11, 'o');                  // well
    g.stamp(14, 9, [':      :']);
    g.stamp(14, 14, [':      :']);
    // row A
    g.house(4, 2, 8, 5, { roof: 3, door: 3, win: [1, 6] });          // stable, door (7,6)
    g.stamp(2, 3, ['h', 'h', 'x']);
    g.house(15, 3, 6, 4, { roof: 2, door: 2, win: [4] });              // Aldric, door (17,6)
    g.stamp(15, 2, [':.::.:']);
    g.frame(22, 2, 8, 5, 'f'); g.rect(23, 3, 6, 3, '.'); g.set(25, 6, 'F'); // paddock
    g.stamp(23, 3, ['hh', 'h ']);
    g.scatter(23, 3, 6, 3, ',', 0.35, 21);
    // row B
    g.house(4, 10, 6, 5, { roof: 3, door: 2, win: [4] });              // store, door (6,14)
    const bk = g.house(24, 10, 6, 5, { roof: 3, door: 2, win: [0, 4] }); // bakery (no door)
    g.set(bk.x, bk.y, 'W');
    g.stamp(30, 12, ['x', 'x']);
    // row C
    g.house(4, 19, 8, 5, { roof: 3, door: 3, win: [1, 6] });          // inn, door (7,23)
    g.house(15, 18, 11, 6, { roof: 3, door: 5 });                      // the Pit, door (20,23)
    g.stamp(16, 23, ['*.p...p.*'.replace(/\./g, ' ')]);
    g.blob(29, 20, 2.6, 2.2, '~', 3);                                    // pond
    g.stamp(27, 23, [':;:']);
    g.scatter(26, 17, 6, 7, ':', 0.25, 31);
    // signs
    g.set(31, 13, 'S'); g.set(10, 14, 'S'); g.set(3, 23, 'S'); g.set(14, 23, 'S'); g.set(14, 5, 'S'); g.set(19, 11, 'S');
    g.set(25, 9, 'S');

    return {
      name: 'Thornbrook', music: 'village', outdoor: true,
      tiles: g.rows(),
      warps: [
        L.warp(7, 6, 'thornbrook_stable', 6, 8, 'up'),
        L.warp(17, 6, 'thornbrook_aldric', 4, 6, 'up'),
        L.warp(6, 14, 'thornbrook_store', 4, 6, 'up'),
        L.warp(7, 23, 'thornbrook_inn', 5, 7, 'up'),
        L.warp(20, 23, 'thornbrook_pit', 7, 10, 'up'),
        L.warp(W - 1, 15, 'route1', 1, 10, 'right'),
        L.warp(W - 1, 16, 'route1', 1, 11, 'right'),
      ],
      signs: [
        { x: 31, y: 13, text: 'EAST: Whisperwood, then Millbridge.\nWolves. Boars. Mild peril. Bring bread.' },
        { x: 10, y: 14, text: "GILDA'S GOODS\nBread, buckles, and things that go bonk." },
        { x: 3, y: 23, text: 'THE SLEEPY BADGER INN\n10 gold a night. Badger not included.' },
        { x: 14, y: 23, text: 'THORNBROOK SWORD PIT\nNovice Cup open to all! Bring your own teeth.' },
        { x: 14, y: 5, text: 'Sir Aldric, Knight (retired).\nKnocking is permitted. Yelling is preferred.' },
        { x: 19, y: 11, text: 'THE WISHING WELL\nPlease do not wish for "more wishes". It upsets the well.' },
        { x: 25, y: 9, text: "MAUDE'S BAKERY\nUse the back door. The front door is load-bearing." },
      ],
      objects: [
        { x: 13, y: 3, type: 'chest', id: 'tb_chest_herb', item: 'herb', qty: 1 },
        { x: 31, y: 18, type: 'chest', id: 'tb_chest_pond', item: 'bread', qty: 3 },
      ],
      npcs: [
        {
          id: 'cedric', x: 13, y: 7, look: 'cedric', dir: 'left', move: 'still', name: 'Cedric of Vane',
          cond: () => F('trained') && !F('rival1'),
          script: async (c) => G.content.story.rival1(c, false),
        },
        {
          id: 'hesk', x: 16, y: 12, look: 'granny', dir: 'down', move: 'turn', name: 'Mother Hesk',
          script: L.talk(() => G.U.pick([
            ['Parry, dearie! HOLD the right side to raise your shield JUST as the blow lands.', 'Too early and you merely block. Too late and you merely bleed.'],
            ["Watch for the little '!' glint before a brute swings.", "That's your cue to block, or FLICK the right side and roll away like a dropped turnip."],
          ])),
        },
        {
          id: 'pip', x: 20, y: 12, look: 'kidA', dir: 'down', move: 'wander', name: 'Pip',
          script: L.talk(() => F('trained')
            ? ['Whoa, a real sword! Can I hold it? Can I lick it?', 'When I grow up I want to be a knight. Or a goose.']
            : ['Hiya! I hit a tree with a stick today. The tree won.']),
        },
        {
          id: 'lyle', x: 15, y: 10, look: 'bard', dir: 'down', move: 'turn', name: 'Lyle the Bard',
          script: async (c, npc) => {
            c.sfx('text');
            await L.say(c, npc, G.U.pick([
              ['♪ Oh the squire went down to the Pit one day... ♪', '♪ ...and came back up without his teeth! ♪', 'Still workshopping the second verse.'],
              ['♪ Three seals hath the realm, and one crown hath the king... ♪', '♪ ...and a goose hath Pip, which is NOT a real thing! ♪'],
              ['A tale needs a hero. You look... adequate!', 'Go do something brave. I need new material.'],
            ]));
          },
        },
        {
          id: 'dobbin', x: 26, y: 4, look: 'farmer', dir: 'down', move: 'wander', name: 'Farmer Dobbin',
          script: L.talk(['Stamina is like hay, lad. Use it all and you fall over.', "Don't swing like a windmill. Strike, step back, breathe."]),
        },
        {
          id: 'maude', x: 27, y: 16, look: 'baker', dir: 'up', move: 'turn', name: 'Maude the Baker',
          script: async (c, npc) => {
            if (!F('maude_bread') && F('trained')) {
              await L.say(c, npc, ['A squire! You look peaky. Here, take these.', 'Bread heals you. You can even eat it mid-fight. Top left button!']);
              c.give('bread', 3); c.setFlag('maude_bread');
            } else await L.say(c, npc, 'The front door? Oh, it stopped opening in the spring. We use the window.');
          },
        },
        {
          id: 'wat', x: 31, y: 14, look: 'guard', dir: 'left', move: 'still', name: 'Wat the Watchman',
          script: L.talk(() => F('trained')
            ? ['Off to Whisperwood? Keep to the path.', 'Wolves come in packs. Back off, let them line up, and hold right as they lunge. A parry!']
            : ['Whisperwood is no place without training, friend.']),
        },
        {
          id: 'tilly', x: 27, y: 24, look: 'kidB', dir: 'up', move: 'still', name: 'Tilly',
          script: L.talk(['Shh! I am fishing.', "I've been fishing for three days. I think the pond is empty.", 'I found a chest by the water though. Finders keepers!']),
        },
        {
          id: 'pete', x: 3, y: 21, look: 'villagerM', dir: 'right', move: 'turn', name: 'Old Pete',
          script: L.talk(['I was a champion once! Won the Novice Cup in... uh...', '...what year is it? Anyway. Level up, spend your perks. Riposte is lovely.']),
        },
      ],
      onEnter: async (c) => {
        if (F('trained') && !F('rival1')) await G.content.story.rival1(c, true);
      },
    };
  });

  // ------------------------------------------------------------------ Aldric's cottage
  def('thornbrook_aldric', (L) => {
    const g = L.room(10, 8, 'k', 4);
    g.stamp(1, 2, ['llkkkkee', 'kkkkkkkk', 'kkvvkkkk', 'kkkkkkkx', 'xkkkkkkk']);
    g.set(5, 1, '*');
    return {
      name: "Aldric's Cottage", music: 'village', outdoor: false, tiles: g.rows(),
      warps: [L.warp(4, 7, 'thornbrook', 17, 7, 'down')],
      npcs: [
        { id: 'aldric', x: 6, y: 4, look: 'aldric', dir: 'down', move: 'turn', name: 'Sir Aldric', cond: () => F('trained'), script: (c, npc) => G.content.story.aldricHome(c, npc) },
      ],
      objects: [{ x: 8, y: 6, type: 'chest', id: 'tb_aldric_tonic', item: 'potion', qty: 1 }],
    };
  });

  // ------------------------------------------------------------------ Gilda's Goods
  def('thornbrook_store', (L) => {
    const g = L.room(10, 8, 'k', 4);
    g.stamp(1, 2, ['lllkkxxx', 'kkkkkkkk', 'vvvkkkkk', 'kkkkkkkk', 'xkkkkkkl']);
    return {
      name: "Gilda's Goods", music: 'village', outdoor: false, tiles: g.rows(),
      warps: [L.warp(4, 7, 'thornbrook', 6, 15, 'down')],
      npcs: [
        {
          id: 'gilda', x: 2, y: 3, look: 'merchant', dir: 'down', move: 'still', name: 'Gilda',
          script: async (c, npc) => {
            await L.say(c, npc, F('gilda_met') ? 'Back again! Coin burning a hole?' : ['Welcome, welcome! Everything a squire needs.', 'Padded jacks! Bread! A buckler that is mostly not cracked!']);
            c.setFlag('gilda_met');
            await c.shop('thornbrook_store');
          },
        },
        { id: 'cat', x: 7, y: 4, look: { skin: '#e8a050', hair: '#e8a050', hairStyle: 'spiky', tunic: '#e8a050', pants: '#e8a050', boots: '#c07830' }, dir: 'left', move: 'wander', name: 'Biscuit (?)', script: L.talk(['It is... a very small man in an orange suit?', '"Mrow," he says, with great dignity.']) },
      ],
    };
  });

  // ------------------------------------------------------------------ the Sleepy Badger
  def('thornbrook_inn', (L) => {
    const g = L.room(12, 9, 'k', 5);
    g.stamp(1, 2, ['eekkllkkee', 'kkkkkkkkkk', 'vvvkkkkvkk', 'kkkkkvkkkk', 'kkkkkkkkkk', 'xkkkkkkkkx']);
    g.set(3, 1, '*'); g.set(8, 1, '*');
    return {
      name: 'The Sleepy Badger', music: 'village', outdoor: false, tiles: g.rows(),
      warps: [L.warp(5, 8, 'thornbrook', 7, 24, 'down')],
      npcs: [
        {
          id: 'marta', x: 2, y: 3, look: 'innkeep', dir: 'down', move: 'still', name: 'Marta',
          script: async (c, npc) => { await L.say(c, npc, 'A bed and a bowl of stew, 10 gold. Sleep heals all, and I\'ll mind your save.'); await c.inn(10); },
        },
        { id: 'grub', x: 7, y: 5, look: 'hedgeKnight', dir: 'left', move: 'still', name: 'Grub the Veteran', script: L.talk(['Armor adds defense but slows your rolls.', 'Heavy weapons hit like a cart, swing like a cow.', 'Me, I fight in my nightshirt. Freedom of movement.']) },
        { id: 'nell', x: 9, y: 4, look: 'villagerF', dir: 'down', move: 'wander', name: 'Nell', script: L.talk(['Every hall has cups for Novices, Squires and Knights.', 'You can re-enter some cups for gold. Rent is rent!']) },
      ],
    };
  });

  // ------------------------------------------------------------------ the Sword Pit
  def('thornbrook_pit', (L) => {
    const g = L.room(16, 12, 'a', 7, 'q');
    g.stamp(1, 2, ['p            p']);
    g.set(4, 1, '*'); g.set(11, 1, '*'); g.set(0, 6, '*'); g.set(15, 6, '*');
    g.stamp(1, 9, ['x', 'x']); g.stamp(14, 9, ['x', 'l']);
    return {
      name: 'Thornbrook Sword Pit', music: 'tourney', outdoor: false, tiles: g.rows(),
      warps: [L.warp(7, 11, 'thornbrook', 20, 24, 'down')],
      npcs: [
        { id: 'bram', x: 7, y: 3, look: 'bram', dir: 'down', move: 'still', name: 'Pit Master Bram', script: (c, npc) => G.content.story.hallMaster(c, npc, 'thornbrook_pit') },
        { id: 'fan1', x: 2, y: 5, look: 'villagerM', dir: 'right', move: 'turn', name: 'Rowdy Fan', script: L.talk(['BLOOD! Er, I mean... good sportsmanship!', 'Novice Cup: three bouts. Then Bram himself, for the Seal!']) },
        { id: 'fan2', x: 13, y: 6, look: 'villagerF', dir: 'left', move: 'turn', name: 'Fishwife Joan', script: L.talk(['Tom swings wide. Meg is quick. Oswin hides behind his shield.', 'Bram? Bram hits like a falling barn. Parry him!']) },
        { id: 'tomkid', x: 12, y: 9, look: 'child', dir: 'up', move: 'wander', name: 'Little Wil', script: L.talk(['I am Bram\'s biggest fan. I have his autograph!', 'It is just an X. He says it stands for "eXcellent".']) },
      ],
    };
  });
})();
