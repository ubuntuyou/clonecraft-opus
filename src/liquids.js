// ---- liquids -------------------------------------------------------------------------
// Water and lava flow on a tick: water every 0.25 s, lava every 0.75 s. A cell is queued
// when a block at or next to it changes (`wake`). Per tick, a queued flow cell first takes
// its level from its neighbours, then spreads:
//   - down first: an open cell below becomes a falling flow (level 7);
//   - sideways at (effective level - 1) when it cannot fall, or when it is a source.
// Effective level: 8 for a source or a falling flow, else the level. Flows reach 7 cells
// past the source (8 including it). A flow whose feeders are gone drains to air. Two water
// sources beside a cell over solid ground make a new source. Lava that touches water turns
// into obsidian (source) or cobblestone (flow).
import { UNLOADED } from './config.js';
import { B, DIR4, IS_WATER, LIQ_KIND, LIQ_LEVEL, liquidId, REPLACEABLE, SOLID } from './blocks.js';
import { DIRS } from './world.js';
import { world } from './engine.js';
import { particles, audio } from './order.js';

const liquids = (() => {
  const TICK = [0, 0.25, 0.75], queues = [null, new Map(), new Map()], timers = [0, 0, 0];
  const key = (x, y, z) => `${x},${y},${z}`;
  const openDown = (b, kind) => b === B.AIR || (REPLACEABLE[b] && !LIQ_KIND[b]) || LIQ_KIND[b] === kind;
  const canFlowInto = (b, kind, lvl) => b === B.AIR || (REPLACEABLE[b] && !LIQ_KIND[b]) || (LIQ_KIND[b] === kind && LIQ_LEVEL[b] < lvl);
  const falling = (x, y, z, kind) => LIQ_KIND[world.getBlock(x, y + 1, z)] === kind;
  function queue(x, y, z) {
    const k = LIQ_KIND[world.getBlock(x, y, z)];
    if (k) queues[k].set(key(x, y, z), [x, y, z]);
  }
  // Queue the cell and its 6 neighbours (only cells that hold a liquid).
  function wake(x, y, z) {
    queue(x, y, z);
    for (const d of DIRS) queue(x + d[0], y + d[1], z + d[2]);
  }
  function tickCell(x, y, z, kind) {
    const id = world.getBlock(x, y, z);
    if (id === UNLOADED) { if (queues[kind].size < 20000) queues[kind].set(key(x, y, z), [x, y, z]); return; }
    if (LIQ_KIND[id] !== kind) return;
    if (kind === 2) for (const d of DIRS) {
      if (!IS_WATER[world.getBlock(x + d[0], y + d[1], z + d[2])]) continue;
      world.setBlock(x, y, z, LIQ_LEVEL[id] === 8 ? B.OBSIDIAN : B.COBBLE);
      audio.fizz(x + 0.5, y + 0.5, z + 0.5);
      particles.poof(x + 0.5, y + 1, z + 0.5, 0.8);
      return;
    }
    let level = LIQ_LEVEL[id];
    const below = y > 0 ? world.getBlock(x, y - 1, z) : B.BEDROCK;
    if (level < 8) {
      let want = 0;
      if (falling(x, y, z, kind)) want = 7;
      else {
        let sources = 0;
        for (const [dx, dz] of DIR4) {
          const nx = x + dx, nz = z + dz, n = world.getBlock(nx, y, nz);
          if (LIQ_KIND[n] !== kind) continue;
          const src = LIQ_LEVEL[n] === 8;
          if (src) sources++;
          if (!src && openDown(world.getBlock(nx, y - 1, nz), kind)) continue;   // it falls instead
          const eff = src || falling(nx, y, nz, kind) ? 8 : LIQ_LEVEL[n];
          if (eff - 1 > want) want = eff - 1;
        }
        if (kind === 1 && sources >= 2 && (SOLID[below] || below === B.WATER)) want = 8;
      }
      if (want !== level) {
        world.setBlock(x, y, z, want <= 0 ? B.AIR : liquidId(kind, want));
        if (want <= 0) return;
        level = want;
      }
    }
    if (y > 0 && canFlowInto(below, kind, 7)) world.setBlock(x, y - 1, z, liquidId(kind, 7));
    if (level === 8 || !openDown(y > 0 ? world.getBlock(x, y - 1, z) : B.BEDROCK, kind)) {
      const out = (level === 8 || falling(x, y, z, kind) ? 8 : level) - 1;
      if (out >= 1) for (const [dx, dz] of DIR4) {
        if (canFlowInto(world.getBlock(x + dx, y, z + dz), kind, out)) world.setBlock(x + dx, y, z + dz, liquidId(kind, out));
      }
    }
  }
  function step(kind) {
    const q = queues[kind];
    if (!q.size) return;
    queues[kind] = new Map();
    const t0 = performance.now();
    let n = 0, late = false;
    world.beginBatch();
    for (const [k, c] of q) {
      if (!late && (n++ & 15) === 0 && performance.now() - t0 > 6) late = true;   // time budget: the rest waits a tick
      if (late) { queues[kind].set(k, c); continue; }
      tickCell(c[0], c[1], c[2], kind);
    }
    world.endBatch();
  }
  return {
    wake,
    update(dt) {
      for (const kind of [1, 2]) {
        timers[kind] -= dt;
        if (timers[kind] <= 0) { timers[kind] = TICK[kind]; step(kind); }
      }
    },
    get pending() { return queues[1].size + queues[2].size; },
    save() { return [1, 2].map((k) => [...queues[k].values()]); },
    clear() { queues[1].clear(); queues[2].clear(); },
    load(lists) { [1, 2].forEach((k, i) => { for (const c of (lists && lists[i]) || []) queues[k].set(key(c[0], c[1], c[2]), c); }); },
  };
})();

export { liquids };
