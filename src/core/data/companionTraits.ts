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
    text: 'Banks the cold. Bone ceiling raised to 9.',
    baseId: 'boreas',
    boons: { maxBones: 9 },
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
    text: 'Breathes the air off a lightning strike. Holds 9 Bones instead of 8.',
    baseId: 'voltara',
    boons: { maxBones: 9 },
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
   * The first knack in the game on the Bone axis.
   *
   * `CombatBoons.bones` has existed since the brews and neither a trait nor a relic had
   * ever asked for it. An extra opening Bone is a whole turn-one card on a school whose
   * cheapest plays are walls.
   */
  iron_reserves: {
    id: 'iron_reserves',
    name: 'Iron Reserves',
    text: 'Comes to the field already braced. Start every fight with 1 extra Bone.',
    baseId: 'ferrum',
    boons: { bones: 1 },
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
      'No `hollow` status exists to carry. The Hollow Climax trait is built, but as a rider — the host leaves Brittle on what it wounds — so nothing on the board is "carrying Hollow" for a death trigger to read.',
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
  // The five pairings that had no bloodline until the roster closed the set. Each names the
  // *founder* of its two schools rather than the school's second bloodline — a hybrid
  // inherits from the beast the school is named after, and picking the newcomer instead
  // would be an arbitrary choice dressed as a rule.
  shade: ['ignis', 'mortis'],
  elk: ['boreas', 'sylva'],
  serpent: ['voltara', 'sylva'],
  heron: ['mortis', 'sylva'],
  crab: ['ferrum', 'sylva'],
};

/**
 * The six second bloodlines' knacks.
 *
 * Three apiece and all three wired, which is the standard a mono species is held to — a
 * taming roll is meant to be a three-way choice, and `buildRelics.test.ts` enforces exactly
 * that. Hybrids get away with two because they inherit their parents' pools; these have no
 * parents to inherit from.
 *
 * Written against boons the engine already reads, deliberately. Every one of these is a
 * capability the resolver has been able to express since the hybrid pool was built —
 * `steamBurns`, `alliesGrounded`, `bonusFreezeStacks` and the rest were authored for beasts
 * that could not all use them, and this is the change that spends them. Two new boons appear
 * below and no more; the rest is vocabulary the game already had.
 */
const SECOND_BLOODLINE_TRAITS: Record<string, CompanionTrait> = {
  // ---------------------------------------------------------------- salamander (pyre)
  flue_born: {
    id: 'flue_born',
    name: 'Flue-Born',
    text: 'Grew up in a chimney. Fire does nothing to it at all.',
    baseId: 'salamander',
    boons: { immuneToBurn: true },
  },
  soot_lungs: {
    id: 'soot_lungs',
    name: 'Soot Lungs',
    text: 'Reads a room by its smoke. Sees through fog nobody else can.',
    baseId: 'salamander',
    boons: { ignoreFog: true },
  },
  quick_kindling: {
    id: 'quick_kindling',
    name: 'Quick Kindling',
    text: 'Catches before the match is out. Opens every contract holding an extra card.',
    baseId: 'salamander',
    boons: { extraOpeningCards: 1 },
  },

  // ---------------------------------------------------------------------- seal (frost)
  harbor_hide: {
    id: 'harbor_hide',
    name: 'Harbor Hide',
    text: 'Blubber and salt glass. Opens every contract wearing 30 Armor.',
    baseId: 'seal',
    boons: { armor: 30 },
  },
  deep_breath: {
    id: 'deep_breath',
    name: 'Deep Breath',
    text: 'Surfaces when it chooses to. Every Freeze you cause lasts one turn longer.',
    baseId: 'seal',
    boons: { bonusFreezeStacks: 1 },
  },
  glass_footed: {
    id: 'glass_footed',
    name: 'Glass-Footed',
    text: 'Born on ice. Keeps its feet where everyone else loses theirs, and the shards of a Shatter never reach it.',
    baseId: 'seal',
    boons: { ignoreIceSlip: true, immuneToShatterSplash: true },
  },

  // ---------------------------------------------------------------------- kite (surge)
  pylon_graze: {
    id: 'pylon_graze',
    name: 'Pylon Graze',
    text: 'Grazes the grid and bleeds it dry. Opens every contract with an extra Bone in hand.',
    baseId: 'kite',
    boons: { bones: 1 },
  },
  earthing_hooves: {
    id: 'earthing_hooves',
    name: 'Earthing Hooves',
    text: 'Plants all four hooves into the conduit itself. Arc collateral ignores Armor entirely.',
    baseId: 'kite',
    boons: { arcPierces: true },
  },
  braced_stance: {
    id: 'braced_stance',
    name: 'Braced Stance',
    text: 'Braces against the line and will not be moved for anything. No shove, drag or current moves any unit of yours.',
    baseId: 'kite',
    boons: { alliesGrounded: true },
  },

  // ---------------------------------------------------------------------- jackal (dusk)
  grave_nose: {
    id: 'grave_nose',
    name: 'Grave-Nose',
    text: 'Smells a plan before it is buried. Enemy intentions are shown to you before they happen.',
    baseId: 'jackal',
    boons: { revealIntents: true },
  },
  scavengers_due: {
    id: 'scavengers_due',
    name: "Scavenger's Due",
    text: 'Takes its cut off every body. Each tithe yields 1 extra Marrow.',
    baseId: 'jackal',
    boons: { bonusTitheMarrow: 1 },
  },
  carrion_thrift: {
    id: 'carrion_thrift',
    name: 'Carrion Thrift',
    text: 'Wastes nothing it opens. Each tithe puts 10 health back on your Pact.',
    baseId: 'jackal',
    boons: { healOnTithe: 10 },
  },

  // -------------------------------------------------------------------- aurochs (bloom)
  fallow_gut: {
    id: 'fallow_gut',
    name: 'Fallow Gut',
    text: 'Grazes what would kill anything else. Poison does nothing to it.',
    baseId: 'aurochs',
    boons: { immuneToToxin: true },
  },
  deep_pasture: {
    id: 'deep_pasture',
    name: 'Deep Pasture',
    text: 'Sows heavier than it looks. Every Toxin you apply lands with an extra stack.',
    baseId: 'aurochs',
    boons: { bonusToxinStacks: 1 },
  },
  broad_back: {
    id: 'broad_back',
    name: 'Broad Back',
    text: 'Built to be walked into. Takes 20 less from every collision.',
    baseId: 'aurochs',
    boons: { collisionResist: 20 },
  },

  // ------------------------------------------------------------------------ ram (bulwark)
  chalk_horn: {
    id: 'chalk_horn',
    name: 'Chalk Horn',
    text: 'Hits like the quarry face coming down. Every shove you deal throws its target one tile further.',
    baseId: 'ram',
    boons: { bonusShoveDistance: 1 },
  },
  right_of_way: {
    id: 'right_of_way',
    name: 'Right of Way',
    text: 'Goes where it was going. Guardians do not stop your units reaching what is behind them.',
    baseId: 'ram',
    boons: { ignoreGuardians: true },
  },
  drystone_sense: {
    id: 'drystone_sense',
    name: 'Drystone Sense',
    text: 'Knows how a wall wants to stand. Every construct you raise is built with 20 extra health.',
    baseId: 'ram',
    boons: { bonusObstacleHp: 20 },
  },
};

