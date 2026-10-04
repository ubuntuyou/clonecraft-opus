/* =====================================================================================
 * boss.js — the Jewel Titan fight (SPEC_realms Phase 6). Living header.
 * -------------------------------------------------------------------------------------
 * The arena: worldgen puts 6 pillars on the ring of radius 26 around the Crystal Realm origin.
 * A Resonance Pylon (B.PYLON) sits on each pillar top (WG.PYLONS). A pylon is a plain block, so a
 * broken pylon is a block override and stays broken with no extra state. A pylon cell in an
 * unloaded chunk counts as standing.
 *
 * The boss is class Titan, a Mob in `mobs[]`. Melee, arrows, and the crosshair reach it like any
 * mob. Its stats and model are MOB_TYPES.titan (mobs.js). Titan replaces Mob.update:
 *  - 'sleep': it hovers at HOME. It wakes when the player comes within WAKE_R of the center.
 *  - 'fight': phase 1 while any pylon stands (shielded, 3-shard fan every 3 s). Phase 2 with no
 *    pylon and HP above 50 % (hunts at 2.5, slams, 3-shard fan every 4 s). Phase 3 at 50 % or
 *    below (hunts at 3.5, slams, 5-shard fan every 3 s, 2 Shardlings every 12 s, 4 alive at most).
 *    At SLEEP_R or more from the center, it returns to HOME and sleeps again. It keeps its HP.
 *  - 'slam': it rises for SLAM_WARN s over a particle ring of radius SLAM_R on the floor, then
 *    drops. A shockwave ring then runs out along the floor to SLAM_R (shockwave()). It hits a
 *    player on the floor as its edge passes, so a jump over the edge avoids it.
 *  - 'dying': it spins and cracks for DEATH_T s, then shatters, drops its loot, and builds the
 *    exit portal (built lit) at the arena center.
 * Sounds (audio.js): a roar when it wakes and when the phase rises (a deeper one into phase 3),
 * a shard ping per fan, a rising whine through the slam warning, a boom when the slam lands, and a
 * crystal shatter for each broken pylon and for the death.
 * A fight resets on the player's death (full HP, Shardlings gone, sleep, the toast may show again).
 * Leaving the realm clears `mobs[]` (realm.enter), so the next visit spawns a fresh boss.
 *
 * `boss.update(dt)` spawns the boss when the Crystal Realm is current, the save has no kill
 * (realm.boss.defeated), and the center chunk is lit. It also draws the pylon beams, drives the
 * boss bar (hud.bossBar), and shows the victory screen once the kill ends.
 * ===================================================================================== */
import { THREE } from './three.js';
import { randRange, UNLOADED } from './config.js';
import { B } from './blocks.js';
import { WG } from './gen-service.js';
import { game, player, scene, world } from './engine.js';
import { damagePlayer } from './player.js';
import { moveEntity } from './collision.js';
import { spawnDrop } from './drops.js';
import { angleLerp, Mob, MOB_TYPES, mobs } from './mobs.js';
import { projectiles } from './projectiles.js';
import { particles } from './particles.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { showVictory } from './menus.js';
import { persist } from './persist.js';
import { realm } from './realms.js';
import { portals } from './portals.js';

const FLOOR = WG.CRYSTAL_TOP + 1;            // the y of the arena floor surface (97)
const HOVER = 2;                             // the boss floats this many blocks above the floor
const HOME = new THREE.Vector3(0.5, FLOOR + HOVER, 0.5);
const WAKE_R = 32, SLEEP_R = 64, ROAM_R = 38;
const SHARD_DMG = 4, SLAM_DMG = 8, SLAM_R = 4, SLAM_NEAR = 5, SLAM_WARN = 0.8, SLAM_CD = 2.5, SLAM_RISE = 1.6;
// The slam shockwave: a ring on the floor that grows from the boss's rim (WAVE_R0) to SLAM_R at
// WAVE_SPEED blocks per s. It hits a player whose feet are below FLOOR + WAVE_H as its edge passes.
const WAVE_R0 = 1.2, WAVE_SPEED = 6, WAVE_H = 0.6;
const FAN = { 1: [3, 3], 2: [3, 4], 3: [5, 3] };   // phase -> [shards per fan, seconds between fans]
const SPEED = { 2: 2.5, 3: 3.5 };
const SUMMON_T = 12, SUMMON_N = 2, SHARDLINGS_MAX = 4;
const DEATH_T = 3;
// The exit portal: an opening 3 wide and 4 tall (like the arrival portal) in the plane z = 0.
const EXIT = { x0: -1, y0: FLOOR, z: 0, w: 3, h: 4 };
const PYLONS = WG.PYLONS;

