/**
 * State -> snapshot projections. Events embed these so the renderer never reads live
 * state mid-animation.
 */

import type { CardInstanceId, Side } from '../../contract/ids.js';
import type { BoardView, CommanderView } from '../../contract/query.js';
import type { CardSnapshot, ObstacleSnapshot, UnitSnapshot } from '../../contract/snapshots.js';
import type { GameState } from '../types/state.js';
import { territoryDepthFor } from '../types/state.js';
import type { Obstacle, Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import { RUNES } from '../data/runes.js';
import { resonanceFor } from '../data/resonance.js';
import { allObstacles, allUnits } from './board.js';
import { isSpent } from './movement.js';

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
    school: unit.school,
    keywords: [...unit.keywords],
    archetype: unit.archetype,
    escalation: unit.escalation,
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

export function toCardSnapshot(state: GameState, side: Side, id: CardInstanceId): CardSnapshot {
  const inst = state.players[side].cards[id];
  const def = inst ? CARDS[inst.defId] : undefined;
  if (!inst || !def) {
    return {
      instanceId: id,
      defId: 'unknown',
      name: '???',
      cost: 0,
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
    cost: def.cost,
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
    sparks: c.sparks,
    handCount: c.hand.length,
    deckCount: c.deck.length,
    discardCount: c.discard.length,
    name: c.name,
    ...(c.companionName ? { companionName: c.companionName } : {}),
    heroColumn: c.heroColumn,
    companionColumn: c.companionColumn,
    companionSchool: c.companionSchool,
    resonanceUsed: c.resonanceUsedThisTurn,
    ...(resonance ? { resonanceName: resonance.name } : {}),
  };
}

export function toBoardView(state: GameState): BoardView {
  const units = allUnits(state);
  const obstacles = allObstacles(state);

  const runes: BoardView['runes'] = [];
  for (const e of [...units, ...obstacles]) {
    if (!e.rune) continue;
    const def = RUNES[e.rune.defId];
    if (!def) continue;
    runes.push({
      hostId: e.id,
      at: { ...e.anchor },
      rune: { defId: def.id, name: def.name, school: def.school, ownerSide: e.rune.ownerSide },
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
    runes,
    statuses,
    escalation: units
      .filter((u) => u.escalation > 0)
      .map((u) => ({ unitId: u.id, stacks: u.escalation })),
    player: toCommanderView(state, 'player'),
    enemy: toCommanderView(state, 'enemy'),
    encounterName: state.encounter.name,
    bossPhase: state.encounter.bossPhase,
  };
}
