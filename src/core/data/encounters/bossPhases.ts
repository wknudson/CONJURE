/**
 * The grow-at-half boss script, in one place.
 *
 * Ignis's trial and the campaign finale ran the same machinery as two hand-written
 * copies: a 50% damage gate that clamps the crossing hit and cancels the rest of its
 * chain, a status purge, a dock into a larger form with a retry when the board leaves
 * no room, and the 25% seal underneath it all. They differed in exactly four knobs —
 * the phase's name, the form grown into, whether making room evicts the player's own
 * bodies, and where the fallback add appears — so the knobs are the config and the
 * machinery is written once. A rule written twice is a rule that will eventually be
 * two different rules, and a boss's phase change is the last place to find that out.
 *
 * `seal.ts` deliberately stays what it is: the 25% rule alone. Growth is a different
 * rule that some bosses layer on top, which is why this is a sibling file rather than
 * a widening of that one.
 */

import type { EncounterScript } from './registry.js';
import type { Ctx } from '../../engine/context.js';
import { emit, newCause } from '../../engine/context.js';
import { dockIntoForm, summonUnit } from '../../engine/spawn.js';
import { sealAt25 } from './seal.js';
import { clearIntents } from '../../engine/intents.js';
import { canPlace, entityAt, unitsOf } from '../../engine/board.js';
import { toCardSnapshot } from '../../engine/views.js';
import { cellsAt } from '../../util/grid.js';

export interface GrowAtHalfConfig {
  /** What the `bossPhaseShift` banner announces. */
  phaseName: string;
  /** The form docked into at the gate. */
  grownDefId: string;
  /** The add summoned when the growth is boxed in. */
  addDefId: string;
  /** Where that add tries to appear, in order. */
  addSpawns: readonly (readonly [number, number])[];
  /**
   * Whether making room throws the player's own bodies out of the way.
   *
   * Ignis's trial evicts — player units in the footprint return to hand with a flat
   * 1 Marrow — because a wild thing growing does not ask. The finale does not: the
   * Colossus rises where the floor opens or waits for the throne guard to clear it.
   */
  forcedEviction?: boolean;
  /** The gate's threshold as a fraction of max HP. The halfway mark unless stated. */
  clampFraction?: number;
}

/**
 * Builds the whole script: clamp-and-grow at the fraction, seal at 25%.
 *
 * The clamp cancels the remainder of the triggering chain so cascade damage cannot
 * undo it; the growth is tracked apart from the phase so being boxed in retries at
 * the start of each of the boss's turns without re-announcing a phase that has, in
 * every other respect, genuinely happened.
 */
