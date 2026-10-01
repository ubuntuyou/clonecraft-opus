// ---- inventory screen -----------------------------------------------------------------
import { CONFIG } from './config.js';
import {
  altarOffers, ARMOR_PIECES, armorId, B, ENCH, ENCH_SLOTS, enchantable, FUEL, ITEMS, restack, ROMAN,
  setEnchantSeed, SMELT, SMELT_TIME,
} from './blocks.js';
import { ICON_URL } from './atlas.js';
import { game, input, player } from './engine.js';
import { resumeGame } from './player.js';
import { resetMining } from './interact.js';
import { dropStack, inv } from './inventory.js';
import { RECIPES } from './crafting.js';
import { consumeCraft, craftOutput } from './craft-grid.js';
import { tileEntity, ui } from './tile-entities.js';
import { audio, hud, setState } from './order.js';

const invEl = document.getElementById('inventory'), invPanelEl = document.getElementById('invPanel');
const chestGridEl = document.getElementById('chestGrid');
const craftGridEl = document.getElementById('craftGrid');
const craftResultEl = document.getElementById('craftResult');
const storageEl = document.getElementById('storageGrid');
const invHotbarEl = document.getElementById('invHotbar');
const recipesEl = document.getElementById('recipes');
const cursorEl = document.getElementById('cursorStack');
const tooltipEl = document.getElementById('tooltip');
const trashSlotEl = document.getElementById('trashSlot');
trashSlotEl.style.setProperty('--trash-delay', `${CONFIG.trashDelay}s`);
let trashTimer = 0;   // setTimeout id of the pending delete of inv.trash
let hoverSlot = null, mouseX = 0, mouseY = 0;

function paintSlot(el, s) {
  let icon = el.querySelector('.icon');
  if (!icon) {
    el.innerHTML = '<div class="icon"></div><div class="count"></div><div class="dur"><i></i></div>';
    icon = el.querySelector('.icon');
  }
  icon.style.backgroundImage = s ? `url(${ICON_URL[s.id]})` : 'none';
  markEnch(icon, s);
  el.querySelector('.count').textContent = s && s.count > 1 ? s.count : '';
  const dur = el.querySelector('.dur'), max = s && ITEMS[s.id].maxDur;
  if (s && max && s.dur < max) {
    const f = s.dur / max;
    dur.style.display = 'block';
    dur.firstChild.style.width = `${Math.round(f * 100)}%`;
    dur.firstChild.style.background = `hsl(${Math.round(f * 120)},100%,45%)`;
  } else dur.style.display = 'none';
}
// An enchanted stack shimmers purple: .ench adds a sweep masked by the icon image (--img).
function markEnch(icon, s) {
  const on = !!(s && s.ench);
  icon.classList.toggle('ench', on);
  if (on) icon.style.setProperty('--img', `url(${ICON_URL[s.id]})`);
}
function makeSlot(parent, kind, index) {
  const el = document.createElement('div');
  el.className = 'islot'; el.dataset.kind = kind; el.dataset.index = index;
  parent.appendChild(el);
  return el;
}
for (let i = 9; i < 36; i++) makeSlot(storageEl, 'inv', i);
const armorSlotEls = [...document.querySelectorAll('#armorCol .islot')];
for (const el of armorSlotEls) el.style.setProperty('--ghost', `url(${ICON_URL[armorId(2, +el.dataset.index)]})`);
for (let i = 0; i < 9; i++) makeSlot(invHotbarEl, 'inv', i);
for (let i = 0; i < 27; i++) makeSlot(chestGridEl, 'chest', i);
function buildCraftGrid() {
  craftGridEl.innerHTML = '';
  craftGridEl.style.gridTemplateColumns = `repeat(${inv.craftSize}, var(--islot))`;
  for (let i = 0; i < inv.craftSize * inv.craftSize; i++) makeSlot(craftGridEl, 'craft', i);
  document.getElementById('craftTitle').textContent = inv.craftSize === 3 ? 'Crafting Table' : 'Crafting';
}
function slotStack(el) {
  const k = el.dataset.kind, i = +el.dataset.index;
  if (k === 'inv') return inv.slots[i];
  if (k === 'craft') return inv.craft[i];
  if (k === 'chest' || k === 'furnace') return ui.te ? ui.te.slots[i] || null : null;
  if (k === 'trash') return inv.trash;
  if (k === 'armor') return inv.armor[i];
  if (k === 'altar') return inv.altar[i];
  return craftOutput();
}
function renderInventory() {
  for (const el of invEl.querySelectorAll('.islot')) paintSlot(el, slotStack(el));
  for (const el of armorSlotEls) el.classList.toggle('empty', !inv.armor[+el.dataset.index]);
  trashSlotEl.classList.toggle('full', !!inv.trash);
  if (hoverSlot && !slotStack(hoverSlot)) tooltipEl.style.display = 'none';   // the hovered stack moved away
  paintCursor();
  renderRecipeBook();
  if (ui.mode === 'altar') renderAltar();
}
function paintCursor() {
  const s = inv.cursor;
  cursorEl.style.display = s ? 'block' : 'none';
  if (s) {
    cursorEl.querySelector('.icon').style.backgroundImage = `url(${ICON_URL[s.id]})`;
    markEnch(cursorEl.querySelector('.icon'), s);
    cursorEl.querySelector('.count').textContent = s.count > 1 ? s.count : '';
    cursorEl.style.left = mouseX + 'px'; cursorEl.style.top = mouseY + 'px';
  }
}

