# SPEC: deepen

Status: draft by rsh on 2026-11-01 for Joe's review. Gate: `GATE_deepen.md`.
Sources: the scan `/tmp/deepen-clonecraft-opus-2026-11-01.md` (at `77e5c90`), `/tmp/deepen-clonecraft/design-{A,B,C}.md`, and rsh's decisions `/tmp/deepen-clonecraft/decisions.md`. A decision overrides a design.

## Part 1: General

### Scope

This spec deepens ten modules and fixes the bugs that the scan found on the way. A **module code** (`M1`…`M10`) names one deepened module; Mn matches scan Fn. An M code changes no user-visible behavior. A **bug code** (`K1`…`K11`) names one bug; Kn matches scan Bn. A K code changes exactly the behavior its section states, and nothing else. The letters M and K are new in this repo.

| Code | Scan | Rating or mark | One line |
|---|---|---|---|
| M1 | F1 | Strong | One `SCOPED` table drives `slice`, `leave`, and `enter` in `realms.js`. |
| M2 | F2 | Worth exploring | `realm.data()` pairs with `realm.load(d)`; `persist.data` stops knowing the realm layout. |
| M3 | F3 | Worth exploring | `boss` owns `defeated` and the exit lock; `ringHas` serves both portal boxes. |
| M4 | F4 | Worth exploring | `openSave(...)` in `save-format.js` holds the boot fallback policy. |
| M5 | F5 | Worth exploring | `face-kind.js` owns the face-kind byte and generates the GLSL decoder. |
| M6 | F6 | Worth exploring | `new World(meshes)` takes a mesh adapter; `world` joins `PURE`. |
| M7 | F7 | Worth exploring | The realm look lives in the `REALMS` row. |
| M8 | F8 | Worth exploring | `world.batched(fn)` replaces `beginBatch`/`endBatch`. |
| M9 | F9 | Speculative | `precip.js` holds the precipitation rule. |
| M10 | F10 | Speculative | One `DRAW_ORDER` table in `config.js`. |
| K1 | B1 | C | `brightnessAt` uses the normalized light curves. |
| K2 | B2 | C, latent | Each realm row carries its own `ambientTint`. |
| K3 | B3 | C, latent | A misspelled `tex` tile name throws at load. |
| K4 | B4 | P (reproduced in Node by design C) | An atlas tile past 256 throws at load. |
| K5 | B5 | P | The exit portal build breaks placed chests, furnaces, torches, and doors first. |
| K6 | B6 | P | Not reproduced. No code. |
| K7 | B7 | P | An apply throw with a blocked `sessionStorage` carries the notice in `localStorage` and reloads. |
| K8 | B8 | C, doc | The Seams row for realms states the `SCOPED` table. |
| K9 | B9 | C, doc | D6 and the `engine.js` header list `travel` and `victory`. |
| K10 | B10 | C | `validSlice` leaves the exports of `save-format.js`. |
| K11 | B11 | C, benign | No code. `DISCOVERY_engine.md` records the reason. |
| K12 | N1 | C | A failed `store.remove(SAVE_KEY)` after a good backup keeps the save, so a reload cannot loop. Added by Joe, 2026-11-01 12:51 CT ("Fix N1"). |

### Constraints

- **No behavior change for an M code.** Every UI string, log text, delay, limit, and color stays. Allowed: M2 changes the key order of `persist.data()` (deep-equal holds); M8 closes a batch when `fn` throws.
- **A K code changes only its stated behavior.**
- **Project invariants** (paste into every dispatch):
  - `src/order.js` lists every module once, in load order. An upward name is used only inside a function, never at load time or in an IIFE (D38, D39).
  - Only a setter in the owner module writes another module's `let` (D40). A property write on an imported object is allowed.
  - `src/worldgen.js` has no imports (D41). The golden hashes in `tests/worldgen.test.js` do not change.
  - The save shape is frozen. `tests/fixtures/save-live.json` passes `readSave`. `tests/fixtures/save-accepted-mutants.json` does not change.
  - No `window.clonecraft` key (`src/main.js:124-137`) is renamed (SPEC_modules C1, decision 1).
  - Containers clear and load in place. Code never reassigns `tileEntities`, `looted`, `torches`, `doorTimers`, or a module queue. `homes` is the one `let`; only `homes.js` writes it.
  - D48: the realm light floor comes from `REALMS[*].ambient` and has two readers, `uAmbient` and `world.brightnessAt`.
- **`PURE` and Node-loadable are two properties** (decision 12). Depcheck `PURE` (`tools/depcheck.js:22`) means "never reaches `order.js`". **Node-loadable** means the module loads in Node after `tests/host-stub.js`, with no three.js CDN and no DOM. `atlas`, `terrain-material`, `clouds`, and `three` are `PURE` but not Node-loadable. `face-kind.js`, `precip.js`, `world.js` (after M6), and `save-format.js` are both.
- **Clock and store are parameters.** New pure code takes its clock (`now`) and its stores (`store`, `session`) as parameters. It calls no platform API.
- **No new dependency.** Tests use `node:test`, `acorn` (a devDependency), and `tests/host-stub.js`.
- **Callers keep their public names.** Only these files may change: `src/` `boot.js`, `persist.js`, `realms.js`, `tile-entities.js`, `homes.js`, `interact.js`, `boss.js`, `portals.js`, `portal-frame.js`, `mesher.js`, `terrain-material.js`, `shadows.js`, `engine.js`, `held-light.js`, `world.js`, `sky.js`, `ash.js`, `fireflies.js`, `weather.js`, `particles.js`, `targeting.js`, `grass.js`, `farming.js`, `explosions.js`, `leaf-decay.js`, `liquids.js`, `atlas.js`, `config.js`, `save-format.js`, `order.js`; and `tools/depcheck.js`.
- **Handle changes.** Additions: `boss.defeated`, `boss.data`, `boss.load`, `boss.locks`, `world.batched`, `world.extraLight`. One property goes: `world.scene` (M6). No doc or QA recipe reads it (design B grep). `realm.boss` stays as a read-only getter (M3).
- **Ported, not dropped.** No step deletes a test case. A deleted case maps to a named new test in the gate.
- **Contract amendment.** When the build proves a contract signature wrong, the orchestrator updates this spec and the gate on the step branch, with the reason, and names it in the step report. A task never changes a signature; it stops and reports.
- **P bugs reproduce first.** K4, K5, and K7 reproduce before the fix. A P bug that does not reproduce is recorded and left unpatched. K6 did not reproduce.
- **Tests.** The 109 existing tests pass unchanged. In an existing test file, `git diff` shows added lines only. Test tasks follow the test-writing rules of `~/.claude/standards/advanced/orchestration.md`.
- **Commits.** Conventional Commits, author `ubuntuyou`, no co-author trailer: `refactor(<scope>)` for M, `fix(<scope>)` for K, `test(<scope>)`, `docs(<scope>)`. A task never commits `index.html`.
- **QA.** Throwaway seeds only. Never open seed 1234 or write its key. Record `clonecraft.lastSeed` before QA and restore it after.

