// ---- spawning ---------------------------------------------------------------------------
import { THREE } from './three.js';
import {
  CS, H, lidx, MAX_ANIMALS_PER_CHUNK, MAX_HOSTILE, MAX_PASSIVE, mulberry32, randInt, randRange, SEED,
  UNLOADED,
} from './config.js';
import { B, baseOf, IS_LEAF, LIQ_KIND, OPAQUE, SOLID } from './blocks.js';
import { BIOME } from './biomes.js';
import { game, player, scene, world } from './engine.js';
import { FACE_NORMAL } from './interact.js';
import { Mob, MOB_TEXTURES, MOB_TYPES, mobs } from './mobs.js';
import { particles } from './order.js';

const entityStore = new Map();   // chunk key -> [{type, x, y, z, hp}] saved passive mobs
const spawnedChunks = new Set(); // chunk keys that already rolled their passive mobs
const PASSIVE_BY_BIOME = {
  [BIOME.PLAINS]: ['cow', 'pig', 'sheep', 'chicken'], [BIOME.FOREST]: ['cow', 'pig', 'chicken', 'sheep'],
  [BIOME.RAINFOREST]: ['chicken', 'pig'], [BIOME.HIGHLANDS]: ['sheep', 'cow'],
  [BIOME.SNOWY_PLAINS]: ['sheep'], [BIOME.SNOWY_MOUNTAINS]: ['sheep'], [BIOME.BEACH]: ['chicken'],
};
const passiveCount = () => { let n = 0; for (const m of mobs) if (!m.def.hostile && !m.dead) n++; return n; };
const hostileCount = () => { let n = 0; for (const m of mobs) if (m.def.hostile && !m.dead) n++; return n; };

// Passive mobs live only in the overworld (SPEC_realms Phase 1). world.realm is the realm of
// the chunk: during a realm switch, world.reset unloads the old chunks before it changes realm.
world.onChunkLoaded = (c) => {
  if (world.realm !== 'overworld') return;
  const saved = entityStore.get(c.key);
  if (saved) {
    entityStore.delete(c.key);
    for (const s of saved) { const m = new Mob(s.type, s.x, s.y, s.z); m.hp = s.hp; mobs.push(m); }
    return;
  }
  if (spawnedChunks.has(c.key)) return;
  spawnedChunks.add(c.key);
  const rng = mulberry32(SEED ^ Math.imul(c.cx, 73856093) ^ Math.imul(c.cz, 19349663));
  if (rng() > 0.1 || passiveCount() >= MAX_PASSIVE) return;
  const biome = c.biomes[8 * CS + 8], kinds = PASSIVE_BY_BIOME[biome];
  if (!kinds) return;
  const type = kinds[Math.floor(rng() * kinds.length)];
  let n = Math.min(MAX_ANIMALS_PER_CHUNK, 2 + Math.floor(rng() * 3));
  for (let i = 0; i < n * 3 && passiveCount() < MAX_PASSIVE; i++) {
    const lx = Math.floor(rng() * 16), lz = Math.floor(rng() * 16);
    const y = c.heights[lz * CS + lx];
    const top = c.blocks[lidx(lx, y, lz)];
    if (top !== B.GRASS && top !== B.SNOW || y >= H - 3) continue;
    if (c.blocks[lidx(lx, y + 1, lz)] !== B.AIR || c.blocks[lidx(lx, y + 2, lz)] !== B.AIR) continue;
    mobs.push(new Mob(type, c.cx * CS + lx + 0.5, y + 1, c.cz * CS + lz + 0.5));
    if (--n <= 0) break;
  }
};
world.onChunkUnloaded = (c) => {
  const x0 = c.cx * CS, z0 = c.cz * CS;
  const saved = [];
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.pos.x < x0 || m.pos.x >= x0 + CS || m.pos.z < z0 || m.pos.z >= z0 + CS) continue;
    if (!m.def.hostile && !m.dead && world.realm === 'overworld') saved.push({ type: m.type, x: m.pos.x, y: m.pos.y, z: m.pos.z, hp: m.hp });
    m.remove(); mobs.splice(i, 1);
  }
  if (saved.length) entityStore.set(c.key, saved);
};

// True when a mob of `def` size fits at (x, y, z): its full height is clear, and a wide mob's
// neighbour cells are clear too.
function spawnRoom(x, y, z, def) {
  const r = def.w > 1 ? 1 : 0;
  for (let dy = 0; dy < Math.ceil(def.h); dy++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    const id = world.getBlock(x + dx, y + dy, z + dz);
    if (SOLID[id] || LIQ_KIND[id] || id === UNLOADED) return false;
  }
  return true;
}
let spawnTimer = 0;
function spawnHostiles(dt) {
  spawnTimer -= dt;
  if (spawnTimer > 0 || player.dead || world.realm !== 'overworld') return;
  spawnTimer = 0.35;
  if (hostileCount() >= MAX_HOSTILE) return;
  for (let attempt = 0; attempt < 6; attempt++) {
    const a = Math.random() * Math.PI * 2, r = randRange(24, 44);
    const x = Math.floor(player.pos.x + Math.sin(a) * r), z = Math.floor(player.pos.z + Math.cos(a) * r);
    const c = world.chunkAt(x, z);
    if (!c || !c.meshed) continue;
    const top = c.heights[(z & 15) * CS + (x & 15)];
    let y = randInt(2, Math.min(H - 3, top + 1));
    while (y > 1 && !SOLID[world.getBlock(x, y - 1, z)]) y--;
    const below = world.getBlock(x, y - 1, z);
    if (!OPAQUE[below] || below === B.BEDROCK || IS_LEAF[below]) continue;
    const b0 = world.getBlock(x, y, z), b1 = world.getBlock(x, y + 1, z);
    if (SOLID[b0] || SOLID[b1] || LIQ_KIND[b0] || LIQ_KIND[b1]) continue;
    if (Math.hypot(x + 0.5 - player.pos.x, y - player.pos.y, z + 0.5 - player.pos.z) < 24) continue;
    // a cave below y 40 (no sky light) spawns a Magma Brute 1 time in 8, in any light
    const cave = y < 40 && world.getSky(x, y, z) === 0;
    let type;
    if (cave && Math.random() < 1 / 8) type = 'brute';
    else {
      const light = Math.max(Math.round(world.getSky(x, y, z) * game.daylight), world.getBlk(x, y, z));
      if (light > 7) continue;
      const r = Math.random();
      type = r < 0.35 ? 'zombie' : r < 0.65 ? 'skeleton' : r < 0.85 ? 'creeper' : 'spider';
    }
    if (!spawnRoom(x, y, z, MOB_TYPES[type])) continue;
    mobs.push(new Mob(type, x + 0.5, y, z + 0.5));
    return;
  }
}

