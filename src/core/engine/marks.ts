/**
 * Marks: attachment, trigger evaluation, cascades, and fizzling.
 *
 * The three rules that matter (Draft 7 §7):
 *  1. Max 1 mark per entity (enforced by the `mark?` field being singular).
 *  2. Damage-based triggers need at least 1 point of ACTUAL HP loss — damage fully
 *     absorbed by armor does not detonate. This is what makes armor a real cascade brake.
 *  3. Fizzle: an entity killed by an unaligned damage type, or devoured, discards its
 *     mark without detonating.
 */

import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import { coordEq } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit, newCause } from './context.js';
import type { BlastPattern, Entity, MarkDef } from '../types/units.js';
import { MARKS } from '../data/marks.js';
import { allEntities, entityAt, getEntity, lowestHpEnemy, refOf } from './board.js';
import { MAX_CHAIN_DEPTH, dealDamage, type DamageRequest } from './damage.js';
import { applyStatusTo } from './status.js';
import { cellsOf, chebyshev, manhattan } from '../util/grid.js';

/** Cascades deeper than this abort — a hard backstop against pathological loops. */
// Imported rather than declared: the ceiling is a property of cascades, not of marks,
// and a second copy here is how `mark -> collision -> mark` came to be bounded by nothing.

export function attachMark(ctx: Ctx, host: Entity, markDefId: string): void {
  const def = MARKS[markDefId];
  if (!def) return;
  // Attaching over an existing mark replaces it; the old one is simply discarded.
  host.mark = { defId: def.id, ownerSide: host.side };
  emit(ctx, {
    t: 'markAttached',
    hostId: host.id,
    at: { ...host.anchor },
    mark: { defId: def.id, name: def.name, school: def.school, ownerSide: host.side },
  });
}

/**
 * Called from dealDamage after HP is written. Decides detonate / fizzle / nothing.
 */
export function evaluateMarkOnDamage(
  ctx: Ctx,
  host: Entity,
  req: DamageRequest,
  hpLoss: number,
  died: boolean,
): void {
  const attached = host.mark;
  if (!attached) return;
  const def = MARKS[attached.defId];
  if (!def) return;

  const depth = (req.chainDepth ?? 0) + 1;

  if (def.trigger.kind === 'hpLoss') {
    const aligned = def.trigger.alignedTypes.includes(req.dtype);
    if (hpLoss > 0 && aligned) {
      detonate(ctx, host, depth);
      return;
    }
    // Killed by the wrong damage type: the mark is lost without firing.
    if (died) {
      host.mark = undefined;
      emit(ctx, { t: 'markFizzled', hostId: host.id, mark: def.id, reason: 'unaligned' });
    }
    return;
  }

  // Death-triggered marks (Soul Splinter) fire regardless of damage type.
  if (def.trigger.kind === 'death' && died) {
    detonate(ctx, host, depth);
  }
}

/** Fired when a unit dies or is sacrificed without a damage instance driving it. */
export function evaluateMarkOnDeath(
  ctx: Ctx,
  host: Entity,
  devoured: boolean,
  /**
   * Depth the death itself arrived at. A death mark is a link like any other: a mark that
   * kills a mark-holder whose own mark kills the next is the cascade the ceiling exists
   * for, and this was hardcoded to 1 -- so every death in a chain restarted the count.
   */
  chainDepth = 1,
): void {
  const attached = host.mark;
  if (!attached) return;
  const def = MARKS[attached.defId];
  if (!def) return;

  if (devoured) {
    host.mark = undefined;
    emit(ctx, { t: 'markFizzled', hostId: host.id, mark: def.id, reason: 'devour' });
    return;
  }

  if (def.trigger.kind === 'death') {
    detonate(ctx, host, chainDepth);
  } else {
    host.mark = undefined;
    emit(ctx, { t: 'markFizzled', hostId: host.id, mark: def.id, reason: 'unaligned' });
  }
}

/**
 * Detonates one mark. Damage dealt here re-enters dealDamage, which re-enters
 * evaluateMarkOnDamage — that recursion IS the cascade, and it resolves within the
 * same step exactly as the docs describe.
 */
export function detonate(ctx: Ctx, host: Entity, chainDepth: number, bonusDamage = 0): void {
  const attached = host.mark;
  if (!attached) return;
  const def = MARKS[attached.defId];
  if (!def) return;
  if (chainDepth > MAX_CHAIN_DEPTH) return;
  if (ctx.state.encounter.chainCancelled) return;

  // Read the owner before consuming: `host.mark` is cleared on the next line, and the
  // riders below still need to know whose trap this was.
  const ownerSide = attached.ownerSide;

  // Consume before resolving, so a mark can never re-trigger itself.
  host.mark = undefined;

  // Counted for the Mastery Objectives. Whose trap it was, not whose body it was on: a
  // Cinder Mark the player branded an enemy with is the player's detonation, and that is
  // the whole shape of the objective.
  if (ownerSide === 'player') ctx.state.playerMarkDetonations += 1;

  const origin = { ...host.anchor };
  const affected = blastTiles(ctx, host, def.blast);

  newCause(ctx);
  emit(ctx, {
    t: 'markDetonated',
    hostId: host.id,
    at: origin,
    mark: def.id,
    school: def.school,
    affected,
    chainDepth,
  });

  applyBlast(ctx, host, def, def.damage + bonusDamage, chainDepth, affected, ownerSide);
}

