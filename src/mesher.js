/* =====================================================================================
 * === 8. MESH GENERATION
 * -------------------------------------------------------------------------------------
 * buildChunkMesh copies the chunk and a 1-cell border from its 8 neighbours into padded
 * arrays (18 x 98 x 18), then emits one quad per visible face. Each vertex carries:
 *   position (Int16, 1/16 block units), uv (Uint16, 1/16 texel units),
 *   aLight = (sky, block, ao, face shade), aTint = biome colour for tintable texels.
 * Smooth lighting: each vertex averages the light of the 4 cells around it in front of
 * the face; ambient occlusion comes from the 3 opaque neighbours of that vertex.
 * Two meshes per chunk: opaque/cutout and water (transparent). Portal panes go in the water mesh.
 * ===================================================================================== */
import { THREE } from './three.js';
import { ckey, CS, H, mulberry32, UNLOADED } from './config.js';
import {
  B, BLOCKS, CRYSTAL_GROW, DIR4, GLOWS, IS_LEAF, LEAF_COLOR, LIQ_KIND, LIQ_LEVEL, OPAQUE, RAIL_ENDS, railUp,
  SHAPE, SHAPE_OF, SOLID, STAIR_BOXES, stairKey, stairV,
} from './blocks.js';
import { BIOME_FOLIAGE, BIOME_GRASS } from './biomes.js';
import { FACE_TILE, TILE } from './atlas.js';
import { terrainMaterial, waterMaterial } from './order.js';

const PAD = 18, PSY = PAD * PAD, PVOL = PSY * (H + 2);
const PB = new Uint8Array(PVOL), PS = new Uint8Array(PVOL), PL = new Uint8Array(PVOL), PC = new Uint8Array(PVOL);   // blocks, sky, block light, crystal light
const pidx = (x, y, z) => (y + 1) * PSY + (z + 1) * PAD + (x + 1);
const TINT_G = new Float32Array(PAD * PAD * 3), TINT_F = new Float32Array(PAD * PAD * 3), TINT_TMP = new Float32Array(PAD * PAD * 3);

const MAXQ = 1 << 17;
class QuadBuffer {
  constructor(max) {
    this.max = max; this.n = 0;
    this.pos = new Int16Array(max * 12); this.uv = new Uint16Array(max * 8);
    this.light = new Uint8Array(max * 16); this.tint = new Uint8Array(max * 16);
    this.cry = new Uint8Array(max * 4);   // crystal light per vertex
  }
}
const QB_OPAQUE = new QuadBuffer(MAXQ), QB_WATER = new QuadBuffer(MAXQ >> 2);
const QUAD_INDEX = (() => {
  const a = new Uint32Array(MAXQ * 6);
  for (let q = 0; q < MAXQ; q++) { const v = q * 4, i = q * 6; a[i] = v; a[i + 1] = v + 1; a[i + 2] = v + 2; a[i + 3] = v; a[i + 4] = v + 2; a[i + 5] = v + 3; }
  return new THREE.BufferAttribute(a, 1);
})();

// Faces in FACE_TILE order: +X, -X, +Y, -Y, +Z, -Z. Corners: BL, BR, TR, TL (CCW from outside).
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.6 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.6 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.8 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.8 },
];
const STRIDE = [1, PSY, PAD];   // padded strides for x, y, z
for (const F of FACES) {
  F.off = F.n[0] * STRIDE[0] + F.n[1] * STRIDE[1] + F.n[2] * STRIDE[2];
  const axis = F.n[0] ? 0 : F.n[1] ? 1 : 2;
  const others = [0, 1, 2].filter((a) => a !== axis);
  F.ao = F.c.map((corner) => {
    const o1 = (corner[others[0]] ? 1 : -1) * STRIDE[others[0]];
    const o2 = (corner[others[1]] ? 1 : -1) * STRIDE[others[1]];
    return [o1, o2, o1 + o2];
  });
}
const UV_CORNERS = [[0, 1], [1, 1], [1, 0], [0, 0]];   // BL, BR, TR, TL -> (u, v) with v down

