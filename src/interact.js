/* =====================================================================================
 * === 11. RAYCASTING AND BLOCK EDITING
 * -------------------------------------------------------------------------------------
 * raycast() walks the voxel grid (Amanatides-Woo DDA) from the eye. Water and air never
 * stop the ray. Non-cube shapes (plants, torches, cactus) test their own smaller box.
 * Mining: hold left click; progress += dt / breakTime(block, held tool); ten crack
 * stages draw on an overlay cube. A 0.25 s delay follows each break (as in Survival).
 * Breaking a block also breaks blocks above it that need support (plants, torches,
 * cactus). Every block change wakes nearby liquids (`world.onEdit`), so water and lava
 * flow into a dug gap. Right click uses a block (table, furnace, chest, door) unless Shift
 * is held; otherwise it eats or places the held item.
 * ===================================================================================== */
import { THREE } from './three.js';
import { CONFIG, H, randInt, randRange, REACH, UNLOADED } from './config.js';
import {
  B, baseOf, blockDrop, BLOCKS, breakTime, CRYSTAL_GROW, DIR4, enchLevel, I, IS_CROP, IS_FARMLAND, IS_LEAF,
  IS_ORE, IS_RAIL, IS_SAPLING, IS_STAIR, ITEMS, LEAF_COLOR, LEAF_DECAYS, LIQ_KIND, LIQ_LEVEL, NEEDS_SUPPORT,
  OPAQUE, RAIL_ENDS, railShapeFor, railUp, REPLACEABLE, SHAPE, SHAPE_OF, SOLID, TARGETABLE,
} from './blocks.js';
import { crystalXform, doorBox } from './mesher.js';
import { camera, game, input, player, world } from './engine.js';
import { keyDown } from './player.js';
import { cellBlockedByEntity, stairBoxesAt } from './collision.js';
import {
  farming, spawnDrop, viewModel, dropStack, inv, spillTileEntity, openInventory, mobs, vehicles, projectiles,
  primeTnt, particles, audio, hud, realm, portals,
} from './order.js';

const SEL_BOX = [];
for (const def of BLOCKS) if (def) SEL_BOX[def.id] = [0, 0, 0, 1, 1, 1];
SEL_BOX[B.TORCH] = [0.4, 0, 0.4, 0.6, 0.625, 0.6];
for (let f = 0; f < 4; f++) {   // wall torch: u 0..6/16 from the wall, h 3..13.5/16
  const [dx, dz] = DIR4[f], a0 = dx + dz > 0 ? 0 : 10 / 16, a1 = a0 + 6 / 16;
  SEL_BOX[B.TORCH_WALL + f] = dx ? [a0, 3 / 16, 6.5 / 16, a1, 13.5 / 16, 9.5 / 16] : [6.5 / 16, 3 / 16, a0, 9.5 / 16, 13.5 / 16, a1];
}
for (const id of [B.TALL_GRASS, B.ROSE, B.DANDELION]) SEL_BOX[id] = [0.15, 0, 0.15, 0.85, 0.8, 0.85];
for (let c = 0; c < 7; c++) SEL_BOX[B.SAPLING + c] = [0.15, 0, 0.15, 0.85, 0.85, 0.85];
for (let v = 0; v < 4; v++) SEL_BOX[B.WHEAT + v] = [0, 0, 0, 1, (3 + v * 4) / 16, 1];
SEL_BOX[B.FARMLAND] = SEL_BOX[B.FARMLAND_WET] = [0, 0, 0, 1, 15 / 16, 1];
for (let f = 0; f < 4; f++) {   // ladder: a 3/16 slab against its wall (the rail depth)
  const [dx, dz] = DIR4[f], a0 = dx + dz > 0 ? 0 : 13 / 16, a1 = a0 + 3 / 16;
  SEL_BOX[B.LADDER + f] = dx ? [a0, 0, 0, a1, 1, 1] : [0, 0, a0, 1, 1, a1];
}
SEL_BOX[B.CACTUS] = [1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16];
for (let v = 0; v < 10; v++) SEL_BOX[B.RAIL + v] = [0, 0, 0, 1, railUp(v) >= 0 ? 0.5 : 2 / 16, 1];
for (let v = 0; v < 16; v++) SEL_BOX[B.DOOR + v] = doorBox(B.DOOR + v).map((n) => n / 16);
for (let v = 0; v < 6; v++) {   // crystal: local box u 2..14, h 0..13, w 2..14, turned like the model
  const a = [0, 0, 0, 0, 0, 0];
  crystalXform(v, 2, 0, 2, a, 0); crystalXform(v, 14, 13, 14, a, 3);
  SEL_BOX[B.CRYSTAL + v] = [0, 1, 2].map((i) => Math.min(a[i], a[i + 3]) / 16).concat([0, 1, 2].map((i) => Math.max(a[i], a[i + 3]) / 16));
}

