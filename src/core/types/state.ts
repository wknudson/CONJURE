import type { CardInstanceId, Coord, School, Side, UnitId } from '../../contract/ids.js';
import type { Command } from './commands.js';
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
  /**
   * Companion cards played this turn that have fired the Resonance.
   *
   * A count rather than the old boolean, because the limit stopped being one: gear can
   * buy a second firing, and "how many so far" is the only question that answers both.
   */
  resonancesThisTurn: number;
  /** Resonance may fire twice a turn rather than once. */
  doubleResonance: boolean;
  /** Collision damage this side's units shrug off, per hit. Floored at zero on read. */
  collisionResist: number;
  /** This side sees past Guardians. A wall is still a wall. */
  ignoresGuardians: boolean;
  /** Spliced cards cost this side 1 Pip less, never below one. */
  discountHybrids: boolean;
  /** Pips refunded by elemental reactions this turn, capped so cascades cannot self-fund. */
  reactionPipsThisTurn: number;
  /**
   * The Companion's body on the board, if this side has one. A side without one casts
   * from nowhere in particular, exactly as every side did before Bound Forms existed.
   */
  companionUnitId?: UnitId;
  /** Its stat block, kept so sudden death can restore the body after the board is wiped. */
  companionUnitDefId?: string;
  hp: number;
  maxHp: number;
  armor: number;
  /** Banked. The cap of 8 is enforced only during end-of-turn cleanup. */
  pips: number;
  /** Ephemeral. Zeroed at end of turn. */
  marrow: number;
  deck: CardInstanceId[];
  hand: CardInstanceId[];
  discard: CardInstanceId[];
  cards: Record<CardInstanceId, CardInstance>;
  handLimit: number;
  /**
   * The most Pips this side may bank through end of turn.
   *
   * A field rather than the `PIP_CAP` constant read directly, for the same reason
   * `handLimit` is one: gear can move it, and a rule that gear bends has to be a value
   * somebody can hold rather than a number compiled into the cleanup.
   */
  pipCap: number;
  /**
   * Smoke does not blind this side.
   *
   * A capability on the commander rather than a check against an item, because the engine
   * is only ever handed rules: whether it came from goggles, a Companion's trait or a
   * spell is the overworld's business and never this layer's.
   */
  ignoresFog: boolean;
  /** Burn does not tick on this side. */
  immuneToBurn: boolean;
  /** Toxin does not tick on this side. */
  immuneToToxin: boolean;
  /**
   * This side sees everything the opposition means to do, card plays included.
   *
   * Read by the session when it asks the AI to declare, so the engine never learns that
   * a difficulty setting exists — only that this commander is owed the full telegraph.
   */
  revealsIntents: boolean;
  /** Added to the health of obstacles this side raises from a card. */
  bonusObstacleHp: number;
  /** Added to what each of this side's sacrifices pays out. */
  bonusSacrificeMarrow: number;
  /** Health returned to the Pact each time this side gives a body up. */
  healOnSacrifice: number;
  /** Extra stacks folded into every Toxin this side applies. */
  bonusToxinStacks: number;
  /** This side's Bound Form crosses broken ground freely and rides no current. */
  boundFormIgnoresHazards: boolean;
  /** This side's Bound Form cannot be shoved, pulled, or carried. */
  boundFormGrounded: boolean;
  /** Ice underfoot costs this side nothing. */
  ignoresIceSlip: boolean;
}

/**
 * The sky over an arena. Global and permanent, unlike a hazard, which sits on a tile and
 * burns off — so it lives on the encounter rather than in `hazards`, where the tick
 * would age it away.
 */
export type Weather =
  /** Fire gutters in the wet. */
  | { kind: 'rain' }
  /** Nothing can be seen past three tiles, by anyone, in any direction. */
  | { kind: 'fog' }
  /** A steady wind: ranged attacks reach further downwind and fall short into it. */
  | { kind: 'gale'; wind: Coord };

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
  /** The weather this fight is being had in, if any. */
  weather?: Weather;
  /**
   * The Harpoon Protocol: a cornered Alpha seals itself, and the trial stops being a
   * damage race and becomes a siege around one tethered unit.
   *
   * Always present rather than optional, so the reducer never has to ask whether the
   * field exists before reading it, and so the shape of a serialised state does not
   * depend on how far into a fight it got.
   */
  subjugation: Subjugation;
}

export interface Subjugation {
  /**
   * The beast has sealed itself and can no longer be harmed.
   *
   * Set at the enrage and never cleared: a failed tether leaves the Alpha just as
   * unkillable as before, which is what forces the player back to the Rite rather than
   * back to swinging. Held here rather than read off the `aetherPlated` status because
   * the body carrying that status can leave the board — a wipe, a sudden death — and a
   * boss that became mortal again because its model was removed would be a way to win a
   * subjugation by accident.
   */
  sealed: boolean;
  /** True between the Rite being cast and the tether resolving or snapping. */
  active: boolean;
  /** The tethered unit. Null whenever `active` is false. */
  anchorUnitId: UnitId | null;
  /** Completed rounds the anchor has endured. At `SUBJUGATION_ROUNDS` the beast breaks. */
  turnsSurvived: number;
}

