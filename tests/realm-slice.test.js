// SPEC_deepen M1: the SCOPED table in src/realms.js drives the realm slice, leave, and enter.
// realms.js does not load in Node (it reaches the DOM and three.js), so the tests read its source.
// The acorn helpers below come from the S5 contract. The tests follow them.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { SLICE_FIELDS } from '../src/save-format.js';

// The text of src/realms.js, with LF line ends.
export const realmsSource = () => readFileSync('src/realms.js', 'utf8').replace(/\r\n/g, '\n');

// The top-level `const SCOPED = { ... }` object node of `src`. Throws when the const is missing
// or is not an object literal.
function scopedNode(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  for (const n of ast.body) {
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) {
      if (d.id.type !== 'Identifier' || d.id.name !== 'SCOPED') continue;
      assert.equal(d.init?.type, 'ObjectExpression', 'SCOPED is not an object literal');
      return d.init;
    }
  }
  throw new Error('realms.js has no top-level const SCOPED');
}

// The keys of SCOPED in `src`, in source order.
export const scopedKeys = (src) => scopedNode(src).properties.map((p) => p.key.name ?? p.key.value);

// The field list that the realms.js guard compares with SLICE_FIELDS.
export const guardFields = (src) => ['edits', ...scopedKeys(src)];

// `src` with the SCOPED entry `key` and its trailing comma removed (the planted fail proof).
export function withoutScoped(src, key) {
  const p = scopedNode(src).properties.find((q) => (q.key.name ?? q.key.value) === key);
  assert.ok(p, `SCOPED has no entry ${key}`);
  const end = src[p.range[1]] === ',' ? p.range[1] + 1 : p.range[1];
  return src.slice(0, p.range[0]) + src.slice(end);
}

export { SLICE_FIELDS };

// ---- M1-1: the SCOPED keys and SLICE_FIELDS ------------------------------------------------
test('M1-1 the SCOPED keys plus edits equal SLICE_FIELDS, in order', () => {
  assert.deepEqual(guardFields(realmsSource()), SLICE_FIELDS);
});

test('M1-1 SCOPED holds each slice field once and never holds edits', () => {
  const keys = scopedKeys(realmsSource());
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(!keys.includes('edits'));
  assert.deepEqual(keys, SLICE_FIELDS.filter((f) => f !== 'edits'));
});

test('M1-1 a planted copy without looted fails the guard', () => {
  const planted = withoutScoped(realmsSource(), 'looted');
  assert.ok(!scopedKeys(planted).includes('looted'));
  assert.notEqual(guardFields(planted).join(), SLICE_FIELDS.join());
});

test('M1-1 removing any one SCOPED key fails the guard', () => {
  const src = realmsSource();
  for (const key of scopedKeys(src)) {
    const planted = withoutScoped(src, key);
    assert.deepEqual(scopedKeys(planted), scopedKeys(src).filter((k) => k !== key), `removed ${key}`);
    assert.notEqual(guardFields(planted).join(), SLICE_FIELDS.join(), `${key} still passes`);
  }
});

test('M1-1 removing a SCOPED key leaves the other entries untouched', () => {
  const src = realmsSource();
  const planted = withoutScoped(src, 'te');
  const kept = scopedKeys(src).filter((k) => k !== 'te');
  assert.deepEqual(scopedKeys(planted), kept);
  assert.equal(planted.length < src.length, true);
});

test('M1-1 a planted extra key fails the guard', () => {
  const src = realmsSource().replace(/const SCOPED = \{/, 'const SCOPED = { extra: wrap(liquids),');
  assert.ok(scopedKeys(src).includes('extra'));
  assert.notEqual(guardFields(src).join(), SLICE_FIELDS.join());
});

test('M1-1 scopedKeys throws when realms.js has no top-level SCOPED object', () => {
  assert.throws(() => scopedKeys('const A = {};'), /no top-level const SCOPED/);
  assert.throws(() => scopedKeys('const SCOPED = [];'), /not an object literal/);
});

test('M1-1 realms.js checks SCOPED against SLICE_FIELDS at load time and throws', () => {
  const src = realmsSource();
  const guard = acornTopIfs(src).find((t) => t.includes('SLICE_FIELDS') && t.includes('SCOPED'));
  assert.ok(guard, 'no top-level if compares SCOPED with SLICE_FIELDS');
  assert.match(guard, /\[\s*'edits',\s*\.\.\.Object\.keys\(SCOPED\)\s*\]\.join\(\)\s*!==\s*SLICE_FIELDS\.join\(\)/);
  assert.match(guard, /throw new Error\(/);
});

// ---- M2: persist.data takes the realm layout from realm.data() ----------------------------
// The spec lists M2-1 and M2-2 as QA. These source checks cover the part that runs in Node.
test('M2-src realms.js defines realm.data() and persist.data() spreads it', () => {
  const realms = realmsSource();
  assert.match(realms, /\n {2}data\(\) \{/);
  const persist = readFileSync('src/persist.js', 'utf8').replace(/\r\n/g, '\n');
  assert.match(persist, /\.\.\.realm\.data\(\)/);
});

test('M2-src persist.js no longer reads REALMS or realm.slice', () => {
  const persist = readFileSync('src/persist.js', 'utf8').replace(/\r\n/g, '\n');
  const code = persist.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(code, /\bREALMS\b/);
  assert.doesNotMatch(code, /realm\.slice\(/);
});

// The source text of each top-level `if` statement of `src`.
function acornTopIfs(src) {
  const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', ranges: true });
  return ast.body.filter((n) => n.type === 'IfStatement').map((n) => src.slice(n.range[0], n.range[1]));
}
