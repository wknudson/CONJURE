/**
 * Hybrids: what comes off the splicing bench.
 *
 * Authored as ordinary cards rather than assembled at runtime, deliberately. A hybrid
 * built by merging two `CardDef`s on the fly would be a second, weaker card parser living
 * beside the real one — and the first time a splice produced an effect tree nothing else
 * in the game could read, it would fail in combat rather than at the bench.
 *
 * So the Forge does not *make* a card. It looks one up, and charges for the lookup. Every
 * hybrid here is a card the engine already knows how to resolve, which means a splice can
 * never produce something unplayable.
 *
 * Each one is named for the elemental reaction it forces: the reactions already exist in
 * `data/reactions.ts`, and a hybrid that applied a status with no reaction behind it would
 * be a promise the combat engine could not keep.
 */

import type { CardDef } from '../../types/cards.js';

export const HYBRID_CARDS: Record<string, CardDef> = {
  /**
   * Pyre pressed with a Frost core.
   *
   * Fire that arrives on something already frozen, in one card. It applies the frost
   * first and the flame second, so the Vaporize reaction fires off its own setup rather
   * than needing a second caster — which is the whole point of paying for a hybrid.
   */
  vaporize_blast: {
    id: 'vaporize_blast',
    name: 'Vaporize Blast',
    cost: { pips: 2, marrow: 1 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Chill the target, then boil it: 1 frost damage, then 3 fire damage. The steam blinds what is left.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 1, dtype: 'frost', area: { shape: 'target' } },
        { op: 'damage', amount: 3, dtype: 'fire', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
    spliceOnly: true,
  },

  /**
   * Pyre pressed with a Surge core.
   *
   * The charge lands first so the flame has something to argue with. Cheaper in Marrow
   * than the Frost hybrid and shorter-ranged: this one is meant to be thrown into a
   * crowd you are already standing near.
   */
  superconduct_strike: {
    id: 'superconduct_strike',
    name: 'Superconduct Strike',
    cost: { pips: 2, marrow: 1 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Charge the target, then set it alight: 2 shock damage, then 2 fire damage, and the arc jumps.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 2, dtype: 'shock', area: { shape: 'target' } },
        { op: 'damage', amount: 2, dtype: 'fire', area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    spliceOnly: true,
  },
};
