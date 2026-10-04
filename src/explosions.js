// ---- explosions ------------------------------------------------------------------------
import { THREE } from './three.js';
import { UNLOADED } from './config.js';
import { B, BLOCKS, LIQ_KIND } from './blocks.js';
import { player, scene, world } from './engine.js';
import { damagePlayer } from './player.js';
import { breakBlock } from './interact.js';
import { mobs } from './mobs.js';
import { particles, audio } from './order.js';

function explode(x, y, z, r, cause = 'was blown up by a creeper') {
  audio.explode(x, y, z);
  particles.explosion(x, y, z, r);
  world.beginBatch();
  const R = Math.ceil(r);
  for (let dy = -R; dy <= R; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
    const d = Math.hypot(dx, dy, dz);
    if (d > r - Math.random() * 1.1) continue;
    const bx = Math.floor(x) + dx, by = Math.floor(y) + dy, bz = Math.floor(z) + dz;
    const id = world.getBlock(bx, by, bz);
    if (id === B.AIR || LIQ_KIND[id] || id === UNLOADED || BLOCKS[id].hardness < 0) continue;
    if (id === B.TNT) { primeTnt(bx, by, bz, 0.5 + Math.random()); continue; }   // chain reaction
    const drop = Math.random() < 0.3;
    breakBlock(bx, by, bz, drop, true);
  }
  world.endBatch();
  // damage and knockback fall off with distance (up to twice the radius)
  const hitEntity = (e, isPlayer) => {
    const ex = e.pos.x - x, ey = e.pos.y + e.h / 2 - y, ez = e.pos.z - z;
    const d = Math.hypot(ex, ey, ez);
    if (d >= r * 2) return;
    const f = 1 - d / (r * 2);
    const n = d || 1;
    const kr = isPlayer ? 1 : 1 - (e.def.kbRes || 0);   // a heavy mob resists the push
    e.vel.x += ex / n * f * 14 * kr; e.vel.y += Math.max(3, ey / n * f * 14) * kr; e.vel.z += ez / n * f * 14 * kr;
    const dmg = Math.round(f * 24);
    if (isPlayer) damagePlayer(dmg, cause, null, 'explosion');
    else if (!e.dead) { e.invuln = 0; e.hurt(dmg, null); }
  };
  if (!player.dead) hitEntity(player, true);
  for (const m of mobs) hitEntity(m, false);
}

// ---- TNT --------------------------------------------------------------------------------
// A right click or a torch placed beside it primes TNT. The block stays in the world during the
// fuse and flashes white. When the fuse ends, the block becomes air and explodes. A primed TNT
// that is broken or unloaded is defused. A save never holds the fuse, so a reload keeps the TNT unlit.
const TNT_FUSE = 4, TNT_POWER = 4;
const primedTnt = new Map();   // "x,y,z" -> { x, y, z, t, fuse, mesh, tick }
const tntFlashMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
const tntFlashGeo = new THREE.BoxGeometry(1.01, 1.01, 1.01);
function primeTnt(x, y, z, fuse = TNT_FUSE) {
  const k = `${x},${y},${z}`, cur = primedTnt.get(k);
  if (cur) { cur.t = Math.min(cur.t, fuse); return; }
  if (world.getBlock(x, y, z) !== B.TNT) return;
  const mesh = new THREE.Mesh(tntFlashGeo, tntFlashMat.clone());
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  scene.add(mesh);
  primedTnt.set(k, { x, y, z, t: fuse, fuse, mesh, tick: 0 });
  audio.fuse(x + 0.5, y + 1, z + 0.5);
}
function removeTntFlash(e) { scene.remove(e.mesh); e.mesh.material.dispose(); }
function updateTnt(dt) {
  for (const [k, e] of primedTnt) {
    if (world.getBlock(e.x, e.y, e.z) !== B.TNT) { removeTntFlash(e); primedTnt.delete(k); continue; }
    e.t -= dt;
    if (e.t <= 0) {
      removeTntFlash(e); primedTnt.delete(k);
      world.setBlock(e.x, e.y, e.z, B.AIR);
      explode(e.x + 0.5, e.y + 0.5, e.z + 0.5, TNT_POWER, 'was blown up by TNT');
      continue;
    }
    const age = e.fuse - e.t;
    e.mesh.material.opacity = Math.floor(age * 4) % 2 ? 0 : 0.55;           // flash at 2 Hz
    e.mesh.scale.setScalar(e.t < 0.5 ? 1 + (0.5 - e.t) * 0.16 : 1);         // swell before the blast
    if ((e.tick -= dt) <= 0) { e.tick = 0.3; audio.sizzle(e.x + 0.5, e.y + 1, e.z + 0.5); particles.tntSpark(e.x + 0.5, e.y + 1.02, e.z + 0.5); }
  }
}

// Realm switch: every fuse goes out. The TNT block stays, unlit.
function clearTnt() { for (const e of primedTnt.values()) removeTntFlash(e); primedTnt.clear(); }

export { clearTnt, explode, primedTnt, primeTnt, updateTnt };
