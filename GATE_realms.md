# GATE: realms

Spec: `SPEC_realms.md`. `[x]` means I observed it in Chromium through Playwright (seed 12345 unless an item names another seed), or a Node test proves it where the item says so. `[ ]` means it is not verified. A note tells why. Owner review items stay open until Joe plays them.

## Phase 0: id plan

- [x] Armor ids are 300..323. `armorId(tier, piece)` returns 300 + 4 × tier + piece. (Node test.)
- [x] `migrateIds` maps every stack id in 176..199 to id + 124 in the inventory, the loose stacks, the armor slots, and every chest and furnace. A save with `ids: 2` passes through unchanged. (Node test on a built old save.)
- [x] An old save from HEAD before Phase 0 loads in Chromium with its worn armor, armor in the inventory, armor in a chest, its edits, and its homes. Armor points and durability match the old save.
- [x] An old export file imports and loads the same way.
- [x] An item with an id of 256 or more survives every stack path: pick up, hotbar, held view model, icon, tooltip, split, drop, chest, furnace fuel and output, trash and undo, craft result, death drop, save, export, and import.
  Note (Phase 0): armor ids 300..323 passed pick up, hotbar, held view model, icon, tooltip, move, armor slot, chest, trash and undo, craft result (recipe in the table grid), Q drop, death drop, save, export, and import. Split and furnace fuel and output need a stackable, burnable, or smeltable id of 256 or more. None exists before Phase 4 (Raw Emberite, Ember Dust, Emberite Ingot), so this item stays open until Phase 4 checks those paths.
  Note (Phase 4): Playwright: a right-click split of a Raw Emberite (256) stack gave two halves. Ember Dust (259) went into the furnace fuel slot and burned. Raw Emberite went into the input slot, and an Emberite Ingot (257) came out of the output slot into the inventory.
- [x] Ids 176..186 are blocks and fit in a chunk byte. No B id and I id overlap. (Node test.)
  Note (Phase 0): the Node tests prove every block id is below 255, ids 176..199 are free, and B and I do not overlap. The blocks 176..186 arrive in Phases 2, 3, 5, and 6. This item closes when the last of them exists.
  Note (Phase 6): PYLON (186) is the last of them. The Node test `ids 176..199 hold only the realm blocks and their block items` passes.

## Phase 1: realm core

- [x] `clonecraft.realm.travel('ember')` and `('crystal')` load the target realm with the loading screen and its realm text. Return to the overworld works the same way.
  Note (Phase 1): Observed for ember, crystal, and overworld. Each shows the realm text over an opaque tinted screen. The QA hold (`world.update = () => {}`) kept the screen up for the screenshots.
- [x] An edit in each realm survives a round trip: overworld to ember, ember to crystal, crystal to overworld. No edit appears in the wrong realm.
  Note (Phase 1): GLASS (overworld), PLANKS (ember), and DIRT (crystal) at (5, 60, 5) each survived the round trip. Arrival in ember and in crystal read AIR at that cell before the edit there.
- [x] A chest in the Ember Realm keeps its items across a round trip and across a reload. A chest at the same x, y, z in the overworld keeps different items.
  Note (Phase 1): Ember chest at (3, 45, 3) kept stone ×3 across a round trip and a reload. The overworld chest at (3, 45, 3) kept dirt ×7.
- [x] Liquids, leaf decay, farming, and vehicles keep their state per realm across a round trip.
  Note (Phase 1): The liquid, leaf, farming, and vehicle snapshots at leave and at re-entry were identical in the overworld and in ember. The ember liquid queue was not empty.
- [x] Drops left in a realm wait frozen and are still there on return in the same session.
  Note (Phase 1): An ember drop was at the same position on return.
- [x] A realm change removes all mobs. Passive overworld mobs return from `entityStore` when the overworld loads again.
  Note (Phase 1): Mobs were 0 after each realm change. Passive overworld mobs were 40 before and 40 after the return.
- [x] A reload while in the Ember Realm starts in the Ember Realm at the same place.
  Note (Phase 1): A reload in ember started in ember at (−11.25, 41, 21.5), the place of the save.
