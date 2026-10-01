/* =====================================================================================
 * === 14. MOB ENTITIES AND AI
 * -------------------------------------------------------------------------------------
 * Models are groups of textured boxes; each limb is a pivot group so it swings about
 * its joint. Models face +Z; yaw = atan2(dx, dz) of the heading.
 * Passive mobs (cow, pig, sheep, chicken) spawn with a chunk when it first loads, wander,
 * flee when hit, and drop items. When their chunk unloads they are saved in
 * `entityStore` and come back when it reloads.
 * Hostile mobs (zombie, creeper) spawn in the dark: light = max(sky * daylight, block) <= 7,
 * so dark caves spawn them by day too. Zombies burn in direct sunlight; creepers under
 * open sky despawn by day. Creepers hiss for 1.5 s near the player, then explode.
 * ===================================================================================== */
import { THREE } from './three.js';
import { clamp, EYE, GRAVITY, JUMP_V, randInt, randRange, UNLOADED } from './config.js';
import { B, I, IS_LAVA, LIQ_KIND, OPAQUE, SOLID } from './blocks.js';
import { mobTexture } from './atlas.js';
import { game, player, scene, world } from './engine.js';
import { damagePlayer, touchesAny } from './player.js';
import { moveEntity } from './collision.js';
import { spawnDrop } from './drops.js';
import { makeItemMesh } from './held-item.js';
import {
  ARROW_GRAVITY, projectiles, explode, spawners, spawnHostiles, particles, audio, weather,
} from './order.js';

