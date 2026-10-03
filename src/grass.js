// ---- grass spread ----------------------------------------------------------------------
// Random ticks grow grass over exposed dirt and turn covered grass to dirt (SPEC_expansion.md,
// "Grass spread"). A random tick picks random dirt and grass cells in the lit chunks within
// TICK_RADIUS chunks of the player (or the render distance, when it is smaller). Each such cell
// gets a tick on average every `every` seconds.
//   - Dirt becomes grass when the cell above is not opaque, holds no liquid, and has light
//     MIN_LIGHT or more in any channel, and a grass block lies within 1 block horizontally,
//     from 1 below to 3 above the dirt (Minecraft's spread box, seen from the dirt).
//   - Grass becomes dirt when the cell above is opaque or holds a liquid. Darkness alone does
//     not kill grass.
// An UNLOADED cell is never grass, cover, or light, so the tick does not act on it.
//
// Candidate list: only about 1 cell in 100 is dirt or grass, and a random read into a chunk array
// misses the cache. So each chunk keeps a list of its dirt and grass cells (its candidates) and the
// tick samples only that list. A chunk scans its blocks for the list on its first tick, at most
// SCANS_PER_FRAME chunks per frame. world.onEdit adds each new dirt or grass cell to the list of a
// scanned chunk. A bitset keeps a cell in the list once. A sampled cell that is no longer dirt or
// grass leaves the list. The lists live in a WeakMap, so an unloaded chunk drops its list.
// A change is a normal setBlock edit, so the save keeps it. The tick saves nothing of its own.
import { CONFIG, CS, lidx, UNLOADED, VOL } from './config.js';
import { B, LIQ_KIND, OPAQUE } from './blocks.js';
import { world } from './engine.js';

const grass = (() => {
  const TICK_RADIUS = 8, MIN_LIGHT = 9, SCANS_PER_FRAME = 4;
  const lists = new WeakMap();   // chunk -> { cells: Int32Array of local indices, n, has: bitset, carry }
  const changes = [];            // flat x, y, z, id quadruples found this frame
  let ticked = 0;
  const candidate = (id) => id === B.DIRT || id === B.GRASS;

  function scan(c) {
    const blocks = c.blocks, D = B.DIRT, G = B.GRASS, has = new Uint8Array(VOL >> 3);
    let cells = new Int32Array(256), n = 0;
    for (let i = 0; i < VOL; i++) {
      const id = blocks[i];
      if (id !== D && id !== G) continue;
      if (n === cells.length) { const more = new Int32Array(n * 2); more.set(cells); cells = more; }
      cells[n++] = i;
      has[i >> 3] |= 1 << (i & 7);
    }
    const L = { cells, n, has, carry: 0 };
    lists.set(c, L);
    return L;
  }
  function add(L, i) {
    if (L.has[i >> 3] & (1 << (i & 7))) return;
    if (L.n === L.cells.length) { const more = new Int32Array(L.n * 2); more.set(L.cells); L.cells = more; }
    L.cells[L.n++] = i;
    L.has[i >> 3] |= 1 << (i & 7);
  }
  function drop(L, j) {
    const i = L.cells[j];
    L.has[i >> 3] &= ~(1 << (i & 7));
    L.cells[j] = L.cells[--L.n];
  }
  function grassNear(x, y, z) {
    for (let dy = -1; dy <= 3; dy++) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (world.getBlock(x + dx, y + dy, z + dz) === B.GRASS) return true;
    }
    return false;
  }
  // The id the cell at (x, y, z) becomes under the rules, or 0 when it stays.
  function next(x, y, z) {
    const id = world.getBlock(x, y, z);
    if (!candidate(id)) return 0;
    const above = world.getBlock(x, y + 1, z);
    if (above === UNLOADED) return 0;
    const covered = OPAQUE[above] || LIQ_KIND[above];
    if (id === B.GRASS) return covered ? B.DIRT : 0;
    if (covered) return 0;
    const ay = y + 1;
    if (Math.max(world.getSky(x, ay, z), world.getBlk(x, ay, z), world.getCry(x, ay, z)) < MIN_LIGHT) return 0;
    return grassNear(x, y, z) ? B.GRASS : 0;
  }
  function apply() {
    const own = !world.batch;   // beginBatch does not nest
    if (own) world.beginBatch();
    try {
      for (let k = 0; k < changes.length; k += 4) {
        const x = changes[k], y = changes[k + 1], z = changes[k + 2], to = changes[k + 3];
        if (next(x, y, z) === to) world.setBlock(x, y, z, to);   // an earlier change this frame can void it
      }
    } finally {
      changes.length = 0;
      if (own) world.endBatch();
    }
  }

  const api = {
    every: 40,              // mean seconds between two ticks of one cell; tests may lower it
    // Advances the random ticks by dt seconds of game time.
    update(dt) {
      const ctr = world.center;
      ticked = 0;
      if (!ctr || !(dt > 0)) return;
      const R = Math.min(TICK_RADIUS, CONFIG.renderDistance), R2 = (R + 0.5) * (R + 0.5);
      let scans = 0;
      for (const c of world.chunks.values()) {
        const dx = c.cx - ctr.cx, dz = c.cz - ctr.cz;
        if (!c.lit || dx * dx + dz * dz > R2) continue;
        let L = lists.get(c);
        if (!L) {
          if (scans >= SCANS_PER_FRAME) continue;
          scans++;
          L = scan(c);
        }
        ticked++;
        L.carry += dt * L.n / api.every;
        let n = Math.floor(L.carry);
        L.carry -= n;
        const blocks = c.blocks, bx = c.cx * CS, bz = c.cz * CS;
        while (n-- > 0 && L.n > 0) {
          const j = (Math.random() * L.n) | 0, i = L.cells[j];
          if (!candidate(blocks[i])) { drop(L, j); continue; }
          const x = bx + (i & 15), y = i >> 8, z = bz + ((i >> 4) & 15), to = next(x, y, z);
          if (to) changes.push(x, y, z, to);
        }
      }
      if (changes.length) apply();
    },
    // world.onEdit: adds a new dirt or grass cell to its chunk's list, when the chunk has one.
    onEdit(x, y, z, old, id) {
      if (!candidate(id) || candidate(old)) return;
      const c = world.chunkAt(x, z), L = c && lists.get(c);
      if (L) add(L, lidx(x & 15, y, z & 15));
    },
    // Applies the rules to one cell now. Returns the new id, or 0 when nothing changed.
    tick(x, y, z) {
      const to = next(x, y, z);
      return to && world.setBlock(x, y, z, to) ? to : 0;
    },
    get ticked() { return ticked; },   // chunks with a list that the last update ticked
    // Candidate count of the chunk at world (x, z), or -1 when the chunk has no list yet. Tests use it.
    candidates(x, z) { const c = world.chunkAt(x, z), L = c && lists.get(c); return L ? L.n : -1; },
  };
  return api;
})();

export { grass };
