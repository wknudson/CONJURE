/**
 * The Gaslamp set: industrial occultism.
 *
 * Where the starter deck is soldiers and runes, these are machinery and butchery — a
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
    text: 'Vent a widening blast: 3 fire damage in a 3-deep cone, then shove everything caught 1 tile away.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 3, dtype: 'fire', area: { shape: 'cone', depth: 3 } },
        { op: 'shoveArea', distance: 1, area: { shape: 'cone', depth: 3 } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
    // Ascension buys depth, not damage. A four-deep cone clears the whole doorway and the
    // room behind it, which changes where the card can be aimed from rather than how hard
    // it hits — the same reason the shove goes to 2 instead of the damage going to 4.
    rank2: {
      cost: { pips: 2, marrow: 0 },
      text: 'Vent a widening blast: 3 fire damage in a 4-deep cone, then shove everything caught 2 tiles away.',
      effect: {
        op: 'seq',
        effects: [
          { op: 'damage', amount: 3, dtype: 'fire', area: { shape: 'cone', depth: 4 } },
          { op: 'shoveArea', distance: 2, area: { shape: 'cone', depth: 4 } },
        ],
      },
      range: 4,
    },
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
    keywords: ['Escalate'],
    leavesRubble: true,
    unit: {
      atk: 2,
      hp: 6,
      mov: 1,
      rangeMin: 2,
      rangeMax: 4,
      footprint: 1,
      archetype: 'sniper',
      sacrificeValue: 2,
      escalationBonus: { atk: 1, hp: 0 },
      attackProfile: 'arcing',
    },
    // A bigger gun on the same carriage. The blind spot stays — a mortar that could
    // depress its aim would stop being a mortar, and the card is priced around having to
    // be screened.
    rank2: {
      text: 'Lobber. Fires 2-5 tiles, arcing over cover, and cannot depress its aim onto anything adjacent. Leaves rubble when it breaks.',
      unit: { atk: 3, hp: 8, rangeMax: 5 },
    },
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
    kind: 'spell',
    text: 'Drag every unit orthogonally beside the target tile onto it. They collide with whatever arrives first.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'pullArea', distance: 1, area: { shape: 'adjacentCross' } },
    keywords: [],
    range: 5,
    needsLoS: true,
    // Reach, and one more ring of victims. The diagonals were the whole restraint on this
    // card, so giving them up is the ascension.
    rank2: {
      cost: { pips: 1, marrow: 1 },
      text: 'Drag every unit beside the target tile onto it, diagonals included. They collide with whatever arrives first.',
      effect: { op: 'pullArea', distance: 1, area: { shape: 'adjacent8' } },
      range: 6,
    },
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
    text: 'Sacrifice a friendly minion. Extract Marrow equal to its remaining health, up to 4, and draw a card.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'sacrificeTarget' },
        { op: 'extractMarrow', amount: { from: 'sacrificedHp', max: 4 } },
        { op: 'drawCards', amount: 1 },
      ],
    },
    keywords: [],
    // The cap is the card, so the cap is what moves. Still free, still paid for in bodies.
    rank2: {
      text: 'Sacrifice a friendly minion. Extract Marrow equal to its remaining health, up to 6, and draw two cards.',
      effect: {
        op: 'seq',
        effects: [
          { op: 'sacrificeTarget' },
          { op: 'extractMarrow', amount: { from: 'sacrificedHp', max: 6 } },
          { op: 'drawCards', amount: 2 },
        ],
      },
    },
  },
};
