# SPEC: hardening

Status: draft by rsh on 2026-10-31 for Joe's review. Gate: `GATE_hardening.md`.
Source: the two-axis repo review of 2026-10-31 (`/tmp/review-clonecraft-opus-2026-10-31.md`, review at `855062e`). Joe chose "the high and medium C and P findings" on 2026-10-31 22:53 CT. That is the list rsh proposed: F1–F6, F17–F20, F27. F5 and F6 are medium-low. They are in scope because they were on the proposed list.

## Part 1: General

### Scope

This spec fixes the save, portal, boss, and loading defects that the review found. It also closes three gaps in the checks. A **hardening code** (`H1`…`H10`) names one unit of work in this spec. The letter H is new. Earlier specs use C, D, G, N, O, P, Q, R, S, and T, and Joe uses A, D, F, O, Q, and R. Each H-code maps to one or more review F-codes:

| Code | F-code | Verdict | Finding |
|---|---|---|---|
| H1 | F17 | C | Boot applies the local save without `validSave`, and an apply error has no fallback. |
| H2 | F18, F2 | C | `validSlice` does not check the elements of `liquids`, `leaves`, `te`, `homes`, or `inv.sel`. A bad import blocks its seed. |
| H3 | F20 | C | The save checks and the edits codec have no test, and Node cannot import them. |
| H4 | F1 | P | A portal platform built next to water floods, and the water removes the panes. |
| H5 | F3 | C | A travel during the boss's 3 s death animation loses the kill. |
| H6 | F4 | C | `?rd=2` never leaves the loading screen. |
| H7 | F5 | C | The exit portal can be broken, and nothing rebuilds it. |
| H8 | F6 | C | Loose stacks that do not fit the inventory are deleted on load. |
| H9 | F19 | C | The depcheck `upward` rule misses a load-time IIFE. |
| H10 | F27 | C | `REALMS.scale` and `REALMS.label` are never read. `defaultTarget` uses a bare 8. |

### Constraints

- `npm run check` passes at the end of every task and every step.
- Chromium shows 0 game console errors. The python static server's `favicon.ico` 404 does not count.
- Saves stay compatible. Every save that the current game writes loads after this spec, with no loss. `IDS_VERSION` does not change.
- The boot fallback (H1) never deletes a rejected save. It copies the text to a backup key first.
- Joe's seed 1234 world is in the Playwright browser's local storage. Back up its save text to the session scratchpad before the first QA run of Step 1. Do not commit it.
- Use a throwaway seed for every QA run. After QA, set `persist.blocked = true`, remove the throwaway save key, and open `?seed=1234` so `lastSeed` returns to 1234.
- Reproduce a P finding before you fix it. H4 is the only P finding. If H4 does not reproduce, record the result in the gate file and leave the code unpatched.
- A wave task runs `npm run check` in its worktree, but it does not commit `index.html`. The step close rebuilds `index.html` once on the merged branch and commits it. Parallel tasks would otherwise conflict on the 700 KB generated file.
- Every new rule obeys `code.md ## Static checks`. It runs behind `npm run check`. It is deterministic. A scratch violation proves that it can fail.
- A baseline only shrinks. Never regenerate a baseline to make the gate pass.
- The module rules stay in force (D36–D42, `SPEC_modules.md`). `src/order.js` lists every new module. A module that tests import joins `PURE` in `tools/depcheck.js`.
- Commits follow Conventional Commits. They carry no co-author trailer.

### Non-goals

- These review findings are out of scope: F7–F16, F21–F26, and F28–F52.
- H2 adds no checks for fields outside the save shape that `persist.data()` writes today.
- H1 adds no save repair. A rejected save is backed up, not fixed.
- H4 changes only the platform fallback. The site search (`siteOk`) does not change.
- H5 does not change the boss fight, the 3 s animation, or the victory screen.
- H7 does not lock the exit portal before the kill. There is no exit portal before the kill.
- H8 does not change the in-game close path (`closeInventory`).
- H9 does not change the other depcheck rules.
- H10 does not change the 1:8 ratio, the y offset of 64, or the 33..110 clamp. It only names them.
- `SPEC_modules.md` N4 (no formatter, no linter) and N8 (no retrieval index) still hold.

## Part 2: Product

### What to build

**H3. A pure save-format module.**
- `src/save-format.js` holds the save shape checks (`validSave`, `validSlice`), the edits codec (`editsOf`, `mapsOf`), and the boot reader (`readSave`).
- The module is pure. It imports only from pure modules, so Node tests can import it.
- `validSave` reads three tables: `REALMS`, the weather kinds, and `VEHICLE_KINDS`. They are pure data but live in non-pure modules today. Move them:
  - `REALMS` moves to `src/config.js`. `realms.js` imports it.
  - The weather kinds move to `src/config.js` as `WEATHER_KINDS`. `weather.KINDS` reads `WEATHER_KINDS`.
  - `VEHICLE_KINDS` moves to `src/blocks.js`, beside `I.BOAT` and `I.MINECART`. `vehicles.js` imports it.
