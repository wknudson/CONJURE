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
 * Also the same house rule, stated precisely now that a pool has tested it: a trait may
 * grant a **new capability**, numbers and all — steam that scalds, plate that charges off
 * an arc, a Freeze that lasts a turn longer. What it may not do is **scale a number some
 * card already prints**. `ember_spores` and `frost_reaper` below are exactly that, which
 * is why they are the two knacks marked pending for a reason that is not a missing
 * mechanic.
 */

import type { CombatBoons } from '../engine/setup.js';

export interface CompanionTrait {
  id: string;
  name: string;
  text: string;
  /** Which species can roll this. A trait belongs to a bloodline, not to the pool. */
  baseId: string;
  boons: CombatBoons;
  /**
   * What the engine would need before this could be rolled, if it needs anything.
   *
   * Present means **declared, not built**: the design is recorded, `boons` is empty, and
   * `traitsFor` will not offer it. A knack that a player could roll and that then did
   * nothing is worse than one that does not exist, because the second is a gap and the
   * first is a bug they will spend a run trying to reproduce.
   */
  pending?: string;
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

/**
 * The hybrid bloodlines' knacks — two apiece, and the first pool in the game with a
 * **declared but unbuilt** half.
 *
 * Eleven of the twenty are wired to real capabilities and roll like every knack above.
 * The other nine name mechanics the engine does not have — Echo, Pierce, Frail, Hollow,
 * Devour, damage reflection — and carry `pending` saying exactly which. They are here
 * rather than deleted because the design is the useful artefact: a trait that says what
 * it needs is a work item, and a trait quietly dropped is a conversation somebody has to
 * have twice.
 *
 * `traitsFor` filters them out, so nothing rollable is ever a no-op. A hybrid still has
 * plenty to roll: see `TRAIT_LINEAGE` below.
 */
const HYBRID_TRAITS: Record<string, CompanionTrait> = {
  fog_stalker: {
    id: 'fog_stalker',
    name: 'Fog-Stalker',
    text: 'Learns the cloud from the inside. Your units standing in Steam Fog cannot be picked out by ranged attacks.',
    baseId: 'chimera',
    boons: { fogConceals: true },
  },
  boiling_point: {
    id: 'boiling_point',
    name: 'Boiling Point',
    text: 'Your steam stays at the boil. Enemies beginning a turn inside it take 10 damage through armor.',
    baseId: 'chimera',
    boons: { steamBurns: 10 },
  },
  arc_welder: {
    id: 'arc_welder',
    name: 'Arc-Welder',
    text: 'Earths through plate rather than around it. Arc collateral ignores Armor entirely.',
    baseId: 'wasp',
    boons: { arcPierces: true },
  },
  static_burn: {
    id: 'static_burn',
    name: 'Static Burn',
    text: 'Enemies afflicted with Burn suffer -1 MOV.',
    baseId: 'wasp',
    boons: {},
    pending:
      'Movement has no per-side hook: `movementRange` reads a unit and nothing else, so a MOV penalty owed to the *opposing* commander cannot be seen from there.',
  },
  heavy_tread: {
    id: 'heavy_tread',
    name: 'Heavy Tread',
    text: 'The whole line digs in. Nothing shoves, drags, or carries any unit of yours anywhere.',
    baseId: 'tortoise',
    boons: { alliesGrounded: true },
  },
  magma_plating: {
    id: 'magma_plating',
    name: 'Magma Plating',
    text: 'Cooled crust over every joint. Your units take 20 less damage from every collision.',
    baseId: 'tortoise',
    boons: { collisionResist: 20 },
  },
  toxic_smoke: {
    id: 'toxic_smoke',
    name: 'Toxic Smoke',
    text: 'The blast blows the spores onto whatever is left. Enemies surviving a Wildfire take Toxin (1).',
    baseId: 'treant',
    boons: { wildfireSeedsToxin: 1 },
  },
  ember_spores: {
    id: 'ember_spores',
    name: 'Ember Spores',
    text: 'Toxin ticks deal an additional 10 fire damage.',
    baseId: 'treant',
    boons: {},
    pending:
      'Scales an existing damage number, which is the one thing this schema deliberately has nowhere to put. See the note at the top of this file.',
  },
  conductive_ice: {
    id: 'conductive_ice',
    name: 'Conductive Ice',
    text: 'Rime carries a charge. Chill satisfies any Surge reaction that asks for Charged, and is spent in its place.',
    baseId: 'mantis',
    boons: { chillConducts: true },
  },
  lightning_rod: {
    id: 'lightning_rod',
    name: 'Lightning Rod',
    text: 'Allied Guardians reflect 10 shock damage when struck by a ranged attack.',
    baseId: 'mantis',
    boons: {},
    pending:
      'Reflection does not exist. Nothing in the damage pipeline sends anything back the way it came, and the attacker is not carried to where a defence could read it.',
  },
  dense_ice: {
    id: 'dense_ice',
    name: 'Dense Ice',
    text: 'Freezes to the bone. Every Freeze you cause lasts one turn longer.',
    baseId: 'juggernaut',
    boons: { bonusFreezeStacks: 1 },
  },
  shrapnel_guard: {
    id: 'shrapnel_guard',
    name: 'Shrapnel Guard',
    text: 'Knows which way the ice goes. Your units take nothing from Shatter splash.',
    baseId: 'juggernaut',
    boons: { immuneToShatterSplash: true },
  },
  frost_reaper: {
    id: 'frost_reaper',
    name: 'Frost-Reaper',
    text: 'Dusk spells deal +20 bonus damage to Chilled targets.',
    baseId: 'gargoyle',
    boons: {},
    pending:
      'Scales an existing damage number, and additionally by school and by target status. See the note at the top of this file.',
  },
  hollow_ice: {
    id: 'hollow_ice',
    name: 'Hollow Ice',
    text: 'Units carrying Hollow raise an Ice Barricade on their tile when they die.',
    baseId: 'gargoyle',
    boons: {},
    pending:
      'No `hollow` status exists. `data/auras.ts` names Hollow as an unbuilt Dusk Climax trait, and nothing applies or reads it.',
  },
  magnetic_repulsion: {
    id: 'magnetic_repulsion',
    name: 'Magnetic Repulsion',
    text: 'Everything you push, you push harder. Your cards shove one tile further.',
    baseId: 'dynamo',
    boons: { bonusShoveDistance: 1 },
  },
  shock_absorber: {
    id: 'shock_absorber',
    name: 'Shock Absorber',
    text: 'Takes the jolt as plate. Your units gain 10 Armor when Arc collateral strikes them.',
    baseId: 'dynamo',
    boons: { armorOnArcCollateral: 10 },
  },
  echo_chamber: {
    id: 'echo_chamber',
    name: 'Echo Chamber',
    text: 'Echoes persist for one additional round before expiring.',
    baseId: 'geist',
    boons: {},
    pending:
      'Echo does not exist. There is no such resource anywhere in `src/core`, so there is nothing to extend the life of.',
  },
  death_rattle: {
    id: 'death_rattle',
    name: 'Death Rattle',
    text: 'Overloaded units apply Frail to their killer as they go.',
    baseId: 'geist',
    boons: {},
    pending:
      'Neither half exists: `frail` is not a StatusKind, and Overload is a reaction rather than a status a body can be killed while carrying.',
  },
  ossify: {
    id: 'ossify',
    name: 'Ossify',
    text: 'Persistent Armor on your units cannot be bypassed by Pierce.',
    baseId: 'sovereign',
    boons: {},
    pending:
      'Pierce does not exist as a keyword. Armor is bypassed by the `true` damage type, which is a property of the blow and has no per-side exemption to grant.',
  },
  grave_robber: {
    id: 'grave_robber',
    name: 'Grave-Robber',
    text: 'Devoured allied units return to your hand instead of the discard pile.',
    baseId: 'sovereign',
    boons: {},
    pending:
      'Devour does not exist. Nothing consumes an allied body for stats, so there is no trigger to redirect the card away from the discard pile.',
  },
};

/**
 * The parent species a hybrid inherits rollable knacks from.
 *
 * Two reasons, and the first is structural: a bloodline with fewer than two rollable
 * traits makes taming one a formality, and three of these hybrids have *zero* wired
 * traits of their own because all four of their briefed knacks need engine work first.
 * Inheritance means no hybrid is ever short, whatever is or is not built yet.
 *
 * The second is that it is simply true. A Chimera of the Caldera is half Ignis, and there
 * is no reading of that under which it cannot have been born with Ash-Walker.
 *
 * Keyed by the hybrid's own `baseId` rather than derived from its schools, because the
 * mapping from a school to the species that speaks it is a fact about the roster and not
 * about the taming roll — and `data/companions.ts` is not something this file should have
 * to import to answer a question about traits.
 */
export const TRAIT_LINEAGE: Record<string, readonly string[]> = {
  chimera: ['ignis', 'boreas'],
  wasp: ['ignis', 'voltara'],
  tortoise: ['ignis', 'ferrum'],
  treant: ['ignis', 'sylva'],
  mantis: ['boreas', 'voltara'],
  juggernaut: ['boreas', 'ferrum'],
  gargoyle: ['boreas', 'mortis'],
  dynamo: ['voltara', 'ferrum'],
  geist: ['voltara', 'mortis'],
  sovereign: ['ferrum', 'mortis'],
};

for (const [id, trait] of Object.entries(VOLTARA_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(MORTIS_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(SYLVA_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(FERRUM_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(LEXIS_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(HYBRID_TRAITS)) COMPANION_TRAITS[id] = trait;

export function traitById(id: string): CompanionTrait | undefined {
  return COMPANION_TRAITS[id];
}

/**
 * The traits a given species can roll. Empty for a species nobody wrote traits for.
 *
 * Two rules on top of the obvious one. A `pending` trait is **never** offered — see the
 * field's own note — and a hybrid rolls its parents' pools alongside its own, which is
 * both true to what a hybrid is and the thing that keeps every bloodline's roll worth
 * making while half the hybrid knacks are still engine work.
 */
export function traitsFor(baseId: string): CompanionTrait[] {
  const pools = [baseId, ...(TRAIT_LINEAGE[baseId] ?? [])];
  return Object.values(COMPANION_TRAITS)
    .filter((t) => !t.pending && pools.includes(t.baseId))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Everything written for a bloodline, pending knacks included.
 *
 * For the Field Journal and for tests: "what did we design for a Chimera" and "what can a
 * Chimera roll today" are different questions, and only the second one should be able to
 * hand a player a trait.
 */
export function declaredTraitsFor(baseId: string): CompanionTrait[] {
  return Object.values(COMPANION_TRAITS)
    .filter((t) => t.baseId === baseId)
    .sort((a, b) => a.id.localeCompare(b.id));
}
