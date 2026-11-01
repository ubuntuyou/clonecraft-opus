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
    // LF first: a CRLF checkout (core.autocrlf) must not stop a "\n" pattern from matching.
    // A plant that does not change the text proves nothing, so each plant asserts that it changed the file.
    edit((name, fn) => {
      const p = join(dir, `${name}.js`);
      const before = readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
      const after = fn(before);
      assert.notEqual(after, before, `the plant did not change ${name}.js`);
      writeFileSync(p, after);
    });
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
test('upward: a later name is used at load time', () => fires(planted((e) => e('mesher', (t) => t + '\nterrainMaterial;\n')), 'upward'));
test('readonly: a module writes an imported name', () => fires(planted((e) => e('main', (t) => t + '\nfunction f() { world = null; }\n')), 'readonly'));
test('free: a name that is neither defined nor imported', () => fires(planted((e) => e('hud', (t) => t + '\nfunction f() { return notDefinedAnywhere; }\n')), 'free'));
// SPEC_hardening H9: an IIFE runs at load time, so a later name used inside one is an error.
test('upward: a later name is used inside an IIFE at load time', () => fires(planted((e) => e('liquids', (t) => t + '\nconst probe = (() => particles.update)();\n')), 'upward'));
test('upward: a later name is used inside a function IIFE at load time', () => fires(planted((e) => e('liquids', (t) => t + '\nconst probe = (function () { return particles.update; })();\n')), 'upward'));
// The control: a function that is not called at once still defers the name, so the rule does not fire.
test('upward: a later name inside a plain function still defers', () => {
  const errors = planted((e) => e('liquids', (t) => t + '\nfunction probe() { return particles.update; }\n'));
  assert.ok(!errors.some((x) => x.startsWith('upward:')), `a plain function must not fire, got: ${errors.join(' | ')}`);
});
test('worker: worldgen.js imports something', () => fires(planted((e) => e('worldgen', (t) => "import { CS } from './config.js';\n" + t)), 'worker'));
test('pure: a pure module reaches order.js', () => fires(planted((e) => e('crafting', (t) => "import { mobs } from './order.js';\n" + t)), 'pure'));

// SPEC_hardening H3: save-format is pure. The plant must change the text, or the test proves nothing.
test('pure: save-format reaches order.js', () => {
  let changed = false;
  const errors = planted((e) => e('save-format', (t) => { const out = "import { mobs } from './order.js';\n" + t; changed = out !== t; return out; }));
  assert.ok(changed, 'the plant did not change save-format.js');
  assert.ok(errors.includes('pure: save-format.js reaches order.js'), `expected the save-format pure error, got: ${errors.join(' | ') || 'none'}`);
});
