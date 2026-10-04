/* =====================================================================================
 * === 16. HUD AND UI
 * -------------------------------------------------------------------------------------
 * The HUD is DOM over the canvas. `hud.update` repaints only dirty parts: the hotbar,
 * the hearts, and a text panel (refreshed 4x per second).
 * Game states: loading -> menu -> playing <-> paused | inventory | homes | dead | travel.
 * 'travel' shows the travel screen while a realm loads. Input and damage do nothing then.
 * Outside the overworld the compass needle spins and the text shows "?".
 * `setState` is the only place that shows and hides the screens.
 * ===================================================================================== */
import { CONFIG, CS, SEED } from './config.js';
import { BLOCKS, breakTime, I, ITEMS } from './blocks.js';
import { BIOME_NAMES } from './biomes.js';
import { ARMOR_URL, HEART_URL } from './atlas.js';
import { game, player, renderer, world } from './engine.js';
import { mining, target, targetMob } from './interact.js';
import { liquids } from './liquids.js';
import { leafDecay } from './leaf-decay.js';
import { drops } from './drops.js';
import { viewModel } from './held-item.js';
import { inv } from './inventory.js';
import { paintSlot, renderFurnaceProgress } from './inventory-ui.js';
import { mobs } from './mobs.js';
import { hostileCount } from './spawning.js';
import { particles } from './particles.js';
import { clockText, persist, realm, weather } from './order.js';

