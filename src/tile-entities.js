// ---- tile entities: furnace and chest contents ------------------------------------------
import { THREE } from './three.js';
import { mulberry32, randRange, SEED, UNLOADED } from './config.js';
import {
  ARMOR_TIERS, armorId, B, baseOf, BLOCKS, ENCH, ENCH_MAX, FUEL, FUEL_LEFT, I, ITEMS, SMELT, SMELT_TIME,
  toolId,
} from './blocks.js';
import { WG } from './gen-service.js';
import { game, world } from './engine.js';
import { spawnDrop } from './drops.js';
import { inv } from './inventory.js';
import { closeInventory } from './order.js';

const tileEntities = new Map();   // "x,y,z" -> { type, x, y, z, slots, burn?, burnMax?, cook? }
const ui = { mode: 'craft', te: null };   // what the inventory screen shows
function tileEntity(x, y, z) {
  const k = `${x},${y},${z}`, base = baseOf(world.getBlock(x, y, z));
  let te = tileEntities.get(k);
  if (!te && base === B.FURNACE) te = { type: 'furnace', x, y, z, slots: [null, null, null], burn: 0, burnMax: 0, cook: 0 };
  if (!te && base === B.CHEST) te = lootChest(x, y, z) || { type: 'chest', x, y, z, slots: new Array(27).fill(null) };
  if (te) tileEntities.set(k, te);
  return te;
}
// Drops the contents of a broken furnace or chest and forgets it. A generated chest that nobody
// opened fills first, so breaking or blowing it up spills its loot.
function spillTileEntity(x, y, z) {
  const k = `${x},${y},${z}`, te = tileEntities.get(k) || lootChest(x, y, z);
  if (!te) return;
  if (ui.te === te && game.state === 'inventory') closeInventory();
  tileEntities.delete(k);
  for (const s of te.slots) if (s) spawnDrop(s.id, s.count, x + 0.5, y + 0.5, z + 0.5, new THREE.Vector3(randRange(-2, 2), randRange(2, 4), randRange(-2, 2)), 0.5, s.dur, s.ench);
}

