// ---- vehicles (Batch 16) ------------------------------------------------------------------
// A vehicle is a boat or a minecart. The player rides at most one (player.vehicle).
// A boat floats on water: W/S drive it and A/D turn it. A cart runs on rails: `cell` is its rail
// cell, `t` its place from rail end A (0) to rail end B (1), and `u` its signed speed (blocks per s)
// toward B. A cart without a rail falls until it meets one. `update` moves each vehicle before
// `updatePlayer`, which seats the rider.
import { THREE } from './three.js';
import { clamp, EYE, GRAVITY, randRange, REACH, UNLOADED } from './config.js';
import { B, DIR4, I, IS_LAVA, IS_RAIL, IS_WATER, LIQ_KIND, RAIL_ENDS, railUp, SOLID } from './blocks.js';
import { camera, game, input, player, scene, world } from './engine.js';
import { keyDown, setFlying } from './player.js';
import { moveEntity } from './collision.js';
import { _dir, railLink, rayBox, raycast, resetMining, target } from './interact.js';
import { spawnDrop } from './drops.js';
import { particles, audio, hud } from './order.js';

const VEHICLE_KINDS = {
  boat: { item: I.BOAT, w: 1.375, h: 0.6, stepH: 0.45, eye: 1.1, sound: 'wood' },
  cart: { item: I.MINECART, w: 0.98, h: 0.7, stepH: 0, eye: 1.25, sound: 'stone' },
};
const BOAT_WATER_SPEED = 6, BOAT_LAND_SPEED = 1, BOAT_TURN = 2, CART_MAX = 8;
const vehicles = (() => {
  const list = [];
  const FACE_SHADE = [0.8, 0.8, 1, 0.5, 0.65, 0.65];   // BoxGeometry faces: +x -x +y -y +z -z
  function model(parts) {
    const pos = [], col = [];
    for (const [w, h, d, x, y, z, c] of parts) {
      const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
      const a = g.getAttribute('position').array;
      for (let i = 0; i < a.length; i += 3) {
        const s = FACE_SHADE[Math.floor(i / 18)];
        pos.push(a[i], a[i + 1], a[i + 2]); col.push(c[0] / 255 * s, c[1] / 255 * s, c[2] / 255 * s);
      }
      g.dispose();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }
  // Models face -z (the yaw forward). y 0 is the vehicle bottom.
  const PL = [150, 108, 62], PD = [118, 84, 48], PH = [186, 140, 86];
  const GEO = {
    boat: model([
      [1.0, 0.1, 1.5, 0, 0.05, 0, PD],
      [0.1, 0.45, 1.6, 0.55, 0.275, 0, PL], [0.1, 0.45, 1.6, -0.55, 0.275, 0, PL],
      [1.2, 0.45, 0.1, 0, 0.275, 0.8, PL], [1.2, 0.45, 0.1, 0, 0.275, -0.8, PL],
      [1.0, 0.08, 0.3, 0, 0.36, 0.15, PH],
    ]),
    cart: model([
      [0.9, 0.08, 1.1, 0, 0.16, 0, [110, 116, 126]],
      [0.08, 0.5, 1.1, 0.45, 0.45, 0, [164, 170, 180]], [0.08, 0.5, 1.1, -0.45, 0.45, 0, [164, 170, 180]],
      [0.82, 0.5, 0.08, 0, 0.45, 0.51, [150, 156, 166]], [0.82, 0.5, 0.08, 0, 0.45, -0.51, [150, 156, 166]],
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([sx, sz]) => [0.08, 0.26, 0.26, sx * 0.4, 0.13, sz * 0.34, [44, 44, 50]]),
    ]),
  };
  // A paddle turns around its oarlock. The blade hangs outward and down.
  const PADDLE = model([[0.05, 0.05, 1.0, 0, 0, 0.15, PH], [0.03, 0.08, 0.3, 0, 0, 0.55, PD]]);

  function spawn(kind, x, y, z, yaw) {
    const k = VEHICLE_KINDS[kind];
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const group = new THREE.Group(); group.rotation.order = 'YXZ';
    group.add(new THREE.Mesh(GEO[kind], mat));
    const paddles = [];
    if (kind === 'boat') for (const s of [1, -1]) {
      const m = new THREE.Mesh(PADDLE, mat); m.position.set(s * 0.62, 0.48, 0.1); m.rotation.order = 'YXZ';
      m.rotation.y = s * 1.2; group.add(m); paddles.push(m);
    }
    const v = { kind, k, pos: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), w: k.w, h: k.h, stepH: k.stepH,
      onGround: false, hitWall: false, yaw, pitch: 0, u: 0, cell: null, t: 0, hits: 0, hitT: 0, oar: 0, group, mat, paddles };
    group.position.copy(v.pos); group.rotation.y = yaw;
    scene.add(group); list.push(v);
    if (kind === 'cart') attach(v);
    return v;
  }
  function remove(v) {
    if (player.vehicle === v) dismount();
    const i = list.indexOf(v); if (i >= 0) list.splice(i, 1);
    scene.remove(v.group); v.mat.dispose();
  }
  function clear() { while (list.length) remove(list[list.length - 1]); }

  // The straight segment of a rail between the midpoints of its 2 end edges, 1/16 above the floor.
  function railSeg(x, y, z, s) {
    const [a, b] = RAIL_ENDS[s], up = railUp(s);
    const ax = x + 0.5 + DIR4[a][0] * 0.5, ay = y + (up === a ? 1 : 0) + 1 / 16, az = z + 0.5 + DIR4[a][1] * 0.5;
    const bx = x + 0.5 + DIR4[b][0] * 0.5, by = y + (up === b ? 1 : 0) + 1 / 16, bz = z + 0.5 + DIR4[b][1] * 0.5;
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    return { a, b, ax, ay, az, dx: (bx - ax) / len, dy: (by - ay) / len, dz: (bz - az) / len, len };
  }
  // Put a loose cart on the rail in its cell or the cell below. Keeps the speed along the rail.
  function attach(v) {
    const x = Math.floor(v.pos.x), z = Math.floor(v.pos.z), fy = Math.floor(v.pos.y);
    for (const y of [fy, fy - 1]) {
      const id = world.getBlock(x, y, z);
      if (!IS_RAIL(id) || v.pos.y - y > 1.2) continue;
      const g = railSeg(x, y, z, id - B.RAIL);
      v.cell = { x, y, z };
      v.t = clamp(((v.pos.x - g.ax) * g.dx + (v.pos.y - g.ay) * g.dy + (v.pos.z - g.az) * g.dz) / g.len, 0, 1);
      v.u = v.vel.x * g.dx + v.vel.z * g.dz; v.vel.set(0, 0, 0);
      return true;
    }
    return false;
  }

  function stepBoat(v, dt, ctrl) {
    let fwd = 0, turn = 0;
    if (ctrl) {
      if (keyDown('KeyW', 'ArrowUp')) fwd += 1;
      if (keyDown('KeyS', 'ArrowDown')) fwd -= 1;
      if (keyDown('KeyA', 'ArrowLeft')) turn += 1;
      if (keyDown('KeyD', 'ArrowRight')) turn -= 1;
    }
    const fx = Math.floor(v.pos.x), fz = Math.floor(v.pos.z), cy = Math.floor(v.pos.y + 0.35);
    const wet = !!IS_WATER[world.getBlock(fx, cy, fz)];
    if (wet) {   // float with the deck 0.3 above the surface; a sunk boat rises
      const surf = cy + (IS_WATER[world.getBlock(fx, cy + 1, fz)] ? 1.6 : 0.875);
      v.vel.y += (surf - 0.3 - v.pos.y) * 30 * dt;
      v.vel.y *= Math.exp(-5 * dt);
    } else v.vel.y = Math.max(v.vel.y - GRAVITY * dt, -40);
    const top = wet ? BOAT_WATER_SPEED : BOAT_LAND_SPEED;
    const want = fwd > 0 ? top : fwd < 0 ? -top * 0.4 : 0;
    v.u += (want - v.u) * (1 - Math.exp(-(fwd ? 1.2 : 0.8) * dt));
    if (Math.abs(v.u) > top) v.u *= Math.exp(-5 * dt);
    const dyaw = turn * BOAT_TURN * dt;
    v.yaw += dyaw;
    if (player.vehicle === v) player.yaw += dyaw;
    v.vel.x = -Math.sin(v.yaw) * v.u; v.vel.z = -Math.cos(v.yaw) * v.u;
    if (wet) v.onGround = true;   // water supports the hull, so moveEntity lets it step up a bank
    moveEntity(v, dt);
    if (v.hitWall) v.u *= Math.exp(-10 * dt);
    v.oar += (Math.abs(v.u) + Math.abs(turn) * 2) * dt * 1.6;
  }

  function stepCart(v, dt, ctrl) {
    if (v.cell && !IS_RAIL(world.getBlock(v.cell.x, v.cell.y, v.cell.z))) v.cell = null;   // the rail broke
    if (!v.cell && !attach(v)) {
      v.vel.x *= Math.exp(-2 * dt); v.vel.z *= Math.exp(-2 * dt);
      v.vel.y = Math.max(v.vel.y - GRAVITY * dt, -40);
      moveEntity(v, dt);
      return;
    }
    let c = v.cell, s = world.getBlock(c.x, c.y, c.z) - B.RAIL, g = railSeg(c.x, c.y, c.z, s);
    const hl = Math.hypot(g.dx, g.dz) || 1;
    if (ctrl && keyDown('KeyW', 'ArrowUp')) v.u += (-Math.sin(player.yaw) * g.dx - Math.cos(player.yaw) * g.dz) / hl * 6 * dt;
    if (ctrl && keyDown('KeyS', 'ArrowDown')) v.u -= Math.sign(v.u) * Math.min(Math.abs(v.u), 10 * dt);
    v.u -= g.dy * 7 * dt;
    v.u = Math.sign(v.u) * Math.max(0, Math.abs(v.u) - (0.4 + 0.05 * Math.abs(v.u)) * dt);
    v.u = clamp(v.u, -CART_MAX, CART_MAX);
    let dist = v.u * dt;
    for (let hop = 0; hop < 4; hop++) {
      const nt = v.t + dist / g.len;
      // A rail end with no link stops the cart at the centre of that rail, not over its edge.
      if (dist > 0 ? v.t <= 0.5 && nt > 0.5 : v.t >= 0.5 && nt < 0.5) {
        if (!railLink(c.x, c.y, c.z, s, dist > 0 ? g.b : g.a)) { v.t = 0.5; v.u = 0; break; }
      }
      if (nt >= 0 && nt <= 1) { v.t = nt; break; }
      const end = nt > 1 ? g.b : g.a, left = (nt > 1 ? nt - 1 : -nt) * g.len;
      const n = railLink(c.x, c.y, c.z, s, end);
      if (!n) { v.t = nt > 1 ? 1 : 0; v.u = 0; break; }   // a rail end stops the cart
      c = v.cell = { x: n.x, y: n.y, z: n.z }; s = n.v; g = railSeg(c.x, c.y, c.z, s);
      const fromA = g.a === ((end + 2) & 3);
      v.t = fromA ? 0 : 1; v.u = fromA ? Math.abs(v.u) : -Math.abs(v.u); dist = fromA ? left : -left;
      if (Math.abs(v.u) > 1) audio.dig('stone', 0.25, c.x + 0.5, c.y + 0.2, c.z + 0.5);
    }
    v.pos.set(g.ax + g.dx * g.len * v.t, g.ay + g.dy * g.len * v.t, g.az + g.dz * g.len * v.t);
    v.yaw = Math.atan2(-g.dx, -g.dz); v.pitch = Math.asin(clamp(g.dy, -1, 1));
    v.vel.set(g.dx * v.u, g.dy * v.u, g.dz * v.u);
  }

  function update(dt) {
    for (const v of list) {
      const c = world.chunkAt(Math.floor(v.pos.x), Math.floor(v.pos.z));
      if (!c || !c.lit) continue;
      const ctrl = player.vehicle === v && game.state === 'playing';
      if (v.kind === 'boat') stepBoat(v, dt, ctrl); else stepCart(v, dt, ctrl);
      v.hitT = Math.max(0, v.hitT - dt);
      const g = v.group;
      g.position.copy(v.pos);
      g.rotation.set(v.pitch, v.yaw, Math.sin(v.hitT * 40) * v.hitT * 0.5);
      v.paddles.forEach((m, i) => { m.rotation.x = Math.sin(v.oar + i * Math.PI) * 0.5 - 0.3; });
      const l = world.brightnessAt(Math.floor(v.pos.x), Math.floor(v.pos.y + 0.5), Math.floor(v.pos.z), game.daylight);
      if (v.hitT > 0) v.mat.color.setRGB(l * 1.2, l * 0.45, l * 0.45); else v.mat.color.setScalar(Math.max(0.08, l));
    }
  }
  // The nearest vehicle on the eye ray within maxT, except the one the player rides: {v, t}.
  function ray(ox, oy, oz, dx, dy, dz, maxT) {
    let best = null;
    for (const v of list) {
      if (v === player.vehicle) continue;
      const hw = v.w / 2, r = rayBox(ox, oy, oz, dx, dy, dz, v.pos.x - hw, v.pos.y, v.pos.z - hw, v.pos.x + hw, v.pos.y + v.h, v.pos.z + hw, maxT);
      if (r && (!best || r.t < best.t)) best = { v, t: r.t };
    }
    return best;
  }
  // Two hits break a vehicle. It drops as its item.
  function hit(v) {
    v.hits++; v.hitT = 0.35;
    audio.dig(v.k.sound, 1, v.pos.x, v.pos.y + 0.3, v.pos.z);
    if (v.hits < 2) return;
    particles.blockBreak(Math.floor(v.pos.x), Math.floor(v.pos.y), Math.floor(v.pos.z), v.kind === 'boat' ? B.PLANKS : B.STEEL_BLOCK);
    spawnDrop(v.k.item, 1, v.pos.x, v.pos.y + 0.3, v.pos.z, new THREE.Vector3(randRange(-1, 1), 3, randRange(-1, 1)), 0.4);
    remove(v);
  }
  let hintShown = false;
  function mount(v) {
    const p = player;
    if (p.vehicle || p.dead) return;
    setFlying(false);
    p.vehicle = v; p.sprinting = false; input.wSprint = false;
    resetMining();
    if (!hintShown) { hintShown = true; hud.toast('Shift to get out'); }
  }
  function seat(p) { const v = p.vehicle; p.pos.set(v.pos.x, v.pos.y + v.k.eye - EYE, v.pos.z); }
  // The nearest cell next to the vehicle where the player can stand: feet and head free, head dry,
  // and a solid floor (pass 0) or water (pass 1). The vehicle's own column costs extra.
  function exitSpot(v) {
    const cx = Math.floor(v.pos.x), cy = Math.floor(v.pos.y + 0.35), cz = Math.floor(v.pos.z);
    for (let pass = 0; pass < 2; pass++) {
      let best = null, bd = Infinity;
      for (let dy = -1; dy <= 2; dy++) for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy, z = cz + dz;
        const feet = world.getBlock(x, y, z), head = world.getBlock(x, y + 1, z), below = world.getBlock(x, y - 1, z);
        if (feet === UNLOADED || head === UNLOADED || below === UNLOADED) continue;
        if (SOLID[feet] || SOLID[head] || LIQ_KIND[head] || IS_LAVA[feet] || IS_LAVA[below]) continue;
        if (pass === 0 ? !SOLID[below] || LIQ_KIND[feet] : !SOLID[below] && !IS_WATER[feet]) continue;
        const d = dx * dx + dz * dz + Math.abs(dy) * 0.5 + (dx === 0 && dz === 0 ? 3 : 0);
        if (d < bd) { bd = d; best = { x: x + 0.5, y, z: z + 0.5 }; }
      }
      if (best) return best;
    }
    return { x: v.pos.x, y: v.pos.y + v.h, z: v.pos.z };
  }
  function dismount() {
    const p = player, v = p.vehicle;
    if (!v) return;
    p.vehicle = null;
    const s = exitSpot(v);
    p.pos.set(s.x, s.y, s.z); p.vel.set(0, 0, 0); p.fallPeak = null; p.onGround = false;
  }
  // Place the held boat on the water the eye ray meets, or the held cart on the rail it meets.
  function placeHeld(item) {
    camera.getWorldDirection(_dir);
    const o = camera.position;
    if (item.vehicle === 'boat') {
      const r = raycast(o.x, o.y, o.z, _dir.x, _dir.y, _dir.z, REACH, true);
      if (!r || !IS_WATER[r.id]) { hud.toast('Place the boat on water'); return false; }
      let y = r.y;
      while (y < r.y + 8 && IS_WATER[world.getBlock(r.x, y + 1, r.z)]) y++;
      let x = r.x + 0.5, z = r.z + 0.5;   // move off a solid bank so the hull does not start inside it
      const bank = (dx, dz) => SOLID[world.getBlock(r.x + dx, y, r.z + dz)] || SOLID[world.getBlock(r.x + dx, y + 1, r.z + dz)];
      x += (bank(-1, 0) ? 0.19 : 0) - (bank(1, 0) ? 0.19 : 0); z += (bank(0, -1) ? 0.19 : 0) - (bank(0, 1) ? 0.19 : 0);
      spawn('boat', x, y + 0.575, z, player.yaw);
    } else {
      const t = target;
      if (!t || !IS_RAIL(t.id)) { hud.toast('Place the minecart on a rail'); return false; }
      const g = railSeg(t.x, t.y, t.z, t.id - B.RAIL);
      spawn('cart', t.x + 0.5, g.ay + g.dy * g.len * 0.5, t.z + 0.5, Math.atan2(-g.dx, -g.dz));
    }
    return true;
  }
  const data = () => list.map((v) => ({ kind: v.kind, x: +v.pos.x.toFixed(3), y: +v.pos.y.toFixed(3), z: +v.pos.z.toFixed(3), yaw: +v.yaw.toFixed(3) }));
  function load(arr) { clear(); for (const d of arr || []) spawn(d.kind, d.x, d.y, d.z, d.yaw); }
  return { list, spawn, remove, clear, update, ray, hit, mount, seat, exitSpot, dismount, placeHeld, data, load, railSeg };
})();

export { VEHICLE_KINDS, vehicles };
