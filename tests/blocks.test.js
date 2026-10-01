// Block and item id tests (SPEC_modules.md, T15).
// Saves store ids, so a duplicate or a missing entry breaks old worlds.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, BLOCKS, I, ITEMS } from '../src/blocks.js';

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
