# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Item ids (SPEC_realms.md, Phase 0): armor ids move from 176..199 to 300..323, so the realm blocks can use the one-byte ids. New item-only ids start at 256.
  - A save now holds `ids: 2`. An older save or export loads and imports with every armor piece intact: worn, in the inventory, in a chest, or held on the cursor.
  - An import rejects a save with an unknown `ids` value.

### Added

- Ember content (SPEC_realms.md, Phase 4): the Ember Realm now has fortresses, Emberite gear, and two new mobs.
  - Raw Emberite smelts into an Emberite Ingot. The Emberite tier adds a pickaxe, sword, axe, shovel, hoe, and 4 armor pieces. Each worn armor piece cuts lava damage by 20 %.
  - Ember Dust burns 60 s in a furnace. 4 Ember Dust craft 1 Ember Lamp.
  - One fortress stands in each 96-block cell: a brick keep on pillars with 2..4 bridges over the lava. A bridge is 32..64 long and can end in a room with a chest.
  - The keep holds a Cinder Knight spawner and the heart chest. The heart chest always holds 1 Ember Heart.
  - Ember Wisp: a flying mob that keeps 8..16 blocks away and shoots a fireball every 3 s. A fireball deals 5 and breaks no block. It drops 0..2 Ember Dust.
  - Cinder Knight: an armored melee mob, 30 HP, half knockback, and half damage from arrows. It spawns only inside a fortress. It drops 0..2 coal and Raw Emberite 1 time in 3.
  - Ember Realm spawns ignore the time of day and need block light 11 or less. Magma Brutes spawn there too.
- Ember portal (SPEC_realms.md, Phase 3): an obsidian frame lit with a Magma Core opens a portal between the overworld and the Ember Realm.
  - A frame opening is 2..4 wide and 3..5 tall, along x or z. The corners are optional. A Magma Core on an incomplete frame shows "The frame is not complete" and keeps the core.
  - The pane shows a moving orange swirl and sparks, gives light 11, and hums nearby. The player walks through it, and the crosshair passes through it.
  - Breaking a frame block, or placing a block into the opening, removes the whole pane.
  - Standing in the pane for 2.5 s travels. An orange vignette grows during the wait. Stepping out resets the timer. After arrival, the player must step out and back in to travel again.
  - Linking uses 1:8: overworld (x, z) leads to ember (x/8, z/8). An existing portal within 16 blocks (ember) or 128 blocks (overworld) of the target is reused. Otherwise the game builds a 2×3 portal at the target, on an obsidian platform over open lava.
  - A rider in a boat or a cart does not travel and sees "Leave the boat to travel" or "Leave the cart to travel".
- Ember Realm terrain (SPEC_realms.md, Phase 2): the Ember Realm is now a large cave world under a bedrock roof, with a lava sea at y 31 and below.
  - New blocks: Ember Rock, Ash Sand, Ember Lamp, Emberite Ore, and Ember Bricks. New items: Raw Emberite and Ember Dust.
  - Ember Lamps hang from the roof and give light 15. Emberite Ore needs a diamond pickaxe. A vein of 1 to 3 ore forms about once per 2 chunks.
  - Ash Sand slows walking to 40 %.
  - Unlit caves show a red-orange light floor (level 9). Red fog ends at 72 blocks. Ash flakes and glowing embers drift around the camera.
  - A water bucket in the Ember Realm boils away with steam and a fizz. The bucket empties and places no water.
- Realm core (SPEC_realms.md, Phase 1): the game now has three realms: the overworld, the Ember Realm, and the Crystal Realm. Only the current realm loads.
  - Each realm keeps its own block edits, chests and furnaces, homes, liquids, leaf decay, farming, vehicles, and looted chests. Dropped items wait frozen in their realm for the session.
  - A realm change shows a travel screen ("Entering the Ember Realm…") and removes all mobs. Passive overworld mobs come back on return.
  - Death in any realm respawns the player at the overworld spawn.
  - The Ember Realm has a dark red sky and fog. The Crystal Realm has a violet sky with stars and a void below y 0. Below y −32 the void deals 4 damage every 0.5 s, and armor does not reduce it.
  - Weather, clouds, and fireflies show only in the overworld. The compass spins outside the overworld.
  - The save holds `realm`, `realms`, `portals`, and `boss`. An older save loads in the overworld unchanged.
  - The Crystal Realm uses flat stub terrain until Phase 5. `clonecraft.realm.travel('ember')` is the debug travel handle until the portals exist.
