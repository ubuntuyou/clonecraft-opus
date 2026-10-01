// World generation tests (SPEC_modules.md, T14).
// The golden hashes come from the baseline WorldGenModule (git tag baseline-single-file), seed 12345.
// A changed hash means the terrain changed. Old saves store only edits, so they would load on new terrain.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CS, H, SEA } from '../src/config.js';
import { B } from '../src/blocks.js';
import { BIOME } from '../src/biomes.js';
import { WorldGenModule } from '../src/worldgen.js';

const K = { CS, H, SEA, B, BIOME };
const hashChunk = (c) => createHash('sha256').update(c.blocks).update(c.biomes).update(c.heights)
  .update(JSON.stringify(c.features)).digest('hex').slice(0, 16);
const GOLDEN = [[0, 0, '5167c1324e58d98e'], [5, -3, '399824d31c76a83c'], [-12, 7, '6e67986199e49b29']];

test('the same seed gives the same chunk bytes twice', () => {
  const a = WorldGenModule(12345, K).generateChunk(3, 4), b = WorldGenModule(12345, K).generateChunk(3, 4);
  assert.equal(hashChunk(a), hashChunk(b));
  assert.equal(a.blocks.length, CS * CS * H);
});

test('an instance built from WorldGenModule.toString() gives the same chunk', () => {
  // The worker runs this text alone, so it must not reference anything outside its body.
  const Copy = new Function(`return ${WorldGenModule.toString()}`)();
  assert.equal(hashChunk(Copy(12345, K).generateChunk(-2, 9)), hashChunk(WorldGenModule(12345, K).generateChunk(-2, 9)));
});

for (const [cx, cz, want] of GOLDEN) {
  test(`chunk ${cx}, ${cz} matches its golden hash`, () => {
    assert.equal(hashChunk(WorldGenModule(12345, K).generateChunk(cx, cz)), want);
  });
}