// Ray vs box. Returns {t, n: face index} or null.
function rayBox(ox, oy, oz, dx, dy, dz, x0, y0, z0, x1, y1, z1, maxT) {
  let tmin = 0, tmax = maxT, face = -1;
  const o = [ox, oy, oz], d = [dx, dy, dz], lo = [x0, y0, z0], hi = [x1, y1, z1];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-9) { if (o[a] < lo[a] || o[a] > hi[a]) return null; continue; }
    let t1 = (lo[a] - o[a]) / d[a], t2 = (hi[a] - o[a]) / d[a];
    let f = a * 2 + 1;                       // entering through the low side -> normal points -axis
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; f = a * 2; }
    if (t1 > tmin) { tmin = t1; face = f; }
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return face < 0 ? null : { t: tmin, face };
}
// face index follows FACES order: 0 +X, 1 -X, 2 +Y, 3 -Y, 4 +Z, 5 -Z; axis a -> +a is 2a
const FACE_NORMAL = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const AXIS_FACE = [[0, 1], [2, 3], [4, 5]];   // [positive, negative] face per axis

// With `sources`, the ray also stops at a water or lava source (the bucket ray).
function raycast(ox, oy, oz, dx, dy, dz, maxD, sources = false) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = Math.sign(dx), sy = Math.sign(dy), sz = Math.sign(dz);
  const tdx = sx ? Math.abs(1 / dx) : Infinity, tdy = sy ? Math.abs(1 / dy) : Infinity, tdz = sz ? Math.abs(1 / dz) : Infinity;
  let tmx = sx > 0 ? (x + 1 - ox) * tdx : sx < 0 ? (ox - x) * tdx : Infinity;
  let tmy = sy > 0 ? (y + 1 - oy) * tdy : sy < 0 ? (oy - y) * tdy : Infinity;
  let tmz = sz > 0 ? (z + 1 - oz) * tdz : sz < 0 ? (oz - z) * tdz : Infinity;
  let t = 0, face = -1;
  for (let i = 0; i < 64 && t <= maxD; i++) {
    const id = world.getBlock(x, y, z);
    if (id === UNLOADED) return null;
    if (sources && LIQ_LEVEL[id] === 8 && face >= 0) return { x, y, z, id, face, t };
    if (TARGETABLE[id]) {
      if (SHAPE_OF[id] === SHAPE.CUBE && face >= 0) return { x, y, z, id, face, t };
      if (IS_STAIR[id]) {   // nearest box of the stair's shape
        let best = null;
        for (const b of stairBoxesAt(id, x, y, z)) {
          const r = rayBox(ox, oy, oz, dx, dy, dz, x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16, maxD);
          if (r && (!best || r.t < best.t)) best = r;
        }
        if (best) return { x, y, z, id, face: best.face, t: best.t };
      } else {
        const b = SEL_BOX[id];
        const r = rayBox(ox, oy, oz, dx, dy, dz, x + b[0], y + b[1], z + b[2], x + b[3], y + b[4], z + b[5], maxD);
        if (r) return { x, y, z, id, face: r.face, t: r.t };
      }
    }
    if (tmx < tmy && tmx < tmz) { x += sx; t = tmx; tmx += tdx; face = AXIS_FACE[0][sx > 0 ? 1 : 0]; }
    else if (tmy < tmz) { y += sy; t = tmy; tmy += tdy; face = AXIS_FACE[1][sy > 0 ? 1 : 0]; }
    else { z += sz; t = tmz; tmz += tdz; face = AXIS_FACE[2][sz > 0 ? 1 : 0]; }
  }
  return null;
}

// Nearest living mob hit by the ray within maxT.
function raycastMobs(ox, oy, oz, dx, dy, dz, maxT) {
  let best = null, bt = maxT;
  for (const m of mobs) {
    if (m.dead) continue;
    const hw = m.w / 2;
    const r = rayBox(ox, oy, oz, dx, dy, dz, m.pos.x - hw, m.pos.y, m.pos.z - hw, m.pos.x + hw, m.pos.y + m.h, m.pos.z + hw, bt);
    if (r && r.t < bt) { bt = r.t; best = m; }
  }
  return best;
}