- Grass spread (SPEC_expansion.md, "Grass spread"): grass grows back over exposed dirt, and covered grass turns to dirt.
  - Lit dirt next to grass (1 block to the side, from 1 below to 3 above) turns to grass after about 40 s on average. Sky light counts at night.
  - Grass under an opaque block, water, or lava turns to dirt. Darkness alone does not kill grass.
  - A dug patch greens from its edge inward. Dry farmland that turned to dirt grows grass again.
  - Only chunks within 8 chunks of the player tick. Pause and the settings menu stop the ticks. The changes save as normal edits.
- Sunset cloud colors (SPEC_graphics.md, G5): at sunrise and sunset, clouds take color by their place in the sky.
  - Clouds low and toward the sun are gold and orange. Clouds to the side are pink. Clouds away from the sun are purple to blue-grey.
  - A low sun lights the cloud bases from below.
  - An afterglow moves the colors from orange and pink to purple and blue after sunset. Sunrise runs the same steps in reverse.
  - Rain mutes the colors. A storm removes them.
- Realistic clouds (SPEC_graphics.md, G5): one soft layer at y 192 replaces the blocky clouds.
  - Clouds have varied shapes, wispy edges, and gaps of open sky. They drift east and change shape slowly.
  - The sun lights them: grey bases, bright thin edges, and dark grey at night.
  - Rain thickens the layer toward overcast, and a storm closes it. Clear weather brings the gaps back.
  - Clouds cast soft moving shadows on the terrain and the water. The shadows remove direct light only and follow the Shadows box. Caustics fade under them.
  - Clouds hide the stars and dim the light shafts. Thick cloud hides the sun and moon and removes the sun glitter on the water.
  - White clouds do not bloom. The layer shows from above and in the menu panorama.
- Render scale: a pause-menu slider from 50 % to 100 % sets the share of the window's pixels the game draws. The browser stretches the smaller image to fill the window. At 3240×2025 over shallow water with shadows and bloom, 75 % gives 60 fps against 49 fps at 100 %. The setting saves with the others.
- Fireflies: they come out at dusk over grass blocks in the plains, forest, and rainforest biomes, also under the trees. Each one hovers 0.3 to 3.5 blocks above the grass, drifts around its home point, and blinks on its own rhythm with a bloom halo. They fade in from about 17:46 to 18:23, stay through the night, and fade out from about 05:37 to 06:14. Rain and storms send them away. The save holds no firefly state.
- Temple trap warning: a dry rattle over a low falling tone plays once when the player comes within 3 blocks of a set trap plate, or up to 14 blocks above it. The top of a temple shaft is in range, so the warning plays before the drop. It plays again after the player leaves and returns. A mined plate or a fired trap gives no warning.
- Ladders: 7 sticks in an H craft 3. A ladder hangs on the clicked wall face and drops when its wall breaks. It is a 3D model: two rails and four rungs.
- Climbable leaves: the player passes through leaves at 60 % speed. Inside leaves or on a ladder, Space climbs, Shift climbs down, and no key holds on. The top leaf of a canopy holds a walking player; Shift or a fall faster than 10 m/s drops into it, and the climb catches the fall without damage. Mobs, arrows, and items still collide with leaves.
- Pause menu: a "Time of day" slider (00:00–24:00 in 15-minute steps) and a "Freeze time" checkbox. The world save keeps the time. Freeze time is a setting for all worlds.
- Graphics (SPEC_graphics.md, G1–G4):
  - The water surface no longer uses the generated texture. It has moving waves, sky reflection at grazing angles, and a sun or moon glitter path that blooms.
  - Caustics move on blocks under sunlit water. They brighten the floor's own light, fade out between 3 and 7 blocks deep, and show only by day. Rain weakens them. The lines bend and re-form in place instead of sliding as one pattern.
  - Sun and moon light with dynamic shadows from terrain, trees, mobs, drops, and vehicles. Leaves cast dappled shadows. Rain softens the light and the shadows.
  - A torch in the selected hotbar slot lights the area around the player (level 14, stopped by walls). It lights terrain, water, mobs, drops, and the held item, and glints on the waves.
  - Faster water and softer shadows (P1–P3): caustics and ripples read from patterns baked at startup, water takes 1 shadow read, and terrain shadows take 4 hardware-filtered reads with a wider edge. At 3240×2025 on an M1 Air, the shore view went from 54 to 60 fps.

