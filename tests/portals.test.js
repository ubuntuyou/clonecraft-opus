// Portal geometry tests (SPEC_realms Phase 3): the frame check, the nearest-portal search, and
// the build plan. Each test builds a small block map; cells outside it read `fill`.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { B, LIQ_KIND, OPAQUE, SOLID } from '../src/blocks.js';
import { buildPlan, findFrame, frameCells, nearestPortal, portalFoot } from '../src/portal-frame.js';

function grid(fill = B.AIR) {
  const m = new Map();
  const get = (x, y, z) => (m.has(`${x},${y},${z}`) ? m.get(`${x},${y},${z}`) : fill);
  const set = (x, y, z, id) => m.set(`${x},${y},${z}`, id);
  return { m, get, set };
}
// An obsidian frame with opening w x h, low opening corner (x0, y0, z0), along `axis`.
function frame(g, axis, x0, y0, z0, w, h, corners = true) {
  const at = (u, v, id) => (axis === 'x' ? g.set(x0 + u, y0 + v, z0, id) : g.set(x0, y0 + v, z0 + u, id));
  for (let v = -1; v <= h; v++) for (let u = -1; u <= w; u++) {
    const ring = u === -1 || u === w || v === -1 || v === h, corner = (u === -1 || u === w) && (v === -1 || v === h);
    if (ring && (corners || !corner)) at(u, v, B.OBSIDIAN);
  }
}

test('the frame check accepts every opening size along x and z, with and without corners', () => {
  for (const axis of ['x', 'z']) for (let w = 2; w <= 4; w++) for (let h = 3; h <= 5; h++) for (const corners of [true, false]) {
    const g = grid();
    frame(g, axis, 10, 40, 20, w, h, corners);
    // click the bottom row, a side, and the top row
    const clicks = axis === 'x' ? [[10, 39, 20], [9, 41, 20], [10 + w - 1, 40 + h, 20]] : [[10, 39, 20], [10, 41, 19], [10, 40 + h, 20 + w - 1]];
    for (const c of clicks) {
      const f = findFrame(g.get, ...c);
      assert.ok(f, `${axis} ${w}x${h} corners=${corners} click ${c}`);
      assert.deepEqual([f.axis, f.x0, f.y0, f.z0, f.w, f.h], [axis, 10, 40, 20, w, h]);
      assert.equal(frameCells(f).length, w * h);
    }
  }
});

test('the frame check rejects a missing side block, a wrong block, a filled opening, and bad sizes', () => {
  const base = () => { const g = grid(); frame(g, 'x', 0, 40, 0, 2, 3); return g; };
  let g = base(); g.set(-1, 41, 0, B.AIR);
  assert.equal(findFrame(g.get, 0, 39, 0), null, 'missing side block');
  g = base(); g.set(2, 41, 0, B.STONE);
  assert.equal(findFrame(g.get, 0, 39, 0), null, 'wrong block in the side');
  g = base(); g.set(0, 43, 0, B.COBBLE);
  assert.equal(findFrame(g.get, 0, 39, 0), null, 'wrong block in the top row');
  g = base(); g.set(1, 41, 0, B.DIRT);
  assert.equal(findFrame(g.get, 0, 39, 0), null, 'filled opening');
  g = base(); g.set(0, 40, 0, B.WATER);
  assert.equal(findFrame(g.get, 0, 39, 0), null, 'water in the opening');
  for (const [w, h] of [[1, 3], [5, 3], [2, 2], [2, 6]]) {
    g = grid(); frame(g, 'z', 0, 40, 0, w, h);
    assert.equal(findFrame(g.get, 0, 39, 0), null, `opening ${w}x${h}`);
  }
  g = base();
  assert.equal(findFrame(g.get, 0, 40, 0), null, 'a click on air');
  assert.equal(findFrame(g.get, 5, 39, 0), null, 'a click away from the frame');
});

test('nearestPortal picks the nearest portal cell within the horizontal radius', () => {
  const entries = [['10,40,10', B.PORTAL_EMBER], ['3,40,3', B.OBSIDIAN], ['20,70,0', B.PORTAL_EMBER], ['-30,40,0', B.PORTAL_EMBER]];
  assert.deepEqual(nearestPortal(entries, B.PORTAL_EMBER, 0, 40, 0, 16), [10, 40, 10]);
  assert.equal(nearestPortal(entries, B.PORTAL_EMBER, 0, 40, 0, 12), null);
  assert.deepEqual(nearestPortal(entries, B.PORTAL_EMBER, 18, 70, 0, 16), [20, 70, 0]);
});

