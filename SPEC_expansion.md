# SPEC: expansion (O1–O6)

Status: approved by Joe on 2026-09-28 ("Spec and gate o1-o6 in whatever order you want. Then start").
Gate: `GATE_game.md` (was `GATE.md`), sections "Batch 13" to "Batch 18".
Multi-room dungeons: requested by Joe on 2026-10-02. Joe found dungeon floors that float in caves with no walls. Joe chose option O3 (a room with open cells under its floor is not built) and asked for "multiple rooms at different levels somewhat random". Joe's choices: stairs and ladders mixed at random, a spawner in one room only, 2 to 4 rooms inside one chunk. Gate: `GATE_game.md`, section "Multi-room dungeons".

## Part 1: General

### Scope

Six feature groups give the player goals past rubies, diamonds, and TNT.

- O1: armor, a bow with arrows, and three hostile mobs (skeleton, spider, Magma Brute).
- O2: generated structures with loot chests (dungeon, desert temple, ruined tower, mineshaft) and a mob spawner.
- O3: crystal enchanting at an altar.
- O4: farming and renewables: saplings, seeds, wheat, bread, a hoe, farmland, apples, bone meal, and buckets.
- O5: weather: rain, snow, and thunderstorms with lightning.
- O6: travel: boats, minecarts on rails, and a compass.

### Constraints

- All code stays in `index.html`, in its numbered sections. No build step and no external assets. (Superseded 2026-10-01 by SPEC_modules.md: the source is the modules in `src/`. `npm run build` writes the one shipped `index.html`.)
- Block and item ids stay one byte. `UNLOADED` (255) stays reserved. The id plan in Part 2 is fixed.
- The world generator stays pure: the same seed gives the same chunks, structures, and loot.
- Saves from before this spec load without loss. New save fields are optional in `validSave`.
- The atlas stays one 256×256 texture of 16 px tiles.
- Chromium shows 0 console errors.
- UI follows the `ui-guidelines` skill: 44 px targets, 12 px gaps, and Undo or confirm on every delete.

### Non-goals

- O7: the portal, the crystal realm, and the boss (Joe: "Save o7 for later").
- Hunger. Food keeps healing HP directly.
- Fire and fire spread. Lightning does not light blocks.
- Powered rails, detector rails, and redstone.
- Maps.
- Armor on mobs.
- Enchanted books, anvils, and XP.
- Villages and villagers.

## Part 2: Product

### What to build

#### O4: farming and renewables

- Saplings: each of the 7 leaf colors drops its sapling 1 time in 16 when the leaf decays or breaks. A sapling stands on grass or dirt. After 60–180 s it grows the tree that matches its color (oak, or spruce for white). A tree needs room, or the sapling waits.
- Apples: an oak leaf drops an apple 1 time in 60. An apple heals 4 HP.
- Seeds: tall grass drops seeds 1 time in 8.
- Hoe: 7 tiers, crafted like vanilla (2 heads, 2 sticks). A right click on grass or dirt with open air above makes farmland. The hoe loses 1 durability.
- Farmland: a lower block (15/16 tall). It is wet when water lies within 4 blocks horizontally, on the same level or one above. Wet farmland shows a darker texture. Farmland with no crop and no water turns to dirt after about 60 s. A jump or fall onto farmland turns it to dirt.
- Wheat: seeds planted on farmland grow through 4 stages (0..3). Each stage takes 40–80 s on wet farmland and twice that on dry farmland. A ripe crop drops 1 wheat and 1–3 seeds. A crop that is not ripe drops 1 seed. A crop breaks when its farmland goes.
- Bread: 3 wheat in a row craft 1 bread. Bread heals 5 HP.
- Bone meal: 1 bone crafts 3 bone meal. A right click on a sapling or a crop with bone meal advances it one stage (a sapling has 2 stages). The click shows green particles.
- Buckets: 3 steel in a V craft 1 bucket. A right click on a water or lava source picks it up. A full bucket places a source on the clicked face and returns an empty bucket. A lava bucket burns in a furnace for 1000 s and leaves a bucket.
- Golden apple: only in loot. It heals 10 HP and gives 20 s of regeneration at 1 HP per s.

#### O1: armor, mobs, and the bow

