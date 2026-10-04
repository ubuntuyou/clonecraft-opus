/* =====================================================================================
 * PORTAL FRAME — living header (src/portal-frame.js, SPEC_realms Phase 3)
 * -------------------------------------------------------------------------------------
 * Pure portal geometry. No module state, no world access: every function reads blocks through
 * get(x, y, z), so Node tests call it with a plain map. src/portals.js applies the results.
 *
 * Frame: a vertical rectangle of frame blocks along x or z. The frame block is obsidian (the
 * Ember portal) or Crystal Frame (the crystal portal, Phase 5). The opening is 2..4 wide and 3..5
 * tall and holds only air. The sides, the bottom row, and the top row are frame blocks. The 4 corner
 * cells are optional. A frame is { axis, x0, y0, z0, w, h }: axis 'x' spans x (the pane lies in
 * the plane z = z0), axis 'z' spans z. (x0, y0, z0) is the low corner cell of the opening.
 *
 * Build plan: a 2x3 opening in a 4x5 frame. The first choice is the nearest site within
 * SITE_R blocks horizontally of the target: a full solid floor, air (or a replaceable non-liquid)
 * for the frame, one clear side to step out, and no lava near it. Without a site, the plan is the
 * fallback platform: 4 x 3 obsidian at the frame's bottom row, air cleared above it, and every
 * lava cell next to the structure turned to obsidian. Either way, the portal never touches lava.
 * ===================================================================================== */
import { B, LIQ_KIND, OPAQUE, REPLACEABLE, SOLID } from './blocks.js';
import { H, UNLOADED } from './config.js';

const MIN_W = 2, MAX_W = 4, MIN_H = 3, MAX_H = 5;
const SITE_R = 14;   // horizontal reach of the site search. The spec says 16; 14 keeps the 1:8 return within 128.
const SITE_DY = 40;  // vertical reach of the site search, above and below the target

// Cell (u, v) of a frame plane: u along the axis, v up. `d` offsets across the plane.
const cellOf = (axis, x0, y0, z0, u, v, d = 0) => (axis === 'x' ? [x0 + u, y0 + v, z0 + d] : [x0 + d, y0 + v, z0 + u]);

// True when the frame { axis, x0, y0, z0, w, h } is complete: an air opening in a ring of `ring` blocks.
function frameOk(get, f, ring = B.OBSIDIAN) {
  const { axis, x0, y0, z0, w, h } = f;
  const at = (u, v) => get(...cellOf(axis, x0, y0, z0, u, v));
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) if (at(u, v) !== B.AIR) return false;
  for (let v = 0; v < h; v++) if (at(-1, v) !== ring || at(w, v) !== ring) return false;
  for (let u = 0; u < w; u++) if (at(u, -1) !== ring || at(u, h) !== ring) return false;
  return true;
}

// The complete frame that holds `ring` cell (x, y, z) in its ring (corners count when present),
// or null. Smaller openings win when the cell belongs to more than one frame.
function findFrame(get, x, y, z, ring = B.OBSIDIAN) {
  if (get(x, y, z) !== ring) return null;
  for (let h = MIN_H; h <= MAX_H; h++) for (let w = MIN_W; w <= MAX_W; w++) for (const axis of ['x', 'z']) {
    const a = axis === 'x' ? x : z;   // the clicked cell's coordinate along the axis
    // (u, v) of the clicked cell in the frame: u in -1..w, v in -1..h, on the ring
    for (let v = -1; v <= h; v++) for (let u = -1; u <= w; u++) {
      const onRing = u === -1 || u === w || v === -1 || v === h;
      if (!onRing) continue;
      const f = { axis, x0: axis === 'x' ? a - u : x, y0: y - v, z0: axis === 'z' ? a - u : z, w, h };
      if (f.y0 < 1 || f.y0 + h >= H) continue;
      if (frameOk(get, f, ring)) return f;
    }
  }
  return null;
}

// Every opening cell of frame f, as [x, y, z].
function frameCells(f) {
  const out = [];
  for (let v = 0; v < f.h; v++) for (let u = 0; u < f.w; u++) out.push(cellOf(f.axis, f.x0, f.y0, f.z0, u, v));
  return out;
}

// The nearest cell of `id` among override entries ([key "x,y,z", id]) within `radius` blocks
// horizontally of (tx, tz). Ties break by the 3D distance. Returns [x, y, z] or null.
function nearestPortal(entries, id, tx, ty, tz, radius) {
  let best = null, bestD = Infinity;
  for (const [k, v] of entries) {
    if (v !== id) continue;
    const [x, y, z] = k.split(',').map(Number);
    const dh = (x + 0.5 - tx) ** 2 + (z + 0.5 - tz) ** 2;
    if (dh > radius * radius) continue;
    const d = dh + (y - ty) ** 2;
    if (d < bestD) { bestD = d; best = [x, y, z]; }
  }
  return best;
}

// The cell where a traveller stands in the portal that holds cell c: the bottom of c's column.
function portalFoot(get, c, id) {
  let [x, y, z] = c;
  while (y > 0 && get(x, y - 1, z) === id) y--;
  return [x, y, z];
}

