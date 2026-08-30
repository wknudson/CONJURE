import type {
  CardDefId,
  CardInstanceId,
  Coord,
  DamageType,
  Keyword,
  MarkDefId,
  School,
  Side,
  StatusKind,
  TargetRef,
  UnitId,
} from '../../contract/ids.js';
import type { UnitArchetype } from '../../contract/snapshots.js';
import type { HazardKind } from './state.js';

/**
 * Effect primitives. Card rules text compiles down to a tree of these, interpreted by
 * engine/effects.ts. Keeping cards as data (rather than closures) means the AI can read
 * a card's shape to enumerate targets, and new cards need no engine changes.
 */
/**
 * Where a revival puts the body.
 *
 * `pyre` is the exact tile it died on and is refused if anything stands there — the
 * counterplay an enemy buys by holding the ground. The two Rally sites ignore where it
 * fell, which is what lets them raise a body that died in a *previous* fight of the same
 * dungeon.
 */
export type ReviveSite = 'pyre' | 'anchor' | 'startingZone';

/** How much health a raised body comes back with. */
export type ReviveHp =
  /** A share of its ceiling per Bone of X actually paid. */
  | { mode: 'perBonePercent'; percent: number }
  /** A flat share of its ceiling. */
  | { mode: 'percent'; percent: number }
  /** An exact number, however large the body. */
  | { mode: 'fixed'; amount: number };

