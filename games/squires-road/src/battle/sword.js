// Live sword combat (DESIGN.md §7a): a top-down 3/4 arena with souls-lite
// thumb controls. Art lives in sword_art.js, enemy AI in sword_ai.js.
//
// Touch input model (R zone):
//   * pointer down  -> the sword cocks back at once (visible feedback), and the
//                      press is "pending".
//   * released < 260 ms without moving -> STRIKE (combo-aware). Slow thumbs
//                      still strike: the guard may have shown for a moment.
//   * held >= 150 ms -> BLOCK. The guard counts as raised at the moment the
//                      finger went down, so parry timing is exact.
//   * an enemy hit that lands while a press is still pending also counts as a
//     guard raised at finger-down (so a quick press right before impact parries).
//   * flick -> dodge roll in the flick direction.
//   * hold >= 600 ms then release with the whirlwind perk -> spin attack.
(() => {
  const U = G.U;
  G.SW = G.SW || {};
  const PI = Math.PI, TAU = PI * 2;
  const HOLD_T = 0.15, WHIRL_T = 0.6, TAP_MAX = 0.26, TAP_DIST = 14;
  const HUD_H = 26;
  const REST = 0.85;

  const SWINGS = [
    { wind: 0.07, act: 0.09, rec: 0.24, mult: 1.0, from: 1.7, to: -1.35, arc: 1.15, lunge: 60, cost: 9, kb: 80 },
    { wind: 0.07, act: 0.09, rec: 0.24, mult: 1.05, from: -1.45, to: 1.65, arc: 1.15, lunge: 60, cost: 9, kb: 80 },
    { wind: 0.13, act: 0.11, rec: 0.36, mult: 1.6, from: 2.6, to: -1.7, arc: 1.35, lunge: 110, cost: 15, kb: 170, big: true },
  ];
  const SPIN = { wind: 0.06, act: 0.34, rec: 0.26, mult: 1.8, from: REST, to: REST + TAU, arc: 9, lunge: 0, cost: 26, kb: 190, spin: true, big: true };

  const dirOf = (a) => {
    const c = Math.cos(a), s = Math.sin(a);
    if (Math.abs(c) >= Math.abs(s)) return c > 0 ? 'right' : 'left';
    return s > 0 ? 'down' : 'up';
  };
  const hasTouch = () => G.input.lastWasTouch || 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  const inRect = (p, r) => r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

  function playerWeaponVis(item) {
    if (!item || item.id === 'stick') return { kind: 'stick', len: 15 };
    if (item.id === 'war_axe') return { kind: 'axe', len: 17, color: item.color };
    return { kind: 'sword', len: Math.round((item.reach || 22) * 0.62), color: item.color };
  }
  function enemyWeaponVis(e) {
    const col = e.wcolor || '#b8bcc6';
    switch (e.weapon) {
      case 'short': return { kind: 'sword', len: 11, color: col };
      case 'long': return { kind: 'sword', len: 16, color: col };
      case 'axe': return { kind: 'axe', len: 16, color: e.wcolor || '#8a8f99' };
      case 'club': return { kind: 'club', len: e.kind === 'troll' ? 24 : 15 };
      default: return null;
    }
  }

  function makeScene(opts, done) {
    const art = G.SW.art, AI = G.SW.ai, D = G.draw;
    const arenaKind = ['pit', 'field', 'forest', 'road', 'castle', 'practice'].includes(opts.arena) ? opts.arena : 'field';
    const st0 = G.player.stats();
    const hasPerk = (id) => G.player.hasPerk(id);

    let W = 0, H = 0, A, F, bg, crowd = null;
    const BTN = { potion: null, run: null };
    let T = 0, RT = 0, phase = 'intro', pt = 0, endT = 0, finished = false, won = false, fled = false;
    let hitstop = 0, slowT = 0, slowK = 1, shakeA = 0, flashW = 0, vign = 0, cheer = 0;
    let hintT = 6.5, fightBanner = 0, potionKeyPrev = false;
    const parts = [], texts = [], proj = [];
    const stats = { parries: 0, blocks: 0, taken: 0, landed: 0, dodges: 0, crits: 0, guardBreaks: 0, parried: 0 };
    let token = null, tokenCd = 0;
    const canFlee = !!opts.canFlee && !opts.boss;

    // ---------------------------------------------------------------- player
    const P = {
      team: 'p', look: G.state.look || 'hero', sep: 11,
      x: 0, y: 0, vx: 0, vy: 0, kbx: 0, kby: 0, r: 8, ang: -PI / 2,
      hp: Math.max(1, st0.hp), maxHp: st0.maxHp, hpShow: Math.max(1, st0.hp), hpGhost: Math.max(1, st0.hp),
      sta: st0.maxSta, maxSta: st0.maxSta, staDelay: 0, staFlash: 0,
      atk: st0.atk, def: st0.def, spd: 74 * (st0.speed || 1),
      weapon: st0.weapon || G.items.stick, shield: st0.shield,
      wvis: playerWeaponVis(st0.weapon), svis: art.shieldVis(st0.shield),
      state: 'free', st: 0, stunT: 0, sw: null, combo: 0, comboT: 0,
      guardT: -9, press: null, keyB: false, keyBrt: 0, blockQueued: false,
      iframes: 0, flash: 0, walkD: 0, moving: false, dodge: null, riposte: 0, swHeal: 0,
      bufStrike: -9, bufDodge: null, parryGlow: 0, guardShine: 0, lastStrike: -9,
    };

    // ---------------------------------------------------------------- enemies
    function makeEnemy(id, i) {
      let r = G.roster.sword[id];
      if (!r) {
        console.warn('sword: unknown roster id', id);
        r = G.roster.sword.bandit || { name: String(id), look: 'bandit', hp: 30, dmg: 5, def: 0, ai: 'brawler', weapon: 'short', level: 1, speed: 1, aggression: 0.5 };
      }
      const kind = art.creatureKind(r.look);
      const e = Object.assign({}, r, {
        rid: id, idx: i, x: 0, y: 0, vx: 0, vy: 0, kbx: 0, kby: 0,
        r: kind ? art.CREATURES[kind].r : 8, ang: PI / 2, state: 'idle', st: 0,
        maxHp: r.hp, hp: r.hp, hpShow: r.hp, flash: 0, dead: false, deadT: 0, kind,
        walkD: 0, invuln: 0, level: r.level || 1, wob: 0, glint: 9, stunT: 0,
      });
      e.wvis = enemyWeaponVis(e);
      e.svis = r.shield ? art.shieldVis(true, r.scolor) : null;
      e.spriteH = kind ? (art.CREATURES[kind].h + 2) * 2 : 44;
      e.sep = kind ? Math.max(e.r, art.CREATURES[kind].w * 0.72) : 11;
      AI.init(e);
      return e;
    }
    const ids = Array.isArray(opts.enemies) && opts.enemies.length ? opts.enemies : ['bandit'];
    const enemies = ids.map(makeEnemy);
    let wi = 0;
    for (const e of enemies) if (e.ai === 'wolf') e.packI = wi++;
    const boss = enemies.find((e) => e.boss) && (opts.boss || enemies.length === 1) ? enemies.find((e) => e.boss) : opts.boss ? enemies[0] : null;
    // First fights forgive a late thumb: a wider parry window against low-level, non-boss foes
    // (+120 ms vs level 1, +80 ms vs level 2, +40 ms vs level 3; bosses demand the real window).
    const topLevel = enemies.reduce((m, e) => Math.max(m, e.level || 1), 1);
    const parryEase = boss || opts.boss || enemies.some((e) => e.boss) ? 0 : U.clamp((4 - topLevel) * 0.04, 0, 0.12);
    const tut = enemies.length === 1 && enemies[0].ai === 'dummy' ? { stage: 0, hits: 0, blockT: 0, t: 0 } : null;
    const alive = () => enemies.filter((e) => !e.dead);

    // ---------------------------------------------------------------- layout
    function layout() {
      const oW = W, oH = H, oA = A;
      W = G.W; H = G.H;
      const top = H > W * 1.3 ? HUD_H + 30 : HUD_H + 10;
      F = { x0: 8, y0: top, x1: W - 8, y1: H - 8 };
      A = { x0: F.x0 + 10, y0: F.y0 + 22, x1: F.x1 - 10, y1: F.y1 - 6 };
      bg = art.arena(arenaKind, W, H, F);
      crowd = arenaKind === 'pit' ? art.makeCrowd(W, F) : null;
      BTN.potion = { x: 3, y: 3, w: 25, h: 22 };
      BTN.run = canFlee ? { x: W - 37, y: 4, w: 33, h: 17 } : null;
      if (oW && (oW !== W || oH !== H)) {
        // keep relative positions on rotation
        for (const f of [P, ...enemies]) {
          f.x = A.x0 + ((f.x - oA.x0) / Math.max(1, oA.x1 - oA.x0)) * (A.x1 - A.x0);
          f.y = A.y0 + ((f.y - oA.y0) / Math.max(1, oA.y1 - oA.y0)) * (A.y1 - A.y0);
          clampArena(f);
        }
      }
    }
    function spawn() {
      const aw = A.x1 - A.x0, ah = A.y1 - A.y0;
      const tall = H >= W;
      const cx = (A.x0 + A.x1) / 2, cy = (A.y0 + A.y1) / 2;
      const gap = Math.min(tall ? ah : aw, 150) * 0.5;
      if (tall) { P.x = cx; P.y = cy + gap * 0.75; P.ang = -PI / 2; }
      else { P.x = cx - gap; P.y = cy + 8; P.ang = 0; }
      const n = enemies.length;
      enemies.forEach((e, i) => {
        const k = n === 1 ? 0 : i / (n - 1) - 0.5;
        if (tall) { e.x = cx + k * Math.min(aw * 0.8, n * 40); e.y = cy - gap * 0.75 - (i % 2) * 14; }
        else { e.x = cx + gap + (i % 2) * 14; e.y = cy + k * Math.min(ah * 0.8, n * 34); }
        e.ang = U.angle(e.x, e.y, P.x, P.y);
        clampArena(e);
      });
    }
    function clampArena(f) {
      let hit = false;
      const r = f.r * 0.6;
      if (f.x < A.x0 + r) { f.x = A.x0 + r; hit = true; if (f.kbx < 0) f.kbx *= -0.4; }
      if (f.x > A.x1 - r) { f.x = A.x1 - r; hit = true; if (f.kbx > 0) f.kbx *= -0.4; }
      if (f.y < A.y0) { f.y = A.y0; hit = true; if (f.kby < 0) f.kby *= -0.4; }
      if (f.y > A.y1) { f.y = A.y1; hit = true; if (f.kby > 0) f.kby *= -0.4; }
      f.hitWall = hit;
      return hit;
    }

    // ---------------------------------------------------------------- fx
    const fx = {
      spark(x, y, n, col = '#fff6c0', sp = 140) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, v = sp * (0.4 + Math.random());
          parts.push({ k: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, life: 0.25 + Math.random() * 0.2, t: 0, c: Math.random() < 0.3 ? '#ffffff' : col });
        }
      },
      stars(x, y, n, col = '#ffe48a') {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * TAU, v = 50 + Math.random() * 70;
          parts.push({ k: 'star', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.45 + Math.random() * 0.3, t: 0, c: col, s: 2 + Math.random() * 2, rot: Math.random() * 6 });
        }
      },
      dust(x, y, n = 3) {
        for (let i = 0; i < n; i++) parts.push({ k: 'dust', x: x + U.rand(-4, 4), y: y + U.rand(-2, 1), vx: U.rand(-15, 15), vy: U.rand(-12, -2), life: 0.4 + Math.random() * 0.25, t: 0, s: 2 + Math.random() * 2 });
      },
      ring(x, y, col = '#ffffff', r = 24, life = 0.35) { parts.push({ k: 'ring', x, y, life, t: 0, c: col, s: r }); },
      heal(x, y, n = 8) {
        for (let i = 0; i < n; i++) parts.push({ k: 'heal', x: x + U.rand(-10, 10), y: y + U.rand(-30, 0), vx: 0, vy: -U.rand(20, 40), life: 0.7 + Math.random() * 0.4, t: Math.random() * -0.3, c: Math.random() < 0.5 ? '#7cff7a' : '#c8ffb0' });
      },
      text(x, y, s, col = '#fff', size = 8, o = {}) {
        texts.push({ x, y, s: String(s), col, size, t: 0, life: o.life || 0.8, vy: o.vy ?? -26, pop: o.pop ?? 1 });
        if (texts.length > 24) texts.shift();
      },
      shake(a) { shakeA = Math.max(shakeA, a); },
      stop(t) { hitstop = Math.max(hitstop, t); },
      slow(t, k) { slowT = Math.max(slowT, t); slowK = k; },
    };
    const sfx = (n) => G.sfx.play(n);
    const glintSfx = (red) => { if (red) sfx('charge'); else if (G.sfx.tone) G.sfx.tone(1900, 0.07, { type: 'triangle', vol: 0.07 }); };

    // ---------------------------------------------------------------- player actions
    function canGuard() {
      return P.state === 'free' || P.state === 'block' || (P.state === 'swing' && P.sw && P.sw.ph === 'rec');
    }
    function parryWindow() {
      return 0.12 + parryEase + (P.shield ? (P.shield.parry || 0) / 1000 : 0) + (hasPerk('parry_master') ? 0.08 : 0);
    }
    function startBlock(t0) {
      P.state = 'block'; P.st = 0; P.sw = null;
      P.guardT = Math.min(T, t0 ?? T);
      P.guardShine = parryWindow();
      P.blockQueued = false;
      if (G.sfx.tone) G.sfx.tone(320, 0.05, { type: 'square', vol: 0.05 });
    }
    function wantBlock(t0) {
      if (phase !== 'fight') return;
      if (canGuard()) startBlock(t0);
      else P.blockQueued = true;
    }
    function holding() { return (P.press && P.press.mode === 'hold') || P.keyB; }
    function releaseHold(dur) {
      P.blockQueued = false;
      if (phase !== 'fight') return;
      if (hasPerk('whirlwind') && dur >= WHIRL_T && (P.state === 'block' || P.state === 'free')) {
        P.state = 'free';
        startSwing(0, true);
        return;
      }
      if (P.state === 'block' && !holding()) { P.state = 'free'; P.st = 0; }
    }
    function tapStrike() {
      if (phase !== 'fight') return;
      P.lastStrike = RT;
      if (P.state === 'swing') {
        if (P.sw.ph !== 'wind') P.sw.buf = true;
        return;
      }
      if (P.state === 'free' || P.state === 'block') {
        startSwing(P.comboT > 0 ? P.combo : 0);
        return;
      }
      P.bufStrike = RT; // buffered (e.g. late in a dodge or hurt)
    }
    function nearest(maxD, preferToken) {
      if (preferToken && token && !token.dead && U.dist(P.x, P.y, token.x, token.y) < maxD + 40 &&
          (token.state === 'windup' || token.state === 'attack')) return token;
      let best = null, bd = maxD;
      for (const e of enemies) {
        if (e.dead) continue;
        const d = U.dist(P.x, P.y, e.x, e.y) - e.r;
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    }
    function startSwing(i, spin) {
      const def = spin ? SPIN : SWINGS[i];
      if (P.sta <= 0) { P.staFlash = 0.5; fx.text(P.x, P.y - 50, 'Out of breath!', '#ffb08a', 7); return; }
      P.sta = Math.max(0, P.sta - def.cost); P.staDelay = 0.65;
      const sp = P.weapon.speed || 1;
      P.state = 'swing'; P.st = 0;
      P.sw = { i, def, ph: 'wind', t: 0, wind: def.wind * sp, act: def.act * sp, rec: def.rec * sp, hit: new Set(), buf: false, spin: !!spin };
      P.comboT = 0;
      const tgt = nearest((P.weapon.reach || 20) * 2.6, false);
      if (tgt) P.ang += U.clamp(U.angleDiff(P.ang, U.angle(P.x, P.y, tgt.x, tgt.y)), -1.4, 1.4);
      if (spin) { fx.ring(P.x, P.y - 4, '#ffe48a', 30); sfx('charge'); }
    }
    function tryDodge(dx, dy) {
      if (phase !== 'fight') return;
      const m = Math.hypot(dx, dy) || 1;
      dx /= m; dy /= m;
      const ok = P.state === 'free' || P.state === 'block' || (P.state === 'swing' && P.sw.ph === 'rec');
      if (!ok) { P.bufDodge = { dx, dy, t: RT }; return; }
      const cost = 20 * (hasPerk('blade_dancer') ? 0.7 : 1);
      if (P.sta < 4) { P.staFlash = 0.5; fx.text(P.x, P.y - 50, 'Out of breath!', '#ffb08a', 7); return; }
      P.sta = Math.max(0, P.sta - cost); P.staDelay = 0.6;
      P.state = 'dodge'; P.st = 0; P.sw = null;
      P.dodge = { dx, dy, dur: 0.32 };
      P.iframes = 0.22 * (hasPerk('blade_dancer') ? 1.5 : 1);
      P.dodgeIF = true;
      if (Math.abs(dx) > 0.3) P.ang = Math.atan2(dy, dx);
      sfx('dodge');
      fx.dust(P.x, P.y, 4);
      if (tut && tut.stage === 2) advanceTut();
    }
    function potionCount() {
      let n = 0;
      for (const id in G.state.bag) if (G.items[id] && G.items[id].type === 'consumable') n += G.state.bag[id];
      return n;
    }
    function tryPotion() {
      if (phase !== 'fight') return;
      if (!(P.state === 'free' || P.state === 'block')) return;
      if (P.hp >= P.maxHp) { fx.text(P.x, P.y - 50, 'HP is full', '#cfe8ff', 7); sfx('cancel'); return; }
      const id = G.player.bestHealItem(P.maxHp - P.hp);
      if (!id) { fx.text(P.x, P.y - 50, 'No healing items', '#ffb08a', 7); sfx('cancel'); return; }
      G.state.hp = Math.round(P.hp);
      const got = G.player.useItem(id);
      P.hp = Math.min(P.maxHp, G.state.hp);
      P.state = 'drink'; P.st = 0; P.stunT = 0.7;
      fx.heal(P.x, P.y, 12);
      fx.text(P.x, P.y - 52, `+${got}`, '#8aff8a', 10);
      fx.text(P.x, P.y - 40, (G.items[id] || {}).name || id, '#e8ffe0', 6, { life: 1 });
    }
    function tryFlee() {
      if (!canFlee || phase !== 'fight' || P.state === 'dead') return;
      phase = 'flee'; pt = 0; fled = true; won = false;
      P.state = 'free'; P.sw = null;
      sfx('dodge');
      fx.text(P.x, P.y - 52, 'Got away safely!', '#ffffff', 9, { life: 1.2, vy: -10 });
    }

    // ---------------------------------------------------------------- hits on the player
    function hitPlayer(e, mv, sx, sy, isProj) {
      if (phase !== 'fight' || P.state === 'dead') return 'miss';
      if (P.state === 'dodge' && P.iframes > 0) {
        if (!P.dodgedShown) { stats.dodges++; fx.text(P.x, P.y - 48, 'Dodge!', '#bfe4ff', 7); P.dodgedShown = true; }
        return 'miss';
      }
      if (P.iframes > 0) return 'miss';
      const raw = e.dmg * (mv.mult || 1) * U.rand(0.9, 1.1);
      const srcA = U.angle(P.x, P.y, sx, sy);
      const frontal = Math.abs(U.angleDiff(P.ang, srcA)) < 1.35;
      let guarding = P.state === 'block';
      if (!guarding && P.press && P.press.mode === 'pending' && P.press.neutral && canGuard()) {
        guarding = true;
        P.press.mode = 'hold';
        startBlock(P.press.t0);
      }
      if (guarding && frontal) {
        if (mv.col === 'r') {
          fx.text(P.x, P.y - 56, 'Unblockable!', '#ff6a5a', 8);
        } else if (T - P.guardT <= parryWindow()) {
          doParry(e, sx, sy, isProj);
          return 'parry';
        } else return doBlock(e, mv, raw, srcA);
      }
      takeHit(e, mv, raw, srcA);
      return 'hit';
    }
    function shieldPoint() {
      return { x: P.x + Math.cos(P.ang) * 10, y: P.y - 16 + Math.sin(P.ang) * 7 };
    }
    function doParry(e, sx, sy, isProj) {
      stats.parries++;
      P.sta = Math.min(P.maxSta, P.sta + 15);
      if (hasPerk('riposte')) P.riposte = T + 1.0;
      const sp = shieldPoint();
      fx.spark(sp.x, sp.y, 26, '#ffe48a', 200);
      fx.stars(sp.x, sp.y, 6, '#fff6c0');
      fx.ring(sp.x, sp.y, '#ffffff', 34, 0.4);
      fx.ring(sp.x, sp.y, '#ffe48a', 22, 0.3);
      flashW = 0.55; fx.slow(0.38, 0.22); fx.shake(4); fx.stop(0.09);
      sfx('clang'); sfx('parry');
      fx.text(P.x, P.y - 58, 'PARRY!', '#ffe48a', 13, { pop: 2, life: 1.0, vy: -14 });
      P.parryGlow = 0.5;
      cheer = 1;
      if (!isProj && e && !e.dead) {
        e.state = 'stagger'; e.st = 0; e.stunT = 1.2; e.open = true; e.queue = []; e.plan = null;
        releaseToken(e);
        const a = U.angle(P.x, P.y, e.x, e.y);
        e.kbx += Math.cos(a) * 120; e.kby += Math.sin(a) * 120;
      }
    }
    function doBlock(e, mv, raw, srcA) {
      stats.blocks++;
      if (P.press) P.press.absorbed = true;
      const bv = P.shield ? P.shield.block || 0.5 : 0.35;
      const cost = (6 + raw * 0.9) * (P.shield ? 1 : 1.3) * (mv.bash ? 1.6 : 1);
      const sp = shieldPoint();
      const back = srcA + PI;
      if (P.sta <= 0 || P.sta < cost * 0.5) {
        P.sta = 0; P.staDelay = 1.0;
        const dmg = Math.max(1, Math.round(raw * 0.5 - P.def));
        P.hp -= dmg;
        P.state = 'stagger'; P.st = 0; P.stunT = 0.9; P.sw = null;
        P.kbx += Math.cos(back) * 160; P.kby += Math.sin(back) * 160;
        fx.spark(sp.x, sp.y, 16, '#ffd08a'); fx.stars(P.x, P.y - 36, 4);
        fx.shake(4); fx.stop(0.07); sfx('break');
        fx.text(P.x, P.y - 58, 'Guard broken!', '#ff9a5a', 9, { pop: 1.5 });
        fx.text(P.x + 8, P.y - 44, `-${dmg}`, '#ff6a5a', 8);
        if (P.hp <= 0) playerDown();
        return 'block';
      }
      P.sta = Math.max(0, P.sta - cost); P.staDelay = 0.8;
      const dmg = bv >= 0.75 ? 0 : Math.max(0, Math.round(raw * (1 - bv) - P.def * 0.5));
      if (dmg > 0) { P.hp -= dmg; fx.text(P.x + 8, P.y - 44, `-${dmg}`, '#ff8a7a', 7); }
      const kb = mv.bash ? 170 : 80;
      P.kbx += Math.cos(back) * kb; P.kby += Math.sin(back) * kb;
      if (mv.bash) { P.state = 'stagger'; P.st = 0; P.stunT = 0.3; }
      fx.spark(sp.x, sp.y, 10, '#fff6c0', 120);
      fx.shake(1.5); fx.stop(0.045);
      sfx('block');
      fx.text(P.x, P.y - 52, 'Block', '#bcd8ff', 7);
      if (P.hp <= 0) playerDown();
      return 'block';
    }
    function takeHit(e, mv, raw, srcA) {
      stats.taken++;
      const dmg = Math.max(1, Math.round(raw - P.def));
      P.hp -= dmg;
      P.flash = 0.16; P.iframes = 0.5;
      P.state = 'hurt'; P.st = 0; P.stunT = mv.col === 'r' ? 0.5 : (mv.stun || 0.3); P.sw = null;
      const back = srcA + PI, kb = mv.kb || 110;
      P.kbx += Math.cos(back) * kb; P.kby += Math.sin(back) * kb;
      fx.shake(mv.col === 'r' ? 6 : 3.5); fx.stop(0.06);
      vign = 0.75;
      fx.stars(P.x, P.y - 22, 4, '#ffffff');
      fx.spark(P.x, P.y - 20, 6, '#ffb0a0', 90);
      fx.text(P.x + 6, P.y - 46, `-${dmg}`, '#ff5a4a', 10, { pop: 1.4 });
      sfx('hurt');
      cheer = Math.max(cheer, 0.4);
      if (P.hp <= 0) playerDown();
    }
    function playerDown() {
      P.hp = 0; P.state = 'dead'; P.st = 0; P.sw = null; P.press = null;
      fx.slow(0.8, 0.3);
      phase = 'ending'; endT = 1.2; won = false;
      sfx('thud');
      for (const e of enemies) { if (!e.dead && (e.state === 'windup' || e.state === 'attack')) { e.state = 'recover'; e.st = 0; e.queue = []; } }
      token = null;
    }

    // ---------------------------------------------------------------- hits on enemies
    function hitEnemy(e, sw) {
      if (e.dead) return;
      const a = U.angle(P.x, P.y, e.x, e.y);
      const cx = e.x - Math.cos(a) * e.r, cy = e.y - 16 - Math.sin(a) * e.r * 0.6;
      if (e.invuln > 0) { fx.spark(cx, cy, 6); sfx('clang'); return; }
      const heavy = !!P.weapon.heavy || !!sw.def.big;
      const res = sw.noDefend ? null : AI.defend(e, S, { i: sw.i, heavy, spin: sw.spin });
      if (res === 'parry') {
        stats.parried++;
        P.state = 'stagger'; P.st = 0; P.stunT = 0.6; P.sw = null;
        P.kbx -= Math.cos(a) * 120; P.kby -= Math.sin(a) * 120;
        fx.spark(cx, cy, 20, '#fff6c0', 180); fx.ring(cx, cy, '#ffffff', 26);
        fx.shake(3); fx.stop(0.08); flashW = 0.25;
        sfx('clang'); sfx('parry');
        fx.text(P.x, P.y - 56, 'Parried!', '#ff9a7a', 10, { pop: 1.6 });
        e.state = 'guard'; e.st = 0.25;
        return;
      }
      if (res === 'block') {
        fx.spark(cx, cy, 10, '#fff6c0', 130);
        sfx('block'); sfx('clang');
        fx.text(e.x, e.y - e.spriteH - 6, 'Block', '#bcd8ff', 7);
        P.kbx -= Math.cos(a) * 60; P.kby -= Math.sin(a) * 60;
        e.kbx += Math.cos(a) * 40; e.kby += Math.sin(a) * 40;
        fx.stop(0.04); fx.shake(1.2);
        return;
      }
      if (res === 'break') {
        e.state = 'stagger'; e.st = 0; e.stunT = 1.0; e.open = true; e.queue = []; e.plan = null;
        releaseToken(e);
        fx.text(e.x, e.y - e.spriteH - 14, 'GUARD BREAK!', '#ffd04a', 9, { pop: 1.8 });
        sfx('break');
        fx.spark(cx, cy, 16, '#ffd04a', 160);
      }
      let mult = sw.def.mult;
      if (P.riposte > T && hasPerk('riposte')) {
        mult *= 2.5; P.riposte = 0;
        fx.text(e.x, e.y - e.spriteH - 20, 'RIPOSTE!', '#ff9af0', 10, { pop: 2 });
      }
      const crit = e.open || e.state === 'stun';
      if (crit) mult *= 1.5;
      let dmg = Math.max(1, Math.round(P.atk * mult * U.rand(0.9, 1.1) - (e.def || 0)));
      if (tut && tut.stage < 3) dmg = Math.max(0, Math.min(dmg, e.hp - 1));
      e.hp -= dmg;
      e.flash = 0.12;
      stats.landed++; if (crit) stats.crits++;
      const resist = e.kind === 'troll' || e.ai === 'heavy' ? 0.35 : e.boss ? 0.6 : e.ai === 'dummy' ? 0 : 1;
      const kb = sw.def.kb * (P.weapon.heavy ? 1.3 : 1) * resist;
      e.kbx += Math.cos(a) * kb; e.kby += Math.sin(a) * kb;
      if (e.ai === 'dummy') e.wob = 1;
      const busy = e.state === 'windup' || e.state === 'attack';
      const disabled = e.state === 'stagger' || e.state === 'stun' || e.state === 'roar';
      if (!disabled && e.ai !== 'dummy' && !(e.armorAtk && busy) && !(busy && e.armorT > 0)) {
        if (AI.flinch(e, S)) {
          e.state = 'hurt'; e.st = 0; e.stunT = sw.def.big ? 0.32 : 0.22; e.queue = []; e.plan = null;
          releaseToken(e);
        }
      }
      fx.stop(crit ? 0.085 : 0.05); fx.shake(crit ? 4 : 2);
      fx.spark(cx, cy, crit ? 16 : 9, crit ? '#ffe48a' : '#fff6c0');
      if (crit) fx.stars(cx, cy, 4);
      sfx('hit');
      fx.text(e.x + U.rand(-6, 6), e.y - e.spriteH - 4, crit ? `${dmg}!` : dmg, crit ? '#ffe048' : '#ffffff', crit ? 12 : 9, { pop: crit ? 1.8 : 1.3 });
      if (crit) fx.text(e.x, e.y - e.spriteH - 16, 'CRIT', '#ffd04a', 7);
      cheer = Math.max(cheer, crit ? 0.9 : 0.45);
      if (hasPerk('second_wind') && !e.dead) {
        P.sta = Math.min(P.maxSta, P.sta + 20);
        const h = Math.min(5, 30 - P.swHeal);
        if (h > 0 && P.hp < P.maxHp) { P.hp = Math.min(P.maxHp, P.hp + h); P.swHeal += h; fx.heal(P.x, P.y, 2); }
      }
      if (tut && tut.stage === 0) { tut.hits++; if (tut.hits >= 2) advanceTut(); }
      if (e.hp <= 0) kill(e);
    }
    function kill(e) {
      e.dead = true; e.state = 'dead'; e.deadT = 0; e.hp = 0;
      releaseToken(e);
      fx.stars(e.x, e.y - e.spriteH / 2, 10, '#ffe48a');
      fx.ring(e.x, e.y - 10, '#ffffff', 30);
      fx.dust(e.x, e.y, 6);
      sfx('thud');
      cheer = 1;
      if (arenaKind === 'pit') sfx('crowd');
      if (!alive().length) {
        fx.slow(0.7, 0.3);
        phase = 'ending'; endT = 1.0; won = true;
        proj.length = 0;
      }
    }

    // ---------------------------------------------------------------- tutorial
    function advanceTut() {
      tut.stage++; tut.t = 0;
      sfx('confirm');
      fx.ring(P.x, P.y - 16, '#9ff59a', 30);
    }

    // ---------------------------------------------------------------- token
    function releaseToken(e) {
      if (token === e) { token = null; tokenCd = alive().length > 1 ? 0.45 : 0.08; }
    }

    // ---------------------------------------------------------------- AI context
    const S = {
      P, enemies, proj,
      get phase() { return phase; },
      packN: enemies.filter((e) => e.ai === 'wolf').length,
      canAttack(e) { return P.state !== 'dead' && (token === e || (!token && tokenCd <= 0)); },
      takeToken(e) { token = e; },
      tokenBusy() { return !!token && !token.dead && (token.state === 'windup' || token.state === 'attack'); },
      poise(e) { fx.text(e.x, e.y - e.spriteH - 8, 'Unflinching!', '#ffb08a', 7); fx.ring(e.x, e.y - 16, '#ffb08a', 22, 0.3); },
      releaseToken,
      sfx,
      dust: (x, y, n) => fx.dust(x, y, n),
      hitPlayer,
      glint(e) {
        e.glint = 0;
        glintSfx(e.mv.col === 'r');
      },
      feint(e) { /* the second glint is the tell */ },
      roar(e) {
        fx.ring(e.x, e.y - 20, '#ff5a3a', 60, 0.6); fx.ring(e.x, e.y - 20, '#ffe48a', 40, 0.5);
        fx.shake(6); sfx('break'); sfx('charge');
        fx.text(e.x, e.y - e.spriteH - 14, 'ENRAGED!', '#ff5a3a', 11, { pop: 2, life: 1.3 });
        const a = U.angle(e.x, e.y, P.x, P.y);
        if (P.state !== 'dead') { P.kbx += Math.cos(a) * 200; P.kby += Math.sin(a) * 200; }
        cheer = 1;
      },
      throwDagger(e) {
        const lead = 0.25;
        const tx = P.x + (P.vx || 0) * lead, ty = P.y - 14 + (P.vy || 0) * lead;
        const sx = e.x + Math.cos(e.ang) * 8, sy = e.y - 18;
        const a = U.angle(sx, sy, tx, ty), v = 160 + e.level * 3;
        proj.push({ x: sx, y: sy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, owner: e, life: 2.2, rot: 0, mv: { mult: 0.8, col: 'w', kb: 60 } });
        sfx('swing');
      },
      slamFx(e) {
        const mv = e.mv;
        const cx = e.x + Math.cos(e.ang) * mv.fwd, cy = e.y + Math.sin(e.ang) * mv.fwd;
        fx.ring(cx, cy, '#ffd08a', mv.reach + 6, 0.4);
        fx.dust(cx, cy, 10);
        fx.shake(5); sfx('thud');
      },
      wallStun(e) {
        e.state = 'stun'; e.st = 0; e.stunT = 1.7; e.open = true; e.queue = [];
        releaseToken(e);
        fx.shake(5); fx.stop(0.06); sfx('thud'); sfx('break');
        fx.dust(e.x, e.y, 8); fx.stars(e.x, e.y - 20, 5);
        fx.text(e.x, e.y - e.spriteH - 10, 'Stunned!', '#ffe48a', 9, { pop: 1.6 });
        cheer = 1;
      },
    };

    // ---------------------------------------------------------------- input
    function processInput() {
      const fight = phase === 'fight';
      for (const ev of G.input.events) {
        if (ev.type === 'down' && ev.zone === 'R') {
          if (inRect(ev, BTN.run) || inRect(ev, BTN.potion)) continue;
          if (P.press) continue;
          P.press = { id: ev.id, rt0: RT, t0: T, mode: 'pending', neutral: (P.state === 'free' || P.state === 'block') && RT - P.lastStrike > 0.3 };
        } else if (ev.type === 'flick' && ev.zone === 'R' && P.press && ev.id === P.press.id) {
          P.press.mode = 'flick';
          if (fight) tryDodge(ev.dx, ev.dy);
        } else if (ev.type === 'up' && P.press && ev.id === P.press.id) {
          const pr = P.press; P.press = null;
          if (!fight) continue;
          const quick = RT - pr.rt0 < TAP_MAX && ev.dist < TAP_DIST && !ev.flicked && pr.mode !== 'flick';
          if (pr.mode === 'pending' && quick) tapStrike();
          else if (pr.mode === 'hold') {
            // a slow tap (150-260 ms) is still a strike, unless the guard just soaked a hit
            if (quick && !pr.absorbed && !P.keyB) { if (P.state === 'block') { P.state = 'free'; P.st = 0; } tapStrike(); }
            else releaseHold(RT - pr.rt0);
          }
        } else if (ev.type === 'key') {
          if (ev.key === 'b' && !ev.down) {
            if (P.keyB) { P.keyB = false; releaseHold(RT - P.keyBrt); }
            continue;
          }
          if (!fight || !ev.down) continue;
          if (ev.key === 'a') tapStrike();
          else if (ev.key === 'b') { P.keyB = true; P.keyBrt = RT; wantBlock(T); }
          else if (ev.key === 'c') {
            const s = G.input.stick;
            if (s.mag > 0.3) tryDodge(s.x, s.y); else tryDodge(-Math.cos(P.ang), -Math.sin(P.ang));
          } else if (ev.key === 'menu') tryFlee();
        }
      }
      // the finger vanished without an 'up' (focus lost, pointer cancelled): let go quietly
      if (P.press && !G.input.rHold()) P.press = null;
      if (P.keyB && !G.input.down('b')) P.keyB = false;
      if (P.press && P.press.mode === 'pending' && RT - P.press.rt0 >= HOLD_T) {
        P.press.mode = 'hold';
        if (fight) wantBlock(P.press.t0);
      }
      const pk = G.input.keyDown('KeyQ') || G.input.keyDown('KeyH');
      if (pk && !potionKeyPrev) tryPotion();
      potionKeyPrev = pk;
      if (fight) {
        if (BTN.potion && G.input.consumeTap(BTN.potion)) tryPotion();
        if (BTN.run && G.input.consumeTap(BTN.run)) tryFlee();
      }
    }

    // ---------------------------------------------------------------- player update
    function updatePlayer(dt) {
      P.st += dt;
      P.iframes -= dt; P.flash -= dt; P.staFlash -= dt; P.parryGlow -= dt; P.guardShine -= dt;
      if (P.comboT > 0) P.comboT -= dt;
      if (P.state === 'dead') { P.vx = P.vy = 0; return; }
      // stamina
      if (P.staDelay > 0) P.staDelay -= dt;
      else P.sta = Math.min(P.maxSta, P.sta + (P.state === 'block' ? 14 : 42) * dt);

      const s = G.input.stick;
      const busyUI = G.ui.busy();
      const mx = busyUI || phase !== 'fight' ? 0 : s.x, my = busyUI || phase !== 'fight' ? 0 : s.y;
      const mag = Math.hypot(mx, my);
      let speed = 0;
      switch (P.state) {
        case 'free': speed = P.spd; break;
        case 'block': speed = P.spd * 0.42; break;
        case 'swing': speed = P.sw.ph === 'rec' ? P.spd * 0.35 : P.spd * 0.15; break;
        case 'drink': speed = P.spd * 0.3; break;
        default: speed = 0;
      }
      P.vx = mx * speed; P.vy = my * speed;
      P.moving = mag > 0.15 && speed > 0;
      if (P.moving) {
        const before = Math.floor(P.walkD / 12);
        P.walkD += Math.hypot(P.vx, P.vy) * dt;
        if (Math.floor(P.walkD / 12) !== before && P.state === 'free' && Math.random() < 0.5) fx.dust(P.x, P.y, 1);
      }

      // facing (free 360° aim + soft lock-on)
      const tgt = nearest(130, true);
      let want = null, rate = 14;
      if (P.state === 'free' || P.state === 'drink') {
        if (P.moving) {
          const ma = Math.atan2(my, mx);
          want = ma;
          if (tgt) {
            const ta = U.angle(P.x, P.y, tgt.x, tgt.y);
            if (Math.abs(U.angleDiff(ma, ta)) < 1.6 && U.dist(P.x, P.y, tgt.x, tgt.y) < 95) want = ta;
          }
        } else if (tgt) want = U.angle(P.x, P.y, tgt.x, tgt.y);
      } else if (P.state === 'block') {
        if (tgt) want = U.angle(P.x, P.y, tgt.x, tgt.y);
        else if (P.moving) want = Math.atan2(my, mx);
        rate = 10;
      } else if (P.state === 'swing' && P.sw.ph === 'wind' && !P.sw.spin) {
        const t2 = nearest((P.weapon.reach || 20) * 2.6, false);
        if (t2) { want = U.angle(P.x, P.y, t2.x, t2.y); rate = 25; }
      }
      if (want != null) P.ang += U.clamp(U.angleDiff(P.ang, want), -rate * dt, rate * dt);

      switch (P.state) {
        case 'swing': updateSwing(dt); break;
        case 'block':
          if (tut && tut.stage === 1) { tut.blockT += dt; if (tut.blockT > 0.5) advanceTut(); }
          if (!holding()) { P.state = 'free'; P.st = 0; }
          break;
        case 'dodge': {
          const d = P.dodge, k = P.st / d.dur;
          const v = 215 * Math.max(0, 1 - k * k);
          P.vx = d.dx * v; P.vy = d.dy * v;
          if (P.iframes <= 0 && P.dodgeIF) P.dodgeIF = false;
          if (P.st >= d.dur) { P.dodgedShown = false; toFree(); }
          break;
        }
        case 'hurt': case 'stagger': case 'drink':
          if (P.st >= P.stunT) toFree();
          break;
      }
      if (P.state === 'free') {
        if (P.blockQueued && holding()) startBlock(T);
        else if (holding() && P.st > 0) startBlock(T);
      }
    }
    function toFree() {
      P.state = 'free'; P.st = 0;
      if (holding()) { startBlock(T); return; }
      if (P.bufDodge && RT - P.bufDodge.t < 0.25) { const b = P.bufDodge; P.bufDodge = null; tryDodge(b.dx, b.dy); return; }
      if (RT - P.bufStrike < 0.25) { P.bufStrike = -9; startSwing(P.comboT > 0 ? P.combo : 0); }
    }
    function updateSwing(dt) {
      const sw = P.sw;
      sw.t += dt;
      if (sw.ph === 'wind') {
        if (sw.t >= sw.wind) {
          sw.ph = 'act'; sw.t = 0;
          sfx('swing');
          if (sw.def.lunge) { P.kbx += Math.cos(P.ang) * sw.def.lunge; P.kby += Math.sin(P.ang) * sw.def.lunge; }
        }
      } else if (sw.ph === 'act') {
        checkHits(sw);
        if (sw.t >= sw.act) { sw.ph = 'rec'; sw.t = 0; }
      } else {
        if (sw.buf && !sw.spin && sw.i < 2 && sw.t >= sw.rec * 0.3) { startSwing(sw.i + 1); return; }
        if (sw.t >= sw.rec) {
          const next = sw.spin ? 0 : (sw.i + 1) % 3;
          P.state = 'free'; P.st = 0; P.sw = null;
          P.combo = next; P.comboT = sw.i < 2 && !sw.spin ? 0.3 : 0;
          if (sw.buf) { startSwing(sw.spin ? 0 : next); return; }
          toFree();
        }
      }
    }
    function checkHits(sw) {
      const reach = (P.weapon.reach || 20) + 8 + (sw.def.big ? 4 : 0);
      for (const e of enemies) {
        if (e.dead || sw.hit.has(e)) continue;
        const d = U.dist(P.x, P.y, e.x, e.y);
        if (d > reach + e.r) continue;
        if (!sw.spin && d > e.r + 6 && Math.abs(U.angleDiff(P.ang, U.angle(P.x, P.y, e.x, e.y))) > sw.def.arc) continue;
        sw.hit.add(e);
        hitEnemy(e, sw);
        if (P.state !== 'swing') return; // got parried
      }
    }

    // ---------------------------------------------------------------- world update
    function separate() {
      const list = [P, ...enemies.filter((e) => !e.dead)];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a === P && P.state === 'dodge') continue;
        if ((a.mv && a.mv.dash && a.state === 'attack') || (b.mv && b.mv.dash && b.state === 'attack')) continue;
        const min = (a.sep || a.r) + (b.sep || b.r);
        const dx = b.x - a.x, dy = (b.y - a.y) * 1.5;
        const d = Math.hypot(dx, dy);
        if (d >= min || d === 0) continue;
        const push = (min - d) / d;
        const wa = a === P ? 0.3 : 0.5, wb = 1 - wa;
        a.x -= dx * push * wa; a.y -= (dy / 1.5) * push * wa;
        b.x += dx * push * wb; b.y += (dy / 1.5) * push * wb;
      }
    }
    function integrate(f, dt) {
      f.x += (f.vx + f.kbx) * dt;
      f.y += (f.vy + f.kby) * dt;
      const k = Math.exp(-9 * dt);
      f.kbx *= k; f.kby *= k;
      if (Math.abs(f.kbx) < 1) f.kbx = 0;
      if (Math.abs(f.kby) < 1) f.kby = 0;
      clampArena(f);
    }
    function updateProj(dt) {
      for (let i = proj.length - 1; i >= 0; i--) {
        const p = proj[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += 22 * dt; p.life -= dt;
        let gone = p.life <= 0 || p.x < F.x0 || p.x > F.x1 || p.y < F.y0 - 30 || p.y > F.y1;
        if (!gone && !p.reflected) {
          if (U.dist(p.x, p.y, P.x, P.y - 14) < P.r + 5) {
            const res = hitPlayer(p.owner, p.mv, p.x - p.vx * 0.05, p.y - p.vy * 0.05 + 14, true);
            if (res === 'parry') {
              p.reflected = true;
              const o = p.owner, a = o && !o.dead ? U.angle(p.x, p.y, o.x, o.y - 14) : Math.atan2(-p.vy, -p.vx);
              const v = Math.hypot(p.vx, p.vy) * 1.4;
              p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v; p.life = 1.5;
              fx.text(P.x, P.y - 44, 'Deflected!', '#ffe48a', 8);
            } else if (res !== 'miss') gone = true;
          }
        } else if (!gone) {
          for (const e of enemies) {
            if (e.dead) continue;
            if (U.dist(p.x, p.y, e.x, e.y - 14) < e.r + 6) {
              hitEnemy(e, { i: 0, def: { mult: 1.4, kb: 120, big: true }, hit: new Set(), noDefend: true });
              gone = true; break;
            }
          }
        }
        if (gone) { if (p.life > 0) fx.spark(p.x, p.y, 4, '#d8dce6', 60); proj.splice(i, 1); }
      }
    }
    function updateParts(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        if (p.t < 0) continue;
        if (p.vx != null) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          const k = Math.exp(-(p.k === 'spark' ? 5 : 3) * dt);
          p.vx *= k; p.vy *= k;
          if (p.k === 'star') p.vy += 80 * dt;
        }
      }
      if (parts.length > 400) parts.splice(0, parts.length - 400);
      for (let i = texts.length - 1; i >= 0; i--) {
        const t = texts[i];
        t.t += dt; t.y += t.vy * dt; t.vy *= Math.exp(-3 * dt);
        if (t.t >= t.life) texts.splice(i, 1);
      }
    }

    function finish() {
      if (finished) return;
      finished = true;
      const hp = won || fled ? Math.max(1, Math.round(P.hp)) : opts.noDeath ? 1 : 0;
      done({ won, fled, hp });
    }

    function update(rdt) {
      RT += rdt;
      if (!W || W !== G.W || H !== G.H) layout();
      if (G.ui.busy()) { updateParts(rdt); return; }

      if (phase === 'talk') return;
      processInput();
      shakeA = Math.max(0, shakeA - rdt * 22);
      flashW = Math.max(0, flashW - rdt * 2.2);
      vign = Math.max(0, vign - rdt * 1.6);
      cheer = Math.max(0, cheer - rdt * 0.8);

      if (phase === 'intro') {
        pt += rdt;
        if (pt > G.BUI.INTRO_T || (pt > G.BUI.INTRO_SKIP && (G.input.anyTap() || G.input.pressed('a')))) {
          G.input.consumeAllTaps();
          phase = 'fight'; pt = 0; fightBanner = 0.9;
          sfx('clang');
          if (arenaKind === 'pit') sfx('crowd');
          cheer = 1;
        }
        updateParts(rdt);
        return;
      }

      if (hitstop > 0) { hitstop -= rdt; return; }
      let k = 1;
      if (slowT > 0) { slowT -= rdt; k = slowK; }
      const dt = rdt * k;
      T += dt;
      if (fightBanner > 0) fightBanner -= rdt;
      if (phase === 'fight' && hintT > 0) hintT -= rdt;
      if (tokenCd > 0) tokenCd -= dt;
      if (token && token.dead) token = null;
      if (tut) tut.t += rdt;

      updatePlayer(dt);
      if (phase === 'flee') {
        pt += rdt;
        const ex = H >= W ? 0 : -1, ey = H >= W ? 1 : 0;
        P.x += ex * 160 * dt; P.y += ey * 160 * dt; P.walkD += 160 * dt; P.moving = true;
        P.ang = Math.atan2(ey, ex);
        if (pt > 0.9) finish();
      } else integrate(P, dt);

      S.packN = enemies.filter((e) => e.ai === 'wolf' && !e.dead).length;
      let wiA = 0;
      for (const e of enemies) {
        if (e.dead) { e.deadT += dt; continue; }
        if (e.ai === 'wolf') e.packI = wiA++;
        e.flash -= dt; e.invuln -= dt;
        e.wob *= Math.exp(-3 * dt);
        AI.update(e, dt, S);
        const sp = Math.hypot(e.vx, e.vy);
        e.moving = sp > 5;
        e.walkD += sp * dt;
        integrate(e, dt);
        e.hpShow += (e.hp - e.hpShow) * Math.min(1, dt * 6);
      }
      separate();
      updateProj(dt);
      updateParts(dt);
      P.hpShow += (P.hp - P.hpShow) * Math.min(1, dt * 8);
      if (P.hpGhost > P.hp) P.hpGhost = Math.max(P.hp, P.hpGhost - dt * P.maxHp * 0.35); else P.hpGhost = P.hp;

      if (phase === 'ending') {
        endT -= rdt;
        if (endT <= 0) {
          phase = 'outro'; pt = 0;
          if (won) { sfx('win'); G.music.play('victory'); P.state = 'victory'; P.st = 0; cheer = 1; fx.stars(P.x, P.y - 30, 14); }
          else sfx('lose');
        }
      } else if (phase === 'outro') {
        pt += rdt;
        if (won && Math.random() < rdt * 6) fx.stars(U.rand(0, W), U.rand(H * 0.25, H * 0.45), 1, U.pick(['#ffe48a', '#ffffff', '#9fd8ff']));
        if (pt > G.BUI.OUTRO_T || (pt > G.BUI.OUTRO_SKIP && (G.input.anyTap() || G.input.pressed('a')))) finish();
      }
    }

    // ---------------------------------------------------------------- drawing
    function swingOffset(sw) {
      const d = sw.def;
      if (sw.ph === 'wind') return U.lerp(REST, d.from, U.ease.outQuad(Math.min(1, sw.t / sw.wind)));
      if (sw.ph === 'act') return U.lerp(d.from, d.to, U.ease.outQuad(Math.min(1, sw.t / sw.act)));
      return U.lerp(d.to, REST, U.ease.inOut(Math.min(1, sw.t / sw.rec)));
    }
    function enemyOffset(e) {
      const mv = e.mv;
      if (!mv) return REST;
      if (e.state === 'windup') {
        const k = U.ease.outQuad(Math.min(1, e.st / e.wind));
        if (mv.thrust) return U.lerp(REST, -0.15, k);
        return U.lerp(REST, mv.from ?? REST, k);
      }
      if (e.state === 'attack') {
        if (mv.thrust) return 0;
        return U.lerp(mv.from ?? REST, mv.to ?? REST, U.ease.outQuad(Math.min(1, e.st / mv.act)));
      }
      if (e.state === 'recover') {
        const from = mv.thrust ? 0 : (mv.to ?? REST);
        return U.lerp(from, REST, Math.min(1, e.st / 0.25));
      }
      return REST;
    }
    function drawTrail(ctx, px, py, len, a0, a1, alpha, col) {
      if (alpha <= 0.02 || Math.abs(a1 - a0) < 0.05) return;
      ctx.save();
      ctx.translate(px, py); ctx.scale(1, 0.78);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      const ro = len + 7, ri = len * 0.35;
      const ccw = a1 < a0;
      ctx.beginPath();
      ctx.arc(0, 0, ro, a0, a1, ccw);
      ctx.arc(0, 0, ri, a1, a0, !ccw);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = alpha * 0.9;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, ro - 1, a0 + (a1 - a0) * 0.4, a1, ccw); ctx.stroke();
      ctx.restore();
    }
    function drawWeaponAt(ctx, w, px, py, ang, o) {
      ctx.save();
      ctx.translate(px, py); ctx.scale(1, 0.8);
      art.weapon(ctx, w, 0, 0, ang, o);
      ctx.restore();
    }

    // Generic armed human (player or enemy).
    function drawHuman(ctx, f, look, o) {
      const ang = f.ang;
      const ca = Math.cos(ang), sa = Math.sin(ang);
      const cy = f.y - 17;
      const rh = ang + PI / 2, lh = ang - PI / 2;
      const rhx = f.x + Math.cos(rh) * 6 + ca * 2, rhy = cy + 3 + Math.sin(rh) * 4 + sa * 2;
      const raised = o.shieldUp;
      const shx = raised ? f.x + ca * 9 + Math.cos(lh) * 1 : f.x + Math.cos(lh) * 7 + ca * 1;
      const shy = raised ? cy + 2 + sa * 6 : cy + 4 + Math.sin(lh) * 4;
      const wa = ang + (o.wOff ?? REST);
      const items = [];
      if (o.weapon) items.push({ y: rhy - (Math.sin(wa) < -0.5 ? 3 : 0), fn: () => {
        if (o.trail) drawTrail(ctx, rhx, rhy, o.weapon.len, ang + o.trail[0], ang + o.trail[1], o.trail[2], o.trail[3]);
        drawWeaponAt(ctx, o.weapon, rhx, rhy, wa, { glow: o.glow });
      } });
      if (o.shield) items.push({ y: shy - (raised ? 0 : 1), fn: () => art.shield(ctx, o.shield, shx, shy, ang, raised) });
      const body = () => {
        const dir = dirOf(ang);
        const frame = f.moving ? [1, 0, 2, 0][Math.floor(f.walkD / 7) & 3] : 0;
        if (o.rot) {
          ctx.save();
          ctx.translate(Math.round(f.x), Math.round(f.y - 18));
          ctx.rotate(o.rot);
          G.chars.draw(ctx, look, dir, frame, 0, 18, 2, { shadow: false, alpha: o.alpha });
          if (o.flash) { ctx.globalAlpha = o.flashA ?? 1; G.chars.draw(ctx, look, dir, frame, 0, 18, 2, { shadow: false, flash: o.flash }); }
          ctx.restore();
        } else {
          G.chars.draw(ctx, look, dir, frame, f.x, f.y + (o.bob || 0), 2, { shadow: false, alpha: o.alpha });
          if (o.flash) {
            ctx.globalAlpha = o.flashA ?? 1;
            G.chars.draw(ctx, look, dir, frame, f.x, f.y + (o.bob || 0), 2, { shadow: false, flash: o.flash });
            ctx.globalAlpha = 1;
          }
        }
      };
      if (o.alpha != null) ctx.globalAlpha = o.alpha;
      for (const it of items) if (it.y < cy + 1) it.fn();
      body();
      if (o.alpha != null) ctx.globalAlpha = o.alpha;
      for (const it of items) if (it.y >= cy + 1) it.fn();
      ctx.globalAlpha = 1;
    }

    function telegraphFlash(e) {
      if (e.state !== 'windup') return null;
      const k = Math.min(1, e.st / e.wind);
      const col = e.mv.col === 'r' ? '#ff3b30' : '#ffffff';
      const a = k > 0.65 ? (Math.sin(RT * 42) > 0 ? 0.85 : 0.3) : 0.15 + 0.45 * k;
      return { col, a };
    }

    function drawPlayer(ctx) {
      const sw = P.sw;
      const o = { weapon: P.wvis, shield: P.svis, shieldUp: P.state === 'block' };
      if (P.state === 'dead') {
        G.draw.shadow(P.x, P.y - 2, 26);
        drawHuman(ctx, P, P.look, { rot: PI / 2 * Math.min(1, P.st * 4), weapon: null, shield: null });
        return;
      }
      G.draw.shadow(P.x, P.y - 2, 22);
      if (P.state === 'swing') {
        let off = swingOffset(sw);
        if (sw.spin) {
          const k = sw.ph === 'act' ? Math.min(1, sw.t / sw.act) : sw.ph === 'rec' ? 1 : 0;
          off = REST + U.ease.outQuad(k) * TAU;
          if (sw.ph === 'act') o.trail = [off - 2.2, off, 0.55, '#ffe48a'];
        } else if (sw.ph === 'act' || (sw.ph === 'rec' && sw.t < 0.08)) {
          const fade = sw.ph === 'act' ? 0.6 : 0.6 * (1 - sw.t / 0.08);
          o.trail = [sw.def.from, off, fade, sw.def.big ? '#ffe48a' : '#ffffff'];
        }
        o.wOff = off;
        o.glow = sw.def.big && sw.ph !== 'rec' ? 'rgba(255,228,138,0.35)' : null;
      } else if (P.state === 'block') o.wOff = 2.1;
      else if (P.press && P.press.mode === 'pending' && phase === 'fight' && P.state === 'free') o.wOff = U.lerp(REST, 1.6, Math.min(1, (RT - P.press.rt0) / HOLD_T));
      else if (P.state === 'drink') o.wOff = 1.9;
      else if (P.state === 'victory') { o.wOff = U.angleDiff(P.ang, -PI / 2 - 0.3); o.bob = -Math.abs(Math.sin(P.st * 6)) * 3; }
      if (P.state === 'dodge') {
        const k = Math.min(1, P.st / P.dodge.dur);
        o.rot = (P.dodge.dx >= 0 ? 1 : -1) * k * TAU;
        o.weapon = null; o.shield = null;
        if (P.iframes > 0) o.alpha = 0.75;
      }
      if (P.state === 'stagger') o.rot = Math.sin(P.st * 30) * 0.12;
      if (P.flash > 0) { o.flash = '#ffffff'; o.flashA = 0.9; }
      else if (P.parryGlow > 0) { o.flash = '#ffe48a'; o.flashA = P.parryGlow; }
      else if (P.iframes > 0 && P.state !== 'dodge' && Math.sin(RT * 40) > 0) o.alpha = 0.55;
      // whirlwind charge glow
      const holdDur = P.press && P.press.mode === 'hold' ? RT - P.press.rt0 : P.keyB ? RT - P.keyBrt : 0;
      if (hasPerk('whirlwind') && holdDur >= WHIRL_T && P.state === 'block') {
        const pulse = 0.5 + 0.5 * Math.sin(RT * 14);
        ctx.strokeStyle = `rgba(255,228,138,${0.4 + pulse * 0.4})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(P.x, P.y - 2, 18 + pulse * 3, 7 + pulse, 0, 0, TAU); ctx.stroke();
        o.glow = 'rgba(255,228,138,0.45)';
      }
      if (P.state === 'flee' || phase === 'flee') o.alpha = Math.max(0, 1 - pt * 1.2);
      drawHuman(ctx, P, P.look, o);
      if (P.state === 'drink') {
        const bx = P.x + Math.cos(P.ang - 0.6) * 6, by = P.y - 26;
        D.rect(bx - 2, by - 3, 4, 5, '#21160f'); D.rect(bx - 1.5, by - 2.5, 3, 4, '#e0473c'); D.rect(bx - 0.5, by - 5, 1, 2, '#c9a36a');
      }
      // parry window shine on the shield right after raising it
      if (P.state === 'block' && P.guardShine > 0) {
        const sp = shieldPoint();
        art.star(ctx, sp.x + 3, sp.y - 5, 3 + P.guardShine * 12, 'rgba(255,255,255,0.9)', RT * 6);
      }
    }

    function drawEnemy(ctx, e) {
      const fl = telegraphFlash(e);
      let flash = null, flashA = 1;
      if (e.flash > 0) flash = '#ffffff';
      else if (fl) { flash = fl.col; flashA = fl.a; }
      else if (e.open && Math.sin(RT * 10) > 0.3) { flash = '#ffe48a'; flashA = 0.35; }
      let alpha = null;
      if (e.dead) alpha = Math.max(0, 1 - e.deadT / 0.9);
      if (alpha === 0) return;
      if (e.kind) {
        let pose = 'idle';
        if (e.state === 'windup') pose = 'windup';
        else if (e.state === 'attack') pose = e.kind === 'troll' ? 'idle' : 'attack';
        else if (e.state === 'stun' || e.state === 'stagger' || e.dead) pose = 'stun';
        else if (e.moving) pose = 'walk';
        const frame = Math.floor(e.walkD / 6);
        let rot = 0;
        if (e.ai === 'dummy') rot = Math.sin(RT * 18) * e.wob * 0.35;
        if (e.dead && e.kind !== 'dummy') rot = (Math.cos(e.ang) < 0 ? -1 : 1) * Math.min(1, e.deadT * 4) * PI / 2;
        if (e.dead && e.kind === 'dummy') rot = Math.min(1, e.deadT * 3) * PI / 2;
        if (e.kind === 'troll' && e.wvis) {
          // troll swings a big club
          const off = enemyOffset(e);
          const cy = e.y - 30;
          const hx = e.x + Math.cos(e.ang + PI / 2) * 13, hy = cy + 6 + Math.sin(e.ang + PI / 2) * 6;
          const draw = () => { if (!e.dead) drawWeaponAt(ctx, e.wvis, hx, hy, e.ang + off, {}); };
          if (hy < cy) draw();
          art.creature(ctx, e.kind, e.x, e.y, { ang: e.ang, pose, frame, flash, flashA, alpha, rot });
          if (hy >= cy) draw();
        } else art.creature(ctx, e.kind, e.x, e.y + (pose === 'attack' && e.mv && e.mv.dash ? -3 : 0), { ang: e.ang, pose, frame, flash, flashA, alpha, rot });
        return;
      }
      G.draw.shadow(e.x, e.y - 2, 22, e.dead ? 0.28 * alpha : 0.28);
      const o = {
        weapon: e.dead ? null : e.wvis, shield: e.dead ? null : e.svis, flash, flashA, alpha,
        shieldUp: e.state === 'guard' || (e.guardUp && e.state === 'idle' && e.ai === 'knight'),
        wOff: enemyOffset(e),
      };
      if (e.state === 'attack' && e.mv && !e.mv.thrust && !e.mv.bash) {
        const mv = e.mv;
        o.trail = [mv.from, o.wOff, 0.55, mv.col === 'r' ? '#ff6a5a' : '#ffffff'];
      }
      if (e.state === 'windup' && e.mv && e.mv.bash) o.shieldUp = true;
      if (e.state === 'attack' && e.mv && e.mv.bash) o.shieldUp = true;
      if (e.dead) o.rot = (Math.cos(e.ang) < 0 ? -1 : 1) * Math.min(1, e.deadT * 4) * PI / 2;
      else if (e.state === 'stagger' || e.state === 'stun') o.rot = Math.sin(RT * 16) * 0.12;
      else if (e.state === 'roar') o.bob = -Math.abs(Math.sin(e.st * 20)) * 2;
      drawHuman(ctx, e, e.look, o);
    }

    function drawGroundTelegraphs(ctx) {
      for (const e of enemies) {
        if (e.dead || !e.mv || e.mv.col !== 'r') continue;
        if (e.state !== 'windup' && !(e.state === 'attack' && e.mv.charge)) continue;
        const mv = e.mv;
        const k = e.state === 'windup' ? Math.min(1, e.st / e.wind) : 1;
        const pulse = 0.5 + 0.5 * Math.sin(RT * 20);
        ctx.save();
        if (mv.charge) {
          const a = e.dashAng ?? e.ang;
          ctx.translate(e.x, e.y); ctx.rotate(a);
          const len = 260 * Math.min(1, k * 1.4);
          ctx.fillStyle = `rgba(255,50,40,${0.12 + 0.12 * k})`;
          ctx.fillRect(0, -e.r, len, e.r * 2);
          ctx.fillStyle = `rgba(255,80,60,${0.35 + 0.3 * pulse})`;
          for (let s = 14; s < len; s += 16) { ctx.beginPath(); ctx.moveTo(s, -5); ctx.lineTo(s + 6, 0); ctx.lineTo(s, 5); ctx.lineTo(s + 2, 0); ctx.fill(); }
        } else {
          const cx = mv.slam ? e.x + Math.cos(e.ang) * mv.fwd : e.x, cy = mv.slam ? e.y + Math.sin(e.ang) * mv.fwd : e.y;
          const R = mv.reach + (mv.slam ? 4 : 8);
          ctx.translate(cx, cy); ctx.scale(1, 0.62);
          ctx.fillStyle = `rgba(255,40,30,${0.1 + 0.16 * k})`;
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
          ctx.strokeStyle = `rgba(255,70,50,${0.5 + 0.4 * pulse})`; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke();
          ctx.fillStyle = 'rgba(255,90,60,0.22)';
          ctx.beginPath(); ctx.arc(0, 0, R * k, 0, TAU); ctx.fill();
        }
        ctx.restore();
      }
    }

    function drawOverheads(ctx) {
      for (const e of enemies) {
        if (e.dead) continue;
        const top = e.y - e.spriteH - 2;
        // glint "!"
        if (e.state === 'windup') {
          const red = e.mv.col === 'r';
          const pop = 1 + Math.max(0, 0.22 - e.glint) * 4;
          const gy = top - 9;
          if (e.glint < 0.3) art.star(ctx, e.x, gy + 2, 9 * (1 - e.glint / 0.3) + 2, red ? 'rgba(255,90,60,0.9)' : 'rgba(255,255,255,0.95)', RT * 5);
          D.text(red ? '!!' : '!', e.x, gy - 4 * pop + 4, { size: Math.round(11 * pop), align: 'center', baseline: 'middle', bold: true, color: red ? '#ff4a3a' : '#ffffff', outline: red ? '#3a0a08' : '#21160f', outlineW: 3 });
        }
        // stun stars
        if (e.state === 'stagger' || e.state === 'stun') {
          for (let i = 0; i < 3; i++) {
            const a = RT * 5 + (i * TAU) / 3;
            art.star(ctx, e.x + Math.cos(a) * 9, top + 2 + Math.sin(a) * 3, 2.5, '#ffe48a', RT * 4);
          }
          if (e.open && Math.sin(RT * 8) > -0.3) D.text('OPEN!', e.x, top - 12, { size: 7, align: 'center', bold: true, color: '#ffe48a', outline: '#3a2a10', outlineW: 2 });
        }
        if (e === boss) continue;
        // hp bar
        const bw = Math.max(20, Math.min(30, e.r * 2.6));
        const bx = Math.round(e.x - bw / 2), by = Math.round(top - 3);
        D.rect(bx - 1, by - 1, bw + 2, 4, '#1a120c');
        D.rect(bx, by, bw, 2, '#3a2a20');
        D.rect(bx, by, bw * U.clamp(e.hpShow / e.maxHp, 0, 1), 2, '#f2c14e');
        D.rect(bx, by, bw * U.clamp(e.hp / e.maxHp, 0, 1), 2, '#e0473c');
        if (e.guardPts > 0 && e.blockCh > 0) for (let i = 0; i < e.guardPts; i++) D.rect(bx + i * 4, by + 3, 3, 1.5, '#9fd8ff');
      }
    }

    function drawParts(ctx) {
      for (const p of parts) {
        if (p.t < 0) continue;
        const k = p.t / p.life;
        switch (p.k) {
          case 'spark':
            ctx.globalAlpha = 1 - k * 0.6;
            D.line(p.x, p.y, p.x - p.vx * 0.03, p.y - p.vy * 0.03, p.c, 1.4);
            break;
          case 'star':
            ctx.globalAlpha = 1 - k;
            art.star(ctx, p.x, p.y, p.s * (1 - k * 0.5), p.c, p.rot + p.t * 8);
            break;
          case 'dust':
            ctx.globalAlpha = 0.55 * (1 - k);
            D.circle(p.x, p.y, p.s * (1 + k * 1.5), '#e8dcc0');
            break;
          case 'ring':
            ctx.globalAlpha = 1 - k;
            ctx.save(); ctx.translate(p.x, p.y); ctx.scale(1, 0.75);
            D.circle(0, 0, p.s * U.ease.outQuad(k), null, p.c, 2 * (1 - k) + 0.5);
            ctx.restore();
            break;
          case 'heal':
            ctx.globalAlpha = 1 - k;
            D.rect(p.x - 1.5, p.y - 0.5, 3, 1, p.c); D.rect(p.x - 0.5, p.y - 1.5, 1, 3, p.c);
            break;
        }
      }
      ctx.globalAlpha = 1;
      for (const p of proj) {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        D.rect(-5, -1.5, 10, 3, '#21160f'); D.rect(-4, -0.8, 6, 1.6, '#d8dce6'); D.rect(2, -0.8, 2, 1.6, '#6a4a2a');
        ctx.restore();
        D.shadow(p.x, p.y + 14, 6, 0.2);
      }
    }
    function drawTexts(ctx) {
      for (const t of texts) {
        const k = t.t / t.life;
        const s = t.pop > 1 ? 1 + (t.pop - 1) * Math.max(0, 1 - t.t / 0.12) : 1;
        ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        D.text(t.s, t.x, t.y, { size: Math.round(t.size * s), align: 'center', baseline: 'middle', bold: true, color: t.col, outline: '#1a0f08', outlineW: Math.max(2, t.size / 3.5) });
      }
      ctx.globalAlpha = 1;
    }

    function drawHUD(ctx) {
      // potion button
      const b = BTN.potion, n = potionCount();
      const usable = n > 0 && P.hp < P.maxHp && phase === 'fight' && (P.state === 'free' || P.state === 'block');
      const pressed = G.input.pointerIn(b);
      D.rrect(b.x, b.y + 2, b.w, b.h, 4, 'rgba(0,0,0,0.45)');
      D.rrect(b.x, b.y + (pressed ? 1 : 0), b.w, b.h, 4, usable ? '#7a4630' : '#4a3a32', '#21160f', 1);
      D.rrect(b.x + 2, b.y + 1 + (pressed ? 1 : 0), b.w - 4, 6, 3, 'rgba(255,255,255,0.12)');
      const fx0 = b.x + b.w / 2 - 2, fy0 = b.y + 4 + (pressed ? 1 : 0);
      ctx.globalAlpha = n > 0 ? 1 : 0.45;
      D.rect(fx0, fy0, 5, 3, '#c9a36a'); D.rect(fx0 + 1, fy0 + 3, 3, 2, '#e8e0d0');
      D.circle(fx0 + 2.5, fy0 + 10, 5.5, '#21160f'); D.circle(fx0 + 2.5, fy0 + 10, 4.5, '#e8e0d0'); D.circle(fx0 + 2.5, fy0 + 11, 3.6, '#e0473c');
      D.rect(fx0 + 0.5, fy0 + 8, 1.5, 1.5, '#ffd0c8');
      ctx.globalAlpha = 1;
      D.text(String(n), b.x + b.w - 2, b.y + b.h - 1, { size: 7, align: 'right', baseline: 'bottom', bold: true, color: '#ffffff', outline: '#21160f', outlineW: 2 });

      // player bars
      const x0 = b.x + b.w + 5, w = Math.min(W - x0 - (BTN.run ? 42 : 5), 180);
      const hpF = U.clamp(P.hpShow / P.maxHp, 0, 1);
      D.rect(x0 - 1, 4, w + 2, 9, '#1a120c');
      D.rect(x0, 5, w, 7, '#3a1a14');
      D.rect(x0, 5, Math.round(w * U.clamp(P.hpGhost / P.maxHp, 0, 1)), 7, '#ffe0c0');
      D.rect(x0, 5, Math.round(w * hpF), 7, hpF < 0.25 && Math.sin(RT * 10) > 0 ? '#ff7a5a' : '#e0473c');
      D.rect(x0, 5, Math.round(w * hpF), 2, 'rgba(255,255,255,0.3)');
      D.text(`HP ${Math.max(0, Math.ceil(P.hp))}/${P.maxHp}`, x0 + 3, 8.8, { size: 6, baseline: 'middle', bold: true, color: '#fff', outline: '#1a0f08', outlineW: 1.6 });
      D.text(`Lv${G.state.level}`, x0 + w - 2, 8.8, { size: 6, align: 'right', baseline: 'middle', bold: true, color: '#fff3d6', outline: '#1a0f08', outlineW: 1.6 });
      const sw2 = Math.round(w * 0.8);
      D.rect(x0 - 1, 14, sw2 + 2, 6, '#1a120c');
      D.rect(x0, 15, sw2, 4, '#3a3014');
      D.rect(x0, 15, Math.round(sw2 * U.clamp(P.sta / P.maxSta, 0, 1)), 4, P.staFlash > 0 && Math.sin(RT * 30) > 0 ? '#ff6a3a' : '#f2c14e');
      D.rect(x0, 15, Math.round(sw2 * U.clamp(P.sta / P.maxSta, 0, 1)), 1, 'rgba(255,255,255,0.35)');
      D.text('STA', x0 + sw2 + 3, 17, { size: 5, baseline: 'middle', bold: true, color: '#f2e0a0', outline: '#1a0f08', outlineW: 1.4 });

      // run button
      if (BTN.run) {
        const r = BTN.run, pr = G.input.pointerIn(r);
        const ok = phase === 'fight';
        D.rrect(r.x, r.y + 2, r.w, r.h, 4, 'rgba(0,0,0,0.45)');
        D.rrect(r.x, r.y + (pr ? 1 : 0), r.w, r.h, 4, ok ? '#5a6a7a' : '#4a4a4a', '#21160f', 1);
        D.text('Run', r.x + r.w / 2, r.y + r.h / 2 + (pr ? 1 : 0), { size: 7, align: 'center', baseline: 'middle', bold: true, color: '#fff', shadow: true });
      }

      // boss bar
      if (boss && phase !== 'intro') {
        const bw = Math.min(W - 16, 260), by = H - 11, bx0 = Math.round(W / 2 - bw / 2);
        D.text(boss.name + (boss.title ? ` — ${boss.title}` : ''), bx0, by, { size: 6, bold: true, color: '#ffe0c0', outline: '#1a0f08', outlineW: 1.6, baseline: 'bottom' });
        D.rect(bx0 - 1, by + 1, bw + 2, 6, '#1a120c');
        D.rect(bx0, by + 2, bw, 4, '#3a1a14');
        D.rect(bx0, by + 2, bw * U.clamp(boss.hpShow / boss.maxHp, 0, 1), 4, '#f2c14e');
        D.rect(bx0, by + 2, bw * U.clamp(boss.hp / boss.maxHp, 0, 1), 4, boss.phase2 ? '#b0306a' : '#c0392b');
        D.rect(bx0, by + 2, bw * U.clamp(boss.hp / boss.maxHp, 0, 1), 1, 'rgba(255,255,255,0.3)');
        if (boss.ai === 'champion') D.rect(bx0 + bw / 2, by + 1, 1, 6, 'rgba(0,0,0,0.6)');
      }
    }

    function drawHint(ctx) {
      if (tut && phase === 'fight') {
        const touch = hasTouch();
        const msgs = ['Tap right to strike!', 'Hold right to block', 'Flick right to dodge', 'Now destroy the dummy!'];
        const keys = ['(keyboard: Z)', '(keyboard: hold X)', '(keyboard: C + direction)', ''];
        const m = msgs[Math.min(3, tut.stage)];
        const pop = 1 + Math.max(0, 0.25 - tut.t) * 2;
        const y = H - 44 - (boss ? 12 : 0);
        if (!touch && keys[tut.stage]) D.text(keys[tut.stage], W / 2, y + 17, { size: 6, align: 'center', baseline: 'middle', color: '#fff3d6', outline: '#1a0f08', outlineW: 2 });
        const w = Math.min(W - 16, D.measure(m, 10) + 24);
        D.rrect(W / 2 - w / 2, y - 12, w, 24, 6, 'rgba(25,15,8,0.78)', '#f2c14e', 1);
        D.text(m, W / 2, y, { size: Math.round(10 * pop), align: 'center', baseline: 'middle', bold: true, color: '#ffe48a' });
        if (tut.stage < 3) {
          D.text(`${tut.stage + 1}/3`, W / 2 + w / 2 - 4, y + 8, { size: 5, align: 'right', baseline: 'middle', color: '#c9b48a' });
          if (touch) {
            // hand icon on the right side
            const hx = W * 0.75, hy = y - 34 + Math.sin(RT * 6) * 2;
            const press = tut.stage === 0 ? (RT % 0.8 < 0.2) : tut.stage === 1;
            const fl = tut.stage === 2 ? ((RT * 1.5) % 1) * 18 : 0;
            D.circle(hx + fl, hy, press ? 7 : 5, null, 'rgba(255,255,255,0.7)', 1.5);
            D.circle(hx + fl, hy, 3, 'rgba(255,255,255,0.85)');
            if (tut.stage === 2) D.line(hx, hy, hx + fl, hy, 'rgba(255,255,255,0.5)', 2);
          }
        }
        return;
      }
      if (hintT <= 0 || phase !== 'fight') return;
      G.BUI.drawHint(ctx, hintLines(), Math.min(1, hintT), H - 52 - (boss ? 12 : 0));
    }
    let hintCache = null, hintTouch = null;
    function hintLines() {
      const touch = hasTouch();
      if (hintCache && hintTouch === touch) return hintCache;
      hintTouch = touch;
      const spin = hasPerk('whirlwind');
      hintCache = touch
        ? ['Left thumb: move', 'Tap right: strike  •  Hold: block  •  Flick: dodge', spin ? 'Hold right, then let go: whirlwind' : 'Block just as a foe flashes to PARRY']
        : ['WASD: move  •  Z: strike  •  X: block  •  C: dodge', 'Q: potion' + (canFlee ? '  •  Esc: run' : '') + (spin ? '  •  hold X, let go: spin' : '')];
      return hintCache;
    }

    function groupNames() {
      const map = new Map();
      for (const e of enemies) map.set(e.name, (map.get(e.name) || 0) + 1);
      return [...map.entries()].map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(', ');
    }

    const introInfo = () => ({
      title: opts.title || (opts.boss ? 'Boss Battle!' : enemies.some((e) => e.kind && e.kind !== 'dummy') ? 'Wild encounter!' : 'Duel!'),
      you: { look: P.look, name: G.state.name || 'Squire', sub: `Level ${G.state.level}  •  ${P.weapon.name || 'Stick'}` },
      foe: {
        name: groupNames(),
        sub: enemies.length === 1 ? (enemies[0].title || `Level ${enemies[0].level}`) : `${enemies.length} foes`,
        portrait: (c, x, y, s) => art.portrait(c, enemies[0].look, x, y, s),
      },
      footer: canFlee ? 'Tap Run to flee' : null,
    });
    let introCache = null;
    function drawIntro(ctx) {
      if (!introCache) introCache = introInfo();
      G.BUI.drawIntro(ctx, pt, introCache);
    }

    function drawBanners(ctx) {
      if (fightBanner > 0 && phase === 'fight') G.BUI.drawShout(ctx, 'FIGHT!', 1 - fightBanner / 0.9);
      if (phase === 'outro') {
        const sub = won ? (enemies.length > 1 ? 'All foes defeated' : `${enemies[0].name} is beaten`) : opts.noDeath ? 'You yield... for now.' : 'You collapse in the dirt...';
        G.BUI.drawOutro(ctx, pt, { won, sub, rt: RT });
      }
    }

    function draw(ctx) {
      if (!W || W !== G.W || H !== G.H) layout();
      ctx.save();
      if (shakeA > 0) ctx.translate(Math.round(U.rand(-shakeA, shakeA)), Math.round(U.rand(-shakeA, shakeA)));
      ctx.drawImage(bg, 0, 0);
      art.arenaFx(ctx, arenaKind, W, H, F, RT, cheer, crowd);
      drawGroundTelegraphs(ctx);
      // depth-sorted fighters
      const list = enemies.slice();
      list.push(P);
      list.sort((a, b) => a.y - b.y);
      for (const f of list) {
        if (f === P) drawPlayer(ctx);
        else drawEnemy(ctx, f);
      }
      if (flashW > 0) { ctx.globalAlpha = Math.min(0.45, flashW); D.rect(-10, -10, W + 20, H + 20, '#fffbe8'); ctx.globalAlpha = 1; }
      drawParts(ctx);
      drawOverheads(ctx);
      drawTexts(ctx);
      ctx.restore();

      if (vign > 0 || (P.hp < P.maxHp * 0.25 && P.state !== 'dead' && phase === 'fight')) {
        const low = P.hp < P.maxHp * 0.25 ? 0.25 + 0.15 * Math.sin(RT * 5) : 0;
        const a = Math.max(vign * 0.6, low);
        const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        g.addColorStop(0, 'rgba(200,0,0,0)'); g.addColorStop(1, `rgba(200,0,0,${a})`);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }
      if (phase !== 'intro') drawHUD(ctx);
      drawHint(ctx);
      drawBanners(ctx);
      if (phase === 'intro') drawIntro(ctx);
      if (phase === 'fight') G.input.drawStick(ctx);
    }

    const scene = {
      name: 'battle-sword',
      enter() {
        layout();
        spawn();
        G.music.play(opts.boss ? 'boss' : 'battle');
        if (opts.intro) {
          phase = 'talk';
          const e0 = enemies[0];
          const look = e0.kind ? undefined : e0.look;
          Promise.resolve(G.ui.say(opts.intro, { name: e0.name, look })).then(() => { phase = 'intro'; pt = 0; });
        }
      },
      update(dt) {
        try { update(dt); } catch (e) { console.error('sword update error', e); }
      },
      draw,
      resize() { layout(); },
      debugEnd(w) {
        won = !!w; fled = false;
        if (won && P.hp < 1) P.hp = 1;
        finish();
      },
      // test hooks
      get _s() { return { P, enemies, phase, T, token, tut, proj, stats }; },
    };
    return scene;
  }

  if (G.battle && G.battle.register) G.battle.register('sword', (opts, done) => makeScene(opts || {}, done));
  else console.error('sword: G.battle missing at load');
  G.SW.makeScene = makeScene;
})();
