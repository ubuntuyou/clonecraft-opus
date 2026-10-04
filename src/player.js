// ---- player: pointer lock, movement, health (section 9) ------------------------------------
// updatePlayer(dt) reads input and moves the player through moveEntity (walk, sprint, fly,
// swim, climb). A rider sits still; vehicles.seat() places it. updateCamera(dt) places the
// camera. damagePlayer, die, and respawn own health. The pointer-lock rules follow.
// A menu close (inventory, homes, pause by Esc) asks for a soft lock. On a refused soft lock
// the game stays in 'playing' and shows #resume; the next click on the canvas takes the lock.
// Esc: the menu closes on the keydown, and the lock request waits for the keyup (`escLock`).
// In Chrome and Brave (Joe's report), a lock taken on the Esc keydown ends at once.
// An unlock within 300 ms of a soft lock shows #resume, not the pause screen.
import {
  BOB_RATE, clamp, CLIMB_V, CONFIG, EYE, FLY_SPEED, FLY_V, GRAVITY, JUMP_V, LEAF_SPEED, ASH_SPEED, randRange,
  SPRINT_MULT, WALK_SPEED,
} from './config.js';
import { B, BLOCKS, CLIMB, enchLevel, IS_FARMLAND, IS_LAVA, IS_LEAF, IS_WATER } from './blocks.js';
import { camera, canvas, game, input, player, world } from './engine.js';
import {
  moveEntity, bow, primaryClick, useItem, farming, dropEverything, dropHeld, inv, selectSlot, closeInventory,
  inventoryKey, openInventory, vehicles, primeTnt, particles, audio, hud, fadeIn, setState, showPause,
  homesKey, openHomes, realm,
} from './order.js';

let lockSoft = false, escLock = false, softLockAt = -1e9, pausedAt = -1e9;
const resumeEl = document.getElementById('resume');   // $() is defined later
function lockRefused() {
  if (lockSoft && game.state === 'playing') resumeEl.style.display = 'block';
  else if (game.state !== 'dead' && game.state !== 'inventory' && game.state !== 'homes' && game.state !== 'travel') showPause();
}
function requestLock(soft) {
  lockSoft = !!soft;
  try {
    const p = canvas.requestPointerLock();
    if (p && p.catch) p.catch(lockRefused);
  } catch (e) { lockRefused(); }
}
document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    if (lockSoft) softLockAt = performance.now();
    lockSoft = false; resumeEl.style.display = 'none';
    if (game.state === 'paused' || game.state === 'menu' || game.state === 'inventory' || game.state === 'homes') setState('playing');
  } else {
    input.keys.clear(); input.mouseL = input.mouseR = false;
    if (game.state === 'playing') {
      if (performance.now() - softLockAt < 300) resumeEl.style.display = 'block';
      else showPause();
    }
  }
});
// Returns from a menu to the game. I and H are user gestures, so the lock request runs at once.
function resumeGame(viaEsc) {
  setState('playing');
  if (viaEsc) escLock = true;
  else requestLock(true);
}
document.addEventListener('pointerlockerror', lockRefused);

