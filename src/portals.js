/* =====================================================================================
 * PORTALS — living header (src/portals.js, SPEC_realms Phase 3)
 * -------------------------------------------------------------------------------------
 * The Ember portal at run time. src/portal-frame.js holds the pure geometry (frame check,
 * nearest portal, build plan); this module applies it to the world.
 *
 * Ignition: a Magma Core on a frame block fills the opening with PORTAL_EMBER (interact.js
 * calls ignite). Removal: world.onEdit reports every edit. An edit that changes a portal cell, or
 * that removes an obsidian cell next to one, removes every connected portal cell.
 *
 * Travel: while the player's body touches a portal cell, the timer runs and an orange
 * vignette grows. At TRAVEL_T seconds the player travels. A step out resets the timer. Every
 * travel of any kind (and the load) disarms the portal until the player touches no portal cell. A rider
 * gets a toast and does not travel.
 *
 * Linking: the target point is realms.defaultTarget (1:8, ember y = overworld y - 64, held to
 * 33..110). The nearest portal cell in the target realm's overrides wins: within 16 blocks
 * horizontally in the Ember Realm, 128 in the overworld. Portal cells exist only as edits, so the
 * search needs no chunk. Without one, arrive() builds a portal at the target (buildPlan) once
 * the chunks there are meshed. A built portal is normal edits, so the save keeps it.
 *
 * `cells` mirrors the portal cells of the loaded realm for particles and the hum. It rebuilds
 * when world.overrides changes identity (a realm switch or a load).
 * ===================================================================================== */
import { B } from './blocks.js';
import { game, player, world } from './engine.js';
import { buildPlan, findFrame, frameCells, nearestPortal, portalFoot } from './portal-frame.js';
import { particles } from './particles.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { defaultTarget, realm } from './realms.js';

const TRAVEL_T = 2.5;               // seconds in the portal before travel
const LINK_R = { ember: 16, overworld: 128 };
const HUM_R = 12, SPARK_R = 16;     // reach of the hum and of the sparks, in blocks
const P = B.PORTAL_EMBER;
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

