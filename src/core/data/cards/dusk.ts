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
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'spell',
    text: 'A held breath of black smoke. Blocks line of sight; anyone may walk into it.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnConstruct', obstacleDef: 'smoke_bank', hp: 30 },
    keywords: [],
  },

  /** What the Bomb raises. Never drawn, never owned — the card is the only way to it. */
  smoke_bank: {
    id: 'smoke_bank',
    name: 'Smoke Bank',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'obstacle',
    text: 'Blocks sight but not movement. Units may stand in it.',
    target: { kind: 'none' },
    effect: { op: 'seq', effects: [] },
    keywords: [],
    setupOnly: true,
    obstacleHp: 30,
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
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Haste. Jolted upright and already moving. It does not remember what it was.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'galvanic_revenant' },
    keywords: ['Haste'],
    setupOnly: true,
    unit: {
      atk: 20,
      hp: 30,
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
   * so a Ghoul **cannot be cashed in on the turn it lands**. One Bone does not buy two
   * Marrow now; it buys two Marrow next turn, if the thing is still standing. A board that
   * can reach it has a turn in which to answer.
   */
  ash_ghoul: {
    id: 'ash_ghoul',
    name: 'Ash-Ghoul',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Dormant: cannot act the turn it is summoned, and so cannot be tithed until the next one. Cannot move, ever. Bled for +1 Marrow above the usual.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'ash_ghoul' },
    keywords: ['Dormant'],
    unit: {
      // The whole point of the card, and the same premium the Marrow Wisp charges — bought
      // here with immobility and a turn of waiting rather than with a Bone and mobility.
      titheBonus: 1,
      atk: 20,
      hp: 20,
      mov: 0,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      // The whole point of the card, and the same number the Marrow Wisp pays — bought
      // here with immobility and a turn of waiting rather than with a Bone and mobility.
      // Unreachable without the Growth keyword; the stat block demands the field anyway.
      escalationBonus: { atk: 0, hp: 0 },
    },
  },

  // ------------------------------------------------------------ the expansion shelf

  /**
   * A body spent, and the drain aimed by the board rather than by the caster.
   *
   * "Sacrifice an ally to drain an enemy" wants two targets and the game gives a card one.
   * `lowestHpEnemy` is the resolution, and it is the better card: the siphon finishes
   * whatever is already dying, so the decision is *when* to spend the body rather than
   * which corpse to point it at.
   *
   * `consumeTarget` and not `tithe` -- deliberately. Blood Magic replaced sacrifice-for-
   * Marrow; this pays no Marrow at all and spends the body whole, which is the other,
   * older idea that happened to share the name.
   */
  shadow_siphon: {
    id: 'shadow_siphon',
    name: 'Shadow Siphon',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Spends an allied unit whole. The weakest enemy loses 30 health through any armor, and your Pact recovers 30.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'consumeTarget' },
        { op: 'damage', amount: 30, dtype: 'true', area: { shape: 'lowestHpEnemy' } },
        { op: 'heal', amount: 30 },
      ],
    },
    keywords: [],
    range: 4,
  },

  /**
   * A wall that pays for its own death.
   *
   * Zero attack is not a drawback here, it is the entire design: the Husk exists to be
   * shot, and Guardian is what makes the enemy shoot it. Two Bones come back when it falls,
   * so a body that traded itself for two enemy turns of shooting has also funded the
   * answer.
   *
   * **Hollow pays Bones, because Echo does not exist.** The brief's "+2 Echoes when killed"
   * has no resource behind it anywhere in the engine; `creditRefund` is the real payment
   * of that shape, and it is the same one a landed reaction makes.
   */
  hollowed_husk: {
    id: 'hollowed_husk',
    name: 'Hollowed Husk',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Guardian. It cannot strike. When it dies, you are paid 2 Bones.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'hollowed_husk' },
    keywords: ['Guardian'],
    unit: {
      atk: 0,
      hp: 40,
      mov: 1,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      refunds: { onDeath: 2 },
    },
  },

  /**
   * One body traded for a better one, on the tile it was standing on.
   *
   * The Aetheric Defibrillator's shape, at a school price rather than a splicing one: the
   * Defibrillator is a hybrid and demands an *un-exhausted* body, which makes it a tempo
   * card. This one takes anything, which makes it a way to cash in something already
   * spent.
   */
  grave_call: {
    id: 'grave_call',
    name: 'Grave Call',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Spends an allied unit whole. A Hollow Wraith stands up on the same tile, striking through any armor.',
    target: { kind: 'entity', side: 'ally', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [{ op: 'consumeTarget' }, { op: 'summon', unitDef: 'hollow_wraith' }],
    },
    keywords: [],
    range: 4,
  },

  /**
   * What Grave Call raises.
   *
   * **Pierce is `attackDtype: 'true'`,** and that is not only an upside. Armor stops being
   * a problem and so does the whole physical half of the reaction table: a Wraith cannot
   * Shatter a Frozen body, because Shatter is what a *physical* blow does to ice. Trading
   * a reaction for plate-ignoring is the actual decision the card poses.
   */
  hollow_wraith: {
    id: 'hollow_wraith',
    name: 'Hollow Wraith',
    cost: { bones: 0, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Its strikes pass through armor entirely — and, being no longer physical, they no longer Shatter ice.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'hollow_wraith' },
    keywords: [],
    setupOnly: true,
    unit: {
      atk: 40,
      hp: 40,
      mov: 2,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'bruiser',
      escalationBonus: { atk: 0, hp: 0 },
      attackDtype: 'true',
    },
  },

  // -------------------------------------------------------------------- decay
  //
  // Three cards, and the reason they were unwritable until now is worth stating.
  //
  // Dusk was the only school with no status of its own. Pyre has Burn, Frost has
  // Chill/Freeze/Brittle, Surge has Charged, Bloom has Toxin and Entangle, Bulwark has armour
  // and Stun. Dusk's payload is **Marrow** — and Marrow is a resource, not a status. That is
  // not a flavour observation, it is why four hooks every other school got were closed to this
  // one: `obstacleTurnStart` is typed `{ status, stacks }` with nowhere to put a resource, so a
  // Dusk construct could not be built at all. Dusk had no construct, and no area card either.
  //
  // So Dusk gets a second pillar beside Marrow: **decay, spelled as `brittle`**. Borrowed
  // rather than invented, and defensible — Brittle is "+20 from every hit until it wears off",
  // which is what decay *is*, and the one Climax trait reserved for this school (`hollow`,
  // `data/auras.ts`) is described as frail-strike, the same idea from the other end. One card
  // lays it, one cashes it, one spreads it.
  //
  // The shelf needed this for a second reason: five of Dusk's seven spells spend a body, which
  // made the school a single move played at different prices.

  /**
   * Dusk's first construct, and the school's first standing threat.
   *
   * Every other school has an obstacle that ticks its own status onto the row it occupies —
   * the Pyre Pillar burns, the Hail Spire chills, the Tesla Pylon charges, the Briar Rampart
   * poisons. Dusk had nothing to tick, so it had no pillar. Brittle is what it ticks: a row
   * left standing beside this is a row where every blow lands twenty harder, which is the
   * whole of what Dusk means by decay.
   *
   * Fifty health, matching the Spire and the Rampart. It is a clock the enemy has to answer,
   * and answering it costs the turn that is the actual price of the card.
   *
   * **Not `spawnConstruct`.** Smoke Bomb puts its health on the spell because smoke is a held
   * breath and the caster's `bonusObstacleHp` should thicken it. Masonry is masonry: the health
   * belongs to the definition, which is also what `spawnObstacle` requires.
   */
  charnel_pillar: {
    id: 'charnel_pillar',
    name: 'Charnel Pillar',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'obstacle',
    text: 'Raises a 50 HP cairn of bone on an empty tile. At the start of each enemy turn, every enemy in its row is left Brittle — taking +20 damage from every hit until it wears off.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: { op: 'spawnObstacle', obstacleDef: 'charnel_pillar' },
    keywords: [],
    obstacleHp: 50,
    obstacleTurnStart: { status: 'brittle', stacks: 1 },
    leavesRubble: true,
    range: 3,
    needsLoS: true,
  },

  /**
   * The cash-in, at the cheapest price the game charges for one.
   *
   * The house pattern, fourth time it has been used and the first time for Dusk: Stoke reads
   * Burn, Rime Lock reads Freeze, Spore Burst reads Toxin, and this reads Brittle. A Bone buys
   * either a genuine finisher or a stack of setup, and which one it buys is a fact about the
   * board rather than about the card.
   *
   * `true` on the paid branch, because Brittle is a *damage-taken* multiplier and pairing it
   * with a blow armour could eat would be the card arguing with itself. Thirty rather than
   * Spore Burst's forty: one stack of Brittle is a great deal easier to arrange than two
   * stacks of Toxin, and the Charnel Pillar arranges it for free every turn.
   */
  wither: {
    id: 'wither',
    name: 'Wither',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Against a Brittle target, deals 30 damage through any armor. Otherwise it merely leaves the target Brittle.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'ifMet',
      cond: { kind: 'targetStatus', status: 'brittle' },
      then: { op: 'damage', amount: 30, dtype: 'true', area: { shape: 'target' } },
      otherwise: { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'target' } },
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Dusk's first area card, of any kind.
   *
   * Seven spells and not one of them touched more than a single body — every one was a trade
   * aimed at a specific thing, which is a school that can answer a duel and never a board.
   * This is the correction, and it is deliberately the *cheap* shape rather than a finisher:
   * twenty through armour is a rounding error on its own, and four bodies each taking twenty
   * more from everything that follows is the turn that wins the next one.
   *
   * Orthogonal and tile-aimed, matching Spore Cloud and Static Arc, so the three read as one
   * geometry the player has already learned. The diagonals are the restraint.
   */
  creeping_decay: {
    id: 'creeping_decay',
    name: 'Creeping Decay',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 20 damage through any armor to everything orthogonally beside the target tile, and leaves it all Brittle.',
    target: { kind: 'emptyTile', zone: 'any', footprint: 1 },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 20, dtype: 'true', area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'brittle', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 3,
    needsLoS: true,
  },

  // -------------------------------------------------------------- the second bloodline
  //
  // Dusk speaks for the Carrion Stag and now for the Barrow Jackal, which digs at the edge of
  // a necropolis the Magistracy posts no maps of. Three cards, and one of them is the school
  // finally getting its own body back off the floor: Dusk has spent the whole game feeding
  // corpses to other cards and has never once picked one up.

  /**
   * The cheapest thing in the school, and the one that makes its clock tick faster.
   *
   * Dusk's decay shelf is slow by design and slow decks need a card that costs almost
   * nothing to keep the pressure on while the expensive half assembles. A Pall is a Bone for
   * two bodies' worth of rot — 10 through plate, because a pall does not care what anyone is
   * wearing, and a Toxin stack on each so the Blight and the Creeping Decay find them
   * already rotting.
   */
  pall: {
    id: 'pall',
    name: 'Pall',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Deals 10 damage through any armor to the target and everything orthogonally beside it, and leaves it all poisoned (Toxin 1).',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 10, dtype: 'true', area: { shape: 'target' } },
        { op: 'damage', amount: 10, dtype: 'true', area: { shape: 'adjacentCross' } },
        { op: 'applyStatus', status: 'toxin', stacks: 1, area: { shape: 'adjacentCross' } },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * The drain, finally pointed the other way.
   *
   * Every siphon in the school takes health off a body and gives the caster Marrow. This one
   * takes it off a body and gives the caster *health*, which the school has never had a way
   * to do — a Dusk player's Pact bleeds all game from its own tithes and there was no card
   * anywhere in the colour that put a single point back.
   *
   * Priced at two Bones and 30 for 20, deliberately a losing trade in raw numbers. It is not
   * bought for the damage; it is bought on the turn the Pact is low enough that the fight
   * ends without it.
   */
  last_rites: {
    id: 'last_rites',
    name: 'Last Rites',
    cost: { bones: 2, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Drains 30 decay damage out of the target and puts 20 back on your Pact.',
    target: { kind: 'entity', side: 'enemy', includeObstacles: false },
    effect: {
      op: 'seq',
      effects: [
        { op: 'damage', amount: 30, dtype: 'decay', area: { shape: 'target' } },
        { op: 'heal', amount: 20 },
      ],
    },
    keywords: [],
    range: 4,
    needsLoS: true,
  },

  /**
   * Dusk picking a body up instead of putting one down.
   *
   * The school's whole relationship with its own dead has been one-directional — Grave Call
   * spends a living ally to make a Wraith, Harvest and the tithes spend bodies for Marrow —
   * and `revive` has existed the whole time, used by Bulwark's rallies. A necropolis
   * bloodline that could not exhume anything was a gap with a joke in it.
   *
   * Raised at the starting zone rather than where it fell, at half health, stripped of
   * everything: no marks, no statuses, no Aura, no growth — that is what `revive` does by
   * construction, and it is the reason three Bones is a fair price for a body that might have
   * cost four.
   */
  exhume: {
    id: 'exhume',
    name: 'Exhume',
    cost: { bones: 3, marrow: 0 },
    school: 'dusk',
    source: 'companion',
    kind: 'spell',
    text: 'Digs a fallen Vanguard body out of the ground. It stands up in your starting zone at half health, stripped of everything it was carrying.',
    target: { kind: 'fallen', site: 'startingZone' },
    effect: {
      op: 'revive',
      site: 'startingZone',
      hp: { mode: 'percent', percent: 50 },
    },
    keywords: [],
  },

  /**
   * A body bought to be spent.
   *
   * One Bone, 20 health, and a `titheBonus` — the Crow exists to be bled. Dusk's economy runs
   * on Blood Magic and the school has never had a cheap body bred for it: tithing a Grave
   * Sentinel works and costs two Bones of Vanguard budget to set up, which makes the Marrow
   * expensive.
   *
   * It also flies, after a fashion — four movement and no attack worth the name. A Crow that
   * is not tithed is a Crow standing somewhere annoying, which is a fair second use.
   */
  carrion_crow: {
    id: 'carrion_crow',
    name: 'Carrion Crow',
    cost: { bones: 1, marrow: 0 },
    school: 'dusk',
    source: 'hero',
    kind: 'minion',
    text: 'Bleeds well. Yields extra Marrow when tithed.',
    target: { kind: 'emptyTile', zone: 'ownTerritory', footprint: 1 },
    effect: { op: 'summon', unitDef: 'carrion_crow' },
    keywords: [],
    unit: {
      atk: 10,
      hp: 20,
      mov: 4,
      rangeMin: 1,
      rangeMax: 1,
      footprint: 1,
      archetype: 'skirmisher',
      escalationBonus: { atk: 0, hp: 0 },
      titheBonus: 1,
    },
  },
};
