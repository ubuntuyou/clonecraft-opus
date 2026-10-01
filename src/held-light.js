// G4: a torch in the selected hotbar slot lights the area around the player. Light of level 14
// flood-fills from the head cell like block light: 1 less per block, plus the block's ATTEN,
// and never through OPAQUE blocks. The levels live in a 32³ R8 3D texture centred on the head
// (linear filtering smooths it). It refills when the head cell, the held item, or any block changes.
// TERRAIN_FS samples it (uHeld); world.brightnessAt reads levelAt() for mobs, drops, and particles.
import { THREE } from './three.js';
import { ATTEN, B, OPAQUE } from './blocks.js';
import { terrainUniforms } from './terrain-material.js';
import { camera, game, player, world } from './engine.js';
import { inv } from './inventory.js';

const heldLight = (() => {
  const N = 32, R = 16, LEVEL = 14;
  const data = new Uint8Array(N * N * N);
  const tex = new THREE.Data3DTexture(data, N, N, N);
  tex.format = THREE.RedFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  terrainUniforms.uHeld.value = tex;
  const queue = new Int32Array(N * N * N * 4);
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  let on = false, ox = 0, oy = 0, oz = 0, hx = NaN, hy = NaN, hz = NaN, serial = -1;
  function fill() {
    data.fill(0);
    ox = hx - R; oy = hy - R; oz = hz - R;
    if (!OPAQUE[world.getBlock(hx, hy, hz)]) {
      let head = 0, tail = 0;
      const s0 = R + N * (R + N * R);
      data[s0] = LEVEL * 17; queue[tail++] = s0;
      while (head < tail) {
        const i = queue[head++], x = i % N, y = ((i / N) | 0) % N, z = (i / (N * N)) | 0, l = data[i] / 17;
        if (l <= 1) continue;
        for (const d of DIRS) {
          const nx = x + d[0], ny = y + d[1], nz = z + d[2];
          if (nx < 1 || ny < 1 || nz < 1 || nx > N - 2 || ny > N - 2 || nz > N - 2) continue;   // keep a dark border
          const id = world.getBlock(ox + nx, oy + ny, oz + nz);
          if (OPAQUE[id]) continue;
          const nl = l - 1 - ATTEN[id], j = nx + N * (ny + N * nz);
          if (nl <= 0 || data[j] >= nl * 17 || tail >= queue.length) continue;
          data[j] = nl * 17; queue[tail++] = j;
        }
      }
    }
    tex.needsUpdate = true;
    terrainUniforms.uHeldOrigin.value.set(ox, oy, oz);
  }
  return {
    update() {
      const s = inv.held();
      on = !!(s && s.id === B.TORCH) && game.started && !player.dead;
      terrainUniforms.uHeldOn.value = on ? 1 : 0;
      if (!on) { hx = NaN; return; }
      const x = Math.floor(camera.position.x), y = Math.floor(camera.position.y), z = Math.floor(camera.position.z);
      if (x !== hx || y !== hy || z !== hz || serial !== world.editSerial) {
        hx = x; hy = y; hz = z; serial = world.editSerial;
        fill();
      }
    },
    // light level 0..15 at a block cell (0 when no torch is held)
    levelAt(x, y, z) {
      if (!on) return 0;
      const lx = x - ox, ly = y - oy, lz = z - oz;
      if (lx < 0 || ly < 0 || lz < 0 || lx >= N || ly >= N || lz >= N) return 0;
      return data[lx + N * (ly + N * lz)] / 17;
    },
    get on() { return on; },
  };
})();

export { heldLight };