- [x] The save holds `ids`, `realm`, `realms`, `portals`, and `boss`. An overworld-only save still reads the same top-level fields. `validSave` rejects a save with a bad realm name or a bad slice.
  Note (Phase 1): The save holds `ids` 2, `realm`, `realms` (ember and crystal, all 8 slice keys), `portals`, and `boss`. `validSave` rejected a bad realm, an overworld key in `realms`, a bad slice, an array for `realms`, a bad portal, and a bad boss. A save from the build before Phase 1 loaded in the overworld with its edit, chest, and home, and re-saved with the new fields.
- [x] A late chunk from the old realm, still in a worker at the switch, never enters the new realm. (Travel during heavy loading; compare block bytes against a fresh generation.)
  Note (Phase 1): A teleport kept 4 workers busy at the switch. 8 stale results arrived and were dropped. All 293 loaded ember chunks had 0 differing cells against a fresh generation.
- [x] Death in the Ember Realm respawns the player at the overworld spawn. The death drops wait in the Ember Realm.
  Note (Phase 1): Death in ember respawned at the overworld spawn. A save during the respawn travel held the overworld and the spawn. The death drops (dirt ×9, glass ×4) were in ember on return.
- [x] The homes screen lists only the current realm's homes. A home set in the Ember Realm teleports within the Ember Realm.
  Note (Phase 1): The overworld homes screen showed "No homes yet." while ember had a home. `goHome` in ember stayed in ember.
- [x] In the Crystal Realm, a cell below y 0 reads as air. Below y −32 the player takes 4 void damage every 0.5 s, and armor does not reduce it. Drops and mobs below y −32 vanish.
  Note (Phase 1): Crystal cells below y 0 read AIR. The player took 4 damage every 0.5 s with 15 armor points. The death message was "fell out of the world". A drop and a mob below y −32 were removed.
- [x] The compass spins and shows "?" outside the overworld.
  Note (Phase 1): Observed: the needle spins and the text is "?" in ember and crystal.
- [x] Weather, clouds, rain sounds, lightning, and fireflies stay out of the new realms. The weather state keeps counting down there.
  Note (Phase 1): Travel in a storm snapped the weather to 0. In ember: `rainGain` 0, cloud cover 0, firefly level 0, and `weather.left` kept counting down. A 22 s storm watch in ember showed a maximum flash of 0. Return to the overworld snapped the storm back.
- [x] Pause, inventory, and death during a travel load do not break the switch. Esc on the loading screen does nothing.
  Note (Phase 1): Travel closed an open inventory. Esc, E, and H during the load kept the state 'travel'. A hidden tab kept 'travel'. Damage of 100 during the load was ignored, so death cannot start during the load. A second travel during the load returned false.

## Phase 2: Ember Realm terrain

- [x] The same seed gives the same Ember Realm chunks. A worker instance equals the main-thread instance. (Node test.)
  Note (Phase 2): `tests/worldgen.test.js` checks 5 ember chunks against a second instance and a worker copy. A different seed differs. The overworld golden hashes still pass.
- [x] Bedrock at y 0 and from y 124 up; the roof hangs down to y 116 in bumps. Open cells at y 31 and below hold lava. (Node scan.)
  Note (Phase 2): The 17×17 chunk scan finds bedrock at y 0 and y 124+ in every column, a lowest roof of exactly y 116, no air at y ≤ 31, and no lava above y 31.
- [x] Ember Rock, Ash Sand, Ember Lamps, and Emberite Ore generate. Emberite: about 1 vein per 2 chunks, veins of 1–3, y 8 to 110. (Node scan over 289 chunks.)
  Note (Phase 2): The 289-chunk scan finds all 4 blocks and no stone. Emberite: 141 veins, 0.49 per chunk (sizes: 49 of 1, 53 of 2, 39 of 3), all at y 8..110.
- [x] Each new block breaks with its tool at its spec hardness and drops its spec item. Emberite Ore drops nothing to a ruby pickaxe and Raw Emberite to a diamond pickaxe.
  Note (Phase 2): `tests/blocks.test.js` checks the hardness, the tool, and the drop of each block. Lamp dust is 2..4 over 200 draws. Emberite gives Infinity (no drop) to a ruby pickaxe and Raw Emberite to a diamond pickaxe.
