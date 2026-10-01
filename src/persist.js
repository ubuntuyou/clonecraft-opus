// ---- save and load ------------------------------------------------------------------
// One save per seed in localStorage (SAVE_KEY). It holds the block edits (overridesByChunk),
// the player, the inventory, furnaces and chests, homes, queued liquid cells, and the time.
// Mobs and dropped items are not saved. Autosave: every CONFIG.autosaveEvery seconds of
// play, on pause, and when the page hides or closes. An import sets `blocked`, so the
// page-hide save cannot overwrite the imported save before the reload.
import { THREE } from './three.js';
import { CONFIG, CS, SAVE_KEY, SEED, storage, VOL } from './config.js';
import { B, baseOf, BLOCKS, enchantSeed, ITEMS, setEnchantSeed, validEnch } from './blocks.js';
import { game, player, world } from './engine.js';
import { doorTimers, torches } from './interact.js';
import { liquids } from './liquids.js';
import { leafDecay } from './leaf-decay.js';
import { farming } from './farming.js';
import { inv } from './inventory.js';
import { looted, tileEntities } from './tile-entities.js';
import { VEHICLE_KINDS, vehicles } from './vehicles.js';
import { $, hud } from './hud.js';
import { homes, setHomes, weather } from './order.js';

const persist = {
  timer: 0, savedAt: 0, warned: false, blocked: false,
  savedAgo() { return this.savedAt ? `${Math.round((performance.now() - this.savedAt) / 1000)} s ago` : 'never'; },
  data() {
    const p = player, edits = [];
    for (const [k, m] of world.overridesByChunk) { const flat = []; for (const [i, id] of m) flat.push(i, id); edits.push([k, flat]); }
    // A rider saves at the exit spot of the vehicle and loads on foot. The vehicle saves in place.
    const out = p.vehicle && !p.dead ? vehicles.exitSpot(p.vehicle) : null;
    const pos = p.dead ? p.spawn : out ? new THREE.Vector3(out.x, out.y, out.z) : p.pos;
    return {
      v: 1, seed: SEED, dayTime: game.dayTime, clock: game.clock,
      player: { pos: pos.toArray(), spawn: p.spawn.toArray(), yaw: p.yaw, pitch: p.pitch, health: p.dead ? p.maxHealth : p.health, flying: p.flying && !p.dead },
      inv: { slots: inv.slots, sel: inv.sel, loose: [...inv.craft, ...inv.altar, inv.cursor].filter(Boolean) },
      armor: inv.armor,
      edits, te: [...tileEntities.values()], homes, liquids: liquids.save(), leaves: leafDecay.save(),
      farm: farming.save(), enchantSeed, vehicles: vehicles.data(), looted: [...looted], weather: weather.data(),
    };
  },
  save() {
    if (!game.started || this.blocked) return false;
    const ok = storage.set(SAVE_KEY, JSON.stringify(this.data()));
    if (ok) this.savedAt = performance.now();
    else if (!this.warned) { this.warned = true; hud.toast('Could not save: browser storage is full or blocked'); }
    this.timer = 0;
    return ok;
  },
  // Restores a save at boot, before any chunk arrives (overrides apply as chunks load).
  apply(d) {
    game.dayTime = d.dayTime; game.clock = d.clock;
    const p = player, P = d.player;
    p.pos.fromArray(P.pos); p.spawn.fromArray(P.spawn); p.yaw = P.yaw; p.pitch = P.pitch;
    p.health = P.health; p.flying = !!P.flying;
    for (let i = 0; i < 36; i++) inv.slots[i] = d.inv.slots[i] || null;
    inv.sel = d.inv.sel | 0;
    for (let i = 0; i < 4; i++) inv.armor[i] = (d.armor || [])[i] || null;
    for (const s of d.inv.loose || []) inv.add(s.id, s.count, s.dur, s.ench);
    for (const [k, flat] of d.edits) {
      const m = new Map(), cx = Math.floor(k / 65536) - 32768, cz = (k % 65536) - 32768;
      for (let j = 0; j < flat.length; j += 2) {
        const i = flat[j], x = cx * CS + (i & 15), y = i >> 8, z = cz * CS + ((i >> 4) & 15);
        let id = flat[j + 1];
        if (id === B.LEAVES) id = B.LEAVES_PLACED;   // saves before leaf decay: every leaf edit was a placed leaf
        m.set(i, id);
        world.overrides.set(`${x},${y},${z}`, id);
        if (baseOf(id) === B.TORCH) torches.add(`${x},${y},${z}`);
        const v = id - B.DOOR;
        if (baseOf(id) === B.DOOR && (v & 4) && !(v & 8)) doorTimers.set(`${x},${y},${z}`, game.clock + CONFIG.doorCloseDelay);
      }
      world.overridesByChunk.set(k, m);
    }
    for (const t of d.te || []) tileEntities.set(`${t.x},${t.y},${t.z}`, t);
    setHomes(d.homes || []);
    liquids.load(d.liquids);
    leafDecay.load(d.leaves);
    farming.load(d.farm);
    if (Number.isInteger(d.enchantSeed)) setEnchantSeed(d.enchantSeed);
    vehicles.load(d.vehicles);
    for (const k of d.looted || []) looted.add(k);
    weather.load(d.weather);
    this.savedAt = performance.now();
  },
};
addEventListener('pagehide', () => persist.save());
$('newWorldBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  if (!confirm(`Start a new world?\nThis world stays saved. Open it again with ?seed=${SEED}.`)) return;
  persist.save();
  location.search = '?new';
});