export type EffectNode =
  | { op: 'seq'; effects: EffectNode[] }
  | { op: 'damage'; amount: number; dtype: DamageType; area: AreaSpec }
  | { op: 'summon'; unitDef: CardDefId }
  | { op: 'spawnObstacle'; obstacleDef: CardDefId }
  /**
   * An obstacle placed with health this cast decides, rather than the card's own.
   *
   * Separate from `spawnObstacle` because a construct's durability is a property of the
   * spell that raised it — two different spells may raise the same pillar at different
   * strengths, and neither should have to be its own card definition to do so.
   */
  | { op: 'spawnConstruct'; obstacleDef: CardDefId; hp: number }
  | { op: 'attachMark'; mark: MarkDefId }
  | { op: 'push'; distance: number }
  | { op: 'grantArmor'; amount: number | { from: 'titheDamage' } }
  | { op: 'applyStatus'; status: StatusKind; stacks: number; area: AreaSpec }
  /**
   * Spend an allied body whole, to make room or to make something else of it.
   *
   * This is **not** part of the Marrow economy and never was: it pays nothing out, and the
   * one card using it converts a minion into a different minion on the same tile. Blood
   * Magic replaced *sacrifice-for-Marrow*, which is `tithe` below; kill-and-replace is a
   * separate idea that happened to share the old name.
   */
  | { op: 'consumeTarget' }
  /**
   * Blood Magic, as a card.
   *
   * Wounds an allied unit for Marrow and Exhausts it, exactly as the `bloodTithe` command
   * does — both route through one `applyTithe`, so a card can never quietly invent a
   * cheaper or crueller tithe than the rule. Cards pay above the command's rate because
   * they cost a card as well as the blood.
   */
  | { op: 'tithe'; damage: number; marrow: number }
  /**
   * Hangs an Elemental Aura on an allied unit.
   *
   * Recasting replaces whatever the unit was wearing and resets it to one stack — the old
   * Aura's stats are handed back first, so this is never a way to wear two at once.
   */
  | { op: 'attachAura'; aura: string }
  /**
   * Spends a Climaxed Aura.
   *
   * Removes the Aura and its stats, and nothing else: the burst is whatever ordinary ops
   * follow it in the card's own `seq`, so a Detonation is balanced in the same vocabulary
   * as every other spell.
   */
  | { op: 'detonateAura' }
  /**
   * Puts health back on the caster's Pact.
   *
   * Routes through `healCommander`, the one thing in the game that heals, so the ceiling
   * clamp and the silence-when-nothing-is-owed both come for free.
   */
  | { op: 'heal'; amount: number }
  /**
   * Stands a fallen Vanguard body back up.
   *
   * The raised unit is built **fresh from its definition** — a new instance with no marks,
   * no statuses, no Aura and no growth. That is what "stripped of everything" means here,
   * and implementing it as *not copying anything* is one rule rather than five.
   */
  | {
      op: 'revive';
      site: ReviveSite;
      hp: ReviveHp;
      riders?: { fleet?: number; armorFromMissingHp?: true };
    }
  /**
   * Marrow gained. A fixed number, or scaled off the blood a `tithe` just took.
   *
   * The dynamic form mirrors `grantArmor`'s, which already reads `titheDamage` — the
   * same fact, wanted by two different cards for two different purposes.
   */
  | { op: 'extractMarrow'; amount: number | { from: 'titheDamage'; max: number } }
  /** Cards drawn, obeying the hand limit and the overdraw burn like any other draw. */
  | { op: 'drawCards'; amount: number }
  /** Shoves everything in the area directly away from the point of origin. */
  | { op: 'shoveArea'; distance: number; area: AreaSpec }
  /**
   * Drags everything in the area directly toward the point of origin.
   *
   * The inverse of `shoveArea`, and interesting for the same reason a shove is not:
   * several units converging on one tile arrive in sequence, so the second and later
   * arrivals collide with whoever got there first.
   */
  | { op: 'pullArea'; distance: number; area: AreaSpec }
  | { op: 'detonateAllMarks'; bonusDamage: number }
  /** Magma Brute's on-deploy 2-tile cleave. */
  | { op: 'cleaveFront'; amount: number; dtype: DamageType; width: number }
  /**
   * Rite of Subjugation: drives the tether into the chosen unit.
   *
   * This replaced an older `bindCompanion` op that simply declared victory. Binding is no
   * longer a button you press once the beast is weak enough — it is three rounds of
   * holding on, and the win is decided by whether the anchor is still standing.
   */
  | { op: 'anchorTether' }
  /**
   * Runs `then` only if the board agrees, and `otherwise` when it does not.
   *
   * The first branching op in the game, and the one primitive most of the new catalog
   * needed: "deal damage, and if it was already Chilled, do this as well" was previously
   * unrepresentable, so a card wanting it had to be split into two cards or flattened into
   * an unconditional one.
   *
   * Deliberately a **condition, not a predicate function**. Cards stay data — a closure
   * here would put game logic in the registry and take it out of the reducer, which is the
   * one rule this file exists to hold.
   */
  | { op: 'ifMet'; cond: PlayCondition; then: EffectNode; otherwise?: EffectNode }
  /**
   * Bones paid straight into the bank, clamped at the ceiling like every other credit.
   *
   * Distinct from a reaction refund: this is a card buying tempo outright, so it does not
   * touch `reactionBonesThisTurn` and is not bounded by the two-per-turn cascade budget.
   */
  | { op: 'gainBones'; amount: number }
  /**
   * Lays terrain on the tiles an area covers.
   *
   * The counterpart to `spawnConstruct`: that one raises something with health that can be
   * broken, this one changes the ground. A hazard has no health, blocks nothing, and is
   * removed by its own clock.
   */
  | { op: 'spawnHazard'; kind: HazardKind; turns: number; area: AreaSpec }
  /**
   * Strips a status off whatever the area covers.
   *
   * The first cleanse in the game, and it exists because the reaction table has been
   * spending statuses from the start while no *card* could. A card that consumes its own
   * setup -- Plasma Arc eats two Burn to pay for its blast -- needs the same verb the
   * engine already uses internally.
   *
   * Removes the stacks outright rather than decrementing: a partial cleanse would be a
   * different and much fiddlier card than anything has asked for.
   */
  | { op: 'clearStatus'; status: StatusKind; area: AreaSpec };

/**
 * Something a card can ask about before it commits.
 *
 * Three kinds, each answering a question a card in the catalog actually asks. All three
 * are facts the reducer can read off the state it already has — nothing here needs
 * history, and nothing needs the card to have been played differently.
 */
