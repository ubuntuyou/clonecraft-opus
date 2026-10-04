# GATE: game

The first criteria (sections "Delivery" to "Presentation") came from `Minecraft Clone Prompt V3.md`. Joe removed that file on 2026-10-01 because the project has moved beyond it. The later sections come from Joe's requests and the specs they name. `[x]` means I observed it in Chromium through Playwright (seed 12345). `[ ]` means it is not verified. A note tells why. Joe renamed this file from `GATE.md` on 2026-10-01, when the project had three specs.

## Delivery

- [x] Code is in the spec's sections, numbered 1–18, with a living header.
- [x] Chromium: load, play, and QA runs with 0 console errors and 0 warnings.
- [x] Chrome and Brave: Joe played it. (Corrected 2026-10-01: the line said Firefox. Joe does not use Firefox.)
- [x] `file://` launch: Joe loaded the file from disk in Chrome or Brave. (Corrected 2026-10-01: the line said Firefox.)
- [x] The game ships as one HTML file. Three.js r160 comes from a CDN. The file needs no other asset and no server-side step. (Wording approved by Joe 2026-10-01. The built `index.html` loads only the jsdelivr Three.js URL. The worker runs from a Blob URL.)
- [x] `npm run build` writes that file from the modules in `src/`. Git tracks the built file. (`npm run check` fails when the root `index.html` differs from a fresh build.)

## World

- [x] Infinite chunks (16×16×96 then; 16×16×176 since Batch 2). Teleports to (2000, −1500) and (+3000, 0) stream new terrain. Old chunks unload.
- [x] The same seed regenerates the same terrain. Passive mobs return to the same chunks.
- [x] Biomes: plains, forest, rainforest, desert, beach, ocean, rocky highlands, snowy mountains, snowy plains, and river.
- [x] Caves, a cave zombie at y 25, coal and iron ore, trees, and water at sea level.
- [x] Render distance 8 by default. Fog hides the edge. The slider changes the loaded chunk count (4 gives 225 chunks, 12 gives 877 chunks).

## Lighting

- [x] Sky light darkens at night. Torch light falls off by distance: 0.83 at the torch, 0.13 at 10 blocks.
- [x] A directional sun term follows the sun by day and the moon by night.
- [x] Sky dome, sun, moon, stars, and clouds render.

## Player

- [x] Collision, gravity, and water. Water cancels fall damage.
- [x] Fall damage above 3 blocks. Death screen with a cause. Respawn restores 20 HP at spawn.
- [x] Regeneration: +1 HP every 2 s after 4 s without damage.
- [x] Pause freezes time and simulation.
- [x] Sprint at 1.5×: the code sets `SPRINT_MULT`. (Joe, 2026-09-29: "sprint and shovel speed are ok".)
- [x] (Superseded by Batch 4: K toggles flight.) Double-tap Space starts flight. Space rises at 7.5 m/s. Flight with Ctrl reaches 20 m/s. Shift sinks to the ground, and the landing ends flight with no damage.
- [x] (Superseded by Batch 4.) Double-tap Space in the air ends flight. A fall from 13 blocks deals 10 damage.
- [x] Respawn ends flight.
- [x] Walk bob: 0.6 cycles per block on flat ground (2.6 per second at walk speed).

## Blocks and tools

- [x] Mining time follows hardness and tool. Stone by hand takes 7.5 s and drops nothing. A wood pickaxe takes 1.15 s.
- [x] Iron ore needs a stone pickaxe. A wood pickaxe takes 7.5 s and drops nothing.
- [x] A stone axe breaks a log in 0.77 s.
- [x] Placement on the aimed face. Placement into the player's box is refused.
- [x] Raycasts pass through water.
- [x] Drops fly to the player and enter the inventory.
- [x] Shovel speed. (Joe, 2026-09-29: "sprint and shovel speed are ok".)

## Inventory and crafting

- [x] Log to 4 planks and 4 planks to a crafting table, through real DOM clicks. Shift-click on the result works.
- [x] The recipe book renders.
- [x] Tool recipes through the UI: a Diamond Pickaxe crafted from the recipe book in Batch 2 QA.
- [x] Full inventory leaves drops in the world. (2026-10-01: 35 slots of 64 cobblestone and 63 dirt. A drop of 3 dirt topped the dirt to 64. The other 2 stayed in the world for 8 s. After one slot was emptied, the player picked up the 2. Block breaks use the same `spawnDrop` path.)

## Mobs

- [x] Six mob models render: cow, pig, sheep, chicken, zombie, and creeper.
- [x] An iron sword kills a cow in 2 hits. The cow drops beef and leather. The sword loses 2 durability.
- [x] A creeper fuses for 1.5 s, explodes, leaves a crater, and deals 12 damage at 3 blocks.
- [x] A zombie kills the player ("was slain by a zombie").
- [x] Zombies burn in daylight.
- [x] Passive mobs persist across chunk unload and reload (40 before, 40 after).

## Presentation

- [x] HUD: hearts, hotbar, item-name toast, and the debug text (FPS, XYZ, chunk, biome, facing, time).
- [x] Particles: block break, explosion (size capped near the camera), torch flame, and fire on burning zombies.
- [x] Held item: arm, cube, tool, and torch poses.
- [x] Audio: Joe heard it in Chrome or Brave. (Corrected 2026-10-01: the line said Firefox.)
- [x] Leaves and plants sway: the frame changes when only the shader time changes. Trees show no gaps.
- [x] Water glints toward the sun by day and the moon by night.
- [x] Menu panorama, frosted panel, and the new controls rows render. The hotbar selector centers on the selected slot. A stack that grows pops its icon.
- [x] Respawn fades in from black.
- [x] Bloom: the sun, moon glow, torch heads (orange halo), and the water glint bloom. Snow and white clouds do not.
- [x] Light shafts through a leaf screen at dusk and sunrise. The moon casts weak blue shafts. Clouds dim the shafts.
- [x] Shaft passes skip underwater and when the light is off-screen (draw calls: 3 fewer).
- [x] Effects slider: Off, Bloom, Bloom + shafts. The value saves to `localStorage`. The `fx` URL parameter sets it. (Superseded 2026-09-29: see "Compact pause menu".)
- [x] Effects cost: 60 fps (vsync) at 1280×720 in all three modes. Draw calls: 17 off, 27 bloom, 30 with shafts.
- [x] The held item renders after the composite. It does not bloom.
- [x] Sun: a white-hot square disc in a round glow at morning and dusk, with effects on and off. No sun shows below the horizon.
- [x] Moon: a white square disc in a soft glow at night, with effects on and off. It matches the Fable moon.
- [x] Clouds hide the stars behind them. No stars show below the horizon.
- [x] A full day lasts 720 s (`CONFIG.dayLength`). Superseded: Batch 2 sets 900 s.
- [x] LDR fallback (no half-float render targets). (2026-10-01: an init script hid `EXT_color_buffer_float` and `EXT_color_buffer_half_float`. `post.hdr` was false. The sun bloomed through the clouds, with shafts. The console had 0 errors and 0 warnings, and `gl.getError()` returned 0.)

## Batch 2: depth, liquids, ores, machines, saves

Observed in Chromium through Playwright on 2026-09-25 (seed 12345 unless noted).

- [x] A full day lasts 900 s (`CONFIG.dayLength`).
- [x] The world is 176 blocks tall. Sea level is y 128. Mean surface y is 134.8 (was 54.9): 2.45× deeper above bedrock. The spawn is at y 138.
- [x] Clouds fly at y 192. The shaft mask treats y > 180 as cloud. (Superseded 2026-10-02: the shaft mask reads the cloud density. See "Clouds".) The highest loaded terrain is y 173. The spawn and the menu panorama follow the new sea level.
- [x] Caves are larger: 21.7% of the underground is air (was 12.0%), 7,170 cave cells per chunk (was 1,503). Tunnels widen with depth. Giant caverns form at y 6–70.
- [x] Lava fills every cave cell at y ≤ 10 (566 cells per chunk). Lava glows (screenshot), emits light 15 (14, 13, 12 above it), deals 4 damage every 0.5 s ("tried to swim in lava"), and slows walking to 0.35× (4.32 to 1.51 m/s). An orange overlay shows with the head in lava.
- [x] Water and lava flow into open neighbour cells: down first, then sideways. A source on a platform gave levels 8, 7, 6 … 1 along a row, then 0: the flow reaches 7 cells past the source (8 cells including it). Water off the platform edge fell as a column.
- [x] A flow drains when its source goes: 112 flow cells to 0 in about 1.5 s.
- [x] Lava meets water: a lava source became obsidian. A lava flow became cobblestone.
- [x] Breaking stone beside a lava lake let lava flow into the gap (level 7).
- [x] Ores per chunk (median y): coal 162 (y 80), copper 88 (y 92), iron 106 (y 60), gold 26 (y 31), ruby 13 (y 21), diamond 9 (y 14). Before: coal and iron only, 20 and 11 veins per chunk.
- [x] Tool tiers: wood, stone, copper, steel, gold, ruby, and diamond, 28 tool recipes in the book. A Diamond Pickaxe crafted through the recipe book and a shift-click on the result. Durability rises from 59 (wood) to 1561 (diamond); gold is fastest (speed 12) and weakest (64).
- [x] Harvest rules (`canHarvest` table per tier): copper and iron ore need stone; gold and ruby ore need steel; diamond ore needs ruby; obsidian needs diamond (8.3 s).
- [x] Furnace: crafted from 8 cobblestone through the UI. It faces the player when placed. Shift-click put raw iron in the input and coal in the fuel slot. 2 steel ingots came out with the screen closed. Sand became glass. A left click took the output. A lit furnace glows at night and lights its neighbours (12, 11, 9). A full output of another item stops smelting.
- [x] Glass: placeable and see-through; faces between glass blocks are culled.
- [x] Chest: crafted from 8 planks. Doors and a pickaxe moved in by DOM clicks. Close (E), reopen: both stacks stayed. Shift-click moved the pickaxe out. Breaking the chest dropped its contents and its item.
- [x] Door: 6 planks made 3. Placing uses one door for two cells. Right click opens both halves; holding the button does not toggle again. The open door is not solid; the closed door is. It closed after 5 s. With the player in the doorway it stayed open for 6 s, then closed 1.2 s after the player left. Breaking the top half removed both halves and dropped one door.
- [x] Save: autosave after 30 s, on pause, and on page hide each wrote the save. A reload without a `seed` parameter restored the seed, position, view, inventory, block edits, homes, the time of day, and a furnace with its contents. The menu shows "Continue" and "Welcome back".
- [x] New World: a confirm dialog, then a new random seed; the `new` parameter is removed from the URL. The old world stays saved and reopens with `?seed=12345`.
- [x] Homes: H opens the list. Typing "h" in the name field does not close it. Set, Go (teleport with a fade and a toast), and Delete work, and each change saves. H and Esc close the screen. The 11th home is refused with a toast.
- [x] Chromium: 0 console errors and 0 warnings during the whole QA run. 60 fps.

## Batch 3: wall torches, torch light, keys

Observed in Chromium through Playwright on 2026-09-25 (seed 4242).

