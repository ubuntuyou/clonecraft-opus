// ---- clouds: the shared cloud density field (G5) ---------------------------------------------
// The clouds are one flat layer at CLOUD_Y. Their density at a world point (x, z) is a function of
// one noise texture, three scroll offsets, and the coverage. This module owns all of it, so the sky
// (the cloud layer), the terrain shader (cloud shadows), and the light shafts read the same clouds.
//   - The texture is baked once at startup: 256², tiling, mipmapped. R is fractal value noise (the
//     cloud shapes, 1024 blocks per tile). G is inverted cell noise (billows that erode the edges).
//   - GLSL `cloudDensity(xz)` gives 0 (open sky) .. 1 (thick cloud). Two reads of R scroll at
//     different speeds, so the shapes change as they drift. One read of G roughens the edges.
//   - `clouds.advance(dt, k, storm)` moves the wind (+x) and sets the coverage from the weather.
//   - `clouds.densityAt(x, z)` is the same function on the CPU, for tests.
// The module is pure (three and config only), so terrain-material can import it.
import { THREE } from './three.js';
import { mulberry32, SEA, SEED } from './config.js';

const CLOUD_Y = SEA + 64;                     // y of the layer (192)
const N = 256, TILE = 1024, DETAIL = 6, MORPH = 1.37;
const WIND = 1.6;                              // blocks per second along +x
const COVER_CLEAR = 0.53, COVER_RAIN = 0.76, COVER_STORM = 0.95;   // about 37 %, 96 %, and 100 % of the sky

const data = new Uint8Array(N * N * 4);
(function bake() {
  const rng = mulberry32(SEED ^ 0xc10d5);
  // R: tiling value noise, 6 octaves from 4 to 128 cells per tile, quintic fade. The 8-cell octave
  // (128 blocks) is the strongest, so single clouds are about 50-150 blocks wide. The 4-cell octave
  // makes regions of more and fewer clouds.
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const r = new Float32Array(N * N);
  const AMP = { 4: 0.6, 8: 1, 16: 0.6, 32: 0.3, 64: 0.15, 128: 0.08 };
  for (let L = 4; L <= 128; L *= 2) {
    const amp = AMP[L];
    const g = new Float32Array(L * L).map(() => rng());
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N * L, v = j / N * L, x0 = Math.floor(u), y0 = Math.floor(v);
      const fx = fade(u - x0), fy = fade(v - y0), x1 = (x0 + 1) % L, y1 = (y0 + 1) % L;
      const a = g[y0 * L + x0], b = g[y0 * L + x1], c = g[y1 * L + x0], d = g[y1 * L + x1];
      r[j * N + i] += amp * ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy);
    }
  }
  // G: tiling cell noise (one jittered point per cell), 1 - distance to the nearest point; two octaves
  const g = new Float32Array(N * N);
  for (const [C, w] of [[12, 0.65], [24, 0.35]]) {
    const px = new Float32Array(C * C).map(() => rng()), py = new Float32Array(C * C).map(() => rng());
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const u = i / N * C, v = j / N * C, cx = Math.floor(u), cy = Math.floor(v);
      let best = 9;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = cx + dx, qy = cy + dy, k = ((qy + C) % C) * C + ((qx + C) % C);
        best = Math.min(best, Math.hypot(qx + px[k] - u, qy + py[k] - v));
      }
      g[j * N + i] += w * Math.max(0, 1 - best);
    }
  }
  const norm = (f) => { let lo = Infinity, hi = -Infinity; for (const x of f) { lo = Math.min(lo, x); hi = Math.max(hi, x); } return (x) => (x - lo) / (hi - lo); };
  const nr = norm(r), ng = norm(g);
  for (let o = 0; o < N * N; o++) {
    data[o * 4] = Math.round(nr(r[o]) * 255); data[o * 4 + 1] = Math.round(ng(g[o]) * 255);
    data[o * 4 + 2] = 0; data[o * 4 + 3] = 255;
  }
})();

const cloudTexture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;
cloudTexture.magFilter = THREE.LinearFilter; cloudTexture.minFilter = THREE.LinearMipmapLinearFilter;
cloudTexture.anisotropy = 8;   // three clamps it to the GPU maximum; keeps far clouds sharp at a slant
cloudTexture.generateMipmaps = true; cloudTexture.needsUpdate = true;

// Shared uniform objects: each material that reads the clouds spreads these into its own uniforms.
const cloudUniforms = {
  uCloudTex: { value: cloudTexture },
  uCloudOff: { value: new THREE.Vector4() },     // xy: shape read, zw: morph read (texture units)
  uCloudDetOff: { value: new THREE.Vector2() },  // billow read
  uCloudCover: { value: COVER_CLEAR },           // 0 none .. 1 overcast
};

const CLOUD_GLSL = /* glsl */`
  uniform sampler2D uCloudTex; uniform vec4 uCloudOff; uniform vec2 uCloudDetOff; uniform float uCloudCover;
  const float CLOUD_Y = ${CLOUD_Y.toFixed(1)};
  float cloudDensity(vec2 xz) {
    vec2 p = xz / ${TILE.toFixed(1)};
    float n = texture2D(uCloudTex, p - uCloudOff.xy).r * 0.68 + texture2D(uCloudTex, p * ${MORPH} - uCloudOff.zw).r * 0.32;
    n -= (1.0 - texture2D(uCloudTex, p * ${DETAIL.toFixed(1)} - uCloudDetOff).g) * 0.12;
    float lo = 1.0 - uCloudCover;
    return smoothstep(lo, lo + 0.2, n);
  }`;

const clouds = (() => {
  let drift = 0, t = 0;
  const off = cloudUniforms.uCloudOff.value, det = cloudUniforms.uCloudDetOff.value;
  const fr = (x) => x - Math.floor(x);
  // k: rain 0..1, storm: 0..1 (weather.k and weather.storm)
  function advance(dt, k, storm) {
    drift += dt * WIND; t += dt;
    off.set(fr(drift / TILE), 0, fr(drift * 0.8 * MORPH / TILE), fr(t * 0.35 * MORPH / TILE));
    det.set(fr(drift * 1.15 * DETAIL / TILE), fr(t * 0.2 * DETAIL / TILE));
    const c = COVER_CLEAR + (COVER_RAIN - COVER_CLEAR) * k;
    cloudUniforms.uCloudCover.value = c + (COVER_STORM - COVER_RAIN) * storm;
  }
  // Bilinear read of one channel with repeat wrap (the GPU also blends mip levels far away).
  function tex(u, v, ch) {
    const x = fr(u) * N - 0.5, y = fr(v) * N - 0.5, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
    const at = (i, j) => data[(((j + N) % N) * N + ((i + N) % N)) * 4 + ch] / 255;
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy) + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  }
  function densityAt(x, z) {
    const px = x / TILE, pz = z / TILE;
    let n = tex(px - off.x, pz - off.y, 0) * 0.68 + tex(px * MORPH - off.z, pz * MORPH - off.w, 0) * 0.32;
    n -= (1 - tex(px * DETAIL - det.x, pz * DETAIL - det.y, 1)) * 0.12;
    const lo = 1 - cloudUniforms.uCloudCover.value;
    return THREE.MathUtils.smoothstep(n, lo, lo + 0.2);
  }
  return { advance, densityAt, get cover() { return cloudUniforms.uCloudCover.value; } };
})();

export { CLOUD_GLSL, CLOUD_Y, clouds, cloudUniforms };