// Furnace screen progress: the flame shows the fuel left, the arrow the smelt progress.
const flameFillEl = document.getElementById('flameFill'), cookFillEl = document.getElementById('cookFill');
function renderFurnaceProgress() {
  const te = ui.te;
  if (!te || te.type !== 'furnace') return;
  flameFillEl.style.height = `${te.burnMax ? Math.round(te.burn / te.burnMax * 100) : 0}%`;
  cookFillEl.style.width = `${Math.round(te.cook / SMELT_TIME * 36)}px`;
}

// Altar screen: 3 offers for the item in inv.altar[0], paid with the crystals in inv.altar[1].
// A note replaces the offers when there is no item or nothing fits, and names a missing payment.
const altarGemEl = document.getElementById('altarGem'), altarNoteEl = document.getElementById('altarNote');
const offerEls = [...document.querySelectorAll('#altarOffers .offer')];
altarGemEl.style.setProperty('--ghost', `url(${ICON_URL[B.CRYSTAL]})`);
function renderAltar() {
  const [s, gem] = inv.altar, have = gem ? gem.count : 0, offers = altarOffers(s);
  altarGemEl.classList.toggle('empty', !gem);
  offerEls.forEach((el, k) => {
    const o = offers[k];
    el.hidden = !o;
    if (!o) return;
    el.disabled = have < o.cost;
    el.innerHTML = `<span>${ENCH[o.key].name} ${ROMAN[o.level]}</span><small>${o.cost} crystal${o.cost > 1 ? 's' : ''}</small>`;
  });
  altarNoteEl.textContent = !s ? 'Place a tool, armor piece, or bow in the top slot. Crystals go in the slot below it.'
    : !offers.length ? (Object.keys(s.ench || {}).length >= ENCH_SLOTS ? `This item holds ${ENCH_SLOTS} enchantments, the most it can take.`
      : 'No other enchantment fits this item.')
    : have < 3 ? `You have ${have} crystal${have === 1 ? '' : 's'}. Grey offers need more.` : '';
}
// Pays for offer k and adds its enchantment. A new enchantSeed then re-rolls the offers.
function enchantAltar(k) {
  const [s, gem] = inv.altar, o = altarOffers(s)[k];
  if (!o || !gem || gem.count < o.cost) return false;
  s.ench = { ...s.ench, [o.key]: o.level };
  s.dur ??= ITEMS[s.id].maxDur;
  if ((gem.count -= o.cost) <= 0) inv.altar[1] = null;
  setEnchantSeed((Math.random() * 2 ** 31) | 0);
  audio.enchant();
  inv.changed();
  return true;
}
document.getElementById('altarOffers').addEventListener('click', (e) => {
  const el = e.target.closest('.offer');
  if (el && !el.disabled) enchantAltar(+el.dataset.offer);
});

