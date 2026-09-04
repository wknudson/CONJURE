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
import type { CardSnapshot, ObstacleSnapshot, MarkSnapshot, UnitSnapshot } from './snapshots.js';
import type { Phase } from './events.js';

/** A player intent. Same shape the engine consumes. */
export type Action =
  | { type: 'playCard'; card: CardInstanceId; target?: TargetSelection; x?: number }
  | { type: 'moveUnit'; unit: UnitId; to: Coord }
  | { type: 'attack'; attacker: UnitId; target: TargetRef }
  | { type: 'bloodTithe'; unit: UnitId }
  | { type: 'channel'; unit: UnitId }
  /** Deployment only: put a rostered body on an Anchor Tile. */
  | { type: 'deployUnit'; defId: string; at: Coord }
  /** Deployment only: pick a placed body back up. */
  | { type: 'recallUnit'; unit: UnitId }
  /** Deployment only: set the line and begin turn one. */
  | { type: 'finishDeployment' }
  /** Gives the fight up as a loss. Legal at any moment; the HUD confirms it first. */
  | { type: 'concede' }
  | { type: 'endTurn' };

export type TargetSelection =
  | { kind: 'tile'; at: Coord }
  | { kind: 'fallen'; rosterIndex: number }
  | { kind: 'entity'; ref: TargetRef }
  | { kind: 'line'; from: Coord; dir: Coord }
  | { kind: 'global' };

/** What kind of selection a card needs, so the UI knows how to highlight. */
export type TargetSpec =
  | { kind: 'none' }
  /**
   * Empty ground this card may be aimed at.
   *
   * `footprint` is the size of what lands there, and it travels with the spec because the
   * *shape* of a cast is part of aiming it: a Behemoth placed on a 2x2 covers three tiles
   * the player never clicked, and a highlight that lit only the anchor was quietly lying
   * about where the body would go.
   */
  | { kind: 'tiles'; tiles: Coord[]; footprint: 1 | 2 }
  | { kind: 'entities'; refs: TargetRef[] }
  /**
   * Pick from your own Graveyard.
   *
   * Carries the tile each body fell on where there is one, so a picker can point at the
   * ground as well as name the body. `at` is absent for a corpse carried in from an
   * earlier fight, which the two Rallies can still raise and Resurgence cannot.
   */
  | { kind: 'fallen'; entries: { rosterIndex: number; defId: string; name: string; at?: Coord }[] }
  | { kind: 'lines'; origins: { from: Coord; dir: Coord; covers: Coord[] }[] }
  | { kind: 'global' };

export interface ActionPreview {
  legal: boolean;
  reason?: string;
  /**
   * Every tile the cast would touch, and what it would do there.
   *
   * `status` and `hazard` were the missing kinds, and their absence was visible: a card
   * that only applies a status — a Chill cross, an Entangle, a smoke cloud — produced no
   * tile effects at all, so its area of effect could not be previewed. It was invisible
   * until it resolved.
   */
  tileEffects: {
    at: Coord;
    damage?: number;
    kind: 'hit' | 'aoe' | 'summon' | 'buff' | 'status' | 'hazard';
    /** Which status, for the ones that leave one. Drives the flash colour. */
    status?: string;
  }[];
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
  cost: { bones: number; marrow: number };
}

/** A flattened, render-ready view of the board. Read only while the sequencer is idle. */
/** One rostered body, as the deploy tray needs to draw it. */
export interface RosterView {
  defId: string;
  name: string;
  /**
   * How much ground this body stands on.
   *
   * On the view because the deployment overlay needs it: a Behemoth put on an Anchor Tile
   * covers three tiles nobody clicked, and lighting the anchor alone was the same quiet
   * lie a footprint-blind card highlight tells.
   */
  footprint: 1 | 2;
  /** Point-buy cost, so the tray can show what each body was worth. */
  points: number;
  status: 'reserve' | 'fielded' | 'fallen';
  /** Set while fielded, so clicking the board can find the tray entry. */
  unitId?: UnitId;
  /**
   * Where this body fell, while it is `fallen`.
   *
   * The Soul Pyre. Carried on the view because there is nothing at the coordinate to
   * render from — a pyre is roster memory, not an entity — so without this the board has
   * no way to know the ground is marked.
   */
  fellAt?: Coord;
}

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
    kind: 'attack' | 'commander' | 'card' | 'move' | 'channel' | 'tithe';
    at?: Coord;
    path?: Coord[];
    /** The entity a declared card is bound to — the marker follows it. See `Intent`. */
    targetId?: UnitId;
    damage: number;
    label?: string;
  }[];
  marks: { hostId: UnitId; at: Coord; mark: MarkSnapshot }[];
  statuses: { unitId: UnitId; kind: string; stacks: number }[];
  escalation: { unitId: UnitId; stacks: number }[];
  /**
   * The player's Anchor Tiles — the only ground a Vanguard may deploy onto.
   *
   * Carried on the view rather than recomputed, for the same reason `territoryDepth` is:
   * the renderer cannot import the engine, so the ground travels with the picture.
   */
  anchors: Coord[];
  /**
   * Points this arena will seat, from `rosterBudgetFor(width, height)`.
   *
   * A character owns one warband up to the kit ceiling and fields an arena's worth of it, so
   * the tray needs the arena's number to show a running total and to grey a chip that will
   * not fit. Travels on the view for the same reason `anchors` does — the renderer cannot
   * import the engine, and a second copy of the arithmetic is a second answer.
   */
  deployBudget: number;
  /** The Vanguard tray: every body brought, and where each one currently is. */
  roster: RosterView[];
  player: CommanderView;
  enemy: CommanderView;
  encounterName: string;
  bossPhase?: number;
  /**
   * This fight is won by clearing the board, and has no enemy Commander to show.
   *
   * On the view rather than inferred from an empty name, because the HUD and the renderer
   * both have to agree to draw nothing — and "the enemy bar is missing" is the kind of
   * thing that looks like a bug unless something says out loud that it is deliberate.
   */
  rout?: boolean;
}

export interface CommanderView {
  hp: number;
  maxHp: number;
  armor: number;
  bones: number;
  marrow: number;
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

/**
 * Where a Companion card is thrown from, so the board can show its reach.
 *
 * Absent for Hero cards: the Architect is off the board and has no origin to draw.
 */
export interface CastInfo {
  origin: Coord;
  range: number;
  needsLoS: boolean;
  /** Tiles the origin cannot see. Empty when the card does not need a line. */
  occluded: Coord[];
}

export interface RulesQuery {
  getBoard(): BoardView;
  getHand(): CardSnapshot[];
  getPlayableCards(): CardInstanceId[];
  getLegalTargets(card: CardInstanceId): TargetSpec;
  /** Origin and reach for a Companion-cast card; undefined when the Hero casts it. */
  castInfo(card: CardInstanceId): CastInfo | undefined;
  getLegalMoves(unit: UnitId): Coord[];
  getLegalAttacks(unit: UnitId): TargetRef[];
  /**
   * Every tile this body could strike from where it stands, occupied or not.
   *
   * Deliberately not `getLegalAttacks`, which answers a different question: that one lists
   * *targets*, and a player choosing where to stand needs the **shape of the reach** — the
   * ring they can count tiles against — whether or not anything is standing in it today.
   */
  getStrikeReach(unit: UnitId): Coord[];
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
