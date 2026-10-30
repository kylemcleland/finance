// Pause menu: open each tab, take shots.
export default async (page, h) => {
  await h.eval(() => {
    G.newGame();
    const s = G.state;
    s.level = 7; s.xp = 40; s.gold = 523; s.perkPoints = 3; s.playTime = 4321;
    s.perks.parry_master = true; s.perks.steady_hand = true;
    s.seals.sword = true; s.ranks = { sword: 2, archery: 1, joust: 0 };
    s.bag = { bread: 3, herb: 2, potion: 1, iron_sword: 1, falchion: 1, kite_shield: 1, leather: 1, lost_arrows: 1, letter: 1 };
    s.equip.weapon = 'rusty_sword'; s.equip.shield = 'buckler'; s.equip.bow = 'short_bow';
    s.hp = 30; s.map = 'millbridge_inn'; s.flags.visited_millbridge = true;
    G.menus.open();
  });
  await h.wait(500);
  await h.shot('status');
  const W = await h.W(), H = await h.H();
  const land = W > H * 1.15;
  // click tabs by keyboard-free approach: set via tap positions computed similarly
  const tabs = ['status', 'gear', 'bag', 'perks', 'map'];
  for (let i = 1; i < tabs.length; i++) {
    let x, y;
    const pw = Math.min(W - 8, land ? 600 : 420), ph = Math.min(H - 8, land ? 420 : 640);
    const px = Math.round((W - pw) / 2), py = Math.round((H - ph) / 2);
    if (!land) { const tw = (pw - 12) / 5; x = px + 6 + i * tw + tw / 2; y = py + 32 + 15; }
    else { const avail = (py + ph - 32) - (py + 8) - 6; const th = Math.max(24, Math.min(30, Math.floor(avail / 5) - 2)); x = px + 7 + 39; y = py + 8 + i * (th + 2) + th / 2; }
    await h.tap(x, y);
    await h.wait(350);
    await h.shot(tabs[i]);
    if (tabs[i] === 'gear') {
      // tap weapon slot
      const cx = land ? px + 78 + 14 + 40 : px + 30;
      const cy = land ? py + 32 + 16 : py + 32 + 36 + 16;
      await h.tap(cx, cy); await h.wait(300); await h.shot('gear_weapon');
      await h.key('KeyX'); await h.wait(200);
    }
    if (tabs[i] === 'bag') {
      await h.key('ArrowDown'); await h.wait(100); await h.key('Enter'); await h.wait(250); await h.shot('bag_used');
    }
    if (tabs[i] === 'perks') {
      await h.key('ArrowDown'); await h.wait(100); await h.key('Enter'); await h.wait(250); await h.shot('perks_sel');
    }
  }
  await h.key('Escape'); await h.wait(300);
  console.log('scene after close:', await h.eval(() => G.scenes.top().name));
};
