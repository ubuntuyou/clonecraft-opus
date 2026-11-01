# DISCOVERY: save-format

Gotchas, pointers, and invariants for `src/save-format.js`: the save checks, the edits codec, and the boot reader. Read this file before you add, rename, or remove a save field. `ARCHITECTURE.md` D16 holds the decisions.

## Invariants

- Only `src/save-format.js` calls `JSON.parse` on save text. The save-reader test enforces this rule.
- Boot reads `SAVE_KEY` only through `readSave(text, seed)`. The file import checks with `validSave(d)`.
- `save-format.js` is pure. It imports only from `config.js` and `blocks.js`. It is in `PURE` in `tools/depcheck.js`.
- A save that `persist.data()` writes passes `validSave`. The live fixture proves this.
- Boot never deletes a rejected save. It writes the backup key `clonecraft.world.<seed>.rejected.<epoch ms>` first.
- Each check in `SAVE_CHECKS` and `SLICE_CHECKS` names one field. `readSave` puts that name in its reason.

## Gotchas

- Every new save field needs a check in `save-format.js` and an entry in the live fixture. A field without a check lets a bad import block its seed.
- Refresh the live fixture (`tests/fixtures/save-live.json`) when you add a save field. Write it from the game, not by hand: play a throwaway seed, fill the field, and copy `JSON.stringify(clonecraft.persist.data())`. Fill every slice field in the overworld, the Ember slice, and the Crystal slice. A test checks this.
- The Crystal Realm has no generated chests. To fill its `looted` list, add a key to `clonecraft.looted`, as `lootChest` does.
- Keep the fixture small. The save-sweep runs about 8 mutants per JSON path, so a large edit list makes `npm test` slow.
- The baseline `tests/fixtures/save-accepted-mutants.json` only shrinks. Never regenerate it to make the sweep pass. A new accepted mutant needs a true reason. When the mutant would break `persist.apply`, add a check instead.
- A baseline path writes each array index as `[*]`. One entry covers every index, so one accepted index keeps the entry alive.
- After a new check, the sweep reports the entries that the check now rejects. Delete those entries.
- `mapsOf` reads a `B.LEAVES` edit as `B.LEAVES_PLACED`. So `editsOf(mapsOf(x))` equals `x` only when `x` holds no `B.LEAVES` edit.
- `validSave` does not compare the seed. `readSave` does. A valid save for another seed is rejected at boot but imports under its own seed.
- `readSave` returns `{ save: null, reason: null }` only for `null` text. Any other text that fails gives a reason, and boot backs it up.
- An apply throw reloads the page. The notice waits in `sessionStorage` under `clonecraft.bootNotice`. With `keep: true`, the next boot skips `SAVE_KEY` and sets `persist.blocked`.
- The HUD, and so the toast, is hidden until the game starts. Boot shows the notice in the menu load line first, then as a toast when Play or the overlay click starts the game.
- The save-reader taint is per file, not per scope. Two variables with the same name in one file share the taint. Rename the variable if the rule fires on a value that is not save text.

## Pointers

- Tests: `tests/save-format.test.js` (fixture, codec, save-sweep, element checks, `readSave`, save-reader).
- Pure-module fail proof: `pure: save-format reaches order.js` in `tests/depcheck.test.js`.
- QA: put text in `clonecraft.world.<seed>` from a page on the same origin, then open `?seed=<seed>`. Use a throwaway seed. Remove the `.rejected.` keys afterwards.
- QA for a failed backup write: an init script that makes `localStorage.setItem` throw for keys that contain `.rejected.`.
