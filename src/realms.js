/* =====================================================================================
 * REALMS — living header (src/realms.js, SPEC_realms)
 * -------------------------------------------------------------------------------------
 * Three realms: overworld, ember (the Ember Realm), and crystal (the Crystal Realm). The
 * player is in exactly one realm, `realm.current`. Only that realm's chunks load.
 *
 * Realm-scoped state: block edits, chests and furnaces, looted chests, homes, liquids, leaf
 * decay, farming, vehicles, and dropped items. This module owns the stash of every realm that
 * is not current. A stash holds the override maps, the save slice of the other modules, and the
 * drop objects (detached from the scene, so they wait frozen). Torches and door timers are
 * derived from the overrides. Mobs, arrows, primed TNT, and spawner models do not wait: a
 * realm change removes them.
 *
 * Travel: realm.travel(name, to, arrive) saves, stashes the current realm, clears the scoped
 * modules, restores the target stash, resets the world, and shows the travel screen. When the
 * chunks around `to` are meshed, arrive(to) returns the standing point (default: standNear).
 * The simulation stops during the load (state 'travel'). The game saves again on arrival.
 *
 * Save: the top-level slice fields hold the overworld. `realms.ember` and `realms.crystal` hold
 * the other slices. `realm` names the realm of player.pos. persist.js calls slice() and load().
 * ===================================================================================== */
import { CONFIG, CS, H, UNLOADED, VOID_Y } from './config.js';
import { B, baseOf, IS_LEAF, LIQ_KIND, SOLID } from './blocks.js';
import { canvas, game, player, scene, world } from './engine.js';
import { resumeEl } from './player.js';
import { doorTimers, resetMining, torches } from './interact.js';
import { liquids } from './liquids.js';
import { leafDecay } from './leaf-decay.js';
import { farming } from './farming.js';
import { drops } from './drops.js';
import { looted, tileEntities } from './tile-entities.js';
import { closeInventory } from './inventory-ui.js';
import { mobs } from './mobs.js';
import { vehicles } from './vehicles.js';
import { projectiles } from './projectiles.js';
import { clearTnt } from './explosions.js';
import { spawners } from './spawning.js';
import { $, hud } from './hud.js';
import { fadeIn, setState } from './menus.js';
import { persist } from './persist.js';
import { closeHomes, homes, setHomes } from './homes.js';
import { weather } from './order.js';

// ambient: the block-light floor of unlit cells (Phase 2). fog: null follows the sky; else
// { color, far } caps the fog distance. voidBelow: a cell below y 0 is air.
const REALMS = {
  overworld: { name: 'overworld', label: 'the Overworld', scale: 1, sky: 'day', ambient: 0, fog: null, voidBelow: false, weather: true, enter: 'Returning to the Overworld…' },
  ember: { name: 'ember', label: 'the Ember Realm', scale: 8, sky: 'ember', ambient: 6, fog: { color: 0x2e0a05, far: 72 }, voidBelow: false, weather: false, enter: 'Entering the Ember Realm…' },
  crystal: { name: 'crystal', label: 'the Crystal Realm', scale: 1, sky: 'crystal', ambient: 0, fog: { color: 0x2a1446, far: Infinity }, voidBelow: true, weather: false, enter: 'Entering the Crystal Realm…' },
};
const SLICE_FIELDS = ['edits', 'te', 'homes', 'liquids', 'leaves', 'farm', 'vehicles', 'looted'];
const VOID_DAMAGE = 4, VOID_TICK = 0.5;

// ---- edits: the save form (flat [chunk key, [index, id, ...]]) and the live maps ----------
function editsOf(byChunk) {
  const edits = [];
  for (const [k, m] of byChunk) { const flat = []; for (const [i, id] of m) flat.push(i, id); edits.push([k, flat]); }
  return edits;
}
function mapsOf(edits) {
  const overrides = new Map(), overridesByChunk = new Map();
  for (const [k, flat] of edits || []) {
    const m = new Map(), cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768;
    for (let j = 0; j < flat.length; j += 2) {
      const i = flat[j];
      let id = flat[j + 1];
      if (id === B.LEAVES) id = B.LEAVES_PLACED;   // saves before leaf decay: every leaf edit was a placed leaf
      m.set(i, id);
      overrides.set(`${cx * CS + (i & 15)},${i >> 8},${cz * CS + ((i >> 4) & 15)}`, id);
    }
    overridesByChunk.set(k, m);
  }
  return { overrides, overridesByChunk };
}