- [x] Ash Sand slows walking to 40 %.
  Note (Phase 2): Playwright, a held W key on built strips: 4.33 blocks/s on Ember Rock, 1.70 on Ash Sand. The ratio is 0.394.
- [x] An Ember Lamp lights its area at level 15. An unlit cave shows the red-orange ambient floor, not black. (Screenshots.)
  Note (Phase 2): The lamp cell at (13, 46, 11) reads light 15; the cells below read 14, 13, 12, 11, 10, 9. Screenshots show the lit lamp cluster and red-orange unlit rock. The ambient level is 9, not the spec's first 6: level 6 read near-black on screenshots. SPEC_realms now says 9.
- [x] Red fog ends at 72 blocks at render distance 8. Ash particles drift around the camera. (Screenshots.)
  Note (Phase 2): At render distance 8, `scene.fog.far` and `uFogFar` read 72 (near 21.6), color 0x4a1409. Screenshots show grey flakes and orange embers. Samples 1 s apart show a flake moved; the pool stays within 20 blocks across and 12 up and down. Ash hides in the overworld.
- [x] A water bucket in the Ember Realm makes steam and a hiss, empties, and places no water.
  Note (Phase 2): Playwright: `useItem` with a water bucket aimed at the floor made 34 steam particles and 1 fizz. The slot became an empty bucket, and no water block appeared nearby. The same bucket placed water at (-540, 77, 196) in the overworld.
- [x] The realm looks right: a large cave world with a lava sea, glowing lamps, and no sky. (Screenshots.)
  Note (Phase 2): Wide screenshots from (-67, 42, 24) show the lava sea, rock islands, the cave roof, hanging lamps, red fog, and no sky. Reload, overworld round trip, and return keep ambient 9, the fog, and the ash. 0 console errors and 0 warnings.

## Phase 3: Ember portal

- [x] The frame check accepts obsidian rectangles with openings 2..4 wide and 3..5 tall, along x and along z, with or without corners. It rejects a missing side block, a wrong block, a filled opening, and openings out of range. (Node test.)
  Note (Phase 3): Node: `tests/portals.test.js` covers every size 2..4 × 3..5 on both axes, with and without corners, and clicks on the bottom row, a side, and the top row. It rejects a missing side, stone in a side, cobble in the top row, dirt or water in the opening, sizes 1×3, 5×3, 2×2, and 2×6, and clicks on air or away from the frame. 45 of 45 tests pass.
- [x] A right click with a Magma Core lights a valid frame and uses the core. A click on an invalid frame keeps the core and shows "The frame is not complete".
  Note (Phase 3): Playwright: a core on an incomplete frame showed "The frame is not complete" and kept the core. A core on a complete frame lit 6 cells and the stack went from 2 to 1. A second click on the lit frame kept the core.
- [x] The portal pane draws in the frame's plane with a moving swirl and particles. It emits light 11. The player walks through it, and the crosshair passes through it to the block behind. (Screenshots.)
  Note (Phase 3): Screenshots show the swirl and sparks on x-axis and z-axis frames. Block light reads 11 in the cells and 10 one cell away. The crosshair targets the stone behind the pane. With held W, the player walked from z 0.4 to z −6.0 through the pane at z −4 (y 133). The timer reached 0.35 s and reset, with no travel.
- [x] Breaking a frame block removes every portal block in that opening. So does placing a block into the opening.
  Note (Phase 3): Playwright: breaking a side block of the Ember frame at x 58, z 127 removed all 6 cells. Stone placed through the pane at (59, 33, 130) stayed, and the other 5 cells became air.
- [x] Standing in the portal for 2.5 s travels. The vignette grows during the wait. Stepping out at 2 s resets the timer.
  Note (Phase 3): Playwright: at t 2.03 the vignette read 0.98 (screenshot). A step out at 2 s set the timer and the vignette to 0 with no travel. A full 2.5 s stand travelled.
