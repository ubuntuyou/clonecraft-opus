import { THREE } from './three.js';
import { clamp, hashString, lerp, mulberry32 } from './config.js';
import {
  ARMOR_PIECES, ARMOR_TIERS, armorId, B, BLOCKS, DIR_FACE, I, IS_LEAF, IS_STAIR, ITEMS, TIERS, TOOL_KINDS,
  toolId,
} from './blocks.js';
import { BIOME, BIOME_FOLIAGE, BIOME_GRASS, TINT_ALPHA } from './biomes.js';

const ATLAS_SIZE = 256;
const atlasCanvas = document.createElement('canvas');
atlasCanvas.width = atlasCanvas.height = ATLAS_SIZE;
const actx = atlasCanvas.getContext('2d');
const TILE = {};          // tile name -> tile index
const TILE_PIX = {};      // tile name -> Uint8ClampedArray(16*16*4) (for icons / particles)
let tileCount = 0;

function tileNoise(rng, passes) {
  let a = new Float32Array(256);
  for (let i = 0; i < 256; i++) a[i] = rng();
  for (let p = 0; p < passes; p++) {
    const b = new Float32Array(256);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      let s = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s += a[((y + dy) & 15) * 16 + ((x + dx) & 15)];
      b[y * 16 + x] = s / 9;
    }
    a = b;
  }
  let mn = 1, mx = 0;
  for (const v of a) { if (v < mn) mn = v; if (v > mx) mx = v; }
  for (let i = 0; i < 256; i++) a[i] = (a[i] - mn) / ((mx - mn) || 1);
  return a;
}
// Wrapped Voronoi: returns {cell, edge} per pixel for cobble/gravel-like tiles.
function tileVoronoi(rng, n) {
  const pts = [];
  for (let i = 0; i < n; i++) pts.push([rng() * 16, rng() * 16]);
  const cell = new Int16Array(256), edge = new Float32Array(256), rel = new Float32Array(512);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    let d1 = 1e9, d2 = 1e9, c = 0, rx = 0, ry = 0;
    for (let i = 0; i < n; i++) {
      let dx = x + 0.5 - pts[i][0], dy = y + 0.5 - pts[i][1];
      dx -= Math.round(dx / 16) * 16; dy -= Math.round(dy / 16) * 16;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; c = i; rx = dx; ry = dy; } else if (d < d2) d2 = d;
    }
    const k = y * 16 + x;
    cell[k] = c; edge[k] = d2 - d1; rel[k * 2] = rx; rel[k * 2 + 1] = ry;
  }
  return { cell, edge, rel, pts };
}

function paintTile(name, painter) {
  const index = tileCount++;
  TILE[name] = index;
  const data = new Uint8ClampedArray(16 * 16 * 4);
  const rng = mulberry32(hashString(name) ^ 0x5bd1e995);
  const P = {
    rng,
    set(x, y, c, a = 255) { const i = ((y & 15) * 16 + (x & 15)) * 4; data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = a; },
    get(x, y) { const i = ((y & 15) * 16 + (x & 15)) * 4; return [data[i], data[i + 1], data[i + 2], data[i + 3]]; },
    alpha(x, y) { return data[((y & 15) * 16 + (x & 15)) * 4 + 3]; },
    fill(fn) { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) fn(x, y); },
    copy(from) { data.set(TILE_PIX[from]); },
  };
  painter(P, rng);
  TILE_PIX[name] = data;
  actx.putImageData(new ImageData(data, 16, 16), (index % 16) * 16, Math.floor(index / 16) * 16);
}
const shade = (c, f) => [c[0] * f, c[1] * f, c[2] * f];
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const gray = (v) => [v, v, v];

