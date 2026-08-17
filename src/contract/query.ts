/**
 * The read-only query facade the renderer uses for affordances and previews.
 *
 * Every method is pure and synchronous, safe to call many times per frame — but ONLY
 * while the sequencer is idle, because that is the only time view state equals logic state.
 *
 * `previewAction` is implemented as clone -> dispatch -> collect -> discard, reusing the
 * real resolver. That guarantees a preview can never disagree with what actually happens.
 */

import type { CardInstanceId, Coord, TargetRef, UnitId } from './ids.js';
import type { CardSnapshot, ObstacleSnapshot, RuneSnapshot, UnitSnapshot } from './snapshots.js';
import type { Phase } from './events.js';

/** A player intent. Same shape the engine consumes. */
export type Action =
  | { type: 'playCard'; card: CardInstanceId; target?: TargetSelection }
  | { type: 'moveUnit'; unit: UnitId; to: Coord }
  | { type: 'attack'; attacker: UnitId; target: TargetRef }
  | { type: 'sacrifice'; unit: UnitId }
  | { type: 'endTurn' };

export type TargetSelection =
  | { kind: 'tile'; at: Coord }
  | { kind: 'entity'; ref: TargetRef }
  | { kind: 'line'; from: Coord; dir: Coord }
  | { kind: 'global' };

/** What kind of selection a card needs, so the UI knows how to highlight. */
export type TargetSpec =
  | { kind: 'none' }
  | { kind: 'tiles'; tiles: Coord[] }
  | { kind: 'entities'; refs: TargetRef[] }
  | { kind: 'lines'; origins: { from: Coord; dir: Coord; covers: Coord[] }[] }
  | { kind: 'global' };

export interface ActionPreview {
  legal: boolean;
  reason?: string;
  tileEffects: { at: Coord; damage?: number; kind: 'hit' | 'aoe' | 'summon' | 'buff' }[];
  displacements: {
    unitId: UnitId;
    path: Coord[];
    collision?: {
      at: Coord;
      against: 'wall' | 'unit' | 'obstacle';
      damage: number;
      collateral?: { id: UnitId; damage: number };
    };
  }[];
  detonations: { hostId: UnitId; at: Coord; affected: Coord[]; chainDepth: number }[];
  predictedDeaths: UnitId[];
  cost: { pips: number; sparks: number };
}

/** A flattened, render-ready view of the board. Read only while the sequencer is idle. */
export interface BoardView {
  width: number;
  height: number;
  /**
   * How many rows deep each side's territory reaches. Short arenas use one row rather
   * than two; the renderer cannot import the engine, so the depth travels with the view.
   */
  territoryDepth: number;
  turn: number;
  activeSide: 'player' | 'enemy';
  phase: Phase;
  units: UnitSnapshot[];
  obstacles: ObstacleSnapshot[];
  hazards: { at: Coord; kind: string; turns: number }[];
  /** What the enemy has committed to next turn. Empty during the enemy's own turn. */
  intents: {
    unitId: UnitId;
    kind: 'attack' | 'commander' | 'card';
    at?: Coord;
    path?: Coord[];
    damage: number;
    label?: string;
  }[];
  runes: { hostId: UnitId; at: Coord; rune: RuneSnapshot }[];
  statuses: { unitId: UnitId; kind: string; stacks: number }[];
  escalation: { unitId: UnitId; stacks: number }[];
  player: CommanderView;
  enemy: CommanderView;
  encounterName: string;
  bossPhase?: number;
}

export interface CommanderView {
  hp: number;
  maxHp: number;
  armor: number;
  pips: number;
  sparks: number;
  handCount: number;
  deckCount: number;
  discardCount: number;
  name: string;
  companionName?: string;
  /** Board columns the Hero and Companion stand beside, off-grid. */
  heroColumn: number;
  companionColumn: number;
  companionSchool: string;
  /** Resonance already fired this turn. */
  resonanceUsed: boolean;
  resonanceName?: string;
}

export interface RulesQuery {
  getBoard(): BoardView;
  getHand(): CardSnapshot[];
  getPlayableCards(): CardInstanceId[];
  getLegalTargets(card: CardInstanceId): TargetSpec;
  getLegalMoves(unit: UnitId): Coord[];
  getLegalAttacks(unit: UnitId): TargetRef[];
  /** Tiles the given origin cannot see, for shadow-cone fog rendering. */
  getOccludedTiles(from: Coord): Coord[];
  /** Tiles enemies could strike next turn, with incoming damage per tile. */
  getThreat(): ThreatView;
  /** Your units with an action still available, in board order. */
  getReadyUnits(): UnitId[];
  /** What passing the turn right now would leave on the table. */
  getUnspentPotential(): { readyUnits: number; playableCards: number };
  previewAction(action: Action): ActionPreview;
  isOver(): boolean;
}

export interface ThreatView {
  tiles: { at: Coord; damage: number }[];
  /** Enemy units already able to reach your Commander. */
  commanderThreatCount: number;
}