const _vx = new Int32Array(12), _vuv = new Int32Array(8), _vl = new Uint8Array(16), _vc = new Uint8Array(4);
// Wind sway and glow, stored in the aTint alpha: 255 = still, 128 = leaves (half sway),
// 0 = full sway, 200 = glow (torch: bright texels are emissive), 214 = soft glow (lava, lit
// furnace: bright texels ignore light but barely bloom), 232 = crystal (every texel glows and
// keeps its facet shade), 160 = portal pane (the water pass draws the swirl). Plants sway only at
// their top vertices, so their base stays in the ground.
const SWAY_NONE = 0, SWAY_LEAF = 1, SWAY_PLANT = 2, SWAY_GLOW = 3, SWAY_SOFTGLOW = 4, SWAY_CRYSTAL = 5, SWAY_PORTAL = 6, SWAY_PORTAL_CRY = 7;
const SWAY_ALPHA = [255, 128, 0, 200, 214, 232, 160, 172];
const WET_ALPHA = 246;   // a still face whose neighbour cell is water: the shader draws caustics on it
let swayMode = SWAY_NONE;
let wetFace = false;   // emitCubeFace sets it per face
let flatCry = 0;   // crystal light (0..15) of emitFlat quads; buildChunkMesh sets it per cell
// Writes one quad from the scratch arrays; `flip` rotates the vertex order to flip the diagonal.
function pushQuad(buf, tint, flip) {
  if (buf.n >= buf.max) return;
  const q = buf.n++;
  const yMin = Math.min(_vx[1], _vx[4], _vx[7], _vx[10]);
  for (let k = 0; k < 4; k++) {
    const s = flip ? (k + 1) & 3 : k, v = q * 4 + k;
    buf.pos[v * 3] = _vx[s * 3]; buf.pos[v * 3 + 1] = _vx[s * 3 + 1]; buf.pos[v * 3 + 2] = _vx[s * 3 + 2];
    buf.uv[v * 2] = _vuv[s * 2]; buf.uv[v * 2 + 1] = _vuv[s * 2 + 1];
    buf.light[v * 4] = _vl[s * 4]; buf.light[v * 4 + 1] = _vl[s * 4 + 1]; buf.light[v * 4 + 2] = _vl[s * 4 + 2]; buf.light[v * 4 + 3] = _vl[s * 4 + 3];
    buf.tint[v * 4] = tint[0]; buf.tint[v * 4 + 1] = tint[1]; buf.tint[v * 4 + 2] = tint[2];
    buf.tint[v * 4 + 3] = swayMode === SWAY_PLANT ? (_vx[s * 3 + 1] > yMin ? 0 : 255) : swayMode === SWAY_NONE && wetFace ? WET_ALPHA : SWAY_ALPHA[swayMode];
    buf.cry[v] = _vc[s];
  }
}
const L15 = 255 / 15;

// Full-block face with smooth light and AO. `topH` (1/16 units) lowers the top edge. A negative
// `topH` takes one height per top corner from LIQ_H[cx + cz * 2] (sloped liquid surfaces).
const LIQ_H = new Int32Array(4);
function emitCubeFace(buf, x, y, z, p, f, tile, tint, topH, smooth) {
  const F = FACES[f], pf = p + F.off;
  const u0 = (tile & 15) * 256 + 1, v0 = (tile >> 4) * 256 + 1;
  const aos = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) {
    const c = F.c[k];
    const h = topH < 0 ? LIQ_H[c[0] + c[2] * 2] : topH;
    _vx[k * 3] = (x + c[0]) * 16; _vx[k * 3 + 1] = y * 16 + (c[1] ? h : 0); _vx[k * 3 + 2] = (z + c[2]) * 16;
    const uc = UV_CORNERS[k];
    const vTop = h < 16 && f !== 2 && f !== 3 ? (16 - h) * 16 : 0;
    _vuv[k * 2] = u0 + uc[0] * 254; _vuv[k * 2 + 1] = v0 + (uc[1] ? 254 : vTop);
    let sk = PS[pf], bl = PL[pf], cr = PC[pf], ao = 3;
    if (smooth) {
      const o = F.ao[k];
      const s1 = OPAQUE[PB[pf + o[0]]], s2 = OPAQUE[PB[pf + o[1]]], s3 = OPAQUE[PB[pf + o[2]]];
      ao = (s1 && s2) ? 0 : 3 - s1 - s2 - s3;
      let n = 1;
      if (!s1) { sk += PS[pf + o[0]]; bl += PL[pf + o[0]]; cr += PC[pf + o[0]]; n++; }
      if (!s2) { sk += PS[pf + o[1]]; bl += PL[pf + o[1]]; cr += PC[pf + o[1]]; n++; }
      if (!s3 && !(s1 && s2)) { sk += PS[pf + o[2]]; bl += PL[pf + o[2]]; cr += PC[pf + o[2]]; n++; }
      sk /= n; bl /= n; cr /= n;
    }
    aos[k] = ao * 4 + (sk + Math.max(bl, cr)) * 0.01;
    _vc[k] = cr * L15;
    _vl[k * 4] = sk * L15; _vl[k * 4 + 1] = bl * L15; _vl[k * 4 + 2] = ao * 85; _vl[k * 4 + 3] = F.shade * 255;
  }
  wetFace = buf === QB_OPAQUE && LIQ_KIND[PB[pf]] === 1;
  pushQuad(buf, tint, aos[0] + aos[2] < aos[1] + aos[3]);
  wetFace = false;
}