export function growAtHalfScript(cfg: GrowAtHalfConfig): EncounterScript {
  const PHASE_GATE = 'phase2';
  const GROWN_GATE = 'grown';
  const fraction = cfg.clampFraction ?? 0.5;

  function gateHp(ctx: Ctx): number {
    return Math.floor(ctx.state.players.enemy.maxHp * fraction);
  }

  function grow(ctx: Ctx): boolean {
    const state = ctx.state;
    if (state.encounter.firedGates.includes(GROWN_GATE)) return false;

    const grew = cfg.forcedEviction
      ? dockIntoForm(ctx, 'enemy', cfg.grownDefId, (c, at) => evictAndSpawn(c, at, false))
      : dockIntoForm(ctx, 'enemy', cfg.grownDefId);
    if (!grew) return false;

    state.encounter.firedGates.push(GROWN_GATE);
    // Every declared blow was aimed from a body that no longer stands there, and half
    // the sightlines it was aimed along have just been rewritten.
    clearIntents(ctx);
    return true;
  }

  function enterPhaseTwo(ctx: Ctx): void {
    const state = ctx.state;
    state.encounter.bossPhase = 2;

    newCause(ctx);
    emit(ctx, { t: 'bossPhaseShift', side: 'enemy', phase: 2, name: cfg.phaseName });

    // Purge debuffs from the boss's own units, its own body included. A phase change
    // shrugging off crowd control is standard for a boss, and it is the reason spending
    // a Flash Freeze just before the threshold is a mistake rather than a plan.
    for (const unit of unitsOf(state, 'enemy')) unit.statuses = {};

    if (grow(ctx)) return;

    // Boxed in, or fighting from off the board entirely. It calls for help instead;
    // the growth is retried at the start of each of its turns until there is room.
    for (const [x, y] of cfg.addSpawns) {
      if (cfg.forcedEviction) {
        if (evictAndSpawn(ctx, { x, y }, cfg.addDefId)) return;
      } else if (canPlace(ctx.state, { x, y }, 1)) {
        summonUnit(ctx, cfg.addDefId, 'enemy', { x, y });
        return;
      }
    }
  }

  return {
    onDamageToCommander(ctx, side, amount) {
      if (side !== 'enemy') return amount;
      if (ctx.state.encounter.firedGates.includes(PHASE_GATE)) return amount;

      const cmd = ctx.state.players.enemy;
      const gate = gateHp(ctx);
      // Only clamp if this hit would actually cross the threshold.
      if (cmd.hp - amount > gate) return amount;

      const clamped = Math.max(0, cmd.hp - gate);
      ctx.state.encounter.firedGates.push(PHASE_GATE);
      // Cancel the rest of this chain so further cascade damage cannot undo the clamp,
      // then transform. The engine is synchronous, so this runs before the damage write
      // completes — the phase change only touches units and the board, never boss HP.
      ctx.state.encounter.chainCancelled = true;
      enterPhaseTwo(ctx);
      return clamped;
    },

    onCommanderHpChanged(ctx, side) {
      if (side !== 'enemy') return;
      sealAt25(ctx);
    },

    onTurnStart(ctx, side) {
      // A damage-over-time tick can cross the gate outside a damage chain.
      if (side !== 'enemy') return;
      const cmd = ctx.state.players.enemy;
      if (cmd.hp <= gateHp(ctx) && !ctx.state.encounter.firedGates.includes(PHASE_GATE)) {
        ctx.state.encounter.firedGates.push(PHASE_GATE);
        enterPhaseTwo(ctx);
      } else if (ctx.state.encounter.bossPhase === 2) {
        // It was boxed in when it tried to grow. Try again now that the board has moved.
        grow(ctx);
      }
      sealAt25(ctx);
    },
  };
}

/**
 * Clears one anchor cell of player bodies — returned to hand with a flat 1 Marrow —
 * and optionally summons into the gap.
 *
 * `summonDefId` is the add called into the cleared ground; `false` clears without
 * summoning, which is the shape `dockIntoForm` wants for making room under a growing
 * boss. An enemy occupant refuses the whole site: the boss does not throw its own.
 */
export function evictAndSpawn(
  ctx: Ctx,
  anchor: { x: number; y: number },
  summonDefId: string | false = false,
): boolean {
  const state = ctx.state;

  for (const cell of cellsAt(anchor, 1)) {
    const occupant = entityAt(state, cell);
    if (!occupant) continue;
    if (occupant.side !== 'player') return false; // enemy unit already there; try next site

    // Return the player's unit to hand with a marrow refund.
    const cmd = state.players.player;
    delete state.units[occupant.id];
    emit(ctx, {
      t: 'unitDied',
      unitId: occupant.id,
      at: { ...occupant.anchor },
      footprint: occupant.footprint,
      cause: 'spell',
    });

    const instanceId = `evict${state.nextId++}`;
    cmd.cards[instanceId] = { instanceId, defId: occupant.defId };
    cmd.hand.push(instanceId);
    cmd.marrow += 1;
    emit(ctx, {
      t: 'cardReturnedToHand',
      side: 'player',
      card: toCardSnapshot(state, 'player', instanceId),
      refundedMarrow: 1,
    });
  }

  // Used both to make room for a larger form and to call an add into the gap.
  if (summonDefId === false) return true;
  if (!canPlace(state, anchor, 1)) return false;
  summonUnit(ctx, summonDefId, 'enemy', anchor);
  return true;
}
