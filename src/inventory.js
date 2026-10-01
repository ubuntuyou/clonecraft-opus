/* =====================================================================================
 * === 13. INVENTORY AND CRAFTING SYSTEMS
 * -------------------------------------------------------------------------------------
 * A stack is { id, count, dur? }. `dur` is the remaining durability of a tool.
 * inv.slots[0..8] is the hotbar; inv.slots[9..35] is storage. The craft grid holds
 * 2x2 (inventory) or 3x3 (crafting table) cells in inv.craft (row-major, width craftSize).
 * Recipes are shape-aware: the grid is trimmed to the bounding box of its items and
 * compared cell by cell with the pattern, also mirrored left-right.
 * Slot clicks follow Minecraft: left = pick up / put / swap / merge, right = half / one,
 * shift+left = quick move, 1-9 over a slot = swap with that hotbar slot.
 * The same screen serves three modes (`ui.mode`): 'craft' (2x2 or 3x3 grid), 'furnace',
 * and 'chest'. A furnace or chest keeps its slots in a tile entity (`tileEntities`, keyed
 * "x,y,z"). Furnaces smelt in `updateFurnaces` whether or not their screen is open.
 * ===================================================================================== */
import { THREE } from './three.js';
import { EYE, randRange } from './config.js';
import { enchLevel, ITEMS, restack, wears } from './blocks.js';
import { camera, game, player } from './engine.js';
import { _dir, resetMining } from './interact.js';
import { spawnDrop } from './drops.js';
import { viewModel } from './held-item.js';
import { renderInventory, audio, hud } from './order.js';

const inv = {
  slots: new Array(36).fill(null), sel: 0,
  craft: new Array(9).fill(null), craftSize: 2, cursor: null,
  trash: null,   // the last trashed stack; click the trash slot to take it back. Gone after CONFIG.trashDelay or on close.
  armor: new Array(4).fill(null),   // worn armor by piece: helmet, chestplate, leggings, boots
  altar: [null, null],              // the altar screen: 0 the item to enchant, 1 crystals. Returned on close.
  held() { return this.slots[this.sel]; },
  armorPoints() { let n = 0; for (const s of this.armor) if (s) n += ITEMS[s.id].armor.pts + enchLevel(s, 'protection'); return n; },
  // One armored hit: each worn piece loses 1 durability. A piece at 0 breaks.
  wearArmor() {
    for (let i = 0; i < 4; i++) {
      const s = this.armor[i];
      if (!s || !wears(s) || --s.dur > 0) continue;
      this.armor[i] = null; audio.toolBreak(); hud.toast(`${ITEMS[s.id].name} broke!`);
    }
    this.changed();
  },
  // Right click with a held armor piece: wear it, and put the worn piece of that kind in the hand.
  equipHeld() {
    const s = this.held(), a = s && ITEMS[s.id].armor;
    if (!a) return false;
    this.slots[this.sel] = this.armor[a.piece]; this.armor[a.piece] = s;
    audio.equip(); this.changed();
    return true;
  },
  changed() { hud.dirtyHotbar = true; if (game.state === 'inventory') renderInventory(); },
  // Adds items. Returns how many did not fit.
  add(id, count, dur, ench) {
    const max = ITEMS[id].maxStack;
    const order = [];
    for (let i = 0; i < 36; i++) order.push(i);
    if (dur === undefined) for (const i of order) {
      const s = this.slots[i];
      if (s && s.id === id && s.count < max) { const n = Math.min(count, max - s.count); s.count += n; count -= n; if (!count) break; }
    }
    for (const i of order) {
      if (!count) break;
      if (!this.slots[i]) {
        const n = Math.min(count, max);
        this.slots[i] = { id, count: n };
        if (ITEMS[id].maxDur) this.slots[i].dur = dur !== undefined ? dur : ITEMS[id].maxDur;
        if (ench) this.slots[i].ench = { ...ench };
        count -= n;
      }
    }
    this.changed();
    return count;
  },
  consumeHeld(n) {
    const s = this.slots[this.sel];
    if (!s) return;
    s.count -= n;
    if (s.count <= 0) this.slots[this.sel] = null;
    this.changed();
  },
  damageHeld(n) {
    const s = this.slots[this.sel];
    if (!s || s.dur === undefined) return;
    for (let k = 0; k < n; k++) if (wears(s)) s.dur--;
    if (s.dur <= 0) { this.slots[this.sel] = null; audio.toolBreak(); hud.toast(`${ITEMS[s.id].name} broke!`); }
    this.changed();
  },
  countOf(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.count; return n; },
  take(id, n) {   // removes up to n of id (storage first, then hotbar). Returns the amount taken.
    let got = 0;
    for (let i = 35; i >= 0 && got < n; i--) {
      const s = this.slots[i];
      if (!s || s.id !== id) continue;
      const k = Math.min(n - got, s.count); s.count -= k; got += k;
      if (!s.count) this.slots[i] = null;
    }
    return got;
  },
};

function selectSlot(i) {
  if (i === inv.sel) return;
  inv.sel = i;
  resetMining();
  hud.dirtyHotbar = true;
  hud.showItemName();
}

function dropStack(stack, speed = 5) {
  if (!stack) return;
  camera.getWorldDirection(_dir);
  const v = new THREE.Vector3(_dir.x * speed, _dir.y * speed + 2, _dir.z * speed);
  spawnDrop(stack.id, stack.count, player.pos.x, player.pos.y + EYE - 0.3, player.pos.z, v, 1.5, stack.dur, stack.ench).thrown = true;
}
function dropHeld(all) {
  const s = inv.held();
  if (!s) return;
  const n = all ? s.count : 1;
  dropStack(restack(s, n));
  inv.consumeHeld(n);
  viewModel.swing();
}
function dropEverything() {
  const all = [...inv.slots, ...inv.craft, ...inv.armor, ...inv.altar, inv.cursor];
  inv.slots.fill(null); inv.craft.fill(null); inv.armor.fill(null); inv.altar.fill(null); inv.cursor = null;
  for (const s of all) {
    if (!s) continue;
    const v = new THREE.Vector3(randRange(-3, 3), randRange(2, 5), randRange(-3, 3));
    spawnDrop(s.id, s.count, player.pos.x, player.pos.y + 1, player.pos.z, v, 2, s.dur, s.ench);
  }
  inv.changed();
}

export { dropEverything, dropHeld, dropStack, inv, selectSlot };
