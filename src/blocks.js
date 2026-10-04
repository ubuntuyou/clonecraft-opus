/* =====================================================================================
 * === 2. BLOCK AND ITEM DEFINITIONS
 * ===================================================================================== */
import { mulberry32, randInt, UNLOADED } from './config.js';

const B = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, COBBLE: 4, COAL_ORE: 5, IRON_ORE: 6, SAND: 7, WATER: 8,
  LOG: 9, PLANKS: 10, LEAVES: 11, SNOW: 12, TABLE: 13, TORCH: 14, BEDROCK: 15,
  TALL_GRASS: 16, ROSE: 17, DANDELION: 18, CACTUS: 19, WOOL: 20, GRAVEL: 21,
  COPPER_ORE: 22, GOLD_ORE: 23, RUBY_ORE: 24, DIAMOND_ORE: 25, GLASS: 26, OBSIDIAN: 27,
  FURNACE: 28,        // 28..31: facing 0..3
  FURNACE_LIT: 32,    // 32..35: facing 0..3
  CHEST: 36,          // 36..39: facing 0..3
  DOOR: 40,           // 40..55: DOOR + (top << 3 | open << 2 | facing)
  WATER_FLOW: 56,     // 56..62: flowing water, level 1..7
  LAVA: 63,           // lava source
  LAVA_FLOW: 64,      // 64..70: flowing lava, level 1..7
  TORCH_WALL: 71,     // 71..74: wall torch, leans toward DIR4[facing]; its wall is the opposite cell
  LEAVES_RED: 75, LEAVES_ORANGE: 76, LEAVES_BROWN: 77, LEAVES_PINK: 78, LEAVES_WHITE: 79,
  LEAVES_PLACED: 80,  // 80..86: placed leaves (never decay), LEAF_COLOR 0..6
  LEAVES_YELLOW: 87,  // natural yellow leaves (after the placed range; saves hold the older IDs)
  // storage blocks: nine ingots, gems, or coal crafted into one building block
  COAL_BLOCK: 88, COPPER_BLOCK: 89, STEEL_BLOCK: 90, GOLD_BLOCK: 91, RUBY_BLOCK: 92, DIAMOND_BLOCK: 93,
  CRYSTAL: 94,        // 94..99: crystal cluster that grows toward CRYSTAL_GROW[v] (0 up, 1 down, 2..5 walls)
  TNT: 110,           // ids 0..99 are full; 110..129 hold no items, so blocks may use them
  STAIRS_COBBLE: 111, // 111..118: STAIRS_COBBLE + (top << 2 | facing)
  STAIRS_PLANKS: 119, // 119..126: STAIRS_PLANKS + (top << 2 | facing)
  // SPEC_expansion id plan: blocks use 127..129, 138..166, and 249; items use the rest.
  FARMLAND: 127, FARMLAND_WET: 128,
  ALTAR: 145,         // enchanting altar (Batch 15)
  SAPLING: 146,       // 146..152: SAPLING + LEAF_COLOR
  WHEAT: 153,         // 153..156: WHEAT + growth stage 0..3 (3 is ripe)
  RAIL: 157,          // 157..166: RAIL + rail shape 0..9 (see RAIL_ENDS)
  LADDER: 250,        // 250..253: ladder facing 0..3; it hangs on the wall opposite DIR4[facing]
  // structures (Batch 17). Id 140 is the door item, so the bricks skip it.
  COBWEB: 129, MOSSY_COBBLE: 138, STONE_BRICKS: 139, MOSSY_BRICKS: 141, CRACKED_BRICKS: 142,
  SANDSTONE: 143, CHISELED_SANDSTONE: 144, SPAWNER: 249,
  // Ember Realm (SPEC_realms, Phase 2)
  EMBER_ROCK: 176, ASH_SAND: 177, EMBER_LAMP: 178, EMBERITE_ORE: 179, EMBER_BRICKS: 180,
};
// Growth direction of each crystal variant. The crystal hangs on the cell opposite its growth.
// Walls follow DIR4: variant 2 + k grows toward DIR4[k], like TORCH_WALL + k.
const CRYSTAL_GROW = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [0, 0, 1], [-1, 0, 0], [0, 0, -1]];
const SHAPE = { NONE: 0, CUBE: 1, CROSS: 2, TORCH: 3, WATER: 4, CACTUS: 5, DOOR: 6, CRYSTAL: 7, STAIRS: 8, FARMLAND: 9, CROP: 10, RAIL: 11, LADDER: 12 };
// Horizontal directions used by facing blocks and doors: 0 +X, 1 +Z, 2 -X, 3 -Z.
const DIR4 = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const DIR_FACE = [0, 4, 1, 5];          // direction -> FACES index

// Flat property tables indexed by block id (fast lookups in hot loops).
const OPAQUE = new Uint8Array(256);     // blocks light fully, hides neighbour faces, casts AO
const SOLID = new Uint8Array(256);      // collides with entities
const SKY_FREE = new Uint8Array(256);   // full sky light (15) falls through without loss
const ATTEN = new Uint8Array(256);      // extra light loss when light enters this block
const EMIT = new Uint8Array(256);       // block light emission (warm: torches, lava)
const EMIT_CRY = new Uint8Array(256);   // crystal light emission (turquoise: crystal clusters)
const SHAPE_OF = new Uint8Array(256);
const TARGETABLE = new Uint8Array(256); // the crosshair ray stops here
const REPLACEABLE = new Uint8Array(256);// placing a block may overwrite this
const NEEDS_SUPPORT = new Uint8Array(256); // breaks when the block below is removed
const GLOWS = new Uint8Array(256);      // bright texels (red > 0.8) ignore light (lit furnace, lava)
const LIGHT_STOP = new Uint8Array(256); // takes light from its neighbours but never passes it on (stairs)
const IS_STAIR = new Uint8Array(256);
// Leaves. LEAF_COLOR: 0 green, 1 red, 2 orange, 3 brown, 4 pink, 5 white, 6 yellow.
// A natural leaf (tree-grown) decays without a nearby log. A placed leaf never decays.
const IS_LEAF = new Uint8Array(256), LEAF_DECAYS = new Uint8Array(256), LEAF_COLOR = new Uint8Array(256);
// Climbable cells: the player climbs inside leaves and ladders (Space up, Shift down, no key holds).
const CLIMB = new Uint8Array(256);
// Liquids. A "source" has level 8. A "flow" has level 1..7. LIQ_KIND: 1 water, 2 lava.
const LIQ_KIND = new Uint8Array(256), LIQ_LEVEL = new Uint8Array(256);
const IS_WATER = new Uint8Array(256), IS_LAVA = new Uint8Array(256);
SOLID[UNLOADED] = 1; OPAQUE[UNLOADED] = 1;
const LIQ_SOURCE = [0, B.WATER, B.LAVA], LIQ_FLOW = [0, B.WATER_FLOW, B.LAVA_FLOW];
const liquidId = (kind, level) => level >= 8 ? LIQ_SOURCE[kind] : LIQ_FLOW[kind] + level - 1;

