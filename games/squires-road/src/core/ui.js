// Core: dialog boxes, choices, toasts, simple list menus (drawn above all scenes).
(() => {
  const D = () => G.draw;
  const P = () => G.PAL;
  const LINES = 3;
  const CPS = 55; // typewriter chars per second

  let dlg = null;   // {pages, page, shown, name, look, resolve, choices, sel}
  let menu = null;  // {title, items, sel, resolve, scroll}
  const toasts = [];
  let blockUntil = 0; // swallow taps for a few frames after closing

  function layoutBox() {
    const w = Math.min(G.W - 8, 300);
    const h = 50;
    return { x: Math.round((G.W - w) / 2), y: G.H - h - 6, w, h };
  }

  function paginate(texts, hasPortrait) {
    const ctx = G.gfx.ctx;
    const box = layoutBox();
    ctx.font = D().font(8, true);
    const pad = hasPortrait ? 36 : 10;
    const pages = [];
    for (const t of texts) {
      const lines = G.U.wrapText(ctx, t, box.w - pad - 10);
      for (let i = 0; i < lines.length; i += LINES) pages.push(lines.slice(i, i + LINES));
    }
    return pages;
  }

  const ui = {
    busy: () => !!dlg || !!menu,
    toastOffset: 0, // full-screen UIs may push toasts down (logical px)
    say(text, o = {}) {
      const texts = Array.isArray(text) ? text : [text];
      return new Promise((resolve) => {
        dlg = { pages: paginate(texts, !!o.look), page: 0, shown: 0, name: o.name, look: o.look, resolve, choices: null, sel: 0, t: 0 };
      });
    },
    ask(text, choices = ['Yes', 'No'], o = {}) {
      return new Promise((resolve) => {
        dlg = {
          pages: paginate([text], !!o.look), page: 0, shown: 0, name: o.name, look: o.look,
          resolve, choices, sel: 0, t: 0,
        };
        // jump to last page so the question is visible with the choices
        dlg.ask = true;
      });
    },
    toast(text, color) {
      toasts.push({ text, color: color || P().gold, t: 0 });
      if (toasts.length > 4) toasts.shift();
    },
    menu(title, items, o = {}) {
      return new Promise((resolve) => {
        menu = { title, items: items.map((it) => (typeof it === 'string' ? { label: it } : it)), sel: 0, resolve, scroll: 0, cancel: o.cancel !== false, sub: o.sub };
      });
    },

    update(dt) {
      for (let i = toasts.length - 1; i >= 0; i--) { toasts[i].t += dt; if (toasts[i].t > 2.6) toasts.splice(i, 1); }
      if (blockUntil > 0) { blockUntil--; if (dlg || menu) G.input.consumeAllTaps(); }
      if (menu) return updateMenu();
      if (!dlg) return;
      const inp = G.input;
      dlg.t += dt;
      const page = dlg.pages[dlg.page] || [''];
      const total = page.join(' ').length;
      const before = Math.floor(dlg.shown);
      dlg.shown = Math.min(total, dlg.shown + dt * CPS);
      if (Math.floor(dlg.shown) !== before && Math.floor(dlg.shown) % 3 === 0) G.sfx.play('text');
      const lastPage = dlg.page >= dlg.pages.length - 1;
      const done = dlg.shown >= total;

      if (dlg.choices && lastPage && done) {
        // choice buttons handled in draw (immediate mode), keyboard here
        if (inp.pressed('menu') || inp.pressed('b')) return finishAsk(dlg.choices.length - 1);
        const d = inp.dir4();
        if (d && !dlg.navHeld) {
          dlg.navHeld = true;
          if (d === 'up') dlg.sel = (dlg.sel + dlg.choices.length - 1) % dlg.choices.length;
          if (d === 'down') dlg.sel = (dlg.sel + 1) % dlg.choices.length;
          G.sfx.play('select');
        } else if (!d) dlg.navHeld = false;
        if (G.input.pressed('a') && !inp.events.some((e) => e.type === 'tap')) return finishAsk(dlg.sel);
        return;
      }
      if (dlg.t > 0.12 && inp.anyTap()) {
        inp.consumeAllTaps();
        if (!done) dlg.shown = total;
        else if (!lastPage) { dlg.page++; dlg.shown = 0; G.sfx.play('select'); }
        else {
          const r = dlg.resolve; dlg = null; blockUntil = 2; r();
        }
      }
    },

    draw(ctx) {
      // toasts
      let ty = 40 + (ui.toastOffset || 0); // below the HUD plates at the top
      for (const t of toasts) {
        const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.2 ? Math.max(0, (2.6 - t.t) / 0.4) : 1;
        ctx.globalAlpha = a;
        const w = Math.min(G.W - 16, D().measure(t.text, 8) + 16);
        D().rrect(G.W / 2 - w / 2, ty, w, 14, 7, 'rgba(25,15,8,0.85)', t.color, 1);
        D().text(t.text, G.W / 2, ty + 7.5, { align: 'center', baseline: 'middle', color: t.color, size: 8 });
        ty += 17;
        ctx.globalAlpha = 1;
      }
      if (dlg) drawDialog(ctx);
      if (menu) drawMenu(ctx);
    },
  };

  function finishAsk(i) {
    G.sfx.play(i === dlg.choices.length - 1 && dlg.choices.length > 1 ? 'cancel' : 'confirm');
    const r = dlg.resolve; dlg = null; blockUntil = 2; G.input.consumeAllTaps(); r(i);
  }

  function drawDialog(ctx) {
    const box = layoutBox();
    D().panel(box.x, box.y, box.w, box.h);
    let tx = box.x + 10;
    if (dlg.look) {
      D().rrect(box.x + 6, box.y + 8, 26, 26, 3, '#e9d3a4', P().edge, 1);
      G.chars.portrait(ctx, dlg.look, box.x + 7, box.y + 9, 24);
      tx = box.x + 38;
    }
    if (dlg.name) {
      const nw = D().measure(dlg.name, 8) + 12;
      D().rrect(box.x + 8, box.y - 9, nw, 13, 3, P().edge, '#3d2414', 1);
      D().text(dlg.name, box.x + 14, box.y - 2.5, { baseline: 'middle', color: '#fff3d6', size: 8 });
    }
    const page = dlg.pages[dlg.page] || [];
    let left = Math.floor(dlg.shown);
    page.forEach((ln, i) => {
      if (left <= 0) return;
      const s = ln.slice(0, left);
      left -= ln.length + 1;
      D().text(s, tx, box.y + 9 + i * 11, { size: 8, color: P().ink });
    });
    const total = page.join(' ').length;
    const lastPage = dlg.page >= dlg.pages.length - 1;
    if (dlg.shown >= total && !(dlg.choices && lastPage)) {
      const bob = Math.sin(G.time * 8) > 0 ? 1 : 0;
      ctx.fillStyle = P().edge;
      ctx.beginPath();
      const ax = box.x + box.w - 12, ay = box.y + box.h - 10 + bob;
      ctx.moveTo(ax, ay); ctx.lineTo(ax + 6, ay); ctx.lineTo(ax + 3, ay + 4); ctx.fill();
    }
    if (dlg.choices && lastPage && dlg.shown >= total) {
      const n = dlg.choices.length;
      const bw = Math.min(140, Math.max(70, ...dlg.choices.map((c) => D().measure(c, 8) + 24)));
      const bh = 22, gap = 4;
      const bx = box.x + box.w - bw - 4;
      let by = box.y - 8 - n * (bh + gap);
      for (let i = 0; i < n; i++) {
        if (D().button(bx, by, bw, bh, dlg.choices[i], { selected: i === dlg.sel && !G.input.lastWasTouch, color: '#b9783a' })) {
          return finishAsk(i);
        }
        by += bh + gap;
      }
    }
  }

  function updateMenu() {
    const inp = G.input;
    const n = menu.items.length;
    const d = inp.dir4();
    if (d && !menu.navHeld) {
      menu.navHeld = true;
      if (d === 'up') menu.sel = (menu.sel + n - 1) % n;
      if (d === 'down') menu.sel = (menu.sel + 1) % n;
      G.sfx.play('select');
    } else if (!d) menu.navHeld = false;
    if (inp.pressed('a') && !inp.events.some((e) => e.type === 'tap') && !menu.items[menu.sel].disabled) return finishMenu(menu.sel);
    if (menu.cancel && (inp.pressed('b') || inp.pressed('menu'))) return finishMenu(-1);
  }
  function finishMenu(i) {
    G.sfx.play(i < 0 ? 'cancel' : 'confirm');
    const r = menu.resolve; menu = null; blockUntil = 2; G.input.consumeAllTaps(); r(i);
  }
  function drawMenu(ctx) {
    ctx.fillStyle = P().dim; ctx.fillRect(0, 0, G.W, G.H);
    const n = menu.items.length;
    const bh = 22, gap = 4;
    const w = Math.min(G.W - 16, 220);
    const maxRows = Math.max(3, Math.floor((G.H - 80) / (bh + gap)));
    const rows = Math.min(n, maxRows);
    const h = 30 + rows * (bh + gap) + (menu.cancel ? bh + 8 : 0) + (menu.sub ? 12 : 0);
    const x = Math.round((G.W - w) / 2), y = Math.round((G.H - h) / 2);
    D().panel(x, y, w, h);
    D().text(menu.title, G.W / 2, y + 9, { align: 'center', size: 9, bold: true });
    let by = y + 24;
    if (menu.sub) { D().text(menu.sub, G.W / 2, by - 2, { align: 'center', size: 7, color: '#6a4a2a' }); by += 12; }
    // keep selection visible
    if (menu.sel < menu.scroll) menu.scroll = menu.sel;
    if (menu.sel >= menu.scroll + rows) menu.scroll = menu.sel - rows + 1;
    for (let r = 0; r < rows; r++) {
      const i = menu.scroll + r;
      const it = menu.items[i];
      if (D().button(x + 8, by, w - 16, bh, it.label, { selected: i === menu.sel && !G.input.lastWasTouch, disabled: it.disabled, color: it.color })) return finishMenu(i);
      by += bh + gap;
    }
    if (n > rows) {
      if (menu.scroll > 0 && D().button(x + w - 26, y + 4, 20, 14, '▲', { size: 7 })) menu.scroll--, menu.sel = menu.scroll;
      if (menu.scroll + rows < n && D().button(x + w - 26, y + h - 20 - (menu.cancel ? bh + 8 : 0), 20, 14, '▼', { size: 7 })) menu.scroll++, menu.sel = menu.scroll + rows - 1;
    }
    if (menu.cancel && D().button(x + w / 2 - 40, by + 4, 80, bh, 'Back', { color: '#8a6a4a' })) return finishMenu(-1);
  }

  G.ui = ui;
})();
