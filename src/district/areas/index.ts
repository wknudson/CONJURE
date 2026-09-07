/**
 * Every walkable place, by id.
 *
 * The id is what `playerPos.mapId` stores, so it is load-bearing across saves: renaming one
 * strands anyone standing in it. `areaById` returning `undefined` for an unknown id is the
 * intended shape — callers fall back to Ashfall, which is how a save written before an area
 * existed (or after one was cut) still boots somewhere real.
 */

import type { AreaDef } from '../map.js';
import { ASHFALL } from './ashfall.js';
import { CHALK_VERGE } from './chalkVerge.js';
import { CHALK_ROAD } from './chalkRoad.js';
import { LAMPROW } from './lamprow.js';
import { BONEMARKET } from './bonemarket.js';
import { CINDERWORKS } from './cinderworks.js';
import { WARD_SEVEN } from './wardSeven.js';
import { HIGHCOURT } from './highcourt.js';
import { MILLHARROW } from './millharrow.js';
import { TALLOW_LEVELS } from './tallowLevels.js';
import { SALTGLASS } from './saltglass.js';
import { BRAYS_HOLLOW } from './braysHollow.js';
import { FENWICKS_CROSSING } from './fenwicksCrossing.js';
import { WEEPING_STILE } from './weepingStile.js';
import { CALDERA } from './caldera.js';
import { ASHWOOD } from './ashwood.js';
import { RIMEFIELDS } from './rimefields.js';
import { STORM_SHELF } from './stormShelf.js';
import { BONE_BASTION } from './boneBastion.js';
import { ASHFALL_IRONWORKS } from './interiors/ashfallIronworks.js';
import { ASHFALL_APOTHECARY } from './interiors/ashfallApothecary.js';
import { ASHFALL_VIVARIUM } from './interiors/ashfallVivarium.js';
import { ASHFALL_RECORDS } from './interiors/ashfallRecords.js';
import { ASHFALL_TOLL_HOUSE } from './interiors/ashfallTollHouse.js';
import { ASHFALL_COUNTING_HOUSE } from './interiors/ashfallCountingHouse.js';
import { ASHFALL_CHAPEL } from './interiors/ashfallChapel.js';
import { ASHFALL_CINDER_CUP } from './interiors/ashfallCinderCup.js';
import { LAMPROW_OIL_HOUSE } from './interiors/lamprowOilHouse.js';
import { LAMPROW_TITHE_OFFICE } from './interiors/lamprowTitheOffice.js';
import { LAMPROW_SINK_CELLARS } from './interiors/lamprowSinkCellars.js';
import { BONEMARKET_HALL } from './interiors/bonemarketHall.js';
import { BONEMARKET_PAWNSHOP } from './interiors/bonemarketPawnshop.js';
import { CINDERWORKS_FOUNDRY } from './interiors/cinderworksFoundry.js';
import { CINDERWORKS_POSTERS } from './interiors/cinderworksPosters.js';
import { WARD_SEVEN_CISTERN } from './interiors/wardSevenCistern.js';
import { WARD_SEVEN_CLINIC } from './interiors/wardSevenClinic.js';
import { HIGHCOURT_SPIRE_LOBBY } from './interiors/highcourtSpireLobby.js';
import { HIGHCOURT_SMOKE_EATERS } from './interiors/highcourtSmokeEaters.js';
import { HIGHCOURT_UNDERCROFT } from './interiors/highcourtUndercroft.js';
import { CHALK_VERGE_BOTHY } from './interiors/chalkVergeBothy.js';
import { CHALK_ROAD_WAYSTATION } from './interiors/chalkRoadWaystation.js';
import { MILLHARROW_MILL } from './interiors/millharrowMill.js';
import { MILLHARROW_GRANARY } from './interiors/millharrowGranary.js';
import { TALLOW_PUMP_HOUSE } from './interiors/tallowPumpHouse.js';
import { SALTGLASS_GLASSHOUSE } from './interiors/saltglassGlasshouse.js';
import { SALTGLASS_CUSTOMS_HOUSE } from './interiors/saltglassCustomsHouse.js';
import { BRAYS_BARN } from './interiors/braysBarn.js';

