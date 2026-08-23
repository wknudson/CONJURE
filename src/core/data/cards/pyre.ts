/**
 * The Pyre school's expansion shelf.
 *
 * Pyre is the starter school, so its founding cards live in `starter.ts` with the rest of
 * the opening deck. That was fine while there were four of them and stops being fine at
 * fourteen: a school with a shelf of its own is a school somebody can author against
 * without reading the starter deck first. New Pyre cards go here; the four in `starter.ts`
 * stay where they are, because moving them would churn every deck in every save to buy
 * nothing.
 *
 * Pyre's two questions are **burst** and **burn**, and the three below are one of each and
 * one that is both: a line that punishes what is already alight, a body that is worth more
 * dead than alive, and a column that sets the row on fire every turn it is left standing.
 */

import type { CardDef } from '../../types/cards.js';

export const PYRE_CARDS: Record<string, CardDef> = {
  /**
   * The first card in the game with an `ifMet`, and the reason the op exists.
   *
   * "Deal damage, and *also* do this if the board was already set up" was previously
   * unrepresentable: a card wanting it had to be split in two or flattened into an
   * unconditional version that was either overcosted or oppressive. Here the flat half is
   * priced as an ordinary 2-Pip line and the conditional half is the payoff for having
   * spent a turn lighting something up.
   *
   * The condition carries an `area` rather than reading "the target", because a line
   * target names a *direction* and has no single body to ask about. Any burning thing
   * along the line arms it, and then every body on the line takes the Frailty — which is
   * the reading that makes it a follow-up to a Flame Surge rather than a single-target
   * finisher.
   *
   * **Frail is `brittle`.** The engine has had "takes extra damage from every hit until it
   * wears off" from the beginning and calls it Brittle; a second status meaning the same thing
   * at a different name would be indistinguishable on the board.
   */
  ashen_wake: {
    id: 'ashen_wake',
    name: 'Ashen Wake',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage in a 3-tile line. If anything on the line was already Burning, everything on it is left Brittle.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'line', length: 3 } },
        {
          op: 'ifMet',
          cond: { kind: 'targetStatus', status: 'burn', area: { shape: 'line', length: 3 } },
          then: {
            op: 'applyStatus',
            status: 'brittle',
            stacks: 1,
            area: { shape: 'line', length: 3 },
          },
        },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A body priced to be spent.
   *
   * Ten attack is barely a scratch and twenty health is one blow from almost anything, so
   * the Moth is not bought to fight — it is bought to be somewhere inconvenient when it
   * dies. Haste is what lets it arrive and burst on the same turn, which is the whole
   * card: three tiles of movement and a Deathburst is a delivery mechanism.
   *
   * **Ignite is `burn`.** The Pyre Resonance's own text already says "Ignites" for the
   * status the engine calls Burn, so this is the vocabulary the game shipped with rather
   * than a reinterpretation.
   */
  ember_moth: {
    id: 'ember_moth',
    name: 'Ember Moth',
    cost: { pips: 1, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. When it dies, every adjacent enemy catches fire (Burn 1).',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'ember_moth' },
    keywords: ['Haste'],
    unit: {
      atk: 10,
      hp: 20,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
      deathburst: { status: 'burn', stacks: 1 },
    },
  },

  /**
   * The first construct that *does* something.
   *
   * Every obstacle before this was a wall: it occupied tiles, it blocked sight, and the
   * only thing it could do was break. This one has upkeep, and it charges it to the enemy
   * at the start of their turn — the moment they were about to act, which is what makes
   * leaving the row the answer rather than a nicety.
   *
   * Sixty health is deliberately soft for a construct. It is meant to be broken; the
   * question the card asks is whether breaking it is worth the turn.
   */
  pyre_pillar: {
    id: 'pyre_pillar',
    name: 'Pyre Pillar',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 60 HP pillar on an empty tile. At the start of each enemy turn, every enemy in its row catches fire (Burn 1).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'pyre_pillar' },
    keywords: [],
    obstacleHp: 60,
    obstacleTurnStart: { status: 'burn', stacks: 1 },
    leavesRubble: true,
  },

  // ------------------------------------------------------------ the second expansion
  //
  // Pyre was already the richest school, so this is four cards rather than ten: the two
  // shapes the shelf was missing (a cone, and a line that pays for what is already alight)
  // plus a body and a wall that both turn dying into damage. Pyre's whole character is that
  // its cards are worth more when something is already burning, and every one of these
  // reads or writes that state.

  /**
   * The school's first cone, and the reason the shape exists.
   *
   * A widening wedge from the caster: one tile, then three, then five. It needs a `line`
   * target because a cone with no facing is just a circle, and that makes it the only Pyre
   * card whose value depends on where the Companion is standing rather than on where the
   * enemy is.
   *
   * Twenty is modest for three Pips until the geometry lands — a well-placed cone catches
   * five bodies, and every one of them is left Burning for the Ashen Wake or the Stoke that
   * follows.
   */
  cinder_gale: {
    id: 'cinder_gale',
    name: 'Cinder Gale',
    cost: { pips: 3, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 fire damage in a widening 3-deep cone and sets everything caught alight (Burn 1).',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'fire', area: { shape: 'cone', depth: 3 } },
        { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'cone', depth: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A Pip that pays double on a fire already lit.
   *
   * The cheapest card in the school and the one that most rewards having played it second.
   * Against a Burning target it is 30 through armour — better than a two-Pip spell — and
   * against anything else it is a stack of Burn and almost nothing, which is a fair price
   * for a Pip and a bad opening move.
   *
   * `true` on the paid branch because Burn itself ignores nothing and plate is the obvious
   * answer to a burn deck. This is the card that says plate is not enough.
   */
  stoke: {
    id: 'stoke',
    name: 'Stoke',
    cost: { pips: 1, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Burning target, deals 30 damage through any armor. Otherwise it merely sets the target alight (Burn 1).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'burn' },
      then: { op: 'damage', amount: 30, dtype: 'true', area: { shape: 'target' } },
      otherwise: { op: 'applyStatus', status: 'burn', stacks: 1, area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A wall that is worth more broken than standing.
   *
   * Forty health, which is soft even for a construct, and that is the whole card: it is not
   * trying to hold a lane, it is trying to be attacked. Whoever brings it down takes thirty
   * fire and a stack of Burn across the cross around it, indiscriminately — a crystal does
   * not know whose army is standing next to it.
   *
   * So the decision the Cairn asks is the opposite of the one a gate asks. Breaking it is
   * cheap and breaking it hurts, and leaving it standing in the way is sometimes the play.
   */
  slag_cairn: {
    id: 'slag_cairn',
    name: 'Slag Cairn',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 40 HP cairn on an empty tile. When it breaks it bursts for 30 fire damage and Burn 1 in a cross around it, hitting whatever is there.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'slag_cairn' },
    keywords: [],
    obstacleHp: 40,
    obstacleDeath: { status: 'burn', stacks: 1, damage: 30 },
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /**
   * A body that leaves the floor on fire behind it.
   *
   * `trail` lays a hazard on every tile the Hound walks off, and only when it moves under
   * its own power — a body dragged by a Seismic Slam is not grinding its way forward, and
   * letting displacement lay the trail would hand the player a way to wreck their own board
   * by shoving the wrong creature around.
   *
   * Burning ground ignites whoever *starts* a turn standing on it, either side, so a Hound
   * run through your own line is a mistake you get to make. Three movement is what makes
   * the trail long enough to matter.
   */
  ember_hound: {
    id: 'ember_hound',
    name: 'Ember Hound',
    cost: { pips: 2, marrow: 0 },
    school: 'pyre',
    source: 'hero',
    kind: 'minion',
    text: 'Every tile it walks off is left burning. Anything starting its turn on burning ground catches fire — yours included.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'ember_hound' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 40,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
      trail: 'burning',
    },
  },
};
