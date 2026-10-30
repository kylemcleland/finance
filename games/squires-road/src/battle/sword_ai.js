// Sword battle enemy AI: archetypes, attack moves, telegraphs, token turns.
// Used at runtime by battle/sword.js via G.SW.ai. S is the battle context.
(() => {
  G.SW = G.SW || {};
  const U = G.U;
  const PI = Math.PI;

  // col: 'w' = white (blockable / parryable), 'r' = red (unblockable: dodge it).
  // wind/act/rec in seconds at speed 1. reach in px from the attacker's center
  // (the player's radius is added). arc = half-angle in radians.
  const MV = {
    slash:    { wind: 0.55, act: 0.13, rec: 0.45, reach: 26, arc: 1.25, mult: 1.0, col: 'w', lunge: 70, from: 1.7, to: -1.4 },
    slash2:   { wind: 0.32, act: 0.13, rec: 0.5,  reach: 26, arc: 1.25, mult: 1.0, col: 'w', lunge: 70, from: -1.5, to: 1.6 },
    overhead: { wind: 0.8,  act: 0.14, rec: 0.6,  reach: 28, arc: 0.9,  mult: 1.5, col: 'w', lunge: 60, from: 2.8, to: -0.3, kb: 170 },
    thrust:   { wind: 0.5,  act: 0.16, rec: 0.5,  reach: 34, arc: 0.45, mult: 1.1, col: 'w', lunge: 180, from: 0, to: 0, thrust: true },
    stab:     { wind: 0.36, act: 0.12, rec: 0.42, reach: 22, arc: 0.7,  mult: 0.9, col: 'w', lunge: 130, from: 0, to: 0, thrust: true },
    bash:     { wind: 0.34, act: 0.12, rec: 0.5,  reach: 20, arc: 1.2,  mult: 0.6, col: 'w', lunge: 150, bash: true, kb: 220, stun: 0.35, from: 0.9, to: 0.9 },
    slam:     { wind: 1.0,  act: 0.16, rec: 0.85, reach: 30, arc: 9,    mult: 2.0, col: 'r', lunge: 0, slam: true, kb: 240, from: 3.0, to: 0, fwd: 14 },
    sweep:    { wind: 0.85, act: 0.3,  rec: 0.6,  reach: 34, arc: 9,    mult: 1.4, col: 'r', lunge: 0, spin: true, kb: 200, from: 1.6, to: 1.6 + PI * 2 },
    hook:     { wind: 0.6,  act: 0.16, rec: 0.55, reach: 30, arc: 1.5,  mult: 1.2, col: 'w', lunge: 60, from: 2.0, to: -1.6, kb: 140 },
    lunge:    { wind: 0.55, act: 0.32, rec: 0.6,  reach: 8,  arc: 9,    mult: 1.0, col: 'w', dash: 230, bite: true },
    charge:   { wind: 0.8,  act: 1.5,  rec: 0.5,  reach: 8,  arc: 9,    mult: 1.6, col: 'r', dash: 245, charge: true, kb: 280 },
    gore:     { wind: 0.42, act: 0.14, rec: 0.5,  reach: 16, arc: 1.2,  mult: 1.0, col: 'w', lunge: 110, kb: 160 },
    throw:    { wind: 0.5,  act: 0.1,  rec: 0.45, reach: 999, arc: 9,   mult: 0.7, col: 'w', throw: true, from: 2.6, to: -0.5 },
  };
  const WMOD = { long: 5, short: -2, axe: 2, club: 1, fangs: 0, tusks: 0, none: 0 };

  function init(e) {
    const ai = e.ai;
    e.tele = e.tele || U.clamp(1.42 - (e.level - 1) * 0.03, 0.85, 1.42);
    e.spdMul = e.speed || 1;
    e.cd = U.rand(0.9, 1.6) * (ai === 'wolf' ? 0.8 : 1);
    e.orbitR = ai === 'wolf' ? 54 : ai === 'bandit' ? 74 : ai === 'boar' ? 80 : ai === 'heavy' ? 52 : 56;
    e.orbitDir = U.chance(0.5) ? 1 : -1;
    e.moveSpd = 48 * e.spdMul * (ai === 'wolf' ? 1.55 : ai === 'heavy' ? 0.72 : ai === 'boar' ? 1.1 : ai === 'duelist' ? 1.15 : 1);
    e.blockCh = e.ai === 'dummy' ? 0 : ({ knight: 0.72, duelist: 0.3, champion: 0.32 }[ai] ?? (e.shield ? 0.3 : 0));
    e.parryCh = { duelist: 1, champion: 0.6 }[ai] || 0;
    e.armorAtk = ai === 'heavy' || ai === 'champion' || ai === 'boar';
    e.queue = [];
    e.guardPts = 0;
    e.guardMax = ai === 'knight' ? (e.level >= 8 ? 6 : 5) : 3;
    e.poise = e.level <= 3 ? 3 : 2; // flinches tolerated before super-armor + counter
    e.armorT = 0;
    e.flinches = 0; e.flinchT = 0;
    e.wmod = WMOD[e.weapon] || 0;
  }

  // ---- choose a move -------------------------------------------------
  function choose(e, d, S) {
    const r = Math.random();
    const L = e.level;
    switch (e.ai) {
      case 'brawler':
        if (L >= 4 && r < 0.3) return ['slash', 'slash2'];
        if (r < 0.15) return ['overhead'];
        return ['slash'];
      case 'knight':
        if (e.counter) { e.counter = false; return ['bash']; }
        if (L >= 8 && r < 0.25) return ['slash', 'slash2'];
        if (r < 0.45) return ['slash'];
        if (r < 0.72) return ['overhead'];
        return d < 34 ? ['bash'] : ['slash'];
      case 'heavy':
        if (r < 0.38) return ['overhead'];
        if (r < 0.75) return ['slam'];
        return L >= 12 ? ['hook', 'slam'] : ['hook'];
      case 'duelist':
        if (e.counter) { e.counter = false; return ['thrust']; }
        if (r < 0.32) return ['thrust'];
        if (r < 0.72) return L >= 6 ? ['slash', 'slash2', 'thrust'].slice(0, r < 0.5 ? 3 : 2) : ['slash', 'slash2'];
        e.feint = true;
        return ['slash'];
      case 'wolf':
        return ['lunge'];
      case 'boar':
        return d < 42 ? ['gore'] : ['charge'];
      case 'bandit':
        if (d > 56 && !S.proj.some((p) => p.owner === e)) return ['throw'];
        return r < 0.3 && L >= 6 ? ['stab', 'slash2'] : ['stab'];
      case 'champion':
        if (e.counter) { e.counter = false; return ['thrust']; }
        if (!e.phase2) {
          if (r < 0.3) return ['slash', 'slash2'];
          if (r < 0.48) return ['thrust'];
          if (r < 0.68) return ['overhead'];
          if (r < 0.8) { e.feint = true; return ['slash']; }
          return ['slam'];
        }
        if (r < 0.35) return ['slash', 'slash2', 'slash', 'sweep'];
        if (r < 0.52) return ['thrust', 'slash2'];
        if (r < 0.7) return ['slam'];
        if (r < 0.85) return ['sweep'];
        e.feint = true; return ['overhead'];
      default:
        return null;
    }
  }

  function rangeOf(e, name) {
    const mv = MV[name];
    if (mv.throw) return 170;
    if (mv.charge) return 400;
    if (mv.bite) return e.orbitR + 22;
    return mv.reach + e.wmod + 8 + (mv.lunge || 0) * 0.1 + (mv.slam ? mv.fwd : 0);
  }

  function begin(e, name, S, follow) {
    const mv = MV[name];
    e.mv = mv; e.mvName = name;
    e.state = 'windup'; e.st = 0; e.hitDone = false;
    let w = mv.wind * e.tele / e.spdMul;
    if (follow) w *= 0.7;
    if (e.feint && !follow) w *= 0.8;
    e.wind = w;
    e.glint = 0;
    e.dashAng = null;
    e.feinted = false;
    S.glint(e);
  }

  function cooldown(e) {
    return U.rand(0.5, 1.3) * (1.55 - (e.aggression ?? 0.5)) / e.spdMul * (e.phase2 ? 0.7 : 1);
  }

  // ---- defend against a player strike: 'parry' | 'block' | 'break' | null
  function defend(e, S, info) {
    if (e.ai === 'dummy' || e.dead) return null;
    if (!(e.state === 'idle' || e.state === 'recover' || e.state === 'guard')) return null;
    const P = S.P;
    const toP = U.angle(e.x, e.y, P.x, P.y);
    if (Math.abs(U.angleDiff(e.ang, toP)) > 1.2) return null;
    if (info.spin) return null;
    // duelists read predictable combos
    if (e.parryCh && info.i >= 1) {
      const ch = e.parryCh * (info.i === 1 ? 0.22 : 0.38) * U.clamp(0.6 + e.level * 0.03, 0.6, 1.2) * (e.phase2 ? 1.2 : 1);
      if (Math.random() < ch) { e.counter = true; e.cd = 0; return 'parry'; }
    }
    if (Math.random() < (e.state === 'guard' ? Math.max(e.blockCh, 0.85) : e.blockCh)) {
      e.guardPts += info.heavy ? 2 : 1;
      e.guardT = 0;
      if (e.guardPts >= e.guardMax) { e.guardPts = 0; return 'break'; }
      e.state = 'guard'; e.st = 0;
      if (e.ai === 'knight' && e.guardPts >= 2) { e.counter = true; e.cd = 0; }
      return 'block';
    }
    return null;
  }

  // ---- per-frame update ---------------------------------------------------
  function update(e, dt, S) {
    const P = S.P;
    e.st += dt; e.cd -= dt; e.glint += dt;
    e.flinchT -= dt; if (e.flinchT <= 0) e.flinches = 0;
    if (e.armorT > 0) { e.armorT -= dt; if (e.armorT <= 0) e.flinches = 0; }
    e.guardT = (e.guardT || 0) + dt;
    if (e.guardT > 1.6 && e.guardPts > 0) { e.guardPts--; e.guardT = 0; }
    const d = U.dist(e.x, e.y, P.x, P.y);
    const toP = U.angle(e.x, e.y, P.x, P.y);
    let mvx = 0, mvy = 0;
    const turn = (rate) => { e.ang += U.clamp(U.angleDiff(e.ang, toP), -rate * dt, rate * dt); };

    if (e.ai === 'dummy') { e.vx = 0; e.vy = 0; return; }

    // champion phase 2
    if (e.ai === 'champion' && !e.phase2 && e.hp <= e.maxHp * 0.5 && e.state !== 'dead') {
      e.phase2 = true;
      e.queue = []; S.releaseToken(e);
      e.state = 'roar'; e.st = 0; e.invuln = 1.1;
      e.spdMul *= 1.22; e.tele *= 0.88; e.moveSpd *= 1.15;
      S.roar(e);
    }

    switch (e.state) {
      case 'roar':
        if (e.st > 1.1) { e.state = 'idle'; e.cd = 0.3; }
        break;
      case 'hurt':
      case 'stagger':
      case 'stun':
        if (e.st >= e.stunT) { e.state = 'idle'; e.open = false; e.cd = Math.max(e.cd, 0.25); }
        break;
      case 'guard':
        turn(6);
        if (e.counter && e.st > 0.12 && (S.canAttack(e) || !S.tokenBusy())) {
          // shield bash / riposte straight out of the guard
          S.takeToken(e);
          e.queue = []; e.plan = null;
          begin(e, choose(e, d, S)[0], S, true);
          break;
        }
        if (e.st > 0.45) { e.state = 'idle'; if (e.counter) e.cd = 0; }
        break;
      case 'windup': {
        const mv = e.mv;
        if (mv.dash) {
          if (e.st < e.wind * 0.78) turn(5); else if (e.dashAng == null) e.dashAng = e.ang;
        } else turn(e.ai === 'heavy' ? 2 : 3.2);
        if (e.feint && !e.feinted && e.st > e.wind * 0.6) {
          // feint: abort and quickly strike for real
          e.feinted = true; e.feint = false;
          const real = U.chance(0.5) ? 'thrust' : 'slash2';
          begin(e, real, S, true);
          e.wind *= 1.1;
          e.glint = 0;
          S.feint(e);
          break;
        }
        if (e.st >= e.wind) {
          e.state = 'attack'; e.st = 0; e.hitDone = false;
          if (mv.dash) e.dashAng = e.dashAng ?? e.ang;
          if (mv.throw) S.throwDagger(e);
          else if (mv.slam) S.slamFx(e);
          else S.sfx(mv.dash ? 'dodge' : 'swing');
          if (mv.lunge) { e.kbx += Math.cos(e.ang) * mv.lunge; e.kby += Math.sin(e.ang) * mv.lunge; }
        }
        break;
      }
      case 'attack': {
        const mv = e.mv;
        if (mv.dash) {
          const a = e.dashAng;
          mvx = Math.cos(a) * mv.dash; mvy = Math.sin(a) * mv.dash;
          e.ang = a;
          if (mv.charge && e.st % 0.08 < dt) S.dust(e.x, e.y, 1);
          if (!e.hitDone && d < e.r + P.r + mv.reach) {
            e.hitDone = true;
            const res = S.hitPlayer(e, mv, e.x, e.y);
            if (res === 'parry') break;
            e.state = 'recover'; e.st = 0;
            e.kbx -= Math.cos(a) * 80; e.kby -= Math.sin(a) * 80;
            break;
          }
          if (mv.charge && e.hitWall && e.st > 0.1) {
            S.wallStun(e);
            break;
          }
          if (e.st >= mv.act * (mv.charge ? 1 : 1)) { e.state = 'recover'; e.st = 0; }
          break;
        }
        if (!e.hitDone && !mv.throw) {
          let inRange;
          if (mv.slam) {
            const cx = e.x + Math.cos(e.ang) * mv.fwd, cy = e.y + Math.sin(e.ang) * mv.fwd;
            inRange = U.dist(cx, cy, P.x, P.y) < mv.reach + P.r;
          } else {
            inRange = d < mv.reach + e.wmod + P.r + e.r * 0.5 && (mv.arc > 4 || Math.abs(U.angleDiff(e.ang, toP)) < mv.arc);
          }
          if (inRange) {
            e.hitDone = true;
            const res = S.hitPlayer(e, mv, e.x, e.y);
            if (res === 'parry') break;
          }
        }
        if (e.st >= mv.act) { e.state = 'recover'; e.st = 0; }
        break;
      }
      case 'recover': {
        const mv = e.mv;
        const rec = mv.rec * (e.queue.length ? 0.35 : 1) / Math.sqrt(e.spdMul);
        if (e.ai === 'wolf' && e.st > 0.15) { mvx = -Math.cos(toP) * e.moveSpd * 0.6; mvy = -Math.sin(toP) * e.moveSpd * 0.6; }
        if (e.st >= rec) {
          if (e.queue.length && P.state !== 'dead') { begin(e, e.queue.shift(), S, true); }
          else { e.state = 'idle'; e.st = 0; S.releaseToken(e); e.cd = cooldown(e); }
        }
        break;
      }
      case 'idle':
      default: {
        if (S.phase !== 'fight' || P.state === 'dead') { turn(4); break; }
        turn(e.ai === 'heavy' ? 4 : 7);
        let plan = null;
        if (e.cd <= 0 && S.canAttack(e)) {
          if (!e.plan) e.plan = choose(e, d, S);
          plan = e.plan;
        }
        if (plan) {
          const first = plan[0];
          if (d <= rangeOf(e, first) && !(first === 'charge' && d < 62)) {
            S.takeToken(e);
            e.queue = plan.slice(1);
            e.plan = null;
            begin(e, first, S, false);
            break;
          }
          // approach
          const sp = e.moveSpd * (e.ai === 'wolf' ? 0.8 : 1) * (d > 90 ? 1.5 : 1);
          mvx = Math.cos(toP) * sp; mvy = Math.sin(toP) * sp;
          if (e.ai === 'boar' && first === 'charge' && d < 70) { mvx = -mvx; mvy = -mvy; } // back off for a run-up
        } else {
          // orbit around the player at a respectful distance (flanking for packs)
          let slot = e.slot ?? U.angle(P.x, P.y, e.x, e.y);
          if (e.ai === 'wolf' && S.packN > 1) {
            const want = P.ang + PI + (e.packI - (S.packN - 1) / 2) * 1.3;
            slot += U.clamp(U.angleDiff(slot, want), -1.2 * dt, 1.2 * dt);
          } else slot += e.orbitDir * 0.35 * dt;
          e.slot = slot;
          const tx = P.x + Math.cos(slot) * e.orbitR, ty = P.y + Math.sin(slot) * e.orbitR;
          const dd = U.dist(e.x, e.y, tx, ty);
          if (dd > 4) {
            const sp = Math.min(e.moveSpd * (dd > 60 ? 1.3 : 0.75), dd * 4);
            mvx = ((tx - e.x) / dd) * sp; mvy = ((ty - e.y) / dd) * sp;
          }
          if (U.chance(dt * 0.3)) e.orbitDir *= -1;
          if (e.ai === 'knight' && e.shield) e.guardUp = true;
        }
        break;
      }
    }
    e.vx = mvx; e.vy = mvy;
  }

  // Called when a hit would make the enemy flinch. Returns true if it flinches;
  // otherwise it shrugs it off (poise) and lashes back with a quick attack.
  function flinch(e, S) {
    if (e.armorT > 0) return false;
    if (e.flinches < e.poise) { e.flinches++; e.flinchT = 1.6; return true; }
    e.armorT = 1.3;
    if ((e.state === 'idle' || e.state === 'hurt' || e.state === 'recover' || e.state === 'guard') && S.P.state !== 'dead' && (S.canAttack(e) || !S.tokenBusy())) {
      S.takeToken(e);
      e.queue = []; e.plan = null;
      const q = e.ai === 'wolf' ? 'lunge' : e.ai === 'boar' ? 'gore' : e.ai === 'bandit' ? 'stab' : e.ai === 'knight' && e.shield ? 'bash' : 'slash';
      begin(e, q, S, true);
      S.poise(e);
    }
    return false;
  }

  G.SW.ai = { MV, init, update, defend, begin, flinch };
})();
