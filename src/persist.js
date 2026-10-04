// ---- save and load ------------------------------------------------------------------
// One save per seed in localStorage (SAVE_KEY). It holds the block edits (overridesByChunk),
// the player, the inventory, furnaces and chests, homes, queued liquid cells, and the time.
// Realms: the top-level slice fields hold the overworld. `realm` names the realm of the player,
// `realms` holds the ember and crystal slices, and `portals` and `boss` hold their state.
// `ids` names the id plan of the save (IDS_VERSION). migrateIds upgrades an older save at boot and at import.
// Mobs and dropped items are not saved. Autosave: every CONFIG.autosaveEvery seconds of
// play, on pause, and when the page hides or closes. An import sets `blocked`, so the
// page-hide save cannot overwrite the imported save before the reload.
import { THREE } from './three.js';
import { SAVE_KEY, SEED, storage, VOL } from './config.js';
import { BLOCKS, enchantSeed, IDS_VERSION, ITEMS, migrateIds, setEnchantSeed, validEnch } from './blocks.js';
import { game, player } from './engine.js';
import { inv } from './inventory.js';
import { VEHICLE_KINDS, vehicles } from './vehicles.js';
import { $, hud } from './hud.js';
import { realm, REALMS, weather } from './order.js';

const persist = {
  timer: 0, savedAt: 0, warned: false, blocked: false,
  savedAgo() { return this.savedAt ? `${Math.round((performance.now() - this.savedAt) / 1000)} s ago` : 'never'; },
  data() {
    const p = player, place = realm.place();
    // A rider saves at the exit spot of the vehicle and loads on foot. The vehicle saves in place.
    // During a travel load the player saves at the place before travel (realm.place).
    const out = p.vehicle && !p.dead ? vehicles.exitSpot(p.vehicle) : null;
    const pos = place.pos ? new THREE.Vector3().fromArray(place.pos) : p.dead ? p.spawn : out ? new THREE.Vector3(out.x, out.y, out.z) : p.pos;
    const realms = {};
    for (const name of Object.keys(REALMS)) if (name !== 'overworld') { const sl = realm.slice(name); if (sl) realms[name] = sl; }
    return {
      v: 1, ids: IDS_VERSION, seed: SEED, dayTime: game.dayTime, clock: game.clock,
      player: { pos: pos.toArray(), spawn: p.spawn.toArray(), yaw: p.yaw, pitch: p.pitch, health: p.dead ? p.maxHealth : p.health, flying: p.flying && !p.dead },
      inv: { slots: inv.slots, sel: inv.sel, loose: [...inv.craft, ...inv.altar, inv.cursor].filter(Boolean) },
      armor: inv.armor,
      ...realm.slice('overworld'), enchantSeed, weather: weather.data(),
      realm: place.name, realms, portals: { ...realm.portals }, boss: { ...realm.boss },
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
  // migrateIds first moves the stack ids of a save from before the id plan (SPEC_realms, Phase 0).
  apply(d) {
    migrateIds(d);
    game.dayTime = d.dayTime; game.clock = d.clock;
    const p = player, P = d.player;
    p.pos.fromArray(P.pos); p.spawn.fromArray(P.spawn); p.yaw = P.yaw; p.pitch = P.pitch;
    p.health = P.health; p.flying = !!P.flying;
    for (let i = 0; i < 36; i++) inv.slots[i] = d.inv.slots[i] || null;
    inv.sel = d.inv.sel | 0;
    for (let i = 0; i < 4; i++) inv.armor[i] = (d.armor || [])[i] || null;
    for (const s of d.inv.loose || []) inv.add(s.id, s.count, s.dur, s.ench);
    realm.load(d);   // every realm slice: edits, chests, homes, liquids, leaves, farming, vehicles, looted
    if (Number.isInteger(d.enchantSeed)) setEnchantSeed(d.enchantSeed);
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
// only way to apply it. migrateIds runs before validSave, so an export from before the id plan
// imports and is stored with the new ids. An import that meets an existing save for its seed asks first.
// One realm slice: the top-level overworld fields, or one entry of `realms`. The overworld needs
// `edits`; a stored slice may omit any field.
function validSlice(s, top) {
  const num = (x) => typeof x === 'number' && Number.isFinite(x);
  const int = Number.isInteger, arr = Array.isArray;
  const stack = (t) => t === null || (!!t && int(t.id) && !!ITEMS[t.id] && int(t.count) && t.count > 0 && validEnch(t));
  const optArr = (a) => a === undefined || arr(a);
  if (!s || typeof s !== 'object' || arr(s)) return false;
  if (!top && s.edits === undefined) s = { ...s, edits: [] };
  return arr(s.edits) && s.edits.every((e) => arr(e) && int(e[0]) && arr(e[1]) && e[1].length % 2 === 0
      && e[1].every((v, j) => int(v) && (j % 2 === 0 ? v >= 0 && v < VOL : !!BLOCKS[v])))
    && optArr(s.te) && (s.te || []).every((t) => t && int(t.x) && int(t.y) && int(t.z) && arr(t.slots) && t.slots.every(stack))
    && optArr(s.homes) && (s.homes || []).every((h) => h && typeof h.name === 'string' && num(h.x) && num(h.y) && num(h.z))
    && optArr(s.liquids) && optArr(s.leaves)
    && optArr(s.farm) && (s.farm || []).every((c) => arr(c) && c.length === 5 && c.every(num))
    && optArr(s.vehicles) && (s.vehicles || []).every((v) => v && typeof v.kind === 'string' && Object.hasOwn(VEHICLE_KINDS, v.kind)
      && num(v.x) && num(v.y) && num(v.z) && num(v.yaw))
    && optArr(s.looted) && (s.looted || []).every((k) => typeof k === 'string' && /^-?\d+,-?\d+,-?\d+$/.test(k));
}
function validSave(d) {
  const num = (x) => typeof x === 'number' && Number.isFinite(x);
  const int = Number.isInteger, arr = Array.isArray;
  const vec = (a) => arr(a) && a.length === 3 && a.every(num);
  const stack = (s) => s === null || (!!s && int(s.id) && !!ITEMS[s.id] && int(s.count) && s.count > 0 && validEnch(s));
  const optArr = (a) => a === undefined || arr(a);
  const P = d && d.player, V = d && d.inv;
  return !!d && d.v === 1 && d.ids === IDS_VERSION && int(d.seed) && (d.seed | 0) === d.seed && num(d.dayTime) && num(d.clock)
    && !!P && vec(P.pos) && vec(P.spawn) && num(P.yaw) && num(P.pitch) && num(P.health)
    && !!V && arr(V.slots) && V.slots.length <= 36 && V.slots.every(stack) && optArr(V.loose) && (V.loose || []).every((s) => s && stack(s))
    && validSlice(d, true)
    && optArr(d.armor) && (d.armor || []).length <= 4
    && (d.armor || []).every((s, i) => s === null || (stack(s) && ITEMS[s.id].armor?.piece === i))
    && (d.enchantSeed === undefined || int(d.enchantSeed))
    && (d.weather === undefined || (!!d.weather && weather.KINDS.includes(d.weather.kind) && num(d.weather.left) && d.weather.left >= 0))
    && (d.realm === undefined || Object.hasOwn(REALMS, d.realm))
    && (d.realms === undefined || (!!d.realms && typeof d.realms === 'object' && !arr(d.realms)
      && Object.entries(d.realms).every(([k, sl]) => k !== 'overworld' && Object.hasOwn(REALMS, k) && validSlice(sl, false))))
    && (d.portals === undefined || (!!d.portals && (d.portals.crystalBack === null || d.portals.crystalBack === undefined || vec(d.portals.crystalBack))))
    && (d.boss === undefined || (!!d.boss && (d.boss.defeated === undefined || typeof d.boss.defeated === 'boolean')));
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
  try { d = migrateIds(JSON.parse(await file.text())); } catch (err) { d = null; }
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