export type PlayCondition =
  /**
   * Something is carrying at least `stacks` of this status.
   *
   * The chosen target by default. With an `area`, **anything the area covers** — which is
   * what a card aimed down a line needs, since a line target names a direction rather than
   * a body and so has no single "the target" to ask about.
   */
  | { kind: 'targetStatus'; status: StatusKind; stacks?: number; area?: AreaSpec }
  /** The caster is holding at least this many Bones, *after* the card's own cost. */
  | { kind: 'bonesAtLeast'; bones: number }
  /**
   * A shove earlier in this same card was stopped by something solid.
   *
   * Reads `play.collided`, written by the shove ops for exactly this. A body that hit a
   * wall took collision damage the engine already resolved; this is how a card gets to
   * *also* care that it happened.
   */
  | { kind: 'collided' };

/**
 * Whether an effect tree contains a given primitive anywhere, including inside `seq`.
 *
 * Targeting uses this to ask what a card would actually do to its target, rather than
 * maintaining a list of card ids that must be kept in step with the card data.
 */
export function effectContainsOp(node: EffectNode, op: EffectNode['op']): boolean {
  if (node.op === op) return true;
  if (node.op === 'seq') return node.effects.some((child) => effectContainsOp(child, op));
  return false;
}

/** Which tiles an effect touches, relative to the chosen target. */
export type AreaSpec =
  | { shape: 'target' }
  | { shape: 'line'; length: number }
  | { shape: 'adjacent8' }
  | { shape: 'plus'; radius: number }
  /**
   * A widening wedge from the caster, along the chosen direction.
   *
   * Row `n` out is `n` tiles wide either side of the axis, so depth 3 covers 1, 3 then 5
   * tiles. Requires a `line` target, which is the only one carrying a direction — a cone
   * with no facing is just a circle.
   */
  | { shape: 'cone'; depth: number }
  /** The four orthogonal neighbours, and not the diagonals. */
  | { shape: 'adjacentCross' }
  /**
   * A solid block of tiles, `size` on a side.
   *
   * Two conventions in one shape, because the two sizes are asked for by different kinds
   * of card and each wants the anchor a player would expect:
   *
   * | | |
   * |---|---|
   * | `2` | the 2x2 block whose **top-left corner** is the target, exactly the footprint a Behemoth occupies and the zone the targeting overlay already paints |
   * | odd | **centred** on the target, so a 3 covers the target and its eight neighbours |
   *
   * Anything else is a footprint no card has asked for and the resolver returns nothing
   * rather than guessing at an anchor.
   */
  | { shape: 'square'; size: number }
  /**
   * Every tile a shove earlier in this same card dragged a body across.
   *
   * Reads `play.shovePath`, written by the shove ops for exactly this. Empty when nothing
   * has been shoved yet, which makes the ordering inside a `seq` load-bearing and visible:
   * a trail laid before the push covers nothing.
   */
  | { shape: 'shovePath' }
  | { shape: 'all' }
  | { shape: 'lowestHpEnemy' };

/** What the player must pick before a card can resolve. */
export type TargetSpec =
  | { kind: 'none' }
  | { kind: 'emptyTile'; zone: 'ownTerritory' | 'any'; footprint: 1 | 2 }
  | {
      kind: 'entity';
      side: 'ally' | 'enemy' | 'any';
      includeObstacles: boolean;
      requireUnexhausted?: boolean;
      /**
       * Narrows to units carrying an Aura. `'climax'` demands a fully-grown one, which is
       * what makes a Detonation card unplayable until the fuse has actually burned down.
       */
      requiresAura?: 'any' | 'climax';
      /**
       * Narrows to units already carrying this status.
       *
       * The sibling of `requiresAura`, and it does the same job: a card whose entire point
       * is cashing in a setup should be *unplayable* until the setup exists, rather than
       * playable and wasted. Aetheric Overload asks for a Charged body and offers nothing
       * else to click.
       */
      requiresStatus?: StatusKind;
    }
  | { kind: 'adjacentEnemy' }
  | { kind: 'line'; length: number }
  | { kind: 'unitOrPortrait'; side: 'ally' }
  | { kind: 'global' }
  /**
   * Pick from your own Graveyard.
   *
   * `site` decides where the raised body lands, and therefore which entries are offerable:
   * a pyre-sited card cannot raise a body whose tile is now occupied, while the two Rally
   * sites do not care where it fell.
   */
  | { kind: 'fallen'; site: ReviveSite };