- Weather (Batch 18):
  - The weather cycles between clear (5–15 min) and rain (2–6 min). About 1 rain in 3 is a thunderstorm. The change fades over 6 s.
  - The weather is global, and the precipitation depends on the column. Deserts stay dry. Snowy biomes and columns above the snow line get snow. All other biomes get rain.
  - Rain falls as streaks and snow as soft flakes, in a 24-block disc around the camera. No drop falls below the top block of its column, so roofs and caves stay dry.
  - Rain darkens the daylight by 25 % and a storm by 45 %. The clouds turn grey, the sun and stars fade, the fog closes in, and light shafts stop.
  - A rain loop plays under open sky. It fades under a roof and stops on pause.
  - A storm strikes a random point within 64 blocks every 5–20 s. A strike draws a jagged bolt and a screen flash. Thunder follows at 34 blocks/s. A bolt deals 5 damage (before armor) to the player and to mobs within 3 blocks.
  - Zombies and skeletons do not burn where rain or snow falls.
  - The save and the export keep the weather kind and its time left. F3 shows the weather.
  - The test handle exposes `weather`: `set(kind, seconds)`, `strike(x, z)`, `wetAt(x, z)`, and the state getters.

- Structures and loot (Batch 17):
  - Dungeon: a 7×7×5 room of cobblestone and mossy cobblestone at y 14..93, in about 1 chunk in 12. A spawner stands in the centre, and 1–2 chests stand at the walls. A room that meets a cave stays open to the cave.
  - Desert temple: a 15×15 stepped sandstone pyramid with chiseled trim, in about 1 desert chunk in 40. A shaft in the hall centre drops 12 blocks into a room with 4 chests. The centre floor cell is chiseled sandstone over 9 TNT. A step onto it lights the TNT (4 s fuse). Each of the 4 doors has a 1-block step to the ground outside.
  - Ruined tower: a round tower of stone, mossy, and cracked bricks, 8..14 tall, in plains, forest, and highlands (about 1 chunk in 50). Brick steps spiral up the inside to a chest on the top floor. The door is 3 tall, and a cut ramp leads to it.
  - Mineshaft: 3×3 corridors at y 60..100 that run up to 79 blocks from a hub and may fork. Log posts and plank beams stand every 4 blocks. Corridors carry rails, cobwebs, and chests. A mineshaft crosses chunk borders without seams.
  - Spawner (id 249): spawns 1..3 of its mob (zombie, skeleton, or spider) every 5..15 s. It works only when the player is within 16 blocks, the light at the spawner is 9 or less, and no torch touches it. It respects the hostile cap. A small model of its mob spins inside the cage. Mining it drops nothing.
  - Cobweb (id 129): slows movement to 25% and caps the fall speed. A sword breaks it fast and gets 1 string.
  - Loot: each structure has its own loot table. A generated chest fills the first time it opens, breaks, or explodes. The loot depends on the seed and the position, so it is the same on every visit. A filled position never fills again. The save and the export keep the filled positions. Loot can hold enchanted tools, diamond armor, and golden apples.
  - Building blocks: mossy cobblestone (138), stone bricks (139), mossy stone bricks (141), cracked stone bricks (142), sandstone (143), and chiseled sandstone (144). 4 stone craft 4 stone bricks. 4 sand craft 1 sandstone. 2 sandstone craft 1 chiseled sandstone. The furnace smelts stone bricks into cracked stone bricks.

