// Ember content tests (SPEC_realms, Phase 4): the Emberite tier, its recipes, and the furnace entries.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ARMOR_PIECES, armorId, B, EMBERITE_ARMOR, FUEL, I, ITEMS, SMELT, TOOL_KINDS, toolId } from '../src/blocks.js';
import { matchRecipe } from '../src/crafting.js';

function grid(rows, key, size = 3) {
  const g = new Array(size * size).fill(null);
  rows.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== ' ') g[y * size + x] = { id: key[ch], count: 1 }; }));
  return g;
}
const out = (g, size = 3) => matchRecipe(g, size)?.out ?? null;

test('Emberite tools: ids 270..274, level 6, speed 11, durability 2400, spec damage', () => {
  const dmg = { pickaxe: 7, sword: 9, axe: 9, shovel: 6, hoe: 4 };
  Object.keys(TOOL_KINDS).forEach((type, k) => {
    const id = toolId(type, 8), it = ITEMS[id];
    assert.equal(id, 270 + k);
    assert.equal(it.name, `Emberite ${TOOL_KINDS[type].label}`);
    assert.equal(it.maxDur, 2400);
    assert.deepEqual(it.tool, { type, tier: 8, level: 6, speed: 11, damage: dmg[type], mat: 'emberite' });
  });
  assert.equal(ITEMS[I.BONE_MEAL].name, 'Bone Meal');   // tier 8 does not overwrite id 208
});
test('Emberite armor: ids 324..327, points 3/8/6/3, factor 40', () => {
  assert.equal(EMBERITE_ARMOR, 6);
  ARMOR_PIECES.forEach((p, piece) => {
    const it = ITEMS[armorId(EMBERITE_ARMOR, piece)];
    assert.equal(armorId(EMBERITE_ARMOR, piece), 324 + piece);
    assert.equal(it.armor.pts, [3, 8, 6, 3][piece]);
    assert.equal(it.maxDur, p.base * 40);
  });
});
test('every Emberite tool and armor piece crafts with the vanilla shape', () => {
  const k = { M: I.EMBERITE, S: I.STICK };
  assert.equal(out(grid(['MMM', ' S ', ' S '], k)), toolId('pickaxe', 8));
  assert.equal(out(grid(['M', 'M', 'S'], k)), toolId('sword', 8));
  assert.equal(out(grid(['MM', 'MS', ' S'], k)), toolId('axe', 8));
  assert.equal(out(grid(['M', 'S', 'S'], k)), toolId('shovel', 8));
  assert.equal(out(grid(['MM', ' S', ' S'], k)), toolId('hoe', 8));
  ARMOR_PIECES.forEach((p, piece) => assert.equal(out(grid(p.shape, k)), armorId(EMBERITE_ARMOR, piece)));
});
test('Raw Emberite smelts to an ingot; Ember Dust burns 60 s; 4 dust craft 1 lamp', () => {
  assert.equal(SMELT[I.RAW_EMBERITE], I.EMBERITE);
  assert.equal(FUEL[I.EMBER_DUST], 60);
  const r = matchRecipe(grid(['DD', 'DD'], { D: I.EMBER_DUST }, 2), 2);
  assert.equal(r.out, B.EMBER_LAMP);
  assert.equal(r.count, 1);
  assert.equal(ITEMS[I.EMBERITE].name, 'Emberite Ingot');
  assert.equal(ITEMS[I.EMBER_HEART].name, 'Ember Heart');
});

// ---- Ember Fortress (gate items 4, 5, 6, 7): the 25 fortresses of cells -2..2 of seed 12345.
import { CS, EMBER_SPAWN_LIGHT, EMBER_WEIGHTS, emberMobType, H, mulberry32, SEA } from '../src/config.js';
import { LIQ_KIND, SOLID } from '../src/blocks.js';
import { BIOME } from '../src/biomes.js';
import { WorldGenModule } from '../src/worldgen.js';
import { createHash } from 'node:crypto';

const K = { CS, H, SEA, B, BIOME };
const W = WorldGenModule(12345, K);
const chunks = new Map();
const chunk = (cx, cz) => {
  const k = `${cx},${cz}`;
  if (!chunks.has(k)) chunks.set(k, W.generateChunk(cx, cz, 'ember'));
  return chunks.get(k);
};
const get = (x, y, z) => (y < 0 || y >= H ? B.AIR : chunk(Math.floor(x / CS), Math.floor(z / CS)).blocks[(y << 8) | ((z & 15) << 4) | (x & 15)]);
const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const cell = (P, b, t, w) => { const [ux, uz] = D4[b.d]; return [P.kx + ux * (7 + t) - uz * w, P.kz + uz * (7 + t) + ux * w]; };
const plans = [];
for (let gz = -2; gz <= 2; gz++) for (let gx = -2; gx <= 2; gx++) plans.push(W.fortressPlan(gx, gz));

