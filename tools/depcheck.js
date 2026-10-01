// Import-rule check for src/ (SPEC_modules.md, D38 and D39). Permanent: `npm run check` runs it.
// Rules (each error starts with its rule id):
//   order     src/order.js holds only `import './x.js'` and `export { ... } from './x.js'`.
//             It lists every module except main.js exactly once. Its order is the load order.
//   main      main.js imports './order.js' first. No module imports main.js.
//   downward  A module imports a name directly only from an earlier module.
//   upward    A name from './order.js' belongs to a later module, and the importer uses it
//             only inside a function. At load time it is not evaluated yet.
//   readonly  No module writes an imported name. Use the owner's setter.
//   free      Every free name is a JavaScript or browser global.
//   worker    worldgen.js has no imports. The worker runs WorldGenModule.toString() alone.
//   pure      The pure modules never reach order.js, directly or through an import.
// Usage: node tools/depcheck.js [srcDir]   (exit 1 on any error)
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';
import * as escope from 'eslint-scope';
import globals from 'globals';

// Modules that tests import in Node. They must never pull in the rest of the game.
export const PURE = ['three', 'config', 'blocks', 'biomes', 'atlas', 'worldgen', 'gen-service', 'terrain-material', 'crafting'];
const GLOBALS = new Set([...Object.keys(globals.builtin), ...Object.keys(globals.browser)]);

export function depcheck(dir = 'src') {
  const errors = [];
  const err = (rule, msg) => errors.push(`${rule}: ${msg}`);
  const files = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => f.slice(0, -3));
  const parse = (name) => acorn.parse(readFileSync(`${dir}/${name}.js`, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true, ranges: true });
  const target = (spec) => (/^\.\/[\w-]+\.js$/.test(spec) ? spec.slice(2, -3) : null);

  // order.js: the load order and the upward names.
  const order = [], via = new Map();   // via: upward name -> owner module
  for (const n of parse('order').body) {
    const t = n.source && target(n.source.value);
    if (n.type === 'ImportDeclaration' && n.specifiers.length === 0 && t) order.push(t);
    else if (n.type === 'ExportNamedDeclaration' && t) { order.push(t); for (const s of n.specifiers) via.set(s.exported.name, t); }
    else err('order', `order.js line ${n.loc.start.line}: only "import './x.js'" and "export { } from './x.js'" belong here`);
  }
  for (const f of files) if (f !== 'order' && f !== 'main' && order.filter((o) => o === f).length !== 1) err('order', `${f}.js is listed ${order.filter((o) => o === f).length} times`);
  for (const o of order) if (!files.includes(o)) err('order', `order.js lists ${o}.js, which does not exist`);
  if (order.includes('main')) err('main', 'order.js lists main.js');
  const pos = (m) => (m === 'main' ? order.length : order.indexOf(m));

  const deps = {};   // module -> modules it imports
  for (const m of files.filter((f) => f !== 'order')) {
    const ast = parse(m);
    const imports = ast.body.filter((n) => n.type === 'ImportDeclaration');
    deps[m] = imports.map((n) => target(n.source.value)).filter(Boolean);
    if (m === 'main' && target(imports[0]?.source.value) !== 'order') err('main', "main.js must import './order.js' first");
    if (m === 'worldgen' && imports.length) err('worker', `worldgen.js has ${imports.length} imports; it must have none`);
    const fromOrder = new Set();
    for (const n of imports) {
      const t = target(n.source.value);
      if (!t) { if (!/^https:\/\//.test(n.source.value)) err('downward', `${m}.js imports ${n.source.value}`); continue; }
      if (t === 'main') err('main', `${m}.js imports main.js`);
      else if (t === 'order') {
        if (m === 'main') continue;
        for (const s of n.specifiers) {
          const own = via.get(s.imported.name);
          if (!own) err('upward', `${m}.js imports ${s.imported.name} from order.js, which does not export it`);
          else if (pos(own) <= pos(m)) err('upward', `${m}.js imports ${s.imported.name} from order.js, but ${own}.js loads earlier; import it directly`);
          fromOrder.add(s.local.name);
        }
      } else if (pos(t) < 0 || pos(t) >= pos(m)) err('downward', `${m}.js imports ${t}.js, which does not load earlier`);
    }
    const scopes = escope.analyze(ast, { ecmaVersion: 2022, sourceType: 'module' });
    const mod = scopes.scopes.find((s) => s.type === 'module');
    for (const v of mod.variables) {
      if (v.defs[0].type !== 'ImportBinding') continue;
      for (const r of v.references) {
        const line = r.identifier.loc.start.line;
        if (r.isWrite()) err('readonly', `${m}.js line ${line} writes imported ${v.name}`);
        if (fromOrder.has(v.name)) {
          let s = r.from;
          while (s && s !== mod && s.type !== 'function') s = s.upper;
          if (s === mod) err('upward', `${m}.js line ${line} uses ${v.name} at load time; it comes from a later module`);
        }
      }
    }
    for (const r of scopes.globalScope.through) if (!GLOBALS.has(r.identifier.name)) err('free', `${m}.js line ${r.identifier.loc.start.line}: ${r.identifier.name} is not defined or imported`);
  }

  for (const p of PURE) {
    const seen = new Set(), stack = [p];
    while (stack.length) { const x = stack.pop(); for (const d of deps[x] || []) if (!seen.has(d)) { seen.add(d); stack.push(d); } }
    if (seen.has('order')) err('pure', `${p}.js reaches order.js`);
  }
  return errors;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const errors = depcheck(process.argv[2] || 'src');
  for (const e of errors) console.log(e);
  console.log(errors.length ? `depcheck: ${errors.length} error(s)` : 'depcheck: pass');
  process.exit(errors.length ? 1 : 0);
}
