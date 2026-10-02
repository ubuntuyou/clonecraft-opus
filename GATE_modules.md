# GATE: modules

The acceptance criteria come from `SPEC_modules.md`. `[x]` means I observed it. `[ ]` means it is not verified. A note tells why.

## Spec

- [x] Joe approves `SPEC_modules.md` (2026-10-01, "Q1 I approve").

## Step 0: init

- [x] T1: `git status` is clean. The tag `baseline-single-file` holds `index.html` with 511,486 bytes. `HANDOFF.md`, `node_modules/`, and `dist/` are not tracked.
- [x] The commit author is `ubuntuyou`. The commit holds no PII and no co-author trailer.

## Step 1: pipeline (gate G1)

- [x] T2: `npm run build` exits 0 with no warning. Two runs give the same SHA-256. (2026-10-01: SHA-256 `42f03281…` on two runs; the log has no warning.)
- [x] T3: the built script equals the baseline script (PA3, empty edit list). The CSS and markup equal baseline lines 1–372, except the generated-file comment and the script tag. (`node tools/parity.js --unsplit`: 8,680 non-blank lines equal. A planted `REACH = 6` fails the check.)
- [x] T4: the built file loads over `http://` in Chromium with 0 console errors and 0 warnings. A world starts. (seed 12345: 293 chunks, state `playing`, frames advance.)
- [x] T5: the built file loads over `file://` in Chromium with 0 console errors. A world starts. (0 errors and 0 warnings.)
- [x] T6: in the built file, `clonecraft.world.gen.fallback === false` after the world starts. (4 workers over `http://` and over `file://`.)
- [x] `vite` is pinned to an exact 7.x version. `vite-plugin-singlefile` is pinned to an exact 2.x version. `package-lock.json` is committed. (vite 7.3.6, vite-plugin-singlefile 2.3.3.)
- [x] The build does not minify, tree-shake, or down-level the code. (`vite.config.js`: `minify: false`, `treeshake: false`, `target: 'esnext'`.)

## Step 2: split (gate G2)

- [x] T7: `tools/parity.js` passes PA1, PA2, and PA3. The 9 setters and the 11 write sites are the only edits. (Also PAGE. 8,689 non-blank lines. A planted `REACH = 6` in `src/config.js` fails PA2.)
- [x] T8: `tools/depcheck.js` passes: every import obeys D39; every free name in a module is an import or a listed host global; `worldgen.js` has zero imports; the nine modules do not reach `order.js`; `order.js` lists each module once; no module imports `main.js`.
- [x] T9: `tools/depcheck.js` fails on a planted break of each rule. Each plant is removed after the check. (`tests/depcheck.test.js`: 12 of 12. Each plant goes into a temporary copy of `src/`.)
- [x] `src/` holds `order.js` and the 43 modules of the module map, in the load order of the map. (2026-10-01: the fireflies feature adds a 44th module, `fireflies.js`, listed in the map after `weather`.)
- [x] `tools/split.js` wrote every module. No module holds a hand edit. (A second run of `tools/split.js` gives the same hash of `src/*.js`.)
- [x] T10: dev mode (`npm run dev`) loads in Chromium with 0 console errors. A world starts. (Port 5281, seed 12345, 4 workers, 0 console messages.)
- [x] T11: the built file passes T4, T5, and T6 again. (Over `http://` and `file://`: 4 workers, `fallback` false, 0 console messages.)
- [x] T12: smoke test on the built file, seed 12345, with 0 console errors: break a block, place a block, open and close the inventory, craft one item, pause and resume, save, reload, and find the edit and the item still there. (Broke grass at -9, 139, 21. Placed a log at -9, 140, 23. Crafted 4 planks from 1 log by slot clicks. After the reload: air, log, 4 planks, 2 logs. 0 console messages.)
- [x] T12: a save made by the baseline loads in the built file. (Seed 31337: the broken block, the placed log, and 7 logs in the inventory load in the built file.)
- [x] `window.clonecraft` in the built file has the same keys as in the baseline. (98 keys, same names, same order.)
- [x] T13: at the stress view, the built file is at most 5% slower than the baseline. Each file is measured 3 times in turn on the same machine; the medians are compared. (3240×2025, device pixel ratio 1, seed 12345, spawn view, 6 s after 2 s warm-up. Baseline 20.8, 21.8, 23.3 fps; median 21.8. Built 20.8, 23.3, 23.0 fps; median 23.0. 90th-percentile frame 51.1 ms and 51.1 ms.)
- [x] The root `index.html` holds the generated-file comment after the doctype. (Line 2. The root file equals `dist/index.html`.)

