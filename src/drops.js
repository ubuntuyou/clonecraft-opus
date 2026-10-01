// ---- dropped items -------------------------------------------------------------------
// A drop is a small spinning item model with physics. The player collects it on contact.
import { THREE } from './three.js';
import { randRange } from './config.js';
import { IS_LAVA, IS_WATER, ITEMS } from './blocks.js';
import { game, player, scene, world } from './engine.js';
import { moveEntity } from './collision.js';
import { makeItemMesh, inv, particles, audio } from './order.js';

const drops = [];
class Drop {
  constructor(id, count, dur, x, y, z, vel, delay) {
    this.id = id; this.count = count; this.dur = dur;
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = vel ? vel.clone() : new THREE.Vector3(randRange(-1, 1), 3, randRange(-1, 1));
    this.w = 0.25; this.h = 0.25;
    this.age = 0; this.delay = delay; this.spin = Math.random() * 6.28;
    this.mesh = makeItemMesh(id);
    this.mesh.scale.setScalar(this.mesh.userData.textured ? 0.25 : 0.4);
    scene.add(this.mesh);
  }
  remove() { scene.remove(this.mesh); this.mesh.material.dispose(); }
}
// Distance from the player's middle at which a drop flies to the player. A drop the player
// throws (dropStack) uses the short range, so it does not come back while the player stands still.
const PICKUP_RANGE = 3.3, THROWN_PICKUP_RANGE = 1.8;
function spawnDrop(id, count, x, y, z, vel, delay = 0.5, dur, ench) {
  if (drops.length > 400) { drops[0].remove(); drops.shift(); }
  const d = new Drop(id, count, dur, x, y, z, vel, delay);
  if (ench) d.ench = { ...ench };
  drops.push(d);
  return d;
}
function updateDrops(dt) {
  const px = player.pos.x, py = player.pos.y + 0.9, pz = player.pos.z;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.age += dt;
    const c = world.chunkAt(Math.floor(d.pos.x), Math.floor(d.pos.z));
    if (d.age > 300) { d.remove(); drops.splice(i, 1); continue; }
    if (!c || !c.lit) continue;
    const dx = px - d.pos.x, dy = py - d.pos.y, dz = pz - d.pos.z, dist = Math.hypot(dx, dy, dz);
    if (!player.dead && d.age > d.delay && dist < (d.thrown ? THROWN_PICKUP_RANGE : PICKUP_RANGE)) {
      // magnet toward the player, then collect
      const k = Math.min(1, dt * 12);
      d.pos.x += dx * k; d.pos.y += dy * k; d.pos.z += dz * k;
      if (dist < 0.7) {
        const left = inv.add(d.id, d.count, d.dur, d.ench);
        if (left < d.count) audio.pop();
        if (left === 0) { d.remove(); drops.splice(i, 1); continue; }
        d.count = left; d.delay = d.age + 1;
      }
    } else {
      const here = world.getBlock(Math.floor(d.pos.x), Math.floor(d.pos.y + 0.1), Math.floor(d.pos.z));
      if (IS_LAVA[here]) {                        // items burn up in lava
        for (let k = 0; k < 4; k++) particles.fire(d.pos.x, d.pos.y + 0.2, d.pos.z, 0.4);
        audio.fizz(d.pos.x, d.pos.y, d.pos.z);
        d.remove(); drops.splice(i, 1); continue;
      }
      if (IS_WATER[here]) { d.vel.y += (2 - d.vel.y) * Math.min(1, dt * 3); d.vel.x *= Math.exp(-2 * dt); d.vel.z *= Math.exp(-2 * dt); }
      else d.vel.y = Math.max(d.vel.y - 20 * dt, -30);
      moveEntity(d, dt);
      if (d.onGround) { const f = Math.exp(-8 * dt); d.vel.x *= f; d.vel.z *= f; }
    }
    d.spin += dt * 1.8;
    d.mesh.position.set(d.pos.x, d.pos.y + 0.18 + Math.sin(d.age * 2.6) * 0.06, d.pos.z);
    d.mesh.rotation.y = d.spin;
    const l = world.brightnessAt(Math.floor(d.pos.x), Math.floor(d.pos.y + 0.2), Math.floor(d.pos.z), game.daylight);
    d.mesh.material.color.setScalar(l);
  }
  // merge nearby identical stacks every so often (keeps mass drops cheap)
  if (Math.random() < dt * 2) {
    for (let i = 0; i < drops.length; i++) for (let j = i + 1; j < drops.length; j++) {
      const a = drops[i], b = drops[j];
      if (a.id !== b.id || a.dur !== undefined || b.dur !== undefined) continue;
      if (a.count + b.count > ITEMS[a.id].maxStack || a.pos.distanceToSquared(b.pos) > 0.6) continue;
      a.count += b.count; a.thrown = a.thrown || b.thrown; b.remove(); drops.splice(j, 1); j--;
    }
  }
}

export { drops, spawnDrop, updateDrops };