function canHarvest(id, stack) {
  const b = BLOCKS[id], tool = stack && ITEMS[stack.id].tool;
  if (b.tool === 'pickaxe' && (!tool || tool.type !== 'pickaxe')) return false;
  if (b.harvestTool && (!tool || tool.type !== b.harvestTool)) return false;   // a cobweb gives string only to a sword
  if (b.minLevel && (!tool || tool.type !== b.tool || tool.level < b.minLevel)) return false;
  return true;
}

// Block support rules for placement. Mirrors NEEDS_SUPPORT on the break side.
function canStay(id, x, y, z) {
  const below = world.getBlock(x, y - 1, z);
  if (id === B.TORCH) return !!OPAQUE[below];
  if (baseOf(id) === B.TORCH || baseOf(id) === B.LADDER) { const [dx, dz] = DIR4[BLOCKS[id].facing]; return !!OPAQUE[world.getBlock(x - dx, y, z - dz)]; }
  if (id === B.TALL_GRASS || id === B.ROSE || id === B.DANDELION) return below === B.GRASS || below === B.DIRT;
  if (IS_SAPLING(id)) return below === B.GRASS || below === B.DIRT;
  if (IS_CROP(id)) return IS_FARMLAND(below);
  if (baseOf(id) === B.DOOR) return !!SOLID[below] && below !== UNLOADED && baseOf(below) !== B.DOOR;
  if (baseOf(id) === B.CRYSTAL) { const g = CRYSTAL_GROW[id - B.CRYSTAL]; return !!OPAQUE[world.getBlock(x - g[0], y - g[1], z - g[2])]; }
  if (IS_RAIL(id)) return !!SOLID[below] && below !== UNLOADED;
  if (id === B.CACTUS) {
    if (below !== B.SAND && below !== B.CACTUS) return false;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (SOLID[world.getBlock(x + dx, y, z + dz)]) return false;
  }
  return true;
}

const torches = new Set();   // "x,y,z" of placed torches (flame particles)

// Removes a block. Returns true when the world changed. A door takes its other half with it;
// a furnace or chest spills its contents.
function breakBlock(x, y, z, dropItems, silent, fortune = 0) {
  const id = world.getBlock(x, y, z);
  if (id === UNLOADED || id === B.AIR || LIQ_KIND[id] || BLOCKS[id].hardness < 0) return false;
  const base = BLOCKS[id].base;
  if (!world.setBlock(x, y, z, B.AIR)) return false;
  if (base === B.DOOR) {
    const oy = (id - B.DOOR) & 8 ? y - 1 : y + 1;
    if (baseOf(world.getBlock(x, oy, z)) === B.DOOR) world.setBlock(x, oy, z, B.AIR);
    doorTimers.delete(`${x},${Math.min(y, oy)},${z}`);
  }
  if (base === B.FURNACE || base === B.CHEST) spillTileEntity(x, y, z);
  if (base === B.TORCH) torches.delete(`${x},${y},${z}`);
  if (!silent) { particles.blockBreak(x, y, z, id); audio.dig(BLOCKS[id].sound, 1, x + 0.5, y + 0.5, z + 0.5); }
  if (dropItems) {
    const d = blockDrop(id);
    if (d && fortune && IS_ORE.has(id)) d[1] += randInt(0, fortune);   // Fortune: 0..level extra ore items
    if (d) spawnDrop(d[0], d[1], x + 0.5, y + 0.3, z + 0.5, new THREE.Vector3(randRange(-1.5, 1.5), 3, randRange(-1.5, 1.5)), 0.4);
    bonusDrops(id, x, y, z);
  }
  const above = world.getBlock(x, y + 1, z);
  if (NEEDS_SUPPORT[above] && !canStay(above, x, y + 1, z)) breakBlock(x, y + 1, z, true, silent);
  for (let k = 0; k < 4; k++) {   // wall torches and ladders that face away from this cell lose their wall
    const nx = x + DIR4[k][0], nz = z + DIR4[k][1], n = world.getBlock(nx, y, nz);
    if (n === B.TORCH_WALL + k || n === B.LADDER + k) breakBlock(nx, y, nz, true, silent);
  }
  for (let v = 1; v < 6; v++) {   // crystals that grow away from this cell lose their rock (floor crystals: see above)
    const g = CRYSTAL_GROW[v];
    if (world.getBlock(x + g[0], y + g[1], z + g[2]) === B.CRYSTAL + v) breakBlock(x + g[0], y + g[1], z + g[2], true, silent);
  }
  return true;
}

