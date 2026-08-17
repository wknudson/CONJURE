/**
 * Scenery the encounter places, rather than cards anyone plays.
 *
 * These are obstacles in the engine's sense — they hold a tile, they can be broken by
 * either side, and they are not in any deck or collection. What distinguishes them from
 * a Stone Barricade is that breaking them *does something*, which turns a piece of
 * furniture into a reason to fight over ground.
 */

import type { CardDef } from '../../types/cards.js';

export const TERRAIN_CARDS: Record<string, CardDef> = {
  /**
   * A geode is one hit and a decision. It is worth two Sparks to whoever cracks it,
   * which is most of a card — enough that both sides want it early, and early is exactly
   * when neither can spare the tempo. It lands on neutral ground for that reason: taking
   * one means walking somewhere you would rather not stand yet.
   */
  spark_geode: {
    id: 'spark_geode',
    name: 'Spark Geode',
    cost: 0,
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Volatile. Breaking it grants the attacker 2 Sparks.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: [],
    setupOnly: true,
    obstacleHp: 1,
    onDestroyReward: { sparks: 2 },
  },
};
