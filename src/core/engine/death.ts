/**
 * Entity removal and the lethal / Last Stand check.
 */

import type { Coord, DamageCause, UnitId } from '../../contract/ids.js';
import type { Ctx } from './context.js';
import { onAnchorDied } from './subjugation.js';
import { emit, newCause } from './context.js';
import type { Entity, Unit } from '../types/units.js';
import { isUnit } from '../types/units.js';
import { entityAt, getEntity, unitAt } from './board.js';
import { evaluateMarkOnDeath } from './marks.js';
import { placeOpeningUnit } from './spawn.js';
import { CARDS } from '../data/cards/index.js';
import { creditRefund, spawnHazard } from './reactions.js';
import { applyStatusTo } from './status.js';
import { dealDamage } from './damage.js';
import { inBounds } from '../types/state.js';
import { DIRS_8 } from '../util/grid.js';
import { STAT_SCALE } from '../scale.js';

/**
 * Removes an entity from the board. `devoured` routes to the fizzle path: a devoured
 * host's mark is discarded without detonating.
 */
/**
 * Marks a fallen Vanguard body in the roster it came from.
 *
 * A Soul Pyre is **memory, not matter**. Nothing is spawned: the tile is not blocked, the
 * pyre cannot be attacked or dispelled, it never expires, and it coexists with any hazard
 * or occupant. All it is is a coordinate the roster remembers, which is what the three
 * revival spells read.
 *
 * That choice has one visible consequence worth naming: an enemy standing where your body
 * fell denies Aetheric Resurgence *only while it stands there*, and it costs them a body's
 * positioning to do it. A physical pyre would have needed rules for all of that.
 *
 * Only rostered bodies leave one. A spell-summoned revenant, an enemy, a Feral and the
 * Bound Form are all absent from the roster and so pass through here untouched.
 */
function lightPyre(ctx: Ctx, unit: Unit, at: Coord): void {
  const entry = ctx.state.players[unit.side].roster.find(
    (r) => r.unitId === unit.id && r.status === 'fielded',
  );
  if (!entry) return;

  entry.status = 'fallen';
  entry.fellAt = { ...at };
  delete entry.unitId;

  emit(ctx, { t: 'pyreLit', defId: entry.defId, unitId: unit.id, at: { ...at } });
}

export function killEntity(
  ctx: Ctx,
  entity: Entity,
  cause: DamageCause,
  devoured = false,
  chainDepth = 0,
): void {
  const live: Entity | undefined = getEntity(ctx.state, entity.id);
  if (!live) return;

  const at = { ...live.anchor };

  if (isUnit(live)) {
    // Before removal, while the body is still standing somewhere the tether can be drawn
    // snapping from. It also has to run before checkLethal: the punitive stack must be on
    // the beast whatever else this death resolves into.
    onAnchorDied(ctx, live);
    delete ctx.state.units[live.id];
    // Never leave a dangling reference to a body that is no longer on the board. Damage
    // can never kill a Bound Form, but a board wipe removes it like anything else.
    const owner = ctx.state.players[live.side];
    if (owner.companionUnitId === live.id) delete owner.companionUnitId;
    emit(ctx, {
      t: 'unitDied',
      unitId: live.id,
      at,
      footprint: live.footprint,
      cause,
    });
    // One tally, at the only place a unit actually leaves the board. Devoured, shoved
    // into a wall, burned by a hazard or cut down — the Ledger counts them all the same,
    // because the player killed it either way.
    if (live.side === 'enemy') ctx.state.defeated.push(live.defId);
    lightPyre(ctx, live, at);
    payBounty(ctx, live.defId, at);
    deathburst(ctx, live, at);
    payDeathRefund(ctx, live);
  } else {
    delete ctx.state.obstacles[live.id];
    emit(ctx, { t: 'obstacleDestroyed', obstacleId: live.id, at });
    payDestroyReward(ctx, live.defId, at);
    // A broken wall is not a cleared lane. The stone stays where it fell, and crossing
    // it costs — so knocking one down opens a route without making it a fast one.
    if (CARDS[live.defId]?.leavesRubble) {
      spawnHazard(ctx, at, 'rubble', 1, true);
    }
    burstObstacle(ctx, live.defId, at, chainDepth);
  }

  // Mark resolution happens after removal so a death-triggered blast cannot hit its
  // own dead host, and so the board state the blast sees is already correct.
  if (live.mark) {
    evaluateMarkOnDeath(ctx, live, devoured, Math.max(1, chainDepth));
  }

  checkLethal(ctx);
}

/**
 * The corpse lashing out.
 *
 * Runs after the body is off the board, in the same slot an obstacle's burst does and for
 * the same reason: nothing should be able to catch its own dead host, and the board the
 * burst reads has to already be correct.
 *
 * **Enemies of the dead body only.** A Deathburst is what the thing was full of, released
 * where it fell -- not a bomb that fails to tell sides apart. That is the half that makes
 * it worth fielding one deliberately.
 */
function deathburst(ctx: Ctx, dead: Unit, at: Coord): void {
  const spec = CARDS[dead.defId]?.unit?.deathburst;
  if (!spec) return;

  for (const cell of DIRS_8.map((d) => ({ x: at.x + d.x, y: at.y + d.y }))) {
    const victim = entityAt(ctx.state, cell);
    if (!victim || !isUnit(victim) || victim.side === dead.side) continue;
    applyStatusTo(ctx, victim, spec.status, spec.stacks, dead.side);
    if (ctx.state.result) return;
  }
}

