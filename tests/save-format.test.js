// Save format tests (SPEC_hardening H1–H3). The live fixture is a save that the game wrote
// (tests/fixtures/save-live.json). DISCOVERY_save-format.md says when to refresh it.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { B } from '../src/blocks.js';
import { editsOf, mapsOf, SLICE_FIELDS, validSave } from '../src/save-format.js';

// A fresh copy of the live fixture. Each test owns its copy.
const live = () => JSON.parse(readFileSync('tests/fixtures/save-live.json', 'utf8'));
// The slices of a save: the overworld (top level) and each entry of `realms`.
const slices = (d) => ({ overworld: d, ...d.realms });
// liquids holds two queues; it counts as populated when both queues hold an entry.
const populated = (f, v) => Array.isArray(v) && v.length > 0 && (f !== 'liquids' || v.every((q) => q.length > 0));

// ---- H3: the fixture and the moved checks -------------------------------------------------
test('the live fixture populates every slice field in the overworld, ember, and crystal', () => {
  const d = live();
  assert.deepEqual(Object.keys(slices(d)).sort(), ['crystal', 'ember', 'overworld']);
  const empty = [];
  for (const [name, s] of Object.entries(slices(d))) for (const f of SLICE_FIELDS) if (!populated(f, s[f])) empty.push(`${name}.${f}`);
  assert.deepEqual(empty, []);
});
test('the live fixture sets portals.crystalBack and boss', () => {
  const d = live();
  assert.equal(d.portals.crystalBack.length, 3);
  assert.equal(d.boss.defeated, true);
});
test('the live fixture passes validSave unchanged', () => {
  const d = live(), before = JSON.stringify(d);
  assert.equal(validSave(d), true);
  assert.equal(JSON.stringify(d), before);
});
test('editsOf(mapsOf(x)) gives back the edits of the live fixture, with B.LEAVES read as B.LEAVES_PLACED', () => {
  const d = live();
  const edits = Object.values(slices(d)).flatMap((s) => s.edits);
  assert.ok(edits.length > 0);
  assert.ok(edits.some(([, flat]) => flat.some((v, j) => j % 2 === 1 && v === B.LEAVES)), 'precondition: the fixture holds a B.LEAVES edit');
  const expected = edits.map(([k, flat]) => [k, flat.map((v, j) => (j % 2 === 1 && v === B.LEAVES ? B.LEAVES_PLACED : v))]);
  assert.deepEqual(editsOf(mapsOf(edits).overridesByChunk), expected);
});
test('editsOf(mapsOf(x)) equals x when x holds no B.LEAVES edit', () => {
  const x = [[2147516417, [34191, B.STONE, 35007, B.LEAVES_PLACED]], [2147581953, [0, B.WATER, 4095, B.AIR]]];
  assert.ok(!x.some(([, flat]) => flat.includes(B.LEAVES)));
  assert.deepEqual(editsOf(mapsOf(x).overridesByChunk), x);
});
test('a B.LEAVES edit loads as B.LEAVES_PLACED', () => {
  const k = 2147516417, i = (5 << 8) | (3 << 4) | 2;   // chunk (1, 1) of the key; local x 2, y 5, z 3
  const { overrides, overridesByChunk } = mapsOf([[k, [i, B.LEAVES]]]);
  assert.notEqual(B.LEAVES, B.LEAVES_PLACED);
  assert.equal(overridesByChunk.get(k).get(i), B.LEAVES_PLACED);
  const cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768;
  assert.equal(overrides.get(`${cx * 16 + 2},5,${cz * 16 + 3}`), B.LEAVES_PLACED);
});
