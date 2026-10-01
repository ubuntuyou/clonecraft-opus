/* =====================================================================================
 * === 3. PROCEDURAL TEXTURE ATLAS GENERATION
 * -------------------------------------------------------------------------------------
 * Every block face is a 16x16 tile painted pixel by pixel into one 256x256 atlas.
 * Alpha encodes two things:
 *   alpha 0   -> cut out (leaf holes, plant background)
 *   alpha 191 -> "tintable" pixel: the shader multiplies it by the biome colour
 *   alpha 255 -> plain pixel
 * ===================================================================================== */
const BIOME = { OCEAN: 0, BEACH: 1, PLAINS: 2, FOREST: 3, RAINFOREST: 4, DESERT: 5, HIGHLANDS: 6,
  SNOWY_MOUNTAINS: 7, SNOWY_PLAINS: 8, RIVER: 9 };
const BIOME_NAMES = ['Ocean', 'Beach', 'Plains', 'Forest', 'Rainforest', 'Desert', 'Rocky Highlands',
  'Snowy Mountains', 'Snowy Plains', 'River'];
// Grass tint per biome (0..255). Foliage is derived from it.
const BIOME_GRASS = [
  [118, 176, 84], [134, 182, 82], [128, 186, 78], [104, 170, 66], [80, 196, 44], [190, 180, 92],
  [132, 168, 96], [124, 164, 140], [128, 170, 132], [120, 180, 80]];
const BIOME_FOLIAGE = BIOME_GRASS.map(([r, g, b], i) =>
  i === BIOME.SNOWY_MOUNTAINS || i === BIOME.SNOWY_PLAINS ? [96, 138, 116] :
  i === BIOME.RAINFOREST ? [60, 170, 30] : [Math.round(r * 0.82), Math.round(g * 0.9), Math.round(b * 0.75)]);
const TINT_ALPHA = 191;

export { BIOME, BIOME_FOLIAGE, BIOME_GRASS, BIOME_NAMES, TINT_ALPHA };