/**
 * How a unit's attacks travel, beyond how far.
 *
 * Undefined is the ordinary case: free aim within range, needing a clear line. The two
 * named profiles are what make long range interesting instead of merely strong — each
 * buys its reach with a specific, exploitable weakness.
 */
export type AttackProfile =
  /** Fires only down a straight rank, file, or diagonal. Anything on the line stops it. */
  | 'lineOnly'
  /** Lobs over everything, and so needs no line at all — but cannot hit what is close. */
  | 'arcing';

/**
 * What a unit's ordinary attack leaves behind, beyond damage.
 *
 * Deliberately a *status*, never a number: a rider that added damage would be an attack
 * stat wearing a different name, and the same reason relics have nowhere to put one
 * applies here. What this buys is setup — a body that charges what it hits is a body that
 * makes somebody else's fire spell into an Overload.
 *
 * Applied after the blow resolves and only to a survivor. Branding a corpse means nothing,
 * and it would be removed from the board in the same step.
 */
export interface OnHitRider {
  status: StatusKind;
  stacks: number;
}

export interface UnitStatBlock {
  atk: number;
  hp: number;
  mov: number;
  rangeMin: number;
  rangeMax: number;
  footprint: 1 | 2;
  archetype: UnitArchetype;
  /**
   * Extra Marrow this body yields when tithed, on top of the flat rate.
   *
   * Optional, and absent almost everywhere: a tithe pays the same base from any body, so
   * the field marks the handful bred to bleed rather than restating a zero on every stat
   * block. It is no longer a gate — nothing refuses a tithe for being worth nothing.
   */
  titheBonus?: number;
  escalationBonus: { atk: number; hp: number };
  attackProfile?: AttackProfile;
  /** A status its ordinary attacks leave on whatever survives them. */
  onHit?: OnHitRider;
  /**
   * A hazard laid on every tile this thing walks off.
   *
   * Only when it moves under its own power. Being shoved leaves nothing — a body dragged
   * by a Seismic Slam is not grinding its way forward, and letting displacement lay the
   * trail would hand the player a way to wreck their own board by pushing the wrong
   * creature around.
   */
  trail?: HazardKind;
  /**
   * Damage this body's ordinary attacks deal, when it is not `physical`.
   *
   * Absent almost everywhere, because physical is what a body swinging at another body
   * does and restating it on every stat block would be noise. Present on the handful whose
   * strikes are something else — and it is load-bearing rather than flavour, because the
   * damage type is what the whole reaction table matches on: a Wraith striking with `true`
   * bypasses plate and, deliberately, no longer Shatters ice.
   */
  attackDtype?: DamageType;
  /**
   * This body's elemental defences, beyond the one every body gets for free.
   *
   * Signed and flat, in the same multiples of ten everything else here uses: **negative
   * resists, positive is a vulnerability.** Absent almost everywhere, because a body already
   * shrugs off its own school's element by `SELF_ELEMENT_RESIST` without being asked
   * (`resistOf`, `data/elements.ts`) — this is for the exceptions that rule cannot express.
   *
   * The interesting entries are the positive ones. A resistance is a small reward for
   * bringing the wrong element; a stated weakness is a body the player can be *told* how to
   * kill, which is worth more than a number that only ever makes fights longer. A construct
   * that comes apart to impact, or a Bloom horror that burns, is a puzzle with an answer.
   */
  elementalMod?: Partial<Record<DamageType, number>>;
  /**
   * Extra damage this body's attacks deal to a target already carrying one of these.
   *
   * A hunter, in one field. Checked against the target at the moment of the swing, so it
   * cannot be set up and cashed in by the same blow — the same ordering `applyOnHit`
   * documents and for the same reason.
   */
  bonusVs?: { statuses: readonly StatusKind[]; amount: number };
  /**
   * What this body leaves on its neighbours when it dies.
   *
   * Fires wherever the death happened and whatever caused it, in the same slot an
   * obstacle's burst does. Enemies of the dead body only: a Deathburst is the corpse
   * lashing out, not a bomb.
   */
  deathburst?: { status: StatusKind; stacks: number };
  /**
   * Armor this body welds onto itself at the start of each of its owner's turns.
   *
   * **Bounded**, and that bound is the point. Player-side `Escalate` was removed on
   * purpose — unbounded growth on a persistent body is the thing Auras replaced, and they
   * cap at three stacks. This caps at `PLATE_CAP` for the same reason, so a Guardian left
   * alone in a corner becomes hard rather than unkillable.
   */
  platesEachTurn?: number;
  /**
   * Bones this body pays its owner at the two moments worth paying for.
   *
   * Paid through `creditRefund`, which is the one thing in the game that hands a Bone over
   * as a reward rather than as income — the same payment a reaction makes, announced the
   * same way on screen. It does **not** spend the reaction budget: that counter exists so
   * a cascade cannot fund itself, and a body striking once a turn is not a cascade.
   */
  refunds?: { onAttack?: number; onDeath?: number };
  /**
   * What a Feral creature goes after, when it has a choice.
   *
   * `nearest` is the default and the rule every beast followed before this: hunt whatever
   * is closest, on either side. `weakest` makes one a finisher instead — it walks past a
   * healthy body to reach a hurt one, which is a genuinely different thing to play around.
   */
  hunts?: 'nearest' | 'weakest';
}

