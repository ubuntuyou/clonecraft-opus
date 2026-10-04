/* =====================================================================================
 * === 6. CHUNK CLASS AND CHUNK MANAGEMENT
 * -------------------------------------------------------------------------------------
 * Chunk lifecycle: requested -> data (blocks from a worker, overrides applied)
 *   -> lit (initChunkLight) -> meshed (when it and all 8 neighbours are lit)
 *   -> unloaded (beyond renderDistance + 3; meshes disposed).
 * Realms: `world.realm` names the realm of the loaded chunks. `reset()` unloads every chunk,
 * then switches the realm and the override maps (SPEC_realms). An `onChunkUnloaded` hook
 * therefore still sees the old realm. `voidBelow` makes cells below y 0 read as air.
 * ===================================================================================== */
import { ckey, CONFIG, CS, H, lidx, UNLOADED, VOL } from './config.js';
import { ATTEN, B, EMIT, EMIT_CRY, LIGHT_STOP, OPAQUE, SKY_FREE, SOLID } from './blocks.js';
import { GenService } from './gen-service.js';
import { buildChunkMesh, heldLight } from './order.js';

class Chunk {
  constructor(cx, cz, data) {
    this.cx = cx; this.cz = cz; this.key = ckey(cx, cz);
    this.blocks = data.blocks; this.biomes = data.biomes; this.heights = data.heights;
    this.features = data.features || [];   // generated chests and spawners: {kind, x, y, z, type}
    this.sky = new Uint8Array(VOL);
    this.blk = new Uint8Array(VOL);
    this.cry = new Uint8Array(VOL);
    this.chan = [this.sky, this.blk, this.cry];   // light arrays by channel number (CH_SKY, CH_BLK, CH_CRY)
    this.floor = new Uint8Array(CS * CS);   // lowest y that has full (15) sky light, per column
    this.lit = false; this.meshed = false; this.dirty = false;
    this.opaqueMesh = null; this.waterMesh = null;
    this.animalsSpawned = false;
    this.bornAt = performance.now();
  }
}

// Growable FIFO of int quadruples (x, y, z, value) for the light BFS.
class IntQueue {
  constructor() { this.a = new Int32Array(1 << 16); this.head = 0; this.tail = 0; }
  reset() { this.head = 0; this.tail = 0; }
  push(x, y, z, v) {
    if (this.tail + 4 > this.a.length) {
      if (this.head > this.a.length / 2) { this.a.copyWithin(0, this.head, this.tail); this.tail -= this.head; this.head = 0; }
      else { const n = new Int32Array(this.a.length * 2); n.set(this.a.subarray(0, this.tail)); this.a = n; }
    }
    const a = this.a, t = this.tail;
    a[t] = x; a[t + 1] = y; a[t + 2] = z; a[t + 3] = v; this.tail = t + 4;
  }
}
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const DIR_DOWN = 3, DIR_UP = 2;
const CH_SKY = 0, CH_BLK = 1, CH_CRY = 2;          // light channel numbers
const CH_EMIT = [null, EMIT, EMIT_CRY];            // emission table per channel (sky has none)

// Recomputes one column's top block (`heights`, which bounds the mesher) and sky floor (`floor`,
// the lowest cell that sees the sky). `ci` = lz * CS + lx.
function refreshColumn(c, ci) {
  const lx = ci & 15, lz = ci >> 4;
  let top = H - 1;
  while (top > 0 && c.blocks[lidx(lx, top, lz)] === B.AIR) top--;
  c.heights[ci] = top;
  let f = H - 1;
  while (f >= 0 && SKY_FREE[c.blocks[lidx(lx, f, lz)]]) f--;
  c.floor[ci] = f + 1;
}

