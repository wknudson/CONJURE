/**
 * The Frost mini-set.
 *
 * Frost is the control school: it does not out-damage Pyre, it takes away the enemy's
 * turn. Chill stacks toward a Freeze, Brittle makes the next blow land harder, and Ice
 * Barricade rewrites the board's sightlines.
 *
 * Every card here is a setup piece for a reaction: Chill feeds Vaporize, Freeze feeds
 * Shatter. On its own the set is deliberately a little underpowered — it pays off when
 * paired with the Pyre starter deck.
 */

import type { CardDef } from '../../types/cards.js';

export const FROST_CARDS: Record<string, CardDef> = {
  glacial_spike: {
    id: 'glacial_spike',
    name: 'Glacial Spike',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deal 30 frost damage to a unit and apply Chill 1. Chill 3 freezes a unit solid.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'frost', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    // Boreas' reach: the longest in the school, and the reason it can hold the back line.
    range: 5,
    needsLoS: true,
  },

  frost_nova: {
    id: 'frost_nova',
    name: 'Frost Nova',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Apply Chill 1 to every unit adjacent to the target tile, and 10 frost damage.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'frost', area: { shape: 'adjacent8' } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    // A burst, thrown short: the Companion has to commit forward to catch a cluster.
    range: 3,
    needsLoS: true,
  },

  brittle_touch: {
    id: 'brittle_touch',
    name: 'Rime Touch',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Apply Brittle 2 to a unit. A Brittle target takes +20 damage from every hit.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: { op: 'applyStatus', status: 'brittle', stacks: 2, area: { shape: 'target' } },
    keywords: [],
    // A touch, and priced like one: the Companion must be nearly on top of the target.
    range: 2,
    needsLoS: true,
  },

  /**
   * The evolution of the old Flash Freeze, which simply froze one unit.
   *
   * It now raises a coolant pillar and chills what stands beside it, which is a very
   * different card: it makes ground rather than removing a body, and the 2 Marrow it
   * strictly demands means it cannot be held in reserve and dropped from a full bank —
   * something has to have been opened up that turn to pay for it.
   */
  flash_freeze: {
    id: 'flash_freeze',
    name: 'Flash Freeze',
    cost: { bones: 1, marrow: 2 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Raise a 40 HP Coolant Pillar on an empty tile, Chilling everything orthogonally beside it.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnConstruct', obstacleDef: 'coolant_pillar', hp: 40 },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /** What Flash Freeze raises. Ordinary masonry, but it leaves rubble like the rest. */
  coolant_pillar: {
    id: 'coolant_pillar',
    name: 'Coolant Pillar',
    cost: { bones: 0, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'obstacle',
    text: 'A venting column of coolant. Blocks sight and movement; leaves rubble when broken.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: [],
    setupOnly: true,
    obstacleHp: 40,
    leavesRubble: true,
  },

  ice_barricade: {
    id: 'ice_barricade',
    name: 'Ice Barricade',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'obstacle',
    text: 'Raise a wall of ice. Blocks movement and line of sight until it is broken.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'ice_barricade' },
    obstacleHp: 50,
    leavesRubble: true,
    keywords: [],
  },

  rimeguard: {
    id: 'rimeguard',
    name: 'Rimeguard',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'rimeguard' },
    keywords: ['Guardian', 'Growth'],
    unit: {
      atk: 10,
      hp: 70,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 10 },
    },
  },

  // ------------------------------------------------------------ the expansion shelf

  /**
   * Chill, spread rather than stacked.
   *
   * A Bone for five tiles of one stack is a bad rate against any single body and a very
   * good one against a line that has bunched up, which is the decision the card exists to
   * pose. Chill is the school's whole engine -- three stacks is a Freeze, and a Freeze is
   * what Shatter and Vaporize are both waiting for -- so a cheap way to start it
   * everywhere at once is the thing Frost was missing.
   */
  creeping_rime: {
    id: 'creeping_rime',
    name: 'Creeping Rime',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Chills the target tile and everything orthogonally beside it (Chill 1).',
    target: { kind: 'entity', side: 'any', includeObstacles: false },
    effect: { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'plus', radius: 1 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A hunter, and the first body in the game that cares what its prey is carrying.
   *
   * Twenty attack is unremarkable and forty against something Chilled is most of a
   * Sentinel, which makes the Stalker a body you deploy *behind* a plan rather than as
   * one. `bonusVs` is read off the target at the moment of the swing, so it cannot chill
   * something and cash in with the same blow.
   */
  glacial_stalker: {
    id: 'glacial_stalker',
    name: 'Glacial Stalker',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Deals 20 extra damage to a Chilled or Frozen target.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'glacial_stalker' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 50,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      bonusVs: { statuses: ['chill', 'freeze'], amount: 20 },
    },
  },

  /**
   * The finisher, and the reason its condition is asked *first*.
   *
   * A Freeze applied and then tested would always find one, so the `ifMet` runs before the
   * `applyStatus` and the card reads exactly as it is written: it hits something already
   * held down, or it holds it down. Never both, which is what keeps three Bones from buying
   * a lock and a kill in one turn.
   *
   * **Pierce is the `true` damage type.** Armor is bypassed by a property of the blow in
   * this engine, not by a keyword on the caster; 50 through plate is what the brief's five
   * points of Pierce damage means once the Stat Stretch is applied.
   */
  rime_lock: {
    id: 'rime_lock',
    name: 'Rime Lock',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Freezes the target solid. If it was already Frozen, deals 50 damage through any armor instead.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'freeze' },
      then: { op: 'damage', amount: 50, dtype: 'true', area: { shape: 'target' } },
      otherwise: { op: 'applyStatus', status: 'freeze', stacks: 1, area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  // ------------------------------------------------------------ the second expansion
  //
  // Frost was already well served for spells and had almost no bodies -- two, one of which
  // is a wall. Six cards: a beam, a fog bank, a wide chill, a spire that chills the row it
  // stands in, and two bodies that finally let a Boreas hold ground with something other
  // than a Rimeguard.

  /**
   * The school's beam, and its longest reach.
   *
   * `vector: 'linear'` buys five tiles of range with a restriction: rank, file or diagonal
   * from the Companion and nothing else. It is the same geometry a Sniper's `lineOnly`
   * profile uses, so a lance is a lance whoever threw it.
   *
   * Chill on everything it passes through is what makes it more than damage — three stacks
   * freeze, so a Lance down a lane that a Creeping Rime has already crossed is a row of
   * frozen bodies waiting for a physical blow to Shatter them.
   */
  rime_lance: {
    id: 'rime_lance',
    name: 'Rime Lance',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 30 frost damage down a 3-tile line and applies Chill 1 to everything in it. Fires only along a rank, file or diagonal.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'frost', area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    range: 5,
    vector: 'linear',
    needsLoS: true,
  },

  /**
   * Sight, taken away.
   *
   * Steam fog blocks ranged line of sight through the tile, which is the one thing Frost
   * could previously only do by raising a wall somebody had to break. A fog bank costs the
   * enemy nothing to walk through and everything to shoot through, and it expires on its
   * own — so it is a tempo card rather than a construct.
   *
   * The Chill is what stops it being purely defensive: a body that walks into the bank to
   * clear the sightline is a body one stack closer to freezing.
   */
  whiteout: {
    id: 'whiteout',
    name: 'Whiteout',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Fogs a 2x2 block of tiles for 2 turns, blocking ranged line of sight through them, and Chills everything standing there.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 2 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'spawnHazard', kind: 'steam_fog', turns: 2, area: { shape: 'square', size: 2 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'square', size: 2 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Two stacks, wide, and no damage at all.
   *
   * Frost Nova chills a ring for ten; this chills a 3x3 for nothing. That is the trade, and
   * it is the right one for a school whose payoff is the *third* stack: two stacks on nine
   * tiles is a board where every body is one Creeping Rime away from frozen, and a frozen
   * board is a Shatter waiting for any physical card.
   *
   * An odd `square` centres on its origin, so this is genuinely nine tiles around the point
   * rather than a footprint anchored to a corner.
   */
  deep_winter: {
    id: 'deep_winter',
    name: 'Deep Winter',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Applies Chill 2 to everything in a 3x3 around the target tile, and deals no damage at all. The third stack freezes a unit solid.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'applyStatus', status: 'chill', stacks: 2, area: { shape: 'square', size: 3 } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The row-chiller.
   *
   * Pyre burns its row, Surge charges its row, Bloom poisons its row. This one chills it,
   * and chill is the only one of the four that *ends* in hard control: three stacks is a
   * Freeze, so a Spire left standing for three enemy turns locks the lane rather than
   * grinding it down.
   *
   * Fifty health, and it wants to be broken quickly — which is exactly the pressure a
   * control school wants to apply.
   */
  hail_spire: {
    id: 'hail_spire',
    name: 'Hail Spire',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 50 HP spire on an empty tile. At the start of each enemy turn, every enemy in its row takes Chill 1. Three stacks freeze.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'hail_spire' },
    keywords: [],
    obstacleHp: 50,
    obstacleTurnStart: { status: 'chill', stacks: 1 },
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /**
   * A body that does the school's setup for free.
   *
   * Every Frost card wants stacks on the board and every one of them costs a Bone. This costs
   * a Bone once and then chills whatever it bites for the rest of the fight — which makes it
   * the cheapest route to a Freeze in the game, and the reason a Boreas warband wants two.
   *
   * Ten attack, so it will never finish anything itself. The Fox is a setup body, and the
   * `onHit` fires after the blow and only on a survivor: it cannot chill and Shatter with
   * the same swing.
   */
  rime_fox: {
    id: 'rime_fox',
    name: 'Rime Fox',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Whatever survives its bite takes Chill 1, and the third stack freezes a unit solid.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'rime_fox' },
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
      onHit: { status: 'chill', stacks: 1 },
    },
  },

  /**
   * The elite, and the one Frost body that punishes being answered.
   *
   * Counter strikes back for its full attack whenever it is hit in melee and survives to do
   * it again, so forty attack behind eighty health is a body a bruiser cannot profitably
   * trade with. And when it does finally go down it chills everything adjacent — the
   * deathburst is the school's answer to being killed by a cluster.
   *
   * Four Bones: Tier 3, one copy, four roster points. Bought as the plan.
   */
  glacier_warden: {
    id: 'glacier_warden',
    name: 'Glacier Warden',
    cost: { bones: 4, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Counter: strikes back for its full Attack whenever it is hit in melee. When it dies, every adjacent enemy takes Chill 2.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'glacier_warden' },
    keywords: ['Counter'],
    unit: {
      atk: 40,
      hp: 80,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      deathburst: { status: 'chill', stacks: 2 },
    },
  },

  // -------------------------------------------------------------- the second bloodline
  //
  // Frost speaks for two species now — the Frost Bear that founded it and the Saltglass Seal
  // that turned up in a harbour the Magistracy closed — and two beasts drafting one identical
  // shelf is the "second one is a checkbox" problem the Grimoire draft exists to prevent.
  // These three widen the shelf enough to split it: a cheap opener, a defensive turn, and a
  // finisher that pays for the freeze the school spends three cards setting up.

  /**
   * The opener the school did not have.
   *
   * Frost's cheapest card was Rime Touch at a Bone, and it is a single-target Brittle — fine
   * as a follow-up and useless as a first move, because there is nothing to make Brittle
   * yet. Chill is what a Frost deck actually wants on turn one, on as many bodies as
   * possible, and Cold Snap is that and nothing else.
   *
   * Ten damage down a 3-tile line is not the point and is priced as if it is not. Three
   * Chills for a Bone is the point: Chill three times over is a Freeze, so this is one third
   * of a lockdown on every body the line touches.
   */
  cold_snap: {
    id: 'cold_snap',
    name: 'Cold Snap',
    cost: { bones: 1, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 frost damage in a 3-tile line and Chills everything on it.',
    target: { kind: 'line', length: 3 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'frost', area: { shape: 'line', length: 3 } },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'line', length: 3 } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Frost as armour rather than as control.
   *
   * The school is all offence-by-denial — everything it owns either slows a body or breaks
   * one — and it had no way to spend a turn *surviving* except by raising a wall and hiding
   * behind it. This is the other answer: 20 plate on the caster, and a ring of cold that
   * Chills whatever was close enough to be the reason plate was needed.
   *
   * Two Bones buys both halves deliberately. Either alone is a weak card; together they are
   * the turn a Frost player takes when the line has arrived and Deep Winter is still two
   * draws away.
   */
  hoarfrost_veil: {
    id: 'hoarfrost_veil',
    name: 'Hoarfrost Veil',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Sheathes the caster in 20 Armor and Chills everything adjacent to it.',
    target: { kind: 'none' },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 20 },
        { op: 'applyStatus', status: 'chill', stacks: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    // A Companion card declares its reach even when it goes off underfoot: the cast origin
    // is the Bound Form's tile, and the ring is the one square around it.
    range: 1,
  },

  /**
   * What the freeze was for.
   *
   * Frost spends two and three cards driving a body to Frozen and then has to hit it with
   * something *physical* to Shatter — which a caster holding a hand of spells often cannot
   * do. Calving is the school's own answer: impact damage, from a spell, so the reaction
   * table fires on the deck's own terms.
   *
   * The conditional half is enormous on purpose (50 and the ice goes) because the setup cost
   * is enormous: three Chills, or a Flash Freeze at two Bones. Against an unfrozen body it is
   * 20 impact, which is a fair three-Bone nothing and exactly the punishment for casting it
   * early.
   */
  calving: {
    id: 'calving',
    name: 'Calving',
    cost: { bones: 3, marrow: 0 },
    school: 'frost',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Frozen target, breaks the ice for 50 impact damage and 20 more to everything adjacent. Otherwise, 20 impact.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: true },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'freeze' },
      then: {
        op: 'seq',
        effects: [
          { op: 'damage', amount: 50, dtype: 'impact', area: { shape: 'target' } },
          { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'adjacent8' } },
        ],
      },
      otherwise: { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'target' } },
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * A body that does the school's setup for it.
   *
   * Every Frost card is worth more against a Chilled target and every Frost card has to
   * spend itself applying the Chill first. The Hoarhound applies it by walking up and
   * biting, which is the one resource a caster never runs out of — and four movement means
   * it reaches something on the turn it lands.
   *
   * Weak on purpose. 20 attack does not kill anything; it *marks* things, and the Companion
   * kills them.
   */
  hoarhound: {
    id: 'hoarhound',
    name: 'Hoarhound',
    cost: { bones: 2, marrow: 0 },
    school: 'frost',
    source: 'hero',
    kind: 'minion',
    text: 'Anything it strikes is left Chilled.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'hoarhound' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 40,
      mov: 4,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
      onHit: { status: 'chill', stacks: 1 },
    },
  },
};
