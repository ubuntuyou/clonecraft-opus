# Architecture

Clonecraft ships as one HTML file with one module script. The source is 43 ES modules in `src/`. `npm run build` writes them into the root `index.html` (D36). The code keeps its numbered sections 1–18 as banners in the modules. The living header in `src/order.js` maps the sections to the modules. This document records the decisions and the seams.

## Decisions

### D1. World generation is a pure function in Web Workers

`WorldGenModule()` holds the noise functions and the world generator (sections 4 and 5). It reads no outside state. The function is serialized to a string and started in a pool of Blob-URL workers (`GenService`).
Chunk data is `f(seed, cx, cz)`. Any chunk at any coordinate generates on demand, and the same seed always gives the same terrain.
If a worker fails, `GenService` switches to the main thread and resends the pending chunks.

### D2. Player edits are overrides, not saved chunks

The world never saves chunk data. `world.setBlock()` records each edit in `overrides` ("x,y,z" key) and in `overridesByChunk`.
When a chunk regenerates, the world applies its overrides after generation. An unloaded chunk costs only its override map.
The save (D16) stores only `overridesByChunk`. Liquid flows are edits too, so a large flow grows the save.

### D3. Lighting runs on the main thread, meshing waits for neighbours

Section 7 keeps three 0..15 channels per cell: sky light, block light, and crystal light. A BFS flood fill in world coordinates computes them. The fill crosses into any lit neighbour chunk. The fill functions take the channel number, so all channels share one code path.
The world meshes a chunk only when the chunk and all 8 neighbours are lit. Smooth light and ambient occlusion read one cell across every border, so an unlit neighbour gives dark seams.
A `LIGHT_STOP` cell (a stair) takes light from its neighbours but never passes it on. A stair therefore shades like a solid roof, and its own faces still get a light value.
`world.setBlock()` relights only the affected area and remeshes the touched chunks. `beginBatch()` and `endBatch()` group many edits (explosions) into one relight and remesh pass.

### D4. Light is baked per vertex, and daylight is a uniform

The mesher writes sky light, block light, ambient occlusion, and face shade into the `aLight` vertex attribute. The terrain shader scales sky light by `uDaylight` and tints it with `uSkyLight`.
A change of time of day never remeshes. Block light falls off slower than sky light (0.85 against 0.83 per level), so torches light a wider area without brighter days. The shader also adds a small directional term. It takes the face normal from screen-space derivatives and compares it to `uSunDir`, so the vertex format holds no normals.
The water pass uses the same normal for a horizon reflection and a sun glint. The `aTint` alpha carries a wind-sway weight and a torch glow flag, so neither needs a new attribute.
Crystal light has its own attribute, `aCry`. The shader tints it turquoise and takes the maximum of it and the other light. A crystal face is emissive: the `aTint` alpha code 232 marks it.

### D5. Gamma-space color

`THREE.ColorManagement` is disabled, and the renderer outputs `LinearSRGBColorSpace`. All colors, textures, and shader math are in gamma space.
This keeps procedural texture colors identical to their canvas values.

### D6. One state machine owns the screens

`setState()` is the only function that shows or hides screens. The states are `loading`, `menu`, `paused`, `playing`, `inventory`, `homes`, and `dead`.
`game.simulating()` is true for `playing`, `inventory`, `homes`, and `dead`. The main loop runs the simulation only then. A pause therefore freezes time, mobs, drops, and particles.
A menu close returns to `playing`, not `paused`. Esc on the pause screen also returns to `playing`. After Esc, the lock request waits for the Esc keyup. In Chrome and Brave, Joe saw a lock taken on the keydown end at once. A browser can refuse the lock without a user gesture. The game then shows a resume hint, and the next click takes the lock.

### D7. A fixed per-frame budget for world work

`world.update()` receives a time budget: 40 ms while loading and 7 ms while playing. Generation requests, lighting, and meshing stop when the budget runs out, and they continue on the next frame.
The world sorts requests by distance and view direction.

### D8. Two render passes, with post-processing on the world pass

The loop calls `post.render()` for the world, clears depth, then renders the held item (`vmScene`, `vmCamera`). The held item never clips into walls. It also never blooms or catches light shafts.
`renderer.info.autoReset` is off, so the debug screen counts all passes.

