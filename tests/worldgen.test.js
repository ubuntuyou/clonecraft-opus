// World generation tests (SPEC_modules.md, T14).
// The golden hashes come from the baseline WorldGenModule (git tag baseline-single-file), seed 12345.
// A changed hash means the terrain changed. Old saves store only edits, so they would load on new terrain.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { CS, H, SEA } from '../src/config.js';
import { B, OPAQUE, SOLID } from '../src/blocks.js';
import { BIOME } from '../src/biomes.js';
import { WorldGenModule } from '../src/worldgen.js';

const K = { CS, H, SEA, B, BIOME };
const hashChunk = (c) => createHash('sha256').update(c.blocks).update(c.biomes).update(c.heights)
  .update(JSON.stringify(c.features)).digest('hex').slice(0, 16);
// Chunk -12, 7 changed on 2026-10-02: its old one-room dungeon had an open cell under the floor, and the
// multi-room dungeon (SPEC_expansion.md) builds none there. Every changed cell lay inside the old room.
const GOLDEN = [[0, 0, '5167c1324e58d98e'], [5, -3, '399824d31c76a83c'], [-12, 7, '2ad42521a1e65d63']];

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

// Multi-room dungeons (SPEC_expansion.md, 2026-10-02). The first 30 dungeons of seed 12345.
test('dungeons: 2 to 4 rooms, solid ground under every floor, 1 spawner, supported ladders, a walkable way', () => {
  const W = WorldGenModule(12345, K), DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const at = (x, y, z) => (y << 8) | (z << 4) | x;
  const soft = (id) => id === B.AIR || id === B.WATER || (id >= B.WATER_FLOW && id <= B.LAVA_FLOW + 6);
  const isLadder = (id) => id >= B.LADDER && id < B.LADDER + 4;
  const kinds = new Set();
  let found = 0;
  for (let r = 0; found < 30 && r < 40; r++) for (let cz = -r; cz <= r; cz++) for (let cx = -r; cx <= r; cx++) {
    if (found >= 30 || Math.max(Math.abs(cx), Math.abs(cz)) !== r || !W.dungeonPlan(cx, cz)) continue;
    const info = {}, c = W.generateChunk(cx, cz, info), D = info.dungeon;
    if (!D) continue;
    found++;
    const g = (x, y, z) => (x < 0 || x >= CS || z < 0 || z >= CS ? B.STONE : c.blocks[at(x, y, z)]);
    const where = `chunk ${cx}, ${cz}`;
    assert.ok(D.rooms.length >= 2 && D.rooms.length <= 4, `${where}: room count`);
    D.rooms.forEach((R, k) => {
      if (k) { const drop = D.rooms[k - 1].y - R.y; assert.ok(drop >= 5 && drop <= 9, `${where}: drop ${drop}`); }
      const shaft = D.links[k] && D.links[k].kind === 'ladder' ? D.links[k].bottom[0] : null;
      for (let z = R.p[1]; z < R.p[1] + R.s[1]; z++) for (let x = R.p[0]; x < R.p[0] + R.s[0]; x++) {
        if (shaft && shaft[0] === x && shaft[1] === z) continue;
        assert.ok(!soft(g(x, R.y - 1, z)), `${where}: room ${k} has an open cell under its floor at ${x}, ${z}`);
      }
    });
    assert.equal(c.features.filter((f) => f.kind === 'spawner').length, 1, `${where}: spawner count`);
    const region = new Set();
    for (const R of D.rooms) for (let y = R.y + 1; y <= R.y + 3; y++) for (let z = R.p[1] + 1; z < R.p[1] + R.s[1] - 1; z++) for (let x = R.p[0] + 1; x < R.p[0] + R.s[0] - 1; x++) region.add(at(x, y, z));
    for (const L of D.links) {
      kinds.add(L.kind);
      for (const [x, y, z, id] of L.cells) {
        region.add(at(x, y, z));
        if (isLadder(id)) { const [dx, dz] = DIR[id - B.LADDER]; assert.ok(OPAQUE[g(x - dx, y, z - dz)], `${where}: ladder without a wall`); }
      }
    }
    // Walk inside the dungeon only: walk, fall, climb a ladder, and step up 1 onto a bottom stair whose
    // tall half points the way of the step (half a block twice). The walk never jumps.
    const pass = (x, y, z) => !SOLID[g(x, y, z)];
    const stepUp = (x, y, z, dx, dz) => { const s = g(x, y, z) - B.STAIRS_COBBLE; return s >= 0 && s < 4 && DIR[s][0] === dx && DIR[s][1] === dz; };
    const stands = (x, y, z) => pass(x, y, z) && pass(x, y + 1, z) && (SOLID[g(x, y - 1, z)] || isLadder(g(x, y, z)));
    const settle = (x, y, z) => { while (!stands(x, y, z)) { if (!pass(x, y - 1, z) || y < 2) return null; y--; } return [x, y, z]; };
    const walk = (start) => {
      const seen = new Set([at(...start)]), q = [start];
      while (q.length) {
        const [x, y, z] = q.pop(), next = [];
        for (const [dx, dz] of DIR) {
          const nx = x + dx, nz = z + dz;
          if (pass(nx, y, nz) && pass(nx, y + 1, nz)) next.push(settle(nx, y, nz));
          else if (stepUp(nx, y, nz, dx, dz) && pass(x, y + 2, z) && pass(nx, y + 1, nz) && pass(nx, y + 2, nz)) next.push([nx, y + 1, nz]);
        }
        if (isLadder(g(x, y, z)) && pass(x, y + 1, z) && pass(x, y + 2, z)) next.push([x, y + 1, z]);
        if (isLadder(g(x, y, z)) && pass(x, y - 1, z)) next.push(settle(x, y - 1, z));
        for (const p of next) if (p && region.has(at(...p)) && stands(...p) && !seen.has(at(...p))) { seen.add(at(...p)); q.push(p); }
      }
      return seen;
    };
    const floor = (R) => { for (let z = R.p[1] + 1; z < R.p[1] + R.s[1] - 1; z++) for (let x = R.p[0] + 1; x < R.p[0] + R.s[0] - 1; x++) if (stands(x, R.y + 1, z)) return [x, R.y + 1, z]; return null; };
    const top = floor(D.rooms[0]), down = walk(top);
    for (const R of D.rooms) assert.ok(down.has(at(...floor(R))), `${where}: a room is out of reach from the top room`);
    assert.ok(walk(floor(D.rooms[D.rooms.length - 1])).has(at(...top)), `${where}: no way back up`);
  }
  assert.equal(found, 30);
  assert.deepEqual([...kinds].sort(), ['ladder', 'stairs']);
});
