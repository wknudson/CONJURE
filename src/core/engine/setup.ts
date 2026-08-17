/**
 * Combat initialisation: builds a GameState from an encounter definition.
 */

import type { CardInstanceId, Coord, School, Side } from '../../contract/ids.js';
import type { GameState, StepResult, CommanderState } from '../types/state.js';
import { territoryRows } from '../types/state.js';
import { canPlace } from './board.js';
import type { Ctx } from './context.js';
import type { CardInstance } from '../types/cards.js';
import type { EncounterDef } from '../data/encounters/registry.js';
import { getEncounterScript } from '../data/encounters/registry.js';
import { makeRng, shuffle } from '../util/rng.js';
import { makeCtx, emit } from './context.js';
import { DEFAULT_COMPANION, companionById } from '../data/companions.js';
import { HAND_LIMIT, OPENING_HAND, drawCards } from './deck.js';
import { summonUnit } from './spawn.js';
import { beginTurn } from './turn.js';

interface CommanderOpts {
  name: string;
  companionName?: string;
  companionSchool: School;
  hp: number;
  deckDefs: string[];
  prefix: string;
  width: number;
}

function buildCommander(o: CommanderOpts): { commander: CommanderState; nextId: number } {
  const { name, companionName, companionSchool, hp, deckDefs, prefix, width } = o;
  const startId = 0;
  const cards: Record<CardInstanceId, CardInstance> = {};
  const deck: CardInstanceId[] = [];
  let id = startId;

  for (const defId of deckDefs) {
    id += 1;
    const instanceId = `${prefix}${id}`;
    cards[instanceId] = { instanceId, defId };
    deck.push(instanceId);
  }

  // The Hero and Companion flank the board: Hero left of centre, Companion right.
  // The Companion's column is the lane its Resonance passive watches.
  const heroColumn = Math.max(0, Math.floor((width - 1) / 2) - 1);
  const companionColumn = Math.min(width - 1, Math.ceil((width - 1) / 2) + 1);

  return {
    commander: {
      name,
      ...(companionName ? { companionName } : {}),
      companionSchool,
      heroColumn,
      companionColumn,
      resonanceUsedThisTurn: false,
      hp,
      maxHp: hp,
      armor: 0,
      pips: 0,
      sparks: 0,
      deck,
      hand: [],
      discard: [],
      cards,
      handLimit: HAND_LIMIT,
    },
    nextId: id,
  };
}

export function createCombat(
  encounter: EncounterDef,
  seed: number,
  companionId?: string,
  deck?: string[],
): StepResult {
  const rng = makeRng(seed);

  // The chosen Companion decides the player's deck and Resonance school; the encounter
  // only supplies a default.
  const companion =
    companionById(companionId ?? '') ?? companionById(encounter.companionId ?? '') ?? DEFAULT_COMPANION;

  const player = buildCommander({
    name: encounter.playerName,
    companionName: companion.name,
    companionSchool: companion.school,
    hp: encounter.playerHp,
    // A custom deck from the builder overrides the companion's default list.
    deckDefs: deck && deck.length > 0 ? deck : companion.deck,
    prefix: 'pc',
    width: encounter.width,
  });
  const enemy = buildCommander({
    name: encounter.enemyName,
    companionSchool: encounter.enemySchool,
    hp: encounter.enemyHp,
    deckDefs: encounter.enemyDeck,
    prefix: 'ec',
    width: encounter.width,
  });

  player.commander.deck = shuffle(rng, player.commander.deck);
  enemy.commander.deck = shuffle(rng, enemy.commander.deck);

  // Frontal contact opens symmetric at 3 Pips (Module 3). beginTurn adds the first
  // turn's +1 on top, so the player acts meaningfully from turn one.
  const opening = encounter.startingPips ?? 3;
  player.commander.pips = opening;
  enemy.commander.pips = opening;

  const state: GameState = {
    rng,
    turn: 1,
    activeSide: 'player',
    phase: 'startOfTurn',
    width: encounter.width,
    height: encounter.height,
    units: {},
    obstacles: {},
    hazards: {},
    intents: [],
    declaredPlan: [],
    players: { player: player.commander, enemy: enemy.commander },
    encounter: {
      id: encounter.id,
      name: encounter.name,
      bossPhase: 1,
      firedGates: [],
      chainCancelled: false,
    },
    nextId: 0,
    suddenDeath: false,
    commanderDamagedThisRound: false,
    stalledRounds: 0,
    causeCounter: 0,
  };

  const ctx = makeCtx(state);
  emit(ctx, {
    t: 'combatStarted',
    grid: { width: state.width, height: state.height },
    encounterName: encounter.name,
  });

  // Map terrain. Placed before units so openings are never blocked by a spawn.
  for (const t of encounter.terrain ?? []) {
    state.nextId += 1;
    const id = `t${state.nextId}`;
    const isCover = t.kind === 'cover';
    state.obstacles[id] = {
      id,
      defId: isCover ? 'terrain_cover' : 'terrain_wall',
      name: isCover ? 'Bramble Screen' : 'Rubble Wall',
      side: 'player',
      anchor: { ...t.at },
      footprint: 1,
      hp: t.hp ?? (isCover ? 4 : 8),
      maxHp: t.hp ?? (isCover ? 4 : 8),
      destructible: true,
      ...(isCover ? { cover: true } : {}),
    };
  }

  // Enemy opening board.
  for (const [defId, x, y] of encounter.enemyOpeningBoard) {
    placeOpeningUnit(ctx, defId, 'enemy', { x, y });
  }

  // Free Vanguard for both sides, centred on each front line, so turn one is a real
  // tactical turn instead of a setup turn.
  const vanguard = encounter.vanguard === undefined ? 'vanguard_footman' : encounter.vanguard;
  if (vanguard) {
    const mid = Math.floor(encounter.width / 2);
    placeOpeningUnit(ctx, vanguard, 'player', { x: mid, y: encounter.height - 2 });
    placeOpeningUnit(ctx, vanguard, 'enemy', { x: mid, y: 1 });
  }

  // Opening hands, then the encounter script, then turn 1.
  drawCards(ctx, 'player', OPENING_HAND);
  drawCards(ctx, 'enemy', OPENING_HAND);

  getEncounterScript(encounter.id)?.setup?.(ctx);

  // Player turn 1: grants the first pip and draws.
  beginTurn(ctx, 'player');

  return { state, events: ctx.events };
}

/**
 * Places a unit that was already on the field when combat began — so it is not treated
 * as freshly summoned and can act, and escalate, from turn one.
 */
function placeOpeningUnit(ctx: Ctx, defId: string, side: Side, at: Coord): void {
  const spot = firstFreeNear(ctx.state, at, side);
  if (!spot) return;
  const id = summonUnit(ctx, defId, side, spot);
  if (!id) return;
  const unit = ctx.state.units[id];
  if (!unit) return;
  unit.summonedThisTurn = false;
  unit.freshlySummoned = false;
}

/** Falls back to a nearby tile in the same territory if the preferred one is taken. */
function firstFreeNear(state: GameState, at: Coord, side: Side): Coord | undefined {
  if (canPlace(state, at, 1)) return at;
  const rows = territoryRows(state, side);
  for (const y of rows) {
    for (let x = 0; x < state.width; x++) {
      const c = { x, y };
      if (canPlace(state, c, 1)) return c;
    }
  }
  return undefined;
}

export function sideName(state: GameState, side: Side): string {
  return state.players[side].name;
}
