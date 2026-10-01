# SPEC: water, sunlight, shadows, and the held torch (G1–G4)

Status: requested by Joe on 2026-09-29. Joe asked for "water [that looks] more realistic with dynamic movement, caustics, and sun glitter without the generated surface texture", then "directional light and dynamic shadows, and make a held torch cast light around the player".
Gate: `GATE.md`, section "Graphics G1–G4".

## Part 1: General

### Scope

- G1: a water surface with no atlas texture. Moving waves, sky reflection, and sun glitter.
- G2: caustics on the blocks under sunlit water.
- G3: directional sun and moon light with dynamic shadows.
- G4: a torch held in the selected hotbar slot lights the blocks, water, mobs, and items around the player.

### Constraints

- All code stays in `index.html`. No external assets. Three.js r160 only.
- Light does not pass through opaque blocks. This holds for shadows (G3) and the held torch (G4).
- Effects 0 turns off shadows. The world then looks as it does today, plus G1, G2, and G4. (Superseded 2026-09-29: the "Shadows" box turns shadows off.)
- Frame rate at 1200×824 with default settings stays at or above 50 fps on Joe's Mac.
- Chromium shows 0 console errors.
- Saves do not change.

### Non-goals

- Screen-space or planar reflections of terrain in the water.
- Water depth color from the depth buffer. The scene depth is the render target of the same pass.
- Colored or dynamic light from other held items (lava bucket, crystal).
- The player's own shadow in first person. No player body is drawn.
- Shadows cast by clouds.
- Mobs and items do not receive shadows. They cast them.

## Part 2: Product

### G1 Water surface

- The surface color comes from a fixed water palette, not from the water tile. The tile stays for icons and particles.
- Waves move: vertex waves (as now) plus animated normals from several wave octaves in different directions.
- The surface reflects the sky color more at grazing angles (Fresnel).
- The sun makes a bright path of sparkles on the waves (glitter). The sparkles bloom. The moon makes a weak path at night.
- Rain and storms reduce the glitter with the sun.
- Normal detail fades with distance, so far water does not shimmer.

### G2 Caustics

- Faces of blocks that touch water show moving bright caustic lines.
- Caustics need sunlight: they do not show at night, and they weaken in rain. They fade out between about 3 and 7 blocks deep and do not show in covered water.
- Caustics brighten the floor's own light. They add no light to a dark floor.
- Caustics do not show on dry blocks, even below sea level.

### G3 Sun and moon light, shadows

- Terrain in open sky gets ambient light plus direct light from the sun (or the moon at night). The moon gives half the sun's direct light, and the night sky light floor is 4.5/15 (2026-09-29, Joe: "a hint more illumination from the moon"; was 0.4 and 4/15).
- Faces toward the sun are brighter. Faces away from it and shadowed areas get ambient light only.
- Terrain, trees, and leaves cast shadows. Mobs, drops, vehicles, and arrows cast shadows. Leaves cast dappled shadows through their holes.
- Water, the sky, clouds, rain, snow, and particles cast no shadows.
- Shadows move with the sun over the day.
- Shadows cover about 64 blocks around the player and fade out at that edge.
- Rain and storms soften the direct light and the shadows.
- The Effects setting: 0 "Off" (no bloom, no shadows), 1 "Bloom + shadows", 2 "Bloom + shafts + shadows". (Superseded 2026-09-29: two check boxes, "Shadows" and "Bloom + shafts". See ARCHITECTURE D35.)

### G4 Held torch

- When the selected hotbar slot holds a torch, light of level 14 spreads from the player's head.
- The light spreads like block light: it drops by 1 per block and does not pass through opaque blocks.
- It lights terrain, water, mobs, drops, the held item, and particles.
- It uses the warm torch color and flicker of placed torches.
- The light follows the player and turns off at once when the player switches away from the torch.
- Placing or breaking a block near the player updates the light.

## Part 3: Technical

- G1: the `WATER` branch of `TERRAIN_FS` drops `texture2D(map)`. A wave-normal function sums analytic sine derivatives. Fresnel uses Schlick. Glitter is a sharp specular term on the high-frequency normal, in HDR, so `post` blooms it.
- G2: `emitCubeFace` sets `wetFace` when the face neighbor is water (`LIQ_KIND`). `pushQuad` writes sway alpha 246 for a still, wet face. The fragment shader draws caustics where `aTint.a` is about 0.965, from a caustic texture baked at startup (P1, 2026-09-29). The pattern is anchored at the water surface and shifted toward the sun by the depth below it (depth = 15 × (1 − sky light)). Two reads drift in opposite directions and are combined by `min`. Each read is warped by its own field of 4 moving sines (arithmetic, no texture read), so the net re-forms in place. It multiplies the face's sky light (`sky *= 1 + caus`). It is scaled by a depth fade on sky light (`smoothstep(0.5, 0.95, vLight.x)`, about 3 to 7 blocks deep), a daylight gate (0 when `uDaylight` < 0.35), `uSunAmt`, the shadow test, and the weather (fix for Joe, 2026-09-29).
- G3: a `shadows` module owns a 2048² `WebGLRenderTarget` with a `DepthTexture` and an `OrthographicCamera` on the sun (or moon) direction. The box is 128 blocks wide, centered on the camera, and snapped to whole texels. Each frame at Effects ≥ 1 it hides non-casters (water, transparent materials, `Points`, `Line`, `alphaTest` sprites, the sky group), sets `scene.overrideMaterial` to a depth material that discards transparent atlas texels, and renders. `TERRAIN_FS` samples it with a normal-offset bias through a `sampler2DShadow`: 4 hardware-filtered reads on terrain, 1 on water (P2, 2026-09-29; was 3×3 PCF). `uShadowOn` 0 keeps the old light model.
- G4: a `heldLight` module flood-fills level 14 from the head cell through non-`OPAQUE` cells with `ATTEN` into a 32³ `Data3DTexture` (R8, linear filter) centered on the head cell. It refills when the head cell changes, the selected item changes, or a block changes within 16 blocks. `TERRAIN_FS` samples it at `vWorld + n * 0.5`. `world.brightnessAt` takes the max with `heldLight.levelAt(x, y, z)`.
