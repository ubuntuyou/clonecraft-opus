# SPEC: modules (split the source, build one file)

Status: approved by Joe on 2026-10-01 ("Q1 I approve"). Requested by Joe on 2026-10-01 ("deep spec o2 to a file").
Gate: `GATE_modules.md`.

Terms used in this spec:

- **Baseline**: `index.html` as it is today (9,385 lines, 511,486 bytes). Step 0 tags it `baseline-single-file`.
- **Baseline script**: baseline lines 430–9382, the body of the one `<script type="module">`.
- **Module**: one file in `src/` that `src/order.js` lists.
- **Load order**: the order in which the browser evaluates the modules.
- **Built file**: the root `index.html` that `npm run build` writes.
- **Upward name**: a name that a module uses from a later module in the load order.
- **Setter**: a function that assigns one `let` binding for another module.

## Part 1: General

### Scope

The source moves from one 9,385-line file to 43 modules in `src/`. A build writes one HTML file. The built file runs the same code as the baseline, in the same order.

The spec opens four seams:

- S1: `src/order.js`. It pins the load order and re-exports the upward names.
- S2: the build. `src/` goes in; the built file comes out.
- S3: the setters. They are the only way to write another module's binding.
- S4: `src/worldgen.js`. It has no imports, so the worker and Node can both load it.

### Constraints

- C1: Behaviour does not change. The game, the saves, and the `window.clonecraft` handle stay the same.
- C2: The built file is one HTML file. It needs no server-side step and no asset. Three.js r160 still comes from the CDN.
- C3: The built file runs from `http://` and from `file://`.
- C4: The module bodies keep the baseline text. The only code edits are the 9 setters and the 11 write sites in "Interfaces".
- C5: The modules keep the baseline order. No statement moves relative to another statement.
- C6: The build does not minify, tree-shake, or down-level the code.
- C7: No formatter runs on `src/` during this spec. A formatter breaks the text check.
- C8: Frame rate is measured on the built file only. Dev mode loads 43 files and is not a performance target.
- C9: Commits use Conventional Commits, the author `ubuntuyou`, and no co-author trailer.

### Non-goals

- N1: No redesign to remove upward names. `order.js` carries them.
- N2: No unit tests for collision, lighting, or the mesher. They reach `world`, the renderer, and the atlas canvas.
- N3: No CSS or markup extraction. Both stay inline in `src/index.html`.
- N4: No TypeScript, no linter, no formatter, no minification.
- N5: No separate worker file. The worker stays a Blob made from `WorldGenModule.toString()`.
- N6: No regrouping of modules across the baseline order. That is a later, separate change.
- N7: No inline `export` keywords. Each module keeps one export list at its end.
- N8: No specialist-rag domain for this project.
- N9: No hot module replacement. Dev mode reloads the page.

## Part 2: Product

### What to build

#### D36. The source lives in `src/`; the built file is generated and committed

`src/index.html` holds the CSS, the markup, and `<script type="module" src="./main.js">`. `npm run build` writes the root `index.html`. Git tracks the built file, so Joe can open it or copy it to a laptop without Node. A comment after the doctype says that the root file is generated and that edits go in `src/`. `npm run check` fails when the root `index.html` differs from a fresh build.

#### D37. The build is Vite 7 with `vite-plugin-singlefile`, pinned

Pin `vite` to 7.x and `vite-plugin-singlefile` to 2.x with exact versions in `package.json`. Commit `package-lock.json`.

Do not use Vite 8. Vite 8 bundles with Rolldown. In a fixture on 2026-10-01, Vite 8.3.2 removed comments, changed top-level `const` to `var`, and inlined constants. Vite 7.3.6 (Rollup 4) kept the module text unchanged.

Build settings: `minify: false`, `target: 'esnext'`, `modulePreload: false`, `rollupOptions.treeshake: false`. The CDN import of Three.js stays an external URL import.

Known Vite 7 additions to the built file, seen in the fixture:

- The script tag moves into `<head>` and gains `crossorigin`. A module script is deferred, so it still runs after the markup parses.
- One line `const index_html_htmlProxy_inlineCss_index_0 = '';` appears in the script.
- Blank lines separate the modules.

Fallback: if Step 1 fails on Vite 7, use Rollup 4 directly with a small inline step. Stop and ask Joe before the switch.

#### D38. `src/order.js` pins the load order

