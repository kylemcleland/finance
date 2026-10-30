// Story cutscenes and shared NPC logic (opening, rival, mentors, hall masters).
// Everything here runs at runtime only (called from map scripts).
(() => {
  G.content = G.content || {};
  const F = (n) => !!G.state.flags[n];
  const L = () => G.content.lib;
  const line = (c, who, t) => L().line(c, who, t);
  const call = (c, n, ...a) => L().call(c, n, ...a);

  const story = {};

  // ---------------------------------------------------------------- 1. the opening
  story.opening = async (c) => {
    c.setFlag('opening');
    await c.wait(500);
    await c.say(['Zzz... mmh... five more minutes, Buttercup...', 'You wake in the hay of the Thornbrook stable.\nYour bed. Your home. Your itchy, itchy home.']);
    await call(c, 'facePlayer', 'left');
    c.sfx('swing'); await c.wait(180); c.sfx('thud'); await call(c, 'shake', 200);
    await c.say(['You grab your trusty stick and give the hay bale a mighty WHACK.', 'The hay bale does not react. It never does.']);
    await c.wait(300);
    c.sfx('door');
    L().refresh();
    await call(c, 'showNpc', 'aldric', true);
    await line(c, 'Aldric', 'Ho there! Was that you, duelling a hay bale at dawn?');
    await call(c, 'walkNpc', 'aldric', 'UUUUULL');
    await call(c, 'faceNpc', 'aldric', 'left');
    await call(c, 'facePlayer', 'right');
    await line(c, 'Aldric', [
      'The bale is winning, young one. Your elbow is all wrong.',
      'I am Sir Aldric. Knight of the realm. Retired. Mostly.',
      'I have watched you swing that stick every dawn for a year. Shall we make it count?',
    ]);
    await line(c, 'Aldric', [
      'Out back I keep an old straw dummy. His name is Gerald.',
      'Gerald does not hit back. Gerald is a gentleman.',
      'LEFT thumb: put it anywhere on the left side and slide to move.',
      'TAP the right side to strike. Tap in rhythm for a three-hit combo!',
    ]);
    await c.battle('sword', { enemies: ['dummy'], arena: 'practice', noDeath: true, title: 'Training', intro: 'Tap right to strike Gerald!' });
    c.heal();
    await line(c, 'Aldric', [
      'Ha! Gerald will need new stuffing.',
      'But a real foe hits back. HOLD the right side to raise your guard.',
      'Raise it JUST as the blow lands and you PARRY. That staggers them, wide open.',
      'FLICK the right side to dodge-roll. Watch for the wind-up glint "!" and get out of the way.',
      'Swings, blocks and rolls all cost stamina. The yellow bar. Mind it.',
      'Now then. Show an old man what you have learned!',
    ]);
    const r = await c.battle('sword', { enemies: ['aldric_spar'], arena: 'practice', noDeath: true, title: 'Spar: Sir Aldric', intro: 'Hold right to block. Flick right to dodge.' });
    c.heal();
    c.xp(r && r.won ? 25 : 15);
    if (r && r.won) await line(c, 'Aldric', ['Oof! My knees! You have the makings of a knight, truly.']);
    else await line(c, 'Aldric', ['Not bad at all! You lasted longer than my last squire.', 'He became a baker. Lovely buns. Terrible footwork.']);
    await line(c, 'Aldric', ['Here. This was my first blade. Rusty, like me, but true.', 'And a buckler. Small, but quick for parries.']);
    L().giveEquip(c, 'rusty_sword');
    L().giveEquip(c, 'buckler');
    await c.wait(400);
    await line(c, 'Aldric', [
      'The realm has three Seals: the Blade, the Arrow and the Lance.',
      'Win all three and Crownhold will let you into the Grand Tourney.',
      'Start here: the Thornbrook Sword Pit holds a Novice Cup. South of the square.',
      'The menu is top-right, should you need your bag, gear or perks. Off you go!',
    ]);
    c.setFlag('met_aldric'); c.setFlag('trained');
    G.state.lastInn = { map: 'thornbrook_stable', x: 3, y: 3 };
    await call(c, 'walkNpc', 'aldric', 'RRDDDDD');
    c.sfx('door');
    await call(c, 'showNpc', 'aldric', false);
    L().refresh();
    G.save();
  };

  // ---------------------------------------------------------------- 2. rival, fight 1
  story.rival1 = async (c, entering) => {
    if (F('rival1')) return;
    if (entering) {
      await c.wait(300);
      await line(c, 'Cedric', 'Oi! You there! Stable rat!');
      if (G.state.x === 7 && G.state.y === 7) {
        await call(c, 'walkNpc', 'cedric', 'LLLLL');
        await call(c, 'faceNpc', 'cedric', 'left');
        await call(c, 'facePlayer', 'right');
      }
    }
    await line(c, 'Cedric', [
      'Cedric of Vane. Heir to Vane Manor, future Grand Champion, owner of eleven ponies.',
      'They say old Aldric gave his sword to a STABLE BOY. I simply had to see.',
      'En garde! Try not to bleed on my boots. They are imported.',
    ]);
    const r = await c.battle('sword', { enemies: ['cedric1'], arena: 'field', noDeath: true, title: 'Rival: Cedric of Vane' });
    c.heal();
    if (r && r.won) {
      await line(c, 'Cedric', ['Impossible! The sun was in my eyes!', '...It is behind me? Then it was in my EARS. Take this. It is pocket lint to me.']);
      c.gold(50); c.xp(30); c.setFlag('rival1_won');
      await line(c, 'Cedric', 'This is not over, stable rat. Not even slightly!');
    } else {
      await line(c, 'Cedric', ['As expected. Keep that sword shiny, peasant.', 'It will look lovely over a fireplace. See you at the Grand Tourney! Ha! As if.']);
      c.xp(15);
    }
    c.setFlag('rival1');
    await call(c, 'walkNpc', 'cedric', 'RRRRRRRRRR');
    await call(c, 'showNpc', 'cedric', false);
    L().refresh();
  };

  // ---------------------------------------------------------------- Aldric at home
  story.aldricHome = async (c, npc) => {
    const S = (t) => line(c, 'Aldric', t);
    const seals = L().seals();
    if (G.state.seals.grand) {
      await S(['Sir Squire! Ha! I knew it. I knew it the day you beat up that hay bale.', 'Go on, the road is yours. But visit an old man now and then.']);
    } else if (G.state.seals.sword && !F('got_letter')) {
      await S(['The Seal of the Blade! Bram must be nursing his pride.', 'Take this letter to Lady Rowena at Harrowfield. We tilted together, long ago.', 'She broke my lance, my shield and my heart, in that order.']);
      c.give('letter'); c.setFlag('got_letter');
    } else if (!G.state.ranks.sword && !G.state.seals.sword) {
      await S(['The Pit is south of the square. Win the Novice Cup first.', 'If Bram looms, go train in Whisperwood to the east. Levels bring perk points!']);
    } else if (seals < 2) {
      await S(['East through Whisperwood lies Millbridge, the archers\' town.', 'Past that, Harrowfield, where they joust. A knight needs all three arts.']);
    } else {
      await S(['Two seals! The Kingsroad gate north of Harrowfield will open for you now.', 'Beware the brigands. They say Black Hugh camps off the road.']);
    }
    const ch = await c.ask('Spar with Sir Aldric for practice?', ['Spar!', 'Not now']);
    if (ch === 0) {
      const r = await c.battle('sword', { enemies: ['aldric_spar'], arena: 'practice', noDeath: true, title: 'Spar: Sir Aldric' });
      c.heal();
      await S(r && r.won ? 'Well fought! Again tomorrow, when my back unlocks.' : 'Keep that guard up! Practice is free. Pride is not.');
    }
  };

  // ---------------------------------------------------------------- hall masters
  const HALL_TALK = {
    thornbrook_pit: {
      first: ['So. You want to fight in my Pit.', 'Novice Cup: three bouts. Win it, then face me for the Seal of the Blade.', 'Mind your stamina. Parry my big swings. And no biting.'],
      seal: ['Hrmph. You beat me fair and square.', 'The Seal of the Blade is yours. Wear it with pride, and wash it now and then.', 'East, through Whisperwood, lies Millbridge. Show those archers what a sword can do.'],
      back: 'Back for more? The Pit is always hungry.',
    },
    millbridge_range: {
      first: ['Welcome to the Range. Hold right to draw, drag left to aim, let go to loose.', 'Wind pushes arrows. Watch the flag. Three ends of three arrows.'],
      seal: ['Ha! You outshot me. Nobody outshoots me. Except you, apparently.', 'The Seal of the Arrow is yours. And take my recurve, I have spares.', 'Harrowfield lies east, past Greenmeadow. They do the pointy-horse thing there.'],
      back: 'The butts are set. Shoot well!',
    },
    harrowfield_lists: {
      first: ['The Lists! Spur in rhythm, aim the tip at their shield, strike as the ring closes.', 'Break lances for points. Unhorse them to win outright.'],
      seal: ['By my grandmother\'s spurs! You unhorsed me!', 'The Seal of the Lance is yours. Aldric chose well.', 'With two seals or more the Kingsroad opens north. Crownhold awaits.'],
      back: 'Lances are stacked, horses are fed. Shall we tilt?',
    },
    crownhold_arena: {
      first: ['The Crownhold Arena! Only the best fight here.', 'High stakes, high purses. Repeat any cup for coin.'],
      back: 'The crowd is hungry. Feed them glory!',
    },
  };

  // Generic hall master: intro once, run the hall UI, react to a new seal.
  story.hallMaster = async (c, npc, hallId, pre) => {
    const T = HALL_TALK[hallId] || {};
    const S = (t) => L().say(c, npc, t);
    const fk = 'hall_' + hallId;
    if (pre && !(await pre())) return;
    if (!F(fk)) { if (T.first) await S(T.first); c.setFlag(fk); } else if (T.back) await S(T.back);
    const before = Object.assign({}, G.state.seals);
    if (typeof c.tournament !== 'function') { await S('(The registrar is out to lunch. Come back later.)'); return; }
    let res = null;
    try { res = await c.tournament(hallId); } catch (e) { console.error('tournament failed', e); }
    const newSeal = ['sword', 'archery', 'joust'].find((k) => G.state.seals[k] && !before[k]);
    if (newSeal && T.seal) {
      await S(T.seal);
      if (newSeal === 'archery' && !G.player.has('elven_bow')) c.give('elven_bow');
    }
    // Seal still out of reach on level alone? Say so, and where to train.
    const hall = G.halls[hallId];
    const sealCup = hall && (hall.cups || []).find((k) => k.reward && k.reward.seal);
    const d = sealCup && sealCup.reward.seal;
    if (sealCup && d && !G.state.seals[d] && (sealCup.requires || []).every((r) => (G.state.wins || {})[r]) && G.state.level < (sealCup.minLevel || 1)) {
      const where = { sword: 'Whisperwood to the east is full of wolves and bandits to learn from.', archery: 'Greenmeadow, east of town, will toughen you up.', joust: 'Greenmeadow and the Lists\' other cups will season you.' }[d] || 'Go and train.';
      await S([`To face me for the Seal you need level ${sealCup.minLevel}. You are level ${G.state.level}.`, where]);
    }
    // Prize gear goes to the bag; wear it right away if it beats what is equipped.
    if (res && res.won) {
      const cup = ((G.halls[hallId] || {}).cups || []).find((k) => k.id === res.cupId);
      const id = cup && cup.reward && cup.reward.item;
      if (newSeal === 'archery') story.autoEquip('elven_bow');
      if (id) story.autoEquip(id);
    }
    return res;
  };

  // Equip an owned (bagged) gear item if it is better (pricier) than the one in its slot.
  story.autoEquip = (id) => {
    const it = G.items[id];
    const slot = it && G.slotOf[it.type];
    if (!slot || !G.state.bag[id]) return false;
    const cur = G.items[G.state.equip[slot]];
    const PRIZE = { elven_bow: 700, sunsteel: 2000, practice_lance: 0 }; // free prizes, by real worth
    const val = (x) => (x ? (PRIZE[x.id] != null ? PRIZE[x.id] : x.price || 0) : -1);
    if (cur && val(cur) >= val(it) && cur.id !== 'stick' && cur.id !== 'tunic') return false;
    const wasFull = G.state.hp >= G.player.maxHp();
    G.player.equip(id);
    if (wasFull) G.player.heal('full'); // new armor HP should not show up as damage
    G.ui.toast(`Equipped ${it.name}`, '#9ff59a');
    return true;
  };

  // ---------------------------------------------------------------- Millbridge: the miller's arrows
  story.miller = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    if (F('arrows_returned')) {
      await S(G.U.pick([['The wheel turns, the flour flies, and the bow sings!'], ['How\'s that bow treating you? Feed it arrows and it\'s happy.']]));
      return;
    }
    if (G.player.has('lost_arrows')) {
      await S(['My arrows! My lovely arrows! You found them!', 'I fletched these for my late father\'s bow. Here, it deserves a real archer.']);
      c.take('lost_arrows', 1);
      c.give('hunting_bow');
      L().ensureEquipped('bow');
      c.setFlag('arrows_returned');
      await S(['A Hunting Bow! Now Wren will let you into the Range.', 'Go on, show her what a stable hand can do.']);
      return;
    }
    await S(['Oh, woe! My cart tipped in Whisperwood and my arrows went flying.', 'Up north, by the old stumps, past the first bend.', 'Find them, and I\'ll give you a fine bow for your trouble.']);
    c.setFlag('arrows_quest');
  };

  // ---------------------------------------------------------------- Route 2: rival fight 2 (real, but no blackout)
  story.rival2 = async (c, npc) => {
    if (F('rival2')) return;
    if (!F('rival2_met')) {
      await line(c, 'Cedric', [
        'Well, well! The stable rat crawled all the way to Greenmeadow.',
        'I have been training with a REAL master. He charges by the hour. Eleven hours a day!',
        'No practice blades this time. Steel on steel!',
      ]);
      c.setFlag('rival2_met');
    } else await line(c, 'Cedric', 'Back for another thrashing? Splendid. I was getting bored of the bridge.');
    const r = await c.battle('sword', { enemies: ['cedric2'], arena: 'field', title: 'Rival: Cedric of Vane', canFlee: false });
    if (r && r.won) {
      if (r.hp != null) G.player.setHp(Math.max(1, r.hp));
      await line(c, 'Cedric', ['WHAT? Eleven hours a day! I want a refund!', 'Fine. FINE. You win. Take this, and stop looking so smug.']);
      c.reward('sword', ['cedric2'], 1.5);
      await line(c, 'Cedric', 'I shall see you at the Grand Tourney in Crownhold. And THERE, stable rat, I shall be magnificent.');
      c.setFlag('rival2');
      await call(c, 'walkNpc', 'cedric', 'RRRRRRRR');
      await call(c, 'showNpc', 'cedric', false);
      L().refresh();
    } else {
      G.player.setHp(Math.max(1, Math.round(G.player.maxHp() * 0.35)));
      await line(c, 'Cedric', ['Ha! Come back stronger, stable rat. I shall wait right here.', 'I brought snacks. Fancy snacks. You cannot have any.']);
      await c.say('You limp away from the bridge, bruised but not beaten.');
    }
  };

  // ---------------------------------------------------------------- Route 2: the optional troll
  story.troll = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    await S(F('troll_met') ? 'GRUMBOLD STILL GUARDS SANDBAR. You want fight now?' : ['GRUMBOLD GUARDS SANDBAR!', 'Grumbold was going to guard bridge, but bridge said no.', 'Shiny behind Grumbold. You want shiny? You FIGHT Grumbold!']);
    c.setFlag('troll_met');
    const ch = await c.ask('Fight the troll? (He looks very strong.)', ['Fight!', 'Back away slowly']);
    if (ch !== 0) { await S('Grumbold respects slow backing. Very polite.'); return; }
    const r = await c.battle('sword', { enemies: ['river_troll'], arena: 'field', title: 'Grumbold the Troll', canFlee: true });
    if (r && r.won) {
      if (r.hp != null) G.player.setHp(Math.max(1, r.hp));
      c.reward('sword', ['river_troll']);
      c.setFlag('beat_troll');
      await S(['OW. Grumbold yields. Take shiny. Grumbold sulks now.']);
      L().refresh();
    } else if (r && r.fled) {
      if (r.hp != null) G.player.setHp(Math.max(1, r.hp));
      await S('Run, tiny knight! Grumbold not chase. Grumbold has bad knees.');
    } else {
      await G.game.blackout();
    }
  };

  // ---------------------------------------------------------------- Harrowfield: the Kingsroad gate
  story.gate = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    const n = L().seals();
    if (F('gate_open')) { await S(['The Kingsroad is open to you. Safe travels!', 'Brigands roam north. And Black Hugh camps somewhere west of the road.']); return; }
    if (n < 2) {
      await S(['Halt! The Kingsroad is for proven fighters only.', `By order of the Crown, you need two Seals to pass. You have ${n}.`, 'Win the Seal of the Blade, the Arrow or the Lance, then come back.']);
      return;
    }
    await S([`${n === 3 ? 'All three Seals' : 'Two Seals'}?! Let me see... by my helmet, they\'re real!`, 'Here is your Kingsroad Pass. Crownhold lies north.', 'Mind the brigands. And whatever you do, don\'t go looking for Black Hugh.']);
    c.give('gate_pass');
    c.setFlag('gate_open');
    c.sfx('door');
    await call(c, 'walkNpc', 'gateguard', 'UR');
    await call(c, 'showNpc', 'gateguard', false);
    L().refresh();
  };

  // ---------------------------------------------------------------- Harrowfield: Tobias the stable master
  story.tobias = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    if (!F('tobias_met')) { await S(['Welcome to my stable! Horses for every purse.', 'Old Nag 120, Palfrey 400, Destrier for the very rich or very brave.']); c.setFlag('tobias_met'); }
    if (G.player.has('horseshoe') && !F('horseshoe_returned')) {
      await S(['Is that... my LUCKY HORSESHOE?! Found it in Greenmeadow, did you?', 'Since I lost it, every horse has sneezed on me. Every one!', 'Take Daisy, my Old Nag, free. She\'s slow, but she\'s never once thrown a rider.']);
      c.take('horseshoe', 1);
      c.give('old_nag');
      L().ensureEquipped('horse');
      c.setFlag('horseshoe_returned');
      await S('Treat her kindly. She likes apples and quiet songs.');
      return;
    }
    if (!L().hasHorse() && !F('horseshoe_returned')) await S('Psst. I lost my lucky horseshoe out in Greenmeadow. Find it, and I\'ll give you a horse for free.');
    await c.shop('harrowfield_stable');
    L().ensureEquipped('horse');
  };

  // ---------------------------------------------------------------- Harrowfield: Lady Rowena and the Lists
  story.rowena = async (c, npc) => {
    const S = (t) => line(c, 'Rowena', t);
    if (!F('rowena_met')) {
      if (G.player.has('letter')) {
        await S(['A letter from Aldric? Let me see...', '"Dear Rowena. This one is good. Be gentle. Not too gentle. Also, you still owe me a lance."', 'Ha! The old goat. Any squire of his is welcome here.']);
        c.take('letter', 1);
      } else await S(['A newcomer to the Lists! Welcome.']);
      await S(['So, you would joust? Every jouster starts with a practice lance. Here.', 'Blunted ash. It breaks on purpose. Mostly.']);
      L().giveEquip(c, 'practice_lance');
      c.setFlag('rowena_met');
    }
    if (!L().hasLance()) { await S('Lost your lance? Here, take another practice one.'); L().giveEquip(c, 'practice_lance'); }
    L().ensureEquipped('lance');
    if (!L().hasHorse()) {
      await S(['But you cannot joust on foot, dear. That is just running at people.', 'Tobias sells horses at the stable west of the square.', 'Rumour says he lost his lucky horseshoe in Greenmeadow. Find it and he might be generous.']);
      return;
    }
    L().ensureEquipped('horse');
    if (!F('tilt_lesson')) {
      await S([
        'A horse AND a lance! Now, your first tilting lesson.',
        'CHARGE: tap the right side in rhythm to spur. Keep the speed in the sweet zone.',
        'AIM: drag on the left to move your lance tip onto their shield. The gold boss scores best.',
        'IMPACT: a ring shrinks around the target. Tap right just as it closes!',
        'My squire Hobb will play the quintain. Do try not to kill him. He owes me money.',
      ]);
      const r = await c.battle('joust', { opponent: 'quintain_squire', title: 'Tilting Lesson' });
      if (r && r.won) {
        await S(['Splendid! Hobb is on the ground and very confused. Well done!', 'Now you are ready for the Novice Cup of the Lists.']);
        c.xp(40);
        c.setFlag('tilt_lesson');
      } else {
        await S('Hobb wins this one! Not to worry. Speak to me again and we\'ll go once more.');
        return;
      }
    }
    await G.content.story.hallMaster(c, npc, 'harrowfield_lists');
  };

  G.content.story = Object.assign(G.content.story || {}, story);
})();
