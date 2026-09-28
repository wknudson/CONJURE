/**
 * The dens' own: enemy-only bodies that guard the lairs, hunts and contracts where the newer
 * hybrids are bound.
 *
 * All `setupOnly` — they are placed by an encounter and never fielded by a player, which is
 * why they are not in any `PackDef` (a pack is a warband a player could field). The Threat
 * Ledger lists them the moment one is killed. Priced on the same ladder as every body, so an
 * arena's roster budget can still be checked against them.
 */

import type { CardDef } from '../../types/cards.js';

export const DEN_THREAT_CARDS: Record<string, CardDef> = {
  /** A vent drake a season out of the egg. Its bite already burns. */
  drake_hatchling: {
    id: 'drake_hatchling',
    name: 'Drake Hatchling',
    cost: { bones: 2, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Quick, and bites fire (Burn 1).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'drake_hatchling' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 20, hp: 40, mov: 3, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'skirmisher', escalationBonus: { atk: 0, hp: 0 }, onHit: { status: 'burn', stacks: 1 } },
  },

  /** The mother of the vent brood. She does not leave the pools, and she does not need to. */
  brood_drake: {
    id: 'brood_drake',
    name: 'Brood Drake',
    cost: { bones: 4, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Breathes fire at 2 tiles. When it dies, every adjacent enemy catches fire (Burn 2).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'brood_drake' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 40, hp: 110, mov: 2, rangeMin: 1, rangeMax: 2, footprint: 1, archetype: 'caster', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'fire', deathburst: { status: 'burn', stacks: 2 } },
  },

  /** Too young to fly the front, old enough to strike from it. */
  hawk_fledgling: {
    id: 'hawk_fledgling',
    name: 'Hawk Fledgling',
    cost: { bones: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Four tiles a turn, and its talons leave what they strike Charged.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'hawk_fledgling' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 20, hp: 30, mov: 4, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'skirmisher', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'shock' },
  },

  /** The eyrie’s matriarch: a wingspan of storm and a temper to match. */
  storm_roc: {
    id: 'storm_roc',
    name: 'Storm Roc',
    cost: { bones: 4, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Its strikes are shock, leaving what survives Charged.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'storm_roc' },
    keywords: ['Haste'],
    setupOnly: true,
    unit: { atk: 40, hp: 100, mov: 3, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'bruiser', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'shock' },
  },

  /** A barrow’s keeper, still keeping it. */
  barrow_wight: {
    id: 'barrow_wight',
    name: 'Barrow Wight',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Its touch is decay, and chills what survives it (Chill 1).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'barrow_wight' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 20, hp: 50, mov: 2, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'bruiser', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'decay', onHit: { status: 'chill', stacks: 1 } },
  },

  /** Whatever was buried under the largest mound. It still wears the grave-goods. */
  wight_lord: {
    id: 'wight_lord',
    name: 'Wight Lord',
    cost: { bones: 4, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Counter. Its blows are decay, and chill what survives them (Chill 1).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'wight_lord' },
    keywords: ['Counter'],
    setupOnly: true,
    unit: { atk: 40, hp: 110, mov: 2, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'bruiser', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'decay', onHit: { status: 'chill', stacks: 1 } },
  },

  /** A den’s cub. Its mother is never far. */
  bear_cub: {
    id: 'bear_cub',
    name: 'Bear Cub',
    cost: { bones: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Small, stubborn, and heavier than it looks.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'bear_cub' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 20, hp: 50, mov: 2, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'bruiser', escalationBonus: { atk: 0, hp: 0 } },
  },

  /** The mother. The Barrow Bear’s kin, and not in the mood. */
  den_bear: {
    id: 'den_bear',
    name: 'Den Bear',
    cost: { bones: 4, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Counter. Fifty in a swipe, and it strikes back when struck.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'den_bear' },
    keywords: ['Counter'],
    setupOnly: true,
    unit: { atk: 50, hp: 130, mov: 2, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'bruiser', escalationBonus: { atk: 0, hp: 0 } },
  },

  /** Something the ring grew over. It walks where the ring tells it. */
  spore_thrall: {
    id: 'spore_thrall',
    name: 'Spore Thrall',
    cost: { bones: 2, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'When it dies, every adjacent enemy is poisoned (Toxin 2).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'spore_thrall' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 10, hp: 50, mov: 1, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'bruiser', escalationBonus: { atk: 0, hp: 0 }, deathburst: { status: 'toxin', stacks: 2 } },
  },

  /** The oldest cap in the ring, and the ring’s voice. */
  ring_elder: {
    id: 'ring_elder',
    name: 'Ring Elder',
    cost: { bones: 4, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian. Throws spores 1 to 3 tiles, poisoning what it hits (Toxin 2).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'ring_elder' },
    keywords: ['Guardian'],
    setupOnly: true,
    unit: { atk: 30, hp: 100, mov: 1, rangeMin: 1, rangeMax: 3, footprint: 1, archetype: 'caster', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'toxic', onHit: { status: 'toxin', stacks: 2 } },
  },

  /** A lamp-ghost of Lamprow: a wick with nobody holding it. */
  restless_geist: {
    id: 'restless_geist',
    name: 'Restless Geist',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Its touch is decay, and burns what it touches (Burn 1).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'restless_geist' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 20, hp: 30, mov: 3, rangeMin: 1, rangeMax: 1, footprint: 1, archetype: 'caster', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'decay', onHit: { status: 'burn', stacks: 1 } },
  },

  /** The loudest of the lamp-ghosts, and the one the others follow. */
  wailing_geist: {
    id: 'wailing_geist',
    name: 'Wailing Geist',
    cost: { bones: 4, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Strikes 1 to 2 tiles in decay. When it dies, every adjacent enemy catches fire (Burn 2).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'wailing_geist' },
    keywords: [],
    setupOnly: true,
    unit: { atk: 40, hp: 90, mov: 2, rangeMin: 1, rangeMax: 2, footprint: 1, archetype: 'caster', escalationBonus: { atk: 0, hp: 0 }, attackDtype: 'decay', deathburst: { status: 'burn', stacks: 2 } },
  },
};
