// Crafting tests (SPEC_modules.md, T16).
// matchRecipe(grid, size) reads a size×size grid of stacks ({ id } or null).
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, I, toolId } from '../src/blocks.js';
import { matchRecipe } from '../src/crafting.js';

// Builds a grid from rows of characters. A space is an empty slot.
function grid(rows, key, size = 3) {
  const g = new Array(size * size).fill(null);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') g[y * size + x] = { id: key[ch], count: 1 }; }));
  return g;
}
const out = (g, size = 3) => matchRecipe(g, size)?.out ?? null;

test('one log gives planks', () => {
  const r = matchRecipe(grid(['L'], { L: B.LOG }, 2), 2);
  assert.equal(r.out, B.PLANKS);
  assert.equal(r.count, 4);
});
test('a stone pickaxe pattern gives a stone pickaxe', () => {
  assert.equal(out(grid(['CCC', ' S ', ' S '], { C: B.COBBLE, S: I.STICK })), toolId('pickaxe', 2));
});
test('a ring of cobblestone gives a furnace', () => {
  assert.equal(out(grid(['CCC', 'C C', 'CCC'], { C: B.COBBLE })), B.FURNACE);
});
test('an empty grid gives null', () => {
  assert.equal(matchRecipe(new Array(9).fill(null), 3), null);
  assert.equal(matchRecipe(new Array(4).fill(null), 2), null);
});
test('a shaped recipe smaller than the grid matches at each offset', () => {
  // Sticks are a 1×2 pattern. A 3×3 grid holds it at 6 places.
  for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) {
    const g = new Array(9).fill(null);
    g[y * 3 + x] = { id: B.PLANKS, count: 1 }; g[(y + 1) * 3 + x] = { id: B.PLANKS, count: 1 };
    assert.equal(out(g), I.STICK, `offset ${x}, ${y}`);
  }
});
test('a shaped recipe matches when mirrored', () => {
  const axe = toolId('axe', 1);
  assert.equal(out(grid(['PP', 'PS', ' S'], { P: B.PLANKS, S: I.STICK })), axe);
  assert.equal(out(grid(['PP', 'SP', 'S '], { P: B.PLANKS, S: I.STICK })), axe);
  assert.equal(out(grid([' PP', ' SP', ' S '], { P: B.PLANKS, S: I.STICK })), axe);
});
test('a wrong pattern gives null', () => {
  assert.equal(out(grid(['C C', ' S ', ' S '], { C: B.COBBLE, S: I.STICK })), null);
});

// SPEC_realms Phase 5 (gate item 1): an obsidian with a crystal on each side gives 2 Crystal Frames.
test('obsidian ringed by 4 crystals gives 2 Crystal Frames', () => {
  const r = matchRecipe(grid([' C ', 'COC', ' C '], { O: B.OBSIDIAN, C: B.CRYSTAL }), 3);
  assert.deepEqual([r.out, r.count], [B.CRYSTAL_FRAME, 2]);
  assert.equal(out(grid([' C ', 'C C', ' C '], { C: B.CRYSTAL })), null);
});
