/**
 * The Bulwark set: holding ground, and moving other people off it.
 *
 * Bulwark is the school that wins by geometry rather than by damage. Its two existing
 * cards — Shield Bash and Stone Barricade — are both about *where* things are standing,
 * and these continue that: one is a wall that punishes being attacked, the other moves
 * everything around a point at once.
 *
 * Note on Seismic Slam being a Companion card in a school with no Companion: nothing
 * requires them to match. `castOriginCells` asks only whether the *card* is
 * `source: 'companion'`, and casts it from whichever Bound Form is on the board. So the
 * Slam is thrown by your Ignis or your Voltara, and its reach is measured from wherever
 * that beast is standing — which is the whole reason it is a Companion card rather than a
 * Hero one. A Hero card's `range` is read by nothing.
 */

import type { CardDef } from '../../types/cards.js';

export const BULWARK_CARDS: Record<string, CardDef> = {
  /**
   * The game's first source of Stun.
   *
   * `stun` has been in `StatusKind` since the beginning with every *consumer* already
   * built — `canAct` gates move and attack on it, the tick decays it, the threat
   * projection skips a stunned foe, the renderer has an icon, the glossary has an entry,
   * and the targeting layer has a refusal that names it. Every one of those was writing
   * about something no card, mark, or rider could produce. This is the missing half, and
   * it is one line of data.
   *
   * Delivered as a **rider** rather than as a spell, deliberately. Hard CC that arrives
   * on a body has to walk up, survive a turn in the open, and connect — and since the
   * gates went on `onHit`, connecting means actually wounding: armour that eats the blow
   * eats the Stun with it. A spell version would be the same effect with none of that
   * asked for.
   *
   * 1 MOV and 4 HP is the price. It threatens the tile in front of it and nothing else.
   */
  concussive_blow: {
    id: 'concussive_blow',
    name: 'Concussive Blow',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'A slab of a thing with a hammer. Whatever it wounds is Stunned: no moving, no swinging.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'concussive_blow' },
    keywords: [],
    unit: {
      atk: 20,
      hp: 40,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 10, hp: 10 },
      onHit: { status: 'stun', stacks: 1 },
    },
  },

  /**
   * The board-clearing shove.
   *
   * Aimed at a tile, so `originOf` reads the epicentre and `shoveArea` throws everything
   * *directly away* from it — the eight-way inverse of Aetheric Tether's pull. It deals no
   * damage of its own at all; every point it produces comes from what the bodies hit on
   * the way out.
   *
   * That is what makes it a positional card rather than a burst. Cast in the open it
   * scatters a formation and does nothing; cast against a wall it is the hardest single
   * hit in the game, because a shoved unit that meets masonry takes the full collision and
   * so does the masonry.
   */
  seismic_slam: {
    id: 'seismic_slam',
    name: 'Seismic Slam',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Every unit around the target tile is thrown 1 tile directly away from it. Deals no damage of its own — only what they hit. Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
    keywords: [],
    // Thrown short and by eye, like every other burst in the game.
    range: 3,
    needsLoS: true,
  },

  /**
   * The wall that hits back.
   *
   * Guardian *and* Counter is the expensive combination: attacking it head-on costs the
   * attacker its full Attack in return, and going around it means giving up the sightline
   * it is blocking. At four Pips it is Tier 3 and capped at one copy, which is correct —
   * two of these on a narrow board would make a lane simply impassable.
   *
   * No Growth. It is already the largest body a Hero can field outside a Behemoth, and
   * something this hard to remove should not also grow while you fail to remove it.
   */
  slag_iron_golem: {
    id: 'slag_iron_golem',
    name: 'Slag-Iron Golem',
    cost: { pips: 4, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it. Counter: strikes back for its full Attack whenever it is hit in melee, and survives to do it again.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'slag_iron_golem' },
    keywords: ['Guardian', 'Counter'],
    unit: {
      atk: 30,
      hp: 80,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // Worth something as an offering, but nowhere near four Pips back: a body this
      // expensive should be spent by fighting with it, not by cashing it in.
      // Unreachable without the Growth keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  // ------------------------------------------------------------ the expansion shelf

  /**
   * Both halves of what Bulwark does, on one Pip.
   *
   * Plate on a body of your choosing and a shove on everything around it -- the school's
   * two verbs, and the reason the card is a Pip rather than two: neither half is large,
   * and the value is entirely in aiming them at the same tile.
   */
  tectonic_plate: {
    id: 'tectonic_plate',
    name: 'Tectonic Plate',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 30 Armor and shoves everything beside it 1 tile away.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 30 },
        { op: 'shoveArea', distance: 1, area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 4,
  },

  /**
   * A body that gets harder for standing still, and the one place player-side growth came
   * back.
   *
   * Not Escalate. Escalate was removed from the player's side on purpose -- unbounded
   * growth on a persistent body is exactly what Auras replaced, and those cap at three
   * stacks. This plates at ten a turn and stops at `PLATE_CAP` times that, so a Guardian
   * left alone in a corner becomes genuinely hard and never becomes unkillable. It also
   * takes a turn to start, like everything else that grows.
   *
   * Guardian is what makes the plate matter: a body nobody can shoot past is a body worth
   * armouring.
   */
  stone_heart_golem: {
    id: 'stone_heart_golem',
    name: 'Stone-Heart Golem',
    cost: { pips: 3, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian. At the start of each of your turns it welds on 10 more Armor, up to 30.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'stone_heart_golem' },
    keywords: ['Guardian'],
    unit: {
      atk: 30,
      hp: 80,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      platesEachTurn: 10,
    },
  },

  /**
   * A shove that cares whether it landed.
   *
   * The collision damage is the engine's own and happens either way; what this adds is a
   * card noticing. `play.collided` is written by the shove and read by the `ifMet`, which
   * is the same one-op-tells-another pattern `titheDamage` established -- and it means the
   * Frailty is earned by aiming at a wall rather than granted for casting.
   */
  avalanche_slam: {
    id: 'avalanche_slam',
    name: 'Avalanche Slam',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves the target 2 tiles. If it slams into something, it is left Brittle.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'push', distance: 2 },
        {
          op: 'ifMet',
          cond: { kind: 'collided' },
          then: { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'target' } },
        },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  // ------------------------------------------------------------ the second expansion
  //
  // Bulwark had the thinnest spell shelf of any school -- four cards, and two of them were
  // the same shove at different sizes. What was missing was not more shoving: it was the
  // rest of the school's own vocabulary. Plate you buy outright, plate a body grows,
  // constructs that are walls rather than clocks, and the one thing a school built around
  // terrain could not previously do at all -- break somebody else's.

  /**
   * Plate, bought plainly.
   *
   * Forty armour for a Pip and no rider, which reads as strictly worse than Tectonic
   * Plate's thirty-and-a-shove until the shove is the problem: the Plate scatters the
   * cluster you were about to Slam, and half the time an armour card is cast on a body you
   * want left exactly where it is standing.
   *
   * Same price, same school, opposite geometry. That is the decision.
   */
  bastion_stance: {
    id: 'bastion_stance',
    name: 'Bastion Stance',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Gives an ally 40 Persistent Armor and moves nothing. Armor is spent before health, and does not decay.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: { op: 'grantArmor', amount: 40 },
    keywords: [],
    range: 4,
  },

  /**
   * Hard control, and the Marrow that pays for it.
   *
   * A Stun on demand is the strongest thing a card can do to a single body — a turn taken
   * off the board with no way to answer it — so it is gated the way the game gates
   * everything unanswerable: **one Marrow**, which no bank of Pips will cover. The player
   * has to have opened something up this turn.
   *
   * Concussive Blow reaches the same effect for two flat Pips and asks the body to walk up,
   * survive a round in the open and actually wound. This is that Stun bought instead of
   * earned, and the Marrow is the difference.
   */
  hammer_fall: {
    id: 'hammer_fall',
    name: 'Hammer Fall',
    cost: { pips: 2, marrow: 1 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Costs 1 Marrow, which no amount of banked Pips will cover. Deals 30 impact damage and Stuns: no moving, no swinging.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'impact', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'stun', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * The Slam, inverted.
   *
   * Seismic Slam throws everything away from a point; this drags everything toward one. The
   * ops are deliberately the pair — `shoveArea` and `pullArea` — and the difference in play
   * is the whole card: a shove scatters a line you cannot fight, a pull assembles a cluster
   * you can.
   *
   * Victims are collected before anyone moves and resolved row-then-column, so converging
   * bodies collide with whoever arrived first. A pull into a wall is collision damage the
   * enemy chose none of.
   */
  phalanx_step: {
    id: 'phalanx_step',
    name: 'Phalanx Step',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Drags everything around the target tile 1 tile toward it. They collide with whatever arrives first. Triggers standard Collision Damage (30 / 20).',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'pullArea', distance: 1, area: { shape: 'adjacent8' } },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * The school's finisher, and it is still mostly geometry.
   *
   * Forty impact into the four orthogonal neighbours and then a shove on all of them —
   * damage first, so the blow lands on the cluster as it stood rather than on whatever is
   * left after it scatters. Ordering inside a `seq` is load-bearing and this is the clearest
   * case of it in the school.
   *
   * `impact` is what Shatters ice, so a Crag Slam into a frozen line is doing two schools'
   * work with one card.
   */
  crag_slam: {
    id: 'crag_slam',
    name: 'Crag Slam',
    cost: { pips: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 40 impact damage to everything orthogonally beside the target tile, then shoves them 1 tile away. Shatters anything Frozen.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 40, dtype: 'impact', area: { shape: 'adjacentCross' } },
        { op: 'shoveArea', distance: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The first card in the game whose job is breaking a construct.
   *
   * Obstacles have always been terrain rather than allies — either side may break a pillar
   * to open a lane — but nothing was ever *good* at it. Every wall in the game came down to
   * ordinary attacks and incidental splash, which made a Barricade far better than its
   * price against a deck holding no answer.
   *
   * `side: 'any'` with obstacles included, and that is not an oversight: this will happily
   * bring down your own Iron Gate. A demolition card that could only ever help you would be
   * a strictly-better card, and the interesting version asks which wall is in the way.
   */
  siege_break: {
    id: 'siege_break',
    name: 'Siege Break',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 50 impact damage to any unit or construct, yours included. The answer to a wall you cannot walk around.',
    target: { kind: 'entity', side: 'any', includeObstacles: true },
    effect: { op: 'damage', amount: 50, dtype: 'impact', area: { shape: 'target' } },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A real wall, at last.
   *
   * Every construct in the game so far has been a clock: sixty health or less, meant to be
   * broken, asking only whether breaking it is worth the turn. Eighty is the first one that
   * is genuinely meant to *hold* — two turns of a bruiser's attention, or one Siege Break,
   * which is why the two were written together.
   *
   * Masonry, so it leaves rough ground behind. The tile stays expensive after the gate is
   * gone.
   */
  iron_gate: {
    id: 'iron_gate',
    name: 'Iron Gate',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises an 80 HP gate on an empty tile. Blocks movement and line of sight, and leaves rough ground when it finally breaks.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'iron_gate' },
    keywords: [],
    obstacleHp: 80,
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /**
   * Cover you can stand in, which is a different thing from a wall.
   *
   * `obstacleCover` blocks sight and nothing else: units walk into it and shoot out of it,
   * and a ranged body inside one is a body nothing across the board can draw a line to.
   * Bramble cover has done this in encounter terrain since the beginning; this is the first
   * time a player can raise it.
   *
   * Forty health because it is not trying to stop anybody — it is trying to hide them.
   */
  battlement: {
    id: 'battlement',
    name: 'Battlement',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises 40 HP of cover on an empty tile. Blocks line of sight but not movement — your own units may stand in it and shoot out.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'battlement' },
    keywords: [],
    obstacleHp: 40,
    obstacleCover: true,
    range: 3,
    needsLoS: true,
  },

  /**
   * The cheapest Guardian in the game.
   *
   * Ten attack means it will never kill anything, and that is the entire design: a Pip buys
   * a sightline, not a threat. Everything Bulwark wants to do needs a body nobody can shoot
   * past, and until now the cheapest was three Pips.
   */
  shieldbearer: {
    id: 'shieldbearer',
    name: 'Shieldbearer',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian: blocks line of sight behind it. A Pip for a sightline, and almost no threat at all.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'shieldbearer' },
    keywords: ['Guardian'],
    unit: {
      atk: 10,
      hp: 50,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  /**
   * A body that softens what it hits, for somebody else to finish.
   *
   * Brittle is +20 from *every* hit until it wears off, so an Ox that connects has not
   * dealt thirty damage — it has made the next two blows land for fifty. It is the school's
   * only enabler body, and it wants a warband standing behind it.
   *
   * The rider fires after the blow and only on a survivor, so it can never soften and cash
   * in with the same swing.
   */
  siege_ox: {
    id: 'siege_ox',
    name: 'Siege Ox',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Whatever survives its charge is left Brittle, taking +20 damage from every hit until it wears off.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'siege_ox' },
    keywords: [],
    unit: {
      atk: 30,
      hp: 50,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      onHit: { status: 'brittle', stacks: 1 },
    },
  },

  /**
   * The elite, and the hardest single body a player can field.
   *
   * Twenty plate a turn to the cap is sixty armour on top of ninety health, which takes
   * three turns to reach and is close to unanswerable by damage alone once it does. What
   * keeps it fair is what it cannot do: one movement, one tile of reach, and no Guardian —
   * it holds the tile it is standing on and has no opinion about any other.
   *
   * Four Pips puts it at Tier 3, one copy a deck and four roster points. It is meant to be
   * the whole plan, not part of one.
   */
  anvil_lord: {
    id: 'anvil_lord',
    name: 'Anvil Lord',
    cost: { pips: 4, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'At the start of each of your turns it welds on 20 more Armor, up to 60. Slow, short-reached, and very hard to remove.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'anvil_lord' },
    keywords: [],
    unit: {
      atk: 40,
      hp: 90,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      platesEachTurn: 20,
    },
  },

  // -------------------------------------------------------------- the second bloodline
  //
  // Bulwark speaks for the Vault Boar and now the Quarry Ram, which breaks chalk on the road
  // to Jolrek. Three cards for the split, and each one is a thing the school could nearly do
  // already: plate somebody else, drop the floor, and make a shove hurt for what it hits
  // rather than for how far it goes.

  /**
   * Armour for a body that is not the caster.
   *
   * Bulwark plates itself, plates its lane through the Shield Oath, and welds plate onto
   * bodies that bring their own — and had no way to hand 30 points to the one unit that
   * needs it this turn. Deadweight is that card and nothing else, at a Pip.
   *
   * The Exhaust is the price and it is a real one: the plated body gives up its turn. This is
   * for the Anvil Lord holding a door, not for the skirmisher who was about to strike, and
   * misreading which is which is how a player wastes it.
   */
  deadweight: {
    id: 'deadweight',
    name: 'Deadweight',
    cost: { pips: 1, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Bolts 30 Armor onto an allied body. It digs in and cannot act until your next turn.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false, requireUnexhausted: true },
    effect: {
      op: 'seq',
      effects: [
        { op: 'grantArmor', amount: 30 },
        { op: 'applyStatus', status: 'exhaust', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 3,
  },

  /**
   * The ground itself, as an attack.
   *
   * Every Bulwark area card pushes bodies away from a point. This one pulls them into one —
   * the floor gives out and everything around the hole slides in, which is the same
   * `pullArea` geometry Chimney Draw uses and a completely different card, because Bulwark
   * follows it with impact damage and Bulwark is the school the collision table was written
   * for.
   *
   * Units converging on one tile arrive in sequence and collide with whoever got there first.
   * That is the card. The 20 impact is the opening bid.
   */
  sinkhole: {
    id: 'sinkhole',
    name: 'Sinkhole',
    cost: { pips: 3, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Collapses the ground: everything within a tile of the point is dragged 1 tile into it and takes 20 impact damage. Bodies arriving on the same tile collide.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'pullArea', distance: 1, area: { shape: 'adjacent8' } },
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'adjacent8' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * A shove priced for what it leaves behind rather than for how far it throws.
   *
   * One tile, which is the shortest push in the school and looks like a downgrade on the
   * Seismic Slam until the Brittle lands. A body shoved one tile has usually not hit
   * anything; a body shoved one tile and left Brittle takes more from every blow after,
   * which is the Bulwark player's answer to an armoured line that shrugs off collisions.
   *
   * Two Pips, and the Brittle is the whole purchase. The push is there so the card still does
   * something on a turn when nothing is worth softening.
   */
  counterweight: {
    id: 'counterweight',
    name: 'Counterweight',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'companion',
    kind: 'spell',
    text: 'Shoves the target 1 tile, deals 20 impact damage, and leaves it Brittle.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'push', distance: 1 },
        { op: 'damage', amount: 20, dtype: 'impact', area: { shape: 'target' } },
        { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'target' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  /**
   * The cheap body that holds a door.
   *
   * Bulwark's shelf runs to golems and lords — good bodies, all of them expensive in Vanguard
   * points. The Quarry Hand is two points of budget with Guardian on it, which is the keyword
   * that actually makes a line a line: enemies have to deal with it before they deal with
   * what is behind it.
   *
   * 50 health and 20 attack means it is not winning any exchange it starts. It is not meant
   * to start one. It is meant to be in the way for two turns while the Companion works.
   */
  quarry_hand: {
    id: 'quarry_hand',
    name: 'Quarry Hand',
    cost: { pips: 2, marrow: 0 },
    school: 'bulwark',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian. Enemies must come through it before they reach what is behind it.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'quarry_hand' },
    keywords: ['Guardian'],
    unit: {
      atk: 20,
      hp: 50,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
    },
  },
};
