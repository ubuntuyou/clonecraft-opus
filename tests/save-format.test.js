// Save format tests (SPEC_hardening H1–H3). The live fixture is a save that the game wrote
// (tests/fixtures/save-live.json). DISCOVERY_save-format.md says when to refresh it.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as acorn from 'acorn';
import { B } from '../src/blocks.js';
import { editsOf, mapsOf, readSave, SLICE_FIELDS, validSave } from '../src/save-format.js';

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

// ---- H1: readSave ---------------------------------------------------------------------------
const SEED = 777001;   // the seed of the live fixture
test('readSave returns the checked save of the live fixture text', () => {
  const text = readFileSync('tests/fixtures/save-live.json', 'utf8');
  assert.equal(JSON.parse(text).seed, SEED);
  const { save, reason } = readSave(text, SEED);
  assert.equal(reason, null);
  assert.deepEqual(save, JSON.parse(text));
});
test('readSave returns no save and no reason when there is no save text', () => {
  assert.deepEqual(readSave(null, SEED), { save: null, reason: null });
});
test('readSave gives a reason for empty JSON', () => {
  const { save, reason } = readSave('{}', SEED);
  assert.equal(save, null);
  assert.match(reason, /"v" is missing or not valid/);
});
test('readSave gives a reason for a wrong seed', () => {
  const d = live();
  d.seed = SEED + 1;
  assert.equal(validSave(d), true);
  const { save, reason } = readSave(JSON.stringify(d), SEED);
  assert.equal(save, null);
  assert.equal(reason, `the save is for seed ${SEED + 1}, not seed ${SEED}`);
});
test('readSave gives a reason for a truncated text', () => {
  const text = readFileSync('tests/fixtures/save-live.json', 'utf8'), cut = text.slice(0, Math.floor(text.length / 2));
  assert.ok(cut.length > 0 && cut.length < text.length);
  const { save, reason } = readSave(cut, SEED);
  assert.equal(save, null);
  assert.equal(reason, 'the save text is not valid JSON');
});
test('readSave gives a reason for a save with no player', () => {
  const d = live();
  delete d.player;
  const { save, reason } = readSave(JSON.stringify(d), SEED);
  assert.equal(save, null);
  assert.match(reason, /"player" is missing or not valid/);
});
test('readSave runs migrateIds before the checks', () => {
  const d = JSON.parse(readFileSync('tests/fixtures/save-before-ids2.json', 'utf8'));
  assert.equal(d.ids, undefined);
  const { save, reason } = readSave(JSON.stringify(d), d.seed);
  assert.equal(reason, null);
  assert.equal(save.ids, 2);
});

// ---- H1: the save-reader rule -----------------------------------------------------------------
// Only src/save-format.js calls JSON.parse on save text. Save text is an expression that names
// SAVE_KEY or 'clonecraft.world.', or a variable whose value comes from one (forwarded forms).
// The names that an expression reads. A property name (a.b, { b: 1 }) is not a read of b.
function reads(node, out = new Set()) {
  if (!node || typeof node.type !== 'string') return out;
  if (node.type === 'Identifier') { out.add(node.name); return out; }
  for (const [k, v] of Object.entries(node)) {
    if ((node.type === 'MemberExpression' && k === 'property' && !node.computed) || (node.type === 'Property' && k === 'key' && !node.computed)) continue;
    if (Array.isArray(v)) v.forEach((x) => reads(x, out)); else if (v && typeof v === 'object') reads(v, out);
  }
  return out;
}
function saveReaderErrors(dir) {
  const errors = [], SAVE_TEXT = /SAVE_KEY|clonecraft\.world\./;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js') && n !== 'save-format.js')) {
    const src = readFileSync(join(dir, f), 'utf8');
    const ast = acorn.parse(src, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const assigns = [], parses = [];
    (function walk(n) {
      if (!n || typeof n.type !== 'string') return;
      if (n.type === 'VariableDeclarator' && n.id.type === 'Identifier' && n.init) assigns.push([n.id.name, n.init]);
      if (n.type === 'AssignmentExpression' && n.left.type === 'Identifier') assigns.push([n.left.name, n.right]);
      if (n.type === 'CallExpression' && n.callee.type === 'MemberExpression' && n.callee.object.name === 'JSON' && n.callee.property.name === 'parse') parses.push(n);
      for (const v of Object.values(n)) if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v);
    })(ast);
    // A save-text expression names SAVE_KEY or 'clonecraft.world.', or reads a tainted variable.
    const tainted = new Set();
    const isSaveText = (node) => SAVE_TEXT.test(src.slice(node.start, node.end)) || [...reads(node)].some((x) => tainted.has(x));
    for (let grew = true; grew;) {
      grew = false;
      for (const [name, init] of assigns) if (!tainted.has(name) && isSaveText(init)) { tainted.add(name); grew = true; }
    }
    for (const n of parses) {
      if (!n.arguments.some(isSaveText)) continue;
      const arg = n.arguments.map((a) => src.slice(a.start, a.end)).join(', ');
      errors.push(`save-reader: ${f} line ${n.loc.start.line} parses save text (${arg}). Use readSave from save-format.js.`);
    }
  }
  return errors;
}
function plantedSaveReader(file, edit) {
  const dir = mkdtempSync(join(tmpdir(), 'save-reader-'));
  try {
    cpSync('src', dir, { recursive: true });
    const p = join(dir, file), text = readFileSync(p, 'utf8').replace(/\r\n/g, '\n'), out = edit(text);
    assert.notEqual(out, text, `the plant did not change ${file}`);
    writeFileSync(p, out);
    return saveReaderErrors(dir);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('save-reader: only save-format.js parses save text in the real src/', () => assert.deepEqual(saveReaderErrors('src'), []));
test('save-reader fail proof: JSON.parse(storage.get(SAVE_KEY)) in config.js fails the rule', () => {
  const errors = plantedSaveReader('config.js', (t) => t + '\nconst planted = JSON.parse(storage.get(SAVE_KEY));\n');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^save-reader: config\.js line \d+ parses save text/);
});
test('save-reader fail proof: a forwarded save text fails the rule', () => {
  const errors = plantedSaveReader('boot.js', (t) => t + '\nconst raw = storage.get(SAVE_KEY);\nconst text2 = raw;\nconst planted = JSON.parse(text2);\n');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^save-reader: boot\.js line \d+ parses save text \(text2\)/);
});

