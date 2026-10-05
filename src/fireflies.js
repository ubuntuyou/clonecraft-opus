// ---- fireflies -------------------------------------------------------------------------------
// Fireflies come out at dusk over grass blocks in the plains, forest, and rainforest biomes. They
// fade in as the sun sets, stay through the night, and fade out at dawn. Rain and storms send them
// away. A firefly hovers 0.3..3.5 blocks above its grass block (under trees too) and drifts around
// its home point. It blinks on its own rhythm: a short HDR flash that the bloom pass turns into a
// halo, then a faint glow. After its life it fades out and comes back at a new spot in the disc of
// RADIUS blocks around the camera. The pool is one THREE.Points with additive blending. The save
// holds no firefly state.
import { THREE } from './three.js';
import { CS, UNLOADED } from './config.js';
import { B, IS_LAVA, IS_LEAF, IS_WATER, SOLID } from './blocks.js';
import { BIOME } from './biomes.js';
import { camera, game, player, scene, world } from './engine.js';
import { weather } from './weather.js';
import { realm } from './realms.js';

const fireflies = (() => {
  const N = 140, RADIUS = 28, TRIES = 24, FADE = 1.5, PEAK = 4;
  const HOME = new Uint8Array(16); HOME[BIOME.PLAINS] = HOME[BIOME.FOREST] = HOME[BIOME.RAINFOREST] = 1;
  // Per firefly (stride S): home x y z, position x y z, target x y z, age, life, phase, period,
  // retarget timer, and the cached ground: column x z and its grass y.
  const S = 17, d = new Float64Array(N * S);   // 64-bit: a checked move must not round across a block edge
  const pos = new Float32Array(N * 3).fill(-9999), col = new Float32Array(N * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  // A soft glow: a bright core and a wide faint rim.
  const cv = document.createElement('canvas'); cv.width = cv.height = 32;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.75)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  const mat = new THREE.PointsMaterial({ size: 0.35, map: new THREE.CanvasTexture(cv), vertexColors: true,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.renderOrder = 3; points.visible = false; scene.add(points);   // after the water (1)
  for (let i = 0; i < N; i++) d[i * S + 9] = d[i * S + 10] = 0;   // age = life = 0: spawn on the first frame

  let t = 0, level = 0, shown = 0;
  // A cell a firefly may occupy: loaded, not solid (leaves are solid), not liquid.
  function free(x, y, z) {
    const id = world.getBlock(Math.floor(x), Math.floor(y), Math.floor(z));
    return id !== UNLOADED && !SOLID[id] && !IS_WATER[id] && !IS_LAVA[id];
  }
  // The grass block under the canopy of column (x, z): scan down from the top through air, plants,
  // leaves, and logs. Returns its y, or -1 when the column has no open grass or is not a home biome.
  function ground(x, z) {
    const c = world.chunkAt(x, z);
    if (!c || !HOME[c.biomes[(z & 15) * CS + (x & 15)]]) return -1;
    for (let y = weather.top(x, z); y > 0; y--) {
      const id = world.getBlock(x, y, z);
      if (id === B.LOG || IS_LEAF[id] || (!SOLID[id] && !IS_WATER[id] && !IS_LAVA[id])) continue;
      return id === B.GRASS ? y : -1;
    }
    return -1;
  }
  // ground() of column (x, z), cached in the firefly's record `o` for the last column asked.
  function groundAt(o, x, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    if (ix !== d[o + 14] || iz !== d[o + 15]) { d[o + 14] = ix; d[o + 15] = iz; d[o + 16] = ground(ix, iz); }
    return d[o + 16];
  }
  // True when a firefly may be at (x, y, z): over grass in a home biome, 0.3..3.5 blocks above the
  // grass, in a free cell.
  function fits(o, x, y, z) {
    const g = groundAt(o, x, z);
    return g >= 0 && y >= g + 1.3 && y <= g + 4.5 && free(x, y, z);
  }
  function spawn(o) {
    const cp = camera.position, a = Math.random() * Math.PI * 2, r = RADIUS * Math.sqrt(Math.random());
    const x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r;
    d[o + 14] = NaN;   // fresh ground: blocks may have changed since the last life
    const g = groundAt(o, x, z), y = g + 1.3 + Math.random() * 3.2;
    if (g < 0 || !fits(o, x, y, z)) return false;
    d[o] = d[o + 3] = d[o + 6] = x; d[o + 1] = d[o + 4] = d[o + 7] = y; d[o + 2] = d[o + 5] = d[o + 8] = z;
    d[o + 9] = 0; d[o + 10] = 15 + Math.random() * 25;
    d[o + 11] = Math.random() * 10; d[o + 12] = 2.2 + Math.random() * 3; d[o + 13] = 0;
    return true;
  }
  // A new drift target within 2 blocks of home (0.8 up or down), kept 0.3..3.5 above the grass.
  function retarget(o) {
    const x = d[o] + (Math.random() * 2 - 1) * 2, z = d[o + 2] + (Math.random() * 2 - 1) * 2;
    const y = d[o + 1] + (Math.random() * 2 - 1) * 0.8;
    d[o + 14] = NaN;   // re-read the ground now and then: the player may have edited it
    if (fits(o, x, y, z)) { d[o + 6] = x; d[o + 7] = y; d[o + 8] = z; }
    d[o + 13] = 1.5 + Math.random() * 2.5;
  }
  function hide(i) { pos[i * 3 + 1] = -9999; col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0; }

  function update(dt) {
    const e = Math.sin(game.dayTime * Math.PI * 2);   // sun height: 0 at sunrise and sunset
    level = realm.current === 'overworld' ? (1 - THREE.MathUtils.smoothstep(e, -0.1, 0.06)) * (1 - weather.k) : 0;   // overworld only
    const under = player.headInWater || player.headInLava;
    points.visible = level > 0.01 && !under;
    if (level <= 0.01) { for (let i = 0; i < N; i++) d[i * S + 10] = 0; shown = 0; return; }   // fresh spots next night
    if (!points.visible) return;
    t += dt;
    const cp = camera.position, k = Math.min(1, dt * 0.9);
    let tries = TRIES; shown = 0;
    for (let i = 0; i < N; i++) {
      const o = i * S, q = i * 3;
      const far = Math.abs(d[o] - cp.x) > RADIUS + 4 || Math.abs(d[o + 2] - cp.z) > RADIUS + 4;
      if ((d[o + 9] += dt) >= d[o + 10] || far) {
        d[o + 10] = 0;
        if (tries <= 0) { hide(i); continue; }
        tries--;
        if (!spawn(o)) { hide(i); continue; }
      }
      if (!free(d[o + 3], d[o + 4], d[o + 5])) { d[o + 10] = 0; hide(i); continue; }   // a block now fills its cell
      if ((d[o + 13] -= dt) <= 0) retarget(o);
      // ease toward the target with a small wobble; a move that breaks the rules turns it back home
      const w = t * 1.7 + d[o + 11];
      const nx = d[o + 3] + (d[o + 6] - d[o + 3]) * k + Math.sin(w) * 0.15 * dt;
      const ny = d[o + 4] + (d[o + 7] - d[o + 4]) * k + Math.sin(w * 1.3) * 0.1 * dt;
      const nz = d[o + 5] + (d[o + 8] - d[o + 5]) * k + Math.cos(w * 0.9) * 0.15 * dt;
      if (fits(o, nx, ny, nz)) { d[o + 3] = nx; d[o + 4] = ny; d[o + 5] = nz; }
      else { d[o + 6] = d[o]; d[o + 7] = d[o + 1]; d[o + 8] = d[o + 2]; }
      // brightness: life fade x blink x level x distance fade
      const age = d[o + 9], life = Math.min(1, age / FADE, (d[o + 10] - age) / FADE);
      const ph = ((t + d[o + 11]) / d[o + 12]) % 1, flash = ph < 0.25 ? Math.sin(ph / 0.25 * Math.PI) : 0;
      const dist = Math.hypot(d[o + 3] - cp.x, d[o + 5] - cp.z);
      const b = (0.12 + flash) * life * level * (1 - THREE.MathUtils.smoothstep(dist, RADIUS - 6, RADIUS)) * PEAK;
      pos[q] = d[o + 3]; pos[q + 1] = d[o + 4]; pos[q + 2] = d[o + 5];
      col[q] = 0.85 * b; col[q + 1] = b; col[q + 2] = 0.3 * b;
      shown++;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  return {
    update, ground,
    get level() { return level; }, get shown() { return shown; }, get visible() { return points.visible; },
    // For tests: each live firefly as { x, y, z, home: [x, y, z], b } (b = its brightness now).
    list() {
      const out = [];
      for (let i = 0; i < N; i++) {
        const o = i * S, q = i * 3;
        if (pos[q + 1] > -9000 && d[o + 10] > 0) out.push({ x: d[o + 3], y: d[o + 4], z: d[o + 5], home: [d[o], d[o + 1], d[o + 2]], b: col[q + 1] });
      }
      return out;
    },
    N,
  };
})();

export { fireflies };
