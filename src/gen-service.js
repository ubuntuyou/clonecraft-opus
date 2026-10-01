import { ckey, CS, H, SEA, SEED } from './config.js';
import { B } from './blocks.js';
import { BIOME } from './biomes.js';
import { WorldGenModule } from './worldgen.js';

const GEN_CONSTS = { CS, H, SEA, B, BIOME };
const WG = WorldGenModule(SEED, GEN_CONSTS);   // main-thread instance

/* ---- generation service: a pool of Blob Web Workers, with a main-thread fallback ---- */
class GenService {
  constructor() {
    this.pending = new Map();      // key -> {cx, cz}
    this.queue = [];               // keys waiting for a worker
    this.workers = [];
    this.onChunk = null;           // (cx, cz, data) => void
    this.fallback = false;
    const src = `${WorldGenModule.toString()}\nlet WG=null;\nonmessage=(e)=>{const m=e.data;` +
      `if(m.type==='init'){WG=WorldGenModule(m.seed,m.consts);return;}` +
      `if(m.type==='gen'){const r=WG.generateChunk(m.cx,m.cz);` +
      `postMessage({cx:m.cx,cz:m.cz,blocks:r.blocks,biomes:r.biomes,heights:r.heights,features:r.features},[r.blocks.buffer,r.biomes.buffer,r.heights.buffer]);}};`;
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    try {
      const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
      for (let i = 0; i < n; i++) {
        const w = new Worker(url);
        w.busy = 0;
        w.onmessage = (e) => this._done(w, e.data);
        w.onerror = (e) => {
          console.warn('World worker failed; generating on the main thread.', e.message);
          this.fallback = true;
          for (const [k, p] of this.pending) if (p.sent) { p.sent = false; this.queue.push(k); }
        };
        w.postMessage({ type: 'init', seed: SEED, consts: GEN_CONSTS });
        this.workers.push(w);
      }
    } catch (e) {
      console.warn('Web Workers unavailable; generating on the main thread.', e);
      this.fallback = true;
    }
  }
  request(cx, cz) {
    const k = ckey(cx, cz);
    if (this.pending.has(k)) return;
    this.pending.set(k, { cx, cz, sent: false });
    this.queue.push(k);
  }
  cancel(k) {
    const p = this.pending.get(k);
    if (p && !p.sent) this.pending.delete(k);
  }
  get inFlight() { return this.pending.size; }
  _done(w, d) {
    w.busy--;
    const k = ckey(d.cx, d.cz);
    if (this.pending.has(k)) { this.pending.delete(k); this.onChunk && this.onChunk(d.cx, d.cz, d); }
  }
  // Dispatch queued work. `prio(cx, cz)` returns a sort key; smaller runs first.
  pump(prio) {
    if (!this.queue.length) return;
    this.queue = this.queue.filter((k) => this.pending.has(k) && !this.pending.get(k).sent);
    this.queue.sort((a, b) => { const pa = this.pending.get(a), pb = this.pending.get(b); return prio(pa.cx, pa.cz) - prio(pb.cx, pb.cz); });
    if (this.fallback) {
      const t0 = performance.now();
      while (this.queue.length && performance.now() - t0 < 6) {
        const k = this.queue.shift(), p = this.pending.get(k);
        this.pending.delete(k);
        const r = WG.generateChunk(p.cx, p.cz);
        this.onChunk && this.onChunk(p.cx, p.cz, r);
      }
      return;
    }
    for (const w of this.workers) {
      while (w.busy < 2 && this.queue.length) {
        const k = this.queue.shift(), p = this.pending.get(k);
        p.sent = true; w.busy++;
        w.postMessage({ type: 'gen', cx: p.cx, cz: p.cz });
      }
    }
  }
}

export { GenService, WG };