### D13. Post-processing is one module with one entry point

`post` (section 18) hides the render targets and the full-screen passes. The loop sees only `post.render()` and `post.resize()`.
With `CONFIG.bloom` on, the world renders into `sceneRT`. It is half float when the GPU supports it, so emissive sources can exceed 1.0. `glowGain` (2 in HDR, else 1) scales the sun, the moon, flame particles, the water glint, and torch-flame texels. The bloom threshold of 1.0 then catches only those sources, and white snow does not bloom.
Light shafts are screen-space: a quarter-size mask of open sky around the light, taken from the depth texture, then a radial blur toward the light. True volumetric light would need the voxel grid on the GPU; the screen-space method needs only depth.
The composite rolls off the brightest channel above 0.9 and keeps the hue, so the output stays in gamma space (D5).

### D9. Entities share one collision routine

The player, mobs, and dropped items use the same routine, `moveEntity` (section 10). Mobs and drops are Three.js objects outside the voxel grid.
`solidBoxes()` lists the collision boxes near the entity. A full block gives its cell, and a stair gives its sub-cell boxes. `clipAxis()` clips the move against the boxes on Y, then X, then Z. So a new block shape needs only new boxes, not new collision code.
An entity with `stepH` (the player and mobs: 0.6) retries a blocked sideways move lifted by up to `stepH`, then settles down. So it walks up a half step but not a full block. Drops have no `stepH`. The player's `stepRise` lets the camera ease each step.

### D10. Passive mobs persist per chunk, hostile mobs do not

When a chunk unloads, `world.onChunkUnloaded` saves its passive mobs in `entityStore` and removes all mobs in it. When the chunk reloads, `world.onChunkLoaded` restores them.
A chunk rolls its passive spawn once (`spawnedChunks`). Hostile mobs spawn from light level near the player and despawn with distance, so the store does not keep them.

### D11. Ores drop raw items; a furnace refines them

Metal ores drop a raw item (`RAW_IRON`, `RAW_COPPER`, `RAW_GOLD`). A furnace smelts it into an ingot (iron gives steel). Ruby and diamond ores drop the gem.
Each tier has a harvest `level`, and each block has a `minLevel`. Rarer ores need a higher level and generate deeper. A pickaxe below the required level cannot break the block, and a message names the pickaxe it needs. A rare ore is therefore never lost to a weak pickaxe.
Diamond ranks above ruby. Gold mines fastest and breaks soonest.
A storage block (`STORAGE_DEFS`) holds nine of a refined item. Its `minLevel` matches its ore, so a storage block never lowers the pickaxe that a material needs. It crafts back into nine items, so building with it loses nothing.

### D14. Block variants are separate ids

A furnace, chest, or wall torch has one id per facing. A door has 16 ids (top, open, facing). A liquid has one id per level. A leaf has a natural id and a placed id per color. The id alone drives meshing, collision, and light, so the chunk format stays one byte per cell.
`BLOCKS[id].base` names the block that the item places and the break drops. `baseOf(id)` reads it safely, including for `UNLOADED`.

### D15. Liquids flow on a queue, woken by edits

`world.setBlock()` calls `world.onEdit` after every change. The hook wakes the liquid cells at and around the edit (`liquids.wake`). Generated water and lava stay static until an edit wakes them, so an ocean costs nothing.
Water ticks every 0.25 s and lava every 0.75 s. Each tick has a 6 ms budget and one batched remesh. Unprocessed cells wait for the next tick.
A flow cell takes its level from its neighbours, falls first, then spreads sideways. Lava beside water becomes obsidian (source) or cobblestone (flow).

### D16. One save per seed in localStorage

`persist` writes `clonecraft.world.<seed>`: the overrides, the player, the inventory, tile entities, homes, the liquid queue, and the time. Mobs and drops are not saved.
The seed is chosen before the world starts: `?seed=N`, then `?new`, then `clonecraft.lastSeed`. A save is applied before the first chunk arrives, so overrides apply as chunks load.
New World navigates to `?new`. The old world stays saved under its seed.
Export and import move one save as a JSON file. The save is read only at boot, so an import does not apply data to the running world. It checks the file (`validSave`), writes it under its own seed, and reloads on `?seed=N`. The boot path then applies it like any other save. `persist.blocked` stops the page-hide save, so a same-seed import is not overwritten by the running world. `validSave` is the trust boundary: a save from a file must pass it, because a bad id would break the boot of that seed.