- Travel (Batch 16):
  - Boat (id 238): 5 planks. It places on water only. A right click enters it. W and S row, and A and D turn the boat and the view. The boat reaches 6 blocks/s on water and 1 block/s on land. It climbs a bank up to 0.45 blocks high.
  - Rail (ids 157–166): 6 steel and 1 stick make 16. A rail needs a solid block below. Rails join straight, curve at corners, and slope up one block. A neighbour rail with a free end re-shapes to join a new rail.
  - Minecart (id 239): 5 steel. It places on a rail only. W pushes the cart along the look direction, and S brakes. Slopes speed the cart up or slow it down. The cart follows curves and stops at the centre of the last rail. Top speed is 8 blocks/s.
  - Shift leaves a boat or a cart onto a free block beside it. Two hits break a vehicle, and it drops as its item.
  - Vehicles save with the world and the export. A rider loads beside the vehicle.
  - Compass (id 248): 4 steel and 1 crystal. While held, a dial at the top right points to the spawn and shows the distance. Within 2 blocks the needle spins and the text reads "At spawn".

- Enchanting (Batch 15):
  - Enchanting Altar (id 145): 4 obsidian, 2 diamonds, 2 crystals, and 1 Magma Core. It emits light 10 and glows purple.
  - A right click opens the altar screen: an item slot, a crystal slot, and 3 offers. Offer 1, 2, and 3 cost 1, 2, and 3 crystals and give level I, II, and III. An offer the player cannot pay is grey. A note shows when the item slot is empty, when nothing more fits, or when crystals are short.
  - The offers depend on the item and a saved seed. They stay the same until the next enchant. An item holds up to 3 enchantments, and the offers skip those it has.
  - Efficiency (mining tools): speed × (1 + 0.3 × level). Fortune (pickaxe): 0..level extra ore items. Sharpness (sword, axe): + 1.25 × level damage. Unbreaking (tools, armor, bow): skips a wear with chance level / (level + 1). Protection (armor): + level armor points. Power (bow): arrow damage × (1 + 0.25 × level). Feather Falling (boots): fall damage × (1 − 0.25 × level).
  - An enchanted icon shimmers purple. The tooltip lists each enchantment and level.
  - Enchantments travel with the stack through the inventory, drops, chests, the trash slot, deaths, the save, and the export.

- Armor, the bow, and new mobs (Batch 14):
  - Armor (ids 176..199): a helmet, chestplate, leggings, and boots in 6 tiers (Leather, Copper, Steel, Golden, Ruby, Diamond). Each piece crafts with the vanilla shape.
  - The inventory has 4 armor slots. A slot accepts only its piece. A right click on a held piece or a shift-click in the inventory equips it.
  - The HUD armor bar sits above the hearts (2 points per icon). It hides at 0 points.
  - Each armor point cuts mob, arrow, explosion, and lightning damage by 4%, up to 80%. Falls, lava, and cactus ignore armor. A hit costs each worn piece 1 durability, and a piece breaks at 0 with a sound.
  - Armor survives a save and reload. A death drops it.
  - Flint (id 218): gravel drops flint about 1 in 10. Flint, a stick, and a feather craft 4 arrows (id 219). 3 sticks and 3 string craft a bow (id 228).
  - The bow: hold right click to draw for up to 1 s. The view model pulls back and the view zooms. Release fires one arrow. An arrow falls with gravity, deals 2–9 damage by charge, and sticks in blocks. The player picks up an own stuck arrow. A stuck arrow disappears after 30 s.
  - Skeleton: keeps 6–12 blocks away, strafes, and shoots every 2 s while it sees the player. An arrow deals 3. It burns in daylight. It drops 0–2 bones, 0–2 arrows, and a bow 1 in 20.
  - Spider (string id 209): climbs walls and leaps at the player from 2–4 blocks. A bite deals 2. In bright light a spider stays neutral until hit. It drops 0–2 string.
  - Magma Brute: spawns only in caves below y 40. It glows, walks in lava unhurt, takes 20% knockback, and hits for 7. It drops a Magma Core (id 229) and 0–2 coal.
  - Surface spawns mix zombies, skeletons, creepers, and spiders.

