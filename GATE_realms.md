# GATE: realms

Spec: `SPEC_realms.md`. `[x]` means I observed it in Chromium through Playwright (seed 12345 unless an item names another seed), or a Node test proves it where the item says so. `[ ]` means it is not verified. A note tells why. Owner review items stay open until Joe plays them.

## Phase 0: id plan

- [x] Armor ids are 300..323. `armorId(tier, piece)` returns 300 + 4 × tier + piece. (Node test.)
- [x] `migrateIds` maps every stack id in 176..199 to id + 124 in the inventory, the loose stacks, the armor slots, and every chest and furnace. A save with `ids: 2` passes through unchanged. (Node test on a built old save.)
- [x] An old save from HEAD before Phase 0 loads in Chromium with its worn armor, armor in the inventory, armor in a chest, its edits, and its homes. Armor points and durability match the old save.
- [x] An old export file imports and loads the same way.
- [ ] An item with an id of 256 or more survives every stack path: pick up, hotbar, held view model, icon, tooltip, split, drop, chest, furnace fuel and output, trash and undo, craft result, death drop, save, export, and import.
  Note (Phase 0): armor ids 300..323 passed pick up, hotbar, held view model, icon, tooltip, move, armor slot, chest, trash and undo, craft result (recipe in the table grid), Q drop, death drop, save, export, and import. Split and furnace fuel and output need a stackable, burnable, or smeltable id of 256 or more. None exists before Phase 4 (Raw Emberite, Ember Dust, Emberite Ingot), so this item stays open until Phase 4 checks those paths.
- [ ] Ids 176..186 are blocks and fit in a chunk byte. No B id and I id overlap. (Node test.)
  Note (Phase 0): the Node tests prove every block id is below 255, ids 176..199 are free, and B and I do not overlap. The blocks 176..186 arrive in Phases 2, 3, 5, and 6. This item closes when the last of them exists.

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

- [ ] The frame check accepts obsidian rectangles with openings 2..4 wide and 3..5 tall, along x and along z, with or without corners. It rejects a missing side block, a wrong block, a filled opening, and openings out of range. (Node test.)
- [ ] A right click with a Magma Core lights a valid frame and uses the core. A click on an invalid frame keeps the core and shows "The frame is not complete".
- [ ] The portal pane draws in the frame's plane with a moving swirl and particles. It emits light 11. The player walks through it, and the crosshair passes through it to the block behind. (Screenshots.)
- [ ] Breaking a frame block removes every portal block in that opening. So does placing a block into the opening.
- [ ] Standing in the portal for 2.5 s travels. The vignette grows during the wait. Stepping out at 2 s resets the timer.
- [ ] After arrival, the player can stand in the arrival portal without travelling again until the player steps out and back in.
- [ ] Linking: overworld (800, y, −400) arrives near ember (100, −50). An existing ember portal within 16 blocks of the target is reused. An overworld portal within 128 blocks of (x × 8, z × 8) is reused.
- [ ] With no portal at the target, the game builds a 2×3 obsidian portal on solid ground. Over open lava, it builds the obsidian platform. A built portal never touches lava. The built portal survives a reload.
- [ ] Round trip: overworld portal A to the Ember Realm and back arrives at A.
- [ ] Travel from a boat or cart is refused with the toast.

## Phase 4: Ember content

- [ ] Raw Emberite smelts to an Emberite Ingot. Every Emberite tool and armor piece crafts with the vanilla shape through real recipe-book clicks.
- [ ] Emberite tools: level 6, speed 11, durability 2400, and the spec damage values. Emberite armor: points 3/8/6/3, durability factor 40. A full set cuts lava damage by 80 %.
- [ ] Ember Dust burns 60 s in a furnace. 4 dust in a 2×2 craft 1 Ember Lamp.
- [ ] Fortresses generate on the 96-block grid: a keep in one chunk, 2 to 4 bridges, pillars to the floor or lava, and end rooms. No cell of a stamp lies outside its chunk. The same seed gives the same fortress. (Node scan.)
- [ ] A walk check finds a path from every bridge end into the keep without digging. (Node walk check, and one walk in Chromium.)
- [ ] Every keep's heart chest holds exactly 1 Ember Heart. The other chests hold fortress loot. Loot fills on first touch and is the same on every visit.
- [ ] The keep spawner makes Cinder Knights.
- [ ] Ember Wisp: flies, keeps 8–16 blocks away, fires a fireball every 3 s with line of sight. A fireball deals 5 (armored), bursts, and breaks no block. Drops 0–2 Ember Dust.
- [ ] Cinder Knight: 30 HP, a hit of 6, half damage from arrows, half knockback. Drops 0–2 coal and Raw Emberite 1 time in 3.
- [ ] Spawns in the Ember Realm follow the weights and the light rule. Cinder Knights spawn only inside fortress bounds. Magma Brutes spawn there too. (Count over many spawn rolls.)
- [ ] Mob models and textures look right. (Screenshots.)

## Phase 5: Crystal Realm

- [ ] Two Crystal Frames craft from 1 obsidian and 4 crystals through the recipe book.
- [ ] A Crystal Frame portal lights with an Ember Heart and uses the heart. A Magma Core does not light it. In the Ember Realm, the click shows "The frame does not wake here" and keeps the heart.
- [ ] The crystal portal leads to the arrival portal on the arena island. The arrival portal leads back to the last overworld crystal portal used. With that portal broken, it leads to the overworld spawn.
- [ ] The same seed gives the same Crystal Realm chunks. Nothing exists below y 20. No island other than the arena lies within 72 blocks of the origin. (Node test.)
- [ ] Islands taper underneath, carry Glimmer Moss on top, and hold crystal clusters. The violet sky, the stars, the aurora, the fog, and fixed-direction shadows render. (Screenshots.)
- [ ] Voidstone and Glimmer Moss break with their tools and drop their spec items.
- [ ] No mob spawns naturally in the Crystal Realm.

## Phase 6: Prism Colossus

- [ ] The arena has 6 pillars on a ring of radius 26 with a pylon on each. Each pylon emits crystal light 15 and shows a beam to the boss.
- [ ] A pylon breaks by a hand hit and by an arrow, and drops nothing.
- [ ] The boss sleeps until the player is within 32 blocks of the center. The boss bar shows then and hides at 64 blocks.
- [ ] Phase 1: hits do no damage while any pylon stands. The shield flash shows, and the toast appears once per fight. A 3-shard fan fires every 3 s for 4 damage each (armored).
- [ ] Phase 2: with all pylons gone, the boss hunts at speed 2.5. The slam warns for 0.8 s, then deals 8 within 4 blocks with knockback.
- [ ] Phase 3: at 50 % HP, speed 3.5, a 5-shard fan every 3 s, and 2 Shardlings every 12 s, never more than 4 alive.
- [ ] Shardling: 8 HP, speed 4, a hit of 3, drops a crystal 1 time in 2.
- [ ] Death of the player resets the fight: full HP, Shardlings gone, broken pylons stay broken. Leaving the realm does the same.
- [ ] The boss death plays for 3 s, then drops the Prism Heart, 8–16 crystals, and 2–4 Emberite Ingots, and builds the lit exit portal at the center.
- [ ] The exit portal leads like the arrival portal.
- [ ] After a reload, the boss does not return, and the exit portal stays.
- [ ] The victory screen shows on the first kill only, with the time played and a Continue button. The world pauses behind it. Continue and Esc both return to play.
- [ ] The full flow works without the debug handle: craft and light an ember portal, find a fortress, take the Ember Heart, build and light a crystal portal, kill the boss, and return home. (One Playwright run may use creative-style item grants for materials only.)

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
