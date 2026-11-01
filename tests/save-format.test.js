// Save format tests (SPEC_hardening H1–H3). The live fixture is a save that the game wrote
// (tests/fixtures/save-live.json). DISCOVERY_save-format.md says when to refresh it.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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

// ---- H2: the save-sweep rule ----------------------------------------------------------------
// The sweep mutates every JSON path of the live fixture, one mutant at a time, and runs validSave.
// Mutants: delete the key (object keys only), null, a string, -1, 1e9, {}, [], and [null] (in place
// of an array). A mutant equal to the original value is skipped. A path pattern writes each array
// index as [*]. A pattern and mutant pair is accepted when validSave accepts it at any path of the
// pattern. Each accepted pair must be in tests/fixtures/save-accepted-mutants.json with a reason.
// The ratchet: a listed pair that validSave now rejects is an error too, so the baseline only shrinks.
const MUTANTS = { delete: undefined, null: null, string: 'x', '-1': -1, '1e9': 1e9, '{}': {}, '[]': [], '[null]': [null] };
const baseline = () => JSON.parse(readFileSync('tests/fixtures/save-accepted-mutants.json', 'utf8'));
function jsonPaths(v, path = []) {
  const out = [path];
  if (v && typeof v === 'object') for (const k of Object.keys(v)) out.push(...jsonPaths(v[k], [...path, Array.isArray(v) ? +k : k]));
  return out;
}
const pathText = (p, pattern) => p.map((k, i) => (typeof k === 'number' ? (pattern ? '[*]' : `[${k}]`) : (i ? '.' : '') + k)).join('');
function sweep(check, fixture, listed) {
  const accepted = new Map();   // "pattern mutant" -> the first path that accepts it
  for (const p of jsonPaths(fixture).slice(1)) {
    for (const [kind, value] of Object.entries(MUTANTS)) {
      const d = structuredClone(fixture);
      let parent = d;
      for (const k of p.slice(0, -1)) parent = parent[k];
      const last = p[p.length - 1];
      if (kind === 'delete' && Array.isArray(parent)) continue;
      if (kind === '[null]' && !Array.isArray(parent[last])) continue;
      if (kind !== 'delete' && JSON.stringify(parent[last]) === JSON.stringify(value)) continue;
      if (kind === 'delete') delete parent[last]; else parent[last] = structuredClone(value);
      const key = `${pathText(p, true)} ${kind}`;
      if (check(d) && !accepted.has(key)) accepted.set(key, pathText(p, false));
    }
  }
  const errors = [], known = new Set();
  for (const e of listed) {
    const key = `${e.path} ${e.mutant}`;
    known.add(key);
    if (!e.reason) errors.push(`save-sweep: the baseline entry ${key} has no reason`);
    if (!accepted.has(key)) errors.push(`save-sweep: the baseline lists ${key}, but validSave now rejects it. Delete the entry (the baseline only shrinks).`);
  }
  for (const [key, at] of accepted) {
    if (!known.has(key)) errors.push(`save-sweep: ${at} accepts the ${key.slice(key.lastIndexOf(' ') + 1)} mutant. Add a check, or list ${key} with a true reason.`);
  }
  return errors;
}

test('save-sweep: validSave rejects every mutant of the live fixture that the baseline does not list', () => {
  const d = live(), listed = baseline();
  assert.equal(validSave(d), true);
  assert.ok(listed.length > 0);
  assert.deepEqual(sweep(validSave, d, listed), []);
});
test('save-sweep ratchet: a listed mutant that validSave rejects fails the sweep', () => {
  const d = live(), listed = baseline();
  assert.ok(!listed.some((e) => e.path === 'liquids[*][*]' && e.mutant === 'null'), 'precondition: the entry is not listed');
  const errors = sweep(validSave, d, [...listed, { path: 'liquids[*][*]', mutant: 'null', reason: 'a stale entry' }]);
  assert.deepEqual(errors, ['save-sweep: the baseline lists liquids[*][*] null, but validSave now rejects it. Delete the entry (the baseline only shrinks).']);
});
test('save-sweep fail proof: without the liquids element check, the sweep fails and names the path', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'save-sweep-'));
  try {
    cpSync('src', dir, { recursive: true });
    const file = join(dir, 'save-format.js'), text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
    const planted = text.replace(/^ {2}liquids: .*$/m, '  liquids: (a) => a === undefined || arr(a),');
    assert.notEqual(planted, text, 'the plant did not change save-format.js');
    writeFileSync(file, planted);
    const scratch = await import(pathToFileURL(file).href);
    const errors = sweep(scratch.validSave, live(), baseline());
    assert.ok(errors.length > 0);
    assert.ok(errors.every((e) => e.startsWith('save-sweep: ')));
    assert.ok(errors.some((e) => e.startsWith('save-sweep: liquids[0][0] accepts the null mutant')), errors.join('\n'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// ---- H2: element checks ---------------------------------------------------------------------
// Each test changes one field of the live fixture and expects validSave to reject the save.
const rejects = (edit) => { const d = live(); assert.equal(validSave(d), true); edit(d); assert.equal(validSave(d), false); };
test('validSave rejects liquids [[null]]', () => rejects((d) => { d.liquids = [[null]]; }));
test('validSave rejects a null cell in a liquid queue', () => rejects((d) => { d.liquids[0][0] = null; }));
test('validSave rejects a liquid cell with y outside 0..H-1', () => rejects((d) => { d.liquids[1][0][1] = 176; }));
test('validSave rejects leaves [null]', () => rejects((d) => { d.leaves = [null]; }));
test('validSave rejects a leaf cell that is not an integer triple', () => rejects((d) => { d.realms.ember.leaves[0] = [1.5, 70, 2]; }));
test('validSave rejects a furnace with no burn', () => rejects((d) => { delete d.te.find((t) => t.type === 'furnace').burn; }));
test('validSave rejects a furnace with a negative cook', () => rejects((d) => { d.realms.crystal.te.find((t) => t.type === 'furnace').cook = -1; }));
test('validSave rejects a furnace with 27 slots', () => rejects((d) => { d.te.find((t) => t.type === 'furnace').slots = new Array(27).fill(null); }));
test('validSave rejects a chest with 3 slots', () => rejects((d) => { d.te.find((t) => t.type === 'chest').slots = [null, null, null]; }));
test('validSave rejects a tile entity of an unknown type', () => rejects((d) => { d.te[0].type = 'barrel'; }));
test('validSave rejects a home with no yaw', () => rejects((d) => { delete d.homes[0].yaw; }));
test('validSave rejects inv.sel 99', () => rejects((d) => { d.inv.sel = 99; }));
test('validSave rejects a player health above player.maxHealth', () => rejects((d) => { d.player.health = 21; }));
test('validSave rejects a negative player health', () => rejects((d) => { d.player.health = -1; }));
test('validSave rejects a stack with a string dur', () => rejects((d) => { d.inv.slots[0].dur = 'x'; }));
test('validSave accepts a chest from lootChest, which has no burn fields', () => {
  const d = live(), loot = d.te.find((t) => t.type === 'chest' && t.slots.filter(Boolean).length > 1 && t.burn === undefined);
  assert.ok(loot, 'precondition: the fixture holds a looted chest');
  assert.equal(validSave(d), true);
});
