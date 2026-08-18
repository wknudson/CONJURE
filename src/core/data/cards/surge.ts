/**
 * The Surge mini-set.
 *
 * Surge is the conduction school: modest damage on its own, and dangerous the moment the
 * ground is wet. Its whole identity is the weather interaction — a Surge deck brought to
 * a clear sky is playing a slightly weak Arcane deck, and the same deck in a downpour
 * hits everything standing next to what it aimed at.
 *
 * A Hero card rather than a Companion one: there is no Surge companion yet, and a card
 * only a nonexistent companion could cast would be unplayable rather than merely rare.
 */

import type { CardDef } from '../../types/cards.js';

export const SURGE_CARDS: Record<string, CardDef> = {
  arc_lash: {
    id: 'arc_lash',
    name: 'Arc Lash',
    cost: 2,
    school: 'surge',
    source: 'hero',
    kind: 'spell',
    text: 'Deal 3 shock damage to a unit. In rain, the charge arcs for 1 to everything adjacent to it.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'damage', amount: 3, dtype: 'shock', area: { shape: 'target' } },
    keywords: [],
  },
};
