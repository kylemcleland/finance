// Core: global namespace + math helpers.
window.G = window.G || {};
(() => {
  const U = {
    clamp: (v, a, b) => (v < a ? a : v > b ? b : v),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a = 0, b = 1) => a + Math.random() * (b - a),
    randi: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    chance: (p) => Math.random() < p,
    dist: (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay),
    angle: (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax),
    sign: (v) => (v < 0 ? -1 : v > 0 ? 1 : 0),
    approach: (cur, target, step) =>
      cur < target ? Math.min(cur + step, target) : Math.max(cur - step, target),
    angleDiff: (a, b) => {
      let d = b - a;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      return d;
    },
    shuffle: (arr) => {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    // Weighted pick from [{w, ...}]
    weighted: (list) => {
      let total = 0;
      for (const e of list) total += e.w ?? 1;
      let r = Math.random() * total;
      for (const e of list) {
        r -= e.w ?? 1;
        if (r <= 0) return e;
      }
      return list[list.length - 1];
    },
    ease: {
      linear: (t) => t,
      inQuad: (t) => t * t,
      outQuad: (t) => 1 - (1 - t) * (1 - t),
      inOut: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
      outCubic: (t) => 1 - Math.pow(1 - t, 3),
      outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
      outElastic: (t) =>
        t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
    },
    // Split text into lines that fit maxW using the current ctx font.
    wrapText: (ctx, text, maxW) => {
      const out = [];
      for (const para of String(text).split('\n')) {
        const words = para.split(' ');
        let line = '';
        for (const w of words) {
          const test = line ? line + ' ' + w : w;
          if (ctx.measureText(test).width > maxW && line) {
            out.push(line);
            line = w;
          } else line = test;
        }
        out.push(line);
      }
      return out;
    },
    // Tiny seeded RNG (mulberry32) for deterministic decoration.
    rng: (seed) => {
      let a = seed >>> 0;
      return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    },
    hash2: (x, y) => {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = (h ^ (h >>> 13)) * 1274126177;
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    },
    sleep: (ms) => new Promise((r) => G.timers.add(ms, r)),
    // Shade a #rrggbb color by amt (-1..1)
    shade: (hex, amt) => {
      const n = parseInt(hex.slice(1), 16);
      let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
      else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
      const h = (v) => Math.round(v).toString(16).padStart(2, '0');
      return '#' + h(r) + h(g) + h(b);
    },
  };
  G.U = U;
  G.TILE = 16;
  // Registries filled by data/content files (safe at load time in any order).
  G.roster = { sword: {}, joust: {}, archery: {} };
  G.maps = {};
  G.halls = {};
  G.shops = {};
  G.debug = {};
  G.time = 0; // seconds since boot (game-time; advances in the main loop)

  // Game-time timers (pause with the loop; used by U.sleep / c.wait).
  const list = [];
  G.timers = {
    add(ms, fn) { list.push({ t: ms / 1000, fn }); },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        list[i].t -= dt;
        if (list[i].t <= 0) { const fn = list[i].fn; list.splice(i, 1); fn(); }
      }
    },
  };

  G.PAL = {
    ink: '#2b1d14',
    paper: '#f4e4c1',
    paperDark: '#d9c08f',
    edge: '#7a4b2a',
    gold: '#f2c14e',
    red: '#d6453d',
    green: '#5bb04a',
    blue: '#3f7fd1',
    sky: '#8fd3ff',
    white: '#ffffff',
    shadow: 'rgba(0,0,0,0.28)',
    hp: '#e0473c',
    sta: '#f2c14e',
    xp: '#6fc3ff',
    dim: 'rgba(20,12,8,0.55)',
  };
})();