### D17. Furnaces and chests keep state in tile entities

`tileEntities` maps "x,y,z" to the slots of a furnace or chest. The inventory screen has three modes (`ui.mode`): craft, furnace, and chest. The slot code reads the open tile entity through `slotArray`.
The trash slot sits in the shared inventory part of the panel, so every mode shows it. `inv.trash` holds the last trashed stack as the undo. `clickTrash` starts a `CONFIG.trashDelay` (3 s) `setTimeout`, and `emptyTrash` clears the stack when it ends. The timer runs in wall time, so it also counts while the game is paused. `closeInventory` clears the stack at once, and the save never holds it. The drain bar is a CSS animation, restarted by removing and re-adding the `full` class.
`updateFurnaces()` runs every simulated frame for every furnace in a loaded chunk, so smelting continues with the screen closed. The lit and unlit ids swap in place, and the tile entity stays.

### D18. Leaf decay runs on a queue, woken by edits

A natural leaf (tree-grown) decays when no log lies within 6 steps through leaves. A placed leaf has its own id and never decays. The id alone carries the difference, so no per-cell flag exists.
`world.onEdit` queues every natural leaf within 6 blocks of a removed log or leaf. Any leaf whose support changed lies within that cube. Each queued leaf is checked once after a random delay of 0.4–6 s, so a canopy falls apart gradually.
A decay does not wake other leaves. A leaf with a path to a log never depends on a leaf without one.
The queue is saved with the world. A leaf edit in an older save loads as a placed leaf, because only a player could put a leaf into an override.

### D19. Leaf colors come from their own hash

Tree generation picks the leaf color from `hashF(SEED ^ 0x1eaf, x, z)` and the `NPink` patch noise. It does not draw from the tree's own random stream, so tree shapes and positions match worlds made before colors existed.
A pink grove raises the plains tree chance up to `PINK_GROVE_CHANCE` (0.2). The tree's random draw stays the same, so every older tree still grows. Only chunks in a grove gain trees. `NPink` is the last noise the generator creates, so the seeds of the other noises do not change.
Forest oaks use a mosaic instead. Jittered cells of `MOSAIC_CELL` (11) blocks each pick a color from `MOSAIC_COLORS`, from a cell hash. A tree takes the color of its nearest cell point, so colors form patches that span several trees. One tree in 5 (`MOSAIC_STRAY`) takes a random color, so patch edges are not clean.
Colored leaves bake their color into their tiles. Only green leaves take the biome tint.
Natural yellow is id 87, not 86. Placed ids are `LEAVES_PLACED + color`, so placed yellow takes 86. Older saves hold ids 75–85, so no id moved.

### D20. Crystal light is a separate channel

Crystal light could not share the block-light channel. One channel holds one level per cell, so a torch beside a crystal would erase the color. A third channel keeps the hue per source and costs one byte per cell.
Crystals grow in worldgen step 5b (after bedrock, before water). Patch centers come from a hash of each chunk in the 3×3 around the chunk, so a patch crosses chunk borders without seams. A cluster needs rock on its attached face (`CRYSTAL_GROW`), and a cell fills with a probability that falls with distance from the patch center.

### D21. TNT fuses live outside the world grid

A lit TNT stays a `B.TNT` block. `primedTnt` holds its fuse and the flash overlay. The block id alone never changes, so the chunk format, the save, and the mesher need nothing new. A save therefore never holds a lit fuse. When the fuse ends, the block becomes air and `explode()` runs. An explosion lights TNT in its radius with a short fuse instead of breaking it, so a chain goes off in steps.

### D22. Stair shapes come from the neighbours at read time

A stair id holds only its half (upright or upside down) and its facing: `base + (top << 2 | facing)`. The chunk format stays one byte per cell (D14).
The corner shape is not stored. `stairMask()` reads the stairs ahead and behind and applies the Minecraft corner rules each time the mesher, collision, raycast, or outline asks. `STAIR_BOXES[top * 16 + mask]` holds the boxes for every shape. An edit next to a stair therefore reshapes it with no extra write, because the remesh reads the new neighbour.