/**
 * What a detonation does to one victim: the damage, then whatever it leaves behind.
 *
 * Both halves in one place so a mark can never damage without applying, or the reverse.
 *
 * A zero-damage mark skips `dealDamage` entirely rather than calling it with nothing — an
 * empty hit still emits a `damageDealt` the HUD would draw as a "0", and it would run the
 * whole reaction and mark-trigger pipeline for a blow that never landed.
 *
 * Statuses land after the damage and only on a survivor, the same discipline `onHit`
 * keeps: entangling a corpse is bookkeeping nobody reads.
 */
function strike(
  ctx: Ctx,
  def: MarkDef,
  target: TargetRef,
  amount: number,
  chainDepth: number,
  ownerSide: Side,
): void {
  if (amount > 0) {
    dealDamage(ctx, { target, amount, dtype: def.dtype, cause: 'mark', chainDepth });
  }

  if (!def.applies?.length || target.kind !== 'unit') return;
  const victim = ctx.state.units[target.id];
  if (!victim) return;

  for (const rider of def.applies) {
    // The side that *laid* the mark, not the side whose turn sprang it. A trap springs on
    // the enemy's clock by definition, so reading the clock here credited every trap in
    // the game to the player who walked into it.
    applyStatusTo(ctx, victim, rider.status, rider.stacks, ownerSide);
  }
}

function blastTiles(ctx: Ctx, host: Entity, blast: BlastPattern): Coord[] {
  const hostCells = cellsOf(host);
  switch (blast.shape) {
    case 'self':
      return hostCells.map((c) => ({ ...c }));
    case 'adjacent8': {
      const out: Coord[] = [];
      for (const e of allEntities(ctx.state)) {
        if (e.id === host.id) continue;
        for (const c of cellsOf(e)) {
          if (hostCells.some((h) => chebyshev(h, c) <= 1) && !out.some((o) => coordEq(o, c))) {
            out.push({ ...c });
          }
        }
      }
      return [...hostCells.map((c) => ({ ...c })), ...out];
    }
    case 'plus': {
      const out: Coord[] = [];
      for (let y = 0; y < ctx.state.height; y++) {
        for (let x = 0; x < ctx.state.width; x++) {
          const c = { x, y };
          if (hostCells.some((h) => manhattan(h, c) <= blast.radius)) out.push(c);
        }
      }
      return out;
    }
    case 'lowestHpEnemy': {
      const victim = lowestHpEnemy(ctx.state, host.side);
      return victim ? cellsOf(victim).map((c) => ({ ...c })) : [];
    }
  }
}

function applyBlast(
  ctx: Ctx,
  host: Entity,
  def: MarkDef,
  amount: number,
  chainDepth: number,
  affected: Coord[],
  ownerSide: Side,
): void {
  if (def.blast.shape === 'lowestHpEnemy') {
    const victim = lowestHpEnemy(ctx.state, host.side);
    if (victim) {
      strike(ctx, def, refOf(victim), amount, chainDepth, ownerSide);
    }
    return;
  }

  // Collect victims first: the tile list is a snapshot, and entities may die mid-blast.
  const victims = new Set<UnitId>();
  for (const tile of affected) {
    const e = entityAt(ctx.state, tile);
    if (e && e.id !== host.id) victims.add(e.id);
  }

  for (const id of victims) {
    const e = getEntity(ctx.state, id);
    if (!e || e.hp <= 0) continue;
    strike(ctx, def, refOf(e), amount, chainDepth, ownerSide);
  }

  // A detonation on an enemy-owned host also chips the opposing commander is NOT a rule;
  // marks only hit the board. Commander damage comes from units and spells.
}

/** Cataclysmic Core: detonate every mark on the board, with bonus damage. */
export function detonateAllMarks(ctx: Ctx, bonusDamage: number): void {
  // Snapshot the host list first — detonations mutate the board as they resolve.
  const hosts = allEntities(ctx.state)
    .filter((e) => e.mark)
    .sort((a, b) => (a.anchor.y !== b.anchor.y ? a.anchor.y - b.anchor.y : a.anchor.x - b.anchor.x));

  for (const h of hosts) {
    const live = getEntity(ctx.state, h.id);
    if (!live || !live.mark || live.hp <= 0) continue;
    detonate(ctx, live, 1, bonusDamage);
    if (ctx.state.result) return;
  }
}

/** Every entity currently holding a mark — used by AI threat scoring and the board view. */
export function markHosts(state: Ctx['state']): Entity[] {
  return allEntities(state).filter((e) => e.mark);
}
