// Render distance rules (SPEC_hardening H6).
// The rd-ready rule: the lowest render distance must mesh the chunks that loading waits for.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clampRenderDistance, RD_MAX, RD_MIN, READY_RADIUS } from '../src/config.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('rd-ready: the constants are finite and ordered', () => {
  for (const v of [RD_MIN, RD_MAX, READY_RADIUS]) assert.ok(Number.isInteger(v) && v > 0, `bad constant ${v}`);
  assert.ok(RD_MIN < RD_MAX, 'RD_MIN is below RD_MAX');
});

test('rd-ready: the mesh radius at RD_MIN covers READY_RADIUS', () => {
  // world.js meshes a chunk when its distance squared is at most (RD + 0.5) squared.
  assert.ok((RD_MIN + 0.5) ** 2 >= READY_RADIUS ** 2, `RD_MIN ${RD_MIN} never meshes chunks at distance ${READY_RADIUS}`);
});

test('rd-ready: clampRenderDistance returns an integer in RD_MIN..RD_MAX', () => {
  for (const n of [0, 1, 2, 17, NaN, -5, Infinity, 5.6, 8]) {
    const v = clampRenderDistance(n);
    assert.ok(Number.isInteger(v) && v >= RD_MIN && v <= RD_MAX, `clampRenderDistance(${n}) gave ${v}`);
  }
  assert.equal(clampRenderDistance(2), RD_MIN);
  assert.equal(clampRenderDistance(17), RD_MAX);
  assert.equal(clampRenderDistance(NaN), 8);
});

test('rd-ready: the settings slider min equals RD_MIN', () => {
  const m = /id="setRd"[^>]*\bmin="(\d+)"/.exec(read('../src/index.html'));
  assert.ok(m, 'setRd slider not found in src/index.html');
  assert.equal(+m[1], RD_MIN);
});

test('rd-ready: the README range equals RD_MIN..RD_MAX', () => {
  const m = /`rd=N`[^\n]*\((\d+)–(\d+)\)/.exec(read('../README.md'));
  assert.ok(m, 'rd=N range not found in README.md');
  assert.deepEqual([+m[1], +m[2]], [RD_MIN, RD_MAX]);
});

// SPEC_deepen K1: the light curves live in config.js. brightnessAt, sky.js, and the terrain shader share them.
import { LIGHT_BLK, LIGHT_GLSL, LIGHT_SKY, lightCurve } from '../src/config.js';
import { DRAW_ORDER } from '../src/config.js';
import { readdirSync } from 'node:fs';

// The shader text before K1 (terrain-material.js, `curve` and `curveB`), one function per line.
const GLSL_CURVE = 'float curve(float l) { return (pow(0.83, (1.0 - l) * 15.0) - 0.0611) / 0.9389; }';
const GLSL_CURVE_B = 'float curveB(float l) { return (pow(0.85, (1.0 - l) * 15.0) - 0.0874) / 0.9126; }';

test('K1-1 lightCurve is 0 at level 0 and 1 at level 15 for both bases', () => {
  for (const base of [LIGHT_SKY, LIGHT_BLK]) {
    assert.ok(Math.abs(lightCurve(0, base)) < 1e-4, `lightCurve(0, ${base}) = ${lightCurve(0, base)}`);
    assert.ok(Math.abs(lightCurve(15, base) - 1) < 1e-4, `lightCurve(15, ${base}) = ${lightCurve(15, base)}`);
  }
  assert.deepEqual([LIGHT_SKY, LIGHT_BLK], [0.83, 0.85]);
});

test('K1-2 lightCurve rises strictly over 0..15 in steps of 0.5', () => {
  for (const base of [LIGHT_SKY, LIGHT_BLK]) {
    for (let l = 0.5; l <= 15; l += 0.5) assert.ok(lightCurve(l, base) > lightCurve(l - 0.5, base), `base ${base} at ${l}`);
  }
});

test('K1-3 LIGHT_GLSL holds the curve and curveB functions of the old shader, byte for byte', () => {
  assert.deepEqual(LIGHT_GLSL.split('\n'), [GLSL_CURVE, GLSL_CURVE_B]);
});

test('K1-3 the GLSL constants are the rounded values of the JS curve', () => {
  // lightCurve builds its constants with toFixed(4); a drift here moves uAmbient.
  for (const [base, lo, span] of [[LIGHT_SKY, 0.0611, 0.9389], [LIGHT_BLK, 0.0874, 0.9126]]) {
    assert.equal(+(base ** 15).toFixed(4), lo);
    assert.equal(+(1 - base ** 15).toFixed(4), span);
    assert.equal(lightCurve(7, base), (base ** 8 - lo) / span);
  }
});

