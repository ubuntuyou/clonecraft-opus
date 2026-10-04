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
    const info = {}, c = W.generateChunk(cx, cz, 'overworld', info), D = info.dungeon;
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

// SPEC_realms: the realm generators. Ember is Phase 2. Crystal is Phase 5.
test('realms: deterministic, equal in a worker copy, and the overworld unchanged by the realm argument', () => {
  const Copy = new Function(`return ${WorldGenModule.toString()}`)();
  const a = WorldGenModule(12345, K), b = Copy(12345, K), a2 = WorldGenModule(12345, K);
  for (const realm of ['ember', 'crystal']) for (const [cx, cz] of [[0, 0], [2, -1], [-3, 2], [9, 9], [-40, 27]]) {
    const h = hashChunk(a.generateChunk(cx, cz, realm));
    assert.equal(h, hashChunk(b.generateChunk(cx, cz, realm)), `${realm} ${cx},${cz}: worker copy`);
    assert.equal(h, hashChunk(a2.generateChunk(cx, cz, realm)), `${realm} ${cx},${cz}: second instance`);
  }
  assert.notEqual(hashChunk(a.generateChunk(0, 0, 'ember')), hashChunk(WorldGenModule(999, K).generateChunk(0, 0, 'ember')));
  assert.equal(hashChunk(a.generateChunk(5, -3, 'overworld')), GOLDEN[1][2]);
  assert.notEqual(hashChunk(a.generateChunk(0, 0, 'crystal')), hashChunk(WorldGenModule(999, K).generateChunk(0, 0, 'crystal')));
});

// Crystal Realm terrain over 25 x 25 chunks (gate Phase 5, items 4 and 5).
test('crystal: nothing below y 20, the 72-block clearance, the arena, the arrival portal, moss, clusters, and tapers', () => {
  const W = WorldGenModule(12345, K), R = 12, A = W.CRYSTAL_ARRIVAL;
  const cols = new Map();   // "wx,wz" -> the column's ids, for the support and taper checks
  let isleCells = 0, up = 0, down = 0;
  for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
    const c = W.generateChunk(cx, cz, 'crystal');
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = cx * CS + x, wz = cz * CS + z, d = Math.hypot(wx, wz), col = [];
      for (let y = 0; y < H; y++) col.push(c.blocks[(y << 8) | (z << 4) | x]);
      if (!col.some((id) => id !== B.AIR)) continue;
      cols.set(`${wx},${wz}`, col);
      for (let y = 0; y < 20; y++) assert.equal(col[y], B.AIR, `${wx},${y},${wz}: below y 20`);
      assert.ok(d <= W.ARENA_R || d > W.ISLE_CLEAR, `${wx},${wz}: a block at ${d.toFixed(1)} from the origin`);
      if (d > W.ISLE_CLEAR) isleCells++;
      for (let y = 21; y < H - 1; y++) {
        if (col[y] === B.CRYSTAL) { up++; assert.equal(col[y - 1], B.GLIMMER_MOSS, `${wx},${y},${wz}: a top cluster stands on moss`); }
        if (col[y] === B.CRYSTAL + 1) { down++; assert.equal(col[y + 1], B.VOIDSTONE, `${wx},${y},${wz}: a hanging cluster hangs from voidstone`); }
        // every exposed island top is moss (the arena's ring, pad, and portal excepted)
        if (col[y] === B.VOIDSTONE && col[y + 1] === B.AIR && d > W.ARENA_R) assert.fail(`${wx},${y},${wz}: a bare top`);
      }
      if (d > W.ISLE_CLEAR) {
        const top = col.findLastIndex((id) => id === B.GLIMMER_MOSS);
        if (top >= 0) assert.ok(top >= 70 && top <= 110, `${wx},${wz}: top y ${top}`);
      }
    }
  }
  assert.ok(isleCells > 2000, `islands beyond the clearance: ${isleCells} columns`);
  assert.ok(up > 20 && down > 50, `clusters: ${up} on tops, ${down} hanging`);
  // the arena: a flat moss top at y 96 within radius 40, and an underside that tapers
  const thick = (wx, wz) => 96 - cols.get(`${wx},${wz}`).findIndex((id) => id === B.VOIDSTONE);
  for (const [wx, wz] of [[0, 0], [30, 5], [-12, -35], [20, -20]]) {
    const col = cols.get(`${wx},${wz}`);
    assert.equal(col[96], B.GLIMMER_MOSS, `${wx},${wz}: arena top`);
    assert.equal(col[97], B.AIR);
  }
  assert.ok(thick(0, 0) > 30 && thick(0, 0) > 3 * thick(41, 0), `arena taper: ${thick(0, 0)} at the center, ${thick(41, 0)} at the rim`);
  // the arrival portal: a Crystal Frame ring with crystal panes, its bottom row in the floor
  for (let v = -1; v <= A.h; v++) for (let u = -1; u <= A.w; u++) {
    const ring = u === -1 || u === A.w || v === -1 || v === A.h;
    assert.equal(cols.get(`${A.x0 + u},${A.z0}`)[A.y0 + v], ring ? B.CRYSTAL_FRAME : B.PORTAL_CRYSTAL, `arrival ${u},${v}`);
  }
  assert.equal(A.y0, 97);
  // every island tapers: its center column is thicker than a column near its rim
  let checked = 0;
  for (let gz = -3; gz <= 3; gz++) for (let gx = -3; gx <= 3; gx++) {
    const i = W.isleAt(gx, gz);
    if (!i || i.r < 7) continue;
    const c = cols.get(`${Math.floor(i.x)},${Math.floor(i.z)}`);
    if (!c) continue;
    const span = (col) => col.findLastIndex((id) => id === B.VOIDSTONE || id === B.GLIMMER_MOSS) - col.findIndex((id) => id === B.VOIDSTONE);
    const rim = cols.get(`${Math.floor(i.x + i.r * 0.8)},${Math.floor(i.z)}`);
    if (rim) assert.ok(span(c) > span(rim), `island ${gx},${gz}: center ${span(c)}, rim ${span(rim)}`);
    assert.ok(span(c) >= i.r, `island ${gx},${gz}: depth ${span(c)} for radius ${i.r.toFixed(1)}`);
    checked++;
  }
  assert.ok(checked >= 5, `islands checked: ${checked}`);
});