`order.js` lists every module once, in load order. `main.js` imports `./order.js` before anything else. `order.js` holds the living header.

A line in `order.js` has one of two forms:

- `import './config.js';` for a module with no upward names.
- `export { inv, selectSlot } from './inventory.js';` for a module with upward names.

The browser evaluates a module's imports depth-first. `order.js` is in progress during the whole load. An import of `./order.js` from inside a module is therefore skipped and never changes the order.

#### D39. One import rule

- A module imports an **earlier** module's name directly: `import { CS, H } from './config.js';`.
- A module imports a **later** module's name from `./order.js`: `import { mobs } from './order.js';`.
- A module uses an upward name only inside a function body. The baseline already obeys this. The page load proves it: a break throws a `ReferenceError` at load.
- A module never imports `./main.js`.

`tools/depcheck.js` enforces the rule.

#### D40. Setters replace cross-module writes

An imported binding is read-only. Nine `let` bindings have writes from another module. The owner module gains one setter per binding. Each foreign write site calls the setter. See "Interfaces" for the list.

#### D41. The worker keeps the Blob and `toString()`

`src/worldgen.js` holds `WorldGenModule` and has zero imports. `GenService` still builds the worker from `WorldGenModule.toString()`. The build keeps the function text, so the worker source equals the baseline.

#### D42. Text proves parity

The built script equals the baseline script, line for line, except a fixed list of differences. `tools/parity.js` checks this. The full `GATE.md` re-run is not needed. A browser smoke test and Joe's review cover what text cannot: the load, the worker, and the frame rate.

#### Tests

`node --test` runs the tests. Only three modules are free of the DOM and the renderer:

- `worldgen`: no outside names and no host globals.
- `blocks`: needs `config` only.
- `crafting`: needs `blocks` and `config` only.

`config` reads `location`, `localStorage`, and `history` at load. `tests/host-stub.js` sets minimal stand-ins on `globalThis` before a test imports `blocks` or `crafting`. With such stand-ins, the baseline text of `config`, `blocks`, and `crafting` loads in Node today (measured).

### Where it lives

```
index.html          built file (generated, committed)
package.json        scripts and pinned dev dependencies
package-lock.json
vite.config.js
.gitignore          node_modules/, dist/, .DS_Store
src/index.html      CSS, markup, one script tag
src/order.js        living header, load order, upward names
src/main.js         imports order.js; frame loop; window.clonecraft
src/<module>.js     42 more modules (table below)
tools/depcheck.js   import-rule check (permanent)
tools/uiscan.js     unchanged; it runs in the page
tools/modmap.json   module map and edit list (removed at close)
tools/split.js      writes src/ from the baseline (removed at close)
tools/parity.js     text check against the baseline (removed at close)
tests/*.test.js     node --test
tests/host-stub.js
```

#### Module map

The load order equals the row order. "Lines" are baseline line numbers. The 43 ranges cover lines 430–9382 once, with no gap and no overlap (measured). Each range parses as a module on its own (measured). The living header (lines 374–429) moves to `src/order.js`.

