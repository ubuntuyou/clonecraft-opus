# GATE: hardening

The gate file for `SPEC_hardening.md`. Check a box only after you verify it yourself. **(owner)** marks a box that only Joe closes.

## Step 1: the save module (H3, H2, H1)

Merged as 0e4a995 (2026-10-31). Toast deviation: the HUD is hidden on the menu, so the notice shows in the menu load line, and a 12 s toast repeats it when the game starts. Baseline: 226 accepted mutants, each applied in Chromium with no throw.

### Before the step
- [ ] Back up Joe's seed 1234 save text to the session scratchpad (not the repo). — NOT POSSIBLE: Joe plays from `file://` in his own browser (23:06 CT). Substitute: Joe exports the world, and rsh runs `readSave` on it before Joe opens the new build.
- [x] Export `tests/fixtures/save-live.json` from a throwaway seed. Every slice field is populated in the overworld, the Ember slice, and the Crystal slice. `portals.crystalBack` and `boss` are set.

### H3: the pure save-format module
- [x] `src/save-format.js` exists and is listed in `src/order.js` and in `PURE`.
- [x] `REALMS` and `WEATHER_KINDS` live in `config.js`. `VEHICLE_KINDS` lives in `blocks.js`. Every importer is updated.
- [x] The live fixture passes the moved `validSave` unchanged.
- [x] `editsOf(mapsOf(x))` round trip test passes.
- [x] Test: a `B.LEAVES` edit loads as `B.LEAVES_PLACED`.
- [x] Fail proof (pure): a scratch `import { mobs } from './order.js'` in `save-format.js` fails depcheck with `pure`. Reverted.

### H2: element checks
- [x] The checks cover `liquids`, `leaves`, `te` (by type), `homes[].yaw`, `inv.sel`, and the `player.health` range.
- [x] The save-sweep test passes. `save-accepted-mutants.json` lists each accepted mutant with a reason.
- [x] Ratchet proof: a mutant listed in the baseline but now rejected fails the test. Reverted.
- [x] Fail proof (save-sweep): removing the `liquids` element check fails the sweep and names the path. Reverted.
- [x] Rejection tests: `liquids: [[null]]`, `leaves: [null]`, a furnace with no `burn`, a home with no `yaw`, and `inv.sel: 99`.

### H1: boot reader and fallback
- [x] `config.js` no longer parses the save. `boot.js` uses `readSave`.
- [x] Tests: `readSave` gives a reason for empty JSON, a wrong seed, truncated text, and no `player`.
- [x] Fail proof (save-reader): a scratch `JSON.parse(storage.get(SAVE_KEY))` in `config.js` fails the test and names `save-reader`. Reverted.
- [x] Playwright, throwaway seed: a corrupt save gives a fresh world, a toast with the reason and the key, and a backup key that holds the exact text.
- [x] Playwright, throwaway seed: an apply throw (a scratch-only patch, then reverted) gives the same result after one reload.
- [x] Playwright: a failed backup write keeps `SAVE_KEY` and sets `persist.blocked`.
- [ ] Playwright: seed 1234 opens with Continue, at the same position, with the boss defeated. — SUBSTITUTED (agent, 2026-10-31): seed 777008 reloads with Continue at the same position, and seed 777001 reloads in the Crystal Realm with the boss defeated. The real seed 1234 check needs the export above.
- [ ] **(owner)** Joe confirms that his seed 1234 world is intact.
- [x] **(owner)** Joe reviews the toast text and the backup key policy. Approved by Joe, 2026-11-01 14:28 CT: "I approve all the rest".

### Step 1 close
- [x] `npm run build`, then `npm run check` passes on the merged branch. `index.html` is committed once.
- [x] 0 game console errors in Chromium.
- [x] `ARCHITECTURE.md`: D16 names `readSave` and `validSave` as the trust boundary for boot and import. The new seam `save-format` is documented. The table moves are recorded.
- [x] `DISCOVERY_save-format.md` exists (fixture refresh, sweep baseline, the rule that every new save field needs a check and a fixture entry).
- [x] `DISCOVERY_engine.md` points to `DISCOVERY_save-format.md` for save rules.
- [x] `CHANGELOG.md` `[Unreleased]` lists H1–H3.
- [x] QA cleanup: throwaway keys removed, `lastSeed` back to 1234, snapshots deleted.
- [x] **(owner)** Joe approves the Step 1 merge. Approved by Joe, 2026-11-01 14:28 CT: "I approve all the rest".

## Step 2: the wave (H4, H6, H7, H8, H9)

Merged on main (4eaa7ba code, 40b6fef exit box from boss.EXIT, docs accc3b5), 2026-10-31. H4 reproduced in game on f4bc17e (seed 778001: 6 panes to 0 at +346 ms). After the fix: 52 samples over 10.5 s kept 6/6 panes, and travel back succeeded. Browser QA: 0 game console errors.

