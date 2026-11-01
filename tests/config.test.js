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
