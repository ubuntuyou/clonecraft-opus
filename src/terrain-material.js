/* ---- terrain materials: custom shader with baked light, day scaling, fog ---------- */
import { THREE } from './three.js';
import { mulberry32 } from './config.js';
import { atlasTexture } from './atlas.js';
import { CLOUD_GLSL, cloudUniforms } from './clouds.js';

const terrainUniforms = {
  map: { value: atlasTexture },
  uDaylight: { value: 1 },
  uSkyLight: { value: new THREE.Color(1, 1, 1) },
  uAmbient: { value: new THREE.Color(0, 0, 0) },                           // realm light floor (sky.js; the Ember Realm)
  uTorch: { value: 1 },
  uFogColor: { value: new THREE.Color(0.6, 0.75, 1) },
  uFogNear: { value: 80 }, uFogFar: { value: 120 },
  uTime: { value: 0 },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunAmt: { value: 0 },   // directional sun (or moon) term
  uGlow: { value: 1 },                                                     // glowGain: HDR boost of the water glint
  // G3 shadows (`shadows` module): depth map from the sun or moon, world -> shadow clip matrix, on/off
  uShadowMap: { value: null }, uShadowMat: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowBias: { value: 0.0003 },
  uShadowTexel: { value: 1 / 2048 }, uShadowSoft: { value: 1 },
  // G4 held torch (`heldLight` module): 32^3 light levels around the head, world origin of cell 0, on/off
  uHeld: { value: null }, uHeldOrigin: { value: new THREE.Vector3() }, uHeldOn: { value: 0 },
  uWet: { value: 0 },                                                      // weather wetness 0..1
  uCaus: { value: null }, uRipple: { value: null },                        // baked water patterns (bakeWaterPatterns)
  ...cloudUniforms,                                                        // G5 cloud shadows (`clouds` module)
};