// ---- spawners (Batch 17) -------------------------------------------------------------------
// A spawner is a spawner feature of its chunk whose block is still B.SPAWNER. Every SCAN s the
// module scans the chunks within 3 of the player's chunk. A spawner within RANGE blocks of the
// player, with light <= LIGHT_MAX and no torch on its 6 sides, spawns 1..3 mobs of its type every
// 5..15 s in free cells up to 4 blocks away. MAX_HOSTILE caps it like natural spawns. Each spawner
// in the scan shows a small spinning model of its mob. The model goes when the spawner leaves the
// scan or breaks.
const spawners = (() => {
  const live = new Map();   // "x,y,z" -> { f, timer, active, model: { group, mats } }
  const SCAN = 0.25, RANGE = 16, LIGHT_MAX = 9;
  let scanT = 0;
  function makeModel(f) {
    const owner = { mats: [] }, group = new THREE.Group(), body = new THREE.Group();
    const M = (key) => { const m = new THREE.MeshBasicMaterial({ map: MOB_TEXTURES[key]() }); owner.mats.push(m); return m; };
    MOB_TYPES[f.type].build(body, M, owner);
    body.scale.setScalar(f.type === 'spider' ? 0.42 : 0.36);
    group.add(body);
    group.position.set(f.x + 0.5, f.y + 0.12, f.z + 0.5);
    scene.add(group);
    return { group, mats: owner.mats };
  }
  function forget(k, s) {
    scene.remove(s.model.group);
    s.model.group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
    for (const m of s.model.mats) m.dispose();
    live.delete(k);
  }
  const torchBeside = (x, y, z) => FACE_NORMAL.some(([dx, dy, dz]) => baseOf(world.getBlock(x + dx, y + dy, z + dz)) === B.TORCH);
  const lightAt = (x, y, z) => Math.max(Math.round(world.getSky(x, y, z) * game.daylight), world.getBlk(x, y, z));
  function tick(s, dt) {
    const f = s.f, p = player.pos;
    const near = !player.dead && Math.hypot(f.x + 0.5 - p.x, f.y + 0.5 - p.y, f.z + 0.5 - p.z) <= RANGE;
    s.active = near && lightAt(f.x, f.y, f.z) <= LIGHT_MAX && !torchBeside(f.x, f.y, f.z);
    if (!s.active) return;
    if (Math.random() < 0.5) particles.fire(f.x + 0.5, f.y + 0.3, f.z + 0.5, 0.7);
    if ((s.timer -= dt) > 0) return;
    s.timer = randRange(5, 15);
    const def = MOB_TYPES[f.type], n = randInt(1, 3);
    for (let i = 0, made = 0; i < 16 && made < n && hostileCount() < MAX_HOSTILE; i++) {
      // A random (x, z) within 4 blocks; the lowest of the 3 levels around the spawner that has a floor.
      const x = f.x + randInt(-4, 4), z = f.z + randInt(-4, 4);
      let y = f.y - 1;
      while (y <= f.y + 1 && !(SOLID[world.getBlock(x, y - 1, z)] && spawnRoom(x, y, z, def))) y++;
      if (y > f.y + 1) continue;
      mobs.push(new Mob(f.type, x + 0.5, y, z + 0.5));
      particles.poof(x + 0.5, y + 0.5, z + 0.5);
      made++;
    }
  }
  function update(dt) {
    for (const s of live.values()) s.model.group.rotation.y += dt * (s.active ? 3 : 1);
    if ((scanT -= dt) > 0) return;
    scanT = SCAN;
    const pcx = Math.floor(player.pos.x / CS), pcz = Math.floor(player.pos.z / CS), seen = new Set();
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const c = world.chunkAt((pcx + dx) * CS, (pcz + dz) * CS);
      if (!c || !c.meshed) continue;
      for (const f of c.features) {
        if (f.kind !== 'spawner' || world.getBlock(f.x, f.y, f.z) !== B.SPAWNER) continue;
        const k = `${f.x},${f.y},${f.z}`;
        let s = live.get(k);
        if (!s) { s = { f, timer: randRange(1, 4), active: false, model: makeModel(f) }; live.set(k, s); }
        seen.add(k);
        const l = Math.max(0.12, world.brightnessAt(f.x, f.y, f.z, game.daylight));
        for (const m of s.model.mats) m.color.setScalar(l);
        tick(s, SCAN);
      }
    }
    for (const [k, s] of live) if (!seen.has(k)) forget(k, s);
  }
  function clear() { for (const [k, s] of live) forget(k, s); }
  return { update, live, clear };
})();

export { hostileCount, spawners, spawnHostiles };
