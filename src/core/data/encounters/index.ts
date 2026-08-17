/**
 * Encounter catalogue. Importing this module registers every encounter script, so the
 * engine's damage/turn hooks find them by id.
 */

import type { EncounterDef } from './registry.js';
import { NOVICE_DUELIST } from './duelist.novice.js';
import { IGNIS_TRIAL } from './ignis.trial.js';

export const ENCOUNTERS: EncounterDef[] = [NOVICE_DUELIST, IGNIS_TRIAL];

export function encounterById(id: string): EncounterDef | undefined {
  return ENCOUNTERS.find((e) => e.id === id);
}

export { NOVICE_DUELIST, IGNIS_TRIAL };
