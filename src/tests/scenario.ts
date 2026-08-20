/**
 * Declarative scenario builder for engine tests.
 *
 * Tests drive the engine only through applyCommand and assert on the emitted events,
 * exactly as the renderer and AI do — so a passing test proves the real path works.
 */

import type { Coord, Side, TargetRef } from '../contract/ids.js';
import type { GameEvent } from '../contract/events.js';
import type { GameState } from '../core/types/state.js';
import type { Unit } from '../core/types/units.js';
import type { Command } from '../core/types/commands.js';
import type { ChosenTarget } from '../core/types/cards.js';
import { applyCommand } from '../core/engine/engine.js';
import { makeRng } from '../core/util/rng.js';
import { CARDS } from '../core/data/cards/index.js';
import { HAND_LIMIT, PIP_CAP } from '../core/engine/deck.js';
import { flankColumns } from '../core/engine/setup.js';
import { growthCapFor } from '../core/engine/growth.js';

export interface UnitSpec {
  def: string;
  side: Side;
  at: Coord;
  hp?: number;
  armor?: number;
  atk?: number;
  rune?: string;
  keywords?: string[];
  rangeMax?: number;
  fresh?: boolean;
  titheBonus?: number;
}

/** Builds a bare 5x5 board in the action phase, with no cards drawn. */
export function scenario(opts: {
  width?: number;
  height?: number;
  playerHp?: number;
  enemyHp?: number;
  playerArmor?: number;
  enemyArmor?: number;
  pips?: number;
  marrow?: number;
  units?: UnitSpec[];
  obstacles?: { at: Coord; hp?: number; rune?: string; side?: Side }[];
  hand?: string[];
  deck?: string[];
  seed?: number;
} = {}): GameState {
  const width = opts.width ?? 5;
  const height = opts.height ?? 5;

  const state: GameState = {
    rng: makeRng(opts.seed ?? 1),
    turn: 1,
    activeSide: 'player',
    phase: 'action',
    width,
    height,
    units: {},
    obstacles: {},
    hazards: {},
    intents: [],
    declaredPlan: [],
    players: {
      player: blankCommander(
        'Hero',
        opts.playerHp ?? 40,
        opts.playerArmor ?? 0,
        opts.pips ?? 10,
        opts.marrow ?? 0,
        width,
      ),
      enemy: blankCommander('Foe', opts.enemyHp ?? 40, opts.enemyArmor ?? 0, 10, 0, width),
    },
    encounter: {
      id: 'test',
      name: 'Test',
      bossPhase: 1,
      firedGates: [],
      chainCancelled: false,
      subjugation: { sealed: false, active: false, anchorUnitId: null, turnsSurvived: 0 },
    },
    nextId: 0,
    suddenDeath: false,
    commanderDamagedThisRound: false,
    stalledRounds: 0,
    causeCounter: 0,
    encountered: [],
    defeated: [],
  };

  for (const spec of opts.units ?? []) addUnit(state, spec);
  for (const o of opts.obstacles ?? []) {
    state.nextId += 1;
    const id = `o${state.nextId}`;
    state.obstacles[id] = {
      id,
      defId: 'stone_barricade',
      name: 'Stone Barricade',
      side: o.side ?? 'player',
      anchor: { ...o.at },
      footprint: 1,
      hp: o.hp ?? 6,
      maxHp: o.hp ?? 6,
      destructible: true,
      ...(o.rune ? { rune: { defId: o.rune, ownerSide: (o.side ?? 'player') as Side } } : {}),
    };
  }

  for (const defId of opts.hand ?? []) giveCard(state, 'player', defId);
  for (const defId of opts.deck ?? []) {
    const id = giveCard(state, 'player', defId);
    const cmd = state.players.player;
    cmd.hand = cmd.hand.filter((h) => h !== id);
    cmd.deck.push(id);
  }

  return state;
}

function blankCommander(
  name: string,
  hp: number,
  armor: number,
  pips: number,
  marrow: number,
  width: number,
) {
  return {
    name,
    companionSchool: 'pyre' as const,
    ...flankColumns(width),
    resonancesThisTurn: 0,
    reactionPipsThisTurn: 0,
    hp,
    maxHp: hp,
    armor,
    pips,
    marrow,
    deck: [] as string[],
    hand: [] as string[],
    discard: [] as string[],
    cards: {},
    handLimit: HAND_LIMIT,
    pipCap: PIP_CAP,
    ignoresFog: false,
    immuneToBurn: false,
    immuneToToxin: false,
    ignoresIceSlip: false,
    revealsIntents: false,
    bonusObstacleHp: 0,
    bonusTitheMarrow: 0,
    healOnTithe: 0,
    bonusToxinStacks: 0,
    boundFormIgnoresHazards: false,
    boundFormGrounded: false,
    doubleResonance: false,
    collisionResist: 0,
    ignoresGuardians: false,
    discountHybrids: false,
  };
}

