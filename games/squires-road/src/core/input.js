// Core: invisible joypad. Left half = floating stick, right half = gestures.
(() => {
  const STICK_R = 22;
  const TAP_MS = 260, TAP_DIST = 12, HOLD_MS = 200, FLICK_MS = 240, FLICK_DIST = 20;

  const KEYMAP = {
    KeyZ: 'a', KeyJ: 'a', Space: 'a', Enter: 'a', NumpadEnter: 'a',
    KeyX: 'b', KeyK: 'b', Backspace: 'b',
    KeyC: 'c', KeyL: 'c', ShiftLeft: 'c', ShiftRight: 'c',
    Escape: 'menu', KeyM: 'menu', KeyP: 'menu',
  };
  const DIRKEYS = {
    ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
    ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
  };

  const pointers = new Map(); // id -> {zone, x, y, startX, startY, t0, flicked, held, ox, oy}
  const keysDown = new Set();
  const vkDown = { a: false, b: false, c: false, menu: false };
  const vkPressed = { a: false, b: false, c: false, menu: false };
  const vkReleased = { a: false, b: false, c: false, menu: false };
  let tapPressedA = false;

  const input = {
    events: [],
    stick: { x: 0, y: 0, mag: 0, active: false, ox: 0, oy: 0, px: 0, py: 0 },
    lastWasTouch: false,

    attach(canvas) {
      const opts = { passive: false };
      canvas.addEventListener('pointerdown', onDown, opts);
      window.addEventListener('pointermove', onMove, opts);
      window.addEventListener('pointerup', onUp, opts);
      window.addEventListener('pointercancel', onUp, opts);
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      document.addEventListener('gesturestart', (e) => e.preventDefault());
      window.addEventListener('keydown', (e) => {
        if (e.repeat) { if (DIRKEYS[e.code] || KEYMAP[e.code]) e.preventDefault(); return; }
        if (DIRKEYS[e.code] || KEYMAP[e.code]) e.preventDefault();
        input.lastWasTouch = false;
        keysDown.add(e.code);
        const vk = KEYMAP[e.code];
        if (vk) {
          if (!vkDown[vk]) vkPressed[vk] = true;
          vkDown[vk] = true;
          input.events.push({ type: 'key', key: vk, down: true });
        }
        G.audio && G.audio.unlock();
      });
      window.addEventListener('keyup', (e) => {
        keysDown.delete(e.code);
        const vk = KEYMAP[e.code];
        if (vk) {
          // only release if no other key mapping to vk is held
          const still = Object.keys(KEYMAP).some((k) => KEYMAP[k] === vk && keysDown.has(k));
          if (!still) { vkDown[vk] = false; vkReleased[vk] = true; }
          input.events.push({ type: 'key', key: vk, down: false });
        }
      });
      window.addEventListener('blur', () => {
        keysDown.clear();
        // Tell scenes every held pointer ended (cancelled: never counts as a tap).
        const now = performance.now();
        for (const p of pointers.values()) {
          input.events.push({ type: 'up', zone: p.zone, x: p.x, y: p.y, id: p.id, dur: now - p.t0, dist: p.maxDist, held: p.held, flicked: p.flicked, cancelled: true });
        }
        pointers.clear();
        for (const k in vkDown) vkDown[k] = false;
      });
    },

    // --- per-frame queries ------------------------------------------------
    dir4() {
      const s = input.stick;
      if (s.mag < 0.35) return null;
      if (Math.abs(s.x) > Math.abs(s.y)) return s.x > 0 ? 'right' : 'left';
      return s.y > 0 ? 'down' : 'up';
    },
    pressed(k) { return vkPressed[k] || (k === 'a' && tapPressedA); },
    released(k) { return vkReleased[k]; },
    down(k) {
      if (vkDown[k]) return true;
      if (k === 'a') return !!input.rHold();
      return false;
    },
    keyDown(code) { return keysDown.has(code); },
    rHold() { return longest('R'); },
    lHold() { return longest('L'); },
    pointerIn(r) {
      for (const p of pointers.values())
        if (p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h) return true;
      return false;
    },
    consumeTap(r) {
      for (let i = 0; i < input.events.length; i++) {
        const e = input.events[i];
        if (e.type === 'tap' && e.x >= r.x && e.x < r.x + r.w && e.y >= r.y && e.y < r.y + r.h) {
          input.events.splice(i, 1);
          // a tap consumed by UI shouldn't also count as an action press
          if (e.zone === 'R') tapPressedA = false;
          return e;
        }
      }
      return null;
    },
    // Remove every tap (e.g. after a dialog consumed the frame's input).
    consumeAllTaps() {
      input.events = input.events.filter((e) => e.type !== 'tap');
      tapPressedA = false;
      vkPressed.a = false; vkPressed.b = false;
    },
    anyTap() {
      return input.events.some((e) => e.type === 'tap') || vkPressed.a || vkPressed.b;
    },
    has(type, zone) {
      return input.events.find((e) => e.type === type && (!zone || e.zone === zone)) || null;
    },
    // Call once per frame, before scene update.
    poll() {
      // keyboard stick
      let kx = 0, ky = 0;
      for (const code of keysDown) {
        const d = DIRKEYS[code];
        if (d) { kx += d[0]; ky += d[1]; }
      }
      const s = input.stick;
      const lp = longest('L');
      if (lp) {
        let dx = lp.x - lp.ox, dy = lp.y - lp.oy;
        const m = Math.hypot(dx, dy);
        // drag the origin along if thumb goes beyond the ring (feels better)
        if (m > STICK_R * 1.4) {
          lp.ox = lp.x - (dx / m) * STICK_R * 1.4;
          lp.oy = lp.y - (dy / m) * STICK_R * 1.4;
          dx = lp.x - lp.ox; dy = lp.y - lp.oy;
        }
        const mm = Math.hypot(dx, dy);
        const mag = Math.min(1, mm / STICK_R);
        s.x = mm ? (dx / mm) * mag : 0;
        s.y = mm ? (dy / mm) * mag : 0;
        s.mag = mag; s.active = true;
        s.ox = lp.ox; s.oy = lp.oy; s.px = lp.x; s.py = lp.y;
      } else if (kx || ky) {
        const m = Math.hypot(kx, ky);
        s.x = kx / m; s.y = ky / m; s.mag = 1; s.active = false;
      } else {
        s.x = 0; s.y = 0; s.mag = 0; s.active = false;
      }
      // hold events
      const now = performance.now();
      for (const [id, p] of pointers) {
        if (!p.held && !p.flicked && now - p.t0 >= HOLD_MS && p.maxDist < TAP_DIST) {
          p.held = true;
          input.events.push({ type: 'hold', zone: p.zone, x: p.x, y: p.y, id });
        }
      }
    },
    endFrame() {
      input.events.length = 0;
      tapPressedA = false;
      for (const k in vkPressed) { vkPressed[k] = false; vkReleased[k] = false; }
    },
    // Faint stick ring (scenes call this if they want it; overworld + sword do).
    drawStick(ctx) {
      const s = input.stick;
      if (!s.active) return;
      G.draw.circle(s.ox, s.oy, STICK_R, 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.35)', 1);
      G.draw.circle(s.ox + s.x * STICK_R, s.oy + s.y * STICK_R, 7, 'rgba(255,255,255,0.3)');
    },
    STICK_R,
  };

  function longest(zone) {
    let best = null;
    const now = performance.now();
    for (const [id, p] of pointers) {
      if (p.zone !== zone) continue;
      if (!best || p.t0 < best.t0) best = p;
    }
    if (!best) return null;
    return Object.assign(best, { dur: now - best.t0, dist: Math.hypot(best.x - best.startX, best.y - best.startY) });
  }

  function onDown(e) {
    e.preventDefault();
    G.audio && G.audio.unlock();
    input.lastWasTouch = e.pointerType !== 'mouse';
    const { x, y } = G.gfx.toLogical(e.clientX, e.clientY);
    const zone = x < G.W / 2 ? 'L' : 'R';
    const p = { id: e.pointerId, zone, x, y, startX: x, startY: y, ox: x, oy: y, t0: performance.now(), flicked: false, held: false, maxDist: 0 };
    pointers.set(e.pointerId, p);
    try { e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    input.events.push({ type: 'down', zone, x, y, id: e.pointerId });
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    e.preventDefault();
    const { x, y } = G.gfx.toLogical(e.clientX, e.clientY);
    p.x = x; p.y = y;
    const d = Math.hypot(x - p.startX, y - p.startY);
    p.maxDist = Math.max(p.maxDist, d);
    if (!p.flicked && !p.held && d >= FLICK_DIST && performance.now() - p.t0 <= FLICK_MS) {
      p.flicked = true;
      input.events.push({ type: 'flick', zone: p.zone, dx: (x - p.startX) / d, dy: (y - p.startY) / d, x, y, id: p.id });
    }
  }
  function onUp(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const { x, y } = G.gfx.toLogical(e.clientX, e.clientY);
    pointers.delete(e.pointerId);
    const dur = performance.now() - p.t0;
    const dist = Math.max(p.maxDist, Math.hypot(x - p.startX, y - p.startY));
    input.events.push({ type: 'up', zone: p.zone, x, y, id: p.id, dur, dist, held: p.held, flicked: p.flicked, cancelled: e.type === 'pointercancel' });
    if (e.type !== 'pointercancel' && dur < TAP_MS && dist < TAP_DIST && !p.flicked) {
      input.events.push({ type: 'tap', zone: p.zone, x: p.startX, y: p.startY });
      if (p.zone === 'R') tapPressedA = true;
    }
  }

  G.input = input;
})();