const pylonStands = ([x, y, z]) => { const id = world.getBlock(x, y, z); return id === B.PYLON || id === UNLOADED; };
const standingPylons = () => PYLONS.filter(pylonStands);
const shardlings = () => mobs.filter((m) => m.type === 'shardling' && !m.dead);

class Titan extends Mob {
  constructor() {
    super('titan', HOME.x, HOME.y, HOME.z);
    this.state = 'sleep';
    this.toasted = false;                       // "The pylons shield it" shows once per fight
    this.fanT = 3; this.summonT = SUMMON_T; this.slamT = 0; this.slamCD = 0; this.shieldT = 0; this.crackT = 0;
    this.wave = null;                            // the live slam shockwave, or null
    this.yaw = Math.PI;                          // it faces the arrival portal (+z)
    this.phase = 1;
    this.lastPhase = 1;                         // a rise above it while awake roars
    // the shield: a faint turquoise shell while a pylon stands; it flashes when a hit lands
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({
      color: 0x7ff6ea, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.shield.scale.set(2.2, 3, 2.2); this.shield.position.y = 2.4;
    this.group.add(this.shield);   // not in this.mats: paint() would overwrite its color
  }

  remove() { super.remove(); this.shield.material.dispose(); }

  // Resets the fight: full HP, sleep at HOME, the toast may show again.
  reset() {
    this.hp = this.def.hp; boss.hp = null; this.state = 'sleep'; this.toasted = false;
    this.fanT = 3; this.summonT = SUMMON_T; this.slamCD = 0; this.wave = null;
    this.pos.copy(HOME); this.vel.set(0, 0, 0);
  }

  hurt(dmg) {
    if (this.dead || this.state === 'dying' || this.invuln > 0) return;
    this.invuln = 0.5;
    if (this.state === 'sleep') this.wake();
    if (this.phase === 1) {
      this.shieldT = 0.4;
      audio.dig('glass', 0.8, this.pos.x, this.pos.y + 2, this.pos.z);
      if (!this.toasted) { this.toasted = true; hud.toast('The pylons shield it'); }
      return;
    }
    this.hp -= dmg; this.hurtT = 0.3;
    audio.armorHit();
    particles.crystalBurst(this.pos.x, this.pos.y + 2.5, this.pos.z, 6, 2);
    if (this.hp <= 0) { this.hp = 0; this.state = 'dying'; this.deathT = 0; this.vel.set(0, 0, 0); }
  }

  wake() { this.state = 'fight'; audio.roar(); }

  // A fan of n shards at the player's chest, spread over the horizontal plane.
  fan(n) {
    const p = player, ex = this.pos.x, ey = this.pos.y + 2.7, ez = this.pos.z;
    const tx = p.pos.x - ex, ty = p.pos.y + 1.1 - ey, tz = p.pos.z - ez, d = Math.hypot(tx, tz) || 1;
    const yaw = Math.atan2(tx, tz), pitch = Math.atan2(ty, d), step = n > 3 ? 0.2 : 0.24;
    for (let i = 0; i < n; i++) {
      const a = yaw + (i - (n - 1) / 2) * step;
      const dx = Math.sin(a) * Math.cos(pitch), dy = Math.sin(pitch), dz = Math.cos(a) * Math.cos(pitch);
      projectiles.shard(ex + dx * 1.6, ey + dy * 1.6, ez + dz * 1.6, dx, dy, dz, SHARD_DMG, this);
    }
    particles.crystalBurst(ex, ey, ez, 8, 2);
    audio.shard({ x: ex, y: ey, z: ez }, n);
    this.armT = 0.4;
  }

  summon() {
    const n = Math.min(SUMMON_N, SHARDLINGS_MAX - shardlings().length);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, x = this.pos.x + Math.sin(a) * 2.5, z = this.pos.z + Math.cos(a) * 2.5;
      const m = new Mob('shardling', x, FLOOR + 0.5, z);
      m.angry = true; mobs.push(m);
      particles.crystalBurst(x, FLOOR + 0.5, z, 14, 3);
    }
    if (n > 0) audio.enchant(0.6);
  }

  // The slam lands. The damage is the shockwave (shockwave()), which starts at the boss's rim now.
  slam() {
    particles.crystalBurst(this.pos.x, FLOOR + 0.3, this.pos.z, 24, 3);
    audio.slam({ x: this.pos.x, y: FLOOR, z: this.pos.z });
    this.wave = { x: this.pos.x, z: this.pos.z, prev: -1, r: WAVE_R0, hit: false };
    this.shockwave(0);
  }

  // The shockwave ring. Its sparks are drawn at the hit edge each frame, so the ring the player sees
  // is the ring that hits. It hits once, when the edge passes a player on the floor. A jump over the
  // edge, or a step outside SLAM_R, avoids it.
  shockwave(dt) {
    const w = this.wave, p = player;
    if (dt > 0) { w.prev = w.r; w.r = Math.min(SLAM_R, w.r + WAVE_SPEED * dt); }
    const n = Math.ceil(w.r * 7);
    for (let i = 0; i < n; i++) {
      const a = (i + Math.random()) / n * Math.PI * 2;
      particles.crystalSpark(w.x + Math.sin(a) * w.r, FLOOR + 0.15, w.z + Math.cos(a) * w.r, 0, randRange(0.6, 1.8), 0, 0.2, 0.13);
    }
    const dx = p.pos.x - w.x, dz = p.pos.z - w.z, d = Math.hypot(dx, dz);
    const onFloor = p.pos.y < FLOOR + WAVE_H && p.pos.y > FLOOR - 2;
    if (!w.hit && !p.dead && onFloor && d > w.prev && d <= w.r) {
      w.hit = true;
      const h0 = p.health, inv0 = p.invuln;
      damagePlayer(SLAM_DMG, this.def.kill, this.pos, 'slam');
      if (p.health < h0 || (p.dead && inv0 <= 0)) {   // a strong knockback on top of damagePlayer's push
        const k = d || 1;
        p.vel.x += dx / k * 9; p.vel.z += dz / k * 9; p.vel.y = Math.max(p.vel.y, 9);
      }
    }
    if (w.r >= SLAM_R) this.wave = null;
  }

  update(dt) {
    this.age += dt;
    const c = world.chunkAt(Math.floor(this.pos.x), Math.floor(this.pos.z));
    if (!c || !c.lit) return true;               // frozen until its terrain is back
    this.invuln -= dt; this.hurtT -= dt; this.shieldT -= dt; this.armT -= dt; this.slamCD -= dt;
    const p = player, standing = standingPylons().length;
    this.phase = standing > 0 ? 1 : this.hp > this.def.hp / 2 ? 2 : 3;
    if (this.phase > this.lastPhase && this.state !== 'sleep' && this.state !== 'dying') audio.roar(this.phase === 3);
    this.lastPhase = this.phase;
    const cx = p.pos.x - HOME.x, cz = p.pos.z - HOME.z, fromCenter = Math.hypot(cx, cz);
    const dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z, dist = Math.hypot(dx, dz);
    let ty = HOME.y, mx = 0, mz = 0, speed = 0, face = null;

    if (this.wave) { if (this.state === 'dying') this.wave = null; else this.shockwave(dt); }
    if (this.state === 'dying') return this.dying(dt);
    if (this.state === 'sleep') {
      if (!p.dead && fromCenter < WAKE_R) this.wake();
      mx = HOME.x - this.pos.x; mz = HOME.z - this.pos.z; speed = Math.min(2.5, Math.hypot(mx, mz) * 2);
    } else if (fromCenter >= SLEEP_R) {
      this.state = 'sleep';
    } else {
      // the fan and summon timers run in 'fight' and in 'slam', so a slam never delays them
      const [n, every] = FAN[this.phase];
      if ((this.fanT -= dt) <= 0 && !p.dead) { this.fan(n); this.fanT = every; }
      if (this.phase === 3 && (this.summonT -= dt) <= 0) { this.summon(); this.summonT = SUMMON_T; }
    }
    if (this.state === 'slam') {
      this.slamT += dt;
      ty = HOME.y + SLAM_RISE * Math.min(1, this.slamT / SLAM_WARN);
      face = Math.atan2(dx, dz);
      if (Math.random() < dt * 60) {   // the warning ring on the floor
        const a = Math.random() * Math.PI * 2;
        particles.crystalSpark(this.pos.x + Math.sin(a) * SLAM_R, FLOOR + 0.1, this.pos.z + Math.cos(a) * SLAM_R, 0, randRange(0.5, 1.5), 0, 0.5, 0.12);
      }
      if (this.slamT >= SLAM_WARN) {
        this.pos.y = FLOOR + 0.2; this.vel.y = 0;
        this.slam();
        this.state = 'fight'; this.slamCD = SLAM_CD;
      }
    } else if (this.state === 'fight') {
      face = Math.atan2(dx, dz);
      if (this.phase === 1) {
        mx = HOME.x - this.pos.x; mz = HOME.z - this.pos.z; speed = Math.min(2.5, Math.hypot(mx, mz) * 2);
      } else {
        speed = SPEED[this.phase];
        if (dist > 2.5) { mx = dx; mz = dz; }
        const onFloor = p.pos.y < FLOOR + 3 && p.pos.y > FLOOR - 2;   // the slam reaches only the floor
        if (dist < SLAM_NEAR && onFloor && this.slamCD <= 0 && !p.dead) { this.state = 'slam'; this.slamT = 0; audio.slamCharge({ x: this.pos.x, y: this.pos.y + 2, z: this.pos.z }, SLAM_WARN); }
      }
    }

    // ---- motion: steer at `speed`, stay over the arena, hover at `ty`
    const md = Math.hypot(mx, mz);
    if (md > 0.05) { mx /= md; mz /= md; } else mx = mz = 0;
    const nx = this.pos.x + mx, nz = this.pos.z + mz;
    if (Math.hypot(nx - HOME.x, nz - HOME.z) > ROAM_R) mx = mz = 0;
    const a = 1 - Math.exp(-4 * dt);
    this.vel.x += (mx * speed - this.vel.x) * a;
    this.vel.z += (mz * speed - this.vel.z) * a;
    if (this.state !== 'slam' || this.slamT < SLAM_WARN) {
      const vy = Math.max(-4, Math.min(4, (ty - this.pos.y) * 3)) + Math.sin(this.age * 1.6) * 0.25;
      this.vel.y += (vy - this.vel.y) * Math.min(1, dt * 4);
    }
    if (this.hitWall && md > 0.05) this.vel.y = Math.max(this.vel.y, 3);
    moveEntity(this, dt);

    // ---- animation
    if (face !== null) this.yaw = angleLerp(this.yaw, face, Math.min(1, dt * 3));
    else if (Math.hypot(this.vel.x, this.vel.z) > 0.3) this.yaw = angleLerp(this.yaw, Math.atan2(this.vel.x, this.vel.z), Math.min(1, dt * 3));
    const P = this.parts;
    P.orbit.rotation.y += dt * (this.phase === 3 ? 2.4 : 1.2);
    const lift = this.state === 'slam' ? Math.min(1, this.slamT / SLAM_WARN) : 0;
    P.arms.forEach((ar, i) => {
      ar.rotation.x = -lift * 2.6 + Math.sin(this.age * 1.3 + i * Math.PI) * 0.08 - (this.armT > 0 ? Math.sin(this.armT / 0.4 * Math.PI) * 0.7 : 0);
      ar.rotation.z = (i ? -1 : 1) * (0.08 + lift * 0.2);
    });
    P.head.rotation.x = this.state === 'sleep' ? 0.35 : 0;
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    const sh = this.shield.material;
    sh.opacity = this.phase === 1 ? (this.shieldT > 0 ? 0.25 + this.shieldT : 0.07 + Math.sin(this.age * 3) * 0.03) : 0;
    const k = this.state === 'sleep' ? 0.7 : 1;
    if (this.hurtT > 0) this.paint(1.25, 0.55, 0.7); else this.paint(k, k, k);
    if (Math.random() < dt * 8) particles.crystalSpark(this.pos.x + randRange(-1, 1), this.pos.y + randRange(0, 4), this.pos.z + randRange(-1, 1), 0, randRange(0.3, 0.9), 0, 1);
    return true;
  }

  // The death: DEATH_T s of spin and cracks with a growing light, then the shatter.
  dying(dt) {
    this.deathT += dt;
    const t = this.deathT / DEATH_T;
    this.vel.set(0, 0, 0);
    this.group.position.set(this.pos.x + randRange(-0.08, 0.08) * t, this.pos.y + t * 1.2, this.pos.z + randRange(-0.08, 0.08) * t);
    this.group.rotation.y += dt * (2 + t * 14);
    this.shield.material.opacity = t * 0.5;
    this.shield.scale.set(2.2 + t * 1.5, 3 + t * 1.5, 2.2 + t * 1.5);
    const flick = Math.random() < 0.3 + t * 0.5 ? 1.8 + t : 1;
    this.paint(flick, flick, flick * 1.1);
    if ((this.crackT -= dt) <= 0) {
      this.crackT = 0.25 - t * 0.17;
      particles.crystalBurst(this.pos.x, this.pos.y + randRange(1, 4), this.pos.z, 10 + t * 30, 3 + t * 4);
      audio.dig('glass', 0.6 + t * 0.6, this.pos.x, this.pos.y + 2, this.pos.z);
    }
    if (this.deathT < DEATH_T) return true;
    this.shatter();
    return false;
  }

  shatter() {
    const x = this.pos.x, y = this.pos.y + 2, z = this.pos.z;
    particles.crystalBurst(x, y, z, 160, 10);
    particles.explosion(x, y, z, 2);
    audio.shatter(x, y, z, true);
    for (const m of shardlings()) { m.dead = true; m.deathT = 0; }   // they fall and poof, with no drops
    // the loot lands in front of the exit portal (the arrival side, +z) when the boss dies near it
    const dz = Math.abs(x - 0.5) < 4 && Math.abs(z) < 3 ? 3.5 - z : 0;
    for (const [id, n] of this.def.drops()) if (n > 0) spawnDrop(id, n, x, FLOOR + 0.5, z + dz, null, 0.6);
    buildExitPortal();
    realm.boss.defeated = true;
    boss.victoryPending = true;
    persist.save();
  }
}

// The exit portal: a Crystal Frame ring around a 3 x 4 opening, built lit (portals.ignite fills the panes).
function buildExitPortal() {
  const E = EXIT, own = !world.batch;
  if (own) world.beginBatch();
  for (let v = -1; v <= E.h; v++) for (let u = -1; u <= E.w; u++) {
    const ring = u === -1 || u === E.w || v === -1 || v === E.h;
    world.setBlock(E.x0 + u, E.y0 + v, E.z, ring ? B.CRYSTAL_FRAME : B.AIR);
  }
  if (own) world.endBatch();
  const r = portals.ignite(E.x0 - 1, E.y0, E.z, B.PORTAL_CRYSTAL);
  if (r !== 'lit') console.warn(`exit portal: ignite returned ${r}`);
}

// ---- pylon beams: one additive box per pylon, from the pylon to the boss core
const beamGeo = new THREE.BoxGeometry(0.12, 0.12, 1);
beamGeo.translate(0, 0, 0.5);
const beamMat = new THREE.MeshBasicMaterial({ color: 0x8ff8ee, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
const beams = PYLONS.map(() => { const m = new THREE.Mesh(beamGeo, beamMat); m.visible = false; m.frustumCulled = false; scene.add(m); return m; });
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const pylonWas = PYLONS.map(() => null);   // each pylon cell's id last frame (null outside the Crystal Realm)

const boss = {
  titan: null,               // the live Titan, or null
  hp: null,                  // the HP of a boss whose chunk unloaded; the next spawn keeps it
  victoryPending: false,     // the kill ended; the victory screen waits for the 'playing' state
  wasDead: false,
  HOME, PYLONS, EXIT, WAKE_R, SLEEP_R,
  get pylonsStanding() { return standingPylons().length; },

  update(dt) {
    const crystal = realm.current === 'crystal';
    if (this.titan && !mobs.includes(this.titan)) this.titan = null;   // realm.enter or a chunk unload removed it, or the death ended
    if (!crystal) this.hp = null;                                 // a new visit starts a full fight
    if (crystal && !realm.boss.defeated && !this.titan) {
      const c = world.chunkAt(Math.floor(HOME.x), Math.floor(HOME.z));
      if (c && c.lit) { this.titan = new Titan(); if (this.hp) this.titan.hp = this.hp; mobs.push(this.titan); }
    }
    if (this.titan && this.titan.state !== 'dying') this.hp = this.titan.hp;
    const titan = this.titan;
    // the player's death resets the fight
    if (player.dead && !this.wasDead && titan && titan.state !== 'dying') {
      titan.reset();
      for (const m of shardlings()) { particles.crystalBurst(m.pos.x, m.pos.y + 0.3, m.pos.z, 8, 2); m.remove(); mobs.splice(mobs.indexOf(m), 1); }
    }
    this.wasDead = player.dead;
    // the beams
    const alive = titan && titan.state !== 'dying';
    PYLONS.forEach(([x, y, z], i) => {
      const id = crystal ? world.getBlock(x, y, z) : null;
      // a pylon that was standing and is now gone (an arrow, a hit, or an explosion) shatters
      if (pylonWas[i] === B.PYLON && id !== B.PYLON && id !== UNLOADED && id !== null) audio.shatter(x + 0.5, y + 0.5, z + 0.5);
      pylonWas[i] = id;
      const b = beams[i], on = alive && id === B.PYLON;
      b.visible = !!on;
      if (!on) return;
      _a.set(x + 0.5, y + 0.5, z + 0.5);
      _b.set(titan.group.position.x, titan.group.position.y + 2.7, titan.group.position.z);
      b.position.copy(_a); b.lookAt(_b);
      const len = _a.distanceTo(_b), w = 1 + Math.sin(game.clock * 6 + i) * 0.25;
      b.scale.set(w, w, len);
      if (dt > 0 && Math.random() < dt * 6) {
        const t = Math.random();
        particles.crystalSpark(_a.x + (_b.x - _a.x) * t, _a.y + (_b.y - _a.y) * t, _a.z + (_b.z - _a.z) * t, 0, 0.3, 0, 0.5, 0.07);
      }
    });
    // the boss bar: it shows while the boss is awake and the player is within SLEEP_R of the center
    const p = player, near = Math.hypot(p.pos.x - HOME.x, p.pos.z - HOME.z) < SLEEP_R;
    if (crystal && titan && near && titan.state !== 'sleep') hud.bossBar(titan.hp / titan.def.hp, titan.phase === 1);
    else hud.bossBar(null);
    // the victory screen, once the kill has ended and no other screen shows
    if (this.victoryPending && game.state === 'playing' && !p.dead) { this.victoryPending = false; showVictory(); }
  },
};

export { boss, Titan };