// P1: the caustic network and the ripple normals are baked once into small tiling textures, so the
// water and the sea floor read two scrolled texels each instead of evaluating trig per pixel.
(function bakeWaterPatterns() {
  const N = 256, rng = mulberry32(0x5eab1e);
  const tex = (data) => {
    const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.UnsignedByteType);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  // caustics: bright edges of a wrapped Voronoi pattern, warped by periodic waves so the lines curve
  const P = 22, px = [], py = [];
  for (let i = 0; i < P; i++) { px.push(rng()); py.push(rng()); }
  const caus = new Uint8Array(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let u = i / N, v = j / N;
    const wu = u + 0.035 * Math.sin(6.2832 * (2 * v + u)), wv = v + 0.035 * Math.sin(6.2832 * (3 * u - v));
    let d1 = 9, d2 = 9;
    for (let k = 0; k < P; k++) {
      let dx = Math.abs(wu - px[k]) % 1; dx = Math.min(dx, 1 - dx);
      let dy = Math.abs(wv - py[k]) % 1; dy = Math.min(dy, 1 - dy);
      const d = Math.hypot(dx, dy);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    const e = Math.exp(-(d2 - d1) * 38);
    const o = (j * N + i) * 4;
    caus[o] = caus[o + 1] = caus[o + 2] = Math.round(Math.min(1, e) * 255); caus[o + 3] = 255;
  }
  // ripples: gradient of a sum of sines with whole-number wave vectors (tiles exactly); RG = slope
  const W = [];
  while (W.length < 10) {
    const kx = Math.round(rng() * 18 - 9), ky = Math.round(rng() * 18 - 9), k = Math.hypot(kx, ky);
    if (k >= 3 && k <= 9) W.push([kx, ky, 1 / k, rng() * 6.2832]);
  }
  const gx = new Float32Array(N * N), gy = new Float32Array(N * N);
  let gmax = 1e-6;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    let sx = 0, sy = 0;
    for (const [kx, ky, a, ph] of W) { const c = a * Math.cos(6.2832 * (kx * i / N + ky * j / N) + ph); sx += c * kx; sy += c * ky; }
    const o = j * N + i; gx[o] = sx; gy[o] = sy; gmax = Math.max(gmax, Math.abs(sx), Math.abs(sy));
  }
  const rip = new Uint8Array(N * N * 4);
  for (let o = 0; o < N * N; o++) { rip[o * 4] = Math.round((gx[o] / gmax * 0.5 + 0.5) * 255); rip[o * 4 + 1] = Math.round((gy[o] / gmax * 0.5 + 0.5) * 255); rip[o * 4 + 2] = 128; rip[o * 4 + 3] = 255; }
  terrainUniforms.uCaus.value = tex(caus);
  terrainUniforms.uRipple.value = tex(rip);
})();
const TERRAIN_VS = /* glsl */`
  // MSAA runs an edge pixel's shader at the pixel centre, which can lie outside the triangle. Plain
  // varyings then extrapolate: vUv leaves its atlas tile and samples a bright neighbour tile (flashes on
  // distant faces). Centroid sampling keeps vUv, vLight, and vCry inside the triangle. WebGL 1 has no
  // centroid; it has no MSAA here either.
  #if __VERSION__ >= 300
  #define CENTROID centroid
  #else
  #define CENTROID
  #endif
  attribute vec2 aUv; attribute vec4 aLight; attribute vec4 aTint; attribute float aCry;
  CENTROID varying vec2 vUv; CENTROID varying vec4 vLight; varying vec3 vTint; varying float vDist; varying vec3 vWorld; varying float vGlow;
  CENTROID varying float vCry; varying float vCrystal; varying float vWet; varying float vPortal;
  uniform float uTime;
  void main() {
    vPortal = step(0.6, aTint.a) * step(aTint.a, 0.66) + 2.0 * step(0.665, aTint.a) * step(aTint.a, 0.69);   // pane: 1 ember (160), 2 crystal (172)
    vUv = aUv / 4096.0; vLight = aLight; vTint = aTint.rgb; vCry = aCry;
    vCrystal = step(0.88, aTint.a) * step(aTint.a, 0.94);                                // crystal faces glow
    vGlow = step(0.7, aTint.a) * step(aTint.a, 0.85) * (aTint.a > 0.82 ? 0.5 : 1.0);   // 1 glow, 0.5 soft glow
    vWet = step(0.955, aTint.a) * step(aTint.a, 0.975);                                   // WET_ALPHA 246: caustics
    vec3 p = position;
    vec4 wp = modelMatrix * vec4(p, 1.0);
    #ifdef WATER
      if (aLight.w > 0.99) p.y += (sin(wp.x * 1.3 + uTime * 1.7) + sin(wp.z * 1.1 + uTime * 1.3)) * 0.35 - 0.7;
    #else
      // wind sway (position is in 1/16 block units): leaves up to 1/32 block, plant tops 1/10
      float sw = aTint.a < 0.6 ? 1.0 - aTint.a : 0.0;
      if (sw > 0.01) {
        float ph = uTime * 1.6 + wp.x * 0.35 + wp.z * 0.25;
        float gust = 0.65 + 0.35 * sin(uTime * 0.37 + wp.x * 0.05);
        float amt = (sw > 0.75 ? 1.6 : 0.5) * gust;
        p.x += sin(ph) * amt;
        p.z += sin(ph * 0.8 + 1.7) * amt * 0.7;
        p.y += sin(ph * 1.3 + wp.z) * amt * 0.25 * step(sw, 0.75);
      }
    #endif
    vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vDist = length(mv.xyz);
    gl_Position = projectionMatrix * mv;
  }`;