/**
 * Ordered as the city, then the ring, then the wilds — the order they are reached in, which is
 * also the order the atlas lists them. Nothing reads this order, so it is purely for whoever
 * opens the file next.
 */
export const AREAS: readonly AreaDef[] = [
  ASHFALL,
  LAMPROW,
  BONEMARKET,
  CINDERWORKS,
  WARD_SEVEN,
  HIGHCOURT,
  CHALK_VERGE,
  CHALK_ROAD,
  MILLHARROW,
  TALLOW_LEVELS,
  SALTGLASS,
  BRAYS_HOLLOW,
  FENWICKS_CROSSING,
  WEEPING_STILE,
  CALDERA,
  ASHWOOD,
  RIMEFIELDS,
  STORM_SHELF,
  BONE_BASTION,
  // The rooms, after the streets they open off. `interiors/` holds them; see `IndoorSpec`.
  ASHFALL_IRONWORKS,
  ASHFALL_RECORDS,
  ASHFALL_APOTHECARY,
  ASHFALL_VIVARIUM,
  ASHFALL_TOLL_HOUSE,
  ASHFALL_COUNTING_HOUSE,
  ASHFALL_CHAPEL,
  ASHFALL_CINDER_CUP,
  LAMPROW_OIL_HOUSE,
  LAMPROW_TITHE_OFFICE,
  LAMPROW_SINK_CELLARS,
  BONEMARKET_HALL,
  BONEMARKET_PAWNSHOP,
  CINDERWORKS_FOUNDRY,
  CINDERWORKS_POSTERS,
  WARD_SEVEN_CISTERN,
  WARD_SEVEN_CLINIC,
  HIGHCOURT_SPIRE_LOBBY,
  HIGHCOURT_SMOKE_EATERS,
  HIGHCOURT_UNDERCROFT,
  CHALK_VERGE_BOTHY,
  CHALK_ROAD_WAYSTATION,
  MILLHARROW_MILL,
  MILLHARROW_GRANARY,
  TALLOW_PUMP_HOUSE,
  SALTGLASS_GLASSHOUSE,
  SALTGLASS_CUSTOMS_HOUSE,
  BRAYS_BARN,
];

export function areaById(id: string): AreaDef | undefined {
  return AREAS.find((a) => a.id === id);
}

/** Where anyone with no valid position ends up. */
export const DEFAULT_AREA = ASHFALL;

export {
  ASHFALL,
  LAMPROW,
  BONEMARKET,
  CINDERWORKS,
  WARD_SEVEN,
  HIGHCOURT,
  CHALK_VERGE,
  CHALK_ROAD,
  MILLHARROW,
  TALLOW_LEVELS,
  SALTGLASS,
  BRAYS_HOLLOW,
  FENWICKS_CROSSING,
  WEEPING_STILE,
  CALDERA,
  ASHWOOD,
  RIMEFIELDS,
  STORM_SHELF,
  BONE_BASTION,
  ASHFALL_IRONWORKS,
  ASHFALL_RECORDS,
  ASHFALL_APOTHECARY,
  ASHFALL_VIVARIUM,
  ASHFALL_TOLL_HOUSE,
  ASHFALL_COUNTING_HOUSE,
  ASHFALL_CHAPEL,
  ASHFALL_CINDER_CUP,
  LAMPROW_OIL_HOUSE,
  LAMPROW_TITHE_OFFICE,
  LAMPROW_SINK_CELLARS,
  BONEMARKET_HALL,
  BONEMARKET_PAWNSHOP,
  CINDERWORKS_FOUNDRY,
  CINDERWORKS_POSTERS,
  WARD_SEVEN_CISTERN,
  WARD_SEVEN_CLINIC,
  HIGHCOURT_SPIRE_LOBBY,
  HIGHCOURT_SMOKE_EATERS,
  HIGHCOURT_UNDERCROFT,
  CHALK_VERGE_BOTHY,
  CHALK_ROAD_WAYSTATION,
  MILLHARROW_MILL,
  MILLHARROW_GRANARY,
  TALLOW_PUMP_HOUSE,
  SALTGLASS_GLASSHOUSE,
  SALTGLASS_CUSTOMS_HOUSE,
  BRAYS_BARN,
};