// ---- M4, K7: the boot policy (openSave) ---------------------------------------------------------
import * as saveFormat from '../src/save-format.js';
import { BOOT_NOTICE, openSave } from '../src/save-format.js';
// A fake `storage` (config.js shape) with an op log: each call pushes [op, key].
// `failSet` makes every set return false (a full or blocked store); `init` seeds the entries.
// `failRemove` makes every remove return false and keep the entry.
function fakeStore(init = {}, { failSet = false, failRemove = false } = {}) {
  const map = new Map(Object.entries(init)), ops = [];
  return {
    map, ops,
    get(k) { ops.push(['get', k]); return map.has(k) ? map.get(k) : null; },
    set(k, v) { ops.push(['set', k]); if (failSet) return false; map.set(k, String(v)); return true; },
    remove(k) { ops.push(['remove', k]); if (failRemove) return false; map.delete(k); return true; },
  };
}
// A fake sessionStorage with an op log. `throwGet` and `throwSet` make those calls throw, as a
// blocked sessionStorage does; removeItem throws with `throwGet` too.
function fakeSession(init = {}, { throwGet = false, throwSet = false } = {}) {
  const map = new Map(Object.entries(init)), ops = [];
  const blocked = () => { throw new Error('SecurityError: sessionStorage is blocked'); };
  return {
    map, ops,
    getItem(k) { ops.push(['getItem', k]); if (throwGet) blocked(); return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { ops.push(['setItem', k]); if (throwSet) blocked(); map.set(k, String(v)); },
    removeItem(k) { ops.push(['removeItem', k]); if (throwGet) blocked(); map.delete(k); },
  };
}
// The openSave arguments for one boot: the live fixture's seed, a fixed clock, and an apply that
// records its calls. Pass `apply` to make it throw.
const BOOT_KEY = 'clonecraft.world.777001', BOOT_NOW = 1700000000000;
function bootArgs({ store = fakeStore(), session = fakeSession(), apply } = {}) {
  const applied = [];
  return { applied, store, session, key: BOOT_KEY, seed: SEED, now: BOOT_NOW, apply: apply || ((d) => { applied.push(d); }) };
}
const liveText = () => readFileSync('tests/fixtures/save-live.json', 'utf8');
const BACKUP_KEY = `${BOOT_KEY}.rejected.${BOOT_NOW}`;
const writes = (store) => store.ops.filter(([op]) => op !== 'get');   // the set and remove calls
const boom = () => { throw new Error('boom'); };
const carried = (keep) => JSON.stringify({ msg: 'carried message', keep });

test('M4-1 openSave with no save text returns empty fields and does not call apply', () => {
  const a = bootArgs();
  assert.deepEqual(openSave(a), { save: null, notice: null, blocked: false, reload: false });
  assert.deepEqual(a.applied, []);
});
test('M4-2 openSave applies the live fixture once and returns it with no notice', () => {
  const a = bootArgs({ store: fakeStore({ [BOOT_KEY]: liveText() }) });
  const o = openSave(a);
  assert.equal(a.applied.length, 1);
  assert.deepEqual(a.applied[0], JSON.parse(liveText()));
  assert.deepEqual(o.save, JSON.parse(liveText()));
  assert.equal(o.notice, null);
  assert.equal(o.blocked, false);
  assert.equal(o.reload, false);
});
test('M4-3 openSave backs up a bad-JSON save, then removes the key, and names the backup key', () => {
  const store = fakeStore({ [BOOT_KEY]: '{not json' });
  const o = openSave(bootArgs({ store }));
  assert.deepEqual(writes(store), [['set', BACKUP_KEY], ['remove', BOOT_KEY]]);
  assert.equal(store.map.get(BACKUP_KEY), '{not json');
  assert.equal(store.map.has(BOOT_KEY), false);
  assert.deepEqual(o.notice, {
    msg: `The saved world could not load: the save text is not valid JSON. A copy is in ${BACKUP_KEY}. A new world starts.`,
    keep: false,
  });
  assert.equal(o.save, null);
  assert.equal(o.blocked, false);
  assert.equal(o.reload, false);
});
test('M4-4 openSave keeps a bad-JSON save, blocks saving, and says so when the backup fails', () => {
  const store = fakeStore({ [BOOT_KEY]: '{not json' }, { failSet: true });
  const o = openSave(bootArgs({ store }));
  assert.deepEqual(writes(store).filter(([op]) => op === 'remove'), []);
  assert.equal(store.map.get(BOOT_KEY), '{not json');
  assert.deepEqual(o.notice, {
    msg: 'The saved world could not load: the save text is not valid JSON. It was kept. Saving is off until the next visit.',
    keep: true,
  });
  assert.equal(o.blocked, true);
  assert.equal(o.save, null);
  assert.equal(o.reload, false);
});
test('M4-5 openSave with a carried keep notice blocks saving, skips the save key, and clears the session key', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() }), session = fakeSession({ [BOOT_NOTICE]: carried(true) });
  const a = bootArgs({ store, session });
  const o = openSave(a);
  assert.equal(store.ops.some(([op, k]) => op === 'get' && k === BOOT_KEY), false);
  assert.equal(o.blocked, true);
  assert.deepEqual(o.notice, { msg: 'carried message', keep: true });
  assert.equal(session.map.has(BOOT_NOTICE), false);
  assert.equal(o.save, null);
  assert.deepEqual(a.applied, []);
});
test('M4-6 openSave reads a carried notice with bad JSON as no notice', () => {
  const session = fakeSession({ [BOOT_NOTICE]: '{not json' });
  const o = openSave(bootArgs({ session }));
  assert.equal(o.notice, null);
  assert.equal(o.blocked, false);
});
test('M4-7 openSave with a throwing session.getItem gives no notice and does not throw', () => {
  const session = fakeSession({}, { throwGet: true });
  let o;
  assert.doesNotThrow(() => { o = openSave(bootArgs({ session })); });
  assert.equal(o.notice, null);
  assert.equal(o.blocked, false);
});
test('M4-8 openSave on an apply throw returns no save, blocks saving, reloads, and puts the notice in the session', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() }), session = fakeSession();
  const o = openSave(bootArgs({ store, session, apply: boom }));
  assert.equal(o.save, null);
  assert.equal(o.blocked, true);
  assert.equal(o.reload, true);
  assert.deepEqual(o.notice, {
    msg: `The saved world could not load: it failed to load (boom). A copy is in ${BACKUP_KEY}. A new world starts.`,
    keep: false,
  });
  assert.deepEqual(JSON.parse(session.map.get(BOOT_NOTICE)), o.notice);
  assert.equal(store.map.get(BACKUP_KEY), liveText());
  assert.equal(store.map.has(BOOT_KEY), false);
});
test('M4-9 openSave backs up a save for another seed and gives the seed reason', () => {
  const d = live();
  d.seed = SEED + 1;
  const text = JSON.stringify(d), store = fakeStore({ [BOOT_KEY]: text });
  const a = bootArgs({ store });
  const o = openSave(a);
  assert.deepEqual(a.applied, []);
  assert.equal(o.save, null);
  assert.equal(o.notice.keep, false);
  assert.equal(o.notice.msg, `The saved world could not load: the save is for seed ${SEED + 1}, not seed ${SEED}. A copy is in ${BACKUP_KEY}. A new world starts.`);
  assert.equal(store.map.get(BACKUP_KEY), text);
  assert.equal(store.map.has(BOOT_KEY), false);
});
test('M4-10 K7 openSave reloads and carries the notice in the store when apply throws and the session write fails', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() }), session = fakeSession({}, { throwSet: true });
  const o = openSave(bootArgs({ store, session, apply: boom }));
  assert.equal(o.reload, true);
  assert.equal(o.blocked, true);
  assert.equal(o.save, null);
  assert.equal(o.notice.keep, false);
  assert.ok(store.map.has(BOOT_NOTICE), 'the store holds the notice');
  assert.deepEqual(JSON.parse(store.map.get(BOOT_NOTICE)), o.notice);
  assert.equal(store.map.has(BOOT_KEY), false, 'the reload is loop-safe: the save key is gone');
});
test('M4-11 K7 openSave does not reload when apply throws, the session write fails, and the backup fails', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() }, { failSet: true }), session = fakeSession({}, { throwSet: true });
  const o = openSave(bootArgs({ store, session, apply: boom }));
  assert.equal(o.reload, false);
  assert.equal(o.blocked, true);
  assert.equal(o.notice.keep, true);
  assert.match(o.notice.msg, /It was kept\. Saving is off until the next visit\.$/);
  assert.equal(store.map.has(BOOT_KEY), true);
});
test('M4-12 K7 openSave returns a notice that only the store holds and removes it from both stores', () => {
  const store = fakeStore({ [BOOT_NOTICE]: carried(false) }), session = fakeSession();
  const o = openSave(bootArgs({ store, session }));
  assert.deepEqual(o.notice, { msg: 'carried message', keep: false });
  assert.equal(o.blocked, false);
  assert.equal(store.map.has(BOOT_NOTICE), false);
  assert.equal(session.map.has(BOOT_NOTICE), false);
});
test('M4-12b K7 round trip: the boot after a blocked-session apply throw shows the notice and loads a fresh world', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() });
  const first = openSave(bootArgs({ store, session: fakeSession({}, { throwSet: true }), apply: boom }));
  assert.equal(first.reload, true);
  const a = bootArgs({ store, session: fakeSession() });   // the reload: a new tab session, the same store
  const second = openSave(a);
  assert.deepEqual(second.notice, first.notice);
  assert.equal(second.save, null);
  assert.equal(second.reload, false);
  assert.equal(second.blocked, false);
  assert.deepEqual(a.applied, []);
  assert.equal(store.map.has(BOOT_NOTICE), false);
});
test('K12-1 openSave keeps a bad-JSON save when the key remove fails, and drops the copy', () => {
  const store = fakeStore({ [BOOT_KEY]: '{not json' }, { failRemove: true });
  const o = openSave(bootArgs({ store }));
  assert.equal(o.notice.keep, true);
  assert.equal(o.blocked, true);
  assert.match(o.notice.msg, /It was kept\. Saving is off until the next visit\.$/);
  assert.equal(store.map.get(BOOT_KEY), '{not json');
  assert.equal(store.map.has(BACKUP_KEY), false);
  assert.deepEqual(writes(store), [['set', BACKUP_KEY], ['remove', BOOT_KEY], ['remove', BACKUP_KEY]]);
});
test('K12-2 an apply throw with a failing key remove reloads once, and the next boot does not loop', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() }, { failRemove: true }), session = fakeSession();
  const first = openSave(bootArgs({ store, session, apply: boom }));
  assert.equal(first.reload, true);
  assert.equal(JSON.parse(session.map.get(BOOT_NOTICE)).keep, true);
  store.ops.length = 0;
  const a = bootArgs({ store, session, apply: boom });   // the reload: the same tab session and store
  const second = openSave(a);
  assert.equal(second.reload, false);
  assert.equal(second.blocked, true);
  assert.equal(second.notice.keep, true);
  assert.deepEqual(a.applied, []);
  assert.equal(store.ops.some(([op, k]) => op === 'get' && k === BOOT_KEY), false, 'the save key is not read');
  assert.equal(store.ops.some(([op, k]) => op === 'set' && k.includes('.rejected.')), false, 'no new copy');
});
test('K12-3 an apply throw with a failing key remove and a throwing session write does not reload', () => {
  const store = fakeStore({ [BOOT_KEY]: liveText() }, { failRemove: true }), session = fakeSession({}, { throwSet: true });
  const o = openSave(bootArgs({ store, session, apply: boom }));
  assert.equal(o.reload, false);
  assert.equal(o.blocked, true);
  assert.equal(store.map.get(BOOT_KEY), liveText());
});
test('M4-13 K10 save-format.js does not export validSlice', () => {
  assert.equal(typeof saveFormat.validSave, 'function', 'precondition: the namespace holds the real exports');
  assert.equal('validSlice' in saveFormat, false);
});
