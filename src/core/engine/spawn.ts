/**
 * Unit and obstacle creation.
 */

import type { CardDefId, Coord, Side, UnitId } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Obstacle, Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import { growthCapFor } from './growth.js';
import { canPlace } from './board.js';
import type { GameState } from '../types/state.js';
import { startingZone } from '../types/state.js';
import { vanguardBonus } from '../data/roster.js';
import { toSnapshot } from './views.js';

export function nextId(ctx: Ctx, prefix: string): UnitId {
  ctx.state.nextId += 1;
  return `${prefix}${ctx.state.nextId}`;
}

export function summonUnit(
  ctx: Ctx,
  defId: CardDefId,
  side: Side,
  anchor: Coord,
  /**
   * The Vanguard level this body fights at. Absent is level 1 -- the printed card.
   *
   * Folded in **here**, before the unit is written and before `unitSummoned` goes out,
   * and that placement is the whole point. The event embeds a snapshot the renderer draws
   * from and never re-reads, so a body created at its base stats and raised a line later
   * would be permanently drawn at the wrong numbers -- the same trap `spawnObstacle`
   * documents about its health.
   */
  level?: number,
): UnitId | undefined {
  const def = CARDS[defId];
  if (!def?.unit) return undefined;
  const stats = def.unit;

  if (!canPlace(ctx.state, anchor, stats.footprint)) return undefined;

  const trained = vanguardBonus(level ?? 1);

  const unit: Unit = {
    id: nextId(ctx, 'u'),
    defId: def.id,
    name: def.name,
    side,
    anchor: { ...anchor },
    footprint: stats.footprint,
    hp: stats.hp + trained.maxHp,
    maxHp: stats.hp + trained.maxHp,
    armor: 0,
    atk: stats.atk + trained.atk,
    mov: stats.mov,
    rangeMin: stats.rangeMin,
    rangeMax: stats.rangeMax,
    ...(stats.attackProfile ? { attackProfile: stats.attackProfile } : {}),
    ...(stats.onHit ? { onHit: { ...stats.onHit } } : {}),
    ...(stats.trail ? { trail: stats.trail } : {}),
    ...(stats.hunts ? { hunts: stats.hunts } : {}),
    school: def.school,
    archetype: stats.archetype,
    keywords: [...def.keywords],
    statuses: {},
    titheBonus: stats.titheBonus ?? 0,
    escalation: 0,
    // 1x1 units cap at +3 growth; Behemoths run far longer but are no longer *endless*.
    // `Infinity` used to live here and it is not a serialisable number: it survives a
    // structured clone but `JSON.stringify` turns it into `null`, so a saved fight came
    // back with a Behemoth whose ceiling was gone. A large finite number says the same
    // thing about the design and can actually be written down.
    escalationCap: growthCapFor(stats.footprint),
    movedThisTurn: false,
    attackedThisTurn: false,
    summonedThisTurn: true,
    freshlySummoned: true,
  };

  ctx.state.units[unit.id] = unit;
  // Everything the player has *met*, recorded where every unit enters the board — the
  // opening placement and every summon come through here, so there is one place to be
  // wrong rather than three.
  if (unit.side === 'enemy') ctx.state.encountered.push(unit.defId);
  emit(ctx, { t: 'unitSummoned', unit: toSnapshot(unit) });
  return unit.id;
}

/**
 * Places a unit that was already on the field when combat began — so it is not treated
 * as freshly summoned and can act, and escalate, from turn one.
 *
 * Lives here rather than in setup so that sudden death, which wipes the board and must
 * restore the Bound Form afterwards, can reach it without importing combat setup.
 */
export function placeOpeningUnit(
  ctx: Ctx,
  defId: string,
  side: Side,
  at: Coord,
  /** The Vanguard level, for a deployed roster body. Absent everywhere else. */
  level?: number,
): UnitId | undefined {
  const spot = firstFreeNear(ctx.state, at, side);
  if (!spot) return undefined;
  const id = summonUnit(ctx, defId, side, spot, level);
  if (!id) return undefined;
  const unit = ctx.state.units[id];
  if (!unit) return undefined;
  unit.summonedThisTurn = false;
  unit.freshlySummoned = false;
  return id;
}

/** Falls back to a nearby tile in the same territory if the preferred one is taken. */
export function firstFreeNear(state: GameState, at: Coord, side: Side): Coord | undefined {
  if (canPlace(state, at, 1)) return at;
  const rows = startingZone(state, side);
  for (const y of rows) {
    for (let x = 0; x < state.width; x++) {
      const c = { x, y };
      if (canPlace(state, c, 1)) return c;
    }
  }
  return undefined;
}

