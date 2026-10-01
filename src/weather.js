// ---- weather (Batch 18) ---------------------------------------------------------------------
// The weather is global: 'clear' (300..900 s) or 'rain' (120..360 s); 1 rain spell in 3 is a 'storm'.
// `k` (0..1) follows the rain and `storm` (0..1) follows the storm, each over FADE s. The sky dims
// daylight to 0.75x in rain and 0.55x in a storm, greys the sky and clouds, and pulls the fog 30% in.
// The precipitation depends on the biome and the height: none in a desert, snow at every height in
// snowy biomes. Elsewhere the drop's height decides: snow at or above MELT (SNOW_LINE + 1), rain below
// it, so a slope or a treetop never mixes the two. A drop never falls below the top non-air block of
// its column, so roofs, trees, and caves stay dry. In a storm a bolt strikes every 5..20 s within 64 blocks. It deals 5 to
// the player and mobs within 3 blocks and lights nothing. Thunder follows at THUNDER_SPEED blocks/s.
import { THREE } from './three.js';
import { clamp, CS, H, lidx, randRange } from './config.js';
import { B } from './blocks.js';
import { BIOME } from './biomes.js';
import { WG } from './gen-service.js';
import { camera, game, player, scene, world } from './engine.js';
import { damagePlayer } from './player.js';
import { mobs } from './mobs.js';
import { audio } from './audio.js';

