import { ITEMS } from './blocks.js';
import { inv } from './inventory.js';
import { matchRecipe } from './crafting.js';

const craftGrid = () => inv.craft.slice(0, inv.craftSize * inv.craftSize);
function craftOutput() {
  const r = matchRecipe(craftGrid(), inv.craftSize);
  return r ? { id: r.out, count: r.count, dur: ITEMS[r.out].maxDur } : null;
}
function consumeCraft() {
  const n = inv.craftSize * inv.craftSize;
  for (let i = 0; i < n; i++) { const s = inv.craft[i]; if (s && --s.count <= 0) inv.craft[i] = null; }
}

export { consumeCraft, craftOutput };
