/* =====================================================================================
 * === 15. PARTICLES AND AUDIO
 * -------------------------------------------------------------------------------------
 * Particles: one THREE.Points pool of square, fogged sprites. The simulation state is kept
 * in typed arrays. Block debris takes its colors from the block's atlas tiles and
 * collides with terrain. Smoke grows and fades. Flames are emissive: they ignore light.
 * Audio: WebAudio, every sound is synthesized from oscillators and a noise buffer.
 * Positional sounds pan with the camera's right vector and fade over 32 blocks.
 * ===================================================================================== */
import { THREE } from './three.js';
import { glowGain, randInt, randRange, UNLOADED } from './config.js';
import { BLOCKS, DIR4, SOLID } from './blocks.js';
import { FACE_TILE, ITEM_PIX, TILE, tintedPixels } from './atlas.js';
import { terrainUniforms } from './terrain-material.js';
import { camera, game, player, renderer, scene, world } from './engine.js';
import { FACE_NORMAL, torches } from './interact.js';

const MAX_PARTICLES = 6000;
const particles = (() => {
  const N = MAX_PARTICLES;
  const P = new Float32Array(N * 3), V = new Float32Array(N * 3), COL = new Float32Array(N * 3);
  const life = new Float32Array(N), maxLife = new Float32Array(N), size = new Float32Array(N), grow = new Float32Array(N);
  const grav = new Float32Array(N), drag = new Float32Array(N), light = new Float32Array(N);
  const flags = new Uint8Array(N);          // 1 = collides, 2 = emissive, 4 = fades out
  const alive = new Uint8Array(N);
  let count = 0, cursor = 0;
  const posAttr = new THREE.BufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
  const sizeAttr = new THREE.BufferAttribute(new Float32Array(N), 1).setUsage(THREE.DynamicDrawUsage);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', posAttr); geo.setAttribute('aColor', colAttr); geo.setAttribute('aSize', sizeAttr);
  geo.setDrawRange(0, 0);
  const uniforms = {
    uScale: { value: 500 },
    uFogColor: terrainUniforms.uFogColor, uFogNear: terrainUniforms.uFogNear, uFogFar: terrainUniforms.uFogFar,
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      attribute float aSize; attribute vec4 aColor;
      uniform float uScale; uniform float uFogNear; uniform float uFogFar;
      varying vec4 vColor; varying float vFog;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = min(aSize * uScale / max(0.05, -mv.z), uScale * 0.35);
        vColor = aColor;
        vColor.a *= smoothstep(0.35, 1.6, -mv.z);   // fade points that reach the camera
        vFog = smoothstep(uFogNear, uFogFar, length(mv.xyz));
      }`,
    fragmentShader: `
      uniform vec3 uFogColor; varying vec4 vColor; varying float vFog;
      void main() {
        if (vColor.a < 0.01) discard;
        gl_FragColor = vec4(mix(vColor.rgb, uFogColor, vFog), vColor.a);
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 3;
  scene.add(points);

  // palette of a block: opaque pixels of its side and top tiles (grass and leaves tinted)
  const TILE_NAME = [];
  for (const k in TILE) TILE_NAME[TILE[k]] = k;
  const palettes = new Map();
  function palette(id) {
    let p = palettes.get(id);
    if (p) return p;
    p = [];
    for (const f of [0, 2]) {
      const t = FACE_TILE[id * 6 + f];
      if (t < 0) continue;
      const px = tintedPixels(TILE_NAME[t], id);
      for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0) p.push([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255]);
    }
    if (!p.length) p.push([0.5, 0.5, 0.5]);
    palettes.set(id, p);
    return p;
  }
  function itemPalette(itemId) {
    const key = 'i' + itemId;
    let p = palettes.get(key);
    if (p) return p;
    p = [];
    const px = ITEM_PIX[itemId];
    if (px) for (let i = 0; i < px.length; i += 4) if (px[i + 3] > 0) p.push([px[i] / 255, px[i + 1] / 255, px[i + 2] / 255]);
    if (!p.length) p.push([0.8, 0.6, 0.5]);
    palettes.set(key, p);
    return p;
  }

  function emit(x, y, z, vx, vy, vz, o) {
    // find a free slot; overwrite the oldest ring position when full
    let i = -1;
    for (let k = 0; k < 64; k++) { const j = (cursor + k) % N; if (!alive[j]) { i = j; break; } }
    if (i < 0) i = cursor;
    cursor = (i + 1) % N;
    if (!alive[i]) count++;
    alive[i] = 1;
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    V[i * 3] = vx; V[i * 3 + 1] = vy; V[i * 3 + 2] = vz;
    const c = o.color;
    COL[i * 3] = c[0]; COL[i * 3 + 1] = c[1]; COL[i * 3 + 2] = c[2];
    life[i] = maxLife[i] = o.life;
    size[i] = o.size; grow[i] = o.grow || 0;
    grav[i] = o.grav ?? 12; drag[i] = o.drag ?? 1;
    flags[i] = o.flags || 0;
    light[i] = (flags[i] & 2) ? glowGain : world.brightnessAt(Math.floor(x), Math.floor(y), Math.floor(z), game.daylight);
  }

  const solidAt = (x, y, z) => { const b = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z)); return b !== UNLOADED && SOLID[b]; };
  let frame = 0, torchT = 0;

  function update(dt) {
    frame++;
    let hi = 0;
    const pa = posAttr.array, ca = colAttr.array, sa = sizeAttr.array;
    for (let i = 0; i < N; i++) {
      if (!alive[i]) continue;
      life[i] -= dt;
      if (life[i] <= 0) { alive[i] = 0; count--; sa[i] = 0; ca[i * 4 + 3] = 0; continue; }
      const i3 = i * 3;
      V[i3 + 1] -= grav[i] * dt;
      const d = Math.exp(-drag[i] * dt);
      V[i3] *= d; V[i3 + 1] *= d; V[i3 + 2] *= d;
      if (flags[i] & 1) {
        // axis-separated collision against solid blocks
        for (let a = 0; a < 3; a++) {
          const old = P[i3 + a];
          P[i3 + a] += V[i3 + a] * dt;
          if (solidAt(P[i3], P[i3 + 1], P[i3 + 2])) {
            P[i3 + a] = old;
            V[i3 + a] *= a === 1 ? -0.1 : -0.3;
            if (a === 1) { V[i3] *= 0.6; V[i3 + 2] *= 0.6; }
          }
        }
      } else {
        P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      }
      size[i] += grow[i] * dt;
      if (!(flags[i] & 2) && (frame + i) % 10 === 0) light[i] = world.brightnessAt(Math.floor(P[i3]), Math.floor(P[i3 + 1]), Math.floor(P[i3 + 2]), game.daylight);
      const t = life[i] / maxLife[i];
      const l = light[i];
      pa[i3] = P[i3]; pa[i3 + 1] = P[i3 + 1]; pa[i3 + 2] = P[i3 + 2];
      ca[i * 4] = COL[i3] * l; ca[i * 4 + 1] = COL[i3 + 1] * l; ca[i * 4 + 2] = COL[i3 + 2] * l;
      ca[i * 4 + 3] = (flags[i] & 4) ? Math.min(1, t * 2) : 1;
      sa[i] = (flags[i] & 4) ? size[i] : size[i] * Math.min(1, t * 4 + 0.3);
      hi = i + 1;
    }
    geo.setDrawRange(0, hi);
    posAttr.needsUpdate = colAttr.needsUpdate = sizeAttr.needsUpdate = true;
    uniforms.uScale.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

    // torch flames and smoke near the player
    torchT -= dt;
    if (torchT <= 0) {
      torchT = 0.05;
      const px = player.pos.x, py = player.pos.y, pz = player.pos.z;
      for (const k of torches) {
        let [x, y, z] = k.split(',').map(Number);
        if (Math.abs(x - px) > 28 || Math.abs(z - pz) > 28 || Math.abs(y - py) > 28) continue;
        const f = BLOCKS[world.getBlock(x, y, z)]?.facing ?? -1;   // a wall torch's head sits 3/16 toward its wall, 3/16 higher
        if (f >= 0) { x -= DIR4[f][0] * 0.1875; z -= DIR4[f][1] * 0.1875; y += 0.1875; }
        if (Math.random() < 0.35) emit(x + 0.5 + randRange(-0.03, 0.03), y + 0.7, z + 0.5 + randRange(-0.03, 0.03), 0, randRange(0.15, 0.35), 0,
          { color: Math.random() < 0.5 ? [1, 0.8, 0.3] : [1, 0.55, 0.15], life: randRange(0.2, 0.45), size: 0.07, grav: 0, drag: 2, flags: 2 });
        if (Math.random() < 0.05) emit(x + 0.5, y + 0.8, z + 0.5, randRange(-0.05, 0.05), 0.5, randRange(-0.05, 0.05),
          { color: [0.25, 0.25, 0.25], life: 1.4, size: 0.08, grow: 0.04, grav: -0.1, drag: 1, flags: 4 });
      }
      if (player.headInWater && Math.random() < 0.25) {
        const e = camera.position;
        emit(e.x + randRange(-0.4, 0.4), e.y - 0.3, e.z + randRange(-0.4, 0.4), 0, 0.8, 0, { color: [0.75, 0.85, 1], life: 1.2, size: 0.05, grav: -1, drag: 1.5, flags: 2 });
      }
    }
  }

  return {
    update,
    get count() { return count; },
    blockBreak(x, y, z, id) {
      const pal = palette(id);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
        const ox = (i + 0.5) / 4, oy = (j + 0.5) / 4, oz = (k + 0.5) / 4;
        emit(x + ox, y + oy, z + oz, (ox - 0.5) * 4 + randRange(-0.6, 0.6), (oy - 0.2) * 4 + randRange(0, 2), (oz - 0.5) * 4 + randRange(-0.6, 0.6),
          { color: pal[randInt(0, pal.length - 1)], life: randRange(0.4, 1.4), size: randRange(0.06, 0.13), grav: 16, drag: 0.5, flags: 1 });
      }
    },
    blockHit(t) {
      const pal = palette(t.id), n = FACE_NORMAL[t.face];
      for (let i = 0; i < 2; i++) {
        let x = t.x + Math.random(), y = t.y + Math.random(), z = t.z + Math.random();
        if (n[0]) x = t.x + (n[0] > 0 ? 1.05 : -0.05);
        if (n[1]) y = t.y + (n[1] > 0 ? 1.05 : -0.05);
        if (n[2]) z = t.z + (n[2] > 0 ? 1.05 : -0.05);
        emit(x, y, z, n[0] * 1.5 + randRange(-0.5, 0.5), n[1] * 1.5 + randRange(0, 1.5), n[2] * 1.5 + randRange(-0.5, 0.5),
          { color: pal[randInt(0, pal.length - 1)], life: randRange(0.3, 0.7), size: randRange(0.05, 0.09), grav: 16, drag: 0.5, flags: 1 });
      }
    },
    explosion(x, y, z, r) {
      for (let i = 0; i < 70; i++) {
        const a = Math.random() * Math.PI * 2, b = Math.acos(randRange(-1, 1)), s = randRange(1, 6);
        const g = randRange(0.55, 0.95);
        emit(x + randRange(-r, r) * 0.5, y + randRange(-r, r) * 0.5, z + randRange(-r, r) * 0.5,
          Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s + 1, Math.sin(b) * Math.sin(a) * s,
          { color: [g, g, g], life: randRange(0.6, 1.6), size: randRange(0.4, 0.9), grow: 0.6, grav: -0.5, drag: 2.5, flags: 4 });
      }
      for (let i = 0; i < 40; i++) {
        emit(x, y, z, randRange(-9, 9), randRange(-5, 9), randRange(-9, 9),
          { color: Math.random() < 0.5 ? [1, 0.85, 0.4] : [1, 0.45, 0.1], life: randRange(0.15, 0.4), size: randRange(0.2, 0.45), grav: 0, drag: 4, flags: 6 });
      }
    },
    // green sparkles from bone meal on a sapling or a crop
    grow(x, y, z) {
      for (let i = 0; i < 14; i++) {
        const g = randRange(0.7, 1);
        emit(x + randRange(0.1, 0.9), y + randRange(0.1, 0.8), z + randRange(0.1, 0.9), randRange(-0.2, 0.2), randRange(0.3, 0.9), randRange(-0.2, 0.2),
          { color: [0.35 * g, g, 0.3 * g], life: randRange(0.6, 1.1), size: randRange(0.07, 0.12), grav: -0.2, drag: 1.5, flags: 2 });
      }
    },
    poof(x, y, z, w = 0.6) {
      for (let i = 0; i < 18; i++) {
        const g = randRange(0.75, 1);
        emit(x + randRange(-w, w) / 2, y + randRange(-0.4, 0.4), z + randRange(-w, w) / 2, randRange(-0.6, 0.6), randRange(0.2, 1.2), randRange(-0.6, 0.6),
          { color: [g, g, g], life: randRange(0.5, 1), size: randRange(0.12, 0.22), grow: 0.1, grav: -0.3, drag: 2, flags: 4 });
      }
    },
    fire(x, y, z, w = 0.6) {
      emit(x + randRange(-w, w) / 2, y, z + randRange(-w, w) / 2, 0, randRange(0.4, 1), 0,
        { color: Math.random() < 0.5 ? [1, 0.75, 0.25] : [1, 0.4, 0.08], life: randRange(0.25, 0.5), size: randRange(0.1, 0.18), grav: -0.5, drag: 1, flags: 6 });
    },
    ember(x, y, z, w = 0.6, h = 1) {   // a glowing speck that drifts up from a Magma Brute
      emit(x + randRange(-w, w) / 2, y + randRange(0, h), z + randRange(-w, w) / 2, randRange(-0.2, 0.2), randRange(0.5, 1.2), randRange(-0.2, 0.2),
        { color: Math.random() < 0.5 ? [1, 0.6, 0.1] : [1, 0.3, 0.05], life: randRange(0.5, 1), size: randRange(0.04, 0.08), grav: -0.4, drag: 1, flags: 6 });
    },
    tntSpark(x, y, z) {   // sparks and smoke from a burning TNT fuse
      for (let i = 0; i < 3; i++) emit(x, y, z, randRange(-0.8, 0.8), randRange(1, 2.2), randRange(-0.8, 0.8),
        { color: Math.random() < 0.5 ? [1, 0.85, 0.4] : [1, 0.5, 0.12], life: randRange(0.2, 0.4), size: 0.06, grav: 6, drag: 1, flags: 2 });
      emit(x, y + 0.1, z, randRange(-0.05, 0.05), 0.6, randRange(-0.05, 0.05), { color: [0.4, 0.4, 0.4], life: 1.2, size: 0.1, grow: 0.08, grav: -0.1, drag: 1, flags: 4 });
    },
    eat(itemId) {
      const pal = itemPalette(itemId), f = new THREE.Vector3();
      camera.getWorldDirection(f);
      const o = camera.position.clone().addScaledVector(f, 0.45); o.y -= 0.2;
      for (let i = 0; i < 8; i++) emit(o.x, o.y, o.z, f.x * 1.2 + randRange(-0.8, 0.8), randRange(0.5, 2), f.z * 1.2 + randRange(-0.8, 0.8),
        { color: pal[randInt(0, pal.length - 1)], life: randRange(0.4, 0.8), size: randRange(0.04, 0.07), grav: 14, drag: 0.5, flags: 1 });
    },
    splash(x, y, z) {
      for (let i = 0; i < 26; i++) emit(x + randRange(-0.5, 0.5), y, z + randRange(-0.5, 0.5), randRange(-1.5, 1.5), randRange(2, 5), randRange(-1.5, 1.5),
        { color: Math.random() < 0.5 ? [0.7, 0.8, 1] : [0.3, 0.5, 0.9], life: randRange(0.4, 0.9), size: randRange(0.05, 0.1), grav: 16, drag: 0.4, flags: 1 });
    },
  };
})();

export { particles };
