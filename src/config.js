/* =====================================================================================
 * === 1. CONSTANTS AND CONFIGURATION
 * ===================================================================================== */
const CS = 16;                 // chunk size (x and z)
const H = 176;                 // world height
const VOID_Y = -32;           // Crystal Realm: below this y the void hurts the player and removes mobs and drops
const SEA = 128;               // sea level: water fills open columns up to and including this y
const VOL = CS * CS * H;
const REACH = 5;
const PLAYER_W = 0.6, PLAYER_H = 1.8, EYE = 1.62;
const WALK_SPEED = 4.317, SPRINT_MULT = 1.5;
const GRAVITY = 32, JUMP_V = 8.7;
const CLIMB_V = 3, LEAF_SPEED = 0.6, LEAF_CATCH_V = 10;   // climbing m/s; walk speed factor inside leaves; fall speed a canopy top lets in
const ASH_SPEED = 0.4;   // walk speed factor on Ash Sand (the Ember Realm)
const FLY_SPEED = 10.9, FLY_V = 7.5;        // flight: horizontal (x2 when sprinting) and vertical m/s
const BOB_RATE = 0.6;                       // walk-bob cycles per block walked (one footstep per cycle)
const MAX_HOSTILE = 18, MAX_PASSIVE = 40, MAX_ANIMALS_PER_CHUNK = 4;
const UNLOADED = 255;
// Ember Realm hostile spawns (SPEC_realms Phase 4). A mob spawns where block light is at most
// EMBER_SPAWN_LIGHT; sky light and the time of day do not count. EMBER_WEIGHTS are percent weights.
const EMBER_SPAWN_LIGHT = 11;
const EMBER_WEIGHTS = [['brute', 35], ['wisp', 45], ['knight', 20]];
// The Ember Realm mob type for a roll r in [0, 1). Outside a fortress the Cinder Knight is left
// out, and the other two weights keep their ratio.
function emberMobType(r, inFortress) {
  const w = inFortress ? EMBER_WEIGHTS : EMBER_WEIGHTS.filter(([t]) => t !== 'knight');
  let x = r * w.reduce((n, [, k]) => n + k, 0);
  for (const [t, k] of w) if ((x -= k) < 0) return t;
  return w[w.length - 1][0];
}
let glowGain = 1;               // HDR gain of emissive sources (sun, moon, flames, water glint); `post` sets it

function hashString(s) {
  if (/^-?\d+$/.test(s)) return parseInt(s, 10) | 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}
// World choice: `?seed=N` opens that world, `?new` makes a random one, no parameter reopens the
// last world. Each seed has its own save under `clonecraft.world.<seed>` (section 16 writes it).
const urlParams = new URLSearchParams(location.search);
const storage = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
};
const SEED = (() => {
  if (urlParams.has('new')) {
    urlParams.delete('new');
    const q = urlParams.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    return (Math.random() * 2147483647) | 0;
  }
  if (urlParams.has('seed')) return hashString(urlParams.get('seed'));
  const last = storage.get('clonecraft.lastSeed');
  return last !== null && /^-?\d+$/.test(last) ? parseInt(last, 10) | 0 : (Math.random() * 2147483647) | 0;
})();
storage.set('clonecraft.lastSeed', String(SEED));
const SAVE_KEY = `clonecraft.world.${SEED}`;
const SAVE = (() => { try { const d = JSON.parse(storage.get(SAVE_KEY) || 'null'); return d && d.v === 1 && d.seed === SEED ? d : null; } catch (e) { return null; } })();

const CONFIG = {
  renderDistance: 8, fov: 75, sensitivity: 1, volume: 0.6,
  shadows: true,               // sun and moon shadows (pause menu "Shadows")
  bloom: true,                 // bloom and light shafts (pause menu "Bloom + shafts")
  renderScale: 1,              // share of the window's pixels drawn, 0.5..1 (pause menu "Render scale")
  aa: 0,                       // anti-aliasing: 0 off, 1 FXAA, 2/4/8 MSAA samples (settings "Anti-aliasing"; post.js)
  dayLength: 900,              // seconds for a full day/night cycle
  freezeTime: false,           // true stops the day/night cycle (pause menu "Freeze time")
  doorCloseDelay: 5,           // seconds before an open door closes by itself
  trashDelay: 3,               // seconds before the trash slot deletes its stack for good
  autosaveEvery: 30,           // seconds between autosaves
};
try {
  const saved = JSON.parse(localStorage.getItem('clonecraft.settings') || '{}');
  for (const k of ['renderDistance', 'fov', 'sensitivity', 'volume']) if (typeof saved[k] === 'number') CONFIG[k] = saved[k];
  for (const k of ['freezeTime', 'shadows', 'bloom']) if (typeof saved[k] === 'boolean') CONFIG[k] = saved[k];
  if (typeof saved.renderScale === 'number' && saved.renderScale >= 0.5 && saved.renderScale <= 1) CONFIG.renderScale = saved.renderScale;
  if ([0, 1, 2, 4, 8].includes(saved.aa)) CONFIG.aa = saved.aa;
  if (typeof saved.effects === 'number' && typeof saved.shadows !== 'boolean') CONFIG.shadows = CONFIG.bloom = saved.effects > 0;   // old 0-2 slider
} catch (e) { /* storage blocked: keep defaults */ }
if (urlParams.has('fx')) { const fx = parseInt(urlParams.get('fx'), 10) || 0; CONFIG.shadows = !!(fx & 1); CONFIG.bloom = !!(fx & 2); }   // 1 shadows, 2 bloom + shafts, 3 both
if (urlParams.has('rd')) CONFIG.renderDistance = Math.max(2, Math.min(16, parseInt(urlParams.get('rd'), 10) || 8));
function saveSettings() {
  try { localStorage.setItem('clonecraft.settings', JSON.stringify({
    renderDistance: CONFIG.renderDistance, fov: CONFIG.fov, sensitivity: CONFIG.sensitivity, volume: CONFIG.volume,
    shadows: CONFIG.shadows, bloom: CONFIG.bloom, renderScale: CONFIG.renderScale, aa: CONFIG.aa, freezeTime: CONFIG.freezeTime })); } catch (e) {}
}

const ckey = (cx, cz) => (((cx + 32768) & 0xffff) * 65536) + ((cz + 32768) & 0xffff);
const lidx = (x, y, z) => (y << 8) | (z << 4) | x;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = Math.random;
const randRange = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

function setGlowGain(v) { glowGain = v; }

export {
  BOB_RATE, ckey, clamp, CLIMB_V, CONFIG, CS, EMBER_SPAWN_LIGHT, EMBER_WEIGHTS, emberMobType, EYE, FLY_SPEED, FLY_V, glowGain, GRAVITY, H, hashString, JUMP_V,
  LEAF_CATCH_V, LEAF_SPEED, ASH_SPEED, lerp, lidx, MAX_ANIMALS_PER_CHUNK, MAX_HOSTILE, MAX_PASSIVE, mulberry32, PLAYER_H,
  PLAYER_W, randInt, randRange, REACH, SAVE, SAVE_KEY, saveSettings, SEA, SEED, setGlowGain, SPRINT_MULT,
  storage, UNLOADED, VOID_Y, VOL, WALK_SPEED,
};