- `persist.js` imports `validSave` for the file import. `realms.js` imports `editsOf` and `mapsOf`.
- The leaf-id rewrite in `mapsOf` (`B.LEAVES` to `B.LEAVES_PLACED`) moves with the codec. Its behavior does not change.

**H1. The boot reader and the fallback.**
- `config.js` no longer parses the save. It keeps `SAVE_KEY`.
- `boot.js` calls `readSave(text, SEED)` with the text of `SAVE_KEY`. `readSave` parses the text and runs `migrateIds` and then `validSave`.
- `readSave` returns `{ save, reason }`:
  - `save` is the checked save. It is `null` when there is no save text or the save is rejected.
  - `reason` is `null`, or it is a short text that says why the save was rejected.
- On a rejection, boot does these things in this order:
  1. Copy the text to `clonecraft.world.<seed>.rejected.<epoch ms>`.
  2. Remove `SAVE_KEY`.
  3. Start a fresh world.
  4. After loading, show a toast that names the reason and the backup key.
- A save that passes `readSave` but throws in `persist.apply` follows the same path. Boot copies the text, removes `SAVE_KEY`, and reloads the page.
- If the backup write fails, boot leaves `SAVE_KEY` in place. It shows a toast that says the save could not load and was kept. It then starts a fresh world with saving blocked (`persist.blocked = true`), so the old save is not overwritten.

**H2. Element checks in `validSlice` and `validSave`.**
- `liquids`: an array of two arrays. Each entry is an integer triple `[x, y, z]` with `0 <= y < H`.
- `leaves`: an array of integer triples, with the same rule.
- `te`:
  - Each entry has `type` `'chest'` or `'furnace'`.
  - A chest has exactly 27 slots.
  - A furnace has exactly 3 slots and finite `burn`, `burnMax`, and `cook` values of 0 or more.
- `homes`: each entry also has a finite `yaw`.
- `inv.sel`: an integer from 0 to 8.
- `player.health`: a finite number from 0 to `player.maxHealth` (20).
- The checks accept every save that the current game writes. The live fixture (Step 1) proves this.

**H4. A sealed portal platform.**
- The platform fallback in `buildPlan` (`src/portal-frame.js`) turns every liquid cell that touches the structure into obsidian. This covers lava (`LIQ_KIND` 2) and water (`LIQ_KIND` 1).

**H5. A boss kill survives a travel.**
- When `realm.leave()` runs while the Titan is `dying`, the Titan shatters at once.
- The shatter builds the exit portal, drops the loot, sets `realm.boss.defeated`, and sets `boss.victoryPending`. All of these land in the crystal stash.
- The save that follows the travel records `defeated: true`.
- `travel()` saves before `leave()` runs. So the travel saves once more after the shatter.

**H6. A render distance that can load.**
- `config.js` exports `RD_MIN` (3), `RD_MAX` (16), `READY_RADIUS` (3), and `clampRenderDistance(n)`.
- `?rd=N`, the saved setting, and the settings slider all use `clampRenderDistance`.
- `main.js` and `realms.js` call `readyAround(…, READY_RADIUS)`.
- `README.md` says "3–16". The slider keeps `min="3"`.

**H7. A locked exit portal.**
- `world.locked` in `src/portals.js` also returns true inside the exit portal box (`EXIT` from `src/boss.js`, plus a 1-block margin) when the realm is `crystal` and `realm.boss.defeated` is true.
- Every edit path checks `world.locked` already: mining, placing, TNT, and liquids.

**H8. No item loss on load.**
- `persist.apply` collects the leftover of every `inv.add` call for the `loose` stacks.
- After the chunks around the player are meshed, the leftover drops at the player's position. The drop uses `spawnDrop`, as `closeInventory` does.

**H9. An IIFE-aware `upward` rule.**
- In `tools/depcheck.js`, the scope walk treats a function scope as load time when that function is the callee of a `CallExpression`. That covers `(() => …)()` and `(function () { … })()`.
- A new planted test in `tests/depcheck.test.js` proves the rule.
- Live uses that the new rule finds are fixed, not baselined. The review found none.

**H10. One travel ratio.**
- `defaultTarget` reads `REALMS.ember.scale` instead of the bare 8.
- The y offset (64) and the clamp (33..110) become named constants in `realms.js`.
- `REALMS.*.label` is deleted, because no code reads it. Grep first to confirm.

### Where it lives

