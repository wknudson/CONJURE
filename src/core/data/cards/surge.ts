/**
 * The Surge mini-set.
 *
 * Surge is the conduction school: modest damage on its own, and dangerous the moment the
 * ground is wet. Its whole identity is the weather interaction — a Surge deck brought to
 * a clear sky is playing a slightly weak Arcane deck, and the same deck in a downpour
 * hits everything standing next to what it aimed at.
 *
 * Voltara arrived with this wave, so the school finally has a body to cast from and the
 * set can hold Companion cards as well as Hero ones. `arc_lash` stays a Hero card: it was
 * authored to be castable without a Surge companion and there is no reason to take that
 * away from the two decks that can already run it.
 *
 * Surge is also the school the Reaction matrix leans on hardest. `charged` does nothing
 * by itself — it is the setup half of two different reactions, and nothing else in the
 * game applied it before Static Arc.
 */

import type { CardDef } from '../../types/cards.js';

export const SURGE_CARDS: Record<string, CardDef> = {
  /**
   * The charge-layer.
   *
   * Aimed at a tile rather than at a body, which is the established shape for anything
   * that radiates: `resolveArea` reads the chosen tile as its origin, and picking a unit
   * instead would centre the cross on the victim and hit their neighbours rather than
   * them. Everything orthogonally beside the tile is charged; the diagonals are the
   * restraint.
   *
   * The damage is `spell`, per the brief, and that has one consequence worth knowing: it
   * is an aligned type for Cinder Rune, so a Static Arc into a branded cluster detonates
   * the runes as well as charging the survivors. `shock` would not have.
   */
  static_arc: {
    id: 'static_arc',
    name: 'Static Arc',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 2 spell damage to everything orthogonally beside the target tile and leaves it Charged. Fire into a Charged target Overloads; frost Superconducts.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 2, dtype: 'spell', area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    // Thrown short, like every other burst: the Companion has to walk into the fight to
    // catch a cluster with it.
    range: 3,
    needsLoS: true,
  },

  /**
   * The glass cannon.
   *
   * Three attack on two health, moving three, able to act the turn it lands. It is a
   * thrown knife: it kills something wounded and then dies to anything that looks at it,
   * which is the correct body for a school whose spells want a target softened first.
   */
  voltaic_hound: {
    id: 'voltaic_hound',
    name: 'Voltaic Hound',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Can move and attack the turn it is deployed. Fast, vicious, and made of paper.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'voltaic_hound' },
    keywords: ['Haste'],
    unit: {
      atk: 3,
      hp: 2,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      sacrificeValue: 1,
      // Unreachable without the Escalate keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  arc_lash: {
    id: 'arc_lash',
    name: 'Arc Lash',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'spell',
    text: 'Deal 3 shock damage to a unit. In rain, the charge arcs for 1 to everything adjacent to it.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'damage', amount: 3, dtype: 'shock', area: { shape: 'target' } },
    keywords: [],
  },
};
