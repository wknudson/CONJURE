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
   * is an aligned type for Cinder Mark, so a Static Arc into a branded cluster detonates
   * the marks as well as charging the survivors. `shock` would not have.
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
      // No `onHit: charged` rider, and its absence is load-bearing.
      //
      // A Surge body swings with `shock` now that a strike carries its school's element, and
      // `dealDamage` already leaves 1 Charged on any unit a shock hit survives. A rider here
      // would be the card paying for something the engine hands it free — and it measurably
      // did: with both in place every one of these bodies branded its target twice, and three
      // tests caught it at two stacks. Same trap the Arc Mark's docblock records dodging.
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

  // ------------------------------------------------------------ the second expansion
  //
  // Surge's problem was that `charged` is a setup status and Surge had almost nothing to
  // cash it with. Overload and Superconduct both need somebody *else's* card -- fire or
  // frost -- so a mono Voltara deck laid charges all game and waited for an ally who was
  // never coming. Four of the ten below read `charged` themselves, which finally makes the
  // school's own status worth applying.

  /**
   * The school cashing its own setup, at last.
   *
   * Every other Surge card lays `charged` and hands the payoff to a Pyre or Frost ally.
   * This one reads it: a Charged target takes the full jolt and everything around it takes
   * the spill, and an uncharged one takes a Pip's worth of nothing much.
   *
   * The conditional is checked against the chosen body at the moment the node runs, so a
   * Static Arc earlier in the same turn arms this — but a Static Arc later in the same
   * `seq` would not, which is the ordering rule every conditional in the game follows.
   */
  discharge: {
    id: 'discharge',
    name: 'Discharge',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Charged target, deals 40 shock damage and 20 more to everything adjacent. Otherwise only 20.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'charged' },
      then: {
        op: 'seq',
        effects: [
          { op: 'damage', amount: 40, dtype: 'shock', area: { shape: 'target' } },
          { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'adjacent8' } },
        ],
      },
      otherwise: { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Hard control, Marrow-gated, and it asks for the setup as well.
   *
   * Two prices on one card. The Marrow is what the game charges for a Stun — a turn taken
   * off the board with no answer — and `requiresStatus` is what makes it a *Surge* Stun
   * rather than a colourless one: the card is unplayable, greyed out, unclickable, until
   * something on the board is Charged.
   *
   * That second gate is the reason it is only two Pips. A card that demanded both the
   * Marrow and the setup and still cost three would never be worth the slot.
   */
  paralytic_arc: {
    id: 'paralytic_arc',
    name: 'Paralytic Arc',
    cost: { pips: 2, marrow: 1 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Costs 1 Marrow, and can only be aimed at a Charged unit. Deals 20 shock damage and Stuns it: no moving, no swinging.',
    target: {
      kind: 'entity',
      side: 'enemy',
      includeObstacles: false,
      requiresStatus: 'charged',
    },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'shock', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'stun', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A line rather than a burst, and the school's reach.
   *
   * `vector: 'linear'` confines the cast to a rank, file or diagonal from the Companion —
   * the spell-side spelling of a Sniper's `lineOnly` profile, and deliberately the same
   * geometry, so a beam is a beam whoever threw it. Five tiles is the longest reach in the
   * school and it is bought with that restriction.
   *
   * Shock, so everything it leaves standing is Charged. A Chain Bolt down a lane is four
   * bodies armed for a Discharge.
   */
  chain_bolt: {
    id: 'chain_bolt',
    name: 'Chain Bolt',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 shock damage down a 3-tile line, and shock leaves everything it touches Charged. Fires only along a rank, file or diagonal.',
    target: { kind: 'line', length: 3 },
    effect: { op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'line', length: 3 } },
    keywords: [],
    range: 5,
    vector: 'linear',
    needsLoS: true,
  },

  /**
   * Tempo bought for the whole warband instead of one body.
   *
   * Arcing Step gives one ally two tiles and a charge; this gives every ally beside a tile
   * one tile each. Same school, same status, different shape — and the cross rather than
   * the full ring because a card that hastened eight bodies for a Pip would decide games on
   * the turn it was drawn.
   *
   * The `charged` is not a drawback here even though it lands on your own units: nothing in
   * the enemy's deck reads it unless they brought fire or frost, and Surge is betting they
   * did not.
   */
  galvanic_rally: {
    id: 'galvanic_rally',
    name: 'Galvanic Rally',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Every unit orthogonally beside the target tile moves 1 further this turn and is left Charged.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'applyStatus', status: 'fleet', stacks: 1, area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'charged', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * The school's finisher, and the widest charge in the game.
   *
   * Three Pips for a 3x3 of damage and charge, centred on the tile — an odd `square` centres
   * on its origin, which is the convention that makes this read as a storm breaking over a
   * point rather than as a Behemoth's footprint.
   *
   * Anything that survives is armed, which is the Surge promise: the finisher is also the
   * setup for next turn. That charge comes from `dealDamage` rather than from a rider here —
   * a `shock` hit already leaves one Charged on every survivor, and adding an `applyStatus`
   * would quietly land two. Static Arc solves the same problem the other way round, dealing
   * `spell` precisely so its own rider is the only source.
   */
  tempest_break: {
    id: 'tempest_break',
    name: 'Tempest Break',
    cost: { pips: 3, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 shock damage in a 3x3 around the target tile, and shock leaves every survivor Charged.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'damage', amount: 30, dtype: 'shock', area: { shape: 'square', size: 3 },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A construct that arms the row it stands in.
   *
   * The Pyre Pillar burns the row and the Briar Rampart poisons it; this one charges it,
   * and a charge does nothing at all on its own. That is what makes the Pylon a *Surge*
   * construct rather than a reskin: it deals no damage ever, and it turns the enemy's whole
   * lane into targets for a Discharge, a Paralytic Arc, or an ally's fire.
   *
   * Forty health. It is a threat that has to be answered and never a wall.
   */
  tesla_pylon: {
    id: 'tesla_pylon',
    name: 'Tesla Pylon',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 40 HP pylon on an empty tile. At the start of each enemy turn, every enemy in its row is left Charged. Deals no damage itself.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'tesla_pylon' },
    keywords: [],
    obstacleHp: 40,
    obstacleTurnStart: { status: 'charged', stacks: 1 },
    range: 3,
    needsLoS: true,
  },

  /**
   * The cheapest way to arm something.
   *
   * A Pip, three movement, and Haste: it exists to run at whatever needs charging and
   * connect this turn. Ten attack will not kill anything, and the Hare is not trying to —
   * it is trying to make somebody else's card hit for forty.
   */
  static_hare: {
    id: 'static_hare',
    name: 'Static Hare',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Whatever survives its bite is left Charged. Fire Overloads a Charged target; frost Superconducts.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'static_hare' },
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
      // No `onHit: charged` rider, and its absence is load-bearing.
      //
      // A Surge body swings with `shock` now that a strike carries its school's element, and
      // `dealDamage` already leaves 1 Charged on any unit a shock hit survives. A rider here
      // would be the card paying for something the engine hands it free — and it measurably
      // did: with both in place every one of these bodies branded its target twice, and three
      // tests caught it at two stacks. Same trap the Arc Mark's docblock records dodging.
    },
  },

  /**
   * A body that pays for the card that summoned it, eventually.
   *
   * A Pip back when it dies, which is the other half of the Wisp's bargain — that one pays
   * on every swing and this one pays once, for going down. Two Pips in and one Pip out
   * makes a Coil a one-Pip body that spent a turn as a wall first.
   *
   * `refunds.onDeath` fires whatever killed it, including a tithe, which is the interaction
   * worth knowing: bleeding your own Coil pays Marrow *and* a Pip.
   */
  voltaic_coil: {
    id: 'voltaic_coil',
    name: 'Voltaic Coil',
    cost: { pips: 2, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'When it dies — however it dies — you are paid 1 Pip.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'voltaic_coil' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 50,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      refunds: { onDeath: 1 },
    },
  },

  /**
   * The lightning rod: a body that charges everything that touches it, by dying.
   *
   * Deathburst arms every adjacent enemy at once, which is the widest `charged` application
   * in the school and the only one that costs no card. A Rod traded into a cluster is a
   * Discharge or an ally's fire spell hitting three bodies for full.
   *
   * Zero movement, because a bomb that walks itself into position is a very different price.
   */
  storm_rod: {
    id: 'storm_rod',
    name: 'Storm Rod',
    cost: { pips: 1, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Cannot move, ever. When it dies, every adjacent enemy is left Charged.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'storm_rod' },
    keywords: [],
    unit: {
      atk: 10,
      hp: 40,
      mov: 0,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'caster',
      escalationBonus: { atk: 0, hp: 0 },
      deathburst: { status: 'charged', stacks: 1 },
    },
  },

  /**
   * The elite, and the only Surge body that threatens at range.
   *
   * Fifty attack out to three tiles, and every survivor left Charged — a Dynamo behind a
   * Guardian arms the enemy line from safety and then a Discharge collects. It is the
   * school's whole plan in one body, which is what four Pips and a single copy a deck are
   * for.
   *
   * One movement. It sets up where you put it and does not reposition.
   */
  arc_dynamo: {
    id: 'arc_dynamo',
    name: 'Arc Dynamo',
    cost: { pips: 4, marrow: 0 },
    school: 'surge',
    source: 'hero',
    kind: 'minion',
    text: 'Strikes up to 3 tiles away, and whatever survives is left Charged. Slow to move, and the whole reason to bring a Discharge.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'arc_dynamo' },
    keywords: [],
    unit: {
      atk: 50,
      hp: 60,
      mov: 1,
      rangeMin: 1,
      rangeMax: 3,
      footprint: 1,
      archetype: 'sniper',
      escalationBonus: { atk: 0, hp: 0 },
      // No `onHit: charged` rider, and its absence is load-bearing.
      //
      // A Surge body swings with `shock` now that a strike carries its school's element, and
      // `dealDamage` already leaves 1 Charged on any unit a shock hit survives. A rider here
      // would be the card paying for something the engine hands it free — and it measurably
      // did: with both in place every one of these bodies branded its target twice, and three
      // tests caught it at two stacks. Same trap the Arc Mark's docblock records dodging.
    },
  },
};
