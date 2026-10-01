/* =====================================================================================
 * === 18. MAIN ANIMATION LOOP
 * -------------------------------------------------------------------------------------
 * Boot: pick a dry spawn column from the world generator, stream the chunks around it,
 * then enable Play. The menu shows the live world behind it with a slow panorama.
 * Each frame: stream chunks, simulate (only while playing, in the inventory, or dead),
 * update the sky and HUD, render the world through `post` (bloom and light shafts), clear depth,
 * then render the held item.
 * ===================================================================================== */
import { THREE } from './three.js';
import { EYE, SAVE, SEA, UNLOADED } from './config.js';
import { B, IS_LEAF, LIQ_KIND, OPAQUE } from './blocks.js';
import { BIOME } from './biomes.js';
import { WG } from './gen-service.js';
import { player, world } from './engine.js';
import { $ } from './hud.js';
import { playBtn, setState } from './menus.js';
import { persist } from './persist.js';

function findSpawnColumn() {
  const good = (c) => c.biome !== BIOME.OCEAN && c.biome !== BIOME.RIVER && c.h > SEA + 1 && c.h < SEA + 28;
  const pref = (c) => c.biome === BIOME.PLAINS || c.biome === BIOME.FOREST;
  let fallback = null;
  for (let r = 0; r <= 3000; r += 24) {
    const n = Math.max(1, Math.round((r * Math.PI * 2) / 24));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.round(Math.cos(a) * r), z = Math.round(Math.sin(a) * r);
      const c = WG.column(x, z);
      if (good(c)) { if (pref(c)) return { x, z }; if (!fallback) fallback = { x, z }; }
    }
    if (fallback && r > 400) return fallback;
  }
  return fallback || { x: 0, z: 0 };
}

// Standing spot near (x, z): solid ground (not a tree) with two free cells above.
function settleSpawn(x0, z0) {
  for (let r = 0; r <= 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = x0 + dx, z = z0 + dz, y = world.surfaceY(x, z);
    if (y < 1) continue;
    const top = world.getBlock(x, y, z);
    if (IS_LEAF[top] || top === B.LOG || top === B.CACTUS || LIQ_KIND[top]) continue;
    if (world.getBlock(x, y + 1, z) !== B.AIR || world.getBlock(x, y + 2, z) !== B.AIR) continue;
    return new THREE.Vector3(x + 0.5, y + 1, z + 0.5);
  }
  return new THREE.Vector3(x0 + 0.5, world.surfaceY(x0, z0) + 1, z0 + 0.5);
}

// The yaw (of 16) with the longest clear view at eye height, so the first view is not a wall.
function openYaw(pos) {
  let best = 0, bestYaw = 0;
  for (let i = 0; i < 16; i++) {
    const yaw = (i / 16) * Math.PI * 2, dx = -Math.sin(yaw), dz = -Math.cos(yaw);
    let d = 1;
    for (; d <= 24; d++) {
      const id = world.getBlock(Math.floor(pos.x + dx * d), Math.floor(pos.y + EYE), Math.floor(pos.z + dz * d));
      if (id === UNLOADED || OPAQUE[id] || IS_LEAF[id]) break;
    }
    if (d > best) { best = d; bestYaw = yaw; }
  }
  return bestYaw;
}

if (SAVE) persist.apply(SAVE);
else {
  const spawnCol = findSpawnColumn();
  player.pos.set(spawnCol.x + 0.5, WG.column(spawnCol.x, spawnCol.z).h + 1, spawnCol.z + 0.5);
  player.spawn.copy(player.pos);
  player.yaw = Math.PI * 0.75;
}
setState('loading');

const loadBar = $('loadbar').firstChild, loadText = $('loadtext');
const camDir = new THREE.Vector3();
let last = performance.now();

function onLoaded() {
  if (!SAVE) {                       // a restored player keeps the saved position and view
    player.pos.copy(settleSpawn(Math.floor(player.pos.x), Math.floor(player.pos.z)));
    player.spawn.copy(player.pos);
    player.yaw = openYaw(player.pos);
  }
  setState('menu');
  playBtn.disabled = false; playBtn.textContent = SAVE ? 'Continue' : 'Play';
  $('loadbar').style.display = 'none';
  const at = `${Math.floor(player.pos.x)}, ${Math.floor(player.pos.y)}, ${Math.floor(player.pos.z)}`;
  loadText.textContent = SAVE ? `Welcome back · ${at}` : `Spawn: ${at}`;
}

function setLast(v) { last = v; }

export { camDir, last, loadBar, loadText, onLoaded, setLast };
