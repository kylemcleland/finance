// Battle dispatcher (DESIGN.md §7) + blackout handling.
(() => {
  const makers = {};
  let current = null;

  G.battle = {
    register(type, maker) { makers[type] = maker; },
    get active() { return current; },
    async start(type, opts = {}) {
      const maker = makers[type];
      if (!maker) {
        console.error('no battle type', type);
        return { won: true, hp: G.state.hp };
      }
      const prevMusic = G.music.current;
      G.sfx.play('alert');
      await G.scenes.flash(3);
      let scene;
      const result = await new Promise((resolve) => {
        let finished = false;
        const done = (res) => {
          if (finished) return;
          finished = true;
          resolve(res || { won: false });
        };
        G.scenes.fadeOut({ ms: 200 }).then(() => {
          try {
            scene = maker(opts, done);
            scene.name = scene.name || 'battle-' + type;
            current = scene;
            G.scenes.push(scene);
          } catch (e) {
            console.error('battle failed to start', e);
            done({ won: true, hp: G.state.hp });
          }
          G.scenes.fadeIn({ ms: 250 });
        });
      });
      await G.scenes.fadeOut({ ms: 300 });
      if (scene) G.scenes.remove(scene);
      current = null;
      if (prevMusic) G.music.play(prevMusic);
      G.scenes.fadeIn({ ms: 300 });
      return result;
    },
  };

  G.game = G.game || {};
  // Lost in the wild: lose 25% gold, wake at last inn healed.
  G.game.blackout = async () => {
    const lost = Math.floor(G.state.gold * 0.25);
    G.state.gold -= lost;
    await G.ui.say(lost > 0 ? `You blacked out... and dropped ${lost} gold.` : 'You blacked out...');
    G.player.heal('full');
    const inn = G.state.lastInn || { map: 'thornbrook_stable', x: 3, y: 3 };
    if (G.cmd.warp) await G.cmd.warp(inn.map, inn.x, inn.y, 'down');
    await G.ui.say('You wake up, rested. Better train before trying that again!');
    G.save();
  };
})();