### H4: sealed platform (P finding: reproduce first)
- [x] The Node portal-seal test is red on the unfixed code (water case).
- [x] The Playwright repro shows the panes disappear within 2 s. If it does not reproduce, record the result here and skip the fix boxes.
- [x] The fix turns water and lava cells that touch the structure into obsidian.
- [x] The portal-seal test passes for both liquid kinds.
- [x] Playwright: a platform portal over the ocean still works after 10 s, and travel back succeeds.

### H6: render distance
- [x] `RD_MIN`, `RD_MAX`, `READY_RADIUS`, and `clampRenderDistance` exist in `config.js`. `main.js` and `realms.js` use `READY_RADIUS`.
- [x] The rd-ready test passes.
- [x] Fail proof (rd-ready): a scratch `RD_MIN = 2` fails the test and names `rd-ready`. Reverted.
- [x] Playwright: `?rd=2` loads with render distance 3.
- [x] `README.md` says "3–16".

### H7: locked exit portal
- [x] Playwright, boss defeated: mining an exit frame block does nothing.
- [x] Playwright, boss defeated: TNT next to the exit portal leaves it whole.
- [x] Before the kill, arena edits behave as before.

### H8: loose stack leftover
- [x] Playwright: after the reload, the leftover lies as drops at the player, and the item counts match the counts before the reload.

### H9: IIFE-aware upward
- [x] The planted IIFE test is red on the unfixed `depcheck.js`.
- [x] The planted IIFE test passes after the fix. The plant asserts that it changed the text.
- [x] `node tools/depcheck.js` passes on the live source with no baseline.

### Step 2 close
- [x] All five branches are merged. `npm run build`, then `npm run check` passes. `index.html` is committed once.
- [x] 0 game console errors in Chromium.
- [x] `ARCHITECTURE.md`: D16 seed and render distance notes, D49 or D52 notes the exit lock, and D39 or D42 notes the IIFE rule.
- [x] `DISCOVERY_engine.md`: the exit lock and `READY_RADIUS` are recorded.
- [x] `CHANGELOG.md` `[Unreleased]` lists H4 and H6–H9.
- [x] QA cleanup: throwaway keys removed, `lastSeed` back to 1234, snapshots deleted.
- [x] **(owner)** Joe approves the Step 2 merge. Approved by Joe, 2026-11-01 14:28 CT: "I approve all the rest".

## Step 3: boss kill and travel ratio (H5, H10)

Merged on main (code cb40199, docs ec1686f), 2026-10-31. Case A seed 780001 (travel 23 ms after dying), Case B seed 780002 (real portal walk at deathT 2.5). Both: Jewel Heart in the crystal stash, `defeated: true` saved, 18 frame + 12 pane cells after the reload, no Titan, victory once. 0 game console errors.

### H5: kill survives a travel
- [x] Playwright: 0 HP, then death and respawn within 3 s. Before the reload, the crystal stash holds the loot drops.
- [x] Playwright: after that reload, the save holds `defeated: true`, the exit portal stands in the Crystal Realm, and no Titan spawns. Correction by rsh, 2026-10-31: dropped items are never saved (`persist.js` header, D47), so the loot cannot survive a reload for any kill. The loot check moved before the reload.
- [x] Playwright: 0 HP, then walking into the arrival portal within 3 s gives the same results (stash loot before the reload; `defeated` and the exit portal after it).
- [x] The victory screen shows exactly once.

### H10: one travel ratio
- [x] Grep: `defaultTarget` holds no bare 8, 64, 33, or 110. No code reads `label`, and `label` is deleted.
- [x] One `defaultTarget('ember')` result is equal before and after the change. Four samples matched (agent, Node run of the real function body), e.g. overworld (100,70,-40) to ember [12.5,33,-5].

### Step 3 close
- [x] `npm run build`, then `npm run check` passes. `index.html` is committed once.
- [x] 0 game console errors in Chromium.
- [x] `ARCHITECTURE.md` D53 notes that `leave` finishes a dying Titan.
- [x] `CHANGELOG.md` `[Unreleased]` lists H5 and H10.
- [x] QA cleanup: throwaway keys removed, `lastSeed` back to 1234, snapshots deleted.
- [x] **(owner)** Joe approves the Step 3 merge. Approved by Joe, 2026-11-01 14:28 CT: "I approve all the rest".

## Release
- [x] **(owner)** Joe approves the release tag and the version number. Approved by Joe, 2026-11-01 15:20 CT: version 0.2.0 ("yes, 0.2.0"). The tag waits on the open seed 1234 boxes.