// mode: false or 'inv' (2x2 grid), true or 'table' (3x3 grid), 'altar', 'furnace' or 'chest' (with `t`, the target block)
function openInventory(mode, t) {
  if (game.state !== 'playing' || player.dead) return;
  if (mode === true) mode = 'table';
  ui.te = null;
  if (mode === 'furnace' || mode === 'chest') { ui.te = tileEntity(t.x, t.y, t.z); if (!ui.te) return; }
  ui.mode = ui.te ? mode : mode === 'altar' ? 'altar' : 'craft';
  invPanelEl.dataset.mode = ui.mode;
  inv.craftSize = mode === 'table' ? 3 : 2;
  buildCraftGrid();
  if (ui.mode === 'chest') audio.chest(true, t.x + 0.5, t.y + 0.5, t.z + 0.5);
  if (ui.mode === 'altar') audio.enchant(0.6);
  renderFurnaceProgress();
  input.keys.clear(); input.mouseL = input.mouseR = false; resetMining();
  setState('inventory');
  if (document.pointerLockElement) document.exitPointerLock();
  renderInventory();
  audio.click();
}
// Returns grid and cursor items to the inventory; drops what does not fit.
function closeInventory(noRelock, viaEsc) {
  for (const s of [...inv.craft, ...inv.altar, inv.cursor]) {
    if (!s) continue;
    const left = inv.add(s.id, s.count, s.dur, s.ench);
    if (left) dropStack(restack(s, left), 2);
  }
  inv.craft.fill(null); inv.altar.fill(null); inv.cursor = null;
  clearTimeout(trashTimer); inv.trash = null;   // closing the screen deletes the trashed stack at once
  tooltipEl.style.display = 'none'; cursorEl.style.display = 'none';
  if (ui.mode === 'chest' && ui.te) audio.chest(false, ui.te.x + 0.5, ui.te.y + 0.5, ui.te.z + 0.5);
  ui.te = null; ui.mode = 'craft'; invPanelEl.dataset.mode = 'craft';
  inv.changed();
  if (noRelock) return;
  resumeGame(viaEsc);
}
function inventoryKey(e) {
  if (e.code === 'KeyI' || e.code === 'Escape') { e.preventDefault(); if (!e.repeat) closeInventory(false, e.code === 'Escape'); return; }
  if (hoverSlot && e.code.startsWith('Digit')) {
    const n = +e.code.slice(5) - 1;
    if (n >= 0 && n < 9 && hoverSlot.dataset.kind === 'inv') {
      const i = +hoverSlot.dataset.index;
      const t = inv.slots[n]; inv.slots[n] = inv.slots[i]; inv.slots[i] = t;
      inv.changed();
    }
  }
  if (hoverSlot && e.code === 'KeyQ' && hoverSlot.dataset.kind === 'inv') {
    const i = +hoverSlot.dataset.index, s = inv.slots[i];
    if (s) { dropStack(restack(s, 1), 3); if (--s.count <= 0) inv.slots[i] = null; inv.changed(); }
  }
}

function slotArray(kind) {
  if (kind === 'inv') return inv.slots;
  if (kind === 'armor') return inv.armor;
  if (kind === 'altar') return inv.altar;
  if (kind === 'chest' || kind === 'furnace') return ui.te.slots;
  return inv.craft;
}
// The furnace output only gives; the fuel slot takes only fuel. An armor slot takes only its piece.
// The altar item slot takes an enchantable item; the altar crystal slot takes only crystals.
const slotAccepts = (kind, i, id) => kind === 'armor' ? ITEMS[id].armor?.piece === i
  : kind === 'altar' ? (i === 0 ? enchantable(id) : id === B.CRYSTAL)
  : kind !== 'furnace' || i === 0 || (i === 1 && !!FUEL[id]);
