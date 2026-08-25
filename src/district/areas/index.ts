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

export const AREAS: readonly AreaDef[] = [ASHFALL, CHALK_VERGE];

export function areaById(id: string): AreaDef | undefined {
  return AREAS.find((a) => a.id === id);
}

/** Where anyone with no valid position ends up. */
export const DEFAULT_AREA = ASHFALL;

export { ASHFALL, CHALK_VERGE };
