// Precipitation rule tests (SPEC_deepen M9). precip.js is pure: it imports only biomes.js.
// The tests use the module interface: zoneOf, precipKind, snowFloor, rainFloor.
// MELT is a fake snow line, the real SNOW_LINE + 1, passed as a parameter (SPEC: melt is a parameter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BIOME } from '../src/biomes.js';
import { precipKind, rainFloor, snowFloor, zoneOf } from '../src/precip.js';

const MELT = 159;
const ZONES = [-1, 0, 1, 2];   // -1 is an unloaded column (weather.js passes it); 0 dry, 1 height rule, 2 always snow
const NONE = 0, RAIN = 1, SNOW = 2;

// Zones by biome name. A new BIOME entry fails M9-1 until it is listed here.
const ZONE_OF = {
  OCEAN: 1, BEACH: 1, PLAINS: 1, FOREST: 1, RAINFOREST: 1, DESERT: 0,
  HIGHLANDS: 1, SNOWY_MOUNTAINS: 2, SNOWY_PLAINS: 2, RIVER: 1,
};

// ---- M9-1: zoneOf -------------------------------------------------------------------------------
test('M9-1 the zone table names every BIOME', () => {
  assert.deepEqual(Object.keys(ZONE_OF).sort(), Object.keys(BIOME).sort());
});
for (const [name, zone] of Object.entries(ZONE_OF)) {
  test(`M9-1 zoneOf(BIOME.${name}) is ${zone}`, () => {
    assert.equal(zoneOf(BIOME[name]), zone);
  });
}

// ---- M9-2: the zone 1 height rule -----------------------------------------------------------------
test('M9-2 zone 1: t = 157 rains', () => {
  assert.equal(precipKind(1, 157, MELT), RAIN);
});
test('M9-2 zone 1: t = 158 snows (t + 1 == melt)', () => {
  assert.equal(precipKind(1, 158, MELT), SNOW);
});
test('M9-2 zone 1: t + 1 == melt - 1 rains, t + 1 == melt snows, for another melt', () => {
  assert.equal(precipKind(1, 99, 101), RAIN);    // t + 1 = 100 = melt - 1
  assert.equal(precipKind(1, 100, 101), SNOW);   // t + 1 = 101 = melt
});
test('M9-2 zone 1: ground level rains and a peak far above melt snows', () => {
  assert.equal(precipKind(1, 0, MELT), RAIN);
  assert.equal(precipKind(1, 250, MELT), SNOW);
});
test('M9-2 zone 0 (desert) is dry at every height', () => {
  for (const t of [0, 1, 80, 157, 158, 159, 200]) assert.equal(precipKind(0, t, MELT), NONE, `t = ${t}`);
});
test('M9-2 zone 2 (snowy biomes) snows at every height', () => {
  for (const t of [0, 1, 80, 157, 158, 159, 200]) assert.equal(precipKind(2, t, MELT), SNOW, `t = ${t}`);
});
test('M9-2 melt is a parameter: the rule follows the melt it gets', () => {
  assert.equal(precipKind(1, 50, 40), SNOW);
  assert.equal(precipKind(1, 50, 200), RAIN);
});

// ---- M9-3: t < 0 and zone -1 --------------------------------------------------------------------
for (const zone of ZONES) {
  test(`M9-3 zone ${zone}: t = -1 gives kind 0 and floors -1`, () => {
    assert.equal(precipKind(zone, -1, MELT), NONE);
    assert.equal(snowFloor(zone, -1, MELT), -1);
    assert.equal(rainFloor(zone, -1, MELT), -1);
  });
  test(`M9-3 zone ${zone}: any t < 0 gives kind 0 and floors -1`, () => {
    for (const t of [-2, -50, -1e6]) {
      assert.equal(precipKind(zone, t, MELT), NONE, `kind, t = ${t}`);
      assert.equal(snowFloor(zone, t, MELT), -1, `snowFloor, t = ${t}`);
      assert.equal(rainFloor(zone, t, MELT), -1, `rainFloor, t = ${t}`);
    }
  });
}
test('M9-3 zone -1 (unloaded) gives kind 0 and floors -1 for any t >= 0', () => {
  for (const t of [0, 100, 158, 200]) {
    assert.equal(precipKind(-1, t, MELT), NONE, `kind, t = ${t}`);
    assert.equal(snowFloor(-1, t, MELT), -1, `snowFloor, t = ${t}`);
    assert.equal(rainFloor(-1, t, MELT), -1, `rainFloor, t = ${t}`);
  }
});