/**
 * Moves a Commander's body into a bigger one.
 *
 * The whole sequence is one atomic step, because between removing the old body and
 * pointing at the new one the side would briefly have a `companionUnitDefId` naming a
 * unit that does not exist — and origin-cast targeting reads exactly that to decide a
 * spell has nowhere to be thrown from.
 *
 * Deliberately not routed through killEntity: that clears the companion reference and
 * then runs a lethal check, and a Commander mid-transformation is not a Commander who
 * has lost. The old body is removed directly, with the death event kept so the renderer
 * still animates the change.
 *
 * Returns false when there is no room, which is the caller's cue to try something else
 * rather than a failure — a boss with nowhere to grow simply has not grown yet.
 */
export function dockIntoForm(
  ctx: Ctx,
  side: Side,
  defId: CardDefId,
  evict?: (ctx: Ctx, anchor: Coord) => boolean,
): boolean {
  const cmd = ctx.state.players[side];
  const oldId = cmd.companionUnitId;
  const old = oldId ? ctx.state.units[oldId] : undefined;
  if (!old) return false;

  const def = CARDS[defId];
  const footprint = def?.unit?.footprint ?? 1;

  const site = findDockSite(ctx, old.anchor, footprint, old.id, evict);
  if (!site) return false;

  const at = { ...old.anchor };
  delete ctx.state.units[old.id];
  emit(ctx, {
    t: 'unitDied',
    unitId: old.id,
    at,
    footprint: old.footprint,
    cause: 'spell',
  });

  const grown = summonUnit(ctx, defId, side, site);
  if (!grown) {
    // Nothing legal to become. Put the old body back rather than leaving the side
    // bodiless, which would strand every spell it casts from one.
    ctx.state.units[old.id] = old;
    emit(ctx, { t: 'unitSummoned', unit: toSnapshot(old) });
    return false;
  }

  const unit = ctx.state.units[grown];
  if (unit) {
    unit.summonedThisTurn = false;
    unit.freshlySummoned = false;
  }

  cmd.companionUnitId = grown;
  cmd.companionUnitDefId = defId;
  return true;
}

/** The nearest place the larger form fits, trying the current spot first. */
function findDockSite(
  ctx: Ctx,
  from: Coord,
  footprint: 1 | 2,
  ignoreId: UnitId,
  evict?: (ctx: Ctx, anchor: Coord) => boolean,
): Coord | undefined {
  const candidates: Coord[] = [from];
  // A 2x2 anchored here may need to sit up and left of where the old body stood.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      candidates.push({ x: from.x + dx, y: from.y + dy });
    }
  }

  for (const at of candidates) {
    // The old body still occupies its tile at this point, so it is ignored when asking
    // whether the new one fits — it is about to leave.
    if (canPlace(ctx.state, at, footprint, ignoreId)) return at;
  }

  // Nothing free. Ask the caller whether it can make room.
  if (!evict) return undefined;
  for (const at of candidates) {
    if (evict(ctx, at) && canPlace(ctx.state, at, footprint)) return at;
  }
  return undefined;
}

export function spawnObstacle(
  ctx: Ctx,
  defId: CardDefId,
  side: Side,
  anchor: Coord,
  hp?: number,
): UnitId | undefined {
  const def = CARDS[defId];
  if (def?.obstacleHp === undefined) return undefined;
  if (!canPlace(ctx.state, anchor, 1)) return undefined;

  // Health is settled before the event goes out, never after. `obstacleSpawned` embeds a
  // snapshot the renderer draws from and never re-reads, so a wall raised at one number
  // and adjusted at another would be drawn permanently wrong — a 6 HP pillar on screen
  // that takes eight to break. Callers that change the number pass it in here.
  const health = Math.max(1, Math.round(hp ?? def.obstacleHp));

  const obstacle: Obstacle = {
    id: nextId(ctx, 'o'),
    defId: def.id,
    name: def.name,
    side,
    anchor: { ...anchor },
    footprint: 1,
    hp: health,
    maxHp: health,
    destructible: true,
    ...(def.obstacleCover ? { cover: true } : {}),
  };

  ctx.state.obstacles[obstacle.id] = obstacle;
  emit(ctx, {
    t: 'obstacleSpawned',
    obstacle: {
      id: obstacle.id,
      defId: obstacle.defId,
      name: obstacle.name,
      anchor: { ...obstacle.anchor },
      hp: obstacle.hp,
      maxHp: obstacle.maxHp,
      // Carried into the snapshot or the renderer draws a screen as a solid wall: the
      // event embeds what is drawn and is never re-read against live state.
      ...(obstacle.cover ? { cover: true } : {}),
    },
  });
  return obstacle.id;
}
