// SPEC_deepen M6 and M8: World loads in Node with a recorder mesh adapter in place of three.js.
// T6.2 writes the M6-1..M6-14 cases. The helpers below are the S6 contract fakes.
import './host-stub.js';
import { CONFIG } from '../src/config.js';
import { World } from '../src/world.js';

// The recorder mesh adapter: it logs each call as [op, chunk key, visible?] and keeps the
// handle rules of chunkMeshes (build sets opaqueMesh, dispose nulls both handles).
export function recorder() {
  const log = [];
  const meshes = {
    log,
    build(world, chunk) { log.push(['build', chunk.key]); chunk.opaqueMesh = chunk.opaqueMesh || { key: chunk.key, visible: true }; },
    dispose(chunk) { log.push(['dispose', chunk.key]); chunk.opaqueMesh = chunk.waterMesh = null; },
    show(chunk, visible) { log.push(['show', chunk.key, visible]); if (chunk.opaqueMesh) chunk.opaqueMesh.visible = visible; },
    count(op) { return log.filter((e) => e[0] === op).length; },
    clear() { log.length = 0; },
  };
  return meshes;
}

// A World with render distance `rd` and a recorder adapter. Returns { world, meshes }.
export function makeWorld(rd = 3) {
  CONFIG.renderDistance = rd;
  const meshes = recorder();
  return { world: new World(meshes), meshes };
}

// Streams the chunks around block (x, z) until readyAround(x, z, r) is 1 or `frames` run out.
// GenService has no Worker in Node, so it generates on the main thread. Returns the frame count.
export function streamUntilReady(world, x, z, r, frames = 400) {
  const camDir = { x: 0, z: -1 };
  for (let i = 0; i < frames; i++) {
    world.update(x, z, camDir, 1e9);
    if (world.readyAround(x, z, r) === 1) return i + 1;
  }
  throw new Error(`the chunks around (${x}, ${z}) did not mesh in ${frames} frames`);
}
