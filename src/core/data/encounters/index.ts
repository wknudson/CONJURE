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
import {
  CLINIC_QUOTA,
  DEBT_COLLECTED_MINOR,
  FOULED_CISTERN,
  GUTTER_DISPUTE,
  LAMPLIGHTER_ESCORT,
  POSTER_WORK,
} from './campaign.novice.js';
import {
  CELLAR_CLEARANCE,
  DROWNED_GRANARY,
  HOLLOW_CENSUS,
  NIGHT_FREIGHT,
  SALTGLASS_RIOT,
  TALLOW_BLIGHT,
  WARRANT_OF_DISTRAINT,
} from './campaign.adept.js';
import {
  ASHWOOD_POACHER,
  COLDWATER_DUEL,
  SMOKE_EATERS_REST,
  WAYSTONE_DUEL,
} from './campaign.duels.js';
import {
  BONE_BASTION,
  CALDERA_CHIMERA,
  DYNAMO_FLATS,
  PYLON_NINE,
  RELOCATION_TRAIN,
  RIMEFIELD_BREAK,
  STORM_SHELF_BINDING,
  WILDFIRE_WRIT,
} from './campaign.master.js';

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
  LAMPLIGHTER_ESCORT,
  CURFEW_BREAKERS,
  DEBT_COLLECTED_MINOR,
  SMOKE_EATERS_REST,
  FOULED_CISTERN,
  POSTER_WORK,
  GUTTER_DISPUTE,
  CLINIC_QUOTA,
  CHALK_ROAD_TOLL,
  TALLOW_BLIGHT,
  SALTGLASS_RIOT,
  WARRANT_OF_DISTRAINT,
  NIGHT_FREIGHT,
  ASHWOOD_POACHER,
  CELLAR_CLEARANCE,
  HOLLOW_CENSUS,
  DROWNED_GRANARY,
  WAYSTONE_DUEL,
  CALDERA_CHIMERA,
  RIMEFIELD_BREAK,
  STORM_SHELF_BINDING,
  PYLON_NINE,
  WILDFIRE_WRIT,
  COLDWATER_DUEL,
  DYNAMO_FLATS,
  RELOCATION_TRAIN,
  BONE_BASTION,
];

export function encounterById(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

export { NOVICE_DUELIST, NARROW_RUIN, GLACIAL_FIELD, IGNIS_TRIAL };
export { LAMPROW_TITHE, BONEMARKET_VERMIN, CURFEW_BREAKERS, CHALK_ROAD_TOLL };
export {
  LAMPLIGHTER_ESCORT,
  DEBT_COLLECTED_MINOR,
  FOULED_CISTERN,
  POSTER_WORK,
  GUTTER_DISPUTE,
  CLINIC_QUOTA,
  TALLOW_BLIGHT,
  SALTGLASS_RIOT,
  WARRANT_OF_DISTRAINT,
  NIGHT_FREIGHT,
  CELLAR_CLEARANCE,
  HOLLOW_CENSUS,
  DROWNED_GRANARY,
  SMOKE_EATERS_REST,
  ASHWOOD_POACHER,
  WAYSTONE_DUEL,
  COLDWATER_DUEL,
  CALDERA_CHIMERA,
  RIMEFIELD_BREAK,
  STORM_SHELF_BINDING,
  PYLON_NINE,
  WILDFIRE_WRIT,
  DYNAMO_FLATS,
  RELOCATION_TRAIN,
  BONE_BASTION,
};
