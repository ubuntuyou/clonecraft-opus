# GATE: deepen

The gate file for `SPEC_deepen.md`. Check a box only after you verify it yourself. **(owner)** marks a box that only Joe closes. Test names refer to the numbered acceptance tests in the spec (for example `M4-3`). "Step gate" means `node tools/depcheck.js && npm test && npx vite build` on the merged step branch.

## Spec
- [ ] **(owner)** Joe approves `SPEC_deepen.md` and this gate before Step 1. Note by rsh, 2026-11-01: Joe said "Spec everything kept including bugs then fix" (09:24 CT), so the build starts. This box stays open for Joe's review of the spec text.

## Bugs with no code
- [x] K6: not reproduced, unpatched. Design B found no reachable cell where the lower door half places and the upper half fails. (rsh, 2026-11-01: a scan of the arrival and exit lock boxes found 0 such cells.)
- [ ] K11: no code. The invariant is in `DISCOVERY_engine.md` (S7 close).

## Every step (repeat in each step's Integrate box)
The step gate passes. The 109 existing tests pass, and `git diff main -- tests` shows added lines only in existing files. `git diff main -- tests/fixtures` is empty. `save-live.json` passes `readSave`. The sweep baseline is unchanged. For an M step, the string-literal diff review shows no user-visible text change. No expectation was edited to pass. Reindex: N/A (no specialist-rag domain for this repo).

## Wave 1