const mobs = [];
const MOB_TEX = {};
function mtex(key, base, variance, painter) { return MOB_TEX[key] || (MOB_TEX[key] = mobTexture(base, variance, painter)); }
const eyes = (set, y, x1, x2, white = [240, 240, 240], pupil = [20, 20, 20]) => {
  set(x1, y, white); set(x1 + 1, y, pupil); set(x2, y, pupil); set(x2 + 1, y, white);
  set(x1, y + 1, white); set(x1 + 1, y + 1, pupil); set(x2, y + 1, pupil); set(x2 + 1, y + 1, white);
};
const MOB_TEXTURES = {
  cow_hide: () => mtex('cow_hide', [70, 48, 32], 0.18, (set, r) => {
    for (let k = 0; k < 4; k++) { const cx = r() * 16, cy = r() * 16, rad = 2 + r() * 3; for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - cx, y - cy) < rad) set(x, y, [228, 226, 220]); }
  }),
  cow_face: () => mtex('cow_face', [70, 48, 32], 0.15, (set) => {
    for (let y = 9; y < 16; y++) for (let x = 3; x < 13; x++) set(x, y, [205, 176, 150]);
    set(5, 12, [60, 40, 30]); set(10, 12, [60, 40, 30]);
    eyes(set, 5, 2, 12); for (let y = 0; y < 4; y++) for (let x = 5; x < 11; x++) set(x, y, [230, 228, 222]);
  }),
  horn: () => mtex('horn', [220, 214, 196], 0.08),
  pig_skin: () => mtex('pig_skin', [238, 164, 164], 0.1),
  pig_face: () => mtex('pig_face', [238, 164, 164], 0.08, (set) => eyes(set, 6, 2, 12)),
  pig_snout: () => mtex('pig_snout', [214, 128, 132], 0.06, (set) => { for (let y = 5; y < 11; y++) { set(4, y, [110, 60, 60]); set(5, y, [110, 60, 60]); set(10, y, [110, 60, 60]); set(11, y, [110, 60, 60]); } }),
  wool: () => mtex('wool', [234, 234, 230], 0.14, (set, r) => { for (let i = 0; i < 40; i++) set(r() * 16 | 0, r() * 16 | 0, [205, 205, 200]); }),
  sheep_face: () => mtex('sheep_face', [200, 172, 150], 0.1, (set) => { eyes(set, 6, 2, 12); for (let x = 6; x < 10; x++) set(x, 11, [160, 120, 110]); }),
  sheep_skin: () => mtex('sheep_skin', [200, 172, 150], 0.1),
  chicken: () => mtex('chicken', [246, 246, 244], 0.06),
  chicken_face: () => mtex('chicken_face', [246, 246, 244], 0.05, (set) => { for (let y = 5; y < 8; y++) { set(2, y, [20, 20, 20]); set(13, y, [20, 20, 20]); } }),
  beak: () => mtex('beak', [240, 172, 40], 0.1),
  wattle: () => mtex('wattle', [200, 30, 30], 0.1),
  chick_leg: () => mtex('chick_leg', [230, 160, 30], 0.1),
  z_skin: () => mtex('z_skin', [92, 142, 78], 0.14),
  z_face: () => mtex('z_face', [92, 142, 78], 0.12, (set) => {
    for (let y = 7; y < 9; y++) for (const x of [3, 4, 11, 12]) set(x, y, [20, 30, 20]);
    for (let x = 6; x < 10; x++) set(x, 12, [50, 70, 45]);
  }),
  z_shirt: () => mtex('z_shirt', [40, 150, 160], 0.14),
  z_pants: () => mtex('z_pants', [62, 62, 150], 0.14),
  sk_bone: () => mtex('sk_bone', [196, 196, 190], 0.1),
  sk_ribs: () => mtex('sk_ribs', [60, 60, 60], 0.1, (set) => {
    for (let y = 1; y < 15; y += 3) for (let x = 2; x < 14; x++) set(x, y, [200, 200, 194]);
    for (let y = 0; y < 16; y++) { set(7, y, [210, 210, 204]); set(8, y, [180, 180, 174]); }
  }),
  sk_face: () => mtex('sk_face', [196, 196, 190], 0.1, (set) => {
    for (let y = 6; y < 9; y++) for (const x of [3, 4, 5, 10, 11, 12]) set(x, y, [24, 24, 24]);
    set(7, 10, [60, 60, 60]); set(8, 10, [60, 60, 60]);
    for (let x = 4; x < 12; x++) set(x, 13, x % 2 ? [70, 70, 70] : [150, 150, 146]);
  }),
  sp_body: () => mtex('sp_body', [50, 42, 38], 0.35, (set, r) => { for (let i = 0; i < 30; i++) set(r() * 16 | 0, r() * 16 | 0, [30, 26, 24]); }),
  sp_face: () => mtex('sp_face', [50, 42, 38], 0.3, (set) => {
    const red = [220, 20, 20], dim = [150, 16, 16];
    for (const [x, y] of [[4, 6], [11, 6], [6, 5], [9, 5]]) { set(x, y, red); set(x + 1, y, red); }
    for (const [x, y] of [[3, 8], [12, 8], [6, 8], [9, 8]]) set(x, y, dim);
    for (let x = 6; x < 10; x++) set(x, 12, [20, 16, 14]);
  }),
  sp_leg: () => mtex('sp_leg', [40, 34, 30], 0.3),
  mb_skin: () => mtex('mb_skin', [58, 26, 18], 0.3, (set, r) => {
    for (let k = 0; k < 4; k++) {   // glowing cracks
      let x = r() * 16, y = r() * 16;
      for (let i = 0; i < 9; i++) { set(x | 0, y | 0, i % 3 ? [255, 120, 20] : [255, 200, 70]); x += r() * 2 - 0.5; y += r() * 2 - 1; }
    }
  }),
  mb_face: () => mtex('mb_face', [58, 26, 18], 0.3, (set) => {
    for (let y = 6; y < 8; y++) for (const x of [3, 4, 5, 10, 11, 12]) set(x, y, [255, 220, 90]);
    for (let x = 4; x < 12; x++) set(x, 11, [255, 110, 20]);
    for (let x = 5; x < 11; x++) set(x, 12, [120, 30, 10]);
  }),
  mb_core: () => mtex('mb_core', [255, 150, 40], 0.3),
  c_skin: () => mtex('c_skin', [86, 172, 74], 0.5, (set, r) => { for (let i = 0; i < 50; i++) set(r() * 16 | 0, r() * 16 | 0, r() < 0.5 ? [40, 90, 40] : [170, 220, 160]); }),
  c_face: () => mtex('c_face', [86, 172, 74], 0.45, (set) => {
    const k = [16, 22, 16];
    for (let y = 4; y < 8; y++) for (const x of [3, 4, 5, 6, 9, 10, 11, 12]) set(x, y, k);
    for (let y = 8; y < 11; y++) for (let x = 6; x < 10; x++) set(x, y, k);
    for (let y = 10; y < 14; y++) { set(5, y, k); set(10, y, k); if (y < 13) { set(6, y, k); set(9, y, k); } }
  }),
};

// Builds a pivot group at (px, py, pz) holding a box of size (w, h, d) offset by (ox, oy, oz).
function limb(parent, M, w, h, d, faces, px, py, pz, ox = 0, oy = 0, oz = 0) {
  const g = new THREE.Group();
  g.position.set(px, py, pz);
  const mats = Array.isArray(faces) ? faces.map((f) => M(f)) : M(faces);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
  mesh.position.set(ox, oy, oz);
  g.add(mesh);
  parent.add(g);
  return g;
}
const headFaces = (side, front) => [side, side, side, side, front, side];

