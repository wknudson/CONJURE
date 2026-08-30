/**
 * Reaction resolution: the engine half of `data/reactions.ts`.
 *
 * Split in two because reactions straddle the damage write. The bonus damage and the
 * status consumption have to happen *before* armor is applied, while the outcome — fog,
 * shrapnel, a toxin bloom — can only resolve once we know the hit actually drew blood.
 */

import type { Coord, DamageType, Side, StatusKind, UnitId } from '../../contract/ids.js';
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

  // Conductive Ice: rime carries a charge, so Chill answers a reaction that asked for
  // Charged. A substitute rather than a second status — the table is matched against a
  // *view* of the body and the body itself is never written, so nothing downstream can
  // find a `charged` stack that was never really there.
  const substituted =
    ctx.state.players[ctx.state.activeSide].chillConducts &&
    !entity.statuses.charged &&
    (entity.statuses.chill ?? 0) > 0;
  const reads = substituted
    ? { ...entity.statuses, charged: entity.statuses.chill }
    : entity.statuses;

  const def = findReaction(dtype, reads, ctx.state.encounter.weather?.kind);
  if (!def) return { bonus: 0, pending: undefined };

  // A weather-gated reaction has no status to read or spend: `consumed` is what Wildfire
  // scales its blast by, and for Arc there is nothing on the body to have consumed.
  // What a substituted reaction spends is the cold it actually ran through, not the
  // charge it borrowed the name of.
  const spends: StatusKind | undefined =
    substituted && def.requires === 'charged' ? 'chill' : def.requires;
  const consumed = spends ? entity.statuses[spends] ?? 0 : 0;
  if (def.consumes && spends) delete entity.statuses[spends];

  return {
    bonus: def.bonusDamage ?? 0,
    pending: { def, consumed, at: { ...entity.anchor } },
  };
}

/**
 * Called after the damage is written. Most reactions need the hit to have drawn blood,
 * so armor that soaks a blow entirely stops them just as it stops a mark. Shatter opts
 * out: see `requiresHpLoss`.
 */
export function resolveReaction(
  ctx: Ctx,
  pending: PendingReaction,
  hpLoss: number,
  dealDamage: DealDamageFn,
  chainDepth: number,
): void {
  if (hpLoss <= 0 && pending.def.requiresHpLoss) return;
  if (ctx.state.encounter.chainCancelled) return;

  const { def, consumed, at } = pending;
  newCause(ctx);
  emit(ctx, { t: 'reactionTriggered', reaction: def.id, name: def.name, at: { ...at } });

  refundReactionBone(ctx, def, at);

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
        chainDepth,
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
        // Shrapnel Guard. Scoped to the splash and not to the strip: this is plate against
        // flying ice, and it has nothing to say about the armor Shatter takes off its host.
        if (isUnit(victim) && ctx.state.players[victim.side].immuneToShatterSplash) continue;
        dealDamage(ctx, {
          target: isUnit(victim)
            ? { kind: 'unit', id: victim.id }
            : { kind: 'obstacle', id: victim.id },
          amount: def.outcome.splash,
          dtype: 'impact',
          cause: 'reaction',
          chainDepth,
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
        // A shove is a cascade link too: what it slams the body into takes real damage.
        pushUnit(ctx, unit, dir, def.outcome.shove, chainDepth);
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
          chainDepth,
        });
        if (ctx.state.result) return;

        // Toxic Smoke: the blast burns the spores off and blows them onto whatever is
        // still standing. Re-read, because the blast may have just killed it.
        const seeds = ctx.state.players[ctx.state.activeSide].wildfireSeedsToxin;
        if (seeds > 0 && isUnit(victim) && ctx.state.units[victim.id]) {
          applyStatusTo(ctx, ctx.state.units[victim.id]!, 'toxin', seeds, ctx.state.activeSide);
        }
      }
      break;
    }

    case 'conduct': {
      // Every body touching the target, whoever it belongs to. A charge that checked
      // allegiance before jumping would be a spell effect wearing weather's clothes, and
      // it is what makes casting into a melee in the rain a decision rather than a bonus.
      const host = entityAt(ctx.state, at);
      const struck: UnitId[] = [];
      for (const c of adjacentTiles(ctx, at)) {
        const victim = entityAt(ctx.state, c);
        // Units only: arcing through scenery would make every wall a lightning rod.
        if (!victim || !isUnit(victim)) continue;
        // A Behemoth occupies cells adjacent to its own anchor, so identity is by id and
        // never by position — otherwise it would arc into itself.
        if (host && victim.id === host.id) continue;
        if (struck.includes(victim.id)) continue;
        struck.push(victim.id);
      }

      // Arc-Welder: the jump is dealt through plate. Read off the side that let the
      // charge go, not off whoever it earths into — this is a property of the storm the
      // caster is standing in, and it applies to their own line the same way the arc does.
      const pierces = ctx.state.players[ctx.state.activeSide].arcPierces;

      for (const id of struck) {
        if (ctx.state.encounter.chainCancelled || ctx.state.result) return;
        // Re-read: an earlier arc in this same loop may already have killed it.
        if (!ctx.state.units[id]) continue;
        dealDamage(ctx, {
          target: { kind: 'unit', id },
          amount: def.outcome.damage,
          dtype: pierces ? 'true' : def.outcome.dtype,
          cause: 'reaction',
          chainDepth,
        });

        // Shock Absorber: the collateral charges the plate instead of cracking it. Read
        // off the *struck* side, which is what makes it a defence rather than a rider on
        // the caster's arc, and applied only to a body that survived to wear it.
        const survivor = ctx.state.units[id];
        if (!survivor) continue;
        const plate = ctx.state.players[survivor.side].armorOnArcCollateral;
        if (plate <= 0) continue;
        survivor.armor += plate;
        emit(ctx, {
          t: 'armorGained',
          target: { kind: 'unit', id },
          amount: plate,
          total: survivor.armor,
        });
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
    chainDepth?: number;
  },
) => unknown;