const weather = (() => {
  const RADIUS = 24, FADE = 6, BOLT_RANGE = 64, THUNDER_SPEED = 34, NRAIN = 2600, NSNOW = 1100, STREAK = 1.3;
  let kind = 'clear', left = randRange(300, 900), k = 0, storm = 0, boltT = randRange(5, 20), flash = 0;
  const KINDS = ['clear', 'rain', 'storm'];
  // Column queries against the loaded chunks. top: the highest non-air block, or -1 when unloaded.
  function top(x, z) {
    const c = world.chunkAt(x, z);
    if (!c || !c.lit) return -1;
    const lx = x & 15, lz = z & 15;
    for (let y = H - 1; y > 0; y--) if (c.blocks[lidx(lx, y, lz)] !== B.AIR) return y;
    return 0;
  }
  // The zone of column (x, z): -1 unloaded, 0 dry (desert), 1 by height (snow at or above MELT, rain
  // below), 2 snow (snowy biomes).
  function zone(x, z) {
    const c = world.chunkAt(x, z);
    if (!c) return -1;
    const b = c.biomes[(z & 15) * CS + (x & 15)];
    return b === BIOME.DESERT ? 0 : b === BIOME.SNOWY_PLAINS || b === BIOME.SNOWY_MOUNTAINS ? 2 : 1;
  }
  const melt = () => WG.SNOW_LINE + 1;
  // What lands on the top block t of column (x, z): 0 none, 1 rain, 2 snow.
  function precip(x, z, t) {
    if (t < 0) return 0;
    const zn = zone(x, z);
    return zn === 1 ? (t + 1 >= melt() ? 2 : 1) : Math.max(0, zn);
  }
  // The floor of a snow flake in column (x, z) with top block t: the top, or MELT in zone 1.
  // Returns -1 when no snow falls in the column.
  function snowFloor(x, z, t) {
    const zn = t < 0 ? -1 : zone(x, z);
    return zn === 2 ? t + 1 : zn === 1 ? Math.max(t + 1, melt()) : -1;
  }

  // Particle pools: rain as line streaks, snow as points. Each drop stores x, y, z, its floor, and a phase.
  const group = new THREE.Group(); group.visible = false; scene.add(group);
  // A soft round flake: a radial gradient, so near flakes do not draw as hard squares.
  const flakeCv = document.createElement('canvas'); flakeCv.width = flakeCv.height = 16;
  const fctx = flakeCv.getContext('2d'), fg = fctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  fg.addColorStop(0, 'rgba(255,255,255,1)'); fg.addColorStop(0.5, 'rgba(255,255,255,0.85)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
  fctx.fillStyle = fg; fctx.fillRect(0, 0, 16, 16);
  const flakeTex = new THREE.CanvasTexture(flakeCv);
  function pool(n, snow) {
    const d = new Float32Array(n * 5), pos = new Float32Array(n * (snow ? 3 : 6)).fill(-9999);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = snow ? new THREE.PointsMaterial({ color: 0xffffff, map: flakeTex, size: 0.16, transparent: true, opacity: 0.95, depthWrite: false })
      : new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, depthWrite: false });
    const obj = snow ? new THREE.Points(g, mat) : new THREE.LineSegments(g, mat);
    obj.frustumCulled = false; group.add(obj);
    for (let i = 0; i < n; i++) d[i * 5 + 3] = 1e9;   // floor above everything: respawn on the first frame
    return { n, d, pos, g, mat, snow };
  }
  const rain = pool(NRAIN, false), snow = pool(NSNOW, true);
  // A new drop in the disc around the camera, from `y0` up by `span`. Returns false when the drop's
  // kind cannot fall there: rain only below MELT, snow only above its floor.
  function spawn(P, i, y0, span) {
    const cp = camera.position, a = Math.random() * Math.PI * 2, r = RADIUS * Math.random();   // denser near the camera
    const x = cp.x + Math.cos(a) * r, z = cp.z + Math.sin(a) * r, ix = Math.floor(x), iz = Math.floor(z);
    const t = top(ix, iz), d = P.d, o = i * 5;
    let floor, y = y0 + Math.random() * span;
    if (P.snow) {
      floor = snowFloor(ix, iz, t);
      if (floor < 0 || y0 + span <= floor) return false;
    } else {
      if (t < 0 || zone(ix, iz) !== 1 || t + 1 >= melt()) return false;
      floor = t + 1; y = Math.min(y, melt());
    }
    d[o] = x; d[o + 1] = Math.max(floor, y); d[o + 2] = z; d[o + 3] = floor; d[o + 4] = Math.random() * 6.28;
    return true;
  }
  function stepPool(P, dt, active) {
    const cp = camera.position, d = P.d, pos = P.pos, fall = P.snow ? 1.6 : 20, stride = P.snow ? 3 : 6;
    for (let i = 0; i < P.n; i++) {
      const o = i * 5, q = i * stride;
      if (i >= active) { pos[q + 1] = -9999; if (!P.snow) pos[q + 4] = -9999; d[o + 3] = 1e9; continue; }
      d[o + 1] -= fall * dt * (P.snow ? 1 : 0.9 + 0.2 * ((i * 7) % 10) / 10);
      let moved = false;
      if (P.snow) {   // sway; a flake that drifts into another column takes that column's floor
        const cx = Math.floor(d[o]);
        d[o] += Math.sin(game.clock * 1.3 + d[o + 4]) * 0.5 * dt;
        if (Math.floor(d[o]) !== cx) {
          const nx = Math.floor(d[o]), nz = Math.floor(d[o + 2]), f = snowFloor(nx, nz, top(nx, nz));
          moved = f < 0; d[o + 3] = f;
        }
      }
      const far = Math.abs(d[o] - cp.x) > RADIUS + 2 || Math.abs(d[o + 2] - cp.z) > RADIUS + 2;
      if (moved || d[o + 1] <= d[o + 3] || d[o + 1] < cp.y - 14 || far) {
        const first = d[o + 3] > 1e8;
        if (!spawn(P, i, first ? cp.y - 12 : cp.y + 12, first ? 32 : 8)) { pos[q + 1] = -9999; if (!P.snow) pos[q + 4] = -9999; d[o + 3] = 1e9; continue; }
      }
      pos[q] = d[o]; pos[q + 1] = d[o + 1]; pos[q + 2] = d[o + 2];
      if (!P.snow) { pos[q + 3] = d[o] + 0.04; pos[q + 4] = d[o + 1] + STREAK; pos[q + 5] = d[o + 2]; }
    }
    P.g.attributes.position.needsUpdate = true;
  }

  // Lightning: a jagged bolt of thin boxes (HDR white for bloom), shown for 0.3 s, and a screen flash.
  const boltGeo = new THREE.BoxGeometry(1, 1, 1), boltMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
  boltGeo.userData.shared = true;
  const bolts = [];   // { group, t }
  const flashEl = document.createElement('div');
  flashEl.style.cssText = 'position:fixed;inset:0;background:#e4ecff;opacity:0;pointer-events:none;z-index:4';
  document.body.appendChild(flashEl);
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3();
  function segment(g, a, b, w) {
    const m = new THREE.Mesh(boltGeo, boltMat);
    _m.addVectors(a, b).multiplyScalar(0.5); m.position.copy(_m);
    m.scale.set(w, a.distanceTo(b) + w, w);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _b.subVectors(a, b).normalize());
    g.add(m);
  }
  function drawBolt(x, y, z) {
    const g = new THREE.Group();
    let p = new THREE.Vector3(x + 0.5, Math.min(H + 40, y + 70), z + 0.5);
    while (p.y > y) {
      const q = new THREE.Vector3(x + 0.5 + randRange(-2.5, 2.5), Math.max(y, p.y - randRange(3, 7)), z + 0.5 + randRange(-2.5, 2.5));
      if (q.y <= y) q.set(x + 0.5, y, z + 0.5);
      segment(g, p, q, 0.28);
      if (Math.random() < 0.3 && q.y > y + 8) {   // a short branch
        const e = q.clone().add(new THREE.Vector3(randRange(-5, 5), -randRange(4, 8), randRange(-5, 5)));
        segment(g, q, e, 0.14);
      }
      p = q;
    }
    scene.add(g);
    bolts.push({ group: g, t: 0.3 });
  }
  function thunder(dist) {
    const delay = dist / THUNDER_SPEED, v = 0.9 * Math.max(0.15, 1 - dist / 90);
    if (dist < 20) audio.noise({ ftype: 'highpass', f0: 2600, f1: 700, q: 0.6, dur: 0.35, vol: v * 0.8, delay });
    audio.noise({ ftype: 'lowpass', f0: 320, f1: 50, q: 0.8, dur: 2.8, vol: v, attack: 0.05, delay: delay + 0.05 });
    audio.noise({ ftype: 'lowpass', f0: 180, f1: 40, q: 0.8, dur: 3.6, vol: v * 0.7, attack: 0.3, delay: delay + 0.6 });
  }
  // A bolt at column (x, z). Returns the strike cell, or null when the column is not loaded.
  function strike(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    const t = top(x, z);
    if (t < 0) return null;
    const y = t + 1, cx = x + 0.5, cz = z + 0.5;
    drawBolt(x, y, z);
    const dist = Math.hypot(cx - camera.position.x, y - camera.position.y, cz - camera.position.z);
    flash = Math.max(flash, dist < 80 ? 1 - dist / 110 : 0.25);
    thunder(dist);
    const p = player.pos;
    if (Math.hypot(p.x - cx, p.y - y, p.z - cz) <= 3) damagePlayer(5, 'was struck by lightning', null, 'lightning');
    for (const m of mobs) if (!m.dead && Math.hypot(m.pos.x - cx, m.pos.y - y, m.pos.z - cz) <= 3) m.hurt(5, null);
    return { x, y, z };
  }

  // The rain loop: looped noise through a band filter. It plays under open sky and fades under a roof.
  let loop = null;
  function rainLoop(target) {
    if (!audio.ok()) { if (loop) loop.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2); return; }
    if (!loop) {
      const ctx = audio.ctx, s = ctx.createBufferSource(), lp = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), gain = ctx.createGain();
      s.buffer = audio.noiseBuf; s.loop = true;
      lp.type = 'lowpass'; lp.frequency.value = 2400; hp.type = 'highpass'; hp.frequency.value = 350; gain.gain.value = 0;
      s.connect(hp); hp.connect(lp); lp.connect(gain); gain.connect(audio.master); s.start();
      loop = { s, lp, gain };
    }
    const t = audio.ctx.currentTime;
    loop.gain.gain.setTargetAtTime(target, t, 0.6);
    loop.lp.frequency.setTargetAtTime(target > 0.1 ? 2400 : 700, t, 0.6);
  }

  function next() {
    if (kind === 'clear') { kind = Math.random() < 1 / 3 ? 'storm' : 'rain'; left = randRange(120, 360); }
    else { kind = 'clear'; left = randRange(300, 900); }
  }
  function update(dt) {
    if ((left -= dt) <= 0) next();
    const wet = kind === 'clear' ? 0 : 1, st = kind === 'storm' ? 1 : 0;
    k += clamp(wet - k, -dt / FADE, dt / FADE);
    storm += clamp(st - storm, -dt / FADE, dt / FADE);
    if (kind === 'storm' && storm > 0.5 && (boltT -= dt) <= 0) {
      boltT = randRange(5, 20);
      const a = Math.random() * Math.PI * 2, r = BOLT_RANGE * Math.sqrt(Math.random());
      strike(player.pos.x + Math.cos(a) * r, player.pos.z + Math.sin(a) * r);
    }
    flash = Math.max(0, flash - dt * 3.5);
    flashEl.style.opacity = (flash * 0.55).toFixed(3);
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i];
      b.group.visible = (b.t -= dt) > 0 && (b.t > 0.2 || Math.random() < 0.6);   // flicker in the last 0.1 s
      if (b.t <= 0) { scene.remove(b.group); bolts.splice(i, 1); }
    }
    // particles: a share of each pool by intensity (a storm uses the full pool)
    const under = player.headInWater || player.headInLava;
    group.visible = k > 0.01 && !under;
    if (group.visible) {
      const share = k * (0.7 + 0.3 * storm);
      stepPool(rain, dt, Math.round(NRAIN * share));
      stepPool(snow, dt, Math.round(NSNOW * share));
      const lum = 0.25 + 0.75 * game.daylight;
      rain.mat.color.setRGB(0.78 * lum, 0.84 * lum, 0.93 * lum);
      snow.mat.color.setScalar(0.35 + 0.65 * lum);
    }
    // sound: rain on the player's column; full under open sky, faint under a roof
    const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z), t = top(px, pz);
    const open = t < player.pos.y + 1.6;
    const raining = game.state === 'playing' && precip(px, pz, t) === 1;
    rainLoop(raining ? k * (0.22 + 0.12 * storm) * (open ? 1 : 0.18) : 0);
  }
  // True when rain or snow falls on column (x, z) now (mobs do not burn there).
  function wetAt(x, z) { return k > 0.3 && precip(x, z, top(x, z)) > 0; }
  function set(kn, seconds) {
    if (!KINDS.includes(kn)) throw new Error(`weather kind: ${KINDS.join(', ')}`);
    kind = kn; left = seconds > 0 ? seconds : kn === 'clear' ? randRange(300, 900) : randRange(120, 360);
    if (kn === 'storm') boltT = Math.min(boltT, 5);
  }
  return {
    update, set, strike, wetAt, precip, top, zone, melt,
    get kind() { return kind; }, get left() { return left; }, get k() { return k; }, get storm() { return storm; }, get flash() { return flash; },
    get dim() { return 1 - 0.25 * k - 0.2 * storm; },
    get rainGain() { return loop ? loop.gain.gain.value : 0; },   // for tests: the rain loop's current volume
    data() { return { kind, left }; },
    load(w) { if (!w) return; kind = w.kind; left = w.left; k = kind === 'clear' ? 0 : 1; storm = kind === 'storm' ? 1 : 0; },
    KINDS,
  };
})();

export { weather };
