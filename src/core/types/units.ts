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
import type { AttackProfile, OnHitRider } from './cards.js';
import type { HazardKind } from './state.js';

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
  /**
   * Statuses the blast leaves on the units it catches.
   *
   * A list, because a trap can do two things at once — roots that hold *and* poison — and
   * modelling that as two runes would mean two attachments on a target that may hold one.
   *
   * Statuses only, never a damage number: `damage` is already the field for that, and a
   * second one would be two ways to say the same thing. A rune with `damage: 0` and an
   * entry here is a pure control trap, which is a real card and not a broken one.
   */
  applies?: { status: StatusKind; stacks: number }[];
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
  /** How its attacks travel. Undefined is free aim, needing a clear line. */
  attackProfile?: AttackProfile;
  /** What its attacks leave on a survivor. Undefined is an ordinary swing. */
  onHit?: OnHitRider;
  /** A hazard laid on every tile it walks off under its own power. */
  trail?: HazardKind;
  /** What it hunts, if it is Feral. Undefined is `nearest`. */
  hunts?: 'nearest' | 'weakest';
  school: School;
  archetype: UnitArchetype;
  keywords: Keyword[];
  statuses: Partial<Record<StatusKind, number>>;
  rune?: AttachedRune;
  /** Extra Marrow this body yields when tithed, above the flat rate. Usually 0. */
  titheBonus: number;
  /** Stacks of enemy `Growth` taken. Player units grow through Auras instead. */
  escalation: number;
  escalationCap: number;
  /**
   * The Elemental Aura riding this unit, if any. One slot, like `rune`.
   *
   * `stacks` counts from 1 on the turn it is cast; at `AURA_MAX_STACKS` it has Climaxed
   * and stops growing. See `src/core/data/auras.ts`.
   */
  aura?: { defId: string; stacks: number };
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