export function addUnit(state: GameState, spec: UnitSpec): Unit {
  const def = CARDS[spec.def];
  if (!def?.unit) throw new Error(`no unit def ${spec.def}`);
  const stats = def.unit;
  state.nextId += 1;
  const id = `u${state.nextId}`;

  const unit: Unit = {
    id,
    defId: def.id,
    name: def.name,
    side: spec.side,
    anchor: { ...spec.at },
    footprint: stats.footprint,
    hp: spec.hp ?? stats.hp,
    maxHp: Math.max(spec.hp ?? stats.hp, stats.hp),
    armor: spec.armor ?? 0,
    atk: spec.atk ?? stats.atk,
    mov: stats.mov,
    rangeMin: stats.rangeMin,
    rangeMax: spec.rangeMax ?? stats.rangeMax,
    ...(stats.attackProfile ? { attackProfile: stats.attackProfile } : {}),
    // Kept in step with `spawn.ts`. This builder duplicates that construction rather than
    // calling it, so every field added to a stat block has to be added here too — miss one
    // and the tests quietly exercise a different unit than the game spawns.
    ...(stats.onHit ? { onHit: { ...stats.onHit } } : {}),
    ...(stats.trail ? { trail: stats.trail } : {}),
    ...(stats.hunts ? { hunts: stats.hunts } : {}),
    school: def.school,
    archetype: stats.archetype,
    keywords: (spec.keywords as Unit['keywords']) ?? [...def.keywords],
    statuses: {},
    titheBonus: spec.titheBonus ?? stats.titheBonus ?? 0,
    escalation: 0,
    escalationCap: growthCapFor(stats.footprint),
    movedThisTurn: false,
    attackedThisTurn: false,
    summonedThisTurn: false,
    freshlySummoned: spec.fresh ?? false,
    ...(spec.rune ? { rune: { defId: spec.rune, ownerSide: spec.side } } : {}),
  };

  state.units[id] = unit;
  return unit;
}

export function giveCard(state: GameState, side: Side, defId: string): string {
  const cmd = state.players[side];
  state.nextId += 1;
  const instanceId = `${side[0]}card${state.nextId}`;
  cmd.cards[instanceId] = { instanceId, defId };
  cmd.hand.push(instanceId);
  return instanceId;
}

/** Finds the hand card instance for a def id. */
export function handCard(state: GameState, side: Side, defId: string): string {
  const cmd = state.players[side];
  const found = cmd.hand.find((id) => cmd.cards[id]?.defId === defId);
  if (!found) throw new Error(`no ${defId} in ${side} hand`);
  return found;
}

/** Finds a unit by its def id and side. */
export function findUnit(state: GameState, defId: string, side: Side = 'player'): Unit {
  const u = Object.values(state.units).find((x) => x.defId === defId && x.side === side);
  if (!u) throw new Error(`no ${defId} on board for ${side}`);
  return u;
}

export function unitAtCoord(state: GameState, at: Coord): Unit | undefined {
  return Object.values(state.units).find((u) => u.anchor.x === at.x && u.anchor.y === at.y);
}

export interface RunResult {
  state: GameState;
  events: GameEvent[];
}

/** Applies a sequence of commands, accumulating events. */
export function run(state: GameState, ...commands: Command[]): RunResult {
  let cur = state;
  const events: GameEvent[] = [];
  for (const c of commands) {
    const res = applyCommand(cur, c);
    cur = res.state;
    events.push(...res.events);
  }
  return { state: cur, events };
}

export const play = (card: string, target: ChosenTarget = { kind: 'none' }): Command => ({
  type: 'playCard',
  card,
  target,
});

export const atTile = (x: number, y: number): ChosenTarget => ({ kind: 'tile', at: { x, y } });
export const atUnit = (id: string): ChosenTarget => ({ kind: 'entity', ref: { kind: 'unit', id } });
export const atObstacle = (id: string): ChosenTarget => ({
  kind: 'entity',
  ref: { kind: 'obstacle', id },
});
export const atPortrait = (side: Side): ChosenTarget => ({
  kind: 'entity',
  ref: { kind: 'portrait', side },
});
export const alongLine = (from: Coord, dir: Coord): ChosenTarget => ({ kind: 'line', from, dir });

export const unitRef = (id: string): TargetRef => ({ kind: 'unit', id });
export const portraitRef = (side: Side): TargetRef => ({ kind: 'portrait', side });

/** Filters an event stream by type, with correct narrowing. */
export function eventsOf<T extends GameEvent['t']>(
  events: GameEvent[],
  t: T,
): Extract<GameEvent, { t: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
}

export function damageTo(events: GameEvent[], unitId: string): number {
  return eventsOf(events, 'damageDealt')
    .filter((e) => e.target.kind === 'unit' && e.target.id === unitId)
    .reduce((sum, e) => sum + e.hpLoss, 0);
}
