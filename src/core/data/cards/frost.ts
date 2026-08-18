/**
 * The Frost mini-set (Module 1 §2).
 *
 * Frost is the control school: it does not out-damage Pyre, it takes away the enemy's
 * turn. Chill stacks toward a Freeze, Brittle makes the next blow land harder, and Ice
 * Barricade rewrites the board's sightlines.
 *
 * Every card here is a setup piece for a reaction: Chill feeds Vaporize, Freeze feeds
 * Shatter. On its own the set is deliberately a little underpowered — it pays off when
 * paired with the Pyre starter deck.
 */

import type { CardDef } from '../../types/cards.js';

export const FROST_CARDS: Record<string, CardDef> = {
  glacial_spike: {
    id: 'glacial_spike',
    name: 'Glacial Spike',
    cost: { pips: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deal 3 frost damage to a unit and apply Chill 1. Chill 3 freezes a unit solid.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 3, dtype: 'frost', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    // Boreas' reach: the longest in the school, and the reason it can hold the back line.
    range: 5,
    needsLoS: true,
  },

  frost_nova: {
    id: 'frost_nova',
    name: 'Frost Nova',
    cost: { pips: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Apply Chill 1 to every unit adjacent to the target tile, and 1 frost damage.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 1, dtype: 'frost', area: { shape: 'adjacent8' } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    // A burst, thrown short: the Companion has to commit forward to catch a cluster.
    range: 3,
    needsLoS: true,
  },

  brittle_touch: {
    id: 'brittle_touch',
    name: 'Rime Touch',
    cost: { pips: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Apply Brittle 2 to a unit. A Brittle target takes +2 damage from every hit.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'applyStatus', status: 'brittle', stacks: 2, area: { shape: 'target' } },
    keywords: [],
    // A touch, and priced like one: the Companion must be nearly on top of the target.
    range: 2,
    needsLoS: true,
  },

  flash_freeze: {
    id: 'flash_freeze',
    name: 'Flash Freeze',
    cost: { pips: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Freeze a unit for 1 turn. A Frozen unit cannot move or attack — and shatters if struck.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'applyStatus', status: 'freeze', stacks: 1, area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  ice_barricade: {
    id: 'ice_barricade',
    name: 'Ice Barricade',
    cost: { pips: 1, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raise a wall of ice. Blocks movement and line of sight until it is broken.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'ice_barricade' },
    obstacleHp: 5,
    leavesRubble: true,
    keywords: [],
  },

  rimeguard: {
    id: 'rimeguard',
    name: 'Rimeguard',
    cost: { pips: 2, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it. Escalate: +1 HP.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'rimeguard' },
    keywords: ['Guardian', 'Escalate'],
    unit: {
      atk: 1,
      hp: 7,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      sacrificeValue: 1,
      escalationBonus: { atk: 0, hp: 1 },
    },
  },
};

/**
 * Boreas' deck: the Pyre starter's Hero cards with the Companion slots swapped for Frost.
 * Built in `starter.ts` terms so the two companions play the same physical game and
 * differ only in what their Companion casts.
 */
export const FROST_COMPANION_CARDS = [
  'glacial_spike',
  'glacial_spike',
  'frost_nova',
  'brittle_touch',
  'flash_freeze',
] as const;