// ---- M9-4: the snow floor -------------------------------------------------------------------------
test('M9-4 snowFloor(1, 100) is the melt line', () => {
  assert.equal(snowFloor(1, 100, MELT), 159);
});
test('M9-4 snowFloor(1, 170) is the top + 1', () => {
  assert.equal(snowFloor(1, 170, MELT), 171);
});
test('M9-4 snowFloor(1, t) is max(t + 1, melt), at the boundary too', () => {
  assert.equal(snowFloor(1, 157, MELT), 159);   // t + 1 = 158 < melt
  assert.equal(snowFloor(1, 158, MELT), 159);   // t + 1 == melt
  assert.equal(snowFloor(1, 159, MELT), 160);   // t + 1 > melt
  assert.equal(snowFloor(1, 0, MELT), 159);
});
test('M9-4 snowFloor(2, t) is t + 1', () => {
  for (const t of [0, 1, 100, 158, 159, 200]) assert.equal(snowFloor(2, t, MELT), t + 1, `t = ${t}`);
});
test('M9-4 snowFloor(0, t) is -1', () => {
  for (const t of [0, 1, 100, 158, 159, 200]) assert.equal(snowFloor(0, t, MELT), -1, `t = ${t}`);
});

// ---- M9-5: the rain floor -------------------------------------------------------------------------
test('M9-5 for t in 0..175, rainFloor >= 0 exactly when precipKind is rain (every zone)', () => {
  for (const zone of ZONES) {
    for (let t = 0; t <= 175; t++) {
      const rains = precipKind(zone, t, MELT) === RAIN;
      assert.equal(rainFloor(zone, t, MELT) >= 0, rains, `zone ${zone}, t = ${t}`);
    }
  }
});
test('M9-5 where it rains, the rain floor is t + 1', () => {
  for (let t = 0; t <= 157; t++) assert.equal(rainFloor(1, t, MELT), t + 1, `t = ${t}`);
});
test('M9-5 rain floor boundary: t + 1 == melt - 1 rains, t + 1 == melt does not', () => {
  assert.equal(rainFloor(1, 157, MELT), 158);
  assert.equal(rainFloor(1, 158, MELT), -1);
});
test('M9-5 zones 0 and 2 have no rain floor', () => {
  for (const t of [0, 50, 157, 158, 175]) {
    assert.equal(rainFloor(0, t, MELT), -1, `zone 0, t = ${t}`);
    assert.equal(rainFloor(2, t, MELT), -1, `zone 2, t = ${t}`);
  }
});

// ---- M9-6: a flake lands where snow falls ----------------------------------------------------------
test('M9-6 where the kind is snow, the snow floor is at least 0 (every zone)', () => {
  for (const zone of ZONES) {
    for (let t = 0; t <= 175; t++) {
      if (precipKind(zone, t, MELT) === SNOW) assert.ok(snowFloor(zone, t, MELT) >= 0, `zone ${zone}, t = ${t}`);
    }
  }
});
test('M9-6 where the kind is snow, the snow floor is above the top block', () => {
  for (const zone of [1, 2]) {
    for (let t = 0; t <= 175; t++) {
      if (precipKind(zone, t, MELT) === SNOW) assert.ok(snowFloor(zone, t, MELT) >= t + 1, `zone ${zone}, t = ${t}`);
    }
  }
});