// ---- structure loot (Batch 17) -----------------------------------------------------------
// A generated chest is a chest feature of its chunk. It fills the first time the game touches it:
// open (tileEntity), break, or explosion (spillTileEntity). The rng seeds from the world seed, the
// position, and the structure type, so the loot is the same on every visit. `looted` holds the
// filled positions ("x,y,z"), so a chest never fills twice, even when a new chest takes its place.
// A LOOT entry is [item, min, max, weight]. 'ench' is an enchanted steel-to-diamond tool and
// 'armor' a diamond armor piece. The golden apple comes only from loot.
const LOOT = {
  dungeon: { rolls: [4, 7], items: [[I.BONE, 1, 4, 10], [I.FLESH, 1, 4, 10], [I.STRING, 1, 3, 8], [I.GUNPOWDER, 1, 4, 8],
    [I.BREAD, 1, 3, 8], [I.STEEL, 1, 4, 6], [I.GOLD, 1, 3, 4], [I.ARROW, 2, 8, 5], [I.BUCKET, 1, 1, 3], [I.SEEDS, 2, 6, 4],
    [I.GOLDEN_APPLE, 1, 1, 2], [I.DIAMOND, 1, 2, 1], [I.MAGMA_CORE, 1, 1, 1], ['ench', 1, 1, 2], ['armor', 1, 1, 1]] },
  temple: { rolls: [3, 6], items: [[I.BONE, 1, 5, 10], [I.FLESH, 1, 5, 10], [I.GOLD, 2, 6, 10], [I.STEEL, 1, 5, 8],
    [I.RUBY, 1, 3, 5], [I.DIAMOND, 1, 3, 4], [B.SAND, 4, 12, 5], [I.GUNPOWDER, 1, 4, 5], [I.GOLDEN_APPLE, 1, 1, 3],
    [I.MAGMA_CORE, 1, 1, 1], ['ench', 1, 1, 3], ['armor', 1, 1, 1]] },
  tower: { rolls: [2, 5], items: [[I.ARROW, 4, 12, 10], [I.BREAD, 1, 3, 10], [I.APPLE, 1, 3, 8], [I.STEEL, 1, 3, 6],
    [I.FEATHER, 2, 6, 6], [I.FLINT, 1, 4, 5], [I.BOW, 1, 1, 3], [I.COMPASS, 1, 1, 2], [I.GOLDEN_APPLE, 1, 1, 2],
    [I.RUBY, 1, 2, 2], ['ench', 1, 1, 2], ['armor', 1, 1, 1]] },
  mine: { rolls: [3, 6], items: [[I.COAL, 3, 10, 12], [B.RAIL, 4, 12, 10], [B.TORCH, 4, 12, 8], [I.RAW_IRON, 1, 5, 8],
    [I.RAW_GOLD, 1, 3, 5], [I.BREAD, 1, 3, 6], [I.RUBY, 1, 2, 2], [I.DIAMOND, 1, 2, 2], [I.GOLDEN_APPLE, 1, 1, 1],
    [I.MAGMA_CORE, 1, 1, 1], ['ench', 1, 1, 1]] },
};
const looted = new Set();
// The chest feature at (x, y, z), or null.
function featureAt(x, y, z, kind) {
  const c = world.chunkAt(x, z);
  return (c && c.features.find((f) => f.kind === kind && f.x === x && f.y === y && f.z === z)) || null;
}
// One loot stack drawn with `rnd`.
function lootStack(entry, rnd) {
  const [what, lo, hi] = entry, count = lo + Math.floor(rnd() * (hi - lo + 1));
  if (what === 'armor') { const id = armorId(ARMOR_TIERS.length - 1, Math.floor(rnd() * 4)); return { id, count: 1, dur: ITEMS[id].maxDur }; }
  if (what === 'ench') {
    const kinds = ['pickaxe', 'sword', 'axe', 'shovel'], id = toolId(kinds[Math.floor(rnd() * 4)], 4 + Math.floor(rnd() * 4));
    const keys = Object.keys(ENCH).filter((k) => ENCH[k].fits(ITEMS[id])), ench = {};
    const n = 1 + (rnd() < 0.35 ? 1 : 0);
    for (let i = 0; i < n && keys.length; i++) ench[keys.splice(Math.floor(rnd() * keys.length), 1)[0]] = 1 + Math.floor(rnd() * ENCH_MAX);
    return { id, count: 1, dur: ITEMS[id].maxDur, ench };
  }
  const s = { id: what, count: Math.min(count, ITEMS[what].maxStack) };
  if (ITEMS[what].maxDur) s.dur = ITEMS[what].maxDur;
  return s;
}
// The filled chest tile entity of an unfilled generated chest, or null. Marks the chest looted.
function lootChest(x, y, z) {
  const k = `${x},${y},${z}`, f = !looted.has(k) && featureAt(x, y, z, 'chest'), table = f && LOOT[f.type];
  if (!table) return null;
  looted.add(k);
  const rnd = mulberry32(WG.hash3(SEED ^ 0x100f, x, WG.hash3(y, z, f.type.length)));
  const slots = new Array(27).fill(null), total = table.items.reduce((a, e) => a + e[3], 0);
  const rolls = table.rolls[0] + Math.floor(rnd() * (table.rolls[1] - table.rolls[0] + 1));
  for (let i = 0; i < rolls; i++) {
    let w = rnd() * total, e = table.items[0];
    for (const it of table.items) { w -= it[3]; if (w < 0) { e = it; break; } }
    let slot = Math.floor(rnd() * 27);
    while (slots[slot]) slot = (slot + 1) % 27;
    slots[slot] = lootStack(e, rnd);
  }
  return { type: 'chest', x, y, z, slots };
}

// Slot 0 = input, 1 = fuel, 2 = output. A fuel item starts burning only when something can
// smelt; the fire then burns out its full time. The block swaps between lit and unlit ids.
function updateFurnaces(dt) {
  for (const te of tileEntities.values()) {
    if (te.type !== 'furnace') continue;
    const id = world.getBlock(te.x, te.y, te.z);
    if (id === UNLOADED || baseOf(id) !== B.FURNACE) continue;
    const [inp, fuel, out] = te.slots, res = inp ? SMELT[inp.id] : undefined;
    const can = res !== undefined && (!out || (out.id === res && out.count < ITEMS[res].maxStack));
    let changed = false;
    if (te.burn > 0) te.burn = Math.max(0, te.burn - dt);
    if (te.burn <= 0 && can && fuel && FUEL[fuel.id]) {
      te.burn = te.burnMax = FUEL[fuel.id];
      if (--fuel.count <= 0) te.slots[1] = FUEL_LEFT[fuel.id] ? { id: FUEL_LEFT[fuel.id], count: 1 } : null;
      changed = true;
    }
    if (te.burn > 0 && can) {
      te.cook += dt;
      if (te.cook >= SMELT_TIME) {
        te.cook = 0;
        if (--inp.count <= 0) te.slots[0] = null;
        if (out) out.count++; else te.slots[2] = { id: res, count: 1 };
        changed = true;
      }
    } else te.cook = Math.max(0, te.cook - dt * 2);
    const want = (te.burn > 0 ? B.FURNACE_LIT : B.FURNACE) + BLOCKS[id].facing;
    if (id !== want) world.setBlock(te.x, te.y, te.z, want);
    if (changed && ui.te === te && game.state === 'inventory') inv.changed();
  }
}

export { featureAt, LOOT, lootChest, looted, spillTileEntity, tileEntities, tileEntity, ui, updateFurnaces };