// A stash: { overrides, overridesByChunk, slice: { te, homes, liquids, leaves, farm, vehicles, looted }, drops }.
function stashOf(slice) {
  const s = slice || {};
  return { ...mapsOf(s.edits), slice: s, drops: [] };
}

const realm = {
  current: 'overworld',
  travelling: null,                     // { from, pos, to, arrive } while the travel screen shows
  portals: { crystalBack: null },
  boss: { defeated: false },
  stash: new Map(),                     // realm name -> stash, for every realm except current
  voidT: 0,

  get def() { return REALMS[this.current]; },

  // The save slice of realm `name`, from the live modules or from its stash.
  slice(name) {
    if (name === this.current) {
      return {
        edits: editsOf(world.overridesByChunk), te: [...tileEntities.values()], homes,
        liquids: liquids.save(), leaves: leafDecay.save(), farm: farming.save(), vehicles: vehicles.data(), looted: [...looted],
      };
    }
    const s = this.stash.get(name);
    if (!s) return null;
    const out = { edits: editsOf(s.overridesByChunk) };
    for (const f of SLICE_FIELDS) if (f !== 'edits') out[f] = s.slice[f] ?? [];
    return out;
  },
  // Where the save puts the player: the realm before travel during a load, the overworld when dead.
  place() {
    const t = this.travelling;
    if (t) return { name: t.from, pos: t.pos };
    return { name: player.dead ? 'overworld' : this.current, pos: null };
  },

  // Boot: restores every slice of the save and makes d.realm current (persist.apply).
  load(d) {
    this.current = REALMS[d.realm] ? d.realm : 'overworld';
    this.portals = { crystalBack: d.portals?.crystalBack ?? null };
    this.boss = { defeated: !!d.boss?.defeated };
    this.stash.clear();
    const slices = { overworld: d, ...(d.realms || {}) };
    for (const name of Object.keys(REALMS)) if (name !== this.current && slices[name]) this.stash.set(name, stashOf(slices[name]));
    this.enter(stashOf(slices[this.current]));
  },

  // Detaches the live realm-scoped state into a stash and clears the modules.
  leave() {
    const s = { overrides: world.overrides, overridesByChunk: world.overridesByChunk, slice: this.slice(this.current), drops: drops.splice(0) };
    for (const d of s.drops) scene.remove(d.mesh);
    tileEntities.clear(); looted.clear(); setHomes([]);
    liquids.clear(); leafDecay.clear(); farming.clear(); vehicles.clear();
    torches.clear(); doorTimers.clear(); clearTnt(); projectiles.clear(); spawners.clear();
    resetMining();
    return s;
  },
  // Makes a stash live: resets the world to its override maps and loads the other modules.
  enter(s) {
    const def = REALMS[this.current];
    world.reset(def.name, s.overrides, s.overridesByChunk, def.voidBelow);
    for (const m of mobs) m.remove();
    mobs.length = 0;
    for (const [k, id] of world.overrides) {
      if (baseOf(id) === B.TORCH) torches.add(k);
      const v = id - B.DOOR;
      if (baseOf(id) === B.DOOR && (v & 4) && !(v & 8)) doorTimers.set(k, game.clock + CONFIG.doorCloseDelay);
    }
    const sl = s.slice;
    for (const t of sl.te || []) tileEntities.set(`${t.x},${t.y},${t.z}`, t);
    for (const k of sl.looted || []) looted.add(k);
    setHomes(sl.homes || []);
    liquids.load(sl.liquids); leafDecay.load(sl.leaves); farming.load(sl.farm); vehicles.load(sl.vehicles);
    for (const d of s.drops) { scene.add(d.mesh); drops.push(d); }
    this.voidT = 0;
  },

  // Switches to realm `name`. `to` = [x, y, z] is where the chunks load (default: defaultTarget);
  // arrive(to) returns the standing point once they are meshed. Returns false when the switch
  // cannot start.
  travel(name, to = defaultTarget(name), arrive = standNear) {
    if (!REALMS[name] || name === this.current || this.travelling || !game.started || player.vehicle) return false;
    if (!Array.isArray(to) || to.length !== 3 || !to.every(Number.isFinite)) return false;
    if (game.state === 'inventory') closeInventory(true);
    if (game.state === 'homes') closeHomes();
    if (!player.dead) persist.save();
    const dead = player.dead;               // a respawn travels while dead: a save then puts the player at spawn
    this.travelling = { from: dead ? 'overworld' : this.current, pos: (dead ? player.spawn : player.pos).toArray(), to, arrive };
    this.stash.set(this.current, this.leave());
    this.current = name;
    const s = this.stash.get(name) || stashOf(null);
    this.stash.delete(name);
    this.enter(s);
    player.pos.set(to[0], to[1], to[2]); player.vel.set(0, 0, 0); player.fallPeak = null;
    weather.snap();
    travelText.textContent = REALMS[name].enter;
    travelEl.dataset.realm = name;
    travelBar.style.width = '0%';
    setState('travel');
    if (document.pointerLockElement) document.exitPointerLock();
    return true;
  },
  // Each frame while the travel screen shows (main.js).
  updateTravel() {
    const t = this.travelling;
    if (!t) return;
    const r = world.readyAround(t.to[0], t.to[2], 3);
    travelBar.style.width = `${Math.round(r * 100)}%`;
    if (r < 1) return;
    const p = t.arrive(t.to) || t.to;
    player.pos.set(p[0], p[1], p[2]); player.vel.set(0, 0, 0); player.fallPeak = null; player.invuln = Math.max(player.invuln, 1);
    this.travelling = null;
    setState('playing');
    fadeIn();
    hud.dirtyHotbar = hud.dirtyHearts = true;
    if (document.pointerLockElement !== canvas) resumeEl.style.display = 'block';
    persist.save();
  },

  // The void (Crystal Realm): 4 damage every 0.5 s below y -32, not armored (player.js calls it).
  voidTick(dt, hurt) {
    if (!world.voidBelow || player.pos.y >= VOID_Y || player.dead) { this.voidT = 0; return; }
    if ((this.voidT -= dt) > 0) return;
    this.voidT = VOID_TICK;
    hurt(VOID_DAMAGE, 'fell out of the world', null, 'void');
  },
};

