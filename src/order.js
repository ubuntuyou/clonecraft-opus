/* =====================================================================================
 * CLONECRAFT — living header (src/order.js)
 * -------------------------------------------------------------------------------------
 * An infinite, Minecraft-style voxel sandbox. Three.js comes from a CDN. Everything else
 * (noise, textures, sounds, models) is generated at runtime. The source is the 43 modules
 * in src/. `npm run build` writes them into the one root index.html, in this load order.
 *
 * Module layout:
 *  - This file lists every module once, in load order. main.js imports this file first,
 *    so the browser evaluates the modules in the order below.
 *  - A module imports an earlier module's names directly from that module.
 *  - A module imports a later module's names (upward names) from './order.js' and uses them
 *    only inside a function. The `export { } from` lines below re-export the upward names.
 *  - An imported binding is read-only. A write to another module's `let` goes through the
 *    owner's setter (setTarget, setHomes, ...).
 *  - worldgen.js has no imports. The worker runs WorldGenModule.toString() alone.
 *  - three, config, blocks, biomes, atlas, worldgen, gen-service, terrain-material, and
 *    crafting never reach this file. Node tests import them.
 *  - tools/depcheck.js enforces these rules. `npm run check` runs it.
 *
 * Section map (search for "=== N."; the modules of each section follow it):
 *   1. Constants and configuration: config
 *   2. Block and item definitions: blocks (ENCH: enchantments; restack() copies a stack with
 *      dur and ench)
 *   3. Procedural texture atlas: biomes, atlas (blocks, cracks, item icons, mob skins)
 *   4. Noise functions + 5. World generation: worldgen. WorldGenModule() is a pure function
 *      that gen-service serializes into Web Workers. Chunk data = f(seed, cx, cz).
 *      Structures (dungeon, temple, tower, mineshaft) stamp only cells of their own chunk and
 *      report chests and spawners as chunk `features`.
 *   6. Chunk class and chunk management + 7. Voxel lighting: world (streaming, block
 *      overrides, unloading; sky, block, and crystal light, BFS flood fill, incremental
 *      updates; a LIGHT_STOP cell such as a stair takes light but never passes it on)
 *   8. Mesh generation: mesher (hidden-face culling, smooth light + AO, sloped liquids, doors,
 *      crystals, stairs, wet faces for caustics: WET_ALPHA; rails: railMesh() rotates one
 *      flat, slope, or curve quad); terrain-material (TERRAIN_FS: water waves and glitter,
 *      shadows, held light)
 *   9. Renderer and player: engine, player (water and lava physics, lava damage;
 *      damagePlayer applies armor by damage kind; the temple trap and its warning: trapNear,
 *      audio.trapWarn)
 *  10. Collision detection: collision (per-axis clip against solidBoxes(): full cells and
 *      stair boxes; step-up by stepH for the player and mobs; shared by player/mobs/items).
 *      The player alone passes through leaves (_passLeaf) and climbs in leaf and ladder
 *      cells (CLIMB).
 *  11. Raycasting and block editing: interact (DDA, mining, doors; rails: railPlan() picks
 *      the shape and railJoin() re-shapes a neighbour), liquids, leaf-decay, farming
 *      (saplings, farmland, crops, bone meal, buckets), targeting (world.onEdit wiring,
 *      selection box, crack overlay), drops
 *  12. Held item view model: held-item (the bow pulls back while it draws)
 *  13. Inventory and crafting: inventory, crafting, craft-grid, tile-entities (furnaces,
 *      chests; lootChest() fills a generated chest once, and the save keeps `looted`),
 *      inventory-ui (armor slots; the altar screen: altarOffers() seeded by enchantSeed,
 *      enchantAltar(); the .ench icon shimmer)
 *  14. Mob entities and AI: mobs (skeleton, spider, Magma Brute, creeper), vehicles (boats:
 *      moveEntity, float in water; minecarts: a rail cell plus t along it, railLink() hops
 *      cells; player.vehicle seats the rider), projectiles (arrows), explosions (TNT),
 *      spawning (`spawners` run the spawner features)
 *  15. Particles and audio: particles, audio
 *  16. HUD and UI: hud (the compass dial), menus, persist (save and load, export and
 *      import), homes
 *  17. Day/night cycle and sky: sky; weather (clear, rain, storm): rain or snow by biome and height
 *      pools, lightning, the rain loop; weather.dim scales game.daylight (clearDaylight keeps
 *      the clock)
 *  18. Start and frame loop: boot (spawn search, start), shadows (sun or moon shadow map,
 *      G3), held-light (a held torch flood-fills light into a 32^3 texture, G4), post (bloom,
 *      light shafts), main (frame loop, window.clonecraft)
 *
 * Key invariants:
 *  - Chunk index: idx = (y << 8) | (z << 4) | x, with local x,z in 0..15 and y in 0..H-1 (175).
 *  - Block variants (furnace, chest, wall torch, and stair facing, door states, liquid levels, placed leaves, rail shapes) are separate ids;
 *    baseOf(id) gives the block that the item places and the break drops.
 *  - Every setBlock calls world.onEdit. It wakes nearby liquids, queues leaf-decay checks, and
 *    registers saplings, crops, and farmland with `farming`.
 *  - A chunk is meshed only when it and all 8 neighbours are lit (smooth light reads 1 cell
 *    across every border).
 *  - Block edits go through world.setBlock(): it stores the override, relights, and remeshes.
 *  - A stair id holds its half and facing only. Its corner shape comes from its neighbours
 *    at read time (stairKey), so the mesher, collision, raycast, and outline must all use stairKey.
 *  - Terrain shader works in gamma space. THREE.ColorManagement is disabled on purpose.
 * ===================================================================================== */

import './three.js';
import './config.js';
import './blocks.js';
import './biomes.js';
import './atlas.js';
import './worldgen.js';
import './gen-service.js';
import './world.js';
export { buildChunkMesh } from './mesher.js';
export { terrainMaterial, waterMaterial } from './terrain-material.js';
import './engine.js';
import './player.js';
export { moveEntity } from './collision.js';
export { bow, primaryClick, useItem } from './interact.js';
import './liquids.js';
import './leaf-decay.js';
export { farming } from './farming.js';
import './targeting.js';
export { spawnDrop } from './drops.js';
export { makeItemMesh, viewModel } from './held-item.js';
export { dropEverything, dropHeld, dropStack, inv, selectSlot } from './inventory.js';
import './crafting.js';
import './craft-grid.js';
export { spillTileEntity } from './tile-entities.js';
export { closeInventory, inventoryKey, openInventory, renderInventory } from './inventory-ui.js';
export { mobs } from './mobs.js';
export { vehicles } from './vehicles.js';
export { ARROW_GRAVITY, projectiles } from './projectiles.js';
export { explode, primeTnt } from './explosions.js';
export { spawners, spawnHostiles } from './spawning.js';
export { particles } from './particles.js';
export { audio } from './audio.js';
export { hud } from './hud.js';
export { clockText, fadeIn, setState, showPause } from './menus.js';
export { persist } from './persist.js';
export { homes, homesEl, homesKey, openHomes, setHomes } from './homes.js';
import './sky.js';
export { weather } from './weather.js';
import './boot.js';
import './shadows.js';
export { heldLight } from './held-light.js';
import './post.js';
