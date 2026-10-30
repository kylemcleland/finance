// Shops (buy/sell with gear comparison) and inns. DESIGN.md §9.
// G.shop.open(shopId) → Promise (resolves when closed); G.shop.inn(price) → Promise<bool rested>.
(() => {
  const U = G.U;
  const D = () => G.draw;
  const M = () => G.mui;
  const ctx = () => G.gfx.ctx;

  const sellPrice = (it) => Math.floor((it.price || 0) / 2);
  const isGear = (it) => !!(G.slotOf && G.slotOf[it.type]);
  const canSell = (it) => it && it.type !== 'key' && !it.noSell && (it.price || 0) > 0 && it.id !== 'stick' && it.id !== 'tunic';
  const TYPE_NAMES = { weapon: 'Sword', shield: 'Shield', armor: 'Armor', lance: 'Lance', horse: 'Horse', bow: 'Bow', consumable: 'Provision', key: 'Key item' };

  const BUY_LINES = ['A fine choice!', 'Pleasure doing business.', 'Use it well!', 'You won\'t regret it.', 'Thank you kindly!'];
  const SELL_LINES = ['I\'ll find a buyer for that.', 'Fair trade.', 'Hm, it\'ll do.', 'Done and done.'];
  const POOR_LINES = ['You\'re a bit short, friend.', 'Come back with more coin.', 'No credit, sorry!'];

  async function open(shopId) {
    const shop = G.shops && G.shops[shopId];
    if (!shop) { console.warn('unknown shop', shopId); G.ui.toast('The shop is closed.', '#ffb08a'); return; }
    const mui = M();
    const nav = mui.makeNav();
    const fx = mui.makeFx();
    const S = {
      tab: 'buy', sel: null, goldShown: G.state.gold, goldFlash: 0, shake: 0,
      line: shop.greet || 'Welcome!', lineT: 0, busy: false, coinTarget: { x: 0, y: 0 },
    };
    const look = (typeof shop.look === 'string' && !(G.looks && G.looks[shop.look])) ? 'merchant' : shop.look || 'merchant';

    function buyList() { return (shop.stock || []).map((id) => G.items[id]).filter(Boolean); }
    function sellList() {
      const out = [];
      for (const id in G.state.bag) { const it = G.items[id]; if (canSell(it)) out.push(it); }
      const order = G.itemTypes || [];
      out.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type) || a.price - b.price);
      return out;
    }
    function say(l) { S.line = l; S.lineT = 0; }

    async function buy(it) {
      if (S.busy) return;
      const price = it.price || 0;
      if (G.state.gold < price) {
        S.goldFlash = 0.8; S.shake = 0.35;
        G.sfx.play('cancel');
        say(`${U.pick(POOR_LINES)} (Need ${price - G.state.gold} more.)`);
        const bb = S.btnRect; if (bb) fx.text(bb.x + bb.w / 2, bb.y - 6, "Can't afford!", '#ff8a7a', 9);
        return;
      }
      G.state.gold -= price;
      G.sfx.play('coin');
      G.player.give(it.id, 1);
      say(U.pick(BUY_LINES));
      const b = S.btnRect || { x: G.W / 2, y: G.H / 2, w: 0, h: 0 };
      for (let i = 0; i < 6; i++) fx.coin(S.coinTarget.x, S.coinTarget.y, b.x + b.w / 2, b.y + b.h / 2, i * 0.05);
      fx.sparkle(b.x + b.w / 2, b.y + b.h / 2, 10, '#ffe48a');
      if (isGear(it)) {
        S.busy = true;
        const slot = G.slotOf[it.type];
        const i = await G.ui.ask(`Equip the ${it.name} now?`, ['Equip now', 'Later'], { name: shop.keeper, look });
        if (i === 0 && G.player.equip(it.id)) {
          G.sfx.play('confirm');
          fx.text(b.x + b.w / 2, b.y - 8, 'Equipped!', '#ffe48a', 10);
          say(`Wear it with pride!`);
          fx.sparkle(b.x + b.w / 2, b.y - 20, 18, '#fff3b0', 60);
        }
        S.busy = false;
        void slot;
      } else fx.text(b.x + b.w / 2, b.y - 6, `+1 ${it.name}`, '#9ff59a', 9);
    }
    async function sell(it) {
      if (S.busy || !G.state.bag[it.id]) return;
      const p = sellPrice(it);
      if (isGear(it)) {
        S.busy = true;
        const i = await G.ui.ask(`Sell your ${it.name} for ${p} gold?`, ['Sell', 'Keep it'], { name: shop.keeper, look });
        S.busy = false;
        if (i !== 0) return;
      }
      G.player.take(it.id, 1);
      G.player.addGold(p);
      say(U.pick(SELL_LINES));
      const b = S.btnRect || { x: G.W / 2, y: G.H / 2, w: 0, h: 0 };
      for (let k = 0; k < Math.min(8, 2 + Math.floor(p / 40)); k++) fx.coin(b.x + b.w / 2, b.y + b.h / 2, S.coinTarget.x, S.coinTarget.y, k * 0.05);
      fx.text(b.x + b.w / 2, b.y - 6, `+${p}g`, '#ffe48a', 10);
      if (!G.state.bag[it.id]) S.sel = null;
    }

    const def = {
      name: 'shop',
      update(dt) {
        fx.update(dt);
        S.lineT += dt;
        S.goldFlash = Math.max(0, S.goldFlash - dt);
        S.shake = Math.max(0, S.shake - dt);
        const g = G.state.gold;
        S.goldShown = U.approach(S.goldShown, g, Math.max(30, Math.abs(g - S.goldShown) * 3.5) * dt);
        const k = nav.update(dt);
        if (S.busy) return;
        if (k.menu) return def.close();
        if (k.back) {
          G.sfx.play('cancel');
          def.close();
        }
      },
      draw(c, k) {
        c.globalAlpha = k;
        D().rect(0, 0, G.W, G.H, 'rgba(20,12,8,0.62)');
        c.save();
        const e = U.ease.outBack(k);
        c.translate(G.W / 2, G.H / 2); c.scale(0.92 + 0.08 * e, 0.92 + 0.08 * e); c.translate(-G.W / 2, -G.H / 2);
        nav.begin();
        drawShop();
        fx.draw();
        c.restore();
        c.globalAlpha = 1;
      },
    };
    const narrow = () => G.W <= G.H * 1.15;

    function drawShop() {
      const W = G.W, H = G.H, land = !narrow();
      const pw = Math.min(W - 8, land ? 600 : 420), ph = Math.min(H - 8, land ? 420 : 680);
      const P = { x: Math.round((W - pw) / 2), y: Math.round((H - ph) / 2), w: pw, h: ph };
      mui.parchment(P.x, P.y, P.w, P.h);
      // ---- header: keeper, name, speech
      const hx = P.x + 8, hy = P.y + 8;
      mui.portraitFrame(look, hx + 2, hy + 2, 28, { bg1: '#e8c88a', bg2: '#c99a5a' });
      const nameW = P.w - 84;
      let ns = 10;
      while (ns > 7 && D().measure(shop.name, ns) > nameW) ns -= 0.5;
      D().text(shop.name, hx + 38, hy + 3, { size: ns, bold: true, color: '#3a2414' });
      // speech line (typewriter)
      const vis = Math.min(S.line.length, Math.floor(S.lineT * 50));
      D().text(`“${S.line.slice(0, vis)}${vis >= S.line.length ? '”' : ''}`, hx + 38, hy + 16, { size: 6, color: '#7a4b2a', maxW: nameW, lineH: 7.5 });
      if (mui.closeBtn(nav, P.x + P.w - 30, P.y + 5)) def.close();
      // ---- tabs + gold counter
      const ty = P.y + 42;
      const sx = S.shake > 0 ? Math.sin(S.shake * 60) * 3 * (S.shake / 0.35) : 0;
      const gw = mui.goldCounter(P.x + P.w - 8 + sx, ty + 4.5, S.goldShown, { align: 'right', flash: S.goldFlash > 0 && Math.sin(S.goldFlash * 25) > -0.3 });
      S.coinTarget = { x: P.x + P.w - 8 - gw + 8, y: ty + 12 };
      const tabW = land ? 80 : Math.min(90, (P.w - 16 - gw - 12) / 2);
      ['buy', 'sell'].forEach((t, i) => {
        const on = S.tab === t;
        if (nav.btn('tab_' + t, P.x + 8 + i * (tabW + 5), ty, tabW, 24, t === 'buy' ? 'Buy' : 'Sell', {
          color: on ? '#b8442f' : '#bfa070', textColor: on ? '#fff6dc' : '#4a2a14', icon: t === 'buy' ? 'bag' : 'coin', pri: t === 'buy',
        })) { if (S.tab !== t) { S.tab = t; S.sel = null; nav.resetScroll('shoplist'); } }
      });
      const top = ty + 30;
      const bodyH = P.y + P.h - 8 - top;
      let LA, DA;
      if (land) {
        const lw = Math.floor((P.w - 16) * 0.5);
        LA = { x: P.x + 8, y: top, w: lw, h: bodyH };
        DA = { x: P.x + 8 + lw + 6, y: top, w: P.w - 16 - lw - 6, h: bodyH };
      } else {
        const dh = Math.min(150, Math.max(118, bodyH * 0.42));
        LA = { x: P.x + 8, y: top, w: P.w - 16, h: bodyH - dh - 4 };
        DA = { x: P.x + 8, y: top + bodyH - dh, w: P.w - 16, h: dh };
      }
      const list = S.tab === 'buy' ? buyList() : sellList();
      if (S.sel && !list.includes(S.sel)) S.sel = null;
      if (!S.sel && list.length) S.sel = list[0];
      // ---- list
      nav.scroll('shoplist', LA, (oy) => {
        let y = oy + 1;
        if (!list.length) {
          D().text(S.tab === 'buy' ? 'Sold out!' : 'Nothing to sell. (Equipped gear and key items can\'t be sold.)', LA.x + LA.w / 2, y + 16, { size: 7, align: 'center', color: '#8a6a4a', maxW: LA.w - 20 });
          return 50;
        }
        for (const it of list) {
          const rh = 30;
          const price = S.tab === 'buy' ? it.price : sellPrice(it);
          const afford = S.tab === 'sell' || G.state.gold >= price;
          const own = G.player.count(it.id);
          const eq = isGear(it) && G.state.equip[G.slotOf[it.type]] === it.id;
          if (nav.btn('row_' + it.id, LA.x, y, LA.w - 5, rh - 3, '', {
            pri: true,
            draw(r, st) {
              const v = isGear(it) ? mui.verdict(it, mui.equippedFor(it)) : 0;
              mui.drawRow(r, st, { selected: S.sel === it, accent: S.tab === 'buy' && isGear(it) && !eq ? (v > 0 ? '#5bb04a' : v < 0 ? '#d6453d' : null) : null });
              mui.itemIcon(it, r.x + 15, r.y + r.h / 2, 14);
              D().text(it.name, r.x + 30, r.y + 5, { size: 8, bold: true, color: '#2b1d14' });
              const sub = TYPE_NAMES[it.type] || it.type;
              let sx2 = r.x + 30;
              D().text(sub, sx2, r.y + 16, { size: 6, color: '#8a6a4a' });
              sx2 += D().measure(sub, 6) + 4;
              if (eq) sx2 += mui.chip(sx2, r.y + 15, 'Equipped', '#c9893c') + 3;
              else if (own) sx2 += mui.chip(sx2, r.y + 15, (S.tab === 'sell' ? '×' : 'Own ') + own, '#8a7a5a') + 3;
              if (S.tab === 'buy' && isGear(it) && !eq && v > 0) mui.chip(sx2, r.y + 15, '▲ Upgrade', '#4a8a3a');
              // price
              mui.icon('coin', r.x + r.w - 9, r.y + r.h / 2, 9);
              D().text(String(price), r.x + r.w - 15, r.y + r.h / 2 + 0.5, { size: 8, align: 'right', baseline: 'middle', color: afford ? '#3a2414' : '#c0392b', bold: true });
            },
          })) { S.sel = it; if (!land) nav.setFocus('act'); }
          y += rh;
        }
        return y - oy + 2;
      });
      // ---- detail
      drawDetail(DA, land);
    }

    function drawDetail(A, land) {
      mui.inset(A.x, A.y, A.w, A.h, 'rgba(255,250,235,0.55)');
      const it = S.sel;
      if (!it) {
        D().text(S.tab === 'buy' ? 'Tap an item to see details.' : 'Tap an item to sell it for half its price.', A.x + A.w / 2, A.y + A.h / 2 - 6, { size: 7, align: 'center', color: '#8a6a4a', maxW: A.w - 20 });
        S.btnRect = null;
        return;
      }
      const big = it.type === 'horse' ? 30 : 24;
      const ix = A.x + 8 + big / 2 + 3, iy = A.y + 8 + big / 2 + 3;
      if (it.type === 'horse') drawHorseCard(A.x + 6, A.y + 6, big + 8, it);
      else mui.itemIcon(it, ix, iy, big);
      const tx = A.x + big + 20;
      D().text(it.name, tx, A.y + 7, { size: 9, bold: true, color: '#2b1d14', maxW: A.w - big - 26 });
      const own = G.player.count(it.id);
      D().text((TYPE_NAMES[it.type] || it.type) + (own ? `  ·  In bag: ${own}` : ''), tx, A.y + 20, { size: 6, color: '#8a6a4a' });
      let y = A.y + big + 18;
      const descH = D().text(it.desc || '', A.x + 8, y, { size: 7, color: '#3a2414', maxW: A.w - 16, lineH: 9 });
      y += descH + 3;
      // comparison
      const eqIt = mui.equippedFor(it);
      const btnH = 24;
      const room = A.y + A.h - btnH - 8 - y;
      if (mui.STATS[it.type] && room > 12) {
        if (eqIt !== undefined && S.tab === 'buy') {
          const isEq = eqIt && eqIt.id === it.id;
          D().text(isEq ? 'Currently equipped' : `vs. equipped: ${eqIt ? eqIt.name : 'nothing'}`, A.x + 8, y, { size: 6, color: '#8a5a2a' });
          y += 9;
          mui.drawCompare(it, isEq ? undefined : eqIt, A.x + 10, y, Math.min(A.w - 20, 150), { lh: 9 });
        } else mui.drawCompare(it, undefined, A.x + 10, y, Math.min(A.w - 20, 150), { lh: 9 });
      }
      // action button
      const bw = Math.min(A.w - 16, 140);
      const bx = A.x + A.w - bw - 8, by = A.y + A.h - btnH - 8;
      S.btnRect = { x: bx, y: by, w: bw, h: btnH };
      if (S.tab === 'buy') {
        const afford = G.state.gold >= it.price;
        if (nav.btn('act', bx, by, bw, btnH, afford ? `Buy for ${it.price}g` : `Need ${it.price}g`, {
          color: afford ? '#5a8a3a' : '#a39580', icon: 'coin', sfx: false, tapDisabled: true, pri: true,
        })) buy(it);
      } else {
        const p = sellPrice(it);
        if (nav.btn('act', bx, by, bw, btnH, `Sell for ${p}g`, { color: '#c9893c', icon: 'coin', sfx: false, pri: true })) sell(it);
      }
    }

    // A little horse portrait for the stable.
    function drawHorseCard(x, y, s, it) {
      const g = ctx().createLinearGradient(x, y, x, y + s);
      g.addColorStop(0, '#9fd0ef'); g.addColorStop(0.7, '#cfe6b0'); g.addColorStop(1, '#7fae4a');
      D().rrect(x - 1, y - 1, s + 2, s + 2, 4, '#7a4b2a');
      D().rrect(x, y, s, s, 3, g);
      ctx().save();
      ctx().beginPath(); ctx().rect(x, y, s, s); ctx().clip();
      const bob = Math.sin(G.time * 3) * 0.6;
      mui.icon('horse', x + s / 2 + 1, y + s / 2 + 2 + bob, s * 0.9, { color: mui.itemColor(it) });
      ctx().restore();
    }

    await mui.runScene(def);
  }

  // ======================================================================
  // INN
  // ======================================================================
  async function inn(price = 10) {
    price = Math.max(0, Math.round(price || 0));
    const q = price > 0 ? `Rest for ${price} gold? You'll wake fully healed. (You have ${G.state.gold}g.)` : 'Rest here for the night?';
    const i = await G.ui.ask(q, ['Rest', 'Not now'], { name: 'Innkeeper', look: 'innkeep' });
    if (i !== 0) return false;
    if (G.state.gold < price) {
      G.sfx.play('cancel');
      await G.ui.say(`Sorry, love — a room is ${price} gold. Come back when you've the coin.`, { name: 'Innkeeper', look: 'innkeep' });
      return false;
    }
    G.state.gold -= price;
    if (price) G.sfx.play('coin');
    await restScene();
    G.ui.toast('HP fully restored. Game saved.', '#9ff59a');
    return true;
  }

  function lullaby() {
    if (!G.sfx.tone) return;
    const notes = [523, 659, 784, 1047, 784, 659, 523, 392, 523, 659, 523];
    notes.forEach((f, k) => G.sfx.tone(f, 0.38, { type: 'triangle', vol: 0.09, delay: 0.25 + k * 0.2 }));
    [262, 196, 262].forEach((f, k) => G.sfx.tone(f, 0.9, { type: 'sine', vol: 0.08, delay: 0.25 + k * 0.75 }));
  }

  function restScene() {
    const mui = M();
    const stars = Array.from({ length: 36 }, () => [Math.random(), Math.random() * 0.7, Math.random() * 6]);
    let t = 0, healed = false, skip = false;
    const before = G.state.hp;
    const def = {
      name: 'inn-rest',
      update(dt) {
        t += dt;
        if (t > 0.9 && !healed) {
          healed = true;
          G.player.heal('full');
          const s = G.state;
          s.lastInn = { map: s.map, x: s.x, y: s.y };
          G.save();
          G.sfx.play('heal');
        }
        if (t > 1.2 && (G.input.anyTap() || G.input.pressed('a'))) { G.input.consumeAllTaps(); skip = true; }
        if (t > 4.2 || (skip && healed && t > 1.4)) def.close();
      },
      draw(c, k) {
        const W = G.W, H = G.H;
        // fade in (0..0.6), hold, fade out (k drives the close)
        const a = Math.min(1, t / 0.6) * k;
        c.globalAlpha = a;
        const g = c.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#05030f'); g.addColorStop(1, '#1a1030');
        c.fillStyle = g; c.fillRect(0, 0, W, H);
        for (const s of stars) {
          c.globalAlpha = a * (0.4 + 0.5 * Math.abs(Math.sin(t * 1.5 + s[2])));
          D().rect(s[0] * W, s[1] * H, 1, 1, '#fff8e0');
        }
        c.globalAlpha = a;
        const cx = W / 2, cy = H * 0.4;
        // moon
        D().circle(cx + 40, cy - 50, 16, 'rgba(255,240,180,0.15)');
        mui.icon('inn', cx + 40, cy - 50, 26);
        // candle-lit bed silhouette
        D().rrect(cx - 34, cy + 10, 68, 16, 3, '#5a3418');
        D().rrect(cx - 30, cy + 4, 60, 10, 3, '#c9b6e0');
        D().rrect(cx - 30, cy + 2, 16, 8, 3, '#f4f0e6');
        D().rect(cx - 34, cy - 2, 4, 30, '#4a2a14'); D().rect(cx + 30, cy + 4, 4, 24, '#4a2a14');
        // sleeper lying on the pillow, under a quilt
        c.save(); c.translate(cx - 26, cy + 6); c.rotate(-Math.PI / 2);
        G.chars.draw(c, G.state.look || 'hero', 'down', 0, 0, 14, 1, { shadow: false, alpha: a });
        c.restore();
        c.globalAlpha = a;
        D().rrect(cx - 18, cy + 1, 48, 12, 3, '#8a5aa8', '#4a2a5a', 1);
        for (let q = 0; q < 4; q++) D().rect(cx - 14 + q * 11, cy + 3, 1, 9, 'rgba(255,255,255,0.18)');
        // Zzz
        for (let i = 0; i < 4; i++) {
          const p = ((t * 0.55 + i * 0.25) % 1);
          c.globalAlpha = a * Math.sin(p * Math.PI);
          D().text('Z', cx - 14 + p * 30 + Math.sin(p * 9 + i) * 4, cy - 6 - p * 46, { size: 8 + p * 10, bold: true, color: '#cfe0ff', outline: '#2a2050', outlineW: 2 });
        }
        c.globalAlpha = a;
        if (healed) {
          const k2 = U.clamp((t - 0.9) / 0.4, 0, 1);
          c.globalAlpha = a * k2;
          D().text('Rested!', cx, cy + 44, { size: 14, align: 'center', bold: true, color: '#ffe48a', outline: '#3a1a10', outlineW: 3 });
          const mx = G.player.maxHp();
          D().text(`HP ${Math.round(U.lerp(before, mx, k2))} / ${mx}`, cx, cy + 64, { size: 8, align: 'center', color: '#9ff59a', outline: '#102010', outlineW: 2 });
          D().text('Game saved', cx, cy + 78, { size: 7, align: 'center', color: '#cfe0ff' });
        }
        c.globalAlpha = 1;
      },
    };
    lullaby();
    return mui.runScene(def);
  }

  G.shop = { open, inn, sellPrice };
  G.cmd = G.cmd || {};
  G.cmd.shop = (id) => G.shop.open(id);
  G.cmd.inn = (price) => G.shop.inn(price);
  if (!G.cmd.stable) G.cmd.stable = () => G.shop.open('harrowfield_stable');
})();