class World {
  constructor(scene) {
    this.scene = scene;
    this.chunks = new Map();
    this.overrides = new Map();          // "x,y,z" -> block id (every edit the player made)
    this.overridesByChunk = new Map();   // chunk key -> Map(local index -> block id)
    this.touched = new Set();            // meshed chunks whose light/blocks changed this edit
    this.aq = new IntQueue(); this.rq = new IntQueue(); this.bq = new IntQueue(); this.cq = new IntQueue();
    this._lc = null; this._lcx = 1e9; this._lcz = 1e9;
    this.gen = new GenService();
    this.gen.onChunk = (cx, cz, d) => this.onChunkData(cx, cz, d);
    this.lastRequest = { cx: 1e9, cz: 1e9, rd: -1, t: 0 };
    this.stats = { meshed: 0, lit: 0, meshMs: 0, lightMs: 0 };
    this.onChunkLoaded = null;           // hook for passive mob spawning
    this.onChunkUnloaded = null;
    this.batch = null;                   // Set of chunks to remesh while batching edits
    this.onEdit = null;                  // (x, y, z, oldId, newId) after every setBlock (liquids wake here)
    this.voidBelow = false;              // true in the Crystal Realm: a cell below y 0 is air, not bedrock
  }

  // Realm switch (SPEC_realms): unloads every chunk (each calls onChunkUnloaded), drops the
  // pending generation, and swaps in the target realm's override maps. The next update()
  // requests the chunks around the player again.
  reset(realm, overrides, overridesByChunk, voidBelow) {
    for (const c of [...this.chunks.values()]) this.unload(c);
    this.gen.setRealm(realm);
    this.overrides = overrides; this.overridesByChunk = overridesByChunk;
    this.voidBelow = voidBelow;
    this.touched.clear(); this.batch = null;
    this.lastRequest.cx = 1e9; this.center = null;
  }

  get realm() { return this.gen.realm; }   // the realm of the loaded chunks (reset() switches it)

  chunkAt(x, z) {                        // x, z: integer world coordinates
    const cx = x >> 4, cz = z >> 4;
    if (cx === this._lcx && cz === this._lcz && this._lc) return this._lc;
    const c = this.chunks.get(ckey(cx, cz));
    this._lc = c; this._lcx = cx; this._lcz = cz;
    return c;
  }
  getChunk(cx, cz) { return this.chunks.get(ckey(cx, cz)); }

  getBlock(x, y, z) {
    if (y < 0) return this.voidBelow ? B.AIR : B.BEDROCK;
    if (y >= H) return B.AIR;
    const c = this.chunkAt(x, z);
    return c ? c.blocks[lidx(x & 15, y, z & 15)] : UNLOADED;
  }
  getSky(x, y, z) {
    if (y >= H) return 15; if (y < 0) return 0;
    const c = this.chunkAt(x, z);
    return c && c.lit ? c.sky[lidx(x & 15, y, z & 15)] : 15;
  }
  getBlk(x, y, z) {
    if (y >= H || y < 0) return 0;
    const c = this.chunkAt(x, z);
    return c && c.lit ? c.blk[lidx(x & 15, y, z & 15)] : 0;
  }
  getCry(x, y, z) {
    if (y >= H || y < 0) return 0;
    const c = this.chunkAt(x, z);
    return c && c.lit ? c.cry[lidx(x & 15, y, z & 15)] : 0;
  }
  // Brightness 0..1 of a cell (used to shade mobs, items, the held item).
  brightnessAt(x, y, z, daylight) {
    const s = this.getSky(x, y, z) * daylight, b = Math.max(this.getBlk(x, y, z), this.getCry(x, y, z), heldLight.levelAt(x, y, z));
    return Math.max(0.04, Math.pow(0.83, 15 - s), Math.pow(0.85, 15 - b));   // block light falls off slower (shader curveB)
  }
  surfaceY(x, z) {                       // highest solid block, or -1 if unloaded
    const c = this.chunkAt(x, z);
    if (!c) return -1;
    for (let y = H - 1; y > 0; y--) if (SOLID[c.blocks[lidx(x & 15, y, z & 15)]]) return y;
    return 0;
  }