// Ember Realm terrain over 17 x 17 = 289 chunks (gate Phase 2, items 2 and 3).
test('ember: bedrock shell, roof bumps to y 116, lava sea, the 4 blocks, and the Emberite vein rate', () => {
  const W = WorldGenModule(12345, K), R = 8, N = (2 * R + 1) ** 2;
  const count = {}, ore = new Map(), lamps = [];
  let lowestRoof = H, open = 0, openLow = 0, lavaHigh = 0;
  for (let cz = -R; cz <= R; cz++) for (let cx = -R; cx <= R; cx++) {
    const c = W.generateChunk(cx, cz, 'ember'), where = `chunk ${cx}, ${cz}`;
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const id = (y) => c.blocks[(y << 8) | (z << 4) | x];
      assert.equal(id(0), B.BEDROCK, `${where}: y 0`);
      for (let y = 124; y < H; y++) assert.equal(id(y), B.BEDROCK, `${where}: roof at y ${y}`);
      let roof = 124;
      while (id(roof - 1) === B.BEDROCK) roof--;
      assert.ok(roof >= 116, `${where}: the roof hangs below y 116`);
      lowestRoof = Math.min(lowestRoof, roof);
      for (let y = 1; y < roof; y++) {
        const b = id(y);
        assert.notEqual(b, B.BEDROCK, `${where}: bedrock inside at y ${y}`);
        count[b] = (count[b] || 0) + 1;
        if (b === B.AIR) { open++; if (y <= 31) openLow++; }
        if (b === B.LAVA && y > 31) lavaHigh++;
        if (b === B.EMBERITE_ORE) {
          assert.ok(y >= 8 && y <= 110, `${where}: Emberite at y ${y}`);
          ore.set(`${cx * CS + x},${y},${cz * CS + z}`, 1);
        }
        if (b === B.EMBER_LAMP) lamps.push([id(y + 1), y]);
      }
    }
  }
  assert.equal(lowestRoof, 116, 'some roof bump reaches y 116');
  assert.equal(openLow, 0, 'every open cell at y 31 and below holds lava');
  assert.equal(lavaHigh, 0, 'no lava above y 31');
  assert.ok(count[B.LAVA] > N * 256, 'a lava sea: more than 1 lava cell per column');
  assert.ok(open > N * CS * CS * 40, 'a large cave world: more than 40 open cells per column');
  for (const id of [B.EMBER_ROCK, B.ASH_SAND, B.EMBER_LAMP, B.EMBERITE_ORE]) assert.ok(count[id] > 0, `block ${id} generates`);
  assert.ok(count[B.EMBER_ROCK] > count[B.ASH_SAND] * 20, 'Ember Rock is the main rock');
  assert.equal(count[B.STONE] || 0, 0, 'no overworld stone');
  // A lamp hangs: from rock, bedrock, another lamp, or a fortress brick (Phase 4 stamps after the lamps).
  for (const [up, y] of lamps) assert.ok([B.EMBER_ROCK, B.BEDROCK, B.EMBER_LAMP, B.EMBER_BRICKS].includes(up), `a lamp at y ${y} hangs from ${up}`);
  // Emberite veins: 6-connected groups of ore cells.
  const veins = [];
  for (const k of ore.keys()) {
    if (ore.get(k) !== 1) continue;
    let size = 0;
    const q = [k];
    ore.set(k, 2);
    while (q.length) {
      const [x, y, z] = q.pop().split(',').map(Number);
      size++;
      for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const n = `${x + dx},${y + dy},${z + dz}`;
        if (ore.get(n) === 1) { ore.set(n, 2); q.push(n); }
      }
    }
    veins.push(size);
  }
  const rate = veins.length / N;
  assert.ok(rate >= 0.35 && rate <= 0.65, `about 1 vein per 2 chunks: ${rate.toFixed(2)}`);
  assert.ok(veins.filter((s) => s > 3).length <= veins.length * 0.03, `veins of 1 to 3: ${veins.filter((s) => s > 3)}`);
});
