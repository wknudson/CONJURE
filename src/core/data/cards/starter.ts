/**
 * Draft 7 §10's 15-card prototype starter deck, plus the unit stat blocks it summons.
 *
 * Cards are typed TS data rather than JSON so every effect node is validated at compile
 * time. They serialise to JSON unchanged if a data-driven editor is ever wanted.
 */

import type { CardDef } from '../../types/cards.js';

/** Card definitions, keyed by id. Duplicates in the deck list reference the same def. */
export const STARTER_CARDS: Record<string, CardDef> = {
  /**
   * Not in any deck. Both sides get one free at setup so the board is never empty on
   * turn one and the opening turn is a tactical decision rather than a setup step.
   */
  vanguard_footman: {
    id: 'vanguard_footman',
    name: 'Vanguard Footman',
    cost: 1,
    school: 'neutral',
    source: 'hero',
    kind: 'minion',
    text: 'A conscript of the line. Escalate: +1 ATK / +1 HP.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'vanguard_footman' },
    keywords: ['Escalate'],
    unit: {
      atk: 2,
      hp: 4,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      sacrificeValue: 1,
      escalationBonus: { atk: 1, hp: 1 },
    },
  },

  // ---------------------------------------------------------------- minions
  scout_imp: {
    id: 'scout_imp',
    name: 'Scout Imp',
    cost: 1,
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Can move and attack the turn it is deployed. Escalate: +1 ATK.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'scout_imp' },
    keywords: ['Haste', 'Escalate'],
    unit: {
      atk: 2,
      hp: 2,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      sacrificeValue: 1,
      escalationBonus: { atk: 1, hp: 0 },
    },
  },

  spark_wisp: {
    id: 'spark_wisp',
    name: 'Spark Wisp',
    cost: 1,
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Escalate: +1 ATK. Sacrifice: grants +2 Sparks.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'spark_wisp' },
    keywords: ['Escalate', 'Sacrifice'],
    unit: {
      atk: 1,
      hp: 3,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'caster',
      sacrificeValue: 2,
      escalationBonus: { atk: 1, hp: 0 },
    },
  },

  grave_sentinel: {
    id: 'grave_sentinel',
    name: 'Grave Sentinel',
    cost: 2,
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Counter: retaliates when hit in melee. Guardian: blocks line of sight behind it.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'grave_sentinel' },
    keywords: ['Counter', 'Guardian', 'Escalate'],
    unit: {
      atk: 2,
      hp: 6,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      sacrificeValue: 2,
      escalationBonus: { atk: 1, hp: 1 },
    },
  },

  magma_brute: {
    id: 'magma_brute',
    name: 'Magma Brute',
    cost: 4,
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Power Tier. 2x2 Behemoth. Impact: deals 2 fire damage across a 2-tile front cleave. Cannot enter 1x1 gaps.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'summon', unitDef: 'magma_brute' },
        { op: 'cleaveFront', amount: 2, dtype: 'fire', width: 2 },
      ],
    },
    keywords: ['Impact', 'PowerTier', 'Escalate'],
    unit: {
      atk: 4,
      hp: 12,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      sacrificeValue: 3,
      // Behemoth escalation is uncapped per Module 2; the cap is applied in status.ts.
      escalationBonus: { atk: 1, hp: 1 },
    },
  },

  // ------------------------------------------------------------------ runes
  cinder_rune: {
    id: 'cinder_rune',
    name: 'Cinder Rune',
    cost: 1,
    school: 'pyre',
    source: 'companion',
    kind: 'rune',
    text: 'Attach to a unit or obstacle (max 1 per target). Detonates for 4 fire damage to all adjacent when the host loses HP to fire or spell damage.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'attachRune', rune: 'cinder_rune' },
    keywords: [],
  },

  soul_splinter_rune: {
    id: 'soul_splinter_rune',
    name: 'Soul Splinter Rune',
    cost: 1,
    school: 'dusk',
    source: 'companion',
    kind: 'rune',
    text: 'Attach to a friendly unit. When it dies or is sacrificed, deals 5 damage to the lowest-HP enemy.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: { op: 'attachRune', rune: 'soul_splinter_rune' },
    keywords: [],
  },

  // ----------------------------------------------------------------- spells
  flame_surge: {
    id: 'flame_surge',
    name: 'Flame Surge',
    cost: 2,
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 3 fire damage in a 2-tile line or diagonal. Detonates any Cinder Runes whose armor is penetrated.',
    target: { kind: 'line', length: 2 },
    effect: { op: 'damage', amount: 3, dtype: 'fire', area: { shape: 'line', length: 2 } },
    keywords: [],
  },

  cataclysmic_core: {
    id: 'cataclysmic_core',
    name: 'Cataclysmic Core',
    cost: 5,
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Power Tier. Retain. Detonates every active Rune on the board immediately with +2 bonus damage.',
    target: { kind: 'global' },
    effect: { op: 'detonateAllRunes', bonusDamage: 2 },
    keywords: ['PowerTier', 'Retain'],
  },

  dark_tithe: {
    id: 'dark_tithe',
    name: 'Dark Tithe',
    cost: 0,
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'Sacrifice an un-exhausted friendly minion. Grants its current HP as Persistent Armor and generates +2 Sparks.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'sacrificeTarget' },
        { op: 'grantArmor', amount: { from: 'sacrificedHp' } },
        { op: 'gainSparks', amount: 2 },
      ],
    },
    keywords: [],
  },

  shield_bash: {
    id: 'shield_bash',
    name: 'Shield Bash',
    cost: 1,
    school: 'bulwark',
    source: 'hero',
    kind: 'spell',
    text: 'Deals 2 damage to an enemy and shoves it 1 tile away. Triggers standard Collision Damage (3 / 2).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 2, dtype: 'physical', area: { shape: 'target' } },
        { op: 'push', distance: 1 },
      ],
    },
    keywords: [],
  },

  stone_barricade: {
    id: 'stone_barricade',
    name: 'Stone Barricade',
    cost: 1,
    school: 'bulwark',
    source: 'hero',
    kind: 'obstacle',
    text: 'Spawns a destructible 6 HP pillar on an empty tile. Blocks line of sight.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'stone_barricade' },
    keywords: [],
    obstacleHp: 6,
  },

  aegis_ward: {
    id: 'aegis_ward',
    name: 'Aegis Ward',
    cost: 1,
    school: 'arcane',
    source: 'hero',
    kind: 'spell',
    text: 'Retain. Grants a friendly unit or your Hero +4 Persistent Armor.',
    target: { kind: 'unitOrPortrait', side: 'ally' },
    effect: { op: 'grantArmor', amount: 4 },
    keywords: ['Retain'],
  },

  // ------------------------------------------------- boss-granted special card
  rite_of_binding: {
    id: 'rite_of_binding',
    name: 'Rite of Binding',
    cost: 0,
    school: 'arcane',
    source: 'companion',
    kind: 'spell',
    text: 'Bind the weakened companion to your service, ending the trial in your favour.',
    target: { kind: 'global' },
    effect: { op: 'bindCompanion' },
    keywords: ['Retain'],
  },
};

/**
 * The 15-card starter deck as a list of card ids. Duplicates are intentional and match
 * Draft 7's table: 2x Grave Sentinel, 2x Cinder Rune, 2x Flame Surge.
 */
export const STARTER_DECK: string[] = [
  'scout_imp',
  'spark_wisp',
  'grave_sentinel',
  'grave_sentinel',
  'magma_brute',
  'cinder_rune',
  'cinder_rune',
  'soul_splinter_rune',
  'flame_surge',
  'flame_surge',
  'cataclysmic_core',
  'dark_tithe',
  'shield_bash',
  'stone_barricade',
  'aegis_ward',
];
