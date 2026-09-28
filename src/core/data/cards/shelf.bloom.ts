/**
 * Bloom's third shelf: six common spells and constructs, and the signature cards of its two
 * wild bloodlines.
 *
 * Bloom had Toxin in every size and roots in two, and its two species split the shelf with a
 * four-card `omit` each. The commons fill what was missing: a free nettle, a line of thorns,
 * a seed pod that poisons whoever breaks it, a leech vine that drinks, a wide spore cloud,
 * and bark skin for an ally that roots it where it stands.
 *
 * **Sylva** keeps the patience: a rootbind that holds for two turns, a warden tree that
 * poisons as it falls, and a bramble lash. **The Moss Aurochs** keeps the field: a fallow
 * cloud over a 3x3, a stampede that shoves and poisons down a line, and a ruminating card
 * that grazes health back onto the Pact.
 */

import type { CardDef } from '../../types/cards.js';

const ENEMY_UNIT = { kind: 'entity', side: 'enemy', includeObstacles: false } as const;
const ALLY_UNIT = { kind: 'entity', side: 'ally', includeObstacles: false } as const;
const ANY_TILE = { kind: 'emptyTile', zone: 'any', footprint: 1 } as const;

export const BLOOM_SHELF: Record<string, CardDef> = {
  // ==================================================================== commons

  /** Free, and nothing but a Toxin: the setup Spore Burst and Blight Harvest want first. */
  nettle: {
    id: 'nettle',
    name: 'Nettle',
    cost: { bones: 0, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Poisons a unit (Toxin 1).',
    target: ENEMY_UNIT,
    effect: { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Twenty physical and a Toxin down a line. Thornlash, spread. */
  thorn_volley: {
    id: 'thorn_volley',
    name: 'Thorn Volley',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 physical damage down a 3-tile line and poisons everything on it (Toxin 1).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'physical', area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** A pod that bursts when broken: two Toxin on everything on or beside it, both sides. */
  seed_pod: {
    id: 'seed_pod',
    name: 'Seed Pod',
    cost: { bones: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 30 HP seed pod on an empty tile. When it breaks, every unit on or beside it is poisoned (Toxin 2).',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'seed_pod' },
    keywords: [],
    obstacleHp: 30,
    obstacleDeath: { status: 'toxin', stacks: 2 },
    range: 3,
    needsLoS: true,
  },

  /** Twenty toxic out of an enemy and twenty back on the Pact. The vine drinks. */
  leech_vine: {
    id: 'leech_vine',
    name: 'Leech Vine',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 toxic damage to a unit and restores 20 health to your Pact.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'toxic', area: { shape: 'target' } },
        { op: 'heal', amount: 20 },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Two Toxin in a wide cross around a tile, two out each way. No damage; the rot does it. */
  rot_spores: {
    id: 'rot_spores',
    name: 'Rot Spores',
    cost: { bones: 3, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Poisons every unit in a wide cross around the target tile, two tiles out each way (Toxin 2), yours included.',
    target: ANY_TILE,
    effect: { op: 'applyStatus', status: 'toxin', stacks: 2, area: { shape: 'plus', radius: 2 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** Thirty armour on an ally, and roots that hold it where it stands. */
  bark_skin: {
    id: 'bark_skin',
    name: 'Bark Skin',
    cost: { bones: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 30 Armor. It takes root: Entangled until the end of your turn.',
    target: ALLY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 30 },
        { op: 'applyStatus', status: 'entangle', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
  },

  // =============================================================== Sylva, the Warden

  /** Two turns of roots and a Toxin: the Warden's patience, as one card. */
  rootbind: {
    id: 'rootbind',
    name: 'Rootbind',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Roots a unit for its next two turns (Entangle 2) and poisons it (Toxin 1). A rooted unit can still attack.',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'entangle', stacks: 2, area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    bloodline: ['sylva'],
    range: 4,
    needsLoS: true,
  },

  /** Ninety health of living wood that bursts in rot as it falls. */
  warden_tree: {
    id: 'warden_tree',
    name: 'Warden Tree',
    cost: { bones: 3, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 90 HP tree on an empty tile. When it falls it bursts: 20 damage and Toxin 2 to every unit on or beside it.',
    target: ANY_TILE,
    effect: { op: 'spawnObstacle', obstacleDef: 'warden_tree' },
    keywords: [],
    obstacleHp: 90,
    obstacleDeath: { status: 'toxin', stacks: 2, damage: 20 },
    leavesRubble: true,
    bloodline: ['sylva'],
    range: 3,
    needsLoS: true,
  },

  /** Twenty physical to an enemy and a Toxin on everything in a cross around it. */
  bramble_lash: {
    id: 'bramble_lash',
    name: 'Bramble Lash',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 physical damage to a unit and poisons it and everything in a cross around it (Toxin 1).',
    target: ENEMY_UNIT,
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'physical', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'plus', radius: 1 } },
      ],
    },
    keywords: [],
    bloodline: ['sylva'],
    range: 3,
    needsLoS: true,
  },

  // =========================================================== the Moss Aurochs

  /** A Toxin on everything in a 3x3, no damage. The field left fallow on purpose. */
  fallow_cloud: {
    id: 'fallow_cloud',
    name: 'Fallow Cloud',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Poisons every unit in a 3x3 around the target tile (Toxin 1), yours included. No damage.',
    target: ANY_TILE,
    effect: { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'square', size: 3 } },
    keywords: [],
    bloodline: ['aurochs'],
    range: 4,
    needsLoS: true,
  },

  /** A line shoved a tile and poisoned: the herd going through. */
  moss_stampede: {
    id: 'moss_stampede',
    name: 'Moss Stampede',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves everything on a 3-tile line 1 tile away from its near end and poisons it (Toxin 1). Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'shoveArea', distance: 1, area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    bloodline: ['aurochs'],
    range: 4,
    needsLoS: true,
  },

  /** Twenty health back on the Pact, and a card. The Aurochs grazes. */
  ruminate: {
    id: 'ruminate',
    name: 'Ruminate',
    cost: { bones: 1, marrow: 0 },
    school: 'bloom',
    source: 'companion',
    kind: 'spell',
    text: 'Restores 20 health to your Pact. Draw 1 card.',
    target: { kind: 'none' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'heal', amount: 20 },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
    bloodline: ['aurochs'],
  },
};
