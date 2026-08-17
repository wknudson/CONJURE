import type { CardInstanceId, Coord, School, Side, UnitId } from '../../contract/ids.js';
import type { CombatResult, GameEvent, Phase } from '../../contract/events.js';
import type { RngState } from '../util/rng.js';
import type { CardInstance } from './cards.js';
import type { Obstacle, Unit } from './units.js';

export interface CommanderState {
  name: string;
  companionName?: string;
  /** Drives the Resonance passive and Companion card framing. */
  companionSchool: School;
  /** Board column the Hero stands beside, off-grid. Purely for presentation. */
  heroColumn: number;
  /** Board column the Companion watches — the lane its Resonance affects. */
  companionColumn: number;
  /** Resonance fires once per turn, on the first Companion card played. */
  resonanceUsedThisTurn: boolean;
  hp: number;
  maxHp: number;
  armor: number;
  /** Banked. The cap of 8 is enforced only during end-of-turn cleanup. */
  pips: number;
  /** Ephemeral. Zeroed at end of turn. */
  sparks: number;
  deck: CardInstanceId[];
  hand: CardInstanceId[];
  discard: CardInstanceId[];
  cards: Record<CardInstanceId, CardInstance>;
  handLimit: number;
}

export interface EncounterState {
  id: string;
  name: string;
  bossPhase: number;
  /** Gates already fired, so a 50%/25% threshold triggers exactly once. */
  firedGates: string[];
  /**
   * Set when a boss Damage Gate clamps HP mid-chain. The effect interpreter and the
   * cascade worklist both check this and abandon the rest of the current chain.
   */
  chainCancelled: boolean;
}

/**
 * A lingering effect occupying a tile. Hazards are terrain, not entities: they do not
 * block movement and cannot be attacked, they simply change what the tile does.
 */
export interface Hazard {
  kind: HazardKind;
  at: Coord;
  /** Turns remaining; decremented in the hazard slot of the status tick order. */
  turns: number;
  /** Which side's turn ticks it down, so both sides see it for the same duration. */
  owner: Side;
}

export type HazardKind = 'steam_fog';

export interface GameState {
  rng: RngState;
  turn: number;
  activeSide: Side;
  phase: Phase;
  width: number;
  height: number;
  units: Record<UnitId, Unit>;
  obstacles: Record<UnitId, Obstacle>;
  /** Tile hazards: fog, fire patches and the like, keyed by "x,y". */
  hazards: Record<string, Hazard>;
  players: Record<Side, CommanderState>;
  encounter: EncounterState;
  nextId: number;
  result?: CombatResult;
  suddenDeath: boolean;
  /** Set whenever a commander actually loses HP; drives the Pacifist Lockout. */
  commanderDamagedThisRound: boolean;
  /** Consecutive full rounds in which neither commander took damage. */
  stalledRounds: number;
  /** Incremented per atomic resolution step; stamped onto events as causeId. */
  causeCounter: number;
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

/** Player territory is the bottom two rows; enemy territory the top two. */
export function territoryRows(state: GameState, side: Side): number[] {
  return side === 'player'
    ? [state.height - 1, state.height - 2]
    : [0, 1];
}

export function inBounds(state: GameState, c: Coord): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < state.width && c.y < state.height;
}

/** The off-grid portrait's virtual row, used for melee reach and ranged LoS vectors. */
export function portraitRow(state: GameState, side: Side): number {
  return side === 'player' ? state.height : -1;
}
