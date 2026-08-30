/**
 * The three ways of fighting at a distance.
 *
 * Long reach on a big board is simply strong unless it costs something specific, so each
 * of these buys its range with a weakness a player can play around — and, just as
 * importantly, one the player can *see*: a body in the way, a step closer, a wall.
 */

import type { CardDef } from '../../types/cards.js';

export const RANGED_CARDS: Record<string, CardDef> = {
  /**
   * Unlimited reach, down a straight line only. It threatens whole ranks and files at
   * once and nothing at all off them, so the counter is a single sidestep — or anything
   * at all standing on the line, since its shot is stopped by the first thing it meets.
   */
  longshot_stalker: {
    id: 'longshot_stalker',
    name: 'Longshot Stalker',
    cost: { bones: 3, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Fires any distance, but only along a straight line. Anything in the way stops the shot.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'longshot_stalker' },
    keywords: ['Growth'],
    unit: {
      atk: 30,
      hp: 30,
      mov: 2,
      rangeMin: 1,
      // Effectively the whole board. Deliberately a large number rather than Infinity,
      // which JSON cannot carry -- it would serialise as null and corrupt the state hash.
      rangeMax: 99,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 10, hp: 0 },
      attackProfile: 'lineOnly',
    },
  },

  /**
   * Lobs over walls, Guardians and Behemoths alike, which makes cover worthless against
   * it — but it cannot depress its aim. Walking into its face is the entire counter, and
   * that is a real cost, because getting there is what it was shelling you to prevent.
   */
  cinder_lobber: {
    id: 'cinder_lobber',
    name: 'Cinder Lobber',
    cost: { bones: 3, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Shoots over anything, needing no line of sight. Cannot hit what is adjacent.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'cinder_lobber' },
    keywords: ['Growth'],
    unit: {
      atk: 20,
      hp: 50,
      mov: 2,
      // The blind spot is the price of ignoring sight entirely.
      rangeMin: 2,
      rangeMax: 4,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 10, hp: 0 },
      attackProfile: 'arcing',
    },
  },

  /**
   * The hardest hitter at range, bolted to the floor. It cannot answer a bad placement,
   * so where it lands is the whole decision — and shoving it, or simply walling its
   * sightline, beats it without ever trading a blow.
   */
  arc_turret: {
    id: 'arc_turret',
    name: 'Arc Turret',
    cost: { bones: 4, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Hits hard at long range and never moves. Blocking its line, or shoving it, is the answer.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'arc_turret' },
    keywords: ['Growth'],
    unit: {
      atk: 50,
      hp: 60,
      mov: 0,
      rangeMin: 1,
      rangeMax: 5,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 10 },
    },
  },
};