- New: `src/save-format.js`, `tests/save-format.test.js`, `tests/config.test.js`, `tests/fixtures/save-live.json`, `tests/fixtures/save-accepted-mutants.json`, `DISCOVERY_save-format.md`.
- Changed: `src/config.js`, `src/blocks.js`, `src/boot.js`, `src/persist.js`, `src/realms.js`, `src/weather.js`, `src/vehicles.js`, `src/order.js`, `src/portal-frame.js`, `src/portals.js`, `src/boss.js`, `src/main.js`, `tools/depcheck.js`, `tests/depcheck.test.js`, `tests/portals.test.js`, `README.md`, `ARCHITECTURE.md`, `DISCOVERY_engine.md`, `CHANGELOG.md`, `index.html` (rebuilt).

### Interfaces

Step 1 writes these names. Later tasks use them as the contract.

- `src/save-format.js` exports `readSave(text, seed) -> { save, reason }`, `validSave(d)`, `validSlice(s, top)`, `editsOf(byChunk)`, `mapsOf(edits)`, and `SLICE_FIELDS`. `SLICE_FIELDS` moves from `realms.js`.
- `src/config.js` exports `REALMS`, `WEATHER_KINDS`, `RD_MIN`, `RD_MAX`, `READY_RADIUS`, and `clampRenderDistance(n)`. Step 2 adds the last four.
- `src/blocks.js` exports `VEHICLE_KINDS`.
- The backup key format is `clonecraft.world.<seed>.rejected.<epoch ms>`.

### Patterns to follow