### Non-goals

- Review F-codes not picked: F24, F25, F26, F28, F29, F30, F31, F33, F34, F41. F23 is taken only as M8. M1 moves one tile-entity key build into `tile-entities.js`; F24 is otherwise untouched.
- K6 and K11: no code.
- The dropped scan candidates: rail planning, a hook registry, a state enum, mob model build and dispose, one ambient-effects module, the stand point and spawn search, a cell-key helper.
- Adjacent cleanup: the unused `setHomes` re-export, the shader floor 0.018 versus the 0.04 floor, an atlas duplicate-name check, moving `weather` or `fog` into the look, an `fx.shafts` flag.

## Part 2: Product

Line numbers are at `77e5c90`. A step in a later wave writes its contract against the merged file.

### M1: one table for the realm-scoped modules (S5)

**Behaviors to keep.**
1. `leave()` calls `boss.finish()` before it reads any state.
2. `leave()` snapshots the slice before it clears. The stash keeps the live `overrides` and `overridesByChunk` and the drops; each drop mesh leaves the scene.
3. `leave()` clears tile entities, looted, homes, liquids, leaves, farm, vehicles, torches, door timers, TNT, projectiles, and spawners, then calls `resetMining()`.
4. `enter()` calls `world.reset(...)` first, then removes every mob.
5. `enter()` rebuilds `torches` and `doorTimers` from `world.overrides`. A timer is set only for an open bottom door half (`v & 4 && !(v & 8)`), due at `game.clock + CONFIG.doorCloseDelay`.
6. `enter()` loads every field (a missing field loads empty), re-adds the drops, and sets `voidT = 0`.
7. A live slice returns the fields in `SLICE_FIELDS` order. `te` holds the live objects. `homes` is the live array, so the stash keeps the old array.
8. A stash slice returns `editsOf(s.overridesByChunk)` plus `s.slice[f] ?? []`. An unknown realm returns `null`.
9. The stash entry `{ overrides, overridesByChunk, slice, drops }` is frozen (`portals.js:151,157`).

| Name | File | Definition |
|---|---|---|
| `teSlice` | `tile-entities.js` (export) | `data() -> [...tileEntities.values()]`; `load(list)` sets each under `` `${t.x},${t.y},${t.z}` ``; `clear()` |
| `lootedSlice` | `tile-entities.js` (export) | `data() -> [...looted]`; `load(list)` adds each key; `clear()` |
| `homesSlice` | `homes.js` (export) | `data() -> homes`; `load(list) { homes = list \|\| []; }`; `clear() { homes = []; }` |
| `editIndex` | `interact.js` (export) | `load(overrides)` holds the loop of `realms.js:114-118`; `clear()` empties `torches` and `doorTimers` in place |
| `wrap(m)` | `realms.js` (internal) | `({ data: () => m.save(), load: (v) => m.load(v), clear: () => m.clear() })` |
| `SCOPED` | `realms.js` (internal) | `{ te: teSlice, homes: homesSlice, liquids: wrap(liquids), leaves: wrap(leafDecay), farm: wrap(farming), vehicles: { data: () => vehicles.data(), load: (v) => vehicles.load(v), clear: () => vehicles.clear() }, looted: lootedSlice }` |
| `CLEARED` | `realms.js` (internal) | `[editIndex, { clear: clearTnt }, projectiles, spawners, { clear: resetMining }]`. Every member is a downward import of `realms.js` (`realms.js:26-37,41`), so both tables are legal load-time consts (D39). |
| guard | `realms.js` (load time) | `if (['edits', ...Object.keys(SCOPED)].join() !== SLICE_FIELDS.join()) throw new Error('realms: SCOPED keys must equal SLICE_FIELDS');` |

An adapter's `load(v)` assumes an empty field and accepts `undefined`. `leave` clears each `SCOPED` entry, then each `CLEARED` entry. `enter` resets the world, removes the mobs, calls `editIndex.load(world.overrides)`, then `SCOPED[f].load(sl[f])` per field. `realm.slice(name)` stays a method.

**Choices.**
- The adapters wrap the existing names `liquids.save`, `leafDecay.save`, `farming.save`, `vehicles.data` (decision 1). Rejected: renaming them to `.data` (design A).
- Edits stay outside the table. Rejected: an `edits` adapter (the stash keeps the live maps for `world.reset`).
- Mobs stay inline in `enter`. Rejected: mobs in `CLEARED` (changes when mobs go).
- The loads now follow `SLICE_FIELDS` order (`looted` moves last). The adapters own disjoint state, so the order is not observable.

### M2: the realm save layout in one module (S5)

**Behaviors to keep.**
1. The overworld slice is top-level. `realms` holds every other non-null slice. `realm` is `place().name`. `portals` and `boss` are copies.
2. `place()` returns `{ name: from, pos }` while travelling, else the overworld when dead or `current`, with `pos: null`.
3. `load(d)` is unchanged.

| Name | File | Signature |
|---|---|---|
| `realm.data()` | `realms.js` (new) | `-> { ...overworldSlice, realm: place().name, realms, portals: { ...this.portals }, boss: { ...this.boss } }`; S7 changes the `boss` slot to `boss.data()` |
| `realm.load(d)`, `realm.place()` | `realms.js` | unchanged |

`persist.data` (`persist.js:33-41`) keeps the player, inventory, armor, `enchantSeed`, and weather, and spreads `...realm.data()`. It drops its `REALMS` import and the `realms` loop. `enchantSeed` and `weather` move after `boss` in key order. Rejected: a separate `realm-save.js` (the reader `load(d)` already sits in `realms.js`).

### M3: the boss owns `defeated` and the exit lock (S7)

**Behaviors to keep.**
1. The save path is `boss.defeated`, a boolean; a missing value loads as `false`.
2. The boss spawns only while the flag is false.
3. In the Crystal Realm, `world.locked` is true on every cell of the arrival ring box: plane `z0`, x `x0-1..x0+w`, y `y0-1..y0+h`, in every state.
4. After the kill, the same ring box around `EXIT` is locked.
5. The lock holds only while `world.realm === 'crystal'`.
6. The shatter order stays: loot, build the exit portal, set the flag, `victoryPending`, save. The build is never locked.
7. `defeated` is global; travel does not change it.

