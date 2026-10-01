// Writes src/order.js and the modules in src/ from the baseline (SPEC_modules.md, Step 2).
// One-off tool: Step 5 removes it. Nobody moves code by hand.
// Input: tools/modmap.json (module ranges, write-site edits, setters) and the baseline git tag.
// For each module it writes: leading comment, imports, baseline body with edits, setters, export list.
// The imports and exports come from scope analysis of the baseline script, never from a hand list.
// Usage: node tools/split.js
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import * as acorn from 'acorn';
import * as escope from 'eslint-scope';

const map = JSON.parse(readFileSync('tools/modmap.json', 'utf8'));
const base = execFileSync('git', ['show', `${map.baseline}:index.html`], { encoding: 'utf8', maxBuffer: 1 << 26 }).split('\n');
const mods = map.modules;
const index = Object.fromEntries(mods.map((m, i) => [m.name, i]));
const fail = (msg) => { console.error('split: ' + msg); process.exit(1); };

// Baseline script with the edits applied. Lines outside the script are blank, so line numbers hold.
const lines = base.map((l, i) => (i + 1 >= map.script.from && i + 1 <= map.script.to ? l : ''));
for (const e of map.edits) {
  if (!lines[e.line - 1].includes(`${e.binding} = `)) fail(`edit at ${e.line} does not write ${e.binding}`);
  lines[e.line - 1] = e.text;
}
// The setters go after the script, one per line, so the analysis sees them.
const setterLine = new Map();   // line -> setter
for (const s of map.setters) { lines.push(s.text); setterLine.set(lines.length, s); }

const moduleOf = (line) => {
  if (setterLine.has(line)) return setterLine.get(line).module;
  const m = mods.find((x) => line >= x.from && line <= x.to);
  if (!m) fail(`line ${line} is in no module`);
  return m.name;
};

const ast = acorn.parse(lines.join('\n'), { ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true });
const scope = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' }).scopes.find((s) => s.type === 'module');

const owner = new Map();                                   // top-level name -> module
for (const v of scope.variables) owner.set(v.name, moduleOf(v.defs[0].name.loc.start.line));
const needs = Object.fromEntries(mods.map((m) => [m.name, new Set()]));   // module -> names from other modules
const exportsOf = Object.fromEntries(mods.map((m) => [m.name, new Set()]));
for (const v of scope.variables) {
  const own = owner.get(v.name);
  for (const r of v.references) {
    const user = moduleOf(r.identifier.loc.start.line);
    if (user === own) continue;
    if (r.isWrite()) fail(`${user} writes ${v.name} of ${own} at line ${r.identifier.loc.start.line}; add an edit and a setter`);
    needs[user].add(v.name);
    exportsOf[own].add(v.name);
  }
}

const wrap = (head, names, tail) => {   // one statement, wrapped at 110 columns
  const one = `${head}{ ${names.join(', ')} }${tail}`;
  if (one.length <= 110) return [one];
  const out = [`${head}{`]; let cur = ' ';
  for (const n of names) { if ((cur + ' ' + n + ',').length > 110) { out.push(cur); cur = ' '; } cur += ' ' + n + ','; }
  out.push(cur, `}${tail}`);
  return out;
};
const byOrder = (a, b) => index[owner.get(a)] - index[owner.get(b)] || a.localeCompare(b);

for (const f of readdirSync('src')) if (f.endsWith('.js')) unlinkSync(`src/${f}`);

const upward = Object.fromEntries(mods.map((m) => [m.name, new Set()]));   // module -> names that earlier modules use
for (const m of mods) {
  const imports = [];
  if (m.name === 'main') imports.push(`import './order.js';`);
  const down = {}, up = [];
  for (const n of [...needs[m.name]].sort(byOrder)) {
    const o = owner.get(n);
    if (index[o] < index[m.name]) (down[o] ||= []).push(n);
    else { up.push(n); upward[o].add(n); }
  }
  for (const o of Object.keys(down).sort((a, b) => index[a] - index[b])) imports.push(...wrap('import ', down[o], ` from './${o}.js';`));
  if (up.length) imports.push(...wrap('import ', up, ` from './order.js';`));

  const body = lines.slice(m.from - 1, m.to);
  const setters = map.setters.filter((s) => s.module === m.name).map((s) => s.text);
  while (body.length && !body.at(-1).trim()) body.pop();
  // Keep the leading comment (the section banner) above the imports.
  let k = 0;
  while (k < body.length && !body[k].trim()) k++;
  if (body[k]?.trim().startsWith('/*')) { while (k < body.length && !body[k].includes('*/')) k++; k++; }
  else while (k < body.length && body[k].trim().startsWith('//')) k++;
  const lead = body.slice(0, k), rest = body.slice(k);
  while (lead.length && !lead[0].trim()) lead.shift();
  const exp = [...exportsOf[m.name]].sort((a, b) => a.localeCompare(b));
  const out = [
    ...lead,
    ...imports,
    ...(imports.length ? [''] : []),
    ...rest,
    ...(setters.length ? ['', ...setters] : []),
    ...(exp.length ? ['', ...wrap('export ', exp, ';')] : []),
    '',
  ];
  writeFileSync(`src/${m.name}.js`, out.join('\n'));
}

// order.js: the living header, then every module once, in load order.
const order = [...base.slice(map.header.from - 1, map.header.to), ''];
for (const m of mods) {
  if (m.name === 'main') continue;
  const up = [...upward[m.name]].sort((a, b) => a.localeCompare(b));
  order.push(...(up.length ? wrap('export ', up, ` from './${m.name}.js';`) : [`import './${m.name}.js';`]));
}
writeFileSync('src/order.js', order.join('\n') + '\n');

const nUp = Object.values(upward).reduce((s, x) => s + x.size, 0);
const nExp = Object.values(exportsOf).reduce((s, x) => s + x.size, 0);
console.log(`split: ${mods.length} modules, ${nExp} exported names, ${nUp} upward names, ${map.edits.length} edits, ${map.setters.length} setters`);
