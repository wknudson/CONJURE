/**
 * The GameEvent union — the single seam between logic and presentation.
 *
 * Rules the core must honour when emitting:
 *  1. Events are appended at the exact moment the state mutation happens, so one
 *     command yields one complete, correctly ordered batch.
 *  2. Every event carries a `causeId`: the same value for all events produced by one
 *     atomic resolution step. The sequencer groups parallel-safe events by causeId.
 *  3. Events embed snapshots, never live references.
 */

import type {
  CardInstanceId,
  Coord,
  DamageCause,
  DamageType,
  RuneDefId,
  School,
  Side,
  StatusKind,
  TargetRef,
  UnitId,
} from './ids.js';
import type { CardSnapshot, ObstacleSnapshot, RuneSnapshot, UnitSnapshot } from './snapshots.js';

export type Phase = 'startOfTurn' | 'action' | 'resolution' | 'endOfTurn' | 'over';

/** Fields present on every event. */
export interface EventBase {
  /** Shared by all events from one atomic resolution step. Used for parallel grouping. */
  causeId: string;
}

export type GameEvent = EventBase &
  (
    | { t: 'combatStarted'; grid: { width: number; height: number }; encounterName: string }
    | { t: 'turnStarted'; side: Side; turn: number }
    | { t: 'phaseChanged'; phase: Phase; side: Side }
    | { t: 'pipGained'; side: Side; amount: number; total: number }
    | { t: 'resourcesChanged'; side: Side; pips: number; marrow: number }
    | { t: 'cardDrawn'; side: Side; card: CardSnapshot }
    | { t: 'cardBurned'; side: Side; card: CardSnapshot }
    | { t: 'cardDiscarded'; side: Side; cardId: CardInstanceId }
    | { t: 'deckReshuffled'; side: Side; count: number }
    | { t: 'cardPlayed'; side: Side; card: CardSnapshot; at?: Coord }
    | { t: 'cardInjected'; side: Side; card: CardSnapshot }
    | { t: 'cardReturnedToHand'; side: Side; card: CardSnapshot; refundedMarrow: number }
    | { t: 'unitSummoned'; unit: UnitSnapshot }
    | { t: 'obstacleSpawned'; obstacle: ObstacleSnapshot }
    | { t: 'unitMoved'; unitId: UnitId; path: Coord[] }
    | { t: 'unitDisplaced'; unitId: UnitId; from: Coord; to: Coord }
    | {
        t: 'collision';
        unitId: UnitId;
        at: Coord;
        against: 'wall' | 'unit' | 'obstacle';
        blockerId?: UnitId;
      }
    | { t: 'attackDeclared'; attackerId: UnitId; target: TargetRef }
    | {
        t: 'damageDealt';
        target: TargetRef;
        at?: Coord;
        amount: number;
        absorbedByArmor: number;
        hpLoss: number;
        remainingHp: number;
        dtype: DamageType;
        cause: DamageCause;
      }
    | { t: 'armorGained'; target: TargetRef; amount: number; total: number }
    | { t: 'healed'; target: TargetRef; amount: number; remainingHp: number }
    | { t: 'statusApplied'; unitId: UnitId; status: StatusKind; stacks: number }
    | { t: 'statusTicked'; unitId: UnitId; status: StatusKind; damage: number; remaining: number }
    | { t: 'runeAttached'; hostId: UnitId; at: Coord; rune: RuneSnapshot }
    | {
        t: 'runeDetonated';
        hostId: UnitId;
        at: Coord;
        rune: RuneDefId;
        school: School;
        affected: Coord[];
        chainDepth: number;
      }
    | { t: 'runeFizzled'; hostId: UnitId; rune: RuneDefId; reason: 'unaligned' | 'devour' | 'gate' }
    | { t: 'escalated'; unitId: UnitId; stacks: number; atk: number; hp: number }
    | { t: 'unitSacrificed'; unitId: UnitId; marrowExtracted: number }
    /** A unit spent its attack extracting Marrow instead of swinging. */
    | { t: 'unitChannelled'; unitId: UnitId; side: Side; marrow: number }
    | { t: 'unitDied'; unitId: UnitId; at: Coord; footprint: 1 | 2; cause: DamageCause }
    /**
     * Something left the board without dying — a scavenger that reached the edge.
     *
     * Deliberately not a death: nothing killed it, nobody is owed the kill, and it
     * should read as a loss of opportunity rather than as a victory for either side.
     */
    | { t: 'unitEscaped'; unitId: UnitId; at: Coord }
    | { t: 'obstacleDestroyed'; obstacleId: UnitId; at: Coord }
    | { t: 'resonanceTriggered'; side: Side; name: string; column: number }
    | { t: 'reactionTriggered'; reaction: string; name: string; at: Coord }
    | { t: 'armorStripped'; unitId: UnitId; amount: number }
    | { t: 'hazardSpawned'; kind: string; at: Coord; turns: number }
    | { t: 'hazardExpired'; at: Coord }
    | {
        t: 'intentDeclared';
        unitId: UnitId;
        kind: 'attack' | 'commander' | 'card';
        at?: Coord;
        damage: number;
        label?: string;
      }
    | { t: 'intentsCleared' }
    | { t: 'intentWhiffed'; attackerId: UnitId; at: Coord }
    | { t: 'bossPhaseShift'; side: Side; phase: number; name: string }
    | { t: 'suddenDeath' }
    | { t: 'combatEnded'; result: CombatResult }
  );

export type CombatResult = 'victory' | 'defeat' | 'bound';

/** Event types that may animate simultaneously when they share a causeId. */
export const PARALLEL_SAFE: ReadonlySet<GameEvent['t']> = new Set<GameEvent['t']>([
  'damageDealt',
  'statusApplied',
  'statusTicked',
  'armorGained',
  'healed',
  'resourcesChanged',
  'escalated',
  'cardDrawn',
]);
