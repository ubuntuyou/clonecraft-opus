// Proves that tools/depcheck.js catches a break of each rule (SPEC_modules.md, T9).
// Each test copies src/ to a temporary folder, plants one break, and expects that rule to fire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { depcheck } from '../tools/depcheck.js';

function planted(edit) {
  const dir = mkdtempSync(join(tmpdir(), 'depcheck-'));
  try {
    cpSync('src', dir, { recursive: true });
    edit((name, fn) => { const p = join(dir, `${name}.js`); writeFileSync(p, fn(readFileSync(p, 'utf8'))); });
    return depcheck(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const fires = (errors, rule) => assert.ok(errors.some((e) => e.startsWith(`${rule}:`)), `expected a "${rule}" error, got: ${errors.slice(0, 3).join(' | ') || 'none'}`);

test('the real src/ passes', () => assert.deepEqual(depcheck('src'), []));

test('order: a statement other than a module line', () => fires(planted((e) => e('order', (t) => t + 'const x = 1;\n')), 'order'));
test('order: a module listed twice', () => fires(planted((e) => e('order', (t) => t + "import './blocks.js';\n")), 'order'));
test('main: main.js does not import order.js first', () => fires(planted((e) => e('main', (t) => t.replace("import './order.js';\n", ''))), 'main'));
test('main: a module imports main.js', () => fires(planted((e) => e('hud', (t) => "import './main.js';\n" + t)), 'main'));
test('downward: a module imports a later module directly', () => fires(planted((e) => e('blocks', (t) => "import { player } from './engine.js';\n" + t)), 'downward'));
test('upward: an earlier name comes from order.js', () => fires(planted((e) => e('vehicles', (t) => "import { mobs as m2 } from './order.js';\n" + t)), 'upward'));
test('upward: a later name is used at load time', () => fires(planted((e) => e('world', (t) => t + '\nbuildChunkMesh;\n')), 'upward'));
test('readonly: a module writes an imported name', () => fires(planted((e) => e('main', (t) => t + '\nfunction f() { world = null; }\n')), 'readonly'));
test('free: a name that is neither defined nor imported', () => fires(planted((e) => e('hud', (t) => t + '\nfunction f() { return notDefinedAnywhere; }\n')), 'free'));
test('worker: worldgen.js imports something', () => fires(planted((e) => e('worldgen', (t) => "import { CS } from './config.js';\n" + t)), 'worker'));
test('pure: a pure module reaches order.js', () => fires(planted((e) => e('crafting', (t) => "import { mobs } from './order.js';\n" + t)), 'pure'));
