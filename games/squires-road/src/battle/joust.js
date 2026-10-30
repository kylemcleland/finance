// Live jousting (DESIGN.md §7b): a first-person, pseudo-3D charge down the tilt.
// The world is rendered at logical resolution into an offscreen canvas (crisp
// pixel look, cheap to shake/tumble), the HUD is drawn on top with G.draw.
(() => {
  const U = G.U;

  // ---- world layout (meters). Camera = your eyes in the saddle, looking down +z.
  const EYE = 2.55;
  const OPP_X = -1.5;             // opponent's lane, left of the barrier
  const BAR_X = -0.62;            // the tilt barrier
  const STAND_L = -5.4, STAND_R = 4.4, STAND_DEPTH = 3.8;
  const START_GAP = 72, REACH = 4.2, LIST_END = 90;
  const NEAR = 0.45;
  const RING_T = 1.2, BRACE_T = 0.5;
  // opponent shield (local to his horse, meters)
  const SH_LX = 0.44, SH_H = 1.98, SH_W = 0.3, SH_HH = 0.37, BOSS_N = 0.3;
  // speed gauge (0..S_MAX)
  const SWEET_LO = 0.6, SWEET_HI = 0.88, S_MAX = 1.2;

  const CROWD = ['#d6453d', '#3f7fd1', '#f2c14e', '#5bb04a', '#e07a3a', '#7b3fb5', '#f4e4c1', '#a8743a', '#2f8e6b', '#c43c3c', '#6fc3ff', '#d07a8a'];
  const SKIN = ['#f1c27d', '#e2ae80', '#c98e5d', '#f5cfa8', '#a86b45'];
  const HAIR = ['#3a2616', '#6b3e1f', '#d9a54a', '#1a1a1a', '#9a5a2a', '#c2552c'];
  const BANNERS = ['#d6453d', '#3f7fd1', '#f2c14e', '#2f7a3a', '#7b3fb5', '#f4e4c1'];

  const DEF_OPP = { name: 'Hedge Rider', title: '', look: 'knight', horseColor: '#7a5a3a', skill: 0.4, power: 0.9, seat: 0.4, speed: 0.85 };

  function resolveLook(look) {
    try { return G.chars.resolve(look || 'knight'); } catch (e) { return G.chars.resolve('knight'); }
  }
  const isHex = (c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c);
  const hex = (c, d) => (isHex(c) ? c : d);

  function make(opts, done) {
    opts = opts || {};
    let opp = G.roster && G.roster.joust && G.roster.joust[opts.opponent];
    if (!opp) { console.warn('joust: unknown opponent', opts.opponent); opp = DEF_OPP; }
    opp = Object.assign({}, DEF_OPP, opp);
    const boss = !!(opts.boss || opp.boss && opts.boss !== false);
    const oLook = resolveLook(opp.look);
    const oCol = {
      main: hex(oLook.tunic, '#3b5fa8'),
      trim: hex(oLook.tunic2, U.shade(hex(oLook.tunic, '#3b5fa8'), 0.6)),
      plume: hex(oLook.plume, hex(oLook.tunic2, '#f2c14e')),
      horse: hex(opp.horseColor, '#7a5a3a'),
    };
    const TITLES = ['Sir', 'Lady', 'Dame', 'Squire', 'Lord'];
    const nameParts = opp.name.split(' ');
    const titled = TITLES.includes(nameParts[0]) && nameParts.length > 1;
    const oppShort = opp.short || (titled ? nameParts[0] + ' ' + nameParts[1] : nameParts[0]);
    const oppBarName = (titled ? nameParts[1] : nameParts[0]).slice(0, 9).toUpperCase();

    // ---- player gear (fallbacks if the caller forgot)
    let st = {};
    try { st = G.player.stats(); } catch (e) { console.warn('joust: no player stats', e); }
    const lance = st.lance || G.items.practice_lance || { power: 1, stability: 0.2, breakChance: 0.15 };
    const horse = st.horse || G.items.old_nag || { speed: 0.8, stamina: 0.7, control: 0.5, color: '#8a6a4a' };
    const def = st.def || 0;
    const perk = (id) => { try { return G.player.hasPerk(id); } catch (e) { return false; } };
    const P_STEADY = perk('steady_hand'), P_SPURS = perk('spurs'), P_SEAT = perk('iron_seat');
    const P_SHATTER = perk('shatter'), P_CHAMP = perk('lance_champion');
    const pLookRaw = (G.state && G.state.look) || 'hero';
    const pLook = resolveLook(pLookRaw);
    const pCol = {
      main: hex(pLook.tunic, '#3b6fc4'),
      trim: hex(pLook.tunic2, '#f4e4c1'),
      shield: hex(st.shield && st.shield.color, hex(pLook.tunic, '#3b6fc4')),
      horse: hex(horse.color, '#8a6a4a'),
    };
    const maxStam = Math.round(8 + 9 * (horse.stamina || 0.7));
    const champ = P_CHAMP ? 1.6 : 1;

    // ---- layout
    let W = 0, H = 0, f = 150, hy = 180, vpx = 100, hsc = 1;
    let off = null, oc = null, skyGrad = null, groundGrad = null;
    function layout() {
      W = Math.max(1, Math.ceil(G.W)); H = Math.max(1, Math.ceil(G.H));
      [off, oc] = G.gfx.makeCanvas(W, H);
      const portrait = H > W;
      f = Math.min(W * 0.72, H * 0.62);
      hy = Math.round(H * (portrait ? 0.4 : 0.46));
      vpx = Math.round(W / 2 + 0.14 * f);
      hsc = Math.min(W, H * 0.75) / 195;
      skyGrad = oc.createLinearGradient(0, 0, 0, hy);
      skyGrad.addColorStop(0, '#3d86d6'); skyGrad.addColorStop(0.6, '#8fcaf5'); skyGrad.addColorStop(1, '#e4f3ff');
      groundGrad = oc.createLinearGradient(0, hy, 0, H);
      groundGrad.addColorStop(0, '#d8bd88'); groundGrad.addColorStop(0.3, '#c9a46a'); groundGrad.addColorStop(1, '#a87c48');
      if (ax) { ax = U.clamp(ax, 8, W - 8); ay = U.clamp(ay, 8, H - 8); }
    }
    let panX = 0, panY = 0; // camera look-at pan (you turn your head toward him)
    const X = (x, d) => vpx + panX + (x * f) / d;
    const Y = (h, d) => hy + panY + ((EYE - h) * f) / d;

    // ---- bout state
    let phase = 'intro', pt = 0, T = 0;
    const passes = [];
    let passN = 0, ended = false, won = false, endReason = '';
    let camZ = 0, oz = START_GAP, s = 0, vo = 0, tc = 0;
    let beatT = 0, beatP = 0.55, beatFlash = 0, rhythmFlash = 0, gallopPh = 0, oppPh = 0, oBob = 0, oppSway = 0;
    let stamina = maxStam, agitation = 0, lastSpur = -9, spurs = 0, spurOnBeat = 0;
    let oppLower = 0, oppMoving = false;
    let ax = 0, ay = 0, wobX = 0, wobY = 0, wobAmp = 0, lastLId = null, lastLX = 0, lastLY = 0;
    let tti = 99, brace = null, grace = -1, timeScale = 1;
    let lanceBroken = false, oppLanceBroken = false, oppUnseated = false, youUnseated = false;
    let rider = null; // flying opponent rider
    let tumbleT = 0, shake = 0, flash = 0, flashCol = '#fff', hitJolt = 0, excite = 0.15;
    let result = null; // last pass result
    let impactPt = null;
    const pops = [];
    const parts = [];
    const streaks = [];
    let hintT = 0;
    const clouds = [];
    for (let i = 0; i < 7; i++) clouds.push({ x: Math.random() * 1.4 - 0.2, y: 0.08 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.006 });
    layout();

    function resetPass() {
      camZ = 0; oz = START_GAP; s = 0; vo = 0; tc = 0;
      beatT = 0; stamina = maxStam; agitation = 0; spurs = 0; spurOnBeat = 0;
      oppLower = 0; oppMoving = false; tti = 99; brace = null; grace = -1; timeScale = 1;
      lanceBroken = false; oppLanceBroken = false; oppUnseated = false; youUnseated = false; rider = null;
      tumbleT = 0; result = null; impactPt = null; hitJolt = 0;
      parts.length = 0; streaks.length = 0;
      // start the reticle between the far target and the impact point
      updatePan(0, true);
      ax = W * 0.46 + 14; ay = hy + panY + 10;
    }

    // ---- helpers
    function pop(text, o = {}) {
      pops.push({ text, sub: o.sub || '', color: o.color || '#ffe48a', size: o.size || 16, t: 0, life: o.life || 1.6, y: o.y != null ? o.y : 0.3 });
    }
    function burst(x, y, n, o = {}) {
      for (let i = 0; i < n; i++) {
        const a = o.angle != null ? o.angle + U.rand(-o.spread || -1, o.spread || 1) : Math.random() * Math.PI * 2;
        const sp = U.rand(o.min || 20, o.max || 90);
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), g: o.g != null ? o.g : 160,
          life: U.rand(0.5, 1) * (o.life || 1), t: 0, col: U.pick(o.cols || ['#fff']), sz: U.rand(o.sz0 || 1, o.sz1 || 2.5),
          kind: o.kind || 'dot', rot: Math.random() * 6, vr: U.rand(-12, 12), len: U.rand(3, 9) * (o.lenMul || 1),
        });
      }
    }
    function oppShield() {
      const d = Math.max(NEAR, oz - camZ);
      return { x: X(OPP_X + oppSway + SH_LX, d), y: Y(SH_H + oBob, d), k: f / d };
    }
    function updatePan(dt, follow) {
      const d = Math.max(REACH, oz - camZ);
      const tx = W * 0.46 - (vpx + ((OPP_X + SH_LX) * f) / d);
      const ty = -((EYE - SH_H) * f) / d * 0.5;
      if (follow) { panX = tx; panY = ty; }
      else { const k = Math.min(1, dt * 1.5); panX = U.lerp(panX, 0, k * 0.5); panY = U.lerp(panY, 0, k * 0.5); }
    }
    function reticle() { return { x: ax + wobX, y: ay + wobY }; }

    // ---- input
    function actionPressed() {
      for (const e of G.input.events) {
        if (e.type === 'down' && e.zone === 'R') return true;
        if (e.type === 'key' && e.key === 'a' && e.down) return true;
      }
      return false;
    }
    function updateAim(dt) {
      const lp = G.input.lHold();
      if (lp) {
        if (lastLId === lp.id) {
          ax += (lp.x - lastLX) * 1.15;
          ay += (lp.y - lastLY) * 1.15;
        }
        lastLId = lp.id; lastLX = lp.x; lastLY = lp.y;
      } else {
        lastLId = null;
        const sk = G.input.stick;
        if (!sk.active && sk.mag > 0) { ax += sk.x * 75 * dt; ay += sk.y * 75 * dt; }
      }
      ax = U.clamp(ax, 6, W - 6); ay = U.clamp(ay, 6, H - 6);
    }
    function spur() {
      if (stamina <= 0) {
        s = Math.min(S_MAX, s + 0.012);
        pop('Winded!', { color: '#ffb08a', size: 9, life: 0.8, y: 0.62 });
        G.sfx.play('bump');
        return;
      }
      stamina--; spurs++;
      const near = Math.min(beatT, beatP - beatT);
      const onBeat = near < 0.11;
      let add = 0.072 * (P_SPURS ? 1.2 : 1) * (0.7 + 0.35 * (horse.speed || 0.8));
      if (onBeat) { add *= 1.65; rhythmFlash = 1; spurOnBeat++; G.sfx.tone(880, 0.07, { vol: 0.08, type: 'triangle' }); }
      if (T - lastSpur < 0.2) { agitation = Math.min(1.5, agitation + 0.35); add *= 0.6; }
      lastSpur = T;
      s = Math.min(S_MAX, s + add);
      if (s > SWEET_HI) agitation = Math.min(1.5, agitation + 0.18);
      G.sfx.hiss(0.07, { freq: 2600, vol: 0.12, q: 2 });
      // dust kick from the spur
      burst(W * 0.5 + U.rand(-30, 30) * hsc, H - 4, 4, { angle: -Math.PI / 2, spread: 1.2, min: 20, max: 60, cols: ['#d8bd88', '#c9a46a', '#b89060'], g: 60, sz0: 1.5, sz1: 3.5, life: 0.6 });
    }
    function doBrace(err) {
      const a = Math.abs(err);
      let grade, tq, bv;
      if (a <= 0.055 * champ) { grade = 'PERFECT!'; tq = 1; bv = 0.45; }
      else if (a <= 0.11 * champ) { grade = 'GOOD'; tq = 0.8; bv = 0.3; }
      else if (a <= 0.2 * champ) { grade = err > 0 ? 'EARLY' : 'LATE'; tq = 0.55; bv = 0.15; }
      else { grade = 'TOO EARLY'; tq = 0.35; bv = 0.05; }
      brace = { err, grade, tq, bv };
      G.sfx.play('swing');
    }

    // ---- the pass resolves here
    function resolvePass() {
      if (!brace) brace = { err: -1, grade: 'LATE', tq: 0.3, bv: 0 };
      const sh = oppShield();
      const r = reticle();
      const nx = (r.x - sh.x) / (SH_W * sh.k), ny = (r.y - sh.y) / (SH_HH * sh.k);
      const n = Math.hypot(nx, ny);
      let aimQ, zone;
      if (n <= BOSS_N) { aimQ = 1; zone = 'boss'; }
      else if (n <= 1) { aimQ = 1 - 0.5 * n; zone = 'shield'; }
      else if (n <= 1.55) { aimQ = 0.25; zone = 'glance'; }
      else { aimQ = 0; zone = 'miss'; }
      const sq = s < SWEET_LO ? 0.45 + 0.55 * (s / SWEET_LO) : s <= SWEET_HI ? 1 : 0.92;
      const Q = aimQ * brace.tq * sq;
      let you = 0;
      if (zone === 'miss') you = 0;
      else if (zone === 'glance' || Q < 0.3) you = 1;
      else {
        you = 2;
        const bp = (lance.breakChance || 0.15) * (0.5 + Q) * (P_SHATTER ? 1.3 : 1) + (zone === 'boss' ? 0.12 : 0);
        if (Math.random() < bp) you = 3;
      }
      let unA = false, marginA = -9;
      if (you >= 2) {
        const F = Q * (lance.power || 1) * (0.55 + 0.5 * Math.min(s, 1.1)) * (zone === 'boss' ? 1.25 : 1);
        marginA = F - opp.seat * 1.2;
        const cap = 0.8 - 0.3 * opp.seat;
        unA = Math.random() < U.clamp(marginA * 1.2, 0, cap);
      }
      // the opponent strikes too
      const rr = U.clamp(opp.skill * 0.85 + U.rand(-0.32, 0.28), 0, 1.2);
      let them = 0;
      if (rr < 0.22) them = 0;
      else if (rr < 0.45) them = 1;
      else { them = 2; if (Math.random() < 0.08 + 0.18 * opp.power * (rr - 0.45)) them = 3; }
      let unB = false, marginB = -9;
      if (them >= 2) {
        const Fo = rr * opp.power * (0.8 + 0.2 * opp.speed);
        const Rs = 0.5 + def * 0.045 + brace.bv - (s > SWEET_HI ? 0.12 : 0);
        marginB = Fo - Rs;
        unB = Math.random() < U.clamp(marginB * 0.75, 0, 0.6) * (P_SEAT ? 0.6 : 1);
      }
      if (scene.force) { if (scene.force.you != null) you = scene.force.you; if (scene.force.them != null) them = scene.force.them; unA = !!scene.force.unA; unB = !!scene.force.unB; }
      if (unA && unB) { if (marginA >= marginB) unB = false; else unA = false; }
      result = { you, them, zone, Q, qThem: rr, grade: brace.grade, unA, unB };
      passes.push({ you, them, q: Q, qt: rr * (them ? 1 : 0), zone, unA, unB });

      // --- juice
      phase = 'resolve'; pt = 0; timeScale = 0.12;
      excite = Math.min(1.2, excite + 0.35 + 0.2 * you + (unA ? 0.6 : 0));
      impactPt = { x: r.x, y: r.y };
      const sparkCols = ['#fff', '#ffe48a', '#f2c14e'];
      const woodCols = ['#e9d9b0', '#d9c08f', '#b88d55', pCol.main, pCol.trim];
      if (you === 0) { G.sfx.play('swing'); }
      else if (you === 1) { G.sfx.play('block'); burst(r.x, r.y, 10, { cols: sparkCols, min: 30, max: 90, g: 80, life: 0.6 }); shake = Math.max(shake, 3); }
      else {
        G.sfx.play('clang'); G.sfx.play('hit');
        burst(r.x, r.y, 18, { cols: sparkCols, min: 40, max: 140, g: 100, life: 0.8 });
        shake = Math.max(shake, 6); flash = 0.6; flashCol = '#fff';
      }
      if (you === 3) {
        lanceBroken = true; G.sfx.play('break');
        burst(r.x, r.y, 34, { cols: woodCols, min: 40, max: 200, g: 220, kind: 'splinter', life: 1.4, up: 40 });
        shake = Math.max(shake, 9);
      }
      if (them >= 1) {
        hitJolt = them >= 2 ? 1 : 0.5;
        shake = Math.max(shake, them >= 2 ? 8 : 4);
        if (them >= 2) { flash = Math.max(flash, 0.5); flashCol = '#ffd0b0'; G.sfx.play('thud'); }
      }
      if (them === 3) {
        oppLanceBroken = true; G.sfx.play('break');
        burst(W * 0.18, H * 0.78, 28, { cols: ['#e9d9b0', '#d9c08f', oCol.main, oCol.trim], min: 50, max: 220, g: 220, kind: 'splinter', life: 1.3, up: 60, angle: -1.2, spread: 1.4 });
      }
      // crowd
      if (you >= 2 || unA) G.sfx.hiss(1.8, { freq: 700, vol: 0.32, q: 0.35 });
      else G.sfx.play('crowd');
      // labels
      const yourLbl = ['MISS', 'GLANCE', 'SHIELD HIT!', 'LANCE SHATTERED!'][you];
      const yourCol = ['#c8c8c8', '#ffe48a', '#9ff59a', '#ffb347'][you];
      if (unA) {
        oppUnseated = true;
        rider = { x: OPP_X + oppSway, h: 1.18 + oBob, z: oz, vx: 0.6, vh: 3.4, vz: 6, rot: 0, vr: -5, landed: false };
        pop('UNHORSED!', { color: '#ffe48a', size: 22, sub: `${oppShort} hits the dirt!`, life: 2.6, y: 0.26 });
        G.sfx.tone(523, 0.2, { vol: 0.1 }); G.sfx.tone(784, 0.4, { vol: 0.1, delay: 0.15 });
      } else if (unB) {
        youUnseated = true;
        pop('UNHORSED!', { color: '#ff7a6a', size: 22, sub: 'You are thrown from the saddle!', life: 2.6, y: 0.3 });
      } else {
        pop(yourLbl, { color: yourCol, size: you === 3 ? 15 : 17, sub: you ? `+${you}  ${zone === 'boss' ? 'dead centre!' : ''}` : 'no points', life: 2.4, y: 0.24 });
        const theirLbl = ['misses you', 'glances off you', 'strikes your shield', 'shatters a lance on you'][them];
        pops.push({ text: `${oppShort} ${theirLbl}${them ? ' +' + them : ''}`, sub: '', color: them >= 2 ? '#ffb08a' : '#f4e4c1', size: 8, t: -0.5, life: 2.4, y: 0.62 });
      }
      pops.push({ text: brace.grade, sub: '', color: brace.tq >= 0.8 ? '#9ff59a' : '#ffd38a', size: 10, t: 0, life: 1.2, y: 0.36, at: { x: r.x, y: r.y - 16 } });
    }

    function bout() {
      let y = 0, t = 0, qy = 0, qt = 0;
      for (const p of passes) { y += p.you; t += p.them; qy += p.q; qt += p.qt; }
      return { y, t, qy, qt };
    }

    function afterPass() {
      const b = bout();
      const n = passes.length;
      const last = passes[n - 1];
      let over = false;
      if (last && last.unA) { over = true; won = true; endReason = `You unhorsed ${opp.name}!`; }
      else if (last && last.unB) { over = true; won = false; endReason = `${opp.name} unhorsed you.`; }
      else if (n >= 3 && b.y !== b.t) { over = true; won = b.y > b.t; endReason = `${b.y} – ${b.t} on points`; }
      else if (n === 2 && Math.abs(b.y - b.t) > 3) { over = true; won = b.y > b.t; endReason = `${b.y} – ${b.t}: unassailable!`; }
      else if (n >= 5) { over = true; won = b.qy >= b.qt; endReason = `Tied ${b.y} – ${b.t}; ${won ? 'your' : 'their'} cleaner hits win it`; }
      if (over) startOutro();
      else { phase = 'card'; pt = 0; G.sfx.play('select'); }
    }

    function startOutro() {
      phase = 'outro'; pt = 0;
      if (won) { G.sfx.play('win'); excite = 1.3; G.sfx.hiss(2.2, { freq: 800, vol: 0.3, q: 0.3 }); }
      else G.sfx.play('lose');
    }

    function finish() {
      if (ended) return;
      ended = true;
      const b = bout();
      let you = b.y, them = b.t;
      const last = passes[passes.length - 1];
      if (last && last.unA) you = Math.max(you, them + 1);
      if (last && last.unB) them = Math.max(them, you + 1);
      done({ won, score: { you, them } });
    }

    function startPass() {
      passN++;
      resetPass();
      phase = 'ready'; pt = 0;
      G.sfx.play('horn');
    }

    // ---- simulation (sim time)
    function simMove(sdt, charging, camMul = 1) {
      const hs = horse.speed || 0.8;
      if (charging) {
        const drag = 0.045 + 0.25 * Math.max(0, s - SWEET_HI);
        s = Math.max(0.08, s - drag * sdt);
      }
      const v = 1.2 + 8.5 * s * (0.85 + 0.15 * hs);
      camZ += v * sdt * camMul;
      if (oppMoving) {
        tc += sdt;
        const vmax = 8.2 * opp.speed;
        vo = vmax * (1 - Math.exp(-tc / 1.0));
        oz -= vo * sdt;
      }
      // gallop beat
      beatP = 0.55 - 0.17 * Math.min(1, s);
      if (s > 0.05) {
        beatT += sdt;
        if (beatT >= beatP) { beatT -= beatP; beatFlash = 1; if (phase === 'charge') G.sfx.play('gallop'); }
      }
      gallopPh += sdt * (Math.PI * 2) / beatP * (s > 0.05 ? 1 : 0);
      if (oppMoving) oppPh += sdt * (Math.PI * 2) / (0.55 - 0.17 * Math.min(1, vo / 9)) * Math.min(1, vo / 2 + 0.2);
      oBob = oppMoving && !oppUnseated ? Math.abs(Math.sin(oppPh)) * 0.07 : 0;
      oppSway = Math.sin(T * 0.9) * 0.1 + Math.sin(T * 2.3) * 0.03;
    }

    function updateWobble(dt) {
      const ctrl = horse.control != null ? horse.control : 0.5;
      const stab = lance.stability != null ? lance.stability : 0.2;
      const wild = s > SWEET_HI ? (s - SWEET_HI) * 5 : 0;
      wobAmp = (f / 150) * 6.5 * (0.35 + s) * (1.45 - ctrl) * (1 - 0.55 * stab) * (P_STEADY ? 0.7 : 1) * (1 + wild) + agitation * 4;
      const t = T;
      const nx = Math.sin(t * 1.3 + 0.4) * 0.55 + Math.sin(t * 2.7 + 2.1) * 0.3 + Math.sin(t * 0.6 + 5) * 0.35;
      const ny = Math.sin(t * 1.1 + 1.7) * 0.5 + Math.sin(t * 3.1 + 0.3) * 0.25 + Math.sin(t * 0.8 + 3) * 0.3;
      const jit = wild + agitation * 0.5;
      wobX = nx * wobAmp + Math.sin(t * 9.3) * jit * 2.5;
      wobY = ny * wobAmp * 0.8 + Math.sin(t * 8.1 + 1) * jit * 2 + Math.sin(gallopPh) * (0.6 + s * 1.6) * (f / 150);
      agitation = Math.max(0, agitation - dt * 0.6);
    }

    function updateParticles(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt;
        if (p.t >= p.life) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      }
      // speed streaks radiate from the vanishing point
      const sp = phase === 'charge' || phase === 'ready' ? s : s * 0.5;
      if (sp > 0.45 && !youUnseated) {
        const rate = (sp - 0.4) * 60;
        if (Math.random() < rate * dt * 2) {
          const a = U.rand(0, Math.PI * 2);
          streaks.push({ a, r: U.rand(0.25, 0.5) * Math.max(W, H), v: U.rand(1.5, 2.5) * Math.max(W, H), t: 0 });
        }
      }
      for (let i = streaks.length - 1; i >= 0; i--) {
        const k = streaks[i];
        k.t += dt; k.r += k.v * dt;
        if (k.r > Math.max(W, H) * 1.2) streaks.splice(i, 1);
      }
      // opponent's hooves kick dust
      const d = oz - camZ;
      if (oppMoving && d > 2 && d < 60 && Math.random() < dt * 30) {
        const k = f / d;
        parts.push({ x: X(OPP_X + U.rand(-0.4, 0.4), d), y: Y(0.05, d), vx: U.rand(-10, 10) * k / 10, vy: -U.rand(5, 15) * k / 10, g: 0, life: U.rand(0.4, 0.8), t: 0, col: U.pick(['#e2cc9c', '#d8bd88', '#c9a46a']), sz: Math.max(1, k * 0.1 * U.rand(0.6, 1.4)), kind: 'puff', rot: 0, vr: 0, len: 0 });
      }
      // our own dust at speed
      if (s > 0.35 && !youUnseated && Math.random() < dt * s * 20) {
        const side = Math.random() < 0.5 ? -1 : 1;
        parts.push({ x: W / 2 + side * U.rand(40, 80) * hsc, y: H + 2, vx: side * U.rand(20, 60), vy: -U.rand(20, 50), g: 30, life: U.rand(0.4, 0.7), t: 0, col: U.pick(['#e2cc9c', '#d8bd88', '#c9a46a']), sz: U.rand(3, 7) * hsc, kind: 'puff', rot: 0, vr: 0, len: 0 });
      }
    }

    function updateRider(sdt) {
      if (!rider) return;
      if (!rider.landed) {
        rider.vh -= 9.8 * sdt;
        rider.h += rider.vh * sdt; rider.z += rider.vz * sdt; rider.x += rider.vx * sdt;
        rider.rot += rider.vr * sdt;
        if (rider.h <= 0.25 && rider.vh < 0) {
          rider.h = 0.25; rider.landed = true; rider.rot = -Math.PI / 2;
          const d = Math.max(NEAR, rider.z - camZ), k = f / d;
          burst(X(rider.x, d), Y(0.1, d), 22, { cols: ['#e2cc9c', '#d8bd88', '#c9a46a'], min: 10, max: 60, g: -10, kind: 'puff', sz0: k * 0.2, sz1: k * 0.5, life: 1.2, angle: -Math.PI / 2, spread: 1.6 });
          G.sfx.play('thud'); shake = Math.max(shake, 4);
          G.sfx.hiss(1.6, { freq: 800, vol: 0.28, q: 0.4 });
          excite = 1.3;
        }
      }
    }

    // ------------------------------------------------------------------ scene
    const scene = {
      name: 'battle-joust',
      enter() { G.music.play(boss ? 'boss' : 'tourney'); resetPass(); },
      resize() { layout(); },
      update(dt) {
        T += dt; pt += dt;
        if (G.W !== W || G.H !== H) layout();
        excite = Math.max(0.15, excite - dt * 0.25);
        shake = Math.max(0, shake - dt * 18);
        flash = Math.max(0, flash - dt * 2.5);
        beatFlash = Math.max(0, beatFlash - dt * 4);
        rhythmFlash = Math.max(0, rhythmFlash - dt * 3);
        hitJolt = Math.max(0, hitJolt - dt * 2.5);
        for (let i = pops.length - 1; i >= 0; i--) { pops[i].t += dt; if (pops[i].t > pops[i].life) pops.splice(i, 1); }
        for (const c of clouds) { c.x += c.v * dt; if (c.x > 1.3) c.x = -0.3; }

        if (phase === 'intro') {
          if (pt > 2.2 || (pt > 0.6 && G.input.anyTap())) { G.input.consumeAllTaps(); startPass(); }
          updateParticles(dt);
          return;
        }
        if (phase === 'ready') {
          updateAim(dt);
          updateWobble(dt);
          simMove(dt, false);
          updatePan(dt, true);
          oppLower = pt < 0.8 ? 0 : pt < 1.6 ? Math.sin(((pt - 0.8) / 0.8) * Math.PI) * 0.45 : U.clamp((pt - 1.6) / 0.8, 0, 1) * 0.3;
          if (pt > 2.5) {
            phase = 'charge'; pt = 0; oppMoving = true; s = 0.2; tc = 0;
            G.sfx.play('charge');
            pop('CHARGE!', { color: '#ffe48a', size: 22, life: 1.1, y: 0.3 });
          }
          updateParticles(dt);
          return;
        }
        if (phase === 'charge') {
          hintT += dt;
          const sdt = dt * timeScale;
          updateAim(dt);
          if (actionPressed()) {
            if (grace >= 0) { if (!brace) doBrace(-grace); }
            else if (tti > RING_T) spur();
            else if (tti <= BRACE_T && !brace) doBrace(tti);
          }
          simMove(sdt, true);
          updatePan(dt, true);
          oppLower = Math.min(1, oppLower + sdt * 0.8);
          updateWobble(dt);
          const closing = Math.max(1, (1.2 + 8.5 * s) + vo);
          tti = (oz - camZ - REACH) / closing;
          if (tti <= 0) {
            if (brace) resolvePass();
            else {
              if (grace < 0) { grace = 0; timeScale = 0.06; }
              grace += dt;
              if (grace > 0.2 * champ) resolvePass();
            }
          }
          updateParticles(dt);
          return;
        }
        if (phase === 'resolve') {
          timeScale = pt < 0.55 ? 0.12 : Math.min(1, timeScale + dt * 1.6);
          const sdt = dt * timeScale;
          // rein in
          s = U.approach(s, oppUnseated ? 0 : 0.25, sdt * (oppUnseated ? 0.9 : 0.35));
          if (!youUnseated) simMove(sdt, false, oppUnseated ? U.clamp(1 - pt / 1.4, 0, 1) : 1);
          else { oz -= vo * sdt; oppPh += sdt * 12; }
          updateRider(sdt);
          if (pt > 1.2) updatePan(dt, false);
          if (youUnseated) {
            tumbleT += dt;
            if (tumbleT > 1.25 && tumbleT - dt <= 1.25) {
              G.sfx.play('thud'); shake = 10; G.sfx.play('hurt');
              burst(W / 2, H * 0.4, 30, { cols: ['#e2cc9c', '#d8bd88', '#c9a46a', '#a87c48'], min: 30, max: 160, g: 120, kind: 'puff', sz0: 3, sz1: 9, life: 1.2 });
            }
          }
          updateParticles(sdt + dt * 0.3);
          const hold = oppUnseated || youUnseated ? 4.2 : 3.0;
          if (pt > hold || (pt > 1.6 && !oppUnseated && !youUnseated && G.input.anyTap())) { G.input.consumeAllTaps(); afterPass(); }
          return;
        }
        if (phase === 'card') {
          updateParticles(dt);
          if (pt > 0.5 && G.input.anyTap()) { G.input.consumeAllTaps(); startPass(); }
          return;
        }
        if (phase === 'outro') {
          updateParticles(dt);
          updateRider(dt);
          if (youUnseated) tumbleT += dt;
          if (won && Math.random() < 0.6) parts.push({ x: Math.random() * W, y: -4, vx: U.rand(-15, 15), vy: U.rand(20, 50), g: 20, life: 3, t: 0, col: U.pick(BANNERS), sz: 2, kind: 'dot', rot: 0, vr: 0, len: 0 });
          if (pt > 4.5 || (pt > 1.2 && G.input.anyTap())) { G.input.consumeAllTaps(); finish(); }
        }
      },

      draw(ctx) {
        if (!off || G.W !== W || G.H !== H) layout();
        drawWorld(oc);
        // blit with shake / tumble
        ctx.fillStyle = '#6a4a2a';
        ctx.fillRect(0, 0, W, H);
        let sx = 0, sy = 0;
        if (shake > 0) { sx = U.rand(-shake, shake) * 0.5; sy = U.rand(-shake, shake) * 0.5; }
        const bobY = phase === 'charge' && !youUnseated ? Math.sin(gallopPh) * (0.4 + s * 1.2) : 0;
        if (youUnseated && tumbleT > 0) {
          const t = tumbleT;
          const FINAL = Math.PI * 2 - 0.38;
          const land = Math.max(0, t - 1.25);
          const bounce = land > 0 ? Math.sin(land * 22) * Math.exp(-land * 5) : 0;
          const roll = t < 1.25 ? U.ease.inOut(t / 1.25) * FINAL : FINAL + bounce * 0.06;
          let oy;
          if (t < 0.55) oy = Math.sin((t / 0.55) * Math.PI / 2) * H * 0.4;
          else if (t < 1.25) oy = U.lerp(H * 0.4, -H * 0.45, U.ease.inQuad((t - 0.55) / 0.7));
          else oy = U.lerp(-H * 0.45, H * 0.06, U.ease.outCubic(Math.min(1, land / 0.9))) + bounce * 8;
          ctx.save();
          ctx.translate(W / 2 + sx, H / 2 + sy);
          ctx.rotate(roll);
          ctx.scale(1.4, 1.4);
          ctx.translate(-W / 2, -H / 2 + oy);
          ctx.drawImage(off, 0, 0);
          ctx.restore();
          if (t > 1.1) {
            const a = t < 1.35 ? U.clamp((t - 1.1) / 0.25, 0, 0.9) : U.lerp(0.9, 0.38, U.clamp((t - 1.35) / 1.2, 0, 1));
            ctx.globalAlpha = a;
            drawDirt(ctx);
            ctx.globalAlpha = 1;
          }
        } else {
          ctx.drawImage(off, Math.round(sx), Math.round(sy + bobY));
        }
        if (flash > 0) {
          ctx.globalAlpha = Math.min(0.8, flash);
          ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
        drawHUD(ctx, sx, sy + bobY);
      },
    };
    scene.dbg = () => ({ phase, pt, tti, s, passN, wobX, wobY, beatT, beatP, ret: reticle(), stamina, gap: oz - camZ, brace: brace && brace.grade, result, passes, ax, ay, sh: oppShield(), W, H });
    scene.debugEnd = (w) => { if (ended) return; ended = true; done({ won: !!w, score: { you: w ? 3 : 0, them: w ? 0 : 3 } }); };

    // ================================================================== WORLD
    function quad(c, x1, y1, x2, y2, x3, y3, x4, y4, col) {
      c.fillStyle = col;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineTo(x3, y3); c.lineTo(x4, y4); c.closePath(); c.fill();
    }
    // vertical plane at x from h0..h1, spanning depths da..db
    function vplane(c, x, h0, h1, da, db, col) {
      quad(c, X(x, da), Y(h0, da), X(x, da), Y(h1, da), X(x, db), Y(h1, db), X(x, db), Y(h0, db), col);
    }
    function slope(c, x0, h0, x1, h1, da, db, col) {
      quad(c, X(x0, da), Y(h0, da), X(x1, da), Y(h1, da), X(x1, db), Y(h1, db), X(x0, db), Y(h0, db), col);
    }

    function drawWorld(c) {
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.imageSmoothingEnabled = false;
      // sky
      c.fillStyle = skyGrad; c.fillRect(0, 0, W, H);
      drawClouds(c);
      drawDistant(c);
      // ground
      c.fillStyle = groundGrad; c.fillRect(0, Math.round(hy + panY), W, H);
      drawGroundBands(c);
      drawEndStand(c);
      drawPavilion(c);
      drawStands(c);
      // barrier far of the opponent, opponent, barrier near
      const od = oz - camZ;
      drawBarrier(c, od, LIST_END);
      if (rider && rider.z < oz) { drawOpp(c, od); drawRider(c); }
      else { drawRider(c); drawOpp(c, od); }
      drawBarrier(c, -10, od);
      drawWorldParticles(c, 'puff');
      drawStreaks(c);
      if (!youUnseated || tumbleT < 0.6) drawForeground(c);
      drawWorldParticles(c, 'dot');
      drawWorldParticles(c, 'splinter');
      if (phase === 'ready' || phase === 'intro') drawSaluteInset(c);
    }

    // During the herald's call he is a speck at the far end: show him in a spyglass inset.
    function drawSaluteInset(c) {
      const R_ = Math.round(Math.min(W, H) * 0.2);
      const land = W > H;
      const cx = Math.round(land ? R_ + 12 : W / 2), cy = Math.round(land ? H * 0.56 : hy - R_ - 6);
      const a = phase === 'intro' ? 0 : U.clamp(pt * 3, 0, 1) * U.clamp((2.5 - pt) * 3, 0, 1);
      if (a <= 0) return;
      c.save();
      c.globalAlpha = a;
      c.beginPath(); c.arc(cx, cy, R_, 0, Math.PI * 2); c.clip();
      c.fillStyle = skyGrad; c.fillRect(cx - R_, cy - R_, R_ * 2, R_ * 2);
      // stand backdrop + sand
      for (let i = 0; i < 24; i++) { c.fillStyle = CROWD[i % CROWD.length]; c.fillRect(cx - R_ + ((i * 7) % (R_ * 2)), cy - R_ * 0.35 + ((i * 3) % 7), 4, 5); }
      c.fillStyle = '#6a4630'; c.fillRect(cx - R_, cy - R_ * 0.12, R_ * 2, R_ * 0.18);
      c.fillStyle = '#d8bd88'; c.fillRect(cx - R_, cy + R_ * 0.05, R_ * 2, R_ * 2);
      const sCam = camZ, sPX = panX, sPY = panY, sMov = oppMoving;
      const dd = 7.5 * (Math.min(W, H) / 195) * (150 / f) * (40 / R_) * 0.9;
      camZ = oz - dd;
      panX = cx - vpx - ((OPP_X + oppSway) * f) / dd;
      panY = cy + R_ * 0.75 - hy - (EYE * f) / dd;
      oppMoving = false;
      drawOpp(c, dd);
      camZ = sCam; panX = sPX; panY = sPY; oppMoving = sMov;
      c.restore();
      c.globalAlpha = a;
      c.strokeStyle = '#2b1d14'; c.lineWidth = 3; c.beginPath(); c.arc(cx, cy, R_, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#c9893c'; c.lineWidth = 1.5; c.beginPath(); c.arc(cx, cy, R_, 0, Math.PI * 2); c.stroke();
      c.globalAlpha = 1;
    }

    function drawClouds(c) {
      for (const cl of clouds) {
        const x = cl.x * W + panX * 0.3, y = cl.y * hy, r = 9 * cl.s * hsc;
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath();
        c.arc(x, y, r, 0, Math.PI * 2); c.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
        c.arc(x - r * 1.1, y + r * 0.3, r * 0.7, 0, Math.PI * 2); c.arc(x + r * 0.3, y - r * 0.5, r * 0.7, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = 'rgba(200,220,240,0.7)';
        c.fillRect(Math.round(x - r * 1.7), Math.round(y + r * 0.55), Math.round(r * 3.6), Math.max(1, Math.round(r * 0.35)));
      }
    }

    function drawDistant(c) {
      // rolling hills + Crownhold-ish castle beyond the far end
      const hy0 = hy + panY;
      c.fillStyle = '#8fb87a';
      c.beginPath(); c.moveTo(0, hy0 + 1);
      for (let x = 0; x <= W; x += 4) c.lineTo(x, hy0 - 6 - Math.sin((x - panX) * 0.035 + 1) * 4 - Math.sin((x - panX) * 0.011) * 5);
      c.lineTo(W, hy0 + 1); c.fill();
      c.fillStyle = '#a9b2c6';
      const k = f / 360, bx = vpx + panX + 6 * k;
      const tw = Math.max(2, Math.round(3 * k * 4));
      for (let i = -2; i <= 2; i++) {
        const th = (i === 0 ? 28 : 18 + Math.abs(i) * 2) * k * 4;
        const tx = Math.round(bx + i * 9 * k * 4 - tw / 2);
        c.fillRect(tx, Math.round(hy0 - th), tw, Math.round(th));
        c.fillRect(tx - 1, Math.round(hy0 - th - 2), tw + 2, 2);
      }
      c.fillRect(Math.round(bx - 18 * k * 4), Math.round(hy0 - 12 * k * 4), Math.round(36 * k * 4), Math.round(12 * k * 4));
      c.fillStyle = '#d6453d';
      c.fillRect(Math.round(bx), Math.round(hy0 - 28 * k * 4 - 6), 4, 2);
      c.fillStyle = '#a9b2c6';
      c.fillRect(Math.round(bx), Math.round(hy0 - 28 * k * 4 - 6), 1, 6);
    }

    function drawGroundBands(c) {
      // alternating rake marks scroll past to sell speed
      const step = 3;
      const z0 = Math.floor(camZ / step) * step;
      for (let z = z0; z < LIST_END; z += step) {
        const da = Math.max(NEAR, z - camZ), db = z + step - camZ;
        if (db <= NEAR) continue;
        if ((Math.round(z / step) & 1) === 0) {
          const y0 = Math.min(H, Y(0, da)), y1 = Y(0, db);
          c.fillStyle = 'rgba(120,80,30,0.08)';
          c.fillRect(0, Math.round(y1), W, Math.max(1, Math.round(y0 - y1)));
        }
      }
      // trampled lanes
      const dn = NEAR, dfar = LIST_END - camZ;
      const lane = (x0, x1, col) => quad(c, X(x0, dn), Y(0, dn), X(x1, dn), Y(0, dn), X(x1, dfar), Y(0, dfar), X(x0, dfar), Y(0, dfar), col);
      lane(OPP_X - 0.55, OPP_X + 0.55, 'rgba(140,95,50,0.28)');
      lane(-0.5, 0.5, 'rgba(140,95,50,0.28)');
      // hoof prints scattered in lanes
      c.fillStyle = 'rgba(100,65,30,0.35)';
      for (let z = Math.floor(camZ); z < Math.min(LIST_END, camZ + 40); z++) {
        const d = z - camZ; if (d < 1) continue;
        const k = f / d;
        const hx = U.hash2(z, 3), hx2 = U.hash2(z, 9);
        const w = Math.max(1, Math.round(k * 0.14));
        c.fillRect(Math.round(X(-0.35 + hx * 0.7, d)), Math.round(Y(0, d)), w, Math.max(1, Math.round(w * 0.5)));
        c.fillRect(Math.round(X(OPP_X - 0.35 + hx2 * 0.7, d)), Math.round(Y(0, d)), w, Math.max(1, Math.round(w * 0.5)));
      }
    }

    function drawEndStand(c) {
      const d = LIST_END - camZ;
      if (d <= 1) return;
      const k = f / d;
      const x0 = X(-16, d), x1 = X(16, d);
      // back wall + crowd
      c.fillStyle = '#6a4630';
      c.fillRect(Math.round(x0), Math.round(Y(5.2, d)), Math.round(x1 - x0), Math.round(Y(0, d) - Y(5.2, d)));
      for (let row = 0; row < 4; row++) {
        const hRow = 1.6 + row * 0.95;
        const y = Math.round(Y(hRow, d));
        const step = Math.max(1, Math.round(k * 0.6));
        for (let x = Math.round(x0); x < x1; x += step) {
          const hsh = U.hash2(x + 999, row);
          c.fillStyle = CROWD[(hsh * CROWD.length) | 0];
          const jump = excite > 0.4 && hsh > 0.5 ? Math.round(Math.abs(Math.sin(T * 8 + hsh * 20)) * excite * k * 0.2) : 0;
          c.fillRect(x, y - Math.max(1, Math.round(k * 0.5)) - jump, Math.max(1, step - 1), Math.max(1, Math.round(k * 0.5)));
          c.fillStyle = SKIN[(hsh * 37 % 1 * SKIN.length) | 0];
          c.fillRect(x, y - Math.max(2, Math.round(k * 0.8)) - jump, Math.max(1, step - 1), Math.max(1, Math.round(k * 0.3)));
        }
      }
      // front wall drapes
      for (let i = -8; i < 8; i++) {
        c.fillStyle = i & 1 ? '#b23a3a' : '#f2c14e';
        const xa = X(i * 2, d), xb = X(i * 2 + 2, d);
        c.fillRect(Math.round(xa), Math.round(Y(1.2, d)), Math.max(1, Math.round(xb - xa)), Math.max(1, Math.round(Y(0, d) - Y(1.2, d))));
      }
      // canopy + hanging banners + royal box
      c.fillStyle = '#4a2e1e';
      c.fillRect(Math.round(x0), Math.round(Y(5.8, d)), Math.round(x1 - x0), Math.max(1, Math.round(k * 0.6)));
      for (let i = -7; i <= 7; i += 2) {
        const bx = X(i * 2, d);
        c.fillStyle = BANNERS[(i + 7) % BANNERS.length];
        c.fillRect(Math.round(bx), Math.round(Y(5.4, d)), Math.max(1, Math.round(k * 0.8)), Math.max(2, Math.round(k * 2)));
      }
      c.fillStyle = '#7b3fb5';
      c.fillRect(Math.round(X(-2.5, d)), Math.round(Y(7, d)), Math.max(2, Math.round(k * 5)), Math.max(1, Math.round(k * 1.4)));
      c.fillStyle = '#f2c14e';
      c.fillRect(Math.round(X(-2.5, d)), Math.round(Y(5.6, d)), Math.max(2, Math.round(k * 5)), Math.max(1, Math.round(k * 0.3)));
    }

    function drawPavilion(c) {
      const z = LIST_END - 6, d = z - camZ;
      if (d <= 1) return;
      const k = f / d;
      const px = OPP_X - 0.6;
      const cx = X(px, d), gy = Y(0, d);
      const w = 3.2 * k, wallH = 2.4 * k, roofH = 1.9 * k;
      const n = 6;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i & 1 ? oCol.trim : oCol.main;
        c.fillRect(Math.round(cx - w / 2 + (i * w) / n), Math.round(gy - wallH), Math.max(1, Math.ceil(w / n)), Math.round(wallH));
      }
      c.fillStyle = '#2b1d14';
      quad(c, cx - 0.35 * k, gy, cx, gy - 1.6 * k, cx, gy - 1.6 * k, cx + 0.35 * k, gy, '#2b1d14');
      quad(c, cx - w / 2 - 0.2 * k, gy - wallH, cx, gy - wallH - roofH, cx, gy - wallH - roofH, cx + w / 2 + 0.2 * k, gy - wallH, oCol.main);
      quad(c, cx - 0.4 * k, gy - wallH, cx, gy - wallH - roofH, cx, gy - wallH - roofH, cx + 0.4 * k, gy - wallH, oCol.trim);
      // valance
      c.fillStyle = oCol.trim;
      c.fillRect(Math.round(cx - w / 2 - 0.2 * k), Math.round(gy - wallH), Math.round(w + 0.4 * k), Math.max(1, Math.round(0.3 * k)));
      // pole + pennant
      const top = gy - wallH - roofH;
      c.fillStyle = '#4a3020';
      c.fillRect(Math.round(cx), Math.round(top - 1.4 * k), Math.max(1, Math.round(0.08 * k)), Math.round(1.4 * k));
      const wv = Math.sin(T * 6) * 0.2 * k;
      quad(c, cx + 1, top - 1.4 * k, cx + 1.3 * k, top - 1.15 * k + wv, cx + 1.3 * k, top - 1.15 * k + wv, cx + 1, top - 0.9 * k, oCol.plume);
    }

    function drawStands(c) {
      const SEG = 4;
      const first = Math.floor((camZ - 6) / SEG);
      const last = Math.ceil(LIST_END / SEG) - 1;
      for (let i = last; i >= first; i--) {
        const za = i * SEG, zb = za + SEG;
        const db = zb - camZ;
        if (db <= NEAR) continue;
        const da = Math.max(NEAR, za - camZ);
        drawStandSeg(c, -1, i, da, db);
        drawStandSeg(c, 1, i, da, db);
      }
    }

    function drawStandSeg(c, side, idx, da, db) {
      const x0 = side < 0 ? STAND_L : STAND_R;
      const xb = x0 + side * STAND_DEPTH;
      // back wall above the top tier
      vplane(c, xb, 5.0, 6.8, da, db, '#5a3a24');
      // tier slope
      slope(c, x0, 1.1, xb, 5.0, da, db, '#6a4630');
      // crowd rows (back rows first)
      const dMid = (da + db) / 2;
      const kMid = f / dMid;
      for (let r = 4; r >= 0; r--) {
        const xr = x0 + side * (0.4 + r * 0.72), hr = 1.25 + r * 0.76;
        if (kMid < 3.2) {
          // distant: mottled strip
          const n = 4;
          for (let j = 0; j < n; j++) {
            const z1 = da + ((db - da) * j) / n, z2 = da + ((db - da) * (j + 1)) / n;
            const hsh = U.hash2(idx * 17 + j, r * 7 + side);
            const jump = excite > 0.4 ? Math.abs(Math.sin(T * 7 + hsh * 30)) * excite * 0.2 : 0;
            vplane(c, xr, hr + jump, hr + 0.55 + jump, z1, z2, CROWD[(hsh * CROWD.length) | 0]);
          }
        } else {
          const per = 5;
          for (let j = per - 1; j >= 0; j--) {
            const z = idx * 4 + (j + 0.5) * (4 / per);
            const d = z - camZ;
            if (d < 0.8) continue;
            person(c, xr, hr, d, idx * 31 + j * 7 + r * 101 + (side > 0 ? 5000 : 0));
          }
        }
      }
      // front wall with painted drapes
      const drape = side < 0 ? (idx & 1 ? '#b23a3a' : '#f2c14e') : (idx & 1 ? '#3b6fc4' : '#f4e4c1');
      vplane(c, x0, 0, 1.15, da, db, drape);
      vplane(c, x0, 0, 0.18, da, db, '#4a2e1e');
      vplane(c, x0, 1.05, 1.2, da, db, '#7a4b2a');
      // roof underside + valance
      slope(c, x0 - side * 0.2, 6.8, xb, 7.2, da, db, '#3a2618');
      const val = side < 0 ? (idx & 1 ? '#f4e4c1' : '#d6453d') : (idx & 1 ? '#f4e4c1' : '#3f7fd1');
      vplane(c, x0 - side * 0.2, 6.3, 6.8, da, db, val);
      // scallops
      const dm = Math.max(NEAR, (da + db) / 2);
      const km = f / dm;
      if (km > 2) {
        c.fillStyle = val;
        c.beginPath();
        c.arc(X(x0 - side * 0.2, dm), Y(6.3, dm), km * 0.35, 0, Math.PI);
        c.fill();
      }
      // posts every segment
      if (da > NEAR) {
        const k = f / da;
        c.fillStyle = '#4a2e1e';
        const px = X(x0 - side * 0.2, da);
        c.fillRect(Math.round(px - k * 0.06), Math.round(Y(6.8, da)), Math.max(1, Math.round(k * 0.12)), Math.round(Y(1.1, da) - Y(6.8, da)));
        // pennant poles
        if (idx % 3 === 0) {
          const top = Y(8.8, da);
          c.fillRect(Math.round(px - k * 0.04), Math.round(top), Math.max(1, Math.round(k * 0.08)), Math.round(Y(6.8, da) - top));
          const wv = Math.sin(T * 7 + idx) * k * 0.18;
          const col = BANNERS[(idx / 3 + (side > 0 ? 2 : 0)) % BANNERS.length | 0];
          const fl = side * -1; // flags stream toward the centre
          quad(c, px, top + 1, px + fl * k * 1.3, top + k * 0.25 + wv, px + fl * k * 1.3, top + k * 0.25 + wv, px, top + k * 0.55, col);
        }
      }
    }

    function person(c, x, h, d, seed) {
      const k = f / d;
      const hs = U.hash2(seed, 77);
      const col = CROWD[(hs * CROWD.length) | 0];
      const skin = SKIN[(U.hash2(seed, 13) * SKIN.length) | 0];
      const hair = HAIR[(U.hash2(seed, 5) * HAIR.length) | 0];
      const wave = Math.sin(d * 0.25 + camZ * 0.25 - T * 3.5 + (x < 0 ? 0 : 2));
      const jump = (excite > 0.35 ? Math.abs(Math.sin(T * 9 + hs * 20)) * excite * 0.25 : 0) + (wave > 0.85 ? 0.08 : 0);
      const sx = X(x, d), sy = Y(h + jump, d);
      const bw = Math.max(1, Math.round(k * 0.42)), bh = Math.max(1, Math.round(k * 0.5));
      const hw = Math.max(1, Math.round(k * 0.28));
      const bx = Math.round(sx - bw / 2), by = Math.round(sy - bh);
      c.fillStyle = col; c.fillRect(bx, by, bw, bh);
      const hx = Math.round(sx - hw / 2), hyy = by - hw;
      c.fillStyle = skin; c.fillRect(hx, hyy, hw, hw);
      if (k > 8) { c.fillStyle = hair; c.fillRect(hx, hyy, hw, Math.max(1, Math.round(hw * 0.35))); }
      const armsUp = wave > 0.6 || (excite > 0.5 && hs > 0.35);
      if (armsUp) {
        const aw = Math.max(1, Math.round(k * 0.1)), ah = Math.max(1, Math.round(k * 0.4));
        c.fillStyle = col;
        c.fillRect(bx - aw, by - ah + 1, aw, ah); c.fillRect(bx + bw, by - ah + 1, aw, ah);
        if (hs > 0.8) { // waving a kerchief
          c.fillStyle = hs > 0.9 ? '#ffffff' : BANNERS[(seed % BANNERS.length + BANNERS.length) % BANNERS.length];
          const fw = Math.max(1, Math.round(k * 0.25));
          c.fillRect(bx + bw + Math.round(Math.sin(T * 12 + seed) * aw), by - ah - fw + 1, fw, fw);
        }
      }
    }

    function drawBarrier(c, dMin, dMax) {
      const SEG = 3;
      const first = Math.floor((camZ - 4) / SEG);
      const last = Math.ceil(LIST_END / SEG) - 1;
      for (let i = last; i >= first; i--) {
        const za = i * SEG, zb = za + SEG;
        const dbr = zb - camZ, dar = za - camZ;
        if (dbr <= NEAR) continue;
        const mid = (dar + dbr) / 2;
        if (mid < dMin || mid >= dMax) continue;
        const da = Math.max(NEAR, dar);
        // top surface (seen from above), plank face, rail
        slope(c, BAR_X, 1.3, BAR_X - 0.18, 1.3, da, dbr, '#9a6a3a');
        vplane(c, BAR_X, 0.12, 1.15, da, dbr, i & 1 ? '#c43c3c' : '#f2e6c8');
        vplane(c, BAR_X, 0.5, 0.62, da, dbr, i & 1 ? '#f2c14e' : '#c43c3c');
        vplane(c, BAR_X, 1.15, 1.3, da, dbr, '#6a4022');
        vplane(c, BAR_X, 0, 0.12, da, dbr, '#4a2e1e');
        // post at the near end (facing us)
        if (dar > NEAR) {
          const k = f / dar;
          const x0 = X(BAR_X - 0.1, dar), x1 = X(BAR_X + 0.1, dar);
          const yt = Y(1.5, dar), yb = Y(0, dar);
          c.fillStyle = '#5a3a20';
          c.fillRect(Math.round(x0), Math.round(yt), Math.max(1, Math.round(x1 - x0)), Math.round(yb - yt));
          c.fillStyle = '#7a5030';
          c.fillRect(Math.round(x0), Math.round(yt), Math.max(1, Math.round((x1 - x0) * 0.4)), Math.round(yb - yt));
          c.fillStyle = '#f2c14e';
          const cap = Math.max(1, Math.round(k * 0.12));
          c.fillRect(Math.round(x0 - cap * 0.3), Math.round(yt - cap), Math.max(1, Math.round(x1 - x0 + cap * 0.6)), cap);
        }
      }
    }

    // --- opponent knight on a caparisoned horse (billboard at depth d)
    function drawOpp(c, d) {
      if (d < 1.1 || d > LIST_END) return;
      const k = f / d;
      const ox = OPP_X + oppSway;
      const bx = X(ox, d), gy = Y(0, d);
      const P = (lx) => bx + lx * k, Qy = (lh) => gy - lh * k;
      const poly = (pts, col) => {
        c.fillStyle = col; c.beginPath();
        c.moveTo(P(pts[0]), Qy(pts[1]));
        for (let i = 2; i < pts.length; i += 2) c.lineTo(P(pts[i]), Qy(pts[i + 1]));
        c.closePath(); c.fill();
      };
      const R = (lx, lh, w, h, col) => {
        c.fillStyle = col;
        const x0 = Math.round(P(lx)), y0 = Math.round(Qy(lh + h));
        c.fillRect(x0, y0, Math.max(1, Math.round(P(lx + w)) - x0), Math.max(1, Math.round(Qy(lh)) - y0));
      };
      const b = oBob;
      const hc = oCol.horse, hcD = U.shade(hc, -0.3), hcL = U.shade(hc, 0.2);
      const run = oppMoving;
      // shadow
      c.fillStyle = 'rgba(60,35,10,0.35)';
      c.beginPath(); c.ellipse(bx, gy, 0.7 * k, 0.12 * k + 1, 0, 0, Math.PI * 2); c.fill();
      // legs: hind (darker, behind the skirt), then front with bending knees
      for (const [lx, off] of [[-0.27, 2.2], [0.27, 0.6]]) {
        const lift = run ? Math.max(0, Math.sin(oppPh + off)) * 0.2 : 0;
        R(lx - 0.06, lift + 0.08, 0.12, 0.62 - lift, hcD);
        R(lx - 0.06, lift, 0.12, 0.08, '#1f1510');
      }
      for (const [lx, off] of [[-0.15, 0], [0.15, Math.PI]]) {
        const lift = run ? Math.max(0, Math.sin(oppPh + off)) : 0;
        const knee = 0.42 + lift * 0.12, foot = lift * 0.3;
        R(lx - 0.065, knee, 0.13, 0.75 - knee + b, hc);
        R(lx - 0.045 + lift * 0.03, foot + 0.07, 0.09, knee - foot - 0.05, hc);
        R(lx - 0.05 + lift * 0.03, foot + 0.07, 0.1, 0.06, '#f4ecd8');
        R(lx - 0.055 + lift * 0.03, foot, 0.11, 0.07, '#1f1510');
      }
      // caparison skirt with dagged hem, fluttering
      const top = 1.48 + b, bot = 0.6 + b;
      const hem = [];
      const nH = 8;
      for (let i = 0; i <= nH; i++) {
        const lx = 0.52 - i * (1.04 / nH);
        hem.push(lx, bot - (i % 2 ? 0.09 : 0) + (run ? Math.sin(T * 14 + i * 1.7) * 0.03 : 0));
      }
      poly([-0.44, top, 0.44, top, ...hem], oCol.main);
      poly([-0.44, top, -0.3, top, -0.36, bot, -0.52, bot], U.shade(oCol.main, -0.25));
      poly([0.3, top, 0.44, top, 0.52, bot, 0.36, bot], U.shade(oCol.main, -0.12));
      poly([-0.42, bot + 0.2, 0, bot + 0.55, 0.42, bot + 0.2, 0.42, bot + 0.32, 0, bot + 0.67, -0.42, bot + 0.32], oCol.trim);
      R(-0.52, bot - 0.02, 1.04, 0.06, oCol.trim);
      // rider (unless unhorsed)
      if (!oppUnseated) drawKnight(c, P(0), Qy(1.5 + b), k, 0, true);
      // neck in a crinet, then the head with a steel chanfron
      const nb = b * 1.3 + (run ? Math.sin(oppPh + 0.6) * 0.035 : 0);
      poly([-0.21, 1.3 + b, 0.21, 1.3 + b, 0.17, 1.86 + nb, -0.17, 1.86 + nb], oCol.main);
      poly([-0.21, 1.3 + b, -0.12, 1.3 + b, -0.1, 1.86 + nb, -0.17, 1.86 + nb], U.shade(oCol.main, -0.25));
      R(-0.21, 1.3 + b, 0.42, 0.05, oCol.trim);
      // ears
      poly([-0.15, 1.86 + nb, -0.07, 1.86 + nb, -0.13, 2.04 + nb], hcD);
      poly([0.07, 1.86 + nb, 0.15, 1.86 + nb, 0.13, 2.04 + nb], hcD);
      // face
      poly([-0.16, 1.9 + nb, 0.16, 1.9 + nb, 0.13, 1.4 + nb, 0.1, 1.2 + nb, -0.1, 1.2 + nb, -0.13, 1.4 + nb], hc);
      poly([-0.16, 1.9 + nb, -0.08, 1.9 + nb, -0.07, 1.25 + nb, -0.1, 1.2 + nb, -0.13, 1.4 + nb], hcD);
      R(-0.1, 1.2 + nb, 0.2, 0.1, U.shade(hc, -0.45));
      R(-0.07, 1.24 + nb, 0.04, 0.04, '#120c08');
      R(0.03, 1.24 + nb, 0.04, 0.04, '#120c08');
      // chanfron + eye cups
      poly([-0.11, 1.9 + nb, 0.11, 1.9 + nb, 0.08, 1.4 + nb, -0.08, 1.4 + nb], '#c8ccd6');
      poly([-0.11, 1.9 + nb, -0.04, 1.9 + nb, -0.03, 1.4 + nb, -0.08, 1.4 + nb], '#9aa0aa');
      R(-0.012, 1.42 + nb, 0.024, 0.46, '#f0f4ff');
      R(-0.17, 1.7 + nb, 0.06, 0.07, '#9aa0aa'); R(0.11, 1.7 + nb, 0.06, 0.07, '#9aa0aa');
      R(-0.155, 1.72 + nb, 0.03, 0.03, '#120c08'); R(0.125, 1.72 + nb, 0.03, 0.03, '#120c08');
      // chanfron plume
      const pw = run ? Math.sin(T * 12) * 0.03 : 0;
      poly([-0.04, 1.9 + nb, 0.04, 1.9 + nb, 0.07 + pw, 2.12 + nb, -0.01 + pw, 2.1 + nb], oCol.plume);
      // reins
      c.strokeStyle = '#3a2210'; c.lineWidth = Math.max(1, k * 0.02);
      c.beginPath(); c.moveTo(P(-0.1), Qy(1.3 + nb)); c.lineTo(P(-0.24), Qy(1.72 + b)); c.moveTo(P(0.1), Qy(1.3 + nb)); c.lineTo(P(0.2), Qy(1.7 + b)); c.stroke();
      // shield (target) on his left arm (screen right)
      drawOppShield(c, P(SH_LX), Qy(SH_H + b), k);
      // lance
      drawOppLance(c, d, ox, b);
    }

    // Procedural knight, origin at the saddle (hip), meters, rotated by rot.
    function drawKnight(c, x0, y0, k, rot, mounted) {
      const steel = hex(oLook.helmet, '#b8bcc6'), steelD = U.shade(steel, -0.3), steelL = U.shade(steel, 0.4);
      c.save();
      c.translate(Math.round(x0), Math.round(y0));
      if (rot) c.rotate(rot);
      const R = (mx, mh, w, h, col) => { c.fillStyle = col; c.fillRect(Math.round(mx * k), Math.round(-(mh + h) * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))); };
      const poly = (pts, col) => { c.fillStyle = col; c.beginPath(); c.moveTo(pts[0] * k, -pts[1] * k); for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i] * k, -pts[i + 1] * k); c.closePath(); c.fill(); };
      // legs astride (greaves + sabatons)
      if (mounted) {
        R(-0.4, -0.5, 0.12, 0.55, steel); R(-0.4, -0.5, 0.04, 0.55, steelD); R(-0.43, -0.56, 0.16, 0.07, steelD);
        R(0.28, -0.5, 0.12, 0.55, steel); R(0.28, -0.5, 0.04, 0.55, steelD); R(0.26, -0.56, 0.16, 0.07, steelD);
      } else {
        R(-0.17, -0.75, 0.13, 0.78, steel); R(0.04, -0.75, 0.13, 0.78, steel);
      }
      // mantling behind the helm
      poly([-0.13, 0.98, -0.3, 0.78, -0.22, 0.66, -0.12, 0.78], oCol.main);
      poly([0.13, 0.98, 0.3, 0.8, 0.22, 0.66, 0.12, 0.78], U.shade(oCol.main, -0.2));
      // torso in a surcoat
      poly([-0.21, 0, 0.21, 0, 0.26, 0.68, -0.26, 0.68], oCol.main);
      poly([-0.21, 0, -0.12, 0, -0.15, 0.68, -0.26, 0.68], U.shade(oCol.main, -0.22));
      R(-0.05, 0, 0.1, 0.68, oCol.trim);
      R(-0.22, 0.1, 0.44, 0.05, '#4a2e1e'); R(-0.03, 0.095, 0.06, 0.06, '#f2c14e');
      // lance arm (screen left)
      R(-0.38, 0.2, 0.13, 0.46, steel); R(-0.38, 0.2, 0.04, 0.46, steelD);
      R(-0.4, 0.14, 0.16, 0.1, steelD);
      // pauldrons
      c.fillStyle = steel;
      c.beginPath(); c.ellipse(-0.27 * k, -0.63 * k, 0.13 * k, 0.09 * k, 0, 0, Math.PI * 2); c.ellipse(0.27 * k, -0.63 * k, 0.13 * k, 0.09 * k, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = steelL;
      c.fillRect(Math.round(-0.31 * k), Math.round(-0.69 * k), Math.max(1, Math.round(0.06 * k)), Math.max(1, Math.round(0.03 * k)));
      // gorget + great helm
      R(-0.1, 0.66, 0.2, 0.08, steelD);
      poly([-0.15, 0.73, 0.15, 0.73, 0.15, 1.0, 0.11, 1.06, -0.11, 1.06, -0.15, 1.0], steel);
      R(-0.15, 0.73, 0.07, 0.27, steelD);
      R(0.03, 0.76, 0.03, 0.27, steelL);
      R(-0.12, 0.9, 0.24, 0.04, '#141418');
      R(-0.004, 0.73, 0.02, 0.17, steelD);
      R(0.05, 0.8, 0.02, 0.02, '#141418'); R(0.09, 0.8, 0.02, 0.02, '#141418'); R(0.05, 0.84, 0.02, 0.02, '#141418'); R(0.09, 0.84, 0.02, 0.02, '#141418');
      // crest plume streaming back
      const wv = Math.sin(T * 13) * 0.04;
      poly([-0.06, 1.05, 0.06, 1.05, 0.14 + wv, 1.3, 0.04 + wv, 1.42, -0.06 + wv * 0.5, 1.3], oCol.plume);
      poly([-0.02, 1.05, 0.04, 1.05, 0.06 + wv, 1.36, 0.0 + wv, 1.38], U.shade(oCol.plume, 0.35));
      c.restore();
    }

    function drawOppShield(c, cx, cy, k) {
      const w = SH_W * k, h = SH_HH * k;
      const path = () => {
        c.beginPath();
        c.moveTo(cx - w, cy - h); c.lineTo(cx + w, cy - h); c.lineTo(cx + w, cy + h * 0.05);
        c.quadraticCurveTo(cx + w * 0.9, cy + h * 0.7, cx, cy + h * 1.08);
        c.quadraticCurveTo(cx - w * 0.9, cy + h * 0.7, cx - w, cy + h * 0.05);
        c.closePath();
      };
      path(); c.fillStyle = oCol.trim; c.fill();
      c.save(); path(); c.clip();
      c.fillStyle = oCol.main;
      c.beginPath(); c.moveTo(cx - w, cy - h); c.lineTo(cx - w * 0.35, cy - h); c.lineTo(cx + w * 1.1, cy + h * 0.9); c.lineTo(cx + w * 0.4, cy + h * 1.2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.18)'; c.fillRect(cx - w, cy - h, w * 0.5, h * 2.2);
      c.restore();
      path(); c.lineWidth = Math.max(1, k * 0.035); c.strokeStyle = '#2b1d14'; c.stroke();
      // boss
      const br = Math.max(1, k * 0.075);
      c.fillStyle = '#8a5a14'; c.beginPath(); c.arc(cx, cy + 1 * (k / 40), br + Math.max(0.5, k * 0.012), 0, Math.PI * 2); c.fill();
      c.fillStyle = '#f2c14e'; c.beginPath(); c.arc(cx, cy, br, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(cx - br * 0.3, cy - br * 0.3, br * 0.35, 0, Math.PI * 2); c.fill();
    }

    function lanceQuads(c, pts, w0, w1, cols, segs) {
      // pts: [x0,y0,k0, x1,y1,k1] screen ends with their px/m scales
      const [x0, y0, k0, x1, y1, k1] = pts;
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      const nx = -dy / L, ny = dx / L;
      for (let i = 0; i < segs; i++) {
        const t0 = i / segs, t1 = (i + 1) / segs;
        const ka = U.lerp(k0, k1, t0), kb = U.lerp(k0, k1, t1);
        const wa = Math.max(0.6, U.lerp(w0, w1, t0) * ka), wb = Math.max(0.6, U.lerp(w0, w1, t1) * kb);
        const ax_ = x0 + dx * t0, ay_ = y0 + dy * t0, bx_ = x0 + dx * t1, by_ = y0 + dy * t1;
        quad(c, ax_ + nx * wa, ay_ + ny * wa, bx_ + nx * wb, by_ + ny * wb, bx_ - nx * wb, by_ - ny * wb, ax_ - nx * wa, ay_ - ny * wa, cols[i % cols.length]);
      }
    }

    function drawOppLance(c, d, ox, b) {
      const hx = ox - 0.3, hh = 1.72 + b, hz = oz;
      // couched direction: toward your chest
      let cx = 0.15 - hx, ch = 2.0 - hh, cz = camZ + 0.3 - hz;
      let cl = Math.hypot(cx, ch, cz); cx /= cl; ch /= cl; cz /= cl;
      let ux = 0.18, uh = 1, uz = -0.08;
      cl = Math.hypot(ux, uh, uz); ux /= cl; uh /= cl; uz /= cl;
      const lw = oppLower;
      let dx = U.lerp(ux, cx, lw), dh = U.lerp(uh, ch, lw), dz = U.lerp(uz, cz, lw);
      cl = Math.hypot(dx, dh, dz); dx /= cl; dh /= cl; dz /= cl;
      let len = oppLanceBroken ? 1.5 : 3.8;
      // keep the tip in front of the camera
      const tipD = hz + dz * len - camZ;
      if (tipD < NEAR + 0.2 && dz < 0) len = Math.max(0.5, (hz - camZ - NEAR - 0.2) / -dz);
      const db = Math.max(NEAR, hz - 0.5 * dz - camZ); // butt behind hand
      const tx = hx + dx * len, th = hh + dh * len, tz = hz + dz * len;
      const butX = hx - dx * 0.6, butH = hh - dh * 0.6;
      const dt = Math.max(NEAR, tz - camZ);
      const kb = f / db, kt = f / dt;
      lanceQuads(c, [X(butX, db), Y(butH, db), kb, X(tx, dt), Y(th, dt), kt], 0.07, 0.03, [oCol.main, '#f4e4c1'], 7);
      // vamplate at the grip
      const vz = hz + dz * 0.3 - camZ, vd = Math.max(NEAR, vz), vk = f / vd;
      const vx = X(hx + dx * 0.3, vd), vy = Y(hh + dh * 0.3, vd);
      c.fillStyle = '#7a808c'; c.beginPath(); c.arc(vx, vy, Math.max(1, vk * 0.15), 0, Math.PI * 2); c.fill();
      c.fillStyle = '#d0d4dc'; c.beginPath(); c.arc(vx - vk * 0.03, vy - vk * 0.03, Math.max(0.7, vk * 0.1), 0, Math.PI * 2); c.fill();
      if (!oppLanceBroken) { c.fillStyle = '#3a3a44'; c.beginPath(); c.arc(X(tx, dt), Y(th, dt), U.clamp(kt * 0.04, 0.8, 5), 0, Math.PI * 2); c.fill(); }
    }

    function drawRider(c) {
      if (!rider) return;
      const d = rider.z - camZ;
      if (d < 1.1) return;
      const k = f / d;
      drawKnight(c, X(rider.x, d), Y(rider.h + 0.3, d), k, rider.rot, false);
    }

    function drawWorldParticles(c, kind) {
      for (const p of parts) {
        if (p.kind !== kind) continue;
        const a = 1 - p.t / p.life;
        if (kind === 'puff') {
          c.globalAlpha = a * 0.5;
          c.fillStyle = p.col;
          const r = p.sz * (1 + p.t / p.life);
          c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
        } else if (kind === 'splinter') {
          c.globalAlpha = Math.min(1, a * 1.5);
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
          c.fillStyle = p.col; c.fillRect(-p.len / 2, -p.sz / 2, p.len, Math.max(1, p.sz * 0.7));
          c.restore();
        } else {
          c.globalAlpha = a;
          c.fillStyle = p.col;
          c.fillRect(Math.round(p.x), Math.round(p.y), Math.max(1, Math.round(p.sz)), Math.max(1, Math.round(p.sz)));
        }
      }
      c.globalAlpha = 1;
    }

    function drawStreaks(c) {
      if (!streaks.length) return;
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 1;
      c.beginPath();
      for (const k of streaks) {
        const cs = Math.cos(k.a), sn = Math.sin(k.a);
        const len = 10 + s * 30;
        c.moveTo(vpx + panX + cs * k.r, hy + panY + sn * k.r);
        c.lineTo(vpx + panX + cs * (k.r + len), hy + panY + sn * (k.r + len));
      }
      c.stroke();
    }

    // --- your horse, lance, gauntlet and shield
    function drawForeground(c) {
      const u = hsc;
      const run = phase === 'charge' || phase === 'resolve';
      const bob = run ? -Math.abs(Math.sin(gallopPh)) * (1.5 + s * 5) * u : Math.sin(T * 2) * 0.6 * u;
      const fall = youUnseated ? tumbleT * tumbleT * H * 1.4 : 0;
      drawHorse(c, u, bob + fall);
      drawShield(c, u, bob * 0.6 + fall);
      if (!(youUnseated && tumbleT > 0.1)) drawLance(c, u, bob * 0.8);
    }

    function drawHorse(c, u, bob) {
      const col = pCol.horse, dark = U.shade(col, -0.35), mid = U.shade(col, -0.15), light = U.shade(col, 0.2);
      const mane = U.shade(col, -0.6), maneL = U.shade(col, -0.4);
      const baseX = W / 2 + 4 * u;
      const run = phase === 'charge' || phase === 'resolve';
      const nod = run ? Math.sin(gallopPh + 1.2) * (1 + s * 3) * u : Math.sin(T * 1.5) * 0.5 * u;
      const pollX = U.lerp(baseX, vpx + panX, 0.25) + nod * 0.3;
      const pollY = H - 78 * u + bob + nod;
      const bw = 62 * u, tw = 18 * u, by = H + 6;
      // neck: dark flank, lit crest, mid right side
      quad(c, baseX - bw, by, pollX - tw, pollY + 4 * u, pollX + tw, pollY + 4 * u, baseX + bw, by, mid);
      quad(c, baseX - bw, by, pollX - tw, pollY + 4 * u, pollX - tw * 0.4, pollY + 4 * u, baseX - bw * 0.45, by, dark);
      quad(c, baseX - bw * 0.45, by, pollX - tw * 0.4, pollY + 4 * u, pollX + tw * 0.35, pollY + 4 * u, baseX + bw * 0.2, by, light);
      // muscle highlight lines
      c.strokeStyle = U.shade(col, 0.32); c.lineWidth = Math.max(1, 1.2 * u);
      c.beginPath(); c.moveTo(baseX - bw * 0.2, by - 8 * u); c.quadraticCurveTo(pollX - 6 * u, pollY + 40 * u, pollX - 4 * u, pollY + 14 * u); c.stroke();
      // poll / forehead top, rounded
      c.fillStyle = light;
      c.beginPath(); c.ellipse(pollX, pollY + 3 * u, tw * 0.95, 7 * u, 0, Math.PI, 0); c.fill();
      c.fillStyle = mid;
      c.beginPath(); c.ellipse(pollX, pollY - 1 * u, tw * 0.6, 4 * u, 0, Math.PI, 0); c.fill();
      // ears (pricked forward while charging)
      const perk_ = run ? -2 * u : 0;
      for (const sd of [-1, 1]) {
        const ex = pollX + sd * 10 * u, ey = pollY + 1 * u;
        c.fillStyle = col;
        c.beginPath(); c.moveTo(ex - 4.5 * u, ey); c.quadraticCurveTo(ex - 3 * u + sd * u, ey - 10 * u + perk_, ex + sd * 1.5 * u, ey - 15 * u + perk_); c.quadraticCurveTo(ex + 4 * u + sd * u, ey - 8 * u + perk_, ex + 4.5 * u, ey); c.closePath(); c.fill();
        c.fillStyle = dark;
        c.beginPath(); c.moveTo(ex - 2 * u, ey - 1 * u); c.quadraticCurveTo(ex - 1 * u, ey - 8 * u + perk_, ex + sd * 1.2 * u, ey - 11 * u + perk_); c.quadraticCurveTo(ex + 2 * u, ey - 6 * u + perk_, ex + 2 * u, ey - 1 * u); c.closePath(); c.fill();
      }
      // bridle: headstall behind the ears + browband in front, with your colours
      c.strokeStyle = '#4a2a12'; c.lineWidth = Math.max(1, 2.2 * u);
      c.beginPath(); c.moveTo(pollX - tw * 0.95, pollY + 9 * u); c.quadraticCurveTo(pollX, pollY + 1 * u, pollX + tw * 0.95, pollY + 9 * u); c.stroke();
      c.strokeStyle = pCol.main; c.lineWidth = Math.max(1, 1.6 * u);
      c.beginPath(); c.moveTo(pollX - tw * 0.8, pollY - 1 * u); c.quadraticCurveTo(pollX, pollY - 5 * u, pollX + tw * 0.8, pollY - 1 * u); c.stroke();
      c.fillStyle = pCol.trim;
      c.beginPath(); c.arc(pollX - tw * 0.8, pollY - 1 * u, 1.8 * u, 0, Math.PI * 2); c.arc(pollX + tw * 0.8, pollY - 1 * u, 1.8 * u, 0, Math.PI * 2); c.fill();
      // forelock tuft between the ears, streaming back
      c.strokeStyle = mane; c.lineCap = 'round';
      for (let i = 0; i < 4; i++) {
        const fx = pollX + (i - 1.5) * 2.5 * u;
        c.lineWidth = Math.max(1, 2.2 * u);
        c.beginPath(); c.moveTo(fx, pollY - 1 * u); c.quadraticCurveTo(fx + Math.sin(T * 11 + i) * 2 * u, pollY + 5 * u, fx + 2 * u + Math.sin(T * 9 + i * 2) * 2 * u, pollY + 10 * u); c.stroke();
      }
      // mane along the crest, falling to the right
      const n = 10;
      const ptsL = [], ptsR = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const cx = U.lerp(pollX + 1 * u, baseX + 8 * u, t), cy = U.lerp(pollY + 6 * u, by, t);
        const w = (3 + t * 9) * u;
        const flow = (1 + s * 4) * u * Math.sin(T * (7 + s * 10) - i * 0.9);
        ptsL.push(cx - w * 0.3, cy);
        ptsR.push(cx + w + flow + (i & 1 ? 3 * u : 0), cy + (i & 1 ? 3 * u : 0));
      }
      c.fillStyle = mane;
      c.beginPath(); c.moveTo(ptsL[0], ptsL[1]);
      for (let i = 2; i < ptsL.length; i += 2) c.lineTo(ptsL[i], ptsL[i + 1]);
      for (let i = ptsR.length - 2; i >= 0; i -= 2) c.lineTo(ptsR[i], ptsR[i + 1]);
      c.closePath(); c.fill();
      c.strokeStyle = maneL; c.lineWidth = Math.max(1, u);
      c.beginPath();
      for (let i = 1; i < n; i += 2) { c.moveTo(ptsL[i * 2] + 2 * u, ptsL[i * 2 + 1]); c.lineTo(ptsR[i * 2] - 2 * u, ptsR[i * 2 + 1] - 1 * u); }
      c.stroke();
      c.lineCap = 'butt';
      // reins down the sides of the neck to your hands
      c.strokeStyle = '#3a2210'; c.lineWidth = Math.max(1, 1.8 * u);
      c.beginPath();
      c.moveTo(pollX - tw * 1.05, pollY + 8 * u); c.quadraticCurveTo(pollX - tw * 1.6, pollY + 40 * u, baseX - 26 * u, by);
      c.moveTo(pollX + tw * 1.05, pollY + 8 * u); c.quadraticCurveTo(pollX + tw * 1.6, pollY + 40 * u, baseX + 30 * u, by);
      c.stroke();
    }

    function drawShield(c, u, bob) {
      // top-right corner of your heater shield on the left arm
      const jolt = hitJolt * 10 * u;
      const x0 = -10 - jolt, y0 = H - 66 * u + bob + jolt * 0.6;
      const path = () => {
        c.beginPath();
        c.moveTo(x0, y0); c.lineTo(x0 + 70 * u, y0 + 6 * u);
        c.quadraticCurveTo(x0 + 66 * u, y0 + 50 * u, x0 + 40 * u, H + 10);
        c.lineTo(x0, H + 10); c.closePath();
      };
      path(); c.fillStyle = pCol.shield; c.fill();
      c.save(); path(); c.clip();
      c.fillStyle = pCol.trim;
      quad(c, x0 + 28 * u, y0, x0 + 44 * u, y0 + 2 * u, x0 + 20 * u, H + 10, x0 + 4 * u, H + 10, pCol.trim);
      c.fillStyle = 'rgba(255,255,255,0.2)';
      c.fillRect(x0, y0, 80 * u, 6 * u);
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(x0 + 50 * u, y0, 40 * u, H);
      c.restore();
      path(); c.strokeStyle = '#c8ccd6'; c.lineWidth = Math.max(1.5, 3 * u); c.stroke();
      path(); c.strokeStyle = '#2b1d14'; c.lineWidth = 1; c.stroke();
      // rivets
      c.fillStyle = '#eef2f8';
      for (let i = 0; i < 4; i++) c.fillRect(Math.round(x0 + (10 + i * 16) * u), Math.round(y0 + (3 + i * 1.4) * u), Math.max(1, Math.round(1.5 * u)), Math.max(1, Math.round(1.5 * u)));
    }

    function drawLance(c, u, bob) {
      const r = reticle();
      const lift = phase === 'resolve' || phase === 'card' || phase === 'outro' ? U.ease.outCubic(U.clamp((pt - 0.5) / 1.2, 0, 1)) * H * 0.25 : 0;
      const tipX = r.x + lift * 0.3, tipY = r.y - lift;
      const buttX = W + 14 * u, buttY = H + 20 * u + bob;
      const len = Math.hypot(tipX - buttX, tipY - buttY);
      const brk = lanceBroken ? 0.5 : 1;
      const ex = U.lerp(buttX, tipX, brk), ey = U.lerp(buttY, tipY, brk);
      // shaft widths: near = big, tip = small
      const kNear = 1, kTip = 1;
      lanceQuads(c, [buttX, buttY, kNear, ex, ey, kTip], 12 * u, lanceBroken ? 4 * u : 1.6, [pCol.main, '#f4e4c1'], 8);
      // shading line
      c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = Math.max(1, 2 * u);
      c.beginPath(); c.moveTo(buttX, buttY + 6 * u); c.lineTo(ex, ey + (lanceBroken ? 2 * u : 0.5)); c.stroke();
      if (lanceBroken) {
        c.fillStyle = '#e9d9b0';
        const ang = Math.atan2(ey - buttY, ex - buttX);
        for (let i = -2; i <= 2; i++) {
          const a = ang + i * 0.25;
          quad(c, ex - Math.sin(ang) * i * 1.5 * u, ey + Math.cos(ang) * i * 1.5 * u, ex + Math.cos(a) * (6 + (i & 1) * 4) * u, ey + Math.sin(a) * (6 + (i & 1) * 4) * u, ex + Math.cos(a) * (6 + (i & 1) * 4) * u + 1, ey + Math.sin(a) * (6 + (i & 1) * 4) * u + 1, ex - Math.sin(ang) * (i + 0.6) * 1.5 * u, ey + Math.cos(ang) * (i + 0.6) * 1.5 * u, '#e9d9b0');
        }
      } else {
        // coronel tip
        c.fillStyle = '#3a3a44'; c.beginPath(); c.arc(tipX, tipY, 1.6, 0, Math.PI * 2); c.fill();
      }
      // vamplate (cone hand-guard)
      const t = Math.min(0.42, (60 * u) / Math.max(1, len));
      const vx = U.lerp(buttX, tipX, t), vy = U.lerp(buttY, tipY, t);
      c.fillStyle = '#6a707c';
      c.beginPath(); c.ellipse(vx + 2 * u, vy + 2 * u, 20 * u, 17 * u, -0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#b8bec8';
      c.beginPath(); c.ellipse(vx, vy, 19 * u, 16 * u, -0.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e8ecf2';
      c.beginPath(); c.ellipse(vx - 6 * u, vy - 5 * u, 7 * u, 4 * u, -0.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#3a3a44'; c.lineWidth = 1;
      c.beginPath(); c.ellipse(vx, vy, 19 * u, 16 * u, -0.5, 0, Math.PI * 2); c.stroke();
      // gauntlet below/behind the vamplate
      const gx = vx + 14 * u, gy = vy + 18 * u;
      c.fillStyle = '#8a909c';
      c.beginPath(); c.ellipse(gx, gy, 14 * u, 11 * u, -0.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#c8ccd6';
      for (let i = 0; i < 3; i++) c.fillRect(Math.round(gx - 10 * u + i * 6 * u), Math.round(gy - 8 * u + i * 2 * u), Math.round(5 * u), Math.max(1, Math.round(3 * u)));
      c.fillStyle = pCol.main;
      c.fillRect(Math.round(gx + 4 * u), Math.round(gy + 4 * u), Math.round(20 * u), Math.round(30 * u));
    }

    function drawDirt(ctx) {
      ctx.fillStyle = '#8a643a'; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) {
        const x = U.hash2(i, 1) * W, y = U.hash2(i, 2) * H;
        ctx.fillStyle = i & 1 ? '#6e4c2a' : '#a07848';
        ctx.fillRect(Math.round(x), Math.round(y), 2 + (i % 4), 1 + (i % 3));
      }
      const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(20,10,0,0.75)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }

    // ==================================================================== HUD
    function drawHUD(ctx, ox, oy) {
      const D = G.draw;
      if (phase !== 'intro') drawScoreBar(ctx);
      if (phase === 'ready' || phase === 'charge') {
        drawGauge(ctx);
        drawReticle(ctx, ox, oy);
      }
      if (phase === 'ready') {
        const a = Math.min(1, pt * 3);
        ctx.globalAlpha = a;
        const by = Math.round(H * 0.13);
        const bw = Math.min(W - 12, 260);
        D.rrect(W / 2 - bw / 2, by, bw, 36, 4, 'rgba(25,15,8,0.82)', '#f2c14e', 1);
        D.text(`Pass ${passN}${passN > 3 ? ' — SUDDEN DEATH' : ` of 3`}`, W / 2, by + 4, { size: 10, align: 'center', color: '#ffe48a', bold: true });
        const line = pt < 1.3 ? `${opp.name}, ${opp.herald || 'enters the lists!'}` : `${oppShort} salutes you!`;
        D.text(line, W / 2, by + 18, { size: 7, align: 'center', color: '#f4e4c1', maxW: bw - 10, lineH: 8 });
        ctx.globalAlpha = 1;
        if (pt > 1.5) {
          const sc = 1 + Math.sin(T * 10) * 0.05;
          D.text('Get ready to spur!', W / 2, H * 0.58, { size: Math.round(10 * sc), align: 'center', color: '#fff', outline: '#2b1d14', bold: true });
        }
      }
      if (phase === 'charge' && tti < RING_T + 0.2 && passN <= 2 && !brace) drawHint(ctx, 'Tap as the ring closes!', 1);
      else if (phase === 'charge' && passN === 1 && hintT < 8) drawHint(ctx, 'Tap RIGHT in rhythm: spur  •  Drag LEFT: aim lance', Math.min(1, (8 - hintT) * 2));
      else if (phase === 'ready' && passN === 1) drawHint(ctx, 'Tap RIGHT: spur & strike  •  Drag LEFT: aim', 1);
      if (phase === 'charge' && passN === 1 && hintT < 7 && tti > RING_T) {
        D.text('Spur with taps!', W - 22, H * 0.38, { size: 8, align: 'right', color: '#fff', outline: '#2b1d14', bold: true });
      }
      // pops
      for (const p of pops) {
        if (p.t < 0) continue;
        const a = p.t < 0.15 ? p.t / 0.15 : p.t > p.life - 0.3 ? Math.max(0, (p.life - p.t) / 0.3) : 1;
        const sc = p.t < 0.15 ? 1.6 - (p.t / 0.15) * 0.6 : 1;
        ctx.globalAlpha = a;
        const x = p.at ? p.at.x + ox : W / 2, y = p.at ? p.at.y + oy : H * p.y;
        D.text(p.text, x, y, { size: Math.round(p.size * sc), align: 'center', baseline: 'middle', color: p.color, outline: '#2b1d14', outlineW: Math.max(2, p.size / 5), bold: true });
        if (p.sub) D.text(p.sub, x, y + p.size * 0.9 + 2, { size: 8, align: 'center', baseline: 'middle', color: '#fff', outline: '#2b1d14', bold: true });
        ctx.globalAlpha = 1;
      }
      if (phase === 'intro') drawIntro(ctx);
      if (phase === 'card') drawCard(ctx);
      if (phase === 'outro') drawOutro(ctx);
    }

    function drawHint(ctx, text, a) {
      const D = G.draw;
      ctx.globalAlpha = a;
      const y = H * 0.665;
      const w = Math.min(W - 8, D.measure(text, 7) + 14);
      D.rrect(W / 2 - w / 2, y, w, 13, 6, 'rgba(25,15,8,0.75)', 'rgba(255,228,138,0.6)', 1);
      D.text(text, W / 2, y + 7, { size: 7, align: 'center', baseline: 'middle', color: '#fff3d6' });
      ctx.globalAlpha = 1;
    }

    function drawScoreBar(ctx) {
      const D = G.draw;
      const b = bout();
      const h = 24, y = 3, x = 3, w = W - 6;
      D.rrect(x, y, w, h, 4, 'rgba(25,15,8,0.8)', '#c9893c', 1);
      G.chars.portrait(ctx, pLookRaw, x + 3, y + 3, 18);
      D.text('YOU', x + 24, y + 4, { size: 7, color: '#c9d8ff' });
      D.text(String(b.y), x + 24, y + 12, { size: 10, color: '#fff', bold: true });
      G.chars.portrait(ctx, opp.look, x + w - 21, y + 3, 18);
      D.text(oppBarName, x + w - 24, y + 4, { size: 7, align: 'right', color: '#ffc8b0' });
      D.text(String(b.t), x + w - 24, y + 12, { size: 10, align: 'right', color: '#fff', bold: true });
      // pass pips
      const total = Math.max(3, passN, passes.length);
      const pw = Math.min(20, Math.floor((W - 110) / total)), cx0 = W / 2 - (total * pw) / 2;
      D.text(passN > 3 ? 'SUDDEN DEATH' : 'PASS', W / 2, y + 3, { size: 6, align: 'center', color: '#f2c14e' });
      for (let i = 0; i < total; i++) {
        const px = cx0 + i * pw + 1, py = y + 11;
        const p = passes[i];
        const cur = i === passN - 1 && !p;
        D.rrect(px, py, pw - 2, 10, 2, cur ? 'rgba(242,193,78,0.35)' : 'rgba(255,255,255,0.08)', cur ? '#f2c14e' : 'rgba(255,255,255,0.25)', 1);
        if (p) {
          const pc = p.you > p.them ? '#8cf26a' : p.you < p.them ? '#ff8a6a' : '#f4e4c1';
          D.text(`${p.you}-${p.them}`, px + (pw - 2) / 2, py + 5.5, { size: 6, align: 'center', baseline: 'middle', color: pc });
        }
      }
    }

    function drawGauge(ctx) {
      const D = G.draw;
      const gw = 8, gx = W - gw - 6;
      const gy0 = Math.round(H * (H > W ? 0.42 : 0.28)), gh = Math.round(H * (H > W ? 0.22 : 0.42));
      const y = (v) => gy0 + gh - (v / S_MAX) * gh;
      D.rrect(gx - 2, gy0 - 2, gw + 4, gh + 4, 3, 'rgba(25,15,8,0.8)', '#c9893c', 1);
      D.rect(gx, y(SWEET_LO), gw, y(0) - y(SWEET_LO), '#3a4a5a');
      D.rect(gx, y(SWEET_HI), gw, y(SWEET_LO) - y(SWEET_HI), '#3f9a3a');
      D.rect(gx, y(S_MAX), gw, y(SWEET_HI) - y(S_MAX), '#9a2f22');
      // fill
      const fy = y(Math.min(S_MAX, s));
      const inSweet = s >= SWEET_LO && s <= SWEET_HI;
      const fc = s > SWEET_HI ? '#ff6a4a' : inSweet ? '#8cf26a' : '#9ac8ff';
      D.rect(gx + 2, fy, gw - 4, y(0) - fy, fc);
      // needle
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(gx - 6, fy - 3); ctx.lineTo(gx - 1, fy); ctx.lineTo(gx - 6, fy + 3); ctx.closePath(); ctx.fill();
      D.text('SPEED', gx + gw / 2, gy0 - 11, { size: 6, align: 'center', color: '#fff', outline: '#2b1d14' });
      if (s > SWEET_HI) D.text('WILD!', gx - 8, fy - 4, { size: 7, align: 'right', color: '#ff8a6a', outline: '#2b1d14', bold: true });
      // spur stamina pips
      const pipY = gy0 + gh + 6;
      const cols = Math.ceil(maxStam / 9);
      for (let i = 0; i < maxStam; i++) {
        const cx = gx + gw + 1 - (Math.floor(i / 9) + 1) * 4 - 0, cy = pipY + (i % 9) * 3;
        D.rect(cx + cols * 0, cy, 3, 2, i < stamina ? '#f2c14e' : 'rgba(255,255,255,0.18)');
      }
      // beat pulse (hoof)
      const bx = gx + gw / 2, by = gy0 - 22;
      const pr = 4 + beatFlash * 3;
      D.circle(bx, by, pr, rhythmFlash > 0 ? `rgba(140,242,106,${0.4 + rhythmFlash * 0.6})` : `rgba(255,255,255,${0.15 + beatFlash * 0.6})`, '#2b1d14', 1);
      if (beatFlash > 0) D.circle(bx, by, 4 + (1 - beatFlash) * 9, null, `rgba(255,255,255,${beatFlash * 0.7})`, 1);
    }

    function drawReticle(ctx, ox, oy) {
      if (phase !== 'charge' && phase !== 'ready') return;
      const r = reticle();
      const x = r.x + ox, y = r.y + oy;
      // colour feedback: over the shield / boss
      let col = '#ffffff';
      const sh = oppShield();
      const d = oz - camZ;
      if (d < 40) {
        const n = Math.hypot((r.x - sh.x) / (SH_W * sh.k), (r.y - sh.y) / (SH_HH * sh.k));
        if (n <= BOSS_N) col = '#ffd04a'; else if (n <= 1) col = '#8cf26a';
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(20,10,5,0.7)';
      ctx.beginPath(); ctx.arc(x, y, 5.5, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 9, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 9);
      ctx.stroke();
      // timing ring
      if (phase === 'charge' && tti < RING_T) {
        const t = Math.max(0, tti);
        const rr = 4.5 + (t / RING_T) * 46;
        const live = t <= BRACE_T;
        const perfect = Math.abs(t) <= 0.055 * champ;
        let rc = live ? (perfect ? '#8cf26a' : '#ffe48a') : 'rgba(255,255,255,0.45)';
        if (brace) rc = brace.tq >= 0.8 ? '#8cf26a' : '#ffb08a';
        ctx.lineWidth = live ? 2 : 1;
        ctx.strokeStyle = 'rgba(20,10,5,0.6)';
        ctx.beginPath(); ctx.arc(x, y, rr + 1, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = rc;
        ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.stroke();
        // target band
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(140,242,106,0.5)';
        ctx.beginPath(); ctx.arc(x, y, 4.5 + (0.055 * champ / RING_T) * 46, 0, Math.PI * 2); ctx.stroke();
        if (grace >= 0 && !brace) G.draw.text('NOW!', x, y - 22, { size: 10, align: 'center', color: '#ffe48a', outline: '#2b1d14', bold: true });
        if (brace && brace.grade) G.draw.text('BRACED', x, y + 14, { size: 6, align: 'center', color: '#fff', outline: '#2b1d14' });
      }
    }

    function drawIntro(ctx) {
      const D = G.draw;
      const a = Math.min(1, pt * 3);
      ctx.globalAlpha = a * 0.6; D.rect(0, 0, W, H, '#000'); ctx.globalAlpha = a;
      const bw = Math.min(W - 16, 230), bh = 118;
      const bx = Math.round(W / 2 - bw / 2), by = Math.round(H / 2 - bh / 2 - (1 - U.ease.outBack(Math.min(1, pt * 2.5))) * 30);
      D.panel(bx, by, bw, bh);
      D.text(opts.title || 'Joust at the Lists', W / 2, by + 9, { size: 10, align: 'center', color: '#7a2a1a', bold: true, maxW: bw - 16 });
      const py = by + 34;
      D.rrect(bx + 16, py, 34, 34, 3, '#c9dcf0', '#7a4b2a', 1);
      G.chars.portrait(ctx, pLookRaw, bx + 17, py + 1, 32);
      D.rrect(bx + bw - 50, py, 34, 34, 3, '#f0d0c0', '#7a4b2a', 1);
      G.chars.portrait(ctx, opp.look, bx + bw - 49, py + 1, 32);
      D.text('VS', W / 2, py + 17, { size: 14, align: 'center', baseline: 'middle', color: '#d6453d', outline: '#2b1d14', bold: true });
      D.text('You', bx + 33, py + 38, { size: 7, align: 'center' });
      D.text(opp.name, bx + bw - 33, py + 38, { size: 7, align: 'center', maxW: 70 });
      if (opp.title) D.text(opp.title, bx + bw - 33, py + 47, { size: 6, align: 'center', color: '#7a4b2a' });
      D.text('Best of 3 passes', W / 2, by + bh - 14, { size: 7, align: 'center', color: '#5a3a24' });
      ctx.globalAlpha = 1;
    }

    function drawCard(ctx) {
      const D = G.draw;
      const a = Math.min(1, pt * 4);
      ctx.globalAlpha = a * 0.55; D.rect(0, 0, W, H, '#000'); ctx.globalAlpha = a;
      const rows = passes.length;
      const bw = Math.min(W - 14, 240), bh = 104 + rows * 11;
      const bx = Math.round(W / 2 - bw / 2), by = Math.round(H / 2 - bh / 2 - (1 - U.ease.outBack(Math.min(1, pt * 3))) * 20);
      D.panel(bx, by, bw, bh);
      D.text(opts.title || 'The Lists', W / 2, by + 7, { size: 8, align: 'center', color: '#7a2a1a', bold: true });
      const b = bout();
      const py = by + 20;
      D.rrect(bx + 10, py, 26, 26, 3, '#c9dcf0', '#7a4b2a', 1);
      G.chars.portrait(ctx, pLookRaw, bx + 11, py + 1, 24);
      D.rrect(bx + bw - 36, py, 26, 26, 3, '#f0d0c0', '#7a4b2a', 1);
      G.chars.portrait(ctx, opp.look, bx + bw - 35, py + 1, 24);
      D.text(`${b.y}  –  ${b.t}`, W / 2, py + 13, { size: 16, align: 'center', baseline: 'middle', color: '#2b1d14', bold: true });
      D.text('You', bx + 23, py + 29, { size: 6, align: 'center' });
      D.text(oppShort, bx + bw - 23, py + 29, { size: 6, align: 'center' });
      const ty = py + 42;
      const lbl = ['miss', 'glance', 'shield', 'broke!'];
      D.text('pass', bx + 14, ty, { size: 6, color: '#7a4b2a' });
      D.text('you', W / 2 - 22, ty, { size: 6, align: 'center', color: '#7a4b2a' });
      D.text(oppShort.slice(0, 8).toLowerCase(), W / 2 + 34, ty, { size: 6, align: 'center', color: '#7a4b2a' });
      passes.forEach((p, i) => {
        const yy = ty + 10 + i * 11;
        D.rect(bx + 8, yy - 1, bw - 16, 1, 'rgba(122,75,42,0.25)');
        D.text(String(i + 1), bx + 16, yy + 1, { size: 7 });
        D.text(`${p.you}  ${lbl[p.you]}`, W / 2 - 22, yy + 1, { size: 7, align: 'center', color: p.you >= 2 ? '#2f7a3a' : '#2b1d14' });
        D.text(`${p.them}  ${lbl[p.them]}`, W / 2 + 34, yy + 1, { size: 7, align: 'center', color: p.them >= 2 ? '#a02a1a' : '#2b1d14' });
      });
      const next = passN + 1;
      const fy = by + bh - 28;
      const nextLbl = next <= 3 ? `Pass ${next} of 3` : `Tied! Sudden death: pass ${next} of 5`;
      D.text(nextLbl, W / 2, fy, { size: 9, align: 'center', color: next > 3 ? '#a02a1a' : '#2b1d14', bold: true });
      if (Math.sin(T * 5) > -0.3) D.text('Tap to ride!', W / 2, fy + 12, { size: 7, align: 'center', color: '#7a4b2a' });
      ctx.globalAlpha = 1;
    }

    function drawOutro(ctx) {
      const D = G.draw;
      const a = Math.min(1, pt * 2);
      ctx.globalAlpha = a * 0.5; D.rect(0, 0, W, H, won ? '#2a1a00' : '#1a0000'); ctx.globalAlpha = 1;
      const sc = U.ease.outElastic(Math.min(1, pt * 1.2));
      const b = bout();
      ctx.save();
      ctx.translate(W / 2, H * 0.36);
      ctx.scale(Math.max(0.01, sc), Math.max(0.01, sc));
      D.text(won ? 'VICTORY!' : 'DEFEATED', 0, 0, { size: 26, align: 'center', baseline: 'middle', color: won ? '#ffd04a' : '#ff6a5a', outline: '#2b1d14', outlineW: 5, bold: true });
      ctx.restore();
      if (pt > 0.5) {
        ctx.globalAlpha = Math.min(1, (pt - 0.5) * 3);
        D.text(endReason, W / 2, H * 0.36 + 22, { size: 8, align: 'center', color: '#fff', outline: '#2b1d14', bold: true, maxW: W - 20 });
        const last = passes[passes.length - 1];
        const unhorse = last && (last.unA || last.unB);
        if (!unhorse) D.text(`Final score  ${b.y} – ${b.t}`, W / 2, H * 0.36 + 44, { size: 9, align: 'center', color: '#ffe48a', outline: '#2b1d14', bold: true });
        if (pt > 1.2 && Math.sin(T * 5) > -0.3) D.text('Tap to continue', W / 2, H * 0.66, { size: 7, align: 'center', color: '#fff', outline: '#2b1d14' });
        ctx.globalAlpha = 1;
      }
    }

    return scene;
  }

  G.battle.register('joust', make);
})();
