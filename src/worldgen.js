/* =====================================================================================
 * === 4. NOISE FUNCTIONS  and  === 5. WORLD GENERATION
 * -------------------------------------------------------------------------------------
 * WorldGenModule is self-contained: it references nothing outside its own body.
 * The game serializes it with Function.prototype.toString() into Blob Web Workers, and
 * also instantiates it on the main thread (spawn search, biome/height queries, fallback).
 * generateChunk(cx, cz, realm) is a pure function of (SEED, cx, cz, realm). realm is 'overworld' (the
 * default), 'ember', or 'crystal'. emberChunk builds the Ember Realm cave world (SPEC_realms Phase 2).
 * The crystal generator is a flat stub until Phase 5. stampFortresses adds the Ember Fortresses (Phase 4).
 * Dungeons have 2..4 rooms at different levels, joined by stairs or ladder shafts (stampDungeon).
 * ===================================================================================== */
function WorldGenModule(SEED, K) {
  const { CS, H, SEA, B, BIOME } = K;
  const SNOW_LINE = SEA + 30;

  // ---------------------------------------------------------------- 4. noise
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash3(a, b, c) {
    let h = Math.imul(a ^ 0x27d4eb2d, 0x85ebca6b) ^ Math.imul(b + 0x165667b1, 0xc2b2ae35) ^ Math.imul(c + 0x61c88647, 0x27d4eb2f);
    h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
    return h | 0;
  }
  const hashF = (a, b, c) => (hash3(a, b, c) >>> 0) / 4294967296;
  const GRAD3 = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1]);
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6, F3 = 1 / 3, G3 = 1 / 6;
  // Stefan Gustavson's simplex noise with a seeded permutation table.
  function Simplex(seed) {
    const rnd = mulberry32(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
    const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
    for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
    function n2(xin, yin) {
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s), j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const x0 = xin - (i - t), y0 = yin - (j - t);
      const i1 = x0 > y0 ? 1 : 0, j1 = 1 - i1;
      const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
      const ii = i & 255, jj = j & 255;
      let n = 0, tt, g;
      tt = 0.5 - x0 * x0 - y0 * y0;
      if (tt > 0) { g = pm12[ii + perm[jj]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x0 + GRAD3[g + 1] * y0); }
      tt = 0.5 - x1 * x1 - y1 * y1;
      if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x1 + GRAD3[g + 1] * y1); }
      tt = 0.5 - x2 * x2 - y2 * y2;
      if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x2 + GRAD3[g + 1] * y2); }
      return 70 * n;
    }
    function n3(xin, yin, zin) {
      const s = (xin + yin + zin) * F3;
      const i = Math.floor(xin + s), j = Math.floor(yin + s), k = Math.floor(zin + s);
      const t = (i + j + k) * G3;
      const x0 = xin - (i - t), y0 = yin - (j - t), z0 = zin - (k - t);
      let i1, j1, k1, i2, j2, k2;
      if (x0 >= y0) {
        if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
        else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
        else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
      } else {
        if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
        else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
        else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      }
      const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
      const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
      const x3 = x0 - 1 + 3 * G3, y3 = y0 - 1 + 3 * G3, z3 = z0 - 1 + 3 * G3;
      const ii = i & 255, jj = j & 255, kk = k & 255;
      let n = 0, tt, g;
      tt = 0.6 - x0 * x0 - y0 * y0 - z0 * z0;
      if (tt > 0) { g = pm12[ii + perm[jj + perm[kk]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x0 + GRAD3[g + 1] * y0 + GRAD3[g + 2] * z0); }
      tt = 0.6 - x1 * x1 - y1 * y1 - z1 * z1;
      if (tt > 0) { g = pm12[ii + i1 + perm[jj + j1 + perm[kk + k1]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x1 + GRAD3[g + 1] * y1 + GRAD3[g + 2] * z1); }
      tt = 0.6 - x2 * x2 - y2 * y2 - z2 * z2;
      if (tt > 0) { g = pm12[ii + i2 + perm[jj + j2 + perm[kk + k2]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x2 + GRAD3[g + 1] * y2 + GRAD3[g + 2] * z2); }
      tt = 0.6 - x3 * x3 - y3 * y3 - z3 * z3;
      if (tt > 0) { g = pm12[ii + 1 + perm[jj + 1 + perm[kk + 1]]] * 3; tt *= tt; n += tt * tt * (GRAD3[g] * x3 + GRAD3[g + 1] * y3 + GRAD3[g + 2] * z3); }
      return 32 * n;
    }
    return { n2, n3 };
  }
  function fbm(N, x, z, oct) {
    let s = 0, a = 1, f = 1, norm = 0;
    for (let o = 0; o < oct; o++) { s += N.n2(x * f, z * f) * a; norm += a; a *= 0.5; f *= 2.03; }
    return s / norm;
  }
  const smoothstep = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  let sc = 0;
  const S = () => Simplex(hash3(SEED, 1013, ++sc));
  const NW1 = S(), NW2 = S(), NC = S(), NT = S(), NH = S(), NHill = S(), ND = S(), ND2 = S(), NM = S(), NR = S(),
    NHi = S(), NRv = S(), NRv2 = S(), NE = S(), NOver = S(),
    CA1 = S(), CB1 = S(), CA2 = S(), CB2 = S(), CCav = S(), CCav2 = S(),
    NPink = S();                            // pink-tree patches in plains (keep last: S() order seeds the rest)

  // ---------------------------------------------------------------- 5. terrain columns
  // Returns the terrain description of one world column. Pure function of (SEED, x, z).
  function column(x, z) {
    const wx = x + NW1.n2(x * 0.0023, z * 0.0023) * 60;
    const wz = z + NW2.n2(x * 0.0023 + 17.3, z * 0.0023 - 9.1) * 60;
    const cont = fbm(NC, wx / 1000, wz / 1000, 5) * 1.7 + 0.18;
    const temp = fbm(NT, wx / 1300, wz / 1300, 3) * 1.6;
    const hum = fbm(NH, wx / 1100, wz / 1100, 3) * 1.6;
    const landW = smoothstep(-0.02, 0.28, cont);

    let h = cont < 0 ? SEA + 1 + cont * 26 : SEA + 1 + cont * 8;
    if (h < SEA - 12) h = SEA - 12 - (SEA - 12 - h) * 0.35;         // soft ocean floor

    const dW = smoothstep(0.15, 0.45, temp) * smoothstep(0.05, -0.2, hum);   // desert weight
    const jW = smoothstep(0.05, 0.3, temp) * smoothstep(0.1, 0.35, hum);     // jungle weight
    const hillN = fbm(NHill, wx / 400, wz / 400, 2) * 1.5;
    const amp = lerp(2.5, 11, smoothstep(-0.3, 0.45, hillN)) * (1 - 0.65 * dW) * (1 + 0.35 * jW);
    h += fbm(ND, wx / 72, wz / 72, 4) * amp * 2 * (0.25 + 0.75 * landW);
    if (dW > 0) h += dW * landW * (Math.abs(ND2.n2(wx / 26, wz / 44)) * 4 - 1);   // dunes

    // mountains: ridged noise
    const mRaw = fbm(NM, wx / 620, wz / 620, 3) * 1.4 + (cont - 0.3) * 0.4;
    const mW = smoothstep(0.25, 0.7, mRaw) * landW;
    if (mW > 0) {
      const r = 1 - Math.abs(fbm(NR, wx / 170, wz / 170, 4) * 1.6);
      h += mW * (r * r * 36 + fbm(ND, wx / 40 + 50, wz / 40, 3) * 8 + 12);
    }
    // rocky highlands: lifted, terraced plateaus
    const hRaw = fbm(NHi, wx / 450, wz / 450, 2) * 1.4;
    const hW = smoothstep(0.1, 0.45, hRaw) * landW * (1 - mW);
    if (hW > 0) {
      const lifted = h + hW * (16 + fbm(NHi, wx / 90 + 99, wz / 90, 2) * 14);
      const t = (lifted - SEA) / 7, fl = Math.floor(t);
      const terr = SEA + (fl + smoothstep(0.3, 0.7, t - fl)) * 7;
      h = lerp(lifted, terr, smoothstep(0.1, 0.4, hW));
    }
    // rivers: where |noise| is near zero
    const rv = Math.abs(NRv.n2(wx / 560, wz / 560) + NRv2.n2(wx / 140, wz / 140) * 0.08);
    let riverK = 0;
    if (rv < 0.12) {
      const fade = (1 - smoothstep(SEA + 16, SEA + 30, h)) * smoothstep(0.02, 0.2, cont);
      if (fade > 0) {
        const valley = smoothstep(0.12, 0.04, rv) * fade;
        h = lerp(h, Math.min(h, SEA + 2.5), valley);
        riverK = smoothstep(0.05, 0.012, rv) * fade;
        h = lerp(h, SEA - 1.5 - 3 * smoothstep(0.03, 0.005, rv), riverK);
      }
    }
    if (h > SEA + 32) h = SEA + 32 + (h - SEA - 32) * 0.5;
    const hi = Math.max(4, Math.min(H - 6, Math.floor(h)));

    const te = temp - Math.max(0, hi - SEA - 8) / 50;
    let biome;
    if (landW < 0.15 && hi < SEA) biome = BIOME.OCEAN;
    else if (riverK > 0.4 && hi < SEA + 1) biome = BIOME.RIVER;
    else if (hi < SEA + 2.5 && cont < 0.12 && mW < 0.1) biome = BIOME.BEACH;
    else if (te < -0.62 || hi > SNOW_LINE) biome = (mW > 0.2 || hi > SNOW_LINE) ? BIOME.SNOWY_MOUNTAINS : BIOME.SNOWY_PLAINS;
    else if ((mW > 0.3 || hW > 0.45) && hi > SEA + 12) biome = BIOME.HIGHLANDS;
    else if (te > 0.25 && hum < -0.05) biome = BIOME.DESERT;
    else if (te > 0.15 && hum > 0.2) biome = BIOME.RAINFOREST;
    else if (hum > 0.02) biome = BIOME.FOREST;
    else biome = BIOME.PLAINS;

    const entr = NE.n2(wx / 70, wz / 70);
    const oh = smoothstep(0.35, 0.8, mW);
    return { h: hi, biome, riverK, mW, hW, oh, entr, temp: te, hum };
  }

  // ---------------------------------------------------------------- 5. chunk generation
  const M = 7, W = CS + 2 * M;            // column table margin (trees reach 6 blocks across borders)
  const TREE_CHANCE = [];
  TREE_CHANCE[BIOME.OCEAN] = 0; TREE_CHANCE[BIOME.BEACH] = 0; TREE_CHANCE[BIOME.RIVER] = 0;
  TREE_CHANCE[BIOME.PLAINS] = 0.018; TREE_CHANCE[BIOME.FOREST] = 0.34; TREE_CHANCE[BIOME.RAINFOREST] = 0.5;
  TREE_CHANCE[BIOME.DESERT] = 0; TREE_CHANCE[BIOME.HIGHLANDS] = 0.035;
  TREE_CHANCE[BIOME.SNOWY_MOUNTAINS] = 0.05; TREE_CHANCE[BIOME.SNOWY_PLAINS] = 0.16;
  const PINK_GROVE_CHANCE = 0.2;          // tree chance at the heart of a pink grove in plains

  // ---------------------------------------------------------------- tree shapes
  // One tree of `shape` ('oak', 'spruce', 'jungle', or 'giant') with its trunk base at (tx, y0, tz).
  // P(x, y, z, id) writes one block. ground(x, y, z) marks the block under a trunk. A tall oak
  // (`tall`) is 6-8 blocks before the lift. The rng draws keep the order of the first inline version,
  // so the trees stand where they always stood. Saplings on the main thread call this through growTree.
  // Lift (2026-09-29): oak, spruce, and jungle trunks grow 1 or 2 blocks taller and the crown moves up
  // with them. The lift comes from a position hash, not from rng, so no later draw changes.
  function buildTree(shape, tx, y0, tz, rng, leaf, tall, P, ground) {
    const lift = shape === 'giant' ? 0 : 1 + (hash3(tx, y0, tz) & 1);
    const blob = (wx, y, wz, r, rCorner) => {
      for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
        const corner = Math.abs(dx) === r && Math.abs(dz) === r;
        if (corner && rng() < rCorner) continue;
        if (dx * dx + dz * dz > r * r + r) continue;
        P(wx + dx, y, wz + dz, leaf);
      }
    };
    const trunk = (h, w) => {
      for (let y = 0; y < h; y++) for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) P(tx + a, y0 + y, tz + b, B.LOG);
      for (let a = 0; a < w; a++) for (let b = 0; b < w; b++) ground(tx + a, y0 - 1, tz + b);
    };
    if (shape === 'spruce') {   // stacked cones
      const h = 6 + Math.floor(rng() * 4);
      trunk(h - 1 + lift, 1);
      let r = 1;
      for (let y = h; y >= 2; y--) {
        if (y === h) P(tx, y0 + lift + y, tz, leaf);
        else blob(tx, y0 + lift + y, tz, r, 1);
        r = (y % 2 === 0) ? Math.min(r + 1, (y < h - 3 ? 3 : 2)) : 1;
        if (y < h - 3 && y % 2 === 1) r = 2;
      }
    } else if (shape === 'giant') {   // 2x2 jungle tree
      const h = 13 + Math.floor(rng() * 7);
      trunk(h, 2);
      for (let y = h - 3; y <= h + 1; y++) {
        const r = y >= h ? 2 : y === h - 1 ? 4 : 3;
        blob(tx, y0 + y, tz, r, 0.7); blob(tx + 1, y0 + y, tz + 1, r, 0.7);
      }
      for (let b = 0; b < 2; b++) {             // side canopies
        const by = y0 + h - 6 - b * 3, dxs = rng() < 0.5 ? -3 : 4, dzs = rng() < 0.5 ? -2 : 3;
        P(tx + (dxs > 0 ? 2 : -1), by, tz + (dzs > 0 ? 1 : 0), B.LOG);
        blob(tx + dxs, by + 1, tz + dzs, 2, 0.8);
      }
    } else if (shape === 'jungle') {
      const h = 7 + Math.floor(rng() * 5) + lift;
      trunk(h, 1);
      blob(tx, y0 + h - 2, tz, 3, 0.6); blob(tx, y0 + h - 1, tz, 2, 0.5);
      blob(tx, y0 + h, tz, 2, 0.9); P(tx, y0 + h + 1, tz, leaf);
    } else {   // oak (sometimes tall)
      const h = (tall ? 6 + Math.floor(rng() * 3) : 4 + Math.floor(rng() * 2)) + lift;
      trunk(h, 1);
      blob(tx, y0 + h - 3, tz, 2, 0.5); blob(tx, y0 + h - 2, tz, 2, 0.5);
      if (tall) blob(tx, y0 + h - 4, tz, 2, 0.8);
      blob(tx, y0 + h - 1, tz, 1, 0.6);
      blob(tx, y0 + h, tz, 1, 1);
    }
  }
  // A sapling's tree: the shape and the tall draw come from `seed`.
  function growTree(shape, x, y, z, seed, leaf, P, ground) {
    const rng = mulberry32(seed);
    buildTree(shape, x, y, z, rng, leaf, rng() < 0.2, P, ground);
  }

  // ---------------------------------------------------------------- 5c. structures (Batch 17)
  // Each stamp writes only cells inside its chunk and draws only from hashes of the seed and world
  // positions. So two chunks agree on a structure that crosses their border without seeing each
  // other (no seams). Chests and spawners go into `features` for the main thread (loot, spawners).
  const D4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // DIR4: 0 +X, 1 +Z, 2 -X, 3 -Z
  const SPAWNER_MOBS = ['zombie', 'zombie', 'skeleton', 'spider'];
  const isSoft = (id) => id === B.AIR || id === B.WATER || (id >= B.WATER_FLOW && id <= B.LAVA_FLOW + 6);
  // The DIR4 index of a unit step (dx, dz).
  const dirOf = (dx, dz) => (dx > 0 ? 0 : dz > 0 ? 1 : dx < 0 ? 2 : 3);
  // Brick mix of a ruin: 60% stone bricks, 25% mossy, 15% cracked.
  const brickAt = (x, y, z) => { const v = hashF(x ^ 0x5b1c, y, z); return v < 0.6 ? B.STONE_BRICKS : v < 0.85 ? B.MOSSY_BRICKS : B.CRACKED_BRICKS; };

  function structCtx(x0, z0, blocks, col, features) {
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    const inside = (lx, lz) => lx >= 0 && lx < CS && lz >= 0 && lz < CS;
    return {
      x0, z0, col, inside,
      get: (lx, y, lz) => blocks[idx(lx, y, lz)],
      set(lx, y, lz, id) { if (inside(lx, lz) && y > 0 && y < H) blocks[idx(lx, y, lz)] = id; },
      feature(kind, lx, y, lz, type) { if (inside(lx, lz)) features.push({ kind, x: x0 + lx, y, z: z0 + lz, type }); },
    };
  }

  // Mineshafts. A cell of the MS_GRID grid holds a hub 2 times in 5, at y 60..100. From the hub, 2..4
  // corridors run straight for 24..79 blocks, and each may fork once into a side corridor of 12..39.
  // A corridor is 3 wide and 3 tall. Every 4th block has 2 log posts and a plank beam. Segments of
  // 4 blocks carry a rail with p 0.6 and a chest with p 1/6. Cobwebs hang in the upper corners.
  const MS_GRID = 96, MS_REACH = 124;
  function mineshaftPlan(gx, gz) {
    const r = mulberry32(hash3(SEED ^ 0x3a5f7, gx, gz));
    if (r() >= 0.4) return null;
    const hx = gx * MS_GRID + 16 + Math.floor(r() * 64), hz = gz * MS_GRID + 16 + Math.floor(r() * 64);
    const y = 60 + Math.floor(r() * 41), n = 2 + Math.floor(r() * 3), d0 = Math.floor(r() * 4);
    const runs = [];
    for (let k = 0; k < n; k++) {
      const d = (d0 + k) & 3, len = 24 + Math.floor(r() * 56);
      const sx = hx + D4[d][0] * 4, sz = hz + D4[d][1] * 4;
      runs.push({ sx, sz, d, len, id: hash3(SEED, gx * 8 + k, gz) });
      if (r() < 0.6) {
        const at = 8 + 4 * Math.floor(r() * ((len - 16) >> 2)), side = r() < 0.5 ? 1 : 3;
        runs.push({ sx: sx + D4[d][0] * at, sz: sz + D4[d][1] * at, d: (d + side) & 3, len: 12 + Math.floor(r() * 28), id: hash3(SEED, gx * 8 + k, gz + 7777) });
      }
    }
    return { hx, hz, y, runs };
  }
  function stampMineshafts(S) {
    const { x0, z0 } = S;
    const gxa = Math.floor((x0 - 80 - MS_REACH) / MS_GRID), gxb = Math.floor((x0 + 15 + MS_REACH) / MS_GRID);
    const gza = Math.floor((z0 - 80 - MS_REACH) / MS_GRID), gzb = Math.floor((z0 + 15 + MS_REACH) / MS_GRID);
    // A cell is carved only when the terrain surface stays 3 blocks above the corridor roof.
    const deep = (lx, lz, y) => S.col(lx, lz).h - 3 > y + 2;
    const carve = (lx, y, lz) => {
      for (let dy = 0; dy < 3; dy++) S.set(lx, y + dy, lz, B.AIR);
      if (isSoft(S.get(lx, y - 1, lz))) S.set(lx, y - 1, lz, B.PLANKS);   // plank bridges over caves
    };
    for (let gz = gza; gz <= gzb; gz++) for (let gx = gxa; gx <= gxb; gx++) {
      const plan = mineshaftPlan(gx, gz);
      if (!plan) continue;
      const y = plan.y;
      for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {   // hub room 7 x 7 x 4
        const lx = plan.hx + dx - x0, lz = plan.hz + dz - z0;
        if (S.inside(lx, lz) && deep(lx, lz, y + 1)) { carve(lx, y, lz); S.set(lx, y + 3, lz, B.AIR); }
      }
      for (const run of plan.runs) {
        const [ux, uz] = D4[run.d], px = -uz, pz = ux, ex = run.sx + ux * (run.len - 1), ez = run.sz + uz * (run.len - 1);
        if (Math.max(run.sx, ex) + 1 < x0 || Math.min(run.sx, ex) - 1 > x0 + 15
          || Math.max(run.sz, ez) + 1 < z0 || Math.min(run.sz, ez) - 1 > z0 + 15) continue;
        for (let t = 0; t < run.len; t++) {
          const seg = t >> 2, post = (t & 3) === 0 && t > 0;
          const rail = hashF(run.id, seg, 91) < 0.6;
          const chest = hashF(run.id, seg, 77) < 1 / 6 && (t & 3) === 2, side = hashF(run.id, seg, 78) < 0.5 ? -1 : 1;
          for (let w = -1; w <= 1; w++) {
            const wx = run.sx + ux * t + px * w, wz = run.sz + uz * t + pz * w, lx = wx - x0, lz = wz - z0;
            if (!S.inside(lx, lz) || !deep(lx, lz, y)) continue;
            carve(lx, y, lz);
            if (post) {
              if (w !== 0) { S.set(lx, y, lz, B.LOG); S.set(lx, y + 1, lz, B.LOG); }
              S.set(lx, y + 2, lz, B.PLANKS);
            } else if (w !== 0 && hashF(wx, y + 2, wz ^ 0x3b) < 0.07) S.set(lx, y + 2, lz, B.COBWEB);
            if (w === 0 && rail) S.set(lx, y, lz, B.RAIL + (run.d & 1 ? 0 : 1));
            if (w === side && chest) {
              S.set(lx, y, lz, B.CHEST + dirOf(-px * w, -pz * w));
              S.feature('chest', lx, y, lz, 'mine');
            }
          }
        }
      }
    }
  }

  // Dungeon (multi-room, 2026-10-02): 2..4 rooms of cobblestone and mossy cobblestone inside one chunk,
  // at y 14..93, 1 chunk in 12. Terms used below:
  //   - room: a box in chunk-local cells. p = [x, z] is its low corner, s = [w, d] its size (5..9),
  //     y its floor layer. The shell is 5 tall, so the interior is 3 tall.
  //   - link: the way from a room down to the next room, 5..9 blocks lower. A staircase leaves the
  //     upper room by a wall door and comes into the lower room through its roof. A ladder shaft
  //     drops from a hole in the upper room's floor and hangs on a wall line that both rooms share.
  //   - busy: interior columns that a link uses (stairs, landing, ladder, the cell in front of a door
  //     or a ladder). No other link, chest, or spawner takes a busy column. No link takes a centre,
  //     so any room can hold the spawner.
  // dungeonPlan(cx, cz, a) is pure (seed, chunk, plan number). stampDungeon tests plans against the terrain.
  const DG_Y0 = 14, DG_Y1 = 93;
  const centreOf = (R) => [R.p[0] + (R.s[0] >> 1), R.p[1] + (R.s[1] >> 1)];
  const colKey = (x, z) => x * 16 + z;
  // A staircase from room A down `drop` blocks, or null when no direction fits the chunk.
  // Step 0 is a stair in A's wall at A's floor layer, under a door 2 cells tall. Step i (1..drop-1) is a
  // stair at y A.y - i with 3 air cells above it. Step `drop` is the landing on the lower room's floor.
  // Each step is half a block twice, so nobody jumps. The last 4 steps lie in the lower room's interior,
  // along its wall.
  function stairLink(A, drop, ri, busy) {
    const d0 = ri(0, 3);
    for (let t = 0; t < 4; t++) {
      const dir = (d0 + t) & 3, ax = dir & 1, cr = 1 - ax, sg = dir < 2 ? 1 : -1;
      const at = (u, v) => (ax ? [v, u] : [u, v]);   // (along, across) to [lx, lz]
      const u0 = sg > 0 ? A.p[ax] + A.s[ax] - 1 : A.p[ax];   // the door, in A's wall
      const uEnd = u0 + sg * drop, uIn = u0 + sg * (drop - 3);
      const lo = Math.min(uEnd, uIn), hi = Math.max(uEnd, uIn);
      const wB = ri(6, 9), bLo = Math.max(0, hi - wB + 2), bHi = Math.min(CS - wB, lo - 1);
      const c = ri(A.p[cr] + 1, A.p[cr] + A.s[cr] - 2), dB = ri(5, 9);
      const across = [c - 1, c - dB + 2].filter((v) => v >= 0 && v <= CS - dB);
      if (bLo > bHi || !across.length) continue;
      const R = { p: [0, 0], s: [0, 0], y: A.y - drop };
      R.p[ax] = ri(bLo, bHi); R.s[ax] = wB; R.p[cr] = across[ri(0, across.length - 1)]; R.s[cr] = dB;
      const front = at(u0 - sg, c), ca = centreOf(A), cb = centreOf(R);
      if (busy.has(colKey(...front)) || (front[0] === ca[0] && front[1] === ca[1])) continue;
      const cells = [], top = [front], bottom = [], stair = B.STAIRS_COBBLE + ((dir + 2) & 3);
      const inB = (u) => u > R.p[ax] && u < R.p[ax] + wB - 1;
      const [ox, oz] = at(u0, c);   // the door: a stair in A's floor layer, then 2 air cells
      cells.push([ox, A.y, oz, stair], [ox, A.y + 1, oz, B.AIR], [ox, A.y + 2, oz, B.AIR]);
      let hitsCentre = false;
      for (let i = 1; i <= drop; i++) {
        const u = u0 + sg * i, [x, z] = at(u, c), ys = A.y - i;
        if (i < drop) cells.push([x, ys, z, stair]);
        for (let y = ys + 1; y <= ys + 3; y++) cells.push([x, y, z, B.AIR]);
        if (i >= drop - 4 && inB(u)) {
          bottom.push([x, z]);
          if (x === cb[0] && z === cb[1]) hitsCentre = true;
          for (let y = R.y + 1; y < Math.min(ys, R.y + 4); y++) cells.push([x, y, z, B.COBBLE]);   // a solid base
        }
      }
      // The room cell beside the landing stays free: the landing can sit in a corner of the lower room.
      const side = at(uEnd, c + (R.p[cr] === c - 1 ? 1 : -1));
      bottom.push(side);
      if (side[0] === cb[0] && side[1] === cb[1]) hitsCentre = true;
      if (hitsCentre) continue;
      return { kind: 'stairs', room: R, cells, top, bottom };
    }
    return null;
  }
  // A ladder shaft from room A down `drop` blocks. The lower room shares A's wall line on one side, so
  // the ladder hangs on a wall from the lower floor up into A. Null when every column is busy.
  function ladderLink(A, drop, ri, busy) {
    const d0 = ri(0, 3);
    for (let t = 0; t < 4; t++) {
      const side = (d0 + t) & 3, ax = side & 1, cr = 1 - ax, sg = side < 2 ? 1 : -1;
      const at = (u, v) => (ax ? [v, u] : [u, v]);
      const wall = sg > 0 ? A.p[ax] + A.s[ax] - 1 : A.p[ax], col = wall - sg;
      const wB = ri(5, Math.min(9, sg > 0 ? wall + 1 : CS - wall)), dB = ri(5, 9);
      const c0 = A.p[cr] + 1, cn = A.s[cr] - 2, k0 = ri(0, cn - 1), ca = centreOf(A);
      for (let k = 0; k < cn; k++) {
        const c = c0 + ((k0 + k) % cn), here = at(col, c), front = at(col - sg, c);
        if (busy.has(colKey(...here)) || busy.has(colKey(...front))) continue;
        if ((here[0] === ca[0] && here[1] === ca[1]) || (front[0] === ca[0] && front[1] === ca[1])) continue;
        const R = { p: [0, 0], s: [0, 0], y: A.y - drop };
        R.p[ax] = sg > 0 ? wall - wB + 1 : wall; R.s[ax] = wB;
        R.p[cr] = ri(Math.max(0, c - dB + 2), Math.min(c - 1, CS - dB)); R.s[cr] = dB;
        const cb = centreOf(R);
        if ((here[0] === cb[0] && here[1] === cb[1]) || (front[0] === cb[0] && front[1] === cb[1])) continue;
        const cells = [], [wx, wz] = at(wall, c), ladder = B.LADDER + ((side + 2) & 3);
        for (let y = R.y + 1; y <= A.y + 2; y++) cells.push([wx, y, wz, B.COBBLE], [here[0], y, here[1], ladder]);
        return { kind: 'ladder', room: R, cells, top: [here, front], bottom: [here, front] };
      }
    }
    return null;
  }
  // Plan `a` (0..DG_PLANS-1) of chunk (cx, cz), or null when the chunk does not try a dungeon. A link is
  // a staircase with p 0.7 when one fits, else a ladder shaft (stairs fit less often, so links end up
  // about 40 % stairs).
  const DG_PLANS = 3;
  function dungeonPlan(cx, cz, a = 0) {
    if (hashF(SEED ^ 0x0d0e, cx, cz) >= 1 / 12) return null;
    const r = mulberry32(hash3((SEED ^ 0x0d0e) + 7919 * (a + 1), cx, cz));
    const ri = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));   // a whole number in lo..hi
    const n = ri(2, 4), drops = [];
    for (let k = 1; k < n; k++) drops.push(ri(5, 9));
    const fall = drops.reduce((sum, v) => sum + v, 0), w = ri(5, 9), d = ri(5, 9);
    const rooms = [{ p: [ri(0, CS - w), ri(0, CS - d)], s: [w, d], y: ri(DG_Y0 + fall, DG_Y1) }], links = [];
    let busy = new Set();
    for (let k = 1; k < n; k++) {
      const A = rooms[k - 1], drop = drops[k - 1];
      const link = (r() < 0.7 && stairLink(A, drop, ri, busy)) || ladderLink(A, drop, ri, busy);
      if (!link) break;
      rooms.push(link.room); links.push(link);
      busy = new Set(link.bottom.map(([x, z]) => colKey(x, z)));
    }
    return { rooms, links };
  }
  // Tests DG_PLANS plans and stamps the first one that keeps the most rooms (3 plans keep the dungeon
  // count near the old count of dungeons on solid ground). A plan keeps its rooms down to the first room
  // that fails: an open cell under its floor (O3, so no floor hangs in a cave), under 4 blocks of
  // terrain above its roof, or a link cell under 4 blocks of terrain. Fewer than 2 rooms: no dungeon. Walls and roofs replace only solid cells, so a room that
  // meets a cave stays open to it. One room holds the spawner and 1..2 chests; the others hold 1 chest.
  // `info`, when given, receives the stamped plan (tests).
  function stampDungeon(cx, cz, S, info) {
    if (!dungeonPlan(cx, cz)) return;
    const roomOk = (R) => {
      for (let z = R.p[1]; z < R.p[1] + R.s[1]; z++) for (let x = R.p[0]; x < R.p[0] + R.s[0]; x++) {
        if (S.col(x, z).h < R.y + 8 || isSoft(S.get(x, R.y - 1, z))) return false;
      }
      return true;
    };
    const linkOk = (L) => L.cells.every(([x, y, z]) => S.col(x, z).h >= y + 4);
    const fit = (P) => { let k = 0; while (k < P.rooms.length && roomOk(P.rooms[k]) && (k === 0 || linkOk(P.links[k - 1]))) k++; return k; };
    let plan = null, kept = 0;   // the first plan that keeps the most rooms
    for (let a = 0; a < DG_PLANS && kept < 4; a++) { const P = dungeonPlan(cx, cz, a), k = fit(P); if (k > kept) { plan = P; kept = k; } }
    if (kept < 2) return;
    const rooms = plan.rooms.slice(0, kept), links = plan.links.slice(0, kept - 1);
    const cob = (x, y, z, p) => (hashF(S.x0 + x, y, (S.z0 + z) ^ 0xd6) < p ? B.MOSSY_COBBLE : B.COBBLE);
    for (const R of rooms) {
      const [x0, z0] = R.p, [w, d] = R.s;
      for (let dy = 0; dy < 5; dy++) for (let dz = 0; dz < d; dz++) for (let dx = 0; dx < w; dx++) {
        const x = x0 + dx, z = z0 + dz, y = R.y + dy;
        if (dy > 0 && dy < 4 && dx > 0 && dx < w - 1 && dz > 0 && dz < d - 1) { S.set(x, y, z, B.AIR); continue; }
        if (dy > 0 && isSoft(S.get(x, y, z))) continue;
        S.set(x, y, z, cob(x, y, z, dy === 0 ? 0.6 : 0.35));
      }
    }
    for (const L of links) for (const [x, y, z, id] of L.cells) S.set(x, y, z, id === B.COBBLE ? cob(x, y, z, 0.35) : id);
    const r = mulberry32(hash3(SEED ^ 0x0d0f, cx, cz)), si = Math.floor(r() * kept);
    for (let k = 0; k < kept; k++) {
      const R = rooms[k], [mx, mz] = centreOf(R), busy = new Set(), y = R.y + 1;
      const [x0, z0] = R.p, x1 = x0 + R.s[0] - 2, z1 = z0 + R.s[1] - 2;   // interior x0+1..x1, z0+1..z1
      for (const L of [links[k - 1] && links[k - 1].bottom, links[k] && links[k].top]) if (L) for (const [x, z] of L) busy.add(colKey(x, z));
      if (k === si) {
        S.set(mx, y, mz, B.SPAWNER);
        S.feature('spawner', mx, y, mz, SPAWNER_MOBS[Math.floor(r() * SPAWNER_MOBS.length)]);
      }
      // True when the free interior floor cells (2 cells of headroom) form one 4-connected area. Only air
      // and ladders are open here: the interior holds air, link cells, chests, and the spawner.
      const open = (id) => id === B.AIR || (id >= B.LADDER && id < B.LADDER + 4);
      const free = (x, z) => x > x0 && x <= x1 && z > z0 && z <= z1 && open(S.get(x, y, z)) && open(S.get(x, y + 1, z));
      const joined = () => {
        let start = null, n = 0;
        for (let z = z0 + 1; z <= z1; z++) for (let x = x0 + 1; x <= x1; x++) if (free(x, z)) { n++; start = start || [x, z]; }
        const seen = new Set(start ? [colKey(...start)] : []), q = start ? [start] : [];
        while (q.length) {
          const [x, z] = q.pop();
          for (const [dx, dz] of D4) if (free(x + dx, z + dz) && !seen.has(colKey(x + dx, z + dz))) { seen.add(colKey(x + dx, z + dz)); q.push([x + dx, z + dz]); }
        }
        return seen.size === n;
      };
      // Wall middles first (a second chest prefers the opposite wall), then the other cells along the
      // walls. A chest faces into the room and takes a spot only when the floor stays joined.
      const wallMid = [[x0 + 1, mz, 0], [x1, mz, 2], [mx, z0 + 1, 1], [mx, z1, 3]];
      const n = k === si && r() < 0.5 ? 2 : 1, first = Math.floor(r() * 4), spots = [0, 2, 1, 3].map((o) => wallMid[(first + o) & 3]);
      for (let x = x0 + 1; x <= x1; x++) spots.push([x, z0 + 1, 1], [x, z1, 3]);
      for (let z = z0 + 2; z < z1; z++) spots.push([x0 + 1, z, 0], [x1, z, 2]);
      let placed = 0;
      for (const [x, z, f] of spots) {
        if (placed === n || busy.has(colKey(x, z)) || !free(x, z)) continue;
        S.set(x, y, z, B.CHEST + f);
        if (!joined()) { S.set(x, y, z, B.AIR); continue; }
        S.feature('chest', x, y, z, 'dungeon');
        placed++;
      }
    }
    if (info) info.dungeon = { rooms, links, spawnerRoom: si };
  }

  // Desert temple: a 15 x 15 stepped sandstone pyramid at lx, lz 0..14, on ground that varies by 4 blocks
  // or less. A desert chunk tries 1 time in 10; about 1 in 4 passes the ground and door tests, so about 1 in 40
  // holds one. A 1 x 1 shaft in the hall centre drops 12 blocks into a 7 x 7
  // room with 4 chests. The room's centre floor cell is chiseled sandstone over 3 x 3 TNT (the trap).
  // The hall floor sits 1 below to 2 above the ground outside each of the 4 doors, or the chunk holds no
  // temple. A door cell rises to its outside ground, and 1 step inside leads down, so each step is 1 block.
  const TEMPLE_DOORS = [[0, 7, -1, 7, 1, 0], [14, 7, 15, 7, -1, 0], [7, 0, 7, -1, 0, 1], [7, 14, 7, 15, 0, -1]];   // door, outside, inward
  function stampTemple(cx, cz, S) {
    if (S.col(7, 7).biome !== BIOME.DESERT || hashF(SEED ^ 0x7e3b, cx, cz) >= 1 / 10) return;
    let lo = 1e9, hi = -1e9;
    for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) {
      const k = S.col(x, z);
      if (k.biome !== BIOME.DESERT || k.oh > 0 || k.riverK > 0.05) return;
      lo = Math.min(lo, k.h); hi = Math.max(hi, k.h);
    }
    const g = TEMPLE_DOORS.map(([, , ox, oz]) => S.col(ox, oz).h), by = Math.max(lo, Math.max(...g) - 2);
    if (hi - lo > 4 || by - lo > 4 || by > Math.min(...g) + 1 || lo < SEA + 2 || by + 14 >= H) return;
    const ry = by - 12, SS = B.SANDSTONE, CH = B.CHISELED_SANDSTONE;
    for (let z = 0; z < 15; z++) for (let x = 0; x < 15; x++) {
      for (let y = by + 1; y <= by + 12; y++) S.set(x, y, z, B.AIR);
      for (let y = S.col(x, z).h + 1; y <= by; y++) S.set(x, y, z, SS);   // the floor, on a foundation where the ground is low
      S.set(x, by, z, SS);
      const edge = x === 0 || x === 14 || z === 0 || z === 14, door = (x === 7 || z === 7);
      if (edge && !door) for (let t = 1; t <= 4; t++) S.set(x, by + t, z, t === 3 ? CH : SS);
      const m = Math.min(x, z, 14 - x, 14 - z);   // distance from the outer edge
      for (const [t, inset] of [[5, 0], [6, 2], [7, 4], [8, 6]]) if (m >= inset) S.set(x, by + t, z, t === 8 && x === 7 && z === 7 ? CH : SS);
      // the lower room: shell at 3..11, air inside, floor at ry
      if (x >= 3 && x <= 11 && z >= 3 && z <= 11) {
        const inner = x >= 4 && x <= 10 && z >= 4 && z <= 10;
        for (let y = ry; y <= ry + 4; y++) S.set(x, y, z, inner && y > ry && y < ry + 4 ? B.AIR : SS);
      }
      if (x >= 6 && x <= 8 && z >= 6 && z <= 8) {
        S.set(x, ry - 1, z, B.TNT);
        if (x !== 7 || z !== 7) { for (let y = ry + 5; y < by; y++) S.set(x, y, z, SS); S.set(x, by, z, CH); }   // shaft lining
      }
    }
    TEMPLE_DOORS.forEach(([dx, dz, , , ix, iz], k) => {
      for (let t = 1; t <= 4; t++) S.set(dx, by + t, dz, t <= g[k] - by ? SS : B.AIR);
      if (g[k] - by === 2) S.set(dx + ix, by + 1, dz + iz, SS);
    });
    for (let y = ry + 4; y <= by; y++) S.set(7, y, 7, B.AIR);   // the shaft
    S.set(7, ry, 7, CH);                                        // the trap plate
    for (const [x, z, f] of [[7, 4, 1], [7, 10, 3], [4, 7, 0], [10, 7, 2]]) {
      S.set(x, ry + 1, z, B.CHEST + f);
      S.feature('chest', x, ry + 1, z, 'temple');
    }
  }

  // Ruined tower: a round 5 x 5 tower of mixed bricks, 8..14 tall, in plains, forest, or highlands. A chunk
  // tries 1 time in 25; about half pass the ground test, so about 1 chunk in 50 of those biomes holds one. The rim breaks off at random heights. Brick steps spiral up the inside to a top floor
  // with a chest. The door (3 tall) faces a random side.
  const TOWER_RING = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];   // steps, from the door
  function stampTower(cx, cz, S) {
    if (hashF(SEED ^ 0x70e4, cx, cz) >= 1 / 25) return;
    const r = mulberry32(hash3(SEED ^ 0x70e5, cx, cz));
    // the centre stays in 6..9, so the tower and its door ramp fit inside the chunk
    const ox = 6 + Math.floor(r() * 4), oz = 6 + Math.floor(r() * 4), hgt = 8 + Math.floor(r() * 7), rot = Math.floor(r() * 4);
    const c = S.col(ox, oz);
    if (c.biome !== BIOME.PLAINS && c.biome !== BIOME.FOREST && c.biome !== BIOME.HIGHLANDS) return;
    let lo = 1e9, hi = -1e9;
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const k = S.col(ox + dx, oz + dz);
      if (k.oh > 0 || k.riverK > 0.05) return;
      lo = Math.min(lo, k.h); hi = Math.max(hi, k.h);
    }
    const base = lo, top = base + hgt, yF = top - 4;
    if (hi - lo > 3 || base < SEA + 1 || top + 4 >= H) return;
    const R = (dx, dz) => { for (let i = 0; i < rot; i++) [dx, dz] = [-dz, dx]; return [ox + dx, oz + dz]; };
    const holes = new Set();
    for (let i = 0; base + 1 + i < yF; i++) {
      const [lx, lz] = R(...TOWER_RING[i & 7]), y = base + 1 + i;
      S.set(lx, y, lz, brickAt(S.x0 + lx, y, S.z0 + lz));
      if (y >= yF - 3) holes.add(lx * 16 + lz);   // the top floor opens over the last 3 steps, so each jump has headroom
    }
    for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) {
      const ring = Math.max(Math.abs(dx), Math.abs(dz)) === 2;
      if (ring && Math.abs(dx) === 2 && Math.abs(dz) === 2) continue;   // round: no corners
      const [lx, lz] = R(dx, dz), wx = S.x0 + lx, wz = S.z0 + lz;
      for (let y = base + 1; y <= top + 3; y++) {
        const cur = S.get(lx, y, lz);
        if (!ring && cur >= B.STONE_BRICKS && cur <= B.CRACKED_BRICKS) continue;   // keep the steps
        S.set(lx, y, lz, B.AIR);
      }
      S.set(lx, base, lz, brickAt(wx, base, wz));
      if (ring) {
        const rim = top - Math.floor(hashF(wx, 404, wz) * 4), door = dx === 0 && dz === -2, window = (dx === 0 || dz === 0) && !door;
        for (let y = base + 1; y <= rim; y++) {
          if (door && y <= base + 3) continue;   // 3 tall: the first step stands just inside, so the jump onto it needs the headroom
          if (window && y === base + 3) continue;
          if (y > base + 2 && hashF(wx, y, wz ^ 0x77) < 0.06) continue;   // missing bricks
          S.set(lx, y, lz, brickAt(wx, y, wz));
        }
      } else if (!holes.has(lx * 16 + lz)) S.set(lx, yF, lz, brickAt(wx, yF, wz));
    }
    // a ramp out of the door: cell t stands 1 block higher than cell t - 1, with 3 blocks of headroom
    for (let t = 1; t <= 4; t++) {
      const [lx, lz] = R(0, -2 - t), fy = base + t - 1;
      for (let y = fy + 1; y <= fy + 3; y++) S.set(lx, y, lz, B.AIR);
    }
    const [chx, chz] = R(0, 0), f = (rot + 3) & 3;   // the chest faces the door side (DIR4 3 = -Z before rotation)
    S.set(chx, yF + 1, chz, B.CHEST + f);
    S.feature('chest', chx, yF + 1, chz, 'tower');
  }

  // `info` (optional, tests only) receives debug data: info.dungeon is the stamped dungeon plan.
  function overworldChunk(cx, cz, info) {
    const x0 = cx * CS, z0 = cz * CS;
    const blocks = new Uint8Array(CS * CS * H);
    const biomes = new Uint8Array(CS * CS), heights = new Uint8Array(CS * CS);
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;

    // column table with margin
    const T = new Array(W * W);
    const TH = new Int16Array(W * W);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const c = column(x0 - M + i, z0 - M + j);
      T[j * W + i] = c; TH[j * W + i] = c.h;
    }
    const col = (lx, lz) => T[(lz + M) * W + (lx + M)];
    const colH = (lx, lz) => TH[(lz + M) * W + (lx + M)];
    const slope = (lx, lz) => {
      const h = colH(lx, lz);
      return Math.max(Math.abs(h - colH(lx + 1, lz)), Math.abs(h - colH(lx - 1, lz)), Math.abs(h - colH(lx, lz + 1)), Math.abs(h - colH(lx, lz - 1)));
    };

    // 1. stone body (with 3D overhang density in mountains)
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const c = col(x, z); const h = c.h;
      biomes[z * CS + x] = c.biome;
      if (c.oh <= 0.001) {
        for (let y = 1; y <= h; y++) blocks[idx(x, y, z)] = B.STONE;
      } else {
        const lo = Math.max(1, h - 12), hi = Math.min(H - 3, h + 12);
        for (let y = 1; y < lo; y++) blocks[idx(x, y, z)] = B.STONE;
        for (let y = lo; y <= hi; y++) {
          const d = (h - y) / 12 + NOver.n3((x0 + x) / 22, y / 14, (z0 + z) / 22) * c.oh * 1.15;
          if (d > 0) blocks[idx(x, y, z)] = B.STONE;
        }
      }
    }

    // 2. surface pass: biome top + filler. Resets on air so overhang tops get grass too.
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const c = col(x, z), steep = slope(x, z) >= 3;
      const b = c.biome;
      let top, filler, fillDepth = 3 + (hash3(SEED, x0 + x, z0 + z) & 1);
      switch (b) {
        case BIOME.DESERT: top = B.SAND; filler = B.SAND; fillDepth = 4; break;
        case BIOME.BEACH: top = B.SAND; filler = B.SAND; break;
        case BIOME.RIVER: top = B.SAND; filler = B.SAND; break;
        case BIOME.OCEAN: top = NHi.n2((x0 + x) / 18, (z0 + z) / 18) > 0.35 ? B.GRAVEL : B.SAND; filler = B.SAND; break;
        case BIOME.SNOWY_PLAINS: top = B.SNOW; filler = B.DIRT; break;
        case BIOME.SNOWY_MOUNTAINS: top = c.h > SNOW_LINE - 4 ? B.SNOW : B.GRASS; filler = c.h > SNOW_LINE - 4 ? B.STONE : B.DIRT; break;
        case BIOME.HIGHLANDS: top = NHi.n2((x0 + x) / 11, (z0 + z) / 11) > 0.55 ? B.GRAVEL : B.GRASS; filler = B.DIRT; break;
        default: top = B.GRASS; filler = B.DIRT;
      }
      if (steep && b !== BIOME.DESERT && b !== BIOME.BEACH) { top = B.STONE; filler = B.STONE; }
      let depth = -1;
      for (let y = H - 1; y >= 1; y--) {
        const i = idx(x, y, z);
        if (blocks[i] === B.AIR) { depth = -1; continue; }
        depth++;
        if (depth === 0) {
          let t = top;
          if (y > SNOW_LINE && !steep) t = B.SNOW;
          else if (y < SEA && t === B.GRASS) t = y < SEA - 2 ? (b === BIOME.RIVER ? B.SAND : B.DIRT) : B.SAND;
          else if (y < SEA && t === B.SNOW) t = B.DIRT;
          blocks[i] = t;
        } else if (depth < fillDepth) {
          blocks[i] = (filler === B.DIRT && y < SEA - 1 && b !== BIOME.FOREST) ? B.DIRT : filler;
        } else if (c.oh <= 0.001) break;            // plain column: the rest is stone
      }
    }

    // 3. caves: two spaghetti tunnel fields, a cavern field, and a giant-cavern field (deep band),
    //    sampled on a coarse 4-block grid. Tunnels widen with depth.
    const GX = 5, GY = H / 4 + 1;
    const gridA1 = new Float32Array(GX * GX * GY), gridB1 = new Float32Array(GX * GX * GY),
      gridA2 = new Float32Array(GX * GX * GY), gridB2 = new Float32Array(GX * GX * GY), gridC = new Float32Array(GX * GX * GY),
      gridD = new Float32Array(GX * GX * GY);
    for (let gy = 0; gy < GY; gy++) for (let gz = 0; gz < GX; gz++) for (let gx = 0; gx < GX; gx++) {
      const wx = x0 + gx * 4, wy = gy * 4, wz = z0 + gz * 4;
      const k = (gy * GX + gz) * GX + gx;
      gridA1[k] = CA1.n3(wx / 56, wy / 36, wz / 56);
      gridB1[k] = CB1.n3(wx / 56, wy / 36, wz / 56);
      gridA2[k] = CA2.n3(wx / 28, wy / 22, wz / 28);
      gridB2[k] = CB2.n3(wx / 28, wy / 22, wz / 28);
      gridC[k] = CCav.n3(wx / 70, wy / 30, wz / 70);
      gridD[k] = CCav2.n3(wx / 110, wy / 26, wz / 110);
    }
    const tri = (g, x, y, z) => {
      const gx = x >> 2, gy = y >> 2, gz = z >> 2, fx = (x & 3) / 4, fy = (y & 3) / 4, fz = (z & 3) / 4;
      const k = (gy * GX + gz) * GX + gx, sy = GX * GX;
      const c00 = g[k] + (g[k + 1] - g[k]) * fx, c10 = g[k + GX] + (g[k + GX + 1] - g[k + GX]) * fx;
      const c01 = g[k + sy] + (g[k + sy + 1] - g[k + sy]) * fx, c11 = g[k + sy + GX] + (g[k + sy + GX + 1] - g[k + sy + GX]) * fx;
      const c0 = c00 + (c10 - c00) * fz, c1 = c01 + (c11 - c01) * fz;
      return c0 + (c1 - c0) * fy;
    };
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const c = col(x, z);
      let minH = 999;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) minH = Math.min(minH, colH(x + dx, z + dz));
      let yMax = c.oh > 0.001 ? Math.min(H - 3, c.h + 12) : c.h;
      if (minH < SEA) yMax = Math.min(yMax, minH - 7);    // never breach into oceans / rivers
      const open = c.entr > 0.4;
      for (let y = 4; y <= yMax; y++) {
        const i = idx(x, y, z);
        if (blocks[i] === B.AIR) continue;
        if (y > c.h - 5 && !open) continue;
        const df = Math.min(1, Math.max(0, (c.h - y) / 60));
        const t = 0.075 + 0.06 * df;
        const a1 = tri(gridA1, x, y, z), b1 = tri(gridB1, x, y, z);
        let carve = a1 * a1 + b1 * b1 < t * t;
        if (!carve) { const a2 = tri(gridA2, x, y, z), b2 = tri(gridB2, x, y, z); carve = a2 * a2 + b2 * b2 < t * t * 0.8; }
        if (!carve && y < SEA - 4) carve = tri(gridC, x, y, z) > 0.55 - 0.16 * df;
        if (!carve && y >= 6 && y <= 70) {
          const band = smoothstep(6, 18, y) * smoothstep(70, 54, y);
          carve = tri(gridD, x, y, z) > 0.72 - 0.22 * band;
        }
        if (carve) blocks[i] = B.AIR;
      }
      // lava: every cave cell at y 10 and below fills with lava
      for (let y = 1; y <= 10; y++) { const i = idx(x, y, z); if (blocks[i] === B.AIR) blocks[i] = B.LAVA; }
    }

    // 4. ore / dirt / gravel veins, seeded per chunk from the 3x3 neighbourhood
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const r = mulberry32(hash3(SEED ^ 0x4f7e, ncx, ncz));
      const vein = (id, count, minS, maxS, ymin, ymax) => {
        for (let v = 0; v < count; v++) {
          let x = ncx * CS + Math.floor(r() * CS), y = ymin + Math.floor(r() * (ymax - ymin)), z = ncz * CS + Math.floor(r() * CS);
          const size = minS + Math.floor(r() * (maxS - minS + 1));
          for (let s = 0; s < size; s++) {
            const lx = x - x0, lz = z - z0;
            if (lx >= 0 && lx < CS && lz >= 0 && lz < CS && y > 0 && y < H) {
              const i = idx(lx, y, lz);
              if (blocks[i] === B.STONE) blocks[i] = id;
            }
            const d = Math.floor(r() * 6);
            if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4) y++; else y--;
          }
        }
      };
      // (id, veins per chunk, min size, max size, y min, y max): rarer ores sit deeper
      vein(B.COAL_ORE, 48, 4, 10, 20, SEA + 37);
      vein(B.COPPER_ORE, 28, 3, 8, 50, SEA + 12);
      vein(B.IRON_ORE, 32, 3, 8, 5, SEA - 18);
      vein(B.GOLD_ORE, 10, 3, 6, 5, 60);
      vein(B.RUBY_ORE, 6, 2, 5, 5, 40);
      vein(B.DIAMOND_ORE, 4, 2, 5, 5, 24);
      vein(B.DIRT, 8, 8, 16, 30, SEA + 22);
      vein(B.GRAVEL, 7, 8, 14, 10, SEA + 12);
    }

    // 5. ragged bedrock floor
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      blocks[idx(x, 0, z)] = B.BEDROCK;
      for (let y = 1; y <= 3; y++) if (hashF(x0 + x, y * 7919, z0 + z) < 1 - y * 0.25) blocks[idx(x, y, z)] = B.BEDROCK;
    }

    // 5b. crystal clusters on cave floors, ceilings, and walls. Patch centres come from the 3x3
    //     chunk neighbourhood, so a patch crosses chunk borders. A cave cell near a centre grows a
    //     crystal when a world-coordinate hash passes; only rock inside this chunk counts as support.
    const CRYSTAL_PATCHES = 2.5, CRYSTAL_DENSITY = 0.6;   // mean patch centres per chunk; hash pass rate at a centre
    const ROCK = new Set([B.STONE, B.DIRT, B.GRAVEL, B.COAL_ORE, B.COPPER_ORE, B.IRON_ORE, B.GOLD_ORE, B.RUBY_ORE, B.DIAMOND_ORE]);
    const rockAt = (x, y, z) => x >= 0 && x < CS && z >= 0 && z < CS && y > 0 && y < H && ROCK.has(blocks[idx(x, y, z)]);
    const CRY_DIRS = [[0, -1, 0, 0], [0, 1, 0, 1], [-1, 0, 0, 2], [0, 0, -1, 3], [1, 0, 0, 4], [0, 0, 1, 5]];   // rock offset, variant
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const r = mulberry32(hash3(SEED ^ 0xc75a1, ncx, ncz));
      for (let n = 0; n < Math.ceil(CRYSTAL_PATCHES); n++) {
        const px = ncx * CS + Math.floor(r() * CS), py = 12 + Math.floor(r() * (SEA - 18)), pz = ncz * CS + Math.floor(r() * CS);
        const R = 4 + Math.floor(r() * 3);
        if (n + 1 > CRYSTAL_PATCHES && r() >= CRYSTAL_PATCHES - n) continue;   // the fractional last patch
        for (let y = Math.max(1, py - R); y <= Math.min(H - 2, py + R); y++)
          for (let lz = Math.max(0, pz - R - z0); lz <= Math.min(CS - 1, pz + R - z0); lz++)
            for (let lx = Math.max(0, px - R - x0); lx <= Math.min(CS - 1, px + R - x0); lx++) {
              const wx = x0 + lx, wz = z0 + lz, d = Math.hypot(wx - px, y - py, wz - pz);
              if (d > R) continue;
              const i = idx(lx, y, lz);
              if (blocks[i] !== B.AIR || y > col(lx, lz).h - 8) continue;
              if (hashF(SEED ^ 0x5c1e, wx * 31 + y, wz) > CRYSTAL_DENSITY * (1 - d / (R + 1))) continue;
              // floors and ceilings weigh 3, walls 1
              let total = 0;
              for (const [ox, oy, oz] of CRY_DIRS) if (rockAt(lx + ox, y + oy, lz + oz)) total += oy ? 3 : 1;
              if (!total) continue;
              let pick = hashF(SEED ^ 0x7e11, wx, y * 131 + wz) * total;
              for (const [ox, oy, oz, v] of CRY_DIRS) {
                if (!rockAt(lx + ox, y + oy, lz + oz)) continue;
                pick -= oy ? 3 : 1;
                if (pick < 0) { blocks[i] = B.CRYSTAL + v; break; }
              }
            }
      }
    }

    // 6. water up to sea level, only above the terrain surface of low columns
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const h = colH(x, z);
      if (h >= SEA) continue;
      for (let y = h + 1; y <= SEA; y++) { const i = idx(x, y, z); if (blocks[i] === B.AIR) blocks[i] = B.WATER; }
    }

    // 7. trees on a jittered 3-block grid, scanned 6 blocks past the border so canopies cross chunks.
    //    Leaf color: snowy biomes grow white leaves. Oaks in pink groves of plains grow pink leaves.
    //    Forest oaks form a mosaic: jittered cells of MOSAIC_CELL blocks each pick one color from
    //    MOSAIC_COLORS, and a tree takes its cell's color, or a random one (MOSAIC_STRAY).
    //    Other oaks are green (70%), red, orange, yellow, or brown (7.5% each). Color draws use their
    //    own hashes, not the tree rng, so tree shapes stay the same as before colors existed.
    const isLeaf = (id) => id === B.LEAVES || (id >= B.LEAVES_RED && id <= B.LEAVES_WHITE) || id === B.LEAVES_YELLOW;
    const OAK_COLORS = [B.LEAVES_RED, B.LEAVES_ORANGE, B.LEAVES_YELLOW, B.LEAVES_BROWN];
    const MOSAIC_COLORS = [B.LEAVES, B.LEAVES, B.LEAVES, B.LEAVES_YELLOW, B.LEAVES_YELLOW, B.LEAVES_ORANGE,
      B.LEAVES_ORANGE, B.LEAVES_RED, B.LEAVES_RED, B.LEAVES_BROWN];   // weights: green 3, yellow/orange/red 2, brown 1
    const MOSAIC_CELL = 11, MOSAIC_STRAY = 0.2;
    // The color of the mosaic cell nearest to (x, z): cell points jitter inside an 11-block grid.
    const mosaicColor = (x, z) => {
      const cx = Math.floor(x / MOSAIC_CELL), cz = Math.floor(z / MOSAIC_CELL);
      let best = Infinity, pick = B.LEAVES;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const r = mulberry32(hash3(SEED ^ 0x3a1c, cx + dx, cz + dz));
        const px = (cx + dx + r()) * MOSAIC_CELL - x, pz = (cz + dz + r()) * MOSAIC_CELL - z, d = px * px + pz * pz;
        if (d < best) { best = d; pick = MOSAIC_COLORS[Math.floor(r() * MOSAIC_COLORS.length)]; }
      }
      return pick;
    };
    const put = (wx, y, wz, id) => {
      const lx = wx - x0, lz = wz - z0;
      if (lx < 0 || lx >= CS || lz < 0 || lz >= CS || y < 1 || y >= H) return;
      const i = idx(lx, y, lz), cur = blocks[i];
      if (isLeaf(id)) { if (cur === B.AIR || cur === B.TALL_GRASS) blocks[i] = id; }
      else if (cur === B.AIR || isLeaf(cur) || cur === B.TALL_GRASS || cur === B.SNOW || cur === B.GRASS || cur === B.DIRT) blocks[i] = id;
    };
    const ground = (wx, y, wz) => {   // the grass under a trunk becomes dirt
      const lx = wx - x0, lz = wz - z0;
      if (lx >= 0 && lx < CS && lz >= 0 && lz < CS && blocks[idx(lx, y, lz)] === B.GRASS) blocks[idx(lx, y, lz)] = B.DIRT;
    };
    const G = 3;
    const gx0 = Math.floor((x0 - 6) / G), gx1 = Math.floor((x0 + CS + 5) / G);
    const gz0 = Math.floor((z0 - 6) / G), gz1 = Math.floor((z0 + CS + 5) / G);
    for (let gz = gz0; gz <= gz1; gz++) for (let gx = gx0; gx <= gx1; gx++) {
      const rng = mulberry32(hash3(SEED ^ 0x7aee, gx, gz));
      const tx = gx * G + Math.floor(rng() * G), tz = gz * G + Math.floor(rng() * G);
      const lx = tx - x0, lz = tz - z0;
      if (lx < -6 || lx > CS + 5 || lz < -6 || lz > CS + 5) continue;
      const c = col(lx, lz);
      // A pink patch in plains is a grove: the tree chance rises from the plains value at the patch
      // edge (n 0.4) to PINK_GROVE_CHANCE at n 0.6. The rng draw is unchanged, so older trees stay.
      const pinkN = c.biome === BIOME.PLAINS ? NPink.n2(tx / 90, tz / 90) : -1;
      const chance = pinkN > 0.4 ? lerp(TREE_CHANCE[c.biome], PINK_GROVE_CHANCE, smoothstep(0.4, 0.6, pinkN)) : TREE_CHANCE[c.biome];
      if (!(rng() < chance)) continue;
      if (c.oh > 0 || c.entr > 0.4 || c.riverK > 0.05 || c.h < SEA + 1 || c.h > H - 20) continue;
      if (slope(lx, lz) >= 2) continue;
      const y0 = c.h + 1;
      const kind = rng();
      const snowy = c.biome === BIOME.SNOWY_PLAINS || c.biome === BIOME.SNOWY_MOUNTAINS;
      const hue = hashF(SEED ^ 0x1eaf, tx, tz);
      let leaf = snowy ? B.LEAVES_WHITE : B.LEAVES, shape = 'oak';
      if (snowy || (c.biome === BIOME.HIGHLANDS && kind < 0.5)) shape = 'spruce';
      else if (c.biome === BIOME.RAINFOREST && kind < 0.18 && (gx & 1) === 0 && (gz & 1) === 0) shape = 'giant';
      else if (c.biome === BIOME.RAINFOREST) shape = 'jungle';
      else if (pinkN > 0.4) leaf = B.LEAVES_PINK;
      else if (c.biome === BIOME.FOREST) {
        leaf = hue < MOSAIC_STRAY ? MOSAIC_COLORS[Math.floor(hue / MOSAIC_STRAY * MOSAIC_COLORS.length)] : mosaicColor(tx, tz);
      } else if (hue >= 0.7) leaf = OAK_COLORS[Math.min(3, Math.floor((hue - 0.7) / 0.075))];
      buildTree(shape, tx, y0, tz, rng, leaf, kind < 0.2, put, ground);
    }

    // 8. ground plants and cacti (in-chunk only)
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const c = col(x, z), h = c.h;
      if (h + 4 >= H) continue;
      const below = blocks[idx(x, h, z)], above = blocks[idx(x, h + 1, z)];
      if (above !== B.AIR) continue;
      const r = hashF(x0 + x, 777, z0 + z);
      if (below === B.SAND && c.biome === BIOME.DESERT) {
        if (r < 0.006) {
          const ch = 1 + Math.floor(hashF(x0 + x, 778, z0 + z) * 3);
          for (let y = 1; y <= ch; y++) blocks[idx(x, h + y, z)] = B.CACTUS;
        }
      } else if (below === B.GRASS) {
        const grassP = c.biome === BIOME.PLAINS ? 0.22 : c.biome === BIOME.RAINFOREST ? 0.3 : 0.1;
        if (r < 0.012) blocks[idx(x, h + 1, z)] = hashF(x0 + x, 779, z0 + z) < 0.5 ? B.ROSE : B.DANDELION;
        else if (r < 0.012 + grassP) blocks[idx(x, h + 1, z)] = B.TALL_GRASS;
      }
    }

    // 9. structures, deepest first, so a surface ruin wins over a corridor below it
    const features = [], S = structCtx(x0, z0, blocks, col, features);
    stampMineshafts(S);
    stampDungeon(cx, cz, S, info);
    stampTemple(cx, cz, S);
    stampTower(cx, cz, S);

    // heightmap: highest non-air block per column
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      let y = H - 1;
      while (y > 0 && blocks[idx(x, y, z)] === B.AIR) y--;
      heights[z * CS + x] = y;
    }
    return { blocks, biomes, heights, features };
  }

  // ---------------------------------------------------------------- Ember Realm (SPEC_realms Phase 2)
  // An enclosed cave world. y 0 is bedrock. The bedrock roof fills y 124 up and hangs down to
  // y 116 in bumps. Between them, a density field carves the caves: 3D noise plus a pull to rock
  // under a floor height and over a ceiling height (2D noise each). The field is sampled on a
  // 4-block grid and interpolated. Open cells at y 31 and below hold lava (the lava sea).
  // Ash Sand covers floor patches near the sea. Ember Lamps hang in clusters from ceilings.
  // Emberite Ore: about 1 vein per 2 chunks, 1..3 cells, y 8..110, only in Ember Rock.
  // The noises take their own seeds: a new S() call would change every overworld noise.
  const EMBER_ROOF = 124, EMBER_HANG = 8, EMBER_SEA = 31, EG = 4, EGY = EMBER_ROOF / EG;
  const EN = (k) => Simplex(hash3(SEED ^ 0xe3be5, k, 77));
  const EA = EN(1), EB = EN(2), EF = EN(3), EC = EN(4), ER = EN(5), EP = EN(6);
  // Density at one point: > 0 is rock.
  function emberSample(x, y, z) {
    const floor = 20 + fbm(EF, x / 90, z / 90, 2) * 18, ceil = 106 + fbm(EC, x / 80, z / 80, 2) * 22;
    let d = EA.n3(x / 64, y / 40, z / 64) * 0.62 + EB.n3(x / 22, y / 16, z / 22) * 0.3 - 0.1;
    if (y < floor) d += (floor - y) / 5;
    if (y > ceil) d += (y - ceil) / 7;
    return d;
  }
  // The interpolated density at cell (x, y, z), as emberChunk computes it. For cells off the chunk.
  function emberDensity(x, y, z) {
    const gx = Math.floor(x / EG), gy = y >> 2, gz = Math.floor(z / EG);
    const fx = (x - gx * EG) / EG, fy = (y & 3) / EG, fz = (z - gz * EG) / EG;
    const c = (i, j, k) => emberSample((gx + i) * EG, (gy + j) * EG, (gz + k) * EG);
    return lerp(lerp(lerp(c(0, 0, 0), c(1, 0, 0), fx), lerp(c(0, 0, 1), c(1, 0, 1), fx), fz),
      lerp(lerp(c(0, 1, 0), c(1, 1, 0), fx), lerp(c(0, 1, 1), c(1, 1, 1), fx), fz), fy);
  }
  // Bedrock bump of column (x, z): 0..EMBER_HANG cells below the roof.
  const emberBump = (x, z) => Math.floor(smoothstep(0.05, 0.75, ER.n2(x / 16, z / 16) * 0.75 + ER.n2(x / 5, z / 5) * 0.25) * (EMBER_HANG + 0.99));

  // ---------------------------------------------------------------- Ember Fortress (SPEC_realms Phase 4)
  // Each cell of the FT_GRID grid holds one fortress. Terms used below:
  //   - keep: a 13 x 13 room of Ember Bricks around (kx, kz). The floor is at y, the walls fill
  //     y + 1..y + 5, and the roof is at y + 6. It holds the knight spawner and the heart chest.
  //   - bridge: a deck 7 wide at y (5 to walk, plus a rail at y + 1 on each side). It leaves the keep
  //     through a door in direction d and runs `len` cells (t = 0..len - 1). Its end room fills
  //     t = len..len + 6 and holds a chest when `chest` is true.
  //   - (t, w): a bridge cell. t counts along the bridge from the keep wall, w across it (-3..3).
  // The keep centre sits at cell offset 40 or 55 on each axis: x follows the parity of gz, and z the
  // parity of gx. A fortress reaches 77 cells from its keep centre. With this layout, no part of one
  // fortress shares a column with a part of another, so the stamp order does not matter.
  // The floor height y is the candidate (40..84) with the most open cells along the 4 axes.
  // fortressPlan(gx, gz) is pure. A memo keeps the plans, because each chunk asks for 4 to 9 of them.
  const FT_GRID = 96, FT_REACH = 78, FT_OFF = [40, 55];
  const ftMemo = new Map();
  function fortressPlan(gx, gz) {
    const key = `${gx},${gz}`;
    let plan = ftMemo.get(key);
    if (plan) return plan;
    const r = mulberry32(hash3(SEED ^ 0xf0275, gx, gz));
    const kx = gx * FT_GRID + FT_OFF[gz & 1], kz = gz * FT_GRID + FT_OFF[gx & 1];
    let y = 40, best = -1;
    for (let cy = 40; cy <= 84; cy += 4) {
      let open = 0;
      for (const [ux, uz] of D4) for (let d = 0; d <= 60; d += 12) for (const dy of [1, 4]) {
        if (emberSample(kx + ux * d, cy + dy, kz + uz * d) <= 0) open++;
      }
      if (open > best) { best = open; y = cy; }
    }
    const dirs = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [dirs[i], dirs[j]] = [dirs[j], dirs[i]]; }
    const n = 2 + Math.floor(r() * 3), bridges = [];
    for (let k = 0; k < n; k++) bridges.push({ d: dirs[k], len: 32 + Math.floor(r() * 33), chest: r() < 0.5 });
    plan = { gx, gz, kx, kz, y, bridges };
    if (ftMemo.size > 4096) ftMemo.clear();
    ftMemo.set(key, plan);
    return plan;
  }
  // The world cell of bridge cell (t, w).
  const bridgeCell = (P, b, t, w) => {
    const [ux, uz] = D4[b.d];
    return [P.kx + ux * (7 + t) - uz * w, P.kz + uz * (7 + t) + ux * w];
  };
  // The plan boxes of a fortress: [x0, y0, z0, x1, y1, z1], inclusive. Box 0 is the keep.
  function fortressBoxes(P) {
    const boxes = [[P.kx - 6, P.y, P.kz - 6, P.kx + 6, P.y + 6, P.kz + 6]];
    for (const b of P.bridges) {
      const [ax, az] = bridgeCell(P, b, 0, -3), [bx, bz] = bridgeCell(P, b, b.len + 6, 3);
      boxes.push([Math.min(ax, bx), P.y, Math.min(az, bz), Math.max(ax, bx), P.y + 5, Math.max(az, bz)]);
    }
    return boxes;
  }
  // The plans of every fortress whose reach covers the box x0..x1, z0..z1.
  function fortressesNear(x0, z0, x1, z1) {
    const out = [];
    const gxa = Math.floor((x0 - 55 - FT_REACH) / FT_GRID), gxb = Math.floor((x1 - 40 + FT_REACH) / FT_GRID);
    const gza = Math.floor((z0 - 55 - FT_REACH) / FT_GRID), gzb = Math.floor((z1 - 40 + FT_REACH) / FT_GRID);
    for (let gz = gza; gz <= gzb; gz++) for (let gx = gxa; gx <= gxb; gx++) out.push(fortressPlan(gx, gz));
    return out;
  }
  // True when cell (x, y, z) lies inside a fortress box (Ember Realm coordinates).
  function inFortress(x, y, z) {
    for (const P of fortressesNear(x, z, x, z)) {
      for (const [ax, ay, az, bx, by, bz] of fortressBoxes(P)) if (x >= ax && x <= bx && y >= ay && y <= by && z >= az && z <= bz) return true;
    }
    return false;
  }
  function stampFortresses(S) {
    const { x0, z0 } = S;
    const at = (x, y, z, id) => S.set(x - x0, y, z - z0, id);
    // A pillar: brick from y0 down through air and lamps. It stops at rock, at the lava, or at y 1.
    const pillar = (x, y0, z) => {
      const lx = x - x0, lz = z - z0;
      if (!S.inside(lx, lz)) return;
      for (let y = y0; y > 0 && (S.get(lx, y, lz) === B.AIR || S.get(lx, y, lz) === B.EMBER_LAMP); y--) S.set(lx, y, lz, B.EMBER_BRICKS);
    };
    for (const P of fortressesNear(x0, z0, x0 + CS - 1, z0 + CS - 1)) {
      const boxes = fortressBoxes(P), y = P.y;
      if (!boxes.some((b) => b[3] >= x0 && b[0] <= x0 + CS - 1 && b[5] >= z0 && b[2] <= z0 + CS - 1)) continue;
      // the keep: a brick shell with air inside
      for (let dz = -6; dz <= 6; dz++) for (let dx = -6; dx <= 6; dx++) {
        const x = P.kx + dx, z = P.kz + dz, wall = Math.abs(dx) === 6 || Math.abs(dz) === 6;
        if (!S.inside(x - x0, z - z0)) continue;
        for (let k = 0; k <= 6; k++) at(x, y + k, z, k === 0 || k === 6 || wall ? B.EMBER_BRICKS : B.AIR);
      }
      for (const b of P.bridges) {
        const [ux, uz] = D4[b.d];
        for (let w = -1; w <= 1; w++) for (let k = 1; k <= 3; k++) at(P.kx + ux * 6 - uz * w, y + k, P.kz + uz * 6 + ux * w, B.AIR);   // keep door
        for (let t = 0; t < b.len + 7; t++) for (let w = -3; w <= 3; w++) {
          const [x, z] = bridgeCell(P, b, t, w);
          if (!S.inside(x - x0, z - z0)) continue;
          at(x, y, z, B.EMBER_BRICKS);
          if (t < b.len) {   // the deck: rails at the edges, air above the walkway
            if (Math.abs(w) === 3) at(x, y + 1, z, B.EMBER_BRICKS);
            else for (let k = 1; k <= 4; k++) at(x, y + k, z, B.AIR);
          } else {           // the end room: a shell 7 x 7 x 6 with a door in the near wall
            const wall = t === b.len || t === b.len + 6 || Math.abs(w) === 3, door = t === b.len && Math.abs(w) <= 1;
            for (let k = 1; k <= 5; k++) at(x, y + k, z, k === 5 || (wall && !(door && k <= 3)) ? B.EMBER_BRICKS : B.AIR);
          }
        }
        // pillars: every 8 cells under the walkway centre, and at the room corners
        for (let t = 4; t < b.len; t += 8) for (let w = -1; w <= 1; w++) { const [x, z] = bridgeCell(P, b, t, w); pillar(x, y - 1, z); }
        for (const t of [b.len, b.len + 6]) for (const w of [-3, 3]) { const [x, z] = bridgeCell(P, b, t, w); pillar(x, y - 1, z); }
        if (b.chest) {
          const [x, z] = bridgeCell(P, b, b.len + 5, 0), lx = x - x0, lz = z - z0;
          if (S.inside(lx, lz)) { S.set(lx, y + 1, lz, B.CHEST + dirOf(-ux, -uz)); S.feature('chest', lx, y + 1, lz, 'fortress'); }
        }
      }
      for (const dx of [-6, -5, 0, 5, 6]) for (const dz of [-6, -5, 0, 5, 6]) {
        if ((dx === 0) !== (dz === 0) || Math.abs(dx) + Math.abs(dz) >= 5) pillar(P.kx + dx, y - 1, P.kz + dz);
      }
      // the keep contents: the spawner at the centre, the heart chest in the -x -z corner
      const sx = P.kx - x0, sz = P.kz - z0;
      if (S.inside(sx, sz)) { S.set(sx, y + 1, sz, B.SPAWNER); S.feature('spawner', sx, y + 1, sz, 'knight'); }
      if (S.inside(sx - 4, sz - 4)) { S.set(sx - 4, y + 1, sz - 4, B.CHEST + dirOf(1, 0)); S.feature('chest', sx - 4, y + 1, sz - 4, 'heart'); }
    }
  }

  function emberChunk(cx, cz) {
    const x0 = cx * CS, z0 = cz * CS;
    const blocks = new Uint8Array(CS * CS * H), biomes = new Uint8Array(CS * CS), heights = new Uint8Array(CS * CS);
    const idx = (x, y, z) => (y << 8) | (z << 4) | x;
    // 1. density grid: (CS / EG + 1)^2 columns of EGY + 1 samples
    const NG = CS / EG + 1, NY = EGY + 1, grid = new Float32Array(NG * NG * NY);
    for (let gz = 0; gz < NG; gz++) for (let gx = 0; gx < NG; gx++) for (let gy = 0; gy < NY; gy++)
      grid[(gz * NG + gx) * NY + gy] = emberSample(x0 + gx * EG, gy * EG, z0 + gz * EG);
    const g = (gx, gy, gz) => grid[(gz * NG + gx) * NY + gy];
    // 2. rock, lava, air, and bedrock
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const gx = x >> 2, gz = z >> 2, fx = (x & 3) / EG, fz = (z & 3) / EG, roof = EMBER_ROOF - emberBump(x0 + x, z0 + z);
      for (let y = 0; y < H; y++) {
        let id;
        if (y === 0 || y >= roof) id = B.BEDROCK;
        else {
          const gy = y >> 2, fy = (y & 3) / EG;
          const d = lerp(lerp(lerp(g(gx, gy, gz), g(gx + 1, gy, gz), fx), lerp(g(gx, gy, gz + 1), g(gx + 1, gy, gz + 1), fx), fz),
            lerp(lerp(g(gx, gy + 1, gz), g(gx + 1, gy + 1, gz), fx), lerp(g(gx, gy + 1, gz + 1), g(gx + 1, gy + 1, gz + 1), fx), fz), fy);
          id = d > 0 ? B.EMBER_ROCK : y <= EMBER_SEA ? B.LAVA : B.AIR;
        }
        blocks[idx(x, y, z)] = id;
      }
    }
    // 3. Ash Sand: a floor cell at y 32..44 (rock under air) in an ash patch turns to ash, 1..3 deep
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = x0 + x, wz = z0 + z;
      if (EP.n2(wx / 26, wz / 26) + EP.n2(wx / 7, wz / 7) * 0.25 < 0.12) continue;
      for (let y = EMBER_SEA + 1; y <= EMBER_SEA + 13; y++) {
        if (blocks[idx(x, y, z)] !== B.EMBER_ROCK || blocks[idx(x, y + 1, z)] !== B.AIR) continue;
        const deep = 1 + Math.floor(hashF(SEED ^ 0xa54, wx, wz) * 3);
        for (let k = 0; k < deep && blocks[idx(x, y - k, z)] === B.EMBER_ROCK; k++) blocks[idx(x, y - k, z)] = B.ASH_SAND;
      }
    }
    // 4. Ember Lamps: patch centres from the 3x3 chunk neighbourhood. An air cell near a centre
    //    under a ceiling (rock or bedrock) takes a lamp when a world hash passes. A lamp may drip:
    //    the air cell under a lamp takes one more on a second hash. Top-down, so drips chain.
    const LAMP_PATCHES = 3, LAMP_DENSITY = 0.75, LAMP_DRIP = 0.45;
    const ceilAt = (i) => blocks[i] === B.EMBER_ROCK || blocks[i] === B.BEDROCK;
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const r = mulberry32(hash3(SEED ^ 0x1a3b, ncx, ncz));
      for (let n = 0; n < LAMP_PATCHES; n++) {
        const px = ncx * CS + Math.floor(r() * CS), py = 44 + Math.floor(r() * 76), pz = ncz * CS + Math.floor(r() * CS);
        const R = 4 + Math.floor(r() * 3);
        for (let y = Math.min(EMBER_ROOF - 1, py + R); y >= Math.max(EMBER_SEA + 2, py - R); y--)
          for (let lz = Math.max(0, pz - R - z0); lz <= Math.min(CS - 1, pz + R - z0); lz++)
            for (let lx = Math.max(0, px - R - x0); lx <= Math.min(CS - 1, px + R - x0); lx++) {
              const wx = x0 + lx, wz = z0 + lz, d = Math.hypot(wx - px, y - py, wz - pz), i = idx(lx, y, lz);
              if (d > R || blocks[i] !== B.AIR) continue;
              const up = idx(lx, y + 1, lz);
              if (ceilAt(up) ? hashF(SEED ^ 0x1a4c, wx * 31 + y, wz) < LAMP_DENSITY * (1 - d / (R + 1))
                : blocks[up] === B.EMBER_LAMP && hashF(SEED ^ 0x1a5d, wx, y * 131 + wz) < LAMP_DRIP) blocks[i] = B.EMBER_LAMP;
            }
      }
    }
    // 5. Emberite Ore: a neighbour chunk holds a vein 1 time in 2. The start is the first of
    //    8 tries that the density field calls rock. The vein walks 1..3 cells and takes only
    //    Ember Rock cells of this chunk.
    for (let ncz = cz - 1; ncz <= cz + 1; ncz++) for (let ncx = cx - 1; ncx <= cx + 1; ncx++) {
      const r = mulberry32(hash3(SEED ^ 0xe3b0, ncx, ncz));
      if (r() >= 0.5) continue;
      let x = 0, y = 0, z = 0, ok = false;
      for (let t = 0; t < 8 && !ok; t++) {
        x = ncx * CS + Math.floor(r() * CS); y = 8 + Math.floor(r() * 103); z = ncz * CS + Math.floor(r() * CS);
        ok = emberDensity(x, y, z) > 0;
      }
      if (!ok) continue;
      const size = 1 + Math.floor(r() * 3);
      for (let s = 0; s < size; s++) {
        const lx = x - x0, lz = z - z0;
        if (lx >= 0 && lx < CS && lz >= 0 && lz < CS && blocks[idx(lx, y, lz)] === B.EMBER_ROCK) blocks[idx(lx, y, lz)] = B.EMBERITE_ORE;
        const d = Math.floor(r() * 6);
        if (d === 0) x++; else if (d === 1) x--; else if (d === 2) z++; else if (d === 3) z--; else if (d === 4 && y < 110) y++; else if (y > 8) y--;
      }
    }
    // 6. Ember Fortresses
    const features = [];
    stampFortresses(structCtx(x0, z0, blocks, null, features));
    heights.fill(H - 1);   // the roof tops every column
    return { blocks, biomes, heights, features };
  }

  // ---------------------------------------------------------------- crystal stub (SPEC_realms Phase 1)
  // One stone disc of radius 44 at the origin, y 90 to 96, over a void. Phase 5 replaces it.
  const CRYSTAL_TOP = 96, CRYSTAL_R = 44;
  function stubChunk(cx, cz) {
    const blocks = new Uint8Array(CS * CS * H);
    const biomes = new Uint8Array(CS * CS), heights = new Uint8Array(CS * CS);
    for (let z = 0; z < CS; z++) for (let x = 0; x < CS; x++) {
      const wx = cx * CS + x, wz = cz * CS + z;
      if (wx * wx + wz * wz > CRYSTAL_R * CRYSTAL_R) continue;
      for (let y = CRYSTAL_TOP - 6; y <= CRYSTAL_TOP; y++) blocks[(y << 8) | (z << 4) | x] = B.STONE;
      heights[z * CS + x] = CRYSTAL_TOP;
    }
    return { blocks, biomes, heights, features: [] };
  }
  function generateChunk(cx, cz, realm = 'overworld', info) {
    return realm === 'ember' ? emberChunk(cx, cz) : realm === 'crystal' ? stubChunk(cx, cz) : overworldChunk(cx, cz, info);
  }

  return { column, generateChunk, growTree, hash3, SNOW_LINE, mineshaftPlan, dungeonPlan, fortressPlan, fortressBoxes, inFortress, FT_GRID };
}

export { WorldGenModule };
