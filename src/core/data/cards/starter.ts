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
    cost: { pips: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'minion',
    text: 'A conscript of the line. Steady, cheap, and yours from the first turn.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'vanguard_footman' },
    keywords: ['Growth'],
    unit: {
      atk: 20,
      hp: 40,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 10, hp: 10 },
    },
  },

  // ---------------------------------------------------------------- minions
  scout_imp: {
    id: 'scout_imp',
    name: 'Scout Imp',
    cost: { pips: 1, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Can move and attack the turn it is deployed.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'scout_imp' },
    keywords: ['Haste', 'Growth'],
    unit: {
      atk: 20,
      hp: 20,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 10, hp: 0 },
    },
  },

  marrow_wisp: {
    id: 'marrow_wisp',
    name: 'Marrow Wisp',
    cost: { pips: 1, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Bled for +1 Marrow above the usual.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'marrow_wisp' },
    keywords: ['Growth'],
    unit: {
      // Bred to bleed. Every body pays the flat tithe rate; this one pays over it, which
      // is the whole of its identity now that being spent whole is no longer a thing.
      titheBonus: 1,
      atk: 10,
      hp: 30,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 10, hp: 0 },
    },
  },

  grave_sentinel: {
    id: 'grave_sentinel',
    name: 'Grave Sentinel',
    cost: { pips: 2, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Counter: retaliates when hit in melee. Guardian: blocks line of sight behind it.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'grave_sentinel' },
    keywords: ['Counter', 'Guardian', 'Growth'],
    unit: {
      atk: 20,
      hp: 60,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 10, hp: 10 },
    },
  },

  magma_brute: {
    id: 'magma_brute',
    name: 'Magma Brute',
    cost: { pips: 4, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Power Tier. 2x2 Behemoth. Impact: deals 20 fire damage across a 2-tile front cleave. Cannot enter 1x1 gaps.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'summon', unitDef: 'magma_brute' },
        { op: 'cleaveFront', amount: 20, dtype: 'fire', width: 2 },
      ],
    },
    keywords: ['Impact', 'PowerTier', 'Growth'],
    unit: {
      atk: 40,
      hp: 120,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 2,
      archetype: 'behemoth',
      // Behemoth escalation is uncapped per Module 2; the cap is applied in status.ts.
      escalationBonus: { atk: 10, hp: 10 },
    },
  },

  // ------------------------------------------------------------------ runes
  cinder_rune: {
    id: 'cinder_rune',
    name: 'Cinder Rune',
    cost: { pips: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'rune',
    text: 'Attach to a unit or obstacle (max 1 per target). Detonates for 40 fire damage to all adjacent when the host loses HP to fire or spell damage.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'attachRune', rune: 'cinder_rune' },
    keywords: [],
    // Branding an enemy means getting a clear look at it.
    range: 4,
    needsLoS: true,
  },

  soul_splinter_rune: {
    id: 'soul_splinter_rune',
    name: 'Soul Splinter Rune',
    cost: { pips: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'rune',
    text: 'Attach to a friendly unit. When it dies — including bled dry by a tithe — deals 50 damage to the lowest-HP enemy.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: { op: 'attachRune', rune: 'soul_splinter_rune' },
    keywords: [],
    // Marking your own needs closeness, not sight: no line required.
    range: 4,
  },

  // ----------------------------------------------------------------- spells
  flame_surge: {
    id: 'flame_surge',
    name: 'Flame Surge',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 fire damage in a 2-tile line or diagonal. Detonates any Cinder Runes whose armor is penetrated.',
    target: { kind: 'line', length: 2 },
    effect: { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'line', length: 2 } },
    keywords: [],
    // The surge erupts at the near end of the line, so that tile is what must be in reach.
    range: 4,
    needsLoS: true,
  },

  cataclysmic_core: {
    id: 'cataclysmic_core',
    name: 'Cataclysmic Core',
    cost: { pips: 5, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Power Tier. Retain. Detonates every active Rune on the board immediately with +20 bonus damage.',
    target: { kind: 'global' },
    effect: { op: 'detonateAllRunes', bonusDamage: 20 },
    keywords: ['PowerTier', 'Retain'],
  },

  dark_tithe: {
    id: 'dark_tithe',
    name: 'Dark Tithe',
    cost: { pips: 0, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'spell',
    text: 'Bleed an un-exhausted friendly minion for 40: extracts 3 Marrow and grants Persistent Armor equal to the health taken.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    // Above the free command's rate on both axes — 4 damage for 3 Marrow against the
    // command's 3 for 2 — because this costs a card as well as the blood. The armour is
    // what it always was, only now measured by the wound rather than by the whole body.
    effect: {
      op: 'seq',
      effects: [
        { op: 'tithe', damage: 40, marrow: 3 },
        { op: 'grantArmor', amount: { from: 'titheDamage' } },
      ],
    },
    keywords: [],
  },

  shield_bash: {
    id: 'shield_bash',
    name: 'Shield Bash',
    cost: { pips: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'spell',
    text: 'Deals 20 damage to an enemy and shoves it 1 tile away. Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'physical', area: { shape: 'target' } },
        { op: 'push', distance: 1 },
      ],
    },
    keywords: [],
    // A staple ascension: the same shape, harder. Two tiles of shove is what turns this
    // from a tempo card into a wall-kill, which is worth three Shards on a Tier 1 card.
    rank2: {
      text: 'Deals 30 damage to an enemy and shoves it 2 tiles away. Triggers standard Collision Damage (30 / 20).',
      effect: {
        op: 'seq',
        effects: [
          { op: 'damage', amount: 30, dtype: 'physical', area: { shape: 'target' } },
          { op: 'push', distance: 2 },
        ],
      },
    },
  },

  stone_barricade: {
    id: 'stone_barricade',
    name: 'Stone Barricade',
    cost: { pips: 1, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'obstacle',
    text: 'Spawns a destructible 60 HP pillar on an empty tile. Blocks line of sight.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'stone_barricade' },
    keywords: [],
    obstacleHp: 60,
    leavesRubble: true,
  },

  aegis_ward: {
    id: 'aegis_ward',
    name: 'Aegis Ward',
    cost: { pips: 1, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'spell',
    text: 'Retain. Grants a friendly unit or your Hero +40 Persistent Armor.',
    target: { kind: 'unitOrPortrait', side: 'ally' },
    effect: { op: 'grantArmor', amount: 40 },
    keywords: ['Retain'],
  },

  // ------------------------------------------------- boss-granted special card
  rite_of_subjugation: {
    id: 'rite_of_subjugation',
    name: 'Rite of Subjugation',
    cost: { pips: 0, marrow: 0 },
    school: 'arcane',
    source: 'companion',
    kind: 'spell',
    text: 'Tether a friendly unit to the sealed beast. It cannot move or act. Hold it there for three rounds to claim the companion.',
    // An ally, not the board: the Rite is a harpoon fired from one of your own, and which
    // one you can afford to immobilise for three rounds is the decision it asks.
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: { op: 'anchorTether' },
    keywords: ['Retain'],
  },
};

/**
 * The 15-card starter deck as a list of card ids. Duplicates are intentional and match
 * Draft 7's table: 2x Grave Sentinel, 2x Cinder Rune, 2x Flame Surge.
 */
/**
 * The deck a new player starts with.
 *
 * Five bodies used to sit at the top of this list. They are a Vanguard Roster now — bought
 * once before the dungeon and deployed onto Anchor Tiles, rather than drawn and paid for
 * again every fight. What replaced them is the Aura line: something to *do* with the board
 * the roster gives you for free.
 */
/**
 * The Hero Deck a new player starts with.
 *
 * Nine cards of utility and nothing elemental, because the elements are not the Hero's to
 * bring any more — the equipped Companion fuses eight fixed spells in at the bell. What is
 * left here is the half a player actually *builds*: a shove, a wall, a ward, a bleed, and
 * the arcane tools that work whatever colour of magic is standing next to them.
 *
 * Nine rather than the full fifteen deliberately. A deck at its ceiling on day one has
 * nowhere to grow, and the six empty slots are the first thing the Field Journal asks the
 * player a question about.
 */
export const STARTER_DECK: string[] = [
  'shield_bash',
  'shield_bash',
  'stone_barricade',
  'dark_tithe',
  'aegis_ward',
  'grapple_line',
  'grapple_line',
  'aether_beam',
  'cull_the_weak',
];
