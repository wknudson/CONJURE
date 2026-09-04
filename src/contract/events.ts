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
  MarkDefId,
  School,
  Side,
  StatusKind,
  TargetRef,
  UnitId,
} from './ids.js';
import type { CardSnapshot, ObstacleSnapshot, MarkSnapshot, UnitSnapshot } from './snapshots.js';

/**
 * `deployment` runs once, before turn one, and only when the player brought a Vanguard.
 * A fight with an empty roster never enters it and begins exactly as it always did.
 */
export type Phase =
  | 'deployment'
  | 'startOfTurn'
  | 'action'
  | 'resolution'
  | 'endOfTurn'
  | 'over';

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
    | { t: 'boneGained'; side: Side; amount: number; total: number }
    /**
     * A Bone paid back for landing an elemental reaction.
     *
     * Separate from `boneGained` because the two are the same arithmetic but different
     * news: turn income is expected and silent, a refund is a reward for a setup that
     * worked and is worth saying out loud, at the tile where it happened.
     */
    | {
        t: 'boneRefunded';
        side: Side;
        amount: number;
        total: number;
        reaction: string;
        name: string;
        at: Coord;
      }
    | { t: 'resourcesChanged'; side: Side; bones: number; marrow: number }
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
    | { t: 'markAttached'; hostId: UnitId; at: Coord; mark: MarkSnapshot }
    | {
        t: 'markDetonated';
        hostId: UnitId;
        at: Coord;
        mark: MarkDefId;
        school: School;
        affected: Coord[];
        chainDepth: number;
      }
    | { t: 'markFizzled'; hostId: UnitId; mark: MarkDefId; reason: 'unaligned' | 'devour' | 'gate' }
    | { t: 'escalated'; unitId: UnitId; stacks: number; atk: number; hp: number }
    /**
     * Marrow paid out by something that died — a shattered geode, a scavenger's purse.
     *
     * Alongside `resourcesChanged` rather than instead of it: that event is a silent dial
     * sync with no sound or text of its own, so there is no double-announcement here. It
     * carries the tile because the payout belongs to where the thing fell, and `source`
     * because glass and a purse should not make the same noise.
     */
    | {
        t: 'marrowExtracted';
        side: Side;
        amount: number;
        total: number;
        at: Coord;
        name: string;
        source: 'obstacle' | 'creature';
      }
    | { t: 'unitTithed'; unitId: UnitId; side: Side; marrow: number; damage: number }
    /** An Elemental Aura took hold, at one stack. Replaces whatever was there. */
    | { t: 'auraAttached'; unitId: UnitId; aura: string; name: string; stacks: number; atk: number; hp: number }
    /** One turn of growth. Stacks 1 and 2 carry a stat change; 3 carries none. */
    | { t: 'auraStacked'; unitId: UnitId; aura: string; stacks: number; atk: number; hp: number }
    /** The cap. Growth stops here and the Climax trait comes on. */
    | { t: 'auraClimaxed'; unitId: UnitId; aura: string; trait: string; atk: number; hp: number }
    /** Spent. The Aura is gone and its stats with it; the burst is the card's own ops. */
    | { t: 'auraDetonated'; unitId: UnitId; aura: string }
    /** The Vanguard may take the field. Carries the ground it may stand on. */
    | { t: 'deploymentBegan'; anchors: Coord[] }
    /** One body placed, or picked back up. Free and re-doable until the line is set. */
    | { t: 'unitDeployed'; unitId: UnitId; defId: string; at: Coord }
    | { t: 'unitRecalled'; defId: string; at: Coord }
    /** The line is set. Turn one begins. */
    | { t: 'deploymentEnded'; fielded: number }
    /** A rostered body fell. The tile is remembered, not occupied — see `lightPyre`. */
    | { t: 'pyreLit'; defId: string; unitId: UnitId; at: Coord }
    /** A fallen body stood back up, at a new instance. */
    | { t: 'unitRevived'; defId: string; unitId: UnitId; at: Coord; hp: number }
    /** A body spent whole to make something else. Pays no Marrow -- see `consumeTarget`. */
    | { t: 'unitConsumed'; unitId: UnitId }
    /** A unit spent its attack extracting Marrow instead of swinging. */
    /**
     * A body gave up its swing. What it produced depends on its class — see
     * `data/economy.ts`. `marrow` predates the Bone economy and is kept so the animation
     * and the AI's existing term keep working; `bones` and `draw` are what the class ladder
     * added.
     */
    | { t: 'unitChannelled'; unitId: UnitId; side: Side; marrow: number; bones: number; draw: number }
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
        kind: 'attack' | 'commander' | 'card' | 'move' | 'channel' | 'tithe';
        at?: Coord;
        damage: number;
        label?: string;
      }
    | { t: 'intentsCleared' }
    | { t: 'intentWhiffed'; attackerId: UnitId; at: Coord }
    | { t: 'bossPhaseShift'; side: Side; phase: number; name: string }
    /** A cornered Alpha seals itself. Damage stops mattering; the tether starts. */
    | { t: 'subjugationBegan'; bossUnitId?: UnitId; rounds: number }
    /**
     * The Rite lands and a unit takes the strain. `held` is the progress it starts with —
     * zero for a first tether, half of what a snapped one had held — and `of` the target.
     */
    | { t: 'anchorSet'; unitId: UnitId; at: Coord; held: number; of: number }
    /** One full round endured. `of` is the target, so the UI needs no constant of its own. */
    | { t: 'subjugationProgress'; turnsSurvived: number; of: number }
    /** The anchor fell. The beast is loose again, and angrier. `kept` rounds carry over. */
    | { t: 'tetherSnapped'; unitId: UnitId; at: Coord; kept: number }
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
