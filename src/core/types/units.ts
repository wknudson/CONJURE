import type {
  CardDefId,
  Coord,
  DamageType,
  Keyword,
  RuneDefId,
  School,
  Side,
  StatusKind,
  UnitId,
} from '../../contract/ids.js';
import type { UnitArchetype } from '../../contract/snapshots.js';

/** How a rune decides to detonate. */
export type RuneTrigger =
  /** Detonates when the host loses at least 1 actual HP to an aligned damage type. */
  | { kind: 'hpLoss'; alignedTypes: DamageType[] }
  /** Detonates when the host dies or is sacrificed. */
  | { kind: 'death' };

export interface RuneDef {
  id: RuneDefId;
  name: string;
  school: School;
  trigger: RuneTrigger;
  /** Damage dealt to everything in the blast when it detonates. */
  damage: number;
  dtype: DamageType;
  /** Blast pattern the renderer highlights and the engine damages. */
  blast: BlastPattern;
  text: string;
}

export type BlastPattern =
  | { shape: 'self' }
  | { shape: 'adjacent8' }
  | { shape: 'plus'; radius: number }
  | { shape: 'lowestHpEnemy' };

export interface AttachedRune {
  defId: RuneDefId;
  ownerSide: Side;
}

export interface Unit {
  id: UnitId;
  defId: CardDefId;
  name: string;
  side: Side;
  anchor: Coord;
  footprint: 1 | 2;
  hp: number;
  maxHp: number;
  armor: number;
  atk: number;
  mov: number;
  rangeMin: number;
  rangeMax: number;
  school: School;
  archetype: UnitArchetype;
  keywords: Keyword[];
  statuses: Partial<Record<StatusKind, number>>;
  rune?: AttachedRune;
  /** Sparks granted when this unit is sacrificed. */
  sacrificeValue: number;
  escalation: number;
  escalationCap: number;
  /** Per-turn action flags. One move and one attack are available each turn. */
  movedThisTurn: boolean;
  attackedThisTurn: boolean;
  summonedThisTurn: boolean;
  /** True while the unit has not yet survived a full enemy round (blocks Escalation). */
  freshlySummoned: boolean;
}

export interface Obstacle {
  id: UnitId;
  defId: CardDefId;
  name: string;
  side: Side;
  anchor: Coord;
  footprint: 1;
  hp: number;
  maxHp: number;
  rune?: AttachedRune;
  destructible: boolean;
  /**
   * Low terrain: blocks line of sight but not movement, so a unit may stand on it.
   * Ranged attackers have to reposition rather than shoot over it, which gives the
   * board texture without walling movement off.
   */
  cover?: boolean;
}

/** Obstacles and units share enough shape that damage/LoS treat them uniformly. */
export type Entity = Unit | Obstacle;

export const isUnit = (e: Entity): e is Unit => 'atk' in e;
