/* =====================================================================================
 * === 17. DAY/NIGHT CYCLE AND SKY
 * -------------------------------------------------------------------------------------
 * dayTime runs 0..1 over CONFIG.dayLength seconds: 0 sunrise, 0.25 noon, 0.5 sunset,
 * 0.75 midnight. CONFIG.freezeTime stops the clock. The pause menu sets dayTime and the freeze.
 * The sun elevation drives daylight (4.5/15 .. 1), which scales baked sky
 * light in the terrain shader. The moon lights by night at half the sun's directional strength. The sky is a gradient dome with a sunset glow, a square
 * sun with a soft halo, a square moon, stars, and blocky clouds that drift. Everything in the sky group
 * follows the camera. Fog color is the sky horizon color, or deep blue underwater.
 * `weather` follows the sky. It fades k (wet) and storm over 6 s. The sky greys the dome and
 * clouds, fades the sun, moon, and stars, and closes the fog by k. game.daylight = clearDaylight
 * × weather.dim + the lightning flash. A drop never falls below the top block of its column.
 * ===================================================================================== */
import { THREE } from './three.js';
import { clamp, CONFIG, CS, glowGain, lerp, mulberry32, SEA, SEED } from './config.js';
import { terrainUniforms } from './terrain-material.js';
import { camera, game, player, renderer, scene } from './engine.js';
import { weather } from './order.js';

