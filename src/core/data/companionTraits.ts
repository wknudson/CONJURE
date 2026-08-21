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
    text: 'Holds its heat overnight. Opens every contract wearing 20 Armor.',
    baseId: 'ignis',
    boons: { armor: 20 },
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
    text: 'Grounded to the bone. Opens every contract wearing 20 Armor.',
    baseId: 'voltara',
    boons: { armor: 20 },
  },

  static_cling: {
    id: 'static_cling',
    name: 'Static Cling',
    text: 'Keeps its feet on ground that takes everyone else off theirs.',
    baseId: 'voltara',
    boons: { ignoreIceSlip: true },
  },
};

/**
 * Mortis's bloodline.
 *
 * Both are about the body rather than the numbers, which is what the Dusk school wants: a
 * deck that spends its own minions cares a great deal about what it gets back for them,
 * and about whether the thing it casts from can be moved off the spot it chose.
 */
const MORTIS_TRAITS: Record<string, CompanionTrait> = {
  soul_siphon: {
    id: 'soul_siphon',
    name: 'Soul Siphon',
    text: 'Takes a little back from every offering. Each tithe returns 10 HP to the Pact.',
    baseId: 'mortis',
    boons: { healOnTithe: 10 },
  },

  grave_ward: {
    id: 'grave_ward',
    name: 'Grave-Ward',
    text: 'Comes wrapped in something older than it is. Opens every contract wearing 20 Armor.',
    baseId: 'mortis',
    // `armor` rather than `startingArmor`: the latter is a *Companion progression* field
    // that levelling writes, and a trait speaks in the engine's vocabulary. Both end up in
    // the same sum inside `carryFor`, which is where the two are added together.
    boons: { armor: 20 },
  },

  ethereal_bound: {
    id: 'ethereal_bound',
    name: 'Ethereal-Bound',
    text: 'Never quite touches the ground. Rubble does not slow it and currents cannot carry it.',
    baseId: 'mortis',
    boons: { boundFormIgnoresHazards: true },
  },
};

/**
 * Sylva's bloodline.
 *
 * One holds ground and one deepens the poison — the two halves of what a Bloom deck is
 * trying to do, which is to still be standing when the rot finishes its work.
 */
const SYLVA_TRAITS: Record<string, CompanionTrait> = {
  deep_roots: {
    id: 'deep_roots',
    name: 'Deep Roots',
    text: 'Rooted where it stands. Nothing shoves, drags, or carries it anywhere.',
    baseId: 'sylva',
    boons: { boundFormGrounded: true },
  },

  iron_wood: {
    id: 'iron_wood',
    name: 'Iron-Wood',
    text: 'Grows its walls dense. Every obstacle you raise stands 20 HP sturdier.',
    baseId: 'sylva',
    // The Alchemist's Mortar's own capability, reached from the other direction. A trait
    // and a relic asking for the same rule is the system working: they stack, and neither
    // needed the engine to learn a new word.
    boons: { bonusObstacleHp: 20 },
  },

  toxic_bloom: {
    id: 'toxic_bloom',
    name: 'Toxic Bloom',
    text: 'Everything you poison takes one stack more than it should.',
    baseId: 'sylva',
    boons: { bonusToxinStacks: 1 },
  },
};

/**
 * Ferrum's knacks. The Vault Boar holds ground; each of these is a different way to.
 */
const FERRUM_TRAITS: Record<string, CompanionTrait> = {
  /**
   * The first knack in the game on the Pip axis.
   *
   * `CombatBoons.pips` has existed since the brews and neither a trait nor a relic had
   * ever asked for it. An extra opening Pip is a whole turn-one card on a school whose
   * cheapest plays are walls.
   */
  iron_reserves: {
    id: 'iron_reserves',
    name: 'Iron Reserves',
    text: 'Comes to the field already braced. Start every fight with 1 extra Pip.',
    baseId: 'ferrum',
    boons: { pips: 1 },
  },

  /**
   * Bracing, not armour.
   *
   * Reduces what a *collision* costs and nothing else, so a Vaporize burns through it
   * exactly as much as before. It answers the shove archetype specifically — Seismic
   * Slam, Grapple Line, currents, Overload's throw — rather than making the line
   * generically tougher, which is what Armor is already for.
   */
  heavy_plating: {
    id: 'heavy_plating',
    name: 'Heavy Plating',
    text: 'Braced for the impact. Your units take 10 less damage from every collision.',
    baseId: 'ferrum',
    boons: { collisionResist: 10 },
  },

  /**
   * The Alchemist's Mortar and Sylva's Iron-Wood, reached a third time.
   *
   * Three sources for one rule is the system working rather than a duplication: they
   * stack, and none of them needed the engine to learn a new word.
   */
  trench_maker: {
    id: 'trench_maker',
    name: 'Trench-Maker',
    text: 'Digs in wherever it stops. Every obstacle you raise stands 20 HP sturdier.',
    baseId: 'ferrum',
    boons: { bonusObstacleHp: 20 },
  },
};

/**
 * Lexis's knacks. The Ink Owl plays the hand rather than the board, and two of these are
 * the first things in the game to ask for boons that have sat unused since the brews.
 */
const LEXIS_TRAITS: Record<string, CompanionTrait> = {
  /**
   * The second untouched boon axis.
   *
   * The opening hand *is* turn one's draw, so a sixth card is a materially different
   * first turn rather than a card arriving marginally sooner.
   */
  prepared_mind: {
    id: 'prepared_mind',
    name: 'Prepared Mind',
    text: 'Reads ahead. Open every fight holding one extra card.',
    baseId: 'lexis',
    boons: { extraOpeningCards: 1 },
  },

  /**
   * The Gambler's Coin reached from the other direction — and they stack, to eleven.
   *
   * Worth more to this Companion than to any other: Marginalia draws every turn, and a
   * hand already at its limit turns that draw into a burnt card and a Marrow.
   */
  hoarder: {
    id: 'hoarder',
    name: 'Hoarder',
    text: 'Throws nothing away. Hold 2 more cards through end of turn.',
    baseId: 'lexis',
    boons: { bonusHandLimit: 2 },
  },

  /**
   * Reads the posture rather than the geometry.
   *
   * A Guardian is a body deliberately interposing; a Behemoth's bulk and a wall are
   * simply in the way. This sees around the first and not the others, which keeps
   * `arcing` the answer to terrain and makes this the answer to a screen.
   */
  piercing_gaze: {
    id: 'piercing_gaze',
    name: 'Piercing Gaze',
    text: 'Looks straight through a held shield. Your ranged attacks and spells ignore Guardian.',
    baseId: 'lexis',
    boons: { ignoreGuardians: true },
  },
};

for (const [id, trait] of Object.entries(VOLTARA_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(MORTIS_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(SYLVA_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(FERRUM_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(LEXIS_TRAITS)) COMPANION_TRAITS[id] = trait;

export function traitById(id: string): CompanionTrait | undefined {
  return COMPANION_TRAITS[id];
}

/** The traits a given species can roll. Empty for a species nobody wrote traits for. */
export function traitsFor(baseId: string): CompanionTrait[] {
  return Object.values(COMPANION_TRAITS)
    .filter((t) => t.baseId === baseId)
    .sort((a, b) => a.id.localeCompare(b.id));
}
