/**
 * The Gaslamp set: industrial occultism.
 *
 * Where the starter deck is soldiers and marks, these are machinery and butchery — a
 * pressure valve vented into a crowd, a mortar bolted together from scrap, a tithe taken
 * in bone. Each one leans on a piece of vocabulary the engine gained for it, so the set
 * doubles as the proof that the vocabulary is real.
 *
 * `Flash Freeze` belongs to this wave too but lives in the Frost file, since it replaced
 * that school's existing prototype rather than joining a new one.
 */

import type { CardDef } from '../../types/cards.js';

export const GASLAMP_CARDS: Record<string, CardDef> = {
  /**
   * The cone card. Damage and displacement over the same wedge, so it clears a doorway
   * rather than merely hurting whoever is in it.
   */
  pressure_valve_release: {
    id: 'pressure_valve_release',
    name: 'Pressure Valve Release',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Vent a widening blast: 30 fire damage in a 3-deep cone, then shove everything caught 1 tile away.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'fire', area: { shape: 'cone', depth: 3 } },
        { op: 'shoveArea', distance: 1, area: { shape: 'cone', depth: 3 } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    // Its Ascension used to buy a deeper cone and a longer shove, and cost a Pip more for
    // them. All three are things Ascension may no longer touch: a Rank 2 that re-priced a
    // card or re-shaped its blast was a second card wearing the first one's name. The
    // ascended printing is now derived — 33 fire in the same 3-deep cone, same shove, same
    // price. See `data/ascension.ts`.
  },

  /**
   * The Lobber, as a body rather than a spell.
   *
   * The card is an ordinary deployment — you place it in your own rows like any minion.
   * Its mortar profile lives on the unit, which is where reach belongs: `rangeMin` gives
   * it the blind spot and `arcing` lets it drop shells over walls.
   */
  scrap_metal_mortar: {
    id: 'scrap_metal_mortar',
    name: 'Scrap-Metal Mortar',
    cost: { pips: 3, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Lobber. Fires 2-4 tiles, arcing over cover, and cannot depress its aim onto anything adjacent. Leaves rubble when it breaks.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'scrap_metal_mortar' },
    keywords: ['Growth'],
    leavesRubble: true,
    unit: {
      atk: 20,
      hp: 60,
      mov: 1,
      rangeMin: 2,
      rangeMax: 4,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 10, hp: 0 },
      attackProfile: 'arcing',
    },
    // No Ascension at all now, and this is the card that shows why the rule is right: it
    // is a *body*, and bodies are levelled rather than ascended. A Vanguard Mortar earns
    // its attack and its health by surviving fights (`vanguardBonus`), and two systems
    // raising one stat block would be two systems arguing about it.
  },

  /**
   * The gravity bomb.
   *
   * Targets a tile rather than two units, which is what keeps `ChosenTarget` singular:
   * one pick, and the area does the rest. Everything orthogonally beside the tile is
   * dragged onto it — so the first arrival takes the spot and the others slam into it,
   * which is where the damage comes from. The spell deals none of its own.
   *
   * A Companion card because its reach is the point. A Hero card ignores `range`
   * entirely and reaches the whole board, which would make a five-tile limit a lie.
   */
  aetheric_tether: {
    id: 'aetheric_tether',
    name: 'Aetheric Tether',
    cost: { pips: 1, marrow: 1 },
    school: 'arcane',
    source: 'companion',
    kind: 'ability',
    text: 'Drag every unit orthogonally beside the target tile onto it. They collide with whatever arrives first.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'pullArea', distance: 1, area: { shape: 'adjacentCross' } },
    keywords: [],
    range: 5,
    needsLoS: true,
    // Its Ascension used to buy the diagonals and a tile of reach. Both are geometry, and
    // geometry is exactly what vertical progression leaves alone — a spell that catches a
    // different set of tiles at Rank 2 is a spell nobody can play around. This card deals
    // no damage of its own, so it has no Rank 2 at all, and the Forge says so.
  },

  /**
   * The tithe. Free to cast and paid for entirely in bodies.
   *
   * Capped at 4 so a fat minion cannot fund a whole turn on its own, and it draws a
   * card, which is what makes feeding it a plan rather than a last resort.
   */
  harvest_the_weak: {
    id: 'harvest_the_weak',
    name: 'Harvest the Weak',
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'Bleed an un-exhausted friendly minion for 40. Extract Marrow equal to the health actually taken, up to 4, and draw a card.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    // The card's identity survives the overhaul untouched, because `titheDamage` records
    // the *landed* wound: bleeding a 2-HP body still yields 2, and a fat one still caps at
    // the tithe. The tithe itself pays no Marrow — all of it comes from the scaling op, so
    // the cap stays the only number that matters.
    effect: {
      op: 'seq',
      effects: [
        { op: 'tithe', damage: 40, marrow: 0 },
        { op: 'extractMarrow', amount: { from: 'titheDamage', max: 4 } },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
    // No Ascension. Every number on this card is one Ascension refuses: the tithe wounds
    // your own body, so raising it is a *downgrade*; the cap is Marrow; the draw is cards.
    // A card made entirely of excluded quantities has no Rank 2, which is the honest
    // answer rather than a printing that charges Shards to change nothing.
  },
};
