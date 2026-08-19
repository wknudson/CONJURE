/**
 * Runes: attachment, trigger evaluation, cascades, and fizzling.
 *
 * The three rules that matter (Draft 7 §7):
 *  1. Max 1 rune per entity (enforced by the `rune?` field being singular).
 *  2. Damage-based triggers need at least 1 point of ACTUAL HP loss — damage fully
 *     absorbed by armor does not detonate. This is what makes armor a real cascade brake.
 *  3. Fizzle: an entity killed by an unaligned damage type, or devoured, discards its
 *     rune without detonating.
 */

import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import { coordEq } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { emit, newCause } from './context.js';
import type { BlastPattern, Entity, RuneDef } from '../types/units.js';
import { RUNES } from '../data/runes.js';
import { allEntities, entityAt, getEntity, lowestHpEnemy, refOf } from './board.js';
import { MAX_CHAIN_DEPTH, dealDamage, type DamageRequest } from './damage.js';
import { applyStatusTo } from './status.js';
import { cellsOf, chebyshev, manhattan } from '../util/grid.js';

/** Cascades deeper than this abort — a hard backstop against pathological loops. */
// Imported rather than declared: the ceiling is a property of cascades, not of runes,
// and a second copy here is how `rune -> collision -> rune` came to be bounded by nothing.

export function attachRune(ctx: Ctx, host: Entity, runeDefId: string): void {
  const def = RUNES[runeDefId];
  if (!def) return;
  // Attaching over an existing rune replaces it; the old one is simply discarded.
  host.rune = { defId: def.id, ownerSide: host.side };
  emit(ctx, {
    t: 'runeAttached',
    hostId: host.id,
    at: { ...host.anchor },
    rune: { defId: def.id, name: def.name, school: def.school, ownerSide: host.side },
  });
}

/**
 * Called from dealDamage after HP is written. Decides detonate / fizzle / nothing.
 */
export function evaluateRuneOnDamage(
  ctx: Ctx,
  host: Entity,
  req: DamageRequest,
  hpLoss: number,
  died: boolean,
): void {
  const attached = host.rune;
  if (!attached) return;
  const def = RUNES[attached.defId];
  if (!def) return;

  const depth = (req.chainDepth ?? 0) + 1;

  if (def.trigger.kind === 'hpLoss') {
    const aligned = def.trigger.alignedTypes.includes(req.dtype);
    if (hpLoss > 0 && aligned) {
      detonate(ctx, host, depth);
      return;
    }
    // Killed by the wrong damage type: the rune is lost without firing.
    if (died) {
      host.rune = undefined;
      emit(ctx, { t: 'runeFizzled', hostId: host.id, rune: def.id, reason: 'unaligned' });
    }
    return;
  }

  // Death-triggered runes (Soul Splinter) fire regardless of damage type.
  if (def.trigger.kind === 'death' && died) {
    detonate(ctx, host, depth);
  }
}

/** Fired when a unit dies or is sacrificed without a damage instance driving it. */
export function evaluateRuneOnDeath(
  ctx: Ctx,
  host: Entity,
  devoured: boolean,
  /**
   * Depth the death itself arrived at. A death rune is a link like any other: a rune that
   * kills a rune-holder whose own rune kills the next is the cascade the ceiling exists
   * for, and this was hardcoded to 1 -- so every death in a chain restarted the count.
   */
  chainDepth = 1,
): void {
  const attached = host.rune;
  if (!attached) return;
  const def = RUNES[attached.defId];
  if (!def) return;

  if (devoured) {
    host.rune = undefined;
    emit(ctx, { t: 'runeFizzled', hostId: host.id, rune: def.id, reason: 'devour' });
    return;
  }

  if (def.trigger.kind === 'death') {
    detonate(ctx, host, chainDepth);
  } else {
    host.rune = undefined;
    emit(ctx, { t: 'runeFizzled', hostId: host.id, rune: def.id, reason: 'unaligned' });
  }
}

/**
 * Detonates one rune. Damage dealt here re-enters dealDamage, which re-enters
 * evaluateRuneOnDamage — that recursion IS the cascade, and it resolves within the
 * same step exactly as the docs describe.
 */
export function detonate(ctx: Ctx, host: Entity, chainDepth: number, bonusDamage = 0): void {
  const attached = host.rune;
  if (!attached) return;
  const def = RUNES[attached.defId];
  if (!def) return;
  if (chainDepth > MAX_CHAIN_DEPTH) return;
  if (ctx.state.encounter.chainCancelled) return;

  // Read the owner before consuming: `host.rune` is cleared on the next line, and the
  // riders below still need to know whose trap this was.
  const ownerSide = attached.ownerSide;

  // Consume before resolving, so a rune can never re-trigger itself.
  host.rune = undefined;

  const origin = { ...host.anchor };
  const affected = blastTiles(ctx, host, def.blast);

  newCause(ctx);
  emit(ctx, {
    t: 'runeDetonated',
    hostId: host.id,
    at: origin,
    rune: def.id,
    school: def.school,
    affected,
    chainDepth,
  });

  applyBlast(ctx, host, def, def.damage + bonusDamage, chainDepth, affected, ownerSide);
}

/**
 * What a detonation does to one victim: the damage, then whatever it leaves behind.
 *
 * Both halves in one place so a rune can never damage without applying, or the reverse.
 *
 * A zero-damage rune skips `dealDamage` entirely rather than calling it with nothing — an
 * empty hit still emits a `damageDealt` the HUD would draw as a "0", and it would run the
 * whole reaction and rune-trigger pipeline for a blow that never landed.
 *
 * Statuses land after the damage and only on a survivor, the same discipline `onHit`
 * keeps: entangling a corpse is bookkeeping nobody reads.
 */
function strike(
  ctx: Ctx,
  def: RuneDef,
  target: TargetRef,
  amount: number,
  chainDepth: number,
  ownerSide: Side,
): void {
  if (amount > 0) {
    dealDamage(ctx, { target, amount, dtype: def.dtype, cause: 'rune', chainDepth });
  }

  if (!def.applies?.length || target.kind !== 'unit') return;
  const victim = ctx.state.units[target.id];
  if (!victim) return;

  for (const rider of def.applies) {
    // The side that *laid* the rune, not the side whose turn sprang it. A trap springs on
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
  def: RuneDef,
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
  // runes only hit the board. Commander damage comes from units and spells.
}

/** Cataclysmic Core: detonate every rune on the board, with bonus damage. */
export function detonateAllRunes(ctx: Ctx, bonusDamage: number): void {
  // Snapshot the host list first — detonations mutate the board as they resolve.
  const hosts = allEntities(ctx.state)
    .filter((e) => e.rune)
    .sort((a, b) => (a.anchor.y !== b.anchor.y ? a.anchor.y - b.anchor.y : a.anchor.x - b.anchor.x));

  for (const h of hosts) {
    const live = getEntity(ctx.state, h.id);
    if (!live || !live.rune || live.hp <= 0) continue;
    detonate(ctx, live, 1, bonusDamage);
    if (ctx.state.result) return;
  }
}

/** Every entity currently holding a rune — used by AI threat scoring and the board view. */
export function runeHosts(state: Ctx['state']): Entity[] {
  return allEntities(state).filter((e) => e.rune);
}
