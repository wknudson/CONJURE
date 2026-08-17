/**
 * Encounter catalogue. Importing this module registers every encounter script, so the
 * engine's damage/turn hooks find them by id.
 */

import type { EncounterDef } from './registry.js';
import { NOVICE_DUELIST } from './duelist.novice.js';
import { NARROW_RUIN } from './narrow.ruin.js';
import { GLACIAL_FIELD } from './glacial.field.js';
import { IGNIS_TRIAL } from './ignis.trial.js';

// Roughly in order of what they ask of a player: an honest duel, then a corridor that
// punishes standing still, then an open field where nothing can see, then the boss.
export const ENCOUNTERS: EncounterDef[] = [
  NOVICE_DUELIST,
  NARROW_RUIN,
  GLACIAL_FIELD,
  IGNIS_TRIAL,
];

export function encounterById(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

export { NOVICE_DUELIST, NARROW_RUIN, GLACIAL_FIELD, IGNIS_TRIAL };
