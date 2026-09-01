/**
 * The Companions' bodies on the board.
 *
 * These are not deck cards and can never be drawn, played, or owned — they exist only as
 * stat blocks for the unit placed at setup, in the same way the free Vanguard Footman
 * does. Each is bound to its Companion by CompanionDef.unitCardId.
 *
 * Every one carries BoundForm, which is what makes them the Pact's body: they keep no
 * health of their own, cannot be tithed, enchanted or attached to, and never grow. The `hp`
 * below is therefore cosmetic — it never moves, because damage is redirected to the Pact
 * before it reaches the unit. It is set to the Pact's own total so that anything reading
 * a health fraction off the unit reads full, rather than reading a misleading sliver.
 *
 * Note the deliberate asymmetry with `source`: these summon nothing and trigger nothing,
 * so their source is irrelevant to Resonance. They are marked 'companion' for honesty.
 */

import type { CardDef } from '../../types/cards.js';

/** The Pact's full pool, mirrored so the body never reads as wounded. */
const PACT_HP = 40;
/** The Trial's own pool, mirrored on the boss's bodies for the same reason. */
const BOSS_HP = 440;

export const COMPANION_UNIT_CARDS: Record<string, CardDef> = {
  ignis_bound: {
    id: 'ignis_bound',
    name: 'Ignis',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // A drake that fights at arm's length: it wants to be near the fray, which is the
      // same place its spells reach furthest from — and the same place it is shoved.
      atk: 30,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  // ------------------------------------------------------------- the hybrids
  //
  // Ten bloodlines that draw on two schools at once, and therefore need ten bodies to
  // cast from. Every one is a `PACT_HP` Bound Form like the seven before it: the pool a
  // Companion's body shows is the Pact's, mirrored, so it never reads as wounded while
  // the gauge above it is full.
  //
  // Their stat lines differ only in the three things a player reads off a body before
  // deciding where to walk it -- reach, speed, and how hard it hits back. A Tortoise is
  // slow and unmoving because its whole argument is the ground it holds; a Wasp is fast
  // and thin because its argument is that it is somewhere else by now.

  /** Two heads that disagree about the weather, and a body that boils where they meet. */
  chimera_bound: {
    id: 'chimera_bound',
    name: 'Chimera of the Caldera',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre and Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 30,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** Not one thing. Fast, thin, and it goes where the current does. */
  wasp_bound: {
    id: 'wasp_bound',
    name: 'Cinder-Wasp Swarm',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** Slow, and it does not need to be anything else. The ground goes where it pushes. */
  tortoise_bound: {
    id: 'tortoise_bound',
    name: 'Obsidian Tortoise',
    cost: { bones: 0, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** Sap that catches. It grows toward whatever burned last. */
  treant_bound: {
    id: 'treant_bound',
    name: 'Crimson Treant',
    cost: { bones: 0, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 30,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** It waits, then it does not. Everything between is a conductor. */
  mantis_bound: {
    id: 'mantis_bound',
    name: 'Storm-Mantis',
    cost: { bones: 0, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Frost and Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 30,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** A wall that chose a direction. What it freezes, it then walks through. */
  juggernaut_bound: {
    id: 'juggernaut_bound',
    name: 'Glacial Juggernaut',
    cost: { bones: 0, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Frost and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 30,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** It perches over the cold ones and waits for them to stop moving. */
  gargoyle_bound: {
    id: 'gargoyle_bound',
    name: 'Grave-Gargoyle',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Frost and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** Brass, wound tight. Everything it touches ends up somewhere else. */
  dynamo_bound: {
    id: 'dynamo_bound',
    name: 'Kinetic Dynamo',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Surge and Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** Charge with nothing to earth into. It borrows your bodies for that. */
  geist_bound: {
    id: 'geist_bound',
    name: 'Volatile Geist',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Surge and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
  /** It is wearing the last several things that stood where you are standing. */
  sovereign_bound: {
    id: 'sovereign_bound',
    name: 'Bone Bastion Sovereign',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Bulwark and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 30,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * The Novice Duelist's own Companion, and the first enemy to have a body at all.
   *
   * Deliberately the least imposing of the three: a duelist you are meant to beat should
   * not field the hardest Bound Form in the game. Its reach of 2 is what makes it worth
   * chasing — it can be walked down, but it will get a hit in on the way.
   */
  umbra_bound: {
    id: 'umbra_bound',
    name: 'Umbra',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The Duelist casts from where it stands, and bleeds when it is struck.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * Ignis as the Trial fights it: on the board, in reach, and worth walking up to.
   *
   * A boss that commanded from off-grid could only ever be chipped at through its
   * minions. Standing it on the field makes the fight about closing with the drake, and
   * the 44 HP it draws on is the encounter's own pool rather than anything of its own.
   */
  ignis_drake_bound: {
    id: 'ignis_drake_bound',
    name: 'Ignis, Ember Drake',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The drake itself. Wounds it takes are dealt to its Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 40,
      hp: BOSS_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * What it becomes at half health. Bigger in every sense: it hits harder, it is slower,
   * and at 2x2 it blocks line of sight through itself — so the enraged drake rewrites
   * the sightlines of the arena simply by standing in it.
   */
  ignis_behemoth_bound: {
    id: 'ignis_behemoth_bound',
    name: 'Ignis Enraged',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The drake grown into its full shape. Blocks sight through itself.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 50,
      hp: BOSS_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * Lord Magistrate Vane's second phase: the throne floor opens and he boards the
   * engine. The campaign finale's Bound Form, shaped exactly like `ignis_behemoth_bound`
   * because it fills the same role — the fight's second half, at 2x2, redrawing the
   * arena's lanes by standing in them.
   */
  colossus_bound: {
    id: 'colossus_bound',
    name: 'The Clockwork Colossus',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The Great Quieting, given legs. Blocks sight through itself.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // A step over the behemoth's 50, and on the Stat Stretch grid — every figure is
      // x10, and the stretch test holds bodies to it.
      atk: 60,
      hp: BOSS_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      escalationBonus: { atk: 0, hp: 0 },
      // The kit, not just the size — it shipped as a stat clone of the enraged drake and
      // read as a bigger number rather than a different machine. It strikes with the grid
      // it eats, and what survives a blow is left Charged: the engine primes the board
      // for Vane's own cascade deck, so ignoring the body makes his hand worse for you.
      attackDtype: 'shock',
      onHit: { status: 'charged', stacks: 1 },
      // Self-welding plate. Left alone it hardens; PLATE_CAP bounds how far.
      platesEachTurn: 10,
      // And the stated weakness the player can be told: it comes apart to impact —
      // Bulwark's whole vocabulary is the answer to the machine.
      elementalMod: { impact: 10 },
    },
  },

  /**
   * The Bone Bastion Sovereign at half strength: the necropolis apex grown into the
   * shape the doc always billed it as. The third 2x2 Bound Form, and like the other two
   * it is the fight's second half — slower, harder-hitting, and rewriting the arena's
   * sightlines by standing in them. Dusk's own body: what the graves keep, at full size.
   */
  sovereign_behemoth_bound: {
    id: 'sovereign_behemoth_bound',
    name: 'The Sovereign, Risen',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The Bastion, awake. Blocks sight through itself.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 50,
      hp: BOSS_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  voltara_bound: {
    id: 'voltara_bound',
    name: 'Voltara',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // Fast and thin, between the drake and the bear: Surge's bursts are thrown short,
      // so the body that throws them has to be able to reposition every turn and cannot
      // afford to be the thing standing in the way when it gets there.
      atk: 20,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  mortis_bound: {
    id: 'mortis_bound',
    name: 'Mortis',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // Slow and unbothered. A Dusk deck spends its own bodies rather than chasing, so the
      // thing it casts from wants to stand somewhere useful and stay there.
      atk: 20,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  sylva_bound: {
    id: 'sylva_bound',
    name: 'Sylva',
    cost: { bones: 0, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // The longest reach of any Bound Form and the least willing to swing. Bloom wins by
      // waiting, so its body wants to be far enough back to still be there when it does.
      atk: 10,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * Ferrum's body. The slowest thing in the game and the hardest to move off a tile.
   *
   * 1 MOV is the whole design: Shield Oath armours the Companion's own column, so the
   * lane it is standing in is the lane it is defending, and a body that could reposition
   * freely would make that choice cost nothing. Where you walk it in the first two turns
   * is where the fight happens.
   */
  ferrum_bound: {
    id: 'ferrum_bound',
    name: 'Ferrum',
    cost: { bones: 0, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Bulwark cards are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm', 'Guardian'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * The Ink Owl. Fragile, far-sighted, and the only Bound Form that wants to be nowhere
   * near the fighting.
   *
   * **No longer a bloodline.** Lexis was a tameable arcane species and is not any more —
   * the roster is the six disciplines and the wild bloodlines a contract can bind, and an
   * arcane companion sat outside both. What survives is the body, because the Magistracy
   * keeps one: it is the clerk-bird on Vane's dais in `the.summons.ts`, the phase-1 form
   * his Colossus docks out of. A creature the regime owns and nobody can pact with reads
   * better than a bloodline nobody could pick.
   *
   * Its position is purely about cast reach, which makes walking it forward a decision
   * with no compensation — the right shape for something that belongs behind a throne.
   */
  lexis_bound: {
    id: 'lexis_bound',
    name: 'Ink Owl',
    cost: { bones: 0, marrow: 0 },
    school: 'arcane',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Arcane cards are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 10,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  boreas_bound: {
    id: 'boreas_bound',
    name: 'Boreas',
    cost: { bones: 0, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // A bear that keeps its distance: weaker in the melee, but able to hold a sightline
      // from further back, which suits Frost's longer reach.
      atk: 20,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  // ------------------------------------------------------------- the eleven newcomers
  //
  // Six second bloodlines — one per school, so no element is a single beast any more — and
  // five hybrids closing the last five school pairings. Every one is a `PACT_HP` body like
  // the sixteen above; a Bound Form's health is the Pact's health and is not a place to
  // express character.
  //
  // Where they *do* differ is reach, speed and swing, and each of the six new monos is
  // deliberately built as the counter-argument to its school's founder: the Salamander is
  // quick where the Drake is a bruiser, the Ram is a wall where the Boar is a wall that
  // hits. A player who catches both should be choosing between two bodies, not upgrading.

  /** Lives in flues. Fast, thin, and never where the smoke was a moment ago. */
  salamander_bound: {
    id: 'salamander_bound',
    name: 'Flue Salamander',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // Ignis is a 30-attack bruiser that walks 2. This is the other half of the school:
      // 4 movement, and it would rather be somewhere else than win an exchange.
      atk: 10,
      hp: PACT_HP,
      mov: 4,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** Came in with the tide the harbour writ closed. Slow on land, impossible to move. */
  seal_bound: {
    id: 'seal_bound',
    name: 'Saltglass Seal',
    cost: { bones: 0, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Frost spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** Grazes the Magistracy's own pylon fields and has never once been asked to leave. */
  kudu_bound: {
    id: 'kudu_bound',
    name: 'Conduit Kudu',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Surge spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 10,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** Digs where the Census buried, and has learned which ground is fresh. */
  jackal_bound: {
    id: 'jackal_bound',
    name: 'Barrow Jackal',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 4,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** Walks the fallow strips the tithe left. Nothing hurries it. */
  aurochs_bound: {
    id: 'aurochs_bound',
    name: 'Moss Aurochs',
    cost: { bones: 0, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // Sylva is the longest reach in the game and swings for 10. The Aurochs is the
      // opposite reading of patience: it stands in front, and it hits back.
      atk: 30,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** Breaks chalk for the road it will never be allowed to walk down. */
  ram_bound: {
    id: 'ram_bound',
    name: 'Quarry Ram',
    cost: { bones: 0, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Bulwark spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      // Ferrum walks 1 and holds its lane. The Ram walks 3 and arrives — same school, and
      // the only Bulwark body in the game with somewhere to be.
      atk: 30,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** **Pyre + Dusk.** What is left of a lamplighter who kept going back for the wick. */
  shade_bound: {
    id: 'shade_bound',
    name: 'Cinder Shade',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Pyre and Dusk spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** **Frost + Bloom.** Antlers with last winter's thorns still frozen into them. */
  elk_bound: {
    id: 'elk_bound',
    name: 'Winterthorn Elk',
    cost: { bones: 0, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Frost and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 30,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** **Surge + Bloom.** Hedge lightning: it lives in the briar and the briar is live. */
  serpent_bound: {
    id: 'serpent_bound',
    name: 'Voltbriar Serpent',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Surge and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 3,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** **Dusk + Bloom.** Stands in the fen all day. Whatever it is waiting for, it comes. */
  heron_bound: {
    id: 'heron_bound',
    name: 'Murk Heron',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Dusk and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 10,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /** **Bulwark + Bloom.** A standing stone the hedge grew through and then wore. */
  crab_bound: {
    id: 'crab_bound',
    name: 'Dolmen Crab',
    cost: { bones: 0, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. Your Bulwark and Bloom spells are cast from where it stands. Wounds it takes are dealt to your Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: PACT_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
