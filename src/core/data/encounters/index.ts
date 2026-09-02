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
import { THE_SUMMONS } from './the.summons.js';
import {
  HUNT_ASHWOOD_STAG,
  HUNT_ASHWOOD_WARDEN,
  HUNT_BARROW_JACKAL,
  HUNT_CALDERA_DRAKE,
  HUNT_CHALK_BOAR,
  HUNT_CHALK_CUT_RAM,
  HUNT_CINDERWORKS_SALAMANDER,
  HUNT_PYLON_KUDU,
  HUNT_RIMEFIELD_BEAR,
  HUNT_SALTGLASS_SEAL,
  HUNT_SHELF_LYNX,
  HUNT_TALLOW_AUROCHS,
} from './hunts.js';
import { PACK_ENCOUNTERS } from './packs.js';
import { CALDERA_TORTOISE, CALDERA_WASPS, RIMEFIELD_GARGOYLE } from './apex.lairs.js';
import {
  DEAD_LETTERS,
  THE_QUIET_BELOW,
  UNDERCROFT_CENSUS,
  UNDERHILL_DUEL,
} from './campaign.epilogue.js';

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
  THE_SUMMONS,
  // The epilogue, in walking order — gated on the finale purely by coming after it in
  // `STORY_CONTRACTS`.
  DEAD_LETTERS,
  UNDERCROFT_CENSUS,
  UNDERHILL_DUEL,
  THE_QUIET_BELOW,
  // The regional apex lairs: walk-to fights with no poster, second routes for species
  // whose story fights happened in the city. See `district/sites.ts` for the ground.
  CALDERA_TORTOISE,
  CALDERA_WASPS,
  RIMEFIELD_GARGOYLE,
  // The Wild Hunts, last: they are not campaign order because they are not campaign. Every
  // one is standing work behind the ward gate, repeatable on its own clock.
  HUNT_CALDERA_DRAKE,
  HUNT_RIMEFIELD_BEAR,
  HUNT_SHELF_LYNX,
  HUNT_ASHWOOD_STAG,
  HUNT_ASHWOOD_WARDEN,
  HUNT_CHALK_BOAR,
  HUNT_CINDERWORKS_SALAMANDER,
  HUNT_CHALK_CUT_RAM,
  HUNT_SALTGLASS_SEAL,
  HUNT_TALLOW_AUROCHS,
  HUNT_PYLON_KUDU,
  HUNT_BARROW_JACKAL,
  // The roaming packs. Spread rather than listed, because what a pack *is* lives in
  // `data/packs.ts` and this file should not be a second place to forget one.
  ...PACK_ENCOUNTERS,
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
  THE_SUMMONS,
};
