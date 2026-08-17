/**
 * Legal target enumeration. One implementation serves both the UI (tile highlighting)
 * and the AI (action enumeration), so they can never disagree about what is playable.
 */

import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import type { CardDef, ChosenTarget } from '../types/cards.js';
import { effectContainsOp } from '../types/cards.js';
import type { GameState } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import {
  allEntities,
  emptyTiles,
  entityAt,
  getEntity,
  opposite,
  refOf,
  summonSpots,
  unitsOf,
} from './board.js';
import { canAttack, canAct } from './movement.js';
import { hasLoS, hasLoSToPortrait } from './los.js';
import { DIRS_8, cellsOf } from '../util/grid.js';
import { inBounds, portraitRow, territoryRows } from '../types/state.js';

/**
 * Where a card is cast from.
 *
 * The Hero works from off the board and so reaches all of it — that is what being the
 * Architect means. A Companion card is thrown by the Companion, so it reaches only as
 * far as the Companion can see and stretch from where it is standing.
 *
 * `'global'` means unrestricted; a cell list means measure from these; `'none'` means
 * there is nothing to cast from and the card has no legal target at all.
 */
function castOriginCells(state: GameState, side: Side, def: CardDef): Coord[] | 'global' | 'none' {
  if (def.source !== 'companion' || def.range === undefined) return 'global';

  // A side that never had a body -- every enemy Commander today -- casts as it always
  // did. Without this, the enemy AI would silently lose every ranged Companion card in
  // its deck the moment ranges were assigned.
  if (!state.players[side].companionUnitDefId) return 'global';

  const id = state.players[side].companionUnitId;
  const body = id ? state.units[id] : undefined;
  return body ? cellsOf(body) : 'none';
}

/** Whether any origin cell can reach any target cell, within range and sight. */
function inCastRange(
  state: GameState,
  origin: Coord[],
  cells: Coord[],
  def: CardDef,
  ignore: string[],
): boolean {
  const range = def.range ?? Infinity;
  return origin.some((o) =>
    cells.some(
      (c) =>
        Math.max(Math.abs(o.x - c.x), Math.abs(o.y - c.y)) <= range &&
        (!def.needsLoS || hasLoS(state, o, c, ignore)),
    ),
  );
}