const MOB_TYPES = {
  cow: {
    hostile: false, hp: 10, w: 0.9, h: 1.4, speed: 1.2, sound: 'moo',
    drops: () => [[I.BEEF, randInt(1, 3)], [I.LEATHER, randInt(0, 2)]],
    build(root, M) {
      limb(root, M, 0.75, 0.625, 1.125, 'cow_hide', 0, 1.06, 0);
      const head = limb(root, M, 0.5, 0.5, 0.375, headFaces('cow_hide', 'cow_face'), 0, 1.2, 0.56, 0, 0, 0.19);
      limb(head, M, 0.08, 0.18, 0.08, 'horn', 0.27, 0.28, 0.1); limb(head, M, 0.08, 0.18, 0.08, 'horn', -0.27, 0.28, 0.1);
      const legs = [[-0.22, 0.4], [0.22, 0.4], [-0.22, -0.4], [0.22, -0.4]].map(([x, z]) => limb(root, M, 0.25, 0.75, 0.25, 'cow_hide', x, 0.75, z, 0, -0.375, 0));
      return { head, legs };
    },
  },
  pig: {
    hostile: false, hp: 10, w: 0.9, h: 0.9, speed: 1.2, sound: 'oink',
    drops: () => [[I.PORK, randInt(1, 3)]],
    build(root, M) {
      limb(root, M, 0.625, 0.5, 1.0, 'pig_skin', 0, 0.62, 0);
      const head = limb(root, M, 0.5, 0.5, 0.5, headFaces('pig_skin', 'pig_face'), 0, 0.75, 0.45, 0, 0, 0.25);
      limb(head, M, 0.25, 0.19, 0.07, 'pig_snout', 0, -0.06, 0.53);
      const legs = [[-0.18, 0.32], [0.18, 0.32], [-0.18, -0.32], [0.18, -0.32]].map(([x, z]) => limb(root, M, 0.25, 0.375, 0.25, 'pig_skin', x, 0.375, z, 0, -0.1875, 0));
      return { head, legs };
    },
  },
  sheep: {
    hostile: false, hp: 8, w: 0.9, h: 1.3, speed: 1.15, sound: 'baa',
    drops: () => [[I.MUTTON, randInt(1, 2)], [B.WOOL, 1]],
    build(root, M) {
      limb(root, M, 0.8, 0.7, 1.1, 'wool', 0, 1.0, 0);
      const head = limb(root, M, 0.375, 0.375, 0.5, headFaces('sheep_skin', 'sheep_face'), 0, 1.15, 0.5, 0, 0, 0.22);
      limb(head, M, 0.44, 0.2, 0.3, 'wool', 0, 0.18, 0.12);
      const legs = [[-0.2, 0.36], [0.2, 0.36], [-0.2, -0.36], [0.2, -0.36]].map(([x, z]) => limb(root, M, 0.22, 0.75, 0.22, 'sheep_skin', x, 0.75, z, 0, -0.375, 0));
      return { head, legs };
    },
  },
  chicken: {
    hostile: false, hp: 4, w: 0.4, h: 0.7, speed: 1.0, sound: 'cluck',
    drops: () => [[I.CHICKEN, 1], [I.FEATHER, randInt(0, 2)]],
    build(root, M) {
      limb(root, M, 0.375, 0.375, 0.5, 'chicken', 0, 0.5, 0);
      const head = limb(root, M, 0.25, 0.375, 0.19, headFaces('chicken', 'chicken_face'), 0, 0.62, 0.22, 0, 0.12, 0.05);
      limb(head, M, 0.25, 0.12, 0.13, 'beak', 0, 0.12, 0.2);
      limb(head, M, 0.12, 0.12, 0.07, 'wattle', 0, 0.0, 0.18);
      const wings = [-0.21, 0.21].map((x) => limb(root, M, 0.06, 0.25, 0.37, 'chicken', x, 0.62, 0, 0, -0.12, 0));
      const legs = [-0.08, 0.08].map((x) => limb(root, M, 0.06, 0.31, 0.06, 'chick_leg', x, 0.31, 0.03, 0, -0.155, 0));
      return { head, legs, wings };
    },
  },
  zombie: {
    hostile: true, hp: 20, w: 0.6, h: 1.95, speed: 2.4, sound: 'groan', damage: 3, burns: true, kill: 'was slain by a zombie',
    drops: () => [[I.FLESH, randInt(0, 2)]],
    build(root, M) {
      limb(root, M, 0.5, 0.75, 0.25, 'z_shirt', 0, 1.125, 0);
      const head = limb(root, M, 0.5, 0.5, 0.5, headFaces('z_skin', 'z_face'), 0, 1.5, 0, 0, 0.25, 0);
      const arms = [-0.375, 0.375].map((x) => limb(root, M, 0.25, 0.75, 0.25, 'z_skin', x, 1.375, 0, 0, -0.3, 0));
      for (const a of arms) a.rotation.x = -Math.PI / 2;
      const legs = [-0.125, 0.125].map((x) => limb(root, M, 0.25, 0.75, 0.25, 'z_pants', x, 0.75, 0, 0, -0.375, 0));
      return { head, legs, arms };
    },
  },
  skeleton: {
    hostile: true, hp: 20, w: 0.6, h: 1.95, speed: 2.4, sound: 'rattle', burns: true, ranged: true,
    drops: () => [[I.BONE, randInt(0, 2)], [I.ARROW, randInt(0, 2)], [I.BOW, Math.random() < 0.05 ? 1 : 0]],
    build(root, M, mob) {
      limb(root, M, 0.5, 0.75, 0.25, 'sk_ribs', 0, 1.125, 0);
      const head = limb(root, M, 0.5, 0.5, 0.5, headFaces('sk_bone', 'sk_face'), 0, 1.5, 0, 0, 0.25, 0);
      const arms = [-0.3125, 0.3125].map((x) => limb(root, M, 0.125, 0.75, 0.125, 'sk_bone', x, 1.375, 0, 0, -0.3, 0));
      const legs = [-0.125, 0.125].map((x) => limb(root, M, 0.125, 0.75, 0.125, 'sk_bone', x, 0.75, 0, 0, -0.375, 0));
      // a bow in the left hand, held upright across the arm
      const b = makeItemMesh(I.BOW); b.userData.shared = true; mob.mats.push(b.material);
      b.scale.setScalar(0.7); b.position.set(0, -0.62, 0.05); b.rotation.set(Math.PI / 2, Math.PI / 2, -Math.PI / 4);
      arms[1].add(b);
      return { head, legs, arms };
    },
  },
  spider: {
    hostile: true, hp: 16, w: 1.4, h: 0.9, speed: 3.2, sound: 'hiss', damage: 2, reach: 1.5, climbs: true, brightNeutral: 12,
    kill: 'was slain by a spider',
    drops: () => [[I.STRING, randInt(0, 2)]],
    build(root, M) {
      limb(root, M, 0.75, 0.6, 0.8, 'sp_body', 0, 0.55, -0.45);
      limb(root, M, 0.42, 0.4, 0.42, 'sp_body', 0, 0.5, 0.12);
      const head = limb(root, M, 0.5, 0.5, 0.5, headFaces('sp_body', 'sp_face'), 0, 0.52, 0.32, 0, 0, 0.25);
      // 8 legs: 4 per side, fanned from front to back; each one bends down to the ground
      const spiderLegs = [];
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? 1 : -1, k = i % 4;
        const l = limb(root, M, 0.9, 0.1, 0.1, 'sp_leg', side * 0.2, 0.52, 0.28 - k * 0.14, side * 0.45, 0, 0);
        l.userData.fan = (0.6 - k * 0.4) * side; l.userData.side = side; l.userData.k = k;
        spiderLegs.push(l);
      }
      return { head, legs: [], spiderLegs };
    },
  },
  brute: {
    hostile: true, hp: 40, w: 1.0, h: 2.2, speed: 1.6, sound: 'rumble', damage: 7, reach: 1.45, kbRes: 0.8, fireproof: true,
    glow: 0.85, armBase: 0, kill: 'was crushed by a Magma Brute',
    drops: () => [[I.MAGMA_CORE, 1], [I.COAL, randInt(0, 2)]],
    build(root, M) {
      limb(root, M, 1.0, 0.9, 0.6, 'mb_skin', 0, 1.4, 0);
      limb(root, M, 0.34, 0.3, 0.1, 'mb_core', 0, 1.5, 0.3);
      const head = limb(root, M, 0.55, 0.55, 0.55, headFaces('mb_skin', 'mb_face'), 0, 1.82, 0.12, 0, 0.2, 0.05);
      const arms = [-0.68, 0.68].map((x) => limb(root, M, 0.36, 1.15, 0.36, 'mb_skin', x, 1.8, 0, 0, -0.52, 0));
      const legs = [-0.25, 0.25].map((x) => limb(root, M, 0.38, 0.95, 0.38, 'mb_skin', x, 0.95, 0, 0, -0.475, 0));
      return { head, legs, arms };
    },
  },
  creeper: {
    hostile: true, hp: 20, w: 0.6, h: 1.7, speed: 2.1, sound: null,
    drops: () => [[I.GUNPOWDER, randInt(0, 2)]],
    build(root, M) {
      limb(root, M, 0.5, 0.75, 0.25, 'c_skin', 0, 0.75, 0);
      const head = limb(root, M, 0.5, 0.5, 0.5, headFaces('c_skin', 'c_face'), 0, 1.125, 0, 0, 0.25, 0);
      const legs = [[-0.125, 0.25], [0.125, 0.25], [-0.125, -0.25], [0.125, -0.25]].map(([x, z]) => limb(root, M, 0.25, 0.375, 0.25, 'c_skin', x, 0.375, z * 0.9, 0, -0.1875, 0));
      return { head, legs };
    },
  },
};

