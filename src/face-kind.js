/* =====================================================================================
 * FACE KIND — living header (src/face-kind.js, SPEC_deepen M5)
 * -------------------------------------------------------------------------------------
 * The one owner of the face-kind byte (the aTint alpha). Terms: a **face kind** (FACE_KIND)
 * names how a face sways or glows; its **face byte** (FACE_BYTE) is the alpha that the mesher
 * writes and the shaders decode with FACE_GLSL. No imports; pure. Rules: DISCOVERY_face-kind.md.
 * ===================================================================================== */

const FACE_KIND = Object.freeze({ STILL: 0, LEAF: 1, PLANT: 2, GLOW: 3, SOFT_GLOW: 4, CRYSTAL: 5, PORTAL_EMBER: 6, PORTAL_CRYSTAL: 7, WET: 8 });
const FACE_BYTE = Uint8Array.of(255, 128, 0, 200, 214, 232, 160, 172, 246);   // by kind

// The byte of one vertex. `top`: the vertex lies above the quad's lowest y (PLANT only).
// `wet`: the face's neighbour cell is water (STILL only). -> 0..255
// TODO M5 (T2.1): PLANT gives top ? 0 : 255; STILL with wet gives FACE_BYTE[WET].
function faceByte(kind, top, wet) { return FACE_BYTE[kind]; }

// The JS mirror of the GLSL match: the kind whose byte lies within 0.5 of `byte`, or -1.
// TODO M5 (T2.1)
function faceKindOf(byte) { return -1; }

// GLSL: one `const float FACE_<NAME> = <byte>.0;` per kind, and faceIs(a, k).
// TODO M5 (T2.1)
const FACE_GLSL = '';

export { FACE_BYTE, FACE_GLSL, FACE_KIND, faceByte, faceKindOf };
