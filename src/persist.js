// ---- save and load ------------------------------------------------------------------
// One save per seed in localStorage (SAVE_KEY). It holds the block edits (overridesByChunk),
// the player, the inventory, furnaces and chests, homes, queued liquid cells, and the time.
// Realms: the top-level slice fields hold the overworld. `realm` names the realm of the player,
// `realms` holds the ember and crystal slices, and `portals` and `boss` hold their state.
// `ids` names the id plan of the save (IDS_VERSION). migrateIds upgrades an older save at boot and at import.
// The save checks live in save-format.js (validSave, readSave). A new save field needs a check there.
// Mobs and dropped items are not saved. Autosave: every CONFIG.autosaveEvery seconds of
// play, on pause, and when the page hides or closes. An import sets `blocked`, so the
// page-hide save cannot overwrite the imported save before the reload.
import { THREE } from './three.js';
import { REALMS, SAVE_KEY, SEED, storage } from './config.js';
import { enchantSeed, IDS_VERSION, migrateIds, setEnchantSeed } from './blocks.js';
import { game, player } from './engine.js';
import { inv } from './inventory.js';
import { validSave } from './save-format.js';
import { vehicles } from './vehicles.js';
import { $, hud } from './hud.js';
import { realm, weather } from './order.js';

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
// under its own seed, and reloads on that seed: boot reads the save (readSave), so a reload is the
// only way to apply it. migrateIds runs before validSave, so an export from before the id plan
// imports and is stored with the new ids. An import that meets an existing save for its seed asks first.
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

export { persist };