## Step 3: tests

- [x] T14: `worldgen` tests pass: the same seed gives the same chunk bytes twice; an instance built from `WorldGenModule.toString()` gives the same chunk as a direct instance; the hashes of three fixed chunks match recorded values. (Chunks 0,0; 5,-3; -12,7 at seed 12345. The hashes come from the baseline `WorldGenModule`, cut from the git tag. A planted change in `hash3` fails all three; the file is restored.)
- [x] T15: `blocks` tests pass: the ids in `B` and `I` are unique and do not overlap; each `B` id has a `BLOCKS` entry; each `I` id has an `ITEMS` entry.
- [x] T16: `crafting` tests pass: three known recipes match; an empty grid gives `null`; a shaped recipe smaller than the grid matches at each offset and when mirrored. (Planks, stone pickaxe, furnace. Sticks at all 6 offsets. The axe mirrored and shifted.)
- [x] T17: `npm run check` exits 0. (depcheck pass, 29 of 29 tests, the root file equals a fresh build.)
- [x] T17: `npm run check` exits non-zero after a one-character edit of the root `index.html`. The file is restored after the check. (A space added on line 5: exit 1. `git checkout` restored the file.)

## Step 4: docs (gate G3)

- [x] T18: the built script at Step 4 has the same token stream as the built script at Step 2. (acorn tokenizer: 139,672 tokens each, no difference. A planted `REACH = 9` fails at token 47. The only markup change is the HTML comment in `src/index.html`.)
- [x] T19: `ARCHITECTURE.md` holds D36–D42 and the seams S1–S4. (grep: 7 headings, S1–S4 rows.)
- [x] T19: `README.md` gives the dev, build, test, and check commands. (Section "Develop".)
- [x] T19: `CHANGELOG.md` `[Unreleased]` records the change. (Two lines under "Changed".)
- [x] T19: no doc states that the project has no build step. No doc points at a baseline line number. (`SPEC_expansion.md` and `SPEC_graphics.md` carry dated superseded notes. `SPEC_modules.md` cites baseline lines on purpose: it describes the tag.)
- [x] T19: `DISCOVERY_build.md` exists and records the Vite 7 pin and the reason. (Gotchas, first item.)
- [x] T20: each module over 150 lines starts with a section banner or a living header. (Script: every such module has a comment in its first 3 lines. `atlas.js`, `post.js`, and `player.js` got new headers.)
- [x] The living header in `src/order.js` describes the module layout. ("Module layout" block; the section map names the modules.)

## Step 5: close

- G4 removed by Joe on 2026-10-01: "I do not use Firefox." (Was: the built file runs from `file://` in Firefox.)
- [x] G5, owner review (Joe): the built file loads and plays on the Nvidia laptop and the Arc laptop. (Joe, 2026-10-01 09:15 CT: "Works on both laptops.")
- [x] G6, owner review (Joe): a short play check finds no change in feel. (Joe, 2026-10-01 09:23 CT: yes.)
- [x] G7, owner decision (Joe): the replacement wording for the removed `GATE.md` Delivery item. (Joe approved it 2026-10-01 09:01 CT. `GATE_game.md` "Delivery" holds it.)
- [x] After Joe approves: `tools/split.js`, `tools/parity.js`, and `tools/modmap.json` are removed. `npm run check` still exits 0. (depcheck pass, 29 of 29 tests, the root file equals a fresh build.)
