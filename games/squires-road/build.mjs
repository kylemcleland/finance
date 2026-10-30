// Bundles src/**/*.js into one self-contained dist/index.html.
// Usage: node games/squires-road/build.mjs [--out path]
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = dirname(fileURLToPath(import.meta.url));
const src = join(root, 'src');

const CORE = ['util.js', 'gfx.js', 'input.js', 'sprites.js', 'audio.js', 'scenes.js', 'ui.js'];
const DIRS = ['data', 'game', 'world', 'content', 'battle'];

const files = CORE.map((f) => join(src, 'core', f));
for (const extra of readdirSync(join(src, 'core')).sort()) {
  if (extra.endsWith('.js') && !CORE.includes(extra)) files.push(join(src, 'core', extra));
}
for (const d of DIRS) {
  const dir = join(src, d);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).sort()) if (f.endsWith('.js')) files.push(join(dir, f));
}
files.push(join(src, 'main.js'));

// Each file is syntax-checked. A broken file is skipped (and reported) so one
// in-progress module never blocks everyone else; --strict makes it fatal.
// Each file runs inside try/catch so a load-time throw is isolated too.
const strict = process.argv.includes('--strict');
let ok = true;
const parts = [];
for (const f of files) {
  const code = readFileSync(f, 'utf8');
  const name = relative(src, f);
  try {
    new vm.Script(code, { filename: relative(root, f) });
  } catch (e) {
    ok = false;
    console.error(`Syntax error in ${relative(root, f)} (skipped):\n  ${e.message}\n${(e.stack || '').split('\n').slice(0, 3).join('\n')}`);
    continue;
  }
  parts.push(`/* ---- ${name} ---- */\ntry {\n${code.replace(/<\/script/gi, '<\\/script')}\n} catch (e) { console.error('load error in ${name}', e); }`);
}
if (!ok && strict) process.exit(1);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#1b1640">
<title>Squire's Road</title>
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; height: 100%; background: #000; overflow: hidden;
    touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent; overscroll-behavior: none; }
  canvas { display: block; position: fixed; left: 0; top: 0; image-rendering: pixelated; }
</style>
</head>
<body>
<script>
${parts.join('\n')}
</script>
</body>
</html>
`;

// --artifact: page fragment for claude.ai Artifacts (the host adds the skeleton).
const artifact = process.argv.includes('--artifact');
const page = artifact
  ? html.replace(/^[\s\S]*?<head>\n/, '').replace(/<\/head>\n<body>\n/, '').replace(/<\/body>\n<\/html>\n$/, '')
      .replace(/<meta (charset|name="viewport"|name="apple-mobile-web-app-capable"|name="mobile-web-app-capable")[^>]*>\n/g, '')
  : html;
const outArg = process.argv.indexOf('--out');
const out = outArg > 0 ? process.argv[outArg + 1] : join(root, 'dist', 'index.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, page);
console.log(`Built ${relative(process.cwd(), out)} — ${files.length} files, ${(html.length / 1024).toFixed(0)} KB`);
