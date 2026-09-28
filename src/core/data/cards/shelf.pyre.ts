/**
 * Pyre's third shelf: eight common spells and constructs, and the signature cards of its
 * two wild bloodlines.
 *
 * Pyre had the thinnest pure shelf of the six — six Spells and two Constructs a beast could
 * draft, once the Auras, the fusions and the engine-dealt crystal are taken out — and its
 * two species split that shelf with a four-card `omit` each. An Ignis and a Flue Salamander
 * were therefore drawing eight cards out of the same eleven, and a player who caught both
 * could not have told their books apart. This file is the fix in both directions: the
 * commons make the shelf deep enough that two draws of it differ, and the signatures give
 * each bloodline cards the other can never learn.
 *
 * ## The commons
 *
 * The shapes the school was missing, not more of the shapes it had. A zero-cost igniter, so
 * the Burn payoffs have something cheap to follow; a single-target bolt with reach; a cone
 * at close range; a wall-breaker; a payoff that grows with a Burn already on the target, and
 * one that spreads it; a 3x3 that sets the ground's occupants alight; and a construct that
 * is cover until it is broken and fire after.
 *
 * ## The signatures
 *
 * `bloodline` names the one species that may draft each, and each species' first Grimoire
 * slot is dealt from its own. **Ignis** keeps the Drake's identity — Marks and cascades —
 * with a spell that brands its target, one that sets every Mark on the board off at once,
 * and a roar that sets a wide cross alight. **The Salamander** keeps the chimney's: ground
 * that burns, a line that drags its occupants back along it, and burning ground laid in a
 * line behind it.
 *
 * Signatures sit at or below the school's median price on purpose. A card only one beast can
 * draft is a card nobody can answer by building around, and the one thing that must never be
 * true of a bloodline is that its signature is simply better than the common shelf.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;

export const PYRE_SHELF: Record<string, CardDef> = {
  // ==================================================================== commons

  /**
   * The match. Free, and nothing but a Burn — which is exactly what Stoke, Immolate and
   * Flashover want on their target first.
   */
  kindling: {
    id: 'kindling',
    name: 'Kindling',
    cost: { bones: 0, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Sets a unit alight (Burn 1).',
    target: ENEMY_UNIT,
    effect: { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** The plain bolt, with reach. Pyre had no single-target damage past four tiles. */
  molten_shot: {
    id: 'molten_shot',
    name: 'Molten Shot',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 fire damage to a unit.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'target' } },
    keywords: [],
    range: 5,
    needsLoS: true,
  },

  /**
   * Cinder Gale at arm's length: a shorter cone and a cheaper one, for a beast that has
   * walked into the melee rather than stood back from it.
   */
  fire_breath: {
    id: 'fire_breath',
    name: 'Fire Breath',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage in a 2-deep cone and sets everything caught alight (Burn 1).',
    target: { kind: 'line', length: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'cone', depth: 2 } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'cone', depth: 2 } },
      ],
    },
    keywords: [],
    range: 2,
    needsLoS: true,
  },

  /** Fire that can hit a wall. Twenty on anything, obstacles included. */
  scorch: {
    id: 'scorch',
    name: 'Scorch',
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage to a unit or obstacle.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The big single-target finisher, and a reason to have lit the target first.
   *
   * Forty on anything; sixty on something already Burning. The Burn is not consumed — this is
   * a payoff, not a detonation, and a target left alight is still a target for Stoke.
   */
  immolate: {
    id: 'immolate',
    name: 'Immolate',
    cost: { bones: 3, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 fire damage to a unit, or 60 if it is already Burning.',
    target: ENEMY_UNIT,
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'burn' },
      then: { op: 'damage', amount: 60, dtype: 'fire', area: { shape: 'target' } },
      otherwise: { op: 'damage', amount: 40, dtype: 'fire', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * One burning body setting off the ones around it.
   *
   * Aimed at a Burning enemy it is thirty in a cross, the target included, so a bunched line
   * that one Kindling touched is a line that burns together. Aimed at anything else, ten.
   */
  flashover: {
    id: 'flashover',
    name: 'Flashover',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Burning unit, deals 30 fire damage to it and everything in a cross around it. Otherwise only 10.',
    target: ENEMY_UNIT,
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'burn' },
      then: { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'plus', radius: 1 } },
      otherwise: { op: 'damage', amount: 10, dtype: 'fire', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Burn on everything in a 3x3, and no damage. The setup at scale, priced below Emberfall
   * because it lights the bodies and not the ground they stand on.
   */
  wildfire: {
    id: 'wildfire',
    name: 'Wildfire',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Sets every unit in a 3x3 around the target tile alight (Burn 1), yours included. No damage.',
    target: ANY_TILE,
    effect: { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'square', size: 3 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Cover that turns into fire.
   *
   * Thirty health of iron basket a body can stand in and shoot from; broken, it spills its
   * coals over everything on and beside it, both sides, the rule every crystal follows.
   */
  brazier: {
    id: 'brazier',
    name: 'Brazier',
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises 30 HP of cover on an empty tile. When it breaks it spills its coals: 20 damage and Burn 1 to every unit on or beside it.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'brazier' },
    keywords: [],
    obstacleHp: 30,
    obstacleCover: true,
    obstacleDeath: { status: 'burn', stacks: 1, damage: 20 },
    range: 3,
    needsLoS: true,
  },

  // ============================================================ Ignis, the Drake

  /**
   * The Drake's brand. Ten fire and a Cinder Mark on whatever it hits — the Mark the Hero
   * half has to spend a card to lay, laid by the beast as it opens.
   */
  drakes_brand: {
    id: 'drakes_brand',
    name: "Drake's Brand",
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 fire damage to a unit or obstacle and brands it with a Cinder Mark.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'fire', area: { shape: 'target' } },
        { op: 'attachMark', mark: 'cinder_mark' },
      ],
    },
    keywords: [],
    bloodline: ['ignis'],
    range: 4,
    needsLoS: true,
  },

  /**
   * The cascade, without the Core's premium.
   *
   * Cataclysmic Core sets every Mark off for twenty extra at five Bones and Power Tier. This
   * sets them off as they are for three, which is the Drake's whole plan written as one card:
   * brand the board, then light it.
   */
  ember_cascade: {
    id: 'ember_cascade',
    name: 'Ember Cascade',
    cost: { bones: 3, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Sets off every Mark on the board at once.',
    target: { kind: 'global' },
    effect: { op: 'detonateAllMarks', bonusDamage: 0 },
    keywords: [],
    bloodline: ['ignis'],
  },

  /**
   * A wide cross of Burn from a beast that wants to be surrounded by it. No damage: the
   * roar is the setup, and the Drake's cascade is what cashes it.
   */
  drakes_roar: {
    id: 'drakes_roar',
    name: "Drake's Roar",
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Sets every unit in a wide cross around the target tile alight (Burn 1), two tiles out each way.',
    target: ANY_TILE,
    effect: { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'plus', radius: 2 } },
    keywords: [],
    bloodline: ['ignis'],
    range: 3,
    needsLoS: true,
  },

  // ======================================================= the Flue Salamander

  /** Burning ground in a cross, cheap. Where the Salamander has been, the floor is still hot. */
  smoulder: {
    id: 'smoulder',
    name: 'Smoulder',
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Sets the ground burning in a cross around the target tile for 2 turns. Anything starting its turn there catches fire.',
    target: ANY_TILE,
    effect: { op: 'spawnHazard', kind: 'burning', turns: 2, area: { shape: 'plus', radius: 1 } },
    keywords: [],
    bloodline: ['salamander'],
    range: 3,
    needsLoS: true,
  },

  /**
   * The chimney's draw, down a line: everything on it dragged a tile toward the near end and
   * lit on the way. Aimed so the near end is burning ground, it is a card that puts the enemy
   * on the fire.
   */
  ductwork_drag: {
    id: 'ductwork_drag',
    name: 'Ductwork Drag',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Drags everything on a 3-tile line 1 tile toward its near end and sets it alight (Burn 1).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'pullArea', distance: 1, area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['salamander'],
    range: 4,
    needsLoS: true,
  },

  /** A fire break, backwards: a line of burning ground and ten fire along it. */
  backburn: {
    id: 'backburn',
    name: 'Backburn',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 fire damage down a 3-tile line and leaves it burning for 2 turns.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'fire', area: { shape: 'line', length: 3 } },
        { op: 'spawnHazard', kind: 'burning', turns: 2, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['salamander'],
    range: 4,
    needsLoS: true,
  },

  // ======================================================== the Ashwing Phoenix

  /** A fallen body stood back up where it fell, at forty per cent. The Phoenix's own trick, lent. */
  ash_rebirth: {
    id: 'ash_rebirth',
    name: 'Ash Rebirth',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Raises a fallen Vanguard on the exact tile it fell, at 40% of its health. Nothing may be standing there.',
    target: { kind: 'fallen', site: 'pyre' },
    effect: { op: 'revive', site: 'pyre', hp: { mode: 'percent', percent: 40 } },
    keywords: [],
    bloodline: ['phoenix'],
  },

  /** Thirty fire on a unit, and everything beside it caught alight as the bird pulls up. */
  phoenix_dive: {
    id: 'phoenix_dive',
    name: 'Phoenix Dive',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 fire damage to a unit and sets everything adjacent to it alight (Burn 1).',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['phoenix'],
    range: 4,
    needsLoS: true,
  },

  /** A line of Burn from one beat of the wings. No damage. */
  wingbeat_embers: {
    id: 'wingbeat_embers',
    name: 'Wingbeat Embers',
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Fans embers down a 3-tile line, setting everything on it alight (Burn 1). No damage.',
    target: { kind: 'line', length: 3 },
    effect: { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'line', length: 3 } },
    keywords: [],
    bloodline: ['phoenix'],
    range: 4,
    needsLoS: true,
  },

  // ====================================================== the Cinderback Badger

  /** Twenty fire and a Burn on an adjacent enemy. The Badger bites. */
  burrow_strike: {
    id: 'burrow_strike',
    name: 'Burrow Strike',
    cost: { bones: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage to an adjacent enemy and sets it alight (Burn 1).',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['badger'],
    range: 1,
  },

  /** A sett full of smoke: fog on a 2x2 for two turns, and a Burn on whoever is in it. */
  smoke_sett: {
    id: 'smoke_sett',
    name: 'Smoke Sett',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Fills a 2x2 block with smoke for 2 turns, blocking ranged line of sight, and sets everything there alight (Burn 1).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnHazard', kind: 'steam_fog', turns: 2, area: { shape: 'square', size: 2 } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    bloodline: ['badger'],
    range: 4,
    needsLoS: true,
  },

  /** Twenty fire to everything around the Badger, friend and foe: the cinders on its back. */
  cinderback_bristle: {
    id: 'cinderback_bristle',
    name: 'Cinderback Bristle',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage to everything adjacent to the caster, yours included.',
    target: { kind: 'none' },
    effect: { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'adjacent8' } },
    keywords: [],
    bloodline: ['badger'],
    range: 1,
  },

  // ================================================== hybrid signatures (Pyre)
  //
  // One apiece for the hybrids filed here: a card of this school that carries its other
  // parent's element on it, so a hybrid's book opens on the seam it is made of.

  /** The Chimera: fire from one head and frost from the other, in one breath. */
  twin_breath: {
    id: 'twin_breath',
    name: "Twin Breath",
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage in a 2-deep cone and Chills everything caught.',
    target: { kind: 'line', length: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'cone', depth: 2 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'cone', depth: 2 } },
      ],
    },
    keywords: [],
    bloodline: ['chimera'],
    range: 2,
    needsLoS: true,
  },

  /** The Cinder Shade: soot that rots as it burns. */
  lampblack: {
    id: 'lampblack',
    name: "Lampblack",
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 decay damage to a unit and sets it alight (Burn 1).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'decay', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['shade'],
    range: 4,
    needsLoS: true,
  },
};