- Pure module tests: `tests/blocks.test.js` and `tests/portals.test.js`. Import `./host-stub.js` first.
- Planted depcheck tests: `tests/depcheck.test.js`. Assert that the plant changed the text before you run depcheck (the review's F21 lesson).
- Liquid-touch logic: the lava branch in `src/portal-frame.js:129-136`.
- Drop on overflow: `closeInventory` in `src/inventory-ui.js`.
- Toasts: `hud.toast`.

## Part 3: Execution

### Mechanized rules (B2)

| Code | Rule | Kind | Fail proof |
|---|---|---|---|
| H1 | **save-reader**: only `src/save-format.js` calls `JSON.parse` on save text. A test in `tests/save-format.test.js` scans `src/*.js` for `JSON.parse` next to `SAVE_KEY` or `clonecraft.world.` (forwarded forms included: a variable that holds `storage.get(SAVE_KEY)`). | invariant test | Plant `JSON.parse(storage.get(SAVE_KEY))` in a scratch copy of `config.js`. The test fails and names `save-reader`. |
| H2 | **save-sweep**: a mutation sweep over `tests/fixtures/save-live.json`. For each JSON path, the sweep tries these mutants: delete the key, `null`, a string, `-1`, `1e9`, `{}`, `[]`, and `[null]` inside arrays. Each mutant must fail `validSave`, unless `tests/fixtures/save-accepted-mutants.json` lists it with a reason. The test also fails when a listed mutant is now rejected, so the baseline only shrinks. | invariant test + ratchet | Remove the `liquids` element check in a scratch copy. The sweep fails and names `save-sweep` and the path. |
| H3 | **pure**: `save-format` joins `PURE` in `tools/depcheck.js`. The existing rule then guards the module. | existing tool rule | Plant `import { mobs } from './order.js'` in a scratch copy. Depcheck fails with `pure`. |
| H4 | **portal-seal**: for each liquid kind, a test plans a platform in a stub world full of that liquid. It applies the planned edits. Then it asserts that no liquid cell touches the structure box. | invariant test | The test is red before the H4 fix. That is the Node repro. |
| H6 | **rd-ready**: `(RD_MIN + 0.5) ** 2 >= READY_RADIUS ** 2`. `clampRenderDistance` returns values in `RD_MIN..RD_MAX` for 0, 1, 2, 17, and NaN. The slider `min` in `src/index.html` and the README range equal `RD_MIN`. | invariant test | Set `RD_MIN` to 2 in a scratch copy. The test fails and names `rd-ready`. |
| H9 | **upward** with IIFEs: the planted `const probe = (() => particles.update)();` must fire `upward`. | tool rule | The test is red before the H9 fix. |
| H5, H7, H8, H10 | Review only. No deterministic check covers the class without the browser. Each code has a Playwright or inspection box. | review only | — |

### File overlap

| File | Codes |
|---|---|
| `src/persist.js` | H1, H2, H3, H8 |
| `src/realms.js` | H3, H5, H6, H10 |
| `src/config.js` | H1, H3, H6 |
| `tools/depcheck.js` | H3, H9 |
| `src/boot.js` | H1 |
| `src/portal-frame.js`, `tests/portals.test.js` | H4 |
| `src/portals.js` | H7 |
| `src/boss.js` | H5 |
| `src/main.js`, `README.md` | H6 |

### Build order

**Step 1 (one task, Opus): the save module.** Codes H3, then H2, then H1, in that order. Each code gets its own commit.
1. Back up Joe's seed 1234 save text to the scratchpad.
2. Export a live fixture from a throwaway seed. Populate every slice field in the overworld, the Ember slice, and the Crystal slice: furnace and chest, home, liquid queue, leaf queue, farm cell, boat and cart, looted chest, `crystalBack`, and `boss`. Save the text as `tests/fixtures/save-live.json`.
3. Build H3. Assert that the fixture passes the moved `validSave`, unchanged.
4. Build H2 and the save-sweep rule.
5. Build H1 and the save-reader rule.

**Step 2 (one wave, five parallel tasks).** Each task starts from the Step 1 merge commit in its own worktree.
- 2a, H4 (Opus): reproduce first, then fix. Files: `portal-frame.js`, `tests/portals.test.js`.
- 2b, H6 (Sonnet). Files: `config.js`, `main.js`, the `readyAround` line in `realms.js`, `README.md`, `tests/config.test.js`. 2b is the only Step 2 task that edits `realms.js`.
- 2c, H7 (Sonnet). Files: `portals.js`.
- 2d, H8 (Sonnet). Files: `persist.js`.
- 2e, H9 (Haiku). Files: `tools/depcheck.js`, `tests/depcheck.test.js`.

**Step 3 (one task, Sonnet).** H5, then H10, as two commits. Both edit `realms.js`, so they cannot run beside 2b.

Each step closes with these actions: merge, rebuild `index.html`, run `npm run check`, run the Playwright QA for the step, and update the docs.

### Acceptance tests

- **H1**
  - `npm test` passes the save-reader test and its fail proof.
  - `readSave` returns a reason for each of these: empty JSON, a wrong seed, a truncated text, and no `player`.
  - In Playwright with a throwaway seed:
    - A corrupt save in `SAVE_KEY` gives a fresh world, a toast, and a backup key that holds the exact text.
    - A save that passes `readSave` but throws in apply gives the same result after one reload. Inject the throw with a scratch-only patch, then revert the patch.
  - Seed 1234 opens with Continue, at the same position, with the boss still defeated.
- **H2**
  - The live fixture passes `validSave`.
  - The save-sweep passes, and its fail proof fails as described.
  - Imports of `liquids: [[null]]`, `leaves: [null]`, a furnace with no `burn`, a home with no `yaw`, and `inv.sel: 99` each show the "not a Clonecraft world save" alert. Test these in Playwright, or with `validSave` in Node.
- **H3**
  - `node tools/depcheck.js` passes with `save-format` in `PURE`, and the pure fail proof fails.
  - An `editsOf(mapsOf(x))` round trip equals `x` on the fixture's edits.
  - A `B.LEAVES` edit loads as `B.LEAVES_PLACED`.
- **H4**
  - The Node portal-seal test is red before the fix.
  - The Playwright repro: travel from the Ember Realm below y 64 to an overworld ocean with no portal within 128 blocks. The panes disappear within 2 s.
  - After the fix, both checks pass, and the platform portal over the ocean still works after 10 s.
  - If the in-game repro fails, record that result. The fix then stays out.
- **H5** (Playwright, throwaway seed): bring the Titan to 0 HP, then travel within 3 s. Test both cases: death plus respawn, and walking into the arrival portal. Then reload. The save holds `defeated: true`. The crystal stash holds the exit portal and the loot. The victory screen shows once.
- **H6**
  - `npm test` passes the rd-ready test and its fail proof.
  - `?rd=2` loads, with the render distance set to 3.
- **H7** (Playwright, throwaway seed, boss defeated): mining an exit frame block does nothing, and TNT next to the exit portal does not break it. Before the kill, the arena edits behave as they do today.
- **H8** (Playwright): put stacks in the craft grid and fill the inventory. Close the tab, then reopen the world. The leftover lies as drops at the player, and the item counts match the counts before the reload.
- **H9**: the planted IIFE test passes, and it is red without the fix. `node tools/depcheck.js` passes on the live source.
- **H10**: grep shows no bare 8, 64, 33, or 110 in `defaultTarget`, and no read of `label`. Ember travel still lands at the same spot as before. Compare one `defaultTarget` result before and after.

### Gates

- Each step closes when all of its gate boxes are checked and `npm run check` passes on the merged branch.
- These gates need owner review. They cannot be automated, and rsh does not declare them done:
  - Joe reviews the boot fallback's toast text and the backup key policy.
  - Joe confirms that his seed 1234 world is intact after Step 1.
  - Joe approves each step merge.
  - Joe approves the release tag.