/** Every legal way to play this card right now. Empty means it is unplayable. */
export function legalCardTargets(state: GameState, side: Side, defId: string): ChosenTarget[] {
  const def = CARDS[defId];
  if (!def) return [];

  const origin = castOriginCells(state, side, def);
  if (origin === 'none') return [];
  const bodyId = state.players[side].companionUnitId;
  // The caster never blocks its own line.
  const ignore = bodyId ? [bodyId] : [];
  const reaches = (cells: Coord[], alsoIgnore: string[] = []): boolean =>
    origin === 'global' || inCastRange(state, origin, cells, def, [...ignore, ...alsoIgnore]);

  switch (def.target.kind) {
    case 'none':
      return [{ kind: 'none' }];

    case 'global':
      // A board-wide detonation with nothing to detonate would silently burn its whole
      // cost, so treat it as having no legal target rather than letting it be wasted.
      if (def.effect.op === 'detonateAllRunes' && !allEntities(state).some((e) => e.rune)) {
        return [];
      }
      return [{ kind: 'global' }];

    case 'emptyTile': {
      const tiles =
        def.target.zone === 'ownTerritory'
          ? summonSpots(state, side, def.target.footprint)
          : emptyTiles(state);
      // Summons into your own territory are placed by the Hero and are never ranged;
      // a tile-targeted spell cast anywhere on the board is thrown by the Companion.
      return tiles.filter((at) => reaches([at])).map((at) => ({ kind: 'tile' as const, at }));
    }

    case 'entity': {
      const spec = def.target;
      // Two things can never be done to a Bound Form, and offering them would waste the
      // card: it cannot be sacrificed, and a rune attached to it could never detonate,
      // because its damage is redirected to the Pact before runes are ever evaluated.
      const barred =
        effectContainsOp(def.effect, 'sacrificeTarget') ||
        effectContainsOp(def.effect, 'attachRune');
      const out: ChosenTarget[] = [];
      for (const e of allEntities(state)) {
        const isUnitEntity = 'atk' in e;
        if (!spec.includeObstacles && !isUnitEntity) continue;
        if (spec.side === 'ally' && e.side !== side) continue;
        if (spec.side === 'enemy' && e.side === side) continue;
        if (spec.requireUnexhausted && isUnitEntity && !canAct(e as Unit)) continue;
        if (barred && isUnitEntity && (e as Unit).keywords.includes('BoundForm')) continue;
        // The target itself never blocks the line to itself.
        if (!reaches(cellsOf(e), [e.id])) continue;
        out.push({ kind: 'entity', ref: refOf(e) });
      }
      return out;
    }

    case 'adjacentEnemy': {
      const out: ChosenTarget[] = [];
      for (const foe of unitsOf(state, opposite(side))) {
        out.push({ kind: 'entity', ref: { kind: 'unit', id: foe.id } });
      }
      return out;
    }

    case 'line': {
      const out: ChosenTarget[] = [];
      const length = def.target.length;
      for (let y = 0; y < state.height; y++) {
        for (let x = 0; x < state.width; x++) {
          const from = { x, y };
          // A line erupts at `from` and runs outward, so that origin tile is what has to
          // be in reach — not the far end of the line.
          if (!reaches([from])) continue;
          for (const dir of DIRS_8) {
            // Only offer lines that actually cover at least one entity.
            if (!lineCovers(state, from, dir, length).some((c) => entityAt(state, c))) continue;
            out.push({ kind: 'line', from, dir });
          }
        }
      }
      return out;
    }

    case 'unitOrPortrait': {
      const out: ChosenTarget[] = [
        { kind: 'entity', ref: { kind: 'portrait', side } },
      ];
      for (const u of unitsOf(state, side)) {
        // Armor on a Bound Form would never be consumed: its damage is redirected to the
        // Pact before unit armor is considered. The portrait above is the real target.
        if (u.keywords.includes('BoundForm')) continue;
        out.push({ kind: 'entity', ref: { kind: 'unit', id: u.id } });
      }
      return out;
    }
  }
}

export function lineCovers(state: GameState, from: Coord, dir: Coord, length: number): Coord[] {
  const out: Coord[] = [];
  let cur = { ...from };
  for (let i = 0; i < length; i++) {
    if (!inBounds(state, cur)) break;
    out.push({ ...cur });
    cur = { x: cur.x + dir.x, y: cur.y + dir.y };
  }
  return out;
}

/**
 * Everything a unit may attack: enemy entities in range with line of sight, plus the
 * enemy portrait when reachable.
 *
 * Melee (range 1-2) must stand in the opponent's two home rows to strike the portrait.
 * Ranged (3+) needs a clear straight or diagonal vector to it.
 */
export function legalAttacks(state: GameState, unit: Unit): TargetRef[] {
  if (!canAttack(unit)) return [];

  const out: TargetRef[] = [];
  const foeSide = opposite(unit.side);

  for (const e of allEntities(state)) {
    if (e.id === unit.id) continue;
    // Obstacles are terrain, not allies: either side may break a pillar to open a lane,
    // regardless of who conjured it.
    const isObstacle = !('atk' in e);
    const targetIsFeral = !isObstacle && (e as Unit).keywords.includes('Feral');
    const attackerIsFeral = unit.keywords.includes('Feral');

    if (attackerIsFeral) {
      // A beast has no allies. It will bite anything that is not also a beast, on
      // whichever side that thing happens to be — which is the whole of "hostile to
      // both", falling out of the target list rather than needing a rule of its own.
      if (targetIsFeral) continue;
    } else {
      // And nobody counts a beast as an ally either, including the side whose record it
      // sits in: it is on the board the way a pillar is, and either army may swing at it.
      if (!isObstacle && !targetIsFeral && e.side === unit.side) continue;
    }
    if (!canStrike(state, unit, cellsOf(unit), cellsOf(e), [unit.id, e.id])) continue;
    out.push(refOf(e));
  }

  if (canHitPortrait(state, unit, foeSide)) {
    out.push({ kind: 'portrait', side: foeSide });
  }

  return out;
}

