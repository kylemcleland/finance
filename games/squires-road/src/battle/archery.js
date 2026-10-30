// Archery contest (DESIGN.md §7c): first-person view down a festive range.
// Hold R to draw, L-drag to aim, release to loose. 3 ends × 3 arrows vs rivals.
(() => {
  const U = G.U;
  const D = () => G.draw;

  const CAM_H = 1.6;   // eye height (m)
  const FACE_H = 1.25; // target face centre height (m)
  const ARROWS_PER_END = 3, ENDS = 3;
  const Z0 = 2.2;      // arrow launch depth (m)
  const RING_COL = ['#f6d04a', '#d6453d', '#3f7fd1', '#26262c', '#f4efe2'];
  const RING_LINE = ['#a8801a', '#8a231d', '#244f8e', '#6a6a72', '#9a9488'];
  const SCORE_COL = { 10: '#f6d04a', 8: '#e8574e', 6: '#4f8fe1', 4: '#3a3a42', 2: '#f4efe2', 0: '#8a7a6a' };

  const TIERS = {
    1: { D: 22, R: 0.6, wMin: 0.6, wMax: 1.1, osc: 0.08, perArrow: 0, gust: 0, change: 0, move: 0 },
    2: { D: 30, R: 0.6, wMin: 1.2, wMax: 2.4, osc: 0.3, perArrow: 0.7, gust: 0, change: 0, move: 0 },
    3: { D: 32, R: 0.6, wMin: 0.9, wMax: 2.0, osc: 0.25, perArrow: 0.4, gust: 1.7, change: 0, move: 'all', moveAmp: 1.3, moveSpd: 0.85 },
    4: { D: 40, R: 0.5, wMin: 1.3, wMax: 2.6, osc: 0.3, perArrow: 0.5, gust: 2.1, change: 1, move: 'final', moveAmp: 1.1, moveSpd: 0.75 },
  };

  // --- rival simulation -------------------------------------------------------
  function expScore(s) {
    let e = 0;
    for (let k = 1; k <= 5; k++) { const a = 0.2 * k; e += 2 * (1 - Math.exp(-(a * a) / (2 * s * s))); }
    return e;
  }
  function sigmaFor(mean) {
    mean = U.clamp(mean, 0.5, 9.8);
    let lo = 0.005, hi = 6;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (expScore(m) > mean) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function gauss() { return Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(Math.PI * 2 * Math.random()); }
  function ringScore(r, r10) {
    if (r <= r10) return 10;
    if (r <= 0.4) return 8;
    if (r <= 0.6) return 6;
    if (r <= 0.8) return 4;
    if (r <= 1.0) return 2;
    return 0;
  }
  function rivalArrow(rv, pressure) {
    const s = rv.sigma * rv.form * (1 + pressure * rv.nerve * Math.random() * 1.6);
    const r = s * Math.sqrt(-2 * Math.log(1 - Math.random()));
    const a = Math.random() * Math.PI * 2;
    return { score: ringScore(r, 0.2), rx: Math.cos(a) * r, ry: Math.sin(a) * r, r };
  }

  function make(opts, done) {
    opts = opts || {};
    const tier = U.clamp(opts.tier | 0 || 1, 1, 4);
    const T = TIERS[tier];
    const st = G.player.stats();
    const bow = st.bow || G.items.short_bow || { power: 0.8, steady: 0.3, draw: 0.9, name: 'Short Bow' };
    const perk = (id) => G.player.hasPerk(id);
    const drawTime = (bow.draw || 0.9) * (perk('quick_draw') ? 0.65 : 1);
    const bp = bow.power || 1, steady = U.clamp(bow.steady || 0.3, 0, 0.95);
    const R10 = perk('bullseye') ? 0.28 : 0.2;
    const breathTime = 2.6 + 2 * steady;
    const swayBase = 0.0058 * T.D * (1 - 0.6 * steady) * (perk('calm_breath') ? 0.65 : 1);
    const pLook = G.chars.resolve(G.state.look || 'hero');

    // rivals
    const rivals = (opts.rivals && opts.rivals.length ? opts.rivals : ['arch_tam']).map((id) => {
      let r = G.roster.archery && G.roster.archery[id];
      if (!r) { console.warn('archery: unknown rival', id); r = { name: id, look: 'archer', skill: 0.6 }; }
      const skill = U.clamp(r.skill ?? 0.6, 0.05, 0.98);
      return {
        id, name: r.name || id, look: r.look || 'archer', quip: r.quip, skill,
        sigma: sigmaFor(skill * 10), spread: r.spread ?? 1, nerve: r.nerve ?? (1 - skill) * 0.9,
        form: 1, ends: [], total: 0, sd: null, anim: Math.random() * 6, shootT: -1,
      };
    });

    // --- scene state ------------------------------------------------------------
    let t = 0, phase = 'intro', phaseT = 0;
    let end = 0, arrowIdx = 0;
    const mine = [];           // per end: [{score, rx, ry, r}]
    let myTotal = 0;
    let finished = false;
    let hintT = 0, hintDone = false;
    const introDur = rivals.some((r) => r.quip) ? 3.2 : G.BUI.INTRO_T;
    let armed = false, drawing = false, power = 0, breath = 1, shakeT = 0, fullT = 0;
    let aimX = 0, aimY = 0, lastL = null;
    let swayT = Math.random() * 10, swX = 0, swY = 0;
    let zoom = 1, shake = 0, recoil = 0, stringVib = 0, targetWob = 0;
    let flight = null, lastHit = null, popup = null;
    let stuck = [];            // arrows in the target this end {rx, ry} (m, rel. to face)
    let grounded = [];         // arrows in grass {x, z}
    let board = null, sudden = false, sdResult = null, outcome = null;
    let drawEl = 0, heartT = 0, creaked = false, fullClick = false, bowIn = 0;
    let targetT = Math.random() * 10;
    const parts = [];
    const petals = [];
    const crowd = [];
    let cheer = 0;

    // wind
    const wind = { base: 0, target: 0, cur: 0, gust: 0, gustT: 0, gustDur: 0, gustAmp: 0, nextGust: 3, changeT: 6, osc: Math.random() * 10 };
    function rollWind(keepSign) {
      const sgn = keepSign && wind.base ? Math.sign(wind.base) : (Math.random() < 0.5 ? -1 : 1);
      wind.target = sgn * U.rand(T.wMin, T.wMax);
    }
    rollWind(false);
    wind.base = wind.target; wind.cur = wind.base;

    // crowd
    const crowdLooks = ['villagerM', 'villagerF', 'child', 'merchant', 'elder', 'innkeep', 'smith', 'monk', 'guard', 'noble'];
    for (let side = 0; side < 2; side++) {
      for (let i = 0; i < 9; i++) {
        crowd.push({
          side, row: i % 2, i: Math.floor(i / 2) + (i % 2) * 0.5,
          look: U.pick(crowdLooks), ph: Math.random() * 6, jump: 0,
        });
      }
    }
    for (let i = 0; i < 10; i++) petals.push({ x: Math.random(), y: Math.random(), s: U.rand(0.6, 1.4), ph: Math.random() * 6, c: U.pick(['#fff3b0', '#ffb0c8', '#ffffff', '#ffd27a']) });

    // geometry (recomputed each frame; G.W/G.H may change)
    const g = { W: 0, H: 0, min: 0, F: 0, cx: 0, hy: 0, land: false, lat: 1 };
    function geo() {
      g.W = G.W; g.H = G.H; g.min = Math.min(g.W, g.H); g.land = g.W > g.H * 1.15;
      g.F = (4.2 + 0.5 * Math.max(0, tier - 2)) * g.min; g.cx = g.W / 2; g.hy = g.H * (g.land ? 0.36 : 0.4);
      g.pvx = g.cx; g.pvy = g.hy + (CAM_H - FACE_H) * g.F / T.D;
      g.Rpx = T.R * g.F / T.D;
    }
    const proj = (x, y, z) => { const s = g.F / z; return [g.cx + x * s, g.hy + (CAM_H - y) * s]; };
    // world-layer (pre-zoom) → screen
    const toScr = (x, y) => [g.pvx + (x - g.pvx) * zoom + shx, g.pvy + (y - g.pvy) * zoom + shy];
    let shx = 0, shy = 0;

    const moving = () => T.move === 'all' || (T.move === 'final' && end === ENDS - 1 && !sudden) || (T.move === 'final' && sudden);
    const targetX = (tt) => (moving() ? T.moveAmp * Math.sin(tt * T.moveSpd) : 0);

    function swayAmp() {
      let m;
      if (!drawing) m = 0.55;
      else if (power < 1) m = U.lerp(0.55, 0.9, power);
      else m = 0.7 + 1.1 * Math.pow(1 - breath, 1.5);
      return swayBase * m;
    }

    // --- phases -----------------------------------------------------------------
    function setPhase(p) { phase = p; phaseT = 0; }
    function startEnd() {
      stuck = []; grounded = [];
      arrowIdx = 0;
      mine[end] = [];
      for (const rv of rivals) rv.form = Math.max(0.6, 1 + (Math.random() - 0.5) * 0.35 * rv.spread);
      if (tier >= 2) rollWind(Math.random() < 0.7);
      toAim();
    }
    function toAim() {
      armed = false; drawing = false; power = 0; breath = 1; shakeT = 0; fullT = 0; creaked = false; fullClick = false;
      setPhase('aim');
    }

    function loose() {
      const p = power;
      drawing = false;
      if (!hintDone) { hintDone = true; }
      const v = 30 + 42 * p * bp;
      const tF = T.D / v;
      const dur = U.clamp(tF * 1.7, 0.45, 1.0);
      const drift = wind.cur * tF * 0.62 / bp;
      const drop = (1 - p) * T.D * 0.045;
      const noise = 0.012 * T.D / 22 * (1.3 - steady);
      const hx = aimX + swX + drift + gauss() * noise;
      const hy = aimY + swY - drop + gauss() * noise;
      const short = p < 0.4;
      // launch point: the arrowhead on screen, unprojected to z0
      const B = bowGeo();
      const ahx = B.gx - B.vx * B.L * 0.05, ahy = B.gy - B.vy * B.L * 0.05;
      const wx = g.pvx + (ahx - g.pvx) / zoom, wy = g.pvy + (ahy - g.pvy) / zoom;
      const x0 = (wx - g.cx) * Z0 / g.F, y0 = CAM_H - (wy - g.hy) * Z0 / g.F;
      flight = { t: 0, dur, hx, hy, short, p, x0, y0, zEnd: short ? T.D * U.lerp(0.25, 0.8, p / 0.4) : T.D, tLand: targetT + dur };
      G.sfx.play('arrow');
      G.sfx.tone(short ? 330 : 210, 0.16, { type: 'triangle', vol: 0.18, slide: short ? 200 : 130 });
      recoil = 1; stringVib = 1;
      power = 0;
      setPhase('flight');
    }

    function impact() {
      const f = flight;
      const ms = mine[end] || (mine[end] = []);
      let res;
      if (f.short) {
        grounded.push({ x: f.hx * (f.zEnd / T.D), z: f.zEnd });
        res = { score: 0, rx: 9, ry: 9, r: 99, kind: 'short' };
        G.sfx.tone(1900, 0.05, { type: 'square', vol: 0.06 });
        G.sfx.tone(1350, 0.08, { type: 'triangle', vol: 0.08, delay: 0.04 });
        dust(f.hx * (f.zEnd / T.D), 0, f.zEnd, '#8a6a3a', 8);
      } else {
        const tx = targetX(f.tLand);
        const rx = (f.hx - tx) / T.R, ry = (f.hy) / T.R;
        const r = Math.hypot(rx, ry);
        const score = ringScore(r, R10);
        if (r <= 1) {
          res = { score, rx, ry, r, kind: score === 10 ? 'bull' : 'ring' };
          stuck.push({ rx: f.hx - tx, ry: f.hy });
          G.sfx.play('thud');
          targetWob = 1; shake = Math.max(shake, score >= 8 ? 3 : 2);
          dust(f.hx, FACE_H + f.hy, T.D, '#e8c86a', 10);
          if (score === 10) {
            G.sfx.play('parry');
            setTimeout(() => G.sfx.play('coin'), 120);
            sparkle(f.hx, FACE_H + f.hy);
            cheer = 2.2; G.sfx.play('crowd');
          } else if (score >= 8) { cheer = 1.2; G.sfx.play('crowd'); }
        } else if (Math.abs(rx) <= 1.3 && ry <= 1.25 && ry >= -1.3) {
          res = { score: 0, rx, ry, r, kind: 'hay' };
          stuck.push({ rx: f.hx - tx, ry: f.hy });
          G.sfx.play('thud'); shake = 1.5; targetWob = 0.5;
          dust(f.hx, FACE_H + f.hy, T.D, '#e8c86a', 14);
        } else {
          res = { score: 0, rx, ry, r, kind: 'miss' };
          grounded.push({ x: f.hx, z: T.D + 4 });
          G.sfx.play('bush');
        }
      }
      if (sudden) {
        sdResult.you = res;
      } else {
        ms.push(res);
        myTotal += res.score;
      }
      lastHit = res;
      const label = res.kind === 'bull' ? 'BULLSEYE!' : res.kind === 'short' ? 'Too weak!' : res.kind === 'hay' ? 'Hay! 0' : res.kind === 'miss' ? 'MISS' : '+' + res.score;
      popup = { text: label, score: res.score, kind: res.kind, t: 0 };
      flight = null;
      setPhase('hit');
    }

    function afterHit() {
      if (sudden) { buildSdBoard(); setPhase('sdboard'); return; }
      arrowIdx++;
      if (arrowIdx < ARROWS_PER_END) { toAim(); return; }
      // end finished: simulate rivals
      const pressure = end === ENDS - 1 ? 0.6 : end === 1 ? 0.2 : 0;
      for (const rv of rivals) {
        const arr = [];
        for (let i = 0; i < ARROWS_PER_END; i++) arr.push(rivalArrow(rv, pressure));
        rv.ends[end] = arr;
      }
      buildBoard();
      setPhase('board');
    }

    function buildBoard() {
      const rows = [{ you: true, name: G.state.name || 'You', look: G.state.look || 'hero', arrows: mine[end], prev: myTotal - sum(mine[end]), total: myTotal }];
      for (const rv of rivals) {
        const s = sum(rv.ends[end]);
        rows.push({ name: rv.name, look: rv.look, arrows: rv.ends[end], prev: rv.total, total: rv.total + s, rv });
        rv.total += s;
      }
      board = { rows, t: 0, ticks: 0 };
    }
    function buildSdBoard() {
      const rows = [{ you: true, name: G.state.name || 'You', look: G.state.look || 'hero', sd: sdResult.you }];
      for (const rv of sdResult.rivals) rows.push({ name: rv.name, look: rv.look, sd: rv.sd, rv });
      board = { rows, t: 0, sd: true };
    }
    const sum = (a) => (a || []).reduce((s, x) => s + x.score, 0);
    const bestRival = () => rivals.reduce((b, r) => (!b || r.total > b.total ? r : b), null);

    function afterBoard() {
      if (board && board.sd) return finish();
      end++;
      if (end < ENDS) { startEnd(); setPhase('endcard'); return; }
      const best = bestRival();
      if (myTotal === best.total) {
        sudden = true;
        const tied = rivals.filter((r) => r.total === myTotal);
        for (const rv of tied) rv.sd = rivalArrow(rv, 1);
        sdResult = { you: null, rivals: tied };
        stuck = []; grounded = [];
        if (tier >= 2) rollWind(Math.random() < 0.5);
        setPhase('sdcard');
        G.sfx.play('horn');
        return;
      }
      finish();
    }

    function finish() {
      const best = bestRival();
      let won;
      if (sudden && sdResult && sdResult.you) {
        const yd = sdResult.you.r;
        won = sdResult.rivals.every((r) => yd < r.sd.r);
      } else won = myTotal >= best.total;
      outcome = { won, you: myTotal, best: best.total };
      setPhase('outro');
      G.music.stop();
      if (won) { G.sfx.play('win'); G.sfx.play('crowd'); cheer = 4; setTimeout(() => G.music.play('victory'), 900); for (let i = 0; i < 80; i++) confetti(); }
      else G.sfx.play('lose');
    }
    function end_(won, score) {
      if (finished) return;
      finished = true;
      done({ won, score });
    }

    // --- particles --------------------------------------------------------------
    function dust(x, y, z, col, n) {
      const [sx, sy] = proj(x, y, z);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, s = U.rand(10, 45);
        parts.push({ x: sx, y: sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, g: 90, life: U.rand(0.3, 0.7), max: 0.7, c: Math.random() < 0.5 ? col : U.shade(col, -0.3), sz: Math.random() < 0.3 ? 2 : 1, world: true });
      }
    }
    function sparkle(x, y) {
      const [sx, sy] = proj(targetX(targetT) + x - targetX(targetT), y, T.D);
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, s = U.rand(25, 70);
        parts.push({ x: sx, y: sy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 10, life: U.rand(0.6, 1.1), max: 1.1, c: U.pick(['#fff3b0', '#ffd04a', '#ffffff']), sz: 2, star: true, world: true });
      }
    }
    function confetti() {
      parts.push({ x: Math.random() * G.W, y: -10 - Math.random() * G.H * 0.5, vx: U.rand(-20, 20), vy: U.rand(30, 70), g: 20, life: U.rand(2.5, 4), max: 4, c: U.pick(['#f6d04a', '#d6453d', '#3f7fd1', '#5bb04a', '#ffffff', '#ff8ad0']), sz: 2, conf: true, ph: Math.random() * 6 });
    }

    // --- update -----------------------------------------------------------------
    function updateWind(dt) {
      wind.osc += dt;
      if (T.change) {
        wind.changeT -= dt;
        if (wind.changeT <= 0) { wind.changeT = U.rand(5, 8); rollWind(Math.random() < 0.55); }
      }
      wind.base = U.approach(wind.base, wind.target, dt * 0.9);
      if (T.gust) {
        if (wind.gustT > 0) {
          wind.gustT -= dt;
          wind.gust = wind.gustAmp * Math.sin(Math.PI * (1 - Math.max(0, wind.gustT) / wind.gustDur));
        } else {
          wind.gust = 0;
          wind.nextGust -= dt;
          if (wind.nextGust <= 0) {
            wind.gustDur = U.rand(1.4, 2.6); wind.gustT = wind.gustDur;
            wind.gustAmp = (Math.random() < 0.65 ? Math.sign(wind.base || 1) : -Math.sign(wind.base || 1)) * U.rand(0.7, 1) * T.gust;
            wind.nextGust = U.rand(2.5, 5.5);
          }
        }
      }
      wind.cur = wind.base + T.osc * (Math.sin(wind.osc * 0.9) + 0.5 * Math.sin(wind.osc * 2.3 + 1)) / 1.5 + wind.gust;
    }

    function updateAim(dt) {
      const inp = G.input;
      const busy = G.ui.busy();
      // aim: relative L drag, else keyboard stick
      const lp = inp.lHold();
      const mPerPx = T.D / g.F / zoom;
      if (lp && !busy) {
        if (lastL && lastL.id === lp.id) {
          aimX += (lp.x - lastL.x) * 0.6 * mPerPx;
          aimY -= (lp.y - lastL.y) * 0.6 * mPerPx;
        }
        lastL = { id: lp.id, x: lp.x, y: lp.y };
      } else {
        lastL = null;
        const s = inp.stick;
        if (!busy && s.mag > 0.1) {
          const sp = T.R * 0.9 * (drawing ? 0.7 : 1);
          aimX += s.x * sp * dt; aimY -= s.y * sp * dt;
        }
      }
      aimX = U.clamp(aimX, -4, 4); aimY = U.clamp(aimY, -2.2, 2.2);

      // draw
      const held = !busy && inp.down('a');
      if (!held) armed = true;
      if (phase !== 'aim') return;
      if (armed && held && !drawing) { drawing = true; power = 0; breath = 1; shakeT = 0; fullT = 0; drawEl = 0; }
      if (drawing) {
        drawEl += dt;
        if (!creaked) { creaked = true; G.sfx.tone(120, drawTime * 0.9, { type: 'sawtooth', vol: 0.035, slide: 240 }); }
        if (power < 1) {
          power = Math.min(1, power + dt / drawTime);
          if (power >= 1 && !fullClick) { fullClick = true; G.sfx.tone(880, 0.05, { type: 'square', vol: 0.06 }); }
        } else {
          fullT += dt;
          breath = Math.max(0, breath - dt / breathTime);
          if (breath <= 0) shakeT += dt;
          if (breath < 0.35) {
            heartT -= dt;
            if (heartT <= 0) { heartT = breath <= 0 ? 0.32 : 0.55; G.sfx.tone(62, 0.12, { type: 'sine', vol: 0.3 }); }
          }
        }
        if (!held) {
          // a lost focus / cancelled pointer is not a release: keep the arrow
          if (drawEl < 0.2 || G.BUI.blurredWithin(400)) { drawing = false; power = 0; creaked = false; fullClick = false; armed = false; }
          else loose();
        }
      }
    }

    function update(dt) {
      t += dt; phaseT += dt;
      if (phase !== 'intro') bowIn += dt;
      geo();
      targetT += dt;
      updateWind(dt);
      // sway (figure-8 wander)
      const shaking = drawing && power >= 1 && breath <= 0;
      swayT += dt * (1 + (shaking ? 0.6 : 0));
      const w = 1.15, A = swayAmp();
      swX = A * (Math.sin(swayT * w) + 0.35 * Math.sin(swayT * w * 0.37 + 1.3)) / 1.2;
      swY = A * (0.55 * Math.sin(2 * swayT * w) + 0.3 * Math.sin(swayT * w * 0.53 + 0.4)) / 1.1;
      if (shaking) {
        const k = swayBase * (0.5 + Math.min(2.5, shakeT * 1.4));
        swX += k * (Math.sin(t * 31) + 0.6 * Math.sin(t * 47 + 1)) * 0.6;
        swY += k * (Math.sin(t * 37 + 2) + 0.6 * Math.sin(t * 53)) * 0.6;
      }
      // camera
      let zt = 1 + 0.18 * (drawing ? power : 0);
      if (perk('eagle_eye') && drawing && power >= 0.9) zt *= 1.5;
      if (phase === 'flight' || phase === 'hit') zt = Math.max(1.05, zoom * 0.98);
      zoom = U.approach(zoom, zt, dt * (zt > zoom ? 1.6 : 2.4));
      shake = Math.max(0, shake - dt * 10);
      shx = shake ? U.rand(-shake, shake) : 0; shy = shake ? U.rand(-shake, shake) : 0;
      recoil = Math.max(0, recoil - dt * 4);
      stringVib = Math.max(0, stringVib - dt * 3);
      targetWob = Math.max(0, targetWob - dt * 3);
      cheer = Math.max(0, cheer - dt);
      if (popup) popup.t += dt;
      // particles
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.conf) p.x += Math.sin(t * 3 + p.ph) * 20 * dt + wind.cur * 6 * dt;
      }
      for (const pt of petals) {
        pt.x += (wind.cur * 0.05 + Math.sin(t + pt.ph) * 0.01) * dt * pt.s;
        pt.y += (0.025 + Math.sin(t * 1.7 + pt.ph) * 0.02) * dt * pt.s;
        if (pt.x > 1.05) pt.x -= 1.1; if (pt.x < -0.05) pt.x += 1.1;
        if (pt.y > 1.02) { pt.y = -0.02; pt.x = Math.random(); }
      }
      for (const c of crowd) {
        if (cheer > 0 && Math.random() < dt * 6 && c.jump <= 0) c.jump = 0.35;
        c.jump = Math.max(0, c.jump - dt);
      }
      for (const rv of rivals) rv.anim += dt;

      const tapped = !G.ui.busy() && (G.input.anyTap());
      switch (phase) {
        case 'intro':
          if (phaseT > introDur || (phaseT > G.BUI.INTRO_SKIP && tapped)) { startEnd(); setPhase('aim'); G.input.consumeAllTaps(); }
          break;
        case 'endcard':
        case 'sdcard':
          updateAim(dt);
          if (phaseT > 1.4) toAim();
          break;
        case 'aim':
          hintT += dt;
          if (hintT > G.BUI.HINT_T) hintDone = true;
          updateAim(dt);
          break;
        case 'flight':
          updateAim(dt);
          flight.t += dt;
          if (flight.t >= flight.dur) impact();
          break;
        case 'hit':
          updateAim(dt);
          if (phaseT > 1.9 || (phaseT > 0.6 && G.input.has('tap'))) { popup = null; afterHit(); }
          break;
        case 'board': case 'sdboard': {
          board.t += dt;
          const n = boardAnimLen();
          // tick sounds as chips pop
          const ticks = Math.floor(Math.min(board.t, n) / 0.14);
          if (ticks > board.ticks) { board.ticks = ticks; G.sfx.play('select'); }
          if (board.t > n + 0.2 && (tapped || G.input.pressed('a'))) { G.sfx.play('confirm'); G.input.consumeAllTaps(); afterBoard(); }
          else if (board.t < n && tapped) board.t = n;
          break;
        }
        case 'outro':
          if (phaseT > 0.4 && Math.random() < dt * 20 && outcome.won) confetti();
          if (phaseT > G.BUI.OUTRO_T || (phaseT > G.BUI.OUTRO_SKIP && tapped)) end_(outcome.won, { you: outcome.you, best: outcome.best });
          break;
      }
    }
    function boardAnimLen() { return board ? 0.4 + board.rows.length * 0.55 : 0; }

    // --- drawing: world -----------------------------------------------------------
    function drawSky(ctx) {
      const { W, H, hy } = g;
      const sg = ctx.createLinearGradient(0, -H * 0.3, 0, hy);
      sg.addColorStop(0, '#4fa8e8'); sg.addColorStop(0.7, '#9fdcff'); sg.addColorStop(1, '#dff4ff');
      ctx.fillStyle = sg; ctx.fillRect(-W, -H, W * 3, hy + H + 2);
      // sun
      D().circle(W * 0.82, hy * 0.25, g.min * 0.09, 'rgba(255,250,210,0.35)');
      D().circle(W * 0.82, hy * 0.25, g.min * 0.06, '#fff7c8');
      // clouds drift with the wind
      for (let i = 0; i < 4; i++) {
        const span = W + 120;
        let x = ((i * 137 + t * wind.cur * 3.5 + i * 31) % span + span) % span - 60;
        const y = hy * (0.18 + 0.17 * i) * 0.9;
        const s = g.min * (0.05 + 0.012 * (i % 3));
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.ellipse(x, y, s * 1.6, s * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(x - s * 0.8, y + s * 0.15, s * 0.9, s * 0.45, 0, 0, Math.PI * 2);
        ctx.ellipse(x + s * 0.5, y - s * 0.3, s * 0.9, s * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(180,210,235,0.5)';
        ctx.fillRect(x - s * 1.4, y + s * 0.3, s * 2.8, 1);
      }
    }
    function drawHorizon(ctx) {
      const { W, hy, min } = g;
      // far hills
      ctx.fillStyle = '#8fbf8a';
      ctx.beginPath(); ctx.moveTo(-W, hy + 1);
      for (let x = -W; x <= W * 2; x += 6) ctx.lineTo(x, hy - min * 0.07 - Math.sin(x * 0.021 + 1) * min * 0.035 - Math.sin(x * 0.053) * min * 0.012);
      ctx.lineTo(W * 2, hy + 1); ctx.fill();
      ctx.fillStyle = '#5f9a55';
      ctx.beginPath(); ctx.moveTo(-W, hy + 1);
      for (let x = -W; x <= W * 2; x += 4) ctx.lineTo(x, hy - min * 0.03 - Math.abs(Math.sin(x * 0.09)) * min * 0.025 - Math.sin(x * 0.031) * min * 0.01);
      ctx.lineTo(W * 2, hy + 1); ctx.fill();
      // pavilions
      const tents = [[-0.42, '#d6453d'], [-0.25, '#3f7fd1'], [0.24, '#f2c14e'], [0.4, '#d6453d'], [0.62, '#7b3fb5'], [-0.62, '#5bb04a']];
      for (const [fx, col] of tents) {
        const x = g.cx + fx * Math.max(W, min * 1.3), s = min * 0.045;
        const y = hy + 1;
        ctx.fillStyle = '#f4efe2'; ctx.fillRect(x - s, y - s * 1.2, s * 2, s * 1.2);
        for (let k = 0; k < 4; k++) if (k % 2 === 0) { ctx.fillStyle = col; ctx.fillRect(x - s + k * s / 2, y - s * 1.2, s / 2, s * 1.2); }
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - s * 1.15, y - s * 1.2); ctx.lineTo(x, y - s * 2.1); ctx.lineTo(x + s * 1.15, y - s * 1.2); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.moveTo(x, y - s * 1.2); ctx.lineTo(x, y - s * 2.1); ctx.lineTo(x + s * 1.15, y - s * 1.2); ctx.fill();
        // tiny flag streaming with the wind
        D().line(x, y - s * 2.1, x, y - s * 2.8, '#5a3a1a', 1);
        const fl = s * (0.5 + Math.min(1, Math.abs(wind.cur) / 3) * 0.6) * Math.sign(wind.cur || 1);
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x, y - s * 2.8); ctx.lineTo(x + fl, y - s * 2.62 + Math.sin(t * 8 + x) * 0.6); ctx.lineTo(x, y - s * 2.45); ctx.fill();
      }
    }
    function drawGround(ctx) {
      const { W, H, hy } = g;
      const gg = ctx.createLinearGradient(0, hy, 0, H);
      gg.addColorStop(0, '#8cc85a'); gg.addColorStop(1, '#4e9a38');
      ctx.fillStyle = gg; ctx.fillRect(-W, hy, W * 3, H * 2);
      // mown stripes (lines of constant world x converge at the vanishing point)
      const zN = 1.2, zF = 400;
      for (let i = -14; i < 14; i++) {
        if (i % 2) continue;
        const x0 = i * 1.5 - 0.75, x1 = x0 + 1.5;
        const a = proj(x0, 0, zN), b = proj(x1, 0, zN), c = proj(x1, 0, zF), d = proj(x0, 0, zF);
        ctx.fillStyle = 'rgba(255,255,220,0.07)';
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.lineTo(d[0], d[1]); ctx.fill();
      }
      // distance lines
      for (let z = 5; z < T.D; z += 5) {
        const y = proj(0, 0, z)[1];
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(-W, y, W * 3, Math.max(1, 3 / z * 4));
      }
      // grass tufts (deterministic)
      for (let i = 0; i < 40; i++) {
        const z = 2.2 + U.hash2(i, 3) * (T.D + 10), x = (U.hash2(i, 7) - 0.5) * z * 0.5;
        const [sx, sy] = proj(x, 0, z), s = Math.max(1, g.F / z * 0.12);
        ctx.fillStyle = i % 5 === 0 ? '#f2e46a' : '#3f8a2c';
        ctx.fillRect(sx, sy - s, Math.max(1, s * 0.4), s);
        ctx.fillRect(sx + s * 0.5, sy - s * 0.7, Math.max(1, s * 0.4), s * 0.7);
      }
    }
    function drawStands(ctx) {
      // festive stands with crowd on both sides (stylised, screen-relative)
      const { W, hy, min } = g;
      const sw = Math.max(W * 0.22, min * 0.32), sh = min * 0.16;
      for (let side = 0; side < 2; side++) {
        const x0 = side ? W - sw * 0.92 : -sw * 0.08, y0 = hy - sh * 0.35;
        // structure
        ctx.fillStyle = '#8a5a2e'; ctx.fillRect(x0, y0 + sh * 0.25, sw, sh * 0.85);
        ctx.fillStyle = '#6a4220';
        for (let k = 0; k < 4; k++) ctx.fillRect(x0, y0 + sh * (0.45 + k * 0.17), sw, 1);
        // canopy stripes
        const cw = sw / 8;
        for (let k = 0; k < 8; k++) {
          ctx.fillStyle = k % 2 ? '#f4efe2' : (side ? '#3f7fd1' : '#d6453d');
          ctx.fillRect(x0 + k * cw, y0 - sh * 0.15, cw + 0.5, sh * 0.22);
          ctx.beginPath(); ctx.arc(x0 + k * cw + cw / 2, y0 + sh * 0.07, cw / 2, 0, Math.PI); ctx.fill();
        }
        // crowd
        const sc = Math.max(1, min / 200);
        for (const c of crowd) {
          if (c.side !== side) continue;
          const cxp = x0 + sw * (0.12 + c.i * 0.2);
          const cyp = y0 + sh * (c.row ? 0.62 : 0.88) - (c.jump > 0 ? Math.sin(c.jump / 0.35 * Math.PI) * 3 : 0);
          G.chars.draw(ctx, c.look, 'down', 0, cxp, cyp, sc, { shadow: false });
        }
        ctx.fillStyle = '#a8743a'; ctx.fillRect(x0, y0 + sh * 0.95, sw, sh * 0.15);
        ctx.fillStyle = '#6a4220'; ctx.fillRect(x0, y0 + sh * 1.1, sw, 1);
      }
    }
    function drawLaneRopes(ctx) {
      for (const sx of [-1.7, 1.7]) {
        const a = proj(sx, 0.7, 2.5), b = proj(sx, 0.7, T.D - 1);
        D().line(a[0], a[1], b[0], b[1], 'rgba(240,230,200,0.8)', Math.max(1, g.F / 2.5 * 0.012));
        for (let z = 3; z < T.D - 1; z += 3.5) {
          const p0 = proj(sx, 0, z), p1 = proj(sx, 0.75, z);
          D().line(p0[0], p0[1], p1[0], p1[1], '#6a4220', Math.max(1, g.F / z * 0.05));
          // little flags on the rope
          const s = g.F / z * 0.1;
          ctx.fillStyle = (Math.round(z) % 2) ? '#d6453d' : '#f2c14e';
          ctx.beginPath(); ctx.moveTo(p1[0], p1[1]); ctx.lineTo(p1[0] + s * Math.sign(wind.cur || 1), p1[1] + s * 0.5); ctx.lineTo(p1[0], p1[1] + s); ctx.fill();
        }
      }
    }
    function drawFace(ctx, x, y, R, o = {}) {
      const r10 = o.r10 || R10;
      const rads = [1, 0.8, 0.6, 0.4, r10];
      const cols = [RING_COL[4], RING_COL[3], RING_COL[2], RING_COL[1], RING_COL[0]];
      const lines = [RING_LINE[4], RING_LINE[3], RING_LINE[2], RING_LINE[1], RING_LINE[0]];
      for (let i = 0; i < 5; i++) D().circle(x, y, R * rads[i], cols[i]);
      if (R > 8) {
        for (let i = 0; i < 5; i++) D().circle(x, y, R * rads[i], null, lines[i], Math.max(0.5, R / 60));
        D().circle(x, y, R * r10 * 0.5, null, '#a8801a', Math.max(0.5, R / 80));
        D().circle(x, y, R, null, '#5a4a3a', Math.max(1, R / 30));
      }
      if (R > 20) {
        D().line(x - R * 0.04, y, x + R * 0.04, y, '#7a5a10', Math.max(0.5, R / 100));
        D().line(x, y - R * 0.04, x, y + R * 0.04, '#7a5a10', Math.max(0.5, R / 100));
      }
      // painted sheen
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.ellipse(x - R * 0.35, y - R * 0.4, R * 0.35, R * 0.18, -0.6, 0, Math.PI * 2); ctx.fill();
    }
    function drawBale(ctx, x, y, R, seed) {
      const bw = R * 2.6, bh = R * 2.55;
      const x0 = x - bw / 2, y0 = y - bh / 2 + R * 0.02;
      // three stacked bales
      for (let k = 0; k < 3; k++) {
        const by = y0 + k * bh / 3;
        D().rect(x0, by, bw, bh / 3, k % 2 ? '#d9b452' : '#e3c060');
        D().rect(x0, by + bh / 3 - Math.max(1, R * 0.05), bw, Math.max(1, R * 0.05), '#b08a32');
        // twine
        D().rect(x0 + bw * 0.25, by, Math.max(1, R * 0.03), bh / 3, '#8a6a2a');
        D().rect(x0 + bw * 0.73, by, Math.max(1, R * 0.03), bh / 3, '#8a6a2a');
      }
      // straw strands
      ctx.fillStyle = '#f6dc8a';
      for (let i = 0; i < 24; i++) {
        const hx = x0 + U.hash2(i, seed) * bw, hyy = y0 + U.hash2(seed, i) * bh;
        ctx.fillRect(hx, hyy, Math.max(1, R * 0.12), Math.max(1, R * 0.025));
      }
      ctx.fillStyle = '#c49a3e';
      for (let i = 0; i < 6; i++) ctx.fillRect(x0 - 1 + U.hash2(i, seed + 9) * bw, y0 - 1, Math.max(1, R * 0.03), Math.max(1, R * 0.1));
      D().rect(x0, y0, bw, Math.max(1, R * 0.04), 'rgba(255,240,180,0.5)');
      return { x0, y0, bw, bh };
    }
    function drawTarget(ctx) {
      const tx = targetX(targetT);
      const [x, y] = proj(tx, FACE_H, T.D);
      const R = g.Rpx;
      const ground = proj(tx, 0, T.D)[1];
      const wob = targetWob > 0 ? Math.sin(targetWob * 30) * targetWob * R * 0.04 : 0;
      // rope track for moving targets
      if (moving()) {
        const a = proj(-T.moveAmp - 1.6, 0.05, T.D), b = proj(T.moveAmp + 1.6, 0.05, T.D);
        D().rect(a[0], a[1] - R * 0.08, b[0] - a[0], R * 0.1, '#6a4220');
        D().rect(a[0], a[1] + R * 0.02, b[0] - a[0], R * 0.04, '#4a2e14');
        for (const s of [-1, 1]) {
          const p0 = proj(s * (T.moveAmp + 1.6), 0, T.D), p1 = proj(s * (T.moveAmp + 1.6), 2.6, T.D);
          D().line(p0[0], p0[1], p1[0], p1[1], '#5a3a1a', Math.max(2, R * 0.12));
          D().circle(p1[0], p1[1], Math.max(1.5, R * 0.08), '#3a2a1a');
        }
        const r0 = proj(-T.moveAmp - 1.6, 2.6, T.D), r1 = proj(T.moveAmp + 1.6, 2.6, T.D);
        D().line(r0[0], r0[1], r1[0], r1[1], '#c9a36a', Math.max(1, R * 0.04));
        const top = proj(tx, 2.6, T.D);
        D().line(top[0] - R * 0.6, top[1], x - R * 0.9, y - R * 1.2, '#c9a36a', 1);
        D().line(top[0] + R * 0.6, top[1], x + R * 0.9, y - R * 1.2, '#c9a36a', 1);
        D().circle(top[0], top[1], Math.max(1.5, R * 0.1), '#6a4220');
      }
      // stand legs
      D().shadow(x, ground, R * 3.2, 0.25);
      D().line(x - R * 1.0, ground, x - R * 0.7, y + R * 0.8, '#6a4220', Math.max(1.5, R * 0.1));
      D().line(x + R * 1.0, ground, x + R * 0.7, y + R * 0.8, '#6a4220', Math.max(1.5, R * 0.1));
      if (moving()) {
        D().rect(x - R * 1.2, ground - R * 0.18, R * 2.4, R * 0.18, '#7a4b2a');
        D().circle(x - R * 0.8, ground, R * 0.13, '#3a2a1a'); D().circle(x + R * 0.8, ground, R * 0.13, '#3a2a1a');
      }
      ctx.save();
      ctx.translate(x + wob, y);
      ctx.rotate(wob * 0.02);
      drawBale(ctx, 0, 0, R, 5);
      drawFace(ctx, 0, 0, R);
      // stuck arrows
      for (const s of stuck) drawStuck(ctx, s.rx, s.ry, tx, R);
      ctx.restore();
    }
    // arrow stub sticking out towards the camera (ctx at face centre)
    function drawStuck(ctx, rx, ry, tx, R) {
      const k = R / T.R;
      const hx = rx * k, hy = -ry * k;
      const [ax, ay] = proj(tx + rx, FACE_H + ry, T.D);
      const [bx, by] = proj(tx + rx, FACE_H + ry, T.D - 0.75);
      const dx = (bx - ax), dy = (by - ay);
      const ex = hx + dx + R * 0.06, ey = hy + dy + R * 0.18;
      D().line(hx, hy, ex, ey, '#5a3a1a', Math.max(1, R * 0.05));
      D().line(hx, hy, ex, ey, '#c08850', Math.max(0.6, R * 0.025));
      const fs = Math.max(1, R * 0.08);
      ctx.fillStyle = '#e8574e'; ctx.fillRect(ex - fs, ey - fs * 0.5, fs, fs * 1.2);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(ex, ey - fs * 0.5, fs * 0.8, fs * 1.2);
      D().circle(hx, hy, Math.max(0.8, R * 0.04), '#2a1a10');
    }
    function drawSideTargets(ctx) {
      const lat = T.move ? T.moveAmp + 3.1 : 3.4;
      for (const lx of [-lat, lat]) {
        const [x, y] = proj(lx, FACE_H, T.D);
        if (x < -g.Rpx * 2 || x > g.W + g.Rpx * 2) continue;
        const ground = proj(lx, 0, T.D)[1];
        D().line(x - g.Rpx, ground, x - g.Rpx * 0.7, y + g.Rpx * 0.8, '#6a4220', Math.max(1.5, g.Rpx * 0.1));
        D().line(x + g.Rpx, ground, x + g.Rpx * 0.7, y + g.Rpx * 0.8, '#6a4220', Math.max(1.5, g.Rpx * 0.1));
        drawBale(ctx, x, y, g.Rpx, lx > 0 ? 11 : 17);
        drawFace(ctx, x, y, g.Rpx, { r10: 0.2 });
        ctx.fillStyle = 'rgba(80,100,60,0.18)'; ctx.fillRect(x - g.Rpx * 1.3, y - g.Rpx * 1.3, g.Rpx * 2.6, g.Rpx * 2.6);
      }
    }
    function flagShape(ctx, x, y, len, hgt, col, ph, dirSign, str) {
      // a fluttering triangular pennant. droop when calm, stream when windy.
      const a = (1 - str) * 1.25; // angle below horizontal
      const ca = Math.cos(a) * dirSign, sa = Math.sin(a);
      const n = 6;
      const amp = hgt * (0.15 + 0.35 * str);
      const top = [], bot = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        const wv = Math.sin(t * (5 + 9 * str) - f * 5 + ph) * amp * f;
        const px = x + ca * len * f - sa * wv * dirSign, py = y + sa * len * f + Math.cos(a) * wv;
        const half = hgt * (1 - f) * 0.5;
        // perpendicular to flag direction
        top.push([px + sa * half * dirSign * -1 * 0, py - half]);
        bot.push([px, py + half]);
      }
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(top[0][0], top[0][1]);
      for (const p of top) ctx.lineTo(p[0], p[1]);
      for (let i = bot.length - 1; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let i = 0; i <= n; i++) ctx.lineTo((top[i][0] + bot[i][0]) / 2, (top[i][1] + bot[i][1]) / 2);
      for (let i = n; i >= 0; i--) ctx.lineTo(bot[i][0], bot[i][1]);
      ctx.fill();
    }
    function drawPoles(ctx) {
      const str = U.clamp(Math.abs(wind.cur) / 3.2, 0, 1);
      const ds = Math.sign(wind.cur || 0.01);
      const zs = [0.95, 0.7, 0.45];
      const cols = ['#d6453d', '#f2c14e', '#3f7fd1', '#5bb04a', '#7b3fb5', '#f2c14e'];
      const halfW = g.W / 2;
      zs.forEach((zf, i) => {
        const z = T.D * zf;
        // screen-relative lateral placement keeps poles visible in portrait
        const off = halfW * (g.land ? 0.62 : 0.86) * Math.pow(0.45 / zf, 0.8);
        const sc = g.F / z;
        for (const side of [-1, 1]) {
          const x = g.cx + side * Math.max(off, g.Rpx * 2.4);
          const ph = Math.min(3.2, CAM_H + (g.hy - 44) / sc);
          const base = g.hy + CAM_H * sc, top = g.hy + (CAM_H - ph) * sc;
          const pw = Math.max(1, sc * 0.06);
          D().line(x, base, x, top, '#e8dcc0', pw);
          D().line(x + pw * 0.3, base, x + pw * 0.3, top, 'rgba(0,0,0,0.2)', Math.max(0.5, pw * 0.4));
          D().circle(x, top, pw * 0.9, '#f2c14e');
          flagShape(ctx, x, top + pw, sc * (0.42 + 0.25 * str), sc * 0.22, cols[(i * 2 + (side > 0 ? 1 : 0)) % cols.length], i * 1.7 + side, ds, str);
        }
      });
    }
    function drawWindsock(ctx) {
      const str = U.clamp(Math.abs(wind.cur) / 3.2, 0, 1);
      const ds = Math.sign(wind.cur || 0.01);
      const z = T.D * 0.98, sc = g.F / z;
      const x = g.cx + (g.land ? 1 : 1) * Math.max(g.Rpx * 2.9, Math.min(g.W * 0.28, 3.2 * sc));
      const base = g.hy + CAM_H * sc, top = g.hy + (CAM_H - Math.min(3.6, CAM_H + (g.hy - 40) / sc)) * sc;
      D().line(x, base, x, top, '#6a4220', Math.max(1.5, sc * 0.07));
      D().circle(x, top, Math.max(1, sc * 0.06), '#3a2a1a');
      // sock: 4 segments, tapering
      const a = (1 - str) * 1.3;
      const segL = sc * 0.3, n = 4;
      let px = x, py = top + sc * 0.08;
      let ang = a;
      for (let i = 0; i < n; i++) {
        const f = i / n;
        const w0 = sc * 0.2 * (1 - f * 0.45), w1 = sc * 0.2 * (1 - (f + 1 / n) * 0.45);
        ang = a + (1 - str) * f * 0.5 + Math.sin(t * (6 + 8 * str) - i * 1.2) * (0.06 + 0.12 * str);
        const dx = Math.cos(ang) * ds, dy = Math.sin(ang);
        const nx = px + dx * segL, ny = py + dy * segL;
        const pxn = -dy, pyn = dx; // normal
        ctx.fillStyle = i % 2 ? '#f4efe2' : '#e8574e';
        ctx.beginPath();
        ctx.moveTo(px + pxn * w0 / 2 * ds, py + pyn * w0 / 2 * ds);
        ctx.lineTo(nx + pxn * w1 / 2 * ds, ny + pyn * w1 / 2 * ds);
        ctx.lineTo(nx - pxn * w1 / 2 * ds, ny - pyn * w1 / 2 * ds);
        ctx.lineTo(px - pxn * w0 / 2 * ds, py - pyn * w0 / 2 * ds);
        ctx.fill();
        px = nx; py = ny;
      }
    }
    function drawGrounded(ctx, far) {
      for (const a of grounded) {
        if ((a.z > T.D) !== far) continue;
        const [x, y] = proj(a.x, 0, a.z);
        const s = g.F / a.z;
        D().line(x, y, x + s * 0.12, y - s * 0.35, '#5a3a1a', Math.max(1, s * 0.03));
        ctx.fillStyle = '#e8574e'; ctx.fillRect(x + s * 0.1, y - s * 0.4, Math.max(1, s * 0.05), Math.max(1, s * 0.08));
      }
    }
    function flightPos(f, u) {
      u = Math.max(0, u);
      const z = U.lerp(Z0, f.zEnd, u);
      const k = (z - Z0) / (f.zEnd - Z0);
      let x, y;
      if (f.short) {
        x = U.lerp(f.x0, f.hx * f.zEnd / T.D, k);
        y = U.lerp(f.y0, 0, k * k) + Math.sin(k * Math.PI) * 0.3;
      } else {
        x = U.lerp(f.x0, f.hx, k);
        y = U.lerp(f.y0, FACE_H + f.hy, k) + Math.sin(k * Math.PI) * (0.15 + T.D * 0.012 * (1.2 - f.p));
      }
      return proj(x, y, z);
    }
    function drawFlight(ctx) {
      const f = flight;
      if (!f) return;
      const u = Math.min(1, f.t / f.dur);
      const ue = u; // constant world speed; perspective does the easing
      const span = f.zEnd - Z0;
      const a = flightPos(f, ue), b = flightPos(f, ue - 0.8 / span);
      const z = U.lerp(Z0, f.zEnd, ue);
      const w = Math.max(1.2, g.F / z * 0.022);
      // trail
      const c = flightPos(f, ue - 5 / span);
      ctx.globalAlpha = 0.5;
      D().line(c[0], c[1], b[0], b[1], '#ffffff', Math.max(1, w * 0.6));
      ctx.globalAlpha = 1;
      D().line(a[0], a[1], b[0], b[1], '#5a3a1a', w * 1.6);
      D().line(a[0], a[1], b[0], b[1], '#d9a060', w);
      ctx.fillStyle = '#e8574e'; ctx.fillRect(b[0] - w, b[1] - w, w * 2, w * 2);
      D().circle(a[0], a[1], w * 0.8, '#c8ccd4');
    }

    function drawWorld(ctx) {
      ctx.save();
      ctx.translate(shx, shy);
      ctx.translate(g.pvx, g.pvy); ctx.scale(zoom, zoom); ctx.translate(-g.pvx, -g.pvy);
      drawSky(ctx);
      drawHorizon(ctx);
      drawGround(ctx);
      drawStands(ctx);
      drawSideTargets(ctx);
      drawLaneRopes(ctx);
      drawWindsock(ctx);
      drawGrounded(ctx, true);
      drawTarget(ctx);
      drawGrounded(ctx, false);
      drawPoles(ctx);
      drawFlight(ctx);
      // world particles
      for (const p of parts) {
        if (!p.world) continue;
        ctx.globalAlpha = U.clamp(p.life / p.max * 1.5, 0, 1);
        if (p.star) { ctx.fillStyle = p.c; ctx.fillRect(p.x - 2, p.y - 0.5, 5, 1.2); ctx.fillRect(p.x - 0.5, p.y - 2, 1.2, 5); }
        else { ctx.fillStyle = p.c; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    // --- drawing: foreground --------------------------------------------------------
    function drawBunting(ctx) {
      const { W, min } = g;
      const y0 = Math.max(26, min * 0.12);
      const sag = min * 0.06;
      const n = Math.ceil(W / 14) + 2;
      const pts = [];
      for (let i = 0; i <= n; i++) {
        const f = i / n, x = -7 + f * (W + 14);
        pts.push([x, y0 + Math.sin(f * Math.PI) * sag + Math.sin(t * 1.5 + f * 3) * 1.2]);
      }
      ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 1; ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      ctx.stroke();
      const cols = ['#d6453d', '#f2c14e', '#3f7fd1', '#5bb04a', '#f4efe2'];
      const fs = Math.max(5, min * 0.035);
      for (let i = 0; i < n; i++) {
        const [x, y] = pts[i];
        const sw = wind.cur * 0.12 + Math.sin(t * (3 + Math.abs(wind.cur)) + i * 1.3) * (0.05 + Math.abs(wind.cur) * 0.05);
        ctx.save(); ctx.translate(x + 7, y + 1); ctx.rotate(-sw);
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.moveTo(-fs * 0.55, 0); ctx.lineTo(fs * 0.55, 0); ctx.lineTo(0, fs * 1.3); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(fs * 0.55, 0); ctx.lineTo(0, fs * 1.3); ctx.fill();
        ctx.restore();
      }
    }
    function drawPetals(ctx) {
      for (const p of petals) {
        const x = p.x * g.W, y = p.y * g.H;
        const s = Math.sin(t * 5 + p.ph);
        ctx.fillStyle = p.c;
        ctx.fillRect(x, y, Math.max(1, Math.abs(s) * 2.2 * p.s), 1.5 * p.s);
      }
    }
    function drawRivalsFg(ctx) {
      const { W, H, min, land } = g;
      const sc = Math.max(2, min / 70);
      const slots = land ? [[0.1, 0], [0.9, 1], [0.21, 0.5]] : [[0.06, 0], [0.94, 1], [0.0, 0.5]];
      const order = rivals.slice(0, 3).map((rv, i) => [rv, i]);
      if (order.length === 3) order.unshift(order.pop());
      if (!land && order.length === 3) order.shift();
      order.forEach(([rv, i]) => {
        const [fx] = slots[i];
        const far = i === 2;
        const s = far ? sc * 0.8 : sc;
        const x = W * fx, y = H - min * (far ? 0.2 : 0.06);
        const bob = Math.sin(rv.anim * 2) > 0.3 ? 0 : 1;
        G.chars.draw(ctx, rv.look, 'up', 0, x, y + bob, s, { shadow: false });
        // bow held to the side
        const bx = x + (fx < 0.5 ? 7 : -7) * s, by = y - 12 * s;
        ctx.strokeStyle = '#6a4220'; ctx.lineWidth = Math.max(1.5, s * 0.8);
        ctx.beginPath(); ctx.arc(bx - (fx < 0.5 ? 4 : -4) * s, by, 8 * s, -0.9 + (fx < 0.5 ? 0 : Math.PI), 0.9 + (fx < 0.5 ? 0 : Math.PI)); ctx.stroke();
        // name plate
        const nm = rv.name.length > 12 ? rv.name.split(' ').pop() : rv.name;
        const tw = D().measure(nm, 6) + 6;
        const ny = y - 23 * s;
        if (!far || land) {
          const nx = U.clamp(x, tw / 2 + 2, W - tw / 2 - 2);
          D().rrect(nx - tw / 2, ny - 4, tw, 9, 3, 'rgba(30,18,10,0.7)');
          D().text(nm, nx, ny + 0.5, { size: 6, align: 'center', baseline: 'middle', color: '#fff3d6' });
        }
      });
    }
    function drawBow(ctx) {
      const { min, land, H, cx } = g;
      const vis = phase === 'aim' || phase === 'flight' || phase === 'hit' || phase === 'endcard' || phase === 'sdcard';
      if (!vis) return;
      const pv = phase === 'aim' && drawing ? power : 0;
      const B = bowGeo();
      let gx = B.gx, gy = B.gy;
      const L = B.L;
      const cant = B.cant;
      const ux = -Math.sin(cant), uy = Math.cos(cant);      // bow axis (down)
      const vx = B.vx, vy = B.vy;                           // towards viewer (arrow points along -v)
      const brace = L * 0.2 + pv * L * 0.14;
      const La = L * (1 - 0.07 * pv);
      const Tx = gx - ux * La + vx * brace, Ty = gy - uy * La + vy * brace;
      const Bx = gx + ux * La + vx * brace, By = gy + uy * La + vy * brace;
      const vib = stringVib * Math.sin(t * 95) * L * 0.05;
      const pull = L * 0.2 + pv * L * 0.75;
      const Nx = gx + vx * pull - ux * vib, Ny = gy + vy * pull - uy * vib;

      // bow forearm (from bottom-left)
      const skin = pLook.skin || '#f1c27d', sleeve = pLook.tunic || '#5f8f3a';
      const aw = min * 0.085;
      limb(ctx, gx - min * 0.02, gy + min * 0.04, gx - min * 0.45, H + min * 0.25, aw, sleeve);
      limb(ctx, gx - min * 0.02, gy + min * 0.04, gx - min * 0.14, gy + min * 0.17, aw * 0.95, '#7a4b2a'); // bracer
      // limbs
      const lw = Math.max(2, min * 0.022);
      const C1x = gx - ux * La * 0.6 - vx * L * 0.05 + vx * pv * L * 0.03, C1y = gy - uy * La * 0.6 - vy * L * 0.05 + vy * pv * L * 0.03;
      const C2x = gx + ux * La * 0.6 - vx * L * 0.05 + vx * pv * L * 0.03, C2y = gy + uy * La * 0.6 - vy * L * 0.05 + vy * pv * L * 0.03;
      const curve = (col, w, ox, oy) => {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(Tx + ox, Ty + oy); ctx.quadraticCurveTo(C1x + ox, C1y + oy, gx + ox, gy + oy);
        ctx.quadraticCurveTo(C2x + ox, C2y + oy, Bx + ox, By + oy); ctx.stroke();
      };
      // string (behind arrow, in front of limbs)
      curve('#2a160a', lw + 2, 0, 0);
      curve('#8a5a2b', lw, 0, 0);
      curve('#c99055', Math.max(1, lw * 0.4), -lw * 0.25, -lw * 0.1);
      D().circle(Tx, Ty, lw * 0.6, '#3a2414'); D().circle(Bx, By, lw * 0.6, '#3a2414');
      ctx.strokeStyle = '#f4efe2'; ctx.lineWidth = 1; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(Tx, Ty); ctx.lineTo(Nx, Ny); ctx.lineTo(Bx, By); ctx.stroke();
      // nocked arrow
      const hasArrow = phase === 'aim' || phase === 'endcard' || phase === 'sdcard' || phase === 'intro';
      if (hasArrow) {
        const A = L * 1.05;
        const ax = Nx - vx * A, ay = Ny - vy * A;
        D().line(Nx, Ny, ax, ay, '#3a2414', Math.max(2, min * 0.016));
        D().line(Nx, Ny, ax, ay, '#d9a060', Math.max(1, min * 0.009));
        // head
        ctx.fillStyle = '#c8ccd4';
        const hl = min * 0.05, hw = min * 0.018;
        ctx.beginPath(); ctx.moveTo(ax - vx * hl, ay - vy * hl); ctx.lineTo(ax + vy * hw, ay - vx * hw); ctx.lineTo(ax - vy * hw, ay + vx * hw); ctx.fill();
        ctx.fillStyle = '#ffffff'; ctx.fillRect(ax - vx * hl * 0.6, ay - vy * hl * 0.6, 1, 1);
        // fletching
        const fx = Nx - vx * L * 0.12, fy = Ny - vy * L * 0.12;
        const fl = L * 0.22, fw = min * 0.022;
        ctx.fillStyle = '#e8574e';
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - vx * fl + vy * fw, fy - vy * fl - vx * fw); ctx.lineTo(fx - vx * fl, fy - vy * fl); ctx.fill();
        ctx.fillStyle = '#f4efe2';
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx - vx * fl - vy * fw, fy - vy * fl + vx * fw); ctx.lineTo(fx - vx * fl, fy - vy * fl); ctx.fill();
      }
      // grip wrap + bow fist
      const fsz = min * 0.075;
      ctx.save(); ctx.translate(gx, gy); ctx.rotate(cant);
      D().rrect(-fsz * 0.55, -fsz * 0.75, fsz * 1.1, fsz * 1.5, fsz * 0.3, U.shade(skin, -0.45));
      D().rrect(-fsz * 0.5, -fsz * 0.7, fsz, fsz * 1.4, fsz * 0.28, skin);
      for (let k = 0; k < 3; k++) D().rect(fsz * 0.05, -fsz * 0.45 + k * fsz * 0.38, fsz * 0.42, 1, U.shade(skin, -0.3));
      D().rect(-fsz * 0.5, -fsz * 0.7, fsz * 0.3, fsz * 1.4, 'rgba(255,255,255,0.15)');
      ctx.restore();
      // draw arm (from bottom-right) + hand on the string
      limb(ctx, Nx + min * 0.02, Ny + min * 0.03, Nx + min * 0.35, Ny + min * 0.6, aw * 1.05, sleeve);
      const hs = min * 0.068;
      ctx.save(); ctx.translate(Nx, Ny); ctx.rotate(-0.6);
      D().rrect(-hs * 0.15, -hs * 0.5, hs * 1.2, hs * 1.05, hs * 0.3, U.shade(skin, -0.45));
      D().rrect(-hs * 0.1, -hs * 0.45, hs * 1.1, hs * 0.95, hs * 0.28, skin);
      for (let k = 0; k < 3; k++) D().rect(-hs * 0.05, -hs * 0.3 + k * hs * 0.27, hs * 0.35, 1, U.shade(skin, -0.3));
      D().rrect(-hs * 0.2, -hs * 0.35, hs * 0.25, hs * 0.7, hs * 0.1, '#5a3a1a'); // tab
      ctx.restore();
    }
    // grip position + arrow direction: the arrow points from the nock at the
    // target, so the bow sits below-right of it and is canted for readability.
    function bowGeo() {
      const { min, land, H } = g;
      const vx = 0.16, vy = 0.987;
      const sPx = g.F / T.D * zoom;
      const d = min * (land ? 0.36 : 0.55);
      let gx = g.pvx + vx * d + swX * sPx * 0.35 + recoil * min * 0.03 * vx;
      let gy = g.pvy + vy * d - swY * sPx * 0.35 + recoil * min * 0.03 * vy;
      if (!land) gy = Math.min(gy, H - min * 0.3);
      gy += (1 - U.ease.outBack(U.clamp(bowIn / 0.5, 0, 1))) * min * 0.8;
      return { gx, gy, vx, vy, L: min * (land ? 0.3 : 0.36), cant: 0.62 };
    }
    function limb(ctx, x0, y0, x1, y1, w, col) {
      ctx.lineCap = 'round';
      ctx.strokeStyle = U.shade(col, -0.5); ctx.lineWidth = w + 2;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = w;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.lineWidth = w * 0.3;
      ctx.beginPath(); ctx.moveTo(x0 - w * 0.2, y0); ctx.lineTo(x1 - w * 0.2, y1); ctx.stroke();
    }

    function reticlePos() {
      const sPx = g.F / T.D;
      const [x, y] = toScr(g.cx + (aimX + swX) * sPx, g.pvy - (aimY + swY) * sPx);
      return [x, y];
    }
    function drawReticle(ctx) {
      if (!(phase === 'aim' || phase === 'endcard' || phase === 'sdcard')) return;
      const [x, y] = reticlePos();
      const shaking = drawing && power >= 1 && breath <= 0;
      // windreader ghost
      if (perk('windreader')) {
        const p = drawing ? Math.max(0.4, power) : 1;
        const v = 30 + 42 * p * bp, tF = T.D / v;
        const drift = wind.cur * tF * 0.62 / bp, drop = (1 - p) * T.D * 0.045;
        const sPx = g.F / T.D * zoom;
        const gx = x + drift * sPx, gy = y + drop * sPx;
        ctx.setLineDash([2, 2]);
        D().line(x, y, gx, gy, 'rgba(140,240,255,0.8)', 1);
        ctx.setLineDash([]);
        D().circle(gx, gy, 3.5, 'rgba(140,240,255,0.25)', 'rgba(140,240,255,0.95)', 1);
        D().circle(gx, gy, 0.9, '#bff6ff');
      }
      const col = shaking ? (Math.sin(t * 30) > 0 ? '#ff5a4a' : '#ffffff') : '#ffffff';
      const r = U.clamp(g.Rpx * zoom * 0.28, 3.5, 6);
      D().circle(x, y, r, null, 'rgba(0,0,0,0.5)', 2.5);
      D().circle(x, y, r, null, col, 1);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        D().line(x + dx * (r + 1), y + dy * (r + 1), x + dx * (r + 4), y + dy * (r + 4), 'rgba(0,0,0,0.5)', 2.5);
        D().line(x + dx * (r + 1), y + dy * (r + 1), x + dx * (r + 4), y + dy * (r + 4), col, 1);
      }
      D().circle(x, y, 1.2, col);
      // power arc
      if (drawing) {
        const pc = power >= 1 ? (Math.sin(t * 10) > 0 ? '#ffd04a' : '#fff3b0') : power < 0.4 ? '#ff8a5a' : '#fff3b0';
        ctx.lineCap = 'butt';
        ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(x, y, r + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = pc; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * power); ctx.stroke();
        if (power >= 1) {
          const bw = 26;
          const bc = breath > 0.5 ? '#8fd3ff' : breath > 0.2 ? '#f2c14e' : '#ff5a4a';
          D().bar(x - bw / 2, y + r + 12, bw, 3, breath, bc);
          if (breath <= 0) D().text('SHAKING!', x, y + r + 17, { size: 6, align: 'center', color: '#ffb0a0', outline: '#2a0a0a', outlineW: 2 });
          else if (fullT < 0.6) D().text('FULL DRAW', x, y + r + 17, { size: 6, align: 'center', color: '#fff3b0', outline: '#2a1a0a', outlineW: 2 });
        } else if (power < 0.4) D().text('weak', x, y + r + 11, { size: 6, align: 'center', color: '#ffb08a', outline: '#2a1a0a', outlineW: 2 });
      }
    }

    function drawQuiver(ctx, x, y, n, of) {
      for (let i = 0; i < of; i++) {
        const on = i < n;
        const ax = x + i * 6;
        D().line(ax, y, ax, y + 10, on ? '#d9a060' : 'rgba(255,255,255,0.25)', 1.5);
        if (on) { D().rect(ax - 1.5, y + 7, 3, 4, '#e8574e'); D().rect(ax - 1, y - 1, 2, 2, '#c8ccd4'); }
      }
    }
    function drawHUD(ctx) {
      const { W } = g;
      const best = bestRival();
      // left: end & quiver (boxes shrink on narrow phones so the centre score box keeps its room)
      const sw = U.clamp(Math.floor(W * 0.27), 46, 58);
      D().rrect(4, 4, sw, 26, 4, 'rgba(25,15,8,0.72)', 'rgba(242,193,78,0.6)', 1);
      D().text(sudden ? 'SUDDEN' : `END ${Math.min(end + 1, ENDS)}/${ENDS}`, 9, 8, { size: 7, color: '#ffe48a' });
      const left = sudden ? (sdResult && sdResult.you ? 0 : 1) : ARROWS_PER_END - arrowIdx - (phase === 'hit' || phase === 'flight' ? 1 : 0);
      drawQuiver(ctx, 11, 17, Math.max(0, left), sudden ? 1 : ARROWS_PER_END);
      // centre: scores
      const bw = Math.min(110, W - 2 * sw - 18);
      const bx = W / 2 - bw / 2;
      D().rrect(bx, 4, bw, 26, 4, 'rgba(25,15,8,0.72)', 'rgba(242,193,78,0.6)', 1);
      D().text('YOU', bx + 6, 8, { size: 6, color: '#cfe8ff' });
      D().text(String(myTotal), bx + 6, 15, { size: 11, bold: true, color: '#ffffff' });
      const bn = best ? (best.name.length > 9 ? best.name.split(' ').pop() : best.name) : '';
      D().text(G.BUI.fit(bn.toUpperCase(), 6, bw / 2 - 8), bx + bw - 6, 8, { size: 6, align: 'right', color: '#ffc9a0' });
      D().text(best ? String(best.total) : '0', bx + bw - 6, 15, { size: 11, bold: true, align: 'right', color: '#ffe0c8' });
      D().text('vs', W / 2, 15, { size: 6, align: 'center', color: 'rgba(255,255,255,0.5)' });
      // right: wind gauge
      const wx = W - sw - 4, ww = sw;
      D().rrect(wx, 4, ww, 26, 4, 'rgba(25,15,8,0.72)', 'rgba(242,193,78,0.6)', 1);
      const gusting = wind.gust && Math.abs(wind.gust) > 0.3;
      D().text(gusting ? 'GUST!' : 'WIND', wx + 5, 8, { size: 6, color: gusting ? (Math.sin(t * 10) > -0.3 ? '#ffb08a' : '#ffffff') : '#bfe8ff' });
      const sp = Math.abs(wind.cur);
      D().text(sp.toFixed(1), wx + ww - 5, 8, { size: 7, align: 'right', color: sp > 2.4 ? '#ffb08a' : '#ffffff' });
      const ds = Math.sign(wind.cur || 0.01);
      const len = 8 + Math.min(1, sp / 3.5) * (ww - 22);
      const ay = 22, acx = wx + ww / 2;
      const a0 = acx - ds * len / 2, a1 = acx + ds * len / 2;
      D().line(a0, ay, a1, ay, wind.gust && Math.abs(wind.gust) > 0.3 ? '#ffb08a' : '#bfe8ff', 2);
      ctx.fillStyle = wind.gust && Math.abs(wind.gust) > 0.3 ? '#ffb08a' : '#bfe8ff';
      ctx.beginPath(); ctx.moveTo(a1 + ds * 3, ay); ctx.lineTo(a1 - ds * 2, ay - 3.5); ctx.lineTo(a1 - ds * 2, ay + 3.5); ctx.fill();

    }

    function insetLayout(big) {
      const { W, H, min, land } = g;
      if (big) {
        const ri = min * (land ? 0.27 : 0.24);
        if (land) return { x: W - ri - 12, y: H * 0.52, r: ri };
        return { x: W / 2, y: Math.max(38 + ri, g.hy - g.Rpx * zoom - ri - 18), r: ri };
      }
      const ri = min * 0.1;
      return { x: W - ri - 8, y: 36 + ri, r: ri };
    }
    function drawInset(ctx) {
      const big = phase === 'hit' && lastHit && lastHit.kind !== 'short';
      const showSmall = (phase === 'aim' || phase === 'flight') && mine.some((e) => e && e.length);
      if (!big && !showSmall) return;
      const L = insetLayout(big);
      let r = L.r;
      if (big) r *= U.ease.outBack(Math.min(1, phaseT / 0.3));
      const { x, y } = L;
      D().circle(x + 1, y + 2, r + 3, 'rgba(0,0,0,0.35)');
      D().circle(x, y, r + 3, '#7a4b2a');
      D().circle(x, y, r + 1.5, '#f2c14e');
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.clip();
      D().rect(x - r, y - r, r * 2, r * 2, '#e3c060');
      ctx.fillStyle = '#f6dc8a';
      for (let i = 0; i < 18; i++) ctx.fillRect(x - r + U.hash2(i, 2) * r * 2, y - r + U.hash2(3, i) * r * 2, r * 0.25, 1);
      const fr = r * 0.78;
      drawFace(ctx, x, y, fr);
      // all my arrows (older ends faded)
      mine.forEach((ens, ei) => {
        if (!ens) return;
        for (let i = 0; i < ens.length; i++) {
          const a = ens[i];
          if (a.kind === 'short' || a.kind === 'miss') continue;
          const cur = ei === end && !sudden;
          const isLast = big && a === lastHit;
          ctx.globalAlpha = cur ? 1 : 0.35;
          const hx = x + a.rx * fr, hy = y - a.ry * fr;
          const hs = isLast ? 1 + 0.4 * Math.max(0, 1 - phaseT * 2) : 1;
          D().circle(hx, hy, Math.max(1.5, r * 0.07) * hs, '#2a1a10');
          D().circle(hx, hy, Math.max(0.8, r * 0.035) * hs, cur ? '#e8574e' : '#ffffff');
          if (isLast) D().circle(hx, hy, Math.max(3, r * 0.14) + Math.sin(t * 10) * 1, null, '#ffffff', 1);
        }
      });
      if (sudden && sdResult && sdResult.you && sdResult.you.kind !== 'short' && sdResult.you.kind !== 'miss') {
        const a = sdResult.you, hx = x + a.rx * fr, hy = y - a.ry * fr;
        D().circle(hx, hy, Math.max(2, r * 0.08), '#2a1a10'); D().circle(hx, hy, Math.max(1, r * 0.04), '#e8574e');
        D().circle(hx, hy, Math.max(3, r * 0.14) + Math.sin(t * 10), null, '#ffffff', 1);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      // sparkles round the inset for a bullseye
      if (big && lastHit.kind === 'bull') {
        for (let i = 0; i < 8; i++) {
          const a = t * 1.5 + i * Math.PI / 4, rr = r + 6 + Math.sin(t * 6 + i) * 2;
          const sx = x + Math.cos(a) * rr, sy = y + Math.sin(a) * rr;
          const s = 2 + (Math.sin(t * 8 + i * 2) + 1);
          ctx.fillStyle = i % 2 ? '#fff3b0' : '#ffd04a';
          ctx.fillRect(sx - s, sy - 0.5, s * 2, 1.5); ctx.fillRect(sx - 0.5, sy - s, 1.5, s * 2);
        }
      }
      if (!big) D().text('YOUR ARROWS', x, y + r + 5, { size: 5, align: 'center', color: '#fff3d6', outline: '#2a1a0a', outlineW: 2 });
    }
    function drawPopup(ctx) {
      if (!popup || phase !== 'hit') return;
      const k = popup.t;
      const big = lastHit && lastHit.kind !== 'short';
      const L = big ? insetLayout(true) : { x: g.W / 2, y: g.H * 0.42, r: 0 };
      const sc = U.ease.outBack(Math.min(1, k / 0.35));
      const y = L.y + L.r + 14 - Math.min(6, k * 8);
      const col = popup.kind === 'bull' ? '#ffe48a' : popup.score >= 8 ? '#ffd0c8' : popup.score > 0 ? '#ffffff' : '#ffb08a';
      ctx.save(); ctx.translate(L.x, y); ctx.scale(sc, sc);
      if (popup.kind === 'bull') {
        D().text('10', 0, -1, { size: 16, bold: true, align: 'center', baseline: 'middle', color: '#ffe48a', outline: '#5a2a0a', outlineW: 4 });
        D().text('BULLSEYE!', 0, 14, { size: 11, bold: true, align: 'center', baseline: 'middle', color: Math.sin(t * 14) > 0 ? '#ffffff' : '#ffe48a', outline: '#5a2a0a', outlineW: 3 });
      } else {
        D().text(popup.text, 0, 0, { size: popup.score > 0 ? 14 : 11, bold: true, align: 'center', baseline: 'middle', color: col, outline: '#2a1a0a', outlineW: 3 });
      }
      ctx.restore();
    }

    let hintCache = null, hintTouch = null;
    const HINT_BREATH = ['Let go now, before your arms shake!'];
    function drawHint(ctx) {
      // first end: say it once the breath runs short
      if (phase === 'aim' && end === 0 && !sudden && drawing && power >= 1 && breath < 0.45) { G.BUI.drawHint(ctx, HINT_BREATH, 1); return; }
      if (hintDone || !(phase === 'aim')) return;
      const a = U.clamp(Math.min(hintT / 0.4, (G.BUI.HINT_T - hintT) / 0.6), 0, 1);
      const touch = G.BUI.touch();
      if (!hintCache || hintTouch !== touch) {
        hintTouch = touch;
        hintCache = touch
          ? ['Hold right: draw  •  Let go: loose', 'Left thumb: aim  •  Mind the wind!']
          : ['Hold Z / Space: draw  •  Let go: loose', 'Arrows: aim  •  Mind the wind!'];
      }
      G.BUI.drawHint(ctx, hintCache, a);
    }

    function drawBanner(ctx, text, sub, col, k) {
      const { W, H } = g;
      const y = H * 0.36;
      const bh = 34 + (sub ? 12 : 0);
      const w = W * U.ease.outCubic(U.clamp(k, 0, 1));
      ctx.fillStyle = 'rgba(25,15,8,0.82)'; ctx.fillRect(W / 2 - w / 2, y - bh / 2, w, bh);
      ctx.fillStyle = '#f2c14e'; ctx.fillRect(W / 2 - w / 2, y - bh / 2, w, 1.5); ctx.fillRect(W / 2 - w / 2, y + bh / 2 - 1.5, w, 1.5);
      if (k > 0.3) {
        D().text(text, W / 2, y - (sub ? 6 : 0), { size: 15, bold: true, align: 'center', baseline: 'middle', color: col || '#ffe48a', outline: '#3a1a0a', outlineW: 4, maxW: 0 });
        if (sub) D().text(sub, W / 2, y + 12, { size: 7, align: 'center', baseline: 'middle', color: '#fff3d6' });
      }
    }

    let introCache = null;
    function drawIntro(ctx) {
      if (!introCache) {
        const q = rivals.find((r) => r.quip);
        const short = (n) => n.split(' ').pop();
        introCache = {
          title: opts.title || 'Archery Contest', dur: introDur,
          you: { look: G.state.look || 'hero', sub: bow.name || 'Bow' },
          foe: {
            name: rivals.length === 1 ? rivals[0].name : rivals.map((r) => short(r.name)).join(', '),
            sub: rivals.length === 1 ? (G.roster.archery[rivals[0].id] || {}).title || 'Archer' : `${rivals.length} rivals`,
            portrait: (c, x, y, sz) => {
              if (rivals.length === 1) { G.chars.portrait(c, rivals[0].look, x, y, sz); return; }
              const n = Math.min(3, rivals.length), ps = Math.round(sz * 0.62);
              for (let i = n - 1; i >= 0; i--) G.chars.portrait(c, rivals[i].look, x + (sz - ps) * (i / (n - 1)), y + (sz - ps) * (1 - i / (n - 1)) * 0.5 + (sz - ps) * 0.25, ps);
            },
          },
          footer: `${T.D} m  •  ${['', 'steady breeze', 'shifting wind', 'moving target, gusts', 'long range, gusting wind'][tier]}  •  3 ends × 3 arrows`,
          quip: q ? `${q.name.split(' ')[0]}: "${q.quip}"` : null,
        };
      }
      G.BUI.drawIntro(ctx, phaseT, introCache);
    }

    function chip(x, y, s, sc) {
      const c = SCORE_COL[s] || '#888';
      const sz = 13 * sc;
      if (sz < 1) return;
      D().rrect(x - sz / 2, y - sz / 2, sz, sz, 3, c, 'rgba(0,0,0,0.5)', 1);
      D().text(s === 0 ? 'M' : String(s), x, y + 0.5, { size: 7 * Math.max(0.5, sc), bold: true, align: 'center', baseline: 'middle', color: s === 4 || s === 0 ? '#ffffff' : s === 2 ? '#2a1a10' : '#1a0e06' });
    }
    function drawBoard(ctx) {
      if (!board) return;
      const { W, H } = g;
      ctx.fillStyle = 'rgba(10,6,4,0.55)'; ctx.fillRect(0, 0, W, H);
      const rows = board.rows;
      const rh = 26, pw = Math.min(W - 12, 280);
      const ph = 36 + rows.length * rh + 26;
      const px = W / 2 - pw / 2, py = Math.max(6, H / 2 - ph / 2);
      const k = U.ease.outBack(Math.min(1, board.t / 0.3));
      ctx.save(); ctx.translate(W / 2, py + ph / 2); ctx.scale(k, k); ctx.translate(-W / 2, -(py + ph / 2));
      D().panel(px, py, pw, ph);
      const title = board.sd ? 'SUDDEN DEATH' : `END ${end + 1} of ${ENDS}`;
      D().text(title, W / 2, py + 9, { size: 10, bold: true, align: 'center', color: '#5a2a0a' });
      D().text(board.sd ? 'closest to the centre wins' : end === ENDS - 1 ? 'final scores' : 'scores so far', W / 2, py + 22, { size: 6, align: 'center', color: '#7a5a3a' });
      const n = boardAnimLen();
      let lead = null;
      if (!board.sd) {
        for (const r of rows) if (!lead || r.total > lead.total) lead = r;
      } else {
        for (const r of rows) if (r.sd && (!lead || r.sd.r < lead.sd.r)) lead = r;
      }
      const showTiny = pw >= 230;
      rows.forEach((r, i) => {
        const y = py + 32 + i * rh;
        const rt = board.t - 0.3 - i * 0.55;
        const a = U.clamp(rt / 0.2, 0, 1);
        ctx.globalAlpha = a;
        D().rrect(px + 6, y, pw - 12, rh - 3, 3, r.you ? 'rgba(63,127,209,0.18)' : 'rgba(122,75,42,0.1)');
        D().rrect(px + 9, y + 2, 19, 19, 2, '#e9d3a4', '#7a4b2a', 1);
        G.chars.portrait(ctx, r.look, px + 10, y + 3, 17);
        let nm = r.you ? 'You' : r.name;
        const maxNameW = pw - 12 - 26 - (board.sd ? 60 : 3 * 15 + 34) - (showTiny ? 24 : 0);
        while (D().measure(nm, 7) > maxNameW && nm.length > 3) nm = nm.slice(0, -2) + '…';
        D().text(nm, px + 32, y + 11, { size: 7, baseline: 'middle', color: r.you ? '#1f3f78' : '#3a2010' });
        if (board.allDone !== false && board.t > n && r === lead) {
          // crown on the leader
          const cx = px + 18, cy = y - 1;
          ctx.fillStyle = '#f2c14e';
          ctx.beginPath(); ctx.moveTo(cx - 5, cy + 3); ctx.lineTo(cx - 5, cy - 2); ctx.lineTo(cx - 2.5, cy + 0.5); ctx.lineTo(cx, cy - 3); ctx.lineTo(cx + 2.5, cy + 0.5); ctx.lineTo(cx + 5, cy - 2); ctx.lineTo(cx + 5, cy + 3); ctx.fill();
        }
        if (board.sd) {
          const sdv = r.sd;
          const txt = !sdv ? '—' : sdv.r > 1.3 ? 'missed' : `${Math.round(sdv.r * T.R * 100)} cm`;
          if (rt > 0.25) D().text(txt, px + pw - 12, y + 11, { size: 9, bold: true, align: 'right', baseline: 'middle', color: r === lead ? '#2a6a1a' : '#5a3a1a' });
        } else {
          const right = px + pw - 12;
          const chipX0 = right - 34 - 3 * 15 + 7;
          if (showTiny) {
            // mini face with this end's arrows
            const mx = chipX0 - 16, my = y + 11, mr = 9;
            drawFace(ctx, mx, my, mr, { r10: r.you ? R10 : 0.2 });
            for (const ar of r.arrows || []) if (ar.r <= 1.05) D().circle(mx + ar.rx * mr, my - ar.ry * mr, 1.2, '#1a0e06');
          }
          (r.arrows || []).forEach((ar, j) => {
            const ct = rt - 0.1 - j * 0.14;
            const s = ct <= 0 ? 0 : U.ease.outBack(Math.min(1, ct / 0.2));
            chip(chipX0 + j * 15, y + 11, ar.score, s);
          });
          const tt = U.clamp((rt - 0.5) / 0.3, 0, 1);
          const shown = Math.round(U.lerp(r.prev, r.total, tt));
          D().text(String(shown), right, y + 11, { size: 11, bold: true, align: 'right', baseline: 'middle', color: r.you ? '#1f3f78' : '#3a2010' });
        }
        ctx.globalAlpha = 1;
      });
      if (board.t > n + 0.2) {
        const blink = Math.sin(t * 5) > -0.3;
        const label = board.sd ? 'See result ▶' : end < ENDS - 1 ? 'Next end ▶' : 'Final result ▶';
        if (blink) D().text(label, W / 2, py + ph - 20, { size: 8, bold: true, align: 'center', color: '#7a3a10' });
        D().text('tap to continue', W / 2, py + ph - 10, { size: 5, align: 'center', color: '#9a7a5a' });
      }
      ctx.restore();
    }

    function drawOutro(ctx) {
      if (!outcome) return;
      const best = bestRival();
      const sub = sudden ? (outcome.won ? 'Won the sudden-death shoot-off!' : 'Lost the sudden-death shoot-off') : outcome.won ? 'The crowd roars your name!' : 'Practise your breathing, squire.';
      G.BUI.drawOutro(ctx, phaseT, { won: outcome.won, sub, detail: `You ${outcome.you}  —  ${best.name.split(' ').pop()} ${outcome.best}`, rt: t, y: g.H * 0.4 });
    }

    function drawOverlayFx(ctx) {
      // breath vignette
      if (phase === 'aim' && drawing && power >= 1 && breath < 0.4) {
        const a = (0.4 - breath) / 0.4 * (0.25 + 0.15 * Math.sin(t * (breath <= 0 ? 20 : 10)));
        const vg = ctx.createRadialGradient(g.W / 2, g.H / 2, g.min * 0.3, g.W / 2, g.H / 2, Math.max(g.W, g.H) * 0.7);
        vg.addColorStop(0, 'rgba(120,0,0,0)'); vg.addColorStop(1, `rgba(120,0,0,${a})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, g.W, g.H);
      }
      if (zoom > 1.3) {
        // scope vignette for eagle eye
        const a = U.clamp((zoom - 1.3) / 0.4, 0, 1) * 0.5;
        const vg = ctx.createRadialGradient(g.pvx, g.pvy, g.min * 0.25, g.pvx, g.pvy, g.min * 0.7);
        vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${a})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, g.W, g.H);
      }
      for (const p of parts) {
        if (p.world) continue;
        ctx.globalAlpha = U.clamp(p.life / p.max * 2, 0, 1);
        ctx.fillStyle = p.c;
        const s = Math.abs(Math.sin(t * 6 + p.ph));
        ctx.fillRect(p.x, p.y, 1 + s * 2, 2.5);
      }
      ctx.globalAlpha = 1;
    }

    function draw(ctx) {
      geo();
      drawWorld(ctx);
      drawBunting(ctx);
      drawPetals(ctx);
      drawRivalsFg(ctx);
      drawBow(ctx);
      drawReticle(ctx);
      drawOverlayFx(ctx);
      // the scoreboard owns the totals while it counts up (the HUD would show the new totals early)
      if (phase !== 'intro' && phase !== 'outro' && phase !== 'board' && phase !== 'sdboard') drawHUD(ctx);
      drawInset(ctx);
      drawPopup(ctx);
      drawHint(ctx);
      if (phase === 'intro') drawIntro(ctx);
      if (phase === 'endcard') drawBanner(ctx, `END ${end + 1}`, end === ENDS - 1 ? (moving() && T.move === 'final' ? 'Final end — the target moves!' : 'Final end!') : 'Arrows retrieved', '#ffe48a', phaseT / 0.35);
      if (phase === 'sdcard') drawBanner(ctx, 'SUDDEN DEATH', 'One arrow — closest to the centre wins!', '#ff9a7a', phaseT / 0.35);
      if (phase === 'board' || phase === 'sdboard') drawBoard(ctx);
      if (phase === 'outro') drawOutro(ctx);
    }

    const scene = {
      name: 'battle-archery',
      enter() { G.music.play(opts.boss ? 'boss' : 'tourney'); G.sfx.play('horn'); },
      update,
      draw,
      resize() { geo(); },
    };
    scene.debugEnd = (won) => end_(!!won, { you: 0, best: 0 });
    // test hooks (not part of the public API)
    scene._dbg = {
      get: () => ({ phase, end, arrowIdx, myTotal, power, breath, aimX, aimY, wind: wind.cur, zoom, rivals: rivals.map((r) => [r.name, r.total]), mine, sudden }),
      set: (o) => { if ('aimX' in o) aimX = o.aimX; if ('aimY' in o) aimY = o.aimY; if ('wind' in o) { wind.base = wind.target = o.wind; } },
      rivals: () => rivals,
      comp: () => {
        const v = 30 + 42 * bp, tF = T.D / v, dur = U.clamp(tF * 1.7, 0.45, 1.0);
        return { x: targetX(targetT + dur + 0.3) - wind.cur * tF * 0.62 / bp, y: 0 };
      },
    };
    geo();
    return scene;
  }

  G.battle.register('archery', make);
  G.archery = { sigmaFor, expScore };
})();
