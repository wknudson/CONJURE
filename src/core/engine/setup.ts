/**
 * Combat initialisation: builds a GameState from an encounter definition.
 */

import type { CardInstanceId, Coord, School, Side } from '../../contract/ids.js';
import type { GameState, StepResult, CommanderState } from '../types/state.js';
import { territoryDepthFor, territoryRows } from '../types/state.js';
import { canPlace } from './board.js';
import type { Ctx } from './context.js';
import type { CardInstance } from '../types/cards.js';
import type { EncounterDef } from '../data/encounters/registry.js';
import { getEncounterScript } from '../data/encounters/registry.js';
import { makeRng, nextInt, shuffle } from '../util/rng.js';
import { makeCtx, emit } from './context.js';
import { DEFAULT_COMPANION, companionById } from '../data/companions.js';
import { HAND_LIMIT, OPENING_HAND, drawCards } from './deck.js';
import { placeOpeningUnit, spawnObstacle } from './spawn.js';
import { beginTurn } from './turn.js';

/**
 * Where the Hero and Companion stand: they flank the board, Hero left of centre and
 * Companion right. The Companion's column is the lane its Resonance passive watches.
 *
 * Exported because the test scenario builder needs the identical placement — two copies
 * of this arithmetic drifted apart once already.
 */