| Name | File | Signature |
|---|---|---|
| `ringHas(frame, x, y, z)` | `portal-frame.js` (export) | `-> boolean`: (x, y, z) lies in the plane of `{ axis, x0, y0, z0, w, h }`, inside the opening plus a 1-block ring |
| `EXIT` | `boss.js` | unchanged `{ x0, y0, z, w, h }` |
| `EXIT_FRAME` | `boss.js` (private) | built once: `{ axis: 'x', x0: EXIT.x0, y0: EXIT.y0, z0: EXIT.z, w: EXIT.w, h: EXIT.h }` |
| `boss.defeated` | `boss.js` | `false` at load; `Titan.shatter` sets it |
| `boss.data()` / `boss.load(d)` | `boss.js` | `-> { defeated }` / `this.defeated = !!d?.defeated` |
| `boss.locks(x, y, z)` | `boss.js` | `-> this.defeated && ringHas(EXIT_FRAME, x, y, z)` |
| `realm.boss` | `realms.js` | `get boss() { return { defeated: boss.defeated }; }` |
| `world.locked` | `portals.js` | `world.realm === 'crystal' && (ringHas(A, x, y, z) \|\| boss.locks(x, y, z))`; `boss` read at call time (D39) |

`realm.load` calls `boss.load(d.boss)`; `realm.data` returns `boss: boss.data()`. `inArrival` and `inExit` (`portals.js:58-63`) are deleted.

**Choices.** `boss.locks` makes the build-before-flag rule local to `boss.js`. Rejected: `inExit` in `portals.js`. `realm.boss` stays as a getter, and `EXIT` keeps `z` (decision 2). Rejected: design A's removal of `realm.boss` and its rename `z` to `z0`.

### M4: the boot policy as one pure function (S1)

**Behaviors to keep.**
1. The notice is read from `clonecraft.bootNotice`, then removed. A parse or access failure gives `null`.
2. A notice with `keep` sets `blocked`, and `SAVE_KEY` is not read.
3. Every rejection backs up first, to `${key}.rejected.${now}`. On success, `SAVE_KEY` is removed and the message is `The saved world could not load: <reason>. A copy is in <key>. A new world starts.` (`keep` false). On failure, `SAVE_KEY` stays, `blocked` is true, and the message is `The saved world could not load: <reason>. It was kept. Saving is off until the next visit.` (`keep` true).
4. A `readSave` reason replaces a carried notice.
5. An apply throw makes `save` null and `blocked` true, with the reason `it failed to load (<e.message>)` and the same backup rule. The notice goes to the session; the page reloads when that write succeeds.
6. One backup per boot at most, so one `now` is enough.
7. Nothing saves between an apply throw and `persist.blocked = true` (`persist.save` waits for `game.started`, `persist.js:45`).

| Name | File | Signature |
|---|---|---|
| `BOOT_NOTICE` | `save-format.js` | `'clonecraft.bootNotice'` (moves from `boot.js:75`) |
| `openSave` | `save-format.js` (export) | `openSave({ store, session, key, seed, now, apply }) -> { save, notice, blocked, reload }`; `notice` is `{ msg, keep }` or `null` |
| `store` | param | `get(k)`, `set(k, v) -> bool`, `remove(k)` (the `storage` shape, `config.js:55`) |
| `session` | param | `getItem`, `setItem`, `removeItem`, each may throw; boot passes lazy wrappers, so a throw on the global stays inside `openSave` |
| `key`, `seed`, `now`, `apply` | param | `SAVE_KEY`, `SEED`, `Date.now()`, `(d) => persist.apply(d)` |
| `takeNotice(session, store)` | internal | reads the session, then the store; removes the key from both |
| `backup(store, key, text, reason, now)` | internal | `-> { msg, keep }` |

`boot.js:66-103` becomes one `openSave` call, then `if (o.blocked) persist.blocked = true; if (o.reload) location.reload();`. `NOTICE_SECONDS` stays. **Choices:** `apply` is injected, so one function holds the whole policy. Rejected: a separate `onApplyFailure`. Rejected: a new `boot-policy.js` (decision 3), so S1 edits neither `order.js` nor `PURE`.

### M5: the face-kind byte gets one owner (S2)

**Today:** the encoder is `mesher.js:66-73,88`; the decoders are hand windows at `terrain-material.js:90-94,101-108` and `shadows.js:34`.

**Behaviors to keep.**
1. Each kind writes its byte.
2. A plant writes 0 at a vertex above the quad's lowest y, 255 elsewhere (`mesher.js:88`).
3. Only a still face in the opaque buffer next to water gets 246. A leaf or glow face next to water keeps its byte.
4. Each flag decodes to today's value on the 9 live bytes. Every other byte decodes to no kind.
5. Sway applies only in the non-water build. Shadows read only the leaf flag.

| Name | File | Signature |
|---|---|---|
| `FACE_KIND` | `face-kind.js` (new; no imports; `PURE`; Node-loadable) | frozen `{ STILL: 0, LEAF: 1, PLANT: 2, GLOW: 3, SOFT_GLOW: 4, CRYSTAL: 5, PORTAL_EMBER: 6, PORTAL_CRYSTAL: 7, WET: 8 }` |
| `FACE_BYTE` | `face-kind.js` | `Uint8Array.of(255, 128, 0, 200, 214, 232, 160, 172, 246)` by kind |
| `faceByte(kind, top, wet)` | `face-kind.js` | `-> 0..255`: PLANT gives `top ? 0 : 255`; STILL with `wet` gives 246; else `FACE_BYTE[kind]` |
| `faceKindOf(byte)` | `face-kind.js` | `-> kind or -1`; JS mirror of the GLSL match, `abs(byte - FACE_BYTE[k]) <= 0.5` |
| `FACE_GLSL` | `face-kind.js` | `const float FACE_<NAME> = <byte>.0;` per kind, and `float faceIs(float a, float k) { return step(abs(a * 255.0 - k), 0.5); }` |

`terrain-material.js`: `vPortal = faceIs(…PORTAL_EMBER) + 2.0 * faceIs(…PORTAL_CRYSTAL)`, `vGlow = faceIs(…GLOW) + 0.5 * faceIs(…SOFT_GLOW)`, `vCrystal` and `vWet` alike; sway `amt = (plant > 0.5 ? 1.6 : 0.5) * gust` when `leaf + plant > 0.5`, y-bob times `leaf`. `shadows.js`: `vLeaf = faceIs(aTint.a, FACE_LEAF)`. `mesher.js` destructures `FACE_KIND` locally, so each `swayMode =` line is a one-name edit. `face-kind.js` goes after `import './world.js';` in `order.js`.

**Choices** (decision 8: exact match in the vertex shader). Rejected: the old windows as rows (hand-picked per kind). Rejected: `FACE_GLSL` writing varyings (each shader reads different flags). Rejected: a fragment decode (plant quads interpolate). Rejected: an `aKind` attribute (memory).

### M6: `World` takes a mesh adapter (S6)

