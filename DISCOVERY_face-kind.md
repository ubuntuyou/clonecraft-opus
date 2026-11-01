# DISCOVERY: face-kind

Gotchas, pointers, and invariants for `src/face-kind.js`: the face-kind byte that the mesher writes into the `aTint` alpha and the shaders decode. Read this file before you add a face kind or a shader that reads `aTint.a`. `ARCHITECTURE.md` D55 holds the decision.

## Invariants

- `face-kind.js` is the one owner of the face byte. The mesher writes it only through `faceByte`. The shaders read it only through `faceIs` and the `FACE_<NAME>` constants in `FACE_GLSL`.
- `FACE_BYTE` holds 9 live bytes: STILL 255, LEAF 128, PLANT 0, GLOW 200, SOFT_GLOW 214, CRYSTAL 232, PORTAL_EMBER 160, PORTAL_CRYSTAL 172, WET 246. Every other byte decodes to no kind.
- The decode is an exact match within 0.5 (`faceIs` in GLSL, `faceKindOf` in JS). There are no byte windows. A new kind needs only a new, unused byte.
- A PLANT vertex above the quad's lowest y gets 0; a vertex at the lowest y gets 255 (STILL). So only a plant top sways.
- Only a STILL face next to water gets WET (246). A LEAF, GLOW, or CRYSTAL face next to water keeps its byte.
- The decode runs in the vertex shader. A plant quad mixes 0 and 255, so a fragment decode would see interpolated bytes.
- Sway applies only in the non-water build of the terrain shader. The shadow pass reads only `FACE_LEAF`.
- `face-kind.js` has no imports and is in `PURE` (`tools/depcheck.js`). It loads after `world.js` in `src/order.js`.

## Gotchas

- `mesher.js` keeps the current kind in `swayMode`. Reset `swayMode` to `K_STILL` after each block that sets it, or the next blocks inherit the kind.
- `mesher.js` destructures `FACE_KIND` into local `K_*` names. A new kind needs a new name in that destructure.
- A new kind adds one entry to `FACE_KIND` and one byte to `FACE_BYTE`, at the same index. The M5 tests pin the table, so update `M5-2` with it.
- Never test `aTint.a` with a `step(0.` window. Test M5-7 fails on such a window in `terrain-material.js` or `shadows.js`. Add a new shader file to its `SHADER_FILES` list.

## Pointers

- Tests: `tests/face-kind.test.js` (M5-1..M5-7). M5-5 checks the old and new decoders on all 256 bytes. M5-6 checks the `FACE_GLSL` text.
- Writers: `pushQuad` in `src/mesher.js`. Readers: `src/terrain-material.js` (portal, glow, crystal, wet, sway) and `src/shadows.js` (leaf cut-out).
- QA: compare screenshots of leaves, water, a torch, lava, crystals, and both portal panes before and after a change, with the time and weather frozen.