// ---- terrain tiles ---------------------------------------------------------------
function paintDirt(P, rng) {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    const k = y * 16 + x, r = rng();
    let c = mix3([116, 82, 56], [150, 108, 75], n[k]);
    if (r < 0.08) c = [96, 68, 46];
    else if (r < 0.13) c = [164, 122, 88];
    else if (r < 0.15) c = [128, 118, 108];
    P.set(x, y, shade(c, 0.94 + rng() * 0.12));
  });
}
paintTile('dirt', paintDirt);
paintTile('grass_top', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    let v = 150 + n[y * 16 + x] * 60 + (rng() - 0.5) * 34;
    if (rng() < 0.1) v -= 38;
    P.set(x, y, gray(v), TINT_ALPHA);
  });
});
paintTile('grass_side', (P, rng) => {
  paintDirt(P, rng);
  for (let x = 0; x < 16; x++) {
    let d = 3 + (rng() < 0.55 ? 1 : 0) + (rng() < 0.2 ? 1 : 0);
    if (rng() < 0.12) d += 2;
    for (let y = 0; y < d; y++) {
      const v = 160 + rng() * 55 - (y === d - 1 ? 30 : 0);
      P.set(x, y, gray(v), TINT_ALPHA);
    }
  }
});
function paintStone(P, rng) {
  const n = tileNoise(rng, 1), m = tileNoise(rng, 2);
  P.fill((x, y) => {
    const k = y * 16 + x;
    let v = 112 + n[k] * 26 + (rng() - 0.5) * 12;
    if (m[k] > 0.78) v -= 18;
    if (m[k] < 0.12) v += 12;
    P.set(x, y, gray(v));
  });
}
paintTile('stone', paintStone);
paintTile('cobble', (P, rng) => {
  const vor = tileVoronoi(rng, 9);
  const cellShade = []; for (let i = 0; i < 9; i++) cellShade.push(100 + rng() * 50);
  P.fill((x, y) => {
    const k = y * 16 + x;
    if (vor.edge[k] < 1.1) { P.set(x, y, gray(58 + rng() * 22)); return; }
    let v = cellShade[vor.cell[k]] + (rng() - 0.5) * 16;
    // light from the top-left: pixels facing up-left inside a stone are brighter
    const rx = vor.rel[k * 2], ry = vor.rel[k * 2 + 1];
    v += (-rx - ry) * 3.2;
    P.set(x, y, gray(clamp(v, 60, 190)));
  });
});
function paintOre(name, colors) {
  paintTile(name, (P, rng) => {
    paintStone(P, rng);
    const clusters = 4 + Math.floor(rng() * 2);
    for (let c = 0; c < clusters; c++) {
      const cx = 1 + Math.floor(rng() * 13), cy = 1 + Math.floor(rng() * 13);
      const size = 3 + Math.floor(rng() * 3);
      for (let i = 0; i < size; i++) {
        const x = cx + Math.floor(rng() * 3) - 1, y = cy + Math.floor(rng() * 3) - 1;
        P.set(x, y, colors[Math.floor(rng() * colors.length)]);
        if (rng() < 0.5) P.set(x + 1, y, shade(colors[0], 0.8));
      }
    }
  });
}
paintOre('coal_ore', [[36, 36, 36], [52, 52, 52], [22, 22, 22]]);
paintOre('iron_ore', [[222, 178, 146], [190, 142, 110], [168, 120, 90]]);
paintOre('copper_ore', [[214, 120, 66], [178, 92, 50], [96, 170, 140]]);
paintOre('gold_ore', [[250, 214, 64], [214, 170, 30], [255, 246, 160]]);
paintOre('ruby_ore', [[214, 24, 56], [150, 10, 36], [255, 120, 140]]);
paintOre('diamond_ore', [[92, 226, 218], [40, 170, 170], [210, 255, 250]]);
// Storage block tiles. C = [dark, mid, light]. Every style has a bevel: a lit top-left edge and a
// shadowed bottom-right edge. 'metal' adds an inset panel and a diagonal sheen. 'gem' adds
// diamond-shaped facet rings. 'coal' has a rough face with bright glints.
function paintStorage(name, C, style) {
  paintTile(name, (P, rng) => {
    const n = tileNoise(rng, 1);
    P.fill((x, y) => {
      const k = y * 16 + x, edge = Math.min(x, y, 15 - x, 15 - y);
      let t = 0.5 + (n[k] - 0.5) * (style === 'coal' ? 0.5 : 0.16);
      if (style === 'metal') {
        if (edge === 2) t -= 0.22;
        else if (edge > 2 && (x + y) % 14 >= 3 && (x + y) % 14 <= 5) t += 0.22;
      } else if (style === 'gem') {
        const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
        t += (Math.floor(d / 2.5) % 2 ? -0.14 : 0.1) + (x < y ? -0.06 : 0.06);
        if (rng() < 0.03) t = 1;
      } else if (rng() < 0.05) t = 0.95;
      if (x === 0 || y === 0) t = 0.92;
      else if (x === 15 || y === 15) t = 0.06;
      t = clamp(t, 0, 1);
      P.set(x, y, t < 0.5 ? mix3(C[0], C[1], t * 2) : mix3(C[1], C[2], (t - 0.5) * 2));
    });
  });
}
paintStorage('coal_block', [[14, 14, 16], [40, 40, 46], [104, 104, 116]], 'coal');
paintStorage('copper_block', [[140, 70, 40], [200, 112, 66], [240, 168, 116]], 'metal');
paintStorage('steel_block', [[92, 100, 114], [160, 170, 184], [222, 230, 240]], 'metal');
paintStorage('gold_block', [[176, 124, 16], [240, 200, 48], [255, 246, 150]], 'metal');
paintStorage('ruby_block', [[118, 8, 28], [204, 30, 60], [255, 116, 140]], 'gem');
paintStorage('diamond_block', [[28, 126, 126], [78, 216, 206], [196, 255, 250]], 'gem');
// TNT: red dynamite sticks with a white label band that reads "TNT"; the top shows the fuse.
const TNT_GLYPHS = [['###', '.#.', '.#.', '.#.', '.#.'], ['#..#', '##.#', '#.##', '#..#', '#..#']];
paintTile('tnt_side', (P, rng) => {
  const ink = new Set();
  [[2, 0], [6, 1], [11, 0]].forEach(([x0, g]) => TNT_GLYPHS[g].forEach((row, r) => [...row].forEach((c, i) => { if (c === '#') ink.add((6 + r) * 16 + x0 + i); })));
  P.fill((x, y) => {
    if (y >= 5 && y <= 11) P.set(x, y, ink.has(y * 16 + x) ? [24, 24, 28] : shade([236, 232, 222], 0.94 + rng() * 0.08));
    else P.set(x, y, shade([200, 36, 30], (x % 4 === 3 ? 0.72 : 1) * (0.92 + rng() * 0.12) * (y === 4 || y === 12 ? 0.8 : 1)));
  });
});
paintTile('tnt_top', (P, rng) => {
  P.fill((x, y) => P.set(x, y, shade([200, 36, 30], ((x % 4 === 3) || (y % 4 === 3) ? 0.7 : 1) * (0.9 + rng() * 0.12))));
  for (const [x, y] of [[7, 7], [8, 7], [7, 8], [8, 8]]) P.set(x, y, [96, 96, 100]);
  P.set(8, 6, [150, 150, 150]); P.set(9, 5, [180, 180, 176]);
});
paintTile('tnt_bottom', (P, rng) => P.fill((x, y) => P.set(x, y, shade([176, 30, 26], ((x % 4 === 3) || (y % 4 === 3) ? 0.7 : 1) * (0.9 + rng() * 0.12)))));
// Crystal: deep teal at the base (v = 1) to pale turquoise at the tip (v = 0), with long streaks and glints.
paintTile('crystal', (P, rng) => {
  const streak = Array.from({ length: 16 }, () => (rng() - 0.5) * 0.3);
  P.fill((x, y) => {
    let t = 1 - y / 15 + streak[x] + (rng() - 0.5) * 0.08;
    if (x === 0 || x === 15) t -= 0.2;
    if (rng() < 0.025) t = 1.25;
    t = clamp(t, 0, 1.25);
    P.set(x, y, t < 0.6 ? mix3([18, 92, 100], [52, 196, 190], t / 0.6) : mix3([52, 196, 190], [214, 255, 248], Math.min(1, (t - 0.6) / 0.6)));
  });
});
paintTile('obsidian', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    const v = n[y * 16 + x] + (rng() - 0.5) * 0.3;
    let c = mix3([16, 10, 26], [52, 34, 80], v);
    if (rng() < 0.04) c = [120, 96, 168];
    P.set(x, y, c);
  });
});
// Enchanting altar: obsidian with a diamond trim and lilac runes. Rune texels have red > 0.8, so they glow.
const RUNE = [238, 176, 255], RUNE_DIM = [150, 84, 196];
paintTile('altar_side', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    let c = mix3([16, 10, 26], [48, 30, 74], n[y * 16 + x] + (rng() - 0.5) * 0.25);
    if (y <= 2) c = y === 2 ? [20, 60, 70] : mix3([60, 190, 196], [190, 250, 246], rng() * 0.6 + (y === 0 ? 0.3 : 0));   // diamond trim
    P.set(x, y, c);
  });
  // three runes: small glyphs of 3x5 cells
  const glyphs = [[1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0], [0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0], [1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 1, 1, 1]];
  glyphs.forEach((g, k) => g.forEach((on, i) => { if (on) P.set(1 + k * 5 + (i % 3), 6 + Math.floor(i / 3), (i + k) % 4 ? RUNE : RUNE_DIM); }));
  for (let x = 0; x < 16; x++) if (rng() < 0.5) P.set(x, 14, RUNE_DIM);
});
paintTile('altar_top', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    const e = Math.min(x, y, 15 - x, 15 - y);
    let c = mix3([16, 10, 26], [48, 30, 74], n[y * 16 + x] + (rng() - 0.5) * 0.25);
    if (e === 0) c = mix3([60, 190, 196], [190, 250, 246], rng() * 0.6);   // diamond rim
    const d = Math.abs(x - 7.5) + Math.abs(y - 7.5);
    if (d > 4.2 && d < 5.4) c = RUNE;                                       // rune ring
    else if (d < 2.2) c = mix3([52, 196, 190], [214, 255, 248], 1 - d / 2.2);   // crystal eye
    P.set(x, y, c);
  });
});
// Lava: bright texels (red > 0.8) glow in the shader; dark crust takes block light.
paintTile('lava', (P, rng) => {
  const n = tileNoise(rng, 2), m = tileNoise(rng, 1);
  P.fill((x, y) => {
    const k = y * 16 + x, w = Math.sin((x * 0.7 + y * 0.4) + n[k] * 5) * 0.5 + 0.5;
    let c = mix3([226, 84, 8], [255, 196, 64], w * 0.8 + rng() * 0.2);
    if (m[k] > 0.8) c = mix3([150, 40, 6], [96, 22, 4], rng());
    P.set(x, y, c);
  });
});
// Glass: an opaque frame and a clear (alpha 0) pane with a few glints.
paintTile('glass', (P) => {
  P.fill((x, y) => {
    const edge = x === 0 || y === 0 || x === 15 || y === 15;
    if (edge) P.set(x, y, (x + y) % 5 === 0 ? [236, 246, 250] : [196, 220, 230]);
    else if ((x - y === 4 && x > 5 && x < 12) || (x - y === 6 && x > 8 && x < 13) || (x === 2 && y === 2)) P.set(x, y, [236, 246, 250]);
    else P.set(x, y, [0, 0, 0], 0);
  });
});
function paintStoneBrick(P, rng) {
  paintStone(P, rng);
  P.fill((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) P.set(x, y, gray(82 + rng() * 14));
    else if (x === 1 || y === 1) P.set(x, y, gray(150 + rng() * 14));
  });
}
paintTile('furnace_side', paintStoneBrick);
paintTile('furnace_top', (P, rng) => {
  paintStoneBrick(P, rng);
  P.fill((x, y) => { if (x > 3 && x < 12 && y > 3 && y < 12 && (x === 4 || y === 4 || x === 11 || y === 11)) P.set(x, y, gray(96)); });
});
function paintFurnaceFront(P, rng, lit) {
  paintStoneBrick(P, rng);
  P.fill((x, y) => {
    if (y >= 3 && y <= 5 && x >= 3 && x <= 12) P.set(x, y, gray(70 + rng() * 10));          // lintel
    if (y >= 8 && y <= 13 && x >= 4 && x <= 11) {                                      // fire box
      if (!lit) { P.set(x, y, gray(20 + rng() * 14)); return; }
      const h = 13 - y + (rng() - 0.5) * 2, flame = h < 2 + Math.abs(x - 7.5) * -0.35 + 3.5;
      P.set(x, y, flame ? (h < 2 ? [255, 236, 120] : [255, 150 + rng() * 60, 30]) : [60, 22, 8]);
    }
  });
}
paintTile('furnace_front', (P, rng) => paintFurnaceFront(P, rng, false));
paintTile('furnace_front_lit', (P, rng) => paintFurnaceFront(P, rng, true));
function paintChest(P, rng, face) {
  const offs = [5, 11, 2, 9];
  P.fill((x, y) => {
    const board = y >> 2, row = y & 3;
    let c = shade([150, 104, 50], 0.88 + rng() * 0.12);
    if (row === 3) c = [98, 66, 30];
    if (x === offs[board] && row !== 3) c = [110, 76, 36];
    if (x === 0 || y === 0 || x === 15 || y === 15) c = [70, 46, 20];
    if (face !== 'top' && y === 5) c = [70, 46, 20];                         // lid seam
    P.set(x, y, c);
  });
  if (face === 'front') for (let y = 4; y <= 8; y++) for (let x = 7; x <= 8; x++) P.set(x, y, y === 4 || y === 8 ? [120, 120, 124] : [196, 196, 204]);
}
paintTile('chest_side', (P, rng) => paintChest(P, rng, 'side'));
paintTile('chest_top', (P, rng) => paintChest(P, rng, 'top'));
paintTile('chest_front', (P, rng) => paintChest(P, rng, 'front'));
// Door halves: vertical boards in a frame. The top half has a two-pane window (cut out).
function paintDoor(P, rng, top) {
  P.fill((x, y) => {
    let c = shade([164, 128, 76], 0.88 + rng() * 0.14);
    if (x % 5 === 0) c = [118, 90, 50];
    if (x < 2 || x > 13 || (top ? y < 2 : y > 13)) c = [124, 94, 54];
    if (top && y >= 3 && y <= 11 && x >= 3 && x <= 12) c = (x === 7 || x === 8 || y === 7) ? [124, 94, 54] : null;
    if (!top && x === 12 && (y === 1 || y === 2)) c = [60, 60, 64];          // handle
    if (c) P.set(x, y, c); else P.set(x, y, [0, 0, 0], 0);
  });
}
paintTile('door_bottom', (P, rng) => paintDoor(P, rng, false));
paintTile('door_top', (P, rng) => paintDoor(P, rng, true));
paintTile('sand', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    let c = mix3([208, 194, 146], [226, 214, 170], n[y * 16 + x]);
    if (rng() < 0.08) c = [190, 174, 128];
    P.set(x, y, shade(c, 0.97 + rng() * 0.06));
  });
});
// ---- structure tiles (Batch 17)
// Moss: green patches from smoothed noise, stretched to 0..1 so the cover is about `cover` of the tile.
function paintMoss(P, rng, cover) {
  const n = tileNoise(rng, 2);
  let lo = 1, hi = 0; for (const v of n) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  P.fill((x, y) => {
    const t = (n[y * 16 + x] - lo) / (hi - lo + 1e-6);
    if (t > 1 - cover) P.set(x, y, shade(mix3([54, 92, 40], [92, 132, 56], rng()), 0.85 + t * 0.25));
  });
}
// Stone bricks: 2 rows of bricks in running bond with dark mortar and a lit top-left edge.
function paintBricks(P, rng) {
  paintStone(P, rng);
  P.fill((x, y) => {
    const row = y >> 3, jx = row ? 8 : 0, ly = y & 7, lx = (x - jx) & 15;
    if (ly === 7 || lx === 0) P.set(x, y, gray(72 + rng() * 12));
    else if (ly === 0 || lx === 1) P.set(x, y, gray(148 + rng() * 12));
    else if (ly === 6 || lx === 15) P.set(x, y, gray(104 + rng() * 10));
  });
}
paintTile('mossy_cobble', (P, rng) => { P.copy('cobble'); paintMoss(P, rng, 0.4); });
paintTile('stone_bricks', paintBricks);
paintTile('mossy_bricks', (P, rng) => { paintBricks(P, rng); paintMoss(P, rng, 0.35); });
paintTile('cracked_bricks', (P, rng) => {
  paintBricks(P, rng);
  for (let c = 0; c < 3; c++) {   // cracks: short random walks in dark gray
    let x = Math.floor(rng() * 16), y = Math.floor(rng() * 16);
    for (let i = 0; i < 9; i++) { P.set(x, y, gray(46 + rng() * 14)); x += rng() < 0.5 ? 1 : -1; if (rng() < 0.6) y++; }
  }
});
const SANDSTONE_COL = [[214, 200, 150], [228, 216, 170]];
paintTile('sandstone_top', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => P.set(x, y, shade(mix3(SANDSTONE_COL[0], SANDSTONE_COL[1], n[y * 16 + x]), 0.96 + rng() * 0.05)));
});
paintTile('sandstone_side', (P, rng) => {
  P.fill((x, y) => {
    let c = mix3(SANDSTONE_COL[0], SANDSTONE_COL[1], rng() * 0.6 + 0.2);
    if (y < 3) c = shade(SANDSTONE_COL[1], 1.02);           // smooth cap
    else if (y === 3 || y === 12) c = shade(SANDSTONE_COL[0], 0.86);
    else if (y > 12) c = shade(SANDSTONE_COL[0], 0.92 + rng() * 0.05);
    P.set(x, y, c);
  });
});
paintTile('sandstone_chiseled', (P, rng) => {
  P.fill((x, y) => {
    let c = shade(mix3(SANDSTONE_COL[0], SANDSTONE_COL[1], 0.5), 0.97 + rng() * 0.05);
    const frame = x === 1 || x === 14 || y === 1 || y === 14;
    const glyph = (x >= 5 && x <= 10 && (y === 4 || y === 11)) || ((x === 5 || x === 10) && y >= 4 && y <= 11)
      || (x >= 7 && x <= 8 && y >= 6 && y <= 9);
    if (frame || glyph) c = shade(SANDSTONE_COL[0], 0.72);
    P.set(x, y, c);
  });
});
// Spawner: a dark iron cage. Gaps between the bars are clear (alpha 0), like glass.
paintTile('spawner', (P, rng) => {
  P.fill((x, y) => {
    const bar = x % 5 === 0 || y % 5 === 0;
    if (!bar) { P.set(x, y, [0, 0, 0], 0); return; }
    const hi = (x % 5 === 0 && y % 5 === 0) ? 1.35 : 1;
    P.set(x, y, shade([44, 52, 66], hi * (0.9 + rng() * 0.2)));
  });
});
// Cobweb: 8 threads from the centre and 3 rings, pale gray on clear.
paintTile('cobweb', (P, rng) => {
  P.fill((x, y) => P.set(x, y, [0, 0, 0], 0));
  const web = [226, 228, 234];
  for (let a = 0; a < 8; a++) {
    const ang = a * Math.PI / 4 + 0.2;
    for (let r = 0; r < 9; r += 0.5) P.set(Math.round(7.5 + Math.cos(ang) * r), Math.round(7.5 + Math.sin(ang) * r), web);
  }
  for (const R of [2.5, 4.5, 6.5]) for (let t = 0; t < 64; t++) {
    const ang = t / 64 * Math.PI * 2;
    if (rng() < 0.85) P.set(Math.round(7.5 + Math.cos(ang) * R), Math.round(7.5 + Math.sin(ang) * R * 0.95), shade(web, 0.85));
  }
});
paintTile('gravel', (P, rng) => {
  const vor = tileVoronoi(rng, 14);
  const cols = []; for (let i = 0; i < 14; i++) cols.push(rng() < 0.3 ? [128, 110, 100] : gray(95 + rng() * 60));
  P.fill((x, y) => {
    const k = y * 16 + x;
    const c = vor.edge[k] < 0.8 ? gray(70) : shade(cols[vor.cell[k]], 0.9 + rng() * 0.2 + (-vor.rel[k * 2] - vor.rel[k * 2 + 1]) * 0.04);
    P.set(x, y, c);
  });
});
paintTile('water', (P, rng) => {
  const n = tileNoise(rng, 2);
  P.fill((x, y) => {
    const w = Math.sin((x + y * 0.5) * 0.8 + n[y * 16 + x] * 3) * 0.5 + 0.5;
    const c = mix3([38, 76, 190], [70, 116, 222], w * 0.7 + rng() * 0.2);
    P.set(x, y, c, 200);
  });
});
paintTile('log_side', (P, rng) => {
  const cols = []; for (let x = 0; x < 16; x++) cols.push(0.8 + rng() * 0.35);
  P.fill((x, y) => {
    let c = shade([104, 80, 48], cols[x] * (0.92 + rng() * 0.12));
    if ((x % 4 === 1 && rng() < 0.85) || rng() < 0.05) c = [74, 56, 32];
    P.set(x, y, c);
  });
});
paintTile('log_top', (P, rng) => {
  P.fill((x, y) => {
    const dx = x - 7.5, dy = y - 7.5, d = Math.max(Math.abs(dx), Math.abs(dy)) * 0.7 + Math.sqrt(dx * dx + dy * dy) * 0.3;
    let c;
    if (x === 0 || y === 0 || x === 15 || y === 15) c = [96, 74, 44];
    else c = (Math.floor(d + rng() * 0.4) % 2 === 0) ? [178, 142, 88] : [150, 116, 70];
    P.set(x, y, shade(c, 0.95 + rng() * 0.1));
  });
});
function paintPlanks(P, rng) {
  const offs = [3, 11, 6, 14];
  P.fill((x, y) => {
    const board = y >> 2, row = y & 3;
    let c = shade([164, 132, 80], 0.9 + rng() * 0.12 + (board % 2) * 0.04);
    if (rng() < 0.12) c = shade(c, 0.86);
    if (row === 3) c = [112, 88, 52];
    if (x === offs[board] && row !== 3) c = [120, 94, 56];
    P.set(x, y, c);
  });
}
paintTile('planks', paintPlanks);
paintTile('leaves', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    const k = y * 16 + x;
    if (rng() < 0.12) { P.set(x, y, [0, 0, 0], 0); return; }
    let v = 100 + n[k] * 90 + (rng() - 0.5) * 40;
    if (rng() < 0.12) v = 70;
    P.set(x, y, gray(v), TINT_ALPHA);
  });
});
// Colored leaves bake their color into the tile (alpha 255), so no biome tint applies.
// Pink and white add a few pale blossom or frost texels. `con` scales the texture contrast.
for (const [name, col, speck, con] of [
  ['leaves_red', [226, 64, 42], null, 1], ['leaves_orange', [238, 134, 36], null, 1], ['leaves_brown', [168, 104, 56], null, 1],
  ['leaves_pink', [250, 150, 196], [255, 222, 236], 0.8], ['leaves_white', [226, 234, 242], [255, 255, 255], 0.4],
  ['leaves_yellow', [242, 204, 48], null, 1],
]) {
  paintTile(name, (P, rng) => {
    P.copy('leaves');
    P.fill((x, y) => {
      const [g, , , a] = P.get(x, y);
      if (!a) return;
      const k = 1 - con + con * g / 150;
      P.set(x, y, speck && rng() < 0.14 ? speck : [Math.min(255, col[0] * k), Math.min(255, col[1] * k), Math.min(255, col[2] * k)]);
    });
  });
}
paintTile('snow', (P, rng) => {
  P.fill((x, y) => {
    let c = gray(238 + rng() * 14);
    if (rng() < 0.1) c = [220, 232, 245];
    P.set(x, y, c);
  });
});
paintTile('table_top', (P, rng) => {
  paintPlanks(P, rng);
  P.fill((x, y) => {
    if (x === 0 || y === 0 || x === 15 || y === 15) P.set(x, y, [88, 62, 36]);
    else if (x === 1 || y === 1 || x === 14 || y === 14) P.set(x, y, [124, 94, 56]);
    else if ((x === 5 || x === 10 || y === 5 || y === 10)) P.set(x, y, [96, 72, 42]);
  });
});
function paintTableSide(P, rng, variant) {
  paintPlanks(P, rng);
  P.fill((x, y) => {
    if (y < 3) P.set(x, y, shade([92, 66, 38], 0.9 + rng() * 0.2));
    if (x === 0 || x === 15) P.set(x, y, [84, 60, 34]);
  });
  if (variant === 0) {
    // hammer
    for (let y = 6; y < 14; y++) P.set(4, y, [96, 70, 40]);
    for (let x = 2; x < 7; x++) { P.set(x, 5, [120, 120, 120]); P.set(x, 6, [150, 150, 150]); }
    // saw
    for (let x = 8; x < 14; x++) { P.set(x, 7, [180, 180, 180]); P.set(x, 8, (x % 2) ? [140, 140, 140] : [90, 90, 90]); }
    P.set(8, 6, [96, 70, 40]); P.set(9, 6, [96, 70, 40]);
  } else {
    // pick + shears
    for (let i = 0; i < 7; i++) P.set(4 + i, 12 - i, [96, 70, 40]);
    for (let x = 6; x < 13; x++) P.set(x, 5 + Math.abs(x - 9) * 0.5 | 0, [150, 150, 150]);
    P.set(12, 10, [170, 170, 170]); P.set(13, 11, [170, 170, 170]); P.set(12, 12, [170, 170, 170]);
  }
}
paintTile('table_side', (P, rng) => paintTableSide(P, rng, 0));
paintTile('table_front', (P, rng) => paintTableSide(P, rng, 1));
paintTile('torch', (P, rng) => {
  P.fill((x, y) => P.set(x, y, [0, 0, 0], 0));
  for (let y = 8; y < 16; y++) { P.set(7, y, [118, 86, 50]); P.set(8, y, [86, 62, 34]); }
  P.set(7, 6, [255, 236, 130]); P.set(8, 6, [255, 200, 80]);
  P.set(7, 7, [255, 170, 40]); P.set(8, 7, [230, 120, 30]);
  P.set(7, 5, [255, 250, 200], 255); P.set(8, 5, [255, 224, 120], 255);
});
paintTile('ladder', (P, rng) => {   // two rails and four rungs on a clear tile
  P.fill((x, y) => P.set(x, y, [0, 0, 0], 0));
  const wood = (f) => shade([150, 112, 62], f * (0.9 + rng() * 0.15));
  for (let y = 0; y < 16; y++) { P.set(2, y, wood(1)); P.set(3, y, wood(0.78)); P.set(12, y, wood(1)); P.set(13, y, wood(0.78)); }
  for (const ry of [1, 5, 9, 13]) for (let x = 4; x < 12; x++) { P.set(x, ry, wood(1.08)); P.set(x, ry + 1, wood(0.72)); }
});
paintTile('bedrock', (P, rng) => {
  const n = tileNoise(rng, 1);
  P.fill((x, y) => {
    const v = n[y * 16 + x] + (rng() - 0.5) * 0.5;
    P.set(x, y, gray(v < 0.3 ? 42 : v < 0.55 ? 78 : v < 0.8 ? 112 : 150));
  });
});
paintTile('tall_grass', (P, rng) => {
  P.fill((x, y) => P.set(x, y, [0, 0, 0], 0));
  for (let b = 0; b < 9; b++) {
    let x = 1 + rng() * 14; const h = 5 + Math.floor(rng() * 10), lean = (rng() - 0.5) * 0.5;
    for (let i = 0; i < h; i++) { P.set(Math.round(x), 15 - i, gray(130 + rng() * 80 + i * 3), TINT_ALPHA); x += lean; }
  }
});
function paintFlower(P, rng, petal, center) {
  P.fill((x, y) => P.set(x, y, [0, 0, 0], 0));
  for (let y = 8; y < 16; y++) P.set(7 + (y > 12 ? 1 : 0), y, [44, 126, 34]);
  P.set(6, 11, [52, 140, 40]); P.set(5, 10, [52, 140, 40]); P.set(9, 13, [52, 140, 40]); P.set(10, 12, [52, 140, 40]);
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (Math.abs(dx) + Math.abs(dy) > 3) continue;
    P.set(7 + dx, 5 + dy, shade(petal, 0.8 + rng() * 0.3));
  }
  P.set(7, 5, center);
}
paintTile('rose', (P, rng) => paintFlower(P, rng, [206, 30, 32], [120, 10, 10]));
paintTile('dandelion', (P, rng) => paintFlower(P, rng, [250, 226, 40], [230, 170, 20]));
paintTile('cactus_side', (P, rng) => {
  P.fill((x, y) => {
    if (x === 0 || x === 15) { P.set(x, y, [0, 0, 0], 0); return; }
    let c = shade([20, 118, 34], 0.9 + rng() * 0.15);
    if (x === 3 || x === 8 || x === 12) c = [12, 88, 22];
    if ((x === 2 || x === 9 || x === 13) && (y % 4 === 1)) c = [220, 230, 170];
    P.set(x, y, c);
  });
});
paintTile('cactus_top', (P, rng) => {
  P.fill((x, y) => {
    const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
    let c = d > 7 ? null : d > 6 ? [16, 96, 28] : d > 3 ? [32, 140, 46] : [60, 160, 70];
    if (!c) { P.set(x, y, [0, 0, 0], 0); return; }
    P.set(x, y, shade(c, 0.9 + rng() * 0.15));
  });
});
paintTile('wool', (P, rng) => {
  P.fill((x, y) => {
    const v = 224 + rng() * 22 - (((x + y * 2) % 4 === 0) ? 14 : 0);
    P.set(x, y, gray(v));
  });
});
// ---- farming tiles: farmland (dry and wet), saplings per leaf color, and wheat stages
function paintFarmland(P, rng, wet) {
  P.copy('dirt');
  P.fill((x, y) => {
    const c = P.get(x, y), furrow = y % 4 === 0, ridge = y % 4 === 2;
    const f = (furrow ? 0.62 : ridge ? 1.08 : 0.9) * (wet ? 0.58 : 1);
    P.set(x, y, [c[0] * f, c[1] * f * (wet ? 0.95 : 1), c[2] * f * (wet ? 1.05 : 1)]);
  });
}
paintTile('farmland', (P, rng) => paintFarmland(P, rng, false));
paintTile('farmland_wet', (P, rng) => paintFarmland(P, rng, true));
// Sapling: a thin stem and 3 leaf tufts in the leaf color. The spruce sapling is a small cone.
const SAPLING_COL = [[64, 140, 38], [204, 58, 38], [230, 128, 34], [150, 96, 50], [244, 150, 192], [52, 104, 70], [236, 196, 46]];
for (let c = 0; c < 7; c++) {
  paintTile('sapling_' + c, (P, rng) => {
    const L = SAPLING_COL[c], stem = [96, 70, 40];
    for (let y = 8; y < 16; y++) P.set(7 + (y > 12 ? 1 : 0), y, stem);
    const leafAt = (x, y) => P.set(x, y, shade(L, 0.75 + rng() * 0.4));
    if (c === 5) {
      for (let y = 2; y < 13; y++) { const r = Math.floor((y - 1) / 2.4); for (let x = 7 - r; x <= 8 + r; x++) if (rng() < 0.9) leafAt(x, y); }
    } else {
      for (const [cx, cy, r] of [[7, 5, 3.2], [4, 9, 2.4], [11, 8, 2.6]]) {
        for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (Math.hypot(x - cx, y - cy) < r && rng() < 0.85) leafAt(x, y);
      }
      P.set(6, 11, stem); P.set(9, 10, stem);
    }
  });
}
// Wheat: stage 0 short sprouts, stage 3 tall golden stalks with ears.
for (let v = 0; v < 4; v++) {
  paintTile('wheat_' + v, (P, rng) => {
    const h = [4, 7, 11, 13][v], green = [70, 150, 40], gold = [214, 180, 70];
    const col = v === 3 ? gold : v === 2 ? mix3(green, gold, 0.35) : green;
    for (let b = 0; b < 6; b++) {
      const x = 1 + b * 2.6 + rng() * 1.2 | 0, bh = h - (rng() * 3 | 0);
      for (let i = 0; i < bh; i++) P.set(x, 15 - i, shade(col, 0.8 + rng() * 0.3));
      if (v >= 2) for (let i = bh - 4; i < bh; i++) { P.set(x - 1, 15 - i, shade(v === 3 ? [236, 200, 90] : col, 0.9 + rng() * 0.2)); P.set(x + 1, 15 - i, shade(v === 3 ? [180, 140, 50] : col, 0.8 + rng() * 0.2)); }
    }
  });
}
// Rails: wooden ties under 2 steel rails on a transparent tile. The straight rail runs along
// the tile y axis. The curve joins the x = 16 edge and the y = 16 edge around the corner (16, 16).
const RAIL_TIE = [112, 80, 48], RAIL_HI = [200, 206, 214], RAIL_LO = [110, 116, 126];
paintTile('rail', (P, rng) => {
  for (const y0 of [1, 5, 9, 13]) for (let y = y0; y < y0 + 2; y++) for (let x = 1; x < 15; x++) P.set(x, y, shade(RAIL_TIE, 0.8 + rng() * 0.3));
  for (let y = 0; y < 16; y++) for (const x of [2, 12]) { P.set(x, y, RAIL_HI); P.set(x + 1, y, RAIL_LO); }
});
paintTile('rail_curve', (P, rng) => {
  P.fill((x, y) => {
    const dx = 15.5 - x, dy = 15.5 - y, d = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) * Math.PI / 8;
      if (d > 1.5 && d < 15.5 && Math.abs(d * Math.sin(a - t)) < 1) P.set(x, y, shade(RAIL_TIE, 0.8 + rng() * 0.3));
    }
    for (const r of [3.5, 13.5]) if (Math.abs(d - r) < 1) P.set(x, y, d > r ? RAIL_HI : RAIL_LO);
  });
});
// crack stages 0..9: one random crack pattern revealed step by step
{
  const rng = mulberry32(99173);
  const order = new Float32Array(256).fill(99);
  let step = 0;
  for (let arm = 0; arm < 7; arm++) {
    let x = 7.5, y = 7.5, a = rng() * Math.PI * 2;
    for (let i = 0; i < 12; i++) {
      a += (rng() - 0.5) * 1.1; x += Math.cos(a); y += Math.sin(a);
      if (x < 0 || y < 0 || x >= 16 || y >= 16) break;
      const k = (y | 0) * 16 + (x | 0);
      order[k] = Math.min(order[k], i + arm * 0.35 + rng());
      step++;
    }
  }
  for (let s = 0; s < 10; s++) {
    paintTile('crack_' + s, (P) => {
      const lim = 1.2 + s * 1.35;
      P.fill((x, y) => { const o = order[y * 16 + x]; P.set(x, y, [0, 0, 0], o <= lim ? 200 : 0); });
    });
  }
}