  // ---------------------------------------------------------------- data arrival
  onChunkData(cx, cz, d) {
    const key = ckey(cx, cz);
    if (this.chunks.has(key)) return;
    const p = this.center;
    if (p && Math.max(Math.abs(cx - p.cx), Math.abs(cz - p.cz)) > CONFIG.renderDistance + 3) return;
    const c = new Chunk(cx, cz, d);
    const ov = this.overridesByChunk.get(key);   // block overrides are applied after generation
    if (ov) {
      const cols = new Set();
      for (const [i, id] of ov) { c.blocks[i] = id; cols.add(i & 255); }
      for (const ci of cols) refreshColumn(c, ci);   // edits above the generated top must be meshed and lit
    }
    this.chunks.set(key, c);
    this._lc = null; this._lcx = 1e9;
  }

  unload(c) {
    this.disposeMeshes(c);
    this.chunks.delete(c.key);
    this._lc = null; this._lcx = 1e9;
    if (this.onChunkUnloaded) this.onChunkUnloaded(c);
  }
  disposeMeshes(c) {
    for (const m of [c.opaqueMesh, c.waterMesh]) {
      if (!m) continue;
      this.scene.remove(m);
      m.geometry.setIndex(null);          // the quad index buffer is shared; keep it alive
      m.geometry.dispose();
    }
    c.opaqueMesh = c.waterMesh = null;
  }

  // ---------------------------------------------------------------- edits
  // Sets a block, records the override, relights, and remeshes touched chunks now.
  setBlock(x, y, z, id) {
    if (y < 0 || y >= H) return false;
    const c = this.chunkAt(x, z);
    if (!c || !c.lit) return false;
    const lx = x & 15, lz = z & 15, i = lidx(lx, y, lz);
    const old = c.blocks[i];
    if (old === id) return false;
    this.editSerial = (this.editSerial || 0) + 1;   // heldLight refills its light field when this changes
    c.blocks[i] = id;
    this.overrides.set(`${x},${y},${z}`, id);
    let m = this.overridesByChunk.get(c.key);
    if (!m) { m = new Map(); this.overridesByChunk.set(c.key, m); }
    m.set(i, id);
    refreshColumn(c, lz * CS + lx);   // keep the heightmap and the sky floor of this column current

    this.touched.clear();
    this.touch(c, lx, lz);
    this.relightAt(x, y, z);
    if (this.batch) for (const tc of this.touched) this.batch.add(tc);
    else for (const tc of this.touched) if (tc.meshed) { buildChunkMesh(this, tc); tc.dirty = false; }
    if (this.onEdit) this.onEdit(x, y, z, old, id);
    return true;
  }
  // Batch mode (explosions): setBlock only collects touched chunks; endBatch remeshes each once.
  beginBatch() { this.batch = new Set(); }
  endBatch() {
    const set = this.batch; this.batch = null;
    if (set) for (const tc of set) if (tc.meshed) { buildChunkMesh(this, tc); tc.dirty = false; }
  }

  touch(c, lx, lz) {
    if (c.meshed) { c.dirty = true; this.touched.add(c); }
    if (lx === 0 || lx === 15 || lz === 0 || lz === 15) {
      const dx = lx === 0 ? -1 : lx === 15 ? 1 : 0, dz = lz === 0 ? -1 : lz === 15 ? 1 : 0;
      if (dx) this._touchC(c.cx + dx, c.cz);
      if (dz) this._touchC(c.cx, c.cz + dz);
      if (dx && dz) this._touchC(c.cx + dx, c.cz + dz);
    }
  }
  _touchC(cx, cz) { const n = this.chunks.get(ckey(cx, cz)); if (n && n.meshed) { n.dirty = true; this.touched.add(n); } }