const TERRAIN_FS = /* glsl */`
  uniform sampler2D map; uniform float uDaylight; uniform vec3 uSkyLight; uniform vec3 uAmbient; uniform float uTorch; uniform float uTime;
  uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar; uniform vec3 uSunDir; uniform float uSunAmt; uniform float uGlow;
  uniform highp sampler2DShadow uShadowMap; uniform mat4 uShadowMat; uniform float uShadowOn; uniform float uShadowBias; uniform float uShadowTexel; uniform float uShadowSoft;
  uniform sampler2D uCaus; uniform sampler2D uRipple;
  uniform highp sampler3D uHeld; uniform vec3 uHeldOrigin; uniform float uHeldOn; uniform float uWet;
  #if __VERSION__ >= 300
  #define CENTROID centroid
  #else
  #define CENTROID
  #endif
  CENTROID varying vec2 vUv; CENTROID varying vec4 vLight; varying vec3 vTint; varying float vDist; varying vec3 vWorld; varying float vGlow;
  CENTROID varying float vCry; varying float vCrystal; varying float vWet; varying float vPortal;
  float curve(float l) { return (pow(0.83, (1.0 - l) * 15.0) - 0.0611) / 0.9389; }
  // block light (torches, lava) falls off slower than sky light, so a torch reaches farther
  float curveB(float l) { return (pow(0.85, (1.0 - l) * 15.0) - 0.0874) / 0.9126; }
  // G3 (P2): 1 = sunlit, 0 = in shadow. Hardware-filtered depth compares: each read blends 4 texels.
  // Terrain takes 4 reads on a square turned by per-pixel noise (a soft ~0.3-block penumbra); water takes 1.
  // With Soft shadows off (uShadowSoft 0), terrain also takes 1 read: a hard edge.
  // Fades to 1 at the edge of the shadow box.
  float shadowLit(vec3 n, bool soft) {
    vec4 sc = uShadowMat * vec4(vWorld + n * 0.12, 1.0);
    vec3 c = sc.xyz * 0.5 + 0.5;
    float edge = max(abs(c.x - 0.5), abs(c.y - 0.5)) * 2.0;
    if (edge >= 1.0 || c.z >= 1.0) return 1.0;
    float z = c.z - uShadowBias, s;
    if (soft) {
      float a = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) * 6.2832;
      vec2 r = vec2(cos(a), sin(a)) * uShadowTexel * 2.2, q = vec2(-r.y, r.x);
      s = 0.25 * (texture(uShadowMap, vec3(c.xy + r, z)) + texture(uShadowMap, vec3(c.xy - r, z))
                + texture(uShadowMap, vec3(c.xy + q, z)) + texture(uShadowMap, vec3(c.xy - q, z)));
    } else s = texture(uShadowMap, vec3(c.xy, z));
    return mix(s, 1.0, smoothstep(0.8, 1.0, edge));
  }
  ${CLOUD_GLSL}
  // G5: the cloud density (0..1) where the ray to the sun (or moon) crosses the layer
  float sunCloud() {
    vec2 q = vWorld.xz + uSunDir.xz * ((CLOUD_Y - vWorld.y) / max(uSunDir.y, 0.12));
    return cloudDensity(q);
  }
  // G5: direct light under the clouds: 1 = no cloud, 0.25 = under a thick cloud
  float cloudLit() { return 1.0 - 0.75 * sunCloud(); }
  #ifdef WATER
  // G1: animated surface normal: four sine waves plus the baked ripples; \`detail\` fades the ripples with distance
  vec3 waveNormal(vec2 p, float t, float detail) {
    vec2 g = vec2(0.0);
    vec2 d; float k, a, w, ph;
    d = normalize(vec2(1.0, 0.3));   k = 0.9;  a = 0.05;  w = 1.2; ph = dot(d, p) * k + t * w; g += d * a * k * cos(ph);
    d = normalize(vec2(-0.4, 1.0));  k = 1.4;  a = 0.035; w = 1.5; ph = dot(d, p) * k + t * w; g += d * a * k * cos(ph);
    d = normalize(vec2(0.7, -0.8));  k = 2.3;  a = 0.02;  w = 2.1; ph = dot(d, p) * k + t * w; g += d * a * k * cos(ph);
    d = normalize(vec2(-0.9, -0.3)); k = 3.7;  a = 0.012; w = 2.7; ph = dot(d, p) * k + t * w; g += d * a * k * cos(ph);
    // small ripples: two scrolled reads of the baked slope map (mipmaps smooth them with distance)
    vec2 h = (texture2D(uRipple, p / 6.0 + t * vec2(0.031, 0.017)).rg * 2.0 - 1.0)
           + (texture2D(uRipple, p / 3.7 + vec2(0.5, 0.21) - t * vec2(0.022, 0.035)).rg * 2.0 - 1.0);
    g += h * 0.055 * detail;
    return normalize(vec3(-g.x, 1.0, -g.y));
  }
  // Phase 3: the Ember portal pane. Two reads of the caustic net, bent by moving sine fields, flow
  // over a crimson-to-orange band pattern. The pane ignores light (it emits light 11), and its
  // bright streaks pass 1.0 in HDR, so the bloom pass gives them a halo.
  // Phase 5: the crystal pane (cry true) uses the same flow, slower, from deep indigo to turquoise
  // with pale violet streaks.
  vec4 portalPane(vec3 n, bool cry) {
    vec2 q = (abs(n.x) > abs(n.z) ? vWorld.zy : vWorld.xy) * 0.9;
    float t = uTime * (cry ? 0.4 : 0.6);
    vec2 w = vec2(sin(q.y * 2.3 + t * 1.3) + sin(q.x * 1.7 - t), cos(q.x * 2.1 - t * 1.1) + sin(q.y * 1.3 + t * 0.7));
    float a = texture2D(uCaus, q * 0.35 + w * 0.12 + vec2(t * 0.05, -t * 0.08)).r;
    float b = texture2D(uCaus, q * 0.6 - w * 0.1 + vec2(-t * 0.07, t * 0.04)).r;
    float s = 0.5 + 0.5 * sin(q.x * 3.0 + q.y * 2.0 + w.x * 2.0 + w.y + t * 2.0);
    vec3 col = cry ? mix(vec3(0.06, 0.04, 0.3), vec3(0.1, 0.78, 0.74), s) : mix(vec3(0.42, 0.03, 0.05), vec3(1.0, 0.36, 0.06), s);
    col += (cry ? vec3(0.78, 0.7, 1.0) : vec3(1.0, 0.72, 0.3)) * (a * 1.3 + b * 0.7) * (0.9 + (uGlow - 1.0) * 0.5);
    return vec4(col, clamp(0.68 + 0.25 * (a + b), 0.0, 0.95));
  }
  #endif
  void main() {
    #ifdef WATER
      if (vPortal > 0.5) {
        vec4 pc = portalPane(normalize(cross(dFdx(vWorld), dFdy(vWorld))), vPortal > 1.5);
        float pf = smoothstep(uFogNear, uFogFar, vDist);
        gl_FragColor = vec4(mix(pc.rgb, uFogColor, pf), mix(pc.a, 1.0, pf));
        return;
      }
      vec3 col = vec3(0.10, 0.27, 0.42);   // G1: fixed water color, no atlas tile
    #else
      vec4 tex = texture2D(map, vUv);
      if (tex.a < 0.5) discard;
      vec3 col = tex.rgb * mix(vec3(1.0), vTint, step(tex.a, 0.9));
    #endif
    // flat face normal from screen-space derivatives
    vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
    float ndl = dot(n, uSunDir);
    float sunF, lit = 1.0;
    if (uShadowOn > 0.5) {
      // G3: ambient plus direct sun; direct needs open sky (baked sky light), no shadow, and no cloud (G5)
      #ifdef WATER
      if (ndl > 0.0 && uSunAmt > 0.0) lit = shadowLit(n, false) * cloudLit();
      #else
      if (ndl > 0.0 && uSunAmt > 0.0) lit = shadowLit(n, uShadowSoft > 0.5) * cloudLit();
      #endif
      float open = smoothstep(0.6, 0.95, vLight.x);
      float direct = max(ndl, 0.0) * lit * open * uSunAmt;
      sunF = mix(1.0, 0.68 + 0.52 * direct, open);
    } else {
      sunF = 1.0 + uSunAmt * (max(ndl, 0.0) * 0.24 - 0.12);   // faces toward the sun get up to +12%
    }
    float sky = curve(vLight.x * uDaylight) * sunF;
    // G2: caustics on faces that touch water, projected along the light direction. They scale the face's own
    // sky light, so they darken with it; they fade out between ~3 and ~7 blocks deep (sky light drops 1 per
    // block in water), vanish as daylight falls (none by moonlight), and weaken in rain.
    float caus = 0.0;
    #ifndef WATER
    if (vWet > 0.5 && uSunAmt > 0.0 && vLight.x > 0.3) {
      // The net is anchored at the water surface and shifted toward the sun by the depth below it.
      // Depth comes from sky light (1 per water block). Absolute y here made the net race as the sun moved.
      float depth = 15.0 * (1.0 - vLight.x);
      vec2 cp = (vWorld.xz + uSunDir.xz * (depth / max(uSunDir.y, 0.35))) / 3.3;
      // Two layers of the net drift in opposite directions. Each layer is bent by its own moving sine
      // field, so the lines wobble and re-form in place instead of sliding as one pattern. The bend is
      // arithmetic, so it adds no texture read.
      vec2 wa = vec2(sin(dot(cp, vec2(14.3, 8.4)) + uTime * 1.9) + sin(dot(cp, vec2(-7.8, 20.0)) - uTime * 1.4),
                     sin(dot(cp, vec2(-12.7, 15.9)) + uTime * 1.6) + sin(dot(cp, vec2(18.4, 5.9)) - uTime * 2.2));
      vec2 wb = vec2(sin(dot(cp, vec2(-16.5, 7.3)) - uTime * 1.7) + sin(dot(cp, vec2(9.2, -17.8)) + uTime * 1.5),
                     sin(dot(cp, vec2(6.8, 17.0)) - uTime * 2.0) + sin(dot(cp, vec2(-19.4, -8.1)) + uTime * 1.3));
      float ca = min(texture2D(uCaus, cp + wa * 0.025 + uTime * vec2(0.03, 0.018)).r,
                     texture2D(uCaus, cp * 1.19 + vec2(0.37, 0.61) + wb * 0.025 - uTime * vec2(0.026, 0.036)).r);
      float dayF = clamp((uDaylight - 0.35) / 0.5, 0.0, 1.0);   // uDaylight: 4.5/15 at night, 1 by day
      caus = ca * 1.3 * uSunAmt * dayF * lit * smoothstep(0.5, 0.95, vLight.x) * (1.0 - 0.8 * uWet);
      sky *= 1.0 + caus;
    }
    #endif
    // G4: held torch light, flood-filled around the head; sampled in the cell in front of the face
    float held = 0.0;
    if (uHeldOn > 0.5) {
      vec3 ns = dot(n, cameraPosition - vWorld) < 0.0 ? -n : n;   // the lit side: water is double-sided
      vec3 hp = (vWorld + ns * 0.5 - uHeldOrigin) / 32.0;
      if (all(greaterThan(hp, vec3(0.0))) && all(lessThan(hp, vec3(1.0)))) held = texture(uHeld, hp).r;
    }
    float blk = curveB(max(vLight.y, held)) * uTorch;
    vec3 light = max(sky * uSkyLight, blk * vec3(1.0, 0.86, 0.64));
    light = max(light, curveB(vCry) * vec3(0.3, 0.92, 0.86));                              // crystal light: soft turquoise
    light = max(light, max(uAmbient, vec3(0.018)));                                      // the realm floor, then the minimum
    float ao = mix(0.42, 1.0, vLight.z);
    col *= light * ao * vLight.w;
    #ifndef WATER
    if (vCrystal > 0.5) col = tex.rgb * (0.45 + 0.55 * vLight.w) * (0.9 + (uGlow - 1.0) * 0.3);   // tips just reach bloom in HDR
    if (vGlow > 0.25 && tex.r > 0.8) col = tex.rgb * (vGlow > 0.75 ? 0.95 + (uGlow - 1.0) * 3.0 : 0.92 + (uGlow - 1.0) * 0.25);   // flames ~4 in HDR; lava ~1.2
    #endif
    #ifdef WATER
      // G1: wave normal on open top faces; Fresnel sky reflection; sun (or moon) glitter in HDR
      vec3 v = normalize(cameraPosition - vWorld);
      if (dot(n, v) < 0.0) n = -n;
      float top = smoothstep(0.5, 0.9, abs(n.y));
      float detail = 1.0 - smoothstep(20.0, 80.0, vDist);
      vec3 wn = waveNormal(vWorld.xz, uTime, detail);
      wn.y *= sign(n.y);
      vec3 nn = normalize(mix(n, wn, top));
      float open = top * smoothstep(0.5, 0.9, vLight.x);
      float fres = (0.02 + 0.98 * pow(1.0 - max(dot(nn, v), 0.0), 5.0)) * open;
      col = mix(col, uFogColor * (0.3 + 0.7 * uDaylight), min(fres * 1.1, 0.9));
      col += vec3(1.0, 0.72, 0.42) * blk * 0.4 * (1.0 - fres);   // torch light scatters in the surface layer
      if (held > 0.0) {   // G4: the held torch glints on the waves (light just below the eye)
        vec3 tl = normalize(cameraPosition + vec3(0.0, -0.45, 0.0) - vWorld);
        col += vec3(1.0, 0.8, 0.5) * pow(max(dot(reflect(-v, nn), tl), 0.0), 250.0) * curveB(held) * 3.0 * detail;
      }
      float rs = max(dot(reflect(-v, nn), uSunDir), 0.0);
      float glit = (pow(rs, 900.0) * 14.0 + pow(rs, 120.0) * 0.8) * detail + pow(rs, 60.0) * 0.35 * (1.0 - detail);
      float spec = glit * uSunAmt * open * (1.0 - 0.85 * uWet) * lit;
      // G5: the glitter is a mirror image of the sun, so it fades like the sun disc (sky.js), with or
      // without Shadows. The 25 % floor of cloudLit() left a bright HDR glint under overcast.
      if (spec > 0.0) spec *= exp(-sunCloud() * 6.0);
      col += vec3(1.0, 0.93, 0.8) * spec * uGlow;
    #endif
    float f = smoothstep(uFogNear, uFogFar, vDist);
    col = mix(col, uFogColor, f);
    #ifdef WATER
      gl_FragColor = vec4(col, mix(0.5 + fres * 0.45 + min(spec, 1.0) * 0.3, 1.0, f));
    #else
      gl_FragColor = vec4(col, 1.0);
    #endif
  }`;
const terrainMaterial = new THREE.ShaderMaterial({ uniforms: terrainUniforms, vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS });
const waterMaterial = new THREE.ShaderMaterial({
  uniforms: terrainUniforms, vertexShader: TERRAIN_VS, fragmentShader: TERRAIN_FS,
  defines: { WATER: 1 }, transparent: true, side: THREE.DoubleSide, depthWrite: true,
});

export { terrainMaterial, terrainUniforms, waterMaterial };