const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
atlasTexture.magFilter = THREE.NearestFilter;
atlasTexture.minFilter = THREE.NearestFilter;
atlasTexture.generateMipmaps = false;
atlasTexture.flipY = false;
atlasTexture.colorSpace = THREE.NoColorSpace;

// Tile index for each block face: faceTiles[id*6 + face], face order +X,-X,+Y,-Y,+Z,-Z.
// A facing block (furnace, chest) puts its front on one face; the table shows it on +Z and -Z.
const FACE_TILE = new Int16Array(256 * 6).fill(-1);
for (const def of BLOCKS) {
  if (!def || !def.tex) continue;
  const t = def.tex;
  const side = TILE[t.side], front = t.front ? TILE[t.front] : side;
  const tiles = [side, side, TILE[t.top], TILE[t.bottom], front, front];
  if (def.facing >= 0) { tiles[4] = tiles[5] = side; tiles[DIR_FACE[def.facing]] = front; }
  FACE_TILE.set(tiles, def.id * 6);
}

/* ---- UI icons ------------------------------------------------------------------ */
// Resolve the tint for icons (plains grass / forest foliage).
function tintedPixels(name, forBlock) {
  const src = TILE_PIX[name], out = new Uint8ClampedArray(src);
  const tint = IS_LEAF[forBlock] ? BIOME_FOLIAGE[BIOME.FOREST] : BIOME_GRASS[BIOME.PLAINS];
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === TINT_ALPHA) {
      out[i] = out[i] * tint[0] / 255; out[i + 1] = out[i + 1] * tint[1] / 255; out[i + 2] = out[i + 2] * tint[2] / 255; out[i + 3] = 255;
    }
  }
  return out;
}
function pixCanvas(data) {
  const c = document.createElement('canvas'); c.width = c.height = 16;
  c.getContext('2d').putImageData(new ImageData(data, 16, 16), 0, 0);
  return c;
}
// Isometric cube icon. Returns a 64x64 canvas.
function cubeIcon(id) {
  const t = BLOCKS[id].tex;
  const top = pixCanvas(tintedPixels(t.top, id)), left = pixCanvas(tintedPixels(t.front || t.side, id)), right = pixCanvas(tintedPixels(t.side, id));
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  // draw each face on its own layer so source-atop only darkens that face
  const layer = (img, m, dark) => {
    const l = document.createElement('canvas'); l.width = l.height = 64;
    const lg = l.getContext('2d'); lg.imageSmoothingEnabled = false;
    lg.setTransform(...m); lg.drawImage(img, 0, 0);
    if (dark) { lg.globalCompositeOperation = 'source-atop'; lg.setTransform(1, 0, 0, 1, 0, 0); lg.fillStyle = `rgba(0,0,0,${dark})`; lg.fillRect(0, 0, 64, 64); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(l, 0, 0);
  };
  layer(left, [26 / 16, 13 / 16, 0, 30 / 16, 6, 17], 0.22);
  layer(right, [26 / 16, -13 / 16, 0, 30 / 16, 32, 30], 0.42);
  layer(top, [26 / 16, 13 / 16, -26 / 16, 13 / 16, 32, 4], 0);
  return c;
}
// Isometric stair icon: the slab, then the step at the back (-X), drawn back to front. Each face
// clips the side tile to its outline. Iso point: (32 + 1.625 (X - Z), 4 + 0.8125 (X + Z) + 1.875 (16 - Y)).
function stairIcon(id) {
  const tile = pixCanvas(tintedPixels(BLOCKS[id].tex.side, id));
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const P = (X, Y, Z) => [32 + 1.625 * (X - Z), 4 + 0.8125 * (X + Z) + 1.875 * (16 - Y)];
  const face = (pts, m, dark) => {
    g.save(); g.beginPath();
    pts.forEach(([X, Y, Z], i) => { const [sx, sy] = P(X, Y, Z); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.closePath(); g.clip();
    g.setTransform(...m); g.drawImage(tile, 0, 0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (dark) { g.fillStyle = `rgba(0,0,0,${dark})`; g.fill(); }
    g.restore();
  };
  for (const [x0, y0, x1, y1] of [[0, 0, 16, 8], [0, 8, 8, 16]]) {
    // +Y face (u = X, v = Z), +Z face (u = X, v = 16 - Y), +X face (u = 16 - Z, v = 16 - Y)
    face([[x0, y1, 0], [x1, y1, 0], [x1, y1, 16], [x0, y1, 16]], [1.625, 0.8125, -1.625, 0.8125, 32, 4 + 1.875 * (16 - y1)], 0);
    face([[x0, y0, 16], [x1, y0, 16], [x1, y1, 16], [x0, y1, 16]], [1.625, 0.8125, 0, 1.875, 6, 17], 0.22);
    face([[x1, y0, 16], [x1, y0, 0], [x1, y1, 0], [x1, y1, 16]], [1.625, -0.8125, 0, 1.875, 6 + 1.625 * x1, 17 + 0.8125 * x1], 0.42);
  }
  return c;
}
function flatIcon(data) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(pixCanvas(data), 0, 0, 64, 64);
  return c;
}

// ---- item pixel art (16x16), built from simple shape rules ---------------------------
const ITEM_PIX = {};   // item id -> Uint8ClampedArray 16x16 RGBA (used by icons and 3D extrusion)
function pixArt(fn) {
  const d = new Uint8ClampedArray(1024);
  const set = (x, y, c, a = 255) => { if (x < 0 || y < 0 || x > 15 || y > 15) return; const i = (y * 16 + x) * 4; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = a; };
  fn(set);
  // dark outline around opaque pixels (Minecraft item style)
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (d[(y * 16 + x) * 4 + 3]) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < 16 && ny < 16 && d[(ny * 16 + nx) * 4 + 3]) near = true;
    }
    if (near) { const i = (y * 16 + x) * 4; out[i] = 24; out[i + 1] = 20; out[i + 2] = 18; out[i + 3] = 255; }
  }
  return out;
}
const MAT_COL = {
  wood: [[104, 78, 40], [150, 116, 66], [192, 156, 96]],
  stone: [[84, 84, 84], [126, 126, 126], [170, 170, 170]],
  iron: [[150, 150, 150], [212, 212, 212], [255, 255, 255]],
  copper: [[140, 70, 40], [200, 112, 66], [240, 168, 116]],
  steel: [[92, 100, 114], [160, 170, 184], [222, 230, 240]],
  gold: [[176, 124, 16], [240, 200, 48], [255, 246, 150]],
  ruby: [[118, 8, 28], [204, 30, 60], [255, 116, 140]],
  diamond: [[28, 126, 126], [78, 216, 206], [196, 255, 250]],
  leather: [[96, 50, 28], [150, 80, 44], [176, 104, 60]],
};
const HANDLE = [[78, 56, 28], [120, 88, 46], [150, 114, 64]];
function drawHandle(set, from, to) {
  // handle along x+y=15 from along=from..to  (along = x - y)
  for (let x = 0; x < 16; x++) { const y = 15 - x, a = x - y; if (a >= from && a <= to) set(x, y, HANDLE[(x % 3 === 0) ? 2 : 1]); }
  for (let x = 0; x < 16; x++) { const y = 16 - x, a = x - y; if (a >= from + 1 && a <= to + 1) set(x, y, HANDLE[0]); }
}
function toolPix(type, mat) {
  const C = MAT_COL[mat];
  return pixArt((set) => {
    if (type === 'pickaxe') {
      drawHandle(set, -13, 1);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const d = Math.hypot(x + 0.5 - 3, y + 0.5 - 12.5);
        if (d >= 9.7 && d <= 11.6 && x >= 3 && y <= 12) set(x, y, d > 10.9 ? C[0] : (x + y < 14 ? C[2] : C[1]));
      }
    } else if (type === 'sword') {
      for (let x = 4; x < 15; x++) { const y = 15 - x; set(x, y - 1, C[2]); set(x, y, C[1]); set(x + 1, y, C[0]); }
      set(14, 0, C[2]);
      for (let i = -2; i <= 2; i++) set(4 + i, 11 + i, [70, 50, 30]);   // guard
      set(3, 11, [70, 50, 30]); set(5, 12, [70, 50, 30]);
      set(1, 14, HANDLE[1]); set(2, 13, HANDLE[2]); set(3, 12, HANDLE[1]); set(0, 15, HANDLE[0]);
    } else if (type === 'axe') {
      drawHandle(set, -13, 3);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const a = x - y, p = x + y;
        if (a >= -1 && a <= 7 && p >= 8 && p <= 14) {
          const edge = p <= 9 || a <= 0;
          set(x, y, edge ? C[2] : (p >= 13 ? C[0] : C[1]));
        }
      }
    } else if (type === 'hoe') {
      drawHandle(set, -13, 5);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const a = x - y, p = x + y;   // blade: a short bar across the handle top, bent down on one side
        if (a >= 3 && a <= 9 && p >= 14 && p <= 16) set(x, y, p === 14 ? C[2] : C[1]);
        if (a >= 0 && a <= 3 && p >= 11 && p <= 14 && a + (p - 11) <= 4) set(x, y, C[0]);
      }
    } else if (type === 'shovel') {
      drawHandle(set, -13, 2);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const a = x - y, p = x + y;
        const da = (a - 7.5) / 4.2, dp = (p - 15) / 2.9;
        if (da * da + dp * dp <= 1) set(x, y, da > 0.4 ? C[2] : dp < 0 ? C[1] : C[0]);
      }
    }
  });
}
function blobPix(cols, cx, cy, rx, ry, extra) {
  return pixArt((set) => {
    const rng = mulberry32(cx * 131 + cy * 7 + rx * 3 + cols[0][0]);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, d = dx * dx + dy * dy + (rng() - 0.5) * 0.25;
      if (d <= 1) set(x, y, d > 0.7 ? cols[0] : (dx + dy < -0.4 ? cols[2] : cols[1]));
    }
    if (extra) extra(set, rng);
  });
}
ITEM_PIX[I.STICK] = pixArt((set) => { for (let x = 3; x <= 12; x++) { set(x, 15 - x, HANDLE[x % 3 === 0 ? 2 : 1]); set(x + 1, 15 - x, HANDLE[0]); } });
ITEM_PIX[I.COAL] = blobPix([[18, 18, 18], [40, 40, 44], [80, 80, 90]], 8, 8.5, 5.2, 4.6);
const ingotPix = (C) => pixArt((set) => {
  for (let y = 5; y <= 11; y++) for (let x = 2; x <= 13; x++) {
    const inset = (11 - y) * 0.4; if (x < 2 + inset || x > 13 - inset) continue;
    set(x, y, y === 5 ? C[2] : y >= 10 ? C[0] : C[1]);
  }
});
const gemPix = (C) => pixArt((set) => {
  for (let y = 2; y <= 13; y++) for (let x = 2; x <= 13; x++) {
    const d = Math.abs(x - 7.5) + Math.abs(y - (y < 6 ? 5.5 : 5.5)) * (y < 6 ? 2.2 : 0.75);
    if (y < 3 || d > 6.2) continue;
    set(x, y, y < 6 ? (x < 8 ? C[2] : C[1]) : (x + y < 17 ? C[1] : C[0]));
  }
  set(5, 4, [255, 255, 255]);
});
ITEM_PIX[I.STEEL] = ingotPix(MAT_COL.steel);
ITEM_PIX[I.COPPER] = ingotPix(MAT_COL.copper);
ITEM_PIX[I.GOLD] = ingotPix(MAT_COL.gold);
ITEM_PIX[I.RAW_IRON] = blobPix([[150, 110, 84], [200, 160, 128], [232, 200, 170]], 8, 8.5, 5, 4.4, (set, r) => { for (let i = 0; i < 5; i++) set(5 + (r() * 6 | 0), 6 + (r() * 5 | 0), [124, 90, 70]); });
ITEM_PIX[I.RAW_COPPER] = blobPix([[130, 64, 36], [196, 110, 64], [236, 160, 110]], 8, 8.5, 5, 4.4, (set, r) => { for (let i = 0; i < 5; i++) set(5 + (r() * 6 | 0), 6 + (r() * 5 | 0), [90, 170, 140]); });
ITEM_PIX[I.RAW_GOLD] = blobPix([[170, 120, 20], [232, 190, 48], [255, 240, 140]], 8, 8.5, 5, 4.4, (set, r) => { for (let i = 0; i < 5; i++) set(5 + (r() * 6 | 0), 6 + (r() * 5 | 0), [150, 100, 20]); });
ITEM_PIX[I.RUBY] = gemPix(MAT_COL.ruby);
ITEM_PIX[I.DIAMOND] = gemPix(MAT_COL.diamond);
ITEM_PIX[I.DOOR] = pixArt((set) => {
  const bot = TILE_PIX.door_bottom, top = TILE_PIX.door_top;
  for (let y = 0; y < 16; y++) for (let x = 4; x < 12; x++) {
    const src = y < 8 ? top : bot, sy = (y % 8) * 2, sx = (x - 4) * 2, i = (sy * 16 + sx) * 4;
    if (src[i + 3]) set(x, y, [src[i], src[i + 1], src[i + 2]]);
  }
});
ITEM_PIX[I.BEEF] = blobPix([[120, 20, 20], [196, 44, 40], [230, 90, 80]], 8, 8, 6, 4.5, (set, r) => { for (let i = 0; i < 6; i++) set(5 + (r() * 7 | 0), 6 + (r() * 4 | 0), [240, 220, 210]); });
ITEM_PIX[I.PORK] = blobPix([[190, 90, 96], [240, 150, 150], [255, 196, 190]], 8, 8, 6, 4.3, (set) => { for (let x = 4; x < 12; x++) set(x, 5, [255, 240, 235]); });
ITEM_PIX[I.MUTTON] = blobPix([[110, 22, 26], [170, 40, 44], [214, 90, 90]], 8, 8.5, 5.5, 5, (set) => { set(12, 4, [240, 240, 230]); set(13, 3, [240, 240, 230]); });
ITEM_PIX[I.CHICKEN] = blobPix([[190, 140, 120], [236, 190, 170], [255, 220, 205]], 7, 9, 5, 4.5, (set) => { set(11, 5, [245, 240, 230]); set(12, 4, [245, 240, 230]); set(13, 3, [255, 255, 250]); set(13, 4, [255, 255, 250]); });
ITEM_PIX[I.FLESH] = blobPix([[80, 70, 30], [130, 100, 50], [150, 130, 70]], 8, 8, 6, 4.8, (set, r) => { for (let i = 0; i < 7; i++) set(4 + (r() * 8 | 0), 5 + (r() * 6 | 0), [90, 120, 60]); });
ITEM_PIX[I.LEATHER] = blobPix([[96, 50, 28], [150, 80, 44], [176, 104, 60]], 8, 8, 6.2, 6.2);
ITEM_PIX[I.GUNPOWDER] = pixArt((set) => {
  const r = mulberry32(55);
  for (let i = 0; i < 60; i++) { const x = 3 + (r() * 10 | 0), y = 6 + (r() * 8 | 0); if (Math.abs(x - 8) < (y - 4)) set(x, y, gray(60 + r() * 70)); }
});
ITEM_PIX[I.FEATHER] = pixArt((set) => {
  for (let x = 2; x <= 13; x++) { const y = 15 - x; set(x, y, [200, 200, 200]); if (x > 4) { set(x - 1, y - 1, [250, 250, 250]); set(x + 1, y + 1, [230, 230, 230]); } if (x > 6 && x < 12) { set(x - 2, y - 1, [240, 240, 240]); set(x + 1, y + 2, [220, 220, 220]); } }
});
// ---- farming items
const bucketPix = (fill) => pixArt((set) => {
  const S = MAT_COL.steel;
  for (let y = 5; y <= 14; y++) {
    const inset = Math.floor((y - 5) / 3), x0 = 3 + inset, x1 = 12 - inset;
    for (let x = x0; x <= x1; x++) set(x, y, x === x0 ? S[2] : x === x1 ? S[0] : S[1]);
  }
  for (let x = 3; x <= 12; x++) set(x, 5, fill ? fill[x % 3 === 0 ? 1 : 0] : [54, 58, 66]);
  if (fill) for (let x = 4; x <= 11; x++) set(x, 6, fill[1]);
  for (let x = 4; x <= 11; x++) set(x, 2, S[0]);   // handle
  set(3, 3, S[0]); set(3, 4, S[0]); set(12, 3, S[0]); set(12, 4, S[0]);
});
ITEM_PIX[I.BUCKET] = bucketPix(null);
ITEM_PIX[I.WATER_BUCKET] = bucketPix([[40, 90, 220], [90, 150, 255]]);
ITEM_PIX[I.LAVA_BUCKET] = bucketPix([[230, 90, 10], [255, 190, 40]]);
ITEM_PIX[I.SEEDS] = pixArt((set) => {
  for (const [x, y] of [[4, 6], [8, 4], [11, 7], [6, 10], [10, 11], [3, 12], [7, 13], [12, 13]]) {
    set(x, y, [120, 170, 60]); set(x + 1, y, [80, 130, 40]); set(x, y + 1, [60, 100, 30]);
  }
});
ITEM_PIX[I.WHEAT] = pixArt((set) => {
  for (let i = 0; i < 4; i++) for (let k = 0; k < 11; k++) {
    const x = 3 + i * 2 + Math.round(k * (1.5 - i) * 0.12), y = 14 - k;
    set(x, y, k > 6 ? [236, 200, 90] : [196, 160, 60]);
    if (k > 6) set(x + 1, y, [170, 130, 40]);
  }
  for (let x = 4; x <= 10; x++) set(x, 9, [120, 80, 30]);
});
ITEM_PIX[I.BREAD] = blobPix([[120, 70, 24], [184, 120, 50], [222, 170, 90]], 8, 9, 6.5, 3.8, (set) => { for (const x of [5, 8, 11]) set(x, 7, [236, 196, 120]); });
const applePix = (C) => blobPix(C, 8, 9.5, 5.2, 5, (set) => {
  set(8, 3, [90, 60, 30]); set(8, 4, [90, 60, 30]); set(9, 3, [60, 150, 40]); set(10, 2, [60, 150, 40]); set(10, 3, [80, 180, 50]);
  set(6, 7, [255, 255, 255]);
});
ITEM_PIX[I.APPLE] = applePix([[130, 10, 20], [210, 30, 40], [250, 100, 100]]);
ITEM_PIX[I.GOLDEN_APPLE] = applePix(MAT_COL.gold);
ITEM_PIX[I.BONE] = pixArt((set) => {
  for (let x = 4; x <= 11; x++) { set(x, 15 - x, [236, 232, 214]); set(x + 1, 15 - x, [200, 196, 176]); }
  for (const [x, y] of [[2, 12], [3, 13], [2, 11], [4, 13], [12, 2], [13, 3], [11, 2], [13, 4]]) set(x, y, [246, 244, 230]);
});
ITEM_PIX[I.BONE_MEAL] = pixArt((set) => {
  const r = mulberry32(71);
  for (let i = 0; i < 70; i++) { const x = 3 + (r() * 10 | 0), y = 6 + (r() * 8 | 0); if (Math.abs(x - 8) < (y - 4)) set(x, y, gray(200 + r() * 55)); }
});
for (const type of Object.keys(TOOL_KINDS)) for (let tier = 1; tier < TIERS.length; tier++) ITEM_PIX[toolId(type, tier)] = toolPix(type, TIERS[tier].mat);
// ---- combat items (Batch 14)
// Armor icons: one 16x16 mask per piece. The top and left edges are lit, the bottom and right edges are dark.
const ARMOR_MASKS = [
  ['', '', '', '    XXXXXXXX', '   XXXXXXXXXX', '  XXXXXXXXXXXX', '  XXXXXXXXXXXX', '  XXX      XXX', '  XXX      XXX', '  XX        XX'],
  ['', '', '  XXXX    XXXX', ' XXXXXX  XXXXXX', ' XXXXXXXXXXXXXX', ' XXXXXXXXXXXXXX', ' XX XXXXXXXX XX', '    XXXXXXXX', '    XXXXXXXX',
    '    XXXXXXXX', '    XXXXXXXX', '    XXXXXXXX', '    XXXXXXXX'],
  ['', '', '   XXXXXXXXXX', '   XXXXXXXXXX', '   XXXXXXXXXX', '   XXXX  XXXX', '   XXXX  XXXX', '   XXXX  XXXX', '   XXX    XXX',
    '   XXX    XXX', '   XXX    XXX', '   XXX    XXX', '   XXX    XXX'],
  ['', '', '', '', '', '', '', '  XXX    XXX', '  XXX    XXX', '  XXX    XXX', '  XXXX   XXXX', ' XXXXX  XXXXX', ' XXXXX  XXXXX']];