// Chance drops on top of blockDrop: a leaf gives a sapling (1 in 16) and an oak leaf an apple
// (1 in 60); tall grass gives seeds (1 in 8); ripe wheat gives 1-3 seeds.
function bonusDrops(id, x, y, z) {
  const out = (item, n) => spawnDrop(item, n, x + 0.5, y + 0.3, z + 0.5, new THREE.Vector3(randRange(-1.5, 1.5), 2.5, randRange(-1.5, 1.5)), 0.4);
  if (IS_LEAF[id]) {
    if (Math.random() < 1 / 16) out(B.SAPLING + LEAF_COLOR[id], 1);
    if (LEAF_COLOR[id] !== 5 && Math.random() < 1 / 60) out(I.APPLE, 1);
  } else if (id === B.TALL_GRASS && Math.random() < 1 / 8) out(I.SEEDS, 1);
  else if (id === B.WHEAT + 3) out(I.SEEDS, randInt(1, 3));
}

// A torch on the side of an opaque block hangs on that wall; on a top face it stands.
// Otherwise it takes the first spot that holds it: standing, then any wall.
const FACE_DIR = [0, 2, -1, -1, 1, 3];   // FACES index -> DIR4 index (-1 for top and bottom)
function torchFor(t, x, y, z) {
  const k = REPLACEABLE[t.id] || !OPAQUE[t.id] ? -1 : FACE_DIR[t.face];
  const tries = [k >= 0 ? B.TORCH_WALL + k : B.TORCH, B.TORCH, B.TORCH_WALL, B.TORCH_WALL + 1, B.TORCH_WALL + 2, B.TORCH_WALL + 3];
  return tries.find((id) => canStay(id, x, y, z)) ?? B.TORCH;
}

// A ladder hangs on the clicked wall face. Otherwise it takes the first wall that holds it.
function ladderFor(t, x, y, z) {
  const k = REPLACEABLE[t.id] || !OPAQUE[t.id] ? -1 : FACE_DIR[t.face];
  return [k, 0, 1, 2, 3].filter((f) => f >= 0).map((f) => B.LADDER + f).find((id) => canStay(id, x, y, z)) ?? B.LADDER;
}

// A crystal grows away from the clicked face. Otherwise it takes the first face that holds it.
const FACE_CRYSTAL = [2, 4, 0, 1, 3, 5];   // FACES index -> crystal variant that grows along that normal
function crystalFor(t, x, y, z) {
  const first = REPLACEABLE[t.id] || !OPAQUE[t.id] ? B.CRYSTAL : B.CRYSTAL + FACE_CRYSTAL[t.face];
  return [first, 0, 1, 2, 3, 4, 5].map((v, i) => i ? B.CRYSTAL + v : v).find((id) => canStay(id, x, y, z)) ?? B.CRYSTAL;
}

