// Face-kind tests (SPEC_deepen M5). face-kind.js owns the face-kind byte (the aTint alpha).
// The tests use the module interface: FACE_KIND, FACE_BYTE, faceByte, faceKindOf, FACE_GLSL.
// The equivalence test (M5-5) holds today's shader windows as a JS transcription. They were
// copied from terrain-material.js (vertex shader) and shadows.js (VS) before M5 and stay frozen here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACE_BYTE, FACE_GLSL, FACE_KIND, faceByte, faceKindOf } from '../src/face-kind.js';

const KINDS = Object.entries(FACE_KIND);   // [name, kind]
const LIVE = [255, 128, 0, 200, 214, 232, 160, 172, 246];

// ---- M5-1, M5-2: the table ------------------------------------------------------------------
test('M5-1 FACE_KIND is frozen and numbers the 9 kinds 0..8', () => {
  assert.ok(Object.isFrozen(FACE_KIND));
  assert.deepEqual(Object.values(FACE_KIND), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});
test('M5-1 FACE_BYTE has 9 distinct values', () => {
  assert.equal(FACE_BYTE.length, 9);
  assert.equal(new Set(FACE_BYTE).size, 9);
});
test('M5-2 pin: FACE_BYTE equals [255, 128, 0, 200, 214, 232, 160, 172, 246]', () => {
  assert.deepEqual([...FACE_BYTE], LIVE);
});

// ---- M5-3: the encoder and decoder round trip ------------------------------------------------
test('M5-3 every kind but PLANT decodes back to itself', () => {
  for (const [name, k] of KINDS) {
    if (k === FACE_KIND.PLANT) continue;
    assert.equal(faceKindOf(faceByte(k, false, false)), k, name);
  }
});
test('M5-3 a PLANT vertex above the lowest y gives byte 0 and decodes to PLANT', () => {
  const b = faceByte(FACE_KIND.PLANT, true, false);
  assert.equal(b, 0);
  assert.equal(faceKindOf(b), FACE_KIND.PLANT);
});
test('M5-3 a PLANT vertex at the lowest y gives byte 255 and decodes to STILL', () => {
  const b = faceByte(FACE_KIND.PLANT, false, false);
  assert.equal(b, 255);
  assert.equal(faceKindOf(b), FACE_KIND.STILL);
});
test('M5-3 top changes the byte of PLANT only', () => {
  for (const [name, k] of KINDS) {
    if (k === FACE_KIND.PLANT) continue;
    assert.equal(faceByte(k, true, false), faceByte(k, false, false), name);
  }
});

// ---- M5-4: the wet rule ----------------------------------------------------------------------
test('M5-4 a wet STILL face gives 246', () => {
  assert.equal(faceByte(FACE_KIND.STILL, false, true), 246);
  assert.equal(faceKindOf(faceByte(FACE_KIND.STILL, false, true)), FACE_KIND.WET);
});
test('M5-4 a dry STILL face keeps 255', () => {
  assert.equal(faceByte(FACE_KIND.STILL, false, false), 255);
});
test('M5-4 LEAF, GLOW, and CRYSTAL keep their byte when wet', () => {
  for (const name of ['LEAF', 'GLOW', 'CRYSTAL']) {
    const k = FACE_KIND[name];
    assert.equal(faceByte(k, false, true), FACE_BYTE[k], name);
  }
});
test('M5-4 every kind but STILL keeps its byte when wet', () => {
  for (const [name, k] of KINDS) {
    if (k === FACE_KIND.STILL) continue;
    assert.equal(faceByte(k, false, true), faceByte(k, false, false), name);
  }
});

// ---- M5-5: equivalence with today's windows (decision 8) -------------------------------------
// The vertex attribute holds byte / 255 as a float32. Both decoders see that value.
const alpha = (b) => Math.fround(b / 255);
const step = (edge, x) => (x < edge ? 0 : 1);

// Today's windows, copied from the shaders. Each flag is the value the shader computes.
function oldFlags(b) {
  const a = alpha(b);
  const sw = a < 0.6 ? 1.0 - a : 0.0;
  const sways = sw > 0.01;
  return {
    portal: step(0.6, a) * step(a, 0.66) + 2.0 * step(0.665, a) * step(a, 0.69),
    crystal: step(0.88, a) * step(a, 0.94),
    glow: step(0.7, a) * step(a, 0.85) * (a > 0.82 ? 0.5 : 1.0),
    wet: step(0.955, a) * step(a, 0.975),
    sway: sways ? (sw > 0.75 ? 1.6 : 0.5) : 0,   // `amt` without the gust factor
    bob: sways ? step(sw, 0.75) : 0,             // the y-bob factor, active only while swaying
    leaf: step(0.45, a) * step(a, 0.55),         // the shadow shader's vLeaf
  };
}
// The same flags from the new decoder, written as the spec states them.
function newFlags(b) {
  const kind = faceKindOf(alpha(b) * 255);   // the GLSL sees a * 255.0, which is not exactly b
  const is = (name) => (kind === FACE_KIND[name] ? 1 : 0);
  const leaf = is('LEAF'), plant = is('PLANT');
  return {
    portal: is('PORTAL_EMBER') + 2.0 * is('PORTAL_CRYSTAL'),
    crystal: is('CRYSTAL'),
    glow: is('GLOW') + 0.5 * is('SOFT_GLOW'),
    wet: is('WET'),
    sway: leaf + plant > 0.5 ? (plant > 0.5 ? 1.6 : 0.5) : 0,
    bob: leaf + plant > 0.5 ? leaf : 0,
    leaf,
  };
}

test('M5-5 old and new flags are equal on the 9 live bytes', () => {
  for (const b of LIVE) assert.deepEqual(newFlags(b), oldFlags(b), `byte ${b}`);
});
test('M5-5 each live byte decodes to its own kind from the float32 round trip', () => {
  FACE_BYTE.forEach((b, k) => assert.equal(faceKindOf(alpha(b) * 255), k, `byte ${b}`));
});
test('M5-5 the new decoder gives no kind on the other 247 bytes', () => {
  let n = 0;
  for (let b = 0; b < 256; b++) {
    if (LIVE.includes(b)) continue;
    n++;
    assert.equal(faceKindOf(alpha(b) * 255), -1, `byte ${b}`);
    assert.equal(faceKindOf(b), -1, `byte ${b}`);
  }
  assert.equal(n, 247);
});
test('M5-5 the match holds within 0.5 and fails beyond it', () => {
  for (const b of LIVE) {
    const k = FACE_BYTE.indexOf(b);
    assert.equal(faceKindOf(b - 0.4), k, `byte ${b} - 0.4`);
    assert.equal(faceKindOf(b + 0.4), k, `byte ${b} + 0.4`);
    assert.equal(faceKindOf(b - 0.6), -1, `byte ${b} - 0.6`);
    assert.equal(faceKindOf(b + 0.6), -1, `byte ${b} + 0.6`);
  }
});
test('M5-5 the faceIs text in FACE_GLSL agrees with faceKindOf on all 256 bytes', () => {
  const m = /float faceIs\(float a, float k\) \{ return (.+?); \}/.exec(FACE_GLSL);
  assert.ok(m, 'faceIs found');
  const faceIs = new Function('step', 'abs', 'a', 'k', `return ${m[1]};`).bind(null, step, Math.abs);
  for (let b = 0; b < 256; b++) {
    const a = alpha(b);
    for (const [name, k] of KINDS) {
      assert.equal(faceIs(a, FACE_BYTE[k]), faceKindOf(a * 255) === k ? 1 : 0, `byte ${b} ${name}`);
    }
  }
});

// ---- M5-6: the GLSL text ---------------------------------------------------------------------
test('M5-6 FACE_GLSL holds one const float per kind with the kind byte', () => {
  const consts = [...FACE_GLSL.matchAll(/const float (FACE_[A-Z_]+) = (\d+)\.0;/g)];
  assert.equal(consts.length, KINDS.length);
  assert.equal((FACE_GLSL.match(/const float/g) || []).length, KINDS.length);
  const got = Object.fromEntries(consts.map((c) => [c[1], Number(c[2])]));
  const want = Object.fromEntries(KINDS.map(([name, k]) => [`FACE_${name}`, FACE_BYTE[k]]));
  assert.deepEqual(got, want);
});
test('M5-6 FACE_GLSL holds one faceIs that matches the exact byte', () => {
  assert.equal((FACE_GLSL.match(/\bfaceIs\s*\(/g) || []).length, 1);
  assert.ok(FACE_GLSL.includes('float faceIs(float a, float k) { return step(abs(a * 255.0 - k), 0.5); }'));
});

// ---- M5-7: the shader sources ----------------------------------------------------------------
// Strip `//` comments so prose never trips a check.
const source = (f) => readFileSync(`src/${f}`, 'utf8').replace(/\/\/.*$/gm, '');
const SHADER_FILES = ['terrain-material.js', 'shadows.js'];
// FACE_GLSL (the injected text) and FACE_KIND (the import) are the module's other exports.
const ALLOWED = new Set([...Object.keys(FACE_KIND).map((n) => `FACE_${n}`), 'FACE_GLSL', 'FACE_KIND']);

test('M5-7 every FACE_ name in the shader sources is a FACE_KIND name or an export of face-kind.js', () => {
  for (const f of SHADER_FILES) {
    const names = source(f).match(/\bFACE_[A-Z_]+\b/g) || [];
    const bad = names.filter((n) => !ALLOWED.has(n));
    assert.deepEqual(bad, [], f);
  }
});
test('M5-7 the shader sources decode with FACE_GLSL and name the kinds they read', () => {
  // Boolean asserts keep a failure short; assert.match would print the whole source.
  const has = (f, re) => re.test(source(f));
  assert.ok(has('terrain-material.js', /\bFACE_GLSL\b/), 'terrain-material.js uses FACE_GLSL');
  assert.ok(has('shadows.js', /\bFACE_GLSL\b/), 'shadows.js uses FACE_GLSL');
  assert.ok(has('shadows.js', /\bFACE_LEAF\b/), 'shadows.js reads FACE_LEAF');
  for (const n of ['PORTAL_EMBER', 'PORTAL_CRYSTAL', 'GLOW', 'SOFT_GLOW', 'CRYSTAL', 'WET', 'LEAF', 'PLANT']) {
    assert.ok(has('terrain-material.js', new RegExp(`\\bFACE_${n}\\b`)), `terrain-material.js reads FACE_${n}`);
  }
});
test('M5-7 no step(0. window reads aTint.a', () => {
  const windows = [
    /step\(\s*0?\.\d+\s*,[^;)]*aTint\.a/,   // step(0.45, aTint.a)
    /step\(\s*aTint\.a\s*,/,                // step(aTint.a, 0.55)
    /aTint\.a\s*[<>]=?\s*[\d.]/,            // aTint.a < 0.6
    /[\d.]\s*[<>]=?\s*aTint\.a/,            // 0.6 > aTint.a
  ];
  for (const f of SHADER_FILES) {
    const src = source(f);
    windows.forEach((re, i) => assert.ok(!re.test(src), `${f} matches window pattern ${i}`));
  }
});
