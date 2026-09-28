/**
 * Surge's third shelf: six common spells and constructs, and the signature cards of its two
 * wild bloodlines.
 *
 * Surge is a school of setups — shock leaves Charge, and Charge is what the next card pays
 * off — and its shelf had the setups and the big payoffs but little between: nothing free,
 * nothing that drew, nothing that moved the enemy. The commons are those: a zero-cost spark,
 * a card that charges and draws, a payoff that goes through armour, a thunderclap that
 * shoves, a burst, and a capacitor bank that stuns whoever breaks it.
 *
 * **Voltara** keeps the footwork: a pounce that pays off Charge, a free bristle that charges
 * everything around the Lynx, and a chase that moves an ally and charges its neighbours.
 * **The Kudu** keeps what stands still: a draw that drags a crowd in toward one body, a
 * field of charge laid over a 3x3, and a spire that discharges when broken.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ALLY_UNIT = { kind: 'entity', side: 'ally', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;

export const SURGE_SHELF: Record<string, CardDef> = {
  // ==================================================================== commons

  /** Free, and ten shock: which leaves the target Charged for whatever comes next. */
  spark: {
    id: 'spark',
    name: 'Spark',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 shock damage to a unit, leaving it Charged.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** A charge and a card. The setup that pays for itself. */
  static_insight: {
    id: 'static_insight',
    name: 'Static Insight',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 shock damage to a unit, leaving it Charged. Draw 1 card.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'target' } },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The payoff that ignores plate. Thirty through any armour against a Charged unit; ten
   * shock against anything else, which charges it for the next one.
   */
  short_circuit: {
    id: 'short_circuit',
    name: 'Short Circuit',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Charged unit, deals 30 damage through any armor. Otherwise, 10 shock damage.',
    target: ENEMY_UNIT,
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'charged' },
      then: { op: 'damage', amount: 30, dtype: 'true', area: { shape: 'target' } },
      otherwise: { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Ten shock to everything around a tile, then everything shoved a tile away from it. */
  thunderclap: {
    id: 'thunderclap',
    name: 'Thunderclap',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 shock damage to everything adjacent to the target tile and shoves it 1 tile away. Triggers standard Collision Damage (30 / 20).',
    target: ANY_TILE,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'adjacent8' } },
        { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /** Thirty shock in a cross around a tile: Tempest Break's reach, narrower and the same price. */
  ball_lightning: {
    id: 'ball_lightning',
    name: 'Ball Lightning',
    cost: { bones: 3, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 shock damage in a cross around the target tile, leaving every survivor Charged.',
    target: ANY_TILE,
    effect: { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'plus', radius: 1 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A bank of cells that discharges when broken: twenty and a Stun to everything on or
   * beside it, both sides. Cheap because it does nothing until somebody hits it.
   */
  capacitor_bank: {
    id: 'capacitor_bank',
    name: 'Capacitor Bank',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 30 HP capacitor bank on an empty tile. When it breaks it discharges: 20 damage and Stun to every unit on or beside it.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'capacitor_bank' },
    keywords: [],
    obstacleHp: 30,
    obstacleDeath: { status: 'stun', stacks: 1, damage: 20 },
    range: 3,
    needsLoS: true,
  },

  // ========================================================== Voltara, the Lynx

  /** Forty against a Charged unit, twenty against anything else. The Lynx cashes in. */
  storm_pounce: {
    id: 'storm_pounce',
    name: 'Storm Pounce',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 shock damage to a Charged unit, or 20 to anything else.',
    target: ENEMY_UNIT,
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'charged' },
      then: { op: 'damage', amount: 40, dtype: 'shock', area: { shape: 'target' } },
      otherwise: { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
    },
    keywords: [],
    bloodline: ['voltara'],
    range: 3,
    needsLoS: true,
  },

  /** Free: everything beside the Lynx is left Charged, and nothing is hurt. */
  static_bristle: {
    id: 'static_bristle',
    name: 'Static Bristle',
    cost: { bones: 0, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Leaves everything adjacent to the caster Charged. No damage.',
    target: { kind: 'none' },
    effect: { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacent8' } },
    keywords: [],
    bloodline: ['voltara'],
    range: 1,
  },

  /** An ally a tile quicker, and everything beside it left Charged — Arcing Step, spread outward. */
  crackle_chase: {
    id: 'crackle_chase',
    name: 'Crackle Chase',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'An ally moves 1 further this turn, and everything adjacent to it is left Charged.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'fleet', stacks: 1, area: { shape: 'target' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['voltara'],
    range: 4,
  },

  // =========================================================== the Conduit Kudu

  /**
   * Everything around one enemy dragged a tile in toward it, and ten shock to the crowd that
   * arrives. The Kudu's horns, drawing the grid down into one body.
   */
  lightning_draw: {
    id: 'lightning_draw',
    name: 'Lightning Draw',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Drags everything within 2 tiles of an enemy 1 tile toward it, then deals 10 shock damage to everything adjacent to it.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'pullArea', distance: 1, area: { shape: 'square', size: 5 } },
        { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['kudu'],
    range: 4,
    needsLoS: true,
  },

  /** Charge on everything in a 3x3, and no damage. Induction's field, laid flat. */
  static_field: {
    id: 'static_field',
    name: 'Static Field',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Leaves every unit in a 3x3 around the target tile Charged, yours included. No damage.',
    target: ANY_TILE,
    effect: { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'square', size: 3 } },
    keywords: [],
    bloodline: ['kudu'],
    range: 4,
    needsLoS: true,
  },

  /** Sixty health of spire that earths forty into everything beside it when it falls. */
  storm_spire: {
    id: 'storm_spire',
    name: 'Storm Spire',
    cost: { bones: 3, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 60 HP spire on an empty tile. When it breaks it earths out: 40 damage to every unit on or beside it, leaving them Charged.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'storm_spire' },
    keywords: [],
    obstacleHp: 60,
    obstacleDeath: { status: 'charged', stacks: 1, damage: 40 },
    leavesRubble: true,
    bloodline: ['kudu'],
    range: 3,
    needsLoS: true,
  },

  // ============================================================ the Galvanic Eel

  /** Ten shock and an Entangle: the Eel wraps what it bites. */
  eel_coil: {
    id: 'eel_coil',
    name: 'Eel Coil',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 shock damage to a unit and Entangles it: it cannot move through its next turn.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['eel'],
    range: 2,
    needsLoS: true,
  },

  /** A live current on a 2x2, and ten shock to whatever is standing in it. */
  canal_current: {
    id: 'canal_current',
    name: 'Canal Current',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Turns a 2x2 block into a live current for 2 turns and deals 10 shock damage there. The current carries what stands on it 1 tile each round.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnHazard', kind: 'current', turns: 2, area: { shape: 'square', size: 2 } },
        { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    bloodline: ['eel'],
    range: 4,
    needsLoS: true,
  },

  /** Twenty shock at two tiles, for one Bone. */
  eel_jolt: {
    id: 'eel_jolt',
    name: 'Eel Jolt',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 shock damage to a unit, leaving it Charged.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
    keywords: [],
    bloodline: ['eel'],
    range: 2,
    needsLoS: true,
  },

  // ====================================================== the Sparkback Pangolin

  /** Twenty shock down a line, and everything on it shoved a tile along. */
  ball_roll: {
    id: 'ball_roll',
    name: 'Ball Roll',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 shock damage down a 3-tile line and shoves everything on it 1 tile away from its near end. Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'line', length: 3 } },
        { op: 'shoveArea', distance: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['pangolin'],
    range: 3,
    needsLoS: true,
  },

  /** Twenty armour on an ally, and everything beside it left Charged by the scales it sheds. */
  scale_shed: {
    id: 'scale_shed',
    name: 'Scale Shed',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 20 Armor, and leaves everything adjacent to it Charged.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['pangolin'],
    range: 4,
  },

  /** Your Hero plated for twenty, and everything beside the Pangolin left Charged. */
  static_curl: {
    id: 'static_curl',
    name: 'Static Curl',
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Your Hero gains 20 Armor, and everything adjacent to the caster is left Charged.',
    target: { kind: 'none' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    bloodline: ['pangolin'],
    range: 1,
  },

  // ================================================== hybrid signatures (Surge)
  //
  // One apiece for the hybrids filed here: a card of this school that carries its other
  // parent's element on it, so a hybrid's book opens on the seam it is made of.

  /** The Cinder-Wasp Swarm: a sting that sparks and burns. */
  swarm_sting: {
    id: 'swarm_sting',
    name: "Swarm Sting",
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 shock damage to a unit and sets it alight (Burn 1). Fire into a Charged target Overloads.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'shock', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['wasp'],
    range: 3,
    needsLoS: true,
  },

  /** The Volatile Geist: a cold touch that leaves the grid in you. */
  haunting_charge: {
    id: 'haunting_charge',
    name: "Haunting Charge",
    cost: { bones: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 decay damage to a unit and leaves it Charged.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'decay', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['geist'],
    range: 4,
    needsLoS: true,
  },

  /** The Thunderhawk: a stoop that ends in a strike. */
  lightning_dive: {
    id: 'lightning_dive',
    name: 'Lightning Dive',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 shock damage to a unit and sets it alight (Burn 1). Fire into a Charged target Overloads.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['thunderhawk'],
    range: 4,
    needsLoS: true,
  },
};
