// ---- projectiles ------------------------------------------------------------------------
// An arrow flies with gravity (and drag in liquid). A player arrow (shooter null) hits the first
// mob on its path; a mob arrow hits only the player. An arrow that meets a solid cell sticks there
// for ARROW_STUCK s. The player picks up a stuck player arrow by walking near it. An arrow whose
// block is broken falls again. An arrow in an unloaded chunk, or in flight for ARROW_FLIGHT s, is removed.
// A player arrow deals `def.arrowRes` x its damage to a mob with that field (the Cinder Knight takes half).
// A fireball (SPEC_realms Phase 4) flies straight with no gravity and hits only the player. It bursts
// on the player, on a solid or liquid cell, or after FIREBALL_FLIGHT s. It breaks no block.
import { THREE } from './three.js';
import { H, UNLOADED } from './config.js';
import { I, LIQ_KIND, SOLID } from './blocks.js';
import { HANDLE, MAT_COL } from './atlas.js';
import { game, player, scene, world } from './engine.js';
import { damagePlayer } from './player.js';
import { rayBox, raycastMobs } from './interact.js';
import { inv } from './inventory.js';
import { audio, particles } from './order.js';

const ARROW_GRAVITY = 20, ARROW_STUCK = 30, ARROW_FLIGHT = 10, FIREBALL_SPEED = 12, FIREBALL_FLIGHT = 6;
const projectiles = (() => {
  const list = [];
  // one vertex-coloured geometry along +z: shaft, head, and fletching
  const geo = (() => {
    const pos = [], col = [];
    const box = (w, h, d, x, y, z, c) => {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
      const a = g.getAttribute('position').array;
      for (let i = 0; i < a.length; i += 3) { pos.push(a[i], a[i + 1], a[i + 2]); col.push(c[0] / 255, c[1] / 255, c[2] / 255); }
      g.dispose();
    };
    box(0.035, 0.035, 0.62, 0, 0, 0, HANDLE[1]);
    box(0.07, 0.07, 0.1, 0, 0, 0.33, MAT_COL.stone[1]);
    box(0.03, 0.03, 0.06, 0, 0, 0.4, MAT_COL.stone[2]);
    box(0.13, 0.012, 0.14, 0, 0, -0.25, [236, 236, 236]);
    box(0.012, 0.13, 0.14, 0, 0, -0.25, [220, 220, 220]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  })();
  // a fireball: an orange shell around a yellow core; both always full bright
  const fireShell = new THREE.BoxGeometry(0.34, 0.34, 0.34), fireCore = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const shellMat = new THREE.MeshBasicMaterial({ color: 0xff5a14, transparent: true, opacity: 0.8 });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xffe080 });
  const _t = new THREE.Vector3(), _d = new THREE.Vector3();
  function shoot(x, y, z, vx, vy, vz, dmg, shooter) {
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    const a = { pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(vx, vy, vz), dmg, shooter, stuck: null, age: 0, mesh };
    mesh.position.copy(a.pos); mesh.lookAt(_t.copy(a.pos).add(a.vel));
    scene.add(mesh); list.push(a);
    return a;
  }
  // A fireball from (x, y, z) along the unit direction (dx, dy, dz) at FIREBALL_SPEED.
  function fireball(x, y, z, dx, dy, dz, dmg, shooter) {
    const mesh = new THREE.Group(), shell = new THREE.Mesh(fireShell, shellMat);
    mesh.add(new THREE.Mesh(fireCore, coreMat), shell);
    shell.rotation.set(0.6, 0.6, 0);
    const a = { kind: 'fireball', pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(dx, dy, dz).multiplyScalar(FIREBALL_SPEED),
      dmg, shooter, stuck: null, age: 0, mesh };
    mesh.position.copy(a.pos);
    scene.add(mesh); list.push(a);
    return a;
  }
  function burst(x, y, z) { particles.flameBurst(x, y, z); audio.fireballHit(x, y, z); }
  // Moves a fireball one frame. Returns false when the fireball is gone.
  function flyFireball(a, dt) {
    if (a.age > FIREBALL_FLIGHT) return false;
    const p = player, sx = a.vel.x * dt, sy = a.vel.y * dt, sz = a.vel.z * dt;
    if (!p.dead) {
      const hw = p.w / 2 + 0.17;
      if (rayBox(a.pos.x, a.pos.y, a.pos.z, sx, sy, sz, p.pos.x - hw, p.pos.y - 0.17, p.pos.z - hw, p.pos.x + hw, p.pos.y + p.h + 0.17, p.pos.z + hw, 1)) {
        _d.set(a.vel.x, 0, a.vel.z).normalize();
        damagePlayer(a.dmg, 'was burned by an Ember Wisp', { x: a.pos.x - _d.x, z: a.pos.z - _d.z }, 'fireball');
        burst(a.pos.x, a.pos.y, a.pos.z);
        return false;
      }
    }
    const n = Math.max(1, Math.ceil(Math.hypot(sx, sy, sz) / 0.1));
    for (let k = 1; k <= n; k++) {
      const x = a.pos.x + sx * k / n, y = a.pos.y + sy * k / n, z = a.pos.z + sz * k / n;
      const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
      if (id === UNLOADED) return false;
      if (SOLID[id] || LIQ_KIND[id]) { burst(x - sx / n, y - sy / n, z - sz / n); return false; }
    }
    a.pos.x += sx; a.pos.y += sy; a.pos.z += sz;
    a.mesh.position.copy(a.pos);
    a.mesh.rotation.x += dt * 7; a.mesh.rotation.y += dt * 5;
    if (Math.random() < 0.7) particles.fire(a.pos.x, a.pos.y - 0.1, a.pos.z, 0.2);
    return true;
  }
  function remove(i) { const a = list[i]; scene.remove(a.mesh); if (a.kind !== 'fireball') a.mesh.material.dispose(); list.splice(i, 1); }
  function clear() { for (let i = list.length - 1; i >= 0; i--) remove(i); }
  function stickAt(a, x, y, z, bx, by, bz) {
    a.pos.set(x, y, z); a.stuck = { x: bx, y: by, z: bz }; a.age = 0; a.vel.set(0, 0, 0);
    a.mesh.position.copy(a.pos);
    audio.arrowHit(x, y, z);
  }
  function update(dt) {
    const p = player;
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      a.age += dt;
      const bx = Math.floor(a.pos.x), by = Math.floor(a.pos.y), bz = Math.floor(a.pos.z);
      if (world.getBlock(bx, by, bz) === UNLOADED && by >= 0 && by < H) { remove(i); continue; }
      if (a.kind === 'fireball') { if (!flyFireball(a, dt)) remove(i); continue; }
      a.mesh.material.color.setScalar(Math.max(0.1, world.brightnessAt(bx, by, bz, game.daylight)));
      if (a.stuck) {
        if (a.age > ARROW_STUCK) { remove(i); continue; }
        if (!SOLID[world.getBlock(a.stuck.x, a.stuck.y, a.stuck.z)]) { a.stuck = null; a.age = 0; a.dmg = 0; continue; }   // its block is gone: fall
        if (!a.shooter && !p.dead && a.age > 0.25
          && Math.abs(a.pos.x - p.pos.x) < 1.5 && Math.abs(a.pos.z - p.pos.z) < 1.5 && a.pos.y > p.pos.y - 1 && a.pos.y < p.pos.y + p.h + 0.5
          && inv.add(I.ARROW, 1) === 0) { audio.pop(); remove(i); }
        continue;
      }
      if (a.age > ARROW_FLIGHT) { remove(i); continue; }
      const feet = world.getBlock(bx, by, bz);
      a.vel.y -= ARROW_GRAVITY * dt;
      if (LIQ_KIND[feet]) a.vel.multiplyScalar(Math.exp(-4 * dt));
      const sx = a.vel.x * dt, sy = a.vel.y * dt, sz = a.vel.z * dt;
      // an entity on this frame's path
      if (a.dmg > 0) {
        _d.set(a.vel.x, 0, a.vel.z).normalize();
        if (!a.shooter) {
          const m = raycastMobs(a.pos.x, a.pos.y, a.pos.z, sx, sy, sz, 1);
          if (m) { m.hurt(a.dmg * (m.def.arrowRes ?? 1), _d, 0.6); audio.arrowHit(a.pos.x, a.pos.y, a.pos.z); remove(i); continue; }
        } else if (!p.dead) {
          const hw = p.w / 2;
          if (rayBox(a.pos.x, a.pos.y, a.pos.z, sx, sy, sz, p.pos.x - hw, p.pos.y, p.pos.z - hw, p.pos.x + hw, p.pos.y + p.h, p.pos.z + hw, 1)) {
            damagePlayer(a.dmg, 'was shot by a skeleton', { x: a.pos.x - _d.x, z: a.pos.z - _d.z }, 'arrow');
            remove(i); continue;
          }
        }
      }
      // the first solid cell on the path: stick in it
      const n = Math.max(1, Math.ceil(Math.hypot(sx, sy, sz) / 0.1));
      let stuck = false;
      for (let k = 1; k <= n && !stuck; k++) {
        const x = a.pos.x + sx * k / n, y = a.pos.y + sy * k / n, z = a.pos.z + sz * k / n;
        const cx = Math.floor(x), cy = Math.floor(y), cz = Math.floor(z), id = world.getBlock(cx, cy, cz);
        if (!SOLID[id] || id === UNLOADED) continue;
        const back = 0.25 / (Math.hypot(sx, sy, sz) || 1);   // the centre stays 0.25 back, so only the head pokes in
        stickAt(a, x - sx * back, y - sy * back, z - sz * back, cx, cy, cz);
        stuck = true;
      }
      if (stuck) continue;
      a.pos.x += sx; a.pos.y += sy; a.pos.z += sz;
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(_t.copy(a.pos).add(a.vel));
    }
  }
  return { list, shoot, fireball, update, clear };
})();

export { ARROW_GRAVITY, FIREBALL_SPEED, projectiles };