const BLOCKS = [];
function defBlock(id, d) {
  const def = Object.assign({
    id, name: 'Block', shape: SHAPE.CUBE, opaque: true, solid: true, hardness: 1, tool: null, minLevel: 0,
    tex: null, drop: id, sound: 'stone', skyFree: false, atten: 0, emit: 0, particle: null, facing: -1, base: id,
    leaf: -1, decays: false, emitCry: 0,
  }, d);
  BLOCKS[id] = def;
  OPAQUE[id] = def.opaque ? 1 : 0; SOLID[id] = def.solid ? 1 : 0; SKY_FREE[id] = def.skyFree ? 1 : 0;
  ATTEN[id] = def.atten; EMIT[id] = def.emit; EMIT_CRY[id] = def.emitCry; SHAPE_OF[id] = def.shape;
  TARGETABLE[id] = (id !== B.AIR && def.shape !== SHAPE.WATER) ? 1 : 0;
  REPLACEABLE[id] = def.replaceable ? 1 : 0;
  NEEDS_SUPPORT[id] = def.needsSupport ? 1 : 0;
  GLOWS[id] = def.glows ? 1 : 0;
  IS_LEAF[id] = def.leaf >= 0 ? 1 : 0; LEAF_DECAYS[id] = def.decays ? 1 : 0; LEAF_COLOR[id] = Math.max(0, def.leaf);
  CLIMB[id] = def.climb || def.leaf >= 0 ? 1 : 0;
}
const all = (t) => ({ top: t, bottom: t, side: t });
const baseOf = (id) => BLOCKS[id] ? BLOCKS[id].base : -1;   // the item-level block of a variant (UNLOADED -> -1)
defBlock(B.AIR, { name: 'Air', shape: SHAPE.NONE, opaque: false, solid: false, skyFree: true, hardness: 0, replaceable: true, drop: null });
defBlock(B.GRASS, { name: 'Grass Block', tex: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }, hardness: 0.6, tool: 'shovel', drop: B.DIRT, sound: 'grass' });
defBlock(B.DIRT, { name: 'Dirt', tex: all('dirt'), hardness: 0.5, tool: 'shovel', sound: 'gravel' });
defBlock(B.STONE, { name: 'Stone', tex: all('stone'), hardness: 1.5, tool: 'pickaxe', drop: B.COBBLE });
defBlock(B.COBBLE, { name: 'Cobblestone', tex: all('cobble'), hardness: 2, tool: 'pickaxe' });
defBlock(B.SAND, { name: 'Sand', tex: all('sand'), hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(B.LOG, { name: 'Wood Log', tex: { top: 'log_top', bottom: 'log_top', side: 'log_side' }, hardness: 2, tool: 'axe', sound: 'wood' });
defBlock(B.PLANKS, { name: 'Planks', tex: all('planks'), hardness: 2, tool: 'axe', sound: 'wood' });
// Natural leaves (one per color) and their placed variants. A placed leaf drops the natural item.
const LEAF_NATURAL = [B.LEAVES, B.LEAVES_RED, B.LEAVES_ORANGE, B.LEAVES_BROWN, B.LEAVES_PINK, B.LEAVES_WHITE, B.LEAVES_YELLOW];
const LEAF_NAMES = ['Leaves', 'Red Leaves', 'Orange Leaves', 'Brown Leaves', 'Pink Leaves', 'White Leaves', 'Yellow Leaves'];
const LEAF_TILES = ['leaves', 'leaves_red', 'leaves_orange', 'leaves_brown', 'leaves_pink', 'leaves_white', 'leaves_yellow'];
for (let c = 0; c < LEAF_NATURAL.length; c++) {
  const leaf = { name: LEAF_NAMES[c], tex: all(LEAF_TILES[c]), opaque: false, hardness: 0.2, tool: 'sword', sound: 'grass', atten: 1, leaf: c };
  defBlock(LEAF_NATURAL[c], Object.assign({ decays: true }, leaf));
  defBlock(B.LEAVES_PLACED + c, Object.assign({ base: LEAF_NATURAL[c], drop: LEAF_NATURAL[c], noItem: true }, leaf));
}
defBlock(B.SNOW, { name: 'Snow', tex: all('snow'), hardness: 0.2, tool: 'shovel', sound: 'snow' });
defBlock(B.TABLE, { name: 'Crafting Table', tex: { top: 'table_top', bottom: 'planks', side: 'table_side', front: 'table_front' }, hardness: 2.5, tool: 'axe', sound: 'wood' });
defBlock(B.TORCH, { name: 'Torch', shape: SHAPE.TORCH, tex: all('torch'), opaque: false, solid: false, skyFree: true, hardness: 0, emit: 15, sound: 'wood', needsSupport: true });
defBlock(B.BEDROCK, { name: 'Bedrock', tex: all('bedrock'), hardness: -1, drop: null });
defBlock(B.TALL_GRASS, { name: 'Tall Grass', shape: SHAPE.CROSS, tex: all('tall_grass'), opaque: false, solid: false, skyFree: true, hardness: 0, drop: null, sound: 'grass', replaceable: true, needsSupport: true });
defBlock(B.ROSE, { name: 'Rose', shape: SHAPE.CROSS, tex: all('rose'), opaque: false, solid: false, skyFree: true, hardness: 0, sound: 'grass', needsSupport: true });
defBlock(B.DANDELION, { name: 'Dandelion', shape: SHAPE.CROSS, tex: all('dandelion'), opaque: false, solid: false, skyFree: true, hardness: 0, sound: 'grass', needsSupport: true });
defBlock(B.CACTUS, { name: 'Cactus', shape: SHAPE.CACTUS, tex: { top: 'cactus_top', bottom: 'cactus_top', side: 'cactus_side' }, opaque: false, hardness: 0.4, sound: 'cloth', atten: 1, needsSupport: true });
defBlock(B.WOOL, { name: 'Wool', tex: all('wool'), hardness: 0.8, sound: 'cloth' });
defBlock(B.GRAVEL, { name: 'Gravel', tex: all('gravel'), hardness: 0.6, tool: 'shovel', sound: 'gravel', drop: 'gravel' });
defBlock(B.GLASS, { name: 'Glass', tex: all('glass'), opaque: false, skyFree: true, hardness: 0.3, sound: 'glass' });
defBlock(B.OBSIDIAN, { name: 'Obsidian', tex: all('obsidian'), hardness: 50, tool: 'pickaxe', minLevel: 5 });
// ---- ores. A row is [id, name, tile, minLevel, drop item key in I, min count, max count].
// Rarer ores need a better pickaxe (minLevel) and sit deeper (section 5, veins).
const ORE_DEFS = [
  [B.COAL_ORE, 'Coal Ore', 'coal_ore', 1, 'COAL', 1, 2],
  [B.COPPER_ORE, 'Copper Ore', 'copper_ore', 2, 'RAW_COPPER', 1, 3],
  [B.IRON_ORE, 'Iron Ore', 'iron_ore', 2, 'RAW_IRON', 1, 1],
  [B.GOLD_ORE, 'Gold Ore', 'gold_ore', 3, 'RAW_GOLD', 1, 1],
  [B.RUBY_ORE, 'Ruby Ore', 'ruby_ore', 3, 'RUBY', 1, 2],
  [B.DIAMOND_ORE, 'Diamond Ore', 'diamond_ore', 4, 'DIAMOND', 1, 1],
  [B.EMBERITE_ORE, 'Emberite Ore', 'emberite_ore', 5, 'RAW_EMBERITE', 1, 1],   // Ember Realm only
];
const IS_ORE = new Set(ORE_DEFS.map((r) => r[0]));
for (const [id, name, tile, lvl] of ORE_DEFS) defBlock(id, { name, tex: all(tile), hardness: 3, tool: 'pickaxe', minLevel: lvl });
// ---- storage blocks. A row is [id, name, tile, minLevel, item key in I]. Nine items craft one
// block (3x3, crafting table), and one block crafts back into nine items. minLevel matches the ore.
const STORAGE_DEFS = [
  [B.COAL_BLOCK, 'Block of Coal', 'coal_block', 1, 'COAL'],
  [B.COPPER_BLOCK, 'Block of Copper', 'copper_block', 2, 'COPPER'],
  [B.STEEL_BLOCK, 'Block of Steel', 'steel_block', 2, 'STEEL'],
  [B.GOLD_BLOCK, 'Block of Gold', 'gold_block', 3, 'GOLD'],
  [B.RUBY_BLOCK, 'Block of Ruby', 'ruby_block', 3, 'RUBY'],
  [B.DIAMOND_BLOCK, 'Block of Diamond', 'diamond_block', 4, 'DIAMOND'],
];
for (const [id, name, tile, lvl] of STORAGE_DEFS) defBlock(id, { name, tex: all(tile), hardness: 5, tool: 'pickaxe', minLevel: lvl });
defBlock(B.TNT, { name: 'TNT', tex: { top: 'tnt_top', bottom: 'tnt_bottom', side: 'tnt_side' }, hardness: 0, sound: 'grass' });
// ---- crystal clusters: grow in caves on floors, ceilings, and walls, and give turquoise crystal light
for (let v = 0; v < 6; v++) {
  defBlock(B.CRYSTAL + v, { name: 'Crystal Cluster', shape: SHAPE.CRYSTAL, tex: all('crystal'), opaque: false, solid: false, skyFree: true,
    hardness: 1.5, tool: 'pickaxe', sound: 'glass', emitCry: 12, needsSupport: true, base: B.CRYSTAL, noItem: v > 0, drop: B.CRYSTAL });
}
// ---- facing blocks: one id per direction; the front tile faces DIR4[facing]
for (let f = 0; f < 4; f++) {
  defBlock(B.FURNACE + f, { name: 'Furnace', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front' }, hardness: 3.5, tool: 'pickaxe', facing: f, base: B.FURNACE, noItem: f > 0, drop: B.FURNACE });
  defBlock(B.FURNACE_LIT + f, { name: 'Furnace', tex: { top: 'furnace_top', bottom: 'furnace_top', side: 'furnace_side', front: 'furnace_front_lit' }, hardness: 3.5, tool: 'pickaxe', facing: f, base: B.FURNACE, noItem: true, drop: B.FURNACE, emit: 13, glows: true });
  defBlock(B.CHEST + f, { name: 'Chest', tex: { top: 'chest_top', bottom: 'chest_top', side: 'chest_side', front: 'chest_front' }, hardness: 2.5, tool: 'axe', sound: 'wood', facing: f, base: B.CHEST, noItem: f > 0, drop: B.CHEST });
  defBlock(B.TORCH_WALL + f, { name: 'Torch', shape: SHAPE.TORCH, tex: all('torch'), opaque: false, solid: false, skyFree: true, hardness: 0, emit: 15, sound: 'wood', needsSupport: true, facing: f, base: B.TORCH, noItem: true, drop: B.TORCH });
}
// ---- doors: two cells tall. Bit 3 = top half, bit 2 = open, bits 0-1 = facing (the direction
// the placer looked). A closed door blocks its whole cell; an open door does not collide.
for (let v = 0; v < 16; v++) {
  const top = v >> 3, open = (v >> 2) & 1;
  defBlock(B.DOOR + v, { name: 'Door', shape: SHAPE.DOOR, tex: all(top ? 'door_top' : 'door_bottom'), opaque: false, solid: !open,
    hardness: 3, tool: 'axe', sound: 'wood', noItem: true, drop: 'door', base: B.DOOR, needsSupport: !top });
}
// ---- stairs: v = top << 2 | facing. The tall half lies toward DIR4[facing] (the placer's look
// direction). A top stair hangs upside down. A stair stops light like a full block (LIGHT_STOP),
// but its own cell holds light, so the faces of its neighbours stay lit.
for (const [base, name, src] of [[B.STAIRS_COBBLE, 'Cobblestone Stairs', B.COBBLE], [B.STAIRS_PLANKS, 'Plank Stairs', B.PLANKS]]) {
  const m = BLOCKS[src];
  for (let v = 0; v < 8; v++) {
    defBlock(base + v, { name, shape: SHAPE.STAIRS, tex: m.tex, opaque: false, hardness: m.hardness, tool: m.tool, sound: m.sound,
      base, noItem: v > 0, drop: base });
    IS_STAIR[base + v] = 1; LIGHT_STOP[base + v] = 1;
  }
}
// ---- farming. Farmland is 15/16 tall and stops light like a stair. FARMLAND_WET is the darker
// variant near water. Saplings grow the tree of their leaf color. Wheat grows through stages 0..3.
for (const [id, top] of [[B.FARMLAND, 'farmland'], [B.FARMLAND_WET, 'farmland_wet']]) {
  defBlock(id, { name: 'Farmland', shape: SHAPE.FARMLAND, tex: { top, bottom: 'dirt', side: 'dirt' }, opaque: false, hardness: 0.6,
    tool: 'shovel', sound: 'gravel', drop: B.DIRT, base: B.FARMLAND, noItem: true });
  LIGHT_STOP[id] = 1;
}
const SAPLING_NAMES = ['Oak Sapling', 'Red Oak Sapling', 'Orange Oak Sapling', 'Brown Oak Sapling', 'Pink Oak Sapling', 'Spruce Sapling', 'Yellow Oak Sapling'];
for (let c = 0; c < 7; c++) {
  defBlock(B.SAPLING + c, { name: SAPLING_NAMES[c], shape: SHAPE.CROSS, tex: all('sapling_' + c), opaque: false, solid: false, skyFree: true,
    hardness: 0, sound: 'grass', needsSupport: true, leaf: -1 });
}
for (let v = 0; v < 4; v++) {
  defBlock(B.WHEAT + v, { name: 'Wheat Crops', shape: SHAPE.CROP, tex: all('wheat_' + v), opaque: false, solid: false, skyFree: true,
    hardness: 0, sound: 'grass', needsSupport: true, base: B.WHEAT, noItem: true, drop: 'wheat' });
}
// ---- the enchanting altar: a right click opens the altar screen. Bright rune texels glow (soft glow).
defBlock(B.ALTAR, { name: 'Enchanting Altar', tex: { top: 'altar_top', bottom: 'obsidian', side: 'altar_side' }, hardness: 8, tool: 'pickaxe',
  emit: 10, glows: true });
// ---- structure blocks (Batch 17). A cobweb slows movement (moveEntity); only a sword harvests its string.
// A spawner has no item and drops nothing; the spawners module runs it from the chunk features.
defBlock(B.MOSSY_COBBLE, { name: 'Mossy Cobblestone', tex: all('mossy_cobble'), hardness: 2, tool: 'pickaxe' });
defBlock(B.STONE_BRICKS, { name: 'Stone Bricks', tex: all('stone_bricks'), hardness: 1.5, tool: 'pickaxe' });
defBlock(B.MOSSY_BRICKS, { name: 'Mossy Stone Bricks', tex: all('mossy_bricks'), hardness: 1.5, tool: 'pickaxe' });
defBlock(B.CRACKED_BRICKS, { name: 'Cracked Stone Bricks', tex: all('cracked_bricks'), hardness: 1.5, tool: 'pickaxe' });
defBlock(B.SANDSTONE, { name: 'Sandstone', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_side' }, hardness: 0.8, tool: 'pickaxe' });
defBlock(B.CHISELED_SANDSTONE, { name: 'Chiseled Sandstone', tex: { top: 'sandstone_top', bottom: 'sandstone_top', side: 'sandstone_chiseled' },
  hardness: 0.8, tool: 'pickaxe' });
defBlock(B.COBWEB, { name: 'Cobweb', shape: SHAPE.CROSS, tex: all('cobweb'), opaque: false, solid: false, skyFree: true, hardness: 4,
  tool: 'sword', harvestTool: 'sword', noItem: true, sound: 'cloth' });
defBlock(B.SPAWNER, { name: 'Monster Spawner', tex: all('spawner'), opaque: false, skyFree: true, hardness: 5, tool: 'pickaxe',
  drop: null, noItem: true, sound: 'glass' });
// ---- Ember Realm blocks (SPEC_realms, Phase 2). Ash Sand slows walking to 40 % (player.js, ASH_SLOW).
// An Ember Lamp emits light 15 and its bright texels glow. Emberite Ore glows too, but emits no light.
defBlock(B.EMBER_ROCK, { name: 'Ember Rock', tex: all('ember_rock'), hardness: 0.4, tool: 'pickaxe' });
defBlock(B.ASH_SAND, { name: 'Ash Sand', tex: all('ash_sand'), hardness: 0.5, tool: 'shovel', sound: 'sand' });
defBlock(B.EMBER_LAMP, { name: 'Ember Lamp', tex: all('ember_lamp'), hardness: 0.3, emit: 15, glows: true, sound: 'glass' });
defBlock(B.EMBER_BRICKS, { name: 'Ember Bricks', tex: all('ember_bricks'), hardness: 2, tool: 'pickaxe' });
GLOWS[B.EMBERITE_ORE] = 1;
const IS_SAPLING = (id) => id >= B.SAPLING && id < B.SAPLING + 7;
const IS_CROP = (id) => id >= B.WHEAT && id < B.WHEAT + 4;
const IS_FARMLAND = (id) => id === B.FARMLAND || id === B.FARMLAND_WET;
// ---- rails (Batch 16). Variant v = shape: 0 along z, 1 along x, 2..5 slopes, 6..9 curves.
// RAIL_ENDS[v] holds the DIR4 directions of the 2 rail ends. A slope rises toward its first end.
// A curve 6 + lo joins the ends lo and (lo + 1) % 4.
for (let v = 0; v < 10; v++) defBlock(B.RAIL + v, { name: 'Rail', shape: SHAPE.RAIL, tex: all(v >= 6 ? 'rail_curve' : 'rail'),
  opaque: false, solid: false, skyFree: true, hardness: 0.7, sound: 'stone', needsSupport: true, base: B.RAIL, noItem: v > 0, drop: B.RAIL });
const IS_RAIL = (id) => id >= B.RAIL && id < B.RAIL + 10;
// ---- ladders: one id per facing. The item is B.LADDER; placement picks the facing (ladderFor).
for (let f = 0; f < 4; f++) defBlock(B.LADDER + f, { name: 'Ladder', shape: SHAPE.LADDER, tex: all('ladder'), opaque: false, solid: false, skyFree: true,
  hardness: 0.4, tool: 'axe', sound: 'wood', needsSupport: true, climb: true, facing: f, base: B.LADDER, noItem: f > 0, drop: B.LADDER });
const RAIL_ENDS = [[1, 3], [0, 2], [0, 2], [1, 3], [2, 0], [3, 1], [0, 1], [1, 2], [2, 3], [3, 0]];
const railUp = (v) => (v >= 2 && v < 6 ? v - 2 : -1);   // the DIR4 direction a slope rises toward, or -1
// The rail shape with ends a and b (b = -1: one end only). up >= 0 makes a slope (straight only).
function railShapeFor(a, b, up) {
  if (b < 0 || b === ((a + 2) & 3)) return up >= 0 ? 2 + up : (a & 1 ? 0 : 1);
  return 6 + (((a + 1) & 3) === b ? a : b);
}

// Stair shape. The slab fills one half (y 0..8, or y 8..16 for a top stair). The step fills the other
// half as a mask of 8x8x8 quarters: quarter q = qx + 2 qz, where qx = 1 is x 8..16. STAIR_SIDE[k] is
// the half toward DIR4[k].
const STAIR_SIDE = [0b1010, 0b1100, 0b0101, 0b0011];
const stairV = (id) => id - BLOCKS[id].base;
// Step mask from the neighbours at the same y (the Minecraft corner rules). get(dx, dz) gives a
// neighbour id. A stair ahead that turns makes an outer corner (1 quarter). A stair behind that
// turns makes an inner corner (3 quarters). Only stairs of the same half connect.
function stairMask(id, get) {
  const v = stairV(id), f = v & 3, top = v & 4;
  const like = (n) => IS_STAIR[n] && (stairV(n) & 4) === top;
  const free = (k) => { const n = get(DIR4[k][0], DIR4[k][1]); return !(like(n) && (stairV(n) & 3) === f); };
  const [dx, dz] = DIR4[f];
  const ahead = get(dx, dz);
  if (like(ahead)) {
    const d = stairV(ahead) & 3;
    if ((d & 1) !== (f & 1) && free((d + 2) & 3)) return STAIR_SIDE[f] & STAIR_SIDE[d];
  }
  const behind = get(-dx, -dz);
  if (like(behind)) {
    const d = stairV(behind) & 3;
    if ((d & 1) !== (f & 1) && free(d)) return STAIR_SIDE[f] | STAIR_SIDE[d];
  }
  return STAIR_SIDE[f];
}
// STAIR_BOXES[top * 16 + mask]: the slab, then the step as halves and quarters, in 1/16 units.
const STAIR_BOXES = [];
{
  const HALF = [[8, 0, 16, 16], [0, 8, 16, 16], [0, 0, 8, 16], [0, 0, 16, 8]];   // x0 z0 x1 z1 of STAIR_SIDE[k]
  for (let top = 0; top < 2; top++) for (let mask = 0; mask < 16; mask++) {
    const out = [top ? [0, 8, 0, 16, 16, 16] : [0, 0, 0, 16, 8, 16]], y0 = top ? 0 : 8;
    let m = mask;
    for (let k = 0; k < 4; k++) if ((m & STAIR_SIDE[k]) === STAIR_SIDE[k]) {
      const h = HALF[k]; out.push([h[0], y0, h[1], h[2], y0 + 8, h[3]]); m &= ~STAIR_SIDE[k];
    }
    for (let q = 0; q < 4; q++) if (m & (1 << q)) { const qx = (q & 1) * 8, qz = (q >> 1) * 8; out.push([qx, y0, qz, qx + 8, y0 + 8, qz + 8]); }
    STAIR_BOXES[top * 16 + mask] = out;
  }
}
const stairKey = (id, get) => (stairV(id) & 4 ? 16 : 0) + stairMask(id, get);

// ---- liquids: never targeted, never collide, and any placed block replaces them
for (let lvl = 1; lvl <= 8; lvl++) {
  for (const kind of [1, 2]) {
    const id = liquidId(kind, lvl), water = kind === 1;
    defBlock(id, { name: water ? 'Water' : 'Lava', shape: SHAPE.WATER, tex: all(water ? 'water' : 'lava'), opaque: false, solid: false,
      hardness: -1, drop: null, replaceable: true, noItem: true, emit: water ? 0 : 15, glows: !water });
    LIQ_KIND[id] = kind; LIQ_LEVEL[id] = lvl;
    if (water) IS_WATER[id] = 1; else IS_LAVA[id] = 1;
  }
}

// ---- Items ----------------------------------------------------------------------
// Block items share their block id. A block id is one byte (0..254; 255 is UNLOADED), because a chunk
// stores one byte per cell. Other items use the free byte ids and every id from 256 up. Tool ids are
// 200 + 10 * kind + tier (tier 1..7). Armor ids are 300 + 4 * tier + piece (SPEC_realms, Phase 0).
const I = {
  STICK: 100, COAL: 101, RAW_IRON: 102, STEEL: 103, RAW_COPPER: 104, COPPER: 105, RAW_GOLD: 106, GOLD: 107,
  RUBY: 108, DIAMOND: 109,
  BEEF: 130, PORK: 131, MUTTON: 132, CHICKEN: 133, FEATHER: 134, LEATHER: 135, FLESH: 136, GUNPOWDER: 137,
  DOOR: 140,
  BUCKET: 167, WATER_BUCKET: 168, LAVA_BUCKET: 169, SEEDS: 170, WHEAT: 171, BREAD: 172, APPLE: 173, GOLDEN_APPLE: 174,
  BONE: 175, BONE_MEAL: 208, STRING: 209, FLINT: 218, ARROW: 219, BOW: 228, MAGMA_CORE: 229,
  BOAT: 238, MINECART: 239, COMPASS: 248,
  RAW_EMBERITE: 256, EMBER_DUST: 259,
};
const ITEMS = [];
for (const def of BLOCKS) {
  if (!def || def.id === B.AIR || def.noItem) continue;
  ITEMS[def.id] = { id: def.id, name: def.name, kind: 'block', block: def.id, maxStack: 64 };
}
function defItem(id, d) { ITEMS[id] = Object.assign({ id, kind: 'material', maxStack: 64 }, d); }
defItem(I.STICK, { name: 'Stick' });
defItem(I.COAL, { name: 'Coal' });
defItem(I.RAW_IRON, { name: 'Raw Iron' });
defItem(I.STEEL, { name: 'Steel Ingot' });
defItem(I.RAW_COPPER, { name: 'Raw Copper' });
defItem(I.COPPER, { name: 'Copper Ingot' });
defItem(I.RAW_GOLD, { name: 'Raw Gold' });
defItem(I.GOLD, { name: 'Gold Ingot' });
defItem(I.RUBY, { name: 'Ruby' });
defItem(I.DIAMOND, { name: 'Diamond' });
defItem(I.DOOR, { name: 'Door', kind: 'door', maxStack: 16 });
defItem(I.RAW_EMBERITE, { name: 'Raw Emberite' });
defItem(I.EMBER_DUST, { name: 'Ember Dust' });
for (const [id, , , , item, lo, hi] of ORE_DEFS) BLOCKS[id].drop = [I[item], lo, hi];
BLOCKS[B.COBWEB].drop = I.STRING;
BLOCKS[B.EMBER_LAMP].drop = [I.EMBER_DUST, 2, 4];
// Tool tiers. `level` is the harvest level that minLevel checks; a higher tier mines faster.
const TIERS = [null,
  { name: 'Wooden', level: 1, speed: 2, dur: 59, mat: 'wood' },
  { name: 'Stone', level: 2, speed: 4, dur: 131, mat: 'stone' },
  { name: 'Copper', level: 2, speed: 5, dur: 190, mat: 'copper' },
  { name: 'Steel', level: 3, speed: 6, dur: 400, mat: 'steel' },
  { name: 'Golden', level: 3, speed: 12, dur: 64, mat: 'gold' },
  { name: 'Ruby', level: 4, speed: 8, dur: 900, mat: 'ruby' },
  { name: 'Diamond', level: 5, speed: 9, dur: 1561, mat: 'diamond' }];
const TOOL_KINDS = {
  pickaxe: { label: 'Pickaxe', base: 200, dmg: [0, 2, 3, 3, 4, 2, 5, 6] },
  sword: { label: 'Sword', base: 210, dmg: [0, 4, 5, 5, 6, 4, 7, 8] },
  axe: { label: 'Axe', base: 220, dmg: [0, 3, 4, 5, 6, 4, 7, 8] },
  shovel: { label: 'Shovel', base: 230, dmg: [0, 2, 3, 3, 4, 2, 4, 5] },
  hoe: { label: 'Hoe', base: 240, dmg: [0, 1, 1, 2, 2, 1, 2, 3] },
};
const toolId = (type, tier) => TOOL_KINDS[type].base + tier;
for (const [type, k] of Object.entries(TOOL_KINDS)) {
  for (let tier = 1; tier < TIERS.length; tier++) {
    const t = TIERS[tier];
    defItem(toolId(type, tier), { name: `${t.name} ${k.label}`, kind: 'tool', maxStack: 1, maxDur: t.dur,
      tool: { type, tier, level: t.level, speed: t.speed, damage: k.dmg[tier], mat: t.mat } });
  }
}
defItem(I.BEEF, { name: 'Raw Beef', kind: 'food', heal: 4 });
defItem(I.PORK, { name: 'Raw Porkchop', kind: 'food', heal: 4 });
defItem(I.MUTTON, { name: 'Raw Mutton', kind: 'food', heal: 3 });
defItem(I.CHICKEN, { name: 'Raw Chicken', kind: 'food', heal: 2 });
defItem(I.FLESH, { name: 'Rotten Flesh', kind: 'food', heal: 2 });
defItem(I.FEATHER, { name: 'Feather' });
defItem(I.LEATHER, { name: 'Leather' });
defItem(I.GUNPOWDER, { name: 'Gunpowder' });
defItem(I.BUCKET, { name: 'Bucket', kind: 'bucket', maxStack: 16 });
defItem(I.WATER_BUCKET, { name: 'Water Bucket', kind: 'bucket', maxStack: 1, liquid: B.WATER });
defItem(I.LAVA_BUCKET, { name: 'Lava Bucket', kind: 'bucket', maxStack: 1, liquid: B.LAVA });
defItem(I.SEEDS, { name: 'Wheat Seeds', kind: 'seed', crop: B.WHEAT });
defItem(I.WHEAT, { name: 'Wheat' });
defItem(I.BREAD, { name: 'Bread', kind: 'food', heal: 5 });
defItem(I.APPLE, { name: 'Apple', kind: 'food', heal: 4 });
defItem(I.GOLDEN_APPLE, { name: 'Golden Apple', kind: 'food', heal: 10, regen: 20 });
defItem(I.BONE, { name: 'Bone' });
defItem(I.BONE_MEAL, { name: 'Bone Meal', kind: 'bonemeal' });
defItem(I.STRING, { name: 'String' });
defItem(I.FLINT, { name: 'Flint' });
defItem(I.ARROW, { name: 'Arrow' });
defItem(I.BOW, { name: 'Bow', kind: 'bow', maxStack: 1, maxDur: 384 });
defItem(I.MAGMA_CORE, { name: 'Magma Core' });
defItem(I.BOAT, { name: 'Boat', kind: 'vehicle', vehicle: 'boat', maxStack: 1 });
defItem(I.MINECART, { name: 'Minecart', kind: 'vehicle', vehicle: 'cart', maxStack: 1 });
defItem(I.COMPASS, { name: 'Compass', maxStack: 1 });
// Armor: id = 300 + 4 * tier + piece. `pts` lists the points per piece (helmet, chest, legs, boots).
const ARMOR_TIERS = [
  { name: 'Leather', mat: 'leather', item: I.LEATHER, pts: [1, 3, 2, 1], factor: 5 },
  { name: 'Copper', mat: 'copper', item: I.COPPER, pts: [2, 5, 4, 1], factor: 11 },
  { name: 'Steel', mat: 'steel', item: I.STEEL, pts: [2, 6, 5, 2], factor: 15 },
  { name: 'Golden', mat: 'gold', item: I.GOLD, pts: [2, 5, 3, 1], factor: 7 },
  { name: 'Ruby', mat: 'ruby', item: I.RUBY, pts: [3, 7, 5, 2], factor: 25 },
  { name: 'Diamond', mat: 'diamond', item: I.DIAMOND, pts: [3, 8, 6, 3], factor: 33 }];
const ARMOR_PIECES = [
  { name: 'Helmet', base: 11, shape: ['MMM', 'M M'] },
  { name: 'Chestplate', base: 16, shape: ['M M', 'MMM', 'MMM'] },
  { name: 'Leggings', base: 15, shape: ['MMM', 'M M', 'M M'] },
  { name: 'Boots', base: 13, shape: ['M M', 'M M'] }];
const armorId = (tier, piece) => 300 + 4 * tier + piece;
ARMOR_TIERS.forEach((t, tier) => ARMOR_PIECES.forEach((p, piece) =>
  defItem(armorId(tier, piece), { name: `${t.name} ${p.name}`, kind: 'armor', maxStack: 1, maxDur: p.base * t.factor,
    armor: { tier, piece, pts: t.pts[piece] } })));

// Save id plan. A save without `ids` is from before SPEC_realms Phase 0 and holds armor at 176..199.
// migrateIds moves each stack id in that range to id + 124 (the new armor ids 300..323) and sets
// `ids` to IDS_VERSION. It changes `d` in place and returns it. A save that has `ids` passes through.
// Stacks live in the inventory slots, the loose stacks, the armor slots, and the tile entity slots.
const IDS_VERSION = 2;
function migrateIds(d) {
  if (!d || typeof d !== 'object' || d.ids !== undefined) return d;
  const fix = (s) => { if (s && Number.isInteger(s.id) && s.id >= 176 && s.id <= 199) s.id += 124; };
  const each = (a) => { if (Array.isArray(a)) a.forEach(fix); };
  if (d.inv) { each(d.inv.slots); each(d.inv.loose); }
  each(d.armor);
  if (Array.isArray(d.te)) for (const t of d.te) if (t) each(t.slots);
  d.ids = IDS_VERSION;
  return d;
}

// Enchantments. A stack may carry `ench`: {key: level}, with levels 1..ENCH_MAX and at most ENCH_SLOTS keys.
// Only items with maxDur fit an enchantment, and a stack with `dur` never merges, so an enchanted stack
// never merges either. `fits(it)` says which items can take the enchantment.
const ENCH_MAX = 3, ENCH_SLOTS = 3;
const toolIs = (it, ...types) => !!it.tool && types.includes(it.tool.type);
const ENCH = {
  efficiency: { name: 'Efficiency', fits: (it) => toolIs(it, 'pickaxe', 'axe', 'shovel', 'hoe') },   // mining speed × (1 + 0.3 × level)
  fortune: { name: 'Fortune', fits: (it) => toolIs(it, 'pickaxe') },                                 // ore drops + 0..level
  sharpness: { name: 'Sharpness', fits: (it) => toolIs(it, 'sword', 'axe') },                        // damage + 1.25 × level
  unbreaking: { name: 'Unbreaking', fits: (it) => !!it.maxDur },                                     // skips a wear with p = level / (level + 1)
  protection: { name: 'Protection', fits: (it) => !!it.armor },                                      // + level armor points on the piece
  power: { name: 'Power', fits: (it) => it.kind === 'bow' },                                         // arrow damage × (1 + 0.25 × level)
  feather_falling: { name: 'Feather Falling', fits: (it) => it.armor?.piece === 3 },                 // fall damage × (1 − 0.25 × level)
};
const ROMAN = ['', 'I', 'II', 'III'];
const enchLevel = (s, key) => (s && s.ench && s.ench[key]) || 0;
const enchantable = (id) => Object.values(ENCH).some((e) => e.fits(ITEMS[id]));
// One wear event on an enchanted stack: false when Unbreaking skips it.
const wears = (s) => { const u = enchLevel(s, 'unbreaking'); return !u || Math.random() >= u / (u + 1); };
// A save or import may carry `ench` only as known keys that fit the item, levels 1..ENCH_MAX, at most ENCH_SLOTS keys.
function validEnch(s) {
  if (s.ench === undefined) return true;
  const e = s.ench, keys = e && typeof e === 'object' && !Array.isArray(e) ? Object.keys(e) : null;
  return !!keys && keys.length > 0 && keys.length <= ENCH_SLOTS
    && keys.every((k) => ENCH[k] && ENCH[k].fits(ITEMS[s.id]) && Number.isInteger(e[k]) && e[k] >= 1 && e[k] <= ENCH_MAX);
}
// Altar offers. Offer k gives level k + 1 for k + 1 crystals. A pick seeded by `enchantSeed` and the item id
// chooses among the fitting enchantments the item lacks, so the same item shows the same offers until the
// next enchant re-rolls `enchantSeed`. Returns [] when nothing fits or the item holds ENCH_SLOTS enchantments.
let enchantSeed = (Math.random() * 2 ** 31) | 0;
function altarOffers(s) {
  if (!s || !enchantable(s.id)) return [];
  const have = s.ench || {};
  if (Object.keys(have).length >= ENCH_SLOTS) return [];
  const keys = Object.keys(ENCH).filter((k) => !have[k] && ENCH[k].fits(ITEMS[s.id]));
  if (!keys.length) return [];
  const rnd = mulberry32(enchantSeed ^ Math.imul(s.id, 0x9e3779b1));
  return [1, 2, 3].map((level) => ({ key: keys[Math.floor(rnd() * keys.length)], level, cost: level }));
}
// A copy of a stack with a new count. `dur` and `ench` travel with it.
function restack(s, count = s.count) {
  const r = { id: s.id, count, dur: s.dur };
  if (s.ench) r.ench = { ...s.ench };
  return r;
}

// Furnace tables: what smelts into what, and how many seconds a fuel item burns.
const SMELT = { [I.RAW_IRON]: I.STEEL, [I.RAW_COPPER]: I.COPPER, [I.RAW_GOLD]: I.GOLD, [B.SAND]: B.GLASS, [B.COBBLE]: B.STONE,
  [B.STONE_BRICKS]: B.CRACKED_BRICKS };
const FUEL = { [I.COAL]: 40, [B.LOG]: 15, [B.PLANKS]: 15, [I.STICK]: 5, [B.CHEST]: 15, [B.TABLE]: 15, [B.COAL_BLOCK]: 400, [B.STAIRS_PLANKS]: 15,
  [I.LAVA_BUCKET]: 1000 };
const FUEL_LEFT = { [I.LAVA_BUCKET]: I.BUCKET };   // a burnt fuel that leaves an item in the fuel slot
const SMELT_TIME = 5;

// What a broken block drops. Returns [itemId, count] or null.
function blockDrop(id) {
  const d = BLOCKS[id].drop;
  if (d === null || d === undefined) return null;
  if (d === 'door') return [I.DOOR, 1];
  if (d === 'wheat') return id === B.WHEAT + 3 ? [I.WHEAT, 1] : [I.SEEDS, 1];
  if (d === 'gravel') return Math.random() < 0.1 ? [I.FLINT, 1] : [id, 1];
  if (Array.isArray(d)) return [d[0], randInt(d[1], d[2])];
  return [d, 1];
}

// Seconds needed to break `id` while holding `stack` (Minecraft-style formula).
// Name of the weakest pickaxe that reaches harvest level `lvl` ("Steel Pickaxe").
function pickaxeFor(lvl) {
  const tier = TIERS.findIndex((t) => t && t.level >= lvl);
  return ITEMS[toolId('pickaxe', tier)].name;
}

function breakTime(id, stack) {
  const b = BLOCKS[id];
  if (b.hardness < 0) return Infinity;
  if (b.hardness === 0) return 0;
  const tool = stack && ITEMS[stack.id].tool;
  const rightType = !!(tool && b.tool && tool.type === b.tool);
  let harvest = true;
  if (b.tool === 'pickaxe' && !rightType) harvest = false;
  // a block with a required level (ores, obsidian) does not break at all below that level,
  // so a rare ore is never lost to a weak pickaxe
  if (b.minLevel && (!rightType || tool.level < b.minLevel)) return Infinity;
  let speed = rightType ? tool.speed : 1;   // a low-tier tool of the right type keeps its speed (no drop)
  if (tool && tool.type === 'sword' && IS_LEAF[id]) speed = 3;
  if (tool && tool.type === 'sword' && id === B.COBWEB) speed = 15;   // a sword cuts a web in 0.4 s; a hand takes 6 s
  speed *= 1 + 0.3 * enchLevel(stack, 'efficiency');
  return b.hardness * (harvest ? 1.5 : 5) / speed;
}

function setEnchantSeed(v) { enchantSeed = v; }

export {
  altarOffers, ARMOR_PIECES, ARMOR_TIERS, armorId, ATTEN, B, baseOf, blockDrop, BLOCKS, breakTime, CLIMB,
  CRYSTAL_GROW, DIR_FACE, DIR4, EMIT, EMIT_CRY, ENCH, ENCH_MAX, ENCH_SLOTS, enchantable, enchantSeed,
  enchLevel, FUEL, FUEL_LEFT, GLOWS, I, IDS_VERSION, IS_CROP, IS_FARMLAND, IS_LAVA, IS_LEAF, IS_ORE, IS_RAIL, IS_SAPLING,
  IS_STAIR, IS_WATER, ITEMS, LEAF_COLOR, LEAF_DECAYS, LEAF_NATURAL, LIGHT_STOP, LIQ_KIND, LIQ_LEVEL, liquidId,
  migrateIds, NEEDS_SUPPORT, OPAQUE, pickaxeFor, RAIL_ENDS, railShapeFor, railUp, REPLACEABLE, restack, ROMAN,
  setEnchantSeed, SHAPE, SHAPE_OF, SKY_FREE, SMELT, SMELT_TIME, SOLID, STAIR_BOXES, STAIR_SIDE, stairKey,
  stairV, STORAGE_DEFS, TARGETABLE, TIERS, TOOL_KINDS, toolId, validEnch, wears,
};
