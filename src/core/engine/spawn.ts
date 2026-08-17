/**
 * Unit and obstacle creation.
 */

import type { CardDefId, Coord, Side, UnitId } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Obstacle, Unit } from '../types/units.js';
import { CARDS } from '../data/cards/index.js';
import { canPlace } from './board.js';
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
): UnitId | undefined {
  const def = CARDS[defId];
  if (!def?.unit) return undefined;
  const stats = def.unit;

  if (!canPlace(ctx.state, anchor, stats.footprint)) return undefined;

  const unit: Unit = {
    id: nextId(ctx, 'u'),
    defId: def.id,
    name: def.name,
    side,
    anchor: { ...anchor },
    footprint: stats.footprint,
    hp: stats.hp,
    maxHp: stats.hp,
    armor: 0,
    atk: stats.atk,
    mov: stats.mov,
    rangeMin: stats.rangeMin,
    rangeMax: stats.rangeMax,
    school: def.school,
    archetype: stats.archetype,
    keywords: [...def.keywords],
    statuses: {},
    sacrificeValue: stats.sacrificeValue,
    escalation: 0,
    // 1x1 units cap at +3 growth; Behemoths are uncapped (Module 2).
    escalationCap: stats.footprint === 2 ? Infinity : 3,
    movedThisTurn: false,
    attackedThisTurn: false,
    summonedThisTurn: true,
    freshlySummoned: true,
  };

  ctx.state.units[unit.id] = unit;
  emit(ctx, { t: 'unitSummoned', unit: toSnapshot(unit) });
  return unit.id;
}

export function spawnObstacle(
  ctx: Ctx,
  defId: CardDefId,
  side: Side,
  anchor: Coord,
): UnitId | undefined {
  const def = CARDS[defId];
  if (!def || def.obstacleHp === undefined) return undefined;
  if (!canPlace(ctx.state, anchor, 1)) return undefined;

  const obstacle: Obstacle = {
    id: nextId(ctx, 'o'),
    defId: def.id,
    name: def.name,
    side,
    anchor: { ...anchor },
    footprint: 1,
    hp: def.obstacleHp,
    maxHp: def.obstacleHp,
    destructible: true,
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
    },
  });
  return obstacle.id;
}