- Farming and renewables (Batch 13):
  - Saplings (ids 146..152): each leaf color drops its own sapling about 1 in 16, on a break and on decay. A sapling places on grass or dirt. It grows the tree of its color in 60–180 s, and a white sapling grows a spruce. A sapling with no room waits.
  - Apples: a leaf that is not white drops an apple about 1 in 60. An apple heals 4 HP.
  - Seeds: tall grass drops wheat seeds about 1 in 8.
  - Hoes in all 7 tiers. A hoe turns grass or dirt with air above into farmland.
  - Farmland (ids 127, 128) is 15/16 tall. It is wet and darker with water within 4 blocks. Dry farmland with no crop turns to dirt after about 60 s. A fall onto farmland turns it to dirt.
  - Wheat (ids 153..156) grows through 4 stages on farmland, twice as fast on wet farmland. A ripe crop drops 1 wheat and 1–3 seeds. An unripe crop drops 1 seed.
  - Bread: 3 wheat craft 1 bread, which heals 5 HP.
  - Bone meal: 1 bone crafts 3 bone meal. Bone meal advances a sapling or a crop one stage with green particles.
  - Buckets: 3 steel craft 1 bucket. A bucket picks up a water or lava source, and a full bucket places it. A lava bucket burns 1000 s as fuel and leaves the bucket.
  - Golden apple item: heals 10 HP and regenerates 1 HP per s for 20 s. It can be eaten at full health.
  - Bones and golden apples have no source yet. Skeletons (Batch 14) and loot chests (Batch 17) add them.
  - Crops, saplings, farmland, and their timers survive a save and reload.

- World export and import: Export World and Import World sit beside New World in the menu. Export downloads the current world as `clonecraft-<seed>-<date>.json`. Import checks the file, saves it under its seed, and opens that world. An import that meets an existing save for its seed asks before it replaces the save. A file that is not a valid save shows a message and changes nothing.

- Cobblestone Stairs (ids 111..118) and Plank Stairs (ids 119..126): 6 blocks in a stair pattern craft 4 stairs. A stair faces the look direction. A click on a bottom face or on the upper half of a side face places it upside down. Neighbouring stairs join into inner and outer corners. The player and mobs walk up stairs without a jump, and the camera eases each step. Plank stairs burn as furnace fuel for 15 s.

- TNT (id 110): 5 gunpowder and 4 sand craft one TNT. A right click or a torch placed beside it lights the fuse. The block flashes for 4 s and then explodes (power 4). An explosion lights nearby TNT with a 0.5–1.5 s fuse. Breaking a lit TNT defuses it. A save never keeps a lit fuse.
- Crystal clusters (ids 94..99): turquoise quartz-like clusters grow in cave patches on floors, ceilings, and walls. They emit light 12 on a separate crystal light channel, so the light is turquoise. A pickaxe mines them, and the item places a cluster that grows away from the clicked face. A cluster breaks and drops when its rock goes.
- The Block of Coal burns as furnace fuel for 400 s (10 coal burn for the same time as 1 block, which costs 9 coal).
- Storage blocks: Block of Coal, Copper, Steel, Gold, Ruby, and Diamond (ids 88..93). Nine items craft one block on a crafting table, and one block crafts back into nine items.
- Trash slot on the inventory, crafting table, furnace, and chest screens. It holds the last trashed stack until the screen closes, so a click takes it back (undo).
- Flight: Space rises and Shift sinks. Flight cancels fall damage.
- Wind sway for leaves and plant tops in the terrain shader.
- Water reflects the horizon at grazing angles and glints toward the sun or moon.
- Soft halo around the sun.
- Menu panorama: the camera turns slowly 12 blocks above the spawn behind a frosted panel.
- Fade from black on the first start and on respawn. Screens fade in.
- Screen vignette, a sliding hotbar selector, and an icon pop when a hotbar stack grows.
- The spawn faces the direction with the longest clear view.
- Bloom: the sun, moon, torch flames, flame particles, and the water glint glow. The world renders into an HDR target when the GPU supports it.
- Light shafts from the sun or moon. Leaves, terrain, and clouds cast shafts through their gaps. Shafts are warm at dusk and blue at night.
- Effects setting (Off, Bloom, Bloom + shafts) in the menu and the `fx` URL parameter.
- Flowing water and lava. Liquids fall first, then spread up to 7 cells past the source, and drain when the source goes. Breaking a block next to a liquid lets it flow in.
- Lava: lakes fill every cave below y 11. Lava glows, emits light 15, burns (4 damage every 0.5 s), slows movement, and destroys dropped items. Lava beside water becomes obsidian (source) or cobblestone (flow).
- Ores: copper, gold, ruby, and diamond. Obsidian and glass blocks.
- Tool tiers: copper, steel, gold, ruby, and diamond, each with a pickaxe, sword, axe, and shovel.
- Furnace: smelts raw iron into steel, raw copper and gold into ingots, sand into glass, and cobblestone into stone. It keeps smelting with its screen closed. A lit furnace glows and emits light.
- Chest with 27 slots. Breaking a furnace or chest drops its contents.
- Doors, two blocks tall. They close by themselves after 5 s and wait while the doorway is occupied.
- Save and load: one save per seed in `localStorage`, written every 30 s, on pause, and when the page hides. The `new` URL parameter and a New World button start a new world.
- Homes: the H key opens a list of up to 10 named places. Set, teleport, and delete.
- Shift + right click places a block against a usable block.
- Wall torches: a torch placed on the side of a block hangs on that wall and leans away from it. It drops when its wall breaks.
- A resume hint shows when a menu closes without the mouse lock. A click on the game takes the lock.
- Yellow leaves: a new leaf color, with its own block and item.
- Forest mosaic: forest oaks grow in color patches about 11 blocks across. Each patch is green, yellow, orange, red, or brown. One tree in 5 takes a random color.
- Leaf decay: a tree-grown leaf with no log within 6 steps through leaves falls within about 6 s. A decaying leaf drops a stick 1 time in 20. Placed leaves never decay.
- Leaf colors: red, orange, yellow, and brown oaks grow outside forests (30% of those oaks). Pink oaks grow in dense groves in plains. Trees in snowy plains and snowy mountains have white leaves. Each color is its own block and item.