// Arbitrary quad with flat light (plants, torch, cactus sides). Corners in 1/16 units.
function emitFlat(buf, corners, uvRect, sk, bl, shade, tint) {
  for (let k = 0; k < 4; k++) {
    _vx[k * 3] = corners[k * 3]; _vx[k * 3 + 1] = corners[k * 3 + 1]; _vx[k * 3 + 2] = corners[k * 3 + 2];
    const uc = UV_CORNERS[k];
    _vuv[k * 2] = uc[0] ? uvRect[2] : uvRect[0]; _vuv[k * 2 + 1] = uc[1] ? uvRect[3] : uvRect[1];
    _vl[k * 4] = sk * L15; _vl[k * 4 + 1] = bl * L15; _vl[k * 4 + 2] = 255; _vl[k * 4 + 3] = shade * 255;
    _vc[k] = flatCry * L15;
  }
  pushQuad(buf, tint, false);
}
const tileRect = (tile, px0, py0, px1, py1) => {
  const bu = (tile & 15) * 256, bv = (tile >> 4) * 256;
  return [bu + px0 * 16 + 1, bv + py0 * 16 + 1, bu + px1 * 16 - 1, bv + py1 * 16 - 1];
};
const WHITE = [255, 255, 255];
const _tint = [0, 0, 0];
const _corners = new Int32Array(12);
// A rail: 1 quad 1/16 above the floor. A slope quad rises 1 block toward DIR4[up].
// Corner k of the tile takes the cell corner RAIL_QUAD[(k + r) & 3]. Each r turns the tile 90 deg
// and maps DIR4 d to d - 1: r = 1 lays the straight tile along x, and r = 4 - lo turns the curve.
const RAIL_QUAD = [[0, 1], [1, 1], [1, 0], [0, 0]];   // (x, z) of BL, BR, TR, TL with r = 0
function railMesh(buf, x, y, z, v, sk, bl) {
  const curve = v >= 6, up = railUp(v), tile = FACE_TILE[(B.RAIL + v) * 6];
  const r = curve ? (4 - (v - 6)) & 3 : (RAIL_ENDS[v][0] & 1 ? 0 : 1);
  for (let k = 0; k < 4; k++) {
    const [cx, cz] = RAIL_QUAD[(k + r) & 3];
    const hi = up < 0 ? 0 : (DIR4[up][0] ? (DIR4[up][0] > 0 ? cx : 1 - cx) : (DIR4[up][1] > 0 ? cz : 1 - cz));
    _corners[k * 3] = (x + cx) * 16; _corners[k * 3 + 1] = y * 16 + 1 + hi * 16; _corners[k * 3 + 2] = (z + cz) * 16;
  }
  emitFlat(buf, _corners, tileRect(tile, 0, 0, 16, 16), sk, bl, 1, WHITE);
}
function box(buf, x, y, z, x0, y0, z0, x1, y1, z1, tile, sk, bl, uvSide, uvTop, skipBottom) {
  // x0..z1 in 1/16 units inside the block
  const X = x * 16, Y = y * 16, Z = z * 16;
  const faces = [
    [X + x1, Y + y0, Z + z1, X + x1, Y + y0, Z + z0, X + x1, Y + y1, Z + z0, X + x1, Y + y1, Z + z1, 0.6],
    [X + x0, Y + y0, Z + z0, X + x0, Y + y0, Z + z1, X + x0, Y + y1, Z + z1, X + x0, Y + y1, Z + z0, 0.6],
    [X + x0, Y + y1, Z + z1, X + x1, Y + y1, Z + z1, X + x1, Y + y1, Z + z0, X + x0, Y + y1, Z + z0, 1.0],
    [X + x0, Y + y0, Z + z0, X + x1, Y + y0, Z + z0, X + x1, Y + y0, Z + z1, X + x0, Y + y0, Z + z1, 0.5],
    [X + x0, Y + y0, Z + z1, X + x1, Y + y0, Z + z1, X + x1, Y + y1, Z + z1, X + x0, Y + y1, Z + z1, 0.8],
    [X + x1, Y + y0, Z + z0, X + x0, Y + y0, Z + z0, X + x0, Y + y1, Z + z0, X + x1, Y + y1, Z + z0, 0.8],
  ];
  for (let f = 0; f < 6; f++) {
    if (f === 3 && skipBottom) continue;
    const a = faces[f];
    for (let i = 0; i < 12; i++) _corners[i] = a[i];
    emitFlat(buf, _corners, f === 2 || f === 3 ? uvTop : uvSide, sk, bl, a[12], WHITE);
  }
}

// Wall torch: the torch stick leans 22° away from its wall. The model is built in local
// coordinates (u from the wall, h up, w along the wall; 1/16 units) and then turns about the
// cell centre so that +u points along DIR4[f]. The base touches the wall at h 3; the head
// sits at u 4..6, h 13. Shear and rotation keep integer corners and the face winding.
const WALL_TORCH = (() => {
  const u0 = 0, u1 = 2, h0 = 3, h1 = 13, w0 = 7, w1 = 9, lean = 4;
  const q = (a) => a.map((c, i) => (i % 3 === 0 && a[i + 1] === h1 ? c + lean : c));   // shear u by height
  return [   // [corners (u, h, w) x4, uv: 0 side / 1 head / 2 foot, local axis: 0 u, 1 h, 2 w]
    [q([u1, h0, w1, u1, h0, w0, u1, h1, w0, u1, h1, w1]), 0, 0],
    [q([u0, h0, w0, u0, h0, w1, u0, h1, w1, u0, h1, w0]), 0, 0],
    [q([u0, h1, w1, u1, h1, w1, u1, h1, w0, u0, h1, w0]), 1, 1],
    [q([u0, h0, w0, u1, h0, w0, u1, h0, w1, u0, h0, w1]), 2, 1],
    [q([u0, h0, w1, u1, h0, w1, u1, h1, w1, u0, h1, w1]), 0, 2],
    [q([u1, h0, w0, u0, h0, w0, u0, h1, w0, u1, h1, w0]), 0, 2],
  ];
})();
function wallTorch(buf, x, y, z, f, sk) {
  const t = TILE.torch, [dx, dz] = DIR4[f], X = x * 16, Y = y * 16, Z = z * 16;
  const uv = [tileRect(t, 7, 6, 9, 16), tileRect(t, 7, 6, 9, 8), tileRect(t, 7, 14, 9, 16)];
  for (const [c, uvi, axis] of WALL_TORCH) {
    for (let k = 0; k < 4; k++) {
      const u = c[k * 3] - 8, w = c[k * 3 + 2] - 8;   // turn (u, w) so +u -> (dx, dz), +w -> (-dz, dx)
      _corners[k * 3] = X + 8 + dx * u - dz * w;
      _corners[k * 3 + 1] = Y + c[k * 3 + 1];
      _corners[k * 3 + 2] = Z + 8 + dz * u + dx * w;
    }
    // face shade follows the world axis after the turn: X faces 0.6, Z faces 0.8, top 1, bottom 0.5
    const shade = axis === 1 ? (uvi === 1 ? 1 : 0.5) : ((axis === 0) === (dx !== 0) ? 0.6 : 0.8);
    emitFlat(buf, _corners, uv[uvi], sk, 15, shade, WHITE);
  }
}

