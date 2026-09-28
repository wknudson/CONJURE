/**
 * Dusk's third shelf: six common spells and constructs, and the signature cards of its two
 * wild bloodlines.
 *
 * Dusk's shelf was all attrition — drains, tithes, rot through armour — with nothing plain:
 * no bolt, no wall, no way to move a body, no cone. The commons are those, plus a soul
 * rend that heals and a dread gaze that Exhausts an enemy the way a tithe exhausts a
 * friend. None of them leaves Brittle; the Charnel Pillar, Creeping Decay and Wither keep
 * that job (`expansion2.test.ts` pins the list).
 *
 * **Mortis** keeps the feeding: a feast that bleeds a friend for Marrow and health, a toll
 * on the weakest thing standing, and an offering that turns a whole body into Bones.
 * **The Barrow Jackal** keeps the digging: a shallow grave that stands a fallen body back up
 * on an Anchor, a bite that rots, and a howl that rots a whole 3x3.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ALLY_UNIT = { kind: 'entity', side: 'ally', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;

export const DUSK_SHELF: Record<string, CardDef> = {
  // ==================================================================== commons

  /** The plain bolt, in decay. Dusk had no single-target damage that was only damage. */
  gloom_bolt: {
    id: 'gloom_bolt',
    name: 'Gloom Bolt',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 decay damage to a unit.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 20, dtype: 'decay', area: { shape: 'target' } },
    keywords: [],
    range: 5,
    needsLoS: true,
  },

  /** Forty decay and twenty back on the Pact: Last Rites, larger and dearer. */
  soul_rend: {
    id: 'soul_rend',
    name: 'Soul Rend',
    cost: { bones: 3, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 decay damage to a unit and restores 20 health to your Pact.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 40, dtype: 'decay', area: { shape: 'target' } },
        { op: 'heal', amount: 20 },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Sixty health of stacked bone. Dusk's first plain wall. */
  ossuary_wall: {
    id: 'ossuary_wall',
    name: 'Ossuary Wall',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 60 HP wall of bone on an empty tile. Blocks movement and line of sight, and leaves rough ground when it breaks.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'ossuary_wall' },
    keywords: [],
    obstacleHp: 60,
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /** Two more tiles for an ally, this turn. Out of the dark and somewhere else. */
  shadowstep: {
    id: 'shadowstep',
    name: 'Shadowstep',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'An ally moves 2 further this turn.',
    target: ALLY_UNIT,
    effect: { op: 'applyStatus', status: 'fleet', stacks: 2, area: { shape: 'target' } },
    keywords: [],
    range: 4,
  },

  /** A 3-deep cone of plague: ten decay and a Toxin on everything caught. */
  plague_wind: {
    id: 'plague_wind',
    name: 'Plague Wind',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 decay damage in a widening 3-deep cone and poisons everything caught (Toxin 1).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'decay', area: { shape: 'cone', depth: 3 } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'cone', depth: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * An enemy Exhausted, as a tithe exhausts a friend: no moving, striking or channelling
   * through its next turn. Priced as the Stasis Glyph is, because it is the same stop.
   */
  dread_gaze: {
    id: 'dread_gaze',
    name: 'Dread Gaze',
    cost: { bones: 3, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Exhausts an enemy: it cannot move, strike or channel through its next turn.',
    target: ENEMY_UNIT,
    effect: { op: 'applyStatus', status: 'exhaust', stacks: 1, area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  // =========================================================== Mortis, the Stag

  /**
   * A friend bled for twenty: two Marrow out of it and twenty health back on the Pact. The
   * Stag's whole plan, feeding on its own, as one card.
   */
  carrion_feast: {
    id: 'carrion_feast',
    name: 'Carrion Feast',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Bleed an un-exhausted friendly minion for 20: extracts 2 Marrow and restores 20 health to your Pact.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'tithe', damage: 20, marrow: 2 },
        { op: 'heal', amount: 20 },
      ],
    },
    keywords: [],
    bloodline: ['mortis'],
    range: 4,
  },

  /** Thirty through any armour to the weakest enemy standing. What Grave Tithe drains, at once. */
  soul_toll: {
    id: 'soul_toll',
    name: 'Soul Toll',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 damage through any armor to the weakest enemy standing.',
    target: { kind: 'global' },
    effect: { op: 'damage', amount: 30, dtype: 'true', area: { shape: 'lowestHpEnemy' } },
    keywords: [],
    bloodline: ['mortis'],
  },

  /** A friendly body spent whole for three Bones. What the Stag feeds on, it pays for. */
  offering: {
    id: 'offering',
    name: 'Offering',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Spends an allied unit whole. Gain 3 Bones.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'consumeTarget' },
        { op: 'gainBones', amount: 3 },
      ],
    },
    keywords: [],
    bloodline: ['mortis'],
    range: 4,
  },

  // ========================================================= the Barrow Jackal

  /** A fallen Vanguard stood back up on an Anchor Tile at a third of its health. */
  shallow_grave: {
    id: 'shallow_grave',
    name: 'Shallow Grave',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Raises a fallen Vanguard on an Anchor Tile at 30% of its health.',
    target: { kind: 'fallen', site: 'anchor' },
    effect: { op: 'revive', site: 'anchor', hp: { mode: 'percent', percent: 30 } },
    keywords: [],
    bloodline: ['jackal'],
  },

  /** Twenty decay and a Toxin on an adjacent enemy: the Jackal rots what it bites. */
  rot_bite: {
    id: 'rot_bite',
    name: 'Rot Bite',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 decay damage to an adjacent enemy and poisons it (Toxin 1).',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'decay', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['jackal'],
    range: 1,
  },

  /** Ten decay and a Toxin on everything in a 3x3, yours included. The howl carries. */
  barrow_howl: {
    id: 'barrow_howl',
    name: 'Barrow Howl',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 decay damage to every unit in a 3x3 around the target tile and poisons them (Toxin 1), yours included.',
    target: ANY_TILE,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'decay', area: { shape: 'square', size: 3 } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'square', size: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['jackal'],
    range: 4,
    needsLoS: true,
  },

  // ============================================================= the Gloam Owl

  /** Twenty decay from nowhere, at four tiles. */
  silent_talon: {
    id: 'silent_talon',
    name: 'Silent Talon',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 decay damage to a unit.',
    target: ENEMY_UNIT,
    effect: { op: 'damage', amount: 20, dtype: 'decay', area: { shape: 'target' } },
    keywords: [],
    bloodline: ['owl'],
    range: 4,
    needsLoS: true,
  },

  /** Two cards. The Owl sees what is coming. */
  owl_omen: {
    id: 'owl_omen',
    name: 'Owl Omen',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Draw 2 cards. The Owl has already seen them coming.',
    target: { kind: 'none' },
    effect: { op: 'drawCards', amount: 2 },
    keywords: [],
    bloodline: ['owl'],
  },

  /** Fog on a 2x2 for two turns and ten decay to whoever is in it. The moonless night. */
  moonless_night: {
    id: 'moonless_night',
    name: 'Moonless Night',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Darkens a 2x2 block for 2 turns, blocking ranged line of sight, and deals 10 decay damage to everything there.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnHazard', kind: 'steam_fog', turns: 2, area: { shape: 'square', size: 2 } },
        { op: 'damage', amount: 10, dtype: 'decay', area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    bloodline: ['owl'],
    range: 4,
    needsLoS: true,
  },

  // =========================================================== the Crypt Spider

  /** Twenty decay and two Toxin on an adjacent enemy. */
  venom_bite: {
    id: 'venom_bite',
    name: 'Venom Bite',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 decay damage to an adjacent enemy and poisons it (Toxin 2).',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'decay', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['spider'],
    range: 1,
  },

  /** Two turns of web on a unit. It can still bite back. */
  web_snare: {
    id: 'web_snare',
    name: 'Web Snare',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Webs a unit for its next two turns (Entangle 2). A webbed unit can still attack.',
    target: ENEMY_UNIT,
    effect: { op: 'applyStatus', status: 'entangle', stacks: 2, area: { shape: 'target' } },
    keywords: [],
    bloodline: ['spider'],
    range: 3,
    needsLoS: true,
  },

  /** An egg sac that bursts in poison when broken. */
  brood_sac: {
    id: 'brood_sac',
    name: 'Brood Sac',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 40 HP egg sac on an empty tile. When it breaks, every unit on or beside it takes 10 damage and is poisoned (Toxin 2).',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'brood_sac' },
    keywords: [],
    obstacleHp: 40,
    obstacleDeath: { status: 'toxin', stacks: 2, damage: 10 },
    bloodline: ['spider'],
    range: 3,
    needsLoS: true,
  },

  /** The Wight: the cold of the barrow, breathed out. */
  barrow_chill: {
    id: 'barrow_chill',
    name: 'Barrow Chill',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 decay damage to a unit and Chills it and everything in a cross around it.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'decay', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'plus', radius: 1 } },
      ],
    },
    keywords: [],
    bloodline: ['wight'],
    range: 4,
    needsLoS: true,
  },
};