// ---- export and import: the current world as a JSON file ---------------------------------
// Export downloads the save of the current world. Import checks a file (validSave), writes it
// under its own seed, and reloads on that seed: SAVE is read only at boot, so a reload is the
// only way to apply it. An import that meets an existing save for its seed asks first.
function validSave(d) {
  const num = (x) => typeof x === 'number' && Number.isFinite(x);
  const int = Number.isInteger, arr = Array.isArray;
  const vec = (a) => arr(a) && a.length === 3 && a.every(num);
  const stack = (s) => s === null || (!!s && int(s.id) && !!ITEMS[s.id] && int(s.count) && s.count > 0 && validEnch(s));
  const optArr = (a) => a === undefined || arr(a);
  const P = d && d.player, V = d && d.inv;
  return !!d && d.v === 1 && int(d.seed) && (d.seed | 0) === d.seed && num(d.dayTime) && num(d.clock)
    && !!P && vec(P.pos) && vec(P.spawn) && num(P.yaw) && num(P.pitch) && num(P.health)
    && !!V && arr(V.slots) && V.slots.length <= 36 && V.slots.every(stack) && optArr(V.loose) && (V.loose || []).every((s) => s && stack(s))
    && arr(d.edits) && d.edits.every((e) => arr(e) && int(e[0]) && arr(e[1]) && e[1].length % 2 === 0
      && e[1].every((v, j) => int(v) && (j % 2 === 0 ? v >= 0 && v < VOL : !!BLOCKS[v])))
    && optArr(d.te) && (d.te || []).every((t) => t && int(t.x) && int(t.y) && int(t.z) && arr(t.slots) && t.slots.every(stack))
    && optArr(d.homes) && (d.homes || []).every((h) => h && typeof h.name === 'string' && num(h.x) && num(h.y) && num(h.z))
    && optArr(d.liquids) && optArr(d.leaves)
    && optArr(d.farm) && (d.farm || []).every((c) => arr(c) && c.length === 5 && c.every(num))
    && optArr(d.armor) && (d.armor || []).length <= 4
    && (d.armor || []).every((s, i) => s === null || (stack(s) && ITEMS[s.id].armor?.piece === i))
    && (d.enchantSeed === undefined || int(d.enchantSeed))
    && optArr(d.vehicles) && (d.vehicles || []).every((v) => v && typeof v.kind === 'string' && Object.hasOwn(VEHICLE_KINDS, v.kind)
      && num(v.x) && num(v.y) && num(v.z) && num(v.yaw))
    && optArr(d.looted) && (d.looted || []).every((k) => typeof k === 'string' && /^-?\d+,-?\d+,-?\d+$/.test(k))
    && (d.weather === undefined || (!!d.weather && weather.KINDS.includes(d.weather.kind) && num(d.weather.left) && d.weather.left >= 0));
}
function localDate() {
  const t = new Date(), p2 = (n) => String(n).padStart(2, '0');
  return `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`;
}
$('exportBtn').addEventListener('click', (e) => {
  e.stopPropagation();
  persist.save();
  const text = game.started ? JSON.stringify(persist.data()) : storage.get(SAVE_KEY);
  if (!text) { alert('Nothing to export yet. Play this world first.'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = `clonecraft-${SEED}-${localDate()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('importBtn').addEventListener('click', (e) => { e.stopPropagation(); $('importFile').click(); });
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';                  // the same file can be picked again
  if (!file) return;
  let d = null;
  try { d = JSON.parse(await file.text()); } catch (err) { d = null; }
  if (!validSave(d)) { alert('This file is not a Clonecraft world save. Nothing changed.'); return; }
  const key = `clonecraft.world.${d.seed}`;
  if (storage.get(key) !== null
    && !confirm(`Replace the saved world for seed ${d.seed}?\nThe file overwrites it. This cannot be undone.`)) return;
  persist.save();                       // keep the current world before the page changes
  if (!storage.set(key, JSON.stringify(d))) { alert('Could not import: browser storage is full or blocked. Nothing changed.'); return; }
  persist.blocked = true;
  location.search = `?seed=${d.seed}`;
});

export { persist, validSave };