/**
 * What a card asks for.
 *
 * Two different kinds of demand, deliberately:
 *
 *  - `bones` is generic energy. Marrow substitutes for it freely, and does so first,
 *    because Marrow evaporates at end of turn while Bones bank — so a card priced purely
 *    in Bones is still payable entirely out of a sacrifice, which is what keeps the ramp
 *    economy intact.
 *  - `marrow` is a strict requirement. Bones cannot cover it at any price. A card that
 *    asks for Marrow is asking the player to have opened something up this turn, and no
 *    amount of patient banking substitutes for that.
 */
export interface CardCost {
  bones: number;
  marrow: number;
}

/** Sorting, rarity tiers, and anywhere a card needs one comparable number. */
export function cardCostTotal(cost: CardCost): number {
  return cost.bones + cost.marrow;
}

/**
 * The five things a card can be.
 *
 * | | Whose | Where it goes |
 * |---|---|---|
 * | `spell` | Companion | drafted into a Grimoire |
 * | `ability` | Hero | the Hero Deck |
 * | `mark` | Hero | the Hero Deck |
 * | `obstacle` | Hero | the Hero Deck (shown as a Construct) |
 * | `minion` | Hero | the Vanguard Roster, never a deck |
 *
 * A union rather than a boolean pair because these are exclusive and always have been;
 * naming it makes the exhaustiveness checks in the UI and the AI fail the build when a
 * sixth kind arrives, instead of silently rendering nothing.
 */
export type CardKind = 'minion' | 'spell' | 'ability' | 'mark' | 'obstacle';