// A standing spot near (x, y, z): a solid floor that is not a leaf, log, cactus, or liquid,
// with two free cells above. It searches columns within 8 blocks, each from y down, then up.
function standNear(to) {
  const x0 = Math.floor(to[0]), y0 = Math.max(1, Math.min(H - 3, Math.floor(to[1]))), z0 = Math.floor(to[2]);
  const ok = (x, y, z) => {
    const f = world.getBlock(x, y - 1, z);
    if (!SOLID[f] || IS_LEAF[f] || f === B.LOG || f === B.CACTUS || f === UNLOADED) return false;
    for (const dy of [0, 1]) { const b = world.getBlock(x, y + dy, z); if (SOLID[b] || LIQ_KIND[b] || b === UNLOADED) return false; }
    return true;
  };
  for (let r = 0; r <= 8; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
    const x = x0 + dx, z = z0 + dz;
    for (let y = y0; y >= 1; y--) if (ok(x, y, z)) return [x + 0.5, y, z + 0.5];
    for (let y = y0 + 1; y < H - 2; y++) if (ok(x, y, z)) return [x + 0.5, y, z + 0.5];
  }
  return [x0 + 0.5, y0, z0 + 0.5];
}

// The default target of a travel without `to`. Crystal: the arena center. Else the player's point
// in overworld terms (from the Crystal Realm: crystalBack or the spawn), at 1:8 for the Ember Realm.
// An ember y is the overworld y - 64, clamped to 33..110.
function defaultTarget(name) {
  if (name === 'crystal') return [0.5, 97, 0.5];
  const p = player.pos;
  const o = realm.current === 'crystal' ? realm.portals.crystalBack || player.spawn.toArray()
    : realm.current === 'ember' ? [p.x * 8, p.y + 64, p.z * 8] : p.toArray();
  return name === 'ember' ? [o[0] / 8, Math.max(33, Math.min(110, o[1] - 64)), o[2] / 8] : o;
}

const travelEl = $('travel'), travelText = $('travelText'), travelBar = $('travelBar').firstChild;

export { defaultTarget, realm, REALMS, standNear };