- Armor: 6 tiers × 4 pieces. The tiers are leather, copper, steel, gold, ruby, and diamond. The pieces are a helmet, a chestplate, leggings, and boots, with vanilla recipe shapes.
- Armor points per piece (helmet/chest/legs/boots): leather 1/3/2/1, copper 2/5/4/1, steel 2/6/5/2, gold 2/5/3/1, ruby 3/7/5/2, diamond 3/8/6/3.
- Each point reduces damage by 4%, and the reduction caps at 80%. Armor applies to mob hits, arrows, explosions, and lightning. It does not apply to falls or lava.
- Durability = the piece base [11, 16, 15, 13] × the tier factor [5, 11, 15, 7, 25, 33]. Each armored hit costs each worn piece 1 durability. A piece breaks at 0 with a sound.
- The inventory screen shows 4 armor slots in a column left of the player area. A slot takes only its piece. A right click with a held armor piece equips it and swaps out the worn piece. A shift-click on an armor piece in the inventory equips it.
- The HUD shows an armor bar of 10 icons above the hearts when armor points > 0. Each icon is 2 points.
- The player model in first person does not show armor.
- Bow: 3 sticks and 3 string. Holding right click charges it for up to 1 s. Release fires an arrow if the inventory has one. The damage is 2 + 7 × charge. The bow loses 1 durability per shot. The view model pulls back while it charges.
- Arrows: flint, a stick, and a feather craft 4 arrows. An arrow flies with gravity, hits the first mob or solid block, and sticks in a block for 30 s. The player picks up a stuck arrow that the player shot. A mob arrow cannot be picked up.
- Gravel drops flint 1 time in 10, and gravel otherwise.
- Skeleton: 20 HP. It keeps 6–12 blocks from the player and shoots an arrow every 2 s with a line of sight. An arrow deals 3. It burns in daylight like a zombie. It drops 0–2 bones, 0–2 arrows, and a bow 1 time in 20.
- Spider: 16 HP, 1.4 wide, 0.9 tall, speed 3.2. It climbs walls it walks into. It leaps at the player from 2–4 blocks. A bite deals 2. At light ≥ 12 it is neutral until the player hits it. It drops 0–2 string.
- Magma Brute: 40 HP, speed 1.6, a hit of 7, and knockback resistance. It spawns only in caves below y 40 and ignores the light rule. Lava does not hurt it. It glows orange. It drops 1 Magma Core and 0–2 coal.
- Surface spawn weights: zombie 35%, skeleton 30%, creeper 20%, spider 15%. In caves below y 40, 1 spawn in 8 is a Magma Brute.

#### O3: enchanting

- Altar: 4 obsidian, 2 diamonds, 2 crystals, and 1 Magma Core. It emits light 10.
- A right click on the altar opens the altar screen. The screen has a tool slot, a crystal slot, and 3 offers.
- An offer names an enchantment, a level, and a cost in crystals (1, 2, or 3). The offers depend on the item and on `enchantSeed`. `enchantSeed` changes after each enchant, so the offers change.
- A click on an offer that the player can pay for spends the crystals and adds the enchantment to the tool. An item holds up to 3 enchantments. The offers skip enchantments the item already has.
- Enchantments (each has levels I–III):
  - Efficiency (pickaxe, axe, shovel, hoe): mining speed × (1 + 0.3 × level).
  - Fortune (pickaxe): ore drops get a bonus of 0..level extra items.
  - Sharpness (sword, axe): damage + 1.25 × level.
  - Unbreaking (all tools, armor, bow): each durability loss is skipped with chance level / (level + 1).
  - Protection (armor): + 1 armor point per level on that piece.
  - Power (bow): arrow damage × (1 + 0.25 × level).
  - Feather Falling (boots): fall damage × (1 − 0.25 × level).
- An enchanted item shows a purple shimmer on its icon and its tooltip lists the enchantments.
- The `ench` field travels with a stack everywhere a stack moves: the inventory, drops, chests, the trash slot, the save, and the export.

#### O6: travel

- Boat: 5 planks in a U. A right click on water places a boat entity. A right click on a boat enters it. W and S move forward and back. A and D turn. The mouse looks around. Shift exits onto the nearest free block. Top speed is 6 blocks per s on water and 1 on land. Two hits break the boat, and it drops as an item.
- Rails: 6 steel and 1 stick craft 16 rails. A rail needs a solid block below (NEEDS_SUPPORT). A placed rail connects to its rail neighbours: straight along x or z, a curve, or an ascending slope toward a rail one block higher. Neighbour rails re-shape when a rail joins them.
- Minecart: 5 steel in a U. A right click on a rail places a cart. A right click on a cart enters it. W pushes the cart along the look direction on the rail. S brakes. Slopes add gravity. The top speed is 8 blocks per s. Friction slows a coasting cart. A cart stops at a rail end. Shift exits. Two hits break the cart, and it drops as an item.
- Compass: 4 steel in a plus around 1 crystal. While held, a dial on the HUD points to the spawn and shows the distance in blocks.
- Boats and carts save with the world (position, yaw, kind). A rider exits on save.

#### O2: structures and loot