// ---- rail links. The edge height of rail end d is y + 1 on the raised end of a slope, else y.
// Two rails link when each has an end toward the other at the same edge height.
// The rail linked through end d of the rail v at x, y, z, or null.
function railLink(x, y, z, v, d) {
  const ey = y + (railUp(v) === d ? 1 : 0), back = (d + 2) & 3, nx = x + DIR4[d][0], nz = z + DIR4[d][1];
  for (const ny of [ey, ey - 1]) {
    const n = world.getBlock(nx, ny, nz);
    if (!IS_RAIL(n)) continue;
    const nv = n - B.RAIL;
    if (RAIL_ENDS[nv].includes(back) && ny + (railUp(nv) === back ? 1 : 0) === ey) return { x: nx, y: ny, z: nz, v: nv };
  }
  return null;
}
const railLinkedEnds = (x, y, z, v) => RAIL_ENDS[v].filter((d) => railLink(x, y, z, v, d));
// A new shape for the rail v at x, y, z that adds the end `back` and keeps its one linked end.
// rise: the new end is the raised end. Returns -1 when the rail has 2 other links or cannot bend.
function railReshape(x, y, z, v, back, rise) {
  const ends = railLinkedEnds(x, y, z, v).filter((e) => e !== back);
  if (ends.length >= 2) return -1;
  const k = ends.length ? ends[0] : -1, straight = k < 0 || k === ((back + 2) & 3);
  let up = railUp(v) === k ? k : -1;
  if (up >= 0 && !straight) return -1;
  if (rise) { if (up >= 0 || !straight) return -1; up = back; }
  return railShapeFor(back, k, up);
}
// The shape for a new rail at x, y, z. look is the DIR4 direction the player faces.
// Each side takes the first rail at y, y + 1, or y - 1. A side counts when its rail links already
// or can re-shape to link. Priority: a straight pair (a slope toward a higher side), a flat curve,
// one side, then the look axis.
function railPlan(x, y, z, look) {
  const side = [];
  for (let d = 0; d < 4; d++) {
    const back = (d + 2) & 3;
    for (const o of [0, 1, -1]) {
      const n = world.getBlock(x + DIR4[d][0], y + o, z + DIR4[d][1]);
      if (!IS_RAIL(n)) continue;
      const nv = n - B.RAIL, nx = x + DIR4[d][0], ny = y + o, nz = z + DIR4[d][1];
      const faces = RAIL_ENDS[nv].includes(back) && (railUp(nv) === back) === (o === -1);
      if (faces || railReshape(nx, ny, nz, nv, back, o === -1) >= 0) side[d] = o;
      break;
    }
  }
  const has = (d) => side[d] !== undefined;
  for (const a of [look & 1, (look + 1) & 1]) {
    const b = a + 2;
    if (has(a) && has(b) && !(side[a] === 1 && side[b] === 1)) return railShapeFor(a, b, side[a] === 1 ? a : side[b] === 1 ? b : -1);
  }
  for (let a = 0; a < 4; a++) {
    const b = (a + 1) & 3;
    if (has(a) && has(b) && side[a] !== 1 && side[b] !== 1) return railShapeFor(a, b, -1);
  }
  for (const d of [look, (look + 1) & 3, (look + 3) & 3, (look + 2) & 3]) if (has(d)) return railShapeFor(d, -1, side[d] === 1 ? d : -1);
  return railShapeFor(look, -1, -1);
}
// After a rail lands: each end that does not link yet re-shapes the rail it meets, if that rail can.
function railJoin(x, y, z) {
  const v = world.getBlock(x, y, z) - B.RAIL;
  for (const d of RAIL_ENDS[v]) {
    if (railLink(x, y, z, v, d)) continue;
    const ey = y + (railUp(v) === d ? 1 : 0), back = (d + 2) & 3, nx = x + DIR4[d][0], nz = z + DIR4[d][1];
    for (const ny of [ey, ey - 1]) {
      const n = world.getBlock(nx, ny, nz);
      if (!IS_RAIL(n)) continue;
      const nv = railReshape(nx, ny, nz, n - B.RAIL, back, ny < ey);
      if (nv >= 0) world.setBlock(nx, ny, nz, B.RAIL + nv);
      break;
    }
  }
}

function placeBlock(x, y, z, id) {
  if (LEAF_DECAYS[id]) id = B.LEAVES_PLACED + LEAF_COLOR[id];   // a placed leaf never decays
  const own = IS_RAIL(id) && !world.batch;   // one remesh for the rail and the rails it re-shapes
  if (own) world.beginBatch();
  const ok = world.setBlock(x, y, z, id);
  if (ok && IS_RAIL(id)) railJoin(x, y, z);
  if (own) world.endBatch();
  if (!ok) return false;
  if (baseOf(id) === B.TORCH) {
    torches.add(`${x},${y},${z}`);
    for (const [dx, dy, dz] of FACE_NORMAL) if (world.getBlock(x + dx, y + dy, z + dz) === B.TNT) primeTnt(x + dx, y + dy, z + dz);
  }
  audio.dig(BLOCKS[id].sound, 1.1, x + 0.5, y + 0.5, z + 0.5, true);
  return true;
}

const mining = { active: false, x: 0, y: 0, z: 0, id: 0, progress: 0, cooldown: 0, tickT: 0 };
let target = null, targetMob = null, targetVehicle = null;
const _dir = new THREE.Vector3();

function resetMining() { mining.active = false; mining.progress = 0; }

function primaryClick() {
  viewModel.swing();
  if (targetMob) { attackMob(targetMob); return; }
  if (targetVehicle) { vehicles.hit(targetVehicle); return; }
  if (target && mining.cooldown <= 0 && breakTime(target.id, inv.held()) === 0) mineComplete(target);
}

function mineComplete(t) {
  const held = inv.held();
  const harvest = canHarvest(t.id, held);
  const hard = BLOCKS[t.id].hardness > 0;
  if (breakBlock(t.x, t.y, t.z, harvest, false, enchLevel(held, 'fortune'))) {
    if (hard && held && ITEMS[held.id].tool) inv.damageHeld(1);
    mining.cooldown = 0.25;
  }
  resetMining();
}