function clickSlot(el, button, shift) {
  const kind = el.dataset.kind, i = +el.dataset.index;
  audio.click();
  if (kind === 'result') { takeResult(shift, button); return; }
  if (kind === 'trash') { clickTrash(); return; }
  if ((kind === 'chest' || kind === 'furnace') && !ui.te) return;
  if (kind === 'furnace' && i === 2 && !shift) { takeOutput(); return; }
  const arr = slotArray(kind), s = arr[i], c = inv.cursor;
  if (shift && button === 0) { if (s) quickMove(kind, i); return; }
  if (c && !slotAccepts(kind, i, c.id)) return;
  if (button === 0) {
    if (!c) { arr[i] = null; inv.cursor = s; }
    else if (!s) { arr[i] = c; inv.cursor = null; }
    else if (s.id === c.id && s.dur === undefined && c.dur === undefined) {
      const n = Math.min(c.count, ITEMS[s.id].maxStack - s.count);
      s.count += n; c.count -= n; if (!c.count) inv.cursor = null;
    } else { arr[i] = c; inv.cursor = s; }
  } else if (button === 2) {
    if (!c && s) {
      const half = Math.ceil(s.count / 2);
      inv.cursor = restack(s, half);
      s.count -= half; if (!s.count) arr[i] = null;
    } else if (c && (!s || (s.id === c.id && s.dur === undefined && s.count < ITEMS[s.id].maxStack))) {
      if (!s) arr[i] = restack(c, 1); else s.count++;
      if (--c.count <= 0) inv.cursor = null;
    }
  }
  inv.changed();
}
// Trash slot, any button: a held stack replaces the trashed stack (the old one is gone) and
// starts a CONFIG.trashDelay countdown. An empty hand takes the trashed stack back before the
// countdown ends, which is the undo. When the countdown ends, emptyTrash() deletes the stack.
function emptyTrash() {
  trashTimer = 0;
  if (!inv.trash) return;
  inv.trash = null;
  inv.changed();
  if (hoverSlot === trashSlotEl) showTooltip(trashSlotEl);
}
function clickTrash() {
  clearTimeout(trashTimer); trashTimer = 0;
  if (inv.cursor) {
    inv.trash = inv.cursor; inv.cursor = null;
    trashTimer = setTimeout(emptyTrash, CONFIG.trashDelay * 1000);
    trashSlotEl.classList.remove('full'); void trashSlotEl.offsetWidth;   // restart the drain bar
  } else if (inv.trash) { inv.cursor = inv.trash; inv.trash = null; }
  else return;
  inv.changed();
  if (hoverSlot === trashSlotEl) showTooltip(trashSlotEl);
}
// Left click on the furnace output: move it onto the cursor (merging with a matching stack).
function takeOutput() {
  const arr = ui.te.slots, s = arr[2], c = inv.cursor;
  if (!s) return;
  if (!c) { inv.cursor = s; arr[2] = null; }
  else if (c.id === s.id && c.dur === undefined) {
    const n = Math.min(s.count, ITEMS[c.id].maxStack - c.count);
    c.count += n; s.count -= n; if (!s.count) arr[2] = null;
  }
  inv.changed();
}
// Shift-click: containers and the craft grid empty into the inventory; the inventory fills the
// open container (smeltables to the furnace input, fuel to its fuel slot), else hotbar <-> storage.
function quickMove(kind, i) {
  const arr = slotArray(kind), s = arr[i];
  arr[i] = null;
  let left;
  const piece = ITEMS[s.id].armor?.piece;
  if (kind !== 'inv') left = inv.add(s.id, s.count, s.dur, s.ench);
  else if (ui.mode === 'craft' && piece !== undefined && !inv.armor[piece]) { inv.armor[piece] = s; left = 0; audio.equip(); }
  else if (ui.mode === 'altar' && s.id === B.CRYSTAL) left = moveInto(s, inv.altar, 1, 2);
  else if (ui.mode === 'altar' && enchantable(s.id) && !inv.altar[0]) { inv.altar[0] = s; left = 0; }
  else if (ui.mode === 'chest') left = moveInto(s, ui.te.slots, 0, 27);
  else if (ui.mode === 'furnace' && SMELT[s.id] !== undefined) left = moveInto(s, ui.te.slots, 0, 1);
  else if (ui.mode === 'furnace' && FUEL[s.id]) left = moveInto(s, ui.te.slots, 1, 2);
  else left = i < 9 ? moveInto(s, inv.slots, 9, 36) : moveInto(s, inv.slots, 0, 9);
  if (left) arr[i] = restack(s, left);
  inv.changed();
}
function moveInto(s, arr, a, b) {
  let count = s.count; const max = ITEMS[s.id].maxStack;
  if (s.dur === undefined) for (let j = a; j < b && count; j++) {
    const t = arr[j];
    if (t && t.id === s.id && t.count < max) { const n = Math.min(count, max - t.count); t.count += n; count -= n; }
  }
  for (let j = a; j < b && count; j++) if (!arr[j]) { arr[j] = restack(s, count); count = 0; }
  return count;
}
function takeResult(shift) {
  let out = craftOutput();
  if (!out) return;
  if (shift) {
    let made = 0;
    while (out && made < 64) {
      const left = inv.add(out.id, out.count, out.dur);
      consumeCraft(); made += out.count - left;
      if (left) { dropStack({ id: out.id, count: left, dur: out.dur }, 2); break; }
      const next = craftOutput();
      if (!next || next.id !== out.id) break;
      out = next;
    }
  } else {
    const c = inv.cursor;
    if (!c) inv.cursor = out;
    else if (c.id === out.id && c.dur === undefined && c.count + out.count <= ITEMS[c.id].maxStack) c.count += out.count;
    else return;
    consumeCraft();
  }
  audio.craft();
  inv.changed();
}