### D23. Farming runs on one registry, woken by edits

Saplings, crops, and farmland change over time, but a chunk scan for them would cost every frame. `world.onEdit` registers each new sapling, unripe crop, or farmland in `farming`, keyed by cell. Each entry holds a due time in `game.clock` and one counter. The block id tells the kind, so one registry serves all three.
The id carries the stage (`B.SAPLING + color`, `B.WHEAT + stage`) and the wetness (`FARMLAND_WET`). The mesher, the drops, and the save therefore need no new state. A cell that changed kind leaves the registry at its next check.
`game.clock` stops while the game is paused, so crops do not grow on the pause screen. The save stores the remaining time per entry.
A sapling grows with `WG.growTree`, the same code the world generator uses. The tree shape therefore matches the natural trees of its color.

### D24. Damage has a kind, and armor reads the kind

`damagePlayer(amount, cause, from, kind)` takes a damage kind. Armor applies only to the kinds in `ARMORED`: mob, arrow, explosion, and lightning. Falls, lava, and cactus pass no armored kind, so armor never blocks them.
This keeps the armor rule in one place. A caller does not know about armor. A new source picks its kind, and the rule follows.
Each armor point cuts damage by 4%, up to 80%. Each armored hit costs every worn piece 1 durability. The armor slots live in `inv.armor`, so the save, the death drop, and the HUD bar read one array.

### D25. Arrows are projectiles, not mobs or drops

`projectiles` owns every arrow in flight or stuck. An arrow is a mesh, a position, a velocity, a damage value, and a shooter. It is not a `Mob`, so it skips AI, collision boxes, and mob persistence. It is not a drop, so it does not fly to the player.
A flying arrow steps along its path in short segments and stops at the first solid cell. It hits a mob with `hurt()` and the player with `damagePlayer(..., 'arrow')`. A stuck arrow falls again when its block goes. The player picks up an own stuck arrow. A stuck arrow despawns after 30 s. The save does not store arrows.
The bow and the skeleton both call `projectiles.shoot()`. The skeleton checks line of sight with `lineOfSight()` every 0.25 s before it shoots.

### D26. Enchantments are a stack field, and only durable items take them

A stack may carry `ench`: `{key: level}`, with levels 1..3 and at most 3 keys. The field lives on the stack, not in a side table, so every path that moves a stack moves its enchantments. `restack(s, count)` is the one copy helper. Every split, drop, spill, and container move uses it, so no path can forget `ench`.
Only items with `maxDur` take an enchantment. Those items have `maxStack` 1, and a stack with `dur` never merges. So an enchanted stack never merges with a plain one, and the merge code needs no `ench` check.
The altar screen holds its two stacks in `inv.altar`, like the craft grid. The altar block has no tile entity. Closing the screen returns the stacks, and a death drops them.
`altarOffers(s)` is a pure function of the item, its current `ench`, and `enchantSeed`. The same item shows the same offers until an enchant re-rolls `enchantSeed`, so a player cannot re-roll by closing the screen. The save stores `enchantSeed`. `validSave` checks each `ench` with `validEnch`.

### D27. Vehicles are one module, and a cart rides a rail cell, not physics

`vehicles` owns every boat and minecart. A vehicle is not a `Mob`: it has no AI, no health bar, and no per-chunk persistence. The save stores the whole list in `vehicles`.
A rail stores its shape in the block id: `B.RAIL + v`, with 10 shapes (2 straight, 4 slopes, 4 curves). `RAIL_ENDS[v]` names the two `DIR4` ends. The mesher and the cart read the id, so no side table can drift. `railPlan()` picks the shape on placement, and `railJoin()` re-shapes a neighbour that has a free end.
A cart holds a rail cell and a position `t` (0..1) along that cell's segment. It never calls `moveEntity` while on a rail. At a segment end it follows `railLink()` to the next cell. With no link, it stops at the centre of the rail. So a cart cannot leave a curve or clip a corner. A cart off a rail falls under gravity until `attach()` finds a rail.
A boat uses `moveEntity` with step-up. Water sets `onGround`, so a boat can climb a low bank.
A rider sits in the vehicle: `player.vehicle` skips the player's own movement, and `vehicles.seat()` sets the position. The save stores the rider at `vehicles.exitSpot()`, so a reload never starts inside a vehicle.