function armorPix(piece, C) {
  const m = ARMOR_MASKS[piece], on = (x, y) => (m[y] || '')[x] === 'X';
  return pixArt((set) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      if (!on(x, y)) continue;
      set(x, y, !on(x + 1, y) || !on(x, y + 1) ? C[0] : !on(x - 1, y) || !on(x, y - 1) ? C[2] : C[1]);
    }
  });
}
ARMOR_TIERS.forEach((t, tier) => ARMOR_PIECES.forEach((p, piece) => { ITEM_PIX[armorId(tier, piece)] = armorPix(piece, MAT_COL[t.mat]); }));
ITEM_PIX[I.FLINT] = blobPix([[26, 26, 30], [58, 58, 66], [120, 120, 132]], 8, 8.5, 4.4, 5.6);
ITEM_PIX[I.STRING] = pixArt((set) => {
  for (let x = 2; x <= 13; x++) { const y = Math.round(8 + 3 * Math.sin(x * 0.9)); set(x, y, [236, 236, 236]); set(x, y + 1, [180, 180, 186]); }
});
ITEM_PIX[I.ARROW] = pixArt((set) => {
  for (let x = 3; x <= 11; x++) set(x, 15 - x, HANDLE[x % 2 ? 2 : 1]);
  for (const [x, y, c] of [[12, 3, 1], [13, 2, 2], [11, 2, 1], [12, 2, 2], [13, 3, 1], [14, 1, 2], [13, 1, 0], [14, 2, 0]]) set(x, y, MAT_COL.stone[c]);
  for (const [x, y] of [[2, 13], [3, 14], [1, 13], [2, 14], [1, 12], [3, 15], [2, 12], [4, 14]]) set(x, y, [236, 236, 236]);
});
ITEM_PIX[I.BOW] = pixArt((set) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x + 0.5 - 13.5, y + 0.5 - 2.5);
    if (d >= 9.8 && d <= 11.4 && x <= 13 && y >= 2) set(x, y, d > 10.7 ? HANDLE[0] : (x + y) % 5 === 0 ? HANDLE[2] : HANDLE[1]);
  }
  for (let i = 3; i <= 12; i++) set(i, i, [222, 222, 222]);
});
ITEM_PIX[I.MAGMA_CORE] = blobPix([[110, 24, 8], [214, 84, 18], [255, 196, 70]], 8, 8, 5.2, 5.2, (set, r) => {
  for (let i = 0; i < 6; i++) set(5 + (r() * 6 | 0), 5 + (r() * 6 | 0), [60, 16, 8]);
  set(7, 7, [255, 240, 170]); set(8, 7, [255, 240, 170]);
});
// Travel icons (Batch 16): a boat and a minecart from the side, a compass from above.
ITEM_PIX[I.BOAT] = pixArt((set) => {
  for (let x = 0; x < 16; x++) set(x, 6, [196, 150, 92]);
  for (let y = 7; y < 12; y++) for (let x = y - 6; x <= 21 - y; x++) set(x, y, (y & 1) ? [150, 108, 62] : [128, 90, 52]);
  for (const x of [5, 10]) set(x, 7, [96, 66, 38]);
});
ITEM_PIX[I.MINECART] = pixArt((set) => {
  for (let x = 1; x < 15; x++) set(x, 4, [214, 220, 228]);
  for (let y = 5; y < 11; y++) for (let x = 2; x < 14; x++) set(x, y, y === 5 ? [120, 126, 136] : [164, 170, 180]);
  for (const x of [3, 12]) for (const y of [7, 9]) set(x, y, [96, 100, 110]);
  for (const cx of [4, 11]) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) set(cx + dx, 11 + dy, [44, 44, 50]);
});
ITEM_PIX[I.COMPASS] = pixArt((set) => {
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const d = Math.hypot(x - 7.5, y - 7.5);
    if (d < 5.2) set(x, y, [232, 226, 206]); else if (d < 7) set(x, y, d < 6.1 ? [176, 182, 192] : [120, 126, 136]);
  }
  for (let y = 3; y < 8; y++) { set(7, y, [214, 40, 40]); set(8, y, [170, 24, 24]); }
  for (let y = 8; y < 13; y++) { set(7, y, [120, 120, 128]); set(8, y, [84, 84, 92]); }
});
ITEM_PIX[B.RAIL] = tintedPixels('rail', B.RAIL);
ITEM_PIX[B.LADDER] = tintedPixels('ladder', B.LADDER);
for (let c = 0; c < 7; c++) ITEM_PIX[B.SAPLING + c] = tintedPixels(BLOCKS[B.SAPLING + c].tex.side, B.SAPLING + c);
for (const id of [B.TORCH, B.TALL_GRASS, B.ROSE, B.DANDELION]) ITEM_PIX[id] = tintedPixels(BLOCKS[id].tex.side, id);
// Crystal cluster icon: a tall centre crystal and two leaning side crystals. Each crystal has a lit left facet.
ITEM_PIX[B.CRYSTAL] = pixArt((set) => {
  const C = [[22, 104, 112], [58, 198, 192], [206, 255, 248]];
  for (const [bx, w, h, lean] of [[3, 3, 7, -3], [10, 3, 8, 3], [6, 4, 13, 0]]) {
    for (let r = 0; r < h; r++) {
      const y = 14 - r, x0 = bx + Math.round(lean * r / h), taper = r >= h - 2 ? h - 1 - r : 9;
      const a = x0 + Math.max(0, Math.floor((w - 1) / 2) - taper), b = x0 + w - 1 - Math.max(0, Math.ceil((w - 1) / 2) - taper);
      for (let x = a; x <= b; x++) set(x, y, x === a ? C[2] : x === b ? C[0] : C[1]);
    }
  }
});

