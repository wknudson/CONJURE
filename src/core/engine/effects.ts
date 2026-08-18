/**
 * The effect interpreter: one recursive function that turns CardDef data into resolution.
 *
 * Every primitive delegates to an engine helper (dealDamage, pushUnit, killEntity, ...)
 * which owns the event emission and the rule checks. Adding a card means adding data;
 * it cannot bypass rune triggers, armor gating, or the lethal check.
 */

import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import { coordEq } from '../../contract/ids.js';
import type { AreaSpec, CardPlayContext, EffectNode } from '../types/cards.js';
import type { Ctx } from './context.js';
import { applyStatusTo } from './status.js';
import { emit } from './context.js';
import { allEntities, entityAt, getEntity, lowestHpEnemy, refOf } from './board.js';
import { dealDamage, grantArmor } from './damage.js';
import { killEntity, finish } from './death.js';
import { attachRune, detonateAllRunes } from './runes.js';
import { pushUnit } from './displacement.js';
import { spawnObstacle, summonUnit } from './spawn.js';
import { cellsOf, chebyshev, manhattan, toDirection } from '../util/grid.js';
import { inBounds } from '../types/state.js';

export function executeEffect(ctx: Ctx, node: EffectNode, play: CardPlayContext): void {
  // A boss Damage Gate can cancel the remainder of a chain mid-resolution.
  if (ctx.state.encounter.chainCancelled || ctx.state.result) return;

  switch (node.op) {
    case 'seq': {
      for (const child of node.effects) {
        executeEffect(ctx, child, play);
        if (ctx.state.encounter.chainCancelled || ctx.state.result) return;
      }
      return;
    }

    case 'damage': {
      for (const ref of resolveArea(ctx, node.area, play)) {
        dealDamage(ctx, { target: ref, amount: node.amount, dtype: node.dtype, cause: 'spell' });
        if (ctx.state.result) return;
      }
      return;
    }

    case 'summon': {
      const at = play.chosen.kind === 'tile' ? play.chosen.at : undefined;
      if (!at) return;
      const id = summonUnit(ctx, node.unitDef, play.side, at);
      if (id) play.summonedUnitId = id;
      return;
    }

    case 'spawnObstacle': {
      const at = play.chosen.kind === 'tile' ? play.chosen.at : undefined;
      if (!at) return;
      spawnObstacle(ctx, node.obstacleDef, play.side, at);
      return;
    }

    case 'attachRune': {
      const ref = chosenRef(play);
      if (!ref || ref.kind === 'portrait') return;
      const host = getEntity(ctx.state, ref.id);
      if (!host) return;
      attachRune(ctx, host, node.rune);
      return;
    }

    case 'push': {
      const ref = chosenRef(play);
      if (!ref || ref.kind !== 'unit') return;
      const victim = ctx.state.units[ref.id];
      if (!victim) return;
      const dir = pushDirection(ctx, play, victim.anchor);
      pushUnit(ctx, victim, dir, node.distance);
      return;
    }

    case 'grantArmor': {
      if (typeof node.amount === 'number') {
        // Aegis Ward: armor goes to the chosen unit or the Hero portrait.
        const dest = chosenRef(play) ?? { kind: 'portrait' as const, side: play.side };
        if (node.amount > 0) grantArmor(ctx, dest, node.amount);
        return;
      }
      // Dark Tithe: the sacrificed minion's HP becomes Hero armor, not the corpse's.
      const amount = play.sacrificedHp ?? 0;
      if (amount > 0) grantArmor(ctx, { kind: 'portrait', side: play.side }, amount);
      return;
    }

    case 'applyStatus': {
      for (const ref of resolveArea(ctx, node.area, play)) {
        if (ref.kind !== 'unit') continue;
        const unit = ctx.state.units[ref.id];
        if (!unit) continue;

        applyStatusTo(ctx, unit, node.status, node.stacks);
      }
      return;
    }

    case 'sacrificeTarget': {
      const ref = chosenRef(play);
      if (!ref || ref.kind !== 'unit') return;
      const unit = ctx.state.units[ref.id];
      if (!unit) return;
      play.sacrificedHp = unit.hp;
      emit(ctx, { t: 'unitSacrificed', unitId: unit.id, marrowExtracted: 0 });
      killEntity(ctx, unit, 'spell');
      return;
    }

    case 'extractMarrow': {
      const cmd = ctx.state.players[play.side];
      cmd.marrow += node.amount;
      emit(ctx, {
        t: 'resourcesChanged',
        side: play.side,
        pips: cmd.pips,
        marrow: cmd.marrow,
      });
      return;
    }

    case 'detonateAllRunes': {
      detonateAllRunes(ctx, node.bonusDamage);
      return;
    }

    case 'bindCompanion': {
      finish(ctx, 'bound');
      return;
    }

    case 'cleaveFront': {
      const summoned = play.summonedUnitId ? ctx.state.units[play.summonedUnitId] : undefined;
      if (!summoned) return;
      for (const ref of frontCleaveTargets(ctx, summoned.id, play.side, node.width)) {
        dealDamage(ctx, { target: ref, amount: node.amount, dtype: node.dtype, cause: 'spell' });
        if (ctx.state.result) return;
      }
      return;
    }
  }
}