### D28. Structures stamp inside one chunk, and loot fills on first touch

The worker stamps dungeons, temples, towers, and mineshafts after terrain and caves. A stamp writes only cells inside its own chunk. Each placement decision comes from a world hash and from `column()`, which is a pure function of world coordinates. So each neighbour chunk makes the same decision on its own, and no structure has a seam at a chunk border.
A dungeon, a temple, or a tower fits inside one chunk. A mineshaft plan belongs to a 96-block grid cell. Each chunk that a corridor crosses stamps its own part of the corridor.
A structure must be reachable. A temple reads the ground outside its 4 doors from the column margin and rejects a site that its door steps cannot join. A tower stays in the chunk centre, so its door ramp fits.
A stamp reports each chest and spawner as a chunk feature `{kind, x, y, z, type}`. The block grid holds no loot. `lootChest()` rolls the loot the first time the game opens, breaks, or explodes a generated chest. The roll uses the seed and the position. `looted` holds the filled positions and goes into the save, so a position never fills twice.
`spawners` reads the spawner features of the loaded chunks near the player. A feature counts only while its block is still `B.SPAWNER`, so a mined spawner stops with no extra state.

### D29. Weather is one global state; the biome and the drop's height decide the precipitation

`weather` holds one global state: a kind (`clear`, `rain`, or `storm`) and the time left. Two fade values, `k` (wet) and `storm`, move toward the kind over 6 s. Every consumer reads the fade values, not the kind, so no consumer jumps at a change.
The biome and the height decide what falls. `zone(x, z)` reads the chunk biome: a desert gives nothing, and a snowy biome gives snow at every height. Elsewhere the drop's height decides: snow at or above `SNOW_LINE` + 1, rain below it. The rule once read the column's top block instead. That speckled slopes and treetops near the line with snow amid rain (Joe, 2026-10-01). A height rule gives one clean line. The biome map and the block grid already exist, so weather adds no world data.
Drops live in two fixed pools around the camera. A drop takes the top block of its column as its floor, so it never falls through a roof or into a cave. A snow flake in a by-height zone takes the higher of the top block and the snow line as its floor. A snow flake that sways into another column re-reads that column. The pools cost no lighting work and no mesh rebuild.
The sky keeps its own clock. `game.clearDaylight` is the daylight without weather. `game.daylight` multiplies in `weather.dim` and the lightning flash, so terrain, mobs, and fog darken with no change of their own. Mob burning reads `clearDaylight` and `wetAt()`, so rain stops the burn and a dark storm alone does not.
Only the kind and the time left go into the save. The fade values restart at their end values on load.

### D30. Shadows are one depth pass that reuses the scene

`shadows` renders the scene once per frame from an orthographic camera on the sun (or moon) direction. It swaps materials for the pass instead of keeping a second scene: terrain gets a cut-out depth material, other opaque meshes a plain one. Water, transparent and alpha-tested materials, points, lines, and every other ShaderMaterial (the sky) are hidden for the pass. So a new opaque mesh casts a shadow with no extra wiring, and a new sky or effect object must be transparent, a ShaderMaterial, or `fog: false` to stay out.
The box is 128 blocks wide and follows the camera, snapped to whole texels, so shadow edges do not crawl. The depth texture uses hardware comparison (`sampler2DShadow`): terrain takes 4 filtered reads on a noise-turned square for a soft edge, water takes 1. `TERRAIN_FS` splits open-sky light into ambient and direct sun. The direct part needs baked sky light (so caves get none), the shadow test, and `uSunAmt`, which the weather scales down. With `CONFIG.shadows` off, the pass does not run and the terrain keeps the old face term.

### D31. The held torch is a flood fill, not a point light

A point light would shine through walls. `heldLight` instead fills light of level 14 from the head cell with the block-light rules (1 per block plus `ATTEN`, stopped by `OPAQUE`) into a 32³ texture. The shader reads it like baked block light, and `world.brightnessAt` reads the same array, so terrain, water, mobs, drops, and the held item agree. It refills only when the head cell, the held item, or `world.editSerial` changes.

### D32. Caustics ride on a mesher flag