- [x] A torch placed on the side face of stone hangs on the wall (id 73, leans −X). A torch placed on the top face stands (id 14).
- [x] Wall torches on all four sides of a pillar render, lean away from the pillar, and show flames at their heads (screenshot at night).
- [x] The crosshair ray hits a wall torch. Breaking the pillar dropped the cobblestone and all 4 torches.
- [x] Wall torches survive a save and reload, and they emit light 15.
- [x] Torch light reaches farther: torches emit 15 (was 14), and block light uses 0.85 per level (was 0.83). Brightness 6 blocks from a torch is 0.32 (was 0.22); at 10 blocks it is 0.12 (was 0.07).
- [x] The I key opens and closes the inventory (real key presses). E does nothing.
- [x] Esc in the inventory, crafting table, furnace, chest, and homes screens returns to `playing`, not `paused`. The resume hint shows.
- [x] Esc while the resume hint shows opens the pause screen. A lock grant hides the hint. A canvas click without the lock does not mine.
- [x] The resume click takes the pointer lock in a real browser. (Joe, 2026-09-29, in his browser: "esc and resume work fine".)
- [x] Fix after Joe's report (Esc in menus still paused): the Esc lock request moved to the keyup. With a stub that grants every lock and ends it on an Esc keyup (the model of Joe's report), Esc from the inventory, chest, and homes screens returned to `playing` with the lock held. The lock request ran on `keyup`.
- [x] Esc on the pause screen resumes `playing` (stub: lock held). An Esc within 400 ms of the pause does not resume. A held Esc (repeat) does not pause again.
- [x] A refused lock after Esc shows the resume hint in `playing`. A canvas click then takes the lock.
- [x] Esc behavior in a real browser. (Joe, 2026-09-29: "esc and resume work fine". Chrome or Brave.)
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 3b: required pickaxe level

Observed in Chromium through Playwright on 2026-09-25 (seed 4242), holding the mouse button with the ore aimed.

- [x] Joe's report (ruby and diamond ore drop nothing): drops worked with the right pickaxe. A weaker pickaxe broke the ore and dropped nothing, silently.
- [x] Below the level, the ore does not break (progress 0, no crack), and a toast shows: hand on coal ore ("Needs a Wooden Pickaxe or better"), wooden on iron (Stone), copper on gold and ruby (Steel), golden on diamond (Ruby), ruby on obsidian (Diamond).
- [x] At the level, the ore breaks and drops: wooden on coal, stone on iron, steel on gold and ruby (2 rubies), ruby on diamond, diamond on obsidian (8.3 s).
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 4: flight on K

Observed in Chromium through Playwright on 2026-09-26 (seed 4242, pointer-lock stub).

- [x] A real K key press on the ground starts flight. After 1.5 s on the ground, flight is still on.
- [x] Space rises (y 136 to 142.8 in 1 s). Shift sinks to the ground, and flight stays on. Walking on the ground keeps flight on.
- [x] A double-tap of Space does not change flight.
- [x] A real K key press at y 144.9 ends flight. The player falls to y 136 and takes 6 damage (normal fall damage).
- [x] A save and reload restores flight.
- [x] The menu controls show "K: Start or stop flying". The Space row no longer mentions flight.
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 5: leaf decay, leaf colors, pickup range

Observed in Chromium through Playwright on 2026-09-27 (seed 4242, pointer-lock stub).

- [x] An isolated tree with its whole trunk removed loses all 50 natural leaves within 6 s. The leaves fall gradually (48, 37, 30, 24, 11, 0 at 1 s steps).
- [x] A placed leaf touching that canopy stays (id 84, placed pink).
- [x] A tree that keeps its top log keeps all 52 leaves.
- [x] Decaying leaves drop sticks (1 stick from 50 leaves; chance 1 in 20).
- [x] A creeper-size explosion in a canopy queues 164 leaves in 6.9 ms, and the unsupported ones decay.
- [x] Pause freezes decay. The queue saves (107 of 107) and resumes after a reload.
- [x] A leaf edit in an older save (id 11) loads as a placed green leaf (id 80).
- [x] Breaking a placed pink leaf drops the natural pink leaf item (id 78). Placing a natural item places the placed variant.
- [x] Generation over 28 × 28 chunks: forest and plains oaks grow green, red, orange, and brown leaves. Pink leaves grow only on plains oaks. Snowy plains and snowy mountains grow white leaves.
- [x] Tree shapes and positions do not change: colors use their own hash, and `NPink` is the last noise created.
- [x] Pink, orange, brown, and white trees render in the world. The six leaf items show correct icons, and the held item shows its color.
- [x] A drop 3 blocks away flies to the player. A drop 4 blocks away does not.
- [x] A Q throw lands 2.9 blocks away and stays while the player stands still. Walking to it picks it up.
- [x] Chromium: 0 console errors and 0 warnings.
- [x] Joe confirms the colors and the density of pink trees in plains in his own world. (Joe, 2026-10-01 11:24 CT: "F1-F5 are fine.")

## Batch 5b: denser pink groves

Observed in Chromium through Playwright on 2026-09-27 (seed 4242).

- [x] Pink leaves over 28 × 28 chunks rose from 161 to 5911 blocks. The tree chance ramps from 0.018 at the grove edge to 0.2 at its heart.
- [x] Old and new generators match on 736 of 784 chunks. All 48 changed chunks contain pink leaves, so only groves gained trees.
- [x] A grove renders as a dense cluster of pink oaks.
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 6: yellow leaves and forest mosaic

Observed in Chromium through Playwright on 2026-09-27 (seed 4242).

- [x] Yellow leaves generate (825 blocks over 28 × 28 chunks). The tile, item icon, and name ("Yellow Leaves") are correct.
- [x] A forest renders as a patchwork of green, yellow, orange, red, and brown oaks. Patches span several trees.
- [x] Tree shapes and positions match the old generator on 296 of 296 chunks. Only leaf colors changed.
- [x] Yellow leaves decay after nearby logs are removed (47 to 0). Leaves still connected to a neighbor trunk stay.
- [x] A placed yellow leaf becomes id 86, never decays, drops item 87 when broken, and survives a reload.
- [x] Chromium: 0 console errors and 0 warnings.
- [x] Joe confirms the forest mosaic in his own world. (Joe, 2026-10-01 11:24 CT: "F1-F5 are fine.")

## Batch 7: trash slot

Observed in Chromium through Playwright on 2026-09-27 (seed 4242).

