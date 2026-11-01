/* =====================================================================================
 * PRECIP — living header (src/precip.js, SPEC_deepen M9)
 * -------------------------------------------------------------------------------------
 * The precipitation rule, pure. Terms: a biome's **zone** (0 dry, 1 height rule, 2 always snow);
 * a column's **kind** (0 none, 1 rain, 2 snow) from its zone, its top block `top`, and the snow
 * line `melt`; a **floor** is the y where a drop lands, or -1. weather.js wraps these per column.
 * Imports only biomes.js; never reaches order.js. Rules: DISCOVERY_engine.md (weather).
 * ===================================================================================== */
import { BIOME } from './biomes.js';

// The zone of a biome: 0 dry (desert), 2 snow (snowy plains, snowy mountains), 1 for the rest.
function zoneOf(biome) {
  return biome === BIOME.DESERT ? 0 : biome === BIOME.SNOWY_PLAINS || biome === BIOME.SNOWY_MOUNTAINS ? 2 : 1;
}

// What lands on top block `top` in zone `zone`: 0 none, 1 rain, 2 snow. Zone 1 snows when
// top + 1 >= melt. top < 0 (an unloaded column) gives 0. weather.js passes zone -1 for an
// unloaded column; that gives 0 too.
function precipKind(zone, top, melt) {
  if (top < 0) return 0;
  return zone === 1 ? (top + 1 >= melt ? 2 : 1) : Math.max(0, zone);
}

// The floor of a snow flake: top + 1, or max(top + 1, melt) in zone 1; -1 when no snow falls.
function snowFloor(zone, top, melt) {
  const zn = top < 0 ? -1 : zone;
  return zn === 2 ? top + 1 : zn === 1 ? Math.max(top + 1, melt) : -1;
}

// The floor of a rain drop: top + 1 where the kind is rain, else -1. weather.js caps its y at melt.
function rainFloor(zone, top, melt) {
  return precipKind(zone, top, melt) === 1 ? top + 1 : -1;
}

export { precipKind, rainFloor, snowFloor, zoneOf };