// Crystal cluster. The model is built in local coordinates (1/16 units): h runs along the growth
// direction from the attached face, u and w lie across it. crystalXform turns it into the cell for
// variant v (CRYSTAL_GROW[v]). Every turn has determinant +1, so the face winding stays correct.
function crystalXform(v, u, h, w, out, o) {
  if (v === 0) { out[o] = u; out[o + 1] = h; out[o + 2] = w; return; }
  if (v === 1) { out[o] = u; out[o + 1] = 16 - h; out[o + 2] = 16 - w; return; }
  const [dx, , dz] = CRYSTAL_GROW[v];
  out[o] = 8 + dx * (h - 8) - dz * (w - 8); out[o + 1] = 16 - u; out[o + 2] = 8 + dz * (h - 8) + dx * (w - 8);
}
// One cluster per cell hash: a tall centre crystal and 3 or 4 smaller crystals that lean outward.
// A crystal is [base u, base w, half width, body height, tip height, lean u, lean w] in 1/16 units.
const CRYSTAL_MODELS = (() => {
  const models = [];
  for (let m = 0; m < 8; m++) {
    const r = mulberry32(0xc7a5 + m * 977), list = [];
    list.push([8, 8, 2, 7 + Math.floor(r() * 3), 3, Math.round(r() * 2 - 1), Math.round(r() * 2 - 1)]);
    const n = 3 + (r() < 0.5 ? 1 : 0), a0 = r() * Math.PI * 2;
    for (let k = 0; k < n; k++) {
      const a = a0 + k * Math.PI * 2 / n + (r() - 0.5) * 0.8, d = 4 + r() * 1.5, cu = Math.round(8 + Math.cos(a) * d), cw = Math.round(8 + Math.sin(a) * d);
      const lean = 1 + Math.floor(r() * 2);
      list.push([cu, cw, 1, 3 + Math.floor(r() * 4), 2, Math.round(Math.cos(a) * lean), Math.round(Math.sin(a) * lean)]);
    }
    models.push(list);
  }
  return models;
})();
const _cq = new Int32Array(12), _cn = [0, 0, 0];
// Emits one crystal face from local corners (u, h, w) x4.
function crystalFace(buf, X, Y, Z, v, loc, uv, sk, bl) {
  for (let k = 0; k < 4; k++) crystalXform(v, loc[k * 3], loc[k * 3 + 1], loc[k * 3 + 2], _cq, k * 3);
  // face normal from two edges; shade follows it like cube faces (X 0.6, Z 0.8, up 1, down 0.5)
  const ax = _cq[3] - _cq[0], ay = _cq[4] - _cq[1], az = _cq[5] - _cq[2];
  const bx = _cq[6] - _cq[0], by = _cq[7] - _cq[1], bz = _cq[8] - _cq[2];
  _cn[0] = ay * bz - az * by; _cn[1] = az * bx - ax * bz; _cn[2] = ax * by - ay * bx;
  const len2 = _cn[0] * _cn[0] + _cn[1] * _cn[1] + _cn[2] * _cn[2] || 1;
  const shade = (_cn[0] * _cn[0] * 0.6 + _cn[2] * _cn[2] * 0.8 + _cn[1] * _cn[1] * (_cn[1] > 0 ? 1 : 0.5)) / len2;
  for (let k = 0; k < 4; k++) { _corners[k * 3] = X + _cq[k * 3]; _corners[k * 3 + 1] = Y + _cq[k * 3 + 1]; _corners[k * 3 + 2] = Z + _cq[k * 3 + 2]; }
  emitFlat(buf, _corners, uv, sk, bl, shade, WHITE);
}
const _loc = new Int32Array(12);
function crystalCluster(buf, x, y, z, id, sk, bl) {
  const v = id - B.CRYSTAL, t = TILE.crystal, X = x * 16, Y = y * 16, Z = z * 16;
  const hsh = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791);
  const model = CRYSTAL_MODELS[(hsh >>> 7) & 7];
  const cl = (n) => Math.max(0, Math.min(16, n));
  const q = (...c) => { for (let i = 0; i < 12; i++) _loc[i] = c[i]; return _loc; };
  for (const [cu, cw, r, hb, ht, lu, lw] of model) {
    const u0 = cl(cu - r), u1 = cl(cu + r), w0 = cl(cw - r), w1 = cl(cw + r);            // base ring
    const U0 = cl(u0 + lu), U1 = cl(u1 + lu), W0 = cl(w0 + lw), W1 = cl(w1 + lw);        // top ring
    const au = cl(cu + lu * 2), aw = cl(cw + lw * 2), ah = hb + ht;                      // tip apex
    const side = tileRect(t, 8 - r * 2, Math.max(3, 16 - hb), 8 + r * 2, 16), tip = tileRect(t, 8 - r * 2, 0, 8 + r * 2, 3);
    crystalFace(buf, X, Y, Z, v, q(u1, 0, w1, u1, 0, w0, U1, hb, W0, U1, hb, W1), side, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(u0, 0, w0, u0, 0, w1, U0, hb, W1, U0, hb, W0), side, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(u0, 0, w1, u1, 0, w1, U1, hb, W1, U0, hb, W1), side, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(u1, 0, w0, u0, 0, w0, U0, hb, W0, U1, hb, W0), side, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(U1, hb, W1, U1, hb, W0, au, ah, aw, au, ah, aw), tip, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(U0, hb, W0, U0, hb, W1, au, ah, aw, au, ah, aw), tip, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(U0, hb, W1, U1, hb, W1, au, ah, aw, au, ah, aw), tip, sk, bl);
    crystalFace(buf, X, Y, Z, v, q(U1, hb, W0, U0, hb, W0, au, ah, aw, au, ah, aw), tip, sk, bl);
  }
}

