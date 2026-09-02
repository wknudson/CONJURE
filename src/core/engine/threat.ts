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
 *
 * It is a forecast of the enemy's **next** turn, and it reads the board as the engine will
 * find it then, not as it stands now. Every status that gates an action counts down by one
 * at the start of its owner's turn, before that owner acts (`startOfTurnStatuses`), so the
 * question "will this body be held?" is "will it still carry the status after one tick?",
 * and "how far will it stride?" is "what will Fleet be worth after one tick?". Reading the
 * live stacks instead answered both wrong: a one-stack Freeze read as a body that threatens
 * nothing, and it is a body that acts freely, because the ice is gone before it moves.
 */

import type { Coord, Side, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import { inBounds, visionClamp } from '../types/state.js';
import type { Unit } from '../types/units.js';
import { unitsOf, opposite } from './board.js';
import { canStrike } from './targeting.js';
import { canTraverse, licenseFor } from './movement.js';
import { climaxTraitOf } from './growth.js';
import { hasLoS } from './los.js';
import { cellsAt, DIRS_8, add } from '../util/grid.js';

export interface ThreatMap {
  /** Every tile some enemy could attack next turn. */
  tiles: Coord[];
  /** Per-tile total damage if every unit that can reach it does attack. */
  damageByTile: Map<string, number>;
  /** Enemy units that can already reach the given side's Commander. */
  commanderThreats: UnitId[];
}

/**
 * A status as it will stand after its owner's start-of-turn tick.
 *
 * `decay` in `status.ts` takes one stack off freeze, stun, entangle, exhaust and fleet at
 * the start of the owner's turn — before the owner acts. The forecast has to look through
 * that tick or it describes the wrong board. The Anchor is the one gate that does not
 * decay: it holds until the tether resolves.
 */
function afterTick(stacks: number | undefined): number {
  return Math.max(0, (stacks ?? 0) - 1);
}

/** Whether this body will be unable to act at all on its next turn. */
export function heldNextTurn(unit: Unit): boolean {
  if ((unit.statuses.anchor ?? 0) > 0) return true;
  return (
    afterTick(unit.statuses.freeze) > 0 ||
    afterTick(unit.statuses.stun) > 0 ||
    afterTick(unit.statuses.exhaust) > 0
  );
}

/**
 * How far this body will stride next turn.
 *
 * `movementRange` adds the live Fleet; the forecast adds what Fleet will be worth once its
 * owner's tick has taken a stack. A 0-MOV emplacement stays at zero whatever it carries —
 * `canMove` asks the base stat for the same reason: fleetness lengthens a stride, it does
 * not grant one.
 */
function strideNextTurn(unit: Unit): number {
  if (unit.mov <= 0) return 0;
  return unit.mov + afterTick(unit.statuses.fleet);
}

/**
 * Anchors a unit could occupy next turn, ignoring the friction of other units moving.
 * Deliberately optimistic: a threat display should over-warn rather than under-warn.
 *
 * Walked with the body's own licence, so a Climaxed Static Charge is projected straight
 * through the line it will charge through and a Heavy Footprint through the wall it will
 * break. Ground costs are ignored on purpose — rubble slows a real route, and a forecast
 * that assumed the slower route would be the one under-warning.
 */
function reachableAnchors(state: GameState, unit: Unit): Coord[] {
  const out: Coord[] = [{ ...unit.anchor }];
  // Rooted bodies stay put but can still swing at whatever is beside them — if the
  // roots will still hold once their owner's tick has taken a stack.
  if (afterTick(unit.statuses.entangle) > 0) return out;

  const license = licenseFor(unit);
  const seen = new Set<string>([coordKey(unit.anchor)]);
  let frontier: Coord[] = [unit.anchor];

  for (let step = 0; step < strideNextTurn(unit); step++) {
    const next: Coord[] = [];
    for (const cur of frontier) {
      for (const dir of DIRS_8) {
        const anchor = add(cur, dir);
        const key = coordKey(anchor);
        if (seen.has(key)) continue;
        if (!canTraverse(state, anchor, unit, license)) continue;
        seen.add(key);
        next.push(anchor);
        out.push(anchor);
      }
    }
    frontier = next;
  }

  // Blink: a Climaxed Written Path steps to any empty tile it can see, stride or no
  // stride. The same sight the move itself uses — a clear line, no further than the
  // weather lets anything see.
  if (climaxTraitOf(unit) === 'blink') {
    const clamp = visionClamp(state);
    for (let y = 0; y < state.height; y++) {
      for (let x = 0; x < state.width; x++) {
        const to = { x, y };
        const key = coordKey(to);
        if (seen.has(key)) continue;
        if (!inBounds(state, to)) continue;
        if (
          clamp !== undefined &&
          Math.max(Math.abs(x - unit.anchor.x), Math.abs(y - unit.anchor.y)) > clamp
        ) {
          continue;
        }
        if (!canTraverse(state, to, unit, { throughUnits: false, throughObstacles: false })) continue;
        if (!hasLoS(state, unit.anchor, to, [unit.id], unit.side)) continue;
        seen.add(key);
        out.push(to);
      }
    }
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
      if (!canStrike(state, unit, from, [target])) continue;

      out.push(target);
    }
  }

  return out;
}

/** Whether `side`'s Bound Form stands on this tile. */
function boundFormOccupies(state: GameState, side: Side, at: Coord): boolean {
  const id = state.players[side].companionUnitId;
  if (!id) return false;
  const body = state.units[id];
  if (!body) return false;
  return cellsAt(body.anchor, body.footprint).some((c) => c.x === at.x && c.y === at.y);
}

/**
 * Builds the threat map faced by `side` — that is, what the opposing units can hit.
 */
export function threatMap(state: GameState, side: Side): ThreatMap {
  const damageByTile = new Map<string, number>();
  const commanderThreats: UnitId[] = [];

  // Everything hostile to this side, which for a Feral beast means both sides at once:
  // a wolf between two armies is a danger to whichever it can reach.
  const hostile = [
    ...unitsOf(state, opposite(side)),
    ...unitsOf(state, side).filter((u) => u.keywords.includes('Feral')),
  ];

  for (const foe of hostile) {
    // A body that will still be held once its turn begins threatens nothing at all — it
    // can neither move nor strike. One that will have shaken the hold off is a full threat,
    // whatever it looks like standing there frozen now.
    if (heldNextTurn(foe)) continue;

    const anchors = reachableAnchors(state, foe);
    const tiles = new Set<string>();

    for (const anchor of anchors) {
      for (const t of strikeableFrom(state, foe, anchor)) {
        tiles.add(coordKey(t));
        // The Bound Form is the *only* route to a Pact — the portrait itself cannot be
        // swung at — so a foe that can reach the body is exactly a foe that threatens the
        // Commander. The HUD would otherwise call that tile merely dangerous.
        if (!commanderThreats.includes(foe.id) && boundFormOccupies(state, side, t)) {
          commanderThreats.push(foe.id);
        }
      }
    }

    // Raw Attack, as the intent's own `damage` is: the two readouts agree with each other,
    // and neither prices Brittle, brands or weather into a number that is already an upper
    // bound on where, not a promise of how much.
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