// ------------------------------------------------------------------ targeting helpers

function chosenRef(play: CardPlayContext): TargetRef | undefined {
  return play.chosen.kind === 'entity' ? play.chosen.ref : undefined;
}

/** Push direction is away from the caster's side: toward the enemy backline. */
function pushDirection(ctx: Ctx, play: CardPlayContext, victimAnchor: Coord): Coord {
  if (play.casterAnchor) {
    const d = toDirection({
      x: victimAnchor.x - play.casterAnchor.x,
      y: victimAnchor.y - play.casterAnchor.y,
    });
    if (d.x !== 0 || d.y !== 0) return d;
  }
  // Cast from the off-grid portrait: shove straight away from our own side.
  void ctx;
  return play.side === 'player' ? { x: 0, y: -1 } : { x: 0, y: 1 };
}

function resolveArea(ctx: Ctx, area: AreaSpec, play: CardPlayContext): TargetRef[] {
  switch (area.shape) {
    case 'target': {
      const ref = chosenRef(play);
      return ref ? [ref] : [];
    }

    case 'line': {
      if (play.chosen.kind !== 'line') return [];
      const refs: TargetRef[] = [];
      const seen = new Set<UnitId>();
      let cur = { ...play.chosen.from };
      for (let i = 0; i < area.length; i++) {
        if (!inBounds(ctx.state, cur)) break;
        const e = entityAt(ctx.state, cur);
        if (e && !seen.has(e.id)) {
          seen.add(e.id);
          refs.push(refOf(e));
        }
        cur = { x: cur.x + play.chosen.dir.x, y: cur.y + play.chosen.dir.y };
      }
      return refs;
    }

    case 'adjacent8': {
      const origin = originOf(ctx, play);
      if (!origin) return [];
      return allEntities(ctx.state)
        .filter((e) => cellsOf(e).some((c) => chebyshev(c, origin) <= 1 && !coordEq(c, origin)))
        .map(refOf);
    }

    case 'plus': {
      const origin = originOf(ctx, play);
      if (!origin) return [];
      return allEntities(ctx.state)
        .filter((e) => cellsOf(e).some((c) => manhattan(c, origin) <= area.radius))
        .map(refOf);
    }

    case 'all':
      return allEntities(ctx.state).map(refOf);

    case 'lowestHpEnemy': {
      const victim = lowestHpEnemy(ctx.state, play.side);
      return victim ? [{ kind: 'unit', id: victim.id }] : [];
    }
  }
}

function originOf(ctx: Ctx, play: CardPlayContext): Coord | undefined {
  if (play.chosen.kind === 'tile') return play.chosen.at;
  if (play.chosen.kind === 'line') return play.chosen.from;
  if (play.chosen.kind === 'entity' && play.chosen.ref.kind !== 'portrait') {
    return getEntity(ctx.state, play.chosen.ref.id)?.anchor;
  }
  return undefined;
}

/** The tiles directly in front of a freshly deployed unit, toward the enemy. */
function frontCleaveTargets(
  ctx: Ctx,
  unitId: UnitId,
  side: Side,
  width: number,
): TargetRef[] {
  const unit = ctx.state.units[unitId];
  if (!unit) return [];
  const forward = side === 'player' ? -1 : 1;
  const cells = cellsOf(unit);
  const frontRow = side === 'player'
    ? Math.min(...cells.map((c) => c.y))
    : Math.max(...cells.map((c) => c.y));

  const refs: TargetRef[] = [];
  const seen = new Set<UnitId>();
  const columns = [...new Set(cells.map((c) => c.x))].slice(0, width);

  for (const x of columns) {
    const tile = { x, y: frontRow + forward };
    if (!inBounds(ctx.state, tile)) continue;
    const e = entityAt(ctx.state, tile);
    if (e && e.id !== unitId && !seen.has(e.id)) {
      seen.add(e.id);
      refs.push(refOf(e));
    }
  }
  return refs;
}