// Box with flat light whose UVs fit each face (door panels, stairs). b = [x0, y0, z0, x1, y1, z1] in
// 1/16 units. An optional face(f, b) returns false to skip face f, or sets _fl and flatCry for its light.
const _fl = [0, 0];
function boxFit(buf, x, y, z, b, tile, sk, bl, face) {
  const [x0, y0, z0, x1, y1, z1] = b, X = x * 16, Y = y * 16, Z = z * 16;
  const faces = [
    [X + x1, Y + y0, Z + z1, X + x1, Y + y0, Z + z0, X + x1, Y + y1, Z + z0, X + x1, Y + y1, Z + z1, 0.6, 16 - z1, 16 - z0, y0, y1],
    [X + x0, Y + y0, Z + z0, X + x0, Y + y0, Z + z1, X + x0, Y + y1, Z + z1, X + x0, Y + y1, Z + z0, 0.6, z0, z1, y0, y1],
    [X + x0, Y + y1, Z + z1, X + x1, Y + y1, Z + z1, X + x1, Y + y1, Z + z0, X + x0, Y + y1, Z + z0, 1.0, x0, x1, 16 - z1, 16 - z0],
    [X + x0, Y + y0, Z + z0, X + x1, Y + y0, Z + z0, X + x1, Y + y0, Z + z1, X + x0, Y + y0, Z + z1, 0.5, x0, x1, z0, z1],
    [X + x0, Y + y0, Z + z1, X + x1, Y + y0, Z + z1, X + x1, Y + y1, Z + z1, X + x0, Y + y1, Z + z1, 0.8, x0, x1, y0, y1],
    [X + x1, Y + y0, Z + z0, X + x0, Y + y0, Z + z0, X + x0, Y + y1, Z + z0, X + x1, Y + y1, Z + z0, 0.8, 16 - x1, 16 - x0, y0, y1],
  ];
  for (let f = 0; f < 6; f++) {
    const a = faces[f];
    if (face) { if (!face(f, b)) continue; sk = _fl[0]; bl = _fl[1]; }
    for (let i = 0; i < 12; i++) _corners[i] = a[i];
    // u runs along the face; v runs down from the top (16 - y)
    const r = a[13] === a[14] || a[15] === a[16] ? null : tileRect(tile, a[13], 16 - a[16], a[14], 16 - a[15]);
    if (r) emitFlat(buf, _corners, r, sk, bl, a[12], WHITE);
  }
}
// Stair: the boxes of its shape, with flat light per face. A face takes the light of the cell it
// faces. A face on the cell border against an opaque block is hidden. An inner face against an
// opaque block takes the stair cell's own light.
function stairMesh(buf, x, y, z, p, id) {
  const onSlab = stairV(id) & 4 ? 2 : 3;   // a step box's face that lies on the slab
  const boxes = STAIR_BOXES[stairKey(id, (dx, dz) => PB[p + dx + dz * PAD])];
  const face = (f, b) => {
    if (f === onSlab && b !== boxes[0]) return false;
    const F = FACES[f], ax = F.n[0] ? 0 : F.n[1] ? 1 : 2;
    const edge = F.n[ax] > 0 ? b[ax + 3] === 16 : b[ax] === 0;
    let q = p + F.off;
    if (OPAQUE[PB[q]]) { if (edge) return false; q = p; }
    _fl[0] = PS[q]; _fl[1] = PL[q]; flatCry = PC[q];
    return true;
  };
  for (const b of boxes) boxFit(buf, x, y, z, b, FACE_TILE[id * 6], 0, 0, face);
}
// Door panels in 1/16 units: PANEL[k] is the 3/16 slab on the near side of the cell for direction k.
const DOOR_PANEL = [[0, 0, 0, 3, 16, 16], [0, 0, 0, 16, 16, 3], [13, 0, 0, 16, 16, 16], [0, 0, 13, 16, 16, 16]];
const doorBox = (id) => { const v = id - B.DOOR, f = v & 3; return DOOR_PANEL[(v >> 2) & 1 ? (f + 1) & 3 : f]; };

