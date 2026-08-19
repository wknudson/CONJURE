/**
 * The Dusk set: bodies as fuel.
 *
 * Dusk's existing cards already sit around this idea — Dark Tithe spends a minion for
 * armour and Marrow, Soul Splinter pays out when its host dies — but nothing in the school
 * was ever *worth* sacrificing. The Marrow Wisp is Arcane, and it is a better card in
 * every other respect.
 *
 * This is the body you plant in order to spend it.
 */

import type { CardDef } from '../../types/cards.js';

export const DUSK_CARDS: Record<string, CardDef> = {
  /**
   * A Wisp's worth of Marrow on a body that cannot chase anything.
   *
   * Two attack on two health with no movement at all: it threatens exactly the tile it was
   * planted beside and nothing else, forever. Deploying it near the fight is committing to
   * the fight being there.
   *
   * Dormant is the real price, and it is a stricter one than it looks. `canAct` refuses
   * anything summoned this turn without Haste, and the sacrifice command asks `canAct` —
   * so a Ghoul **cannot be cashed in on the turn it lands**. One Pip does not buy two
   * Marrow now; it buys two Marrow next turn, if the thing is still standing. A board that
   * can reach it has a turn in which to answer.
   */
  ash_ghoul: {
    id: 'ash_ghoul',
    name: 'Ash-Ghoul',
    cost: { pips: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Dormant: cannot act the turn it is summoned, and so cannot be sacrificed until the next one. Cannot move, ever. Sacrifice: extracts +2 Marrow.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'ash_ghoul' },
    keywords: ['Dormant', 'Sacrifice'],
    unit: {
      atk: 2,
      hp: 2,
      mov: 0,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // The whole point of the card, and the same number the Marrow Wisp pays — bought
      // here with immobility and a turn of waiting rather than with a Pip and mobility.
      sacrificeValue: 2,
      // Unreachable without the Escalate keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
