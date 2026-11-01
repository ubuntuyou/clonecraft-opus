# GATE: hardening

The gate file for `SPEC_hardening.md`. Check a box only after you verify it yourself. **(owner)** marks a box that only Joe closes.

## Step 1: the save module (H3, H2, H1)

### Before the step
- [ ] Back up Joe's seed 1234 save text to the session scratchpad (not the repo).
- [ ] Export `tests/fixtures/save-live.json` from a throwaway seed. Every slice field is populated in the overworld, the Ember slice, and the Crystal slice. `portals.crystalBack` and `boss` are set.

### H3: the pure save-format module
- [ ] `src/save-format.js` exists and is listed in `src/order.js` and in `PURE`.
- [ ] `REALMS` and `WEATHER_KINDS` live in `config.js`. `VEHICLE_KINDS` lives in `blocks.js`. Every importer is updated.
- [ ] The live fixture passes the moved `validSave` unchanged.
- [ ] `editsOf(mapsOf(x))` round trip test passes.
- [ ] Test: a `B.LEAVES` edit loads as `B.LEAVES_PLACED`.
- [ ] Fail proof (pure): a scratch `import { mobs } from './order.js'` in `save-format.js` fails depcheck with `pure`. Reverted.

### H2: element checks
- [ ] The checks cover `liquids`, `leaves`, `te` (by type), `homes[].yaw`, `inv.sel`, and the `player.health` range.
- [ ] The save-sweep test passes. `save-accepted-mutants.json` lists each accepted mutant with a reason.
- [ ] Ratchet proof: a mutant listed in the baseline but now rejected fails the test. Reverted.
- [ ] Fail proof (save-sweep): removing the `liquids` element check fails the sweep and names the path. Reverted.
- [ ] Rejection tests: `liquids: [[null]]`, `leaves: [null]`, a furnace with no `burn`, a home with no `yaw`, and `inv.sel: 99`.

### H1: boot reader and fallback
- [ ] `config.js` no longer parses the save. `boot.js` uses `readSave`.
- [ ] Tests: `readSave` gives a reason for empty JSON, a wrong seed, truncated text, and no `player`.
- [ ] Fail proof (save-reader): a scratch `JSON.parse(storage.get(SAVE_KEY))` in `config.js` fails the test and names `save-reader`. Reverted.
- [ ] Playwright, throwaway seed: a corrupt save gives a fresh world, a toast with the reason and the key, and a backup key that holds the exact text.
- [ ] Playwright, throwaway seed: an apply throw (a scratch-only patch, then reverted) gives the same result after one reload.
- [ ] Playwright: a failed backup write keeps `SAVE_KEY` and sets `persist.blocked`.
- [ ] Playwright: seed 1234 opens with Continue, at the same position, with the boss defeated.
- [ ] **(owner)** Joe confirms that his seed 1234 world is intact.
- [ ] **(owner)** Joe reviews the toast text and the backup key policy.

### Step 1 close
- [ ] `npm run build`, then `npm run check` passes on the merged branch. `index.html` is committed once.
- [ ] 0 game console errors in Chromium.
- [ ] `ARCHITECTURE.md`: D16 names `readSave` and `validSave` as the trust boundary for boot and import. The new seam `save-format` is documented. The table moves are recorded.
- [ ] `DISCOVERY_save-format.md` exists (fixture refresh, sweep baseline, the rule that every new save field needs a check and a fixture entry).
- [ ] `DISCOVERY_engine.md` points to `DISCOVERY_save-format.md` for save rules.
- [ ] `CHANGELOG.md` `[Unreleased]` lists H1–H3.
- [ ] QA cleanup: throwaway keys removed, `lastSeed` back to 1234, snapshots deleted.
- [ ] **(owner)** Joe approves the Step 1 merge.

## Step 2: the wave (H4, H6, H7, H8, H9)

### H4: sealed platform (P finding: reproduce first)
- [ ] The Node portal-seal test is red on the unfixed code (water case).
- [ ] The Playwright repro shows the panes disappear within 2 s. If it does not reproduce, record the result here and skip the fix boxes.
- [ ] The fix turns water and lava cells that touch the structure into obsidian.
- [ ] The portal-seal test passes for both liquid kinds.
- [ ] Playwright: a platform portal over the ocean still works after 10 s, and travel back succeeds.

### H6: render distance
- [ ] `RD_MIN`, `RD_MAX`, `READY_RADIUS`, and `clampRenderDistance` exist in `config.js`. `main.js` and `realms.js` use `READY_RADIUS`.
- [ ] The rd-ready test passes.
- [ ] Fail proof (rd-ready): a scratch `RD_MIN = 2` fails the test and names `rd-ready`. Reverted.
- [ ] Playwright: `?rd=2` loads with render distance 3.
- [ ] `README.md` says "3–16".

### H7: locked exit portal
- [ ] Playwright, boss defeated: mining an exit frame block does nothing.
- [ ] Playwright, boss defeated: TNT next to the exit portal leaves it whole.
- [ ] Before the kill, arena edits behave as before.

### H8: loose stack leftover
- [ ] Playwright: after the reload, the leftover lies as drops at the player, and the item counts match the counts before the reload.

### H9: IIFE-aware upward
- [ ] The planted IIFE test is red on the unfixed `depcheck.js`.
- [ ] The planted IIFE test passes after the fix. The plant asserts that it changed the text.
- [ ] `node tools/depcheck.js` passes on the live source with no baseline.

### Step 2 close
- [ ] All five branches are merged. `npm run build`, then `npm run check` passes. `index.html` is committed once.
- [ ] 0 game console errors in Chromium.
- [ ] `ARCHITECTURE.md`: D16 seed and render distance notes, D49 or D52 notes the exit lock, and D39 or D42 notes the IIFE rule.
- [ ] `DISCOVERY_engine.md`: the exit lock and `READY_RADIUS` are recorded.
- [ ] `CHANGELOG.md` `[Unreleased]` lists H4 and H6–H9.
- [ ] QA cleanup: throwaway keys removed, `lastSeed` back to 1234, snapshots deleted.
- [ ] **(owner)** Joe approves the Step 2 merge.

## Step 3: boss kill and travel ratio (H5, H10)

### H5: kill survives a travel
- [ ] Playwright: 0 HP, then death and respawn within 3 s, then a reload. The save holds `defeated: true`, and the exit portal and the loot exist in the Crystal Realm.
- [ ] Playwright: 0 HP, then walking into the arrival portal within 3 s gives the same result.
- [ ] The victory screen shows exactly once.

### H10: one travel ratio
- [ ] Grep: `defaultTarget` holds no bare 8, 64, 33, or 110. No code reads `label`, and `label` is deleted.
- [ ] One `defaultTarget('ember')` result is equal before and after the change.

### Step 3 close
- [ ] `npm run build`, then `npm run check` passes. `index.html` is committed once.
- [ ] 0 game console errors in Chromium.
- [ ] `ARCHITECTURE.md` D53 notes that `leave` finishes a dying Titan.
- [ ] `CHANGELOG.md` `[Unreleased]` lists H5 and H10.
- [ ] QA cleanup: throwaway keys removed, `lastSeed` back to 1234, snapshots deleted.
- [ ] **(owner)** Joe approves the Step 3 merge.

## Release
- [ ] **(owner)** Joe approves the release tag and the version number.
