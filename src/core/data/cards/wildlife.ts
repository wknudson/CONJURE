/**
 * Things on the board that belong to neither army.
 *
 * Both are placed by encounters and command themselves. They exist to make the board a
 * place rather than an arena — something is already living here, and it has its own
 * reasons.
 */

import type { CardDef } from '../../types/cards.js';

export const WILDLIFE_CARDS: Record<string, CardDef> = {
  /**
   * The scavenger competes for attention rather than for ground. It never fights, it is
   * faster than anything that wants to catch it, and it is carrying enough to be worth
   * the detour — so the cost it imposes is entirely in the turns spent chasing it.
   */
  gilded_scavenger: {
    id: 'gilded_scavenger',
    name: 'Gilded Scavenger',
    cost: 0,
    school: 'neutral',
    source: 'hero',
    kind: 'minion',
    text: 'Feral. Never attacks. Flees for the edge, and is gone if it reaches one. Kill it for its purse.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['Feral', 'Haste'],
    setupOnly: true,
    bounty: { sparks: 3 },
    unit: {
      atk: 0,
      hp: 6,
      // Faster than anything chasing it: catching one has to cost a real commitment.
      mov: 4,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      sacrificeValue: 0,
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * A wolf is a moving piece of terrain with opinions. It goes for whatever is nearest
   * without caring whose it is, which turns the space around it into ground both armies
   * would rather the other one held.
   */
  ridge_wolf: {
    id: 'ridge_wolf',
    name: 'Ridge Wolf',
    cost: 0,
    school: 'neutral',
    source: 'hero',
    kind: 'minion',
    text: 'Feral. Hunts whatever is closest, on either side. Anyone may put it down.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: ['Feral'],
    setupOnly: true,
    unit: {
      atk: 3,
      hp: 5,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      sacrificeValue: 0,
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
