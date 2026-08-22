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
};