- Dungeon: a 7×7×5 room of cobblestone and mossy cobblestone below y 110, inside one chunk. A spawner sits in the centre. 1–2 chests stand against walls. About 1 chunk in 12 holds a dungeon, and only where the room meets a cave or stays underground. (Superseded 2026-10-02 by the multi-room dungeon below.)
- Multi-room dungeon (2026-10-02): 2 to 4 rooms of cobblestone and mossy cobblestone, inside one chunk, at y 14 to 93.
  - Each room is 5 to 9 blocks wide on each side and 5 blocks tall (3 blocks of headroom). Sizes and places are random per dungeon.
  - The rooms stand at different levels. Each room lies 5 to 9 blocks lower than the room before it.
  - A link joins each room to the next lower room. A link is either a 1-wide cobblestone staircase or a ladder shaft, picked at random.
  - A staircase leaves the upper room through a door, goes down 1 block per step, and comes into the lower room through its roof.
  - A ladder shaft goes down from a hole in the upper room's floor, through the lower room's roof, to its floor. The ladder hangs on the wall.
  - A player walks from the top room to every room and back up without digging.
  - One room, picked at random, holds the spawner in its centre and 1–2 chests. Every other room holds 1 chest.
  - A room is not built when any cell under its floor is open (air, water, or lava). The dungeon then ends at the room above it. A dungeon with fewer than 2 rooms is not built. So no dungeon floor hangs in a cave.
  - Walls and roofs that meet a cave stay open to the cave, as before.
  - Every room keeps the depth rule: the terrain stands at least 4 blocks above its roof.
  - About 1 chunk in 12 tries a dungeon, as before.
  - Technical notes:
    - `dungeonPlan(cx, cz, a)` is pure (seed, chunk, plan number). `stampDungeon` tests `DG_PLANS` (3) plans against the terrain and stamps the plan that keeps the most rooms.
    - A link is a staircase with p 0.7 when one fits, else a ladder shaft.
    - A staircase starts with a door stair in the upper room's wall at its floor layer. Each step rises half a block twice, so the walk up needs no jump.
    - The room cell beside a staircase landing stays free of furniture.
    - A chest goes only where it keeps the room's free floor connected. The candidates are the wall middles first, then the other wall cells.
- Desert temple: a 15×15 sandstone pyramid with chiseled sandstone trim, on desert ground. A shaft in the centre leads to a room with 4 chests. The centre floor cell is chiseled sandstone with 9 TNT under it. A step onto chiseled sandstone that has TNT directly below lights that TNT (4 s fuse). About 1 desert chunk in 40.
- Ruined tower: a broken 5×5 round tower of stone bricks, mossy bricks, and cracked bricks, 8–14 blocks tall, in plains, forest, or highlands. A chest stands at the top floor. About 1 chunk in 50.
- Mineshaft: corridors 3 wide and 3 tall at y 60–100. Log and plank supports stand every 4 blocks. Rails lie on 60% of the floor. Cobwebs hang in corners. A chest stands in 1 corridor segment in 6. Corridors run along lines from anchors on a 96-block grid, so each chunk computes its own part of the same lines.
- Spawner: a cage block with a spinning mob inside. It spawns 1–3 mobs of its type every 5–15 s while the player is within 16 blocks and its light is ≤ 9. A torch next to it stops it. Mining it drops nothing.
- Cobweb: slows movement to 25%. A sword breaks it fast and drops string. A hand breaks it slowly and drops nothing.
- Loot: a generated chest fills the first time the game touches it (open, break, or explode). The loot depends on the seed, the position, and the structure type, so it is the same on every visit. Loot tables per type list items, counts, and weights. Structure-only item: the golden apple. Loot also holds rare diamond armor, enchanted tools, and Magma Cores.

#### O5: weather

- States: clear (300–900 s), rain (120–360 s). Each rain spell becomes a thunderstorm 1 time in 3.
- The weather is global. The precipitation depends on the column: deserts get none, and snowy biomes and columns above `SNOW_LINE` get snow.
- Particles fall in a 24-block radius around the camera. A particle does not fall below the top solid block of its column, so caves and roofs stay dry.
- Rain darkens daylight to 0.75×. A storm darkens it to 0.55×. Clouds turn grey. Fog shortens by 30%.
- Audio: a filtered-noise rain loop while it rains and the player is under open sky. Thunder follows lightning after a delay by distance.
- Lightning: during a storm, a bolt strikes every 5–20 s at a random point within 64 blocks. A bolt draws a jagged line and a screen flash. It deals 5 damage within 3 blocks. It lights nothing.
- Zombies and skeletons do not burn in rain.
- The weather state (kind and time left) saves with the world.
- The test handle exposes `weather.set(kind, seconds)`.