- [x] After arrival, the player can stand in the arrival portal without travelling again until the player steps out and back in.
  Note (Phase 3): Playwright: after arrival at A the player stood 4 s in the pane with the timer at 0 and no travel. A step out and back in travelled. Every 'travel' state now disarms the portal, so a direct `go()` call does not re-trigger either (re-checked).
- [x] Linking: overworld (800, y, −400) arrives near ember (100, −50). An existing ember portal within 16 blocks of the target is reused. An overworld portal within 128 blocks of (x × 8, z × 8) is reused.
  Note (Phase 3): Playwright: overworld (800, 100, −400) arrived at ember (101, 34, −58.5), 8.5 blocks from (100, −50). An ember portal 15.1 blocks from the target was reused; one at 17 blocks led to a new build. An overworld portal at 122.5 blocks was reused; one at 130.5 led to a new build.
- [x] With no portal at the target, the game builds a 2×3 obsidian portal on solid ground. Over open lava, it builds the obsidian platform. A built portal never touches lava. The built portal survives a reload.
  Note (Phase 3): Playwright: builds on solid ground had `platform` false. Over open lava at ember (60, 130), the build made the platform: 12 platform obsidian, 0 lava touches, and the player not in lava. Node tests cover the ledge and lava cases. After a reload the platform portal kept 6 cells; the Ember Realm held 36 cells and the overworld 24. The site radius is 14, not 16 (SPEC_realms updated: 14 × 8 = 112 keeps the return within 128).
- [x] Round trip: overworld portal A to the Ember Realm and back arrives at A.
  Note (Phase 3): Playwright: travel from ember portal B arrived at overworld portal A (25.5, 133, −3.5) with no new build. Travel from A arrived at B (3.5, 69, −0.5).
- [x] Travel from a boat or cart is refused with the toast.
  Note (Phase 3): Playwright: a boat and a cart, each mounted in pane B for 4 s, touched the pane every sample. The timer stayed 0 and no travel happened. The toasts read "Leave the boat to travel" and "Leave the cart to travel", once each. A dismount inside the pane then travelled after 2.5 s. The hum reads 0.147 in the pane, 0.090 at 3 blocks, and 0 far away.

## Phase 4: Ember content

- [x] Raw Emberite smelts to an Emberite Ingot. Every Emberite tool and armor piece crafts with the vanilla shape through real recipe-book clicks.
  Note (Phase 4): Node test for every shape. Playwright: Raw Emberite smelted to an ingot in a furnace. All 9 pieces (5 tools, 4 armor) crafted through recipe-book clicks.