/**
 * The five closing hybrids' own knacks.
 *
 * Two apiece, matching the ten hybrids above, and every one of them wired — the nine pending
 * knacks on the original hybrids are all waiting on engine hooks that do not exist, and
 * writing five more IOUs would have been the easy half of this change and the useless half.
 * These are chosen from what the resolver can already do.
 *
 * Their parents' pools come free through `TRAIT_LINEAGE`, so each of these species rolls
 * eight knacks: two of its own and six inherited.
 */
const CLOSING_HYBRID_TRAITS: Record<string, CompanionTrait> = {
  wick_eater: {
    id: 'wick_eater',
    name: 'Wick-Eater',
    text: 'Feeds on the flame it set. Each tithe puts 20 health back on your Pact.',
    baseId: 'shade',
    boons: { healOnTithe: 20 },
  },
  lamp_shy: {
    id: 'lamp_shy',
    name: 'Lamp-Shy',
    text: 'Keeps out of its own light. Fire cannot touch it, and it reads a smoke bank like clear air.',
    baseId: 'shade',
    boons: { immuneToBurn: true, ignoreFog: true },
  },

  hard_frost: {
    id: 'hard_frost',
    name: 'Hard Frost',
    text: 'The rot goes rigid. Every Freeze you cause lasts one turn longer.',
    baseId: 'elk',
    boons: { bonusFreezeStacks: 1 },
  },
  thorned_hide: {
    id: 'thorned_hide',
    name: 'Thorned Hide',
    text: 'Antlers of last winter. Poison does nothing to it and the shards of a Shatter never reach it.',
    baseId: 'elk',
    boons: { immuneToToxin: true, immuneToShatterSplash: true },
  },

  hedge_current: {
    id: 'hedge_current',
    name: 'Hedge Current',
    text: 'The briar is live all the way down. Arc collateral ignores Armor entirely.',
    baseId: 'serpent',
    boons: { arcPierces: true },
  },
  root_earth: {
    id: 'root_earth',
    name: 'Root-Earth',
    text: 'Earthed through the hedge. Every arc that splashes off a target plates you for 10.',
    baseId: 'serpent',
    boons: { armorOnArcCollateral: 10 },
  },

  fen_patience: {
    id: 'fen_patience',
    name: 'Fen Patience',
    text: 'Waits until the water is ready. Every Toxin you apply lands with an extra stack.',
    baseId: 'heron',
    boons: { bonusToxinStacks: 1 },
  },
  still_water: {
    id: 'still_water',
    name: 'Still Water',
    text: 'Nothing it stands in is a surprise. Poison does nothing to it, and it sees through fog.',
    baseId: 'heron',
    boons: { immuneToToxin: true, ignoreFog: true },
  },

  hedgefort: {
    id: 'hedgefort',
    name: 'Hedgefort',
    text: 'Stone grown through with thorn. Every construct you raise is built with 30 extra health.',
    baseId: 'crab',
    boons: { bonusObstacleHp: 30 },
  },
  dug_in: {
    id: 'dug_in',
    name: 'Dug In',
    text: 'Ten thousand years in one spot. Nothing shoves, drags or carries any unit of yours anywhere.',
    baseId: 'crab',
    boons: { alliesGrounded: true },
  },
};

for (const [id, trait] of Object.entries(VOLTARA_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(MORTIS_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(SYLVA_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(FERRUM_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(HYBRID_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(SECOND_BLOODLINE_TRAITS)) COMPANION_TRAITS[id] = trait;
for (const [id, trait] of Object.entries(CLOSING_HYBRID_TRAITS)) COMPANION_TRAITS[id] = trait;

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