function attackMob(m) {
  const held = inv.held(), tool = held && ITEMS[held.id].tool;
  const dmg = (tool ? tool.damage : 1) + 1.25 * enchLevel(held, 'sharpness');
  _dir.set(m.pos.x - player.pos.x, 0, m.pos.z - player.pos.z).normalize();
  m.hurt(dmg, _dir, player.sprinting ? 1.6 : 1);
  if (tool) inv.damageHeld(tool.type === 'sword' ? 1 : 2);
  if (player.sprinting) { player.vel.x *= 0.4; player.vel.z *= 0.4; }
}

// Horizontal direction (DIR4 index) the player looks along, or faces away from (`toward`).
function lookDir(toward) {
  let lx = -Math.sin(player.yaw), lz = -Math.cos(player.yaw);
  if (toward) { lx = -lx; lz = -lz; }
  return Math.abs(lx) > Math.abs(lz) ? (lx > 0 ? 0 : 2) : (lz > 0 ? 1 : 3);
}

// A stair faces the look direction. It hangs upside down when placed on the bottom face of a block,
// or on the upper half of a side face.
function stairFor(t, id) {
  const hy = camera.position.y + _dir.y * t.t - t.y;
  const top = t.face === 3 || (t.face !== 2 && !REPLACEABLE[t.id] && hy > 0.5);
  return id + (top ? 4 : 0) + lookDir(false);
}

// ---- doors: right click toggles both halves; an open door closes after CONFIG.doorCloseDelay
const doorTimers = new Map();   // "x,y,z" of the bottom half -> game.clock time to close
function toggleDoor(x, y, z) {
  let id = world.getBlock(x, y, z);
  if (baseOf(id) !== B.DOOR) return false;
  if ((id - B.DOOR) & 8) { y--; id = world.getBlock(x, y, z); if (baseOf(id) !== B.DOOR) return false; }
  const v = id - B.DOOR, open = !(v & 4), nv = (v & 3) | (open ? 4 : 0);
  world.beginBatch();
  world.setBlock(x, y, z, B.DOOR + nv);
  if (baseOf(world.getBlock(x, y + 1, z)) === B.DOOR) world.setBlock(x, y + 1, z, B.DOOR + 8 + nv);
  world.endBatch();
  const k = `${x},${y},${z}`;
  if (open) doorTimers.set(k, game.clock + CONFIG.doorCloseDelay); else doorTimers.delete(k);
  audio.door(open, x + 0.5, y + 1, z + 0.5);
  return true;
}
function updateDoors() {
  for (const [k, t] of doorTimers) {
    if (game.clock < t) continue;
    const [x, y, z] = k.split(',').map(Number), id = world.getBlock(x, y, z);
    if (id === UNLOADED) { doorTimers.set(k, game.clock + 2); continue; }
    if (baseOf(id) !== B.DOOR || !((id - B.DOOR) & 4)) { doorTimers.delete(k); continue; }
    // wait while anything stands in the doorway
    if (cellBlockedByEntity(x, y, z) || cellBlockedByEntity(x, y + 1, z)) { doorTimers.set(k, game.clock + 0.5); continue; }
    toggleDoor(x, y, z);
  }
}

// A right click on a usable block swings once and blocks the hold-to-repeat until the button is released.
function interacted() { viewModel.swing(); input.rightRepeat = Infinity; }

// ---- bow: hold right click to draw it (full after BOW_DRAW s); release to shoot one arrow.
const BOW_DRAW = 1;
const bow = { charging: false, t: 0, power() { return this.charging ? Math.min(1, this.t / BOW_DRAW) : 0; } };
function startBowDraw() {
  input.rightRepeat = Infinity;
  if (!inv.countOf(I.ARROW)) { hud.toast('No arrows'); return; }
  bow.charging = true; bow.t = 0;
  audio.bowDraw();
}
// Per frame: draw while right click is held; shoot on release. A screen change or a slot change cancels.
function updateBow(dt) {
  if (!bow.charging) return;
  const s = inv.held();
  if (game.state !== 'playing' || player.dead || !s || s.id !== I.BOW) { bow.charging = false; return; }
  if (input.mouseR) { bow.t += dt; return; }
  const c = bow.power();
  bow.charging = false;
  if (c >= 0.1) shootBow(c);
}
function shootBow(c) {
  if (!inv.take(I.ARROW, 1)) return;
  const f = (c * c + 2 * c) / 3, speed = 55 * f;   // Minecraft's draw curve: a half draw gives 42% speed
  camera.getWorldDirection(_dir);
  const o = camera.position;
  projectiles.shoot(o.x + _dir.x * 0.4, o.y + _dir.y * 0.4 - 0.1, o.z + _dir.z * 0.4,
    _dir.x * speed, _dir.y * speed, _dir.z * speed, Math.round((2 + 7 * c) * (1 + 0.25 * enchLevel(inv.held(), 'power'))), null);
  audio.bow(null, c);
  inv.damageHeld(1);
  inv.changed();
}