addEventListener('keydown', (e) => {
  if (e.code === 'F3') { e.preventDefault(); game.debug = !game.debug; return; }
  if (game.state === 'inventory') { inventoryKey(e); return; }
  if (game.state === 'homes') { homesKey(e); return; }
  if (game.state === 'paused' && e.code === 'Escape') {   // the 400 ms guard skips the Esc that paused the game
    e.preventDefault();
    if (!e.repeat && performance.now() - pausedAt > 400) resumeGame(true);
    return;
  }
  if (game.state !== 'playing') return;
  if (e.code === 'Escape' && document.pointerLockElement !== canvas) { if (!e.repeat && !escLock) showPause(); return; }   // from the resume hint
  if (e.code === 'Space' || e.code === 'Tab' || e.ctrlKey || e.code.startsWith('Arrow')) e.preventDefault();
  input.keys.add(e.code);
  if (e.code === 'KeyW' && !e.repeat) {
    const now = performance.now();
    if (now - input.lastWTap < 280) input.wSprint = true;
    input.lastWTap = now;
  }
  if (e.code === 'KeyK' && !e.repeat) setFlying(!player.flying);
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat && player.vehicle) vehicles.dismount();
  if (e.code.startsWith('Digit')) { const n = +e.code.slice(5); if (n >= 1 && n <= 9) selectSlot(n - 1); }
  if (e.code === 'KeyI' && !e.repeat) openInventory(false);
  if (e.code === 'KeyQ' && !e.repeat) dropHeld(false);
  if (e.code === 'KeyH' && !e.repeat) openHomes();
});
addEventListener('keyup', (e) => {
  if (e.code === 'Escape' && escLock) {
    escLock = false;
    if (game.state === 'playing' && document.pointerLockElement !== canvas) requestLock(true);
  }
  input.keys.delete(e.code);
  if (e.code === 'KeyW') input.wSprint = false;
});
addEventListener('blur', () => { input.keys.clear(); input.mouseL = input.mouseR = false; });
document.addEventListener('mousemove', (e) => {
  if (game.state !== 'playing' || document.pointerLockElement !== canvas) return;
  const mx = clamp(e.movementX, -250, 250), my = clamp(e.movementY, -250, 250);   // drop lock-time spikes
  const k = 0.0022 * CONFIG.sensitivity;
  player.yaw -= mx * k;
  player.pitch = clamp(player.pitch - my * k, -Math.PI / 2 + 0.001, Math.PI / 2 - 0.001);
  player.mouseDX += mx; player.mouseDY += my;
});
canvas.addEventListener('mousedown', (e) => {
  if (game.state === 'playing' && document.pointerLockElement !== canvas) { requestLock(true); return; }   // the resume click
  if (game.state !== 'playing' || document.pointerLockElement !== canvas) return;
  audio.init();
  if (e.button === 0) { input.mouseL = true; primaryClick(); }
  if (e.button === 2) { input.mouseR = true; input.rightRepeat = 0.3; useItem(); }
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) input.mouseL = false;
  if (e.button === 2) input.mouseR = false;
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => {
  if (game.state !== 'playing') return;
  selectSlot((inv.sel + (e.deltaY > 0 ? 1 : 8)) % 9);
}, { passive: true });

const keyDown = (...codes) => codes.some((c) => input.keys.has(c));

// A set trap is chiseled sandstone with TNT directly below. "Near" is within TRAP_WARN_R blocks
// on each side and up to TRAP_WARN_H blocks above the plate: the top of a temple shaft is 13 above.
const TRAP_WARN_R = 3, TRAP_WARN_H = 14;
function trapNear(x, y, z) {
  for (let ty = y; ty >= y - TRAP_WARN_H; ty--) for (let dz = -TRAP_WARN_R; dz <= TRAP_WARN_R; dz++) for (let dx = -TRAP_WARN_R; dx <= TRAP_WARN_R; dx++)
    if (world.getBlock(x + dx, ty, z + dz) === B.CHISELED_SANDSTONE && world.getBlock(x + dx, ty - 1, z + dz) === B.TNT) return true;
  return false;
}

