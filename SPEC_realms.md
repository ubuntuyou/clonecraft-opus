# SPEC: realms (O7)

Status: approved by Joe on 2026-10-03 22:51 CT.
Gate: `GATE_realms.md`.
Id plan: Joe chose O1 on 2026-10-03 22:50 CT. Item-only ids leave the byte range, and only armor moves now. He rejected two-byte chunk cells.
Joe's choices (2026-10-03): two realms; an obsidian frame lit with a Magma Core; a fire realm that is an enclosed cave world at 1:8 scale; a fortress, a new ore, and 2 new mobs in the fire realm; a Crystal Realm of floating islands; an Ember Heart from the fire realm that lights a crystal frame; an arena boss with phases.

## Part 1: General

### Scope

The game gets an end game. Two new realms sit beside the overworld. The Ember Realm is an enclosed cave world of ember rock and lava seas. One block there equals 8 blocks in the overworld, so it is also a fast-travel network. Its fortresses hold a new ore tier, two new mobs, and the Ember Heart. The Ember Heart opens the Crystal Realm: floating islands over a void, with the Prism Colossus in an arena. The kill opens an exit portal and shows a victory screen.

### Constraints

- Block ids stay one byte. `UNLOADED` (255) stays reserved. Item-only ids may now be 256 or more (Phase 0).
- The world generator stays pure: the same seed and realm give the same chunks, structures, and loot.
- Saves from before this spec load without loss. Their armor ids migrate (Phase 0). New save fields are optional in `validSave`.
- The atlas stays one 256×256 texture of 16 px tiles.
- `npm run check` passes after every phase.
- Chromium shows 0 console errors.
- The Ember Realm runs at 60 fps (vsync) at 1280×720 and render distance 8 on this Mac, as the overworld does. The Crystal Realm does too.
- UI follows the `ui-guidelines` skill. The game is a desktop pointer game, so the "Web or desktop, pointer" row applies: 14 px minimum text, 24 px targets, 8 px gaps (D35).

### Non-goals

- More realms, or biomes inside a realm.
- Mobs, drops, arrows, and vehicles do not pass through portals.
- A portal does not start from a lava cast or from fire. Fire and fire spread stay out (SPEC_expansion).
- Fireballs and shards break no blocks.
- Weather, clouds, fireflies, and a day-night cycle in the new realms. The global clock and the weather state keep running.
- A boss respawn after the first kill.
- Loot islands, cities, or elytra in the Crystal Realm.
- A way to break the Ember Realm roof or floor (bedrock).
- Beds, maps, and end credits text.

## Part 2: Product

### What to build

#### Realms and travel

- Three realms: `overworld`, `ember` (the Ember Realm), and `crystal` (the Crystal Realm). The player is in exactly one realm. Only that realm's chunks load.
- Travel: the player stands in portal blocks for 2.5 s. A colored vignette grows over the view while the player stands there. A step out resets the timer.
- Travel shows the loading screen with "Entering the Ember Realm…", "Entering the Crystal Realm…", or "Returning to the Overworld…". The simulation stops while it loads, as at boot.
- After arrival, the portal does not fire again until the player steps out of all portal blocks.
- A rider in a boat or cart does not travel. A toast says "Leave the boat to travel" (or the cart).
- Each realm keeps its own block edits, chests and furnaces, homes, liquids, leaf decay, farming, vehicles, and looted chests. A return finds them as the player left them.
- Dropped items stay in their realm for the session. They wait, frozen, while the player is away. The save does not keep drops (unchanged).
- Mobs do not wait: a realm change removes all mobs, and passive mobs come back from `entityStore` when the overworld loads again.
- Death in any realm respawns the player at the overworld spawn. The death drops lie where the player died and wait there for the session.
- The homes screen lists only the homes of the current realm.
- The compass points to spawn only in the overworld. In the other realms the needle spins and the distance shows "?".
- The game saves right before and right after each travel.