// Right click: use a table, furnace, chest, or door; eat; or place the held block. Shift skips "use".
function useItem() {
  if (player.dead) return;
  const t = target, stack = inv.held();
  if (targetVehicle && !keyDown('ShiftLeft', 'ShiftRight')) { interacted(); vehicles.mount(targetVehicle); return; }
  if (t && !keyDown('ShiftLeft', 'ShiftRight')) {
    const base = BLOCKS[t.id].base;
    if (t.id === B.TABLE) { interacted(); openInventory('table'); return; }
    if (t.id === B.ALTAR) { interacted(); openInventory('altar'); return; }
    if (base === B.FURNACE || base === B.CHEST) { interacted(); openInventory(base === B.FURNACE ? 'furnace' : 'chest', t); return; }
    if (base === B.DOOR) { interacted(); toggleDoor(t.x, t.y, t.z); return; }
    if (t.id === B.TNT) { interacted(); primeTnt(t.x, t.y, t.z); return; }
  }
  if (!stack) return;
  const item = ITEMS[stack.id];
  if (item.kind === 'bow') { startBowDraw(); return; }
  if (item.armor) { if (inv.equipHeld()) interacted(); return; }
  if (item.kind === 'food') {
    if (player.health >= player.maxHealth && !item.regen) return;
    player.health = Math.min(player.maxHealth, player.health + item.heal);
    if (item.regen) player.regenLeft = item.regen;
    hud.dirtyHearts = true;
    audio.eat(); particles.eat(stack.id);
    inv.consumeHeld(1); viewModel.swing();
    input.rightRepeat = 0.6;
    return;
  }
  if (item.kind === 'bucket') { useBucket(item); return; }
  if (item.kind === 'vehicle') { if (vehicles.placeHeld(item)) { inv.consumeHeld(1); interacted(); } return; }
  if (!t) return;
  if (stack.id === I.MAGMA_CORE) {   // ignites an Ember portal frame (SPEC_realms Phase 3)
    if (t.id !== B.OBSIDIAN) return;
    const r = portals.ignite(t.x, t.y, t.z);
    if (r === 'lit') { inv.consumeHeld(1); interacted(); } else if (r === 'open') hud.toast('The frame is not complete');
    return;
  }
  if (stack.id === I.EMBER_HEART) {   // ignites a crystal portal frame, in the overworld only (SPEC_realms Phase 5)
    if (t.id !== B.CRYSTAL_FRAME) return;
    if (realm.current !== 'overworld') { hud.toast('The frame does not wake here'); return; }
    const r = portals.ignite(t.x, t.y, t.z, B.PORTAL_CRYSTAL);
    if (r === 'lit') { inv.consumeHeld(1); interacted(); } else if (r === 'open') hud.toast('The frame is not complete');
    return;
  }
  if (item.kind === 'bonemeal') {
    if (farming.boost(t.x, t.y, t.z)) { particles.grow(t.x, t.y, t.z); audio.pop(); inv.consumeHeld(1); interacted(); }
    return;
  }
  if (item.tool && item.tool.type === 'hoe') {
    if ((t.id === B.GRASS || t.id === B.DIRT) && world.getBlock(t.x, t.y + 1, t.z) === B.AIR && world.setBlock(t.x, t.y, t.z, B.FARMLAND)) {
      audio.dig('gravel', 0.9, t.x + 0.5, t.y + 1, t.z + 0.5, true);
      inv.damageHeld(1); interacted();
    }
    return;
  }
  if (item.kind === 'seed') {
    if (IS_FARMLAND(t.id) && t.face === 2 && world.getBlock(t.x, t.y + 1, t.z) === B.AIR && placeBlock(t.x, t.y + 1, t.z, item.crop)) {
      inv.consumeHeld(1); viewModel.swing();
    }
    return;
  }
  if (item.kind !== 'block' && item.kind !== 'door') return;
  let x = t.x, y = t.y, z = t.z;
  if (!REPLACEABLE[t.id]) { const n = FACE_NORMAL[t.face]; x += n[0]; y += n[1]; z += n[2]; }
  if (y < 0 || y >= H) return;
  const cur = world.getBlock(x, y, z);
  // facing blocks turn their front toward the player; a door takes the look direction
  let id = stack.id;
  if (id === B.FURNACE || id === B.CHEST) id += lookDir(true);
  if (item.kind === 'door') id = B.DOOR + lookDir(false);
  if (id === B.TORCH) id = torchFor(t, x, y, z);
  if (id === B.CRYSTAL) id = crystalFor(t, x, y, z);
  if (id === B.LADDER) id = ladderFor(t, x, y, z);
  if (id === B.RAIL) id = B.RAIL + railPlan(x, y, z, lookDir(false));
  if (IS_STAIR[id]) id = stairFor(t, id);
  if (cur === UNLOADED || !REPLACEABLE[cur] || cur === id) return;
  if (LIQ_KIND[cur] && !SOLID[id]) return;
  if (!canStay(id, x, y, z)) return;
  if (SOLID[id] && cellBlockedByEntity(x, y, z)) return;
  if (item.kind === 'door') {
    const up = world.getBlock(x, y + 1, z);
    if (y + 1 >= H || up === UNLOADED || !REPLACEABLE[up] || cellBlockedByEntity(x, y + 1, z)) return;
    world.beginBatch();
    const ok = placeBlock(x, y, z, id) && world.setBlock(x, y + 1, z, id + 8);
    world.endBatch();
    if (ok) { inv.consumeHeld(1); viewModel.swing(); }
    return;
  }
  if (placeBlock(x, y, z, id)) { inv.consumeHeld(1); viewModel.swing(); }
}