function updatePlayer(dt) {
  const p = player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.hurtTilt *= Math.exp(-8 * dt);
  if (p.dead) return;
  const c = world.chunkAt(Math.floor(p.pos.x), Math.floor(p.pos.z));
  if (!c || !c.lit) return;                  // wait for the terrain under the player
  realm.voidTick(dt, damagePlayer);

  // --- intent. A rider sits still: `vehicles.update` moves the vehicle and seats the player.
  const riding = !!p.vehicle;
  let fwd = 0, side = 0;
  if (game.state === 'playing' && !riding) {
    if (keyDown('KeyW', 'ArrowUp')) fwd += 1;
    if (keyDown('KeyS', 'ArrowDown')) fwd -= 1;
    if (keyDown('KeyA', 'ArrowLeft')) side -= 1;
    if (keyDown('KeyD', 'ArrowRight')) side += 1;
  }
  // Shift descends while flying, so only Ctrl and double-tap W sprint in flight.
  const sprintKey = keyDown('ControlLeft', 'ControlRight') || input.wSprint || (!p.flying && keyDown('ShiftLeft', 'ShiftRight'));
  p.sprinting = sprintKey && fwd > 0;
  const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
  let wx = -sy * fwd + cy * side, wz = -cy * fwd - sy * side;
  const wl = Math.hypot(wx, wz);
  if (wl > 0) { wx /= wl; wz /= wl; }
  let speed = p.flying ? FLY_SPEED * (p.sprinting ? 2 : 1) : WALK_SPEED * (p.sprinting ? SPRINT_MULT : 1);
  if (p.inWater && !p.flying) speed *= 0.55;
  if (p.inLava && !p.flying) speed *= 0.35;
  if (bow.charging) speed *= 0.45;
  // Climbing: the body is in a leaf or ladder cell. A rider or a flyer never climbs.
  p.climbing = !p.flying && !riding && touchesAny(p, CLIMB);
  p.sinking = game.state === 'playing' && !riding && keyDown('ShiftLeft', 'ShiftRight');
  if (!p.flying && touchesAny(p, IS_LEAF)) speed *= LEAF_SPEED;
  if (!p.flying && p.onGround && world.getBlock(Math.floor(p.pos.x), Math.floor(p.pos.y - 0.05), Math.floor(p.pos.z)) === B.ASH_SAND) speed *= ASH_SPEED;
  const swim = p.inWater || p.inLava;
  const accel = p.flying ? 7 : p.onGround ? 16 : swim ? 6 : 5;
  const a = 1 - Math.exp(-accel * dt);
  p.vel.x += (wx * speed - p.vel.x) * a;
  p.vel.z += (wz * speed - p.vel.z) * a;

  // --- vertical
  const jump = game.state === 'playing' && keyDown('Space');
  p.jumpCD -= dt;
  if (p.flying) {
    const up = (jump ? 1 : 0) - (game.state === 'playing' && keyDown('ShiftLeft', 'ShiftRight') ? 1 : 0);
    p.vel.y += (up * FLY_V - p.vel.y) * (1 - Math.exp(-10 * dt));
  } else if (swim) {
    const thick = p.inLava ? 0.55 : 1;                         // lava is slower to swim through
    p.vel.y -= GRAVITY * 0.2 * dt;
    p.vel.y *= Math.exp(-2 * dt / thick);
    if (jump) p.vel.y = Math.min(p.vel.y + 24 * dt * thick, 3.4 * thick);
    if (jump && p.hitWall) p.vel.y = Math.max(p.vel.y, 5.2);   // climb out onto a bank
    p.vel.y = Math.max(p.vel.y, -3.5 * thick);
  } else if (p.climbing) {   // Space (or walking into a wall) climbs, Shift climbs down, no key holds
    const up = jump || (fwd > 0 && p.hitWall) ? 1 : p.sinking ? -1 : 0;
    p.vel.y = Math.max(p.vel.y, -CLIMB_V);   // a fall into leaves or onto a ladder is caught
    p.vel.y += (up * CLIMB_V - p.vel.y) * (1 - Math.exp(-12 * dt));
  } else {
    p.vel.y = Math.max(p.vel.y - GRAVITY * dt, -60);
    if (jump && p.onGround && p.jumpCD <= 0) {
      p.vel.y = JUMP_V; p.jumpCD = 0.1;
      if (p.sprinting) { p.vel.x += wx * 1.6; p.vel.z += wz * 1.6; }
    }
  }

  const wasGround = p.onGround || riding, prevY = p.pos.y;
  if (riding) { vehicles.seat(p); p.vel.set(0, 0, 0); p.onGround = true; p.fallPeak = null; }
  else moveEntity(p, dt);
  if (p.flying) p.fallPeak = null;

  // --- water state
  const fx = Math.floor(p.pos.x), fz = Math.floor(p.pos.z);
  const wasWater = p.inWater;
  const feet = world.getBlock(fx, Math.floor(p.pos.y + 0.3), fz);
  p.inWater = !!IS_WATER[feet]; p.inLava = !!IS_LAVA[feet];
  const ey = p.pos.y + EYE, eb = world.getBlock(fx, Math.floor(ey), fz);
  const headIn = (tbl) => tbl[eb] && (tbl[world.getBlock(fx, Math.floor(ey) + 1, fz)] || ey - Math.floor(ey) < 0.86);
  p.headInWater = !!headIn(IS_WATER); p.headInLava = !!headIn(IS_LAVA);
  if (riding) p.inWater = p.inLava = false;   // the legs hang below the boat deck
  if (p.inWater && !wasWater && p.vel.y < -4) { audio.splash(); particles.splash(p.pos.x, Math.floor(p.pos.y + 0.3) + 0.9, p.pos.z); }

  // --- lava burns: 4 damage every 0.5 s while any part of the body touches it
  p.lavaT -= dt;
  if (p.lavaT <= 0 && touchesAny(p, IS_LAVA)) {
    p.lavaT = 0.5; p.invuln = 0;
    damagePlayer(4, 'tried to swim in lava', null, 'lava');
    for (let i = 0; i < 6; i++) particles.fire(p.pos.x, p.pos.y + randRange(0.1, p.h), p.pos.z, p.w);
  }

  // --- fall damage (measured from the highest point since the player left the ground)
  if (p.inWater || p.inLava || p.climbing) p.fallPeak = null;
  else if (!p.onGround) p.fallPeak = p.fallPeak === null ? Math.max(prevY, p.pos.y) : Math.max(p.fallPeak, p.pos.y);
  if (p.onGround && !wasGround) {
    if (p.fallPeak !== null) {
      const dist = p.fallPeak - p.pos.y;
      const dmg = Math.round(Math.floor(dist - 3 + 1e-3) * (1 - 0.25 * enchLevel(inv.armor[3], 'feather_falling')));
      if (dmg > 0) { damagePlayer(dmg, dist > 12 ? 'fell from a high place' : 'hit the ground too hard', null, 'fall'); audio.fall(dmg); }
      if (dist > 1.2) { const id = world.getBlock(fx, Math.floor(p.pos.y - 0.05), fz); if (BLOCKS[id]) audio.step(BLOCKS[id].sound, 0.9); }
      // a jump or a fall onto farmland tramples it
      const fy = Math.floor(p.pos.y - 0.05);
      if (dist > 0.75 && IS_FARMLAND(world.getBlock(fx, fy, fz))) farming.toDirt(fx, fy, fz);
    }
    p.fallPeak = null;
  }

  // --- cactus
  p.cactusT -= dt;
  if (p.cactusT <= 0 && touchesBlock(p, B.CACTUS)) { damagePlayer(1, 'was pricked to death', null, 'cactus'); p.cactusT = 0.5; }

  // --- temple trap: a step onto chiseled sandstone with TNT directly below lights that TNT
  if (p.onGround) {
    const ty = Math.floor(p.pos.y - 0.05);
    if (world.getBlock(fx, ty, fz) === B.CHISELED_SANDSTONE && world.getBlock(fx, ty - 1, fz) === B.TNT) primeTnt(fx, ty - 1, fz);
  }
  // --- trap warning: a rattle plays once when the player comes near a set trap (see trapNear)
  if ((p.trapScanT -= dt) <= 0) {
    p.trapScanT = 0.25;
    const near = trapNear(fx, Math.floor(p.pos.y), fz);
    if (near && !p.trapNear) audio.trapWarn();
    p.trapNear = near;
  }

  // --- regeneration: 1 HP every 2 s after 4 s without damage
  if (p.health < p.maxHealth && game.clock - p.lastHurt > 4) {
    p.regenT += dt;
    if (p.regenT >= 2) { p.regenT = 0; p.health = Math.min(p.maxHealth, p.health + 1); hud.dirtyHearts = true; }
  } else p.regenT = 0;
  // golden apple: 1 HP per s while regenLeft lasts
  if (p.regenLeft > 0) {
    const before = Math.ceil(p.regenLeft);
    p.regenLeft = Math.max(0, p.regenLeft - dt);
    if (Math.ceil(p.regenLeft) < before && p.health < p.maxHealth) { p.health = Math.min(p.maxHealth, p.health + 1); hud.dirtyHearts = true; }
  }

  // --- footsteps and bob
  const hs = Math.hypot(p.vel.x, p.vel.z);
  const walking = p.onGround && hs > 0.6;
  p.bob += ((walking ? Math.min(1, hs / WALK_SPEED) : 0) - p.bob) * Math.min(1, dt * 10);
  if (walking) {
    // the camera is lowest at whole phase values: play the footstep there
    const before = Math.floor(p.walkPhase);
    p.walkPhase += hs * dt * BOB_RATE;
    if (Math.floor(p.walkPhase) !== before) {
      const id = world.getBlock(fx, Math.floor(p.pos.y - 0.05), fz);
      if (BLOCKS[id] && id !== B.AIR) audio.step(BLOCKS[id].sound, 0.45);
    }
  }
  if (swim && hs > 0.5 && Math.random() < dt * 1.5) audio.swim();
}