const $ = (id) => document.getElementById(id);
const SPLASHES = [
  'Infinite voxels!', 'One file!', 'Zero assets!', '100% procedural!', 'Now with creepers!', 'Punch trees!',
  'Also try the real one!', 'Made of noise!', 'Nearest-neighbour filtered!', 'Spaghetti caves!', 'Mind the gap!',
  'WebAudio moos!', 'Sixteen by sixteen!', 'Contains no copyrighted pixels!', 'Seeded!', 'Bedrock is ragged!',
  'Deeper than before!', 'Mind the lava!', 'Doors close themselves!', 'Now it remembers!',
];
const hud = {
  dirtyHotbar: true, dirtyHearts: true,
  toastT: 0, nameT: 0, flashT: 0, hurtT: 0, textT: 0,
  fps: 0, frames: 0, fpsT: 0,
  hotbarEl: $('hotbar'), heartsEl: $('hearts'), armorEl: $('armorbar'), armorIcons: [], armorShown: -1, debugEl: $('debug'), toastEl: $('toast'), nameEl: $('itemname'),
  hurtEl: $('hurt'), waterEl: $('underwater'), lavaEl: $('inlava'), mineEl: $('miningbar'),
  compassEl: $('compass'), compassOn: false, compassText: '',
  slots: [], hearts: [], prevCounts: new Array(9).fill(0), selEl: null,

  build() {
    for (let i = 0; i < 9; i++) {
      const el = document.createElement('div'); el.className = 'slot';
      el.addEventListener('animationend', () => el.classList.remove('pop'));
      this.hotbarEl.appendChild(el); this.slots.push(el); paintSlot(el, null);
    }
    this.selEl = document.createElement('div'); this.selEl.id = 'hotsel';
    this.hotbarEl.appendChild(this.selEl);
    for (let i = 0; i < 10; i++) {
      const el = document.createElement('div'); el.className = 'heart';
      this.heartsEl.appendChild(el); this.hearts.push(el);
      const a = document.createElement('i'); this.armorEl.appendChild(a); this.armorIcons.push(a);
    }
  },
  // The compass dial shows while a compass is held. The needle angle is the spawn direction
  // relative to the view (0 = ahead, clockwise). Within 2 blocks the needle spins. Outside the
  // overworld the needle spins and the text is "?".
  updateCompass() {
    const p = player, s = inv.held(), on = !!s && s.id === I.COMPASS && !p.dead;
    if (on !== this.compassOn) { this.compassOn = on; this.compassEl.classList.toggle('on', on); }
    if (!on) return;
    const dx = p.spawn.x - p.pos.x, dz = p.spawn.z - p.pos.z, d = Math.hypot(dx, dz);
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    const lost = realm.current !== 'overworld';
    const ang = lost || d < 2 ? game.clock * 6 : Math.atan2(dx * cy - dz * sy, -dx * sy - dz * cy);
    this.compassEl.firstChild.firstChild.style.transform = `rotate(${ang.toFixed(3)}rad)`;
    const text = lost ? '?' : d < 2 ? 'At spawn' : `${Math.round(d)} blocks to spawn`;
    if (text !== this.compassText) { this.compassText = text; this.compassEl.lastChild.textContent = text; }
  },
  toast(msg) { this.toastEl.textContent = msg; this.toastEl.style.opacity = 1; this.toastT = 2.5; },
  showItemName() {
    const s = inv.held();
    this.nameEl.textContent = s ? ITEMS[s.id].name : '';
    this.nameEl.style.opacity = s ? 1 : 0; this.nameT = 2;
  },
  paintArmor() {
    const pts = inv.armorPoints();
    if (pts === this.armorShown) return;
    this.armorShown = pts;
    this.armorEl.classList.toggle('on', pts > 0);
    this.armorIcons.forEach((el, i) => {
      el.style.backgroundImage = `url(${ARMOR_URL[pts >= (i + 1) * 2 ? 'full' : pts === i * 2 + 1 ? 'half' : 'empty']})`;
    });
  },
  flashHurt() { this.hurtEl.style.opacity = 1; this.hurtT = 0.3; this.flashT = 0.5; this.dirtyHearts = true; },

  update(dt) {
    this.frames++; this.fpsT += dt;
    if (this.fpsT >= 0.5) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; }
    if (this.dirtyHotbar) {
      this.dirtyHotbar = false;
      // a slot whose stack grew (a pickup or a craft) pops its icon
      this.slots.forEach((el, i) => {
        const s = inv.slots[i], n = s ? s.count : 0;
        paintSlot(el, s);
        if (n > this.prevCounts[i] && game.started) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
        this.prevCounts[i] = n;
      });
      this.selEl.style.transform = `translateX(calc(${inv.sel} * (var(--slot) + 2px)))`;   // slot pitch = width + 2px margin
      viewModel.set(inv.held() ? inv.held().id : -1);
      this.paintArmor();
    }
    const p = player;
    this.updateCompass();
    if (this.dirtyHearts || this.flashT > 0) {
      this.dirtyHearts = false;
      const hp = Math.max(0, Math.ceil(p.health));
      this.hearts.forEach((el, i) => {
        const k = hp >= (i + 1) * 2 ? 'full' : hp === i * 2 + 1 ? 'half' : 'empty';
        if (el.dataset.k !== k) { el.dataset.k = k; el.style.backgroundImage = `url(${HEART_URL[k]})`; }
        el.style.transform = hp <= 4 && !p.dead ? `translateY(${Math.round(Math.random() * 3 - 1)}px)` : '';
      });
      this.heartsEl.classList.toggle('flash', this.flashT > 0 && Math.floor(this.flashT * 10) % 2 === 0);
    }
    if (p.health <= 4) this.dirtyHearts = true;          // keep the low-health jiggle alive
    this.flashT -= dt;
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.toastEl.style.opacity = 0;
    if (this.nameT > 0 && (this.nameT -= dt) <= 0) this.nameEl.style.opacity = 0;
    if (this.hurtT > 0 && (this.hurtT -= dt) <= 0) this.hurtEl.style.opacity = 0;
    this.waterEl.style.display = p.headInWater && !p.dead ? 'block' : 'none';
    this.lavaEl.style.display = p.headInLava && !p.dead ? 'block' : 'none';
    if (game.state === 'inventory') renderFurnaceProgress();
    const showBar = mining.active && mining.progress > 0.02 && breakTime(mining.id, inv.held()) > 0.6;
    this.mineEl.style.display = showBar ? 'block' : 'none';
    if (showBar) this.mineEl.firstChild.style.width = `${Math.min(100, mining.progress * 100)}%`;

    this.textT -= dt;
    if (this.textT <= 0) { this.textT = 0.25; this.debugEl.textContent = this.text(); }
  },

  text() {
    const p = player, x = Math.floor(p.pos.x), y = Math.floor(p.pos.y), z = Math.floor(p.pos.z);
    const cx = Math.floor(x / CS), cz = Math.floor(z / CS);
    const c = world.chunkAt(x, z);
    const biome = c ? BIOME_NAMES[c.biomes[(z & 15) * CS + (x & 15)]] : '…';
    const deg = ((-p.yaw * 180 / Math.PI) % 360 + 360) % 360;
    const facing = ['north (-Z)', 'east (+X)', 'south (+Z)', 'west (-X)'][Math.round(deg / 90) % 4];
    const clock = clockText(game.dayTime);
    const lines = [
      `CloneCraft  ${this.fps} fps`,
      `XYZ: ${p.pos.x.toFixed(1)} / ${p.pos.y.toFixed(1)} / ${p.pos.z.toFixed(1)}`,
      `Chunk: ${cx}, ${cz}  (in-chunk ${x & 15}, ${z & 15})`,
      `Biome: ${biome}   Facing: ${facing}`,
      `Time: ${clock}  Day ${Math.floor(game.clock / CONFIG.dayLength) + 1}   Weather: ${weather.kind}`,
    ];
    if (game.debug) {
      const ri = renderer.info;
      lines.push(
        `Light: sky ${world.getSky(x, y + 1, z)}  block ${world.getBlk(x, y + 1, z)}  daylight ${game.daylight.toFixed(2)}`,
        `Chunks: ${world.chunks.size} loaded, ${world.gen.pending.size} generating, ${world.pendingMeshes} to mesh`,
        `Render: ${ri.render.calls} calls, ${(ri.render.triangles / 1000).toFixed(0)}k tris, RD ${CONFIG.renderDistance}`,
        `Mesh ${world.stats.meshMs.toFixed(1)} ms  Light ${world.stats.lightMs.toFixed(1)} ms (last)`,
        `Mobs: ${mobs.length} (${hostileCount()} hostile)  Drops: ${drops.length}  Particles: ${particles.count}`,
        `Seed: ${SEED}  Liquids queued: ${liquids.pending}  Leaves queued: ${leafDecay.pending}  Saved ${persist.savedAgo()}`,
        target ? `Target: ${BLOCKS[target.id].name} @ ${target.x}, ${target.y}, ${target.z}` : (targetMob ? `Target: ${targetMob.type} (${targetMob.hp} hp)` : 'Target: —'),
      );
    } else lines.push('F3: more details');
    return lines.join('\n');
  },
};
hud.build();

export { $, hud, SPLASHES };