/** Rounds the anchor must survive. */
export const SUBJUGATION_ROUNDS = 3;

/** How far anything can see. Undefined means as far as the board allows. */
export function visionClamp(state: GameState): number | undefined {
  return state.encounter.weather?.kind === 'fog' ? FOG_VISION : undefined;
}

/** Dense fog: three tiles, for units, spells and Commanders alike. */
export const FOG_VISION = 3;

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
  /**
   * Never ages or expires. Rubble is a change to the ground, not a cloud sitting on it.
   *
   * A flag rather than `turns: Infinity`, because Infinity does not survive JSON: it
   * serialises as null, which would corrupt the state hash and with it replay and saves.
   */
  permanent?: true;
  /** Which way a current flows. Present only on `current` hazards. */
  dir?: Coord;
}

export type HazardKind =
  /** Vaporised water. Blocks sight through the tile, but not movement. */
  | 'steam_fog'
  /** What a broken wall leaves behind. Costs more to cross; blocks nothing. */
  | 'rubble'
  /** Moving ground. Carries whatever stands on it one tile at the end of the round. */
  | 'current';

/**
 * A declared enemy action, shown to the player before it happens.
 *
 * `at` is the *tile* the blow lands on, deliberately not the unit that happened to be
 * standing there. Moving the target away makes the attack miss, which is the whole point.
 */
export interface Intent {
  /** The acting unit, or `card:<instanceId>` for a declared card play. */
  unitId: UnitId;
  /**
   * What the body has committed to, as a **category** rather than as a plan.
   *
   * `move` and `channel` exist so that a unit which is doing *something* never reads as
   * doing nothing: before them, only a declared strike produced an intent, so a beast
   * walking into position and a beast standing idle were drawn identically. Both carry
   * the same vagueness as the rest — where it is going, not what it will do when it
   * arrives.
   */
  kind: 'attack' | 'commander' | 'card' | 'move' | 'channel';
  at?: Coord;
  /** Movement committed before the strike, for drawing the approach. */
  path?: Coord[];
  damage: number;
  /** Card name, for declared card plays. */
  label?: string;
}

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
  /** What the enemy has committed to doing next turn, shown to the player. */
  intents: Intent[];
  /** The plan those intents came from. Replayed rather than re-planned. */
  declaredPlan: Command[];
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
  /**
   * Enemy stat blocks that have appeared on this board, and those that have fallen.
   *
   * Definition ids, not instance ids: the Threat Ledger is about *kinds* of thing, and
   * a list of `u7` would grow forever and mean nothing. Duplicates are kept — three dead
   * Scout Imps is three, which is what a tally wants.
   *
   * Held in `GameState` rather than accumulated by the session for one reason: undo.
   * `snapshot`/`restore` deep-clone the state, so rewinding a turn that killed something
   * un-counts it for free. A tally kept beside the state would have to remember to.
   */
  encountered: string[];
  defeated: string[];
}

export interface StepResult {
  state: GameState;
  events: GameEvent[];
}

/**
 * How deep each side's territory reaches from its own edge.
 *
 * Two rows is the standard, but a short arena cannot afford it: at height 4 a
 * two-deep territory on both sides consumes the entire board, leaving no neutral
 * ground to contest and putting every tile within melee reach of a portrait. Small
 * grids therefore fall back to a single row, which keeps the three-zone structure
 * (yours / neutral / theirs) intact at every supported size.
 */
export function territoryDepthFor(height: number): number {
  return height <= 5 ? 1 : 2;
}

/**
 * Rows belonging to a side: the bottom `depth` for the player, the top `depth` for
 * the enemy. This is the single source of truth for deployment zones, melee portrait
 * reach, threat display, and board tinting — do not inline the row arithmetic.
 */
export function territoryRows(state: GameState, side: Side): number[] {
  const depth = territoryDepthFor(state.height);
  const rows: number[] = [];
  for (let i = 0; i < depth; i++) {
    rows.push(side === 'player' ? state.height - 1 - i : i);
  }
  return rows;
}

export function inBounds(state: GameState, c: Coord): boolean {
  return c.x >= 0 && c.y >= 0 && c.x < state.width && c.y < state.height;
}

/** The off-grid portrait's virtual row, used for melee reach and ranged LoS vectors. */
export function portraitRow(state: GameState, side: Side): number {
  return side === 'player' ? state.height : -1;
}