#### Ember Realm

- Terrain: y 0 is bedrock. A bedrock roof fills y 124 to 175 and hangs down to y 116 in noise bumps. Between them, 3D noise carves a large cave world.
- A lava sea fills the open cells at y 31 and below. The sea is static until an edit wakes it (D15).
- New blocks:
  - Ember Rock: the main rock. Hardness 0.4, pickaxe. It drops itself.
  - Ash Sand: patches on floors near the sea. It slows walking to 40 %. Shovel.
  - Ember Lamp: clusters that hang from the roof and from ledges. It emits block light 15. It drops 2–4 Ember Dust; a pickaxe is not needed.
  - Emberite Ore: veins of 1–3 in Ember Rock at y 8 to 110, about 1 vein per 2 chunks. It needs a diamond pickaxe and drops Raw Emberite.
  - Ember Bricks: the fortress block. Hardness 2, pickaxe.
- Light: no sky light reaches inside. An ambient floor of level 9, tinted red-orange, keeps unlit caves visible. (Phase 2 raised it from 6: level 6 read as near-black on screenshots.) Lava and Ember Lamps give block light.
- Fog is dark red and ends at 72 blocks or the render distance, whichever is nearer. Ash particles drift in the air around the camera.
- Water: a water bucket used in the Ember Realm makes steam particles and a hiss. The bucket empties, and no water appears. Ice and snow do not exist there.
- Hostile spawns ignore day and night. A mob spawns where block light is 11 or less. Weights: Magma Brute 35 %, Ember Wisp 45 %, Cinder Knight 20 % (Cinder Knights spawn only inside fortress bounds).

#### Ember Fortress

- Each cell of a 96-block grid (in Ember Realm coordinates) holds one fortress. Its keep sits inside one chunk near the cell center.
- The keep: a 13×13 room of Ember Bricks, 6 blocks tall, standing on brick pillars that reach the floor or the lava. It holds a Cinder Knight spawner and the heart chest.
- The heart chest always holds 1 Ember Heart, plus fortress loot.
- 2 to 4 bridges leave the keep along x and z. A bridge is 5 wide, with a 1-block rail on each side, and 32 to 64 long. Brick pillars hold it up every 8 blocks. Each chunk stamps its own part of a bridge, as mineshafts do (D28).
- A bridge ends in a small room with 1 chest, 1 time in 2.
- A player walks from any bridge end into the keep without digging.
- Fortress loot: Emberite Ingots, Raw Emberite, Ember Dust, Magma Cores, diamonds, obsidian, golden apples, and enchanted diamond tools.

#### Emberite and the new mobs

- Raw Emberite smelts into an Emberite Ingot.
- Emberite tier: tools (pickaxe, sword, axe, shovel, hoe) and armor. Recipes use the vanilla shapes.
  - Tools: level 6, speed 11, durability 2400. Damage: pickaxe 7, sword 9, axe 9, shovel 6.
  - Armor: points 3/8/6/3, durability factor 40. Each worn piece also cuts lava damage by 20 %.
- Ember Dust: burns in a furnace for 60 s. 4 Ember Dust in a 2×2 craft 1 Ember Lamp.
- Ember Wisp: 10 HP. It flies and hovers 2–6 blocks above the floor. It keeps 8 to 16 blocks from the player. It shoots a fireball every 3 s with a line of sight. A fireball flies straight at 12 blocks per s, deals 5 (armored), and shows a small burst. It breaks no blocks. The wisp drops 0–2 Ember Dust.
- Cinder Knight: 30 HP, speed 2.4, a hit of 6, and half knockback. Arrows deal half damage to it. It drops 0–2 coal and Raw Emberite 1 time in 3.
- Magma Brute: unchanged, and it now also spawns in the Ember Realm.

#### Ember portal

