/**
 * The Surge mini-set.
 *
 * Surge is the conduction school: modest damage on its own, and dangerous the moment the
 * ground is wet. Its whole identity is the weather interaction — a Surge deck brought to
 * a clear sky is playing a slightly weak Arcane deck, and the same deck in a downpour
 * hits everything standing next to what it aimed at.
 *
 * Voltara arrived with this wave, so the school finally has a body to cast from and the
 * set can hold Companion cards as well as Hero ones. `arc_lash` stays a Hero card: it was
 * authored to be castable without a Surge companion and there is no reason to take that
 * away from the two decks that can already run it.
 *
 * Surge is also the school the Reaction matrix leans on hardest. `charged` does nothing
 * by itself — it is the setup half of two different reactions, and nothing else in the
 * game applied it before Static Arc.
 */

import type { CardDef } from '../../types/cards.js';

export const SURGE_CARDS: Record<string, CardDef> = {
  /**
   * The charge-layer.
   *
   * Aimed at a tile rather than at a body, which is the established shape for anything
   * that radiates: `resolveArea` reads the chosen tile as its origin, and picking a unit
   * instead would centre the cross on the victim and hit their neighbours rather than
   * them. Everything orthogonally beside the tile is charged; the diagonals are the
   * restraint.
   *
   * The damage is `spell`, per the brief, and that has one consequence worth knowing: it
   * is an aligned type for Cinder Rune, so a Static Arc into a branded cluster detonates
   * the runes as well as charging the survivors. `shock` would not have.
   */
  static_arc: {
    id: 'static_arc',
    name: 'Static Arc',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 spell damage to everything orthogonally beside the target tile and leaves it Charged. Fire into a Charged target Overloads; frost Superconducts.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'spell', area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    // Thrown short, like every other burst: the Companion has to walk into the fight to
    // catch a cluster with it.
    range: 3,
    needsLoS: true,
  },

  /**
   * The glass cannon.
   *
   * Three attack on two health, moving three, able to act the turn it lands. It is a
   * thrown knife: it kills something wounded and then dies to anything that looks at it,
   * which is the correct body for a school whose spells want a target softened first.
   */
  voltaic_hound: {
    id: 'voltaic_hound',
    name: 'Voltaic Hound',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Can move and attack the turn it is deployed. Fast, vicious, and made of paper.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'voltaic_hound' },
    keywords: ['Haste'],
    unit: {
      atk: 30,
      hp: 20,
      mov: 3,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      // Unreachable without the Growth keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * The siege engine that sets the table.
   *
   * `arcing`, so it drops its shells over walls, Guardians and its own front line without
   * needing a clear line to anything — and `rangeMin: 2`, because an arcing profile with
   * no blind spot is simply a better crossbow. It cannot depress its aim onto whatever
   * walks up to it, which is the price of shooting over everything else.
   *
   * The rider is what it is really for. One damage a turn is nothing; one damage a turn
   * that leaves the target **Charged** is a standing invitation for a Pyre or Frost card
   * to Overload or Superconduct it. A Bombardier behind a Slag-Iron Golem is a machine for
   * making somebody else's spell land twice as hard.
   *
   * Deliberately unable to cash in its own setup: the charge lands *after* its blow
   * resolves, so it can never charge and detonate a target in one swing.
   */
  clockwork_bombardier: {
    id: 'clockwork_bombardier',
    name: 'Clockwork Bombardier',
    cost: { pips: 3, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Lobber. Fires 2-4 tiles, arcing over cover, and cannot depress its aim onto anything adjacent. Whatever survives a shell is left Charged.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'clockwork_bombardier' },
    keywords: [],
    unit: {
      atk: 10,
      hp: 40,
      mov: 1,
      // The mortar profile, matching the two lobbers already in the game.
      rangeMin: 2,
      rangeMax: 4,
      footprint: 1,
      archetype: 'sniper',
      attackProfile: 'arcing',
      onHit: { status: 'charged', stacks: 1 },
      // Unreachable without the Growth keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  arc_lash: {
    id: 'arc_lash',
    name: 'Arc Lash',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'spell',
    text: 'Deal 30 shock damage to a unit. In rain, the charge arcs for 10 to everything adjacent to it.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'target' } },
    keywords: [],
  },

  // ------------------------------------------------------------ the expansion shelf

  /**
   * Tempo, spelled in the two statuses the engine already has.
   *
   * "Move an allied minion two tiles and leave it Overloaded" is two things the game does
   * not do -- there is no second target for a destination, and Overload is a *reaction*
   * rather than something a body can be carrying. Both have exact equivalents: Fleet is
   * "+1 MOV per stack, this turn only", which is a body moving two further under its own
   * power, and Charged is precisely the state a fire hit Overloads.
   *
   * Written that way it is also a better card, because the minion chooses where to go
   * after seeing the board rather than being placed by the caster.
   */
  arcing_step: {
    id: 'arcing_step',
    name: 'Arcing Step',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'An allied unit moves 2 further this turn and is left Charged. Fire Overloads it; frost Superconducts.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'fleet', stacks: 2, area: { shape: 'target' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
  },

  /**
   * A generator, and the closest real thing to an Echo.
   *
   * The brief pays this out in Echo. **Echo does not exist** -- there is no such resource
   * anywhere in the engine -- so the Wisp pays a Pip, through `creditRefund`: the one
   * thing in the game that hands a Pip over as a *reward* rather than as income, which is
   * how a reaction and Voltara's Storm Tithe both pay. It does not spend the reaction
   * budget, because that counter exists to stop a cascade funding itself and a body
   * swinging once a turn is not a cascade.
   *
   * Paid whether or not the blow drew blood: a Wisp held off by plate has still
   * discharged.
   */
  storm_wisp: {
    id: 'storm_wisp',
    name: 'Storm Wisp',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Whenever it attacks, you are paid 1 Pip.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'storm_wisp' },
    keywords: ['Haste'],
    unit: {
      atk: 10,
      hp: 20,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
      refunds: { onAttack: 1 },
    },
  },

  /**
   * A card that reads your own bank, which nothing did before.
   *
   * The threshold is checked *after* the cost is paid, because that is the number a player
   * can see on their own gauge as the card lands -- asking about the bank before payment
   * would make the card fire on a total the board never displayed.
   *
   * The second half is Arc's shape written out as an ordinary effect rather than as a
   * forced reaction. Arc proper is weather-gated and pays a Pip back; a card that could
   * summon one on a clear day would be a storm in a bottle at two Pips.
   */
  thunderhead: {
    id: 'thunderhead',
    name: 'Thunderhead',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 shock damage. If you still hold 3 or more Pips, it earths outward for 20 more to everything adjacent.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'target' } },
        {
          op: 'ifMet',
          cond: { kind: 'pipsAtLeast', pips: 3 },
          then: { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'adjacent8' } },
        },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },
};