export interface CardDef {
  id: CardDefId;
  name: string;
  cost: CardCost;
  school: School;
  source: 'hero' | 'companion';
  /**
   * What the card *is*, and — for three of the five — whose half of the deck it lives in.
   *
   * `spell` is now strictly the Companion's elemental magic. A colourless utility card the
   * Hero holds is an **`ability`**, and the split is not cosmetic: `validateDeck` refuses a
   * Spell in a Hero Deck and `draftGrimoire` refuses everything *but* a Spell, so one word
   * decides which half of the fused deck a card can ever reach.
   *
   * The old union called both of them `spell`, which meant the only thing separating the
   * Hero's Shield Bash from a Companion's Flame Surge was the `school` field — a fact about
   * colour being asked to answer a question about ownership. Two facts, two fields.
   */
  kind: CardKind;
  text: string;
  target: TargetSpec;
  effect: EffectNode;
  keywords: Keyword[];
  /** Present for minion cards. */
  unit?: UnitStatBlock;
  /**
   * The obstacle this definition raises is **cover**: it blocks sight and nothing else,
   * and units may stand in it.
   *
   * On the definition rather than on the spawning op, because what a thing *is* belongs
   * with the thing. `terrain_cover` carries it too, even though encounter terrain builds
   * its obstacles directly — a definition that describes itself wrongly is how the two
   * paths drift.
   */
  obstacleCover?: true;
  /** Present for obstacle cards. */
  obstacleHp?: number;
  /**
   * What this obstacle does to the row it stands in, every turn it is still standing.
   *
   * An obstacle that *acts* rather than merely occupying, which nothing here did before:
   * a wall was a wall, and the only thing one could do was break. Scoped to a row because
   * that is the shape the board already speaks — the Companion's column, an enemy's lane —
   * and because a radius would make a construct an area-denial tool with no clean read.
   *
   * Enemies of whoever raised it, and only them.
   */
  obstacleTurnStart?: { status: StatusKind; stacks: number };
  /**
   * A stat block the engine places directly — the free Vanguard, the Companions' bodies.
   * It is never drawn, owned, offered as a reward, or put in a deck. Marking the card is
   * more durable than the list of exceptions the reward roller used to carry.
   */
  setupOnly?: true;
  /**
   * Only ever obtained at the splicing bench.
   *
   * The same guard `setupOnly` provides, for the opposite reason: this card is real and
   * playable, but it is the *product* of a sink. Letting a reward roll or the Schematic
   * shelf hand one over would give away for free the thing the Forge exists to charge
   * for — which is exactly how Rank 2 printings leaked before `isObtainable` caught them.
   */
  /**
   * A variable price, paid in Bones at cast time.
   *
   * The card's own `cost.bones` is **ignored** when this is set: X *is* the price. A
   * declared X of zero is illegal — a free revival would make every death a 20%-health
   * inconvenience rather than a loss — and `max` is the ceiling the player may declare.
   *
   * Marrow is untouched by X, the same way it is untouched by a discount: it is a strict
   * requirement rather than a price, and scaling it would let a card demand more of the
   * one resource nobody can bank.
   */
  xCost?: { max: number };
  spliceOnly?: true;
  /** Paid to whoever breaks this obstacle. Present only on obstacle cards. */
  onDestroyReward?: { marrow: number };
  /** Paid to whoever kills this creature. What makes a scavenger worth chasing. */
  bounty?: { marrow: number };
  /**
   * Breaking this leaves rough ground behind, rather than clearing the tile outright.
   *
   * Masonry does; a geode or a crystal shatters into nothing worth walking around. Opt-in
   * so that "what does this leave" is a property of the thing, not a rule about its size.
   */
  leavesRubble?: true;
  /**
   * What this obstacle does to everything around it when it breaks.
   *
   * Indiscriminate by design: a crystal does not know whose army is standing next to it,
   * which is what makes shooting one a decision rather than a free removal spell.
   */
  obstacleDeath?: {
    status: StatusKind;
    stacks: number;
    damage?: number;
  };
  /**
   * How far from the Companion's Bound Form this may be cast, as a Chebyshev distance.
   *
   * Only meaningful on `source: 'companion'` cards: the Hero is off-grid and has no
   * position to measure from, so its cards reach the whole board. Leaving this undefined
   * keeps a card global, which is how every card behaved before origins existed.
   */
  range?: number;
  /** Whether the cast also needs an unblocked line from the Bound Form. */
  needsLoS?: boolean;
  /**
   * Closest the cast may land, as a Chebyshev distance from the origin.
   *
   * A mortar's blind spot, expressed for spells. Undefined means no minimum, which is
   * how every card behaved before. Sits here beside `range` rather than inside the
   * `TargetSpec` union because reach is a property of the cast, not of what is being
   * picked — the union describes *what* is legal, these two describe *where*.
   */
  minRange?: number;
  /**
   * Whether the cast is confined to a rank, file or diagonal from the origin.
   *
   * The spell-side spelling of `attackProfile: 'lineOnly'`, and deliberately the same
   * geometry, so a beam is a beam whether a unit or a card threw it. Undefined is
   * `omni` — free aim within range.
   */
  vector?: 'omni' | 'linear';
}

/*
 * There is no `rank2` field, and its absence is the design.
 *
 * A Rank 2 printing used to be a hand-written diff hanging off the card — a cheaper cost
 * here, a longer reach there — and five cards in the whole game had one. It is now derived
 * arithmetic: +10% to every number the card deals, and nothing else moves. See
 * `data/ascension.ts`. Nothing to author means nothing to forget, and nothing a Rank 2
 * can change that a player would have to re-learn.
 */