**Behaviors to keep.**
1. A data arrival is dropped when the chunk is loaded or beyond RD+3. Overrides apply, then `refreshColumn` runs per edited column.
2. `update` requests radius RD+1, cancels unsent work beyond RD+2, unloads beyond RD+3, and refreshes on a move, an RD change, or every 1 s.
3. Lighting goes nearest first with 40 % of the budget. `onChunkLoaded` runs per lit chunk.
4. A chunk meshes inside RD+0.5 when it and its 8 neighbors are lit. Visibility follows `inside`.
5. `setBlock` returns false for y out of range, a locked cell, an unloaded or unlit chunk, or the same id. Else it bumps `editSerial`, writes both override maps, relights, remeshes the touched chunks, and calls `onEdit(x, y, z, old, new)` last.
6. Light: opaque cells 0; minus 1 plus `ATTEN` per step; sky 15 stays 15 going down; `LIGHT_STOP` takes light and passes none; an opaque emitter lights its neighbors.
7. y<0 reads bedrock, or air with `voidBelow`; an unloaded cell reads `UNLOADED`; an unlit chunk reads sky 15, block 0.
8. `brightnessAt` = curve of max(sky × daylight, block, crystal, extra, ambient), floor 0.04.
9. `reset` order: unload all (the hook sees the old realm), `setRealm`, swap maps, clear `touched` and `batch`, reset `lastRequest` and `center`.
10. Dispose calls `setIndex(null)` before `dispose()`.
11. `stats`, `pendingMeshes`, `gen.pending`, `center`, and `editSerial` stay readable.

| Name | File | Signature |
|---|---|---|
| `new World(meshes)` | `world.js` | `meshes` is the mesh adapter `{ build, dispose, show }` |
| `meshes.build(world, chunk)` | adapter | builds or replaces the chunk's meshes |
| `meshes.dispose(chunk)` | adapter | frees and removes them, nulls the handles |
| `meshes.show(chunk, visible)` | adapter | replaces the `.visible` writes (`world.js:418-419`) |
| `world.reset(name, overrides, overridesByChunk, voidBelow, ambient)` | `world.js` | unchanged (S5 calls it in the same wave) |
| `world.extraLight` | `world.js` slot | `(x, y, z) -> 0..15` or `null` |
| `chunkMeshes(scene)` | `mesher.js` (export) | `-> { build, dispose, show }` |
| `buildChunkMesh`, `setChunkGeometry(world, scene, chunk, …)` | `mesher.js` | internal; the scene is a parameter, not `world.scene` |

`engine.js:28` becomes `new World(chunkMeshes(scene))` (downward import). `held-light.js` assigns `world.extraLight = (x, y, z) => heldLight.levelAt(x, y, z);` after its IIFE. `order.js:99` becomes `import './mesher.js';`, `:138` becomes `import './held-light.js';`. `world.js` then imports only `config`, `blocks`, and `gen-service`.

**Choices.** Rejected: `.visible` writes in `World`. Rejected: the adapter in `engine.js` (`QUAD_INDEX` lives in `mesher.js`). Rejected: `heldLight` as a constructor parameter (`held-light.js` loads after `engine.js`). Rejected: a `get scene()` with no reader. Two adapters exist (`chunkMeshes`, the test recorder), so the seam is real.

### M7: the realm look in the realm row (S4)

**Behaviors to keep.**
1. The day sky runs first; a row with a `look` replaces its output.
2. The realm sky write order stays (`sky.js:310-342`). The fog is skipped with the head in water or lava.
3. Fog near = `fogNear` × min(fog.far, far); fog far = min(fog.far, far). Star size is written only when stars show.
4. Ash only in ember; fireflies only in the overworld; shafts only in the day sky (`post.js:190` keeps `sky.mode`); weather from the row flag.

| Name | File | Shape |
|---|---|---|
| `REALMS[r].look` | `config.js:36-40` | `null` for the day sky, else `{ top, horizon, light, ambientTint, daylight, sunAmt, lightDir, fogNear, starSize, star, aurora }`. Colors are exact `[r, g, b]` number arrays. `ambientTint` is an array or `null`. `star` is `null` or `{ color, scale, halo }`. |
| `REALMS[r].fx` | `config.js` | `{ fireflies, ash }` |
| `realmSky(def, far)` | `sky.js` | reads `def.look`; the gate is `if (def.look)`; three.js objects built per row once at load |
| gates | `ash.js:65`, `fireflies.js:92` | `realm.def.fx.ash`, `realm.def.fx.fireflies` |

Copy each value from `sky.js:302-342`. **Choices** (decision 9): arrays, not hex (hex moves 8 colors by up to 0.47/255). `weather` and `fog` stay. Rejected: `fx.shafts` (shafts follow the day sun). Rejected: a look keyed by the `sky` string.

### M8: `world.batched(fn)` (S6 adds; S7 and S8 convert)

**Behaviors to keep.**
1. Inside a batch, `setBlock` collects the touched chunks and remeshes nothing.
2. The outermost end remeshes each collected meshed chunk once and clears `dirty`.
3. Outside a batch, `setBlock` remeshes at once.
4. A nested call joins the outer batch.
5. `fn`'s return value passes through.
6. A `reset` inside the batch drops the set.

```js
// Runs fn() with remeshing deferred; the outermost call remeshes each touched chunk once, even when fn throws.
batched(fn) {
  if (this.batch) return fn();
  this.batch = new Set();
  try { return fn(); } finally {
    const set = this.batch; this.batch = null;   // reset() inside fn nulls it: drop the set
    if (set) for (const tc of set) if (tc.meshed) { this.meshes.build(this, tc); tc.dirty = false; }
  }
}
```

Sites (decision 13). S7: `boss.js:303-309`, `portals.js:92-95,117-120,171-174`. S8: `grass.js:76-85` (keep `changes.length = 0` in the `finally` around the `world.batched` call), `interact.js:286-290,355-358,491-493`, `explosions.js:14-26`, `leaf-decay.js:65-74`, `liquids.js:81-87`, and `farming.js:32-35` (its local `batched` goes; `:60,87,106` call `world.batched`). S8 deletes `beginBatch` and `endBatch` (`world.js:200-205`).

Every site that can nest is guarded today, so only a throw inside `fn` behaves differently. Rejected: a depth counter (underflow after `reset`).

### M9: the precipitation rule as a pure module (S9)

**Behaviors to keep.**
1. A desert is dry. Snowy plains and snowy mountains snow at every height.
2. Any other biome snows when `t + 1 >= melt` (159) and rains below.
3. In zone 1 the snow floor is `max(t + 1, melt)`.
4. Rain spawns only where the kind is rain, with floor `t + 1`; `weather.js` caps its y at `melt`.
5. A drifting flake takes its new column's floor and respawns when that column has no snow.
6. `t < 0` gives nothing.
7. `weather.precip`, `zone`, `melt`, `top`, `wetAt` stay on the handle.

| Name | File | Signature |
|---|---|---|
| `zoneOf(biome)` | `precip.js` (new; imports `BIOME` from `biomes.js`; `PURE`; Node-loadable) | `-> 0 dry, 1 height rule, 2 always snow` |
| `precipKind(zone, top, melt)` | `precip.js` | `-> 0 none, 1 rain, 2 snow` |
| `snowFloor(zone, top, melt)` / `rainFloor(zone, top, melt)` | `precip.js` | `-> y or -1` |

