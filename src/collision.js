/* =====================================================================================
 * === 10. COLLISION DETECTION
 * -------------------------------------------------------------------------------------
 * Entities are axis-aligned boxes: pos = centre of the feet, w = width, h = height.
 * moveEntity clips one axis at a time (Y, then X, then Z) in sub-steps of at most 0.4
 * blocks, so no step can skip a block. An entity with passLeaves (the player) skips leaf cells,
 * except the top leaf of a column under slow feet, so the player walks on a canopy.
 * solidBoxes() lists the boxes near the entity: a
 * full cell per solid block, and the sub-cell boxes of a stair (stairKey). On contact the
 * move stops at the box face and that velocity component becomes zero. An entity with
 * stepH (player and mobs) retries a blocked sideways move up to stepH higher, so it walks
 * up a half step. UNLOADED cells count as solid, so nothing falls out of the world while
 * terrain streams in.
 * ===================================================================================== */
import { LEAF_CATCH_V } from './config.js';
import { B, IS_LEAF, IS_STAIR, SOLID, STAIR_BOXES, stairKey } from './blocks.js';
import { player, world } from './engine.js';
import { mobs, vehicles } from './order.js';

const EPS = 1e-7;
// Solid boxes (world units, flat x0 y0 z0 x1 y1 z1) of the cells that overlap a region. A stair
// gives its slab and step boxes. Every other solid block gives its whole cell.
// Leaf pass (the player only): moveEntity sets _passLeaf. 1 skips every leaf except the top leaf
// of a column while the feet (_feetY) are on or above it, so the player walks on a canopy.
// 2 (Shift held, or a fall faster than LEAF_CATCH_V) skips every leaf: the player sinks into the
// canopy, and the climb catches a fall there (a jump lands at 8.7 m/s and stays on top).
const _boxes = [];
let _passLeaf = 0, _feetY = 0;
function stairBoxesAt(id, x, y, z) { return STAIR_BOXES[stairKey(id, (dx, dz) => world.getBlock(x + dx, y, z + dz))]; }
function solidBoxes(x0, y0, z0, x1, y1, z1) {
  _boxes.length = 0;
  for (let y = Math.floor(y0), by = Math.floor(y1); y <= by; y++)
    for (let z = Math.floor(z0), bz = Math.floor(z1); z <= bz; z++)
      for (let x = Math.floor(x0), bx = Math.floor(x1); x <= bx; x++) {
        const id = world.getBlock(x, y, z);
        if (!SOLID[id]) continue;
        if (_passLeaf && IS_LEAF[id] && (_passLeaf === 2 || _feetY < y + 1 - 1e-4 || IS_LEAF[world.getBlock(x, y + 1, z)])) continue;
        if (IS_STAIR[id]) for (const b of stairBoxesAt(id, x, y, z)) _boxes.push(x + b[0] / 16, y + b[1] / 16, z + b[2] / 16, x + b[3] / 16, y + b[4] / 16, z + b[5] / 16);
        else _boxes.push(x, y, z, x + 1, y + 1, z + 1);
      }
  return _boxes;
}
const overlaps = (bx, i, e) => bx[i] < e[3] - EPS && bx[i + 3] > e[0] + EPS && bx[i + 1] < e[4] - EPS && bx[i + 4] > e[1] + EPS && bx[i + 2] < e[5] - EPS && bx[i + 5] > e[2] + EPS;
// The part of move d along axis a (0 x, 1 y, 2 z) that entity box e can make before it touches a box.
function clipAxis(bx, e, a, d) {
  const a1 = (a + 1) % 3, a2 = (a + 2) % 3;
  for (let i = 0; i < bx.length; i += 6) {
    if (bx[i + a1 + 3] <= e[a1] + EPS || bx[i + a1] >= e[a1 + 3] - EPS) continue;
    if (bx[i + a2 + 3] <= e[a2] + EPS || bx[i + a2] >= e[a2 + 3] - EPS) continue;
    if (d > 0 && bx[i + a] >= e[a + 3] - EPS) d = Math.min(d, bx[i + a] - e[a + 3]);
    else if (d < 0 && bx[i + a + 3] <= e[a] + EPS) d = Math.max(d, bx[i + a + 3] - e[a]);
  }
  return d;
}
const shift = (e, a, d) => { e[a] += d; e[a + 3] += d; };