/**
 * What a Grimoire spell rolled on the beast that carries it.
 *
 * The randomness moved. Catching a Companion never decided *which* cards you got — the
 * eight are fixed by species — so what makes one Boreas worth keeping over another is what
 * its eight spells rolled. Every field is a delta rather than an absolute, so a modifier
 * can be read without knowing the card it sits on.
 */
export interface CardModifier {
  /** Cheaper (negative) or dearer. Never takes a card below zero. */
  boneCostDelta?: number;
  /** Added to every damage number the card deals. */
  bonusDamage?: number;
  /** Grants Retain: it stays in hand at end of turn. */
  grantRetain?: boolean;
}

export interface CardInstance {
  instanceId: CardInstanceId;
  defId: CardDefId;
  /** Sits outside the hand limit and cannot be discarded. */
  ephemeral?: boolean;
  /**
   * What this particular copy rolled, if it came out of a Companion's Grimoire.
   *
   * On the **instance** rather than the definition, which is the whole reason this works:
   * the same `flame_surge` def can be dealt cheap from one beast and ordinary from another
   * in the same fight, and nothing global has to change for it. Absent on every Hero Deck
   * card — those are the half that does not roll.
   */
  mods?: CardModifier;
}

/** A resolved target selection passed into effect execution. */
export type ChosenTarget =
  | { kind: 'tile'; at: Coord }
  | { kind: 'entity'; ref: TargetRef }
  | { kind: 'line'; from: Coord; dir: Coord }
  | { kind: 'global' }
  /**
   * A body in the Graveyard, by its index in the caster's roster.
   *
   * An index rather than a def id because a warband may hold two of the same body, and
   * "raise a Grave Sentinel" would be ambiguous about which pyre it meant.
   */
  | { kind: 'fallen'; rosterIndex: number }
  | { kind: 'none' };

export interface CardPlayContext {
  side: Side;
  casterAnchor?: Coord;
  chosen: ChosenTarget;
  /**
   * Health a `tithe` in this same play actually took off a body.
   *
   * The *landed* wound, not the amount asked for, so a card scaling off it cannot be paid
   * for damage a 2-HP body was never able to absorb. This is what lets Harvest the Weak
   * keep its old identity -- "Marrow equal to its remaining health, up to 4" -- with no
   * special case: the cap is the tithe's damage and the floor is what the body had.
   */
  titheDamage?: number;
  /** The X actually paid, for a variable-cost card. Absent on every other card. */
  x?: number;
  /**
   * What the copy being played rolled, if it came out of a Grimoire.
   *
   * Read by the ops that deal numbers, so a rolled `bonusDamage` reaches every hit the
   * card makes without any op needing to know a Companion exists.
   */
  mods?: CardModifier;
  summonedUnitId?: UnitId;
  /**
   * The obstacle this card just raised, for the ops that come after it.
   *
   * The counterpart to `summonedUnitId`, and needed for the same reason: a card aimed at
   * an *empty tile* has no entity in `chosen`, so anything downstream that wants to touch
   * what was just built — attaching a mark to it, most obviously — has no other way to
   * name it. Without this a `seq` of "raise a cask, then wire it" silently raises an
   * unwired cask.
   */
  spawnedObstacleId?: UnitId;
  /**
   * Whether a shove earlier in this same play was stopped by something solid.
   *
   * Written by the shove ops and read by the `collided` condition. On the context for the
   * same reason `titheDamage` is: it is a fact one op produced that a later op in the same
   * `seq` wants, and threading it here keeps both ops ignorant of each other.
   */
  collided?: boolean;
  /**
   * Tiles a shove earlier in this same play dragged a body across, in order.
   *
   * Written by the shove ops and read by the `shovePath` area. Accumulates across several
   * shoves in one card rather than being replaced, so an area shove that moves four bodies
   * lays one trail covering all four routes.
   */
  shovePath?: Coord[];
  /**
   * The tile a `consumeTarget` or a lethal `tithe` just emptied.
   *
   * The third of these handoffs, and the same shape as the other two. A card that offers
   * up a body and then puts something in its place has to name that place, and the body
   * is gone by the time the second op runs — so the tile is remembered at the moment it
   * is vacated rather than looked up afterwards.
   */
  vacatedAt?: Coord;
}
