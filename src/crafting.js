// ---- recipes ------------------------------------------------------------------------
import { ARMOR_PIECES, ARMOR_TIERS, armorId, B, I, STORAGE_DEFS, toolId } from './blocks.js';

const RECIPES = [];
function shaped(pattern, key, out, count = 1) {
  RECIPES.push({ pattern, key, out, count, w: pattern[0].length, h: pattern.length });
}
function shapeless(ings, out, count = 1) { RECIPES.push({ shapeless: ings.slice().sort((a, b) => a - b), out, count }); }
shapeless([B.LOG], B.PLANKS, 4);
shaped(['P', 'P'], { P: B.PLANKS }, I.STICK, 4);
shaped(['PP', 'PP'], { P: B.PLANKS }, B.TABLE, 1);
shaped(['C', 'S'], { C: I.COAL, S: I.STICK }, B.TORCH, 4);
shaped(['S S', 'SSS', 'S S'], { S: I.STICK }, B.LADDER, 3);
shaped(['CCC', 'C C', 'CCC'], { C: B.COBBLE }, B.FURNACE, 1);
shaped(['PPP', 'P P', 'PPP'], { P: B.PLANKS }, B.CHEST, 1);
shaped(['PP', 'PP', 'PP'], { P: B.PLANKS }, I.DOOR, 3);
shaped(['C  ', 'CC ', 'CCC'], { C: B.COBBLE }, B.STAIRS_COBBLE, 4);
shaped(['P  ', 'PP ', 'PPP'], { P: B.PLANKS }, B.STAIRS_PLANKS, 4);
shaped(['SS', 'SS'], { S: B.STONE }, B.STONE_BRICKS, 4);
shaped(['SS', 'SS'], { S: B.SAND }, B.SANDSTONE, 1);
shaped(['S', 'S'], { S: B.SANDSTONE }, B.CHISELED_SANDSTONE, 1);
const TOOL_MATS = [[B.PLANKS, 1], [B.COBBLE, 2], [I.COPPER, 3], [I.STEEL, 4], [I.GOLD, 5], [I.RUBY, 6], [I.DIAMOND, 7]];
for (const [mat, tier] of TOOL_MATS) {
  shaped(['MMM', ' S ', ' S '], { M: mat, S: I.STICK }, toolId('pickaxe', tier));
  shaped(['M', 'M', 'S'], { M: mat, S: I.STICK }, toolId('sword', tier));
  shaped(['MM', 'MS', ' S'], { M: mat, S: I.STICK }, toolId('axe', tier));
  shaped(['M', 'S', 'S'], { M: mat, S: I.STICK }, toolId('shovel', tier));
  shaped(['MM', ' S', ' S'], { M: mat, S: I.STICK }, toolId('hoe', tier));
}
shaped(['WWW'], { W: I.WHEAT }, I.BREAD);
shapeless([I.BONE], I.BONE_MEAL, 3);
shaped(['S S', ' S '], { S: I.STEEL }, I.BUCKET);
shaped(['GSG', 'SGS', 'GSG'], { G: I.GUNPOWDER, S: B.SAND }, B.TNT);
shaped(['F', 'S', 'E'], { F: I.FLINT, S: I.STICK, E: I.FEATHER }, I.ARROW, 4);
shaped([' TS', 'T S', ' TS'], { T: I.STICK, S: I.STRING }, I.BOW);
ARMOR_TIERS.forEach((t, tier) => ARMOR_PIECES.forEach((p, piece) => shaped(p.shape, { M: t.item }, armorId(tier, piece))));
shaped(['OCO', 'DMD', 'OCO'], { O: B.OBSIDIAN, C: B.CRYSTAL, D: I.DIAMOND, M: I.MAGMA_CORE }, B.ALTAR);
shaped(['P P', 'PPP'], { P: B.PLANKS }, I.BOAT);
shaped(['S S', 'SXS', 'S S'], { S: I.STEEL, X: I.STICK }, B.RAIL, 16);
shaped(['S S', 'SSS'], { S: I.STEEL }, I.MINECART);
shaped([' S ', 'SCS', ' S '], { S: I.STEEL, C: B.CRYSTAL }, I.COMPASS);
for (const [id, , , , item] of STORAGE_DEFS) {
  shaped(['MMM', 'MMM', 'MMM'], { M: I[item] }, id);
  shapeless([id], I[item], 9);
}

function matchRecipe(grid, size) {
  let x0 = size, y0 = size, x1 = -1, y1 = -1;
  const ids = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const s = grid[y * size + x];
    if (!s) continue;
    ids.push(s.id);
    if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y;
  }
  if (!ids.length) return null;
  ids.sort((a, b) => a - b);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  for (const r of RECIPES) {
    if (r.shapeless) {
      if (r.shapeless.length === ids.length && r.shapeless.every((v, i) => v === ids[i])) return r;
      continue;
    }
    if (r.w !== bw || r.h !== bh) continue;
    for (const mirror of [false, true]) {
      let ok = true;
      for (let j = 0; j < bh && ok; j++) for (let i = 0; i < bw; i++) {
        const ch = r.pattern[j][mirror ? bw - 1 - i : i];
        const want = ch === ' ' ? null : r.key[ch];
        const s = grid[(y0 + j) * size + x0 + i];
        if ((s ? s.id : null) !== want) { ok = false; break; }
      }
      if (ok) return r;
    }
  }
  return null;
}

export { matchRecipe, RECIPES };