- Frame: a vertical rectangle of obsidian along x or z. The opening is 2 to 4 wide and 3 to 5 tall. Corner blocks are optional.
- Ignition: a right click on a frame block with a Magma Core lights the frame when the shape is valid. It uses the Magma Core. Portal blocks fill the opening. An invalid shape shows a toast "The frame is not complete".
- A portal block is a thin swirling pane in the plane of the frame. It emits block light 11. It does not collide and does not stop the crosshair. It shows drifting particles and a low hum near it.
- Breaking any frame block, or any edit to a portal block, removes all portal blocks of that opening.
- Linking at 1:8:
  - From the overworld, the target is (x / 8, z / 8) in the Ember Realm. From the Ember Realm, it is (x × 8, z × 8) in the overworld.
  - The target y is the overworld y − 64 (ember side, held to 33..110), or the ember y + 64 (overworld side).
  - The game looks for the nearest portal block of the same kind in the target realm: within 16 blocks horizontally in the Ember Realm, or 128 in the overworld. The player arrives in that portal.
  - With no portal there, the game builds one: a 2×3 opening in an obsidian frame, at the nearest site within 16 blocks that has a solid floor and air for the frame. With no site, it builds a 3×4 obsidian platform at the target and clears the air above it. A built portal never stands in lava.
  - A built portal is a set of normal edits, so the save keeps it.

#### Crystal Realm and the crystal portal

- Crystal Frame: a new block. An obsidian in the center with a crystal on each side crafts 2 Crystal Frames.
- The crystal portal frame follows the obsidian frame rules but uses Crystal Frames. A right click with an Ember Heart lights it and uses the heart. Its portal blocks are turquoise. The crystal portal works only in the overworld. In the other realms, the click shows "The frame does not wake here".
- A crystal portal in the overworld always leads to the arrival portal in the Crystal Realm. The game remembers the last overworld crystal portal used.
- The arrival portal is part of the generated arena island. It is always lit. It leads back to the last overworld crystal portal used, or to the overworld spawn when that portal is gone.
- Terrain: floating islands over a void. Nothing exists below y 20. A cell below y 0 reads as air.
  - New blocks: Voidstone (the island rock, hardness 3, pickaxe) and Glimmer Moss (the top layer, shovel, drops Voidstone). Crystal clusters grow on island tops and undersides.
  - Islands taper to points underneath. Tops lie at y 70 to 110.
  - The arena island sits at the realm origin, radius 44, with a flat top at y 96. No other island lies within 72 blocks of the origin. Other islands are sparse beyond that.
- The void: below y −32, the player takes 4 'void' damage every 0.5 s. Armor does not apply. Mobs and drops below y −32 are removed.
- Light: the sky is open. The daylight is fixed at 0.8 and tinted lavender. A pale star gives a fixed light direction, so shadows still work. The sky dome is violet to black with bright stars and slow aurora bands. Fog is deep violet.
- No natural mob spawns.

#### Prism Colossus

- The arena: 6 voidstone pillars stand on a ring of radius 26 around the center, 10 to 16 blocks tall. A Resonance Pylon block sits on each pillar top. A pylon emits crystal light 15. A beam joins each standing pylon to the boss.
- A pylon breaks by any hit (hand included) or by an arrow. It drops nothing.
- The boss: 300 HP, 2.4 blocks wide and 4.5 tall. It floats 2 blocks above the arena floor and ignores knockback.
- It sleeps until the player comes within 32 blocks of the arena center. A boss bar with its name then shows at the top of the screen. The bar hides when the player is 64 or more blocks away.
- Phase 1, while any pylon stands: hits do no damage and show a shield flash. A toast says "The pylons shield it" once per fight. Every 3 s it fires a fan of 3 crystal shards (4 damage each, armored).
- Phase 2, no pylons and HP above 50 %: it hunts the player at speed 2.5. Within 5 blocks it rises, and after 0.8 s of warning (a ring of particles on the floor) it slams: 8 damage within 4 blocks (armored) and a strong knockback. It fires a 3-shard fan every 4 s.
- Phase 3, HP at 50 % or below: speed 3.5. A 5-shard fan every 3 s. It summons 2 Shardlings every 12 s, up to 4 alive.
- Shardling: 8 HP, small, speed 4, a hit of 3. It drops a crystal 1 time in 2.
- A fight resets when the player dies or leaves the realm: full HP, and the Shardlings vanish. Broken pylons stay broken.
- Death: the boss spins and cracks for 3 s with a light burst, then shatters. It drops the Prism Heart (a trophy item), 8–16 crystals, and 2–4 Emberite Ingots. An exit portal of Crystal Frames, already lit, appears at the arena center. It leads like the arrival portal.
- After the kill, the save records it. The boss never returns. The exit portal stays.
- Victory screen, on the first kill only: "The Prism Colossus is defeated", the time played in this world, and a Continue button. The world pauses behind it. Continue or Esc returns to play.

