/**
 * Reaction resolution: the engine half of `data/reactions.ts`.
 *
 * Split in two because reactions straddle the damage write. The bonus damage and the
 * status consumption have to happen *before* armor is applied, while the outcome — fog,
 * shrapnel, a toxin bloom — can only resolve once we know the hit actually drew blood.
 */

import type { Coord, DamageType, Side } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit, newCause } from './context.js';
import type { Entity, Unit } from '../types/units.js';
import { isUnit } from '../types/units.js';
import type { ReactionDef } from '../data/reactions.js';
import { findReaction } from '../data/reactions.js';
import { coordKey } from '../../contract/ids.js';
import { DIRS_8 } from '../util/grid.js';
import { inBounds } from '../types/state.js';
import type { HazardKind } from '../types/state.js';
import { entityAt } from './board.js';
import { pushUnit } from './displacement.js';
import { applyStatusTo } from './status.js';

export interface PendingReaction {
  def: ReactionDef;
  /** Stacks of the required status that were consumed, for scaling outcomes. */
  consumed: number;
  at: Coord;
}

/**
 * Called before damage lands. Applies the bonus, consumes the status, and hands back
 * what still needs resolving once the hit has actually connected.
 */
export function prepareReaction(
  ctx: Ctx,
  entity: Entity,
  dtype: DamageType,
): { bonus: number; pending: PendingReaction | undefined } {
  if (!isUnit(entity)) return { bonus: 0, pending: undefined };
  if (ctx.state.encounter.chainCancelled) return { bonus: 0, pending: undefined };

  const def = findReaction(dtype, entity.statuses);
  if (!def) return { bonus: 0, pending: undefined };

  const consumed = entity.statuses[def.requires] ?? 0;
  if (def.consumes) delete entity.statuses[def.requires];

  return {
    bonus: def.bonusDamage ?? 0,
    pending: { def, consumed, at: { ...entity.anchor } },
  };
}

/**
 * Called after the damage is written. Most reactions need the hit to have drawn blood,
 * so armor that soaks a blow entirely stops them just as it stops a rune. Shatter opts
 * out: see `requiresHpLoss`.
 */
export function resolveReaction(
  ctx: Ctx,
  pending: PendingReaction,
  hpLoss: number,
  dealDamage: DealDamageFn,
): void {
  if (hpLoss <= 0 && pending.def.requiresHpLoss) return;
  if (ctx.state.encounter.chainCancelled) return;

  const { def, consumed, at } = pending;
  newCause(ctx);
  emit(ctx, { t: 'reactionTriggered', reaction: def.id, name: def.name, at: { ...at } });

  refundReactionPip(ctx, def, at);

  // Armor-piercing damage lands before the outcome, and separately from the triggering
  // blow, so plate cannot absorb it. Guarded on the chain flag like everything else: a
  // boss Damage Gate that cancelled mid-chain must stop this too.
  if (def.trueDamage && !ctx.state.encounter.chainCancelled) {
    const victim = entityAt(ctx.state, at);
    if (victim) {
      dealDamage(ctx, {
        target: isUnit(victim) ? { kind: 'unit', id: victim.id } : { kind: 'obstacle', id: victim.id },
        amount: def.trueDamage,
        dtype: 'true',
        cause: 'reaction',
      });
    }
  }

  switch (def.outcome.op) {
    case 'spawnHazard':
      spawnHazard(ctx, at, def.outcome.kind, def.outcome.turns);
      break;

    case 'shatter': {
      // Strip armor from whatever is still standing on the tile, then splash outward.
      const host = entityAt(ctx.state, at);
      if (host && isUnit(host) && host.armor > 0) {
        emit(ctx, { t: 'armorStripped', unitId: host.id, amount: host.armor });
        host.armor = 0;
      }
      for (const c of adjacentTiles(ctx, at)) {
        const victim = entityAt(ctx.state, c);
        if (!victim || (host && victim.id === host.id)) continue;
        dealDamage(ctx, {
          target: isUnit(victim)
            ? { kind: 'unit', id: victim.id }
            : { kind: 'obstacle', id: victim.id },
          amount: def.outcome.splash,
          dtype: 'impact',
          cause: 'reaction',
        });
        if (ctx.state.result) return;
      }
      break;
    }

    case 'overload': {
      // Everything around the target is thrown directly away from it. Collected before
      // any of them move: pushing one unit can vacate a tile another would then be read
      // from, and the blast should be judged on the board as it was when it went off.
      const host = entityAt(ctx.state, at);
      const caught: Unit[] = [];
      for (const c of adjacentTiles(ctx, at)) {
        const victim = entityAt(ctx.state, c);
        if (!victim || !isUnit(victim)) continue;
        if (host && victim.id === host.id) continue;
        if (!caught.some((u) => u.id === victim.id)) caught.push(victim);
      }

      for (const unit of caught) {
        if (ctx.state.encounter.chainCancelled || ctx.state.result) return;
        if (!ctx.state.units[unit.id]) continue;
        // Away from the blast, by the sign of the offset — a diagonal neighbour is thrown
        // diagonally, so nothing is dragged sideways past the tile it was standing on.
        const dir = {
          x: Math.sign(unit.anchor.x - at.x),
          y: Math.sign(unit.anchor.y - at.y),
        };
        if (dir.x === 0 && dir.y === 0) continue;
        pushUnit(ctx, unit, dir, def.outcome.shove);
      }
      break;
    }

    case 'superconduct': {
      const host = entityAt(ctx.state, at);
      if (!host || !isUnit(host)) break;
      if (host.armor > 0) {
        emit(ctx, { t: 'armorStripped', unitId: host.id, amount: host.armor });
        host.armor = 0;
      }
      // Brittle rather than a second status meaning the same thing: "takes extra damage"
      // already exists, is already drawn and explained, and a near-duplicate at a
      // different number would be indistinguishable on the board.
      applyStatusTo(ctx, host, 'brittle', def.outcome.brittle);
      break;
    }

    case 'consumeForAoe': {
      const amount = consumed * def.outcome.perStack;
      if (amount <= 0) break;
      for (const c of adjacentTiles(ctx, at)) {
        const victim = entityAt(ctx.state, c);
        if (!victim) continue;
        dealDamage(ctx, {
          target: isUnit(victim)
            ? { kind: 'unit', id: victim.id }
            : { kind: 'obstacle', id: victim.id },
          amount,
          dtype: def.outcome.dtype,
          cause: 'reaction',
        });
        if (ctx.state.result) return;
      }
      break;
    }

    case 'none':
      break;
  }
}

