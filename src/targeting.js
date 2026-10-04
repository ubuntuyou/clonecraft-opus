import { THREE } from './three.js';
import { REACH } from './config.js';
import { B, BLOCKS, breakTime, IS_STAIR, pickaxeFor, STAIR_BOXES, stairKey } from './blocks.js';
import { ATLAS_SIZE, atlasTexture, TILE } from './atlas.js';
import { camera, game, input, player, scene, world } from './engine.js';
import {
  _dir, mineComplete, mining, raycast, raycastMobs, resetMining, SEL_BOX, setTarget, setTargetMob,
  setTargetVehicle, target, targetMob, targetVehicle, updateBow, useItem,
} from './interact.js';
import { liquids } from './liquids.js';
import { leafDecay } from './leaf-decay.js';
import { farming } from './farming.js';
import { grass } from './grass.js';
import { viewModel, inv, vehicles, particles, audio, hud, portals } from './order.js';

world.onEdit = (x, y, z, old, id) => {
  liquids.wake(x, y, z); leafDecay.onEdit(x, y, z, old, id); farming.onEdit(x, y, z, old, id); grass.onEdit(x, y, z, old, id);
  portals.onEdit(x, y, z, old, id);
};

// ---- selection outline and crack overlay -------------------------------------------
const selectionBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1)),
  new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, fog: false }));
selectionBox.visible = false;
scene.add(selectionBox);
// Stair outline: the stair fills 8 cells of a 2x2x2 grid. An edge of that grid is drawn where the
// 4 cells around it make a crease (1 or 3 filled, or 2 filled on a diagonal). One geometry per shape.
const stairOutline = new THREE.LineSegments(new THREE.BufferGeometry(), selectionBox.material);
stairOutline.visible = false;
scene.add(stairOutline);
const STAIR_OUTLINE = [];
function stairOutlineGeo(key) {
  if (STAIR_OUTLINE[key]) return STAIR_OUTLINE[key];
  const fill = new Uint8Array(8);   // cell (i, j, k) of the 2x2x2 grid -> i + 2 j + 4 k
  for (const b of STAIR_BOXES[key])
    for (let k = b[2] / 8; k < b[5] / 8; k++) for (let j = b[1] / 8; j < b[4] / 8; j++) for (let i = b[0] / 8; i < b[3] / 8; i++) fill[i + 2 * j + 4 * k] = 1;
  const at = (c) => c[0] >= 0 && c[0] < 2 && c[1] >= 0 && c[1] < 2 && c[2] >= 0 && c[2] < 2 ? fill[c[0] + 2 * c[1] + 4 * c[2]] : 0;
  const pos = [];
  for (let a = 0; a < 3; a++) {
    const a1 = (a + 1) % 3, a2 = (a + 2) % 3;
    for (let s = 0; s < 2; s++) for (let u = 0; u <= 2; u++) for (let w = 0; w <= 2; w++) {
      const cell = (du, dw) => { const c = [0, 0, 0]; c[a] = s; c[a1] = u - 1 + du; c[a2] = w - 1 + dw; return at(c); };
      const f00 = cell(0, 0), f10 = cell(1, 0), f01 = cell(0, 1), f11 = cell(1, 1), n = f00 + f10 + f01 + f11;
      if (!(n === 1 || n === 3 || (n === 2 && f00 === f11))) continue;
      const p0 = [0, 0, 0]; p0[a] = s * 0.5; p0[a1] = u * 0.5; p0[a2] = w * 0.5;
      const p1 = p0.slice(); p1[a] += 0.5;
      pos.push(...p0, ...p1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.map((v) => (v - 0.5) * 1.004 + 0.5), 3));
  return (STAIR_OUTLINE[key] = g);
}

const crackGeo = new THREE.BoxGeometry(1.004, 1.004, 1.004);
const crackBaseUv = crackGeo.attributes.uv.array.slice();
const crackMesh = new THREE.Mesh(crackGeo, new THREE.MeshBasicMaterial({
  map: atlasTexture, transparent: true, depthWrite: false, fog: false,
  polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }));
crackMesh.visible = false;
crackMesh.renderOrder = 2;
scene.add(crackMesh);
let crackStage = -1;
function setCrackStage(s) {
  if (s === crackStage) return;
  crackStage = s;
  const tile = TILE['crack_' + s], tx = (tile & 15) * 16, ty = (tile >> 4) * 16;
  const uv = crackGeo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (tx + 0.02 + crackBaseUv[i * 2] * 15.96) / ATLAS_SIZE, (ty + 0.02 + (1 - crackBaseUv[i * 2 + 1]) * 15.96) / ATLAS_SIZE);
  }
  uv.needsUpdate = true;
}

