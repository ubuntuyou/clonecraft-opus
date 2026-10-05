// ---- ash (SPEC_realms Phase 2) -----------------------------------------------------------------
// Ash drifts in the air of the Ember Realm. Grey flakes fall slowly and drift with a slow wind that
// turns over time. A few glowing embers rise from the lava heat and flicker. Both pools live in a box
// around the camera (BOX blocks out, VBOX up and down). A particle that leaves the box wraps to the
// other side, so the density around the camera stays constant. Particles ignore blocks: the depth
// test hides a particle inside rock. The flakes use the scene fog. The embers are additive HDR
// points, so the bloom pass gives them a halo; they fade with distance by hand. The save holds no
// ash state.
import { THREE } from './three.js';
import { camera, player, scene } from './engine.js';
import { realm } from './realms.js';

const ash = (() => {
  const NFLAKE = 900, NEMBER = 70, BOX = 20, VBOX = 12;
  // A soft round dot: a radial gradient, so near particles do not draw as hard squares.
  const cv = document.createElement('canvas'); cv.width = cv.height = 16;
  const cx = cv.getContext('2d'), gr = cx.createRadialGradient(8, 8, 0, 8, 8, 8);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  cx.fillStyle = gr; cx.fillRect(0, 0, 16, 16);
  const dot = new THREE.CanvasTexture(cv);

  // pool(n): positions (absolute) and a per-particle phase and speed.
  function pool(n, mat) {
    const pos = new Float32Array(n * 3), ph = new Float32Array(n), sp = new Float32Array(n);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false; pts.renderOrder = 3; pts.visible = false; scene.add(pts);   // after the water (1)
    for (let i = 0; i < n; i++) { ph[i] = Math.random() * 100; sp[i] = 0.6 + Math.random() * 0.8; }
    return { n, pos, ph, sp, geo, pts };
  }
  const flakes = pool(NFLAKE, new THREE.PointsMaterial({ color: 0x9a8b82, size: 0.1, map: dot, transparent: true,
    opacity: 0.85, depthWrite: false }));
  const emberCol = new Float32Array(NEMBER * 3);
  const embers = pool(NEMBER, new THREE.PointsMaterial({ size: 0.11, map: dot, vertexColors: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  embers.geo.setAttribute('color', new THREE.BufferAttribute(emberCol, 3));

  let seeded = false, t = 0;
  // Scatter a pool through the whole box around the camera.
  function scatter(p) {
    const c = camera.position;
    for (let i = 0; i < p.n; i++) {
      p.pos[i * 3] = c.x + (Math.random() * 2 - 1) * BOX;
      p.pos[i * 3 + 1] = c.y + (Math.random() * 2 - 1) * VBOX;
      p.pos[i * 3 + 2] = c.z + (Math.random() * 2 - 1) * BOX;
    }
  }
  // Wrap v into [c - r, c + r).
  const wrap = (v, c, r) => c - r + ((((v - c + r) % (2 * r)) + 2 * r) % (2 * r));

  // Move pool p by its fall speed `fall` (blocks/s, negative rises) and the wind.
  function move(p, dt, fall, wx, wz, flutter) {
    const c = camera.position;
    for (let i = 0; i < p.n; i++) {
      const q = i * 3, w = t * p.sp[i] + p.ph[i];
      p.pos[q] = wrap(p.pos[q] + (wx + Math.sin(w * 1.3) * flutter) * dt, c.x, BOX);
      p.pos[q + 1] = wrap(p.pos[q + 1] - fall * p.sp[i] * dt, c.y, VBOX);
      p.pos[q + 2] = wrap(p.pos[q + 2] + (wz + Math.cos(w * 1.1) * flutter) * dt, c.z, BOX);
    }
    p.geo.attributes.position.needsUpdate = true;
  }

  function update(dt) {
    const on = realm.current === 'ember' && !player.headInWater && !player.headInLava;
    flakes.pts.visible = embers.pts.visible = on;
    if (!on) { seeded = false; return; }
    if (!seeded) { scatter(flakes); scatter(embers); seeded = true; }
    t += dt;
    const wx = Math.sin(t * 0.07) * 0.6, wz = Math.cos(t * 0.05) * 0.6;   // the slow wind
    move(flakes, dt, 0.45, wx, wz, 0.35);
    move(embers, dt, -0.35, wx * 0.5, wz * 0.5, 0.25);
    // ember color: orange HDR, a flicker, and a fade to 0 at the box edge
    const c = camera.position;
    for (let i = 0; i < NEMBER; i++) {
      const q = i * 3, dist = Math.hypot(embers.pos[q] - c.x, embers.pos[q + 1] - c.y, embers.pos[q + 2] - c.z);
      const b = (0.9 + 0.6 * Math.sin(t * 7 * embers.sp[i] + embers.ph[i])) * (1 - THREE.MathUtils.smoothstep(dist, BOX * 0.5, BOX)) * 2.2;
      emberCol[q] = b; emberCol[q + 1] = 0.42 * b; emberCol[q + 2] = 0.1 * b;
    }
    embers.geo.attributes.color.needsUpdate = true;
  }
  return {
    update,
    get visible() { return flakes.pts.visible; },
    // For tests: the mean offset of the flakes from the camera, and their bounds around it.
    spread() {
      const c = camera.position, p = flakes.pos; let my = 0, mx = 0;
      for (let i = 0; i < NFLAKE; i++) { mx = Math.max(mx, Math.abs(p[i * 3] - c.x), Math.abs(p[i * 3 + 2] - c.z)); my = Math.max(my, Math.abs(p[i * 3 + 1] - c.y)); }
      return { n: NFLAKE + NEMBER, box: mx, vbox: my, first: [p[0], p[1], p[2]] };
    },
    N: NFLAKE + NEMBER,
  };
})();

export { ash };