// A flat world: solid below y 40, air above.
function flat(floorId = B.STONE) {
  const g = grid();
  g.get = ((inner) => (x, y, z) => (g.m.has(`${x},${y},${z}`) ? inner(x, y, z) : y < 40 ? floorId : B.AIR))(g.get);
  return g;
}
const apply = (g, plan) => { for (const [x, y, z, id] of plan.edits) g.set(x, y, z, id); };
const touchesLava = (g, cells) => cells.some(([x, y, z]) =>
  [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].some(([dx, dy, dz]) => LIQ_KIND[g.get(x + dx, y + dy, z + dz)] === 2));

test('buildPlan builds a 2x3 portal in an obsidian frame on solid ground', () => {
  const g = flat();
  const plan = buildPlan(g.get, 100.5, 40, -50.5);
  assert.equal(plan.platform, false);
  apply(g, plan);
  const f = findFrame(g.get, ...(plan.frame.axis === 'x' ? [plan.frame.x0 - 1, plan.frame.y0, plan.frame.z0] : [plan.frame.x0, plan.frame.y0, plan.frame.z0 - 1]));
  assert.equal(f, null, 'the opening holds portal blocks, not air');
  const cells = frameCells(plan.frame);
  assert.equal(cells.length, 6);
  for (const c of cells) assert.equal(g.get(...c), B.PORTAL_EMBER);
  for (const c of cells.filter((c) => c[1] === plan.frame.y0)) { const below = g.get(c[0], c[1] - 2, c[2]); assert.ok(SOLID[below] && OPAQUE[below]); }
  assert.equal(plan.frame.y0, 41, 'the frame bottom row stands on the floor');
  assert.equal(g.get(Math.floor(plan.stand[0]), plan.stand[1], Math.floor(plan.stand[2])), B.PORTAL_EMBER);
  assert.ok(Math.hypot(plan.stand[0] - 100.5, plan.stand[2] + 50.5) <= 16);
});

test('buildPlan uses a nearby ledge before it builds a platform', () => {
  const g = grid();
  // a lava sea up to y 31 and a rock ledge at x 6..20, z -3..3, top y 35
  g.get = ((inner) => (x, y, z) => (g.m.has(`${x},${y},${z}`) ? inner(x, y, z)
    : y <= 31 ? B.LAVA : (x >= 6 && x <= 20 && z >= -3 && z <= 3 && y <= 35) ? B.EMBER_ROCK : B.AIR))(g.get);
  const plan = buildPlan(g.get, 0.5, 34, 0.5);
  assert.equal(plan.platform, false);
  apply(g, plan);
  const all = [];
  for (const [x, y, z, id] of plan.edits) if (id === B.PORTAL_EMBER || id === B.OBSIDIAN) all.push([x, y, z]);
  assert.equal(touchesLava(g, all), false);
});

test('buildPlan over open lava builds the platform, and the portal never touches lava', () => {
  const g = grid();
  g.get = ((inner) => (x, y, z) => (g.m.has(`${x},${y},${z}`) ? inner(x, y, z) : y <= 33 ? B.LAVA : B.AIR))(g.get);
  const plan = buildPlan(g.get, 0.5, 33, 0.5);
  assert.equal(plan.platform, true);
  apply(g, plan);
  const structure = plan.edits.filter((e) => e[3] !== B.AIR).map((e) => e.slice(0, 3));
  const portal = structure.filter((c) => g.get(...c) === B.PORTAL_EMBER);
  assert.equal(portal.length, 6);
  assert.equal(touchesLava(g, portal), false, 'portal cells touch lava');
  // the frame and the platform: obsidian inside the 4 x 3 footprint. Replaced lava lies outside it.
  const f = plan.frame, inFoot = ([x, y, z]) => y >= f.y0 - 1 && y <= f.y0 + 3 && x >= f.x0 - 1 && x <= f.x0 + 2 && z >= f.z0 - 1 && z <= f.z0 + 1;
  const frameAndPlatform = plan.edits.filter((e) => e[3] === B.OBSIDIAN && inFoot(e)).map((e) => e.slice(0, 3));
  assert.ok(frameAndPlatform.length >= 12 + 8);
  assert.equal(touchesLava(g, frameAndPlatform), false, 'the frame or platform touches lava');
  // the platform: 4 x 3 obsidian under the opening's floor level
  let n = 0;
  for (const [x, y, z, id] of plan.edits) if (id === B.OBSIDIAN && y === plan.frame.y0 - 1) n++;
  assert.ok(n >= 12);
  assert.deepEqual(portalFoot(g.get, [Math.floor(plan.stand[0]), plan.frame.y0 + 2, Math.floor(plan.stand[2])], B.PORTAL_EMBER),
    [Math.floor(plan.stand[0]), plan.frame.y0, Math.floor(plan.stand[2])]);
});
