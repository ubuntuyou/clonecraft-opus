// Block and item id tests (SPEC_modules.md, T15).
// Saves store ids, so a duplicate or a missing entry breaks old worlds.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARMOR_PIECES, ARMOR_TIERS, armorId, B, BLOCKS, I, IDS_VERSION, ITEMS, migrateIds } from '../src/blocks.js';
import { UNLOADED } from '../src/config.js';

const bIds = Object.values(B), iIds = Object.values(I);

test('the ids in B are unique', () => assert.equal(new Set(bIds).size, bIds.length));
test('the ids in I are unique', () => assert.equal(new Set(iIds).size, iIds.length));
test('B and I do not overlap', () => {
  const b = new Set(bIds);
  assert.deepEqual(iIds.filter((id) => b.has(id)), []);
});
test('each B id has a BLOCKS entry', () => {
  assert.deepEqual(Object.entries(B).filter(([, id]) => !BLOCKS[id]).map(([k]) => k), []);
});
test('each I id has an ITEMS entry', () => {
  assert.deepEqual(Object.entries(I).filter(([, id]) => !ITEMS[id]).map(([k]) => k), []);
});

// SPEC_realms Phase 0: the id plan.
test('every block id fits in a chunk byte and is not UNLOADED', () => {
  assert.deepEqual(BLOCKS.map((b, id) => b && id).filter((id) => id !== undefined && id !== false && (id < 0 || id >= UNLOADED)), []);
});
test('armor ids are 300..323 and follow 300 + 4 * tier + piece', () => {
  const ids = [];
  ARMOR_TIERS.forEach((t, tier) => ARMOR_PIECES.forEach((p, piece) => {
    const id = armorId(tier, piece);
    assert.equal(id, 300 + 4 * tier + piece);
    assert.deepEqual(ITEMS[id].armor, { tier, piece, pts: t.pts[piece] });
    ids.push(id);
  }));
  assert.equal(Math.min(...ids), 300);
  assert.equal(Math.max(...ids), 323);
});
test('ids 176..199 hold no block and no item', () => {
  const used = [];
  for (let id = 176; id <= 199; id++) if (BLOCKS[id] || ITEMS[id]) used.push(id);
  assert.deepEqual(used, []);
});

// The fixture is a real save from the build before Phase 0 (HEAD c40ebc4, seed 12345). It holds
// armor in the armor slots, the inventory, the loose stacks, and a chest.
const oldSave = () => JSON.parse(readFileSync(new URL('./fixtures/save-before-ids2.json', import.meta.url), 'utf8'));
const stackIds = (d) => [...d.inv.slots, ...d.inv.loose, ...d.armor, ...d.te.flatMap((t) => t.slots)].filter(Boolean).map((s) => s.id);
test('migrateIds moves every armor stack id by 124 and keeps the other stack fields', () => {
  const before = oldSave(), d = migrateIds(oldSave());
  assert.equal(before.ids, undefined);
  assert.equal(d.ids, IDS_VERSION);
  const a = stackIds(before), b = stackIds(d);
  assert.ok(a.filter((id) => id >= 176 && id <= 199).length >= 7);
  assert.deepEqual(b, a.map((id) => id >= 176 && id <= 199 ? id + 124 : id));
  for (const id of b) assert.ok(ITEMS[id], `id ${id} has an item`);
  assert.deepEqual(d.armor.map((s) => s && ITEMS[s.id].armor.piece), [0, 1, null, 3]);
  assert.deepEqual(d.armor[1].ench, before.armor[1].ench);
  assert.equal(d.armor[1].dur, before.armor[1].dur);
  assert.deepEqual(d.edits, before.edits);
  assert.deepEqual(d.homes, before.homes);
});
test('migrateIds passes a save with ids unchanged', () => {
  const d = migrateIds(oldSave()), again = JSON.stringify(d);
  assert.equal(JSON.stringify(migrateIds(d)), again);
  const marked = Object.assign(oldSave(), { ids: IDS_VERSION });
  assert.equal(JSON.stringify(migrateIds(marked)), JSON.stringify(Object.assign(oldSave(), { ids: IDS_VERSION })));
});
test('migrateIds ignores input that is not a save object', () => {
  for (const v of [null, undefined, 3, 'x', []]) assert.doesNotThrow(() => migrateIds(v));
  assert.deepEqual(migrateIds({}), { ids: IDS_VERSION });
});
