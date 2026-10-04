/* =====================================================================================
 * PORTALS — living header (src/portals.js, SPEC_realms Phases 3 and 5)
 * -------------------------------------------------------------------------------------
 * The portals at run time. src/portal-frame.js holds the pure geometry (frame check, nearest
 * portal, build plan); this module applies it to the world. Two kinds exist (KINDS, keyed by pane):
 * the Ember portal (obsidian frame, PORTAL_EMBER, lit by a Magma Core) and the crystal portal
 * (Crystal Frame, PORTAL_CRYSTAL, lit by an Ember Heart, overworld only).
 *
 * Ignition: interact.js calls ignite with the pane id. It fills the opening of the frame that
 * holds the clicked frame block. Removal: world.onEdit reports every edit. An edit that changes a
 * pane cell, or that removes a frame block next to a pane of its kind, removes every connected pane cell.
 *
 * Travel: while the player's body touches a pane cell, the timer runs and a vignette in the kind's
 * colors grows. At TRAVEL_T seconds the player travels. A step out resets the timer. Every travel
 * of any kind (and the load) disarms the portal until the player touches no pane cell. A rider
 * gets a toast and does not travel.
 *
 * Ember linking: the target point is realms.defaultTarget (1:8, ember y = overworld y - 64, held to
 * 33..110). The nearest Ember pane in the target realm's overrides wins: within 16 blocks
 * horizontally in the Ember Realm, 128 in the overworld. Without one, build() builds a portal at
 * the target (buildPlan) once the chunks there are meshed. A built portal is normal edits.
 *
 * Crystal linking: an overworld crystal portal records its foot cell in realm.portals.crystalBack
 * and leads to the arrival portal (WG.CRYSTAL_ARRIVAL). A crystal pane in another realm leads back
 * to the crystalBack portal when a crystal pane still stands there, else to the player's spawn.
 *
 * The arrival portal is generated terrain, not edits (ARCHITECTURE D52). world.locked refuses every
 * edit to its frame and opening, so it is always lit and the player can never be stranded.
 *
 * `cells` maps "x,y,z" to the pane id of every pane cell in the loaded realm (the overrides, plus
 * the arrival panes in the Crystal Realm), for the sparks and the hum. It rebuilds when
 * world.overrides changes identity (a realm switch or a load).
 * ===================================================================================== */
import { B } from './blocks.js';
import { game, player, world } from './engine.js';
import { buildPlan, findFrame, frameCells, nearestPortal, portalFoot } from './portal-frame.js';
import { particles } from './particles.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { defaultTarget, realm } from './realms.js';
import { WG } from './gen-service.js';

const TRAVEL_T = 2.5;               // seconds in the portal before travel
const LINK_R = { ember: 16, overworld: 128 };
const BACK_R = 3;                   // reach of the search for the crystalBack portal, in blocks
const HUM_R = 12, SPARK_R = 16;     // reach of the hum and of the sparks, in blocks
const PE = B.PORTAL_EMBER, PC = B.PORTAL_CRYSTAL;
// The portal kinds, by pane id. vig: the vignette colors (rim, middle, edge).
const KINDS = {
  [PE]: { ring: B.OBSIDIAN, vig: ['255,120,30', '255,86,20', '110,8,12'] },
  [PC]: { ring: B.CRYSTAL_FRAME, vig: ['80,240,225', '40,190,210', '34,12,92'] },
};
const PANE_OF = { [B.OBSIDIAN]: PE, [B.CRYSTAL_FRAME]: PC };   // frame block -> pane id
const N6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const A = WG.CRYSTAL_ARRIVAL;
// The arrival portal: its stand point (the middle of the opening's floor) and its locked box.
const ARRIVAL_STAND = [A.x0 + (A.w >> 1) + 0.5, A.y0, A.z0 + 0.5];
const inArrival = (x, y, z) => z === A.z0 && x >= A.x0 - 1 && x <= A.x0 + A.w && y >= A.y0 - 1 && y <= A.y0 + A.h;

