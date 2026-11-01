// SPEC_deepen M1: the SCOPED table in src/realms.js drives the realm slice, leave, and enter.
// realms.js does not load in Node (it reaches the DOM and three.js), so the tests read its source.
// T5.2 writes the M1-1 cases. The helpers below are the S5 contract fakes.
import './host-stub.js';
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