The mesher knows each face's neighbour cell. A still face whose neighbour is water gets sway alpha `WET_ALPHA` (246), so the shader knows the face is under water without a depth buffer or a new vertex attribute. The net is shifted toward the sun by the water depth, read from sky light, so it stays put as the sun moves. Caustics multiply the face's sky light instead of adding light, so a dark floor stays dark. Sky light drops 1 per water block, so a smoothstep on it fades caustics out between about 3 and 7 blocks deep. A gate on `uDaylight` turns them off by moonlight. Two reads of the one caustic texture drift in opposite directions, and each read is bent by its own field of 4 moving sines. The net then changes shape in place, which a single translated texture cannot do. The bend is arithmetic, so it adds no texture read. The caustic net and the water ripples are baked once into two 256² tiling textures (`bakeWaterPatterns`) and read with scrolling, because per-pixel trig on the sea floor and the surface cost too much on the M1 Air.

### D33. The time of day belongs to the world; the freeze belongs to the player

The pause menu sets `game.dayTime` directly, so the world save keeps the new time. "Freeze time" is `CONFIG.freezeTime`, a setting in `clonecraft.settings` for all worlds, like the other sliders. It stops only the `dayTime` advance in `sky.update()`. `game.clock` keeps running, so timers, the weather, and the day count do not freeze.
Moonlight is the night floor of `game.clearDaylight` (4.5/15) plus the moon's directional term (`uSunAmt` 0.5). The floor stays low enough that hostile mobs still spawn in the open: round(15 × 0.3) = 5, and they need 7 or less.

### D35. Shadows and bloom are separate settings

The old 0–2 Effects slider tied shadows to bloom. Shadows cost the most (the depth pass redraws the scene), so `CONFIG.shadows` and `CONFIG.bloom` are separate booleans. `shadows.render` reads only `CONFIG.shadows`; `post` reads only `CONFIG.bloom`. Light shafts stay with bloom because they need `sceneRT` and the composite pass. The pause menu is for a desktop mouse, so its rows are compact and do not use the 44 px touch targets (Joe, 2026-09-29).

### D34. Leaves pass the player through one collision table

`SOLID` stays shared by every entity, so leaves still stop mobs, drops, vehicles, and arrows. `moveEntity` reads `e.passLeaves` (set on the player only) and sets `_passLeaf` for `solidBoxes`, which skips leaf cells. The top leaf of a column stays solid while the feet are on or above it and the fall is slower than `LEAF_CATCH_V`, so a canopy is a floor to walk on and a net to fall into. `CLIMB` marks leaves and ladders; `updatePlayer` swaps gravity for the climb while the body touches one. The tree `lift` comes from `hash3` of the trunk base, not from the chunk rng, so taller trees do not move any later draw: trees, ores, and structures keep their places.

### D36. The source lives in `src/`; the built file is generated and committed

`src/index.html` holds the CSS, the markup, and one script tag for `main.js`. `npm run build` writes the root `index.html`. Git tracks the built file, so Joe can open it or copy it to a laptop without Node. A comment after the doctype says the file is generated. `npm run check` fails when the root file differs from a fresh build.

### D37. The build is Vite 7 with `vite-plugin-singlefile`, pinned

`package.json` pins exact versions of Vite 7 and the plugin. The build does not minify, tree-shake, or down-level, so the built script keeps the module text. Vite 8 bundles with Rolldown and rewrites the code (comments removed, `const` to `var`, constants inlined), so the project stays on Vite 7. `DISCOVERY_build.md` holds the details.

### D38. `src/order.js` pins the load order

`main.js` imports `./order.js` first. `order.js` lists every other module once, in load order. ES modules evaluate depth-first, and `order.js` stays in progress during the whole load, so an import of `./order.js` from inside a module never changes the order. The load order equals the order of the old single script, so every statement runs in the same order as before.

### D39. One import rule

A module imports an earlier module's names directly. It imports a later module's names (upward names) from `./order.js`, which re-exports them, and uses them only inside a function body. No module imports `main.js`. `tools/depcheck.js` enforces the rule and also rejects any free name that is not a JavaScript or browser global.

### D40. Setters replace cross-module writes

An imported binding is read-only. A `let` that another module writes gets a one-line setter in its owner (`setTarget`, `setHomes`, `setGlowGain`, and 6 more). The other module calls the setter. A write inside the owner stays a plain assignment.

