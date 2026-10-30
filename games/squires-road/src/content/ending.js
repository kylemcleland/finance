// Endgame story (Black Hugh, Crownhold, the Grand Tourney, knighting) and G.game.credits().
(() => {
  G.content = G.content || {};
  G.game = G.game || {};
  const F = (n) => !!G.state.flags[n];
  const L = () => G.content.lib;
  const line = (c, who, t) => L().line(c, who, t);
  const call = (c, n, ...a) => L().call(c, n, ...a);
  const story = {};

  // ---------------------------------------------------------------- Black Hugh (bandit camp boss)
  story.hugh = async (c, npc) => {
    if (F('beat_hugh')) return;
    const S = (t) => line(c, 'Black Hugh', t);
    await S(F('hugh_met') ? 'Back again, little squire? Hugh admires persistence. Briefly.' : [
      'Well, well. A little squire, all the way out here.',
      'I am Black Hugh. I have robbed knights, lords, and once a bishop. He had excellent socks.',
      'Lads, stand back. I\'ll do this one myself.',
    ]);
    c.setFlag('hugh_met');
    const r = await c.battle('sword', { enemies: ['black_hugh'], arena: 'road', boss: true, title: 'Black Hugh', intro: 'The bandit king draws his blade!' });
    if (!(r && r.won)) { await G.game.blackout(); return; }
    if (r.hp != null) G.player.setHp(Math.max(1, r.hp));
    await S(['Impossible... beaten by a stable hand...', 'Fine. Take the signet. Take the loot. Just... tell them I put up a good fight.']);
    c.give('signet');
    c.reward('sword', ['black_hugh'], 2);
    c.gold(500);
    c.setFlag('beat_hugh');
    await c.say(['The bandits flee into the woods, dropping everything.', 'You tie Black Hugh up with a stable knot. Aldric would be proud.', 'Crownhold\'s Captain of the Guard will want to see that signet.']);
    L().refresh();
    G.save();
  };

  // ---------------------------------------------------------------- Captain of the Guard (signet reward)
  story.captain = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    if (G.player.has('signet') && !F('signet_reward')) {
      await S(['Is that... Black Hugh\'s signet? You beat him?!', 'Ten years we hunted that man. TEN. And a squire just... walks in.', 'On behalf of the Crown: the bounty, and a shield fit for a hero.']);
      c.take('signet', 1);
      c.gold(400);
      c.give('heater_shield');
      c.setFlag('signet_reward');
      await S('The King will hear of this. Go on, the castle is right behind me.');
      return;
    }
    if (F('signet_reward')) { await S('The roads are safe thanks to you. The Guard owes you a drink. Several.'); return; }
    await S(['Welcome to Crownhold. I am Captain Brannigan.', 'If you\'re hunting trouble, Black Hugh camps off the Kingsroad. Bring me his signet and there\'s a bounty in it.']);
  };

  // ---------------------------------------------------------------- Cedric, third meeting
  story.rival3 = async (c, npc) => {
    const S = (t) => line(c, 'Cedric', t);
    if (G.state.seals.grand) {
      await S(['You beat Varek. VAREK. ...Good. Someone had to.', 'Not me, obviously. I had a cold. A very bad, very sudden cold.', 'Congratulations, stable r... Sir. Sir Stable Rat.']);
      return;
    }
    if (!F('rival3_met')) {
      await S(['So. You actually made it to Crownhold.', 'I am in the Grand Tourney too. Semifinalist. Obviously.', 'My father bought me a new sword. And a new master. And a new horse. And a new father. (Kidding.)']);
      c.setFlag('rival3_met');
    } else if (F('rival3')) { await S('Don\'t look at me like that. I am SAVING my strength. For the Tourney.'); return; }
    const ch = await c.ask('Duel Cedric for honour?', ['En garde!', 'Not now']);
    if (ch !== 0) { await S('Afraid? Wise. Very wise.'); return; }
    const r = await c.battle('sword', { enemies: ['cedric3'], arena: 'castle', noDeath: true, title: 'Rival: Cedric of Vane' });
    if (r && r.won) {
      await S(['Three times! THREE! I am going to need a new father after all.', 'Fine. Take my purse. And... good luck in the Tourney. I mean it. Slightly.']);
      c.reward('sword', ['cedric3'], 1.5);
      c.setFlag('rival3');
    } else await S('Ha! Finally! Mark this day, everyone! ...Everyone? Hello?');
    c.heal();
  };

  // ---------------------------------------------------------------- the Grand Tourney herald
  story.herald = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    const n = L().seals();
    if (n < 3) {
      await S(['Hear ye! The Grand Tourney of Crownhold!', `Only holders of all three Seals may enter. You hold ${n}.`, 'Blade from Thornbrook, Arrow from Millbridge, Lance from Harrowfield.']);
      return;
    }
    if (!F('herald_met')) {
      await S(['Three Seals! By the crown, a true challenger!', 'The Grand Tourney: a sword round, an archery round, and the joust final.', 'Your final opponent: Sir Varek the Undefeated. Good luck. You\'ll need it.']);
      c.setFlag('herald_met');
    }
    L().ensureEquipped('bow'); L().ensureEquipped('horse'); L().ensureEquipped('lance');
    if (typeof c.tournament !== 'function') { await S('(The lists are being raked. Come back soon.)'); return; }
    let res = null;
    try { res = await c.tournament('crownhold_grand'); } catch (e) { console.error('grand tourney failed', e); }
    if (res && res.won && !G.state.seals.grand) G.state.seals.grand = true;
    if (G.state.seals.grand && !F('knighted')) {
      await S(['The CHAMPION of the Grand Tourney! The King summons you to the throne!']);
      await story.knighting(c);
    }
  };

  // ---------------------------------------------------------------- the King
  story.king = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    if (F('knighted')) {
      await S(G.U.pick([
        ['Sir Squire! The realm is in your debt. Mostly the jousting part.'],
        ['The Arena awaits, Sir Knight. Varek wants a rematch. He has been sulking for days.'],
        ['I watched your joust from the royal box. I spilled my wine twice. Marvellous.'],
      ]));
      return;
    }
    if (G.state.seals.grand) { await story.knighting(c); return; }
    if (!F('met_king')) {
      await S(['So YOU are the squire everyone is on about. From a STABLE, they say?', 'Splendid! I love a good story. My court is very boring.']);
      c.setFlag('met_king');
    }
    if (F('beat_hugh') && !F('king_hugh')) {
      await S(['And you dealt with Black Hugh! He stole my favourite socks, you know.', 'Well, the bishop\'s. But I had my eye on them. Take this, with royal thanks.']);
      c.give('elixir', 2); c.setFlag('king_hugh');
    }
    await S(['Win the Grand Tourney and I shall knight you myself.', 'Speak to the herald by the pillar to enter. You will need all three Seals.']);
  };

  // ---------------------------------------------------------------- knighting + credits
  story.knighting = async (c) => {
    if (F('knighted')) return;
    if (G.state.map !== 'crownhold_castle') {
      await call(c, 'warp', 'crownhold_castle', 10, 4, 'up');
      await c.wait(400);
    } else {
      await call(c, 'facePlayer', 'up');
    }
    c.music('castle');
    await c.say(['The great hall falls silent. Somewhere, the jester stifles a sneeze.', 'You kneel before King Edmund.']);
    const K = { name: 'King Edmund', look: 'king' };
    await c.say(['By the power vested in me by... well, me, mostly...'], K);
    for (let i = 0; i < 3; i++) { c.sfx('clang'); await c.wait(380); }
    await c.say(['...I dub thee SIR SQUIRE OF THORNBROOK, Knight of the Realm!', 'Rise, Sir Knight!'], K);
    c.sfx('crowd'); c.sfx('win');
    await call(c, 'shake', 300);
    await c.say('The hall erupts in cheers!');
    await line(c, 'Aldric', ['(from the back) THAT\'S MY SQUIRE!', '...I am not crying. It is dust. Castle dust. Very dusty castle.']);
    await line(c, 'Cedric', 'Congratulations. I suppose. Next year, stable r... Sir. Sir Stable Rat.');
    c.setFlag('knighted');
    G.save();
    await G.game.credits();
    L().refresh();
    await c.say(['Your cups can be won again for gold, and the Arena awaits.', 'Sir Varek wants a sword rematch. The road goes on!']);
  };

  // ---------------------------------------------------------------- Varek post-game rematch
  story.varekRematch = async (c, npc) => {
    const S = (t) => L().say(c, npc, t);
    if (F('beat_varek_sword')) { await S('Twice. You beat me twice. I am considering a career in pottery.'); return; }
    await S(['You unhorsed me. Fine. But with swords, I have never lost.', 'Face me. Here. Now.']);
    const ch = await c.ask('Duel Sir Varek with swords?', ['Have at thee!', 'Not yet']);
    if (ch !== 0) { await S('I will wait. I am very good at waiting. And at swords.'); return; }
    const r = await c.battle('sword', { enemies: ['varek_sword'], arena: 'castle', boss: true, noDeath: true, title: 'Sir Varek the Undefeated' });
    c.heal();
    if (r && r.won) {
      await S(['...Undefeated no longer. Take my purse. A potter has no need of gold. Or does he? I must ask one.']);
      c.reward('sword', ['varek_sword']); c.gold(1000); c.give('elixir', 3); c.setFlag('beat_varek_sword');
    } else await S('Still undefeated. With swords. Come back when you are stronger.');
  };

  G.content.story = Object.assign(G.content.story || {}, story);

  // ================================================================ credits scene
  function fmtTime(s) {
    s = Math.floor(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
  }
  const sumVals = (o) => { let n = 0; if (o && typeof o === 'object') for (const k in o) n += typeof o[k] === 'number' ? o[k] : (o[k] ? 1 : 0); return n; };

  function buildRoll() {
    const s = G.state;
    const cups = sumVals(s.ranks);
    const R = [];
    const T = (t, size = 9, color = '#fff3d6', gap = 6) => R.push({ t, size, color, gap });
    const H = (t) => T(t, 10, '#ffe48a', 14);
    T('SQUIRE\'S ROAD', 20, '#ffd04a', 10);
    T('~ a tournament tale ~', 9, '#f4e4c1', 30);
    H('STARRING');
    T('You, the Stable Hand  ·  Sir Knight of Thornbrook');
    T('Sir Aldric  ·  Knight (Retired. Mostly.)');
    T('Cedric of Vane  ·  Owner of Eleven Ponies');
    T('Pit Master Bram  ·  Hits Like a Falling Barn');
    T('Wren  ·  Splitter of Arrows');
    T('Lady Rowena  ·  Breaker of Lances and Hearts');
    T('Sir Varek  ·  Formerly Undefeated');
    T('Black Hugh  ·  Currently Tied Up', 9, '#fff3d6', 22);
    H('ALSO FEATURING');
    T('Hamish the Miller & His Arrows');
    T('Tobias, Daisy the Old Nag, and a Lucky Horseshoe');
    T('Grumbold the Troll (Bridge-Adjacent)');
    T('Lyle the Bard, who wrote all this down');
    T('King Edmund the Reasonably Good');
    T('Gerald, a Training Dummy', 9, '#fff3d6', 4);
    T('Buttercup, who was always out', 9, '#fff3d6', 22);
    H('YOUR JOURNEY');
    T(`Level ${s.level}  ·  ${s.gold} gold in your purse`);
    T(`Time on the road: ${fmtTime(s.playTime)}`);
    T(`Cups won: ${cups}  ·  Foes bested: ${sumVals(s.defeated) || sumVals(s.wins)}`);
    T(`Steps taken: ${s.steps || 0}`);
    T(`Seals: Blade, Arrow, Lance  ·  Crown of the Realm`, 9, '#fff3d6', 22);
    H('MADE WITH');
    T('Canvas, WebAudio, and no dependencies whatsoever');
    T('Procedural pixels, lovingly placed by hand-written code', 9, '#fff3d6', 22);
    T('No hay bales were harmed in the making of this tale.', 8, '#d9c08f', 4);
    T('One was whacked. Repeatedly. It had it coming.', 8, '#d9c08f', 40);
    T('THE END?', 16, '#ffd04a', 10);
    return R;
  }

  G.game.credits = () => new Promise((resolve) => {
    let roll;
    try { roll = buildRoll(); } catch (e) { console.error('credits roll failed', e); roll = [{ t: 'THE END', size: 16, color: '#ffd04a', gap: 10 }]; }
    let t = 0, y = 0, phase = 'roll', endT = 0, finished = false;
    let total = 0, layW = -1;
    const layout = (ctx) => {
      if (layW === G.W) return;
      layW = G.W; total = 0;
      for (const r of roll) {
        ctx.font = G.draw.font(r.size, true);
        r.lines = G.U.wrapText(ctx, r.t, G.W - 24).length;
        r.h = r.lines * r.size * 1.25 + r.gap;
        total += r.h;
      }
    };
    const stars = Array.from({ length: 70 }, (_, i) => [G.U.hash2(i, 1), G.U.hash2(i, 2), G.U.hash2(i, 3)]);
    const parade = [
      { look: 'heroKnight', d: 0 }, { look: 'aldric', d: 22 }, { look: 'cedric', d: 44 }, { look: 'bram', d: 66 },
      { look: 'wren', d: 88 }, { look: 'rowena', d: 110 }, { look: 'varek', d: 132 }, { look: 'king', d: 154 }, { look: 'dummy', d: 176 },
    ];
    const D = G.draw;
    const finish = async () => {
      if (finished) return;
      finished = true;
      await G.scenes.fade(() => {
        G.scenes.remove(scene);
        G.state.look = 'heroKnight';
        G.state.flags.credits_seen = true;
        try { G.save(); } catch (e) { console.error(e); }
        try { if (G.world && G.world.refresh) G.world.refresh(); } catch (e) { console.error(e); }
      }, { ms: 500 });
      resolve();
    };
    const scene = {
      name: 'credits', opaque: true,
      enter() { try { G.music.play('victory'); } catch (e) { /* ignore */ } },
      update(dt) {
        t += dt;
        if (phase === 'roll') {
          const fast = G.input.down('a') || !!G.input.rHold();
          y += dt * (fast ? 70 : 18);
          if (layW > 0 && y > total + G.H * 0.55) { phase = 'end'; endT = 0; try { G.music.play('village'); } catch (e) { /* ignore */ } }
          G.input.anyTap();
        } else {
          endT += dt;
          if (endT > 1.6 && G.input.anyTap()) finish();
        }
      },
      draw(ctx) {
        const W = G.W, Hh = G.H;
        const grd = ctx.createLinearGradient(0, 0, 0, Hh);
        grd.addColorStop(0, '#0f0c26'); grd.addColorStop(0.6, '#2a1a40'); grd.addColorStop(1, '#5a2a3a');
        ctx.fillStyle = grd; ctx.fillRect(0, 0, W, Hh);
        for (const s of stars) { ctx.globalAlpha = 0.35 + 0.35 * Math.sin(t * 1.5 + s[2] * 20); D.rect(Math.floor(s[0] * W), Math.floor(s[1] * Hh * 0.8), 1, 1, '#fff'); }
        ctx.globalAlpha = 1;
        // ground + walking parade
        const gy = Hh - 18;
        D.rect(0, gy, W, Hh - gy, '#1f2c1f');
        D.rect(0, gy, W, 2, '#3a5a2a');
        const span = W + 220;
        for (const p of parade) {
          const x = ((t * 22 + span - p.d) % span) - 30;
          G.chars.draw(ctx, p.look, 'right', Math.floor(t * 6 + p.d) % 3, x, gy + 2, 1);
        }
        layout(ctx);
        if (phase === 'roll') {
          let ly = Hh - y;
          for (const r of roll) {
            if (ly > -30 - r.h && ly < gy - 4) {
              const a = G.U.clamp(Math.min((ly - 6) / 30, (gy - 10 - ly) / 30), 0, 1);
              ctx.globalAlpha = a;
              D.text(r.t, W / 2, ly, { size: r.size, align: 'center', color: r.color, shadow: true, maxW: W - 24 });
              ctx.globalAlpha = 1;
            }
            ly += r.h;
          }
          D.text('hold to speed up', W - 4, 4, { size: 6, align: 'right', color: 'rgba(255,255,255,0.4)' });
        } else {
          const a = G.U.clamp(endT / 1.2, 0, 1);
          ctx.globalAlpha = a;
          D.text('The road goes on…', W / 2, Hh * 0.42, { size: 14, align: 'center', color: '#ffe48a', shadow: true, bold: true });
          D.text('Sir Knight of Thornbrook', W / 2, Hh * 0.42 + 22, { size: 8, align: 'center', color: '#f4e4c1', shadow: true });
          if (endT > 1.6) D.text('tap to continue', W / 2, Hh * 0.42 + 44, { size: 7, align: 'center', color: `rgba(255,255,255,${0.4 + 0.3 * Math.sin(t * 4)})` });
          ctx.globalAlpha = 1;
        }
      },
    };
    G.scenes.fade(() => { G.scenes.push(scene); }, { ms: 500 });
  });
})();