`weather.js:37-55` keep their names as thin wrappers; `:84`, `:87-88`, `:104`, `:227`, `:231` call the module. `precip.js` goes after `import './biomes.js';`. `melt` is a parameter. Rejected: importing `WG`.

### M10: one draw-order table (S9)

`DRAW_ORDER = Object.freeze({ DOME: -10, SKY_BODY: -9, TERRAIN: 0, WATER: 1, STARS: 1.5, CLOUDS: 2, CRACK: 2, EFFECTS: 3 })` in `config.js`. Sites: `sky.js:69,91,104,126,185`, `mesher.js:511-512,537`, `targeting.js:62`, `weather.js:71`, `ash.js:28`, `fireflies.js:36`, `particles.js:59`. Every value stays. Rejected: a new module (no behavior).

### K1: `brightnessAt` uses the normalized curves (S6)

**Change.** `brightnessAt` (`world.js:132`) returns `max(0.04, lightCurve(s × daylight, LIGHT_SKY), lightCurve(b, LIGHT_BLK))`, with crystal, extra, and ambient on the block curve. Mobs, drops, the held item, particles, arrows, and vehicles get darker in low light. The terrain shader text, `uAmbient`, and the 0.04 floor stay.

| Name | File | Definition |
|---|---|---|
| `LIGHT_SKY`, `LIGHT_BLK` | `config.js` | `0.83`, `0.85` |
| `lightCurve(level, base)` | `config.js` | `(base ** (15 - level) - lo) / span`, `lo = +(base ** 15).toFixed(4)`, `span = +(1 - base ** 15).toFixed(4)` |
| `LIGHT_GLSL` | `config.js` | generates the `curve` and `curveB` functions, each byte-equal to `terrain-material.js:129` and `:131` |

`sky.js` deletes its local `curveB` (`:309`; the contract reads the post-S4 file) and uses `lightCurve(def.ambient, LIGHT_BLK)`. `terrain-material.js:129-131` uses `${LIGHT_GLSL}`. Rejected: two functions. Rejected: unrounded constants (they shift `uAmbient` by 5e-5).

Block level before → after: 0: 0.087 → 0.040; 4: 0.167 → 0.088; 8: 0.321 → 0.256; 9: 0.377 → 0.317; 12: 0.614 → 0.577; 14: 0.850 → 0.836; 15: 1 → 1. Sky 4: 0.129 → 0.072. Design B holds the full table.

### K2: per-realm `ambientTint` (S4)

A row with `ambient > 0` tints `uAmbient` with its own `look.ambientTint`, not `EMBER_AMBIENT` (`sky.js:333`). No output changes today.

### K3 and K4: atlas checks (S3)

K4: `paintTile` throws `atlas: tile '<name>' does not fit; the atlas holds 256 tiles` when `tileCount >= ATLAS_TILES`. K3: the `FACE_TILE` loop (`atlas.js:803-806`) throws `atlas: block <name> tex.<side|top|bottom|front> names no tile: <n>`; `front` is checked only when set. Neither fires today. New export `ATLAS_TILES = (ATLAS_SIZE / 16) ** 2`; local `tileOf(def, key)`. Rejected: a throwing `Proxy` on `TILE` (hot path).

### K5: the exit portal build breaks placed entities (S7)

Before `buildExitPortal` overwrites a box cell whose base is `CHEST`, `FURNACE`, `TORCH`, or `DOOR`, it calls `breakBlock(x, y, z, true, true)`. The block and contents drop; the torch key, the other door half, and the door timer clear. Other cells are overwritten without drops, as today. `boss.js` imports `breakBlock` (downward) and holds `ENTITY_BASE`. The `breakBlock` neighbor pass may break a torch or plant resting on a box cell; that is intended. Rejected: `breakBlock` on every cell (the arena floor would drop). Rejected: hand-spilling in `boss.js`.

### K6: the door half (no code)

Design B shows that no reachable cell lets the lower door half place and the upper half fail. Recorded as "not reproduced, unpatched".

### K7: the notice survives a blocked `sessionStorage` (S1)

After an apply throw, `openSave` writes the notice to the session. When that write fails and the backup succeeded (`!keep`), it writes the notice to `store` under `BOOT_NOTICE` and returns `reload: true`. The reload is loop-safe because `SAVE_KEY` is gone. When the backup failed (`keep`), it returns `reload: false`, as today. The reload happens on `!keep` even when the store write also fails; the notice is then lost, but the world is clean. Rejected: design A's reload with no carrier.

### K12: a failed save-key remove keeps the save (S10)

N1, found in the S1 review. `backup` returns `keep: false` when the copy write succeeds, even when `store.remove(key)` then fails. After an apply throw, the page reloads and applies the same save again, so every boot writes a new `.rejected.` copy and reloads. Fix: `backup` returns `keep: false` only when both the copy write and the remove succeed. When the remove fails, `backup` removes the copy (best effort) and returns the "It was kept" notice with `keep: true`. The keep path then blocks saving, and a carried keep notice skips the save key on the next boot, so no reload loops. The user-visible text is the existing "It was kept" text. Rejected: a reload counter in the session (a blocked session defeats it).

### K8, K9, K10, K11

- **K8** (S5 docs): the Seams row "realms to the scoped modules" states `SCOPED`, the guard, `CLEARED`, and the pair `realm.data()` / `realm.load(d)`.
- **K9** (S6): D6 and the `engine.js:5-8` header list `travel` (from `playing` or `dead` to `playing` while a realm loads) and `victory` (from `playing` when the Titan dies). Both freeze the simulation and leave pointer lock.
- **K10** (S1): `validSlice` leaves the exports (`save-format.js:120`). The mutants baseline mentions it only as reason text and stays unchanged.
- **K11** (S7 docs): `DISCOVERY_engine.md` records the invariant: the shatter save inside `leave()` is redundant with the arrival save (`realms.js:167`), which also carries `defeated: true`; it stays because it covers a tab that dies between leave and arrival.

### Patterns to follow

- Pure module tests: `tests/portals.test.js` (import `./host-stub.js` first).
- Planted source tests: `tests/depcheck.test.js`. The atlas test copies `src/` the same way and stubs `three.js` and the canvas.
- Living headers: `src/order.js:1-30`.

## Part 3: Execution

### Waves and steps

Steps in one wave own disjoint source files. Waves run in order.

