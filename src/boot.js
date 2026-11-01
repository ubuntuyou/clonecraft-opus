/* =====================================================================================
 * === 18. MAIN ANIMATION LOOP
 * -------------------------------------------------------------------------------------
 * Boot: open the save (openSave), or pick a dry spawn column from the world generator; stream
 * the chunks around the player, then enable Play. A rejected save goes to a backup key first. The menu shows the live world behind it with a slow panorama.
 * Terms: a **notice** is the { msg, keep } text for a rejected save; boot.js shows it in the load line and a toast.
 * The boot fallback policy lives in save-format.js (openSave). Rules: DISCOVERY_save-format.md.
 * Each frame: stream chunks, simulate (only while playing, in the inventory, or dead),
 * update the sky and HUD, render the world through `post` (bloom and light shafts), clear depth,
 * then render the held item.
 * ===================================================================================== */
import { THREE } from './three.js';
import { EYE, SAVE_KEY, SEA, SEED, storage, UNLOADED } from './config.js';
import { B, IS_LEAF, LIQ_KIND, OPAQUE } from './blocks.js';
import { BIOME } from './biomes.js';
import { WG } from './gen-service.js';
import { game, player, world } from './engine.js';
import { $, hud } from './hud.js';
import { playBtn, setState } from './menus.js';
import { persist } from './persist.js';
import { openSave } from './save-format.js';

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

// ---- the boot fallback (SPEC_deepen M4) -----------------------------------------------------
// openSave (save-format.js) holds the policy: the carried notice, the read of SAVE_KEY, the backup of a
// rejected save, and the apply throw. boot.js passes the stores, the clock, and persist.apply, then acts
// on the result. The sessionStorage wrappers are lazy, so a throwing global stays inside openSave.
// After loading, the menu's load line shows the notice, and a toast repeats it when the game starts
// (the HUD and its toast are hidden until then).
const NOTICE_SECONDS = 12;
const session = {
  getItem: (k) => sessionStorage.getItem(k),
  setItem: (k, v) => sessionStorage.setItem(k, v),
  removeItem: (k) => sessionStorage.removeItem(k),
};
const opened = openSave({ store: storage, session, key: SAVE_KEY, seed: SEED, now: Date.now(), apply: (d) => persist.apply(d) });
let notice = opened.notice;
const save = opened.save;
if (opened.blocked) persist.blocked = true;
if (opened.reload) location.reload();
const restored = !!save;
if (!restored) {
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
  if (!restored) {                   // a restored player keeps the saved position and view
    player.pos.copy(settleSpawn(Math.floor(player.pos.x), Math.floor(player.pos.z)));
    player.spawn.copy(player.pos);
    player.yaw = openYaw(player.pos);
  }
  persist.dropLeftover();            // loose stacks that did not fit the inventory; the chunks are meshed
  setState('menu');
  playBtn.disabled = false; playBtn.textContent = restored ? 'Continue' : 'Play';
  $('loadbar').style.display = 'none';
  const at = `${Math.floor(player.pos.x)}, ${Math.floor(player.pos.y)}, ${Math.floor(player.pos.z)}`;
  loadText.textContent = restored ? `Welcome back · ${at}` : `Spawn: ${at}`;
  if (notice) { notice.line = loadText.textContent; loadText.textContent = notice.msg; }
}

// The notice toast, once, when Play or the overlay click starts the game (menus.js runs first).
function toastNotice() {
  if (!notice || !game.started) return;
  hud.toast(notice.msg); hud.toastT = NOTICE_SECONDS;
  if (notice.line) loadText.textContent = notice.line;   // the pause screen shows the usual line again
  notice = null;
}
for (const el of [playBtn, $('overlay')]) el.addEventListener('click', toastNotice);

function setLast(v) { last = v; }

export { camDir, last, loadBar, loadText, onLoaded, setLast };