| # | Module | Lines | Size | Content |
|---|---|---|---|---|
| 1 | `three` | 430–432 | 3 | CDN import, `ColorManagement` off, `export { THREE }` |
| 2 | `config` | 433–518 | 86 | section 1: constants, URL and settings, RNG helpers |
| 3 | `blocks` | 519–983 | 465 | section 2: block and item registry |
| 4 | `biomes` | 984–1005 | 22 | section 3 head: biome ids and tints |
| 5 | `atlas` | 1006–2047 | 1042 | section 3: procedural texture atlas |
| 6 | `worldgen` | 2048–2806 | 759 | sections 4–5: `WorldGenModule` |
| 7 | `gen-service` | 2807–2883 | 77 | `GEN_CONSTS`, `WG`, `GenService` |
| 8 | `world` | 2884–3311 | 428 | sections 6–7: chunks, edits, lighting |
| 9 | `mesher` | 3312–3830 | 519 | section 8: `buildChunkMesh` |
| 10 | `terrain-material` | 3831–4076 | 246 | terrain and water shaders |
| 11 | `engine` | 4077–4120 | 44 | section 9: renderer, scene, camera |
| 12 | `player` | 4121–4475 | 355 | player state, input, movement |
| 13 | `collision` | 4476–4600 | 125 | section 10: `moveEntity` |
| 14 | `interact` | 4601–5097 | 497 | section 11: raycast, break, place, use |
| 15 | `liquids` | 5098–5192 | 95 | water and lava flow |
| 16 | `leaf-decay` | 5193–5265 | 73 | leaf decay |
| 17 | `farming` | 5266–5371 | 106 | crops and growth |
| 18 | `targeting` | 5372–5495 | 124 | `world.onEdit` wiring, selection box, crack overlay, `updateInteraction` |
| 19 | `drops` | 5496–5570 | 75 | item drops |
| 20 | `held-item` | 5571–5767 | 197 | section 12: item meshes, view model |
| 21 | `inventory` | 5768–5889 | 122 | section 13: `inv`, slots, dropping |
| 22 | `crafting` | 5890–5964 | 75 | `RECIPES`, `matchRecipe` |
| 23 | `craft-grid` | 5965–5974 | 10 | `craftGrid`, `craftOutput`, `consumeCraft` |
| 24 | `tile-entities` | 5975–6085 | 111 | furnaces, chests |
| 25 | `inventory-ui` | 6086–6482 | 397 | inventory and container screens |
| 26 | `mobs` | 6483–6952 | 470 | section 14: mobs |
| 27 | `vehicles` | 6953–7208 | 256 | boats, carts, rails |
| 28 | `projectiles` | 7209–7305 | 97 | arrows |
| 29 | `explosions` | 7306–7375 | 70 | TNT |
| 30 | `spawning` | 7376–7542 | 167 | spawn rules, spawners |
| 31 | `particles` | 7543–7785 | 243 | section 15: particles |
| 32 | `audio` | 7786–8011 | 226 | generated sound |
| 33 | `hud` | 8012–8155 | 144 | section 16: HUD |
| 34 | `menus` | 8156–8237 | 82 | game state, pause, fade |
| 35 | `persist` | 8238–8373 | 136 | save, load, export, import |
| 36 | `homes` | 8374–8442 | 69 | Homes screen |
| 37 | `sky` | 8443–8684 | 242 | section 17: sky, sun, moon |
| 38 | `weather` | 8685–8890 | 206 | rain, snow, storms |
| 39 | `boot` | 8891–8969 | 79 | section 18: spawn search, start |
| 40 | `shadows` | 8970–9062 | 93 | shadow pass |
| 41 | `held-light` | 9063–9125 | 63 | held torch light |
| 42 | `post` | 9126–9306 | 181 | bloom and light shafts |
| 43 | `main` | 9307–9382 | 76 | frame loop, `window.clonecraft` |

`craft-grid` is 10 lines on purpose. It sits between `crafting` and `tile-entities` in the baseline, and it needs `inv`. A merge into `crafting` makes `crafting` depend on the DOM. A merge into `inventory` moves code (C5).

### Interfaces

#### A module file

1. Import lines.
2. The baseline lines of the module, unchanged except the edits below.
3. The module's setters, if any.
4. One line: `export { name, name, ... };`.

The split measures 281 exported names. `tools/split.js` derives each import and export list from the baseline with a parser. Nobody writes the lists by hand.

#### Upward names in `order.js` (44 names, measured)

| Module | Names |
|---|---|
| `mesher` | `buildChunkMesh` |
| `terrain-material` | `terrainMaterial`, `waterMaterial` |
| `collision` | `moveEntity` |
| `interact` | `primaryClick`, `bow`, `useItem` |
| `farming` | `farming` |
| `drops` | `spawnDrop` |
| `held-item` | `makeItemMesh`, `viewModel` |
| `inventory` | `inv`, `selectSlot`, `dropStack`, `dropHeld`, `dropEverything` |
| `tile-entities` | `spillTileEntity` |
| `inventory-ui` | `renderInventory`, `openInventory`, `closeInventory`, `inventoryKey` |
| `mobs` | `mobs` |
| `vehicles` | `vehicles` |
| `projectiles` | `ARROW_GRAVITY`, `projectiles` |
| `explosions` | `explode`, `primeTnt` |
| `spawning` | `spawnHostiles`, `spawners` |
| `particles` | `particles` |
| `audio` | `audio` |
| `hud` | `hud` |
| `menus` | `setState`, `showPause`, `fadeIn`, `clockText` |
| `persist` | `persist` |
| `homes` | `homes`, `homesEl`, `openHomes`, `homesKey`, `setHomes` |
| `weather` | `weather` |
| `held-light` | `heldLight` |

