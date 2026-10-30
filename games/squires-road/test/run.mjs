// Playwright harness: load dist/index.html at a phone viewport, run a script, screenshot.
// Usage:
//   node test/run.mjs --script path/to/script.mjs   (default export async (page, h) => {})
//   options: --html file (default dist/index.html) --outdir dir --landscape --debug
//   node test/run.mjs --eval "G.debug.newGame()" --wait 1000 --shot out.png [--landscape]
// Helpers passed to scripts (h): shot(name), wait(ms), tap(x,y) (logical px), hold(x,y,ms),
//   drag(x1,y1,x2,y2,ms), key(code,ms), eval(fn|string), errors[]
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const landscape = args.includes('--landscape');
const outDir = resolve(arg('--outdir', join(root, 'test', 'shots')));
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const vp = landscape ? { width: 844, height: 390 } : { width: 390, height: 844 };
const context = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const page = await context.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}\n${e.stack || ''}`));
const url = pathToFileURL(resolve(arg('--html', join(root, 'dist', 'index.html')))).href + (args.includes('--debug') ? '?debug=1' : '');
await page.goto(url);
await page.waitForFunction(() => window.__SR_READY === true, null, { timeout: 10000 });

const scale = await page.evaluate(() => G.gfx.scale);
const toCss = (x, y) => [x * scale, y * scale];
const h = {
  page, errors,
  wait: (ms) => page.waitForTimeout(ms),
  async shot(name) { const p = join(outDir, name.endsWith('.png') ? name : name + '.png'); await page.screenshot({ path: p }); console.log('shot:', p); return p; },
  eval: (fn, a) => page.evaluate(fn, a),
  async tap(x, y) { const [cx, cy] = toCss(x, y); await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); },
  async hold(x, y, ms) { const [cx, cy] = toCss(x, y); await page.mouse.move(cx, cy); await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up(); },
  async drag(x1, y1, x2, y2, ms = 300) {
    const [a, b] = toCss(x1, y1), [c, d] = toCss(x2, y2);
    await page.mouse.move(a, b); await page.mouse.down();
    const steps = Math.max(2, Math.round(ms / 16));
    for (let i = 1; i <= steps; i++) { await page.mouse.move(a + (c - a) * i / steps, b + (d - b) * i / steps); await page.waitForTimeout(16); }
    await page.mouse.up();
  },
  async key(code, ms = 80) { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); },
  // Hold a direction key while waiting
  async walk(code, ms) { await page.keyboard.down(code); await page.waitForTimeout(ms); await page.keyboard.up(code); },
  W: () => page.evaluate(() => G.W), H: () => page.evaluate(() => G.H),
};

try {
  const script = arg('--script');
  if (script) {
    const mod = await import(pathToFileURL(resolve(script)).href);
    await mod.default(page, h);
  } else {
    const ev = arg('--eval');
    if (ev) await page.evaluate(ev);
    await page.waitForTimeout(Number(arg('--wait', 800)));
    await h.shot(arg('--shot', 'shot.png'));
  }
} catch (e) {
  errors.push('[harness] ' + (e.stack || e.message));
}
if (errors.length) { console.log('--- console errors/warnings ---'); for (const e of errors) console.log(e); }
else console.log('no console errors');
await browser.close();
process.exit(errors.some((e) => e.includes('pageerror') || e.includes('[harness]')) ? 1 : 0);
