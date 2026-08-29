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
};