/**
 * What a body pays its owner for dying.
 *
 * The Dusk half of `refunds`, and the reason the field holds both moments rather than
 * being two fields: a Hollowed Husk is worth something because it died, exactly as a Storm
 * Wisp is worth something because it swung, and the payment is identical either way.
 */
function payDeathRefund(ctx: Ctx, dead: Unit): void {
  const owed = CARDS[dead.defId]?.unit?.refunds?.onDeath ?? 0;
  for (let i = 0; i < owed; i++) {
    creditRefund(ctx, dead.side, { id: dead.defId, name: dead.name }, dead.anchor);
  }
}

/**
 * A crystal going off.
 *
 * Everything in the surrounding nine tiles catches it, on both sides. That is the whole
 * design: the blast does not know whose army is standing in it, so shooting one is a
 * decision about where your own units are, not a free removal spell.
 *
 * Runs inside the death cascade, so it respects a cancelled chain the same way a mark
 * blast does — a boss Damage Gate that stops a chain stops this with it.
 */
function burstObstacle(ctx: Ctx, defId: string, at: Coord, chainDepth: number): void {
  const burst = CARDS[defId]?.obstacleDeath;
  if (!burst) return;
  if (ctx.state.encounter.chainCancelled) return;

  newCause(ctx);
  emit(ctx, { t: 'reactionTriggered', reaction: 'crystal_burst', name: 'Burst', at: { ...at } });

  // Snapshot the victims before touching anything: the blast can kill, and a kill can
  // set off the next crystal, which must not mutate the list being walked.
  const caught: UnitId[] = [];
  for (const cell of [at, ...adjacent(ctx.state, at)]) {
    const occupant = unitAt(ctx.state, cell);
    if (occupant && !caught.includes(occupant.id)) caught.push(occupant.id);
  }

  for (const id of caught) {
    const unit = ctx.state.units[id];
    if (!unit) continue;
    applyStatusTo(ctx, unit, burst.status, burst.stacks);
  }

  if (burst.damage === undefined) return;
  for (const id of caught) {
    if (!ctx.state.units[id]) continue;
    dealDamage(ctx, {
      target: { kind: 'unit', id },
      amount: burst.damage,
      dtype: 'true',
      cause: 'spell',
      chainDepth,
    });
  }
}

/** The eight tiles around a point, in bounds. */
function adjacent(state: Ctx['state'], at: Coord): Coord[] {
  const out: Coord[] = [];
  for (const dir of DIRS_8) {
    const c = { x: at.x + dir.x, y: at.y + dir.y };
    if (inBounds(state, c)) out.push(c);
  }
  return out;
}

/**
 * Pays out an obstacle that was worth something to break.
 *
 * Credited to the side whose turn it is. That is right for a deliberate swing, which is
 * how a geode is broken in practice; a cascade that clips one during the opponent's turn
 * pays the opponent, which is a rare and forgivable wrinkle next to threading an
 * attacker through every path that can destroy a tile.
 */
function payDestroyReward(ctx: Ctx, defId: string, at: Coord): void {
  payTo(ctx, defId, at, CARDS[defId]?.onDestroyReward?.marrow, 'obstacle');
}

/** The purse a scavenger was carrying, paid to whoever brought it down. */
function payBounty(ctx: Ctx, defId: string, at: Coord): void {
  payTo(ctx, defId, at, CARDS[defId]?.bounty?.marrow, 'creature');
}

function payTo(
  ctx: Ctx,
  defId: string,
  at: Coord,
  marrow: number | undefined,
  source: 'obstacle' | 'creature',
): void {
  if (!marrow) return;
  const side = ctx.state.activeSide;
  const cmd = ctx.state.players[side];
  cmd.marrow += marrow;
  emit(ctx, { t: 'resourcesChanged', side, pips: cmd.pips, marrow: cmd.marrow });
  emit(ctx, {
    t: 'marrowExtracted',
    side,
    amount: marrow,
    total: cmd.marrow,
    at: { ...at },
    name: CARDS[defId]?.name ?? defId,
    source,
  });
}

/**
 * Win/loss evaluation, including the mutual-KO rule: if both commanders hit 0
 * in the same step, both revive at 1 HP, the board is wiped of non-obstacle units and
 * marks, all armor is purged, and combat continues in sudden death.
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
      // A second mutual KO during sudden death resolves to the instigator.
      player.hp = STAT_SCALE;
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
    cmd.hp = STAT_SCALE;
    cmd.armor = 0;
  }

  // Wipe every non-obstacle unit and every mark.
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
    obs.mark = undefined;
  }

  // The wipe took the Bound Form with it, but the Pact did not end — it was revived at
  // 1 HP above. The body has to come back with it, or the player would spend the rest of
  // the fight with no Companion and no way to cast from one.
  for (const side of ['player', 'enemy'] as const) {
    const cmd = ctx.state.players[side];
    if (!cmd.companionUnitDefId) continue;
    const id = placeOpeningUnit(ctx, cmd.companionUnitDefId, side, {
      x: cmd.companionColumn,
      y: side === 'player' ? ctx.state.height - 1 : 0,
    });
    cmd.companionUnitId = id;
  }

  emit(ctx, { t: 'suddenDeath' });
}

export function finish(ctx: Ctx, result: 'victory' | 'defeat' | 'bound'): void {
  if (ctx.state.result) return;
  ctx.state.result = result;
  ctx.state.phase = 'over';
  emit(ctx, { t: 'combatEnded', result });
}
