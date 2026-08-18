/**
 * Scenery the encounter places, rather than cards anyone plays.
 *
 * These are obstacles in the engine's sense — they hold a tile, they can be broken by
 * either side, and they are not in any deck or collection. What distinguishes them from
 * a Stone Barricade is that breaking them *does something*, which turns a piece of
 * furniture into a reason to fight over ground.
 */

import type { CardDef } from '../../types/cards.js';

/** Shared shape for the scenery an encounter lays down. Never drawn, never owned. */
function scenery(id: string, name: string, text: string, hp: number): CardDef {
  return {
    id,
    name,
    cost: 0,
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text,
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: [],
    setupOnly: true,
    obstacleHp: hp,
  };
}

export const TERRAIN_CARDS: Record<string, CardDef> = {
  /**
   * The pieces `EncounterDef.terrain` places. They exist as definitions so that the
   * rules about them — what breaking one leaves behind — live with the thing itself
   * rather than as a special case buried in the death path.
   */
  terrain_wall: {
    ...scenery('terrain_wall', 'Rubble Wall', 'Blocks movement and sight until broken.', 8),
    // Masonry does not vanish when it falls.
    leavesRubble: true,
  },
  terrain_cover: scenery(
    'terrain_cover',
    'Bramble Screen',
    'Blocks sight but not movement. Units may stand in it.',
    4,
  ),

  /**
   * A geode is one hit and a decision. It is worth two Marrow to whoever cracks it,
   * which is most of a card — enough that both sides want it early, and early is exactly
   * when neither can spare the tempo. It lands on neutral ground for that reason: taking
   * one means walking somewhere you would rather not stand yet.
   */
  marrow_geode: {
    id: 'marrow_geode',
    name: 'Marrow Geode',
    cost: 0,
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Volatile. Breaking it extracts 2 Marrow for the attacker.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: [],
    setupOnly: true,
    obstacleHp: 1,
    onDestroyReward: { marrow: 2 },
  },

  /**
   * Crystals are traps you set off rather than pick up. Two HP is enough that breaking
   * one is a choice, and the blast catches everything in the nine tiles around it — both
   * armies — so the question is never "should I shoot it" but "who is standing there".
   *
   * Cryo freezes: the tempo swing is enormous and lands on whoever is closest.
   */
  cryo_crystal: {
    ...scenery(
      'cryo_crystal',
      'Cryo-Crystal',
      'Volatile. Shattering it freezes every unit around it, friend and foe.',
      2,
    ),
    school: 'frost',
    obstacleDeath: { status: 'freeze', stacks: 1 },
  },

  /** Magma burns instead, which is slower but sets up a reaction on anything Chilled. */
  magma_crystal: {
    ...scenery(
      'magma_crystal',
      'Magma Barrel',
      'Volatile. Shattering it sets fire to every unit around it, friend and foe.',
      2,
    ),
    school: 'pyre',
    obstacleDeath: { status: 'burn', stacks: 2 },
  },
};