function fillPadded(world, chunk) {
  PB.fill(B.AIR); PS.fill(15); PL.fill(0); PC.fill(0);
  // bottom padding row (y = -1) acts as opaque bedrock
  for (let i = 0; i < PSY; i++) { PB[i] = B.BEDROCK; PS[i] = 0; }
  for (let pz = 0; pz < PAD; pz++) for (let px = 0; px < PAD; px++) {
    const lx = px - 1, lz = pz - 1;
    const ox = lx < 0 ? -1 : lx >= CS ? 1 : 0, oz = lz < 0 ? -1 : lz >= CS ? 1 : 0;
    const c = (ox || oz) ? world.chunks.get(ckey(chunk.cx + ox, chunk.cz + oz)) : chunk;
    const bi = (pz - 0) * PAD + px;
    if (!c) {
      for (let y = 0; y < H; y++) { const p = (y + 1) * PSY + bi; PB[p] = UNLOADED; PS[p] = 0; }
      continue;
    }
    const sx = lx & 15, sz = lz & 15, base = (sz << 4) | sx;
    const cb = c.blocks, cs = c.sky, cl = c.blk, cc = c.cry;
    for (let y = 0; y < H; y++) {
      const s = (y << 8) | base, p = (y + 1) * PSY + bi;
      PB[p] = cb[s]; PS[p] = cs[s]; PL[p] = cl[s]; PC[p] = cc[s];
    }
    // biome tint of this column
    const b = c.biomes[(sz << 4) | sx];
    const g = BIOME_GRASS[b], fo = BIOME_FOLIAGE[b], ti = bi * 3;
    TINT_G[ti] = g[0]; TINT_G[ti + 1] = g[1]; TINT_G[ti + 2] = g[2];
    TINT_F[ti] = fo[0]; TINT_F[ti + 1] = fo[1]; TINT_F[ti + 2] = fo[2];
  }
  // 3x3 box blur of the tint tables, twice, for smooth biome borders
  for (const T of [TINT_G, TINT_F]) for (let pass = 0; pass < 2; pass++) {
    for (let pz = 0; pz < PAD; pz++) for (let px = 0; px < PAD; px++) {
      let r = 0, g = 0, b = 0, n = 0;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx, qz = pz + dz;
        if (qx < 0 || qz < 0 || qx >= PAD || qz >= PAD) continue;
        const k = (qz * PAD + qx) * 3; r += T[k]; g += T[k + 1]; b += T[k + 2]; n++;
      }
      const k = (pz * PAD + px) * 3; TINT_TMP[k] = r / n; TINT_TMP[k + 1] = g / n; TINT_TMP[k + 2] = b / n;
    }
    T.set(TINT_TMP);
  }
}