const _eb = [0, 0, 0, 0, 0, 0], _sb = [0, 0, 0, 0, 0, 0];
// True when the box of entity e overlaps a cobweb cell.
function inCobweb(e) {
  const hw = e.w / 2;
  for (let y = Math.floor(e.pos.y); y <= Math.floor(e.pos.y + e.h); y++)
    for (let z = Math.floor(e.pos.z - hw); z <= Math.floor(e.pos.z + hw); z++)
      for (let x = Math.floor(e.pos.x - hw); x <= Math.floor(e.pos.x + hw); x++) if (world.getBlock(x, y, z) === B.COBWEB) return true;
  return false;
}
function moveEntity(e, dt) {
  // a cobweb slows every move to 25% and caps the fall speed
  if (inCobweb(e)) { dt *= 0.25; if (e.vel.y < -2) e.vel.y = -2; }
  const p = e.pos, v = e.vel, hw = e.w / 2, wasGround = e.onGround;
  e.onGround = false; e.hitWall = false;
  _passLeaf = e.passLeaves ? (e.sinking || v.y < -LEAF_CATCH_V ? 2 : 1) : 0; _feetY = p.y;
  const E = _eb;
  E[0] = p.x - hw; E[1] = p.y; E[2] = p.z - hw; E[3] = p.x + hw; E[4] = p.y + e.h; E[5] = p.z + hw;
  const inside = solidBoxes(E[0], E[1], E[2], E[3], E[4], E[5]);
  let lift = -Infinity;
  for (let i = 0; i < inside.length; i += 6) if (overlaps(inside, i, E)) lift = Math.max(lift, inside[i + 4]);
  if (lift > -Infinity) { p.y = lift; v.y = Math.max(v.y, 0); return; }   // embedded (a block appeared inside it): lift it out
  const maxD = Math.max(Math.abs(v.x), Math.abs(v.y), Math.abs(v.z)) * dt;
  const n = Math.min(12, Math.max(1, Math.ceil(maxD / 0.4)));
  const h = dt / n, stepH = e.stepH || 0;
  for (let i = 0; i < n; i++) {
    const dx = v.x * h, dy = v.y * h, dz = v.z * h;
    _feetY = p.y;
    E[0] = p.x - hw; E[1] = p.y; E[2] = p.z - hw; E[3] = p.x + hw; E[4] = p.y + e.h; E[5] = p.z + hw;
    const bx = solidBoxes(Math.min(E[0], E[0] + dx), Math.min(E[1], E[1] + dy), Math.min(E[2], E[2] + dz),
      Math.max(E[3], E[3] + dx), Math.max(E[4], E[4] + dy) + stepH, Math.max(E[5], E[5] + dz));
    const cy = clipAxis(bx, E, 1, dy);
    shift(E, 1, cy);
    if (cy !== dy) { if (dy < 0) e.onGround = true; v.y = 0; }
    for (let k = 0; k < 6; k++) _sb[k] = E[k];
    let cx = clipAxis(bx, E, 0, dx); shift(E, 0, cx);
    let cz = clipAxis(bx, E, 2, dz); shift(E, 2, cz);
    // step up (stairs): retry the sideways move from up to stepH higher, then settle back down
    if (stepH && (cx !== dx || cz !== dz) && (e.onGround || wasGround)) {
      const S = _sb;
      const up = clipAxis(bx, S, 1, stepH); shift(S, 1, up);
      const sx = clipAxis(bx, S, 0, dx); shift(S, 0, sx);
      const sz = clipAxis(bx, S, 2, dz); shift(S, 2, sz);
      shift(S, 1, clipAxis(bx, S, 1, -up));
      if (sx * sx + sz * sz > cx * cx + cz * cz + 1e-9) {
        if (e.stepRise !== undefined) e.stepRise += S[1] - E[1];   // the camera eases over the step
        for (let k = 0; k < 6; k++) E[k] = S[k];
        cx = sx; cz = sz;
      }
    }
    if (cx !== dx) { v.x = 0; e.hitWall = true; }
    if (cz !== dz) { v.z = 0; e.hitWall = true; }
    p.x = E[0] + hw; p.y = E[1]; p.z = E[2] + hw;
  }
  // resting contact: gravity pulls every frame, so a grounded entity re-collides above;
  // this probe keeps onGround stable when vertical velocity is exactly zero
  if (!e.onGround && v.y === 0) {
    _feetY = p.y;
    E[0] = p.x - hw; E[1] = p.y; E[2] = p.z - hw; E[3] = p.x + hw; E[4] = p.y + e.h; E[5] = p.z + hw;
    if (clipAxis(solidBoxes(E[0], E[1] - 0.02, E[2], E[3], E[1], E[5]), E, 1, -0.02) > -0.02) e.onGround = true;
  }
}

// Does the box of cell (x, y, z) overlap the player or a living mob?
function cellBlockedByEntity(x, y, z) {
  const hit = (e) => {
    const hw = e.w / 2;
    return e.pos.x - hw < x + 1 && e.pos.x + hw > x && e.pos.y < y + 1 && e.pos.y + e.h > y && e.pos.z - hw < z + 1 && e.pos.z + hw > z;
  };
  if (!player.dead && hit(player)) return true;
  for (const m of mobs) if (!m.dead && hit(m)) return true;
  for (const v of vehicles.list) if (hit(v)) return true;
  return false;
}

export { cellBlockedByEntity, inCobweb, moveEntity, stairBoxesAt };