invEl.addEventListener('mousedown', (e) => {
  const el = e.target.closest('.islot');
  if (el) { e.preventDefault(); clickSlot(el, e.button, e.shiftKey); return; }
  if (e.target === invEl && inv.cursor) {           // click outside the panel: throw the cursor stack
    dropStack(inv.cursor, 4); inv.cursor = null; inv.changed();
  }
});
invEl.addEventListener('mouseover', (e) => { hoverSlot = e.target.closest('.islot'); showTooltip(hoverSlot); });
function showTooltip(el) {
  if (el && el.dataset.kind === 'trash') {
    const s = inv.trash;
    tooltipEl.textContent = inv.cursor ? `Trash\nClick to delete ${ITEMS[inv.cursor.id].name}`
      : s ? `Trash: ${s.count > 1 ? s.count + ' × ' : ''}${ITEMS[s.id].name}\nClick to take it back\nDeleted after ${CONFIG.trashDelay} s or when this screen closes`
      : 'Trash\nDrop a stack here to delete it';
    tooltipEl.style.display = 'block';
    return;
  }
  const s = el && slotStack(el);
  if (!s && el && el.dataset.kind === 'armor' && !inv.cursor) {   // an empty armor slot names its piece
    tooltipEl.textContent = `${ARMOR_PIECES[+el.dataset.index].name} slot`; tooltipEl.style.display = 'block'; return;
  }
  if (!s) { tooltipEl.style.display = 'none'; return; }
  const it = ITEMS[s.id];
  let text = it.name;
  for (const k in s.ench || {}) text += `\n${ENCH[k].name} ${ROMAN[s.ench[k]]}`;
  if (it.maxDur) text += `\nDurability: ${s.dur ?? it.maxDur} / ${it.maxDur}`;
  if (it.kind === 'food') text += `\nRestores ${it.heal / 2} ♥`;
  if (it.tool) text += `\n${it.tool.damage} attack damage`;
  if (it.armor) text += `\n+${it.armor.pts} armor`;
  tooltipEl.textContent = text; tooltipEl.style.display = inv.cursor ? 'none' : 'block';
}
invEl.addEventListener('mouseout', (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest('.islot')) { hoverSlot = null; tooltipEl.style.display = 'none'; } });
addEventListener('mousemove', (e) => {
  mouseX = e.clientX; mouseY = e.clientY;
  if (game.state !== 'inventory') return;
  cursorEl.style.left = mouseX + 'px'; cursorEl.style.top = mouseY + 'px';
  tooltipEl.style.left = mouseX + 14 + 'px'; tooltipEl.style.top = mouseY - 30 + 'px';
});