function updateInteraction(dt) {
  mining.cooldown -= dt;
  camera.getWorldDirection(_dir);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  setTarget(player.dead ? null : raycast(ox, oy, oz, _dir.x, _dir.y, _dir.z, REACH));
  const vh = player.dead ? null : vehicles.ray(ox, oy, oz, _dir.x, _dir.y, _dir.z, target ? target.t : REACH);
  setTargetMob(player.dead ? null : raycastMobs(ox, oy, oz, _dir.x, _dir.y, _dir.z, Math.min(3.5, vh ? vh.t : target ? target.t : REACH)));
  setTargetVehicle(targetMob || !vh ? null : vh.v);
  if (targetMob || targetVehicle) setTarget(null);

  stairOutline.visible = !!target && !!IS_STAIR[target.id];
  if (stairOutline.visible) {
    const { x, y, z } = target;
    stairOutline.geometry = stairOutlineGeo(stairKey(target.id, (dx, dz) => world.getBlock(x + dx, y, z + dz)));
    stairOutline.position.set(x, y, z);
    selectionBox.visible = false;
  } else if (target) {
    const b = SEL_BOX[target.id];
    selectionBox.visible = true;
    selectionBox.position.set(target.x + (b[0] + b[3]) / 2, target.y + (b[1] + b[4]) / 2, target.z + (b[2] + b[5]) / 2);
    selectionBox.scale.set(b[3] - b[0] + 0.004, b[4] - b[1] + 0.004, b[5] - b[2] + 0.004);
  } else if (targetVehicle) {   // the vehicle's collision box
    const v = targetVehicle;
    selectionBox.visible = true;
    selectionBox.position.set(v.pos.x, v.pos.y + v.h / 2, v.pos.z);
    selectionBox.scale.set(v.w + 0.004, v.h + 0.004, v.w + 0.004);
  } else selectionBox.visible = false;

  const canAct = game.state === 'playing' && !player.dead;
  if (canAct && input.mouseL && target && !targetMob && mining.cooldown <= 0) {
    if (!mining.active || mining.x !== target.x || mining.y !== target.y || mining.z !== target.z || mining.id !== target.id) {
      mining.active = true; mining.x = target.x; mining.y = target.y; mining.z = target.z; mining.id = target.id;
      mining.progress = 0; mining.tickT = 0;
      const lvl = BLOCKS[target.id].minLevel;
      if (lvl && breakTime(target.id, inv.held()) === Infinity) hud.toast(`Needs a ${pickaxeFor(lvl)} or better`);
    }
    const bt = breakTime(target.id, inv.held());
    if (bt === Infinity) mining.progress = 0;
    else mining.progress += bt > 0 ? dt / bt : 1;
    mining.tickT -= dt;
    if (mining.tickT <= 0) {
      mining.tickT = 0.22;
      viewModel.swing();
      if (bt > 0) {
        audio.dig(BLOCKS[target.id].sound, 0.35, target.x + 0.5, target.y + 0.5, target.z + 0.5);
        particles.blockHit(target);
      }
    }
    if (mining.progress >= 1) mineComplete(target);
  } else if (!input.mouseL || !target) resetMining();

  if (mining.active && mining.progress > 0) {
    crackMesh.visible = true;
    crackMesh.position.set(mining.x + 0.5, mining.y + 0.5, mining.z + 0.5);
    const b = SEL_BOX[mining.id] || SEL_BOX[B.STONE];
    crackMesh.scale.set(b[3] - b[0], b[4] - b[1], b[5] - b[2]);
    crackMesh.position.set(mining.x + (b[0] + b[3]) / 2, mining.y + (b[1] + b[4]) / 2, mining.z + (b[2] + b[5]) / 2);
    setCrackStage(Math.min(9, Math.floor(mining.progress * 10)));
  } else crackMesh.visible = false;

  if (canAct && input.mouseR && input.rightRepeat !== Infinity) {
    input.rightRepeat -= dt;
    if (input.rightRepeat <= 0) { useItem(); input.rightRepeat = 0.25; }
  }
  updateBow(dt);
}

export { updateInteraction };
