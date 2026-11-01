// Realm look tests (SPEC_deepen M7, K2).
// The look of a realm lives in its REALMS row (config.js): look and fx.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REALMS } from '../src/config.js';

const rows = Object.entries(REALMS);
const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
// A source file without its // comments, so a comment can name a retired constant.
const code = (p) => read(p).split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');
const isColor = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1);
const LOOK_KEYS = ['top', 'horizon', 'light', 'ambientTint', 'daylight', 'sunAmt', 'lightDir', 'fogNear', 'starSize', 'star', 'aurora'];

test('M7-1 a row has a look exactly when its sky is not the day sky', () => {
  for (const [name, def] of rows) assert.equal(def.sky === 'day', def.look === null, `realm ${name}`);
});

test('M7-1 the overworld row is the day sky', () => {
  assert.equal(REALMS.overworld.sky, 'day');
  assert.equal(REALMS.overworld.look, null);
});

test('M7-2 every look has every field and no other', () => {
  for (const [name, def] of rows) {
    if (!def.look) continue;
    assert.deepEqual(Object.keys(def.look).sort(), [...LOOK_KEYS].sort(), `realm ${name}`);
  }
});

test('M7-2 every look color is 3 finite numbers in 0..1', () => {
  for (const [name, def] of rows) {
    const l = def.look;
    if (!l) continue;
    for (const k of ['top', 'horizon', 'light']) assert.ok(isColor(l[k]), `realm ${name} look.${k}`);
    if (l.ambientTint !== null) assert.ok(isColor(l.ambientTint), `realm ${name} look.ambientTint`);
    if (l.star !== null) assert.ok(isColor(l.star.color), `realm ${name} look.star.color`);
  }
});

test('M7-2 every look scalar and light direction is finite and in range', () => {
  for (const [name, def] of rows) {
    const l = def.look;
    if (!l) continue;
    for (const k of ['daylight', 'sunAmt', 'fogNear', 'aurora']) {
      assert.ok(Number.isFinite(l[k]) && l[k] >= 0 && l[k] <= 1, `realm ${name} look.${k}`);
    }
    assert.ok(l.starSize === null || (Number.isFinite(l.starSize) && l.starSize > 0), `realm ${name} look.starSize`);
    assert.ok(Array.isArray(l.lightDir) && l.lightDir.length === 3 && l.lightDir.every(Number.isFinite), `realm ${name} look.lightDir`);
    assert.ok(l.lightDir.some((v) => v !== 0), `realm ${name} look.lightDir is not the zero vector`);
    if (l.star !== null) {
      assert.deepEqual(Object.keys(l.star).sort(), ['color', 'halo', 'scale'], `realm ${name} look.star keys`);
      assert.ok(Number.isFinite(l.star.scale) && l.star.scale > 0, `realm ${name} look.star.scale`);
      assert.ok(Number.isFinite(l.star.halo) && l.star.halo >= 0 && l.star.halo <= 1, `realm ${name} look.star.halo`);
    }
  }
});

// The expected values are the literals of sky.js realmSky at the S4 contract commit (b3acd5f).
test('M7-3 the ember look keeps the sky.js values', () => {
  assert.deepEqual(REALMS.ember.look, {
    top: [0.09, 0.012, 0.006],
    horizon: [0.24, 0.05, 0.02],
    light: [1, 0.62, 0.45],
    ambientTint: [1, 0.52, 0.32],
    daylight: 0.3,
    sunAmt: 0,
    lightDir: [0.4, 0.75, 0.3],
    fogNear: 0.3,
    starSize: null,
    star: null,
    aurora: 0,
  });
});

test('M7-3 the crystal look keeps the sky.js values', () => {
  assert.deepEqual(REALMS.crystal.look, {
    top: [0.012, 0, 0.04],
    horizon: [0.2, 0.09, 0.34],
    light: [0.84, 0.76, 1],
    ambientTint: null,
    daylight: 0.8,
    sunAmt: 0.6,
    lightDir: [0.4, 0.75, 0.3],
    fogNear: 0.55,
    starSize: 2.8,
    star: { color: [0.86, 0.84, 1], scale: 0.45, halo: 0.4 },
    aurora: 0.5,
  });
});

test('M7-4 every row has fx with boolean fireflies and ash', () => {
  for (const [name, def] of rows) {
    assert.ok(def.fx && typeof def.fx === 'object', `realm ${name} fx`);
    assert.deepEqual(Object.keys(def.fx).sort(), ['ash', 'fireflies'], `realm ${name} fx keys`);
    assert.equal(typeof def.fx.fireflies, 'boolean', `realm ${name} fx.fireflies`);
    assert.equal(typeof def.fx.ash, 'boolean', `realm ${name} fx.ash`);
  }
});

test('M7-4 only the overworld has fireflies', () => {
  assert.deepEqual(rows.filter(([, d]) => d.fx.fireflies).map(([n]) => n), ['overworld']);
});

test('M7-4 only the ember realm has ash', () => {
  assert.deepEqual(rows.filter(([, d]) => d.fx.ash).map(([n]) => n), ['ember']);
});

test('M7-4 the crystal realm has neither effect', () => {
  assert.deepEqual(REALMS.crystal.fx, { fireflies: false, ash: false });
});

test('K2 every row with ambient above 0 has a valid ambientTint', () => {
  const lit = rows.filter(([, d]) => d.ambient > 0);
  assert.ok(lit.length > 0, 'at least one realm has an ambient floor');
  for (const [name, def] of lit) assert.ok(def.look && isColor(def.look.ambientTint), `realm ${name} look.ambientTint`);
});

test('K2 the ember realm tints its ambient floor with its own color', () => {
  assert.equal(REALMS.ember.ambient, 9);
  assert.deepEqual(REALMS.ember.look.ambientTint, [1, 0.52, 0.32]);
});

test('M7-6 sky.js has no EMBER_ or CRYSTAL_ constant', () => {
  assert.doesNotMatch(code('../src/sky.js'), /\b(EMBER|CRYSTAL)_[A-Z0-9_]+/);
});

test('M7-6 sky.js has no realm sky name check', () => {
  assert.doesNotMatch(code('../src/sky.js'), /===\s*'ember'|'ember'\s*===|===\s*'crystal'|'crystal'\s*===/);
});

test('M7-6 ash.js does not compare realm.current', () => {
  assert.doesNotMatch(code('../src/ash.js'), /realm\.current\s*===/);
});

test('M7-6 fireflies.js does not compare realm.current', () => {
  assert.doesNotMatch(code('../src/fireflies.js'), /realm\.current\s*===/);
});
