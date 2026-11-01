// SPEC_deepen M6 and M8: World loads in Node with a recorder mesh adapter in place of three.js.
// T6.2 writes the M6-1..M6-14 cases. The helpers below are the S6 contract fakes.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CONFIG } from '../src/config.js';
import { ckey, CS, H, lidx, LIGHT_BLK, LIGHT_SKY, lightCurve } from '../src/config.js';
import { B, EMIT, EMIT_CRY, OPAQUE } from '../src/blocks.js';
import { World } from '../src/world.js';
import { WG } from '../src/gen-service.js';
import { depcheck, PURE } from '../tools/depcheck.js';

// The recorder mesh adapter: it logs each call as [op, chunk key, visible?] and keeps the
// handle rules of chunkMeshes (build sets opaqueMesh, dispose nulls both handles).
export function recorder() {
  const log = [];
  const meshes = {
    log,
    build(world, chunk) { log.push(['build', chunk.key]); chunk.opaqueMesh = chunk.opaqueMesh || { key: chunk.key, visible: true }; },
    dispose(chunk) { log.push(['dispose', chunk.key]); chunk.opaqueMesh = chunk.waterMesh = null; },
    show(chunk, visible) { log.push(['show', chunk.key, visible]); if (chunk.opaqueMesh) chunk.opaqueMesh.visible = visible; },
    count(op) { return log.filter((e) => e[0] === op).length; },
    clear() { log.length = 0; },
  };
  return meshes;
}

// A World with render distance `rd` and a recorder adapter. Returns { world, meshes }.
export function makeWorld(rd = 3) {
  CONFIG.renderDistance = rd;
  const meshes = recorder();
  return { world: new World(meshes), meshes };
}

// Streams the chunks around block (x, z) until readyAround(x, z, r) is 1 or `frames` run out.
// GenService has no Worker in Node, so it generates on the main thread. Returns the frame count.
export function streamUntilReady(world, x, z, r, frames = 400) {
  const camDir = { x: 0, z: -1 };
  for (let i = 0; i < frames; i++) {
    world.update(x, z, camDir, 1e9);
    if (world.readyAround(x, z, r) === 1) return i + 1;
  }
  throw new Error(`the chunks around (${x}, ${z}) did not mesh in ${frames} frames`);
}

// ---------------------------------------------------------------------------------------------
// M6 and batched acceptance tests (SPEC_deepen Part 3). Each test builds its own world.
// Tests that read the K1 light curves stay red until T6.1 lands brightnessAt.

const CAM = { x: 0, z: -1 };
const quiet = (fn) => { const w = console.warn; console.warn = () => {}; try { return fn(); } finally { console.warn = w; } };   // GenService warns once: no Worker in Node
const create = (rd = 3) => quiet(() => makeWorld(rd));
// A world streamed until the chunks within 3 of block (8, 8) are meshed. The recorder log starts empty.
function fresh(rd = 3) {
  const { world, meshes } = create(rd);
  streamUntilReady(world, 8, 8, 3);
  meshes.clear();
  return { world, meshes };
}
const frame = (world, x = 8, z = 8, budget = 1e9) => world.update(x, z, CAM, budget);
const topY = (world, x, z) => world.chunkAt(x, z).heights[(z & 15) * CS + (x & 15)];
// An air cell above every column within `r` blocks of (x, z).
const skyY = (world, x, z, r = 2) => {
  let m = 0;
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) m = Math.max(m, topY(world, x + dx, z + dz));
  return m + 4;
};
const builtKeys = (meshes) => meshes.log.filter((e) => e[0] === 'build').map((e) => e[1]);
const dirtyChunks = (world) => [...world.chunks.values()].filter((c) => c.dirty);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);
// Opaque cells that emit no light hold no light in any channel, so brightnessAt reads only the floors there.
function darkCell(world) {
  for (const c of world.chunks.values()) {
    for (let y = 2; y < 40; y++) for (let i = 0; i < 256; i += 17) {
      const b = c.blocks[(y << 8) | i];
      if (OPAQUE[b] && !EMIT[b] && !EMIT_CRY[b]) return [c.cx * CS + (i & 15), y, c.cz * CS + (i >> 4)];
    }
  }
  throw new Error('no dark cell found');
}
const emptyMaps = () => [new Map(), new Map()];

