import './order.js';
import { THREE } from './three.js';
import { CONFIG, SAVE_KEY } from './config.js';
import {
  altarOffers, ARMOR_TIERS, armorId, B, blockDrop, BLOCKS, breakTime, ENCH, enchantSeed, FUEL, I, IS_RAIL,
  ITEMS, LIQ_KIND, LIQ_LEVEL, RAIL_ENDS, SMELT, TIERS, toolId, validEnch,
} from './blocks.js';
import { BIOME } from './biomes.js';
import { tileCount } from './atlas.js';
import { WG } from './gen-service.js';
import { camera, game, input, player, renderer, viewPixelRatio, world } from './engine.js';
import { damagePlayer, respawn, updateCamera, updatePlayer } from './player.js';
import { inCobweb } from './collision.js';
import {
  attackMob, bow, breakBlock, canHarvest, doorTimers, mining, placeBlock, primaryClick, railJoin, railLink,
  railPlan, raycast, target, targetVehicle, toggleDoor, updateDoors, useItem,
} from './interact.js';
import { liquids } from './liquids.js';
import { leafDecay } from './leaf-decay.js';
import { farming } from './farming.js';
import { grass } from './grass.js';
import { updateInteraction } from './targeting.js';
import { drops, spawnDrop, updateDrops } from './drops.js';
import { viewModel, vmCamera, vmScene } from './held-item.js';
import { inv, selectSlot } from './inventory.js';
import { matchRecipe, RECIPES } from './crafting.js';
import {
  featureAt, LOOT, lootChest, looted, tileEntities, tileEntity, ui, updateFurnaces,
} from './tile-entities.js';
import { closeInventory, enchantAltar, openInventory } from './inventory-ui.js';
import { lineOfSight, Mob, mobs, updateMobs } from './mobs.js';
import { vehicles } from './vehicles.js';
import { projectiles } from './projectiles.js';
import { explode, primedTnt, primeTnt, updateTnt } from './explosions.js';
import { emberType, spawners, spawnHostiles } from './spawning.js';
import { particles } from './particles.js';
import { audio } from './audio.js';
import { hud } from './hud.js';
import { setState, showPause } from './menus.js';
import { persist, validSave } from './persist.js';
import { closeHomes, goHome, homes, openHomes, setHome } from './homes.js';
import { defaultTarget, realm, REALMS, standNear } from './realms.js';
import { portals } from './portals.js';
import { sky } from './sky.js';
import { weather } from './weather.js';
import { fireflies } from './fireflies.js';
import { ash } from './ash.js';
import { clouds } from './clouds.js';
import { camDir, last, loadBar, loadText, onLoaded, setLast } from './boot.js';
import { shadows } from './shadows.js';
import { heldLight } from './held-light.js';
import { post } from './post.js';

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  setLast(now);

  camera.getWorldDirection(camDir);
  world.update(player.pos.x, player.pos.z, camDir, game.state === 'loading' || game.state === 'travel' ? 40 : 7);

  if (game.state === 'loading') {
    const r = world.readyAround(player.pos.x, player.pos.z, 3);
    loadBar.style.width = `${Math.round(r * 100)}%`;
    loadText.textContent = `Generating terrain… ${world.chunks.size} chunks`;
    if (r >= 1) onLoaded();
  }
  if (game.state === 'travel') realm.updateTravel();

  const sim = game.simulating();
  if (sim) {
    game.clock += dt;
    vehicles.update(dt);   // before updatePlayer, which seats the rider
    updatePlayer(dt);
    updateInteraction(dt);
    updateMobs(dt);
    projectiles.update(dt);
    updateDrops(dt);
    liquids.update(dt);
    leafDecay.update();
    farming.update();
    grass.update(dt);
    updateFurnaces(dt);
    updateTnt(dt);
    updateDoors();
    particles.update(dt);
    if ((persist.timer += dt) >= CONFIG.autosaveEvery) persist.save();
  }
  updateCamera(dt);
  weather.update(sim ? dt : 0);
  fireflies.update(sim ? dt : 0);
  ash.update(sim ? dt : 0);
  portals.update(sim ? dt : 0);
  sky.update(sim ? dt : 0);
  viewModel.update(dt);
  hud.update(dt);

  renderer.info.reset();
  heldLight.update();
  shadows.render();
  post.render();
  if (game.started && !player.dead) {
    renderer.clearDepth();
    renderer.render(vmScene, vmCamera);
  }
}

addEventListener('resize', () => {   // also fired by the render scale slider
  renderer.setPixelRatio(viewPixelRatio());
  renderer.setSize(innerWidth, innerHeight, false);
  post.resize();
  camera.aspect = vmCamera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix(); vmCamera.updateProjectionMatrix();
});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  if (game.state === 'playing') showPause(); else persist.save();
});

// Handle for automated tests and the browser console.
window.clonecraft = {
  THREE, world, player, game, inv, mobs, drops, particles, audio, sky, post, camera, renderer, CONFIG,
  B, I, BIOME, WG, Mob, spawnDrop, explode, setState, openInventory, closeInventory, respawn, damagePlayer,
  breakBlock, placeBlock, raycast, primaryClick, input, hud, mining, viewModel, useItem, selectSlot,
  BLOCKS, ITEMS, TIERS, LIQ_KIND, LIQ_LEVEL, toolId, liquids, tileEntities, tileEntity, updateFurnaces, ui,
  toggleDoor, doorTimers, persist, SAVE_KEY, leafDecay, farming, grass, matchRecipe, get tileCount() { return tileCount; }, openHomes, closeHomes, setHome, goHome, get homes() { return homes; },
  breakTime, canHarvest, SMELT, FUEL, primeTnt, primedTnt, get target() { return target; },
  projectiles, bow, armorId, ARMOR_TIERS, blockDrop, validSave, spawnHostiles, RECIPES, lineOfSight,
  ENCH, altarOffers, enchantAltar, validEnch, attackMob, get enchantSeed() { return enchantSeed; },
  vehicles, railPlan, railJoin, railLink, IS_RAIL, RAIL_ENDS, get targetVehicle() { return targetVehicle; },
  spawners, looted, lootChest, featureAt, LOOT, inCobweb, weather, fireflies, ash, portals, heldLight, shadows, clouds,
  realm, REALMS, defaultTarget, standNear, emberType,
};

requestAnimationFrame(frame);
