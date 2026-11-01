# DISCOVERY: save-format

Gotchas, pointers, and invariants for `src/save-format.js`: the save checks, the edits codec, the boot reader, and the boot policy (`openSave`). Read this file before you add, rename, or remove a save field. `ARCHITECTURE.md` D16 holds the decisions.

## Invariants

- Only `src/save-format.js` calls `JSON.parse` on save text. The save-reader test enforces this rule.
- Boot reads `SAVE_KEY` only through `openSave`, which calls `readSave(text, seed)`. The file import checks with `validSave(d)`.
- `openSave` holds the whole boot fallback policy. `boot.js` only passes the stores, the clock, and `persist.apply`, then acts on `blocked` and `reload`. Put a new boot rule in `openSave`, not in `boot.js`.
- `BOOT_NOTICE` (`clonecraft.bootNotice`) lives only in `save-format.js`.
- `save-format.js` is pure. It imports only from `config.js` and `blocks.js`. It is in `PURE` in `tools/depcheck.js`.
- A save that `persist.data()` writes passes `validSave`. The live fixture proves this.
- `persist.data()` spreads `realm.data()`. `realms.js` owns the realm layout: the overworld slice at the top level, `realms`, `realm`, `portals`, and `boss` (SPEC_deepen M2). A new realm-scoped field goes in `SCOPED` and `SLICE_FIELDS`, not in `persist.js`.
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
- `inv.loose` holds the stacks in the craft grid, the altar, and on the cursor. `persist.apply` adds each one to the 36 slots. The rest of a stack that does not fit waits in `persist.leftover` (SPEC_hardening H8). `persist.dropLeftover()` drops it at the player from `onLoaded`, after the chunks are meshed. No loose stack is lost on load.
- `readSave` returns `{ save: null, reason: null }` only for `null` text. Any other text that fails gives a reason, and boot backs it up.
- An apply throw reloads the page. The notice waits in `sessionStorage` under `clonecraft.bootNotice`. With `keep: true`, the next boot skips `SAVE_KEY` and sets `persist.blocked`.
- K7 carrier: when the session write fails and the backup succeeded, the notice waits in `localStorage` under `clonecraft.bootNotice`, and the page still reloads. `takeNotice` reads the session first, then the store, and removes the key from both. It removes the store key only when the store holds one, so a normal boot writes nothing.
- When the backup failed (`keep: true`) and the session write fails too, there is no reload. `persist.blocked` stays true for the visit.
- `backup` returns `keep: false` only when the copy write and the save-key remove both succeed (K12, was finding N1). A failed remove keeps the save, removes the copy, and returns the keep notice. A carried keep notice skips the save key on the next boot, so an apply throw cannot loop.
- `validSlice` is internal (K10). The fixture baseline names it only in reason text.
- The HUD, and so the toast, is hidden until the game starts. Boot shows the notice in the menu load line first, then as a toast when Play or the overlay click starts the game.
- The save-reader taint is per file, not per scope. Two variables with the same name in one file share the taint. Rename the variable if the rule fires on a value that is not save text.

## Pointers

- Tests: `tests/save-format.test.js` (fixture, codec, save-sweep, element checks, `readSave`, save-reader, and the boot policy M4-1..M4-13 with a fake store and op log).
- Pure-module fail proof: `pure: save-format reaches order.js` in `tests/depcheck.test.js`.
- QA: put text in `clonecraft.world.<seed>` from a page on the same origin, then open `?seed=<seed>`. Use a throwaway seed. Remove the `.rejected.` keys afterwards.
- QA for a failed backup write: an init script that makes `localStorage.setItem` throw for keys that contain `.rejected.`.
- QA for K7: an init script that makes `sessionStorage.setItem` throw, and a scratch patch that makes `persist.apply` throw. Expect one reload, a fresh world, the notice, and no `clonecraft.bootNotice` left in either store.
