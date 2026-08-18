/**
 * The Companions' bodies on the board.
 *
 * These are not deck cards and can never be drawn, played, or owned — they exist only as
 * stat blocks for the unit placed at setup, in the same way the free Vanguard Footman
 * does. Each is bound to its Companion by CompanionDef.unitCardId.
 *
 * Every one carries BoundForm, which is what makes them the Pact's body: they keep no
 * health of their own, cannot be sacrificed or attached to, and never Escalate. The `hp`
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
const BOSS_HP = 44;

export const COMPANION_UNIT_CARDS: Record<string, CardDef> = {
  ignis_bound: {
    id: 'ignis_bound',
    name: 'Ignis',
    cost: { pips: 0, marrow: 0 },
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
      atk: 3,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      sacrificeValue: 0,
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
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The Duelist casts from where it stands, and bleeds when it is struck.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 2,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'skirmisher',
      sacrificeValue: 0,
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
    cost: { pips: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The drake itself. Wounds it takes are dealt to its Pact.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 4,
      hp: BOSS_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 2,
      footprint: 1,
      archetype: 'bruiser',
      sacrificeValue: 0,
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
    cost: { pips: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'minion',
    text: 'Bound Form. The drake grown into its full shape. Blocks sight through itself.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['BoundForm'],
    setupOnly: true,
    unit: {
      atk: 5,
      hp: BOSS_HP,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      sacrificeValue: 0,
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  boreas_bound: {
    id: 'boreas_bound',
    name: 'Boreas',
    cost: { pips: 0, marrow: 0 },
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
      atk: 2,
      hp: PACT_HP,
      mov: 2,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'caster',
      sacrificeValue: 0,
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