const portals = (() => {
  const cells = new Map();          // "x,y,z" -> pane id of every pane cell in the loaded realm
  let known = null;                 // the override map that `cells` mirrors
  let t = 0, armed = false, warned = false, removing = false, kind = PE;
  const get = (x, y, z) => world.getBlock(x, y, z);
  world.locked = (x, y, z) => world.realm === 'crystal' && inArrival(x, y, z);

  function sync() {
    if (known === world.overrides) return;
    known = world.overrides; cells.clear();
    for (const [k, id] of known) if (KINDS[id]) cells.set(k, id);
    if (world.realm === 'crystal') for (const c of frameCells(A)) cells.set(c.join(','), PC);
  }

  // Removes every pane cell of id P connected to the cells in `seeds` (6-neighbour flood).
  function removeFrom(seeds, P) {
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
    if (KINDS[id]) cells.set(k, id); else if (KINDS[old]) cells.delete(k);
    if (removing || old === id) return;
    const near = () => N6.map(([dx, dy, dz]) => [x + dx, y + dy, z + dz]);
    if (KINDS[old]) removeFrom(near(), old);
    if (PANE_OF[old]) removeFrom(near(), PANE_OF[old]);
  }

  // Lights the frame that holds frame block (x, y, z) with panes of id P. Returns 'lit', 'busy'
  // when the cell already borders a pane of P, or 'open' when no complete frame holds the cell.
  function ignite(x, y, z, P = PE) {
    if (N6.some(([dx, dy, dz]) => get(x + dx, y + dy, z + dz) === P)) return 'busy';
    const f = findFrame(get, x, y, z, KINDS[P].ring);
    if (!f) return 'open';
    const own = !world.batch;
    if (own) world.beginBatch();
    for (const c of frameCells(f)) world.setBlock(c[0], c[1], c[2], P);
    if (own) world.endBatch();
    const [cx, cy, cz] = frameCells(f)[0], pos = { x: cx, y: cy, z: cz };
    if (P === PC) {   // a rising glass chime
      for (const [i, f0] of [[0, 660], [1, 880], [2, 1320]]) audio.tone({ type: 'sine', f0, f1: f0 * 1.5, dur: 1.2 + i * 0.3, vol: 0.18, attack: 0.05 + i * 0.12, pos });
      audio.noise({ ftype: 'highpass', f0: 2000, f1: 6000, q: 0.6, dur: 1.2, vol: 0.2, attack: 0.3, pos });
    } else {
      audio.noise({ ftype: 'lowpass', f0: 150, f1: 1600, q: 0.8, dur: 1.4, vol: 0.45, attack: 0.25, pos });
      audio.tone({ type: 'sine', f0: 70, f1: 150, dur: 1.4, vol: 0.25, attack: 0.2, pos });
    }
    return 'lit';
  }

  // The first pane cell that the player's body box touches, as [x, y, z, id], or null.
  function touching() {
    const p = player.pos, r = 0.3;
    for (let y = Math.floor(p.y); y <= Math.floor(p.y + 1.79); y++)
      for (let z = Math.floor(p.z - r); z <= Math.floor(p.z + r); z++)
        for (let x = Math.floor(p.x - r); x <= Math.floor(p.x + r); x++) { const id = get(x, y, z); if (KINDS[id]) return [x, y, z, id]; }
    return null;
  }

  // Starts the travel through pane cell c = [x, y, z, id]. Returns the realm.travel result.
  function go(c = touching()) {
    if (!c) return false;
    audio.noise({ ftype: 'bandpass', f0: 300, f1: 2400, q: 0.7, dur: 1.2, vol: 0.4, attack: 0.4 });
    if (c[3] === PC) {
      if (realm.current === 'overworld') {
        const f = portalFoot(get, c, PC);
        realm.portals.crystalBack = [f[0] + 0.5, f[1], f[2] + 0.5];
        return realm.travel('crystal', ARRIVAL_STAND, () => { player.yaw = 0; player.pitch = 0; return ARRIVAL_STAND; });
      }
      const back = realm.portals.crystalBack, st = realm.stash.get('overworld');
      const found = back && st ? nearestPortal(st.overrides, PC, back[0], back[1], back[2], BACK_R) : null;
      if (found) return realm.travel('overworld', [found[0] + 0.5, found[1], found[2] + 0.5], () => arriveIn(found, PC));
      return realm.travel('overworld', player.spawn.toArray());
    }
    const name = realm.current === 'overworld' ? 'ember' : 'overworld';
    const to = defaultTarget(name), st = realm.stash.get(name);
    const found = st ? nearestPortal(st.overrides, PE, to[0], to[1], to[2], LINK_R[name]) : null;
    if (found) return realm.travel(name, [found[0] + 0.5, found[1], found[2] + 0.5], () => arriveIn(found, PE));
    return realm.travel(name, to, build);
  }
  // Arrival in an existing portal: the floor of the found cell's column.
  function arriveIn(c, P) {
    if (get(...c) !== P) return null;   // gone: realm.travel stands the player at the target point
    const f = portalFoot(get, c, P);
    return [f[0] + 0.5, f[1], f[2] + 0.5];
  }
  // Arrival with no portal: builds an Ember portal at the target (the chunks there are meshed now).
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
  let shown = -1, shownKind = 0;
  function showVignette(k) {
    const q = Math.round(k * 50) / 50;
    if (q === shown && kind === shownKind) return;
    shown = q; shownKind = kind;
    const [a, b, c] = KINDS[kind].vig;
    vignette.style.opacity = String(Math.min(1, q * 1.2));
    vignette.style.background = `radial-gradient(ellipse at center, rgba(${a},0) ${Math.round(62 - 42 * q)}%, rgba(${b},0.5) ${Math.round(88 - 28 * q)}%, rgba(${c},0.92) 100%)`;
  }

  // Each frame (main.js). dt is 0 while the simulation stops: the timer and the arming hold.
  function update(dt) {
    sync();
    // Every travel disarms (portal, respawn, or home), so no arrival in a portal re-triggers.
    if (!dt || game.state === 'travel') { humTo(0); if (game.state === 'travel') { t = 0; armed = false; showVignette(0); } return; }
    const c = player.dead ? null : touching();
    if (c && c[3] !== kind) { kind = c[3]; t = 0; }
    if (!c) { if (!player.dead) armed = true; t = 0; warned = false; }
    else if (player.vehicle) {
      t = 0;
      if (!warned) { hud.toast(`Leave the ${player.vehicle.kind === 'boat' ? 'boat' : 'cart'} to travel`); warned = true; }
    } else if (armed && (t += dt) >= TRAVEL_T) { t = 0; armed = false; go(c); }
    showVignette(t / TRAVEL_T);
    // sparks near the player, and the hum by the distance to the nearest portal cell
    const px = player.pos.x, py = player.pos.y + 1, pz = player.pos.z;
    let near = Infinity;
    for (const [k, P] of cells) {
      const [x, y, z] = k.split(',').map(Number);
      const d = Math.hypot(x + 0.5 - px, y + 0.5 - py, z + 0.5 - pz);
      if (d < near) near = d;
      if (d < SPARK_R && Math.random() < dt * 2.5) particles.portal(x, y, z, get(x + 1, y, z) === P || get(x - 1, y, z) === P, P === PC);
    }
    humTo(near < HUM_R ? 0.16 * (1 - near / HUM_R) ** 2 : 0);
  }

  return {
    ignite, onEdit, update, touching, go,
    get t() { return t; }, get armed() { return armed; }, get cells() { sync(); return cells; },
    get humGain() { return hum ? hum.gain.gain.value : 0; },   // for tests: the hum's current volume
    get vignette() { return Number(vignette.style.opacity); },
    get lastBuild() { return lastBuild; },
    TRAVEL_T, ARRIVAL_STAND,
  };
})();

export { portals };