### Where it lives

| Feature | Place |
| --- | --- |
| Realm table, current realm, travel, realm-scoped state | new `src/realms.js` |
| Realm generators | `src/worldgen.js` (`WorldGenModule`), one generator per realm |
| Realm parameter for workers, stale-result drop | `src/gen-service.js` |
| World reset, void below y 0 | `src/world.js` |
| Portal frames, ignition, linking, portal building | new `src/portals.js` |
| Blocks, items, tiers, id migration | `src/blocks.js`, new `migrateIds` in `src/persist.js` |
| Tiles and item icons | `src/atlas.js` |
| Portal pane shape | `src/mesher.js`, swirl in `src/terrain-material.js` |
| Realm sky, fog, ambient, fixed light | `src/sky.js`, `src/terrain-material.js` |
| Ash particles | new pool in `src/realms.js` or beside `src/weather.js` pools |
| Fortress, arena | `src/worldgen.js` stamps |
| Ember Wisp, Cinder Knight, Shardling | `MOB_TYPES` in `src/mobs.js` |
| Fireballs, shards | `src/projectiles.js` |
| Spawn rules per realm | `src/spawning.js` |
| Prism Colossus, pylons, boss bar | new `src/boss.js`, bar in `src/hud.js` |
| Victory screen | `src/menus.js`, `src/index.html` |
| Save fields | `src/persist.js` |

### Interfaces

#### Id plan

- Phase 0 moves armor ids from 176..199 to 300..323: `armorId(tier, piece) = 300 + 4 × tier + piece`. A save without `ids: 2` maps each stack id in 176..199 to id + 124.
- New blocks: 176 EMBER_ROCK, 177 ASH_SAND, 178 EMBER_LAMP, 179 EMBERITE_ORE, 180 EMBER_BRICKS, 181 PORTAL_EMBER, 182 PORTAL_CRYSTAL, 183 CRYSTAL_FRAME, 184 VOIDSTONE, 185 GLIMMER_MOSS, 186 PYLON.
- New items: 256 RAW_EMBERITE, 257 EMBERITE, 258 EMBER_HEART, 259 EMBER_DUST, 260 PRISM_HEART.
- Emberite tools are tier 8: `toolId(kind, 8) = 270 + kind index` (pickaxe 270, sword 271, axe 272, shovel 273, hoe 274). Tiers 1–7 keep their ids.
- Emberite armor is armor tier 6: ids 324..327.
- Free after this spec: 187..199, 200, 210, 220, 230, 240, 254, and every item id from 261 except the ones above.

#### Realms