### Changed

- Dungeons now have 2 to 4 rooms at different levels (SPEC_expansion.md, O2). Each room lies 5 to 9 blocks lower than the room before it. A cobblestone staircase or a ladder shaft joins each pair of rooms. One room holds the spawner; every room holds a chest. Dungeons in existing worlds regenerate in the new shape where the player has not edited them.
- Source layout (SPEC_modules.md): the source is now 43 ES modules in `src/`. Vite 7 and vite-plugin-singlefile build them into the root `index.html`, which still ships as one file. The game plays the same; a save from the single-file version loads unchanged.
- Build and checks: `npm run dev` serves `src/` with live reload. `npm run build` writes the root `index.html`. `npm test` runs Node tests for world generation (golden chunk hashes), block and item ids, and crafting. `npm run check` runs the dependency check, the tests, and a fresh build, and fails when the root `index.html` is stale.
- Pause menu: the settings rows sit closer together (30 px apart, was 56 px). The desktop menu no longer uses the 44 px touch targets. Effects is now two check boxes, "Shadows" and "Bloom + shafts", which work on their own. An old Effects value of 1 or 2 turns both on. The `fx` URL parameter is now a bit mask: 1 shadows, 2 bloom and shafts, 3 both.

- Oak, spruce, and jungle trees grow 1 or 2 blocks taller, and their crowns move up with the trunk. Trees stand where they stood before. This applies to existing worlds too; a tree chopped in an old save can leave 1–2 leaf blocks on top.
- Moonlight is a little brighter: the night sky light floor rises from 4/15 to 4.5/15, and the moon's direct light from 0.4 to 0.5 of the sun's. Open ground at midnight is about 20 % brighter.
- The menu right-click hint names till, plant, and buckets.
- The trash slot deletes its stack 3 s after the trash click (`CONFIG.trashDelay`), with a drain bar on the slot. The screen no longer has to close first. Closing the screen before 3 s still deletes the stack at once.
- Every menu button is at least 44 px tall (was 41 px).
- The menu control hints name TNT on the right-click row. A new stairs row names the facing and the flip rule (a click high on a side or on an underside). The right-click row fits one line, so the menu panel no longer scrolls at 1200×824.
- Crystals are about 26% rarer: a chunk tries 2.5 patch centres on average (was 3). Worlds average 25 crystals per chunk (was 34).

