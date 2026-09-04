/**
 * The three ways of fighting at a distance.
 *
 * Long reach on a big board is simply strong unless it costs something specific, so each
 * of these buys its range with a weakness a player can play around — and, just as
 * importantly, one the player can *see*: a body in the way, a step closer, a wall.
 */

import type { CardDef } from '../../types/cards.js';

export const RANGED_CARDS: Record<string, CardDef> = {
  /**
   * Unlimited reach, down a straight line only. It threatens whole ranks and files at
   * once and nothing at all off them, so the counter is a single sidestep — or anything
   * at all standing on the line, since its shot is stopped by the first thing it meets.
   */
  longshot_stalker: {
    id: 'longshot_stalker',
    name: 'Longshot Stalker',
    cost: { bones: 3, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Fires any distance, but only along a straight line. Anything in the way stops the shot.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'longshot_stalker' },
    keywords: ['Growth'],
    unit: {
      atk: 30,
      hp: 30,
      mov: 2,
      rangeMin: 1,
      // Effectively the whole board. Deliberately a large number rather than Infinity,
      // which JSON cannot carry -- it would serialise as null and corrupt the state hash.
      rangeMax: 99,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 10, hp: 0 },
      attackProfile: 'lineOnly',
    },
  },

  /**
   * Lobs over walls, Guardians and Behemoths alike, which makes cover worthless against
   * it — but it cannot depress its aim. Walking into its face is the entire counter, and
   * that is a real cost, because getting there is what it was shelling you to prevent.
   */
  cinder_lobber: {
    id: 'cinder_lobber',
    name: 'Cinder Lobber',
    cost: { bones: 3, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Shoots over anything, needing no line of sight. Cannot hit what is adjacent.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'cinder_lobber' },
    keywords: ['Growth'],
    unit: {
      atk: 20,
      hp: 50,
      mov: 2,
      // The blind spot is the price of ignoring sight entirely.
      rangeMin: 2,
      rangeMax: 4,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 10, hp: 0 },
      attackProfile: 'arcing',
    },
  },

  /**
   * The hardest hitter at range, bolted to the floor. It cannot answer a bad placement,
   * so where it lands is the whole decision — and shoving it, or simply walling its
   * sightline, beats it without ever trading a blow.
   */
  arc_turret: {
    id: 'arc_turret',
    name: 'Arc Turret',
    cost: { bones: 4, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Hits hard at long range and never moves. Blocking its line, or shoving it, is the answer.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'arc_turret' },
    keywords: ['Growth'],
    unit: {
      atk: 50,
      hp: 60,
      mov: 0,
      rangeMin: 1,
      rangeMax: 5,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 10 },
    },
  },

  // ------------------------------------------------------------ the drought, ended
  //
  // Four of the eight schools had no 3-point body, and the card-draw Channel belongs to the
  // 3-point class alone — so a Boreas or a Sylva could never sit a body down for a card, and
  // the two colourless shelves everybody shares offered nothing at range under four points.
  // One ranged body per dry school, each buying its reach with a weakness in the file's
  // idiom: a blind spot, a short leash, glass for armour.

  /**
   * Frost's archer. Ordinary sight and ordinary reach, on a body that will not chase: one
   * step of movement means where it is set is where it shoots from, and a line that moves
   * a tile leaves it behind. The cheapest ranged body in the game, priced for a school
   * whose spells already slow what the archer is meant to hit.
   */
  rime_archer: {
    id: 'rime_archer',
    name: 'Rime Archer',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Shoots up to three tiles away with a clear line. Slow: it holds the ground it was set on.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'rime_archer' },
    keywords: ['Growth'],
    unit: {
      atk: 20,
      hp: 40,
      mov: 1,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 10, hp: 0 },
    },
  },

  /**
   * Bloom's mortar: the Cinder Lobber's shape in the other colour. Arcs over anything and
   * cannot hit what is adjacent, so the answer is to close — and Bloom is the school that
   * roots and snares what tries to.
   */
  thorn_lobber: {
    id: 'thorn_lobber',
    name: 'Thorn Lobber',
    cost: { bones: 3, marrow: 0 },
    school: 'bloom',
    source: 'hero',
    kind: 'minion',
    text: 'Shoots over anything, needing no line of sight. Cannot hit what is adjacent.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'thorn_lobber' },
    keywords: ['Growth'],
    unit: {
      atk: 20,
      hp: 50,
      mov: 1,
      rangeMin: 2,
      rangeMax: 4,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 10 },
      attackProfile: 'arcing',
    },
  },

  /**
   * The Hero's own marksman, glass for armour. Hits like the Stalker at four tiles with
   * ordinary sight, and dies to almost anything that reaches it — thirty health on a body
   * that moves one. Colourless, so every character may field it; the price of that is
   * that nothing about it is anybody's school.
   */
  glass_arbalest: {
    id: 'glass_arbalest',
    name: 'Glass Arbalest',
    cost: { bones: 3, marrow: 0 },
    school: 'arcane',
    source: 'hero',
    kind: 'minion',
    text: 'Shoots up to four tiles away with a clear line. Fragile, and slow to reposition.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'glass_arbalest' },
    keywords: ['Growth'],
    unit: {
      atk: 30,
      hp: 30,
      mov: 1,
      rangeMin: 1,
      rangeMax: 4,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 10, hp: 0 },
    },
  },

  /**
   * The conscript with a sling: the Footman's cousin, and the floor under every warband's
   * card draw. Weak, short, and unlocked for everybody — it exists so that no character,
   * whatever they caught or did not, is ever without a body that can Sight for a card.
   */
  hedge_slinger: {
    id: 'hedge_slinger',
    name: 'Hedge Slinger',
    cost: { bones: 2, marrow: 0 },
    school: 'neutral',
    source: 'hero',
    kind: 'minion',
    text: 'A conscript with a sling. Shoots up to three tiles away with a clear line, and not hard.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'hedge_slinger' },
    keywords: ['Growth'],
    unit: {
      atk: 10,
      hp: 40,
      mov: 2,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 10, hp: 0 },
    },
  },
};