function buildChunkMesh(world, chunk) {
  const t0 = performance.now();
  fillPadded(world, chunk);
  const ob = QB_OPAQUE, wb = QB_WATER;
  ob.n = 0; wb.n = 0;
  let maxY = 0;
  for (let i = 0; i < CS * CS; i++) if (chunk.heights[i] > maxY) maxY = chunk.heights[i];
  maxY = Math.min(H - 1, maxY + 1);
  let minYSeen = H, maxYSeen = 0;
  for (let y = 0; y <= maxY; y++) for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
    const p = (y + 1) * PSY + (z + 1) * PAD + (x + 1);
    const id = PB[p];
    if (id === B.AIR) continue;
    const shape = SHAPE_OF[id];
    const before = ob.n + wb.n;
    flatCry = PC[p];
    if (shape === SHAPE.CUBE) {
      const tintable = id === B.GRASS || (IS_LEAF[id] && LEAF_COLOR[id] === 0);   // colored leaves bake their color
      if (tintable) {
        const T = id === B.GRASS ? TINT_G : TINT_F, k = ((z + 1) * PAD + (x + 1)) * 3;
        _tint[0] = T[k]; _tint[1] = T[k + 1]; _tint[2] = T[k + 2];
      }
      const tint = tintable ? _tint : WHITE;
      swayMode = IS_LEAF[id] ? SWAY_LEAF : GLOWS[id] ? SWAY_SOFTGLOW : SWAY_NONE;
      const glass = id === B.GLASS;
      for (let f = 0; f < 6; f++) {
        const nb = PB[p + FACES[f].off];
        if (OPAQUE[nb] || (glass && nb === B.GLASS)) continue;
        emitCubeFace(ob, x, y, z, p, f, FACE_TILE[id * 6 + f], tint, 16, true);
      }
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.WATER) {
      // Liquid. Each top corner averages the heights of the 4 cells that share it (Minecraft
      // rule): same kind above any of them -> full height; near-full cells weigh 10x.
      const kind = LIQ_KIND[id], above = PB[p + PSY];
      const full = LIQ_KIND[above] === kind;
      if (full) LIQ_H.fill(16);
      else for (let cz = 0; cz < 2; cz++) for (let cx = 0; cx < 2; cx++) {
        let sum = 0, wsum = 0, top = false;
        for (let dz = cz - 1; dz <= cz; dz++) for (let dx = cx - 1; dx <= cx; dx++) {
          const q = p + dx + dz * PAD, b = PB[q];
          if (LIQ_KIND[b] === kind) {
            if (LIQ_KIND[PB[q + PSY]] === kind) { top = true; break; }
            const lv = LIQ_LEVEL[b], h = lv >= 8 ? 14 : 2 + lv * 1.6, w = h >= 11.2 ? 10 : 1;
            sum += h * w; wsum += w;
          } else if (!SOLID[b]) wsum += 1;
        }
        LIQ_H[cx + cz * 2] = top ? 16 : Math.max(1, Math.round(sum / (wsum || 1)));
      }
      const lava = kind === 2, buf = lava ? ob : wb, tile = lava ? TILE.lava : TILE.water;
      if (lava) swayMode = SWAY_SOFTGLOW;
      for (let f = 0; f < 6; f++) {
        const nb = PB[p + FACES[f].off];
        if (LIQ_KIND[nb] === kind || OPAQUE[nb]) continue;
        emitCubeFace(buf, x, y, z, p, f, tile, WHITE, full ? 16 : -1, false);
      }
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.DOOR) {
      boxFit(ob, x, y, z, doorBox(id), FACE_TILE[id * 6], PS[p], PL[p]);
    } else if (shape === SHAPE.STAIRS) {
      stairMesh(ob, x, y, z, p, id);
    } else if (shape === SHAPE.RAIL) {
      railMesh(ob, x, y, z, id - B.RAIL, PS[p], PL[p]);
    } else if (shape === SHAPE.FARMLAND) {   // a cube with its top at 15/16
      for (let f = 0; f < 6; f++) {
        if (f !== 2 && OPAQUE[PB[p + FACES[f].off]]) continue;
        emitCubeFace(ob, x, y, z, p, f, FACE_TILE[id * 6 + f], WHITE, 15, true);
      }
    } else if (shape === SHAPE.CROP) {   // 4 planes in a # pattern, sunk 1/16 into the farmland
      const tile = FACE_TILE[id * 6], r = tileRect(tile, 0, 0, 16, 16);
      const X = x * 16, Y = y * 16 - 1, Z = z * 16;
      swayMode = SWAY_PLANT;
      for (const o of [4, 12]) {
        const q = [
          [X, Y, Z + o, X + 16, Y, Z + o, X + 16, Y + 16, Z + o, X, Y + 16, Z + o],
          [X + 16, Y, Z + o, X, Y, Z + o, X, Y + 16, Z + o, X + 16, Y + 16, Z + o],
          [X + o, Y, Z + 16, X + o, Y, Z, X + o, Y + 16, Z, X + o, Y + 16, Z + 16],
          [X + o, Y, Z, X + o, Y, Z + 16, X + o, Y + 16, Z + 16, X + o, Y + 16, Z],
        ];
        for (const c of q) { for (let i = 0; i < 12; i++) _corners[i] = c[i]; emitFlat(ob, _corners, r, PS[p], PL[p], 0.9, WHITE); }
      }
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.CROSS) {
      const tile = FACE_TILE[id * 6], r = tileRect(tile, 0, 0, 16, 16);
      const tint = id === B.TALL_GRASS ? (() => { const k = ((z + 1) * PAD + (x + 1)) * 3; _tint[0] = TINT_G[k]; _tint[1] = TINT_G[k + 1]; _tint[2] = TINT_G[k + 2]; return _tint; })() : WHITE;
      const X = x * 16, Y = y * 16, Z = z * 16, a = 2, b = 14, top = id === B.TALL_GRASS ? 15 : 16;
      const quads = [
        [X + a, Y, Z + a, X + b, Y, Z + b, X + b, Y + top, Z + b, X + a, Y + top, Z + a],
        [X + b, Y, Z + b, X + a, Y, Z + a, X + a, Y + top, Z + a, X + b, Y + top, Z + b],
        [X + a, Y, Z + b, X + b, Y, Z + a, X + b, Y + top, Z + a, X + a, Y + top, Z + b],
        [X + b, Y, Z + a, X + a, Y, Z + b, X + a, Y + top, Z + b, X + b, Y + top, Z + a],
      ];
      swayMode = SWAY_PLANT;
      for (const q of quads) { for (let i = 0; i < 12; i++) _corners[i] = q[i]; emitFlat(ob, _corners, r, PS[p], PL[p], 0.9, tint); }
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.TORCH) {
      const t = TILE.torch;
      swayMode = SWAY_GLOW;
      const f = BLOCKS[id].facing;
      if (f >= 0) wallTorch(ob, x, y, z, f, PS[p]);
      else box(ob, x, y, z, 7, 0, 7, 9, 10, 9, t, PS[p], 15, tileRect(t, 7, 6, 9, 16), tileRect(t, 7, 6, 9, 8), true);
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.LADDER) {   // two rails and four rungs as boxes against the wall
      const f = BLOCKS[id].facing, [dx] = DIR4[f], back = DIR4[f][0] + DIR4[f][1] > 0, t = TILE.ladder;
      // local u (out from the wall), w (along the wall), h (up), in 1/16 units
      const part = (u0, u1, w0, w1, h0, h1, uv) => {
        const a = back ? u0 : 16 - u1, b = back ? u1 : 16 - u0;
        if (dx) box(ob, x, y, z, a, h0, w0, b, h1, w1, t, PS[p], PL[p], uv, uv);
        else box(ob, x, y, z, w0, h0, a, w1, h1, b, t, PS[p], PL[p], uv, uv);
      };
      const rail = tileRect(t, 2, 0, 4, 16);
      part(0, 3, 2, 4, 0, 16, rail); part(0, 3, 12, 14, 0, 16, rail);   // rails stand 3/16 off the wall
      const rung = tileRect(t, 4, 1, 12, 3);
      for (const h of [2, 6, 10, 14]) part(1, 2, 4, 12, h, h + 1, rung);   // rungs sit inside the rails
    } else if (shape === SHAPE.PORTAL) {
      // One quad through the cell centre, in the frame plane. The pane spans x when a portal
      // neighbour lies along x (every opening is at least 2 wide), else z. The material is
      // double-sided, so one quad shows from both sides.
      const along = PB[p + 1] === id || PB[p - 1] === id, X = x * 16, Y = y * 16, Z = z * 16;
      const c = along ? [X, Y, Z + 8, X + 16, Y, Z + 8, X + 16, Y + 16, Z + 8, X, Y + 16, Z + 8]
        : [X + 8, Y, Z + 16, X + 8, Y, Z, X + 8, Y + 16, Z, X + 8, Y + 16, Z + 16];
      for (let i = 0; i < 12; i++) _corners[i] = c[i];
      swayMode = id === B.PORTAL_CRYSTAL ? SWAY_PORTAL_CRY : SWAY_PORTAL;
      emitFlat(wb, _corners, tileRect(FACE_TILE[id * 6], 0, 0, 16, 16), PS[p], PL[p], 0.8, WHITE);
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.CRYSTAL) {
      swayMode = SWAY_CRYSTAL; flatCry = 15;
      crystalCluster(ob, x, y, z, id, PS[p], PL[p]);
      swayMode = SWAY_NONE;
    } else if (shape === SHAPE.CACTUS) {
      const side = TILE.cactus_side, top = TILE.cactus_top;
      const sk = PS[p], bl = PL[p];
      const X = x * 16, Y = y * 16, Z = z * 16;
      const sr = tileRect(side, 0, 0, 16, 16);
      const sides = [
        [X + 15, Y, Z + 16, X + 15, Y, Z, X + 15, Y + 16, Z, X + 15, Y + 16, Z + 16, 0.6],
        [X + 1, Y, Z, X + 1, Y, Z + 16, X + 1, Y + 16, Z + 16, X + 1, Y + 16, Z, 0.6],
        [X, Y, Z + 15, X + 16, Y, Z + 15, X + 16, Y + 16, Z + 15, X, Y + 16, Z + 15, 0.8],
        [X + 16, Y, Z + 1, X, Y, Z + 1, X, Y + 16, Z + 1, X + 16, Y + 16, Z + 1, 0.8],
      ];
      for (const s of sides) { for (let i = 0; i < 12; i++) _corners[i] = s[i]; emitFlat(ob, _corners, sr, sk, bl, s[12], WHITE); }
      const above = PB[p + PSY], below = PB[p - PSY];
      if (above !== B.CACTUS && !OPAQUE[above]) {
        const q = [X + 1, Y + 16, Z + 15, X + 15, Y + 16, Z + 15, X + 15, Y + 16, Z + 1, X + 1, Y + 16, Z + 1];
        for (let i = 0; i < 12; i++) _corners[i] = q[i];
        emitFlat(ob, _corners, tileRect(top, 1, 1, 15, 15), PS[p + PSY], PL[p + PSY], 1, WHITE);
      }
      if (below !== B.CACTUS && !OPAQUE[below]) {
        const q = [X + 1, Y, Z + 1, X + 15, Y, Z + 1, X + 15, Y, Z + 15, X + 1, Y, Z + 15];
        for (let i = 0; i < 12; i++) _corners[i] = q[i];
        emitFlat(ob, _corners, tileRect(top, 1, 1, 15, 15), sk, bl, 0.5, WHITE);
      }
    }
    if (ob.n + wb.n !== before) { if (y < minYSeen) minYSeen = y; if (y > maxYSeen) maxYSeen = y; }
  }
  chunk.opaqueMesh = setChunkGeometry(world, chunk, chunk.opaqueMesh, ob, terrainMaterial, minYSeen, maxYSeen, 0);
  chunk.waterMesh = setChunkGeometry(world, chunk, chunk.waterMesh, wb, waterMaterial, minYSeen, maxYSeen, 1);
  world.stats.meshMs = performance.now() - t0;
}

