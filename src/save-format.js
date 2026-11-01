/* =====================================================================================
 * SAVE FORMAT — living header (src/save-format.js, SPEC_hardening H1–H3)
 * -------------------------------------------------------------------------------------
 * The shape of a save and the trust boundary for save text. Terms: a **slice** is the
 * realm-scoped part of a save (SLICE_FIELDS); the **edits** are the save form of the block
 * overrides. The module is pure: Node tests import it. Rules: DISCOVERY_save-format.md.
 * ===================================================================================== */
import { CS, REALMS, VOL, WEATHER_KINDS } from './config.js';
import { B, BLOCKS, IDS_VERSION, ITEMS, validEnch, VEHICLE_KINDS } from './blocks.js';

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
    && (d.weather === undefined || (!!d.weather && WEATHER_KINDS.includes(d.weather.kind) && num(d.weather.left) && d.weather.left >= 0))
    && (d.realm === undefined || Object.hasOwn(REALMS, d.realm))
    && (d.realms === undefined || (!!d.realms && typeof d.realms === 'object' && !arr(d.realms)
      && Object.entries(d.realms).every(([k, sl]) => k !== 'overworld' && Object.hasOwn(REALMS, k) && validSlice(sl, false))))
    && (d.portals === undefined || (!!d.portals && (d.portals.crystalBack === null || d.portals.crystalBack === undefined || vec(d.portals.crystalBack))))
    && (d.boss === undefined || (!!d.boss && (d.boss.defeated === undefined || typeof d.boss.defeated === 'boolean')));
}

export { editsOf, mapsOf, SLICE_FIELDS, validSave, validSlice };