export function flankColumns(width: number): { heroColumn: number; companionColumn: number } {
  return {
    heroColumn: Math.max(0, Math.floor((width - 1) / 2) - 1),
    companionColumn: Math.min(width - 1, Math.ceil((width - 1) / 2) + 1),
  };
}

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

  const { heroColumn, companionColumn } = flankColumns(width);

  return {
    commander: {
      name,
      ...(companionName ? { companionName } : {}),
      companionSchool,
      heroColumn,
      companionColumn,
      resonanceUsedThisTurn: false,
      reactionPipsThisTurn: 0,
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

/** Smallest arena the rules stay coherent on, and the largest worth framing. */
export const MIN_ARENA = 4;
export const MAX_ARENA = 12;

/**
 * Rejects an unplayable arena at construction rather than midway through a battle.
 *
 * Encounters are hand-authored data, so these are authoring mistakes, not player
 * actions — a plain Error, not an IllegalCommandError. Nothing checked any of this
 * before: a typo in a coordinate produced terrain quietly dropped on the floor, and an
 * arena too small to hold two territories produced a game with no neutral ground.
 */
export function validateEncounter(encounter: EncounterDef): void {
  const { id, width, height } = encounter;
  if (width < MIN_ARENA || height < MIN_ARENA) {
    throw new Error(`${id}: arena ${width}x${height} is below the ${MIN_ARENA}x${MIN_ARENA} minimum`);
  }
  if (width > MAX_ARENA || height > MAX_ARENA) {
    throw new Error(`${id}: arena ${width}x${height} exceeds the ${MAX_ARENA}x${MAX_ARENA} maximum`);
  }

  const within = (c: Coord): boolean => c.x >= 0 && c.y >= 0 && c.x < width && c.y < height;

  // Terrain in a summon zone would silently shrink the deployable area instead of
  // announcing itself, so it is a hard error rather than a judgement call.
  const depth = territoryDepthFor(height);
  const homeRows = new Set<number>();
  for (let i = 0; i < depth; i++) homeRows.add(i).add(height - 1 - i);

  for (const t of encounter.terrain ?? []) {
    if (!within(t.at)) throw new Error(`${id}: terrain at ${t.at.x},${t.at.y} is outside the arena`);
    if (homeRows.has(t.at.y)) {
      throw new Error(`${id}: terrain at ${t.at.x},${t.at.y} sits in a territory row`);
    }
  }

  for (const [defId, x, y] of encounter.enemyOpeningBoard) {
    if (!within({ x, y })) {
      throw new Error(`${id}: opening unit ${defId} at ${x},${y} is outside the arena`);
    }
  }
}

export function createCombat(
  encounter: EncounterDef,
  seed: number,
  companionId?: string,
  deck?: string[],
): StepResult {
  validateEncounter(encounter);

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
      ...(encounter.weather ? { weather: encounter.weather } : {}),
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
  // tactical turn instead of a setup turn. The two rows below are distinct for every
  // arena validateEncounter accepts (height >= 4), so the pair can never collide.
  const vanguard = encounter.vanguard === undefined ? 'vanguard_footman' : encounter.vanguard;
  if (vanguard) {
    const mid = Math.floor(encounter.width / 2);
    placeOpeningUnit(ctx, vanguard, 'player', { x: mid, y: encounter.height - 2 });
    placeOpeningUnit(ctx, vanguard, 'enemy', { x: mid, y: 1 });
  }

  // The Companion takes the field, standing in its own lane on the back row. The Hero
  // stays off-grid as the Architect; only the Companion has a body to lose.
  const boundId = placeOpeningUnit(ctx, companion.unitCardId, 'player', {
    x: player.commander.companionColumn,
    y: encounter.height - 1,
  });
  if (boundId) {
    state.players.player.companionUnitId = boundId;
    state.players.player.companionUnitDefId = companion.unitCardId;
  }

  // The enemy fields one too, when the encounter says so. A side without one keeps its
  // Commander wholly off-grid, which is what every fight looked like before mirrors —
  // and everything downstream still keys off companionUnitDefId being absent.
  const foe = encounter.enemyCompanion;
  if (foe) {
    const foeAt = foe.at ?? { x: enemy.commander.companionColumn, y: 0 };
    const foeId = placeOpeningUnit(ctx, foe.unitCardId, 'enemy', foeAt);
    if (foeId) {
      state.players.enemy.companionUnitId = foeId;
      state.players.enemy.companionUnitDefId = foe.unitCardId;
    }
  }

  // Currents are part of the map, laid down like terrain rather than conjured.
  for (const c of encounter.currents ?? []) {
    state.hazards[`${c.at.x},${c.at.y}`] = {
      kind: 'current',
      at: { ...c.at },
      turns: 1,
      owner: 'player',
      permanent: true,
      dir: { ...c.dir },
    };
  }

  scatterGeodes(ctx, encounter);

  // Opening hands, then the encounter script, then turn 1.
  drawCards(ctx, 'player', OPENING_HAND);
  drawCards(ctx, 'enemy', OPENING_HAND);

  getEncounterScript(encounter.id)?.setup?.(ctx);

  // Player turn 1: grants the first pip and draws.
  beginTurn(ctx, 'player');

  return { state, events: ctx.events };
}

/**
 * Scatters Spark Geodes across the neutral middle.
 *
 * Never in either territory: a geode in a deploy zone would either be free for its owner
 * or block their own summons, and neither is the intended decision. On neutral ground it
 * is a prize both sides must walk to, which puts a reason to contest the middle on the
 * board from turn one.
 *
 * Placed last, after every unit and every wall, so it can see what ground is actually
 * free — and it consumes the seeded stream, so the same seed lays out the same field.
 */
function scatterGeodes(ctx: Ctx, encounter: EncounterDef): void {
  const spec = encounter.sparkGeodes;
  if (!spec) return;

  const state = ctx.state;
  const off = new Set<number>();
  for (const side of ['player', 'enemy'] as const) {
    for (const y of territoryRows(state, side)) off.add(y);
  }

  const open: Coord[] = [];
  for (let y = 0; y < state.height; y++) {
    if (off.has(y)) continue;
    for (let x = 0; x < state.width; x++) {
      if (canPlace(state, { x, y }, 1)) open.push({ x, y });
    }
  }
  if (open.length === 0) return;

  const span = Math.max(0, spec.max - spec.min);
  const count = Math.min(spec.min + nextInt(state.rng, span + 1), open.length);

  for (let i = 0; i < count; i++) {
    const at = open.splice(nextInt(state.rng, open.length), 1)[0];
    if (!at) break;
    spawnObstacle(ctx, 'spark_geode', 'player', at);
  }
}

export function sideName(state: GameState, side: Side): string {
  return state.players[side].name;
}
