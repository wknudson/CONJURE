/**
 * State -> snapshot projections. Events embed these so the renderer never reads live
 * state mid-animation.
 */

import type { CardInstanceId, Side } from '../../contract/ids.js';
import type { BoardView, CommanderView } from '../../contract/query.js';
import type { CardSnapshot, ObstacleSnapshot, UnitSnapshot } from '../../contract/snapshots.js';
import type { CommanderState, GameState } from '../types/state.js';
import { territoryDepthFor } from '../types/state.js';
import type { Obstacle, Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import { effectiveCost } from './deck.js';
import { MARKS } from '../data/marks.js';
import { resonanceFor } from '../data/resonance.js';
import { rosterBudgetFor, rosterPointsOf } from '../data/roster.js';
import { allObstacles, allUnits } from './board.js';
import { isSpent } from './movement.js';
import { isClimaxed } from './growth.js';

export function toSnapshot(unit: Unit): UnitSnapshot {
  return {
    id: unit.id,
    defId: unit.defId,
    name: unit.name,
    side: unit.side,
    anchor: { ...unit.anchor },
    footprint: unit.footprint,
    hp: unit.hp,
    maxHp: unit.maxHp,
    armor: unit.armor,
    atk: unit.atk,
    mov: unit.mov,
    rangeMin: unit.rangeMin,
    rangeMax: unit.rangeMax,
    ...(unit.attackProfile ? { attackProfile: unit.attackProfile } : {}),
    school: unit.school,
    keywords: [...unit.keywords],
    archetype: unit.archetype,
    escalation: unit.escalation,
    ...(unit.aura
      ? { aura: { ...unit.aura, climaxed: isClimaxed(unit) } }
      : {}),
    exhausted: isSpent(unit),
  };
}

export function toObstacleSnapshot(o: Obstacle): ObstacleSnapshot {
  return {
    id: o.id,
    defId: o.defId,
    name: o.name,
    anchor: { ...o.anchor },
    hp: o.hp,
    maxHp: o.maxHp,
    ...(o.cover ? { cover: true } : {}),
  };
}

/**
 * How many times this side's Resonance may fire in a turn.
 *
 * One place, so the reducer and the HUD's "ready" lamp can never disagree about whether
 * the passive is spent.
 */
export function resonanceLimit(c: CommanderState): number {
  return c.doubleResonance ? 2 : 1;
}

export function toCardSnapshot(state: GameState, side: Side, id: CardInstanceId): CardSnapshot {
  const inst = state.players[side].cards[id];
  const def = inst ? CARDS[inst.defId] : undefined;
  if (!inst || !def) {
    return {
      instanceId: id,
      defId: 'unknown',
      name: '???',
      cost: { pips: 0, marrow: 0 },
      school: 'neutral',
      source: 'hero',
      kind: 'spell',
      text: '',
      keywords: [],
    };
  }
  return {
    instanceId: inst.instanceId,
    defId: def.id,
    name: def.name,
    // The price this side actually pays, so a discounted hybrid reads on its own face
    // rather than surprising the player at the till.
    // The printed price is zero for an X card and means nothing; `xCost` below is what
    // the face should actually be showing.
    cost: effectiveCost(state, side, def, undefined, inst.mods),
    ...(def.xCost ? { xCost: { max: def.xCost.max } } : {}),
    school: def.school,
    source: def.source,
    kind: def.kind,
    text: def.text,
    keywords: [...def.keywords],
    ...(def.unit
      ? { stats: { atk: def.unit.atk, hp: def.unit.hp, mov: def.unit.mov } }
      : {}),
    ...(def.range !== undefined ? { range: def.range } : {}),
    ...(inst.ephemeral ? { ephemeral: true } : {}),
  };
}

function toCommanderView(state: GameState, side: Side): CommanderView {
  const c = state.players[side];
  const resonance = resonanceFor(c.companionSchool);
  return {
    hp: c.hp,
    maxHp: c.maxHp,
    armor: c.armor,
    pips: c.pips,
    marrow: c.marrow,
    handCount: c.hand.length,
    deckCount: c.deck.length,
    discardCount: c.discard.length,
    name: c.name,
    ...(c.companionName ? { companionName: c.companionName } : {}),
    heroColumn: c.heroColumn,
    companionColumn: c.companionColumn,
    companionSchool: c.companionSchool,
    resonanceUsed: c.resonancesThisTurn >= resonanceLimit(c),
    ...(resonance ? { resonanceName: resonance.name } : {}),
  };
}

export function toBoardView(state: GameState): BoardView {
  const units = allUnits(state);
  const obstacles = allObstacles(state);

  const marks: BoardView['marks'] = [];
  for (const e of [...units, ...obstacles]) {
    if (!e.mark) continue;
    const def = MARKS[e.mark.defId];
    if (!def) continue;
    marks.push({
      hostId: e.id,
      at: { ...e.anchor },
      mark: { defId: def.id, name: def.name, school: def.school, ownerSide: e.mark.ownerSide },
    });
  }

  const statuses: BoardView['statuses'] = [];
  for (const u of units) {
    for (const [kind, stacks] of Object.entries(u.statuses)) {
      if (stacks && stacks > 0) statuses.push({ unitId: u.id, kind, stacks });
    }
  }

  return {
    width: state.width,
    height: state.height,
    territoryDepth: territoryDepthFor(state.height),
    turn: state.turn,
    activeSide: state.activeSide,
    phase: state.phase,
    units: units.map(toSnapshot),
    obstacles: obstacles.map(toObstacleSnapshot),
    hazards: Object.values(state.hazards).map((h) => ({
      at: { ...h.at },
      kind: h.kind,
      turns: h.turns,
    })),
    intents: state.intents.map((i) => ({
      unitId: i.unitId,
      kind: i.kind,
      ...(i.at ? { at: { ...i.at } } : {}),
      ...(i.path ? { path: i.path.map((c) => ({ ...c })) } : {}),
      damage: i.damage,
      ...(i.label ? { label: i.label } : {}),
    })),
    marks,
    statuses,
    escalation: units
      .filter((u) => u.escalation > 0)
      .map((u) => ({ unitId: u.id, stacks: u.escalation })),
    anchors: state.anchors.map((c) => ({ ...c })),
    // What this arena seats, in points. Derived rather than stored, like every other view
    // field — and shipped here so the deploy tray reads the same number `deployRefusal`
    // enforces rather than recomputing it from the board's dimensions itself.
    deployBudget: rosterBudgetFor(state.width, state.height),
    roster: state.players.player.roster.map((r) => ({
      defId: r.defId,
      name: CARDS[r.defId]?.name ?? r.defId,
      points: CARDS[r.defId] ? rosterPointsOf(CARDS[r.defId]!) : 0,
      footprint: CARDS[r.defId]?.unit?.footprint ?? 1,
      status: r.status,
      ...(r.unitId ? { unitId: r.unitId } : {}),
      ...(r.fellAt ? { fellAt: { ...r.fellAt } } : {}),
    })),
    player: toCommanderView(state, 'player'),
    enemy: toCommanderView(state, 'enemy'),
    encounterName: state.encounter.name,
    // Only when true, so an ordinary fight's view is byte-identical to what it was.
    ...(state.encounter.rout ? { rout: true as const } : {}),
    bossPhase: state.encounter.bossPhase,
  };
}