/**
 * Can this unit strike these tiles from those ones?
 *
 * The single answer to "is that in reach", used by attack legality, by the danger
 * overlay, and by anything else that needs to know. It lived in three hand-copied
 * versions before, which is two more than can be kept in step: a change to reach or
 * sight had to be made identically in each, and the copies had already drifted apart
 * once. Everything that decides reach now goes through here.
 *
 * `from` is passed separately from the unit because the threat map asks the question
 * about anchors the unit could move to, not the one it currently occupies.
 */
export function canStrike(
  state: GameState,
  unit: Unit,
  from: Coord[],
  targets: Coord[],
  ignoreIds: UnitId[] = [unit.id],
): boolean {
  let best = Infinity;
  for (const c of from) {
    for (const t of targets) {
      best = Math.min(best, Math.max(Math.abs(c.x - t.x), Math.abs(c.y - t.y)));
    }
  }
  if (best < unit.rangeMin || best > unit.rangeMax) return false;

  // A mortar lobs over everything, which is the whole of what it buys with its blind
  // spot: no line is needed, at any distance.
  if (unit.attackProfile === 'arcing') return true;

  // A marksman fires only down a rank, file, or diagonal. Being off the line is a
  // complete defence, whatever the distance.
  if (unit.attackProfile === 'lineOnly' && !onLine(from, targets)) return false;

  // Reaching past arm's length means seeing what you are reaching for; melee never does.
  if (best <= 1) return true;
  return from.some((c) => targets.some((t) => hasLoS(state, c, t, ignoreIds)));
}

/** Whether any attacking cell shares a rank, file, or diagonal with any target cell. */
function onLine(from: Coord[], targets: Coord[]): boolean {
  return from.some((c) =>
    targets.some((t) => {
      const dx = Math.abs(c.x - t.x);
      const dy = Math.abs(c.y - t.y);
      return dx === 0 || dy === 0 || dx === dy;
    }),
  );
}

export function canHitPortrait(state: GameState, unit: Unit, targetSide: Side): boolean {
  const cells = cellsOf(unit);

  if (unit.rangeMax <= 2 && unit.attackProfile === undefined) {
    // Melee (Draft 7 §5.2): reaching the enemy's front or back row is the whole
    // requirement — standing in their territory is what puts the portrait in reach.
    const homeRows = territoryRows(state, targetSide);
    return cells.some((c) => homeRows.includes(c.y));
  }

  // The portrait stands one row beyond the board's edge. Everything ranged measures
  // against that virtual row, so the profiles apply to the Commander exactly as they do
  // to a unit: a mortar lobs at the face within its envelope and cannot hit it from
  // point-blank, and a marksman needs a straight line to it.
  const row = portraitRow(state, targetSide);
  const mid = Math.floor((state.width - 1) / 2);
  const portraitCells: Coord[] = [{ x: mid, y: row }];

  if (unit.attackProfile === 'arcing') {
    const dist = Math.min(
      ...cells.map((c) => Math.max(Math.abs(c.x - mid), Math.abs(c.y - row))),
    );
    return dist >= unit.rangeMin && dist <= unit.rangeMax;
  }

  if (unit.attackProfile === 'lineOnly' && !onLine(cells, portraitCells)) return false;

  // Ranged: needs a clear vector to the off-grid portrait.
  return cells.some((c) => hasLoSToPortrait(state, c, targetSide, [unit.id]));
}

/** Units the given side may sacrifice for Sparks right now. */
export function sacrificeCandidates(state: GameState, side: Side): Unit[] {
  return unitsOf(state, side).filter(
    // Nothing offers up a wolf that does not belong to it in the first place.
    (u) => canAct(u) && u.sacrificeValue > 0 && !u.keywords.includes('Feral'),
  );
}

/** Resolves an entity reference to its board anchor, for previews and AI heuristics. */
export function anchorOf(state: GameState, ref: TargetRef): Coord | undefined {
  if (ref.kind === 'portrait') return undefined;
  return getEntity(state, ref.id)?.anchor;
}
