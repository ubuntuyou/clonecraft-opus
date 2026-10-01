/* =====================================================================================
 * === 12. HELD ITEM VIEW MODEL
 * -------------------------------------------------------------------------------------
 * The held item renders in its own scene and camera after the world, with the depth
 * buffer cleared, so it never clips into walls. Item models:
 *   - cube blocks: a textured cube from a pre-tinted copy of the atlas,
 *   - everything else: the 16x16 item pixel art extruded into 1/16-thick voxels.
 * The same models serve dropped items. Transform stack:
 *   vmRoot (bob, sway, equip dip) -> vmSwing (attack swing) -> held mesh (per-kind pose).
 * ===================================================================================== */
import { THREE } from './three.js';
import { B, BLOCKS, IS_STAIR, ITEMS, SHAPE, SHAPE_OF, STAIR_BOXES, STAIR_SIDE } from './blocks.js';
import { BIOME, BIOME_FOLIAGE, BIOME_GRASS, TINT_ALPHA } from './biomes.js';
import { actx, ATLAS_SIZE, FACE_TILE, ITEM_PIX, mobTexture, TILE, tintedPixels } from './atlas.js';
import { FACES, UV_CORNERS } from './mesher.js';
import { camera, game, player, world } from './engine.js';
import { bow } from './interact.js';
import { inv } from './order.js';

// Atlas copy with biome tint applied (grass/leaves use the plains/forest colour).
const itemAtlasCanvas = document.createElement('canvas');
itemAtlasCanvas.width = itemAtlasCanvas.height = ATLAS_SIZE;
{
  const g = itemAtlasCanvas.getContext('2d');
  const img = actx.getImageData(0, 0, ATLAS_SIZE, ATLAS_SIZE), d = img.data;
  const leafTiles = new Set([TILE.leaves]);
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const tint = leafTiles.has(ty * 16 + tx) ? BIOME_FOLIAGE[BIOME.FOREST] : BIOME_GRASS[BIOME.PLAINS];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const i = ((ty * 16 + y) * ATLAS_SIZE + tx * 16 + x) * 4;
      if (d[i + 3] === TINT_ALPHA) { d[i] = d[i] * tint[0] / 255; d[i + 1] = d[i + 1] * tint[1] / 255; d[i + 2] = d[i + 2] * tint[2] / 255; d[i + 3] = 255; }
    }
  }
  g.putImageData(img, 0, 0);
}
const itemAtlasTexture = new THREE.CanvasTexture(itemAtlasCanvas);
itemAtlasTexture.magFilter = itemAtlasTexture.minFilter = THREE.NearestFilter;
itemAtlasTexture.generateMipmaps = false; itemAtlasTexture.flipY = false; itemAtlasTexture.colorSpace = THREE.NoColorSpace;

