# Clonecraft

Clonecraft is an infinite, Minecraft-style voxel sandbox in one HTML file.
Three.js r160 loads from the jsdelivr CDN. The game generates all textures, sounds, models, and terrain at runtime.

## Run

1. Serve the folder: `python3 -m http.server 8765`.
2. Open `http://localhost:8765/index.html`.
3. Wait for the loading bar, then click **Play**.

Opening `index.html` directly from disk (`file://`) is not verified.

## URL parameters

| Parameter | Effect |
| --- | --- |
| `seed=N` | Opens the world for seed `N`, with its save if one exists. |
| `new` | Starts a new world with a random seed. |
| (none) | Reopens the last world played. |
| `rd=N` | Sets the render distance in chunks (2–16). |
| `fx=N` | Sets the effects: 0 none, 1 shadows, 2 bloom and light shafts, 3 both. |

## Controls

| Input | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Look |
| Space | Jump, swim up, climb in leaves or on a ladder |
| K | Start or stop flying |
| Shift, Ctrl, or double-tap W | Sprint (1.5× speed). In leaves or on a ladder, Shift climbs down. On a canopy top, Shift sinks in. |
| In a boat | W and S row. A and D turn. Shift gets out. |
| In a minecart | W pushes along the look direction. S brakes. Shift gets out. |
| In flight | Space rises. Shift sinks. Ctrl or double-tap W sprints (2×). Flight stays on at ground level. |
| Left click | Hold to break a block. Click to attack a mob. |
| Right click | Place a block, eat food, use a crafting table, furnace, chest, enchanting altar, or door, or light TNT. Till with a hoe, plant seeds, use bone meal, and fill or empty a bucket. Equip a held armor piece. Place a rail, a boat on water, or a minecart on a rail. Enter a boat or a minecart. Hold to draw a bow (up to 1 s); release to shoot. A stair faces the look direction. A torch on the side of a block hangs on the wall. |
| Shift + right click | Place a block against a usable block |
| Shift + click in a screen | Move a stack to the other side: hotbar and backpack, inventory and chest, inventory and furnace, or inventory and altar. In the inventory, equip an armor piece. |
| 1–9, mouse wheel | Select a hotbar slot |
| I | Open or close the inventory and the 2×2 crafting grid |
| Q | Drop the held item |
| H | Homes: set, teleport to, and delete named places (up to 10). Delete asks for a second click to confirm. |
| F3 | Toggle debug details |
| Esc | Pause. On the pause screen or in a menu, Esc returns to the game. If the browser keeps the mouse free, click once. |

## Features