test('fortress plans: a keep in one chunk, 2 to 4 bridges of 32 to 64 along x and z, no shared column', () => {
  const owner = new Map();
  for (const P of plans) {
    const where = `cell ${P.gx}, ${P.gz}`;
    assert.equal(Math.floor((P.kx - 6) / CS), Math.floor((P.kx + 6) / CS), where);
    assert.equal(Math.floor((P.kz - 6) / CS), Math.floor((P.kz + 6) / CS), where);
    assert.ok(P.bridges.length >= 2 && P.bridges.length <= 4, where);
    assert.equal(new Set(P.bridges.map((b) => b.d)).size, P.bridges.length, where);
    for (const b of P.bridges) assert.ok(b.len >= 32 && b.len <= 64, where);
    for (const [ax, , az, bx, , bz] of W.fortressBoxes(P)) for (let x = ax; x <= bx; x++) for (let z = az; z <= bz; z++) {
      const k = `${x},${z}`, o = owner.get(k);
      assert.ok(o === undefined || o === where, `${where} shares column ${k} with ${o}`);
      owner.set(k, where);
    }
  }
});

test('fortress stamps: every planned brick is there across chunk edges, pillars reach the floor or the lava', () => {
  const isBrick = (x, y, z) => get(x, y, z) === B.EMBER_BRICKS;
  // A pillar column under (x, y0): bricks, then rock, lava, or bedrock.
  const pillarOk = (x, y0, z) => { let y = y0; while (y > 0 && isBrick(x, y, z)) y--; return [B.EMBER_ROCK, B.ASH_SAND, B.EMBERITE_ORE, B.LAVA, B.BEDROCK].includes(get(x, y, z)); };
  for (const P of plans) {
    const where = `cell ${P.gx}, ${P.gz}`, y = P.y;
    for (let dx = -6; dx <= 6; dx++) for (let dz = -6; dz <= 6; dz++) {
      assert.ok(isBrick(P.kx + dx, y, P.kz + dz) && isBrick(P.kx + dx, y + 6, P.kz + dz), `${where}: keep floor and roof`);
    }
    for (const [dx, dz] of [[-6, -6], [6, 6], [0, 5], [-5, 0]]) assert.ok(pillarOk(P.kx + dx, y - 1, P.kz + dz), `${where}: keep pillar`);
    for (const b of P.bridges) {
      for (let t = 0; t < b.len + 7; t++) for (let w = -3; w <= 3; w++) {
        const [x, z] = cell(P, b, t, w);
        assert.ok(isBrick(x, y, z), `${where}: deck ${t}, ${w}`);
        if (t < b.len && Math.abs(w) === 3) assert.ok(isBrick(x, y + 1, z), `${where}: rail ${t}, ${w}`);
      }
      for (let t = 4; t < b.len; t += 8) { const [x, z] = cell(P, b, t, 0); assert.ok(pillarOk(x, y - 1, z), `${where}: bridge pillar ${t}`); }
    }
  }
});

test('fortress features: each lies in its own chunk; one knight spawner and one heart chest per keep', () => {
  const heart = [], knight = [], room = [];
  for (const [k, c] of chunks) {
    const [cx, cz] = k.split(',').map(Number);
    for (const f of c.features) {
      assert.ok(Math.floor(f.x / CS) === cx && Math.floor(f.z / CS) === cz, `feature ${f.x}, ${f.z} outside chunk ${k}`);
      assert.equal(get(f.x, f.y, f.z) === B.SPAWNER, f.kind === 'spawner');
      (f.type === 'heart' ? heart : f.type === 'knight' ? knight : room).push(f);
    }
  }
  for (const P of plans) {
    assert.equal(heart.filter((f) => f.x === P.kx - 4 && f.y === P.y + 1 && f.z === P.kz - 4).length, 1, `cell ${P.gx}, ${P.gz}: heart chest`);
    assert.equal(knight.filter((f) => f.x === P.kx && f.y === P.y + 1 && f.z === P.kz).length, 1, `cell ${P.gx}, ${P.gz}: knight spawner`);
  }
  assert.equal(heart.length, plans.length);
  assert.equal(knight.length, plans.length);
  const want = plans.reduce((a, P) => a + P.bridges.filter((b) => b.chest).length, 0);
  assert.equal(room.filter((f) => f.type === 'fortress').length, want);
  assert.ok(want > 0);
});