- The walk bob runs at 0.6 cycles per block (was 1.75). Each footstep plays at the bottom of a bob cycle.
- The menu uses a gradient title, a pulsing splash text, and a system monospace font.
- The sun is a smaller white-hot square disc inside a round glow, modeled on `clonecraft-fable`. It fades out below the horizon.
- The moon matches the `clonecraft-fable` moon: a small white square disc inside a soft blue-white glow. It has no craters.
- A full day lasts 900 s (was 600 s).
- The world is 176 blocks tall, and sea level is y 128 (was 96 and 48). The surface sits about 2.5 times deeper above bedrock.
- Caves are wider with depth and include giant caverns. Cave volume per chunk is about 4.8 times larger.
- Ores are more common. Each ore has a depth band, and rarer ores sit deeper.
- Metal ores drop raw items. Iron ore drops raw iron (was an iron ingot). Iron tools became steel tools.
- Harvest levels replace tiers: copper and iron ore need stone, gold and ruby ore need steel, diamond ore needs ruby, and obsidian needs diamond.
- Without a `seed` parameter, the game reopens the last world (was a random seed).
- Torches emit light 15 (was 14), and block light falls off slower. The same brightness now reaches about 2 blocks farther from a torch.
- The I key opens and closes the inventory (was E).
- The K key starts and stops flight (was a double-tap of Space). Touching the ground does not end flight.
- An ore or obsidian does not break under a pickaxe below its level (was: it broke and dropped nothing). A message names the weakest pickaxe that works.
- A dropped item flies to the player from 3.3 blocks (was 1.8). An item the player throws keeps the 1.8-block range, so it does not come back.
- Esc in the inventory, crafting table, furnace, chest, homes, or pause screen returns to the game (was the pause screen, or nothing on the pause screen).
- Every slot on the inventory screens is 44 px, with 12 px gaps between slots. This covers the backpack, the hotbar row, the crafting grids, the chest, the furnace, the armor column, and the altar. Slots were 40 px with no gap, below the tap-target rule.
- The recipe book, the Homes screen, and the Recipes button meet the text-size and tap-target rules: 14 px minimum text, 44 px targets, and 12 px gaps.
- Deleting a home asks for a confirm click within 3 s.
- The menu panels are darker (80 % opaque), the button hover color is darker, and the name-field placeholder is lighter, so their text meets 4.5:1 contrast.
- The F3 debug text, the settings labels, and the loading text are 14 px (were 13 px). The debug box is darker (60 % black) so its text meets 4.5:1 over a bright sky.
- The settings sliders are 44 px tall targets with 12 px between rows. Item counts have a dark backing so they meet 4.5:1 contrast.
- The Effects setting now reads "Off", "Bloom + shadows", and "Bloom + shafts + shadows". Effects 0 turns shadows off.

### Fixed

- A dungeon floor no longer hangs in mid-air in a cave. A room is built only where every cell under its floor is solid.
- Weather no longer speckles a slope with patches of snow amid rain. Outside snowy biomes, the drop's height decides the kind: snow above y 158, rain below.
- The sun, moon, and sun halo turned toward the world origin instead of the player, so they looked squished (or vanished) far from spawn.
- Caustics raced across the floor as the sun moved. The pattern now shifts by the water depth, not by the block's height in the world.
- Blocks built above the generated terrain height disappeared after a reload, and the sky light under them could be wrong. Saved edits now update the column height and sky floor when a chunk loads.
- Stars no longer show through clouds. Stars no longer show below the horizon.

## [0.1.0] - 2026-09-23

### Added

- Single-file voxel game `index.html` built from `Minecraft Clone Prompt V3.md`.
- Infinite terrain from a seeded, pure world generator in Web Workers, with a main-thread fallback.
- Ten biomes, rivers, caves, coal and iron ore, trees, and a ragged bedrock floor.
- Sky light and torch light with smooth lighting, ambient occlusion, and a directional sun term.
- Mining with tool tiers and durability, block placement, item drops, and a held-item view model.
- A 36-slot inventory, 2×2 and 3×3 shaped crafting, and a recipe book.
- Passive mobs (cow, pig, sheep, chicken) and hostile mobs (zombie, creeper), with per-chunk storage of passive mobs.
- Health, fall damage, regeneration, death, and respawn.
- Day/night cycle, sky dome, sun, moon, stars, and clouds.
- Procedural WebAudio sound effects and a point-particle system.
- Pause menu with render distance, field of view, sensitivity, and volume settings, saved in `localStorage`.
- `window.clonecraft` test handle.
- Project docs: `README.md`, `ARCHITECTURE.md`, `GATE.md`, and `DISCOVERY_engine.md`.
