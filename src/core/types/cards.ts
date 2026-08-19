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

/**
 * Effect primitives. Card rules text compiles down to a tree of these, interpreted by
 * engine/effects.ts. Keeping cards as data (rather than closures) means the AI can read
 * a card's shape to enumerate targets, and new cards need no engine changes.
 */
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
  | { op: 'grantArmor'; amount: number | { from: 'sacrificedHp' } }
  | { op: 'applyStatus'; status: StatusKind; stacks: number; area: AreaSpec }
  | { op: 'sacrificeTarget' }
  /**
   * Marrow gained. A fixed number, or scaled off the unit this card just sacrificed.
   *
   * The dynamic form mirrors `grantArmor`'s, which already reads `sacrificedHp` — the
   * same fact, wanted by two different cards for two different purposes.
   */
  | { op: 'extractMarrow'; amount: number | { from: 'sacrificedHp'; max: number } }
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
  | { kind: 'entity'; side: 'ally' | 'enemy' | 'any'; includeObstacles: boolean; requireUnexhausted?: boolean }
  | { kind: 'adjacentEnemy' }
  | { kind: 'line'; length: number }
  | { kind: 'unitOrPortrait'; side: 'ally' }
  | { kind: 'global' };

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

export interface UnitStatBlock {
  atk: number;
  hp: number;
  mov: number;
  rangeMin: number;
  rangeMax: number;
  footprint: 1 | 2;
  archetype: UnitArchetype;
  sacrificeValue: number;
  escalationBonus: { atk: number; hp: number };
  attackProfile?: AttackProfile;
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

export interface CardInstance {
  instanceId: CardInstanceId;
  defId: CardDefId;
  /** Sits outside the hand limit and cannot be discarded. */
  ephemeral?: boolean;
}

/** A resolved target selection passed into effect execution. */
export type ChosenTarget =
  | { kind: 'tile'; at: Coord }
  | { kind: 'entity'; ref: TargetRef }
  | { kind: 'line'; from: Coord; dir: Coord }
  | { kind: 'global' }
  | { kind: 'none' };

export interface CardPlayContext {
  side: Side;
  casterAnchor?: Coord;
  chosen: ChosenTarget;
  sacrificedHp?: number;
  summonedUnitId?: UnitId;
}
