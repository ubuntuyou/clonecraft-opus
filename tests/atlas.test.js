// Atlas load checks (SPEC_deepen K3, K4). atlas.js paints on a canvas and imports three.js from a
// CDN, so each test loads a copy of src/ with a three.js stub and a canvas stub. A test may plant
// an edit in the copy first, as tests/depcheck.test.js does.
import './host-stub.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

// three.js stand-in: only the names that atlas.js reads.
const THREE_STUB = `const THREE = {
  ColorManagement: { enabled: false },
  NearestFilter: 1003, NoColorSpace: '',
  CanvasTexture: class { constructor(image) { this.image = image; } },
};
export { THREE };
`;

// Canvas stand-in. A 2d context method is a no-op; createImageData gives real pixel data.
// A canvas has width, height, getContext, and toDataURL.
function stubCanvas() {
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData') return (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      if (k === 'getImageData') return (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { width: 300, height: 150, getContext: () => ctx, toDataURL: () => 'data:image/png;base64,' };
}
globalThis.document ??= { createElement: (tag) => { if (tag !== 'canvas') throw new Error(`stub document: no <${tag}>`); return stubCanvas(); } };
globalThis.ImageData ??= class { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } };

// Loads atlas.js from a fresh copy of src/ and returns its module. `edit` maps a file name (as
// 'atlas' or 'blocks') to a text edit; each edit must change its file. A load error rejects.
async function loadAtlas(edit = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'atlas-'));
  try {
    cpSync('src', dir, { recursive: true });
    writeFileSync(join(dir, 'three.js'), THREE_STUB);
    for (const [name, fn] of Object.entries(edit)) {
      const p = join(dir, `${name}.js`), before = readFileSync(p, 'utf8').replace(/\r\n/g, '\n'), after = fn(before);
      assert.ok(after !== before, `the plant did not change ${name}.js`);
      writeFileSync(p, after);
    }
    return await import(pathToFileURL(join(dir, 'atlas.js')).href);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

// Plants N extra tiles in atlas.js, just before the FACE_TILE table, so tileCount is 109 + N.
const plantTiles = (n) => ({
  atlas: (src) => src.replace('const FACE_TILE = new Int16Array', `for (let i = 0; i < ${n}; i++) paintTile('planted_' + i, () => {});\nconst FACE_TILE = new Int16Array`),
});

test('K3/4-1 the real atlas loads and fits', async () => {
  const atlas = await loadAtlas();
  assert.equal(atlas.ATLAS_TILES, 256);
  assert.equal(atlas.tileCount, 109);
  assert.ok(atlas.tileCount <= atlas.ATLAS_TILES);
});

test('K3/4-2 every block with tex has a tile on all six faces', async () => {
  const [atlas, { BLOCKS }] = [await loadAtlas(), await import('../src/blocks.js')];
  let checked = 0;
  for (const def of BLOCKS) {
    if (!def || !def.tex) continue;
    checked++;
    for (let face = 0; face < 6; face++) {
      const tile = atlas.FACE_TILE[def.id * 6 + face];
      assert.ok(tile >= 0 && tile < atlas.tileCount, `${def.name} (id ${def.id}) face ${face} has tile ${tile}`);
    }
  }
  assert.ok(checked > 50, `only ${checked} blocks with tex`);
});

test('K3/4-3 K4 boundary: 147 planted tiles fill the atlas and load', async () => {
  const atlas = await loadAtlas(plantTiles(147));
  assert.equal(atlas.tileCount, atlas.ATLAS_TILES);
});

test('K3/4-4 K4: 148 planted tiles do not fit and the load rejects', async () => {
  await assert.rejects(loadAtlas(plantTiles(148)), /does not fit/);
});

test('K3/4-5 K3: a misspelled tex name rejects and names the block', async () => {
  const edit = { blocks: (src) => src.replace("tex: all('dirt')", "tex: all('drit')") };
  await assert.rejects(loadAtlas(edit), (err) => /names no tile/.test(err.message) && /Dirt/.test(err.message) && /drit/.test(err.message));
});

test('K3/4-6 K3: a misspelled front name rejects, and the message names the front key', async () => {
  const edit = { blocks: (src) => src.replace("front: 'table_front' }", "front: 'table_frnot' }") };
  await assert.rejects(loadAtlas(edit), (err) => /names no tile/.test(err.message) && /Crafting Table/.test(err.message) && /tex\.front/.test(err.message));
});
