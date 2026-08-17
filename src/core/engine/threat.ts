/**
 * Threat projection: which tiles an enemy could strike on their next turn.
 *
 * This is the single biggest readability win available in a grid tactics game. Without
 * it a newcomer cannot tell a safe tile from a fatal one, and every loss feels arbitrary.
 * With it, positioning becomes a decision rather than a guess.
 *
 * A tile is threatened if some enemy unit can reach a position from which that tile
 * falls inside its attack range — so it accounts for movement and reach together, not
 * range alone.
 */

import type { Coord, Side, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import { inBounds } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { canPlace, unitsOf, opposite } from './board.js';
import { hasLoS } from './los.js';
import { cellsAt, chebyshev, DIRS_8, add } from '../util/grid.js';

export interface ThreatMap {
  /** Every tile some enemy could attack next turn. */
  tiles: Coord[];
  /** Per-tile total damage if every unit that can reach it does attack. */
  damageByTile: Map<string, number>;
  /** Enemy units that can already reach the given side's Commander. */
  commanderThreats: UnitId[];
}

/**
 * Anchors a unit could occupy next turn, ignoring the friction of other units moving.
 * Deliberately optimistic: a threat display should over-warn rather than under-warn.
 */
function reachableAnchors(state: GameState, unit: Unit): Coord[] {
  const out: Coord[] = [{ ...unit.anchor }];
  // Entangled units are rooted but can still swing at whatever is beside them.
  if (unit.statuses.entangle) return out;

  const seen = new Set<string>([coordKey(unit.anchor)]);
  let frontier: Coord[] = [unit.anchor];

  for (let step = 0; step < unit.mov; step++) {
    const next: Coord[] = [];
    for (const cur of frontier) {
      for (const dir of DIRS_8) {
        const anchor = add(cur, dir);
        const key = coordKey(anchor);
        if (seen.has(key)) continue;
        if (!canPlace(state, anchor, unit.footprint, unit.id)) continue;
        seen.add(key);
        next.push(anchor);
        out.push(anchor);
      }
    }
    frontier = next;
  }

  return out;
}

/** Tiles a unit standing at `anchor` could attack. */
function strikeableFrom(state: GameState, unit: Unit, anchor: Coord): Coord[] {
  const from = cellsAt(anchor, unit.footprint);
  const out: Coord[] = [];

  for (let y = 0; y < state.height; y++) {
    for (let x = 0; x < state.width; x++) {
      const target = { x, y };
      if (from.some((c) => c.x === x && c.y === y)) continue;

      const dist = Math.min(...from.map((c) => chebyshev(c, target)));
      if (dist < unit.rangeMin || dist > unit.rangeMax) continue;
      // Ranged attacks still need a clear line; melee never does.
      if (dist > 1 && !from.some((c) => hasLoS(state, c, target, [unit.id]))) continue;

      out.push(target);
    }
  }

  return out;
}

/**
 * Builds the threat map faced by `side` — that is, what the opposing units can hit.
 */
export function threatMap(state: GameState, side: Side): ThreatMap {
  const damageByTile = new Map<string, number>();
  const commanderThreats: UnitId[] = [];
  const homeRows = side === 'player' ? [state.height - 1, state.height - 2] : [0, 1];

  for (const foe of unitsOf(state, opposite(side))) {
    // Held units threaten nothing at all — they can neither move nor strike.
    if (foe.statuses.freeze || foe.statuses.stun) continue;

    const anchors = reachableAnchors(state, foe);
    const tiles = new Set<string>();

    for (const anchor of anchors) {
      // Melee reaches a Commander by standing in their home rows; ranged needs a line.
      if (!commanderThreats.includes(foe.id)) {
        const cells = cellsAt(anchor, foe.footprint);
        const canReachCommander =
          foe.rangeMax <= 2
            ? cells.some((c) => homeRows.includes(c.y))
            : cells.some((c) => inBounds(state, c));
        if (canReachCommander) commanderThreats.push(foe.id);
      }

      for (const t of strikeableFrom(state, foe, anchor)) tiles.add(coordKey(t));
    }

    for (const key of tiles) {
      damageByTile.set(key, (damageByTile.get(key) ?? 0) + foe.atk);
    }
  }

  const tiles: Coord[] = [];
  for (const key of damageByTile.keys()) {
    const [x, y] = key.split(',').map(Number);
    tiles.push({ x: x ?? 0, y: y ?? 0 });
  }

  return { tiles, damageByTile, commanderThreats };
}
