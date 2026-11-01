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