Nine modules never reach `order.js`, directly or through an import: `three`, `config`, `blocks`, `biomes`, `atlas`, `worldgen`, `gen-service`, `terrain-material`, `crafting`. `tools/depcheck.js` keeps them that way.

#### Setters (9 setters, 11 write sites, measured)

| Binding | Owner | Setter | Foreign write sites (baseline line) |
|---|---|---|---|
| `glowGain` | `config` | `setGlowGain(v)` | `post` 9264 |
| `enchantSeed` | `blocks` | `setEnchantSeed(v)` | `inventory-ui` 6208, `persist` 8300 |
| `escLock` | `player` | `setEscLock(v)` | `menus` 8168 |
| `pausedAt` | `player` | `setPausedAt(v)` | `menus` 8177 |
| `target` | `interact` | `setTarget(v)` | `targeting` 5434, 5438 |
| `targetMob` | `interact` | `setTargetMob(v)` | `targeting` 5436 |
| `targetVehicle` | `interact` | `setTargetVehicle(v)` | `targeting` 5437 |
| `homes` | `homes` | `setHomes(v)` | `persist` 8296 |
| `last` | `boot` | `setLast(v)` | `main` 9311 |

A setter is one line: `function setTarget(v) { target = v; }`. A write site keeps its right-hand side: `target = expr;` becomes `setTarget(expr);`. A write inside the owner module does not change.

#### Commands

| Command | Result |
|---|---|
| `npm run dev` | Vite serves `src/` with native modules. It needs `http://`. |
| `npm run build` | Writes the root `index.html`. Two runs give the same bytes. |
| `npm test` | Runs `node --test "tests/**/*.test.js"`. Node 25 rejects a bare folder. |
| `npm run check` | Runs `tools/depcheck.js`, the tests, and the fresh-build comparison. |

#### The parity check (`tools/parity.js`)

`tools/modmap.json` holds the module ranges, the 9 setter lines, and the 11 write-site edits. `tools/parity.js` reads the baseline from the tag and checks three things:

- PA1: the ranges cover lines 430–9382 once, in order.
- PA2: each `src/<module>.js`, without its import lines and its export line, equals its baseline lines plus its listed edits. Blank lines do not count.
- PA3: the built script, without blank lines and the Vite CSS line, equals the baseline script without blank lines, plus the listed edits. The order is the baseline order. The living header may sit at a different place.

It also checks that the CSS and the markup of the built file equal baseline lines 1–372, except the generated-file comment and the script tag.

### Patterns to follow

- `world.onEdit` and `world.onChunkLoaded` are the existing hook pattern (baseline lines 5373, 7388, 7413). Leave them as they are.
- Section banners stay in the module bodies. A search for `=== N.` still works in `src/` and in the built file.
- Controlled English in every comment and doc, per `~/.claude/standards/core/docs.md`.
- One name per concept: baseline, module, load order, built file, upward name, setter.

## Part 3: Execution

### Build order

Each step works on a branch `step/<n>-<slug>` and ends with one Conventional Commit.

**Step 0: init.** Run `git init`. Add `.gitignore`. Commit the project as it is. Tag the commit `baseline-single-file`.

**Step 1: pipeline.** Add `package.json`, `vite.config.js`, and `src/index.html`. Put the whole baseline script in `src/main.js`, unsplit. Build. Prove that the build keeps the text (PA3 with an empty edit list). Load the built file over `http://` and `file://`. This step proves D37 before any split work. If it fails, stop and ask Joe.

**Step 2: split.** Write `tools/modmap.json`, `tools/split.js`, `tools/depcheck.js`, and `tools/parity.js`. Run `tools/split.js` to write `src/order.js` and the 43 modules. Do not move code by hand. Run the checks. Smoke-test dev mode and the built file. Compare the frame rate with the baseline at the stress view (seed 12345, viewport 3240×2025).

**Step 3: tests.** Add the tests for `worldgen`, `blocks`, and `crafting`.

**Step 4: docs.** Rewrite the living header in `src/order.js` for the module layout. Add a short living header to each module over 150 lines that has no section banner. Update `ARCHITECTURE.md` (D36–D42 and the Seams table), `DISCOVERY_engine.md` (line pointers become module pointers), `README.md` (run, dev, build, test), and `CHANGELOG.md`. Add `DISCOVERY_build.md` for the build gotchas. Step 4 changes comments only. The token check in T18 proves it.

