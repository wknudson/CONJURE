/**
 * Encounter catalogue. Importing this module registers every encounter script, so the
 * engine's damage/turn hooks find them by id.
 */

import type { EncounterDef } from './registry.js';
import { NOVICE_DUELIST } from './duelist.novice.js';
import { NARROW_RUIN } from './narrow.ruin.js';
import { GLACIAL_FIELD } from './glacial.field.js';
import { IGNIS_TRIAL } from './ignis.trial.js';
import { LAMPROW_TITHE } from './lamprow.tithe.js';
import { BONEMARKET_VERMIN } from './bonemarket.vermin.js';
import { CURFEW_BREAKERS } from './curfew.breakers.js';
import { CHALK_ROAD_TOLL } from './chalk.road.toll.js';

// Roughly in order of what they ask of a player: an honest duel, then a corridor that
// punishes standing still, then an open field where nothing can see, then the boss.
// After those, the story contracts, in campaign order (see `../campaign.ts`).
export const ENCOUNTERS: EncounterDef[] = [
  NOVICE_DUELIST,
  NARROW_RUIN,
  GLACIAL_FIELD,
  IGNIS_TRIAL,
  LAMPROW_TITHE,
  BONEMARKET_VERMIN,
  CURFEW_BREAKERS,
  CHALK_ROAD_TOLL,
];

export function encounterById(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

export { NOVICE_DUELIST, NARROW_RUIN, GLACIAL_FIELD, IGNIS_TRIAL };
export { LAMPROW_TITHE, BONEMARKET_VERMIN, CURFEW_BREAKERS, CHALK_ROAD_TOLL };