| Wave | Step | Codes | Branch | Owns |
|---|---|---|---|---|
| W1 | S1 | M4, K7, K10 | `step/deepen-1-boot-policy` | `boot.js`, `save-format.js`, `tests/save-format.test.js` |
| W1 | S2 | M5 | `step/deepen-2-face-kind` | new `face-kind.js`; `mesher.js` (`:66-74,88`, `swayMode` lines); `terrain-material.js:85-108`; `shadows.js:34-35`; `order.js` (header count, `:17-18`, the new line); `depcheck.js:22`; new `tests/face-kind.test.js` |
| W1 | S3 | K3, K4 | `step/deepen-3-atlas-checks` | `atlas.js`; new `tests/atlas.test.js` |
| W1 | S4 | M7, K2 | `step/deepen-4-realm-look` | `config.js:32-40`; `sky.js:298-342`; `ash.js:65`; `fireflies.js:92`; new `tests/realm-look.test.js` |
| W2 | S5 | M1, M2, K8 | `step/deepen-5-realm-scoped` | `realms.js`, `persist.js`, `tile-entities.js`, `homes.js`, `interact.js` (`editIndex` only); new `tests/realm-slice.test.js` |
| W2 | S6 | M6, K1, K9, `batched` | `step/deepen-6-world-seam` | `world.js`, `engine.js`, `held-light.js`, `mesher.js` (`:353,508-540` at `69da971`; `buildChunkMesh`, `setChunkGeometry`, the export line, new `chunkMeshes`), `config.js` (new light block, export line), `sky.js` (`curveB`), `terrain-material.js:129-131`, `order.js` (`:17-18,99,138`), `depcheck.js:22`; new `tests/world.test.js`; `tests/config.test.js`; `tests/depcheck.test.js` (one plant, `:36`) |
| W3 | S7 | M3, K5, K11 | `step/deepen-7-boss-lock` | `boss.js`, `portals.js`, `portal-frame.js`, `realms.js` (`boss` field, `load`, `data`); `tests/portals.test.js` |
| W3 | S8 | M8 | `step/deepen-8-batched` | `world.js` (`beginBatch`, `endBatch`), `grass.js`, `interact.js`, `farming.js`, `explosions.js`, `leaf-decay.js`, `liquids.js`; `tests/world.test.js` |
| W3 | S9 | M9, M10 | `step/deepen-9-precip-order` | new `precip.js`; `weather.js`; `config.js` (`DRAW_ORDER`, export line); `sky.js:69,91,104,126,185`; `mesher.js:511-512,537`; `targeting.js:62`; `ash.js:28`; `fireflies.js:36`; `particles.js:59`; `order.js` (header count, `:17-18`, the new line); `depcheck.js:22`; new `tests/precip.test.js`; `tests/config.test.js` |

**Shared files.** No wave has two steps in `order.js`, `tools/depcheck.js`, or `config.js` (W1: S2 and S4 split them; W2: S6; W3: S9), so no in-wave resolve is needed. The module count in the `order.js` header goes 51 → 52 (S2) → 53 (S9). The orchestrator writes the shared docs (`ARCHITECTURE.md`, `DISCOVERY_*.md`, `CHANGELOG.md`) at each step close, one step at a time. `index.html` is rebuilt once per wave close on `main`.

**Contract amendment (S6, rsh approved).** S6 Owns adds `tests/depcheck.test.js`. One plant moves: the test "upward: a later name is used at load time" (`:36`) plants `terrainMaterial;` into `mesher.js`, not `buildChunkMesh;` into `world.js`. Reason: under M6, `world.js` has no upward names, so the old plant fails as `free`, not `upward`. The test name and its `upward` expectation stay, so the rule keeps its fail proof. This line is the one exception to "added lines only".

**Merge order.** W1: any. W2: S5, then S6. W3: S7, then S8 (decision 13), then S9. S8's integrate phase first merges `main` (with S7) into its step branch.

### Phases per step