- [x] Emberite tools: level 6, speed 11, durability 2400, and the spec damage values. Emberite armor: points 3/8/6/3, durability factor 40. A full set cuts lava damage by 80 %.
  Note (Phase 4): Node test for the stats (hoe damage 4, rsh's choice). Playwright: the worn full set read 20 points and cut lava damage by 80 %.
- [x] Ember Dust burns 60 s in a furnace. 4 dust in a 2×2 craft 1 Ember Lamp.
  Note (Phase 4): Node test, and Playwright: one dust gave `burnMax` 60, and 4 dust in the 2×2 grid gave 1 Ember Lamp.
- [x] Fortresses generate on the 96-block grid: a keep in one chunk, 2 to 4 bridges, pillars to the floor or lava, and end rooms. No cell of a stamp lies outside its chunk. The same seed gives the same fortress. (Node scan.)
  Note (Phase 4): Node scan of the 25 cells in −2..2: every keep lies in one chunk, every planned brick exists across chunk edges, every pillar ends on rock, lava, or bedrock, and no column belongs to 2 fortresses. A chunk writes only its own array; two generations and a `toString` copy give the same bytes.
- [x] A walk check finds a path from every bridge end into the keep without digging. (Node walk check, and one walk in Chromium.)
  Note (Phase 4): Node walk check passes for every bridge of the 25 fortresses. Playwright: a held-W walk went from the west end room (x −29.5) into the keep (x 37.8) in 15.6 s, with no dig and no drop below y 85.
- [x] Every keep's heart chest holds exactly 1 Ember Heart. The other chests hold fortress loot. Loot fills on first touch and is the same on every visit.
  Note (Phase 4): Node test: one heart chest per keep, and `LOOT.heart` puts 1 Ember Heart first; fortress loot has no heart. Playwright: the heart chest (36, 85, 36) held 1 Ember Heart plus fortress loot; the room chest (−31, 85, 40) held fortress loot. Both kept the same stacks on reopen, after an overworld round trip, and after a page reload.
- [x] The keep spawner makes Cinder Knights.
  Note (Phase 4): Playwright: the spawner at (40, 85, 40) was live with type knight and made 2 Cinder Knights within 1 block of it. Natural spawns cannot land within 24 blocks of the player.
- [x] Ember Wisp: flies, keeps 8–16 blocks away, fires a fireball every 3 s with line of sight. A fireball deals 5 (armored), bursts, and breaks no block. Drops 0–2 Ember Dust.
  Note (Phase 4): Playwright found a defect: over the lava sea the wisp sank below the deck and fired twice in 16 s. The chase height rule fixed it (ARCHITECTURE D51). After the fix: shots 3.0..3.1 s apart, 14 blocks away, 2..4.8 above the player's feet; a wisp spawned at 4.8 blocks backed off to 8.7. Hits dealt 5 bare and 1 in full diamond armor. `flameBurst` ran, and `world.overrides` stayed unchanged. Drops over 6000 rolls: 0, 1, or 2 dust at about 1/3 each.
- [x] Cinder Knight: 30 HP, a hit of 6, half damage from arrows, half knockback. Drops 0–2 coal and Raw Emberite 1 time in 3.
  Note (Phase 4): Playwright: hp 30; hits of 6 on the bare player; an 8-damage player arrow dealt 4 (8 on a zombie); knockback velocity 3 against 6 for a zombie. Drops over 6000 rolls: 0, 1, or 2 coal at about 1/3 each, and Raw Emberite 0.322.
- [x] Spawns in the Ember Realm follow the weights and the light rule. Cinder Knights spawn only inside fortress bounds. Magma Brutes spawn there too. (Count over many spawn rolls.)
  Note (Phase 4): Node tests, and Playwright with the real `emberType`: fortress cell brute 0.347, knight 0.200, wisp 0.453; open cell brute 0.429, wisp 0.571, no knight. Block light 12 and 14 gave no spawn; 9, 10, and 11 always spawned.
- [x] Mob models and textures look right. (Screenshots.)
  Note (Phase 4): screenshots: the knight shows the helm, visor, glowing eyes, plume, pauldrons, belt, and sword. The wisp shows a glowing face and flame shards. The fireball shows an orange shell and a flame trail. Joe has not reviewed the look.

## Phase 5: Crystal Realm

- [x] Two Crystal Frames craft from 1 obsidian and 4 crystals through the recipe book.
  Note (Phase 5): Node test for the shape. Playwright: real recipe-book clicks turned 1 obsidian and 4 crystals into 2 Crystal Frames (183).
- [x] A Crystal Frame portal lights with an Ember Heart and uses the heart. A Magma Core does not light it. In the Ember Realm, the click shows "The frame does not wake here" and keeps the heart.
  Note (Phase 5): Playwright: an incomplete frame showed "The frame is not complete". A Magma Core did nothing. The heart lit all 6 panes and was used. In the Ember Realm the click showed "The frame does not wake here", and the heart stack stayed at 2.
- [x] The crystal portal leads to the arrival portal on the arena island. The arrival portal leads back to the last overworld crystal portal used. With that portal broken, it leads to the overworld spawn.
  Note (Phase 5): Playwright: the portal led to the arrival stand (0.5, 97, 36.5). The return landed at the overworld portal used last. With that portal broken, the return landed at spawn (−11.5, 138, 21.5). The arrival frame is locked (ARCHITECTURE D52): breaks, edits, and a TNT blast left it whole, and 20 frames of held mining made no progress.
- [x] The same seed gives the same Crystal Realm chunks. Nothing exists below y 20. No island other than the arena lies within 72 blocks of the origin. (Node test.)
  Note (Phase 5): Node tests in `tests/worldgen.test.js` pass: equal bytes for the same seed, no block below y 20, and no island within 72 blocks of the origin.
- [x] Islands taper underneath, carry Glimmer Moss on top, and hold crystal clusters. The violet sky, the stars, the aurora, the fog, and fixed-direction shadows render. (Screenshots.)
  Note (Phase 5): screenshots: tapered islands, moss tops, clusters on tops and undersides, the violet sky, stars, aurora, and fog. A shadows-on and shadows-off diff shows the arrival frame's cast shadow on the moss. Joe has not reviewed the look.
- [x] Voidstone and Glimmer Moss break with their tools and drop their spec items.
  Note (Phase 5): Node test for hardness, tools, and drops. Playwright: moss broke in 0.45 s, the pure `breakTime` value, and dropped Voidstone. Voidstone dropped itself with a pickaxe, and a bare hand did not harvest it.
- [x] No mob spawns naturally in the Crystal Realm.
  Note (Phase 5): Playwright: 400 spawn calls and 20 s of play left 0 mobs.

## Phase 6: Prism Colossus

- [x] The arena has 6 pillars on a ring of radius 26 with a pylon on each. Each pylon emits crystal light 15 and shows a beam to the boss.
  Note (Phase 6): Node test for the ring. Playwright: 6 pylons at radius 26, heights 107..112 on seed 1234. Screenshots show the pillars, the pylons, the light, and the beams to the boss.
- [x] A pylon breaks by a hand hit and by an arrow, and drops nothing.
  Note (Phase 6): Playwright: a hand hit breaks a pylon at once. A player arrow breaks one too. Neither leaves a drop. The flow run broke all 6 by hand.
- [x] The boss sleeps until the player is within 32 blocks of the center. The boss bar shows then and hides at 64 blocks.
  Note (Phase 6): Playwright: the boss sleeps at 33.5 blocks and wakes at 31. The bar shows at 31, 50, and 63 blocks. At 66 blocks the boss sleeps and the bar hides. It stays hidden at 50 and 40 blocks and shows again at 31.
- [x] Phase 1: hits do no damage while any pylon stands. The shield flash shows, and the toast appears once per fight. A 3-shard fan fires every 3 s for 4 damage each (armored).
  Note (Phase 6): Playwright: hits leave 300 HP while pylons stand. The shield flash shows, and the toast shows once. Fans of 3 come every 3 s. A shard deals 4 to a player with no armor and 0.8 to a player in full diamond armor, so armor applies.
- [x] Phase 2: with all pylons gone, the boss hunts at speed 2.5. The slam warns for 0.8 s, then deals 8 within 4 blocks with knockback.
  Note (Phase 6): Playwright: the speed peaks at 2.5. The slam warns for 0.82 s, deals 8 at 3 blocks with strong knockback, and 0 at 6 blocks. Fix in QA: the slam hits only a player near the floor.
- [x] The slam damage travels with the visible ring (Joe, 2026-10-04). The ring grows on the floor from the boss's rim to 4 blocks. It hits a player on the floor as its edge passes, so the hit comes later at a larger distance. A jump timed over the edge avoids it. A player at 5 blocks takes nothing.
  Note (2026-10-04): Playwright, distances from the wave center. At 1.0 the hit comes at 0 ms. At 2.4 it comes at 220 ms (r 2.5). At 3.29 it comes at 349 ms. A jump at impact from 2.4 takes no hit; the feet are 1.16 above the floor as the edge passes. At 4.39 nothing hits; the wave stops at r 4. With no armor the hit deals 8. A screenshot at r 2.2 shows the spark ring on the floor at the hit edge.
- [x] Phase 3: at 50 % HP, speed 3.5, a 5-shard fan every 3 s, and 2 Shardlings every 12 s, never more than 4 alive.
  Note (Phase 6): Playwright: the speed is 3.5. 5-shard fans come every 3.0 s through 8 slams. Summons of 2 come at 12 s and 24 s, with a cap of 4. Fix in QA: the fan and summon timers now run during a slam.
- [x] Shardling: 8 HP, speed 4, a hit of 3, drops a crystal 1 time in 2.
  Note (Phase 6): Playwright: a Shardling hits for 3. The drop roll gave a crystal 17 times in 40. HP 8 and speed 4 are in the mob table.
- [x] Death of the player resets the fight: full HP, Shardlings gone, broken pylons stay broken. Leaving the realm does the same.
  Note (Phase 6): Playwright: after a death and after leaving, the boss has full HP, the Shardlings are gone, and the broken pylons stay broken.
- [x] The boss death plays for 3 s, then drops the Prism Heart, 8–16 crystals, and 2–4 Emberite Ingots, and builds the lit exit portal at the center.
  Note (Phase 6): Playwright: the death plays for 3 s. Two kills dropped 1 Prism Heart each, 10 and 9 crystals, and 2 and 4 Emberite Ingots. Both fall in the ranges 8..16 and 2..4. The exit portal at x -1..1, y 97..100, z 0 is lit. Fix in QA: drops shift off the exit pane.
- [x] The exit portal leads like the arrival portal.
  Note (Phase 6): Playwright: without `crystalBack` the exit portal leads to the spawn. In the flow run it led to the `crystalBack` portal at (323.5, 131, 348.5).
- [x] After a reload, the boss does not return, and the exit portal stays.
  Note (Phase 6): Playwright: after a reload, no boss spawns, the exit portal stands, and neither the bar nor the victory screen shows.
- [x] The victory screen shows on the first kill only, with the time played and a Continue button. The world pauses behind it. Continue and Esc both return to play.
  Note (Phase 6): Playwright: the screen shows the title, the time played, and Continue. The game clock delta is 0 behind it. Continue and Esc both return to play. The boss spawns only while `realm.boss.defeated` is false, so a world has one kill.
- [x] The full flow works without the debug handle: craft and light an ember portal, find a fortress, take the Ember Heart, build and light a crystal portal, kill the boss, and return home. (One Playwright run may use creative-style item grants for materials only.)
  Note (Phase 6): Playwright, seed 1234, a fresh save, real input. Grants were materials only (diamonds, sticks, planks, string, flint, feathers, crystals, obsidian, a Magma Core, bread). The run crafted the gear and frames in the recipe book and lit an obsidian portal with the Magma Core. It took the Ember Heart from the heart chest of fortress (1, 0) at (132, 45, 51), built and lit a Crystal Frame portal, broke 6 pylons, and killed the boss in 27 s with a diamond sword. It took the Prism Heart and returned through the exit portal. The game logged no errors. The console showed only `favicon.ico` 404s from the QA static server. The QA script died 3 times on the way (a fall, a wisp, and a fall after pointer lock was lost on travel). Each death was a script error, and the game behaved correctly.

## Phase 7: finish

- [ ] Sounds: portal hum, travel whoosh, wisp fireball, knight hit, boss shard, slam, roar, and shatter play. Audio for Joe: owner review.
- [ ] The Ember Realm holds 60 fps (vsync) at 1280×720 and render distance 8. The Crystal Realm does too. The overworld keeps its own rate. (Mean over 600 frames, each realm.)
- [ ] Chromium: 0 console errors and 0 warnings across all phases. `npm run check` exits 0.
- [ ] `ARCHITECTURE.md`, `CHANGELOG.md`, `DISCOVERY_engine.md`, and the living headers describe the realms, the portals, the boss, and the id plan.

## UI (ui-guidelines, pointer row)

- [ ] No text below 14 px on the boss bar, the victory screen, the loading screen, and toasts. Body text is 16 px (R2).
- [ ] No low-contrast text on the boss bar or the victory screen against the Ember and Crystal skies, checked on screenshots (R2, R11).
- [ ] The victory Continue button is at least 24 px tall, with an 8 px gap to any other target (R3).
- [ ] R4–R10: no forward-search field, text field, reveal, delete, edit screen, or new list in this spec. The homes list keeps its empty-state message when the current realm has no homes (R10).

## Owner review (Joe)

- [ ] The look of the Ember Realm.
- [ ] The look of the Crystal Realm.
- [ ] The feel of the boss fight.
- [ ] The difficulty curve from the first portal to the kill.