### D41. The worker keeps the Blob and `toString()`

`src/worldgen.js` holds `WorldGenModule` and has no imports. `GenService` still builds each worker from `WorldGenModule.toString()`. The build keeps the function text, so the worker source does not change. The same rule lets Node tests import `worldgen.js` directly.

### D42. Text proved the split; tests guard it now

The split was mechanical. `tools/split.js` cut the old script into modules, and `tools/parity.js` proved the built script equal to the old script plus the setters. Both tools were removed when the spec closed (commit history keeps them). The git tag `baseline-single-file` keeps the old file. From now on, `npm run check` guards the build: depcheck, the Node tests (worldgen golden hashes, block ids, recipes), and the fresh-build comparison.

### D12. Procedural audio and particles

`audio` synthesizes every sound with WebAudio oscillators and noise buffers. The context starts on the first user gesture.
`particles` is one `THREE.Points` pool with typed arrays. Its shader shares the fog uniforms with the terrain, caps the point size, and fades points that reach the camera.

## Seams

| Seam | Contract |
| --- | --- |
| `GenService` to world | A request gives `{blocks, biomes, heights}` typed arrays and a `features` list (chests, spawners) for one chunk. |
| world to mobs | `onChunkLoaded(chunk)` and `onChunkUnloaded(chunk)` hooks. |
| block edits | `world.setBlock(x, y, z, id)` is the only write path. `breakBlock()` and `placeBlock()` add drops, sounds, particles, the torch set, door halves, and tile-entity spills. |
| world to liquids, leaves, and farming | `world.onEdit(x, y, z, old, id)` after every edit calls `liquids.wake()`, `leafDecay.onEdit()`, and `farming.onEdit()`. |
| containers | `tileEntity(x, y, z)` returns or creates the furnace or chest state. `openInventory(mode, target)` opens its screen. |
| save | `persist.save()` writes the save. `persist.apply(SAVE)` restores it at boot. |
| light queries | `world.brightnessAt(x, y, z, daylight)` returns 0.04..1 for mobs, drops, and the held item. It includes the held torch (`heldLight.levelAt`). |
| player damage | `damagePlayer(amount, cause, from, kind)` is the only damage path for the player. `kind` selects armor (D24). |
| projectiles | `projectiles.shoot(x, y, z, vx, vy, vz, dmg, shooter)` launches an arrow. `projectiles.update(dt)` runs once per frame. |
| enchantments | `enchLevel(stack, key)` returns 0..3. Each effect site (mining, drops, attack, wear, armor, bow, fall) reads it (D26). |
| vehicles | `vehicles.update(dt)` runs once per frame before `updatePlayer`. `vehicles.mount(v)`, `dismount()`, and `placeHeld(item)` are the entry points (D27). |
| structure loot | `lootChest(x, y, z)` returns the filled tile entity of an unfilled generated chest, or null. `tileEntity()` and the chest spill call it (D28). |
| spawners | `spawners.update(dt)` runs once per frame. It reads `chunk.features` and counts against `MAX_HOSTILE` (D28). |
| weather | `weather.update(dt)` runs once per frame before `sky.update`. The sky reads `weather.k`, `storm`, `dim`, and `flash`. Mobs read `weather.wetAt(x, z)`. `set(kind, seconds)` and `strike(x, z)` are the entry points (D29). |
| screens | `setState(s)`. |
| rendering | `heldLight.update()`, then `shadows.render()`, then `post.render()` draw the world each frame. `post.resize()` follows the window. `terrainUniforms` carries the shadow map, the held-light texture, and `uWet` (D30, D31, D32). |
| S1: load order | `src/order.js` lists every module once, in load order, and re-exports the upward names. A new module goes in its place in that list (D38, D39). |
| S2: build | `src/` goes in; the root `index.html` comes out. `npm run build` writes it; `npm run check` proves it is fresh (D36, D37). |
| S3: setters | A setter in the owner module is the only way to write another module's `let` (D40). |
| S4: worker source | `src/worldgen.js` has no imports, so the worker and Node can both load it (D41). |
| tests | `window.clonecraft` exposes the game objects in the browser. `npm test` runs the Node tests on the modules that never reach `order.js`. |