1. **Interface (contract agent).** One opus agent per wave writes phase 1 for each step of the wave, on its step branch from `main`: every Part 2 signature with `TODO` bodies (or today's body where a caller needs it), the test fakes, and the `order.js` and `PURE` lines. The build and the 109 tests pass. This step commit is the contract. rsh reviews it before the wave dispatch. This deviates from the deepen skill (decision 15) to save orchestrator context.
2. **Wave (task agents).** The step's tasks, dispatched together, with disjoint Owns lists. A P-bug repro runs on the wave base before the fix lands.
3. **Integrate (integration agent, rsh verifies).** One opus agent per wave does the mechanics for each step. rsh re-runs the step gate and reads the mutation log before any merge to `main`. This also deviates from the deepen skill, to save orchestrator context. Merge the task branches. Re-run the step gate. Review each diff (`git diff --stat`, then the key hunks). Check the ported-case table. Run one mutation per kept behavior class, confirm the named test fails, and revert.
4. **Runtime QA (QA agent).** One sonnet QA agent per wave runs the step checks in sequence, ports 8785..8789.
5. **Docs, then close (orchestrator).** Docs, gate boxes, the merge to `main`, worktree and branch removal. No retrieval index exists for this repo, so there is no reindex.

### Tasks

Letters a, b, c map to `.1`, `.2`, `.3`. Big steps (S1, S2, S4, S5, S6) run implementation, tests, and caller migration. Small steps (S3, S7, S8, S9) run implementation with migration, and tests. The implementer never writes the tests for its own contract. Models per decision 16.

| Task | Model | Owns | Work |
|---|---|---|---|
| T1.1 | sonnet | `src/save-format.js` | `openSave`, `takeNotice`, `backup`, K7, K10 |
| T1.2 | sonnet | `tests/save-format.test.js` | M4 and K7 tests |
| T1.3 | sonnet | `src/boot.js` | call `openSave`; lazy session wrappers; header |
| T2.1 | opus | `src/face-kind.js` | table, `faceByte`, `faceKindOf`, `FACE_GLSL` |
| T2.2 | sonnet | `tests/face-kind.test.js` | M5 tests |
| T2.3 | sonnet | `src/mesher.js`, `src/terrain-material.js`, `src/shadows.js` | encoder and decoders |
| T3.1 | sonnet | `src/atlas.js` | K3, K4, `ATLAS_TILES` |
| T3.2 | sonnet | `tests/atlas.test.js` | stubbed load, K3 and K4 tests |
| T4.1 | sonnet | `src/config.js` (`:32-40`), `src/sky.js` | `look`, `fx`, `realmSky`, K2 |
| T4.2 | sonnet | `tests/realm-look.test.js` | M7 and K2 tests |
| T4.3 | sonnet | `src/ash.js`, `src/fireflies.js` | `fx` gates |
| T5.1 | opus | `src/realms.js`, `src/tile-entities.js`, `src/homes.js`, `src/interact.js` | `SCOPED`, `CLEARED`, guard, adapters, `realm.data()` |
| T5.2 | sonnet | `tests/realm-slice.test.js` | M1 test |
| T5.3 | sonnet | `src/persist.js` | spread `realm.data()` |
| T6.1 | opus | `src/world.js`, `src/config.js` (light block, export line) | adapter, `extraLight`, `batched`, `lightCurve` |
| T6.2 | sonnet | `tests/world.test.js`, `tests/config.test.js` | M6, `batched`, K1 tests |
| T6.3 | sonnet | `src/mesher.js`, `src/engine.js`, `src/held-light.js`, `src/sky.js`, `src/terrain-material.js` | `chunkMeshes`, callers, `LIGHT_GLSL`, K9 header |
| T7.1 | opus | `src/boss.js`, `src/portals.js`, `src/portal-frame.js`, `src/realms.js` | M3, K5, 4 batch sites |
| T7.2 | sonnet | `tests/portals.test.js` | `ringHas` tests |
| T8.1 | sonnet | `src/world.js`, `src/grass.js`, `src/interact.js`, `src/farming.js`, `src/explosions.js`, `src/leaf-decay.js`, `src/liquids.js` | convert sites; delete `beginBatch`, `endBatch`, farming's `batched` |
| T8.2 | sonnet | `tests/world.test.js` | source scan |
| T9.1 | sonnet | `src/precip.js`, `src/weather.js`, `src/config.js` (`DRAW_ORDER`), `src/sky.js`, `src/mesher.js`, `src/targeting.js`, `src/ash.js`, `src/fireflies.js`, `src/particles.js` | M9, M10 |
| T9.2 | sonnet | `tests/precip.test.js`, `tests/config.test.js` | M9, M10 tests |

Contract agent per wave: opus. QA agent per wave: sonnet. No haiku task.

### Dispatch rules

- Set `model` on every dispatch.
- Worktree: `git worktree add .claude/worktrees/d<n><letter> -b step/deepen-<n>-<slug>-<letter> <step commit>`; symlink `node_modules`. No harness worktree isolation. The old hardening worktrees stay; every agent excludes `.claude/` from greps.
- Every prompt holds: the worktree path; the Owns list with "edit no other file; stop and report"; the contract files with "do not change a signature; stop and report"; the Part 2 sections of its codes; the project invariants pasted in; "no retrieval index; grep, excluding `.claude/`"; the commands; the commit rule; the report format (commits, files, test results, red tests named red, open questions).
- Task command: `node tools/depcheck.js && npm test && npx vite build`. A task never stages `index.html`; it runs `git checkout -- index.html` if a build touched it.
- T8.2's scan test is red on its task branch for exactly the `boss.js` and `portals.js` sites (S7 owns them). The task reports it red with that reason. It turns green after S8 integrate merges `main`.
- QA agent: throwaway seeds, ports 8785..8789, `browser_snapshot` before each ref action, 0 game console errors, snapshots deleted after.

### Acceptance tests

Node tests run under `npm test`. QA means the runtime QA agent. A test is named `<code>-<n>`, for example `M6-12`.

**M1** (`tests/realm-slice.test.js`; QA)
1. Acorn finds `const SCOPED = {…}` in `src/realms.js`; `['edits', ...keys]` equals `SLICE_FIELDS`. A planted copy without `looted` fails.
2. QA: fill every scoped field, travel overworld → ember → crystal → overworld, `persist.save()`, reload. Before Play, `persist.data()` deep-equals the value before the reload, modulo `clock` and `dayTime`.
3. QA: after a travel, tile entities, looted, homes, liquid queue, and vehicles hold only the target realm's values. `torches` and `doorTimers` keep their keys over a round trip. An open door closes after the delay.

**M2** (QA)
1. `validSave(persist.data())` is true in every realm.
2. `persist.data()` on the wave base and on the step deep-equal at one paused state.

**M3** (`tests/portals.test.js`; QA)
1. `ringHas`, axis 'x': true at the 4 ring corners and the opening; false at `x0-2`, `x0+w+1`, `y0-2`, `y0+h+1`, `z0±1`.
2. The same for axis 'z'.
3. A frame built like `EXIT_FRAME` covers x -2..2, y 96..101, z 0.
4. QA: with `boss.defeated` false, a break at (0, 97, 0) in the Crystal Realm succeeds; with true, `world.setBlock` there returns false. The arrival ring stays locked in both.
5. QA: after a kill, `persist.data().boss` deep-equals `{ defeated: true }`; a reload keeps it; no boss spawns; `realm.boss.defeated` reads true.

**M4, K7, K10** (`tests/save-format.test.js`, fake store with an op log; named M4-1..M4-13)
1. No text: all four fields empty or false; `apply` not called.
2. The live fixture: `apply` once; `notice` null; `save` set.
3. Bad JSON: ops `set(<key>.rejected.<now>)`, then `remove(<key>)`; the message names the backup key; `keep` false.
4. Bad JSON, failing backup: no `remove`; `blocked` and `keep` true; "It was kept".
5. A carried `keep` notice: `store.get(key)` not called; `blocked` true; the session key removed.
6. A carried notice with bad JSON gives `null`.
7. A throwing `session.getItem` gives `null`, no throw.
8. Apply throw, session OK: `save` null; `blocked` and `reload` true; the session holds the notice.
9. A wrong seed gives a reason and a backup.
10. K7: apply throw, throwing `setItem`, good backup: `reload` true; `store` holds the notice.
11. K7: apply throw, throwing `setItem`, failed backup: `reload` false; `blocked` true.
12. K7: a notice only in `store` is returned and removed from both stores.
13. K10: `validSlice` is not exported.

**M5** (`tests/face-kind.test.js`)
1. `FACE_BYTE` has 9 distinct values.
2. Pin: `FACE_BYTE` equals `[255, 128, 0, 200, 214, 232, 160, 172, 246]`.
3. `faceKindOf(faceByte(k, false, false)) === k` except PLANT; PLANT top gives PLANT, base gives STILL.
4. `faceByte(STILL, false, true) === 246`; LEAF, GLOW, CRYSTAL keep their byte when wet.
5. Equivalence (decision 8): today's windows, sway rule, and leaf window ported to JS; old and new flags are equal on the 9 live bytes; the new decoder gives no kind on the other 247.
6. `FACE_GLSL` holds one `const float FACE_<NAME> = <byte>.0;` per kind and one `faceIs`.
7. Source: every `FACE_[A-Z_]+` in `terrain-material.js` and `shadows.js` is a `FACE_KIND` name; no `step(0.` reads `aTint.a`.

**M6 and `batched`** (`tests/world.test.js`; recorder adapter; `CONFIG.renderDistance = 3`; GenService fallback)
1. `world.js` loads in Node; depcheck passes with `world` in `PURE`.
2. Streaming reaches `readyAround(8, 8, 3) === 1`; each meshed chunk has 8 lit neighbors; one `build` per first mesh.
3. An override above the generated top shows in `getBlock` and `heights`.
4. A torch gives 15, then 14 next to it, across a chunk border; both chunks rebuild; removal clears its light.
5. A block above lowers sky light below 15; removal restores 15; a stair passes none down.
6. `setBlock` refuses y -1, y H, a locked cell, an unloaded cell, the same id. `onEdit` gets `(x, y, z, old, new)` after the relight.
7. `extraLight = () => 14` gives `lightCurve(14, LIGHT_BLK)` at a dark cell; `null` gives 0.04.
8. `reset` unloads all; one `dispose` call per loaded chunk (an unmeshed chunk has no meshes, so its call frees nothing); the hook sees the old realm; an old-epoch result is dropped.
9. A center move of RD+4 unloads and disposes the old chunks.
10. An Ember dark cell gives `lightCurve(9, LIGHT_BLK)`.
11. `batched` builds nothing inside and once per chunk after.
12. Nested: only the outer end builds; no chunk stays `dirty`.
13. A throw inside remeshes, nulls `batch`, and rethrows.
14. A `reset` inside builds no unloaded chunk.

**M7, K2** (`tests/realm-look.test.js`)
1. `(def.sky === 'day') === (def.look === null)` per row.
2. Every color is 3 finite numbers in 0..1.
3. Pin the ember and crystal look values.
4. `fx`: overworld fireflies only; ember ash only; crystal neither.
5. K2: every row with `ambient > 0` has a valid `ambientTint`.
6. Source: `sky.js` has no `EMBER_`/`CRYSTAL_` constant and no `=== 'ember'`; `ash.js` and `fireflies.js` have no `realm.current ===`.

**M8** (`tests/world.test.js`)
1. No `src/*.js` except `world.js` contains `beginBatch`, `endBatch`, or `world.batch`.

**M9** (`tests/precip.test.js`, melt 159)
1. `zoneOf` for every `BIOME`.
2. Zone 1: `t = 157` rains, `t = 158` snows.
3. `t < 0` gives kind 0 and floors -1 in every zone.
4. `snowFloor(1, 100) = 159`, `snowFloor(1, 170) = 171`, `snowFloor(2, t) = t + 1`, `snowFloor(0, t) = -1`.
5. For t in 0..175, `rainFloor >= 0` exactly when `precipKind === 1`.

**M10** (`tests/config.test.js`)
1. `DOME < SKY_BODY < TERRAIN < WATER < EFFECTS`; `STARS < CLOUDS`; `CRACK > WATER`.
2. Pin every value.

**K1** (`tests/config.test.js`)
1. `lightCurve(0, b)` is 0 and `lightCurve(15, b)` is 1 within 1e-4, for both bases.
2. Monotonic over 0..15 in steps of 0.5.
3. Each function in `LIGHT_GLSL` equals today's `curve` or `curveB` line byte for byte.
4. Grep: 0 literal `pow(0.8` sites in `src/`; the curves come only from `LIGHT_GLSL` and `lightCurve` (`config.js` defines `LIGHT_SKY` and `LIGHT_BLK` once).

**K3, K4** (`tests/atlas.test.js`, stubbed copy of `src/`; named K3/4-1..K3/4-5)
1. The real atlas loads; `tileCount <= ATLAS_TILES`.
2. Every block with `tex` has no -1 in `FACE_TILE`.
3. K4 boundary: 147 planted tiles load.
4. K4: 148 planted tiles reject with `/does not fit/` (red before the fix: the K4 repro).
5. K3: a misspelled `tex` name rejects with `/names no tile/` and names the block.

**K5** (QA, repro first). Crystal Realm, flag false (`realm.boss.defeated` on the wave base, `boss.defeated` after); a chest with one item at (0, 97, 0) and a torch at (1, 97, 0); spawn the Titan; call `boss.titan.shatter()`. Bug: `tileEntities.has('0,97,0')`, no drop, `torches.has('1,97,0')`. Fixed: the key is gone, the chest and item drop within 3 blocks, `torches` lacks the key.

**K7** (QA, repro first). A valid save under a throwaway seed; `sessionStorage.setItem` throws; `enchantSeed` deleted from the save and a throwing `Object.prototype.enchantSeed` getter that fires only under `.apply`. Bug: no reload, `persist.blocked` true, a half-applied state. Fixed: one reload, a fresh world, the notice shows, `persist.blocked` false, the `.rejected.` key exists, `clonecraft.bootNotice` is gone from `localStorage`.

**K12** (`tests/save-format.test.js`)
1. Bad JSON, good copy write, failing remove: `keep` and `blocked` true; the message ends "It was kept. Saving is off until the next visit."; the save key stays; the copy is removed.
2. Apply throw, failing remove, working session: `reload` true and the carried notice has `keep: true`. The next boot with the same store does not read the save key, does not call `apply`, writes no copy, and returns `reload: false` (no loop).
3. Apply throw, failing remove, throwing session `setItem`: `reload` false; `blocked` true; the save key stays.

**Existing tests that pass unchanged (every step):** all 109 in `tests/blocks.test.js`, `config.test.js`, `crafting.test.js`, `depcheck.test.js`, `ember-content.test.js`, `portals.test.js`, `save-format.test.js` (readSave, the save-reader rule and fail proofs, the live fixture, the sweep), and `worldgen.test.js` (golden hashes).

### Gate command

- Task and step branch: `node tools/depcheck.js && npm test && npx vite build`.
- Wave close on `main`: `npm run build`, then `npm run check` (decision 20). `npm run check` compares `index.html` with a fresh build, so it passes only after the wave rebuild (decision 14).
- Every step: 109 tests unchanged; `git diff main -- tests/fixtures` empty; `save-live.json` passes `readSave`; sweep baseline unchanged; for an M step, a string-literal diff review (`git diff main -U0 -- src | grep -E "^[+-].*['\"\`]"`) shows no user-visible text change.

### Runtime QA (decision 18)

| Step | Check |
|---|---|
| S1 | M4: a corrupt save gives a fresh world, the notice, and a backup key with the exact text. K7 repro and fix. |
| S2, S4 | Screenshot pairs, wave base versus step, at a fixed seed, position, and time, paused: overworld day (leaves, water, torch), ember (lava), crystal (crystal, portal). Identical, or each difference explained. S4 also diffs the terrain uniforms. |
| S5 | M1-2, M1-3, M2-1, M2-2. |
| S6 | An edit remeshes once with no hole; a realm round trip does not grow `renderer.info.memory.geometries`. K1 before/after screenshots (mob, drop, held item; dark cave, night). |
| S7 | M3-4, M3-5; K5 repro and fix. |
| S8 | A TNT blast, a door toggle, and a portal light each remesh once, with no hole. |
| S9 | Rain and snow by kind across y 159, in snowy plains, in a desert. Rain over water draws in front of it. |
| S10 | K12: a valid save under a throwaway seed, an apply throw, and a throwing `localStorage.removeItem`: one reload at most, the "It was kept" notice, the save key unchanged, no `.rejected.` key left, and no second reload. |

### Gates

- A step closes when its gate boxes are checked and the step gate passes on the merged branch. A wave closes when `npm run check` passes on `main` after the rebuild.
- Owner gates (rsh does not declare these done): Joe approves this spec before Step 1; Joe looks at the K1 screenshots and level table; Joe reviews each step diff; Joe approves each wave merge and the release tag.
