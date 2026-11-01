/* =====================================================================================
 * SAVE FORMAT — living header (src/save-format.js, SPEC_hardening H1–H3)
 * -------------------------------------------------------------------------------------
 * The shape of a save and the trust boundary for save text: boot reads SAVE_KEY through
 * readSave, and the file import checks with validSave. Terms: a **slice** is the
 * realm-scoped part of a save (SLICE_FIELDS); the **edits** are the save form of the block
 * overrides. The module is pure: Node tests import it. Rules: DISCOVERY_save-format.md.
 * ===================================================================================== */
import { CS, H, MAX_HEALTH, REALMS, VOL, WEATHER_KINDS } from './config.js';
import { B, BLOCKS, IDS_VERSION, ITEMS, migrateIds, validEnch, VEHICLE_KINDS } from './blocks.js';

// The realm-scoped save fields. The top-level fields hold the overworld slice; `realms` holds the others.
const SLICE_FIELDS = ['edits', 'te', 'homes', 'liquids', 'leaves', 'farm', 'vehicles', 'looted'];

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

// ---- the save checks ---------------------------------------------------------------------
// Each check names one field. saveProblem(d) returns the name of the first failed check, or null.
// validSave(d) is true when nothing fails. A new save field needs a check here and an entry in the
// live fixture (DISCOVERY_save-format.md).
const num = (x) => typeof x === 'number' && Number.isFinite(x);
const int = Number.isInteger, arr = Array.isArray;
const obj = (o) => !!o && typeof o === 'object' && !arr(o);
const vec = (a) => arr(a) && a.length === 3 && a.every(num);
const cell = (c) => arr(c) && c.length === 3 && c.every(int) && c[1] >= 0 && c[1] < H;   // a queued block cell
const stack = (s) => s === null || (obj(s) && int(s.id) && !!ITEMS[s.id] && int(s.count) && s.count > 0
  && (s.dur == null || num(s.dur)) && validEnch(s));
const optList = (a, each) => a === undefined || (arr(a) && a.every(each));
// The tile entity types and the fields that each type adds.
const TE_TYPES = {
  chest: (t) => t.slots.length === 27,
  furnace: (t) => t.slots.length === 3 && [t.burn, t.burnMax, t.cook].every((v) => num(v) && v >= 0),
};
const SLICE_CHECKS = {
  edits: (a) => arr(a) && a.every((e) => arr(e) && int(e[0]) && arr(e[1]) && e[1].length % 2 === 0
    && e[1].every((v, j) => int(v) && (j % 2 === 0 ? v >= 0 && v < VOL : !!BLOCKS[v]))),
  te: (a) => optList(a, (t) => obj(t) && Object.hasOwn(TE_TYPES, t.type) && int(t.x) && int(t.y) && int(t.z)
    && arr(t.slots) && t.slots.every(stack) && TE_TYPES[t.type](t)),
  homes: (a) => optList(a, (h) => obj(h) && typeof h.name === 'string' && num(h.x) && num(h.y) && num(h.z) && num(h.yaw)),
  liquids: (a) => a === undefined || (arr(a) && a.length === 2 && a.every((q) => arr(q) && q.every(cell))),
  leaves: (a) => optList(a, cell),
  farm: (a) => optList(a, (c) => arr(c) && c.length === 5 && c.every(num)),
  vehicles: (a) => optList(a, (v) => obj(v) && typeof v.kind === 'string' && Object.hasOwn(VEHICLE_KINDS, v.kind)
    && num(v.x) && num(v.y) && num(v.z) && num(v.yaw)),
  looted: (a) => optList(a, (k) => typeof k === 'string' && /^-?\d+,-?\d+,-?\d+$/.test(k)),
};
// One realm slice: the top-level overworld fields, or one entry of `realms`. The overworld needs
// `edits`; a stored slice may omit any field.
function sliceProblem(s, top) {
  if (!obj(s)) return 'slice';
  if (!top && s.edits === undefined) s = { ...s, edits: [] };
  return SLICE_FIELDS.find((f) => !SLICE_CHECKS[f](s[f])) ?? null;
}
const SAVE_CHECKS = {
  v: (d) => d.v === 1,
  ids: (d) => d.ids === IDS_VERSION,
  seed: (d) => int(d.seed) && (d.seed | 0) === d.seed,
  dayTime: (d) => num(d.dayTime),
  clock: (d) => num(d.clock),
  player: (d) => obj(d.player) && vec(d.player.pos) && vec(d.player.spawn) && num(d.player.yaw) && num(d.player.pitch)
    && num(d.player.health) && d.player.health >= 0 && d.player.health <= MAX_HEALTH,
  inv: (d) => obj(d.inv) && arr(d.inv.slots) && d.inv.slots.length <= 36 && d.inv.slots.every(stack)
    && int(d.inv.sel) && d.inv.sel >= 0 && d.inv.sel <= 8 && optList(d.inv.loose, (s) => s !== null && stack(s)),
  armor: (d) => optList(d.armor, (s, i) => s === null || (stack(s) && ITEMS[s.id].armor?.piece === i)) && (d.armor || []).length <= 4,
  enchantSeed: (d) => d.enchantSeed === undefined || int(d.enchantSeed),
  weather: (d) => d.weather === undefined || (obj(d.weather) && WEATHER_KINDS.includes(d.weather.kind) && num(d.weather.left) && d.weather.left >= 0),
  realm: (d) => d.realm === undefined || Object.hasOwn(REALMS, d.realm),
  realms: (d) => d.realms === undefined || (obj(d.realms) && Object.keys(d.realms).every((k) => k !== 'overworld' && Object.hasOwn(REALMS, k))),
  portals: (d) => d.portals === undefined || (obj(d.portals) && (d.portals.crystalBack == null || vec(d.portals.crystalBack))),
  boss: (d) => d.boss === undefined || (obj(d.boss) && (d.boss.defeated === undefined || typeof d.boss.defeated === 'boolean')),
};
function saveProblem(d) {
  if (!obj(d)) return 'save';
  const field = Object.keys(SAVE_CHECKS).find((k) => !SAVE_CHECKS[k](d));
  if (field) return field;
  const top = sliceProblem(d, true);
  if (top) return top;
  for (const [k, sl] of Object.entries(d.realms || {})) { const p = sliceProblem(sl, false); if (p) return `realms.${k}.${p}`; }
  return null;
}
const validSlice = (s, top) => sliceProblem(s, top) === null;
const validSave = (d) => saveProblem(d) === null;