/** Signature of the engine's dealDamage, injected to avoid a circular import. */
type DealDamageFn = (
  ctx: Ctx,
  req: {
    target: { kind: 'unit' | 'obstacle'; id: string };
    amount: number;
    dtype: DamageType;
    cause: string;
  },
) => unknown;

/** Reactions are hard to set up, so landing one pays part of its cost back. */
export const REACTION_PIP_REFUND = 1;
/** Two a turn. Beyond that a cascade would fund itself, which is a loop, not a reward. */
export const REACTION_PIP_CAP = 2;

/**
 * Pays a Pip back to whoever caused the reaction.
 *
 * Credited to the active side rather than to the victim's opponent: a reaction fires
 * inside the acting side's resolution chain, and self-inflicted ones (shoving your own
 * burning unit into a chilled ally) are still your doing. This mirrors how `spawnHazard`
 * already decides ownership.
 */
function refundReactionPip(ctx: Ctx, def: ReactionDef, at: Coord): void {
  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  if (cmd.reactionPipsThisTurn >= REACTION_PIP_CAP) return;

  cmd.reactionPipsThisTurn += 1;
  creditRefund(ctx, side, { id: def.id, name: def.name }, at);
}

/**
 * Pays one Pip and announces it as a reward rather than as income.
 *
 * Split out of `refundReactionPip` so a passive can pay the same way a reaction does —
 * Voltara's Storm Tithe is the first — without either re-deriving the amount or
 * re-inventing what the payment looks like on screen.
 *
 * Note what is deliberately **not** in here: `reactionPipsThisTurn`. That counter exists
 * so a cascade cannot fund itself, and it is checked by the one caller that can fire more
 * than once in a turn. A passive limited to once per turn by its own rule does not need
 * the budget and must not spend it — a Resonance that ate one of the two reaction slots
 * would leave the Surge school paying for its own passive out of the reactions it exists
 * to set up.
 */
export function creditRefund(
  ctx: Ctx,
  side: Side,
  source: { id: string; name: string },
  at: Coord,
): void {
  const cmd = ctx.state.players[side];
  // Deliberately unclamped, like every other Pip gain: the cap of 8 is applied once, at
  // end-of-turn cleanup, so a refund near the ceiling still banks for this turn's use.
  cmd.pips += REACTION_PIP_REFUND;

  // `pipRefunded` rather than `gainPips`, which would emit the generic `pipGained`: the
  // presentation layer has to be able to tell a reward from ordinary turn income, and it
  // cannot do that from an event that describes both. It carries `total` for the same
  // reason `pipGained` does, so the dial updates from one event either way.
  emit(ctx, {
    t: 'pipRefunded',
    side,
    amount: REACTION_PIP_REFUND,
    total: cmd.pips,
    reaction: source.id,
    name: source.name,
    at: { ...at },
  });
}

export function spawnHazard(
  ctx: Ctx,
  at: Coord,
  kind: HazardKind,
  turns: number,
  permanent = false,
): void {
  const key = coordKey(at);
  const existing = ctx.state.hazards[key];
  // One hazard to a tile. Re-fogging refreshes rather than stacking a second cloud, and
  // rubble simply replaces whatever was drifting over the ground it buried.
  ctx.state.hazards[key] = {
    kind,
    at: { ...at },
    turns: permanent ? turns : Math.max(turns, existing?.turns ?? 0),
    owner: ctx.state.activeSide,
    ...(permanent ? { permanent: true as const } : {}),
  };
  emit(ctx, { t: 'hazardSpawned', kind, at: { ...at }, turns });
}

function adjacentTiles(ctx: Ctx, at: Coord): Coord[] {
  const out: Coord[] = [];
  const seen = new Set<string>();
  for (const dir of DIRS_8) {
    const c = { x: at.x + dir.x, y: at.y + dir.y };
    if (!inBounds(ctx.state, c)) continue;
    const key = coordKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/** Ticks hazards down at the hazard slot of the status order, clearing expired ones. */
export function tickHazards(ctx: Ctx): void {
  for (const [key, hazard] of Object.entries(ctx.state.hazards)) {
    // Rubble is the ground now. It does not drift away.
    if (hazard.permanent) continue;
    // Only the owner's turn ages a hazard, so both sides get the full stated duration.
    if (hazard.owner !== ctx.state.activeSide) continue;
    hazard.turns -= 1;
    if (hazard.turns > 0) continue;
    delete ctx.state.hazards[key];
    emit(ctx, { t: 'hazardExpired', at: { ...hazard.at } });
  }
}