const angleLerp = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2; return a + d * t; };

class Mob {
  constructor(type, x, y, z) {
    const def = MOB_TYPES[type];
    this.type = type; this.def = def;
    this.pos = new THREE.Vector3(x, y, z); this.vel = new THREE.Vector3();
    this.w = def.w; this.h = def.h;
    this.hp = def.hp; this.dead = false; this.deathT = 0;
    this.yaw = Math.random() * Math.PI * 2; this.headYaw = 0;
    this.invuln = 0; this.hurtT = 0; this.fleeT = 0; this.attackCD = 0; this.armT = 0;
    this.fuse = 0; this.burnT = 0; this.sunT = 0;
    this.wanderT = randRange(0, 3); this.goal = null; this.walkPhase = 0; this.walkAmt = 0;
    this.soundT = randRange(4, 14); this.age = 0;
    this.onGround = false; this.hitWall = false; this.inWater = false; this.stepH = 0.6;
    this.mats = [];
    const M = (key) => { const m = new THREE.MeshBasicMaterial({ map: MOB_TEXTURES[key]() }); this.mats.push(m); return m; };
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.shootCD = randRange(1, 2); this.leapCD = 0; this.strafe = 1; this.strafeT = 0; this.angry = false; this.seeT = 0; this.sees = false;
    this.parts = def.build(this.body, M, this);
    scene.add(this.group);
  }