const sky = (() => {
  const group = new THREE.Group();
  scene.add(group);
  const uniforms = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color(1, 0.45, 0.15) }, uGlowAmt: { value: 0 }, uSunDir: { value: new THREE.Vector3() },
  };
  const dome = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uGlow; uniform float uGlowAmt; uniform vec3 uSunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -1.0, 1.0);
        vec3 c = mix(uHorizon, uTop, smoothstep(-0.02, 0.45, h));
        c = mix(c, uHorizon * 0.55, smoothstep(0.0, -0.35, h));           // darker below the horizon
        float g = pow(max(dot(d, uSunDir), 0.0), 6.0) * uGlowAmt * smoothstep(0.55, -0.05, h);
        gl_FragColor = vec4(mix(c, uGlow, clamp(g, 0.0, 1.0)), 1.0);
      }`,
  }));
  dome.renderOrder = -10; dome.frustumCulled = false;
  group.add(dome);

  // Sun and moon: a square disc with a rim inside a round soft glow (64 px), after `clonecraft-fable`.
  // Both use normal blending: an additive white disc takes the sky's hue through the HDR roll-off.
  function discTexture(core, rim, glow, glowEdge) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 6, 32, 32, 32);
    r.addColorStop(0, glow); r.addColorStop(1, glowEdge);
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    g.fillStyle = rim; g.fillRect(20, 20, 24, 24);
    g.fillStyle = core; g.fillRect(22, 22, 20, 20);
    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.NoColorSpace;
    return t;
  }
  const discMat = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false });
  const sun = new THREE.Mesh(new THREE.PlaneGeometry(115, 115),
    discMat(discTexture('#fffcea', '#ffffff', 'rgba(255,246,220,0.6)', 'rgba(255,230,170,0)')));
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(68, 68),
    discMat(discTexture('#f8fbff', '#ffffff', 'rgba(215,225,255,0.4)', 'rgba(200,210,255,0)')));
  const bodyMat = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  sun.renderOrder = moon.renderOrder = -9;
  group.add(sun, moon);
  // soft halo around the sun: a radial gradient, additive, strongest when the view faces it
  const haloTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    r.addColorStop(0, 'rgba(255,240,200,0.55)'); r.addColorStop(0.25, 'rgba(255,215,150,0.2)');
    r.addColorStop(0.6, 'rgba(255,190,120,0.05)'); r.addColorStop(1, 'rgba(255,180,100,0)');
    g.fillStyle = r; g.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
    return t;
  })();
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), bodyMat(haloTex));
  halo.renderOrder = -9;
  group.add(halo);

  // stars: random directions on the upper sphere, rotating with the sky
  const starGeo = new THREE.BufferGeometry(), sp = [], rng = mulberry32(1234);
  for (let i = 0; i < 1600; i++) {
    const u = rng() * 2 - 1, a = rng() * Math.PI * 2, r = Math.sqrt(1 - u * u);
    sp.push(Math.cos(a) * r * 850, u * 850, Math.sin(a) * r * 850);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  // Stars fade out just below the horizon: the sphere rotates, and the lower dome shows past the loaded terrain.
  const starMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0 }, uSize: { value: 2.2 } }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uSize; varying float vFade;
      void main() { vec4 wp = modelMatrix * vec4(position, 1.0);
        vFade = smoothstep(-0.02, 0.06, normalize(wp.xyz - cameraPosition).y);
        gl_Position = projectionMatrix * viewMatrix * wp; gl_PointSize = uSize; }`,
    fragmentShader: `uniform float uOpacity; varying float vFade;
      void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity * vFade); }`,
  });
  const stars = new THREE.Points(starGeo, starMat);
  // Stars draw after the clouds (renderOrder 2). The clouds write depth, so the depth test hides the stars behind them.
  stars.renderOrder = 2.5; stars.frustumCulled = false;
  group.add(stars);

  // blocky clouds: a periodic 64x64 cell mask, cells 12 blocks wide and 4 thick.
  // Four copies of one tile (2x2) keep the camera at least half a tile from any edge.
  const CN = 64, CELL = 12, CY = SEA + 64, CT = 4, TILE_W = CN * CELL;
  const mask = new Uint8Array(CN * CN);
  {
    const r = mulberry32(SEED ^ 0x51f15e);
    const base = new Float32Array(CN * CN).map(() => r());
    const at = (x, z) => base[((z + CN) % CN) * CN + ((x + CN) % CN)];
    for (let z = 0; z < CN; z++) for (let x = 0; x < CN; x++) {
      let s = 0;
      for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) s += at(x + dx, z + dz);
      mask[z * CN + x] = s / 25 + (r() - 0.5) * 0.12 > 0.54 ? 1 : 0;
    }
  }
  const cloudGeo = (() => {
    const pos = [], shade = [];
    const m = (x, z) => mask[((z + CN) % CN) * CN + ((x + CN) % CN)];
    const quad = (a, b, c, d, s) => { pos.push(...a, ...b, ...c, ...a, ...c, ...d); for (let i = 0; i < 6; i++) shade.push(s); };
    for (let z = 0; z < CN; z++) for (let x = 0; x < CN; x++) {
      if (!m(x, z)) continue;
      const x0 = x * CELL, x1 = x0 + CELL, z0 = z * CELL, z1 = z0 + CELL, y0 = 0, y1 = CT;
      quad([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], 1);
      quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], 0.7);
      if (!m(x + 1, z)) quad([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], 0.85);
      if (!m(x - 1, z)) quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], 0.85);
      if (!m(x, z + 1)) quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], 0.8);
      if (!m(x, z - 1)) quad([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], 0.8);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aShade', new THREE.Float32BufferAttribute(shade, 1));
    return g;
  })();
  const cloudUniforms = {
    uColor: { value: new THREE.Color(1, 1, 1) }, uFogColor: terrainUniforms.uFogColor,
    uNear: { value: 150 }, uFar: { value: 500 },
  };
  const cloudMat = new THREE.ShaderMaterial({
    uniforms: cloudUniforms, transparent: true, depthWrite: true,
    vertexShader: `attribute float aShade; varying float vShade; varying float vDist;
      void main() { vShade = aShade; vec4 mv = modelViewMatrix * vec4(position, 1.0); vDist = length(mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uFogColor; uniform float uNear; uniform float uFar;
      varying float vShade; varying float vDist;
      void main() { float f = smoothstep(uNear, uFar, vDist);
        gl_FragColor = vec4(mix(uColor * vShade, uFogColor, f), 0.82 * (1.0 - f * f)); }`,
  });
  const clouds = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(cloudGeo, cloudMat);
    m.position.set((i & 1) * TILE_W, 0, (i >> 1) * TILE_W);
    m.frustumCulled = false; m.renderOrder = 2;
    clouds.add(m);
  }
  scene.add(clouds);
  let drift = 0;

  const C = (r, g, b) => new THREE.Color(r, g, b);
  const DAY_TOP = C(0.42, 0.62, 1.0), DAY_HOR = C(0.72, 0.84, 1.0);
  const NIGHT_TOP = C(0.008, 0.01, 0.035), NIGHT_HOR = C(0.03, 0.04, 0.09);
  const SUNSET_HOR = C(0.95, 0.6, 0.4);
  const WATER_FOG = C(0.06, 0.16, 0.42), LAVA_FOG = C(0.85, 0.3, 0.04);
  const tmp = new THREE.Color(), sunDir = new THREE.Vector3(), tmpV = new THREE.Vector3();
  const NIGHT_DAYLIGHT = 4.5 / 15;   // moonlit sky light; mobs still spawn in the open (round(15 * 0.3) = 5 <= 7)

  function update(dt) {
    if (game.simulating() && !CONFIG.freezeTime) game.dayTime = (game.dayTime + dt / CONFIG.dayLength) % 1;
    const ang = game.dayTime * Math.PI * 2;
    sunDir.set(Math.cos(ang), Math.sin(ang), 0.25).normalize();
    const elev = sunDir.y;
    const day = THREE.MathUtils.smoothstep(elev, -0.18, 0.22);
    const wk = weather.k;
    game.clearDaylight = lerp(NIGHT_DAYLIGHT, 1, day);
    game.daylight = Math.min(1, game.clearDaylight * weather.dim + weather.flash * 0.5);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3);        // 1 at the horizon crossing

    uniforms.uTop.value.copy(NIGHT_TOP).lerp(DAY_TOP, day);
    uniforms.uHorizon.value.copy(NIGHT_HOR).lerp(DAY_HOR, day).lerp(SUNSET_HOR, dusk * 0.45 * (0.3 + day));
    uniforms.uSunDir.value.copy(sunDir);
    uniforms.uGlowAmt.value = dusk * 0.85 * (1 - wk);
    if (wk > 0) for (const c of [uniforms.uTop.value, uniforms.uHorizon.value]) {   // rain greys and darkens the sky
      const l = (c.r + c.g + c.b) / 3;
      c.lerp(tmp.setRGB(l, l, l * 1.04), 0.75 * wk).multiplyScalar(lerp(1, weather.dim, 0.9));
    }

    group.position.copy(camera.position);
    // lookAt takes a world-space target: face the camera (the group's centre), not the world origin,
    // or the discs turn edge-on as the player travels away from (0, 0)
    sun.position.copy(sunDir).multiplyScalar(700); sun.lookAt(camera.position);
    halo.position.copy(sunDir).multiplyScalar(690); halo.lookAt(camera.position);
    const facing = Math.max(0, camera.getWorldDirection(tmpV).dot(sunDir));
    halo.material.opacity = THREE.MathUtils.smoothstep(elev, -0.1, 0.1) * (0.45 + 0.55 * facing * facing) * (player.headInWater || player.headInLava ? 0 : 1) * (1 - wk);
    moon.position.copy(sunDir).multiplyScalar(-700); moon.lookAt(camera.position);
    sun.material.opacity = THREE.MathUtils.smoothstep(elev, -0.15, 0.05) * (1 - wk);
    sun.material.color.setScalar(glowGain * glowGain);      // 4 in HDR: a white-hot disc with a wide bloom
    moon.material.color.setScalar(glowGain);
    moon.material.opacity = THREE.MathUtils.smoothstep(-elev, -0.15, 0.05) * (1 - 0.9 * day) * (1 - wk);   // faint by day, as in Fable
    starMat.uniforms.uOpacity.value = clamp(1 - day * 1.6, 0, 1) * (1 - wk);
    starMat.uniforms.uSize.value = 2.2 * renderer.getPixelRatio();
    stars.visible = starMat.uniforms.uOpacity.value > 0.01;
    stars.rotation.z = ang; stars.rotation.x = 0.25;

    // sky light tint on the terrain: warm near sunrise/sunset, cool blue at night
    terrainUniforms.uDaylight.value = game.daylight;
    tmp.setRGB(0.62, 0.68, 1.0).lerp(C(1, 1, 1), day).lerp(C(1, 0.8, 0.62), dusk * 0.5);
    terrainUniforms.uSkyLight.value.copy(tmp);
    // directional term follows the sun by day and the moon (weaker) by night
    if (elev >= 0) terrainUniforms.uSunDir.value.copy(sunDir);
    else terrainUniforms.uSunDir.value.copy(sunDir).negate();
    terrainUniforms.uSunAmt.value = (elev >= 0 ? THREE.MathUtils.smoothstep(elev, 0, 0.25) : 0.5 * THREE.MathUtils.smoothstep(-elev, 0, 0.25)) * (1 - 0.8 * weather.k);
    terrainUniforms.uWet.value = weather.k;   // rain and storms soften the direct light, shadows, glitter, and caustics
    terrainUniforms.uTorch.value = 0.95 + Math.sin(game.clock * 11) * 0.02 + Math.sin(game.clock * 23.7) * 0.015 + (Math.random() - 0.5) * 0.02;
    terrainUniforms.uTime.value += dt;

    // fog: horizon color (blended toward the sun glow when facing it), or water fog
    const far = Math.max(24, (CONFIG.renderDistance - 0.5) * CS);
    const fog = terrainUniforms.uFogColor.value;
    if (player.headInLava) {
      fog.copy(LAVA_FOG);
      terrainUniforms.uFogNear.value = 0; terrainUniforms.uFogFar.value = 3;
    } else if (player.headInWater) {
      fog.copy(WATER_FOG).multiplyScalar(0.25 + 0.75 * game.daylight);
      terrainUniforms.uFogNear.value = 0; terrainUniforms.uFogFar.value = 22;
    } else {
      fog.copy(uniforms.uHorizon.value);
      const look = camera.getWorldDirection(new THREE.Vector3());
      const toward = Math.max(0, look.x * sunDir.x + look.z * sunDir.z) * dusk;
      fog.lerp(uniforms.uGlow.value, toward * 0.35);
      terrainUniforms.uFogNear.value = far * 0.55 * (1 - 0.3 * wk); terrainUniforms.uFogFar.value = far * (1 - 0.3 * wk);
    }
    scene.fog.color.copy(fog);
    scene.fog.near = terrainUniforms.uFogNear.value; scene.fog.far = terrainUniforms.uFogFar.value;
    renderer.setClearColor(fog);

    // clouds drift along +X; the periodic tile keeps the camera near its middle
    drift += dt * 1.6;
    const cp = camera.position;
    clouds.position.set(
      drift + Math.floor((cp.x - drift - TILE_W / 2) / TILE_W) * TILE_W, CY,
      Math.floor((cp.z - TILE_W / 2) / TILE_W) * TILE_W);
    const cb = 0.12 + 0.88 * day;
    cloudUniforms.uColor.value.setRGB(cb, cb, cb * 1.02).lerp(C(1, 0.75, 0.6), dusk * 0.35 * day)
      .lerp(tmp.setRGB(0.42, 0.44, 0.47).multiplyScalar(cb), 0.85 * wk);   // grey rain clouds
    cloudUniforms.uFar.value = Math.min(far * 2.6, TILE_W / 2); cloudUniforms.uNear.value = cloudUniforms.uFar.value * 0.4;
    clouds.visible = !player.headInWater && !player.headInLava;
  }
  return { update, sunDir };
})();

export { sky };