  /* ===================================================================================
   * === 7. VOXEL LIGHTING
   * Three 0..15 channels per cell, by channel number: CH_SKY sky light (scaled by daylight
   * in the shader), CH_BLK block light (warm: torches, lava), and CH_CRY crystal light
   * (turquoise: crystal clusters). The shader tints each channel and takes the brightest. Rules:
   *   - Opaque blocks hold 0 and stop light.
   *   - Light loses 1 per step, plus ATTEN of the block it enters (leaves, cactus).
   *   - Sky light at 15 moving straight down into a SKY_FREE cell stays 15.
   *   - A LIGHT_STOP cell (stairs) takes light but never passes it on, so a stair roof is dark
   *     below while the faces next to the stair stay lit.
   * The BFS works in world coordinates and crosses into any neighbouring lit chunk.
   * =================================================================================== */
  initChunkLight(c) {
    const t0 = performance.now();
    const { blocks, sky, blk, cry, floor } = c;
    c.lit = true;
    // column pass: full sky light down to the first non-sky-free block
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      let y = H - 1;
      while (y >= 0) { const i = lidx(x, y, z); if (!SKY_FREE[blocks[i]]) break; sky[i] = 15; y--; }
      floor[z * CS + x] = y + 1;
    }
    const aq = this.aq, bq = this.bq, cq = this.cq;
    aq.reset(); bq.reset(); cq.reset();
    const bx = c.cx * CS, bz = c.cz * CS;
    const nFloor = (x, z, own) => {
      if (x >= 0 && x < CS && z >= 0 && z < CS) return floor[z * CS + x];
      const n = this.chunks.get(ckey(c.cx + (x < 0 ? -1 : x >= CS ? 1 : 0), c.cz + (z < 0 ? -1 : z >= CS ? 1 : 0)));
      return n && n.lit ? n.floor[(z & 15) * CS + (x & 15)] : own;
    };
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const f = floor[z * CS + x];
      if (f >= H) continue;
      const mf = Math.max(nFloor(x + 1, z, f), nFloor(x - 1, z, f), nFloor(x, z + 1, f), nFloor(x, z - 1, f));
      const top = Math.min(H - 1, Math.max(f, mf - 1));
      for (let y = f; y <= top; y++) aq.push(bx + x, y, bz + z, 0);
    }
    // emitters (torches placed by the player come back through overrides)
    for (let i = 0; i < VOL; i++) {
      const e = EMIT[blocks[i]];
      if (e) { blk[i] = e; bq.push(bx + (i & 15), i >> 8, bz + ((i >> 4) & 15), 0); }
      const ec = EMIT_CRY[blocks[i]];
      if (ec) { cry[i] = ec; cq.push(bx + (i & 15), i >> 8, bz + ((i >> 4) & 15), 0); }
    }
    // seeds from the borders of already-lit neighbours (their light flows into us)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = this.chunks.get(ckey(c.cx + dx, c.cz + dz));
      if (!n || !n.lit) continue;
      const nx = dx === 1 ? 0 : dx === -1 ? 15 : -1, nz = dz === 1 ? 0 : dz === -1 ? 15 : -1;
      const nbx = n.cx * CS, nbz = n.cz * CS;
      for (let t = 0; t < CS; t++) {
        const lx = nx >= 0 ? nx : t, lz = nz >= 0 ? nz : t;
        const ownX = dx === 1 ? 15 : dx === -1 ? 0 : t, ownZ = dz === 1 ? 15 : dz === -1 ? 0 : t;
        const ownFloor = floor[ownZ * CS + ownX];
        for (let y = 0; y < H; y++) {
          const i = lidx(lx, y, lz);
          if (n.sky[i] > 1 && !(y >= ownFloor && n.sky[i] === 15)) aq.push(nbx + lx, y, nbz + lz, 0);
          if (n.blk[i] > 1) bq.push(nbx + lx, y, nbz + lz, 0);
          if (n.cry[i] > 1) cq.push(nbx + lx, y, nbz + lz, 0);
        }
      }
    }
    this.propagate(aq, CH_SKY);
    this.propagate(bq, CH_BLK);
    this.propagate(cq, CH_CRY);
    this.stats.lightMs = performance.now() - t0;
  }

  propagate(q, ch) {
    const isSky = ch === CH_SKY;
    while (q.head < q.tail) {
      const arr0 = q.a, h = q.head;
      const x = arr0[h], y = arr0[h + 1], z = arr0[h + 2];
      q.head = h + 4;
      const c = this.chunkAt(x, z);
      if (!c || !c.lit) continue;
      const li = lidx(x & 15, y, z & 15), L = c.chan[ch][li];
      if (L <= 1 || LIGHT_STOP[c.blocks[li]]) continue;
      for (let d = 0; d < 6; d++) {
        const D = DIRS[d], ny = y + D[1];
        if (ny < 0 || ny >= H) continue;
        const nx = x + D[0], nz = z + D[2];
        const nc = (D[0] === 0 && D[2] === 0) ? c : this.chunkAt(nx, nz);
        if (!nc || !nc.lit) continue;
        const ni = lidx(nx & 15, ny, nz & 15), b = nc.blocks[ni];
        if (OPAQUE[b]) continue;
        const nl = (isSky && d === DIR_DOWN && L === 15 && SKY_FREE[b]) ? 15 : L - 1 - ATTEN[b];
        const narr = nc.chan[ch];
        if (nl > narr[ni]) { narr[ni] = nl; q.push(nx, ny, nz, 0); this.touch(nc, nx & 15, nz & 15); }
      }
    }
  }

  unpropagate(rq, aq, ch) {
    const isSky = ch === CH_SKY;
    while (rq.head < rq.tail) {
      const arr = rq.a, h = rq.head;
      const x = arr[h], y = arr[h + 1], z = arr[h + 2], old = arr[h + 3];
      rq.head = h + 4;
      for (let d = 0; d < 6; d++) {
        const D = DIRS[d], ny = y + D[1];
        if (ny < 0 || ny >= H) continue;
        const nx = x + D[0], nz = z + D[2];
        const nc = this.chunkAt(nx, nz);
        if (!nc || !nc.lit) continue;
        const ni = lidx(nx & 15, ny, nz & 15);
        const narr = nc.chan[ch];
        const v = narr[ni];
        if (v === 0) continue;
        if (v < old || (isSky && d === DIR_DOWN && old === 15 && v === 15)) {
          narr[ni] = 0; rq.push(nx, ny, nz, v); this.touch(nc, nx & 15, nz & 15);
        } else aq.push(nx, ny, nz, 0);
      }
    }
  }

  // Incremental relight after the block at (x, y, z) changed.
  relightAt(x, y, z) {
    const c = this.chunkAt(x, z);
    const lx = x & 15, lz = z & 15, i = lidx(lx, y, lz);
    const b = c.blocks[i];
    for (let ch = 0; ch < 3; ch++) {
      const isSky = ch === CH_SKY, emit = isSky ? 0 : CH_EMIT[ch][b], arr = c.chan[ch];
      const rq = this.rq, aq = this.aq;
      rq.reset(); aq.reset();
      const old = arr[i];
      if (old > 0) { arr[i] = 0; rq.push(x, y, z, old); }
      this.unpropagate(rq, aq, ch);
      if (!OPAQUE[b]) {
        let best = emit;
        if (isSky && y === H - 1 && SKY_FREE[b]) best = 15;
        for (let d = 0; d < 6; d++) {
          const D = DIRS[d], ny = y + D[1];
          if (ny < 0 || ny >= H) continue;
          const nx = x + D[0], nz = z + D[2];
          const nc = this.chunkAt(nx, nz);
          if (!nc || !nc.lit) continue;
          const ni = lidx(nx & 15, ny, nz & 15);
          if (LIGHT_STOP[nc.blocks[ni]]) continue;
          const Ln = nc.chan[ch][ni];
          const cand = (isSky && d === DIR_UP && Ln === 15 && SKY_FREE[b]) ? 15 : Ln - 1 - ATTEN[b];
          if (cand > best) best = cand;
        }
        if (best > arr[i]) arr[i] = best;
        if (arr[i] > 1) aq.push(x, y, z, 0);
      } else if (emit) {                         // an opaque emitter (lit furnace) lights its neighbours
        arr[i] = emit; aq.push(x, y, z, 0);
      }
      this.propagate(aq, ch);
    }
  }

  // ---------------------------------------------------------------- streaming
  // Called every frame. Requests, lights, meshes, and unloads chunks around the player.
  update(px, pz, camDir, budgetMs) {
    const RD = CONFIG.renderDistance;
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    this.center = { cx: pcx, cz: pcz };
    const now = performance.now();
    const lr = this.lastRequest;
    if (lr.cx !== pcx || lr.cz !== pcz || lr.rd !== RD || now - lr.t > 1000) {
      lr.cx = pcx; lr.cz = pcz; lr.rd = RD; lr.t = now;
      const R = RD + 1;
      for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
        if (dx * dx + dz * dz > (R + 0.5) * (R + 0.5)) continue;
        const k = ckey(pcx + dx, pcz + dz);
        if (!this.chunks.has(k)) this.gen.request(pcx + dx, pcz + dz);
      }
      for (const [k, p] of this.gen.pending) if (Math.max(Math.abs(p.cx - pcx), Math.abs(p.cz - pcz)) > RD + 2) this.gen.cancel(k);
      for (const c of [...this.chunks.values()]) {
        if (Math.max(Math.abs(c.cx - pcx), Math.abs(c.cz - pcz)) > RD + 3) this.unload(c);
      }
    }
    const fx = camDir.x, fz = camDir.z;
    const prio = (cx, cz) => {
      const dx = cx + 0.5 - px / CS, dz = cz + 0.5 - pz / CS;
      const d2 = dx * dx + dz * dz;
      const behind = (dx * fx + dz * fz) < -0.5 ? 6 : 0;
      return d2 + behind * Math.sqrt(d2);
    };
    this.gen.pump(prio);

    const t0 = performance.now();
    // light: nearest first
    const unlit = [];
    for (const c of this.chunks.values()) if (!c.lit) unlit.push(c);
    if (unlit.length) {
      unlit.sort((a, b) => prio(a.cx, a.cz) - prio(b.cx, b.cz));
      for (const c of unlit) {
        this.initChunkLight(c);
        this.stats.lit++;
        if (this.onChunkLoaded) this.onChunkLoaded(c);
        if (performance.now() - t0 > budgetMs * 0.4) break;
      }
    }
    // mesh: chunks inside the render radius whose 3x3 neighbourhood is lit
    const cand = [];
    const R2 = (RD + 0.5) * (RD + 0.5);
    for (const c of this.chunks.values()) {
      const dx = c.cx - pcx, dz = c.cz - pcz, inside = dx * dx + dz * dz <= R2;
      if (c.opaqueMesh) c.opaqueMesh.visible = inside;
      if (c.waterMesh) c.waterMesh.visible = inside;
      if (!inside || !c.lit || (c.meshed && !c.dirty)) continue;
      let ok = true;
      for (let oz = -1; oz <= 1 && ok; oz++) for (let ox = -1; ox <= 1; ox++) {
        if (!ox && !oz) continue;
        const n = this.chunks.get(ckey(c.cx + ox, c.cz + oz));
        if (!n || !n.lit) { ok = false; break; }
      }
      if (ok) cand.push(c);
    }
    if (cand.length) {
      cand.sort((a, b) => prio(a.cx, a.cz) - prio(b.cx, b.cz));
      for (const c of cand) {
        buildChunkMesh(this, c);
        c.meshed = true; c.dirty = false;
        this.stats.meshed++;
        if (performance.now() - t0 > budgetMs) break;
      }
    }
    this.pendingMeshes = cand.length;
  }

  // Count of chunks that are meshed within `r` chunks of the player (loading screen).
  readyAround(px, pz, r) {
    const pcx = Math.floor(px / CS), pcz = Math.floor(pz / CS);
    let n = 0, t = 0;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dz * dz > r * r) continue;
      t++;
      const c = this.chunks.get(ckey(pcx + dx, pcz + dz));
      if (c && c.meshed) n++;
    }
    return n / t;
  }
}

export { DIRS, World };