/** Reactions are hard to set up, so landing one pays part of its cost back. */
export const REACTION_BONE_REFUND = 1;
/** Two a turn. Beyond that a cascade would fund itself, which is a loop, not a reward. */
export const REACTION_BONE_CAP = 2;

/**
 * Pays a Bone back to whoever caused the reaction.
 *
 * Credited to the active side rather than to the victim's opponent: a reaction fires
 * inside the acting side's resolution chain, and self-inflicted ones (shoving your own
 * burning unit into a chilled ally) are still your doing. This mirrors how `spawnHazard`
 * already decides ownership.
 */
function refundReactionBone(ctx: Ctx, def: ReactionDef, at: Coord): void {
  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  if (cmd.reactionBonesThisTurn >= REACTION_BONE_CAP) return;

  cmd.reactionBonesThisTurn += 1;
  creditRefund(ctx, side, { id: def.id, name: def.name }, at);
}

/**
 * `creditRefund`, but against the per-turn reaction budget.
 *
 * The uncapped door above is right for a passive that its own rule already fires once a turn.
 * It is wrong for anything that scales with how many bodies you own — and `refunds.onAttack`
 * does exactly that. Storm Wisp costs 1 Bone, has Haste, and pays 1 Bone per swing; with an
 * attack costing 1 Bone, every Wisp swing became free and a second Wisp made them profitable.
 * The budget the cascade rule already owns is the right ceiling: "beyond that a cascade would
 * fund itself, which is a loop rather than a reward."
 *
 * Returns whether it paid, so a caller looping `onAttack: 2` can stop at the cap rather than
 * spinning.
 */
export function creditCappedRefund(
  ctx: Ctx,
  side: Side,
  source: { id: string; name: string },
  at: Coord,
): boolean {
  const cmd = ctx.state.players[side];
  if (cmd.reactionBonesThisTurn >= REACTION_BONE_CAP) return false;
  cmd.reactionBonesThisTurn += 1;
  creditRefund(ctx, side, source, at);
  return true;
}

/**
 * Pays one Bone and announces it as a reward rather than as income.
 *
 * Split out of `refundReactionBone` so a passive can pay the same way a reaction does —
 * Voltara's Storm Tithe is the first — without either re-deriving the amount or
 * re-inventing what the payment looks like on screen.
 *
 * Note what is deliberately **not** in here: `reactionBonesThisTurn`. That counter exists
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
  // Deliberately unclamped, like every other Bone gain: the cap of 8 is applied once, at
  // end-of-turn cleanup, so a refund near the ceiling still banks for this turn's use.
  cmd.bones += REACTION_BONE_REFUND;

  // `boneRefunded` rather than `gainBones`, which would emit the generic `boneGained`: the
  // presentation layer has to be able to tell a reward from ordinary turn income, and it
  // cannot do that from an event that describes both. It carries `total` for the same
  // reason `boneGained` does, so the dial updates from one event either way.
  emit(ctx, {
    t: 'boneRefunded',
    side,
    amount: REACTION_BONE_REFUND,
    total: cmd.bones,
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