test('fortress walk check: a walk reaches the keep from every bridge end without digging', () => {
  const pass = (x, y, z) => { const id = get(x, y, z); return !SOLID[id] && !LIQ_KIND[id]; };
  const stand = (x, y, z) => pass(x, y, z) && pass(x, y + 1, z) && SOLID[get(x, y - 1, z)];
  for (const P of plans) {
    const boxes = W.fortressBoxes(P), y0 = P.y - 4, y1 = P.y + 7;
    const inBox = (x, z) => boxes.some(([ax, , az, bx, , bz]) => x >= ax - 1 && x <= bx + 1 && z >= az - 1 && z <= bz + 1);
    for (const b of P.bridges) {
      const [sx, sz] = cell(P, b, b.len + 3, 0), start = [sx, P.y + 1, sz], where = `cell ${P.gx}, ${P.gz}, bridge ${b.d}`;
      assert.ok(stand(...start), `${where}: start`);
      const seen = new Set([start.join()]), queue = [start];
      let reached = false;
      while (queue.length && !reached) {
        const [x, y, z] = queue.shift();
        if (Math.abs(x - P.kx) <= 5 && Math.abs(z - P.kz) <= 5 && y === P.y + 1) reached = true;
        for (const [dx, dz] of D4) {
          const nx = x + dx, nz = z + dz;
          if (!inBox(nx, nz)) continue;
          // same level, a step up 1 (head room above the start), or a drop of up to 3
          const cands = [];
          if (pass(x, y + 2, z)) cands.push(y + 1);
          cands.push(y);
          for (let d = 1; d <= 3 && pass(nx, y - d + 1, nz); d++) cands.push(y - d);
          for (const ny of cands) {
            if (ny < y0 || ny > y1 || !stand(nx, ny, nz)) continue;
            const k = `${nx},${ny},${nz}`;
            if (!seen.has(k)) { seen.add(k); queue.push([nx, ny, nz]); }
            break;
          }
        }
      }
      assert.ok(reached, `${where}: no walk into the keep`);
    }
  }
});

test('fortress chunks: the same seed gives the same bytes; a toString copy agrees', () => {
  const P = plans[12], cx = Math.floor(P.kx / CS), cz = Math.floor(P.kz / CS);
  const h = (c) => createHash('sha256').update(c.blocks).update(JSON.stringify(c.features)).digest('hex');
  const Copy = new Function(`return ${WorldGenModule.toString()}`)();
  const a = h(WorldGenModule(12345, K).generateChunk(cx, cz, 'ember'));
  assert.equal(h(WorldGenModule(12345, K).generateChunk(cx, cz, 'ember')), a);
  assert.equal(h(Copy(12345, K).generateChunk(cx, cz, 'ember')), a);
  assert.equal(a, h(chunk(cx, cz)));
});

test('inFortress: true in the keep and on a bridge, false far away', () => {
  for (const P of plans) {
    assert.ok(W.inFortress(P.kx, P.y + 1, P.kz));
    const b = P.bridges[0], [x, z] = cell(P, b, 10, 0);
    assert.ok(W.inFortress(x, P.y + 1, z));
    assert.ok(!W.inFortress(x, P.y + 20, z));
  }
  assert.ok(!W.inFortress(plans[12].kx + 30, plans[12].y + 1, plans[12].kz + 30));
});

// Gate item: spawns in the Ember Realm follow the weights. Cinder Knights spawn only inside fortress bounds.
test('emberMobType: weights 35/45/20 in a fortress, 35:45 outside, never a knight outside', () => {
  const N = 100000, count = (inF) => {
    const n = { brute: 0, wisp: 0, knight: 0 };
    for (let i = 0; i < N; i++) n[emberMobType((i + 0.5) / N, inF)]++;
    return n;
  };
  assert.deepEqual(count(true), { brute: 35000, wisp: 45000, knight: 20000 });
  assert.deepEqual(count(false), { brute: 43750, wisp: 56250, knight: 0 });
  assert.equal(EMBER_SPAWN_LIGHT, 11);
  assert.deepEqual(EMBER_WEIGHTS, [['brute', 35], ['wisp', 45], ['knight', 20]]);
});

test('ember spawn rolls over fortress and open cells: knights only in fortress bounds', () => {
  const rng = mulberry32(99), n = { in: { brute: 0, wisp: 0, knight: 0 }, out: { brute: 0, wisp: 0, knight: 0 } };
  for (let i = 0; i < 40000; i++) {
    const P = plans[i % plans.length], b = P.bridges[i % P.bridges.length];
    // half the rolls on a deck cell of a bridge, half 20..40 blocks off the keep
    const [x, z] = i % 2 ? cell(P, b, Math.floor(rng() * b.len), Math.floor(rng() * 5) - 2) : [P.kx + 20 + Math.floor(rng() * 20), P.kz - 20 - Math.floor(rng() * 20)];
    const inF = W.inFortress(x, P.y + 1, z);
    n[inF ? 'in' : 'out'][emberMobType(rng(), inF)]++;
  }
  assert.equal(n.out.knight, 0);
  const tin = n.in.brute + n.in.wisp + n.in.knight, tout = n.out.brute + n.out.wisp;
  assert.ok(tin > 15000 && tout > 15000);
  assert.ok(Math.abs(n.in.knight / tin - 0.2) < 0.015 && Math.abs(n.in.wisp / tin - 0.45) < 0.015, JSON.stringify(n.in));
  assert.ok(Math.abs(n.out.brute / tout - 0.4375) < 0.015, JSON.stringify(n.out));
});
