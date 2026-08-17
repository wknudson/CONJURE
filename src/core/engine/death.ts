/**
 * Entity removal and the lethal / Last Stand check.
 */

import type { DamageCause } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit } from './context.js';
import type { Entity } from '../types/units.js';
import { isUnit } from '../types/units.js';
import { getEntity } from './board.js';
import { evaluateRuneOnDeath } from './runes.js';

/**
 * Removes an entity from the board. `devoured` routes to the fizzle path: a devoured
 * host's rune is discarded without detonating, per Draft 7 §4.2.
 */
export function killEntity(ctx: Ctx, entity: Entity, cause: DamageCause, devoured = false): void {
  const live: Entity | undefined = getEntity(ctx.state, entity.id);
  if (!live) return;

  const at = { ...live.anchor };

  if (isUnit(live)) {
    delete ctx.state.units[live.id];
    emit(ctx, {
      t: 'unitDied',
      unitId: live.id,
      at,
      footprint: live.footprint,
      cause,
    });
  } else {
    delete ctx.state.obstacles[live.id];
    emit(ctx, { t: 'obstacleDestroyed', obstacleId: live.id, at });
  }

  // Rune resolution happens after removal so a death-triggered blast cannot hit its
  // own dead host, and so the board state the blast sees is already correct.
  if (live.rune) {
    evaluateRuneOnDeath(ctx, live, devoured);
  }

  checkLethal(ctx);
}

/**
 * Win/loss evaluation, including Draft 7 §9's mutual-KO rule: if both commanders hit 0
 * in the same step, both revive at 1 HP, the board is wiped of non-obstacle units and
 * runes, all armor is purged (Module 5), and combat continues in sudden death.
 */
export function checkLethal(ctx: Ctx): void {
  if (ctx.state.result) return;

  const player = ctx.state.players.player;
  const enemy = ctx.state.players.enemy;
  const playerDead = player.hp <= 0;
  const enemyDead = enemy.hp <= 0;

  if (!playerDead && !enemyDead) return;

  if (playerDead && enemyDead) {
    if (ctx.state.suddenDeath) {
      // A second mutual KO during sudden death resolves to the instigator (Module 8).
      player.hp = 1;
      enemy.hp = 0;
      finish(ctx, 'victory');
      return;
    }
    enterSuddenDeath(ctx);
    return;
  }

  finish(ctx, playerDead ? 'defeat' : 'victory');
}

function enterSuddenDeath(ctx: Ctx): void {
  ctx.state.suddenDeath = true;

  for (const side of ['player', 'enemy'] as const) {
    const cmd = ctx.state.players[side];
    cmd.hp = 1;
    cmd.armor = 0;
  }

  // Wipe every non-obstacle unit and every rune.
  for (const unit of Object.values(ctx.state.units)) {
    delete ctx.state.units[unit.id];
    emit(ctx, {
      t: 'unitDied',
      unitId: unit.id,
      at: { ...unit.anchor },
      footprint: unit.footprint,
      cause: 'spell',
    });
  }
  for (const obs of Object.values(ctx.state.obstacles)) {
    obs.rune = undefined;
  }

  emit(ctx, { t: 'suddenDeath' });
}

export function finish(ctx: Ctx, result: 'victory' | 'defeat' | 'bound'): void {
  if (ctx.state.result) return;
  ctx.state.result = result;
  ctx.state.phase = 'over';
  emit(ctx, { t: 'combatEnded', result });
}
