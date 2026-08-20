import type {
  CardDefId,
  CardInstanceId,
  Coord,
  DamageType,
  Keyword,
  RuneDefId,
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
  /** A share of its ceiling per Pip of X actually paid. */
  | { mode: 'perPipPercent'; percent: number }
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
  | { op: 'attachRune'; rune: RuneDefId }
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
   * The raised unit is built **fresh from its definition** — a new instance with no runes,
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
  | { op: 'detonateAllRunes'; bonusDamage: number }
  /** Magma Brute's on-deploy 2-tile cleave. */
  | { op: 'cleaveFront'; amount: number; dtype: DamageType; width: number }
  /**
   * Rite of Subjugation: drives the tether into the chosen unit.
   *
   * This replaced an older `bindCompanion` op that simply declared victory. Binding is no
   * longer a button you press once the beast is weak enough — it is three rounds of
   * holding on, and the win is decided by whether the anchor is still standing.
   */
  | { op: 'anchorTether' };

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
 *  - `pips` is generic energy. Marrow substitutes for it freely, and does so first,
 *    because Marrow evaporates at end of turn while Pips bank — so a card priced purely
 *    in Pips is still payable entirely out of a sacrifice, which is what keeps the ramp
 *    economy intact.
 *  - `marrow` is a strict requirement. Pips cannot cover it at any price. A card that
 *    asks for Marrow is asking the player to have opened something up this turn, and no
 *    amount of patient banking substitutes for that.
 */
export interface CardCost {
  pips: number;
  marrow: number;
}

/** Sorting, rarity tiers, and anywhere a card needs one comparable number. */
export function cardCostTotal(cost: CardCost): number {
  return cost.pips + cost.marrow;
}

export interface CardDef {
  id: CardDefId;
  name: string;
  cost: CardCost;
  school: School;
  source: 'hero' | 'companion';
  kind: 'minion' | 'spell' | 'rune' | 'obstacle';
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
   * A variable price, paid in Pips at cast time.
   *
   * The card's own `cost.pips` is **ignored** when this is set: X *is* the price. A
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
  /**
   * What this card becomes when it is Ascended.
   *
   * Only what a Rank 2 is allowed to change. `id`, `school`, `source`, `kind` and
   * `target` are deliberately absent: a Rank 2 that picked its targets differently, or
   * moved from Hero to Companion, would be a different card wearing the same name — and
   * since both ranks share one copy cap through `baseIdOf`, it would be a different card
   * smuggled past the deck rules.
   *
   * Authored as overrides rather than as a whole second `CardDef` so a change to the
   * Rank 1 printing — a nerf, a keyword, a re-cost — carries into Rank 2 automatically
   * instead of quietly leaving the upgraded copy on last season's numbers.
   */
  rank2?: Rank2Overrides;
}

/**
 * The Rank 2 printing, as a diff against Rank 1.
 *
 * `unit` is a partial: most ascensions raise one or two stats, and restating a whole
 * block to change `atk` is how the other five drift.
 */
export interface Rank2Overrides {
  name?: string;
  cost?: CardCost;
  text?: string;
  effect?: EffectNode;
  keywords?: Keyword[];
  unit?: Partial<UnitStatBlock>;
  obstacleHp?: number;
  range?: number;
  minRange?: number;
  needsLoS?: boolean;
  vector?: 'omni' | 'linear';
}

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
  pipCostDelta?: number;
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
   * what was just built — attaching a rune to it, most obviously — has no other way to
   * name it. Without this a `seq` of "raise a cask, then wire it" silently raises an
   * unwired cask.
   */
  spawnedObstacleId?: UnitId;
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