**Step 5: close.** Joe reviews. After Joe approves, remove `tools/split.js`, `tools/parity.js`, and `tools/modmap.json`. The tag keeps the baseline.

### Acceptance tests

Step 0:

- T1: `git status` is clean. The tag `baseline-single-file` holds `index.html` with 511,486 bytes. `HANDOFF.md`, `node_modules/`, and `dist/` are not tracked.

Step 1:

- T2: `npm run build` exits 0 with no warning. Two runs give the same SHA-256.
- T3: the built script equals the baseline script (PA3, empty edit list). The CSS and markup equal baseline lines 1–372, except the comment and the script tag.
- T4: the built file loads over `http://` in Chromium with 0 console errors and 0 warnings. A world starts.
- T5: the built file loads over `file://` in Chromium with 0 console errors. A world starts.
- T6: in the built file, `clonecraft.world.gen.fallback === false` after the world starts.

Step 2:

- T7: `tools/parity.js` passes PA1, PA2, and PA3 with the 9 setters and 11 write sites as the only edits.
- T8: `tools/depcheck.js` passes: every import obeys D39; every free name in a module is an import or a listed host global; `worldgen.js` has zero imports; the nine modules do not reach `order.js`; `order.js` lists each module once; no module imports `main.js`.
- T9: `tools/depcheck.js` fails on a planted break of each rule. Remove each plant after the check.
- T10: dev mode (`npm run dev`) loads in Chromium with 0 console errors. A world starts.
- T11: the built file passes T4, T5, and T6 again.
- T12: smoke test on the built file, seed 12345, with 0 console errors: break a block, place a block, open and close the inventory, craft one item, pause and resume, save, reload, and find the edit and the item still there. A save made by the baseline loads in the built file.
- T13: at the stress view, the built file is at most 5% slower than the baseline. Measure each file 3 times in turn on the same machine and compare the medians.

Step 3:

- T14: `worldgen` tests pass: the same seed gives the same chunk bytes twice; an instance built from `WorldGenModule.toString()` gives the same chunk as a direct instance; the hashes of three fixed chunks match recorded values.
- T15: `blocks` tests pass: the ids in `B` and `I` are unique and do not overlap; each `B` id has a `BLOCKS` entry; each `I` id has an `ITEMS` entry.
- T16: `crafting` tests pass: three known recipes match; an empty grid gives `null`; a shaped recipe smaller than the grid matches at each offset and when mirrored.
- T17: `npm run check` exits 0. It exits non-zero after a one-character edit of the root `index.html`. Restore the file after the check.

Step 4:

- T18: the built script at Step 4 has the same token stream as the built script at Step 2. Comments and blank lines are the only differences.
- T19: `ARCHITECTURE.md` holds D36–D42 and the four seams. `README.md` gives the dev, build, test, and check commands. `CHANGELOG.md` `[Unreleased]` records the change. No doc states that the project has no build step. No doc points at a baseline line number.
- T20: each module over 150 lines starts with a section banner or a living header.

### Gates

- G1 (after Step 1): T2–T6 pass. This gate decides Vite 7 or the Rollup fallback.
- G2 (after Step 2): T7–T13 pass.
- G3 (after Step 4): T14–T20 pass.
- G4, owner review (Joe): the built file runs from `file://` in Firefox.
- G5, owner review (Joe): the built file loads and plays on the Nvidia laptop and the Arc laptop.
- G6, owner review (Joe): a short play check finds no change in feel.
- G7, owner decision (Joe): the replacement for the `GATE.md` Delivery item "One HTML file. Three.js r160 comes from a CDN. No build tools and no external assets." Joe removed the item on 2026-10-01 and asked for new wording.

### Risks

- R1: Vite 7 is the last Rollup-based line. A later upgrade to Vite 8 rewrites the code. The pin and `DISCOVERY_build.md` guard this.
- R2: the built file can go stale when someone edits `src/` and forgets the build. `npm run check` guards this.
- R3: an agent can edit the root `index.html` by habit. The generated-file comment, `HANDOFF.md`, and `npm run check` guard this.
- R4: the split tool can mis-derive an import list. A missing import throws a `ReferenceError` only when that code runs, so a smoke test can miss it. The free-name rule in T8 catches it without a run.
- R5: I did not run the full baseline script through Vite 7. The fixture was 5 small modules. Step 1 exists to close this risk first.