function setChunkGeometry(world, chunk, mesh, buf, material, y0, y1, order) {
  if (mesh) { mesh.geometry.setIndex(null); mesh.geometry.dispose(); }
  if (buf.n === 0) { if (mesh) world.scene.remove(mesh); return null; }
  const n = buf.n;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(buf.pos.slice(0, n * 12), 3));
  g.setAttribute('aUv', new THREE.BufferAttribute(buf.uv.slice(0, n * 8), 2));
  g.setAttribute('aLight', new THREE.BufferAttribute(buf.light.slice(0, n * 16), 4, true));
  g.setAttribute('aTint', new THREE.BufferAttribute(buf.tint.slice(0, n * 16), 4, true));
  g.setAttribute('aCry', new THREE.BufferAttribute(buf.cry.slice(0, n * 4), 1, true));
  g.setIndex(QUAD_INDEX);
  g.setDrawRange(0, n * 6);
  const ymid = (y0 + y1 + 1) * 8, yh = (y1 - y0 + 1) * 8;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(128, ymid, 128), Math.sqrt(128 * 128 * 2 + yh * yh) + 16);
  g.boundingBox = new THREE.Box3(new THREE.Vector3(0, y0 * 16, 0), new THREE.Vector3(256, (y1 + 1) * 16, 256));
  if (!mesh) {
    mesh = new THREE.Mesh(g, material);
    mesh.position.set(chunk.cx * CS, 0, chunk.cz * CS);
    mesh.scale.setScalar(1 / 16);
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    mesh.renderOrder = order;
    world.scene.add(mesh);
  } else mesh.geometry = g;
  return mesh;
}

export { buildChunkMesh, crystalXform, doorBox, FACES, UV_CORNERS };
