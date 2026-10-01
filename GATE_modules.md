# GATE: modules

The acceptance criteria come from `SPEC_modules.md`. `[x]` means I observed it. `[ ]` means it is not verified. A note tells why.

## Spec

- [x] Joe approves `SPEC_modules.md` (2026-10-01, "Q1 I approve").

## Step 0: init

- [x] T1: `git status` is clean. The tag `baseline-single-file` holds `index.html` with 511,486 bytes. `HANDOFF.md`, `node_modules/`, and `dist/` are not tracked.
- [x] The commit author is `ubuntuyou`. The commit holds no PII and no co-author trailer.

## Step 1: pipeline (gate G1)

- [ ] T2: `npm run build` exits 0 with no warning. Two runs give the same SHA-256.
- [ ] T3: the built script equals the baseline script (PA3, empty edit list). The CSS and markup equal baseline lines 1–372, except the generated-file comment and the script tag.
- [ ] T4: the built file loads over `http://` in Chromium with 0 console errors and 0 warnings. A world starts.
- [ ] T5: the built file loads over `file://` in Chromium with 0 console errors. A world starts.
- [ ] T6: in the built file, `clonecraft.world.gen.fallback === false` after the world starts.
- [ ] `vite` is pinned to an exact 7.x version. `vite-plugin-singlefile` is pinned to an exact 2.x version. `package-lock.json` is committed.
- [ ] The build does not minify, tree-shake, or down-level the code.

## Step 2: split (gate G2)

- [ ] T7: `tools/parity.js` passes PA1, PA2, and PA3. The 9 setters and the 11 write sites are the only edits.
- [ ] T8: `tools/depcheck.js` passes: every import obeys D39; every free name in a module is an import or a listed host global; `worldgen.js` has zero imports; the nine modules do not reach `order.js`; `order.js` lists each module once; no module imports `main.js`.
- [ ] T9: `tools/depcheck.js` fails on a planted break of each rule. Each plant is removed after the check.
- [ ] `src/` holds `order.js` and the 43 modules of the module map, in the load order of the map.
- [ ] `tools/split.js` wrote every module. No module holds a hand edit.
- [ ] T10: dev mode (`npm run dev`) loads in Chromium with 0 console errors. A world starts.
- [ ] T11: the built file passes T4, T5, and T6 again.
- [ ] T12: smoke test on the built file, seed 12345, with 0 console errors: break a block, place a block, open and close the inventory, craft one item, pause and resume, save, reload, and find the edit and the item still there.
- [ ] T12: a save made by the baseline loads in the built file.
- [ ] `window.clonecraft` in the built file has the same keys as in the baseline.
- [ ] T13: at the stress view, the built file is at most 5% slower than the baseline. Each file is measured 3 times in turn on the same machine; the medians are compared.
- [ ] The root `index.html` holds the generated-file comment after the doctype.

## Step 3: tests

- [ ] T14: `worldgen` tests pass: the same seed gives the same chunk bytes twice; an instance built from `WorldGenModule.toString()` gives the same chunk as a direct instance; the hashes of three fixed chunks match recorded values.
- [ ] T15: `blocks` tests pass: the ids in `B` and `I` are unique and do not overlap; each `B` id has a `BLOCKS` entry; each `I` id has an `ITEMS` entry.
- [ ] T16: `crafting` tests pass: three known recipes match; an empty grid gives `null`; a shaped recipe smaller than the grid matches at each offset and when mirrored.
- [ ] T17: `npm run check` exits 0.
- [ ] T17: `npm run check` exits non-zero after a one-character edit of the root `index.html`. The file is restored after the check.

## Step 4: docs (gate G3)

- [ ] T18: the built script at Step 4 has the same token stream as the built script at Step 2.
- [ ] T19: `ARCHITECTURE.md` holds D36–D42 and the seams S1–S4.
- [ ] T19: `README.md` gives the dev, build, test, and check commands.
- [ ] T19: `CHANGELOG.md` `[Unreleased]` records the change.
- [ ] T19: no doc states that the project has no build step. No doc points at a baseline line number.
- [ ] T19: `DISCOVERY_build.md` exists and records the Vite 7 pin and the reason.
- [ ] T20: each module over 150 lines starts with a section banner or a living header.
- [ ] The living header in `src/order.js` describes the module layout.

## Step 5: close

- [ ] G4, owner review (Joe): the built file runs from `file://` in Firefox.
- [ ] G5, owner review (Joe): the built file loads and plays on the Nvidia laptop and the Arc laptop.
- [ ] G6, owner review (Joe): a short play check finds no change in feel.
- [ ] G7, owner decision (Joe): the replacement wording for the removed `GATE.md` Delivery item.
- [ ] After Joe approves: `tools/split.js`, `tools/parity.js`, and `tools/modmap.json` are removed. `npm run check` still exits 0.