test('K1-4 one definition site of the light curves in src/', () => {
  const sites = [];
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
    if (/pow\(\s*0\.8\d*\b/.test(read(`../src/${f}`))) sites.push(f);
  }
  assert.deepEqual(sites, [], 'no source file hard-codes the 0.83 or 0.85 base; config.js builds it from LIGHT_SKY and LIGHT_BLK');
  assert.ok(/const LIGHT_SKY = 0\.83, LIGHT_BLK = 0\.85;/.test(read('../src/config.js')), 'config.js defines the bases once');
});

test('K1-5 the level table: block light before and after K1', () => {
  // SPEC_deepen K1: brightnessAt at block level l (daylight 0) is max(0.04, lightCurve(l, LIGHT_BLK)).
  const after = { 0: 0.04, 4: 0.088, 8: 0.256, 9: 0.317, 12: 0.577, 14: 0.836, 15: 1 };
  for (const [l, v] of Object.entries(after)) {
    const got = Math.max(0.04, lightCurve(+l, LIGHT_BLK));
    assert.ok(Math.abs(got - v) < 5e-4, `block ${l}: ${got.toFixed(4)} vs ${v}`);
  }
  assert.ok(Math.abs(lightCurve(4, LIGHT_SKY) - 0.072) < 5e-4, `sky 4: ${lightCurve(4, LIGHT_SKY)}`);
});

test('K1-6 the terrain shader and sky.js use the shared curves', () => {
  const tm = read('../src/terrain-material.js');
  assert.ok(tm.includes('${LIGHT_GLSL}'), 'terrain-material.js interpolates LIGHT_GLSL');
  assert.ok(!/float curveB?\(float/.test(tm), 'terrain-material.js defines no curve function of its own');
  const sky = read('../src/sky.js');
  assert.ok(!/const curveB\b/.test(sky), 'sky.js has no local curveB');
  assert.ok(sky.includes('lightCurve(def.ambient, LIGHT_BLK)'), 'sky.js feeds uAmbient from lightCurve');
});

// ---- M10: one draw-order table (SPEC_deepen M10) ---------------------------------------------------
test('M10-1 DRAW_ORDER is frozen', () => {
  assert.ok(Object.isFrozen(DRAW_ORDER));
});
test('M10-1 the order holds: DOME < SKY_BODY < TERRAIN < WATER < EFFECTS', () => {
  const chain = ['DOME', 'SKY_BODY', 'TERRAIN', 'WATER', 'EFFECTS'];
  for (let i = 1; i < chain.length; i++) {
    assert.ok(DRAW_ORDER[chain[i - 1]] < DRAW_ORDER[chain[i]], `${chain[i - 1]} < ${chain[i]}`);
  }
});
test('M10-1 the stars draw before the clouds', () => {
  assert.ok(DRAW_ORDER.STARS < DRAW_ORDER.CLOUDS);
});
test('M10-1 the crack overlay draws after the water', () => {
  assert.ok(DRAW_ORDER.CRACK > DRAW_ORDER.WATER);
});
test('M10-2 pin: every DRAW_ORDER value', () => {
  assert.deepEqual({ ...DRAW_ORDER }, {
    DOME: -10, SKY_BODY: -9, TERRAIN: 0, WATER: 1, STARS: 1.5, CLOUDS: 2, CRACK: 2, EFFECTS: 3,
  });
});
test('M10-3 source: no src file assigns a numeric literal to renderOrder', () => {
  // The renderOrder sites read the table (sky, targeting, weather, ash, fireflies, particles).
  const bad = [];
  for (const f of readdirSync(new URL('../src/', import.meta.url)).filter((n) => n.endsWith('.js'))) {
    read(`../src/${f}`).split('\n').forEach((line, i) => {
      if (/renderOrder\s*=\s*(?:[\w.]+\s*=\s*)*-?\d/.test(line)) bad.push(`${f}:${i + 1}`);
    });
  }
  assert.deepEqual(bad, []);
});
test('M10-3 source: mesher.js passes DRAW_ORDER.TERRAIN and DRAW_ORDER.WATER to setChunkGeometry', () => {
  const m = read('../src/mesher.js');
  assert.ok(/setChunkGeometry\([^\n]*opaqueMesh[^\n]*DRAW_ORDER\.TERRAIN\)/.test(m), 'opaque mesh uses TERRAIN');
  assert.ok(/setChunkGeometry\([^\n]*waterMesh[^\n]*DRAW_ORDER\.WATER\)/.test(m), 'water mesh uses WATER');
});