- Infinite terrain streamed in 16×16×176 chunks by Web Workers. Sea level is y 128, so bedrock lies about 130 blocks below the surface.
- Ten biomes: ocean, beach, plains, forest, rainforest, desert, rocky highlands, snowy mountains, snowy plains, and river.
- Wide tunnel caves and giant caverns. Every cave below y 11 holds lava.
- Turquoise crystal clusters grow in cave patches on floors, ceilings, and walls, and light the cave. A pickaxe mines them, and they can be placed on any face.
- Ores with depth bands: coal, copper, iron, gold, ruby, and diamond. Rarer ores sit deeper.
- Flowing water and lava. Liquids fall first, then spread up to 7 cells past the source. A flow drains when its source goes. Lava and water make obsidian or cobblestone.
- Trees, cacti, and flowers. Oaks have green, red, orange, yellow, or brown leaves. Forests are a mosaic of color patches. Pink oaks grow in dense groves in plains. Snowy biomes have white-leaved spruces.
- The player passes through leaves and climbs in them: Space climbs, Shift climbs down, and no key holds on. A fall into a canopy is caught. Mobs, arrows, and items still collide with leaves.
- Ladders: 7 sticks craft 3. A ladder hangs on a wall and is climbed like leaves; walking into the wall also climbs.
- Leaf decay: when a tree loses its logs, its leaves fall within a few seconds and sometimes drop a stick. Placed leaves never decay.
- Farming: saplings from every leaf color regrow trees. A hoe tills farmland, and seeds from tall grass grow wheat for bread. Farmland near water is wet and grows crops twice as fast. Bone meal speeds up a sapling or a crop.
- Buckets carry water and lava. Apples fall from leaves. A golden apple heals and regenerates.
- Sky light, torch light, and turquoise crystal light with smooth lighting and ambient occlusion. Torches emit light 15 and stand on the ground or hang on walls. Crystals emit light 12.
- Tool tiers: wood, stone, copper, steel, gold, ruby, and diamond. Coal ore needs a wooden pickaxe, copper and iron ore need stone, gold and ruby ore need steel, diamond ore needs ruby, and obsidian needs diamond. A weaker pickaxe does not break the ore, and a message names the pickaxe it needs.
- Furnace (8 cobblestone): smelts raw iron into steel, raw copper and gold into ingots, sand into glass, and cobblestone into stone. It burns coal, blocks of coal, logs, planks, plank stairs, and sticks.
- Storage blocks for building: 9 coal, copper ingots, steel ingots, gold ingots, rubies, or diamonds make one block on a crafting table. One block crafts back into 9 items. Mining a storage block needs the same pickaxe as its ore.
- TNT (5 gunpowder and 4 sand): a right click or a torch placed beside it lights a 4 s fuse. The explosion lights nearby TNT. Breaking lit TNT defuses it.
- Cobblestone and plank stairs (6 blocks make 4). A stair faces the look direction, and a click high on a side or on a bottom face places it upside down. Stairs join into corners. Walk up them without a jump.
- Chest (8 planks) with 27 slots. Door (6 planks make 3): opens by right click and closes by itself after 5 s.
- A 36-slot inventory, 2×2 and 3×3 shaped crafting, and a recipe book.
- A trash slot beside the hotbar on every inventory screen. Click it with a stack to delete the stack. A bar on the slot drains for 3 s. Click the slot empty-handed within 3 s to take the stack back. After 3 s, or when the screen closes, the stack is gone for good.
- Passive mobs (cow, pig, sheep, chicken) and hostile mobs (zombie, creeper, skeleton, spider, Magma Brute).
- Zombies and skeletons burn in daylight. Creepers explode and break blocks. Skeletons keep their distance and shoot arrows. Spiders climb walls and leap; in bright light they stay neutral until hit. Magma Brutes live in caves below y 40, glow, walk through lava, and hit hard.
- Armor in 6 tiers (leather, copper, steel, gold, ruby, diamond) in 4 slots. Each armor point cuts combat damage by 4%, up to 80%. Falls, lava, and cactus ignore armor.
- Enchanting Altar (4 obsidian, 2 diamonds, 2 crystals, 1 Magma Core): spend 1–3 crystals to add Efficiency, Fortune, Sharpness, Unbreaking, Protection, Power, or Feather Falling (levels I–III) to a tool, armor piece, or bow. An item holds up to 3 enchantments. Enchanted icons shimmer purple.
- A bow (3 sticks, 3 string) and arrows (flint, stick, feather make 4). A full draw takes 1 s and deals up to 9 damage. Gravel drops flint.
- Travel: boats (5 planks) row at 6 blocks/s on water and crawl on land. Rails (6 steel and 1 stick make 16) join straight, curve at corners, and slope up one block. Minecarts (5 steel) ride the rails at up to 8 blocks/s and speed up downhill. Two hits break a boat or a cart.
- A compass (4 steel, 1 crystal) shows a dial that points to the spawn, with the distance in blocks.
- Structures: dungeons with a mob spawner, desert temples with a TNT trap under the chest room (a rattle warns when you come near the trap), ruined brick towers with a chest on top, and mineshafts with rails, cobwebs, and chests. Each structure has its own loot. A chest fills once, and the loot is the same for the same seed.
- A spawner spawns its mob near a player within 16 blocks in the dark. A torch beside it stops it. A cobweb slows movement, and a sword cuts it for string.
- Building blocks: stone bricks (4 stone make 4), sandstone (4 sand make 1), and chiseled sandstone (2 sandstone). Mossy cobblestone and mossy bricks come from structures. The furnace cracks stone bricks.
- Dropped items fly to the player from about 3 blocks. Items the player throws must be walked to.
- Health, fall damage, swimming, death, and respawn. Water and lava cancel fall damage. Lava burns and slows. Drowning does not exist.
- A 15-minute day/night cycle with sun, moon, stars, and clouds. The pause menu sets the time of day and can freeze it.
- Sun and moon light with dynamic shadows. Terrain, trees, mobs, and vehicles cast shadows, and leaves let light dapple through. Shadows move with the time of day and fade in rain.
- Water with moving waves, sky reflection, and a glittering sun (or moon) path. Sunlight makes moving caustics on blocks under shallow water.
- A torch held in the selected hotbar slot lights the area around the player. The light does not pass through walls.
- Weather: rain, snow, and thunderstorms. Deserts stay dry, and snow falls in snowy biomes and on high peaks. Rain darkens the sky and plays a rain sound. Lightning strikes during storms and hurts anything within 3 blocks. Zombies and skeletons do not burn in the rain.
- Autosave per seed in `localStorage`: every 30 s, on pause, and when the page hides. New World in the menu keeps the old world.
- Export World downloads the current world as a JSON file. Import World opens a world from such a file. If that seed already has a save, the game asks before it replaces the save.
- Procedural WebAudio sound effects and point particles.
- Bloom on the sun, moon, torch flames, and water glint. Light shafts from the sun or moon through gaps in leaves, terrain, and clouds.
- Settings for render distance, field of view, mouse sensitivity, volume, shadows, bloom and light shafts, the time of day, and freeze time. The browser keeps them in `localStorage`.

## Test handle

`window.clonecraft` exposes the game objects for automated tests and the browser console.
See `DISCOVERY_engine.md` for how to drive the game in headless browsers.