// Camera follows the eye with a small walk bob and a hurt roll.
let panoYaw = 0;
function updateCamera(dt) {
  const p = player;
  if (!game.started) {                 // menu panorama: a slow turn above the spawn
    panoYaw += dt * 0.05;
    camera.position.set(p.pos.x, p.pos.y + 12, p.pos.z);
    camera.rotation.set(-0.2, panoYaw, 0);
    return;
  }
  const bx = Math.sin(p.walkPhase * Math.PI) * 0.035 * p.bob;
  const by = -Math.abs(Math.cos(p.walkPhase * Math.PI)) * 0.05 * p.bob;
  const cs = Math.cos(p.yaw);
  p.stepRise = p.stepRise > 0.002 ? p.stepRise * Math.exp(-dt * 14) : 0;
  camera.position.set(p.pos.x + bx * cs, p.pos.y + EYE + by - p.stepRise, p.pos.z - bx * Math.sin(p.yaw));
  camera.rotation.set(p.pitch, p.yaw, p.hurtTilt + Math.sin(p.walkPhase * Math.PI) * 0.004 * p.bob);
  const target = (p.sprinting && Math.hypot(p.vel.x, p.vel.z) > WALK_SPEED * 1.1 ? 1.12 : 1) * (p.headInWater || p.headInLava ? 0.88 : 1) * (1 - 0.12 * bow.power());
  p.fovMul += (target - p.fovMul) * Math.min(1, dt * 8);
  const fov = CONFIG.fov * p.fovMul;
  if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
}