// ---- recipe book: every recipe, click to fill the grid from the inventory ---------------
document.getElementById('recipeToggle').addEventListener('click', () => { recipesEl.classList.toggle('show'); audio.click(); renderRecipeBook(); });
function recipeCells(r) {
  const cells = new Array(9).fill(null);
  if (r.shapeless) r.shapeless.forEach((id, i) => { cells[i] = id; });
  else for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const ch = r.pattern[j][i]; cells[j * 3 + i] = ch === ' ' ? null : r.key[ch]; }
  return cells;
}
function renderRecipeBook() {
  if (!recipesEl.classList.contains('show')) return;
  if (!recipesEl.childElementCount) {
    recipesEl.innerHTML = '<h3>Recipes</h3>';
    RECIPES.forEach((r, n) => {
      const row = document.createElement('div');
      row.className = 'recipe'; row.dataset.n = n;
      const g = document.createElement('div'); g.className = 'rgrid';
      for (const id of recipeCells(r)) { const c = document.createElement('div'); if (id !== null) c.style.backgroundImage = `url(${ICON_URL[id]})`; g.appendChild(c); }
      const out = document.createElement('div'); out.className = 'rout'; out.style.backgroundImage = `url(${ICON_URL[r.out]})`;
      if (r.count > 1) out.innerHTML = `<span>${r.count}</span>`;
      const name = document.createElement('div'); name.className = 'rname'; name.textContent = ITEMS[r.out].name;
      row.append(g, out, name);
      row.addEventListener('mousedown', (e) => { e.stopPropagation(); fillRecipe(r, row); });
      recipesEl.appendChild(row);
    });
  }
  for (const row of recipesEl.querySelectorAll('.recipe')) {
    const r = RECIPES[+row.dataset.n];
    row.classList.toggle('dim', !r.shapeless && (r.w > inv.craftSize || r.h > inv.craftSize));
  }
}
function fillRecipe(r, row) {
  const size = inv.craftSize;
  if (!r.shapeless && (r.w > size || r.h > size)) { hud.toast('Needs a crafting table'); return; }
  // return the current grid to the inventory first
  for (let i = 0; i < 9; i++) { const s = inv.craft[i]; if (s) { inv.craft[i] = null; const left = inv.add(s.id, s.count, s.dur, s.ench); if (left) dropStack(restack(s, left), 2); } }
  const cells = recipeCells(r), need = {};
  for (const id of cells) if (id !== null) need[id] = (need[id] || 0) + 1;
  for (const id in need) if (inv.countOf(+id) < need[id]) {
    row.classList.add('missing'); setTimeout(() => row.classList.remove('missing'), 350);
    inv.changed(); return;
  }
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) {
    const id = cells[j * 3 + i];
    if (id === null) continue;
    inv.take(id, 1);
    inv.craft[j * size + i] = { id, count: 1 };
  }
  audio.click();
  inv.changed();
}

export {
  closeInventory, enchantAltar, invEl, inventoryKey, openInventory, paintSlot, renderFurnaceProgress,
  renderInventory,
};
