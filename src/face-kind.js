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
function faceByte(kind, top, wet) {
  if (kind === FACE_KIND.PLANT) return top ? 0 : 255;
  if (kind === FACE_KIND.STILL && wet) return FACE_BYTE[FACE_KIND.WET];
  return FACE_BYTE[kind];
}

// The JS mirror of the GLSL match: the kind whose byte lies within 0.5 of `byte`, or -1.
function faceKindOf(byte) {
  for (let k = 0; k < FACE_BYTE.length; k++) if (Math.abs(byte - FACE_BYTE[k]) <= 0.5) return k;
  return -1;
}

// GLSL: one `const float FACE_<NAME> = <byte>.0;` per kind, and faceIs(a, k). `a` is the
// normalized aTint alpha; faceIs gives 1.0 when its byte is k (within 0.5), else 0.0.
const FACE_GLSL = Object.keys(FACE_KIND).map((name) => `const float FACE_${name} = ${FACE_BYTE[FACE_KIND[name]]}.0;\n`).join('')
  + 'float faceIs(float a, float k) { return step(abs(a * 255.0 - k), 0.5); }\n';

export { FACE_BYTE, FACE_GLSL, FACE_KIND, faceByte, faceKindOf };