const ITEM_GEO = {};   // item id -> { geo, textured }
function cubeItemGeometry(id) {
  const pos = [], uv = [], col = [], idx = [];
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], tile = FACE_TILE[id * 6 + f], tu = (tile & 15) * 16, tv = (tile >> 4) * 16;
    const base = pos.length / 3;
    for (let k = 0; k < 4; k++) {
      const c = F.c[k];
      pos.push(c[0] - 0.5, c[1] - 0.5, c[2] - 0.5);
      const u = UV_CORNERS[k];
      uv.push((tu + 0.01 + u[0] * 15.98) / ATLAS_SIZE, (tv + 0.01 + u[1] * 15.98) / ATLAS_SIZE);
      col.push(F.shade, F.shade, F.shade);
    }
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
// Stair item: the boxes of a straight stair with the step at -X (as in the icon), 1 unit wide.
// Each face takes the part of the side tile that it covers.
function stairItemGeometry(id) {
  const pos = [], uv = [], col = [], idx = [];
  const tile = FACE_TILE[id * 6], tu = (tile & 15) * 16, tv = (tile >> 4) * 16;
  for (const b of STAIR_BOXES[STAIR_SIDE[0]]) {   // tall half at +X, so the step lies at -X
    for (let f = 0; f < 6; f++) {
      const F = FACES[f], ax = F.n[0] ? 0 : F.n[1] ? 1 : 2, base = pos.length / 3;
      for (let k = 0; k < 4; k++) {
        const c = F.c[k].map((v, i) => (v ? b[i + 3] : b[i]) / 16);
        pos.push(c[0] - 0.5, c[1] - 0.5, c[2] - 0.5);
        // u and v in tile pixels: the other two axes, v measured down from the top
        const [pu, pv] = ax === 1 ? [c[0], c[2]] : ax === 0 ? [F.n[0] > 0 ? 1 - c[2] : c[2], 1 - c[1]] : [F.n[2] > 0 ? c[0] : 1 - c[0], 1 - c[1]];
        uv.push((tu + 0.01 + pu * 15.98) / ATLAS_SIZE, (tv + 0.01 + pv * 15.98) / ATLAS_SIZE);
        col.push(F.shade, F.shade, F.shade);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}
// 16x16 RGBA pixel art -> 1/16-thick voxel slab, centred, 1 unit wide. Faces between
// two opaque pixels are skipped. Colours carry the face shade.
function extrudedGeometry(pix) {
  const pos = [], col = [];
  const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && pix[(y * 16 + x) * 4 + 3] > 127;
  const quad = (a, b, c, d, r, g, bl, s) => {
    for (const v of [a, b, c, a, c, d]) { pos.push(v[0], v[1], v[2]); col.push(r * s, g * s, bl * s); }
  };
  const T = 1 / 32;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    if (!solid(x, y)) continue;
    const i = (y * 16 + x) * 4, r = pix[i] / 255, g = pix[i + 1] / 255, b = pix[i + 2] / 255;
    const x0 = x / 16 - 0.5, x1 = (x + 1) / 16 - 0.5, y0 = 0.5 - (y + 1) / 16, y1 = 0.5 - y / 16;
    quad([x0, y0, T], [x1, y0, T], [x1, y1, T], [x0, y1, T], r, g, b, 1);
    quad([x1, y0, -T], [x0, y0, -T], [x0, y1, -T], [x1, y1, -T], r, g, b, 0.75);
    if (!solid(x + 1, y)) quad([x1, y0, T], [x1, y0, -T], [x1, y1, -T], [x1, y1, T], r, g, b, 0.62);
    if (!solid(x - 1, y)) quad([x0, y0, -T], [x0, y0, T], [x0, y1, T], [x0, y1, -T], r, g, b, 0.62);
    if (!solid(x, y - 1)) quad([x0, y1, T], [x1, y1, T], [x1, y1, -T], [x0, y1, -T], r, g, b, 0.9);
    if (!solid(x, y + 1)) quad([x0, y0, -T], [x1, y0, -T], [x1, y0, T], [x0, y0, T], r, g, b, 0.5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return geo;
}
function itemGeometry(id) {
  let e = ITEM_GEO[id];
  if (!e) {
    const textured = !ITEM_PIX[id] && SHAPE_OF[id] === SHAPE.CUBE || id === B.CACTUS && !ITEM_PIX[id];
    e = ITEM_GEO[id] = IS_STAIR[id] ? { geo: stairItemGeometry(id), textured: true } : textured ? { geo: cubeItemGeometry(id), textured: true } : { geo: extrudedGeometry(ITEM_PIX[id] || tintedPixels(BLOCKS[id].tex.side, id)), textured: false };
  }
  return e;
}
function makeItemMesh(id) {
  const e = itemGeometry(id);
  const mat = e.textured
    ? new THREE.MeshBasicMaterial({ map: itemAtlasTexture, vertexColors: true, alphaTest: 0.5 })
    : new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const m = new THREE.Mesh(e.geo, mat);
  m.userData.textured = e.textured;
  return m;
}

const vmScene = new THREE.Scene();
const vmCamera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.01, 10);
const vmRoot = new THREE.Group(), vmSwing = new THREE.Group();
vmScene.add(vmRoot); vmRoot.add(vmSwing);
const armMaterial = new THREE.MeshBasicMaterial({ map: mobTexture([214, 160, 124], 0.12, (set, r, w, h) => {
  for (let x = 0; x < w; x++) for (let y = 0; y < 3; y++) set(x, y, [180, 128, 96]);
}) });
const armMesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.75), armMaterial);

const viewModel = {
  heldId: -2, mesh: null, swingT: 1, equip: 0, swayX: 0, swayY: 0, draw: 0,   // heldId -2 = nothing built yet, -1 = empty hand
  swing() { if (this.swingT > 0.5 || this.swingT >= 1) this.swingT = 0; },
  set(id) {
    if (id === this.heldId) return;
    this.heldId = id;
    this.equip = 1;
    if (this.mesh && this.mesh !== armMesh) { vmSwing.remove(this.mesh); this.mesh.material.dispose(); }
    else if (this.mesh) vmSwing.remove(this.mesh);
    if (id < 0) {
      this.mesh = armMesh;
      armMesh.position.set(0.5, -0.5, -0.62);
      armMesh.rotation.set(0.3, 0.3, 0.05);
    } else {
      this.mesh = makeItemMesh(id);
      const it = ITEMS[id];
      if (this.mesh.userData.textured) {
        this.mesh.scale.setScalar(0.3);
        this.mesh.position.set(0.5, -0.4, -0.8);
        this.mesh.rotation.set(0, Math.PI / 4, 0);
      } else if (it.kind === 'bow') {
        // the flat face toward the eye, the string vertical and toward the screen centre
        this.mesh.scale.setScalar(0.46);
        this.mesh.position.set(0.42, -0.22, -0.75);
        this.mesh.rotation.set(0, -0.35, Math.PI * 0.75 + 0.12);
      } else if (it.kind === 'tool') {
        this.mesh.scale.setScalar(0.72);
        this.mesh.position.set(0.5, -0.32, -0.62);
        this.mesh.rotation.set(-0.05, 1.45, 0.35);
      } else {
        this.mesh.scale.setScalar(0.5);
        this.mesh.position.set(0.52, -0.36, -0.66);
        this.mesh.rotation.set(0, 1.25, 0.15);
      }
    }
    vmSwing.add(this.mesh);
  },
  update(dt) {
    const stack = inv.held();
    this.set(stack ? stack.id : -1);
    this.swingT = Math.min(1, this.swingT + dt / 0.3);
    this.equip = Math.max(0, this.equip - dt * 5);
    // sway: the item lags behind camera rotation
    this.swayX += (player.mouseDX * 0.0009 - this.swayX) * Math.min(1, dt * 12);
    this.swayY += (player.mouseDY * 0.0009 - this.swayY) * Math.min(1, dt * 12);
    player.mouseDX = 0; player.mouseDY = 0;
    const ph = player.walkPhase * Math.PI, b = player.bob;
    vmRoot.position.set(Math.sin(ph) * 0.03 * b - this.swayX * 0.4, -Math.abs(Math.cos(ph)) * 0.035 * b - this.equip * 0.45 + this.swayY * 0.3, 0);
    vmRoot.rotation.set(this.swayY * 0.6, this.swayX * 0.8, 0);
    // bow draw: pull the bow to the centre and toward the eye; it trembles at full draw
    this.draw += (bow.power() - this.draw) * Math.min(1, dt * 14);
    if (this.draw > 0.002) {
      const d = this.draw, tr = bow.power() >= 1 ? Math.sin(performance.now() * 0.06) * 0.004 : 0;
      vmRoot.position.x -= 0.14 * d; vmRoot.position.y += 0.05 * d + tr; vmRoot.position.z += 0.06 * d;
      vmRoot.rotation.z += 0.12 * d;
    }
    // swing arc (Minecraft ItemRenderer shape)
    const f = this.swingT < 1 ? this.swingT : 0, sf = Math.sin(Math.sqrt(f) * Math.PI);
    vmSwing.position.set(-0.28 * sf, 0.14 * Math.sin(Math.sqrt(f) * Math.PI * 2), -0.22 * Math.sin(f * Math.PI));
    vmSwing.rotation.set(-sf * 0.9, Math.sin(f * f * Math.PI) * 0.45, sf * 0.3);
    // light at the eye
    const l = player.dead ? 0 : world.brightnessAt(Math.floor(camera.position.x), Math.floor(camera.position.y), Math.floor(camera.position.z), game.daylight);
    this.mesh.material.color.setScalar(Math.max(0.1, l));
    vmRoot.visible = !player.dead;
  },
};

export { makeItemMesh, viewModel, vmCamera, vmScene };
