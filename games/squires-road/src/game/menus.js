// Menu UI kit (G.mui: icons, buttons, scroll areas, keyboard nav) + the pause menu (G.menus.open).
// DESIGN.md §9. Shop and tournament screens reuse G.mui at runtime.
(() => {
  const U = G.U;
  const D = () => G.draw;
  const ctx = () => G.gfx.ctx;
  const PAL = () => G.PAL;

  // ======================================================================
  // Small helpers
  // ======================================================================
  const inter = (a, b) => {
    const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
    const r = Math.min(a.x + a.w, b.x + b.w), btm = Math.min(a.y + a.h, b.y + b.h);
    return r > x && btm > y ? { x, y, w: r - x, h: btm - y } : null;
  };
  const keyDown = (k) => G.input.events.some((e) => e.type === 'key' && e.key === k && e.down);
  const fmtTime = (s) => {
    s = Math.floor(s || 0);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };
  // One step per cup tier won in a discipline (Novice, Seal, Squire, Knight, Champion cups).
  const RANKS = ['Novice', 'Squire', 'Veteran', 'Knight', 'Champion'];
  const rankTitle = (r) => RANKS[U.clamp(r | 0, 0, RANKS.length - 1)];
  const SEALS = [
    { id: 'sword', name: 'Seal of the Blade', short: 'Blade', color: '#d6453d' },
    { id: 'archery', name: 'Seal of the Arrow', short: 'Arrow', color: '#5bb04a' },
    { id: 'joust', name: 'Seal of the Lance', short: 'Lance', color: '#3f7fd1' },
    { id: 'grand', name: 'Crown of the Realm', short: 'Crown', color: '#f2c14e' },
  ];
  const DISC = {
    sword: { name: 'Sword', color: '#d6453d', icon: 'weapon' },
    archery: { name: 'Archery', color: '#5bb04a', icon: 'bow' },
    joust: { name: 'Joust', color: '#3f7fd1', icon: 'lance' },
    mixed: { name: 'Grand', color: '#c99a2e', icon: 'crown' },
  };

  // ======================================================================
  // Procedural icons. Drawn on a 16x16 grid centred on (cx, cy), `s` px wide.
  // ======================================================================
  function icon(kind, cx, cy, s = 16, o = {}) {
    const c = ctx();
    c.save();
    c.translate(cx, cy);
    c.scale(s / 16, s / 16);
    c.translate(-8, -8);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    const ink = '#2b1d14';
    const poly = (pts, fill, stroke, lw = 1) => {
      c.beginPath();
      c.moveTo(pts[0], pts[1]);
      for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
      c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
    };
    const ln = (x1, y1, x2, y2, col, lw = 1) => {
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = lw; c.strokeStyle = col; c.stroke();
    };
    const circ = (x, y, r, fill, stroke, lw = 1) => {
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.lineWidth = lw; c.strokeStyle = stroke; c.stroke(); }
    };
    const col = o.color;
    const sh = U.shade;
    switch (kind) {
      case 'stick': {
        ln(3, 14, 13, 2, ink, 3.4); ln(3, 14, 13, 2, '#9a6a3a', 2);
        ln(8, 8, 10, 9, '#9a6a3a', 1.5); circ(6, 10.5, 0.8, '#6a4520');
        break;
      }
      case 'axe': {
        ln(4, 14, 11, 3, ink, 3); ln(4, 14, 11, 3, '#8a5a30', 1.6);
        poly([9, 2, 14, 3, 15, 8, 12, 9, 10, 6], col || '#aab0bb', ink, 1);
        ln(13, 4, 14.2, 7.5, '#fff', 0.6);
        break;
      }
      case 'weapon': {
        const b = col || '#cfd5df';
        poly([12.5, 1.5, 14.5, 3.5, 6.5, 11, 5, 9.5], b, ink, 1); // blade
        ln(12.8, 2.6, 6.2, 9.4, sh(b, 0.6), 0.6);
        ln(3, 8, 8, 13, ink, 2.6); ln(3, 8, 8, 13, '#d7a838', 1.5); // guard
        ln(5.5, 10.5, 2.5, 13.5, ink, 2.6); ln(5.5, 10.5, 2.5, 13.5, '#6a3b1f', 1.4); // grip
        circ(2.2, 13.8, 1.4, '#d7a838', ink, 0.8);
        break;
      }
      case 'shield': {
        const b = col || '#3b6fc4';
        poly([2.5, 2.5, 13.5, 2.5, 13.5, 8, 8, 14.5, 2.5, 8], b, ink, 1.2);
        poly([8, 2.5, 13.5, 2.5, 13.5, 8, 8, 14.5], sh(b, -0.18));
        c.beginPath(); c.moveTo(2.5, 2.5); c.lineTo(13.5, 2.5); c.lineTo(13.5, 8); c.lineTo(8, 14.5); c.lineTo(2.5, 8); c.closePath();
        c.lineWidth = 1; c.strokeStyle = '#d7a838'; c.stroke();
        ln(8, 3.5, 8, 13, '#f2e6c8', 1); ln(3.5, 6.5, 12.5, 6.5, '#f2e6c8', 1);
        circ(8, 6.5, 1.4, '#f2c14e', ink, 0.6);
        break;
      }
      case 'armor': {
        const b = col || '#9aa3b2';
        poly([4, 2, 6.5, 3, 9.5, 3, 12, 2, 14.5, 5, 12.5, 7, 12, 14, 4, 14, 3.5, 7, 1.5, 5], b, ink, 1.1);
        ln(8, 4, 8, 13.5, sh(b, -0.3), 0.8);
        ln(4.5, 9, 11.5, 9, sh(b, -0.3), 0.8); ln(4.5, 11.5, 11.5, 11.5, sh(b, -0.3), 0.8);
        ln(5, 4.5, 6.5, 7, sh(b, 0.5), 0.8);
        break;
      }
      case 'lance': {
        const b = col || '#c43c3c';
        ln(2, 14, 14, 2, ink, 2.6);
        for (let i = 0; i < 4; i++) ln(2 + i * 2.2, 14 - i * 2.2, 3.8 + i * 2.2, 12.2 - i * 2.2, i % 2 ? '#f2e6c8' : b, 1.5);
        ln(10, 6, 14.2, 1.8, '#e8e2d2', 1.4);
        poly([4.2, 8, 8, 11.8, 7.2, 12.6, 3.4, 8.8], '#b8bcc6', ink, 0.8); // vamplate
        poly([3, 13, 5, 15, 2, 15.5, 1, 14], ink);
        break;
      }
      case 'horse': {
        const b = col || '#8a6a4a';
        poly([5, 15, 5, 9, 4, 5.5, 6.5, 2.5, 7.5, 1, 8.5, 2.5, 10.5, 3, 14.5, 7.5, 14, 9.5, 11.5, 9, 9.5, 8, 10.5, 15], b, ink, 1);
        poly([6.5, 2.5, 4, 5.5, 5, 9, 5, 15, 3.5, 15, 3, 9, 2.5, 5, 5, 2], sh(b, -0.55)); // mane
        circ(10.3, 5, 0.8, '#111');
        circ(13.6, 8, 0.6, '#3a2010');
        ln(9.5, 8, 12, 4.5, '#5a3a22', 0.6); // bridle
        ln(12.2, 4.6, 14.2, 7.6, '#5a3a22', 0.6);
        ln(8, 3, 9.5, 4, sh(b, 0.35), 0.7);
        break;
      }
      case 'bow': {
        const b = col || '#8a5a2a';
        c.beginPath(); c.arc(-1, 8, 12.5, -Math.PI / 3.2, Math.PI / 3.2);
        c.lineWidth = 2.6; c.strokeStyle = ink; c.stroke();
        c.lineWidth = 1.4; c.strokeStyle = b; c.stroke();
        const a = Math.PI / 3.2, ex = -1 + 12.5 * Math.cos(a), ey = 12.5 * Math.sin(a);
        ln(ex, 8 - ey, ex, 8 + ey, '#efe6d0', 0.6);
        ln(2, 8, 15, 8, ink, 1.6); ln(2, 8, 15, 8, '#c9a36a', 0.8);
        poly([15.5, 8, 13, 6.5, 13, 9.5], '#b8bcc6', ink, 0.5);
        poly([2, 8, 4, 6.2, 4.6, 8, 4, 9.8], '#d6453d');
        circ(10.6, 8, 1, '#5a3a22');
        break;
      }
      case 'potion': {
        const b = col || '#e0473c';
        c.beginPath(); c.arc(8, 10.5, 4.6, 0, Math.PI * 2); c.fillStyle = '#dfeef5'; c.fill();
        c.lineWidth = 1; c.strokeStyle = ink; c.stroke();
        c.beginPath(); c.arc(8, 10.5, 3.8, 0.15 * Math.PI, 0.85 * Math.PI); c.fillStyle = b; c.fill();
        c.fillStyle = b; c.fillRect(4.4, 10.2, 7.2, 1.5);
        poly([6.5, 2.5, 9.5, 2.5, 9.5, 6.3, 6.5, 6.3], '#dfeef5', ink, 0.9);
        poly([6, 1, 10, 1, 10, 3, 6, 3], '#8a5a30', ink, 0.7);
        circ(6.2, 9, 0.9, 'rgba(255,255,255,0.8)');
        break;
      }
      case 'bread': {
        c.beginPath(); c.ellipse(8, 9.5, 6.5, 4.5, -0.15, 0, Math.PI * 2);
        c.fillStyle = '#d9963e'; c.fill(); c.lineWidth = 1; c.strokeStyle = ink; c.stroke();
        c.beginPath(); c.ellipse(8, 8.6, 5.4, 3, -0.15, Math.PI, Math.PI * 2); c.fillStyle = '#f0b860'; c.fill();
        for (let i = 0; i < 3; i++) ln(5 + i * 2.6, 7.5 - i * 0.4, 6.3 + i * 2.6, 9.7 - i * 0.4, '#8a5420', 0.8);
        break;
      }
      case 'herb': {
        ln(8, 15, 8, 6, '#3f7a2a', 1.2);
        for (const [x, y, r] of [[5, 6, -0.6], [11, 5.5, 0.6], [6, 10, -0.8], [10.5, 9.5, 0.8], [8, 3, 0]]) {
          c.save(); c.translate(x, y); c.rotate(r);
          c.beginPath(); c.ellipse(0, 0, 2, 3.4, 0, 0, Math.PI * 2);
          c.fillStyle = '#5bb04a'; c.fill(); c.lineWidth = 0.8; c.strokeStyle = '#1f4a14'; c.stroke();
          c.restore();
        }
        break;
      }
      case 'key': {
        circ(5, 5.5, 3.4, null, ink, 3); circ(5, 5.5, 3.4, null, '#f2c14e', 1.6);
        ln(7.5, 8, 14, 14.5, ink, 3); ln(7.5, 8, 14, 14.5, '#f2c14e', 1.6);
        ln(11, 11.5, 9.5, 13, ink, 2.6); ln(11, 11.5, 9.5, 13, '#f2c14e', 1.2);
        ln(13, 13.5, 11.5, 15, ink, 2.6); ln(13, 13.5, 11.5, 15, '#f2c14e', 1.2);
        break;
      }
      case 'scroll': {
        poly([3, 3, 12, 3, 12, 13, 3, 13], '#f4e4c1', ink, 1);
        c.fillStyle = '#d9c08f'; c.fillRect(2, 2, 11, 2.4); c.fillRect(4, 12, 11, 2.4);
        c.strokeStyle = ink; c.lineWidth = 0.8; c.strokeRect(2, 2, 11, 2.4); c.strokeRect(4, 12, 11, 2.4);
        for (let i = 0; i < 3; i++) ln(5, 6.5 + i * 2, 10.5, 6.5 + i * 2, '#8a6a4a', 0.7);
        circ(10, 12.5, 1.5, '#c43c3c');
        break;
      }
      case 'horseshoe': {
        c.beginPath(); c.arc(8, 7, 5, Math.PI * 0.85, Math.PI * 2.15, false);
        c.lineWidth = 3.6; c.strokeStyle = ink; c.stroke(); c.lineWidth = 2.2; c.strokeStyle = '#b8bcc6'; c.stroke();
        ln(3.3, 9, 3.3, 13.5, ink, 3.6); ln(3.3, 9, 3.3, 13.5, '#b8bcc6', 2.2);
        ln(12.7, 9, 12.7, 13.5, ink, 3.6); ln(12.7, 9, 12.7, 13.5, '#b8bcc6', 2.2);
        for (const [x, y] of [[4, 5], [8, 2.2], [12, 5]]) circ(x, y, 0.6, ink);
        break;
      }
      case 'ring': {
        circ(8, 10, 4.5, null, ink, 3); circ(8, 10, 4.5, null, '#d7a838', 1.7);
        poly([5, 5, 11, 5, 10, 2, 6, 2], '#1a1a1a', '#d7a838', 0.8);
        break;
      }
      case 'quiver': {
        poly([4, 5, 11, 4, 12, 15, 5, 15.5], '#8a5a30', ink, 1);
        for (const [x, cl] of [[5.5, '#d6453d'], [8, '#f2e6c8'], [10.5, '#3f7fd1']]) {
          ln(x, 5, x - 0.5, 1.5, ink, 0.8); poly([x - 1.3, 2.8, x - 0.5, 0.6, x + 0.5, 2.8], cl);
        }
        ln(5, 9, 11.5, 8.5, '#5a3a22', 0.8);
        break;
      }
      case 'coin': {
        circ(8, 8, 6, '#f2c14e', ink, 1.2); circ(8, 8, 4.3, null, '#c9962e', 0.9);
        ln(6.5, 6, 6.5, 10, '#fff3b0', 1); circ(5.5, 5, 0.9, '#fff8d8');
        break;
      }
      case 'trophy': {
        const b = col || '#f2c14e';
        c.beginPath(); c.moveTo(4, 2); c.lineTo(12, 2); c.lineTo(11.5, 7); c.quadraticCurveTo(8, 11, 4.5, 7); c.closePath();
        c.fillStyle = b; c.fill(); c.lineWidth = 1; c.strokeStyle = ink; c.stroke();
        c.beginPath(); c.arc(3.5, 4.5, 2, Math.PI * 0.5, Math.PI * 1.5); c.lineWidth = 1.2; c.strokeStyle = ink; c.stroke();
        c.beginPath(); c.arc(12.5, 4.5, 2, -Math.PI * 0.5, Math.PI * 0.5); c.stroke();
        poly([7, 9.5, 9, 9.5, 9.5, 12, 6.5, 12], sh(b, -0.2), ink, 0.8);
        poly([4.5, 12, 11.5, 12, 12, 14.5, 4, 14.5], '#6a3b1f', ink, 0.8);
        ln(5.5, 3, 6, 6.5, '#fff8d0', 0.9);
        break;
      }
      case 'crown': {
        poly([2, 12.5, 2, 5, 5, 8.5, 8, 3, 11, 8.5, 14, 5, 14, 12.5], '#f2c14e', ink, 1.1);
        c.fillStyle = '#c9962e'; c.fillRect(2, 11, 12, 1.5);
        circ(8, 9, 1.2, '#d6453d'); circ(4.7, 10, 0.8, '#3f7fd1'); circ(11.3, 10, 0.8, '#5bb04a');
        circ(2, 5, 0.9, '#fff3b0'); circ(8, 3, 0.9, '#fff3b0'); circ(14, 5, 0.9, '#fff3b0');
        break;
      }
      case 'lock': {
        c.beginPath(); c.arc(8, 7, 3.2, Math.PI, 0); c.lineWidth = 3.2; c.strokeStyle = ink; c.stroke();
        c.lineWidth = 1.6; c.strokeStyle = '#9aa0aa'; c.stroke();
        poly([3.5, 7, 12.5, 7, 12.5, 14, 3.5, 14], '#c9a36a', ink, 1);
        circ(8, 10, 1.1, ink); ln(8, 10.5, 8, 12.3, ink, 1);
        break;
      }
      case 'check': {
        ln(3, 8.5, 6.5, 12, ink, 3.4); ln(6.5, 12, 13, 4, ink, 3.4);
        ln(3, 8.5, 6.5, 12, col || '#7fe07a', 1.8); ln(6.5, 12, 13, 4, col || '#7fe07a', 1.8);
        break;
      }
      case 'star': {
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 2.8 : 6.5;
          pts.push(8 + Math.cos(a) * r, 8.5 + Math.sin(a) * r);
        }
        poly(pts, col || '#f2c14e', ink, 1);
        break;
      }
      case 'person': {
        circ(8, 5, 3.2, '#f1c27d', ink, 1);
        c.beginPath(); c.moveTo(2.5, 15); c.quadraticCurveTo(3, 9, 8, 9); c.quadraticCurveTo(13, 9, 13.5, 15); c.closePath();
        c.fillStyle = col || '#5f8f3a'; c.fill(); c.lineWidth = 1; c.strokeStyle = ink; c.stroke();
        c.fillStyle = '#7a4a24'; c.beginPath(); c.arc(8, 4.4, 3.2, Math.PI, 0); c.fill();
        break;
      }
      case 'bag': {
        c.beginPath(); c.moveTo(5, 5); c.quadraticCurveTo(1.5, 9, 3, 13.5); c.quadraticCurveTo(8, 15.5, 13, 13.5);
        c.quadraticCurveTo(14.5, 9, 11, 5); c.closePath();
        c.fillStyle = col || '#a8743a'; c.fill(); c.lineWidth = 1.1; c.strokeStyle = ink; c.stroke();
        poly([5, 5, 11, 5, 12, 2.5, 4, 2.5], sh(col || '#a8743a', -0.2), ink, 0.9);
        ln(4.8, 5.2, 11.2, 5.2, '#d7a838', 1.2);
        circ(8, 10, 1.4, '#f2c14e', ink, 0.6);
        break;
      }
      case 'map': {
        poly([1.5, 3.5, 5.5, 2, 10.5, 3.5, 14.5, 2, 14.5, 12.5, 10.5, 14, 5.5, 12.5, 1.5, 14], '#f4e4c1', ink, 1);
        poly([5.5, 2, 10.5, 3.5, 10.5, 14, 5.5, 12.5], '#e6cf9c');
        c.setLineDash([1.2, 1.2]); ln(3, 11, 7, 7, '#c43c3c', 0.9); ln(7, 7, 12, 6, '#c43c3c', 0.9); c.setLineDash([]);
        ln(11, 5, 13, 7, '#c43c3c', 1.2); ln(13, 5, 11, 7, '#c43c3c', 1.2);
        break;
      }
      case 'gear': {
        // sword + shield crossed
        c.save(); c.translate(-2, 0); icon_shieldMini(c, ink); c.restore();
        poly([13.5, 1.5, 15, 3, 8, 10, 6.5, 8.5], '#dfe4ec', ink, 0.9);
        ln(5, 7.5, 9, 11.5, ink, 2.2); ln(5, 7.5, 9, 11.5, '#d7a838', 1.1);
        ln(6.8, 10.2, 4.5, 12.5, ink, 2.2); ln(6.8, 10.2, 4.5, 12.5, '#6a3b1f', 1);
        break;
      }
      case 'quill': {
        c.beginPath(); c.moveTo(3, 14); c.quadraticCurveTo(6, 4, 14, 1.5); c.quadraticCurveTo(12, 9, 3, 14);
        c.fillStyle = '#f4f0e6'; c.fill(); c.lineWidth = 0.9; c.strokeStyle = ink; c.stroke();
        ln(3, 14, 10, 6, '#9a8a70', 0.7);
        circ(3.5, 14.5, 1, ink);
        break;
      }
      case 'sound': {
        poly([2, 6, 5, 6, 9, 2.5, 9, 13.5, 5, 10, 2, 10], col || '#f4e4c1', ink, 1);
        if (!o.off) {
          c.beginPath(); c.arc(9, 8, 3, -0.9, 0.9); c.lineWidth = 1.2; c.strokeStyle = ink; c.stroke();
          c.beginPath(); c.arc(9, 8, 5.5, -0.9, 0.9); c.stroke();
        } else { ln(11, 5.5, 15, 10.5, '#d6453d', 1.6); ln(15, 5.5, 11, 10.5, '#d6453d', 1.6); }
        break;
      }
      case 'heart': {
        c.beginPath(); c.moveTo(8, 14); c.bezierCurveTo(1, 9, 1.5, 3, 5, 3); c.bezierCurveTo(6.8, 3, 7.8, 4.2, 8, 5.2);
        c.bezierCurveTo(8.2, 4.2, 9.2, 3, 11, 3); c.bezierCurveTo(14.5, 3, 15, 9, 8, 14);
        c.fillStyle = col || '#e0473c'; c.fill(); c.lineWidth = 1; c.strokeStyle = ink; c.stroke();
        circ(5.5, 6, 1, 'rgba(255,255,255,0.7)');
        break;
      }
      case 'bolt': { // stamina
        poly([9.5, 1, 3.5, 9, 7.5, 9, 6, 15, 12.5, 6.5, 8.5, 6.5], col || '#f2c14e', ink, 1);
        break;
      }
      case 'fist': { // attack
        icon_swordSmall(c, ink, col);
        break;
      }
      case 'hourglass': {
        poly([3.5, 1.5, 12.5, 1.5, 12.5, 3, 9, 8, 12.5, 13, 12.5, 14.5, 3.5, 14.5, 3.5, 13, 7, 8, 3.5, 3], '#dfeef5', ink, 1);
        poly([5, 13.5, 11, 13.5, 8, 10], '#e0b04a'); poly([5.5, 4, 10.5, 4, 8, 7], '#e0b04a');
        break;
      }
      case 'inn': { // crescent moon
        c.save();
        c.beginPath(); c.rect(-2, -2, 20, 20); c.arc(11, 5.5, 5, 0, Math.PI * 2, true); c.clip('evenodd');
        circ(8, 8, 6.5, '#f2e18a', ink, 1);
        c.restore();
        c.save(); c.beginPath(); c.arc(8, 8, 6.5, 0, Math.PI * 2); c.clip();
        circ(11, 5.5, 5, null, ink, 1); c.restore();
        break;
      }
      default: {
        circ(8, 8, 5, col || '#c9a36a', ink, 1);
        D().text('?', 8, 8.5, { size: 8, align: 'center', baseline: 'middle', color: ink });
      }
    }
    c.restore();
  }
  function icon_shieldMini(c, ink) {
    c.beginPath(); c.moveTo(3, 4); c.lineTo(11, 4); c.lineTo(11, 9); c.lineTo(7, 14.5); c.lineTo(3, 9); c.closePath();
    c.fillStyle = '#3b6fc4'; c.fill(); c.lineWidth = 1; c.strokeStyle = ink; c.stroke();
    c.beginPath(); c.moveTo(7, 4.5); c.lineTo(7, 13.5); c.strokeStyle = '#f2c14e'; c.stroke();
  }
  function icon_swordSmall(c, ink, col) {
    c.beginPath(); c.moveTo(13, 2); c.lineTo(14.5, 3.5); c.lineTo(6.5, 11); c.lineTo(5, 9.5); c.closePath();
    c.fillStyle = col || '#dfe4ec'; c.fill(); c.lineWidth = 0.9; c.strokeStyle = ink; c.stroke();
    c.beginPath(); c.moveTo(3, 8); c.lineTo(8, 13); c.lineWidth = 2.2; c.strokeStyle = ink; c.stroke();
    c.lineWidth = 1.1; c.strokeStyle = '#d7a838'; c.stroke();
    c.beginPath(); c.moveTo(5.5, 10.5); c.lineTo(2.5, 13.5); c.lineWidth = 2.2; c.strokeStyle = ink; c.stroke();
    c.lineWidth = 1; c.strokeStyle = '#6a3b1f'; c.stroke();
  }

  // Icon kind for an item def.
  function itemKind(it) {
    if (!it) return '?';
    const id = it.id || '';
    switch (it.type) {
      case 'weapon': return id === 'stick' ? 'stick' : /axe/.test(id) ? 'axe' : 'weapon';
      case 'consumable': return /bread/.test(id) ? 'bread' : /herb/.test(id) ? 'herb' : 'potion';
      case 'key':
        if (/arrow/.test(id)) return 'quiver';
        if (/letter|pass/.test(id)) return 'scroll';
        if (/horseshoe/.test(id)) return 'horseshoe';
        if (/signet|ring/.test(id)) return 'ring';
        return 'key';
      default: return it.type;
    }
  }
  function itemColor(it) {
    if (!it) return null;
    if (it.type === 'consumable') return it.heal >= 900 ? '#c45ad6' : it.heal >= 60 ? '#3f7fd1' : '#e0473c';
    if (it.type === 'armor') return { tunic: '#e6dcc0', padded: '#c9a36a', leather: '#9a6a3a', chainmail: '#aab0bb', plate: '#dfe4ec' }[it.id] || '#aab0bb';
    if (it.type === 'lance') return { practice_lance: '#c9a36a', ash_lance: '#3f7fd1', oak_lance: '#5bb04a', royal_lance: '#7b3fb5' }[it.id] || '#c43c3c';
    if (it.type === 'bow') return { short_bow: '#a8743a', hunting_bow: '#8a5a2a', longbow: '#6a3b1f', elven_bow: '#4a8a58' }[it.id] || '#8a5a2a';
    return it.color || null;
  }
  // Item icon inside a little framed tile.
  function itemIcon(it, cx, cy, s = 16, o = {}) {
    if (o.frame !== false) {
      const f = s + 6;
      D().rrect(cx - f / 2, cy - f / 2 + 1, f, f, 3, 'rgba(60,35,15,0.25)');
      D().rrect(cx - f / 2, cy - f / 2, f, f, 3, o.bg || '#ead6aa', '#a07a4a', 1);
    }
    icon(itemKind(it), cx, cy, s, { color: itemColor(it) });
  }

  // ======================================================================
  // Item stat comparison
  // ======================================================================
  const STATS = {
    weapon: [['dmg', 'Damage', 1, 'n'], ['speed', 'Swing', -1, 'x'], ['reach', 'Reach', 1, 'n']],
    shield: [['block', 'Block', 1, 'pct'], ['parry', 'Parry', 1, 'ms'], ['def', 'Defense', 1, 'n']],
    armor: [['def', 'Defense', 1, 'n'], ['hp', 'Max HP', 1, 'n'], ['weight', 'Weight', -1, 'pct']],
    lance: [['power', 'Power', 1, 'x'], ['stability', 'Stability', 1, 'pct'], ['breakChance', 'Shatter', 1, 'pct']],
    horse: [['speed', 'Speed', 1, 'x'], ['stamina', 'Stamina', 1, 'x'], ['control', 'Control', 1, 'pct']],
    bow: [['power', 'Power', 1, 'x'], ['steady', 'Steady', 1, 'pct'], ['draw', 'Draw', -1, 's']],
    consumable: [['heal', 'Heals', 1, 'n']],
  };
  const fmtVal = (v, f) => {
    v = v || 0;
    if (f === 'pct') return Math.round(v * 100) + '%';
    if (f === 'x') return '×' + (+v).toFixed(2).replace(/0$/, '');
    if (f === 's') return (+v).toFixed(2).replace(/0$/, '') + 's';
    if (f === 'ms') return Math.round(v) + 'ms';
    return v >= 900 ? 'All' : String(Math.round(v * 10) / 10);
  };
  const fmtDelta = (d, f) => {
    const s = d > 0 ? '+' : '−';
    const a = Math.abs(d);
    if (f === 'pct') return s + Math.round(a * 100) + '%';
    if (f === 'x' || f === 's') return s + a.toFixed(2).replace(/0$/, '');
    return s + Math.round(a * 10) / 10;
  };
  // → [{label, val, delta, good}] ; delta null when no comparison/equal.
  function compare(it, vs) {
    const out = [];
    const defs = STATS[it && it.type] || [];
    for (const [k, label, dir, f] of defs) {
      const v = it[k] || 0;
      let delta = null, good = null;
      if (vs !== undefined && vs !== it) {
        const b = (vs && vs[k]) || 0;
        const d = v - b;
        if (Math.abs(d) > 1e-6) { delta = fmtDelta(d, f); good = d * dir > 0; }
      }
      out.push({ label, val: fmtVal(v, f), delta, good });
    }
    return out;
  }
  // Equipped item for an item's slot (undefined if not gear).
  function equippedFor(it) {
    const slot = it && G.slotOf && G.slotOf[it.type];
    if (!slot) return undefined;
    const id = G.state.equip[slot];
    return (id && G.items[id]) || null;
  }
  // Draw comparison rows; returns height used.
  function drawCompare(it, vs, x, y, w, o = {}) {
    const rows = compare(it, vs);
    const lh = o.lh || 10;
    rows.forEach((r, i) => {
      const yy = y + i * lh;
      D().text(r.label, x, yy, { size: 7, color: '#6a4a2a' });
      D().text(r.val, x + w * 0.52, yy, { size: 7, color: PAL().ink, align: 'right' });
      if (r.delta) D().text(r.delta, x + w, yy, { size: 7, align: 'right', color: r.good ? '#2f8a2a' : '#c0392b' });
      else if (vs !== undefined && vs !== it) D().text('=', x + w, yy, { size: 7, align: 'right', color: '#9a8466' });
    });
    return rows.length * lh;
  }
  // Single summary of an item's net upgrade vs equipped: 1 better, -1 worse, 0 mixed/equal.
  function verdict(it, vs) {
    const rows = compare(it, vs).filter((r) => r.delta);
    if (!rows.length) return 0;
    const g = rows.filter((r) => r.good).length;
    if (g === rows.length) return 1;
    if (g === 0) return -1;
    return 0;
  }

  // ======================================================================
  // Panels / chips / bars
  // ======================================================================
  function parchment(x, y, w, h, o = {}) {
    const c = ctx();
    D().rrect(x + 1, y + 3, w, h, 6, 'rgba(0,0,0,0.4)');
    const g = c.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, o.top || '#f8ebcb'); g.addColorStop(1, o.bottom || '#ead2a0');
    D().rrect(x, y, w, h, 6, g, '#5a3418', 2);
    D().rrect(x + 3, y + 3, w - 6, h - 6, 4, null, 'rgba(122,75,42,0.45)', 1);
    // corner studs
    if (o.studs !== false) for (const [sx, sy] of [[x + 6, y + 6], [x + w - 6, y + 6], [x + 6, y + h - 6], [x + w - 6, y + h - 6]]) {
      D().circle(sx, sy, 1.6, '#c9962e', '#5a3418', 0.8);
    }
  }
  function inset(x, y, w, h, fill = 'rgba(122,75,42,0.12)') {
    D().rrect(x, y, w, h, 4, fill, 'rgba(122,75,42,0.35)', 1);
  }
  function chip(x, y, text, color, o = {}) {
    const size = o.size || 6;
    const w = D().measure(text, size) + 8, h = size + 5;
    const xx = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    D().rrect(xx, y, w, h, h / 2, color, U.shade(color, -0.45), 0.8);
    D().text(text, xx + w / 2, y + h / 2 + 0.5, { size, align: 'center', baseline: 'middle', color: o.textColor || '#fffaf0', bold: true });
    return w;
  }
  function ribbon(cx, y, w, text, color = '#b23a3a', o = {}) {
    const h = o.h || 16, x = cx - w / 2;
    const c = ctx();
    c.fillStyle = U.shade(color, -0.4);
    c.beginPath(); c.moveTo(x - 8, y + 4); c.lineTo(x + 4, y + 4); c.lineTo(x + 4, y + h + 4); c.lineTo(x - 8, y + h + 4); c.lineTo(x - 3, y + h / 2 + 4); c.fill();
    c.beginPath(); c.moveTo(x + w + 8, y + 4); c.lineTo(x + w - 4, y + 4); c.lineTo(x + w - 4, y + h + 4); c.lineTo(x + w + 8, y + h + 4); c.lineTo(x + w + 3, y + h / 2 + 4); c.fill();
    D().rrect(x, y, w, h, 2, color, U.shade(color, -0.5), 1);
    D().rect(x + 2, y + 2, w - 4, 2, 'rgba(255,255,255,0.2)');
    D().text(text, cx, y + h / 2 + 0.5, { size: o.size || 9, align: 'center', baseline: 'middle', color: '#fff6dc', bold: true, shadow: 'rgba(0,0,0,0.5)' });
  }
  function fancyBar(x, y, w, h, frac, fg, label) {
    frac = U.clamp(frac, 0, 1);
    D().rrect(x - 1, y - 1, w + 2, h + 2, (h + 2) / 2, '#2b1d14');
    D().rrect(x, y, w, h, h / 2, '#5a4030');
    if (frac > 0) {
      D().rrect(x, y, Math.max(h, w * frac), h, h / 2, fg);
      D().rrect(x + 1, y + 1, Math.max(h - 2, w * frac - 2), Math.max(1, h / 3), h / 4, 'rgba(255,255,255,0.35)');
    }
    if (label) D().text(label, x + w / 2, y + h / 2 + 0.5, { size: Math.min(7, h - 1), align: 'center', baseline: 'middle', color: '#fff', outline: 'rgba(0,0,0,0.6)', outlineW: 2 });
  }
  function sealBadge(seal, cx, cy, r, earned, t = 0) {
    const c = ctx();
    if (earned) {
      // rays
      c.save(); c.translate(cx, cy); c.rotate(t * 0.4);
      c.fillStyle = 'rgba(255,230,140,0.35)';
      for (let i = 0; i < 8; i++) { c.rotate(Math.PI / 4); c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 1.5, -r * 0.25); c.lineTo(r * 1.5, r * 0.25); c.fill(); }
      c.restore();
      // ribbons
      c.fillStyle = U.shade(seal.color, -0.2);
      c.beginPath(); c.moveTo(cx - r * 0.6, cy + r * 0.4); c.lineTo(cx - r * 0.9, cy + r * 1.6); c.lineTo(cx - r * 0.45, cy + r * 1.3); c.lineTo(cx - r * 0.1, cy + r * 1.6); c.lineTo(cx, cy + r * 0.5); c.fill();
      c.beginPath(); c.moveTo(cx + r * 0.6, cy + r * 0.4); c.lineTo(cx + r * 0.9, cy + r * 1.6); c.lineTo(cx + r * 0.45, cy + r * 1.3); c.lineTo(cx + r * 0.1, cy + r * 1.6); c.lineTo(cx, cy + r * 0.5); c.fill();
      D().circle(cx, cy, r, '#f2c14e', '#6a4a14', 1.2);
      D().circle(cx, cy, r * 0.78, seal.color, U.shade(seal.color, -0.5), 1);
      const k = seal.id === 'sword' ? 'weapon' : seal.id === 'archery' ? 'bow' : seal.id === 'joust' ? 'lance' : 'crown';
      icon(k, cx, cy, r * 1.15, { color: seal.id === 'sword' ? '#f0f4ff' : undefined });
      D().circle(cx - r * 0.45, cy - r * 0.45, r * 0.15, 'rgba(255,255,255,0.7)');
    } else {
      D().circle(cx, cy, r, 'rgba(90,60,30,0.18)', 'rgba(90,60,30,0.5)', 1);
      c.setLineDash([2, 2]);
      D().circle(cx, cy, r * 0.75, null, 'rgba(90,60,30,0.4)', 1);
      c.setLineDash([]);
      c.globalAlpha = 0.35; icon('lock', cx, cy, r * 0.9); c.globalAlpha = 1;
    }
  }
  function portraitFrame(look, x, y, s, o = {}) {
    D().rrect(x - 2, y - 2, s + 4, s + 4, 4, o.edge || '#7a4b2a');
    const g = ctx().createLinearGradient(x, y, x, y + s);
    g.addColorStop(0, o.bg1 || '#9fd0ef'); g.addColorStop(1, o.bg2 || '#e8d6a8');
    D().rrect(x, y, s, s, 3, g);
    G.chars.portrait(ctx(), look, x, y, s);
    if (o.dim) D().rrect(x, y, s, s, 3, 'rgba(30,20,10,0.55)');
  }

  // Particle bursts used by all menu scenes.
  function makeFx() {
    const list = [];
    return {
      list,
      sparkle(x, y, n = 12, color = '#fff3b0', spd = 50) {
        for (let i = 0; i < n; i++) {
          const a = Math.random() * Math.PI * 2, v = spd * (0.4 + Math.random());
          list.push({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, t: 0, life: 0.5 + Math.random() * 0.5, color, r: 1 + Math.random() * 1.5 });
        }
      },
      text(x, y, str, color = '#7fe07a', size = 10) { list.push({ k: 't', x, y, str, color, size, t: 0, life: 1.1 }); },
      coin(x, y, tx, ty, delay = 0) { list.push({ k: 'c', x, y, sx: x, sy: y, tx, ty, t: -delay, life: 0.55 }); },
      update(dt) {
        for (let i = list.length - 1; i >= 0; i--) {
          const p = list[i];
          p.t += dt;
          if (p.k === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.vx *= 0.97; }
          if (p.k === 't') p.y -= 18 * dt;
          if (p.t > p.life) list.splice(i, 1);
        }
      },
      draw() {
        const c = ctx();
        for (const p of list) {
          if (p.t < 0) continue;
          const k = p.t / p.life;
          if (p.k === 'p') {
            c.globalAlpha = 1 - k;
            D().rect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r, p.color);
            if (p.r > 1.8) { D().rect(p.x - p.r * 1.2, p.y - 0.25, p.r * 2.4, 0.5, p.color); D().rect(p.x - 0.25, p.y - p.r * 1.2, 0.5, p.r * 2.4, p.color); }
          } else if (p.k === 't') {
            c.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
            D().text(p.str, p.x, p.y, { size: p.size, align: 'center', baseline: 'middle', color: p.color, outline: '#2b1d14', outlineW: 2.5, bold: true });
          } else if (p.k === 'c') {
            const e = U.ease.inOut(U.clamp(k, 0, 1));
            const x = U.lerp(p.sx, p.tx, e), y = U.lerp(p.sy, p.ty, e) - Math.sin(e * Math.PI) * 24;
            icon('coin', x, y, 8);
          }
          c.globalAlpha = 1;
        }
      },
    };
  }

  // ======================================================================
  // Immediate-mode navigation context (tap + keyboard focus + scroll areas)
  // ======================================================================
  function makeNav() {
    const n = {
      items: [], prev: [], focus: null, act: null,
      dirHeld: null, rep: 0, cool: 0.18, blocked: false,
      clip: null, area: null, areas: {}, ensure: false, lastT: G.time,
      // Call from scene.update; returns {back, menu, a}.
      update(dt) {
        const out = { back: false, menu: false };
        n.blocked = G.ui.busy();
        if (n.blocked) { n.cool = 0.15; return out; }
        if (n.cool > 0) { n.cool -= dt; n.dirHeld = null; return out; }
        const d = !G.input.stick.active ? G.input.dir4() : null;
        if (d) {
          if (d !== n.dirHeld) { n.dirHeld = d; n.rep = 0.32; n.move(d); }
          else { n.rep -= dt; if (n.rep <= 0) { n.rep = 0.09; n.move(d); } }
        } else n.dirHeld = null;
        if (keyDown('a') && G.input.pressed('a')) {
          if (n.focus == null || !n.prev.some((i) => i.key === n.focus)) n.pickFirst();
          else n.act = n.focus;
        }
        out.back = G.input.pressed('b');
        out.menu = G.input.pressed('menu');
        return out;
      },
      pickFirst() {
        const f = n.prev.find((i) => !i.disabled && i.pri) || n.prev.find((i) => !i.disabled && i.key !== 'close') || n.prev.find((i) => !i.disabled);
        if (f) { n.focus = f.key; n.ensure = true; G.sfx.play('select'); }
      },
      move(d) {
        const list = n.prev.filter((i) => !i.disabled);
        if (!list.length) return;
        const cur = list.find((i) => i.key === n.focus);
        if (!cur) return n.pickFirst();
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        let best = null, bs = 1e9;
        for (const it of list) {
          if (it === cur) continue;
          const ix = it.x + it.w / 2, iy = it.y + it.h / 2;
          const dx = ix - cx, dy = iy - cy;
          let main, side;
          if (d === 'up') { main = -dy; side = Math.abs(dx); }
          else if (d === 'down') { main = dy; side = Math.abs(dx); }
          else if (d === 'left') { main = -dx; side = Math.abs(dy); }
          else { main = dx; side = Math.abs(dy); }
          if (main < 3) continue;
          // overlap on the cross axis is strongly preferred
          const overlap = d === 'up' || d === 'down'
            ? Math.min(cur.x + cur.w, it.x + it.w) - Math.max(cur.x, it.x)
            : Math.min(cur.y + cur.h, it.y + it.h) - Math.max(cur.y, it.y);
          const s = main + side * (overlap > 0 ? 0.3 : 2.5) + (overlap > 0 ? 0 : 40);
          if (s < bs) { bs = s; best = it; }
        }
        if (best) { n.focus = best.key; n.ensure = true; G.sfx.play('select'); }
      },
      begin() { n.prev = n.items; n.items = []; n.clip = null; n.area = null; },
      setFocus(k) { n.focus = k; n.ensure = true; },
      showFocus() { return !G.input.lastWasTouch; },
      // Immediate-mode button. o: {disabled, color, icon, item, size, draw(r, st), pri, sfx}
      btn(key, x, y, w, h, label, o = {}) {
        const r = { x, y, w, h };
        const vis = n.clip ? inter(r, n.clip) : r;
        if (vis) n.items.push({ key, x: vis.x, y: vis.y, w: vis.w, h: vis.h, full: r, area: n.area, disabled: !!o.disabled && !o.focusDisabled, pri: o.pri });
        let hit = false;
        if (!n.blocked && vis && (!o.disabled || o.tapDisabled)) { if (G.input.consumeTap(vis)) hit = true; }
        if (n.act === key) { n.act = null; hit = !o.disabled || !!o.tapDisabled; }
        const st = {
          focused: n.focus === key && n.showFocus(),
          pressed: !n.blocked && vis && G.input.pointerIn(vis),
          disabled: !!o.disabled,
        };
        if (o.draw) o.draw(r, st); else drawBtn(r, label, o, st);
        if (st.focused) {
          const p = 1.5 + Math.sin(G.time * 8) * 0.6;
          D().rrect(x - p, y - p, w + p * 2, h + p * 2, 5, null, '#fff3b0', 1.5);
          D().rrect(x - p - 1, y - p - 1, w + p * 2 + 2, h + p * 2 + 2, 6, null, 'rgba(90,50,10,0.6)', 1);
        }
        if (hit) { n.focus = key; if (o.sfx !== false) G.sfx.play(o.sfx || 'select'); }
        return hit;
      },
      // Scrollable region. fn(oy) draws content with top at oy and returns content height.
      scroll(id, rect, fn, o = {}) {
        const a = n.areas[id] || (n.areas[id] = { y: 0, v: 0, drag: null, ch: 0, lt: G.time });
        const dt = Math.min(0.05, Math.max(0, G.time - a.lt)); a.lt = G.time;
        const max = Math.max(0, a.ch - rect.h);
        if (!n.blocked) {
          for (const e of G.input.events) {
            if (e.type === 'down' && e.x >= rect.x && e.x < rect.x + rect.w && e.y >= rect.y && e.y < rect.y + rect.h) {
              a.drag = { id: e.id, zone: e.zone, y0: e.y, s0: a.y, ly: e.y };
              a.v = 0;
            }
          }
        }
        if (a.drag) {
          const p = a.drag.zone === 'L' ? G.input.lHold() : G.input.rHold();
          if (p && p.id === a.drag.id) {
            let ny = a.drag.s0 - (p.y - a.drag.y0);
            if (ny < 0) ny *= 0.4; else if (ny > max) ny = max + (ny - max) * 0.4;
            if (dt > 0) a.v = U.lerp(a.v, (ny - a.y) / dt, 0.5);
            a.y = ny;
          } else a.drag = null;
        } else {
          a.y += a.v * dt;
          a.v *= Math.pow(0.04, dt);
          if (Math.abs(a.v) < 5) a.v = 0;
          if (a.y < 0) { a.y = U.lerp(a.y, 0, Math.min(1, dt * 14)); if (a.y > -0.3) a.y = 0; a.v = 0; }
          if (a.y > max) { a.y = U.lerp(a.y, max, Math.min(1, dt * 14)); if (a.y < max + 0.3) a.y = max; a.v = 0; }
        }
        if (o.reset) { a.y = 0; a.v = 0; }
        const c = ctx();
        c.save();
        c.beginPath(); c.rect(rect.x, rect.y, rect.w, rect.h); c.clip();
        const pClip = n.clip, pArea = n.area;
        n.clip = pClip ? inter(rect, pClip) || { x: 0, y: 0, w: 0, h: 0 } : rect;
        n.area = id;
        const ch = fn(rect.y - Math.round(a.y)) || 0;
        a.ch = ch;
        n.clip = pClip; n.area = pArea;
        c.restore();
        // keep focus visible
        if (n.ensure) {
          const f = n.items.find((i) => i.key === n.focus && i.area === id);
          if (f) {
            const fr = f.full;
            if (fr.y < rect.y + 2) a.y -= rect.y + 2 - fr.y;
            else if (fr.y + fr.h > rect.y + rect.h - 2) a.y += fr.y + fr.h - (rect.y + rect.h - 2);
            a.y = U.clamp(a.y, 0, Math.max(0, ch - rect.h));
            n.ensure = false;
          }
        }
        // scrollbar + fades
        if (ch > rect.h + 1) {
          const m = Math.max(1, ch - rect.h);
          const th = Math.max(14, rect.h * (rect.h / ch));
          const ty = rect.y + (rect.h - th) * U.clamp(a.y / m, 0, 1);
          D().rrect(rect.x + rect.w - 3, rect.y + 1, 2.5, rect.h - 2, 1.2, 'rgba(90,60,30,0.15)');
          D().rrect(rect.x + rect.w - 3, ty, 2.5, th, 1.2, 'rgba(122,75,42,0.7)');
          const bob = Math.sin(G.time * 5) * 1;
          if (a.y > 2) chevron(rect.x + rect.w / 2, rect.y + 4 - bob, -1);
          if (a.y < m - 2) chevron(rect.x + rect.w / 2, rect.y + rect.h - 4 + bob, 1);
        }
        return a;
      },
      resetScroll(id) { if (n.areas[id]) { n.areas[id].y = 0; n.areas[id].v = 0; } },
    };
    return n;
  }
  function chevron(cx, cy, dir) {
    const c = ctx();
    c.fillStyle = 'rgba(122,75,42,0.85)';
    c.beginPath(); c.moveTo(cx - 5, cy - 2 * dir); c.lineTo(cx + 5, cy - 2 * dir); c.lineTo(cx, cy + 3 * dir); c.fill();
  }
  function drawBtn(r, label, o, st) {
    const base = st.disabled ? '#a39580' : o.color || '#c9893c';
    const oy = st.pressed ? 1 : 0;
    D().rrect(r.x, r.y + 2, r.w, r.h, 4, U.shade(base, -0.5));
    D().rrect(r.x, r.y + oy, r.w, r.h - oy, 4, base, U.shade(base, -0.55), 1);
    D().rrect(r.x + 2, r.y + oy + 1, r.w - 4, Math.max(2, r.h / 2 - 2), 3, 'rgba(255,255,255,0.2)');
    let tx = r.x + r.w / 2, align = 'center';
    if (o.icon) {
      const is = Math.min(14, r.h - 8);
      if (label) {
        const tw = D().measure(label, o.size || 8) + is + 4;
        const ix = r.x + r.w / 2 - tw / 2 + is / 2;
        icon(o.icon, ix, r.y + r.h / 2 + oy, is, { color: o.iconColor, off: o.iconOff });
        tx = ix + is / 2 + 3; align = 'left';
      } else icon(o.icon, r.x + r.w / 2, r.y + r.h / 2 + oy, is, { color: o.iconColor, off: o.iconOff });
    }
    if (label) D().text(label, tx, r.y + r.h / 2 + oy + 0.5, { size: o.size || 8, align, baseline: 'middle', color: st.disabled ? '#ece4d4' : o.textColor || '#fffaf0', shadow: 'rgba(0,0,0,0.45)', bold: true });
  }
  // Card-like list row (parchment tile).
  function drawRow(r, st, o = {}) {
    const sel = o.selected;
    const base = sel ? '#fff3cf' : o.fill || '#f3e2bb';
    const oy = st.pressed ? 0.5 : 0;
    D().rrect(r.x, r.y + 1.5, r.w, r.h, 4, 'rgba(90,55,25,0.3)');
    D().rrect(r.x, r.y + oy, r.w, r.h - 0.5, 4, st.disabled ? '#ddd0b4' : base, sel ? '#c9893c' : '#b08a5a', sel ? 1.5 : 1);
    if (o.accent) D().rrect(r.x + 1, r.y + 1 + oy, 3, r.h - 2.5, 2, o.accent);
  }
  function closeBtn(nav, x, y, s = 24) {
    return nav.btn('close', x, y, s, s, '', {
      sfx: 'cancel',
      draw(r, st) {
        const oy = st.pressed ? 1 : 0;
        D().circle(r.x + s / 2, r.y + s / 2 + 1.5, s / 2 - 2, '#5a2016');
        D().circle(r.x + s / 2, r.y + s / 2 + oy, s / 2 - 2, '#c0453a', '#5a2016', 1.2);
        D().circle(r.x + s / 2 - 2, r.y + s / 2 - 3 + oy, 2, 'rgba(255,255,255,0.35)');
        const k = 3.5;
        D().line(r.x + s / 2 - k, r.y + s / 2 - k + oy, r.x + s / 2 + k, r.y + s / 2 + k + oy, '#fff6e6', 2);
        D().line(r.x + s / 2 + k, r.y + s / 2 - k + oy, r.x + s / 2 - k, r.y + s / 2 + k + oy, '#fff6e6', 2);
      },
    });
  }
  function goldCounter(x, y, shown, o = {}) {
    const txt = String(Math.round(shown));
    const w = D().measure(txt, 8) + 22;
    const xx = o.align === 'right' ? x - w : x;
    const flash = o.flash > 0;
    D().rrect(xx, y, w, 15, 7.5, flash ? '#7a1c14' : '#3a2414', flash ? '#ff6a5a' : '#c9962e', 1);
    icon('coin', xx + 8, y + 7.5, 10);
    D().text(txt, xx + 15, y + 8, { size: 8, baseline: 'middle', color: flash ? '#ffd0c8' : '#ffe48a', bold: true });
    return w;
  }

  // Generic scene wrapper with open/close animation. def: {update(dt), draw(ctx, k), name}
  function runScene(def) {
    return new Promise((resolve) => {
      let t = 0, closing = -1, result;
      const scene = {
        name: def.name || 'menu',
        opaque: false,
        update(dt) {
          t += dt;
          if (closing >= 0) {
            closing += dt;
            if (closing >= 0.14) { G.scenes.remove(scene); G.input.consumeAllTaps(); resolve(result); }
            return;
          }
          def.update && def.update(dt);
        },
        draw(c) {
          const k = closing >= 0 ? 1 - U.clamp(closing / 0.14, 0, 1) : U.clamp(t / 0.2, 0, 1);
          def.draw(c, k, t);
        },
        resize() { def.resize && def.resize(); },
      };
      def.close = (v) => { if (closing < 0) { closing = 0; result = v; } };
      def.scene = scene;
      G.scenes.push(scene);
    });
  }

  G.mui = {
    icon, itemIcon, itemKind, itemColor, compare, drawCompare, equippedFor, verdict, STATS,
    parchment, inset, chip, ribbon, fancyBar, sealBadge, portraitFrame, makeFx, makeNav,
    drawBtn, drawRow, closeBtn, goldCounter, runScene, chevron, keyDown, inter,
    rankTitle, RANKS, SEALS, DISC, fmtTime,
  };

  // ======================================================================
  // PAUSE MENU
  // ======================================================================
  const TABS = [
    { id: 'status', name: 'Status', icon: 'person' },
    { id: 'gear', name: 'Gear', icon: 'gear' },
    { id: 'bag', name: 'Bag', icon: 'bag' },
    { id: 'perks', name: 'Perks', icon: 'star' },
    { id: 'map', name: 'Map', icon: 'map' },
  ];
  const SLOTS = [
    { id: 'weapon', name: 'Weapon', type: 'weapon' },
    { id: 'shield', name: 'Shield', type: 'shield' },
    { id: 'armor', name: 'Armor', type: 'armor' },
    { id: 'lance', name: 'Lance', type: 'lance' },
    { id: 'horse', name: 'Horse', type: 'horse' },
    { id: 'bow', name: 'Bow', type: 'bow' },
  ];
  let lastTab = 'status';

  function openPause() {
    if (openPause.active) return openPause.active;
    const nav = makeNav();
    const fx = makeFx();
    const S = { tab: lastTab, gearSlot: null, perkSel: null, hpShown: G.state.hp, bagSel: null };
    // Mark current town visited.
    const loc = locOf(G.state.map);
    if (loc && TOWNS.includes(loc)) G.state.flags['visited_' + loc] = true;

    const def = {
      name: 'pause-menu',
      update(dt) {
        fx.update(dt);
        const hp = G.state.hp;
        S.hpShown = U.approach(S.hpShown, hp, Math.max(20, Math.abs(hp - S.hpShown) * 4) * dt);
        const k = nav.update(dt);
        if (k.menu) return def.close();
        if (k.back) {
          if (S.tab === 'gear' && S.gearSlot) { S.gearSlot = null; nav.setFocus('slot_' + (S.lastSlot || 'weapon')); G.sfx.play('cancel'); }
          else if (S.tab === 'perks' && S.perkSel) { S.perkSel = null; G.sfx.play('cancel'); }
          else { G.sfx.play('cancel'); def.close(); }
        }
      },
      draw(c, k) {
        const W = G.W, H = G.H;
        c.globalAlpha = k;
        D().rect(0, 0, W, H, 'rgba(20,12,8,0.62)');
        const L = layout();
        c.save();
        const e = U.ease.outBack(k);
        c.translate(W / 2, H / 2); c.scale(0.9 + 0.1 * e, 0.9 + 0.1 * e); c.translate(-W / 2, -H / 2);
        nav.begin();
        parchment(L.panel.x, L.panel.y, L.panel.w, L.panel.h);
        drawTabs(L);
        // title
        const tab = TABS.find((t) => t.id === S.tab);
        D().text(tab.name, L.title.x, L.title.y, { size: 11, bold: true, color: '#5a3418', baseline: 'middle' });
        if (closeBtn(nav, L.close.x, L.close.y)) def.close();
        const A = L.content;
        try {
          if (S.tab === 'status') tabStatus(A);
          else if (S.tab === 'gear') tabGear(A);
          else if (S.tab === 'bag') tabBag(A);
          else if (S.tab === 'perks') tabPerks(A);
          else if (S.tab === 'map') tabMap(A);
        } catch (err) { console.error('menu tab error', err); }
        fx.draw();
        c.restore();
        c.globalAlpha = 1;
      },
    };

    function layout() {
      const W = G.W, H = G.H, land = W > H * 1.15;
      const pw = Math.min(W - 8, land ? 600 : 420), ph = Math.min(H - 8, land ? 420 : 640);
      const panel = { x: Math.round((W - pw) / 2), y: Math.round((H - ph) / 2), w: pw, h: ph };
      if (!land) {
        const tabsY = panel.y + 32;
        return {
          land, panel,
          title: { x: panel.x + 10, y: panel.y + 16 },
          close: { x: panel.x + panel.w - 30, y: panel.y + 5 },
          tabs: { x: panel.x + 6, y: tabsY, w: panel.w - 12, h: 30, vertical: false },
          content: { x: panel.x + 8, y: tabsY + 36, w: panel.w - 16, h: panel.h - (tabsY - panel.y) - 36 - 38 },
          foot: { x: panel.x + 8, y: panel.y + panel.h - 33, w: panel.w - 16, h: 24 },
        };
      }
      const railW = 78;
      return {
        land, panel,
        title: { x: panel.x + railW + 14, y: panel.y + 16 },
        close: { x: panel.x + panel.w - 30, y: panel.y + 5 },
        tabs: { x: panel.x + 7, y: panel.y + 8, w: railW, h: 0, vertical: true },
        content: { x: panel.x + railW + 14, y: panel.y + 32, w: panel.w - railW - 22, h: panel.h - 40 },
        foot: { x: panel.x + 7, y: panel.y + panel.h - 32, w: railW, h: 24 },
      };
    }

    function drawTabs(L) {
      const T = L.tabs;
      const n = TABS.length;
      TABS.forEach((t, i) => {
        let r;
        if (!T.vertical) { const tw = T.w / n; r = { x: T.x + i * tw + 1, y: T.y, w: tw - 2, h: T.h }; }
        else {
          const avail = L.foot.y - T.y - 6;
          const th = U.clamp(Math.floor(avail / n) - 2, 24, 30);
          r = { x: T.x, y: T.y + i * (th + 2), w: T.w, h: th };
        }
        const on = S.tab === t.id;
        if (nav.btn('tab_' + t.id, r.x, r.y, r.w, r.h, '', {
          draw(rr, st) {
            const oy = st.pressed ? 1 : 0;
            D().rrect(rr.x, rr.y + 1.5, rr.w, rr.h, 4, 'rgba(60,30,10,0.35)');
            D().rrect(rr.x, rr.y + oy, rr.w, rr.h - 0.5, 4, on ? '#b8442f' : '#d9bf8c', on ? '#5a1e12' : '#9a7448', 1.2);
            if (on) D().rrect(rr.x + 2, rr.y + 1 + oy, rr.w - 4, rr.h / 2 - 1, 3, 'rgba(255,255,255,0.18)');
            if (!T.vertical) {
              icon(t.icon, rr.x + rr.w / 2, rr.y + 10 + oy, 13);
              D().text(t.name, rr.x + rr.w / 2, rr.y + rr.h - 6 + oy, { size: 6, align: 'center', baseline: 'middle', color: on ? '#fff3d6' : '#5a3418' });
            } else {
              icon(t.icon, rr.x + 12, rr.y + rr.h / 2 + oy, 13);
              D().text(t.name, rr.x + 23, rr.y + rr.h / 2 + oy + 0.5, { size: 8, baseline: 'middle', color: on ? '#fff3d6' : '#5a3418' });
            }
            if (t.id === 'perks' && G.state.perkPoints > 0) {
              const bx = T.vertical ? rr.x + rr.w - 8 : rr.x + rr.w - 6, by = rr.y + 5;
              D().circle(bx, by, 4.5, '#d6453d', '#fff', 1);
              D().text(String(G.state.perkPoints), bx, by + 0.5, { size: 6, align: 'center', baseline: 'middle', color: '#fff' });
            }
          },
        })) {
          if (S.tab !== t.id) { S.tab = t.id; lastTab = t.id; S.gearSlot = null; S.perkSel = null; G.sfx.play('select'); }
        }
      });
      // Footer: Save + Sound (+ gold in portrait)
      const F = L.foot;
      const on = G.audio.enabled;
      if (!L.land) {
        const bw = Math.min(80, (F.w - 60) / 2);
        if (nav.btn('save', F.x, F.y, bw, F.h, 'Save', { icon: 'quill', color: '#5a8a3a', sfx: 'confirm' })) doSave();
        if (nav.btn('sound', F.x + bw + 6, F.y, bw, F.h, on ? 'Sound' : 'Muted', { icon: 'sound', iconOff: !on, color: on ? '#3f7fd1' : '#8a7a6a' })) toggleSound();
        goldCounter(F.x + F.w, F.y + 4.5, G.state.gold, { align: 'right' });
      } else {
        const bw = (F.w - 4) / 2;
        if (nav.btn('save', F.x, F.y, bw, F.h, '', { icon: 'quill', color: '#5a8a3a', sfx: 'confirm' })) doSave();
        if (nav.btn('sound', F.x + bw + 4, F.y, bw, F.h, '', { icon: 'sound', iconOff: !on, color: on ? '#3f7fd1' : '#8a7a6a' })) toggleSound();
      }
    }
    function doSave() {
      const ok = G.save();
      G.ui.toast(ok ? 'Game saved.' : 'Could not save!', ok ? '#9ff59a' : '#ff8a7a');
      if (ok) G.sfx.play('confirm');
    }
    function toggleSound() {
      const on = !G.audio.enabled;
      G.audio.setEnabled(on);
      if (on) { G.audio.unlock(); G.sfx.play('confirm'); }
      G.ui.toast(on ? 'Sound on' : 'Sound off', '#cfe8ff');
    }

    // ------------------------------------------------------------ STATUS
    function tabStatus(A) {
      const st = G.player.stats();
      const s = G.state;
      nav.scroll('status', A, (oy) => {
        const wide = A.w >= 300;
        const colW = wide ? (A.w - 8) / 2 : A.w;
        let y = oy + 2;
        const x = A.x;
        // hero card
        inset(x, y, colW, 64);
        const ps = 52;
        portraitFrame(s.look || 'hero', x + 6, y + 6, ps);
        const tx = x + ps + 14;
        D().text(s.name || 'Squire', tx, y + 6, { size: 10, bold: true, color: '#3a2414' });
        D().text(`Level ${s.level}`, tx, y + 19, { size: 8, color: '#7a4b2a' });
        const xpN = G.player.xpToNext(s.level);
        const bw = colW - (tx - x) - 8;
        D().text('XP', tx, y + 31, { size: 6, color: '#6a4a2a' });
        fancyBar(tx + 12, y + 31, bw - 12, 7, s.level >= 30 ? 1 : s.xp / xpN, '#6fc3ff', s.level >= 30 ? 'MAX' : `${s.xp}/${xpN}`);
        D().text('HP', tx, y + 43, { size: 6, color: '#6a4a2a' });
        fancyBar(tx + 12, y + 43, bw - 12, 7, S.hpShown / st.maxHp, '#e0473c', `${Math.round(S.hpShown)}/${st.maxHp}`);
        D().text(`${Math.max(0, xpN - s.xp)} XP to next level`, tx, y + 54, { size: 6, color: '#8a6a4a' });
        y += 70;
        // stats grid
        const stats = [
          ['fist', 'Attack', st.atk.toFixed(1), '#dfe4ec'],
          ['shield', 'Defense', String(st.def), '#3b6fc4'],
          ['bolt', 'Stamina', String(st.maxSta), '#f2c14e'],
          ['coin', 'Gold', String(s.gold), null],
          ['hourglass', 'Time', fmtTime(s.playTime), null],
          ['star', 'Perk pts', String(s.perkPoints), '#f2c14e'],
        ];
        const cw = (colW - 4) / 2;
        stats.forEach((r, i) => {
          const cx = x + (i % 2) * (cw + 4), cy = y + Math.floor(i / 2) * 22;
          inset(cx, cy, cw, 19, 'rgba(255,250,235,0.5)');
          icon(r[0], cx + 10, cy + 9.5, 12, { color: r[3] });
          D().text(r[1], cx + 19, cy + 9.5, { size: 6, baseline: 'middle', color: '#7a5a3a' });
          D().text(r[2], cx + cw - 5, cy + 10, { size: 8, baseline: 'middle', align: 'right', color: '#2b1d14', bold: true });
        });
        y += 3 * 22 + 4;
        let y2 = y, x2 = x;
        if (wide) { y2 = oy + 2; x2 = x + colW + 8; }
        // seals
        D().text('Seals', x2 + 2, y2 + 2, { size: 8, bold: true, color: '#5a3418' });
        y2 += 13;
        inset(x2, y2, colW, 46);
        SEALS.forEach((sl, i) => {
          const cx = x2 + colW * (i + 0.5) / 4;
          sealBadge(sl, cx, y2 + 17, 10, !!s.seals[sl.id], G.time + i);
          D().text(sl.short, cx, y2 + 38, { size: 6, align: 'center', color: s.seals[sl.id] ? '#3a2414' : '#a08a6a' });
        });
        y2 += 52;
        // ranks
        D().text('Ranks', x2 + 2, y2 + 2, { size: 8, bold: true, color: '#5a3418' });
        y2 += 13;
        [['sword', 'Sword', 'weapon'], ['archery', 'Archery', 'bow'], ['joust', 'Joust', 'lance']].forEach(([d, nm, ic], i) => {
          const r = (s.ranks && s.ranks[d]) || 0;
          const ry = y2 + i * 21;
          inset(x2, ry, colW, 18, 'rgba(255,250,235,0.5)');
          icon(ic, x2 + 10, ry + 9, 12);
          D().text(nm, x2 + 20, ry + 9.5, { size: 7, baseline: 'middle', color: '#3a2414' });
          // pips
          for (let p = 0; p < 4; p++) {
            const px = x2 + colW - 66 + p * 7;
            D().circle(px, ry + 9, 2.4, p < Math.min(r, 4) ? DISC[d].color : 'rgba(90,60,30,0.2)', '#5a3418', 0.6);
          }
          chip(x2 + colW - 4, ry + 3.5, rankTitle(r), r >= 3 ? '#b8862a' : r >= 2 ? '#7a5aa8' : r >= 1 ? '#4a8a58' : '#8a7a6a', { align: 'right' });
        });
        y2 += 3 * 21;
        return Math.max(y, y2) - oy + 4;
      });
    }

    // ------------------------------------------------------------ GEAR
    function ownedOfType(type) {
      const out = [];
      for (const id in G.state.bag) { const it = G.items[id]; if (it && it.type === type) out.push(it); }
      out.sort((a, b) => (a.price || 0) - (b.price || 0));
      return out;
    }
    function tabGear(A) {
      const side = A.w >= 300;
      const listW = side ? Math.floor(A.w * 0.44) : A.w;
      if (!side && S.gearSlot) return gearPick(A, true);
      const LA = { x: A.x, y: A.y, w: listW, h: A.h };
      nav.scroll('gearslots', LA, (oy) => {
        let y = oy + 2;
        const rh = 32;
        for (const sl of SLOTS) {
          const id = G.state.equip[sl.id];
          const it = id && G.items[id];
          const owned = ownedOfType(sl.type).length;
          if (nav.btn('slot_' + sl.id, A.x, y, listW - 5, rh - 4, '', {
            pri: sl.id === 'weapon',
            draw(r, st) {
              drawRow(r, st, { selected: S.gearSlot === sl.id, accent: it ? '#c9893c' : null });
              if (it) itemIcon(it, r.x + 16, r.y + r.h / 2, 14);
              else { D().rrect(r.x + 5, r.y + r.h / 2 - 10, 21, 20, 3, 'rgba(90,60,30,0.12)', 'rgba(90,60,30,0.35)', 1); ctx().globalAlpha = 0.3; icon(sl.type, r.x + 16, r.y + r.h / 2, 14); ctx().globalAlpha = 1; }
              D().text(sl.name.toUpperCase(), r.x + 32, r.y + 5, { size: 6, color: '#8a6a4a' });
              D().text(it ? it.name : '— empty —', r.x + 32, r.y + 14, { size: 8, color: it ? '#2b1d14' : '#a08a6a', bold: !!it });
              const key = it && compare(it)[0];
              if (key && !(side && r.w < 120)) D().text(`${key.label} ${key.val}`, r.x + r.w - 6, r.y + 5, { size: 6, align: 'right', color: '#6a4a2a' });
              if (owned) chip(r.x + r.w - 5, r.y + r.h - 11, `${owned} spare`, '#7a8a4a', { align: 'right' });
            },
          })) { S.gearSlot = sl.id; S.lastSlot = sl.id; nav.resetScroll('gearpick'); if (!side) nav.setFocus(null); }
          y += rh;
        }
        return y - oy;
      });
      if (side) {
        const RA = { x: A.x + listW + 4, y: A.y, w: A.w - listW - 4, h: A.h };
        if (S.gearSlot) gearPick(RA, false);
        else {
          inset(RA.x, RA.y + 2, RA.w, RA.h - 4);
          D().text('Choose a slot to change your gear.', RA.x + RA.w / 2, RA.y + RA.h / 2 - 10, { size: 8, align: 'center', color: '#8a6a4a', maxW: RA.w - 20 });
          icon('gear', RA.x + RA.w / 2, RA.y + RA.h / 2 + 18, 24);
        }
      }
    }
    function gearPick(A, back) {
      const sl = SLOTS.find((x) => x.id === S.gearSlot);
      const curId = G.state.equip[sl.id];
      const cur = (curId && G.items[curId]) || null;
      let y0 = A.y;
      if (back) {
        if (nav.btn('gearback', A.x, y0, 60, 24, 'Back', { color: '#8a6a4a', sfx: 'cancel' })) { S.gearSlot = null; nav.setFocus('slot_' + sl.id); return; }
        D().text(sl.name, A.x + 68, y0 + 12, { size: 9, bold: true, baseline: 'middle', color: '#5a3418' });
        y0 += 30;
      } else {
        D().text(sl.name, A.x + 4, y0 + 8, { size: 9, bold: true, baseline: 'middle', color: '#5a3418' });
        y0 += 18;
      }
      const items = ownedOfType(sl.type);
      const LA = { x: A.x, y: y0, w: A.w, h: A.y + A.h - y0 };
      nav.scroll('gearpick', LA, (oy) => {
        let y = oy;
        // Equipped card
        inset(A.x, y, A.w - 4, 20 + (cur ? compare(cur).length * 9 : 0) + 4, 'rgba(201,137,60,0.18)');
        D().text('EQUIPPED', A.x + 5, y + 4, { size: 6, color: '#8a5a2a' });
        if (cur) {
          itemIcon(cur, A.x + A.w - 18, y + 14, 12);
          D().text(cur.name, A.x + 5, y + 12, { size: 8, bold: true, color: '#2b1d14' });
          let yy = y + 23;
          for (const r of compare(cur)) { D().text(`${r.label}: ${r.val}`, A.x + 8, yy, { size: 6, color: '#6a4a2a' }); yy += 9; }
          y = yy + 4;
        } else { D().text('Nothing', A.x + 5, y + 12, { size: 8, color: '#a08a6a' }); y += 26; }
        const removable = cur && curId !== 'stick' && curId !== 'tunic';
        if (removable) {
          if (nav.btn('unequip', A.x, y, A.w - 4, 24, 'Unequip', { color: '#8a6a4a', icon: 'lock' })) {
            G.player.unequip(sl.id);
            G.sfx.play('cancel');
            G.ui.toast(`Unequipped ${cur.name}`, '#f4e4c1');
          }
          y += 28;
        }
        if (!items.length) {
          D().text(`You own no other ${sl.name.toLowerCase()}s. Visit a shop!`, A.x + (A.w - 4) / 2, y + 6, { size: 7, align: 'center', color: '#8a6a4a', maxW: A.w - 20 });
          return y - oy + 30;
        }
        D().text('IN YOUR BAG — tap to equip', A.x + 3, y + 2, { size: 6, color: '#8a6a4a' });
        y += 11;
        for (const it of items) {
          const rows = compare(it, cur);
          const h = 22 + rows.length * 9;
          if (nav.btn('pick_' + it.id, A.x, y, A.w - 4, h, '', {
            pri: true,
            draw(r, st) {
              const v = verdict(it, cur);
              drawRow(r, st, { accent: v > 0 ? '#5bb04a' : v < 0 ? '#d6453d' : '#c9a36a' });
              itemIcon(it, r.x + 16, r.y + 13, 14);
              D().text(it.name, r.x + 31, r.y + 6, { size: 8, bold: true, color: '#2b1d14' });
              const cnt = G.state.bag[it.id];
              if (cnt > 1) chip(r.x + r.w - 5, r.y + 4, '×' + cnt, '#8a6a4a', { align: 'right' });
              drawCompare(it, cur, r.x + 31, r.y + 17, r.w - 38, { lh: 9 });
            },
          })) {
            if (G.player.equip(it.id)) {
              G.sfx.play('confirm');
              G.ui.toast(`Equipped ${it.name}!`, '#ffe48a');
              fx.sparkle(A.x + A.w / 2, A.y + 20, 14, '#fff3b0');
            }
          }
          y += h + 4;
        }
        return y - oy;
      });
    }

    // ------------------------------------------------------------ BAG
    function tabBag(A) {
      const st = G.player.stats();
      // HP header
      inset(A.x, A.y, A.w, 22, 'rgba(255,250,235,0.5)');
      icon('heart', A.x + 11, A.y + 11, 12);
      const hbx = A.x + 22, hbw = A.w - 30;
      fancyBar(hbx, A.y + 7, hbw, 8, S.hpShown / st.maxHp, '#e0473c', `HP ${Math.round(S.hpShown)} / ${st.maxHp}`);
      S.hpBar = { x: hbx + hbw / 2, y: A.y + 11 };
      const cons = [], keys = [];
      for (const id in G.state.bag) {
        const it = G.items[id];
        if (!it) continue;
        if (it.type === 'consumable') cons.push(it);
        else if (it.type === 'key') keys.push(it);
      }
      cons.sort((a, b) => a.heal - b.heal);
      const LA = { x: A.x, y: A.y + 26, w: A.w, h: A.h - 26 };
      nav.scroll('bag', LA, (oy) => {
        let y = oy + 2;
        D().text('Provisions', A.x + 2, y, { size: 8, bold: true, color: '#5a3418' });
        y += 12;
        if (!cons.length) { D().text('No provisions. Buy bread and herbs in town.', A.x + 6, y, { size: 7, color: '#8a6a4a', maxW: A.w - 12 }); y += 22; }
        for (const it of cons) {
          const rh = 30;
          drawRow({ x: A.x, y, w: A.w - 4, h: rh - 3 }, {}, {});
          itemIcon(it, A.x + 16, y + 13, 14);
          D().text(it.name, A.x + 31, y + 5, { size: 8, bold: true, color: '#2b1d14' });
          D().text(it.desc || '', A.x + 31, y + 16, { size: 6, color: '#6a4a2a' });
          chip(A.x + A.w - 58, y + 3, '×' + G.state.bag[it.id], '#8a6a4a', { align: 'right' });
          const full = G.state.hp >= st.maxHp;
          if (nav.btn('use_' + it.id, A.x + A.w - 52, y + 2, 44, 23, 'Use', { color: full ? '#a39580' : '#5a8a3a', tapDisabled: true, pri: true, sfx: false })) {
            if (full) { G.ui.toast('HP is already full.', '#f4e4c1'); G.sfx.play('cancel'); }
            else {
              const healed = G.player.useItem(it.id);
              fx.text(S.hpBar.x, S.hpBar.y + 14, '+' + healed + ' HP', '#7fe07a', 11);
              fx.sparkle(S.hpBar.x, S.hpBar.y, 18, '#9ff59a', 70);
              fx.sparkle(A.x + 16, y + 13, 8, '#fff3b0', 40);
            }
          }
          y += rh;
        }
        y += 6;
        D().text('Key items', A.x + 2, y, { size: 8, bold: true, color: '#5a3418' });
        y += 12;
        if (!keys.length) { D().text('Nothing special yet.', A.x + 6, y, { size: 7, color: '#8a6a4a' }); y += 14; }
        for (const it of keys) {
          const c = ctx();
          c.font = D().font(6, true);
          const lines = U.wrapText(c, it.desc || '', A.w - 44);
          const rh = 18 + lines.length * 8;
          drawRow({ x: A.x, y, w: A.w - 4, h: rh - 3 }, {}, { fill: '#efe0c0', accent: '#c9962e' });
          itemIcon(it, A.x + 16, y + 13, 14, { bg: '#f2e2b0' });
          D().text(it.name, A.x + 31, y + 4, { size: 8, bold: true, color: '#2b1d14' });
          lines.forEach((l, i) => D().text(l, A.x + 31, y + 14 + i * 8, { size: 6, color: '#6a4a2a' }));
          y += rh;
        }
        return y - oy + 4;
      });
    }

    // ------------------------------------------------------------ PERKS
    function tabPerks(A) {
      const trees = Object.entries(G.perkTrees || {});
      const pts = G.state.perkPoints || 0;
      const side = A.w >= 300;
      const descH = side ? 0 : 66;
      const treeW = side ? Math.floor(A.w * 0.6) : A.w;
      // points banner
      const bnr = side ? { x: A.x + treeW + 6, w: A.w - treeW - 6 } : { x: A.x, w: treeW };
      inset(bnr.x, A.y, bnr.w, 18, pts > 0 ? 'rgba(242,193,78,0.35)' : 'rgba(255,250,235,0.5)');
      icon('star', bnr.x + 10, A.y + 9, 11);
      D().text(`${pts} perk point${pts === 1 ? '' : 's'}${side ? '' : ' available'}`, bnr.x + 19, A.y + 9.5, { size: 7, baseline: 'middle', color: '#3a2414' });
      const TA = side ? { x: A.x, y: A.y - 4, w: treeW, h: A.h + 4 } : { x: A.x, y: A.y + 22, w: treeW, h: A.h - 22 - descH };
      const colW = TA.w / trees.length;
      const step = U.clamp((TA.h - 16) / 5, 22, 46);
      const nr = Math.min(11, step / 2 - 2);
      trees.forEach(([tid, tree], ti) => {
        const cx = TA.x + colW * (ti + 0.5);
        D().text(tree.name, cx, TA.y + 6, { size: 8, align: 'center', bold: true, color: tree.color, outline: '#f8ebcb', outlineW: 2 });
        const owned = tree.perks.map((p) => !!G.state.perks[p.id]);
        const next = owned.indexOf(false);
        for (let i = 0; i < tree.perks.length; i++) {
          const p = tree.perks[i];
          const ny = TA.y + 16 + step * (i + 0.5);
          if (i < tree.perks.length - 1) {
            const n2 = ny + step;
            D().line(cx, ny + nr, cx, n2 - nr, owned[i + 1] ? tree.color : 'rgba(90,60,30,0.35)', owned[i + 1] ? 3 : 2);
          }
          const state = owned[i] ? 'owned' : i === next ? (pts > 0 ? 'ready' : 'next') : 'locked';
          const sel = S.perkSel && S.perkSel.id === p.id;
          if (nav.btn('perk_' + p.id, cx - Math.max(12, nr + 2), ny - Math.max(12, nr + 2), Math.max(24, nr * 2 + 4), Math.max(24, nr * 2 + 4), '', {
            pri: state === 'ready',
            draw() {
              if (state === 'ready') {
                const g = 0.5 + 0.5 * Math.sin(G.time * 5);
                D().circle(cx, ny, nr + 3 + g * 2, `rgba(255,230,120,${0.35 + g * 0.3})`);
              }
              if (sel) D().circle(cx, ny, nr + 3, null, '#5a3418', 1.5);
              const fill = state === 'owned' ? tree.color : state === 'locked' ? '#cbb994' : '#f8ebcb';
              D().circle(cx, ny + 1.5, nr, 'rgba(60,30,10,0.35)');
              D().circle(cx, ny, nr, fill, state === 'locked' ? '#9a8466' : U.shade(tree.color, -0.4), 1.5);
              if (state === 'owned') { D().circle(cx - nr * 0.35, ny - nr * 0.35, nr * 0.25, 'rgba(255,255,255,0.5)'); icon('check', cx, ny, nr * 1.2, { color: '#fff' }); }
              else if (state === 'locked') { ctx().globalAlpha = 0.6; icon('lock', cx, ny, nr * 1.1); ctx().globalAlpha = 1; }
              else D().text(String(i + 1), cx, ny + 0.5, { size: 8, align: 'center', baseline: 'middle', color: tree.color, bold: true });
            },
          })) { S.perkSel = { id: p.id, tree: tid, i }; }
        }
      });
      // description panel
      const DA = side ? { x: A.x + treeW + 6, y: A.y + 22, w: A.w - treeW - 6, h: A.h - 22 } : { x: A.x, y: A.y + A.h - descH + 2, w: A.w, h: descH - 2 };
      inset(DA.x, DA.y, DA.w, DA.h, 'rgba(255,250,235,0.6)');
      if (!S.perkSel) {
        D().text('Tap a perk to read about it. Perks unlock in order, 1 point each.', DA.x + DA.w / 2, DA.y + DA.h / 2 - 8, { size: 7, align: 'center', color: '#8a6a4a', maxW: DA.w - 16 });
        return;
      }
      const tree = G.perkTrees[S.perkSel.tree];
      const p = tree.perks[S.perkSel.i];
      const owned = !!G.state.perks[p.id];
      const prevOwned = S.perkSel.i === 0 || !!G.state.perks[tree.perks[S.perkSel.i - 1].id];
      D().text(p.name, DA.x + 6, DA.y + 5, { size: 9, bold: true, color: tree.color });
      D().text(`${tree.name} tree · ${S.perkSel.i + 1} of 5`, DA.x + 6, DA.y + 17, { size: 6, color: '#8a6a4a' });
      const btnH = 24;
      D().text(p.desc, DA.x + 6, DA.y + 27, { size: 7, color: '#2b1d14', maxW: side ? DA.w - 12 : DA.w - 100 });
      const bx = side ? DA.x + 6 : DA.x + DA.w - 88, by = side ? DA.y + DA.h - btnH - 6 : DA.y + DA.h - btnH - 6, bw = side ? DA.w - 12 : 82;
      if (owned) chip(bx + bw / 2, by + 6, 'Unlocked', '#4a8a58', { align: 'center', size: 7 });
      else if (!prevOwned) D().text('Unlock the previous perk first.', bx + bw / 2, by + 4, { size: 6, align: 'center', color: '#a0522d', maxW: bw });
      else {
        const can = (G.state.perkPoints || 0) > 0;
        if (nav.btn('unlock', bx, by, bw, btnH, can ? 'Unlock (1 pt)' : 'Need 1 point', { disabled: !can, color: '#c9893c', pri: true, sfx: 'levelup', size: 7 })) {
          G.state.perkPoints--;
          G.state.perks[p.id] = true;
          G.ui.toast(`Learned ${p.name}!`, '#ffe48a');
          const ti = trees.findIndex(([id]) => id === S.perkSel.tree);
          const cx = TA.x + colW * (ti + 0.5), ny = TA.y + 16 + step * (S.perkSel.i + 0.5);
          fx.sparkle(cx, ny, 24, tree.color, 70);
          fx.sparkle(cx, ny, 12, '#fff3b0', 50);
        }
      }
    }

    // ------------------------------------------------------------ MAP
    function tabMap(A) {
      drawWorldMap(A, G.state.map);
    }

    return (openPause.active = runScene(def).then(() => { openPause.active = null; }));
  }

  // ======================================================================
  // World map (DESIGN §8 layout), drawn procedurally
  // ======================================================================
  const TOWNS = ['thornbrook', 'millbridge', 'harrowfield', 'crownhold'];
  const PLACES = {
    thornbrook: { name: 'Thornbrook', kind: 'village', sub: 'Sword Pit' },
    millbridge: { name: 'Millbridge', kind: 'town', sub: 'Archery Range' },
    harrowfield: { name: 'Harrowfield', kind: 'town', sub: 'Jousting Lists' },
    crownhold: { name: 'Crownhold', kind: 'castle', sub: 'Grand Tourney' },
    route1: { name: 'Whisperwood', kind: 'route' },
    route2: { name: 'Greenmeadow', kind: 'route' },
    route3: { name: 'Kingsroad', kind: 'route' },
  };
  function locOf(mapId) {
    if (!mapId) return null;
    if (/^bandit_camp/.test(mapId)) return 'route3';
    for (const k of Object.keys(PLACES)) if (mapId === k || mapId.startsWith(k + '_') || mapId.startsWith(k)) return k;
    return null;
  }
  function visited(town, here) {
    const s = G.state;
    if (here === town) return true;
    if (s.flags && s.flags['visited_' + town]) return true;
    if (town === 'thornbrook') return true;
    if (town === 'millbridge' && s.seals.archery) return true;
    if (town === 'harrowfield' && s.seals.joust) return true;
    if (town === 'crownhold' && s.seals.grand) return true;
    return false;
  }
  function drawWorldMap(A, mapId) {
    const c = ctx();
    const here = locOf(mapId);
    const land = A.w > A.h * 1.1;
    // Normalized positions per orientation.
    const P = land
      ? { thornbrook: [0.1, 0.72], millbridge: [0.45, 0.7], harrowfield: [0.86, 0.7], crownhold: [0.66, 0.16] }
      : { thornbrook: [0.2, 0.88], millbridge: [0.45, 0.6], harrowfield: [0.78, 0.4], crownhold: [0.42, 0.11] };
    const px = (k) => [A.x + P[k][0] * A.w, A.y + P[k][1] * A.h];
    // parchment background
    const g = c.createRadialGradient(A.x + A.w / 2, A.y + A.h / 2, 10, A.x + A.w / 2, A.y + A.h / 2, Math.max(A.w, A.h) * 0.7);
    g.addColorStop(0, '#f5e3b8'); g.addColorStop(1, '#d9b77a');
    D().rrect(A.x, A.y, A.w, A.h, 4, g, '#7a4b2a', 1.5);
    c.save();
    c.beginPath(); c.rect(A.x + 1, A.y + 1, A.w - 2, A.h - 2); c.clip();
    // stains
    const rng = U.rng(77);
    for (let i = 0; i < 14; i++) D().circle(A.x + rng() * A.w, A.y + rng() * A.h, 6 + rng() * 22, 'rgba(150,100,40,0.06)');
    // sea in a corner + coastline
    c.fillStyle = 'rgba(90,150,190,0.35)';
    c.beginPath(); c.moveTo(A.x, A.y + A.h * 0.35);
    for (let i = 0; i <= 10; i++) c.lineTo(A.x + A.w * 0.08 + Math.sin(i * 1.7) * 6 + i * 0.5, A.y + A.h * (0.35 - i * 0.035));
    c.lineTo(A.x, A.y); c.fill();
    // mountains around Kingsroad
    const [hx, hy] = px('harrowfield'), [cx0, cy0] = px('crownhold');
    const mr = U.rng(5);
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const mx = U.lerp(cx0, hx, t) + (i % 2 ? 1 : -1) * (22 + mr() * 12), my = U.lerp(cy0, hy, t) + mr() * 8;
      mountain(mx, my, 9 + mr() * 5);
    }
    // forest (Whisperwood)
    const [tx, ty] = px('thornbrook'), [mx2, my2] = px('millbridge');
    const fr = U.rng(9);
    for (let i = 0; i < 22; i++) {
      const t = 0.2 + fr() * 0.6;
      const fx = U.lerp(tx, mx2, t) + (fr() - 0.5) * 40, fy = U.lerp(ty, my2, t) + (fr() - 0.5) * 34;
      if (Math.hypot(fx - tx, fy - ty) < 22 || Math.hypot(fx - mx2, fy - my2) < 24) continue;
      tree(fx, fy, 3 + fr() * 2);
    }
    // river through Greenmeadow (crossing route 2's midpoint, where the bridge is)
    const bend2 = 10;
    const r2mx = (mx2 + hx) / 2 + bend2 * (land ? 0.3 : 1), r2my = (my2 + hy) / 2 + bend2;
    const rx = U.lerp(U.lerp(mx2, r2mx, 0.5), U.lerp(r2mx, hx, 0.5), 0.5), ry = U.lerp(U.lerp(my2, r2my, 0.5), U.lerp(r2my, hy, 0.5), 0.5);
    c.strokeStyle = 'rgba(70,130,190,0.75)'; c.lineWidth = 3;
    c.beginPath();
    c.moveTo(rx - 25, A.y + A.h); c.quadraticCurveTo(rx - 4, ry + 30, rx, ry); c.quadraticCurveTo(rx + 6, ry - 40, rx + 18, A.y);
    c.stroke();
    // fields near Harrowfield
    for (let i = 0; i < 4; i++) {
      c.fillStyle = i % 2 ? 'rgba(200,170,60,0.35)' : 'rgba(120,160,60,0.3)';
      c.save(); c.translate(hx + 6 + i * 6, hy + 14 + (i % 2) * 6); c.rotate(-0.3); c.fillRect(-6, -3, 12, 6); c.restore();
    }
    // routes
    const routes = [
      ['route1', 'thornbrook', 'millbridge', -10],
      ['route2', 'millbridge', 'harrowfield', 10],
      ['route3', 'harrowfield', 'crownhold', -14],
    ];
    for (const [rid, a, b, bend] of routes) {
      const [ax, ay] = px(a), [bx, by] = px(b);
      // Route 3 starts from Greenmeadow's north (between M and H)
      let sx = ax, sy = ay;
      if (rid === 'route3') { const [m3, n3] = px('millbridge'); sx = U.lerp(m3, ax, 0.72); sy = U.lerp(n3, ay, 0.72); }
      const mx = (sx + bx) / 2 + bend * (land ? 0.3 : 1), my = (sy + by) / 2 + bend;
      c.setLineDash([3, 2.5]);
      c.strokeStyle = 'rgba(122,60,30,0.85)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, bx, by); c.stroke();
      c.setLineDash([]);
      // label
      const lx = U.lerp(U.lerp(sx, mx, 0.5), U.lerp(mx, bx, 0.5), 0.5), ly = U.lerp(U.lerp(sy, my, 0.5), U.lerp(my, by, 0.5), 0.5);
      D().text(PLACES[rid].name, lx, ly - 7, { size: 6, align: 'center', color: '#6a3b1f', outline: 'rgba(245,227,184,0.85)', outlineW: 2 });
      if (here === rid) youAreHere(lx, ly);
      if (rid === 'route2') { D().rrect(rx - 4, ry - 2.5, 8, 5, 1, '#9a6a3a', '#4a2a14', 0.8); D().line(rx - 3, ry - 1, rx + 3, ry - 1, '#c9a36a', 0.6); } // bridge
    }
    // towns
    for (const k of TOWNS) {
      const [x, y] = px(k);
      const vis = visited(k, here);
      if (vis) {
        townGlyph(PLACES[k].kind, x, y);
        D().text(PLACES[k].name, x, y + 9, { size: 7, align: 'center', bold: true, color: '#3a2414', outline: 'rgba(245,227,184,0.9)', outlineW: 2.5 });
        D().text(PLACES[k].sub, x, y + 18, { size: 5, align: 'center', color: '#7a4b2a', outline: 'rgba(245,227,184,0.9)', outlineW: 2 });
        const sealK = { thornbrook: 'sword', millbridge: 'archery', harrowfield: 'joust', crownhold: 'grand' }[k];
        if (G.state.seals[sealK]) sealBadge(SEALS.find((s) => s.id === sealK), x + 13, y - 9, 4.5, true, G.time);
      } else {
        // fog
        const fr2 = U.rng(k.length * 31);
        for (let i = 0; i < 6; i++) D().circle(x + (fr2() - 0.5) * 26, y + (fr2() - 0.5) * 14, 9 + fr2() * 5, 'rgba(235,225,205,0.85)');
        D().text('?', x, y + 1, { size: 12, align: 'center', baseline: 'middle', color: '#9a8466', bold: true });
        D().text('Unexplored', x, y + 13, { size: 5, align: 'center', color: '#9a8466' });
      }
      if (here === k) youAreHere(x, y - 4);
    }
    // compass rose
    const rr = Math.min(14, A.w * 0.07), rxx = land ? A.x + rr + 8 : A.x + A.w - rr - 8, ryy = land ? A.y + rr + 8 : A.y + A.h - rr - 22;
    compass(rxx, ryy, rr);
    // title cartouche
    D().text('The Realm', A.x + A.w - 6, A.y + 6, { size: 8, align: 'right', bold: true, color: '#5a3418' });
    c.restore();
    // vignette border
    D().rrect(A.x + 2, A.y + 2, A.w - 4, A.h - 4, 3, null, 'rgba(122,75,42,0.35)', 2);
    if (!here) D().text('Location unknown', A.x + 6, A.y + A.h - 10, { size: 6, color: '#7a4b2a' });
  }
  function youAreHere(x, y) {
    const b = Math.abs(Math.sin(G.time * 4)) * 4;
    const c = ctx();
    D().circle(x, y + 4, 4 + Math.sin(G.time * 4) * 1.5, 'rgba(214,69,61,0.25)');
    c.fillStyle = '#d6453d'; c.strokeStyle = '#3a1410'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(x, y - b + 2); c.arc(x, y - 6 - b, 4.5, Math.PI * 0.75, Math.PI * 0.25); c.closePath(); c.fill(); c.stroke();
    D().circle(x, y - 6 - b, 1.6, '#fff3d6');
    D().text('You', x, y - 18 - b, { size: 6, align: 'center', color: '#fff', outline: '#7a1c14', outlineW: 2 });
  }
  function mountain(x, y, s) {
    const c = ctx();
    c.fillStyle = '#a08a6a'; c.strokeStyle = '#6a4a2a'; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(x - s, y + s * 0.5); c.lineTo(x, y - s * 0.7); c.lineTo(x + s, y + s * 0.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f4f0e6';
    c.beginPath(); c.moveTo(x - s * 0.3, y - s * 0.3); c.lineTo(x, y - s * 0.7); c.lineTo(x + s * 0.3, y - s * 0.3); c.lineTo(x, y - s * 0.2); c.fill();
  }
  function tree(x, y, r) {
    D().rect(x - 0.5, y, 1, r * 0.8, '#6a4a2a');
    D().circle(x, y, r, '#5f8f3a', '#3a5a22', 0.6);
  }
  function townGlyph(kind, x, y) {
    const c = ctx();
    D().shadow(x, y + 5, 22, 0.2);
    if (kind === 'castle') {
      c.fillStyle = '#b8b0a0'; c.strokeStyle = '#4a3a2a'; c.lineWidth = 0.8;
      c.fillRect(x - 10, y - 6, 20, 10); c.strokeRect(x - 10, y - 6, 20, 10);
      for (const tx of [-11, 7]) { c.fillRect(x + tx, y - 11, 5, 15); c.strokeRect(x + tx, y - 11, 5, 15); }
      c.fillRect(x - 3, y - 14, 6, 10); c.strokeRect(x - 3, y - 14, 6, 10);
      D().rect(x - 0.5, y - 20, 1, 6, '#4a3a2a');
      D().rect(x + 0.5, y - 20, 5, 3, '#d6453d');
      D().rect(x - 2, y, 4, 4, '#4a2a1a');
      for (let i = 0; i < 4; i++) D().rect(x - 10 + i * 6, y - 8, 2, 2, '#b8b0a0');
    } else {
      const n = kind === 'village' ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const hx = x - (n - 1) * 5 + i * 10, hy = y - (i % 2) * 3;
        c.fillStyle = '#f4e4c1'; c.fillRect(hx - 4, hy - 3, 8, 7);
        c.strokeStyle = '#4a3a2a'; c.lineWidth = 0.7; c.strokeRect(hx - 4, hy - 3, 8, 7);
        c.fillStyle = i % 2 ? '#3f6aa8' : '#b84a2f';
        c.beginPath(); c.moveTo(hx - 5.5, hy - 3); c.lineTo(hx, hy - 9); c.lineTo(hx + 5.5, hy - 3); c.closePath(); c.fill(); c.stroke();
        D().rect(hx - 1, hy + 1, 2, 3, '#5a3418');
      }
    }
  }
  function compass(x, y, r) {
    const c = ctx();
    D().circle(x, y, r, 'rgba(245,227,184,0.6)', '#7a4b2a', 0.8);
    c.fillStyle = '#7a4b2a';
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 - Math.PI / 2;
      c.beginPath();
      c.moveTo(x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
      c.lineTo(x + Math.cos(a + 1.3) * r * 0.22, y + Math.sin(a + 1.3) * r * 0.22);
      c.lineTo(x + Math.cos(a - 1.3) * r * 0.22, y + Math.sin(a - 1.3) * r * 0.22);
      c.fillStyle = i === 0 ? '#c43c3c' : '#7a4b2a'; c.fill();
    }
    D().text('N', x, y - r - 6, { size: 6, align: 'center', color: '#5a3418' });
  }

  G.menus = {
    open: () => openPause(),
    drawWorldMap,
    locOf,
    get isOpen() { return !!openPause.active; },
  };
})();