const ICON_URL = {};    // item id -> data URL for DOM icons
for (const it of ITEMS) {
  if (!it) continue;
  const def = BLOCKS[it.id];
  const cv = ITEM_PIX[it.id] ? flatIcon(ITEM_PIX[it.id]) : IS_STAIR[it.id] ? stairIcon(it.id) : (def && def.tex ? cubeIcon(it.id) : null);
  if (cv) ICON_URL[it.id] = cv.toDataURL();
}

// Hearts: 9x9 pixel art -> full / half / empty
const HEART_URL = {};
{
  const mask = ['.XX...XX.', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '..XXXXX..', '...XXX...', '....X....'];
  for (const kind of ['full', 'half', 'empty']) {
    const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d');
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      if (mask[y][x] !== 'X') continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (mask[y + dy] || '')[x + dx] !== 'X');
      let col;
      if (edge) col = '#000';
      else if (kind === 'empty' || (kind === 'half' && x > 4)) col = '#3a1010';
      else col = (y <= 2 && x % 4 === 1) ? '#ffb0b0' : '#e0141a';
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    HEART_URL[kind] = c.toDataURL();
  }
}

// Armor bar icons: a 9x9 chestplate -> full / half / empty
const ARMOR_URL = {};
{
  const mask = ['XXX...XXX', 'XXXX.XXXX', 'XXXXXXXXX', 'XXXXXXXXX', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.', '.XXXXXXX.'];
  for (const kind of ['full', 'half', 'empty']) {
    const c = document.createElement('canvas'); c.width = c.height = 9; const g = c.getContext('2d');
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      if (mask[y][x] !== 'X') continue;
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => (mask[y + dy] || '')[x + dx] !== 'X');
      let col;
      if (edge) col = '#000';
      else if (kind === 'empty' || (kind === 'half' && x > 4)) col = '#34343a';
      else col = (y <= 3 && x < 4) ? '#ffffff' : '#c4c8d4';
      g.fillStyle = col; g.fillRect(x, y, 1, 1);
    }
    ARMOR_URL[kind] = c.toDataURL();
  }
}

// Small solid-colour noise textures for mob parts.
function mobTexture(base, variance, painter, w = 16, h = 16) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); const img = g.createImageData(w, h); const d = img.data;
  const rng = mulberry32(base[0] * 65536 + base[1] * 256 + base[2] + w);
  for (let i = 0; i < w * h; i++) {
    const f = 1 + (rng() - 0.5) * variance;
    d[i * 4] = base[0] * f; d[i * 4 + 1] = base[1] * f; d[i * 4 + 2] = base[2] * f; d[i * 4 + 3] = 255;
  }
  const set = (x, y, col) => { if (x < 0 || y < 0 || x >= w || y >= h) return; const i = (y * w + x) * 4; d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; };
  if (painter) painter(set, rng, w, h);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.NoColorSpace;
  return t;
}

export {
  actx, ARMOR_URL, ATLAS_SIZE, atlasTexture, FACE_TILE, HANDLE, HEART_URL, ICON_URL, ITEM_PIX, MAT_COL,
  mobTexture, TILE, tileCount, tintedPixels,
};