- [x] The trash slot shows beside the hotbar on the inventory, crafting table, furnace, and chest screens.
- [x] A click with a held stack moves the stack into the trash. The slot turns red and shows the stack.
- [x] An empty-handed click (left or right) takes the stack back (undo, UI rule R8).
- [x] Trashing a second stack deletes the first.
- [x] Closing the screen (I or Esc) deletes the trashed stack. It does not return to the inventory or drop into the world.
- [x] Stacks from a chest and a furnace can be trashed and taken back.
- [x] The tooltip explains the slot in each state (empty, holding a stack over it, full).
- [x] The bin icon uses the slot-border gray (#373737) on the slot gray, about 3.5:1 contrast.
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 8: storage blocks

Observed in Chromium through Playwright on 2026-09-27 (seed 4242).

- [x] Six storage blocks exist: coal, copper, steel, gold, ruby, and diamond. Each is a placeable block item.
- [x] Nine items in the 3×3 crafting table grid craft one block (real clicks, gold).
- [x] One block in the 2×2 grid crafts back into nine items (real clicks, gold).
- [x] The recipe book lists both recipes for each block.
- [x] Each block has a distinct tile in the world and a distinct icon in the inventory and hotbar.
- [x] Each block needs the same pickaxe as its ore: coal wood, copper and steel stone, gold and ruby steel, diamond ruby.
- [x] A broken block drops itself.
- [x] Placed and broken blocks and the inventory survive a save and reload.
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 9: TNT, coal block fuel, crystal clusters

Observed in Chromium through Playwright on 2026-09-27 (seed 4242).

- [x] 5 gunpowder and 4 sand in the pattern GSG/SGS/GSG craft one TNT (real clicks on a crafting table).
- [x] The recipe book lists TNT.
- [x] TNT places from the hotbar and shows its side, top, and bottom tiles.
- [x] A right click on TNT lights it. The fuse lasts 4 s, the block flashes white, and sparks rise from the fuse.
- [x] A torch placed beside TNT lights it.
- [x] When the fuse ends, the TNT explodes and leaves a crater.
- [x] An explosion lights nearby TNT, which then explodes.
- [x] Breaking lit TNT defuses it: no explosion follows.
- [x] A TNT death shows "was blown up by TNT".
- [x] A save during a fuse reloads with the TNT in place and unlit.
- [x] A Block of Coal burns in a furnace for 400 s and smelts items.
- [x] Crystal clusters generate in caves on floors, ceilings, and walls, in patches.
- [x] Clusters render as 3D prisms with tips, glow, and light the cave turquoise (light 12).
- [x] A placed cluster grows away from the clicked face, for all 6 faces.
- [x] A pickaxe harvests a cluster, and the break drops a crystal item. A hand does not.
- [x] Removing the rock breaks every attached cluster, and each drops a crystal item.
- [x] Crystal light goes out when the cluster breaks.
- [x] Clusters and their light survive a save and reload.
- [x] The crystal item has an icon in the hotbar and inventory and a held model.
- [x] Chromium: 0 console errors and 0 warnings.

## Batch 10: rarer crystals, cobblestone and plank stairs

Observed in Chromium through Playwright on 2026-09-27 (seed 4242).

- [x] Crystals are a little rarer: 25.2 per chunk over 211 chunks (was about 34).
- [x] 6 cobblestone in a stair pattern craft 4 Cobblestone Stairs. 6 planks craft 4 Plank Stairs (real clicks on a crafting table).
- [x] Stair icons show a stair in the hotbar and inventory.
- [x] Straight stairs, outer corners, inner corners, and upside-down stairs render with the right shapes.
- [x] Stair faces and the faces beside them are lit. No face is black.
- [x] A stair roof blocks sky light below it. Removing the roof lets the light back in.
- [x] The selection outline follows the stair shape.
- [x] A placed stair faces the look direction. A click on a bottom face or on the upper half of a side face places it upside down. The stack count goes down.
- [x] The player walks up a staircase without a jump, and the camera eases each step. Walking down causes no damage.
- [x] A full block still needs a jump. The tall side of a stair blocks a walk.
- [x] Walking and jumping over natural terrain still works. The player never ends inside a block.
- [x] A pig walks up a staircase without a jump.
- [x] A drop rests on the step height it lands on (y + 0.5 or y + 1).
- [x] A ray passes through the empty quarter of a stair and hits the block behind.
- [x] Cobblestone stairs need a pickaxe. Plank stairs break by hand. A break drops the base stair item.
- [x] Plank stairs burn in a furnace for 15 s.
- [x] The held item and the drop show the stair model. The held stair shows its step toward the viewer.
- [x] Stairs survive a save and reload.
- [x] Chromium: 0 console errors.
- [x] The menu right-click hint names TNT. A stairs row reads "Face your view · click high or underside to flip". Every hint row fits one line (1200×824).

## Batch 11: world export and import

Scope: file export and import of the current world (O1). An import that meets an existing save for its seed asks first.
Observed in Chromium through Playwright on 2026-09-28 (seed 4242). Import used `setInputFiles` on the file input. The Import button opened the native file chooser. Messages were read from native dialogs once, then from stubs.

- [x] The menu shows Export World and Import World beside New World, in one row, in the same button style. The menu does not scroll at 1200×824.
- [x] Every menu button is at least 44 px tall, and the gaps between the row buttons are at least 12 px (ui-guidelines R3).
- [x] Export downloads `clonecraft-<seed>-<date>.json` with the current world: edits, player, inventory, chests and furnaces, homes, and time. The date is local.
- [x] Export at boot, before Continue, downloads the stored save. With no save, a message says there is nothing to export.
- [x] Import of a valid file for a seed with no save opens that world, with its edits, player position, and inventory.
- [x] Import of a file for a seed with a save asks first. Cancel keeps the old save and the current game. OK replaces the save and opens the world.
- [x] Import over the running world (same seed) is not overwritten by the page-hide autosave.
- [x] Import leaves the current world saved before the page changes.
- [x] Import rejects a file that is not JSON, a file with a wrong version, and a file with invalid fields (bad item or block ids, missing player). A message explains it, and nothing changes.
- [x] A full browser storage shows a message, and the current world stays.
- [x] An export and import round trip gives the same world (the save JSON matches, except the time fields).
- [x] Chromium (the engine of Brave and Chrome): 0 console errors.

## Batch 12: trash slot deletes after 3 s

Scope: a trashed stack is deleted 3 s after the trash click. The inventory no longer has to close first.
Observed in Chromium through Playwright on 2026-09-28 (seed 4242), with real clicks on the slots.

- [x] A stack put in the trash slot is deleted 3 s later while the screen stays open. The slot returns to the bin icon.
- [x] A white bar at the top of the trash slot drains over the 3 s.
- [x] A click with an empty hand before 3 s takes the stack back. The stack is not deleted later.
- [x] A second stack trashed before 3 s replaces the first (the first is gone) and restarts the 3 s and the bar.
- [x] Closing the screen before 3 s deletes the stack at once. Reopening shows an empty trash slot.
- [x] The tooltip says the stack is deleted after 3 s or when the screen closes.
- [x] The trash slot works the same on the inventory, crafting table, furnace, and chest screens.
- [x] A tool in the trash shows both the drain bar (top) and the durability bar (bottom).
- [x] Chromium: 0 console errors.

## Expansion (SPEC_expansion.md): shared gates

Scope: gates that span Batches 13–18.

- [x] A Batch 12 save loads with its world, inventory, chests, and homes. (A save written by the Batch 12 build passes `validSave`. The current build loads its mined hole at (21,133,-1), ruby 5 and cobblestone 40 in the inventory, 7 diamonds in the chest, and the home `b12home`. A screenshot shows the stacks.)
- [x] Every new screen and HUD element meets ui-guidelines: text ≥ 14 px, targets ≥ 44 px, gaps ≥ 12 px, contrast ≥ 4.5:1 (R2, R3). (Altar: slots 44 px with 12 px gaps, offers 300×44 px with 12 px gaps, text 14–16 px, offer text 6.8:1 and 4.9:1, note 6.4:1. Armor column: fixed from 40 px with no gap to 44 px with 12 px gaps. Compass: 15 px white text on a 60 % black backdrop, at least 5.9:1. The armor bar has no text. The pre-existing 36-slot grid stays at 40 px with no gap; it is not new, see Open in the report.)
- [x] Every delete confirms or offers Undo (R8). The trash slot covers the new items. (Real clicks: a compass goes to the trash, a click within 3 s takes it back, and it returns to its slot. Batches 13–18 add no other delete.)
- [x] Every new list shows an empty-state message when empty (R10). (The altar offers are the only new list. With no item the altar shows "Place a tool, armor piece, or bow in the top slot. Crystals go in the slot below it.")
- [x] Unsaved input survives a window resize on every new screen (R9). (The altar is the only new screen. At 800×600 it keeps its tool, 3 crystals, and 3 offers, and the layout fits. Back at 1200×824 the contents are the same.)
- [x] The id plan holds: no id collides, and `UNLOADED` (255) stays free. (A scan of ids 0–255: every `ITEMS[k].id` is k, every block item points at its own block, no non-block item sits on a block id, no duplicate names. Free ids: 200, 210, 220, 230, 240, 250–255.)
- [x] The atlas holds every new tile (≤ 256 tiles). (`tileCount` is 94 of the 256 tiles that the 256 px atlas of 16 px tiles holds.)
- [x] Owner review (Joe): combat feel with the new mobs. (Joe, 2026-10-01 11:24 CT: "F1-F5 are fine.")
- [x] Owner review (Joe): the look of the structures. (Joe, 2026-10-01 11:24 CT: "F1-F5 are fine.")
- [x] Owner review (Joe): the weather mood. (Joe, 2026-10-01 11:24 CT: "F1-F5 are fine.") Joe also saw patches of snow amid rain and of rain amid snow: "it looks a little funky".

## Slot grids at 44 px (Joe, 2026-09-28)

Scope: every slot grid on the inventory screens (backpack, inventory hotbar, 2×2 and 3×3 crafting, chest) and the furnace slots. The recipe book, the Homes screen, and the HUD hotbar are out of scope.

- [x] Every slot on the inventory, crafting table, furnace, chest, and altar screens is at least 44×44 px (R3). (A DOM scan of the visible slots on all 5 screens at 2 window sizes: the smallest slot is 44 px.)
- [x] Slots in each grid have 12 px gaps (R3). (The same scan: the smallest gap between neighbor slots is 12 px. The backpack-to-hotbar spacer was 10 px; it is now 12 px.)
- [x] Item icons and counts center in the larger slots on every screen. (Icons have a 5 px inset on each side. Screenshots of the inventory, table, furnace, and chest screens show centered icons and counts.)
- [x] Each screen fits in a 1200×824 window and in an 800×600 window. (All 10 panels lie inside the window. The recipe book ends at x 1176 of 1200.)
- [x] Clicks, shift-clicks, the trash slot, and crafting still work on the new grids. (Real clicks: 1 log in the 2×2 grid gives 4 planks, a shift-click moves planks to the backpack and a log into a chest, and a stack goes to the trash and comes back with Undo.)
- [x] Chromium: 0 console errors.

## Recipe book, Homes screen, and Recipes button (Joe, 2026-09-28)

Scope: F1 the recipe book, F2 the Homes screen, F3 the Recipes button. The `.hint` text (Homes hints, the seed line on the pause screen) moves to 14 px with them.

- [x] Recipe book: row text and counts are at least 14 px. Each row is at least 44 px tall, with 12 px between rows (R2, R3). (94 rows: text 14–15 px, the shortest row 67 px, the smallest gap 12 px. The icon cells stay 18 px; they are pictures inside the row target, not targets.)
- [x] Recipe book: a row click still fills the crafting grid, and the panel still fits beside the inventory in a 1200×824 window. (A real click on Planks puts 1 log in the grid. The panel ends at x 1176.)
- [x] Homes: all text is at least 14 px. Go, Delete, Set home here, and the name field are at least 44 px tall, with 12 px gaps (R2, R3). (Smallest text 14 px. Field 220×44, Set 161×44, Go 88×44, Delete 94×44. Gaps 12 px across, 14 px down; rows are 12 px apart.)
- [x] Homes: Delete asks for a confirm. A second click within 3 s deletes the home. Otherwise the button returns to Delete and the home stays (R8). (Real clicks: Delete turns red and reads Confirm; after 3.3 s it reads Delete and the home stays; Delete then Confirm removes it.)
- [x] Homes: the empty list shows "No homes yet." at 14 px (R10). A typed name survives a window resize (R9). ("mine entrance" stays in the field at 800×600.)
- [x] Recipes button: text is at least 14 px, and the button is at least 44 px tall (R2, R3). (83×44 px, 14 px text.)
- [x] Text contrast on the changed elements is at least 4.5:1 (R2). (Recipe text 6.2:1. Button 4.95:1; the shared hover blue was 3.4:1 and is now 5.6:1. The menu panel is now 80 % opaque, so #aaa text holds 4.97:1 even over a white sky. The name placeholder is now #9a9a9a, about 6:1. Screenshots over a bright sky confirm.)
- [x] Chromium: 0 console errors.

## Text at 14 px everywhere (Joe, 2026-09-28)

Scope: the F3 debug overlay, the pause-menu settings labels, and the loading-screen text. Rule R2: 14 px minimum text and 4.5:1 contrast.

- [x] A DOM scan of the menu, loading, and play states finds no visible text below 14 px. (0 hits in 6 states: loading, main menu, play with F3 details, inventory with the recipe book, Homes, pause.)
- [x] The debug overlay, settings labels, and loading text hold 4.5:1 contrast on their backgrounds. (Debug box 38 % to 60 % black: white text at least 5.9:1 over a white sky; a screenshot over a bright sky confirms. Settings labels are white on the menu panel. Loading text #bbb on the menu panel: at least 6:1.)
- [x] The pause menu still fits a 1200×824 window, and the debug overlay does not cover the compass or the hotbar. (The panel spans y 25–799 of 824. Its content scrolled inside the panel before this change too. Debug box x 6–543, y 6–249; the compass starts at x 1088.)
- [x] Chromium: 0 console errors.

## UI sweep (Joe, 2026-09-29)

Scope: every screen and the HUD. A scripted scan (`tools/uiscan.js`) checks target sizes, target gaps, and text contrast in each state.

- [x] The settings sliders are 44 px tall targets with 12 px between rows (R3). (They were 16 px tall with 10 px gaps.) (Superseded 2026-09-29: see "Compact pause menu".)
- [x] Item counts in slots and in the recipe book hold 4.5:1 contrast (R2). (White on the gray slot was 3.4:1, and on the recipe panel about 1.7:1. A 55 % black backing gives at least 4.7:1, even on white. A screenshot shows them clearly.)
- [x] The scan finds no size, gap, or contrast break on the loading screen, main menu, HUD, inventory with recipe book, crafting table, furnace, chest, altar, Homes, pause menu, and death screen. Known false positive: the gradient title text. (All 12 states clean.)
- [x] The pause menu scrolls to its bottom buttons in a 1200×824 window. (New World, Export World, and Import World sit at y 705–749 inside the panel at y 25–799.)
- [x] Chromium: 0 console errors.

## Graphics G1–G4 (SPEC_graphics.md, Joe, 2026-09-29)

Scope: the water surface, caustics, sun and moon light with shadows, and the held torch.

G1 Water surface
- [x] The water surface does not sample the atlas water tile. The tile still draws water icons and particles. (Code: the `WATER` branch of `TERRAIN_FS` has no `texture2D(map)`. The water tile stays in the atlas, and the icon and particle code is unchanged. The Water Bucket icon renders in the inventory.)
- [x] Waves move: two screenshots 1 s apart differ on the water surface. (Two clipped shots of the open sea 1 s apart differ.)
- [x] At a grazing view the water reflects the sky color more than at a steep view. (Shore and open-sea shots: the far water turns sky-blue; steep views show the floor.)
- [x] At noon, a sun glitter path shows on water toward the sun, and it blooms. At night a weak moon path shows. (Morning sun: a bright sparkling path with bloom. Low moon at t 0.545: a silver path.)
- [x] In rain the glitter is weaker than in clear weather. (`spec` scales by 1 − 0.85·`uWet`, and `uSunAmt` by 1 − 0.8·`weather.k`; with rain at k = 1 the direct light and shadows vanish in the rain shot.)
- [x] Far water does not shimmer: normal detail fades with distance. (Ripple octaves fade over 20–80 blocks; the far-sea shot is calm.)

G2 Caustics
- [x] Blocks under shallow sunlit water show moving caustics. (Underwater and top-down shots show the moving line network on the sand. Each nearby chunk has about 1,200 wet vertices.)
- [x] Caustics do not show on dry blocks below sea level, at night, or in covered water. (Only faces whose neighbour cell is water carry `WET_ALPHA`. The term needs `uSunAmt` > 0, sky light > 0.3, and the shadow test.)

G3 Sun and moon light, shadows
- [x] Trees, terrain, and a built wall cast shadows on the ground at noon. Leaves cast dappled shadows. (Test platform: the pillar, wall, and leaf cube cast shadows at Effects 2 and none at Effects 0. Leaf faces drop half their 4×4-texel cells in the pass.)
- [x] A mob casts a shadow that moves with it. (A cow casts a shadow west in the morning and east in the afternoon.)
- [x] Water, clouds, rain, and particles cast no shadows. (The pass hides water, transparent materials, points, lines, and sky ShaderMaterials. Caustics show under open water; no cloud shadows at noon.) (Changed 2026-10-02 by Joe: clouds now shade the ground through their own term, not the shadow pass. See "Clouds".)
- [x] Shadows move with the time of day (morning and afternoon screenshots differ in direction). (t 0.07: west. t 0.43: east.)
- [x] No shadow acne or light leaks on flat ground and on block edges at noon and at a low sun. (Platform and low-sun shots: clean ground and edges.)
- [x] Shadows fade out at the edge of the shadow box; no hard cut line. (Fade over the outer 20 % of the ±64-block box. A wide view at y 165 shows no cut line.)
- [x] Rain softens the direct light and the shadows. (Rain shot: no cast shadows, flat light.)
- [x] Effects 0 turns shadows off. Effects 1 and 2 turn them on. The labels read "Off", "Bloom + shadows", "Bloom + shafts + shadows". (Slider input 0/1/2 gives these labels; the Effects 0 shot has no shadows.) (Superseded 2026-09-29: see "Compact pause menu".)
- [x] Caves and covered areas get no direct sunlight. (Direct light needs baked sky light 9+ of 15 and the shadow test. The ground and water under the platform stay in shadow.)

G4 Held torch
- [x] Holding a torch lights the dark area around the player. Level 14 at the head, 1 less per block. (`levelAt`: 14 at the head, 11 three steps away, 2 at twelve steps. Night shot: the wall and grass are lit.)
- [x] The light does not pass through an opaque wall. (Behind the 3-high wall the level is 5, the 9-step path over it; a straight line would give about 10.)
- [x] Switching to another slot turns the light off at once. Switching back turns it on. (Off: `on` false and level 0. On again: 14 at the head.)
- [x] Walking moves the light with the player. (A fixed cell went from 7 to 11 after a 4-block move.)
- [x] Placing or breaking a block near the player updates the light. (Placing stone: 12 to 10 behind it. Breaking it: back to 12.)
- [x] A mob and a drop near the player get brighter. The held item gets brighter. (Cow brightness 0.522 with the torch, 0.129 without. Drops and the held item use the same `brightnessAt`; the held torch shows bright in the night shots.)
- [x] Water near the player gets the light. (Level 10 in the water cell. Top-down night shot: warm light and torch glints on the waves.)

Shared
- [x] At 1200×824, default settings, the frame rate stays at or above 50 fps (F3), at noon on land and at the shore. (Steady readings: 60, 60, 60, 60 on land and at the shore. Right after a teleport it dips to 40–48 while chunks load.)
- [x] Chromium: 0 console errors. (0 errors across all runs.)
- [x] Owner review (Joe): the look of the water, the shadows, and the held torch. (Joe, 2026-09-29: "looks great". Open follow-ups: the water costs too much frame rate on his MacBook, and he wants softer shadows.)

## Graphics performance P1–P3 (Joe, 2026-09-29)

Scope: the water and shadow shader cost on Joe's M1 MacBook Air (the build machine). Joe: "water effects are a pretty big hit on performance"; "I'd like softer shadows".

- [x] Baseline and after-change frame rates are measured at Joe's render size (about 2160×1350) at the same shore view and land view, with Effects 2. (A/B on this M1 Air: the pre-change build served as a copy, same views, Effects 2, at 2160×1350 and at a 3240×2025 stress size. At 2160×1350 both builds hold the 60 fps cap.)
- [x] Near water, the frame rate after P1 is clearly higher than the baseline. (3240×2025: shore 54.2 → 60 fps, 90th-percentile frame 31.7 → 17.6 ms; underwater 50.8 → 60 fps, 33.3 → 17.5 ms. The 60 fps cap hides any further headroom.)
- [x] Caustics read from a pattern baked once at startup. They still move, fade with depth, and show only on wet faces. (`bakeWaterPatterns` builds a 256² wrapped Voronoi-edge texture; two scrolled reads, combined by min. Shots: a moving net on the sand, none in the platform's shadow.)
- [x] Waves still move and glitter. No visible tiling in the ripples at normal view distances. (Four sines plus two scrolled reads of a baked slope map with whole-number wave vectors. Glitter and top-down shots show no tiling.)
- [x] Shadow edges are softer than before (wider penumbra), with no acne and no light leaks at block edges. (Pillar, wall, and leaf shadows have wide smooth edges; the ground is clean.)
- [x] The shadow lookup makes 4 or fewer texture reads per pixel (hardware-filtered comparison). (`sampler2DShadow` with `LessEqualCompare` and linear filtering: 4 reads on terrain, 1 on water; was 9 on both.)
- [x] The frame rate on land after P2 is equal to or higher than the baseline. (Land: 60 fps before and after at both sizes.)
- [x] Chromium: 0 console errors. (0 errors and 0 warnings, including Effects 0. A first run showed 196 WebGL sampler warnings; `shadows.render` now clears the target once on the first frame.)

## Caustics at night and in deep water (Joe, 2026-09-29)

Joe: "unnaturally noticeable at night and doesn't seem to fade out as water gets deeper".

- [x] At night the sea floor shows no caustics. (At 22:49 `game.daylight` is 0.27, so the daylight gate is 0. The night shot over the 2-deep spot shows no net.)
- [x] Caustics are strong in 1–2 blocks of water, weaker at 4–5, and gone by 7. (Sky light drops 1 per water block. The depth factor is 0.87 at 2 deep, 0.53 at 4, 0.33 at 5, 0.02 at 7. Shots at (9,20) 2 deep, (0,36) 5 deep, and (-8,42) 8 deep show a bright net, a faint net, and none.)
- [x] Caustics scale the floor's own light (no added light on a dark floor). (`sky *= 1.0 + caus`; the old `+ caus` term on `light` is gone.)
- [x] Chromium: 0 console errors and 0 warnings.

## Caustic layers move apart (Joe, 2026-09-29)

Joe: "they do seem to move as one currently. can we make that more pronounced?"

- [x] The caustic net changes shape in place. It does not slide across the floor as one rigid pattern. (See the measure below: the best match sits at shift (0,0) and drops by half.)
- [x] Measured: frames 1 s apart match worse at their best shift than in the old build. (Water hidden; each frame minus a frame with a black caustic texture. Frames 1.1 s apart: old 0.61 and 0.60, new 0.29 and 0.32. Caustic strength is equal: std 10.3 in both.)
- [x] The net still reads as thin bright lines, not blur or noise. (Sine-warp build, Mac, underwater at (9.5,129.2,23.5): a thin, bent net on the sand; two shots 0.7 s apart show different line shapes.)
- [x] No regression: no caustics at night, and the depth fade still holds. (Caustic-only brightness added, p99 of 255: 46 at 2 deep, 4 at 5 deep, 0 at 8 deep, 0 at night.)
- [x] Frame rate over shallow water at 3240×2025 stays at 60 fps at Effects 0, 1, and 2. At Effects 3, showing the water costs no measurable frame rate. (Joe reworded this item on 2026-10-01 21:58 CT (O1). The old text was "stays at 60 fps" at every setting. The 15:44 CT rerun below meets the new text: 60 fps at Effects 0, 1, and 2, and water shown against hidden at Effects 3 is 54.9 against 54.8 fps.) (History: looking down at 2-deep water: old build 47.1 and 47.0 fps, new build 45.9 and 45.4. The old build also misses 60 at this view; the warp costs about 1.5 fps. Shore view: 57.3 fps. Not met. Joe accepted the cost on 2026-09-29 14:24 CT: "It's fine as is." Clean rerun 2026-10-01 15:44 CT, quiet Mac, same view, settings cycled in one page: Effects 3 57.8 fps, Effects 0, 1, and 2 60 fps. Water shown against hidden, interleaved 4 times: 54.9 against 54.8 fps, GPU frame time equal within 0.3 ms. The water costs nothing measurable; the shortfall comes from shadows and bloom together.)
- [x] Chromium: 0 console errors and 0 warnings. (Mac, sine-warp build, across the depth, night, and fps runs.)
- [x] The page loads on Joe's Nvidia laptop. (Joe, 2026-09-29 16:05 CT: the current build, with the sine warp and the sun fix, works.)
- [x] The page loads on Joe's Intel Arc machine. (Joe, 14:12 CT: `index.html` and all 4 bisect builds load once the files are copied on his home network. The earlier hangs came from the file copies, not the shader.)

## Squished sun and racing caustics (Joe, 2026-09-29)

Joe: "the sun and moon occasionally become squished, and when that happens caustics move faster than normal".

- [x] The sun, moon, and halo face the camera at every player position and time of day (tilt under 2°). (6 positions up to (40000,-30000) × 8 times: max tilt 0° for all three. Old build: up to 156°.)
- [x] Far from the origin (x 1000, z 1500, x -2500 z 2500) the sun disc is round in a screenshot. (Shot at (0,160,1500), mid-morning: old build a narrow upright oval, new build round. The other positions have 0° tilt by the measure above.)
- [x] Caustics do not race as the sun moves: with the day running, frames 1.1 s apart at mid-morning shift under 0.3 blocks. (Caustic-only frames, day running: old best match 0.16 at a 24 px shift; new 0.33 at shift (0,0), the same as with the sun frozen.)
- [x] Caustics still show under shallow water, fade with depth, and stay off at night. (Added brightness, p99 of 255: 46 at 2 deep, 4 at 5 deep, 0 at 8 deep, 0 at night.)
- [x] Chromium: 0 console errors and 0 warnings.

## Found in the sweep (2026-09-29)

- [x] Blocks built above the generated terrain height still show after a reload. (A platform at y 150: before the fix the chunk mesh stopped at y 129–138 after a reload; after it the mesh reaches y 154 and the platform shows.)

## Batch 13: farming and renewables (O4)

Scope: saplings, apples, seeds, hoes, farmland, wheat, bread, bone meal, buckets, and the golden apple item.

- [x] Each of the 7 leaf colors drops its own sapling (about 1 in 16) on break and on decay.
- [x] A sapling places on grass or dirt only. It breaks when its ground goes and drops itself.
- [x] A sapling grows the tree of its color after 60–180 s. A white sapling grows a spruce. A sapling with no room waits.
- [x] An oak leaf drops an apple about 1 in 60. An apple heals 4 HP.
- [x] Tall grass drops seeds about 1 in 8.
- [x] Hoes craft in all 7 tiers. A hoe turns grass or dirt with air above into farmland and loses 1 durability.
- [x] Farmland is 15/16 tall. It is wet (darker) with water within 4 blocks. Dry farmland with no crop turns to dirt in about 60 s. A jump onto farmland turns it to dirt.
- [x] Seeds plant on farmland only. Wheat grows through 4 stages, faster on wet farmland.
- [x] A ripe crop drops 1 wheat and 1–3 seeds. An unripe crop drops 1 seed. A crop breaks when its farmland goes.
- [x] 3 wheat craft 1 bread. Bread heals 5 HP.
- [x] 1 bone crafts 3 bone meal. Bone meal advances a sapling or a crop one stage, with green particles, and is consumed.
- [x] A bucket picks up a water or lava source. A full bucket places a source and returns the empty bucket. Flowing liquid cannot be picked up.
- [x] A lava bucket burns 1000 s in a furnace and leaves a bucket.
- [x] The golden apple heals 10 HP and regenerates 1 HP per s for 20 s.
- [x] Crops, saplings, and farmland survive a save and reload.
- [x] Chromium: 0 console errors.

## Batch 14: armor, bow, arrows, and mobs (O1)

Scope: 24 armor pieces, armor slots and bar, the bow and arrows, flint, and the skeleton, spider, and Magma Brute.

- [x] All 24 armor pieces craft with vanilla shapes and show their own icons.
- [x] The inventory shows 4 armor slots. A slot accepts only its piece. Right click and shift-click equip a piece.
- [x] The HUD armor bar shows the total points (2 per icon) above the hearts and hides at 0.
- [x] Armor reduces mob, arrow, explosion, and lightning damage by 4% per point, capped at 80%. Falls and lava ignore armor.
- [x] A hit costs each worn piece 1 durability. A piece breaks at 0 with a sound.
- [x] Armor slots survive a save and reload, and a death drops them.
- [x] Gravel drops flint about 1 in 10. Flint, stick, and feather craft 4 arrows. 3 sticks and 3 string craft a bow.
- [x] Holding right click charges the bow up to 1 s, and the view model pulls back. Release fires an arrow and uses one. With no arrows, nothing fires.
- [x] An arrow flies with gravity, damages a mob (2–9 by charge), and sticks in a block. The player picks up an own stuck arrow. The arrow disappears after 30 s.
- [x] A skeleton keeps 6–12 blocks away and shoots every 2 s with line of sight. Its arrow deals 3 before armor. It burns in daylight.
- [x] A spider climbs walls, leaps at the player, and bites for 2. In bright light it stays neutral until hit.
- [x] A Magma Brute spawns only in caves below y 40. It glows, walks in lava unhurt, resists knockback, and hits for 7. It drops a Magma Core.
- [x] Surface spawns mix zombies, skeletons, creepers, and spiders.
- [x] Mob drops: skeleton bones and arrows, spider string, Magma Brute core and coal.
- [x] Chromium: 0 console errors.

## Batch 15: enchanting (O3)

Scope: the altar block, the altar screen, 7 enchantments, and the `ench` stack field.

- [x] The altar crafts from 4 obsidian, 2 diamonds, 2 crystals, and 1 Magma Core. It emits light.
- [x] A right click opens the altar screen with a tool slot, a crystal slot, and 3 offers. Esc and I close it and return the items.
- [x] Offers fit the item: no Sharpness on a pickaxe, no Fortune on a sword, armor gets Protection.
- [x] An offer the player cannot pay shows as disabled. A paid offer spends crystals and adds the enchantment.
- [x] Offers change after each enchant. The same item before an enchant shows the same offers.
- [x] Each enchantment works: Efficiency speed, Fortune extra ore drops, Sharpness damage, Unbreaking skips, Protection points, Power damage, and Feather Falling.
- [x] An enchanted icon shimmers purple. The tooltip lists each enchantment and level.
- [x] `ench` survives the inventory, a drop and pickup, a chest, the trash undo, a save and reload, and an export and import.
- [x] Enchanted stacks do not merge with plain stacks.
- [x] The altar screen meets ui-guidelines (44 px offers, 12 px gaps, readable text).
- [x] Chromium: 0 console errors.

## Batch 16: travel (O6)

Scope: boats, rails, minecarts, and the compass.

- [x] A boat crafts from 5 planks and places on water only.
- [x] Right click enters the boat. W/S move, A/D turn, and Shift exits onto a free block. The boat is fast on water and slow on land.
- [x] Two hits break a boat, and it drops as an item.
- [x] 6 steel and 1 stick craft 16 rails. A rail needs a block below and breaks without one.
- [x] Rails connect straight, curve at corners, and slope up one block. Neighbour rails re-shape when a rail joins.
- [x] A minecart crafts from 5 steel and places on a rail only.
- [x] In a cart, W pushes, S brakes, slopes accelerate, curves turn the cart, and the cart stops at a rail end. Shift exits.
- [x] Two hits break a cart, and it drops as an item.
- [x] Boats and carts survive a save and reload. A rider is out of the vehicle after a reload.
- [x] The compass crafts from 4 steel and 1 crystal. While held, the HUD dial points to the spawn and shows the distance.
- [x] Chromium: 0 console errors.

## Batch 17: structures and loot (O2)

Scope: dungeons, desert temples, ruined towers, mineshafts, spawners, cobwebs, loot chests, and the new building blocks.

- [x] Dungeons generate underground with cobblestone, mossy cobblestone, a spawner, and 1–2 chests.
- [x] Desert temples generate on desert ground with 4 chests. A step onto the trap lights the TNT below it.
- [x] Ruined towers generate with stone, mossy, and cracked bricks and a top chest.
- [x] Mineshafts generate corridors with supports, rails, cobwebs, and chests.
- [x] The same seed gives the same structures and the same loot.
- [x] A generated chest fills on first open, first break, or explosion, and never fills twice.
- [x] A spawner spawns its mob type near a player within 16 blocks in the dark. A torch beside it stops it. Mining it drops nothing.
- [x] A cobweb slows movement. A sword breaks it fast and drops string.
- [x] Mossy cobblestone, stone bricks, mossy and cracked bricks, sandstone, and chiseled sandstone mine and place. Stone crafts stone bricks and sand crafts sandstone.
- [x] Structures never cut through another chunk's blocks (no seams at chunk borders).
- [x] A player can walk into and out of every temple hall, and up to every tower's top chest, without digging (Node walk check: 19 of 19 temples, 24 of 24 towers; in Chromium: a walk in and out of a temple door).
- [x] Chromium: 0 console errors.

## Batch 18: weather (O5)

Scope: rain, snow, thunderstorms, and lightning.

- [x] The weather cycles between clear and rain. About 1 rain in 3 is a storm. (3000 draws: 32.7 % storms; wet 120–360 s, clear 300–900 s. A 2 s rain ends and fades in real time.)
- [x] Rain falls in rainy biomes. Snow falls in snowy biomes and above the snow line. Deserts stay dry. (Particle audit: plains 1813 rain, desert 0 drops, snowy plains 770 flakes; 8 samples with 0 drops of the wrong kind.)
- [x] No precipitation falls under a roof or in a cave. (0 drops below their column top in every audit; 0 drops under a built 5×5 roof.)
- [x] Rain and storms darken the daylight and the clouds and shorten the fog. (Noon daylight 1 → 0.75 rain → 0.55 storm; fog 66/120 → 46/84; screenshots.)
- [x] A rain loop plays under open sky and fades under a roof. (Gain 0.22 open, 0.04 roofed, 0.34 storm, 0 paused.)
- [x] Lightning draws a bolt and a flash. Thunder follows with a delay. A bolt within 3 blocks deals 5 damage before armor. (Screenshot; thunder delay 0.03 s at 1 block, 1.19 s at 40; health 20 → 15, 16.6 with a diamond chestplate; a zombie loses 5. Storm strikes 8.7–18.5 s apart.)
- [x] Zombies and skeletons do not burn in rain. (A zombie on a wet column at noon, sky 15, keeps 20 hp; it burns after the rain clears. On a dry desert column it burns in rain, as intended.)
- [x] The weather survives a save and reload. (A storm with 250 s left reloads as a storm with 246 s left. `validSave` rejects an unknown kind, a negative time, and null; it accepts a save without `weather`.)
- [x] `clonecraft.weather.set(kind, seconds)` changes the weather.
- [x] Chromium: 0 console errors.

## Time controls and moonlight (Joe, 2026-09-29 18:14 CT)

- [x] The pause menu has a "Time of day" slider. Moving it changes the sky and light at once. (12 → dayTime 0.25, "12:00"; 0 → 0.75, "00:00".)
- [x] The slider shows the current time each time the menu opens. (After 3 s of play from 00:00 it reads "00:04".)
- [x] The new time saves with the world and survives a reload. (Save dayTime 0.75; reload reads "00:00".)
- [x] "Freeze time" stops the clock while playing. Clearing it starts the clock again. (Frozen: 0.25 → 0.25 over 3 s. Cleared: 3.0 game-seconds per 3 s.)
- [x] "Freeze time" survives a reload. (`clonecraft.settings.freezeTime` true; the box is checked after reload.)
- [x] The freeze checkbox has a 44 px hit area; a click beside the box toggles it (R3). (Label 44×44; box 22×22; Playwright click on the label center.) (Superseded 2026-09-29: see "Compact pause menu".)
- [x] Moonlight is a little brighter. (Same view at midnight, open ground: mean 6.1 → 7.2, p90 9.3 → 11.7.)
- [x] Hostile mobs still spawn in the open at night: round(15 × 0.3) = 5, at or below 7. Caustics stay off at night: 0.3 is below the 0.35 gate.
- [x] Chromium: 0 console errors, 0 warnings.

## Ladders, climbable leaves, taller trees (Joe, 2026-09-29 18:57 CT)

Joe chose: leaves act like a ladder for the player only; all worlds get taller trees; ladders are 3D (19:02 CT).

- [x] 7 sticks in an H craft 3 ladders. (`matchRecipe` on the 3×3 grid returns out 250, count 3.)
- [x] A right click on a wall side face places a ladder that faces away from the wall. (Target face 4 on stone; cell holds id 251; the held count drops 16 → 15.)
- [x] The ladder is 3D: two rails 3/16 deep and four inset rungs. The hotbar icon and the held model show it. (Screenshot.)
- [x] Breaking the wall behind a ladder drops that ladder; the ladders above and below stay. (Wall at y 164 broken: ladder cell → air, 2 drops, 163 and 165 keep id 251.)
- [x] On a ladder: Space climbs, Shift climbs down, no key holds, and W into the wall climbs. (Space 2.77 blocks in 1 s; Shift −1.57 in 0.6 s; hold 0.000 over 1.5 s; W 1.87 in 0.8 s.)
- [x] The player walks through leaves at about 60 % speed. (2.1 blocks in 1 s from a stop; target 2.59/s.)
- [x] The top leaf of a canopy holds a walking or jumping player. (Stands at y 154 on a 4-high cube; a jump lands back at 154.)
- [x] Shift on a canopy top sinks into it; releasing Shift holds. (152.12 after 0.7 s; drift −0.006 over 1 s.)
- [x] A fall into a canopy is caught with no damage. (21-block fall: stops at 153.31 inside the top leaf; health 20. Before the fix: 17 damage.)
- [x] Space inside leaves climbs out and stands on top. (y 151 → 154, on ground.)
- [x] On a real tree, holding Space by the trunk reaches the canopy and climbs to the top. (6-log oak: rise 7, health 20.)
- [x] Mobs, drops, vehicles, and arrows still collide with leaves. (A zombie dropped on the canopy stays at y 154. Drops, vehicles, and mobs call `moveEntity` without `passLeaves`; arrows read `SOLID`.)
- [x] Oak, spruce, and jungle trunks grow 1–2 blocks taller; positions do not change. (169 chunks of seed 4242: 18 trunks at the same positions (same hash) in both builds; mean trunk 4.78 → 6.17. Screenshot: crowns move up with the trunk.)
- [x] Ladders survive a save and reload. (Cell id 251 and 16 held ladders after reload.)
- [x] Chromium: 0 console errors, 0 warnings.

## Compact pause menu (Joe, 2026-09-29 20:04 CT)

Joe: the settings can be closer together; ui-guidelines do not apply strictly here (they were written for Android). Joe chose the split: "Shadows" and "Bloom + shafts", each on its own.

- [x] The settings rows are closer together. (Rows 30 px apart, was 56 px. The grid is 206 px tall. Text stays 14 px. Screenshot at 1280×800 shows all rows and the buttons.)
- [x] Effects is two check boxes: "Shadows" and "Bloom + shafts". A click on the box or its text toggles it. (Playwright clicks on the "Shadows" text and on each box.)
- [x] Each box works on its own. (Draw calls in one view: both 673, shadows only 663, bloom only 259, neither 248. Screenshots of shadows only and bloom only render correctly.)
- [x] Both boxes save to `clonecraft.settings` and survive a reload. (Shadows off, bloom on; reload shows the same boxes and `CONFIG` values.)
- [x] An old save with `effects: 2` loads as both boxes on. (The Playwright profile held `effects: 2`; the first load showed both checked.)
- [x] `fx=N` sets the boxes as a bit mask. (`fx=2` gives shadows off, bloom on.)
- [x] Chromium: 0 console errors, 0 warnings.

## Temple trap warning (Joe, 2026-09-29 22:52 CT)

Joe chose: the warning plays near the trap, before it fires.

- [x] A warning sound plays when the player comes near a set trap: within 3 blocks of the plate, from the plate level up to the top of the shaft. (Seed 4242 temple, plate (-105, 119, -41): 2 blocks from the shaft at hall level gives 1 call; 3 blocks from the plate in the chest room gives 1 call.)
- [x] The sound is audible and distinct: a rattle over a low falling tone. (An analyser on the master output reads a 0.18 peak after a call.)
- [x] It plays once per approach, not on every scan. (Standing 1.5 s more gives no new call. 5 blocks out resets it; coming back gives 1 new call.)
- [x] No warning far from a trap. (20 blocks out: 0 calls.)
- [x] No warning when the plate is gone. (Plate mined: `trapNear` false. Restored: true.)
- [x] Coming near does not fire the trap. (In the room for 5 s: the TNT stays unlit, health 20.)
- [x] Chromium: 0 console errors, 0 warnings.


## Snow line by height (Joe, 2026-10-01 11:27 CT)

Joe saw snow patches amid rain and rain amid snow. Joe chose O1: the drop's height decides the kind, not the column.

- [x] Outside snowy biomes and deserts, snow falls only at or above y 159 (`SNOW_LINE` + 1). Rain falls only at or below it. This holds in every column. (Storm on a rocky highlands slope at (-74, 51), camera at y 175, 162, 152, and 145, 10 frames each: about 80,000 rain drops and 39,000 zone-1 flakes. 0 rain drops above y 159 and 0 flakes below it.)
- [x] On a slope across y 159, columns with ground above the line get snow, and columns with ground below get rain. No column breaks the rule because of its own height or a treetop. (Same run: 0 rain drops in a column whose top block reaches y 159. `precip` gives snow at (-88, 44), top 160, and rain at (-88, 51), top 149.)
- [x] Near the line, snow falls from above and turns to rain at y 159. (About 410–460 columns per height held both snow above y 159 and rain below it. The screenshot from y 162 shows flakes on the ridge and rain streaks in the valley.)
- [x] Snowy biomes still get snow at every height. Deserts stay dry. (Snowy mountains at (-66, 99), top 172: 997 flakes, 0 rain. Snowy plains at (116, 257), top 135: 1,096 flakes, 1,084 of them below y 159, 0 rain. Desert at (-436, -355): 0 drops in desert columns, `wetAt` false, rain gain 0.)
- [x] The rain sound plays where rain lands on the player's column, and not where snow lands. (`rainGain` 0 on the column with top 160, 0.338 on the column with top 149, then 0.002 and falling 3 s after the return to top 160.)
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0. (0 errors and 0 warnings for the whole game session. `npm run check` exit 0, 29 tests.)

## Fireflies (Joe, 2026-10-01 21:38 CT)

Joe asked for fireflies that come out at dusk in grassy and wooded areas. rsh picked the details below.

- [x] Fireflies show only over grass blocks in the plains, forest, and rainforest biomes. No firefly shows in any other biome, over water, over sand, or in a cave. (Independent audit, 209,785 firefly samples over 300 frames each in forest (-56, -88), plains (-8, -40), rainforest (-152, -8), a desert edge (-436, -355), and a snowy-mountain edge (116, 257): 0 samples over a column outside plains, forest, and rainforest. Every sample stands over a grass block. Near the desert and the snowy mountains, every firefly stays on the grassy side.)
- [x] Under trees, fireflies hover below the canopy, over the grass. No firefly is inside a solid block, a leaf block, or a liquid. (Same audit: 68,528 samples had a block above them. 0 samples inside a solid block, a leaf block, or a liquid. Some samples hover over a low bush or branch; the grass block lies under it, within 3.5 blocks. Rainforest screenshot at 20:52: fireflies between trunks under the canopy.)
- [x] Each firefly hovers 0.3 to 3.5 blocks above its grass block and drifts slowly around its home point. (Same audit: height above the grass block 0.30 to 3.50. Each firefly eases toward a new point within 2 blocks of home every 1.5–4 s, with a small wobble. Every move is checked against the ground of the new column.)
- [x] Fireflies are absent by day. They fade in at dusk (from about 17:46 to 18:23), stay through the night, and fade out at dawn (from about 05:37 to 06:14). (Sweep, level and count: 12:00 0.00 / 0; 17:45 0.00 / 0; 18:00 0.32; 18:12 0.79; 18:24 1.00; 21:00, 00:00, 03:00, 05:30 1.00; 05:39 0.99; 06:00 0.32; 06:15 0.00 / 0; 07:00 0.00 / 0. Dusk screenshot at 18:15 in the plains: fireflies with halos over the grass.)
- [x] Each firefly blinks on its own rhythm: a short bright flash with a bloom halo, then a faint glow. Neighbours do not blink in step. (Each firefly has a random phase and a period of 2.2–5.2 s; the flash is the first quarter of the period. Over 240 frames, the share of fireflies above half of peak brightness stayed between 11 % and 21 %. Screenshots show a few bright flashes among faint glows.)
- [x] Fireflies fade out in rain and storms and come back when the weather clears. (Rain after 7 s: weather k 1.00, level 0.00, not drawn. Storm: level 0.00. Clear after 3 s: k 0.50, level 0.50, 140 shown. After 7 s: level 1.00.)
- [x] A firefly lives for a while, fades out, and comes back at a new spot near the camera. Fireflies follow the player into new grassy areas and do not show in non-grassy areas the player walks into. (Life is 15–40 s with a 1.5 s fade in and out. After a teleport to the rainforest, all 140 fireflies were within 33 blocks of the new spot within 0.4 s. 0 fireflies outside the home biomes at the desert and snowy edges.)
- [x] Lifecycle: the pause menu freezes the fireflies. A time change in the pause menu (night to noon, noon to night) shows or hides them within the fade. With the head under water, no firefly draws. Save and load keep working; the save holds no firefly state. (Paused 1 s: the firefly list did not change. The pause-menu slider at 12:00: level 0, not drawn. At 21:59: level 1, drawn. After resume: 140 shown, moving again. Head under water at (14, 125, -16): not drawn; back on land: drawn. The save keys are v, seed, dayTime, clock, player, inv, armor, edits, te, homes, liquids, leaves, farm, enchantSeed, vehicles, looted, weather. No firefly key. A reload restored 20:52 at (-7, 137, -39), and 140 fireflies showed.)
- [x] The firefly update costs under 0.3 ms per frame (in-page timer, full pool). (600 updates with the full pool of 140: 0.016 ms each. With every firefly respawning after a 200-block camera jump: 0.02 ms at most.)
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0. (0 errors and 0 warnings for the whole session. `npm run check` exit 0, 29 tests.)

## Render scale (Joe, 2026-10-01 22:00 CT)

Joe asked for a render scale slider: fewer pixels drawn in a full-size window. rsh picked the details below.

- [x] The pause menu has a "Render scale" slider from 50 % to 100 % in 5 % steps, below "Effects". It shows its value as a percent and matches the other sliders in look and layout. (Slider min 0.5, max 1, step 0.05; labels 50%, 55%, 75%, 100%. Screenshot: same row grid, track, and value column as "Volume". The menu panel already scrolled at 846 px high; the new row adds one row to the scroll.)
- [x] The slider scales the drawing buffer: width and height equal the window size × min(device pixel ratio, 1.5) × scale, rounded down. The canvas still fills the window. (1680×846 window, device pixel ratio 2: 50 % 1260×634, 55 % 1386×697, 75 % 1890×951, 100 % 2520×1269, each equal to the formula. Canvas CSS size 1680×846 at every scale.)
- [x] A slider change applies at once, while paused. The bloom, light shaft, and scene targets resize with it. No stretch, offset, or black band shows. (All buffer sizes above were read 300 ms after the change, in the paused state. The slider fires the window resize handler, which calls `post.resize()`. Screenshot at 50 %: the forest view fills the window with no offset or band; the HUD lines up.)
- [x] A window resize keeps the chosen scale. (At 50 %, a resize to 1400×800 at device pixel ratio 1 gave a 700×400 buffer and pixel ratio 0.5.)
- [x] The value saves in `clonecraft.settings` and survives a reload. A missing or bad value falls back to 100 %. (Every slider change wrote `renderScale` to `clonecraft.settings`. Reload at 75 %: slider 0.75, label 75%, buffer 2430×1518 in a 3240×2025 window. Stored 3, stored "x", and no key: each reload gave 100 % and a 3240×2025 buffer.)
- [x] Stars, fireflies, and other point sprites keep the same size on screen at every scale. (Three.js multiplies point size by the pixel ratio, and the star shader reads `renderer.getPixelRatio()` every frame. Night screenshots at 22:19 at 100 % and 50 %: stars and distant fireflies show at the same size; 140 fireflies shown in both.)
- [x] At Effects 3 (shadows and bloom) and 3240×2025, scale 75 % raises the frame rate over shallow water above the 100 % rate. (Measured in one page, interleaved.) (Seed 12345, flying 4 blocks above 2-deep water at (-7, -2), looking down, 12:00, device pixel ratio 1. Three rounds of 5 s each: 100 % 49.3, 49.3, 49.5 fps; 75 % 60.1, 60.1, 60.1 fps, at the 60 fps cap. Screenshot at 75 %: shallow water with caustics.)
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0. (0 errors and 0 warnings across the session. `npm run check` exit 0, 29 tests, `index.html` equals a fresh build.)

## Clouds (Joe, 2026-10-02 12:46 CT)

Joe asked for more realistic clouds than the Minecraft style and chose option O1 (a soft shader layer) with cloud shadows. Spec: `SPEC_graphics.md` G5. rsh picked the details below.

- [x] The blocky clouds are gone. One soft layer at y 192 shows clouds of varied shape and size with soft, wispy edges and gaps of open sky. (2026-10-02, seed 12345: noon view from the ground after the last shading change shows soft clouds of varied size, wispy edges, open gaps. Squared densities in `sunlit` removed bright rings on small puffs.)
- [x] Clouds drift along +x and change shape slowly. They stay fixed in the world: a player who walks or flies does not drag them along. (`clouds.densityAt` profile along x before and after 10 s of wind: best match at a 17-block shift toward +x, with a residual, so the shapes also change. Straight-up view from x 0.5 and x 30.5: a cloud at the left edge moves off screen, so the layer stays fixed in the world.)
- [x] Lighting: thick parts are darker underneath. Thin edges near the sun glow. Dusk tints the clouds warm. At night they are dark grey and faintly lit. (Re-shot after the shading change: noon grey bases and bright thin edges; dusk warm tint; night dark grey, faintly lit.)
- [x] Weather: rain thickens the layer toward overcast and greys it. A storm darkens it more. Clear weather brings the gaps back. Each change follows the weather fade. (Cover follows the weather fade: clear 0.53, rain 0.76, storm 0.95. Screenshots in each state; clear brings the gaps back.)
- [x] Far clouds fade into the fog. The layer shows no edge or seam at render distance 3 and at 16. (Render distance 3 and 16: no edge or seam. The fade ends at a fixed 1000 blocks.)
- [x] Clouds hide the stars behind them. Thin parts dim them. Stars show in the gaps. No stars show below the horizon. (Stars draw at renderOrder 1.5 before the clouds at 2. Night shot: stars only in the gaps, none below the horizon.)
- [x] Clouds dim the light shafts. Shafts still show through gaps in the clouds at sunrise or dusk. (The shaft mask reads the cloud density; thick cloud leaves 25 %. Sunrise shot: shafts through gaps only.)
- [x] Cloud shadows: soft shadows lie on the terrain and the water under the clouds, offset along the light direction, and move with the clouds. A cloud shadow removes only direct light: caves and block shadows look the same. Caustics and the water glitter fade under a cloud shadow. (Soft moving shadows on land and sea, offset toward the sun. Caves and block shadows unchanged. Forced overcast removes the caustic net in a pool. Sunrise sea view: the glitter path shows at cover 0 and is gone at cover 0.95. The glitter fades with the cloud on the sun ray even with Shadows off, like the sun disc.)
- [x] The "Shadows" box turns cloud shadows off and on with the other shadows. (Pause menu checkbox, noon highland view, mean terrain grey: box on, cover 0 against 0.95: 75.6 against 58.7; box off: 78.0 against 78.0. Off and back on: 59.0, 78.0, 59.0.)
- [x] From above (flying at y 220), the layer shows lit cloud tops with gaps to the ground. It hides the terrain under thick parts. (y 240 view: lit tops, gaps to the ground, thick parts hide the terrain.)
- [x] With the head under water or in lava, no clouds draw. The menu panorama shows the new clouds. (Head in water at y 124 and in lava: no clouds. y 140: clouds. Menu panorama shows the new clouds.)
- [x] White clouds do not bloom, in HDR and in the LDR fallback. (Bloom on against off, cloud pixels: HDR mean +0.84/255, p99 3; LDR fallback (`post.hdr` false) mean +2.6/255, p99 7. No glow.)
- [ ] Cost: at 3240×2025 with Shadows and Bloom on, at a view with half sky, the clouds cost at most 2 fps (clouds shown against hidden, interleaved in one page). The render scale item still holds: 75 % holds 60 fps over the shallow-water view. (Open. Cost half passes: layer shown against hidden, interleaved 4×, 42.7/43.3/42.6/42.3 against 43.1/43.1/41.7/43.1 fps. Render-scale half not met on 2026-10-02: 75 % gave 57.5 fps with Android Studio loading the CPU, then about 30 fps on a later run. The HEAD build without clouds gave the same rates in alternating loads (25.7/29.9 against 25.3/30.3), so the drop is the machine. Rerun on a quiet Mac.)
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0. Saves do not change. (0 errors and 0 warnings across the main page loads and the LDR context. `npm run check` exit 0, 29 tests. `src/persist.js` unchanged; no cloud fields in the save.)

## Sunset clouds (Joe, 2026-10-02 19:43 CT)

Joe asked for clouds near the horizon at sunrise and sunset that turn pink and orange, then purple and blue toward the darker sky. Spec: `SPEC_graphics.md` G5. rsh picked the details below.

- [x] Sunset, clear weather: clouds low and toward the sun are gold and orange. Clouds overhead or to the side are pink. Clouds away from the sun are purple to blue-grey. (2026-10-02, seed 12345, y 172, sun elevation 0.05: toward the sun gold and orange; 90° to the side pink, turning purple; overhead purple; away from the sun purple to blue-grey.)
- [x] Sunrise shows the same colors as sunset at the same sun height. (`uSunset` and `uShift` are equal for rise and set at elevation 0.12, 0, and -0.1, for example 0.8438/0.4197 at -0.1. The sunrise shot toward the sun shows gold and orange clouds.)
- [x] A low sun lights the cloud bases: thick clouds glow underneath instead of going dark. (Forced cover 0.95, sun elevation 0.04, view up at 55°: base color 121/94/130 (pink-purple, luminance 106.1) with the colors on against 88/90/97 (grey, 90.1) off.)
- [x] Afterglow: after the sun sets, the colors move from orange and pink to purple and blue, then fade to the night clouds. No step or jump shows. (A sequence of sun heights.) (Elevation 0.25, 0.12, 0.03, -0.04, -0.09, -0.14, -0.19, -0.25: white, gold and pink, vivid orange and pink, pink and purple, dim purple, dark purple, dark, night. Each step is a small change.)
- [x] Far clouds near the horizon keep their color. The layer still shows no edge or seam at the far fade. (Render distance 3 and 16, elevation 0.03, views 30° and 150° from the sun: far clouds stay gold and pink toward the sun and purple-blue away. No edge or seam at the fade.)
- [x] Noon and night clouds look as before. (Noon and midnight screenshots against the build before the change.) (New build against `79a16c2`: `uColor`, `uAmb`, and `uLightAmt` are equal at noon and midnight. `uSunset` is 0. The fragment shader without the sunset block equals the old shader. Screenshots match.)
- [x] Rain mutes the colors. A storm removes them. The change follows the weather fade. (`uSunset` sampled each second: clear 1; rain fade 0.87, 0.75, 0.62, 0.49, 0.37, 0.25; storm fade 0.21 down to 0; back to clear 0.06 up to 1. Screenshots: rain dusky pink-grey, storm grey.)
- [x] Colored clouds do not bloom, in HDR and in the LDR fallback. (Bloom on against off, cloud drift stopped. HDR side view without the sun: mean 0.27/255, p99 1. Gold view beside the sun: the colors add mean 0.2, p99 1 over the bloom with the colors off. LDR (`post.hdr` false): the colors add mean 0.46 and 0.68, p99 3.)
- [x] Cost: at 3240×2025 at a sunset view with half sky, the colors cost at most 1 fps (colors on against off, interleaved in one page). (Two interleaved runs, Shadows and Bloom on: 43.24 against 43.52 fps (5 pairs), 42.17 against 41.76 fps (8 pairs). The machine noise is ±10 fps, so an isolated test also ran: the cloud quad drawn 40 times per sample, synced by `readPixels`. The colors add 0.12 to 0.18 ms per frame in three runs, and 0.5 to 0.58 ms in two runs when the GPU was slower. The interleaved fps runs are the measure this item names, and both pass. The worst isolated time, 0.58 ms, would be 1.05 fps if the frame rate were 43 fps. The frame rate was lower in that slow GPU state, so the real cost was lower.)
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0. Saves do not change. (0 errors and 0 warnings on the HDR page and in an LDR tab; `gl.getError()` 0. `npm run check` exit 0, 29 tests. `src/persist.js` unchanged.)

## Multi-room dungeons (Joe, 2026-10-02 20:35 CT)

Joe found dungeon floors that float in caves. Joe chose O3 and asked for several rooms at random levels. Spec: `SPEC_expansion.md`, "Multi-room dungeon". Checks run on seed 12345 unless an item names another seed.

- [x] No dungeon floor hangs in a cave: no room has an open cell (air, water, lava) under its floor. (Node scan of many chunks, with the old count for comparison.) (Scan of 2601 chunks per seed (radius 25), seeds 12345, 4242 and 31337: 0 rooms with an open cell under the floor. The old generator left 157 of 243 dungeons floating on seed 12345, 130 of 200 on 4242, and 127 of 199 on 31337. The ladder hole of a room's own shaft is the only gap, by design.)
- [x] Every dungeon has 2 to 4 rooms inside one chunk, at y 14 to 93. Each room is 5 to 9 wide on each side and 5 tall. Each room lies 5 to 9 blocks lower than the room before it. (Scan, 3 seeds: 0 failures for room count, chunk bounds, size, y range and drop. Room counts 2/3/4: 62/14/5, 51/23/4, 48/24/5. The test checks the first 30 dungeons.)
- [x] Links: both staircases and ladder shafts occur. Every staircase goes down 1 block per step and faces up toward the upper room. Every ladder hangs on a solid block. (Scan, 3 seeds: 41/40/41 staircases and 64/69/70 ladder shafts. Every stair faces up: the next cell up is a stair 1 higher, or the upper room's floor level with the stair's top. Every ladder has an opaque block behind it. The top step is a stair in the upper room's floor layer since 2026-10-02 21:05; before that the top step needed a jump, which Chromium found.)
- [x] Walk check: from the top room a player reaches every room and gets back to the top room without digging. (Node walk check over every dungeon in the scan, and in Chromium: walk down a staircase and climb a ladder.) (Node walk check in the scan, 3 seeds, and in the test: every room reached from the top and the top reached from the bottom, with no jump. A rise of 1 counts only onto a stair whose tall half points the way of the step. Mutation: without the door stair the test fails at chunk 0, -3. Chromium, chunk 0, -3: W alone walks down the staircase from feet y 47 to 42 and back up to 47. Space climbs the ladder from y 35 to 43.2, W steps off onto the room floor, the player holds still at 42.55 with no key, and Shift climbs down to 35.)
- [x] Each dungeon holds exactly 1 spawner, in the centre of one room, with 1–2 chests in that room. Every other room holds 1 chest. No chest or spawner blocks a link. (Scan, 3 seeds: 1 spawner per dungeon at a room centre, 1–2 chests in the spawner room, 1 chest in every other room, 0 failures. Busy link columns and the cell beside each landing take no chest or spawner. A chest takes a spot only when the room's free floor stays joined. The walk check above proves no furniture blocks a link.)
- [x] Every room keeps the depth rule: the terrain stands at least 4 blocks above its roof. (Scan, 3 seeds: 0 rooms with terrain under 8 above the floor, so at least 4 blocks stand above each roof. `linkOk` applies the same rule to every link cell.)
- [x] The same seed gives the same dungeons. No dungeon cell lies outside its chunk. (All 81 dungeon chunks of seed 12345, radius 25: blocks and features identical on a repeat and in an instance built from `WorldGenModule.toString()`. Scan: 0 room or link cells outside the chunk.)
- [x] Dungeons stay about as common as the old dungeons that had a solid floor (within ±50 %). (New dungeons against old dungeons on a solid floor: 81/86 (−6 %) on seed 12345, 78/70 (+11 %) on 4242, 77/72 (+7 %) on 31337.)
- [x] In Chromium a dungeon looks right: mossy and plain cobblestone, a working spawner with its mob model, chests that fill with dungeon loot, ladders and stairs drawn the right way. (Seed 12345, chunk 0, -3, 4 rooms. Screenshots: mossy and plain cobblestone walls and floor, the spawner cage with its spinning zombie model, chests, a ladder up the wall, half-block stair steps. The spawner made a zombie in 2.7 s once the test torches were gone; torches above light 9 stop it, as designed. All 4 chests filled with dungeon loot, for example rotten flesh, bone, bucket, steel ingot, golden apple, arrows.)
- [x] Only dungeon cells change: other terrain bytes stay equal to the old generator. Golden hashes change only for chunks that hold a dungeon. (Scan, 3 seeds: 0 changed cells outside the old and new dungeon boxes, and other features unchanged. Golden hashes: only chunk -12, 7 changed. It held an old dungeon with an open cell under its floor, and the new generator builds none there.)
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0. Saves do not change. (0 errors and 0 warnings on the game page across both loads. `npm run check` exit 0, 30 tests. `src/persist.js` unchanged.)

## Grass spread (Joe, 2026-10-03 15:31 CT)

Joe asked for grass that spreads. Spec: `SPEC_expansion.md`, "Grass spread". rsh picked the rules, the rate, and the tick radius. The feature adds no UI.

- [x] At the default rate, a lone dirt block in a plains grass field turns to grass. Over 10 such blocks, each turns within 4 minutes, and the mean time is 20 to 80 s. (Real time, no speed-up.)
  - Verified 2026-10-03, seed 12345: the 10 cells turned at 8, 63.4, 49.1, 78.3, 62.1, 118.1, 45.1, 174.1, 21, and 7.1 s. Mean 62.6 s, max 174.1 s.
- [x] A dug patch greens from its edge inward: a 5×5 patch, 1 deep, in plains turns fully to grass over time. The first cell to turn is an edge cell. Each inner cell turns only after a cell next to it has turned. The mean edge time is less than the centre time. (Speed-up allowed: `grass.every` lowered for the run, then restored.)
  - Reworded 2026-10-03 by rsh. The old line said "the edge cells turn before the centre cell". Random ticks do not order every edge cell before the centre, so the line now states the edge-inward property that the rules guarantee.
  - Verified 2026-10-03, plains at (-130, -141), `every` 2: all 25 cells turned. The first cell was the edge cell (-2, -2) at 0.03 s. Edge mean 1.33 s (max 4.73 s), middle ring mean 3.65 s, centre 1.77 s. No inner cell turned before a neighbour. Screenshots show the plains tint.
- [x] Spread box: dirt turns when a grass block lies 1 block to the side (straight or diagonal) at 1 below, level, or up to 3 above. Dirt with grass only 2 blocks to the side, or only 2 below, or only 4 above, stays dirt. (`grass.tick` on built cases.)
  - Verified 2026-10-03: 8 of 8 cases matched (side level, diagonal, 1 below, 3 above turn; 2 below, 4 above, 2 to the side, no grass stay).
- [x] Cover: dirt under an opaque block or under water or lava stays dirt. Dirt under air, a torch, glass, leaves, tall grass, or a sapling turns to grass when the other rules hold. (`grass.tick` on built cases.)
  - Verified 2026-10-03: 8 of 8 cases matched (stone, water, lava stay; torch, glass, leaves, tall grass, sapling turn).
- [x] Light: dirt next to grass in a dark cave (light under 9 above it) stays dirt. A torch that lifts the light above it to 9 or more lets it turn. Light 8 does not. Under open sky, dirt turns at night too. (`grass.tick` on built cases; light read with `getSky`, `getBlk`, `getCry`.)
  - Verified 2026-10-03: dark cave (light 0) stays; torch light 8 stays; torch light 9 turns; open sky at `dayTime` 0.75 (sky 15) turns.
- [x] Grass under an opaque block, water, or lava turns to dirt. Grass under air, glass, a torch, leaves, or tall grass stays grass. Grass in a dark cave stays grass. (`grass.tick` on built cases, and once at the default rate in real time: a dirt block placed on grass turns the grass to dirt.)
  - Verified 2026-10-03: 9 of 9 built cases matched, and grass in a dark cave stayed grass. Real time, default rate: 6 covered grass cells turned to dirt at 16.9, 8.3, 93.3, 24.8, 117.2, and 33.2 s.
- [x] Spread crosses chunk borders: dirt at a chunk edge turns from grass in the neighbour chunk. A cell next to an unloaded chunk does not act on the unloaded side. (`grass.tick` at a border; unloaded case by code read and one built case if reachable.)
  - Verified 2026-10-03: dirt in chunk -2 turned from grass in chunk -3. Built unloaded case: dirt beside chunk (-9, -3), which reads UNLOADED (255), stayed dirt. Code read: `grassNear` and `next` compare ids, so UNLOADED never matches.
- [x] Only chunks within 8 chunks of the player's chunk tick, or within the render distance when it is smaller. Ticks stop on the pause screen, in the settings menu, and while loading, and resume after. The inventory and homes screens do not stop ticks, because the world keeps running behind them, as it does for liquids, crops, and furnaces. (Count of ticked chunks at render distance 4, 8, and 16; dirt next to grass stays dirt over a 60 s pause at a sped-up rate, then turns after resume.)
  - Reworded 2026-10-03 by rsh. The old line said "paused or in a menu". `game.simulating()` is true in the inventory and homes screens, so grass grows there, as other world systems do.
  - Verified 2026-10-03 on the candidate-list code: ticked chunks 69 at render distance 4, 225 at 8, and 225 at 16. Each count equals the lit chunks inside the circle. Pause, `every` 2: 0 of 25 cells turned in 60 s, and the clock stayed still. After resume, all 25 turned within 5.9 s. Settings menu: 0 of 9 turned in 15 s, and all 9 turned within 9.8 s after resume. Loading: `game.simulating()` is false (code read, `src/engine.js:36`).
- [x] A spread change is a normal edit: it remeshes at once with the biome tint, and it survives a save and a reload. The save gets no new field. (Screenshot of the greened patch; reload keeps it; save keys listed.)
  - Verified 2026-10-03: the plains screenshots show the greened patch with the tint. After `persist.save()` and a reload, 25 of 25 spread cells were still grass. Save keys: `clonecraft.lastSeed`, `clonecraft.world.12345`. The save has the same 17 fields as HEAD `src/persist.js:31-36`.
- [x] Farmland cycle: dry farmland without a crop turns to dirt, then grass grows back over it. (Hoe a grass block, wait out the dry time, then the spread, at a sped-up rate.)
  - Verified 2026-10-03: the hoe tilled grass at (-140, 132, -175). The farmland turned to dirt at 60.2 s. With `every` 2, the dirt turned to grass 0.8 s later.
- [x] Generated terrain holds at most 2 cells per chunk that the rules change, on seeds 12345, 4242, and 31337. (Node count over 289 chunks per seed. Measured 2026-10-03 before the build: 0.63, 0.40, and 1.40 per chunk.)
- [x] Cost: `grass.update` takes under 0.3 ms per frame at render distance 8 and under 0.6 ms at 16. (In-page timer, mean over 600 frames.)
  - Verified 2026-10-03 on the candidate-list code: 0.134 ms at render distance 8 and 0.234 ms at 16. The first version cost 0.304 ms at 8 and failed; D45 records the fix. Frames with a grass edit also pay the normal `setBlock` cost (3–13 ms).
- [x] Chromium: 0 console errors, 0 warnings. `npm run check` exits 0.
  - Verified 2026-10-03: the console showed 0 errors and 0 warnings over the whole session. `npm run check` exited 0 (depcheck pass, 30 tests pass, build equal).

## Settings screen and anti-aliasing (Joe, 2026-10-04 11:39 CT)

Joe asked for a Settings button on the pause menu, with the configurable settings moved into it, and an anti-aliasing setting. rsh picked the layout, the groups, the anti-aliasing modes, and the default (Off, the current look). The pause menu keeps the compact desktop rows (Joe, 2026-09-29).

- [x] The pause menu shows a Settings button beside Resume. The title menu shows it beside Play, also while the world loads. The main view holds no setting rows.
  - 2026-10-04, Playwright 1280×720: the title, loading (Play disabled), and pause views show the button. Settings opened in the 'loading' state.
- [x] Settings opens a settings view in the same panel. It holds every former row: render distance, field of view, render scale, shadows, bloom + shafts, mouse sensitivity, volume, time of day, and freeze time, plus anti-aliasing. Group headings order the rows: Graphics, Controls, Sound, World.
  - 2026-10-04: screenshot of the settings view shows all 10 rows under the 4 groups.
- [x] Done returns to the main view. Esc in the settings view returns to the main view and does not resume the game. Esc in the main view still resumes. This holds on the pause menu and on the title menu.
  - 2026-10-04: Esc in the settings view kept 'loading', 'menu', and 'paused'. A second Esc on the pause menu resumed. Focus returns to the Settings button.
- [x] A resume from the settings view (a click beside the panel) and a new pause show the main view, not the settings view.
  - 2026-10-04: the click resumed play, and the next pause showed the main view.
- [x] Every moved setting still works: each control changes its value and its effect, saves to `clonecraft.settings`, and survives a reload. The time-of-day slider shows the current clock each time the settings view opens.
  - 2026-10-04: all 9 moved settings plus anti-aliasing applied, saved, and reloaded (camera.fov 90, pixel ratio 0.75, dayTime 0.25 frozen).
- [x] The anti-aliasing slider offers Off, FXAA, MSAA 2×, MSAA 4×, and MSAA 8×. The MSAA steps stop at the most samples the GPU allows for the scene target; WebGL 1 gets Off and FXAA only. The choice saves and survives a reload. A settings save with no anti-aliasing value loads as Off.
  - 2026-10-04: this GPU allows 4 samples, so `post.aaModes` is [0, 1, 2, 4]. A save with `aa: 8` loads as MSAA 4×. A save with no `aa` loads as Off.
- [x] Each mode renders with bloom on and with bloom off. Off shows hard stair-step edges. FXAA and MSAA show blended edge pixels on a block silhouette against the sky. (Screenshot crops and an edge-pixel count per mode.)
  - 2026-10-04, blended edge pixels of 300 (bloom on / off): Off 0 / 0, FXAA 213 / 221, MSAA 2× 147 / 147, MSAA 4× 209 / 209. `gl.getError()` 0 in all 8 renders.
- [x] Light shafts still render with MSAA, so the depth texture resolves.
  - 2026-10-04: at sunrise, facing the sun, Off and MSAA 4× show the same glow and shafts (mean difference 1.5/255). A 4-sample depth texture reads back geometry (33 % of pixels).
- [x] Twenty mode switches leave the texture count in `renderer.info.memory` where it started. `gl.getError()` returns 0.
  - 2026-10-04: bloom on 35 → 35. Bloom off 33 → 33 → 33 (two runs of 20). `gl.getError()` 0. A first switch from a bloom-on start frees the unused scene target (35 → 33); the count never grows.
- [x] The settings view text is at least 14 px and readable on a white sky and a night sky (R2). The view fits in a 1280×720 window, or it scrolls to Done.
  - 2026-10-04: the smallest text is 14 px (group headings). Noon and night screenshots read clearly on the dark panel. The panel fits: scrollHeight 543 = clientHeight 543.
- [x] Chromium: 0 console errors and 0 warnings. `npm run check` exits 0.
  - 2026-10-04: the Playwright session log holds 0 errors and 0 warnings. `npm run check` exits 0: depcheck passes, 63/63 tests pass, and index.html equals a fresh build.

## Enemy arrows, soft shadows, and the MSAA flashes (Joe, 2026-10-04 12:42 CT)

Joe asked to pick up enemy arrows and to turn off soft shadows. Joe dropped "dynamic shadows" and reported pinpoint flashes on distant objects with MSAA at any level. rsh traced the flashes to `vUv` extrapolation at MSAA edge pixels (atlas bleed) and picked the fix: centroid varyings.

- [x] A skeleton arrow stuck in a block is picked up like a player arrow: walking near it adds 1 arrow and plays the pop. A full inventory leaves the arrow in place. A player arrow still picks up.
  - 2026-10-04 (Playwright): a skeleton arrow 3 blocks away stayed stuck (128 arrows). The player moved next to it: 129, and the arrow left the list. With every slot full, a second skeleton arrow stayed stuck. After the slots were restored, it picked up. A player arrow then gave 130.
- [x] The settings view has a Shadows row with On and Soft edges, and an Effects row with Bloom + shafts. Soft edges is disabled (dimmed) while On is off.
  - 2026-10-04: with On cleared, Soft edges reads `disabled` and its label has opacity 0.5 (screenshot). With On checked, Soft edges is enabled again.
- [x] Soft edges off gives a hard shadow edge (1 read); on gives the soft edge. A screenshot crop shows both. The setting saves and survives a reload. A save without it loads as on.
  - 2026-10-04: a crop of one terrace shadow shows stepped shadow-map texels with Soft edges off and a blurred edge with it on. A click saved `softShadows: false`. After a reload, the config, the checkbox, and `uShadowSoft` read off (0). After the key was deleted and the page reloaded, all three read on (1).
- [x] With MSAA 2× and 4×, distant terrain shows no pixel brighter than the non-MSAA image around it (the bright-pixel count drops to near 0 over 8 views). No flashes are visible in a screenshot.
  - 2026-10-04, render-target test (640×360, 8 views): before the fix, MSAA 4× had 0..214 bright pixels per view. After it, MSAA 2× and 4× had 0..3 per view.
  - 2026-10-04, on screen (MSAA 4×, bloom on): the unfixed shader gave 3447 off-tile (yellow) edge pixels. The fixed shader gave 10 and 7, against 9 for a second AA-off frame. Crops show yellow seams only in the unfixed frame. The remaining bright-pixel flags in the fixed frame are thin snow edges that MSAA resolves and the AA-off frame misses.
- [x] MSAA still smooths block edges (an edge-pixel count), and textures look unchanged at Off.
  - 2026-10-04: of 41658 edge pixels, 12752 are blended at MSAA 4× against 4709 at Off. Centroid sampling equals centre sampling without multisampling, so the Off image does not change. A second AA-off frame differs from the first only by noise (9 pixels).
- [x] Chromium: 0 console errors and 0 warnings. `npm run check` exits 0.
  - 2026-10-04: the console has 0 errors and 0 warnings. `npm run check` exits 0 (depcheck pass, tests pass, index.html equals a fresh build).