### S1: boot policy (M4, K7, K10) — `step/deepen-1-boot-policy`
- [x] Contract commit written by the W1 contract agent (opus); rsh reviewed it. S1 6e14dc1; rsh checked Owns by `git diff --stat main`.
- [x] Wave dispatched: T1.1 sonnet, T1.2 sonnet, T1.3 sonnet. (rsh dispatch, 2026-11-01 10:07 CT.)
- [x] Owns check: `git diff --stat` per task touches only its Owns list. Note: `boot.js`, `save-format.js`, `tests/save-format.test.js` only (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Integrate: the "Every step" checks pass. Note: S1 tip 574603e: depcheck pass, 123/123, build ok; tests add lines only; fixtures unchanged; notice texts byte-equal (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] K7 repro (QA, wave base): no reload, `persist.blocked` true, half-applied state. If it does not reproduce, record it here and skip the K7 fix boxes. Note: reproduced at 8ebe3a7 (seed 790007, forced apply throw): no reload, `blocked` true, realm ember, inventory kept, fresh spawn (`/tmp/deepen-clonecraft/wave-notes.md`).
- [x] Unit: M4-1 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-2 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-3 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-4 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-5 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-6 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-7 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-8 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit: M4-9 Note: green on `main` 5bacd88 (`npm run check`, 167/167).
- [x] Unit (K7): M4-10 Note: green on `main` 5bacd88; red on T1.2 497bad7 before T1.1 merged.
- [x] Unit (K7): M4-11 Note: green on `main` 5bacd88; red on T1.2 497bad7 before T1.1 merged.
- [x] Unit (K7): M4-12 Note: green on `main` 5bacd88; red on T1.2 497bad7 before T1.1 merged.
- [x] Unit (K10): M4-13 Note: green on `main` 5bacd88.
- [x] Ported cases: none deleted. Note: `git diff main -- tests` shows 0 removed lines (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: swap backup `set` and `remove` → M4-3 fails. Note: caught by M4-3, M4-4, M4-11 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: drop the `keep` skip → M4-5 fails. Note: caught by M4-5 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: drop `blocked` on an apply throw → M4-8 fails. Note: caught by M4-8, M4-10, M4-11 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: no store carrier on a failed session write → M4-10 fails. Note: caught by M4-10, M4-12b (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: `reload = true` always → M4-11 fails. Note: caught by M4-1..M4-4, M4-11, M4-12b (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: `takeNotice` reads the session only → M4-12 fails. Note: caught by M4-12, M4-12b (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Structure: grep shows `validSlice` is not exported; `takeNotice` and `rejectSave` are gone from `boot.js`; `BOOT_NOTICE` lives only in `save-format.js`. Note: grep on `main` 5bacd88.
- [x] Structure: `order.js` and `PURE` unchanged (`git diff main -- src/order.js tools/depcheck.js` empty). Note: empty on the S1 tip (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] QA: a corrupt save gives a fresh world, the notice, and a backup key with the exact text. Note: seed 791015, backup holds `{bad`, `SAVE_KEY` gone (`/tmp/deepen-clonecraft/w1-qa.md` C).
- [x] QA: K7 fix gives one reload, a fresh world, the notice, `persist.blocked` false, the `.rejected.` key, and no `clonecraft.bootNotice` left in `localStorage`. Note: seed 791006, 2 document requests, no reload loop (`/tmp/deepen-clonecraft/w1-qa.md` D).
- [x] QA: 0 game console errors; throwaway keys removed; `lastSeed` restored; snapshots deleted. Note: 0 errors; storage cleared on every QA origin (ports 8786..8789, not Joe's origin, so no `lastSeed` to restore); boot shots deleted (`/tmp/deepen-clonecraft/w1-qa.md`).
- [x] Docs: `ARCHITECTURE.md` (save-format Seams row names `openSave`, drops `validSlice`); `DISCOVERY_save-format.md` (boot reads only through `openSave`; the K7 carrier); living headers of `boot.js` and `save-format.js`; `CHANGELOG.md` `[Unreleased]` (Changed M4, Fixed K7, Removed K10). Note: fce403d (the `boot.js` header came with the S1 merge).
- [ ] **(owner)** Joe reviews the S1 diff.
- [x] Merged to `main`; task worktrees and branches removed. Note: 5e07936; worktrees d1, d1a..d1c and their branches removed.

### S2: face kind (M5) — `step/deepen-2-face-kind`
- [x] Contract commit (W1 contract agent, opus); rsh reviewed it. S2 6ff79bf.
- [x] Wave dispatched: T2.1 opus, T2.2 sonnet, T2.3 sonnet.
- [x] Owns check by `git diff --stat`. Note: by file; the hunks outside the line ranges are import lines and the `order.js:35` header fix (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Integrate: the "Every step" checks pass. Note: S2 tip 4b079ca: depcheck pass, 130/130, build ok; no user-visible text (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Unit: M5-1 Note: green on `main` 5bacd88.
- [x] Unit: M5-2 Note: green on `main` 5bacd88.
- [x] Unit: M5-3 Note: green on `main` 5bacd88.
- [x] Unit: M5-4 Note: green on `main` 5bacd88.
- [x] Unit: M5-5 (256-byte equivalence, decision 8) Note: green on `main` 5bacd88.
- [x] Unit: M5-6 Note: green on `main` 5bacd88.
- [x] Unit: M5-7 Note: green on `main` 5bacd88.
- [x] Ported cases: none deleted. Note: `tests/face-kind.test.js` is new; 0 removed lines (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: WET 246 → 255 → M5-1 fails. Note: caught by M5-1..M5-5 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: PORTAL_CRYSTAL 172 → 170 → M5-2 fails. Note: caught by M5-2, M5-5 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: swap the PLANT top and base bytes → M5-3 fails. Note: caught by M5-3 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: drop STILL from the wet rule → M5-4 fails. Note: caught by M5-4 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: decode tolerance 0.5 → 0 → M5-5 fails. Note: caught by M5-5 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: leave one kind out of `FACE_GLSL` → M5-6 fails. Note: caught by M5-6 (GLOW left out) (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: put `step(0.45, aTint.a)` back in `shadows.js` → M5-7 fails. Note: caught by M5-7 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Structure: no `SWAY_` constant in `mesher.js`; no `step(0.` reads `aTint.a`; `face-kind` is in `order.js` and `PURE`; the header count is 52. Note: grep on `main` 5bacd88.
- [x] QA: screenshot pairs (overworld day: leaves, water, torch; ember: lava; crystal: crystal, portal) are identical, or each difference is explained here. Note: 0 differing pixels in all 4 scenes, overworld night too (`/tmp/deepen-clonecraft/w1-qa.md` B; PNGs in `/tmp/deepen-clonecraft/qa-w1/`).
- [x] QA: no GLSL compile error; 0 game console errors; cleanup done. Note: `/tmp/deepen-clonecraft/w1-qa.md` A and Notes.
- [x] Docs: `ARCHITECTURE.md` (the face-kind seam, `:30-31`); new `DISCOVERY_face-kind.md`; `DISCOVERY_engine.md` drops the obsolete byte-window gotcha; living headers of `face-kind.js` and `order.js`; `CHANGELOG.md` (Changed M5). Note: 59b1ec4 (D55 and the face kind Seams row); headers came with the S2 merge (4b079ca).
- [ ] **(owner)** Joe reviews the S2 diff.
- [x] Merged to `main`; worktrees and branches removed. Note: e970ebd; worktrees d2, d2a..d2c and their branches removed.

### S3: atlas checks (K3, K4) — `step/deepen-3-atlas-checks`
- [x] Contract commit (W1 contract agent, opus); rsh reviewed it. S3 cd8bec9.
- [x] Wave dispatched: T3.1 sonnet, T3.2 sonnet.
- [x] Owns check by `git diff --stat`. Note: `atlas.js`, `tests/atlas.test.js` only (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Integrate: the "Every step" checks pass. Note: S3 tip 2408024: depcheck pass, 115/115, build ok (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] K4 repro: K3/4-4 is red on the contract commit, before the fix. Note: red on T3.2 7c6bba2 (the contract plus the tests, before T3.1) (`/tmp/deepen-clonecraft/wave-notes.md`).
- [x] Unit: K3/4-1 (the real atlas loads) Note: green on `main` 5bacd88.
- [x] Unit: K3/4-2 Note: green on `main` 5bacd88.
- [x] Unit: K3/4-3 Note: green on `main` 5bacd88.
- [x] Unit: K3/4-4 Note: green on `main` 5bacd88.
- [x] Unit: K3/4-5 Note: green on `main` 5bacd88.
- [x] Ported cases: none deleted. Note: `tests/atlas.test.js` is new (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: `>=` → `>` in the tile-count check → K3/4-4 fails. Note: caught by K3/4-4 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: remove the K3 throw → K3/4-5 fails. Note: caught by K3/4-5, K3/4-6 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Structure: the only new export is `ATLAS_TILES`; no other file changed. Note: `/tmp/deepen-clonecraft/w1-integrate.md`.
- [x] QA: boot with 0 console errors; hotbar and terrain look unchanged. Note: 0 errors; 0 differing pixels in whole frames with the HUD (`/tmp/deepen-clonecraft/w1-qa.md` A, B).
- [x] Docs: `DISCOVERY_engine.md` (the 256-tile limit, 147 free); `atlas.js` header; `CHANGELOG.md` (Fixed K3, K4). Note: 70e8073 (also D56 in `ARCHITECTURE.md`).
- [ ] **(owner)** Joe reviews the S3 diff.
- [x] Merged to `main`; worktrees and branches removed. Note: 1bb34ac; worktrees d3, d3a, d3b and their branches removed.

### S4: realm look (M7, K2) — `step/deepen-4-realm-look`
- [x] Contract commit (W1 contract agent, opus); rsh reviewed it. S4 b3acd5f.
- [x] Wave dispatched: T4.1 sonnet, T4.2 sonnet, T4.3 sonnet.
- [x] Owns check by `git diff --stat`. Note: `/tmp/deepen-clonecraft/w1-integrate.md`.
- [x] Integrate: the "Every step" checks pass. Note: S4 tip c23f4e4: depcheck pass, 126/126, build ok; `enter` texts byte-equal (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Unit: M7-1 Note: green on `main` 5bacd88.
- [x] Unit: M7-2 Note: green on `main` 5bacd88.
- [x] Unit: M7-3 Note: green on `main` 5bacd88.
- [x] Unit: M7-4 Note: green on `main` 5bacd88.
- [x] Unit (K2): M7-5 Note: the tests are named `K2 ...` (2 tests); green on `main` 5bacd88.
- [x] Unit: M7-6 Note: green on `main` 5bacd88.
- [x] Ported cases: none deleted. Note: `tests/realm-look.test.js` is new (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: ember daylight 0.3 → 0.35 → M7-3 fails. Note: caught by M7-3 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: flip crystal `fx.ash` → M7-4 fails. Note: caught by M7-4 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: delete ember `ambientTint` → M7-5 fails. Note: caught by the `K2 ...` tests (this box's M7-5), M7-2, M7-3 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Mutation: put `realm.current === 'ember'` back in `ash.js` → M7-6 fails. Note: caught by M7-6 (`/tmp/deepen-clonecraft/w1-integrate.md`).
- [x] Structure: no `EMBER_`/`CRYSTAL_` constant in `sky.js`; `git diff main -- src/post.js src/weather.js` is empty. Note: grep on `main` 5bacd88; `git diff 8ebe3a7 -- src/post.js src/weather.js` is empty.
- [x] QA: terrain uniforms equal per realm, wave base versus step; screenshot pairs identical or explained. Note: 21 uniforms equal in 4 states; 0 differing pixels (`/tmp/deepen-clonecraft/w1-qa.md` B).
- [x] QA: 0 game console errors; cleanup done. Note: `/tmp/deepen-clonecraft/w1-qa.md` A and Notes.
- [x] Docs: `ARCHITECTURE.md` D48 (the look in the row); `DISCOVERY_engine.md:21-22`; `sky.js` header; `CHANGELOG.md` (Changed M7, Fixed K2). Note: 01f838e (the look note sits at the end of D47; D48 names `look.ambientTint`).
- [ ] **(owner)** Joe reviews the S4 diff.
- [x] Merged to `main`; worktrees and branches removed. Note: 14a147a; worktrees d4, d4a..d4c and their branches removed.

### W1 close
- [x] `npm run build`, then `npm run check` passes on `main`. `index.html` committed once. Note: 5bacd88; depcheck pass, 167/167, fresh-build check pass.
- [ ] **(owner)** Joe approves the W1 merge.

## Wave 2

### S5: realm-scoped table and layout (M1, M2, K8) — `step/deepen-5-realm-scoped`
- [x] Contract commit (W2 contract agent, opus); rsh reviewed it. Note: S5 b6e0948; rsh reviewed it by diff stat.
- [x] Wave dispatched: T5.1 opus, T5.2 sonnet, T5.3 sonnet. Note: rsh dispatch, 2026-11-01 10:50 CT; T5.1 8a9fcb2, T5.2 a7158ee, T5.3 2fe8edc.
- [x] Owns check by `git diff --stat`. Note: `homes.js`, `interact.js`, `persist.js`, `realms.js`, `tile-entities.js`, `tests/realm-slice.test.js` only (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Integrate: the "Every step" checks pass. Note: S5 tip 15d3904: depcheck pass, 177/177, build ok; fixtures diff empty; live fixture passes `readSave`; sweep baseline unchanged; no user-visible text change (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Unit: M1-1 (with its planted fail proof). Note: 8 `M1-1` tests incl. the planted copy without `looted`; green on `main` edf2906.
- [x] Ported cases: none deleted. Note: `tests/realm-slice.test.js` is new; +119/-0 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: drop `looted` from `SCOPED` → M1-1 fails, and the guard throws at load. Note: 3 `M1-1` tests fail; the guard throws (`/tmp/deepen-clonecraft/w2-integrate.md` 5).
- [x] Mutation: `editIndex.load` without `!(v & 8)` → M1-3 shows a timer on a top half. Note: browser QA, doorTimers held `7,37,1` and `7,38,1` (`/tmp/deepen-clonecraft/w2-qa.md` C1).
- [x] Mutation: `homesSlice.clear` as `homes.length = 0` → M1-3 loses the stashed homes. Note: browser QA, homes lost in 3 places (`/tmp/deepen-clonecraft/w2-qa.md` C2).
- [x] Mutation: `teSlice.clear` reassigns a new Map → M1-3 leak check fails through the handle. Note: browser QA, ember and crystal keys leak through the handle (`/tmp/deepen-clonecraft/w2-qa.md` C3).
- [x] Mutation: `realm.data` drops `portals` → M2-2 fails. Note: browser QA, `/portals` and `/portals/crystalBack` missing, 131 against 133 paths (`/tmp/deepen-clonecraft/w2-qa.md` C4).
- [x] Structure: `realms.js` has no `tileEntities`, `looted`, `torches`, `doorTimers`, or `setHomes` reference; `persist.js` has no `REALMS` or `realm.slice`. Note: grep on `main` edf2906: the only code hit is the `SCOPED` key `looted: lootedSlice` (`realms.js:57`), which the M1 table requires; it names no `looted` set. Comments aside, no other hit.
- [x] Structure: `git diff main -- src/liquids.js src/leaf-decay.js src/farming.js src/vehicles.js src/main.js` is empty (no renames; handle keys unchanged). Note: `git diff 69da971` (the wave base) on `main` edf2906 is empty.
- [x] QA: M1-2 realm round trip, save, reload; `persist.data()` deep-equal modulo clock. Note: seeds 792001, 792004; 0 diffs (`/tmp/deepen-clonecraft/w2-qa.md` B).
- [x] QA: M1-3 leak check, torch and door-timer keys, door closes. Note: no leak; timers on bottom halves only; the door closes after about 7 s (`/tmp/deepen-clonecraft/w2-qa.md` B).
- [x] QA: M2-1 Note: the saved JSON equals `persist.data()`; `validSave` true (`/tmp/deepen-clonecraft/w2-qa.md` B).
- [x] QA: M2-2 Note: 133 saved key paths match the wave base; only the intended key order differs (`/tmp/deepen-clonecraft/w2-qa.md` B).
- [x] QA: 0 game console errors; cleanup done. Note: `/tmp/deepen-clonecraft/w2-qa.md` A and the setup line.
- [x] Docs: `ARCHITECTURE.md` Seams row (K8); `DISCOVERY_engine.md` ("a new scoped field adds one `SCOPED` entry"); `realms.js` header; `CHANGELOG.md` (Changed M1, M2; Fixed K8). Note: 65a2099 (also the save row, D47, and `DISCOVERY_save-format.md`); the `realms.js` header came with T5.1.
- [ ] **(owner)** Joe reviews the S5 diff.
- [x] Merged to `main`; worktrees and branches removed. Note: 4d32132; worktrees d5, d5a..d5c and their branches removed.

### S6: world seam, light curve, batched (M6, K1, K9) — `step/deepen-6-world-seam`
- [x] Contract commit (W2 contract agent, opus), written against the post-S4 `sky.js`; rsh reviewed it. Note: S6 bc14ef1; rsh reviewed it by diff stat and the one test retarget.
- [x] Contract amendment: depcheck.test.js:36 plant moves from world.js to mesher.js; the test still expects `upward`. Note: rsh approved it; `tests/depcheck.test.js:36` plants into `mesher` and expects `upward`; the only changed line in `git diff 69da971 -- tests`.
- [x] Wave dispatched: T6.1 opus, T6.2 sonnet, T6.3 sonnet. Note: rsh dispatch, 2026-11-01 10:52 CT; T6.1 774c8da, T6.2 1c2940f, T6.3 ac2e489 and 04a982f.
- [x] Owns check by `git diff --stat`. Note: all files in S6 Owns plus the amendment (`/tmp/deepen-clonecraft/w2-integrate.md`, S6 2).
- [x] Integrate: merged after S5; the "Every step" checks pass. Note: S5 merge 4d32132, then S6 merge 9e0639b; S6 tip 16c37dd: depcheck pass, 200/200, build ok; fixtures diff empty; no user-visible text change (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Unit: M6-1 Note: green on `main` edf2906.
- [x] Unit: M6-2 Note: green on `main` edf2906.
- [x] Unit: M6-3 Note: green on `main` edf2906.
- [x] Unit: M6-4 Note: green on `main` edf2906.
- [x] Unit: M6-5 Note: green on `main` edf2906.
- [x] Unit: M6-6 Note: green on `main` edf2906.
- [x] Unit: M6-7 Note: green on `main` edf2906.
- [x] Unit: M6-8 Note: green on `main` edf2906; the spec line was amended to one `dispose` per loaded chunk (e37a10f).
- [x] Unit: M6-9 Note: green on `main` edf2906.
- [x] Unit: M6-10 Note: green on `main` edf2906.
- [x] Unit (`batched`): M6-11 Note: green on `main` edf2906.
- [x] Unit (`batched`): M6-12 Note: green on `main` edf2906.
- [x] Unit (`batched`): M6-13 Note: green on `main` edf2906.
- [x] Unit (`batched`): M6-14 Note: green on `main` edf2906.
- [x] Unit: K1-1 Note: green on `main` edf2906.
- [x] Unit: K1-2 Note: green on `main` edf2906.
- [x] Unit: K1-3 Note: green on `main` edf2906; each `LIGHT_GLSL` function equals the old `curve` or `curveB` line byte for byte. The assembled fragment shaders differ in 2 known places only: the `curveB` line lost its 2-space indent, and one GLSL comment moved to a JS comment in `config.js`. The vertex shaders are identical, and the compiled behavior is the same (terrain parity 0 px, `/tmp/deepen-clonecraft/w2-qa.md` F; `/tmp/deepen-clonecraft/w2-integrate.md` S6 4).
- [x] Unit: K1-4 Note: green on `main` edf2906.
- [x] Ported cases: none deleted. Note: tests diff is additions plus the amended depcheck line (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: drop the neighbor-lit check → M6-2 fails. Note: the whole check and the `.lit` part alone are caught by M6-2 (the zero-budget test, 16c37dd; `/tmp/deepen-clonecraft/w2-integrate.md` follow-up).
- [x] Mutation: skip `refreshColumn` at arrival → M6-3 fails. Note: caught by M6-3 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: `L - 1 - ATTEN` → `L - 1`, and drop the `LIGHT_STOP` continue → M6-5 fails (each). Note: ATTEN (both sites and one site) caught by "M6-5 a leaf cell takes ATTEN" (16c37dd); `LIGHT_STOP` caught by M6-5 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: `onEdit` before the relight → M6-6 fails. Note: caught by M6-6 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: drop `extraLight` from the max → M6-7 fails. Note: caught by M6-7 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: drop the unload in `reset` → M6-8 fails. Note: caught by M6-8 and M6-14 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: `RD + 3` → `RD + 4` → M6-9 fails. Note: caught by name by M6-9 after the boolean asserts (16c37dd; `/tmp/deepen-clonecraft/w2-integrate.md` follow-up).
- [x] Mutation: drop the `batched` join → M6-12 fails; drop `finally` → M6-13 fails; capture the set at open → M6-14 fails. Note: each caught by its test (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Mutation: unrounded curve constants → K1-3 fails; drop the normalization → K1-1 fails. Note: caught by K1-3 and K1-5; K1-1, K1-3, K1-5 (`/tmp/deepen-clonecraft/w2-integrate.md`).
- [x] Structure: `world.js` imports only `config`, `blocks`, `gen-service`; `world` is in `PURE`; `order.js` no longer re-exports `buildChunkMesh` or `heldLight`; 0 literal `pow(0.8` sites in `src/`; the curves come only from `LIGHT_GLSL` and `lightCurve` (this states the same intent as "one `pow(0.8` site": one source; `config.js` builds the GLSL text from `LIGHT_SKY` and `LIGHT_BLK`); no reader of `world.scene`. Note: grep on `main` edf2906: `world.js` imports `config`, `blocks`, `gen-service`; `world` in `PURE`; no `buildChunkMesh` or `heldLight` in `order.js`; 0 `pow(0.8` sites; 0 `world.scene` readers.
- [x] QA: an edit remeshes once with no hole; a realm round trip does not grow `renderer.info.memory.geometries`; a held torch brightens mobs. Note: all 49 chunk mesh hashes equal the wave base; 1 build per chunk per edit; geometries 481, 465, 449, 449; `brightnessAt` 0.0855 → 0.8356 with a torch (`/tmp/deepen-clonecraft/w2-qa.md` D).
- [x] QA: K1 before/after screenshots (mob, drop, held item; dark cave, night) and the level table are attached here. Note: `/tmp/deepen-clonecraft/qa-w2/k1-{cave,night,ember}-{before,after}.png`. Level table (brightness before → after): cave block 11, mob and drop 0.6141 → 0.5772, eye 0.2725 → 0.2028; open night 0.1414 → 0.0855 (held item floors at 0.1); Ember ambient 9, 0.3771 → 0.3175 (equals `uAmbient`). Block levels 0: 0.087 → 0.040; 4: 0.167 → 0.088; 8: 0.321 → 0.256; 12: 0.614 → 0.577; 15: 1 → 1. Terrain pixels unchanged (`/tmp/deepen-clonecraft/w2-qa.md` E).
- [ ] **(owner)** Joe looks at the K1 screenshots and the level table, and accepts the darker entities. Note by rsh: the pairs are `/tmp/deepen-clonecraft/qa-w2/k1-*`; the table is in the QA box above.
- [x] QA: 0 game console errors; cleanup done. Note: `/tmp/deepen-clonecraft/w2-qa.md` A and the setup line.
- [x] Docs: `ARCHITECTURE.md` (Seams row world to mesh adapter; D31 `world.extraLight`; D6 lists `travel` and `victory` (K9); D48 `lightCurve`); `DISCOVERY_engine.md` (World is Node-testable; `batched`); headers of `world.js`, `mesher.js`, `engine.js` (K9); `CHANGELOG.md` (Changed M6; Fixed K1 with the darker-entity note, K9). Note: 9764104 (the mesh adapter is the new D57 and the "world to meshes" Seams row; D3 and the block-edits row name `batched`; D4 and the light-queries row name the one curve source); the `engine.js` K9 header came with T6.3 ac2e489.
- [ ] **(owner)** Joe reviews the S6 diff.
- [x] Merged to `main`; worktrees and branches removed. Note: 9e0639b; worktrees d6, d6a..d6c, dw2qa and their branches (and `qa/deepen-w2`) removed.

### W2 close
- [x] `npm run build`, then `npm run check` passes on `main`. `index.html` committed once. Note: edf2906; depcheck pass, 210/210, fresh-build check pass.
- [ ] **(owner)** Joe approves the W2 merge.

## Wave 3

### S7: boss lock (M3, K5, K11) — `step/deepen-7-boss-lock`
- [ ] Contract commit (W3 contract agent, opus); rsh reviewed it.
- [ ] Wave dispatched: T7.1 opus, T7.2 sonnet.
- [ ] Owns check by `git diff --stat`.
- [ ] Integrate: the "Every step" checks pass.
- [ ] K5 repro (QA, wave base): the chest key and the torch key stay, and no drop appears. If it does not reproduce, record it here and skip the K5 fix boxes.
- [ ] Unit: M3-1
- [ ] Unit: M3-2
- [ ] Unit: M3-3
- [ ] Ported cases: none deleted.
- [ ] Mutation: `<=` → `<` on `x0 + w` in `ringHas` → M3-1 fails.
- [ ] Mutation: `world.locked` without the realm check → QA shows an overworld edit at (0, 97, 0) fails.
- [ ] Mutation: `boss.load` without `!!` → M3-5 deep-equal fails after `load({})`.
- [ ] Mutation: swap the build and the flag in `shatter` → M3-5 QA shows no exit panes.
- [ ] Mutation: drop `TORCH` from `ENTITY_BASE` → the K5 torch assert fails.
- [ ] Structure: `inArrival` and `inExit` are gone; `realm.boss` is a getter; `boss.EXIT` keeps `z`; only `boss.js` writes `defeated`; the 4 `boss.js`/`portals.js` batch sites use `world.batched`.
- [ ] QA: M3-4
- [ ] QA: M3-5
- [ ] QA: K5 fix: the chest key is gone, chest and item drop within 3 blocks, `torches` lacks the key.
- [ ] QA: 0 game console errors; cleanup done.
- [ ] Docs: `ARCHITECTURE.md` D49/D52/D53 (the lock lives in `boss`); `DISCOVERY_engine.md` (`:122`, `:142`, and the K11 invariant); headers of `boss.js` and `portals.js`; `CHANGELOG.md` (Changed M3; Fixed K5).
- [ ] **(owner)** Joe reviews the S7 diff.
- [ ] Merged to `main` before S8; worktrees and branches removed.

### S8: batched sites (M8) — `step/deepen-8-batched`
- [ ] Contract commit (W3 contract agent, opus); rsh reviewed it.
- [ ] Wave dispatched: T8.1 sonnet, T8.2 sonnet.
- [ ] Owns check by `git diff --stat`.
- [ ] T8.2 reported M8-1 red on its branch for the `boss.js` and `portals.js` sites only.
- [ ] Integrate: `main` (with S7) merged first; the "Every step" checks pass.
- [ ] Unit: M8-1 green after the merge.
- [ ] Ported cases: none deleted.
- [ ] Mutation: put one `world.beginBatch()` back in `grass.js` → M8-1 fails.
- [ ] Structure: grep (excluding `.claude/`) shows no `beginBatch`, `endBatch`, or `world.batch` read outside `world.js`; farming's local `batched` is gone.
- [ ] QA: a TNT blast, a door toggle, and a portal light each remesh once, with no hole; 0 console errors; cleanup done.
- [ ] Docs: `ARCHITECTURE.md:24`; `DISCOVERY_engine.md:10`; `world.js` header; `CHANGELOG.md` (Changed M8).
- [ ] **(owner)** Joe reviews the S8 diff.
- [ ] Merged to `main`; worktrees and branches removed.

### S9: precipitation and draw order (M9, M10) — `step/deepen-9-precip-order`
- [ ] Contract commit (W3 contract agent, opus); rsh reviewed it.
- [ ] Wave dispatched: T9.1 sonnet, T9.2 sonnet.
- [ ] Owns check by `git diff --stat`.
- [ ] Integrate: merged after S8; the "Every step" checks pass.
- [ ] Unit: M9-1
- [ ] Unit: M9-2
- [ ] Unit: M9-3
- [ ] Unit: M9-4
- [ ] Unit: M9-5
- [ ] Unit: M10-1
- [ ] Unit: M10-2
- [ ] Ported cases: none deleted.
- [ ] Mutation: `>=` → `>` in the height rule → M9-2 fails.
- [ ] Mutation: drop `SNOWY_MOUNTAINS` from zone 2 → M9-1 fails.
- [ ] Mutation: drop the `max` in `snowFloor` → M9-4 fails.
- [ ] Mutation: `EFFECTS: 1` → M10-1 fails.
- [ ] Structure: every `renderOrder =` in `src/` reads `DRAW_ORDER`; `precip` is in `order.js` and `PURE`; header count 53; `weather.precip`, `zone`, `melt`, `top`, `wetAt` still on the handle.
- [ ] QA: rain and snow by kind across y 159, in snowy plains, and in a desert; rain over water draws in front of it.
- [ ] QA: 0 game console errors; cleanup done.
- [ ] Docs: `ARCHITECTURE.md` (weather paragraph; draw order); `DISCOVERY_engine.md:54-59`; headers of `weather.js`, `precip.js`, `order.js`; `CHANGELOG.md` (Changed M9, M10).
- [ ] **(owner)** Joe reviews the S9 diff.
- [ ] Merged to `main`; worktrees and branches removed.

### W3 close
- [ ] `npm run build`, then `npm run check` passes on `main`. `index.html` committed once.
- [ ] **(owner)** Joe approves the W3 merge.

## Release
- [ ] **(owner)** Joe approves the release tag and the version number.