  remove() {
    scene.remove(this.group);
    this.group.traverse((o) => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); });
    for (const m of this.mats) m.dispose();
  }

  hurt(dmg, dir, kb = 1) {
    if (this.dead || this.invuln > 0) return;
    this.hp -= dmg; this.invuln = 0.5; this.hurtT = 0.35; this.angry = true;
    if (dir) {
      const k = kb * (1 - (this.def.kbRes || 0));
      this.vel.x += dir.x * 6 * k; this.vel.z += dir.z * 6 * k; this.vel.y = Math.max(this.vel.y, 4.5 * (1 - (this.def.kbRes || 0) * 0.7));
    }
    if (!this.def.hostile) { this.fleeT = 5; this.goal = null; }
    audio.mob(this.type, this.pos, true);
    if (this.hp <= 0) this.die();
  }

  die() {
    this.dead = true; this.deathT = 0;
    for (const [id, n] of this.def.drops()) if (n > 0) spawnDrop(id, n, this.pos.x, this.pos.y + 0.5, this.pos.z, null, 0.6);
  }

  update(dt) {
    this.age += dt;
    if (this.dead) {
      this.deathT += dt;
      this.body.rotation.z = Math.min(Math.PI / 2, this.deathT * 5);
      this.paint(1, 0.4, 0.4);
      if (this.deathT > 0.9) { particles.poof(this.pos.x, this.pos.y + this.h / 2, this.pos.z, this.w); return false; }
      return true;
    }
    const c = world.chunkAt(Math.floor(this.pos.x), Math.floor(this.pos.z));
    if (!c || !c.lit) return true;               // frozen until its terrain is back
    this.invuln -= dt; this.hurtT -= dt; this.fleeT -= dt; this.attackCD -= dt; this.armT -= dt;
    const def = this.def, p = player;
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dy = p.pos.y - this.pos.y;
    const dist = Math.hypot(dx, dz), dist3 = Math.hypot(dx, dy, dz);

    // ---- despawn rules
    if (def.hostile) {
      if (dist3 > 96 || (dist3 > 40 && Math.random() < dt / 30)) return false;
    }
    // ---- sunlight
    const hx = Math.floor(this.pos.x), hy = Math.floor(this.pos.y + this.h - 0.1), hz = Math.floor(this.pos.z);
    const inSun = game.clearDaylight > 0.75 && world.getSky(hx, hy, hz) >= 15 && !this.inWater && !weather.wetAt(hx, hz);
    if (def.burns && inSun) {
      this.burnT -= dt;
      if (Math.random() < dt * 14) particles.fire(this.pos.x, this.pos.y + randRange(0.2, this.h), this.pos.z, this.w);
      if (this.burnT <= 0) { this.burnT = 1; this.invuln = 0; this.hurt(1, null); if (this.dead) return true; }
    }
    if (this.type === 'creeper' && inSun) {
      this.sunT += dt;
      if (this.sunT > 4 && Math.random() < dt / 4) { particles.poof(this.pos.x, this.pos.y + 0.8, this.pos.z, 0.6); return false; }
    }

    // ---- decide a heading
    let mx = 0, mz = 0, speed = def.speed, lookAtPlayer = false;
    // a spider in bright light stays neutral until the player hits it
    const calm = def.brightNeutral && !this.angry
      && Math.max(Math.round(world.getSky(hx, hy, hz) * game.daylight), world.getBlk(hx, hy, hz)) >= def.brightNeutral;
    const canChase = def.hostile && !calm && !p.dead && dist3 < 16 && game.state !== 'paused';
    if (canChase) {
      mx = dx / (dist || 1); mz = dz / (dist || 1); lookAtPlayer = true;
      if (def.ranged) {
        // keep 6..12 blocks away and strafe; shoot every 2 s while the player is in sight
        if ((this.seeT -= dt) <= 0) { this.seeT = 0.25; this.sees = lineOfSight(this.pos.x, this.pos.y + 1.6, this.pos.z, p.pos.x, p.pos.y + EYE, p.pos.z); }
        if ((this.strafeT -= dt) <= 0) { this.strafeT = randRange(1.5, 3.5); this.strafe = Math.random() < 0.5 ? -1 : 1; }
        const ux = mx, uz = mz;
        if (dist < 6) { mx = -ux; mz = -uz; }
        else if (dist <= 12 && this.sees) { mx = uz * this.strafe * 0.5; mz = -ux * this.strafe * 0.5; }
        this.shootCD -= dt;
        if (this.sees && this.shootCD <= 0) { this.shootAt(p); this.shootCD = 2; }
      } else if (this.type === 'creeper') {
        if (dist3 < 3) { if (this.fuse === 0) audio.hiss(this.pos); this.fuse += dt; mx = mz = 0; }
        else if (this.fuse > 0) { this.fuse = Math.max(0, this.fuse - dt); if (dist3 < 7) { mx = mz = 0; } }
        if (this.fuse >= 1.5) { explode(this.pos.x, this.pos.y + 0.8, this.pos.z, 3); return false; }
      } else if (dist < (def.reach || 1.1) && Math.abs(dy) < 1.6 && this.attackCD <= 0) {
        damagePlayer(def.damage, def.kill, this.pos, 'mob');
        this.attackCD = 1; this.armT = 0.3;
      }
      if (def.climbs && this.onGround && this.leapCD <= 0 && dist > 2 && dist < 4 && Math.abs(dy) < 1.5) {
        this.vel.x = mx * 7; this.vel.z = mz * 7; this.vel.y = 5.5; this.leapCD = randRange(2, 3.5);   // the spider leaps
      }
      if (dist < (def.reach || 1.1) * 0.75 && !def.ranged) { mx = mz = 0; }
    } else {
      if (this.type === 'creeper') this.fuse = Math.max(0, this.fuse - dt);
      if (this.fleeT > 0) {
        if (!this.goal || this.wanderT <= 0) {
          const a = Math.atan2(-dx, -dz) + randRange(-0.8, 0.8);
          this.goal = { x: this.pos.x + Math.sin(a) * 8, z: this.pos.z + Math.cos(a) * 8 }; this.wanderT = 1;
        }
        speed *= 2.1;
      } else if (this.wanderT <= 0) {
        this.wanderT = randRange(3, 9);
        if (Math.random() < 0.6) { const a = Math.random() * Math.PI * 2, r = randRange(3, 8); this.goal = { x: this.pos.x + Math.sin(a) * r, z: this.pos.z + Math.cos(a) * r }; }
        else this.goal = null;
      }
      this.wanderT -= dt;
      if (this.goal) {
        const gx = this.goal.x - this.pos.x, gz = this.goal.z - this.pos.z, gd = Math.hypot(gx, gz);
        if (gd < 0.5) this.goal = null; else { mx = gx / gd; mz = gz / gd; }
      }
      if (!def.hostile && dist3 < 6 && !this.goal && this.fleeT <= 0) lookAtPlayer = true;
      // stay away from drops of 3+ blocks and (for passive mobs) open water
      if (mx || mz) {
        const ax = Math.floor(this.pos.x + mx * 0.9), az = Math.floor(this.pos.z + mz * 0.9), fy = Math.floor(this.pos.y);
        let drop = 0;
        while (drop < 4 && !SOLID[world.getBlock(ax, fy - 1 - drop, az)] && !LIQ_KIND[world.getBlock(ax, fy - 1 - drop, az)]) drop++;
        const wet = LIQ_KIND[world.getBlock(ax, fy - 1, az)] || LIQ_KIND[world.getBlock(ax, fy, az)];
        const hot = IS_LAVA[world.getBlock(ax, fy - 1, az)] || IS_LAVA[world.getBlock(ax, fy, az)];
        if (drop >= 3 || (hot && !def.fireproof) || (wet && !hot && !this.inWater && this.fleeT <= 0)) { this.goal = null; mx = mz = 0; }
      }
    }

    // ---- physics
    const feet = world.getBlock(Math.floor(this.pos.x), Math.floor(this.pos.y + 0.4), Math.floor(this.pos.z));
    this.inWater = !!LIQ_KIND[feet];
    if (this.inWater) speed *= IS_LAVA[feet] ? (def.fireproof ? 0.8 : 0.35) : 0.6;
    this.leapCD -= dt;
    // lava burns mobs too (not a fireproof mob)
    this.lavaT = (this.lavaT || 0) - dt;
    if (!def.fireproof && this.lavaT <= 0 && touchesAny(this, IS_LAVA)) {
      this.lavaT = 0.5; this.invuln = 0; this.hurt(4, null);
      for (let k = 0; k < 4; k++) particles.fire(this.pos.x, this.pos.y + randRange(0.1, this.h), this.pos.z, this.w);
      if (this.dead) return true;
    }
    const a = 1 - Math.exp(-(this.onGround ? 10 : 3) * dt);
    this.vel.x += (mx * speed - this.vel.x) * a;
    this.vel.z += (mz * speed - this.vel.z) * a;
    if (this.inWater) { this.vel.y += (2.2 - this.vel.y) * Math.min(1, dt * 3); }
    else {
      this.vel.y -= GRAVITY * dt;
      if (this.type === 'chicken') this.vel.y = Math.max(this.vel.y, -2.5);
    }
    if (def.climbs && this.hitWall && (mx || mz)) this.vel.y = 2.6;   // a spider walks up walls
    else if (this.hitWall && this.onGround && (mx || mz)) this.vel.y = JUMP_V * 0.95;
    moveEntity(this, dt);
    // mobs push each other and the player apart
    for (const o of mobs) {
      if (o === this || o.dead) continue;
      const ox = this.pos.x - o.pos.x, oz = this.pos.z - o.pos.z, r = (this.w + o.w) / 2;
      if (Math.abs(ox) < r && Math.abs(oz) < r && Math.abs(this.pos.y - o.pos.y) < 1) {
        const d = Math.hypot(ox, oz) || 0.01; this.vel.x += ox / d * 4 * dt * 10; this.vel.z += oz / d * 4 * dt * 10;
      }
    }
    if (!p.dead && Math.abs(dx) < (this.w + p.w) / 2 && Math.abs(dz) < (this.w + p.w) / 2 && Math.abs(dy) < 1.5) {
      const d = dist || 0.01; p.vel.x += dx / d * dt * 20; p.vel.z += dz / d * dt * 20;
    }

    // ---- animation
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (def.ranged && canChase) this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 8));   // an archer faces its target
    else if (hs > 0.2) this.yaw = angleLerp(this.yaw, Math.atan2(this.vel.x, this.vel.z), Math.min(1, dt * 8));
    else if (lookAtPlayer && canChase) this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), Math.min(1, dt * 6));
    this.walkAmt += ((hs > 0.2 ? 1 : 0) - this.walkAmt) * Math.min(1, dt * 8);
    this.walkPhase += hs * dt * 3.2;
    const sw = Math.sin(this.walkPhase) * 0.7 * this.walkAmt;
    const legs = this.parts.legs;
    // quadrupeds swing diagonal pairs (0,3) and (1,2); bipeds alternate
    legs.forEach((l, i) => { l.rotation.x = (i === 0 || i === 3) ? sw : -sw; });
    const armBase = def.armBase ?? -Math.PI / 2, armSw = def.armBase === 0 ? 0.8 : 0.25, armHit = def.armBase === 0 ? 1.8 : 0.8;
    if (this.parts.arms) this.parts.arms.forEach((ar, i) => { ar.rotation.x = armBase + (i ? sw : -sw) * armSw - (this.armT > 0 ? Math.sin(this.armT / 0.3 * Math.PI) * armHit : 0); });
    if (this.parts.spiderLegs) this.parts.spiderLegs.forEach((l) => {
      const ph = this.walkPhase * 1.6 + l.userData.k * Math.PI / 2 + (l.userData.side > 0 ? 0 : Math.PI);
      l.rotation.y = l.userData.fan + Math.sin(ph) * 0.35 * this.walkAmt;
      l.rotation.z = l.userData.side * (-0.55 + Math.max(0, Math.cos(ph)) * 0.3 * this.walkAmt);
    });
    if (this.parts.wings) { const f = this.onGround ? 0 : Math.abs(Math.sin(this.age * 22)) * 1.1; this.parts.wings[0].rotation.z = f; this.parts.wings[1].rotation.z = -f; }
    let hy2 = 0;
    if (lookAtPlayer) hy2 = clamp(angleLerp(0, Math.atan2(dx, dz) - this.yaw, 1), -1, 1);
    this.headYaw += (hy2 - this.headYaw) * Math.min(1, dt * 6);
    this.parts.head.rotation.y = this.headYaw;
    this.parts.head.rotation.x = lookAtPlayer ? clamp(-Math.atan2(dy + EYE - this.h, dist) * 0.6, -0.6, 0.6) : 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    // creeper swell and flash while the fuse burns
    let flash = 1;
    if (this.fuse > 0) {
      const s = 1 + this.fuse * 0.1 + Math.sin(this.fuse * 18) * 0.02;
      this.body.scale.set(s, 1 + this.fuse * 0.05, s);
      if (Math.floor(this.fuse * 8) % 2 === 0) flash = 2.2;
    } else this.body.scale.set(1, 1, 1);
    const l = world.brightnessAt(hx, Math.floor(this.pos.y + this.h * 0.5), hz, game.daylight);
    const lb = def.glow ? Math.max(l, def.glow) : l;   // a glowing mob ignores darkness
    if (this.hurtT > 0) this.paint(lb * 1.2, lb * 0.45, lb * 0.45); else this.paint(lb * flash, lb * flash, lb * flash);
    if (def.glow && Math.random() < dt * 6) particles.ember(this.pos.x, this.pos.y + 0.3, this.pos.z, this.w, this.h * 0.8);

    // ---- ambient sounds
    this.soundT -= dt;
    if (this.soundT <= 0) { this.soundT = randRange(7, 18); if (def.sound && dist3 < 24) audio.mob(this.type, this.pos, false); }
    return true;
  }

  paint(r, g, b) { for (const m of this.mats) m.color.setRGB(r, g, b); }

  // Skeleton shot: aim at the player's chest, lead the drop by gravity, add a little spread.
  shootAt(p) {
    const ex = this.pos.x, ey = this.pos.y + 1.5, ez = this.pos.z;
    const tx = p.pos.x - ex, ty = p.pos.y + 1.1 - ey, tz = p.pos.z - ez, d = Math.hypot(tx, tz) || 1;
    const V = 26, t = d / V, sp = 0.035 * V;
    const f = 0.45 / d;   // start just outside the skeleton's own box
    projectiles.shoot(ex + tx * f, ey + ty * f, ez + tz * f,
      tx / t + randRange(-sp, sp), ty / t + 0.5 * ARROW_GRAVITY * t + randRange(-sp, sp), tz / t + randRange(-sp, sp), 3, this);
    audio.bow(this.pos, 0.7);
    this.armT = 0.3;
  }
}

// True when no solid block lies on the segment from a to b (sampled every 0.25 blocks).
function lineOfSight(ax, ay, az, bx, by, bz) {
  const d = Math.hypot(bx - ax, by - ay, bz - az), n = Math.ceil(d / 0.25);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const id = world.getBlock(Math.floor(ax + (bx - ax) * t), Math.floor(ay + (by - ay) * t), Math.floor(az + (bz - az) * t));
    if (OPAQUE[id] || id === UNLOADED) return false;
  }
  return true;
}

function updateMobs(dt) {
  for (let i = mobs.length - 1; i >= 0; i--) {
    if (!mobs[i].update(dt)) { mobs[i].remove(); mobs.splice(i, 1); }
  }
  spawnHostiles(dt);
  spawners.update(dt);
}

export { lineOfSight, Mob, MOB_TEXTURES, MOB_TYPES, mobs, updateMobs };
