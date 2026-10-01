// ---- farming: saplings, crops, and farmland --------------------------------------------
// One registry holds every sapling, crop, and farmland cell: "x,y,z" -> [x, y, z, due, n].
// The block id tells the kind. `n` is the sapling stage (0 or 1) or the dry seconds of a farmland.
// world.onEdit registers each new sapling, crop, or farmland. A cell that changed kind leaves the
// registry at its next check. Due times use game.clock, which the save keeps, so the registry saves
// as it is.
//   - Sapling: 2 stages of 30-90 s. At stage 1 it grows its tree when every log cell is free,
//     else it waits 20 s. A white sapling grows a spruce; the other colors grow an oak.
//   - Crop: 4 stages (0..3). A stage takes 40-80 s on wet farmland and twice that on dry farmland.
//   - Farmland: checked every 5 s. It is wet with water within 4 blocks horizontally, at its own
//     level or one above. Dry farmland without a crop turns to dirt after 60 s.
import { H, randRange, UNLOADED } from './config.js';
import {
  B, IS_CROP, IS_FARMLAND, IS_SAPLING, IS_WATER, LEAF_NATURAL, LIQ_KIND, REPLACEABLE,
} from './blocks.js';
import { WG } from './gen-service.js';
import { game, world } from './engine.js';
import { breakBlock } from './interact.js';

const farming = (() => {
  const SAPLING_STAGE = [30, 90], SAPLING_WAIT = 20, CROP_STAGE = [40, 80], FARM_CHECK = 5, DRY_TO_DIRT = 60, WATER_REACH = 4;
  const RIPE = B.WHEAT + 3;
  const reg = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const free = (b) => b === B.AIR || (REPLACEABLE[b] && !LIQ_KIND[b]);
  const cropDelay = (x, y, z) => randRange(...CROP_STAGE) * (world.getBlock(x, y - 1, z) === B.FARMLAND_WET ? 1 : 2);
  const firstDelay = (id, x, y, z) => IS_SAPLING(id) ? randRange(...SAPLING_STAGE) : IS_CROP(id) ? cropDelay(x, y, z) : FARM_CHECK;
  function add(x, y, z, id) {
    const k = key(x, y, z);
    if (!reg.has(k)) reg.set(k, [x, y, z, game.clock + firstDelay(id, x, y, z), 0]);
    return reg.get(k);
  }
  function batched(fn) {
    if (world.batch) return fn();
    world.beginBatch();
    try { return fn(); } finally { world.endBatch(); }
  }
  function wet(x, y, z) {
    const R = WATER_REACH;
    for (let dy = 0; dy <= 1; dy++) for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      if (IS_WATER[world.getBlock(x + dx, y + dy, z + dz)]) return true;
    }
    return false;
  }
  // Farmland becomes dirt. A crop on it breaks and drops.
  function toDirt(x, y, z) {
    reg.delete(key(x, y, z));
    world.setBlock(x, y, z, B.DIRT);
    if (IS_CROP(world.getBlock(x, y + 1, z))) breakBlock(x, y + 1, z, true);
  }
  // Grows the tree of the sapling at (x, y, z). Returns false (and changes nothing) when a log cell
  // is not free or not loaded. Leaves fill only free cells, as in the generator.
  function growSapling(x, y, z, id) {
    const c = id - B.SAPLING, cells = [];
    WG.growTree(c === 5 ? 'spruce' : 'oak', x, y, z, (Math.random() * 0x7fffffff) | 0, LEAF_NATURAL[c],
      (X, Y, Z, b) => cells.push([X, Y, Z, b]), () => {});
    for (const [X, Y, Z, b] of cells) {
      if (Y >= H) return false;
      if (b === B.LOG && !(X === x && Y === y && Z === z) && !free(world.getBlock(X, Y, Z))) return false;
    }
    batched(() => {
      if (world.getBlock(x, y - 1, z) === B.GRASS) world.setBlock(x, y - 1, z, B.DIRT);
      for (const [X, Y, Z, b] of cells) if (b === B.LOG || free(world.getBlock(X, Y, Z))) world.setBlock(X, Y, Z, b);
    });
    return true;
  }
  // Advances the cell one stage. Returns true when it changed.
  function step(c, id) {
    const [x, y, z] = c, k = key(x, y, z);
    if (IS_SAPLING(id)) {
      if (c[4] === 0) { c[4] = 1; c[3] = game.clock + randRange(...SAPLING_STAGE); return true; }
      if (growSapling(x, y, z, id)) { reg.delete(k); return true; }
      c[3] = game.clock + SAPLING_WAIT;
      return false;
    }
    if (IS_CROP(id) && id < RIPE) {
      world.setBlock(x, y, z, id + 1);
      if (id + 1 === RIPE) reg.delete(k); else c[3] = game.clock + cropDelay(x, y, z);
      return true;
    }
    return false;
  }
  return {
    onEdit(x, y, z, old, id) { if (IS_SAPLING(id) || (IS_CROP(id) && id < RIPE) || IS_FARMLAND(id)) add(x, y, z, id); },
    update() {
      if (!reg.size) return;
      const now = game.clock;
      batched(() => {
        for (const [k, c] of reg) {
          if (c[3] > now) continue;
          const [x, y, z] = c, id = world.getBlock(x, y, z);
          if (id === UNLOADED) { c[3] = now + 2; continue; }
          if (IS_SAPLING(id) || IS_CROP(id)) { if (!step(c, id) && IS_CROP(id)) reg.delete(k); continue; }
          if (!IS_FARMLAND(id)) { reg.delete(k); continue; }
          c[3] = now + FARM_CHECK;
          const w = wet(x, y, z);
          if (w !== (id === B.FARMLAND_WET)) world.setBlock(x, y, z, w ? B.FARMLAND_WET : B.FARMLAND);
          if (w || IS_CROP(world.getBlock(x, y + 1, z))) c[4] = 0;
          else if ((c[4] += FARM_CHECK) >= DRY_TO_DIRT) toDirt(x, y, z);
        }
      });
    },
    // Bone meal: advances a sapling or an unripe crop one stage. Returns true when it did.
    boost(x, y, z) {
      const id = world.getBlock(x, y, z);
      if (!IS_SAPLING(id) && !(IS_CROP(id) && id < RIPE)) return false;
      return batched(() => step(add(x, y, z, id), id));
    },
    toDirt,
    get pending() { return reg.size; },
    save() { return [...reg.values()].map((c) => [c[0], c[1], c[2], Math.max(0, c[3] - game.clock), c[4]]); },
    load(list) { for (const c of list || []) reg.set(key(c[0], c[1], c[2]), [c[0], c[1], c[2], game.clock + c[3], c[4] | 0]); },
  };
})();

export { farming };
