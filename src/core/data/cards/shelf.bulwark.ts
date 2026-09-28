/**
 * Bulwark's third shelf: six common spells and constructs, and the signature cards of its
 * two wild bloodlines.
 *
 * Bulwark had armour, walls and shoves around a tile, but no line, no cone and no card
 * that drew, and its two species split the shelf with a four-card `omit` each. The commons
 * are the missing shapes: a fault line, a rockfall on a 2x2, a landslide cone, a stone
 * lance that pays off Brittle, a cheap rubble wall, and steady footing that draws.
 *
 * **Ferrum** keeps the ground that will not move: a vault door, a boar's charge, and a
 * tusk that throws an adjacent enemy two tiles. **The Quarry Ram** keeps the breaking of
 * the road: a blow that leaves rough ground behind it, a headbutt, and a rockslide that
 * shoves a whole line two tiles.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ALLY_UNIT = { kind: 'entity', side: 'ally', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;
const COLLISION = 'Triggers standard Collision Damage (30 / 20).';

export const BULWARK_SHELF: Record<string, CardDef> = {
  // ==================================================================== commons

  /** Twenty impact down a line, and everything on it shoved a tile away from its near end. */
  fault_line: {
    id: 'fault_line',
    name: 'Fault Line',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Deals 20 impact damage down a 3-tile line and shoves everything on it 1 tile away from its near end. ${COLLISION}`,
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'line', length: 3 } },
        { op: 'shoveArea', distance: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Thirty impact on a 2x2. Shatters anything Frozen, as any impact does. */
  rockfall: {
    id: 'rockfall',
    name: 'Rockfall',
    cost: { bones: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Drops 30 impact damage on a 2x2 block of tiles. Shatters anything Frozen.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'square', size: 2 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** A 3-deep cone of stone: twenty impact, and everything caught shoved a tile away. */
  landslide: {
    id: 'landslide',
    name: 'Landslide',
    cost: { bones: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Deals 20 impact damage in a widening 3-deep cone and shoves everything caught 1 tile away. ${COLLISION}`,
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'cone', depth: 3 } },
        { op: 'shoveArea', distance: 1, area: { shape: 'cone', depth: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Thirty impact with reach; fifty against a Brittle target. The Counterweight's payoff. */
  stone_lance: {
    id: 'stone_lance',
    name: 'Stone Lance',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 impact damage to a unit, or 50 if it is Brittle.',
    target: ENEMY_UNIT,
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'brittle' },
      then: { op: 'damage', amount: 50, dtype: 'impact', area: { shape: 'target' } },
      otherwise: { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'target' } },
    },
    keywords: [],
    range: 5,
    needsLoS: true,
  },

  /** Fifty health of stacked rubble for one Bone. It leaves rough ground when it goes. */
  rubble_wall: {
    id: 'rubble_wall',
    name: 'Rubble Wall',
    cost: { bones: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 50 HP wall of rubble on an empty tile. Blocks movement and line of sight, and leaves rough ground when it breaks.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'rubble_wall' },
    keywords: [],
    obstacleHp: 50,
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /** Twenty armour on an ally and a card. Bulwark's first draw. */
  steady_footing: {
    id: 'steady_footing',
    name: 'Steady Footing',
    cost: { bones: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 20 Armor. Draw 1 card.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
    range: 4,
  },

  // =============================================================== Ferrum, the Boar

  /** A hundred and twenty health of iron door. The vault the Boar is named for. */
  vault_door: {
    id: 'vault_door',
    name: 'Vault Door',
    cost: { bones: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 120 HP vault door on an empty tile. Blocks movement and line of sight, and leaves rough ground when it breaks.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'vault_door' },
    keywords: [],
    obstacleHp: 120,
    leavesRubble: true,
    bloodline: ['ferrum'],
    range: 3,
    needsLoS: true,
  },

  /** Thirty impact and two tiles of shove: the charge that ends against a wall. */
  boar_charge: {
    id: 'boar_charge',
    name: 'Boar Charge',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Deals 30 impact damage to a unit and shoves it 2 tiles away. ${COLLISION}`,
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'target' } },
        { op: 'push', distance: 2 },
      ],
    },
    keywords: [],
    bloodline: ['ferrum'],
    range: 3,
    needsLoS: true,
  },

  /** An adjacent enemy thrown two tiles, for one Bone. The Boar clears its own ground. */
  tusk_toss: {
    id: 'tusk_toss',
    name: 'Tusk Toss',
    cost: { bones: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Throws an adjacent enemy 2 tiles away. ${COLLISION}`,
    target: ENEMY_UNIT,
    effect: { op: 'push', distance: 2 },
    keywords: [],
    bloodline: ['ferrum'],
    range: 1,
  },

  // ============================================================ the Quarry Ram

  /** Thirty impact on a unit or obstacle, and rough ground around it for three turns. */
  ground_breaker: {
    id: 'ground_breaker',
    name: 'Ground Breaker',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 impact damage to a unit or obstacle and leaves rough ground in a cross around it for 3 turns.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'target' } },
        { op: 'spawnHazard', kind: 'rubble', turns: 3, area: { shape: 'plus', radius: 1 } },
      ],
    },
    keywords: [],
    bloodline: ['ram'],
    range: 3,
    needsLoS: true,
  },

  /** Twenty impact and a tile of shove on an adjacent enemy, for one Bone. */
  headbutt: {
    id: 'headbutt',
    name: 'Headbutt',
    cost: { bones: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Deals 20 impact damage to an adjacent enemy and shoves it 1 tile away. ${COLLISION}`,
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'target' } },
        { op: 'push', distance: 1 },
      ],
    },
    keywords: [],
    bloodline: ['ram'],
    range: 1,
  },

  /** A whole line shoved two tiles. The Ram does not walk the road; it moves it. */
  rockslide_run: {
    id: 'rockslide_run',
    name: 'Rockslide Run',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Shoves everything on a 3-tile line 2 tiles away from its near end. ${COLLISION}`,
    target: { kind: 'line', length: 3 },
    effect: { op: 'shoveArea', distance: 2, area: { shape: 'line', length: 3 } },
    keywords: [],
    bloodline: ['ram'],
    range: 4,
    needsLoS: true,
  },

  // ========================================================= the Ironhide Rhino

  /** Forty impact on an adjacent enemy. The horn. */
  horn_gore: {
    id: 'horn_gore',
    name: 'Horn Gore',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 impact damage to an adjacent enemy. Shatters anything Frozen.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 40, dtype: 'impact', area: { shape: 'target' } },
    keywords: [],
    bloodline: ['rhino'],
    range: 1,
  },

  /** Thirty impact down a line and everything on it shoved a tile along. The charge. */
  crushing_charge: {
    id: 'crushing_charge',
    name: 'Crushing Charge',
    cost: { bones: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: `Deals 30 impact damage down a 3-tile line and shoves everything on it 1 tile away from its near end. ${COLLISION}`,
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'line', length: 3 } },
        { op: 'shoveArea', distance: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['rhino'],
    range: 4,
    needsLoS: true,
  },

  /** Thirty armour on your Hero. The hide, lent. */
  iron_brace: {
    id: 'iron_brace',
    name: 'Iron Brace',
    cost: { bones: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Your Hero gains 30 Armor.',
    target: { kind: 'none' },
    effect: { op: 'grantArmor', amount: 30 },
    keywords: [],
    bloodline: ['rhino'],
  },

  // ========================================================== the Menhir Beetle

  /** A hundred health of standing stone that stuns what is beside it when it falls. */
  standing_stone: {
    id: 'standing_stone',
    name: 'Standing Stone',
    cost: { bones: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 100 HP standing stone on an empty tile. When it falls, every unit on or beside it takes 20 damage and is Stunned.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'standing_stone' },
    keywords: [],
    obstacleHp: 100,
    obstacleDeath: { status: 'stun', stacks: 1, damage: 20 },
    leavesRubble: true,
    bloodline: ['beetle'],
    range: 3,
    needsLoS: true,
  },

  /** Thirty impact on a unit or obstacle, at four tiles: the ball the Beetle rolls. */
  dung_ball: {
    id: 'dung_ball',
    name: 'Dung Ball',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 impact damage to a unit or obstacle.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'target' } },
    keywords: [],
    bloodline: ['beetle'],
    range: 4,
    needsLoS: true,
  },

  /** Twenty armour on your Hero, and a card. The shell closes. */
  hardened_shell: {
    id: 'hardened_shell',
    name: 'Hardened Shell',
    cost: { bones: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Your Hero gains 20 Armor. Draw 1 card.',
    target: { kind: 'none' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
    bloodline: ['beetle'],
  },

  // ================================================== hybrid signatures (Bulwark)
  //
  // One apiece for the hybrids filed here: a card of this school that carries its other
  // parent's element on it, so a hybrid's book opens on the seam it is made of.

  /** The Obsidian Tortoise: a shell that is still cooling. */
  magma_shell: {
    id: 'magma_shell',
    name: "Magma Shell",
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 30 Armor, and sets everything adjacent to it alight (Burn 1).',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 30 },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['tortoise'],
    range: 4,
  },

  /** The Glacial Juggernaut: a charge of packed ice. */
  glacier_ram: {
    id: 'glacier_ram',
    name: "Glacier Ram",
    cost: { bones: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 impact damage down a 3-tile line and Chills everything on it.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['juggernaut'],
    range: 4,
    needsLoS: true,
  },

  /** The Kinetic Dynamo: iron drawn to the coil. */
  magnet_pull: {
    id: 'magnet_pull',
    name: "Magnet Pull",
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Drags everything within 2 tiles of the target tile 1 tile toward it, then leaves everything in a cross around it Charged.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'pullArea', distance: 1, area: { shape: 'square', size: 5 } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'plus', radius: 1 } },
      ],
    },
    keywords: [],
    bloodline: ['dynamo'],
    range: 4,
    needsLoS: true,
  },

  /** The Bone Bastion Sovereign: plate grown out of the grave. */
  bone_bulwark: {
    id: 'bone_bulwark',
    name: "Bone Bulwark",
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Grants an ally 20 Armor, and leaves everything adjacent to it poisoned (Toxin 1).',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['sovereign'],
    range: 4,
  },

  /** The Bear: a paw that has been digging in the ossuary. */
  ossuary_maul: {
    id: 'ossuary_maul',
    name: 'Ossuary Maul',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 impact damage to an adjacent enemy and poisons it (Toxin 1).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['bear'],
    range: 1,
  },
};
