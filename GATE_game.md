# GATE: game

The first criteria (sections "Delivery" to "Presentation") came from `Minecraft Clone Prompt V3.md`. Joe removed that file on 2026-10-01 because the project has moved beyond it. The later sections come from Joe's requests and the specs they name. `[x]` means I observed it in Chromium through Playwright (seed 12345). `[ ]` means it is not verified. A note tells why. Joe renamed this file from `GATE.md` on 2026-10-01, when the project had three specs.

## Delivery

- [x] Code is in the spec's sections, numbered 1–18, with a living header.
- [x] Chromium: load, play, and QA runs with 0 console errors and 0 warnings.
- [x] Firefox: Joe played it.
- [x] `file://` launch: Joe loaded the file from disk in Firefox.
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
- [x] Audio: Joe heard it in Firefox.
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
- [x] Clouds fly at y 192. The shaft mask treats y > 180 as cloud. The highest loaded terrain is y 173. The spawn and the menu panorama follow the new sea level.
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
- [x] Fix after Joe's report (Esc in menus still paused): the Esc lock request moved to the keyup. With a stub that grants every lock and ends it on an Esc keyup (the Firefox model), Esc from the inventory, chest, and homes screens returned to `playing` with the lock held. The lock request ran on `keyup`.
- [x] Esc on the pause screen resumes `playing` (stub: lock held). An Esc within 400 ms of the pause does not resume. A held Esc (repeat) does not pause again.
- [x] A refused lock after Esc shows the resume hint in `playing`. A canvas click then takes the lock.
- [x] Esc behavior in a real browser. (Joe, 2026-09-29: "esc and resume work fine". Firefox not named.)
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
- [ ] Joe confirms the colors and the density of pink trees in plains in his own world.

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
- [ ] Joe confirms the forest mosaic in his own world.

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
- [ ] Owner review (Joe): combat feel with the new mobs.
- [ ] Owner review (Joe): the look of the structures.
- [ ] Owner review (Joe): the weather mood.

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
- [x] Water, clouds, rain, and particles cast no shadows. (The pass hides water, transparent materials, points, lines, and sky ShaderMaterials. Caustics show under open water; no cloud shadows at noon.)
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
- [ ] Frame rate over shallow water at 3240×2025 stays at 60 fps. (FAILS as written. Looking down at 2-deep water: old build 47.1 and 47.0 fps, new build 45.9 and 45.4. The old build also misses 60 at this view; the warp costs about 1.5 fps. Shore view: 57.3 fps. Not met. Joe accepted the cost on 2026-09-29 14:24 CT: "It's fine as is.")
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