// Armor applies to these damage kinds. Each armor point cuts the damage by 4%, up to 80%.
const ARMORED = { mob: 1, arrow: 1, explosion: 1, lightning: 1 };
function armorFactor() { return 1 - Math.min(0.8, inv.armorPoints() * 0.04); }
// kind: mob, arrow, explosion, lightning (armored), or fall, lava, cactus, void (not armored).
// No damage lands while a menu, the loading screen, or the travel screen shows.
function damagePlayer(amount, cause, from, kind = 'mob') {
  const p = player;
  if (p.dead || p.invuln > 0 || amount <= 0 || game.state === 'loading' || game.state === 'menu' || game.state === 'travel') return;
  if (ARMORED[kind] && inv.armorPoints() > 0) { amount *= armorFactor(); inv.wearArmor(); audio.armorHit(); }
  p.health = Math.max(0, p.health - amount);
  p.invuln = 0.5; p.lastHurt = game.clock;
  p.hurtTilt = (Math.random() < 0.5 ? -1 : 1) * 0.12;
  if (from) {
    let dx = p.pos.x - from.x, dz = p.pos.z - from.z; const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    p.vel.x += dx * 7; p.vel.z += dz * 7; p.vel.y = Math.max(p.vel.y, 5.5);
  }
  audio.hurt();
  hud.flashHurt();
  if (p.health <= 0) die(cause);
}

