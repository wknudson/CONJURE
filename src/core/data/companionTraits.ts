/**
 * What a wild Companion happens to be good at.
 *
 * A trait is rolled when a beast is tamed, not chosen — it is the reason one Ignis is
 * worth keeping and the next one is worth releasing. Two of the same species differ by
 * their health roll and this, and nothing else.
 *
 * Same discipline as relics: a trait is authored as **capabilities in the engine's own
 * words**, never as an id the reducer recognises. `createCombat` is handed "this side
 * ignores fog" and has never heard of a Searing Gaze — which is what lets a trait be
 * added as a row here rather than as a branch in the resolver.
 *
 * Also the same house rule: a trait bends what is *possible*. None of them moves a
 * damage number, and the schema has nowhere to put one that did.
 */

import type { CombatBoons } from '../engine/setup.js';

export interface CompanionTrait {
  id: string;
  name: string;
  text: string;
  /** Which species can roll this. A trait belongs to a bloodline, not to the pool. */
  baseId: string;
  boons: CombatBoons;
}

export const COMPANION_TRAITS: Record<string, CompanionTrait> = {
  // ---------------------------------------------------------------- ignis
  ash_walker: {
    id: 'ash_walker',
    name: 'Ash-Walker',
    text: 'Grew up in the flue. Burn does nothing to it.',
    baseId: 'ignis',
    boons: { immuneToBurn: true },
  },

  searing_gaze: {
    id: 'searing_gaze',
    name: 'Searing Gaze',
    text: 'Looks straight through smoke, and resents being told otherwise.',
    baseId: 'ignis',
    boons: { ignoreFog: true },
  },

  banked_coals: {
    id: 'banked_coals',
    name: 'Banked Coals',
    text: 'Holds its heat overnight. Opens every contract wearing 2 Armor.',
    baseId: 'ignis',
    boons: { armor: 2 },
  },

  // --------------------------------------------------------------- boreas
  glacial_pacing: {
    id: 'glacial_pacing',
    name: 'Glacial Pacing',
    text: 'Walks on ice like it is owed something. Slipping is for other people.',
    baseId: 'boreas',
    boons: { ignoreIceSlip: true },
  },

  deep_reserve: {
    id: 'deep_reserve',
    name: 'Deep Reserve',
    text: 'Banks the cold. Pip ceiling raised to 9.',
    baseId: 'boreas',
    boons: { maxPips: 9 },
  },

  rimed_lungs: {
    id: 'rimed_lungs',
    name: 'Rimed Lungs',
    text: 'Breathes the fog rather than choking on it. Burn does nothing to it.',
    baseId: 'boreas',
    boons: { immuneToBurn: true },
  },
};

/**
 * Voltara's bloodline.
 *
 * Required, not decorative: a species with fewer than two traits to roll would make
 * taming one a formality, and `tameCompanion` would hand every Storm Lynx an empty knack.
 */
const VOLTARA_TRAITS: Record<string, CompanionTrait> = {
  storm_lungs: {
    id: 'storm_lungs',
    name: 'Storm Lungs',
    text: 'Breathes the air off a lightning strike. Holds 9 Pips instead of 8.',
    baseId: 'voltara',
    boons: { maxPips: 9 },
  },

  earthed_pelt: {
    id: 'earthed_pelt',
    name: 'Earthed Pelt',
    text: 'Grounded to the bone. Opens every contract wearing 2 Armor.',
    baseId: 'voltara',
    boons: { armor: 2 },
  },

  static_cling: {
    id: 'static_cling',
    name: 'Static Cling',
    text: 'Keeps its feet on ground that takes everyone else off theirs.',
    baseId: 'voltara',
    boons: { ignoreIceSlip: true },
  },
};

for (const [id, trait] of Object.entries(VOLTARA_TRAITS)) COMPANION_TRAITS[id] = trait;

export function traitById(id: string): CompanionTrait | undefined {
  return COMPANION_TRAITS[id];
}

/** The traits a given species can roll. Empty for a species nobody wrote traits for. */
export function traitsFor(baseId: string): CompanionTrait[] {
  return Object.values(COMPANION_TRAITS)
    .filter((t) => t.baseId === baseId)
    .sort((a, b) => a.id.localeCompare(b.id));
}
