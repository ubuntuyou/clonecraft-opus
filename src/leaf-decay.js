// ---- leaf decay ----------------------------------------------------------------------
// A natural leaf decays when no log lies within REACH steps through leaves (6, as in Minecraft).
// An edit that removes a log or a leaf queues the natural leaves within REACH of it. Each queued
// leaf is checked once, after a random delay, so a canopy falls apart over a few seconds.
// A decay wakes nothing: a leaf with a path to a log never depends on a leaf without one.
// A decaying leaf drops a stick 1 time in 20. The queue is saved with the world.
import { THREE } from './three.js';
import { randRange, UNLOADED } from './config.js';
import { B, I, IS_LEAF, LEAF_DECAYS } from './blocks.js';
import { DIRS } from './world.js';
import { game, world } from './engine.js';
import { bonusDrops, breakBlock } from './interact.js';
import { spawnDrop, particles } from './order.js';

const leafDecay = (() => {
  const REACH = 6, DELAY_MIN = 0.4, DELAY_MAX = 6, STICK_CHANCE = 0.05, BUDGET_MS = 2;
  const queue = new Map();            // "x,y,z" -> [x, y, z, due game.clock]
  const key = (x, y, z) => `${x},${y},${z}`;
  const seen = new Set();
  let decaying = false;
  function add(x, y, z) {
    const k = key(x, y, z);
    if (!queue.has(k)) queue.set(k, [x, y, z, game.clock + randRange(DELAY_MIN, DELAY_MAX)]);
  }
  function wake(x, y, z) {
    for (let dy = -REACH; dy <= REACH; dy++) for (let dz = -REACH; dz <= REACH; dz++) for (let dx = -REACH; dx <= REACH; dx++) {
      if (LEAF_DECAYS[world.getBlock(x + dx, y + dy, z + dz)]) add(x + dx, y + dy, z + dz);
    }
  }
  // Breadth-first search through leaves. An unloaded cell counts as support (do not act).
  function supported(x0, y0, z0) {
    let frontier = [[x0, y0, z0]];
    seen.clear(); seen.add(key(x0, y0, z0));
    for (let d = 1; d <= REACH && frontier.length; d++) {
      const next = [];
      for (const [x, y, z] of frontier) for (const [dx, dy, dz] of DIRS) {
        const X = x + dx, Y = y + dy, Z = z + dz, k = key(X, Y, Z);
        if (seen.has(k)) continue;
        seen.add(k);
        const b = world.getBlock(X, Y, Z);
        if (b === B.LOG || b === UNLOADED) return true;
        if (IS_LEAF[b]) next.push([X, Y, Z]);
      }
      frontier = next;
    }
    return false;
  }
  function decay(x, y, z, id) {
    decaying = true;
    breakBlock(x, y, z, false, true);
    decaying = false;
    particles.blockBreak(x, y, z, id);
    if (Math.random() < STICK_CHANCE) spawnDrop(I.STICK, 1, x + 0.5, y + 0.3, z + 0.5, new THREE.Vector3(randRange(-1, 1), 1, randRange(-1, 1)), 0.4);
    bonusDrops(id, x, y, z);
  }
  return {
    onEdit(x, y, z, old, id) {
      if (decaying) return;
      if ((old === B.LOG && id !== B.LOG) || (IS_LEAF[old] && !IS_LEAF[id])) wake(x, y, z);
    },
    update() {
      if (!queue.size) return;
      const now = game.clock, t0 = performance.now();
      let n = 0;
      world.beginBatch();
      for (const [k, c] of queue) {
        if (c[3] > now) continue;
        if ((n++ & 7) === 0 && performance.now() - t0 > BUDGET_MS) break;   // the rest waits a frame
        const id = world.getBlock(c[0], c[1], c[2]);
        if (id === UNLOADED) { c[3] = now + 2; continue; }
        queue.delete(k);
        if (LEAF_DECAYS[id] && !supported(c[0], c[1], c[2])) decay(c[0], c[1], c[2], id);
      }
      world.endBatch();
    },
    get pending() { return queue.size; },
    save() { return [...queue.values()].map((c) => [c[0], c[1], c[2]]); },
    load(list) { for (const c of list || []) add(c[0], c[1], c[2]); },
  };
})();

export { leafDecay };