- `REALMS` in `src/realms.js`: `{ overworld, ember, crystal }`. Each entry holds `name`, `label`, `scale` (1 or 8), `sky` ('day', 'ember', 'crystal'), `ambient`, `fog`, `voidBelow` (true only for crystal), `weather` (true only for overworld).
- `realm.current` is the name of the loaded realm.
- `realm.travel(name, to = defaultTarget(name), arrive = standNear)` runs the switch. `to` is the target point. When the chunks around `to` are meshed, `arrive(to)` returns the standing point. Portals and the debug handle call it.
- A realm-scoped module exposes `save()`, `load(d)`, and `clear()`. `realm.travel` saves the current slice, clears every scoped module, loads the target slice, and resets the world.
- `world.reset()` unloads every chunk (each calls `onChunkUnloaded`) and swaps in the target realm's override maps.
- `WG.generateChunk(cx, cz, realm)`. A worker message carries the realm and an epoch number. The world drops a result whose epoch is old.

#### Save

- `ids: 2` marks the new id plan.
- `realm`: the realm of `player.pos`. Absent means `overworld`.
- The top-level slice fields (`edits`, `te`, `homes`, `liquids`, `leaves`, `farm`, `vehicles`, `looted`) stay the overworld slice, so old saves read the same.
- `realms: { ember?, crystal? }`: one slice object per visited realm, with the same fields.
- `portals: { crystalBack: [x, y, z] | null }` and `boss: { defeated: boolean }`.
- `validSave` runs after `migrateIds` and checks each new field when present.

#### Damage

`damagePlayer(amount, cause, from, kind)` gains the kind `shard` (armored) and `fireball` (armored). The `void` kind is not armored. Lava damage reads the Emberite lava cut.

### Patterns to follow

- Grid structures that cross chunks: the mineshaft in `src/worldgen.js` (D28).
- Hanging light clusters: crystal patches in worldgen step 5b (D20).
- Projectiles: `projectiles.shoot` and the skeleton's line of sight (D25).
- Mobs: `MOB_TYPES` entries with `build(root, M)`, like the Magma Brute.
- Realm-scoped save and load: `liquids.save()` and `farming.load()`.
- Particle pools around the camera: `src/weather.js` and `src/fireflies.js` (D43).
- Screens: `setState` and the death screen markup.
- Blocks whose shape comes from neighbours: stairs (D22). The portal pane takes its axis from its frame neighbours, so it needs one id per portal kind.

## Part 3: Execution

### Build order

Each phase ends with `npm run check`, Playwright QA of its gate section, doc updates, and a commit. The phases are sequential.

1. Phase 0, id plan: move armor ids, add `migrateIds`, allow item ids of 256 or more everywhere a stack goes.
2. Phase 1, realm core: `src/realms.js`, the world reset, the realm parameter in generation, the scoped state, the save format, the realm skies, the void, and a debug travel handle. The new realms use flat stub terrain in this phase.
3. Phase 2, Ember Realm terrain and blocks: the generator, the 5 blocks, the ambient light, the fog, the ash, and water evaporation.
4. Phase 3, Ember portal: frame check, ignition, the pane and swirl, travel, 1:8 linking, and portal building.
5. Phase 4, Ember content: Emberite and its tier, the fortress, the loot, the Ember Heart, the 2 mobs, fireballs, and the spawn rules.
6. Phase 5, Crystal Realm: the island generator, the arena island, Crystal Frames, the crystal portal, arrival and return.
7. Phase 6, boss: pylons, the Colossus, Shardlings, shards, the boss bar, the death, the exit portal, and the victory screen.
8. Phase 7, finish: sounds, the performance check in both realms, and the owner review list.

### Acceptance tests

`GATE_realms.md` lists each test. Each test is observed in Chromium through Playwright with the `window.clonecraft` handle, with real clicks where a UI exists, and with screenshots for visuals. Node tests cover the id migration, the pure generators, and the portal frame check.

### Gates

- Every item in `GATE_realms.md` is checked, or a note says why it cannot be observed.
- An old save (before Phase 0) loads with its world, inventory, armor, chests, and homes.
- `npm run check` passes.
- Chromium: 0 console errors across the QA of each phase.
- Owner review (Joe): the look of both realms, the feel of the boss fight, and the difficulty curve from the first portal to the kill. These items stay open until Joe plays them.
