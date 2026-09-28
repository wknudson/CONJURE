/**
 * Frost's third shelf: six common spells and constructs, and the signature cards of its two
 * wild bloodlines.
 *
 * Frost's shelf was the deepest of the elemental six, and still split between two species by
 * a four-card `omit` each, so a Boreas and a Saltglass Seal drew most of the same book. The
 * commons below fill the shapes it lacked — a cheap Brittle, a 2x2 of sleet, ward-with-teeth
 * armour for an ally, a snowdrift that bites when broken, a wide burst, and a line that
 * shoves as it chills — and the signatures give each bloodline its own.
 *
 * **Boreas** keeps the lockdown: a maul that stacks two Chill at once, a roar that chills a
 * cross, and an ice den that freezes whatever breaks it. **The Seal** keeps the harbour: sea
 * fog, a drifting floe that carries what stands on it, and the dive that breaks ice.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;
const ANY_2X2 = { kind: 'emptyTile', zone: 'any', footprint: 2 } as const;

export const FROST_SHELF: Record<string, CardDef> = {
  // ==================================================================== commons

  /** The cheap Brittle. Brittle Touch's job for the price of a strike, at half the stacks. */
  frostbite: {
    id: 'frostbite',
    name: 'Frostbite',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 frost damage to a unit and applies Brittle 1. A Brittle target takes +20 damage from every hit.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'frost', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Ten frost and a Chill on a 2x2. The cheap area Chill Frost had only in a 3x3 at three. */
  sleet: {
    id: 'sleet',
    name: 'Sleet',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 frost damage to a 2x2 block of tiles and Chills everything there.',
    target: ANY_2X2,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'frost', area: { shape: 'square', size: 2 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A ward that bites. Twenty armour on an ally, and a Chill on everything orthogonally
   * beside it — yours included, because rime does not ask whose shoulder it forms on. The
   * cross rather than all eight keeps it a ward and not a blast: it is the ally's four
   * shoulders that frost over.
   */
  hoar_glaze: {
    id: 'hoar_glaze',
    name: 'Hoar Glaze',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Grants an ally 20 Armor and Chills everything orthogonally beside it, yours included.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 4,
  },

  /** Cover that Chills whoever breaks through it, and whoever was standing beside it. */
  snowdrift: {
    id: 'snowdrift',
    name: 'Snowdrift',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises 30 HP of cover on an empty tile. When it breaks, every unit on or beside it is Chilled.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'snowdrift' },
    keywords: [],
    obstacleHp: 30,
    obstacleCover: true,
    obstacleDeath: { status: 'chill', stacks: 1 },
    range: 3,
    needsLoS: true,
  },

  /** A wide burst: twenty frost and a Chill in a cross around the target tile. */
  icicle_rain: {
    id: 'icicle_rain',
    name: 'Icicle Rain',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 frost damage in a cross around the target tile and Chills everything there.',
    target: ANY_TILE,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'frost', area: { shape: 'plus', radius: 1 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'plus', radius: 1 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A line of weather that pushes. Everything on it is shoved a tile away from the near end
   * and Chilled — a Frost card with a displacement in it, which the school had none of.
   */
  cold_front: {
    id: 'cold_front',
    name: 'Cold Front',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves everything on a 3-tile line 1 tile away from its near end and Chills it. Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'shoveArea', distance: 1, area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  // ============================================================ Boreas, the Bear

  /** Forty frost and two Chill at once: one more stack and the target is solid. */
  glacial_maul: {
    id: 'glacial_maul',
    name: 'Glacial Maul',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 frost damage to a unit and applies Chill 2. The third stack freezes it solid.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 40, dtype: 'frost', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'chill', stacks: 2, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['boreas'],
    range: 2,
    needsLoS: true,
  },

  /** A Chill on an enemy and everything in a cross around it, and ten frost for each. */
  numbing_roar: {
    id: 'numbing_roar',
    name: 'Numbing Roar',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 frost damage to an enemy and everything in a cross around it, and Chills them all.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'frost', area: { shape: 'plus', radius: 1 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'plus', radius: 1 } },
      ],
    },
    keywords: [],
    bloodline: ['boreas'],
    range: 3,
    needsLoS: true,
  },

  /**
   * A wall of packed ice that freezes whoever breaks it. Eighty health, so the freeze is the
   * price of the breach rather than a trap anybody walks into by accident.
   */
  den_of_ice: {
    id: 'den_of_ice',
    name: 'Den of Ice',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises an 80 HP wall of ice on an empty tile. When it breaks, every unit on or beside it is Frozen.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'den_of_ice' },
    keywords: [],
    obstacleHp: 80,
    obstacleDeath: { status: 'freeze', stacks: 1 },
    leavesRubble: true,
    bloodline: ['boreas'],
    range: 3,
    needsLoS: true,
  },

  // =========================================================== the Saltglass Seal

  /** Harbour fog on a 2x2, cheaper than Whiteout because it does not Chill. */
  sea_fog: {
    id: 'sea_fog',
    name: 'Sea Fog',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Fogs a 2x2 block of tiles for 2 turns, blocking ranged line of sight through them.',
    target: ANY_2X2,
    effect: { op: 'spawnHazard', kind: 'steam_fog', turns: 2, area: { shape: 'square', size: 2 } },
    keywords: [],
    bloodline: ['seal'],
    range: 4,
    needsLoS: true,
  },

  /**
   * Moving water with ice on it. The current carries what stands on it a tile at the end of
   * the round, and the Chill makes sure it arrives slower than it left.
   */
  tidal_floe: {
    id: 'tidal_floe',
    name: 'Tidal Floe',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Turns a 2x2 block of tiles into a drifting current for 2 turns and Chills everything there. The current carries what stands on it 1 tile each round.',
    target: ANY_2X2,
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnHazard', kind: 'current', turns: 2, area: { shape: 'square', size: 2 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    bloodline: ['seal'],
    range: 4,
    needsLoS: true,
  },

  /**
   * The Seal breaking its own ice. Against a Frozen target, forty impact and a shove; against
   * anything else, twenty frost. The Seal does not freeze well — it does not have to.
   */
  icebreaker_dive: {
    id: 'icebreaker_dive',
    name: 'Icebreaker Dive',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Frozen unit, deals 40 impact damage and shoves it 1 tile away. Otherwise, 20 frost damage.',
    target: ENEMY_UNIT,
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'freeze' },
      then: {
        op: 'seq',
        effects: [
          { op: 'damage', amount: 40, dtype: 'impact', area: { shape: 'target' } },
          { op: 'push', distance: 1 },
        ],
      },
      otherwise: { op: 'damage', amount: 20, dtype: 'frost', area: { shape: 'target' } },
    },
    keywords: [],
    bloodline: ['seal'],
    range: 3,
    needsLoS: true,
  },
};