const free = (id) => id === B.AIR || (REPLACEABLE[id] && !LIQ_KIND[id] && id !== B.PORTAL_EMBER);
const clear = (id) => id !== UNLOADED && !SOLID[id] && !LIQ_KIND[id];

// True when a 4x5 frame with low outer corner (fx, fy, fz) along `axis` fits: a full floor, free
// cells for the frame, one clear side, and no lava in the box around it.
function siteOk(get, axis, fx, fy, fz) {
  const at = (u, v, d) => get(...cellOf(axis, fx, fy, fz, u, v, d));
  for (let u = 0; u < 4; u++) { const f = at(u, -1, 0); if (f === UNLOADED || !SOLID[f] || !OPAQUE[f]) return false; }
  for (let v = 0; v < 5; v++) for (let u = 0; u < 4; u++) if (!free(at(u, v, 0))) return false;
  const side = (d) => clear(at(1, 1, d)) && clear(at(2, 1, d)) && clear(at(1, 2, d)) && clear(at(2, 2, d));
  if (!side(1) && !side(-1)) return false;
  for (let d = -2; d <= 2; d++) for (let v = -1; v <= 5; v++) for (let u = -1; u <= 4; u++) {
    const id = at(u, v, d);
    if (LIQ_KIND[id] === 2 || id === UNLOADED) return false;
  }
  return true;
}

// The plan for a new Ember portal near target (tx, ty, tz): { edits: [[x, y, z, id]], stand, frame, platform }.
// `stand` is the point where the traveller arrives (the middle of the opening's floor).
function buildPlan(get, tx, ty, tz) {
  const cx = Math.floor(tx), cy = Math.floor(ty), cz = Math.floor(tz);
  let best = null, bestD = Infinity;
  for (let dz = -SITE_R; dz <= SITE_R; dz++) for (let dx = -SITE_R; dx <= SITE_R; dx++) {
    const dh = dx * dx + dz * dz;
    if (dh > SITE_R * SITE_R || dh >= bestD) continue;
    for (let dy = 0; dy <= SITE_DY && dh + dy * dy < bestD; dy++) {
      for (const sy of dy ? [cy - dy, cy + dy] : [cy]) {   // sy: the opening's floor level
        if (sy < 2 || sy + 5 >= H || dh + dy * dy >= bestD) continue;
        for (const axis of ['x', 'z']) {
          // the opening's 2 floor cells meet at (cx + dx, cz + dz): the frame starts 2 cells before
          const fx = axis === 'x' ? cx + dx - 2 : cx + dx, fz = axis === 'z' ? cz + dz - 2 : cz + dz;
          if (siteOk(get, axis, fx, sy - 1, fz)) { best = { axis, fx, fy: sy - 1, fz }; bestD = dh + dy * dy; break; }
        }
      }
    }
  }
  const platform = !best;
  if (platform) best = { axis: 'x', fx: cx - 2, fy: Math.max(1, Math.min(H - 6, cy - 1)), fz: cz };
  const { axis, fx, fy, fz } = best;
  const edits = [], seen = new Set();
  const put = (c, id) => { const k = c.join(','); if (!seen.has(k)) { seen.add(k); edits.push([c[0], c[1], c[2], id]); } };
  const cell = (u, v, d) => cellOf(axis, fx, fy, fz, u, v, d);
  if (platform) {
    // lava next to the structure (platform row, cleared air, frame) turns to obsidian first
    const inBox = (u, v, d) => u >= 0 && u < 4 && v >= 0 && v < 5 && d >= -1 && d <= 1;
    for (let d = -2; d <= 2; d++) for (let v = -1; v <= 5; v++) for (let u = -1; u <= 4; u++) {
      if (inBox(u, v, d)) continue;
      const touches = inBox(u + 1, v, d) || inBox(u - 1, v, d) || inBox(u, v + 1, d) || inBox(u, v - 1, d) || inBox(u, v, d + 1) || inBox(u, v, d - 1);
      const c = cell(u, v, d);
      if (touches && LIQ_KIND[get(...c)] === 2) put(c, B.OBSIDIAN);
    }
    for (let d = -1; d <= 1; d++) for (let u = 0; u < 4; u++) {
      put(cell(u, 0, d), B.OBSIDIAN);
      if (d) for (let v = 1; v < 5; v++) put(cell(u, v, d), B.AIR);
    }
  }
  for (let v = 0; v < 5; v++) for (let u = 0; u < 4; u++) {
    const ring = u === 0 || u === 3 || v === 0 || v === 4;
    put(cell(u, v, 0), ring ? B.OBSIDIAN : B.PORTAL_EMBER);
  }
  const frame = { axis, x0: axis === 'x' ? fx + 1 : fx, y0: fy + 1, z0: axis === 'z' ? fz + 1 : fz, w: 2, h: 3 };
  const s = cell(2, 1, 0);
  const stand = axis === 'x' ? [s[0], s[1], s[2] + 0.5] : [s[0] + 0.5, s[1], s[2]];
  return { edits, stand, frame, platform };
}

export { buildPlan, findFrame, frameCells, frameOk, nearestPortal, portalFoot, SITE_R };
