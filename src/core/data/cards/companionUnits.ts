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

export const COMPANION_UNIT_CARDS: Record<string, CardDef> = {
  ignis_bound: {
    id: 'ignis_bound',
    name: 'Ignis',
    cost: 0,
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

  boreas_bound: {
    id: 'boreas_bound',
    name: 'Boreas',
    cost: 0,
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