### Where it lives

All code is in `index.html`. (Superseded 2026-10-01 by SPEC_modules.md: the source is the modules in `src/`. `npm run build` writes the one shipped `index.html`.)

| Feature | Section |
| --- | --- |
| Ids, `defBlock`, `defItem`, armor and hoe tables | 2 |
| Tiles for new blocks and items | 3 (atlas), `ITEM_PIX` |
| Structures, `growTree` | 4 (`WorldGenModule`) |
| Farmland, crops, saplings, rails, cobwebs, spawners | `world` random ticks and `interact` |
| Armor, damage kinds, bow charge | player section |
| Projectiles | new section beside mobs |
| New mobs | `MOB_TYPES`, `MOB_TEXTURES` |
| Boats and carts | new vehicles section beside mobs |
| Altar screen, armor slots | inventory UI |
| Armor bar, compass dial | HUD |
| Weather | sky section and a new weather module |
| Save fields | `persist`, `validSave` |

### Interfaces

#### Id plan

- Blocks: 127 FARMLAND, 128 FARMLAND_WET, 129 COBWEB, 138 MOSSY_COBBLE, 139 STONE_BRICKS, 141 MOSSY_BRICKS, 142 CRACKED_BRICKS, 143 SANDSTONE, 144 CHISELED_SANDSTONE, 145 ALTAR, 249 SPAWNER.
- Saplings 146..152: `146 + c`, where c follows `LEAF_COLOR` (0 green, 1 red, 2 orange, 3 brown, 4 pink, 5 white, 6 yellow).
- Wheat crop 153..156: `153 + stage`.
- Rails 157..166: `157 + shape`. Shape 0 runs along z, 1 along x, 2..5 ascend toward `DIR4[k]`, 6..9 are curves.
- Items: 167 BUCKET, 168 WATER_BUCKET, 169 LAVA_BUCKET, 170 SEEDS, 171 WHEAT, 172 BREAD, 173 APPLE, 174 GOLDEN_APPLE, 175 BONE, 208 BONE_MEAL, 209 STRING, 218 FLINT, 219 ARROW, 228 BOW, 229 MAGMA_CORE, 238 BOAT, 239 MINECART, 248 COMPASS.
- Armor 176..199: `176 + 4 × tier + piece`.
- Hoes: tool kind 4, ids 241..247.
- Free after this spec: 200, 210, 220, 230, 240, 250..254.

#### Stack and save

- A stack is `{id, count, dur, ench}`. `ench` is optional: an object `{name: level}`. Stacks with `ench` never merge.
- `persist.data()` adds `armor` (4 stacks or null), `weather` (`{kind, left}`), `enchantSeed`, and `vehicles` (a list of `{kind, x, y, z, yaw}`).
- `validSave` checks each new field when present and accepts saves without it.
- The chunk data adds `features`: a list of `{kind: 'chest'|'spawner', x, y, z, type}`.

#### Damage

`damagePlayer(amount, cause, from, kind)`. `kind` is one of `mob`, `arrow`, `explosion`, `lightning`, `fall`, `lava`, `void`. Armor applies to the first four.

### Patterns to follow

- Blocks: `defBlock` with `base` for variants, like stairs and leaf colors.
- Items: `defItem` and `ITEM_PIX` painters, like the storage items and tools.
- Tile entities: `tileEntity` and `spillTileEntity`, like the chest and furnace.
- Screens: `setState` and `ui.mode`, like the furnace screen.
- Timed block changes: the scheduled ticks used by leaf decay and TNT.
- Mobs: `MOB_TYPES` entries with `build(root, M)`, like the creeper.
- Save: optional fields, like `homes` in Batch 7.

## Part 3: Execution

### Build order

Each step is one batch with its own GATE section. Each batch ends with Playwright QA and doc updates.

1. Batch 13: O4 farming and renewables.
2. Batch 14: O1 armor, bow, arrows, and mobs.
3. Batch 15: O3 enchanting.
4. Batch 16: O6 travel (mineshafts need rails).
5. Batch 17: O2 structures and loot (the loot uses items from 13–16).
6. Batch 18: O5 weather.

### Acceptance tests

The GATE sections list each test. Each test is observed in Chromium through Playwright with the `window.clonecraft` handle, real clicks where a UI exists, and screenshots for visuals.

### Gates

- Every GATE item in Batches 13–18 is checked, or a note says why it cannot be observed.
- An old save (Batch 12 format) loads with its world, inventory, and homes.
- Chromium: 0 console errors across the QA of each batch.
- Owner review (Joe): the feel of combat with the new mobs, the look of the structures, and the weather mood. These items stay open until Joe plays them.