// An empty bucket takes the source the eye ray meets first. A full bucket places its source in
// the cell on the clicked face (or in a replaceable target cell) and becomes an empty bucket.
// In the Ember Realm, water boils away: steam and a fizz, an empty bucket, and no water block.
function useBucket(item) {
  camera.getWorldDirection(_dir);
  const p = camera.position;
  if (!item.liquid) {
    const r = raycast(p.x, p.y, p.z, _dir.x, _dir.y, _dir.z, REACH, true);
    if (!r || !LIQ_KIND[r.id] || !world.setBlock(r.x, r.y, r.z, B.AIR)) return;
    const full = r.id === B.WATER ? I.WATER_BUCKET : I.LAVA_BUCKET;
    inv.consumeHeld(1);
    if (!inv.held()) inv.slots[inv.sel] = { id: full, count: 1 };
    else if (inv.add(full, 1)) dropStack({ id: full, count: 1 }, 2);
    inv.changed(); audio.splash(); interacted();
    return;
  }
  const t = target;
  if (!t) return;
  let x = t.x, y = t.y, z = t.z;
  if (!REPLACEABLE[t.id]) { const n = FACE_NORMAL[t.face]; x += n[0]; y += n[1]; z += n[2]; }
  if (y < 0 || y >= H) return;
  const cur = world.getBlock(x, y, z);
  if (cur === UNLOADED || !REPLACEABLE[cur] || cur === item.liquid) return;
  if (item.liquid === B.WATER && realm.current === 'ember') {
    particles.steam(x, y, z); audio.fizz(x + 0.5, y + 0.5, z + 0.5);
    inv.slots[inv.sel] = { id: I.BUCKET, count: 1 };
    inv.changed(); interacted();
    return;
  }
  if (!world.setBlock(x, y, z, item.liquid)) return;
  inv.slots[inv.sel] = { id: I.BUCKET, count: 1 };
  inv.changed(); audio.splash(); interacted();
}

function setTarget(v) { target = v; }
function setTargetMob(v) { targetMob = v; }
function setTargetVehicle(v) { targetVehicle = v; }

export {
  _dir, attackMob, bonusDrops, bow, breakBlock, canHarvest, doorTimers, FACE_NORMAL, mineComplete, mining,
  placeBlock, primaryClick, railJoin, railLink, railPlan, rayBox, raycast, raycastMobs, resetMining, SEL_BOX,
  setTarget, setTargetMob, setTargetVehicle, target, targetMob, targetVehicle, toggleDoor, torches, updateBow,
  updateDoors, useItem,
};