function die(cause) {
  const p = player;
  if (p.vehicle) vehicles.dismount();
  p.dead = true;
  input.mouseL = input.mouseR = false;
  if (game.state === 'inventory') closeInventory(true);
  dropEverything();
  document.getElementById('deathMsg').textContent = `Player ${cause}.`;
  setState('dead');
  if (document.pointerLockElement) document.exitPointerLock();
}

// K toggles flight. Space rises and Shift sinks. Touching the ground does not end flight.
let flightHintShown = false;
function setFlying(on) {
  const p = player;
  if (p.flying === on || (on && (p.dead || p.vehicle))) return;
  p.flying = on; p.fallPeak = null;
  if (on) {
    p.vel.y = Math.max(p.vel.y, 0);
    if (!flightHintShown) { flightHintShown = true; hud.toast('Flying: Space to rise, Shift to sink, K to stop'); }
  }
}

// Respawn is at the overworld spawn. Outside the overworld it travels there; the death drops
// wait in the realm of the death.
function respawn() {
  const p = player;
  p.flying = false;
  if (realm.current !== 'overworld') realm.travel('overworld', p.spawn.toArray(), () => p.spawn.toArray());
  p.health = p.maxHealth; p.dead = false; p.fallPeak = null; p.regenLeft = 0; p.invuln = 1.5; p.lastHurt = -99;
  p.pitch = 0;
  hud.dirtyHearts = true;
  if (realm.travelling) return;              // the travel screen shows; updateTravel ends it
  p.pos.copy(p.spawn); p.vel.set(0, 0, 0);
  fadeIn();
  setState('playing');
  requestLock();
}

// Is any block of type `id` within 0.05 of the entity's box?
function touchesBlock(e, id) {
  const hw = e.w / 2 + 0.05;
  for (let y = Math.floor(e.pos.y - 0.05); y <= Math.floor(e.pos.y + e.h); y++)
    for (let z = Math.floor(e.pos.z - hw); z <= Math.floor(e.pos.z + hw); z++)
      for (let x = Math.floor(e.pos.x - hw); x <= Math.floor(e.pos.x + hw); x++)
        if (world.getBlock(x, y, z) === id) return true;
  return false;
}
// Does the entity's box overlap a cell whose id is set in `table` (IS_LAVA, IS_WATER)?
function touchesAny(e, table) {
  const hw = e.w / 2 - 0.01;
  for (let y = Math.floor(e.pos.y + 0.01); y <= Math.floor(e.pos.y + e.h - 0.01); y++)
    for (let z = Math.floor(e.pos.z - hw); z <= Math.floor(e.pos.z + hw); z++)
      for (let x = Math.floor(e.pos.x - hw); x <= Math.floor(e.pos.x + hw); x++)
        if (table[world.getBlock(x, y, z)]) return true;
  return false;
}

function setEscLock(v) { escLock = v; }
function setPausedAt(v) { pausedAt = v; }

export {
  damagePlayer, keyDown, requestLock, respawn, resumeEl, resumeGame, setEscLock, setFlying, setPausedAt,
  touchesAny, updateCamera, updatePlayer,
};
