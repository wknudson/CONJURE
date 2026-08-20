/**
 * The Dusk set: bodies as fuel.
 *
 * Dusk's existing cards already sit around this idea — Dark Tithe spends a minion for
 * armour and Marrow, Soul Splinter pays out when its host dies — but nothing in the school
 * was ever *worth* sacrificing. The Marrow Wisp is Arcane, and it is a better card in
 * every other respect.
 *
 * This is the body you plant in order to spend it.
 */

import type { CardDef } from '../../types/cards.js';

export const DUSK_CARDS: Record<string, CardDef> = {
  /**
   * The first cover any card has ever put on the board.
   *
   * Cover has existed as long as encounter terrain has, and only an encounter could place
   * it. It blocks sight and nothing else, so units stand *in* it: this is a screen your
   * own melee can walk through and your own archers cannot shoot through, which makes it a
   * genuinely different object from Stone Barricade rather than a cheaper one.
   *
   * `spawnConstruct` rather than `spawnObstacle` so the bank's health comes from the
   * spell. Three is deliberately flimsy — it is a held breath, not masonry — and the
   * caster's `bonusObstacleHp` still stacks on top, which is the one way to make smoke
   * that lingers.
   */
  smoke_bomb: {
    id: 'smoke_bomb',
    name: 'Smoke Bomb',
    cost: { pips: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'A held breath of black smoke. Blocks line of sight; anyone may walk into it.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnConstruct', obstacleDef: 'smoke_bank', hp: 3 },
    keywords: [],
  },

  /** What the Bomb raises. Never drawn, never owned — the card is the only way to it. */
  smoke_bank: {
    id: 'smoke_bank',
    name: 'Smoke Bank',
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'obstacle',
    text: 'Blocks sight but not movement. Units may stand in it.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: [],
    setupOnly: true,
    obstacleHp: 3,
    obstacleCover: true,
  },

  /**
   * What an Aetheric Defibrillator leaves standing.
   *
   * `setupOnly`, so it is never drawn, owned, offered as a reward or put in a deck — the
   * same guard the Vanguard Footman and the Bound Forms use. It exists only as the stat
   * block that card summons.
   *
   * Haste is on the block itself because there is nowhere else to put it: no op grants a
   * keyword at summon time, and adding one for a single caller would be a rule with one
   * user. A body that could not act the turn it was jolted upright would also miss the
   * entire point of the card.
   */
  galvanic_revenant: {
    id: 'galvanic_revenant',
    name: 'Galvanic Revenant',
    cost: { pips: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Jolted upright and already moving. It does not remember what it was.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'galvanic_revenant' },
    keywords: ['Haste'],
    setupOnly: true,
    unit: {
      atk: 2,
      hp: 3,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      // Bleeds at no premium. Bleeding the thing you just made by consuming
      // something else is a loop, and a cheap one.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * A Wisp's worth of Marrow on a body that cannot chase anything.
   *
   * Two attack on two health with no movement at all: it threatens exactly the tile it was
   * planted beside and nothing else, forever. Deploying it near the fight is committing to
   * the fight being there.
   *
   * Dormant is the real price, and it is a stricter one than it looks. `canAct` refuses
   * anything summoned this turn without Haste, and the tithe asks `canAct` —
   * so a Ghoul **cannot be cashed in on the turn it lands**. One Pip does not buy two
   * Marrow now; it buys two Marrow next turn, if the thing is still standing. A board that
   * can reach it has a turn in which to answer.
   */
  ash_ghoul: {
    id: 'ash_ghoul',
    name: 'Ash-Ghoul',
    cost: { pips: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Dormant: cannot act the turn it is summoned, and so cannot be tithed until the next one. Cannot move, ever. Bled for +1 Marrow above the usual.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'ash_ghoul' },
    keywords: ['Dormant'],
    unit: {
      // The whole point of the card, and the same premium the Marrow Wisp charges — bought
      // here with immobility and a turn of waiting rather than with a Pip and mobility.
      titheBonus: 1,
      atk: 2,
      hp: 2,
      mov: 0,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // The whole point of the card, and the same number the Marrow Wisp pays — bought
      // here with immobility and a turn of waiting rather than with a Pip and mobility.
      // Unreachable without the Escalate keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