test('M6-1 world.js loads in Node and joins PURE with no upward import', () => {
  assert.ok(PURE.includes('world'), 'world is listed in depcheck PURE');
  assert.equal(typeof World, 'function');
  assert.deepEqual(depcheck('src'), [], 'depcheck passes on the real src/');
  const imports = [...readFileSync('src/world.js', 'utf8').matchAll(/^import .* from '\.\/([\w-]+)\.js';/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ['blocks', 'config', 'gen-service'], 'world.js imports only config, blocks, and gen-service');
});

test('M6-1 depcheck fires when world.js reaches order.js', () => {
  const dir = mkdtempSync(join(tmpdir(), 'world-pure-'));
  try {
    cpSync('src', dir, { recursive: true });
    const p = join(dir, 'world.js');
    writeFileSync(p, "import { mobs } from './order.js';\n" + readFileSync(p, 'utf8'));
    const errors = depcheck(dir);
    assert.ok(errors.includes('pure: world.js reaches order.js'), `expected the world pure error, got: ${errors.slice(0, 3).join(' | ') || 'none'}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('M6-2 streaming lights and meshes the chunks around the player', () => {
  const { world, meshes } = create();
  const loaded = [], early = [];
  world.onChunkLoaded = (c) => loaded.push(c.key);
  const build = meshes.build;
  meshes.build = (w, c) => {   // a chunk may build only when it and its 8 neighbors are lit
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) {
      const n = w.getChunk(c.cx + ox, c.cz + oz);
      if (!n || !n.lit) early.push(`${c.key} built before ${c.cx + ox},${c.cz + oz} was lit`);
    }
    build(w, c);
  };
  assert.equal(world.readyAround(8, 8, 3), 0, 'nothing is meshed before the first frame');
  streamUntilReady(world, 8, 8, 3);
  assert.deepEqual(early, []);
  assert.equal(world.readyAround(8, 8, 3), 1);
  const meshed = [...world.chunks.values()].filter((c) => c.meshed);
  assert.ok(meshed.length >= 29, `chunks within radius 3 are meshed (${meshed.length})`);
  for (const c of meshed) {
    for (let oz = -1; oz <= 1; oz++) for (let ox = -1; ox <= 1; ox++) assert.ok(world.getChunk(c.cx + ox, c.cz + oz)?.lit, `chunk ${c.key} has a lit neighbor ${ox},${oz}`);
  }
  const lit = [...world.chunks.values()].filter((c) => c.lit).map((c) => c.key);
  assert.deepEqual([...loaded].sort(), [...lit].sort(), 'onChunkLoaded runs once per lit chunk');
  assert.equal(world.stats.lit, lit.length);
  const keys = builtKeys(meshes);
  assert.equal(new Set(keys).size, keys.length, 'one build per first mesh');
  assert.deepEqual([...keys].sort(), meshed.map((c) => c.key).sort());
  assert.equal(world.stats.meshed, meshed.length);
});

test('M6-2 lighting goes nearest first', () => {
  const { world } = create();
  const loaded = [];
  world.onChunkLoaded = (c) => loaded.push(c.key);
  frame(world, 8, 8, 0);   // a zero budget lights the nearest chunk, then stops
  assert.ok(world.getChunk(0, 0)?.lit, 'the chunk under the player is lit first');
  assert.equal(loaded[0], ckey(0, 0));
});

test('M6-2 a chunk shows inside RD+0.5 and hides beyond', () => {
  const { world, meshes } = create();
  streamUntilReady(world, 8, 8, 3);
  const last = new Map();
  for (const [op, key, visible] of meshes.log) if (op === 'show') last.set(key, visible);
  const R2 = 3.5 * 3.5;
  let inside = 0, outside = 0;
  for (const c of world.chunks.values()) {
    if (!last.has(c.key)) continue;
    const want = c.cx * c.cx + c.cz * c.cz <= R2;
    assert.equal(last.get(c.key), want, `chunk ${c.key} visibility`);
    want ? inside++ : outside++;
  }
  assert.ok(inside > 0 && outside > 0, `both sides of the radius occur (${inside} in, ${outside} out)`);
});

test('M6-3 an override above the generated top shows in getBlock and heights', () => {
  const { world } = create();
  const y = H - 20, i = lidx(8, y, 8);
  world.overrides.set(`8,${y},8`, B.STONE);
  world.overridesByChunk.set(ckey(0, 0), new Map([[i, B.STONE]]));
  streamUntilReady(world, 8, 8, 3);
  assert.equal(world.getBlock(8, y, 8), B.STONE);
  assert.equal(world.getChunk(0, 0).heights[8 * CS + 8], y);
  assert.equal(world.getBlock(9, y, 8), B.AIR, 'a neighbor stays air');
});

test('M6-4 a torch lights its cell and the next chunk, and removal clears the light', () => {
  const { world, meshes } = fresh();
  const x = 15, z = 8, y = Math.max(topY(world, 14, z), topY(world, 15, z), topY(world, 16, z), topY(world, 17, z)) + 3;
  assert.equal(world.getBlk(x, y, z), 0, 'the cell starts dark');
  assert.ok(world.setBlock(x, y, z, B.TORCH));
  assert.equal(world.getBlk(x, y, z), 15);
  assert.equal(world.getBlk(x + 1, y, z), 14, 'one step across the chunk border');
  assert.equal(world.getBlk(x - 1, y, z), 14);
  assert.equal(world.getBlk(x + 3, y, z), 12);
  const keys = new Set(builtKeys(meshes));
  assert.ok(keys.has(ckey(0, 0)) && keys.has(ckey(1, 0)), `both chunks rebuild (${[...keys]})`);
  assert.ok(world.setBlock(x, y, z, B.AIR));
  for (let dx = -4; dx <= 4; dx++) assert.equal(world.getBlk(x + dx, y, z), 0, `light at dx ${dx} clears`);
});

test('M6-5 a block above lowers sky light, removal restores it, a stair passes none down', () => {
  const { world } = fresh();
  const x = 8, z = 8, y = skyY(world, x, z);
  assert.equal(world.getSky(x, y, z), 15);
  assert.ok(world.setBlock(x, y + 2, z, B.STONE));
  assert.ok(world.getSky(x, y, z) < 15, `sky under a block is ${world.getSky(x, y, z)}`);
  assert.ok(world.setBlock(x, y + 2, z, B.AIR));
  assert.equal(world.getSky(x, y, z), 15, 'removal restores 15');
  // A shaft: walls on four sides and below, then a stair on top. The stair takes light from its sides but passes none down.
  for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, -1, 0]]) world.setBlock(x + dx, y + dy, z + dz, B.STONE);
  assert.equal(world.getSky(x, y, z), 15, 'the open shaft still gets 15 from above');
  assert.ok(world.setBlock(x, y + 1, z, B.STAIRS_COBBLE));
  assert.ok(world.getSky(x, y + 1, z) > 0, 'the stair cell takes light');
  assert.equal(world.getSky(x, y, z), 0, 'the shaft below the stair is dark');
  assert.ok(world.setBlock(x, y + 1, z, B.AIR));
  assert.equal(world.getSky(x, y, z), 15, 'removing the stair restores 15');
});

test('M6-6 setBlock refuses y -1, y H, a locked cell, an unloaded cell, an unlit chunk, and the same id', () => {
  const { world } = fresh();
  const x = 8, z = 8, y = skyY(world, x, z);
  assert.equal(world.setBlock(x, -1, z, B.STONE), false);
  assert.equal(world.setBlock(x, H, z, B.STONE), false);
  assert.equal(world.setBlock(100000, y, z, B.STONE), false, 'unloaded');
  assert.equal(world.setBlock(x, y, z, B.AIR), false, 'the same id');
  assert.equal(world.editSerial, undefined, 'a refused edit does not bump editSerial');
  world.locked = (lx, ly, lz) => lx === x && ly === y && lz === z;
  assert.equal(world.setBlock(x, y, z, B.STONE), false, 'locked');
  assert.equal(world.getBlock(x, y, z), B.AIR);
  assert.equal(world.overrides.size, 0, 'a refused edit leaves no override');
  world.locked = null;
  assert.equal(world.setBlock(x, y, z, B.STONE), true, 'unlocked again');
  const unlit = quiet(() => create().world);
  unlit.onChunkData(0, 0, WG.generateChunk(0, 0, 'overworld'));
  assert.equal(unlit.getChunk(0, 0).lit, false);
  assert.equal(unlit.setBlock(8, 60, 8, B.STONE), false, 'an unlit chunk');
});

test('M6-6 onEdit gets (x, y, z, old, new) after the relight and the remesh', () => {
  const { world, meshes } = fresh();
  const x = 8, z = 8, y = skyY(world, x, z);
  const calls = [];
  world.onEdit = (...args) => calls.push({ args, blk: world.getBlk(x, y, z), builds: meshes.count('build'), serial: world.editSerial });
  assert.ok(world.setBlock(x, y, z, B.TORCH));
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args, [x, y, z, B.AIR, B.TORCH]);
  assert.equal(calls[0].blk, 15, 'the relight ran first');
  assert.ok(calls[0].builds > 0, 'the remesh ran first');
  assert.equal(calls[0].serial, 1, 'editSerial is bumped');
  world.setBlock(x, y, z, B.AIR);
  assert.deepEqual(calls[1].args, [x, y, z, B.TORCH, B.AIR]);
  assert.equal(world.setBlock(x, y, z, B.AIR), false);
  assert.equal(calls.length, 2, 'a refused edit does not call onEdit');
  assert.deepEqual([...world.overrides], [[`${x},${y},${z}`, B.AIR]]);
  assert.equal(world.overridesByChunk.get(ckey(0, 0)).get(lidx(x & 15, y, z & 15)), B.AIR);
});

test('M6-7 extraLight feeds brightnessAt; null gives the 0.04 floor', () => {
  const { world } = fresh();
  const [x, y, z] = darkCell(world);
  assert.equal(world.extraLight, null, 'the slot starts empty');
  near(world.brightnessAt(x, y, z, 1), 0.04);
  const seen = [];
  world.extraLight = (...a) => { seen.push(a); return 14; };
  near(world.brightnessAt(x, y, z, 1), lightCurve(14, LIGHT_BLK));
  assert.deepEqual(seen, [[x, y, z]]);
  world.extraLight = null;
  near(world.brightnessAt(x, y, z, 1), 0.04);
});

test('M6-8 reset unloads every chunk with the old realm, disposes each once, and drops an old-epoch result', () => {
  const { world, meshes } = fresh();
  const before = [...world.chunks.values()], meshedKeys = before.filter((c) => c.meshed).map((c) => c.key);
  const seen = [];
  world.onChunkUnloaded = (c) => seen.push([c.key, world.realm, world.chunks.has(c.key)]);
  const oldEpoch = world.gen.epoch;
  const [ov, ovc] = emptyMaps();
  world.reset('ember', ov, ovc, true, 9);
  assert.equal(world.chunks.size, 0);
  assert.equal(seen.length, before.length);
  assert.ok(seen.every(([, realm]) => realm === 'overworld'), 'the hook sees the old realm');
  assert.ok(seen.every(([, , has]) => !has), 'the chunk leaves the map before the hook runs');
  assert.equal(world.realm, 'ember');
  assert.equal(world.overrides, ov);
  assert.equal(world.overridesByChunk, ovc);
  assert.equal(world.voidBelow, true);
  assert.equal(world.ambient, 9);
  const disposed = meshes.log.filter((e) => e[0] === 'dispose').map((e) => e[1]);
  assert.equal(new Set(disposed).size, disposed.length, 'no chunk disposes twice');
  for (const k of meshedKeys) assert.ok(disposed.includes(k), `meshed chunk ${k} is disposed`);
  assert.equal(disposed.length, before.length);
  assert.ok(before.every((c) => c.opaqueMesh === null && c.waterMesh === null), 'the handles are nulled');
  // A result from the old epoch never reaches the world.
  assert.ok(world.gen.epoch > oldEpoch);
  world.gen.request(40, 40);
  const stale = WG.generateChunk(40, 40, 'overworld');
  world.gen._done({ busy: 1 }, { cx: 40, cz: 40, epoch: oldEpoch, blocks: stale.blocks, biomes: stale.biomes, heights: stale.heights, features: stale.features });
  assert.equal(world.getChunk(40, 40), undefined, 'the old-epoch chunk is dropped');
  assert.equal(world.gen.pending.has(ckey(40, 40)), true, 'the request stays pending');
});

test('M6-8 reset clears the touched set, the batch, and the request cache', () => {
  const { world } = fresh();
  world.batch = new Set([world.getChunk(0, 0)]);
  world.touched.add(world.getChunk(0, 0));
  world.reset('overworld', ...emptyMaps(), false, 0);
  assert.equal(world.batch, null);
  assert.equal(world.touched.size, 0);
  assert.equal(world.center, null);
  assert.equal(world.lastRequest.cx, 1e9);
  streamUntilReady(world, 8, 8, 3);   // the next update requests the chunks around the player again
  assert.equal(world.readyAround(8, 8, 3), 1);
});

test('M6-9 a center move of RD+4 unloads and disposes the old chunks', () => {
  const { world, meshes } = fresh();
  const RD = CONFIG.renderDistance, before = [...world.chunks.values()];
  const far = before.filter((c) => Math.abs(c.cx - (RD + 4)) > RD + 3), kept = before.filter((c) => Math.abs(c.cx - (RD + 4)) <= RD + 3);
  assert.ok(far.length > 0 && kept.length > 0);
  frame(world, 8 + 16 * (RD + 4), 8);
  for (const c of far) assert.equal(world.getChunk(c.cx, c.cz), undefined, `chunk ${c.key} unloads`);
  for (const c of kept) assert.equal(world.getChunk(c.cx, c.cz), c, `chunk ${c.key} stays`);
  const disposed = meshes.log.filter((e) => e[0] === 'dispose').map((e) => e[1]).sort();
  assert.deepEqual(disposed, far.map((c) => c.key).sort(), 'exactly the unloaded chunks dispose, once each');
});

test('M6-9 update requests RD+1 and cancels unsent work beyond RD+2', () => {
  const { world } = create();
  const RD = CONFIG.renderDistance, R = RD + 1;
  frame(world, 8, 8);
  for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
    assert.ok(world.chunks.has(ckey(dx, dz)) || world.gen.pending.has(ckey(dx, dz)), `chunk ${dx},${dz} is requested`);
  }
  assert.ok(world.gen.pending.size > 0, 'some work is still pending');
  frame(world, 8 + 16 * 30, 8);
  for (const p of world.gen.pending.values()) assert.ok(Math.max(Math.abs(p.cx - 30), Math.abs(p.cz)) <= RD + 2, `pending ${p.cx},${p.cz} is within RD+2 of the new center`);
});

test('M6-10 an Ember dark cell reads the realm ambient on the block curve', () => {
  const { world } = create();
  world.reset('ember', ...emptyMaps(), false, 9);
  streamUntilReady(world, 8, 8, 3);
  assert.equal(world.realm, 'ember');
  const [x, y, z] = darkCell(world);
  near(world.brightnessAt(x, y, z, 1), lightCurve(9, LIGHT_BLK));
  near(world.brightnessAt(x, y, z, 0), lightCurve(9, LIGHT_BLK), 1e-9);
});

test('M6-11 batched builds nothing inside and once per chunk after', () => {
  const { world, meshes } = fresh();
  const y = skyY(world, 8, 8, 6);
  const edits = [[6, y, 8], [7, y, 8], [8, y, 8], [24, y, 8], [25, y, 8]];   // three in chunk 0,0 and two in 1,0
  let inside = -1;
  world.batched(() => {
    for (const [x, ey, z] of edits) assert.ok(world.setBlock(x, ey, z, B.STONE));
    inside = meshes.count('build');
  });
  assert.equal(inside, 0, 'nothing builds inside the batch');
  const keys = builtKeys(meshes);
  assert.equal(new Set(keys).size, keys.length, 'each chunk builds once');
  assert.ok(keys.includes(ckey(0, 0)) && keys.includes(ckey(1, 0)));
  assert.deepEqual(dirtyChunks(world), [], 'no chunk stays dirty');
  assert.equal(world.batch, null);
  // The control: without a batch the same edits build the chunk once per edit.
  meshes.clear();
  for (const [x, ey, z] of edits) world.setBlock(x, ey + 1, z, B.STONE);
  assert.ok(meshes.count('build') > keys.length, `unbatched edits build more (${meshes.count('build')} vs ${keys.length})`);
});

test('M6-12 a nested batched joins the outer batch; only the outer end builds', () => {
  const { world, meshes } = fresh();
  const y = skyY(world, 8, 8, 6);
  const marks = [];
  world.batched(() => {
    world.setBlock(6, y, 8, B.STONE);
    world.batched(() => {
      world.setBlock(7, y, 8, B.STONE);
      world.setBlock(24, y, 8, B.STONE);
      marks.push(meshes.count('build'));
    });
    marks.push(meshes.count('build'), world.batch instanceof Set);
    world.setBlock(8, y, 8, B.STONE);
  });
  assert.deepEqual(marks, [0, 0, true], 'the inner end builds nothing and the batch stays open');
  const keys = builtKeys(meshes);
  assert.ok(keys.length >= 2);
  assert.equal(new Set(keys).size, keys.length, 'each chunk builds once');
  assert.deepEqual(dirtyChunks(world), []);
  assert.equal(world.batch, null);
});

test('M6-13 a throw inside batched still remeshes, nulls the batch, and rethrows', () => {
  const { world, meshes } = fresh();
  const y = skyY(world, 8, 8, 6);
  assert.throws(() => world.batched(() => { world.setBlock(7, y, 8, B.STONE); throw new Error('boom'); }), /boom/);
  assert.ok(builtKeys(meshes).includes(ckey(0, 0)), 'the touched chunk remeshes');
  assert.equal(world.batch, null);
  assert.deepEqual(dirtyChunks(world), []);
  meshes.clear();
  assert.throws(() => world.batched(() => { world.setBlock(6, y, 8, B.STONE); world.batched(() => { world.setBlock(24, y, 8, B.STONE); throw new Error('inner'); }); }), /inner/);
  const keys = builtKeys(meshes);
  assert.ok(keys.includes(ckey(0, 0)) && keys.includes(ckey(1, 0)));
  assert.equal(new Set(keys).size, keys.length, 'a nested throw builds each chunk once');
  assert.equal(world.batch, null);
  world.setBlock(9, y, 8, B.STONE);
  assert.ok(meshes.count('build') > keys.length, 'the next edit remeshes at once: the batch is closed');
});

test('M6-14 a reset inside batched builds no unloaded chunk', () => {
  const { world, meshes } = fresh();
  const y = skyY(world, 8, 8, 6);
  world.batched(() => {
    assert.ok(world.setBlock(7, y, 8, B.STONE));
    world.reset('ember', ...emptyMaps(), false, 9);
    assert.equal(world.batch, null, 'reset drops the set');
  });
  assert.equal(meshes.count('build'), 0, 'nothing builds after the reset');
  assert.equal(world.chunks.size, 0);
  assert.equal(world.batch, null);
});

test('M6-15 batched passes fn\'s return value through, nested or not', () => {
  const { world } = fresh();
  assert.equal(world.batched(() => 42), 42);
  assert.equal(world.batched(() => world.batched(() => 'inner') + '!'), 'inner!');
  assert.equal(world.batch, null);
  assert.equal(world.batched(() => undefined), undefined);
});

test('M6-16 outside a batch setBlock remeshes at once', () => {
  const { world, meshes } = fresh();
  const y = skyY(world, 8, 8);
  assert.equal(world.batch, null);
  assert.ok(world.setBlock(8, y, 8, B.STONE));
  assert.ok(builtKeys(meshes).includes(ckey(0, 0)));
  assert.equal(world.getChunk(0, 0).dirty, false);
});

test('M6-17 stats, pendingMeshes, gen.pending, center, and editSerial stay readable', () => {
  const { world } = create();
  frame(world, 8, 8);
  assert.deepEqual(world.center, { cx: 0, cz: 0 });
  for (const k of ['meshed', 'lit', 'meshMs', 'lightMs']) assert.equal(typeof world.stats[k], 'number', `stats.${k}`);
  assert.equal(typeof world.pendingMeshes, 'number');
  assert.ok(world.gen.pending instanceof Map);
  assert.equal(world.editSerial, undefined);
  streamUntilReady(world, 8, 8, 3);
  world.setBlock(8, skyY(world, 8, 8), 8, B.STONE);
  assert.equal(world.editSerial, 1);
});

test('K1-7 brightnessAt uses the normalized curves: block light, sky light, and the 0.04 floor', () => {
  const { world } = fresh();
  const x = 15, z = 8, y = skyY(world, x, z, 3);
  world.setBlock(x, y, z, B.TORCH);
  // Sky 15 scales by daylight; the torch cell has block 15 so it reads 1.
  near(world.brightnessAt(x, y, z, 1), 1);
  near(world.brightnessAt(x + 1, y, z, 0), lightCurve(14, LIGHT_BLK), 1e-9);   // night: block 14 beside the torch
  near(world.brightnessAt(x + 6, y, z, 0), lightCurve(9, LIGHT_BLK), 1e-9);
  // A sky-lit cell away from the torch: sky 15 at daylight 0.5 is level 7.5.
  const sx = 8, sz = 40;
  const sy = skyY(world, 8, 8, 3);
  near(world.brightnessAt(sx, sy, sz, 0.5), Math.max(0.04, lightCurve(7.5, LIGHT_SKY)), 1e-9);
  near(world.brightnessAt(sx, sy, sz, 0), 0.04);
  near(world.brightnessAt(sx, sy, sz, 1), 1);
  const [dx, dy, dz] = darkCell(world);
  near(world.brightnessAt(dx, dy, dz, 1), 0.04);
});
