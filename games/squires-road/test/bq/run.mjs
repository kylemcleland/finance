// Battle-QA harness: like test/run.mjs, plus --vp WxH (e.g. 360x640) and REAL multi-touch
// through CDP (pointerType 'touch', distinct ids) so two thumbs can act at once.
// Usage: node test/bq/run.mjs --html test/bq.html --outdir test/shots/bq --script test/bq/x.mjs [--vp 360x640|--landscape]
// Helpers (h): shot, wait, eval, W(), H(), tap(x,y,ms), hold(x,y,ms), drag(x1,y1,x2,y2,ms),
//   touch.down(id,x,y) / touch.move(id,x,y) / touch.up(id)  (logical px), key(code,ms),
//   setVp(w,h), errors[], frameStats()
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const outDir = resolve(arg('--outdir', join(root, 'test', 'shots', 'bq')));
mkdirSync(outDir, { recursive: true });
let vp = { width: 390, height: 844 };
if (args.includes('--landscape')) vp = { width: 844, height: 390 };
if (arg('--vp')) { const [w, hh] = arg('--vp').split('x').map(Number); vp = { width: w, height: hh }; }

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); if (m.type() === 'log' && process.env.BQLOG) console.log('[page]', m.text()); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
const url = pathToFileURL(resolve(arg('--html', join(root, 'dist', 'index.html')))).href;
await page.goto(url);
await page.waitForFunction(() => window.__SR_READY === true, null, { timeout: 10000 });
const cdp = await context.newCDPSession(page);

let scale = await page.evaluate(() => G.gfx.scale);
const toCss = (x, y) => [x * scale, y * scale];
const touches = new Map();
async function sendTouch(type) {
  const pts = [...touches.entries()].map(([id, p]) => ({ x: p[0], y: p[1], id, radiusX: 8, radiusY: 8, force: 1 }));
  await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
}
const touch = {
  async down(id, x, y) { touches.set(id, toCss(x, y)); await sendTouch('touchStart'); },
  async move(id, x, y) { touches.set(id, toCss(x, y)); await sendTouch('touchMove'); },
  // releasing one of several fingers = a touchMove that omits it; the last finger = touchEnd
  async up(id) { const p = touches.get(id); touches.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: p ? [{ x: p[0], y: p[1], id }] : [] }); },
};
const h = {
  page, errors, touch, outDir,
  wait: (ms) => page.waitForTimeout(ms),
  async shot(name) { const p = join(outDir, name.endsWith('.png') ? name : name + '.png'); await page.screenshot({ path: p }); console.log('shot:', p); return p; },
  eval: (fn, a) => page.evaluate(fn, a),
  async tap(x, y, ms = 60, id = 7) { await touch.down(id, x, y); await page.waitForTimeout(ms); await touch.up(id); },
  async hold(x, y, ms, id = 7) { await touch.down(id, x, y); await page.waitForTimeout(ms); await touch.up(id); },
  async drag(x1, y1, x2, y2, ms = 300, id = 7, keep = false) {
    await touch.down(id, x1, y1);
    const steps = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) { await touch.move(id, x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await page.waitForTimeout(16); }
    if (!keep) await touch.up(id);
  },
  async key(code, ms = 80) { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); },
  async setVp(w, hh) { await page.setViewportSize({ width: w, height: hh }); await page.waitForTimeout(200); scale = await page.evaluate(() => G.gfx.scale); },
  W: () => page.evaluate(() => G.W), H: () => page.evaluate(() => G.H),
  // start a battle; result lands in window.__res, and window.__doneN counts done() calls
  async battle(type, o) {
    await page.evaluate(([t, o]) => {
      window.__res = null; window.__doneN = 0;
      G.battle.start(t, o).then((r) => { window.__res = r; window.__doneN++; });
    }, [type, o]);
  },
  res: () => page.evaluate(() => window.__res),
  async until(fn, ms = 20000, arg) { try { await page.waitForFunction(fn, arg, { timeout: ms, polling: 'raf' }); return true; } catch (e) { return false; } },
};

let code = 0;
try {
  const mod = await import(pathToFileURL(resolve(arg('--script'))).href);
  await mod.default(page, h);
} catch (e) {
  errors.push('[harness] ' + (e.stack || e.message)); code = 1;
}
if (errors.length) { console.log('--- console errors/warnings ---'); for (const e of errors) console.log(e); }
else console.log('no console errors');
await browser.close();
process.exit(code || (errors.some((e) => e.includes('pageerror') || e.includes('[harness]')) ? 1 : 0));
