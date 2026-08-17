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
  | { op: 'attachRune'; rune: RuneDefId }
  | { op: 'push'; distance: number }
  | { op: 'grantArmor'; amount: number | { from: 'sacrificedHp' } }
  | { op: 'applyStatus'; status: StatusKind; stacks: number; area: AreaSpec }
  | { op: 'sacrificeTarget' }
  | { op: 'gainSparks'; amount: number }
  | { op: 'detonateAllRunes'; bonusDamage: number }
  /** Magma Brute's on-deploy 2-tile cleave. */
  | { op: 'cleaveFront'; amount: number; dtype: DamageType; width: number }
  /** Rite of Binding: ends a Subjugation Trial with the companion bound. */
  | { op: 'bindCompanion' };

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
}

export interface CardDef {
  id: CardDefId;
  name: string;
  cost: number;
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
   * How far from the Companion's Bound Form this may be cast, as a Chebyshev distance.
   *
   * Only meaningful on `source: 'companion'` cards: the Hero is off-grid and has no
   * position to measure from, so its cards reach the whole board. Leaving this undefined
   * keeps a card global, which is how every card behaved before origins existed.
   */
  range?: number;
  /** Whether the cast also needs an unblocked line from the Bound Form. */
  needsLoS?: boolean;
}

export interface CardInstance {
  instanceId: CardInstanceId;
  defId: CardDefId;
  /** Rite of Binding: sits outside the hand limit, cannot be discarded. */
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
