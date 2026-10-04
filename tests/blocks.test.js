// Block and item id tests (SPEC_modules.md, T15).
// Saves store ids, so a duplicate or a missing entry breaks old worlds.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ARMOR_PIECES, ARMOR_TIERS, armorId, B, blockDrop, BLOCKS, breakTime, EMIT_CRY, I, IDS_VERSION, ITEMS, migrateIds, toolId } from '../src/blocks.js';
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
// Phase 4 adds the Emberite tier (6) at 324..327.
test('armor ids are 300..327 and follow 300 + 4 * tier + piece', () => {
  const ids = [];
  ARMOR_TIERS.forEach((t, tier) => ARMOR_PIECES.forEach((p, piece) => {
    const id = armorId(tier, piece);
    assert.equal(id, 300 + 4 * tier + piece);
    assert.deepEqual(ITEMS[id].armor, { tier, piece, pts: t.pts[piece] });
    ids.push(id);
  }));
  assert.equal(Math.min(...ids), 300);
  assert.equal(Math.max(...ids), 327);
});
// Ids 176..186 are the realm blocks. 187..199 stay empty.
// The portal blocks (181, 182) and the pylon (186) have no item: only ignition or worldgen makes them.
test('ids 176..199 hold only the realm blocks and their block items', () => {
  const realm = [B.EMBER_ROCK, B.ASH_SAND, B.EMBER_LAMP, B.EMBERITE_ORE, B.EMBER_BRICKS, B.PORTAL_EMBER,
    B.PORTAL_CRYSTAL, B.CRYSTAL_FRAME, B.VOIDSTONE, B.GLIMMER_MOSS, B.PYLON];
  const noItem = [B.PORTAL_EMBER, B.PORTAL_CRYSTAL, B.PYLON];
  const used = [];
  for (let id = 176; id <= 199; id++) if (BLOCKS[id] || ITEMS[id]) used.push(id);
  assert.deepEqual(used, realm);
  for (const id of realm) if (noItem.includes(id)) assert.equal(ITEMS[id], undefined); else assert.equal(ITEMS[id].kind, 'block');
});

// SPEC_realms Phase 5 (gate item 6): tool, hardness, and drop of each Crystal Realm block.
test('Crystal Realm blocks: tools, hardness, and drops', () => {
  const pick = { id: toolId('pickaxe', 1), count: 1 }, shovel = { id: toolId('shovel', 1), count: 1 };
  const spec = [[B.VOIDSTONE, 3, 'pickaxe'], [B.GLIMMER_MOSS, 0.6, 'shovel'], [B.CRYSTAL_FRAME, 8, 'pickaxe'], [B.PORTAL_CRYSTAL, -1, null]];
  for (const [id, hardness, tool] of spec) {
    assert.equal(BLOCKS[id].hardness, hardness, BLOCKS[id].name);
    assert.equal(BLOCKS[id].tool ?? null, tool, BLOCKS[id].name);
  }
  assert.deepEqual(blockDrop(B.VOIDSTONE), [B.VOIDSTONE, 1]);
  assert.deepEqual(blockDrop(B.GLIMMER_MOSS), [B.VOIDSTONE, 1]);
  assert.deepEqual(blockDrop(B.CRYSTAL_FRAME), [B.CRYSTAL_FRAME, 1]);
  assert.ok(breakTime(B.VOIDSTONE, pick) < breakTime(B.VOIDSTONE, null));
  assert.ok(breakTime(B.GLIMMER_MOSS, shovel) < breakTime(B.GLIMMER_MOSS, null));
  assert.equal(breakTime(B.PORTAL_CRYSTAL, pick), Infinity);
});

// SPEC_realms Phase 6 (gate item 2): any hit breaks a pylon at once, and it drops nothing.
test('Resonance Pylon: breaks at once, drops nothing, emits crystal light 15', () => {
  assert.equal(breakTime(B.PYLON, null), 0);
  assert.equal(BLOCKS[B.PYLON].drop, null);
  assert.equal(EMIT_CRY[B.PYLON], 15);
  assert.equal(ITEMS[I.PRISM_HEART].name, 'Prism Heart');
});

// SPEC_realms Phase 2 (gate item 4): tool, hardness, and drop of each Ember Realm block.
test('Ember Realm blocks: tools, hardness, and drops', () => {
  const pick = (tier) => ({ id: toolId('pickaxe', tier), count: 1 }), shovel = { id: toolId('shovel', 7), count: 1 };
  const spec = [[B.EMBER_ROCK, 0.4, 'pickaxe'], [B.ASH_SAND, 0.5, 'shovel'], [B.EMBER_LAMP, 0.3, null],
    [B.EMBERITE_ORE, 3, 'pickaxe'], [B.EMBER_BRICKS, 2, 'pickaxe']];
  for (const [id, hardness, tool] of spec) {
    assert.equal(BLOCKS[id].hardness, hardness, BLOCKS[id].name);
    assert.equal(BLOCKS[id].tool, tool, BLOCKS[id].name);
  }
  assert.deepEqual(blockDrop(B.EMBER_ROCK), [B.EMBER_ROCK, 1]);
  assert.deepEqual(blockDrop(B.ASH_SAND), [B.ASH_SAND, 1]);
  assert.deepEqual(blockDrop(B.EMBER_BRICKS), [B.EMBER_BRICKS, 1]);
  assert.deepEqual(blockDrop(B.EMBERITE_ORE), [I.RAW_EMBERITE, 1]);
  for (let k = 0; k < 200; k++) {
    const [item, n] = blockDrop(B.EMBER_LAMP);
    assert.equal(item, I.EMBER_DUST);
    assert.ok(n >= 2 && n <= 4);
  }
  // A pickaxe mines the rock faster than a hand. A shovel mines ash faster.
  assert.ok(breakTime(B.EMBER_ROCK, pick(1)) < breakTime(B.EMBER_ROCK, null));
  assert.ok(breakTime(B.ASH_SAND, shovel) < breakTime(B.ASH_SAND, null));
  // The lamp needs no tool: a hand takes the harvest rate (1.5 x hardness).
  assert.equal(breakTime(B.EMBER_LAMP, null), 0.3 * 1.5);
  // Emberite Ore: a ruby pickaxe (level 4) cannot break it, so nothing drops; a diamond pickaxe can.
  assert.equal(breakTime(B.EMBERITE_ORE, pick(6)), Infinity);
  assert.equal(breakTime(B.EMBERITE_ORE, null), Infinity);
  assert.ok(Number.isFinite(breakTime(B.EMBERITE_ORE, pick(7))));
  assert.equal(BLOCKS[B.EMBER_LAMP].emit, 15);
  assert.equal(ITEMS[I.RAW_EMBERITE].name, 'Raw Emberite');
  assert.equal(ITEMS[I.EMBER_DUST].name, 'Ember Dust');
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
