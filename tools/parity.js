// Parity check for the module split (SPEC_modules.md, D42). One-off tool: Step 5 removes it.
// It compares src/ and dist/index.html with the baseline (git tag in tools/modmap.json).
//   PA1  The module ranges cover the baseline script once, in order.
//   PA2  Each src/<module>.js, without its relative imports and its export list, equals
//        its baseline lines plus its edits and setters. Blank lines do not count.
//   PA3  The built script equals the baseline script plus the edits and setters, in order.
//        Blank lines, the Vite CSS line, and the place of the living header do not count.
//   PAGE The built page outside the script equals the baseline page, except the generated comment.
// Usage: node tools/parity.js            after the split (Step 2)
//        node tools/parity.js --unsplit  before the split (Step 1): no edits, no PA1, no PA2
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';

const map = JSON.parse(readFileSync('tools/modmap.json', 'utf8'));
const unsplit = process.argv.includes('--unsplit');
const base = execFileSync('git', ['show', `${map.baseline}:index.html`], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n');
const lines = (a, b) => base.slice(a - 1, b);   // baseline lines a..b, 1-based, inclusive
let fails = 0;
const check = (name, ok, why = '') => { console.log(`${ok ? 'pass' : 'FAIL'} ${name}${ok ? '' : ': ' + why}`); if (!ok) fails++; };

const modules = unsplit ? [{ name: 'main', from: map.script.from, to: map.script.to }] : map.modules;
const edits = unsplit ? [] : map.edits;
const setters = unsplit ? [] : map.setters;

// Baseline lines of one module, with its edits applied and its setters after them.
function expected(m) {
  const out = lines(m.from, m.to);
  for (const e of edits) if (e.line >= m.from && e.line <= m.to) out[e.line - m.from] = e.text;
  for (const s of setters) if (s.module === m.name) out.push(s.text);
  return out;
}
const firstDiff = (a, b) => { for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i] !== b[i]) return `line ${i}: ${JSON.stringify((a[i] ?? '<end>').slice(0, 90))} vs ${JSON.stringify((b[i] ?? '<end>').slice(0, 90))}`; return ''; };

// A module's text without its relative imports and its export list (the lines split.js adds).
function withoutLinks(text) {
  const drop = new Set();
  for (const n of acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true }).body) {
    const link = (n.type === 'ImportDeclaration' && n.source.value.startsWith('./')) || (n.type === 'ExportNamedDeclaration' && !n.declaration && !n.source);
    if (link) for (let l = n.loc.start.line; l <= n.loc.end.line; l++) drop.add(l);
  }
  return text.split('\n').filter((_, i) => !drop.has(i + 1));
}

// PA1
if (!unsplit) {
  let next = map.script.from, ok = true, why = '';
  for (const m of modules) { if (m.from !== next || m.to < m.from) { ok = false; why = `${m.name} starts at ${m.from}, expected ${next}`; break; } next = m.to + 1; }
  if (ok && next !== map.script.to + 1) { ok = false; why = `ranges end at ${next - 1}, expected ${map.script.to}`; }
  for (const e of edits) if (!lines(e.line, e.line)[0].includes(`${e.binding} = `)) { ok = false; why = `edit at ${e.line} does not write ${e.binding}`; }
  check('PA1 module ranges cover the baseline script once, in order', ok, why);
}

// PA2
if (!unsplit) {
  const bad = [];
  for (const m of modules) {
    const path = `src/${m.name}.js`;
    if (!existsSync(path)) { bad.push(`${path} missing`); continue; }
    const got = withoutLinks(readFileSync(path, 'utf8'));
    const d = firstDiff(got.filter((l) => l.trim()), expected(m).filter((l) => l.trim()));
    if (d) bad.push(`${m.name} ${d}`);
  }
  check(`PA2 each of ${modules.length} module bodies equals its baseline lines plus its edits`, !bad.length, bad.slice(0, 3).join('; '));
}

// PA3 and PAGE
const built = readFileSync('dist/index.html', 'utf8');
const tag = built.match(/<script type="module" crossorigin>([\s\S]*?)<\/script>/);
check('PA3 the built page holds one inline module script', !!tag && (built.match(/<script/g) || []).length === 1);
if (tag) {
  let got = tag[1].split('\n').filter((l) => !/^const index_html_htmlProxy_inlineCss_index_\d+ = '';$/.test(l));
  const header = lines(map.header.from, map.header.to);
  const at = got.findIndex((_, i) => header.every((h, j) => got[i + j] === h));
  const headerOk = at >= 0;
  if (headerOk) got.splice(at, header.length);
  check('PA3 the built script holds the living header once, unchanged', headerOk && !got.some((_, i) => header.every((h, j) => got[i + j] === h)));
  const want = modules.flatMap(expected).filter((l) => l.trim());
  got = got.filter((l) => l.trim());
  const d = firstDiff(got, want);
  check(`PA3 the built script equals the baseline script plus ${edits.length} edits and ${setters.length} setters (${want.length} non-blank lines)`, !d, d);
  const page = built.replace(tag[0], '').split('\n').filter((l) => !l.startsWith('<!-- GENERATED by `npm run build`')).map((l) => l.trimEnd()).filter((l) => l);
  const basePage = [...lines(1, 372), ...lines(9384, 9385)].map((l) => l.trimEnd()).filter((l) => l);
  const pd = firstDiff(page, basePage);
  check('PAGE the CSS and markup equal the baseline page', !pd, pd);
}
console.log(fails ? `${fails} check(s) failed` : 'all checks pass');
process.exit(fails ? 1 : 0);