// ---- the boot reader ---------------------------------------------------------------------
// readSave(text, seed) reads the text of SAVE_KEY. It parses the text, runs migrateIds, then the
// save checks, then compares the seed. It returns { save, reason }: `save` is the checked save, or
// null when there is no text or the save is rejected; `reason` is null, or a short text that says
// why the save is rejected. boot.js shows the reason in a toast.
function readSave(text, seed) {
  if (text === null || text === undefined) return { save: null, reason: null };
  let d;
  try { d = JSON.parse(text); } catch (e) { return { save: null, reason: 'the save text is not valid JSON' }; }
  const problem = saveProblem(migrateIds(d));
  if (problem === 'save') return { save: null, reason: 'the save is not an object' };
  if (problem) return { save: null, reason: `the save field "${problem}" is missing or not valid` };
  if (d.seed !== seed) return { save: null, reason: `the save is for seed ${d.seed}, not seed ${seed}` };
  return { save: d, reason: null };
}

// ---- the boot policy (SPEC_deepen M4, K7) ---------------------------------------------------
// openSave holds the whole boot fallback policy: the carried notice, the read, the backup of a
// rejected save, and the apply throw. It is pure: the caller passes the stores, the clock, and
// `apply`. `store` has the `storage` shape (get, set -> bool, remove). `session` has the
// sessionStorage shape (getItem, setItem, removeItem); each call may throw.
// It returns { save, notice, blocked, reload }; `notice` is { msg, keep } or null.
const BOOT_NOTICE = 'clonecraft.bootNotice';

// The notice that a reload carried, or null. It reads the session, then the store (K7: the store
// carries the notice when the session write fails). It removes the key from both.
function takeNotice(session, store) {
  let found = null;
  try { found = session.getItem(BOOT_NOTICE); } catch (e) { /* the session is unreadable */ }
  try { session.removeItem(BOOT_NOTICE); } catch (e) { /* nothing to remove */ }
  if (!found) found = store.get(BOOT_NOTICE);
  store.remove(BOOT_NOTICE);
  try { return found ? JSON.parse(found) : null; } catch (e) { return null; }
}

// Copies the rejected text to `<key>.rejected.<now>`, then removes `key`. -> { msg, keep }
function backup(store, key, text, reason, now) {
  const copy = `${key}.rejected.${now}`;
  if (store.set(copy, text)) {
    store.remove(key);
    return { msg: `The saved world could not load: ${reason}. A copy is in ${copy}. A new world starts.`, keep: false };
  }
  return { msg: `The saved world could not load: ${reason}. It was kept. Saving is off until the next visit.`, keep: true };
}

// K7: after an apply throw, the notice goes to the session. When that write fails and the backup
// succeeded, the notice goes to `store` instead and the page still reloads: SAVE_KEY is gone, so
// the reload cannot loop. When the backup failed (`keep`), a failed session write gives no reload.
function openSave({ store, session, key, seed, now, apply }) {
  let notice = takeNotice(session, store), blocked = !!notice?.keep, reload = false;
  const text = notice?.keep ? null : store.get(key);
  const read = readSave(text, seed);
  let save = read.save;
  if (read.reason) { notice = backup(store, key, text, read.reason, now); if (notice.keep) blocked = true; }
  if (save) {
    try { apply(save); } catch (e) {
      save = null;
      blocked = true;                               // nothing may write the half-restored game
      notice = backup(store, key, text, `it failed to load (${e.message})`, now);
      const carried = JSON.stringify(notice);
      try { session.setItem(BOOT_NOTICE, carried); reload = true; } catch (err) {
        if (!notice.keep) { store.set(BOOT_NOTICE, carried); reload = true; }   // the notice may be lost; the world is clean
      }
    }
  }
  return { save, notice, blocked, reload };
}

// K10: validSlice is not exported (no reader outside this file).
export { BOOT_NOTICE, editsOf, mapsOf, openSave, readSave, SLICE_FIELDS, validSave };