const portals = (() => {
  const cells = new Set();          // "x,y,z" of every portal cell in the loaded realm
  let known = null;                 // the override map that `cells` mirrors
  let t = 0, armed = false, warned = false, removing = false;
  const get = (x, y, z) => world.getBlock(x, y, z);

  function sync() {
    if (known === world.overrides) return;
    known = world.overrides; cells.clear();
    for (const [k, id] of known) if (id === P) cells.add(k);
  }

  // Removes every portal cell connected to the cells in `seeds` (6-neighbour flood).
  function removeFrom(seeds) {
    const seen = new Set(), q = seeds.filter((c) => get(...c) === P), out = [];
    for (const c of q) seen.add(c.join(','));
    while (q.length && out.length < 256) {
      const c = q.pop(); out.push(c);
      for (const [dx, dy, dz] of N6) {
        const n = [c[0] + dx, c[1] + dy, c[2] + dz], k = n.join(',');
        if (!seen.has(k) && get(...n) === P) { seen.add(k); q.push(n); }
      }
    }
    if (!out.length) return;
    removing = true;
    const own = !world.batch;
    if (own) world.beginBatch();
    for (const c of out) world.setBlock(c[0], c[1], c[2], B.AIR);
    if (own) world.endBatch();
    removing = false;
    const c = out[0];
    audio.fizz(c[0] + 0.5, c[1] + 0.5, c[2] + 0.5);
  }

  function onEdit(x, y, z, old, id) {
    sync();
    const k = `${x},${y},${z}`;
    if (id === P) cells.add(k); else if (old === P) cells.delete(k);
    if (removing) return;
    if ((old === P && id !== P) || (old === B.OBSIDIAN && id !== B.OBSIDIAN)) removeFrom(N6.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]));
  }

  // A Magma Core on obsidian cell (x, y, z): 'lit' when it lights a frame, 'busy' when the cell
  // already borders a portal, 'open' when no complete frame holds the cell.
  function ignite(x, y, z) {
    if (N6.some(([dx, dy, dz]) => get(x + dx, y + dy, z + dz) === P)) return 'busy';
    const f = findFrame(get, x, y, z);
    if (!f) return 'open';
    const own = !world.batch;
    if (own) world.beginBatch();
    for (const c of frameCells(f)) world.setBlock(c[0], c[1], c[2], P);
    if (own) world.endBatch();
    const [cx, cy, cz] = frameCells(f)[0];
    audio.noise({ ftype: 'lowpass', f0: 150, f1: 1600, q: 0.8, dur: 1.4, vol: 0.45, attack: 0.25, pos: { x: cx, y: cy, z: cz } });
    audio.tone({ type: 'sine', f0: 70, f1: 150, dur: 1.4, vol: 0.25, attack: 0.2, pos: { x: cx, y: cy, z: cz } });
    return 'lit';
  }

  // True when the player's body box touches a portal cell.
  function touching() {
    const p = player.pos, r = 0.3;
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + 1.79); y++)
      for (let z = Math.floor(p.z - r); z <= Math.floor(p.z + r); z++)
        for (let x = Math.floor(p.x - r); x <= Math.floor(p.x + r); x++) if (get(x, y, z) === P) return true;
    return false;
  }

  // Starts the travel to the linked realm. Returns the realm.travel result.
  function go() {
    const name = realm.current === 'overworld' ? 'ember' : 'overworld';
    const to = defaultTarget(name), st = realm.stash.get(name);
    const found = st ? nearestPortal(st.overrides, P, to[0], to[1], to[2], LINK_R[name]) : null;
    audio.noise({ ftype: 'bandpass', f0: 300, f1: 2400, q: 0.7, dur: 1.2, vol: 0.4, attack: 0.4 });
    if (found) return realm.travel(name, [found[0] + 0.5, found[1], found[2] + 0.5], () => arriveIn(found));
    return realm.travel(name, to, build);
  }
  // Arrival in an existing portal: the floor of the found cell's column.
  function arriveIn(c) {
    if (get(...c) !== P) return null;   // gone: realm.travel stands the player at the target point
    const f = portalFoot(get, c, P);
    return [f[0] + 0.5, f[1], f[2] + 0.5];
  }
  // Arrival with no portal: builds one at the target (the chunks there are meshed now).
  function build(to) {
    const plan = buildPlan(get, to[0], to[1], to[2]);
    const own = !world.batch;
    if (own) world.beginBatch();
    for (const [x, y, z, id] of plan.edits) world.setBlock(x, y, z, id);
    if (own) world.endBatch();
    lastBuild = plan;
    return plan.stand;
  }
  let lastBuild = null;

  // The hum: two low detuned oscillators through a lowpass, with a slow tremolo.
  let hum = null;
  function humTo(target) {
    if (!audio.ok()) { if (hum) hum.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2); return; }
    if (!hum) {
      const ctx = audio.ctx, gain = ctx.createGain(), lp = ctx.createBiquadFilter(), trem = ctx.createGain(), lfo = ctx.createOscillator(), lfoG = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 320; gain.gain.value = 0; trem.gain.value = 0.75;
      lfo.frequency.value = 0.7; lfoG.gain.value = 0.25; lfo.connect(lfoG); lfoG.connect(trem.gain); lfo.start();
      for (const [type, f] of [['sawtooth', 55], ['sawtooth', 55.6], ['sine', 82.5]]) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.connect(lp); o.start();
      }
      lp.connect(trem); trem.connect(gain); gain.connect(audio.master);
      hum = { gain };
    }
    hum.gain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.3);
  }

  const vignette = document.createElement('div');
  vignette.style.cssText = 'position:fixed;inset:0;opacity:0;pointer-events:none;z-index:3';
  document.body.appendChild(vignette);
  let shown = -1;
  function showVignette(k) {
    const q = Math.round(k * 50) / 50;
    if (q === shown) return;
    shown = q;
    vignette.style.opacity = String(Math.min(1, q * 1.2));
    vignette.style.background = `radial-gradient(ellipse at center, rgba(255,120,30,0) ${Math.round(62 - 42 * q)}%, rgba(255,86,20,0.5) ${Math.round(88 - 28 * q)}%, rgba(110,8,12,0.92) 100%)`;
  }

  // Each frame (main.js). dt is 0 while the simulation stops: the timer and the arming hold.
  function update(dt) {
    sync();
    // Every travel disarms (portal, respawn, or home), so no arrival in a portal re-triggers.
    if (!dt || game.state === 'travel') { humTo(0); if (game.state === 'travel') { t = 0; armed = false; showVignette(0); } return; }
    if (player.dead || !touching()) { if (!player.dead) armed = true; t = 0; warned = false; }
    else if (player.vehicle) {
      t = 0;
      if (!warned) { hud.toast(`Leave the ${player.vehicle.kind === 'boat' ? 'boat' : 'cart'} to travel`); warned = true; }
    } else if (armed && (t += dt) >= TRAVEL_T) { t = 0; armed = false; go(); }
    showVignette(t / TRAVEL_T);
    // sparks near the player, and the hum by the distance to the nearest portal cell
    const px = player.pos.x, py = player.pos.y + 1, pz = player.pos.z;
    let near = Infinity;
    for (const k of cells) {
      const [x, y, z] = k.split(',').map(Number);
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py, z + 0.5 - pz);
      if (d < near) near = d;
      if (d < SPARK_R && Math.random() < dt * 2.5) particles.portal(x, y, z, get(x + 1, y, z) === P || get(x - 1, y, z) === P);
    }
    humTo(near < HUM_R ? 0.16 * (1 - near / HUM_R) ** 2 : 0);
  }

  return {
    ignite, onEdit, update, touching, go,
    get t() { return t; }, get armed() { return armed; }, get cells() { sync(); return cells; },
    get humGain() { return hum ? hum.gain.gain.value : 0; },   // for tests: the hum's current volume
    get vignette() { return Number(vignette.style.opacity); },
    get lastBuild() { return lastBuild; },
    TRAVEL_T,
  };
})();

export { portals };
