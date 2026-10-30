// Shop + inn flows.
export default async (page, h) => {
  const shop = process.env.SHOP || 'harrowfield_armory';
  await h.eval((shop) => {
    G.newGame();
    const s = G.state;
    s.level = 9; s.gold = 700; s.hp = 20;
    s.bag = { bread: 3, herb: 1, falchion: 1, letter: 1, leather: 1 };
    s.equip.weapon = 'iron_sword'; s.equip.shield = 'buckler'; s.equip.armor = 'padded';
    window.__shopDone = false;
    G.shop.open(shop).then(() => (window.__shopDone = true));
  }, shop);
  await h.wait(500);
  await h.shot('shop_buy');
  // keyboard: down to first row, select, then act (buy)
  await h.key('ArrowDown'); await h.wait(80); await h.key('ArrowDown'); await h.wait(80);
  await h.key('Enter'); await h.wait(300);
  await h.shot('shop_sel');
  // find act button and press via keyboard: focus moved to 'act' in portrait, in landscape press Right
  await h.eval(() => {});
  await h.key('Enter'); await h.wait(400);
  await h.shot('shop_bought');
  await h.key('Enter'); await h.wait(400); // equip now? -> Equip
  await h.shot('shop_equipped');
  // try something expensive
  await h.eval(() => { G.state.gold = 5; });
  await h.key('Enter'); await h.wait(250);
  await h.shot('shop_poor');
  // sell tab
  const W = await h.W();
  await h.eval(() => { const n = G.scenes.top(); });
  await h.wait(1500);
  console.log('gold', await h.eval(() => G.state.gold), 'equip', await h.eval(() => JSON.stringify(G.state.equip)));
  await h.key('Escape'); await h.wait(400);
  console.log('closed:', await h.eval(() => window.__shopDone));
  // stable
  await h.eval(() => { G.state.gold = 900; G.shop.open('harrowfield_stable'); });
  await h.wait(500);
  await h.key('ArrowDown'); await h.wait(80); await h.key('ArrowDown'); await h.wait(80); await h.key('ArrowDown'); await h.wait(80);
  await h.key('Enter'); await h.wait(300);
  await h.shot('stable');
  await h.key('Escape'); await h.wait(400);
  // sell tab via eval of a tap location: use keyboard up to tabs
  await h.eval(() => { G.shop.open('millbridge_smith'); });
  await h.wait(400);
  await h.key('ArrowDown'); await h.wait(80); await h.key('ArrowRight'); await h.wait(80); await h.key('Enter'); await h.wait(300);
  await h.key('ArrowDown'); await h.wait(80); await h.key('Enter'); await h.wait(300);
  await h.shot('sell');
  await h.key('Escape'); await h.wait(400);
  // inn
  await h.eval(() => { G.state.hp = 10; G.state.map = 'millbridge_inn'; G.state.x = 4; G.state.y = 5; window.__inn = null; G.shop.inn(15).then((r) => (window.__inn = r)); });
  await h.wait(600);
  await h.shot('inn_ask');
  await h.key('Enter'); await h.wait(300); await h.key('Enter'); await h.wait(700);
  await h.shot('inn_zzz');
  await h.wait(1200);
  await h.shot('inn_rested');
  await h.wait(3000);
  console.log('inn result', await h.eval(() => JSON.stringify({ r: window.__inn, hp: G.state.hp, inn: G.state.lastInn, gold: G.state.gold })));
};
