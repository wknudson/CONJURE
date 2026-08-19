/**
 * The effect interpreter: one recursive function that turns CardDef data into resolution.
 *
 * Every primitive delegates to an engine helper (dealDamage, pushUnit, killEntity, ...)
 * which owns the event emission and the rule checks. Adding a card means adding data;
 * it cannot bypass rune triggers, armor gating, or the lethal check.
 */

import { drawCards } from './deck.js';
import type { Coord, Side, TargetRef, UnitId } from '../../contract/ids.js';
import { coordEq } from '../../contract/ids.js';
import type { AreaSpec, CardPlayContext, EffectNode } from '../types/cards.js';
import type { Ctx } from './context.js';
import { applyStatusTo } from './status.js';
import { emit } from './context.js';
import { allEntities, entityAt, getEntity, lowestHpEnemy, refOf } from './board.js';
import { dealDamage, grantArmor, healCommander } from './damage.js';
import { killEntity } from './death.js';
import { setAnchor } from './subjugation.js';
import { attachRune, detonateAllRunes } from './runes.js';
import { pushUnit } from './displacement.js';
import { spawnObstacle, summonUnit } from './spawn.js';
import { CARDS } from '../data/cards/index.js';
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
      // The chosen tile, or — for a card that just offered something up — the ground that
      // offering was standing on. Without the fallback a `seq` of "spend this, raise that"
      // has nowhere to raise it, because an entity-targeted card carries no tile at all.
      const at = play.chosen.kind === 'tile' ? play.chosen.at : play.vacatedAt;
      if (!at) return;
      const id = summonUnit(ctx, node.unitDef, play.side, at);
      if (id) play.summonedUnitId = id;
      return;
    }

    case 'spawnObstacle': {
      const at = play.chosen.kind === 'tile' ? play.chosen.at : undefined;
      if (!at) return;
      play.spawnedObstacleId = spawnObstacle(
        ctx,
        node.obstacleDef,
        play.side,
        at,
        wallHp(ctx, play.side, node.obstacleDef),
      );
      return;
    }

    case 'attachRune': {
      // Whatever was picked, or — for a card aimed at an empty tile — whatever this same
      // play just raised there. That fallback is what lets one card build a thing and
      // wire it in a single `seq`; without it the rune would have no host and vanish.
      const ref = chosenRef(play);
      const hostId = ref && ref.kind !== 'portrait' ? ref.id : play.spawnedObstacleId;
      if (!hostId) return;

      const host = getEntity(ctx.state, hostId);
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
      // Remembered before the body is removed: whatever comes next may want this ground.
      play.vacatedAt = { ...unit.anchor };

      // An offering made by a card is still an offering. `sacrificeTarget` pays nothing
      // of its own — Dark Tithe's Marrow comes from its own `extractMarrow` — but the
      // Ledger is a rule about *sacrificing*, not about one command, so it applies here
      // too. Skipping this would make the relic silently worthless to the deck most
      // likely to want it.
      const cmd = ctx.state.players[play.side];
      const tithe = cmd.bonusSacrificeMarrow;
      if (tithe > 0) {
        cmd.marrow += tithe;
        emit(ctx, { t: 'resourcesChanged', side: play.side, pips: cmd.pips, marrow: cmd.marrow });
      }

      emit(ctx, { t: 'unitSacrificed', unitId: unit.id, marrowExtracted: tithe });
      // An offering made by a card is still an offering, the same reason the Ledger's
      // Marrow applies here.
      healCommander(ctx, play.side, cmd.healOnSacrifice);
      killEntity(ctx, unit, 'spell');
      return;
    }

    case 'extractMarrow': {
      const cmd = ctx.state.players[play.side];
      // A fixed number, or what the body just given up was worth, capped so a fat target
      // cannot pay for the whole turn on its own.
      const amount =
        typeof node.amount === 'number'
          ? node.amount
          : Math.min(node.amount.max, play.sacrificedHp ?? 0);
      if (amount <= 0) return;
      cmd.marrow += amount;
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

    case 'drawCards': {
      // The ordinary draw, so the hand limit and the overdraw burn both still apply — a
      // card that let you exceed seven would quietly rewrite a rule it never mentions.
      drawCards(ctx, play.side, node.amount);
      return;
    }

    case 'shoveArea':
      displaceArea(ctx, play, node.area, node.distance, 'away');
      return;

    case 'pullArea':
      displaceArea(ctx, play, node.area, node.distance, 'toward');
      return;

    case 'spawnConstruct': {
      if (play.chosen.kind !== 'tile') return;
      // Raised at this spell's strength rather than the definition's, plus whatever the
      // caster's gear adds — both settled here so the spawn emits the true number.
      play.spawnedObstacleId = spawnObstacle(
        ctx,
        node.obstacleDef,
        play.side,
        play.chosen.at,
        node.hp + ctx.state.players[play.side].bonusObstacleHp,
      );
      return;
    }

    case 'anchorTether': {
      // Targeting has already restricted this to a living unit of the caster's side, so
      // the only thing left to guard is the target having died to something else in the
      // same resolution chain.
      if (play.chosen.kind !== 'entity' || play.chosen.ref.kind !== 'unit') return;
      const target = ctx.state.units[play.chosen.ref.id];
      if (!target) return;
      setAnchor(ctx, target);
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

/**
 * What an obstacle raised by this side should actually stand at.
 *
 * Computed at the effect ops rather than inside `spawnObstacle`, and that is the whole
 * point: setup spawns the map's own crystals and Marrow Geodes through the same function,
 * filed under `'player'` because the engine has two sides and scenery belongs to neither.
 * A bonus applied down there would have the Alchemist's Mortar silently thickening every
 * rock on the board, including the ones the player wants to break. Only a played card
 * reaches this path.
 */
function wallHp(ctx: Ctx, side: Side, defId: string): number {
  const base = CARDS[defId]?.obstacleHp ?? 0;
  return base + ctx.state.players[side].bonusObstacleHp;
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

/**
 * Moves everything in an area one way or the other along the line to the origin.
 *
 * Shove and pull are the same operation with the vector inverted, so they share a body
 * rather than being two near-identical cases that could drift apart.
 *
 * Two things make the result predictable:
 *
 *  - The victims are collected before any of them moves. Displacing one vacates a tile
 *    another would then be read from, and the blast should be judged on the board as it
 *    was when it went off.
 *  - They are then sorted row-then-column rather than left in board order. It matters
 *    for a pull specifically: several units converging on one tile arrive in sequence,
 *    and whoever gets there first is what the rest collide with. Board order is an
 *    artefact of when units happened to be created, which is not something a player can
 *    see or reason about; reading order at least always resolves the same way.
 */
function displaceArea(
  ctx: Ctx,
  play: CardPlayContext,
  area: AreaSpec,
  distance: number,
  sense: 'toward' | 'away',
): void {
  const origin = originOf(ctx, play);
  if (!origin) return;

  const caught: UnitId[] = [];
  for (const ref of resolveArea(ctx, area, play)) {
    if (ref.kind !== 'unit') continue;
    if (!caught.includes(ref.id)) caught.push(ref.id);
  }

  caught.sort((a, b) => {
    const ua = ctx.state.units[a];
    const ub = ctx.state.units[b];
    if (!ua || !ub) return 0;
    return ua.anchor.y - ub.anchor.y || ua.anchor.x - ub.anchor.x;
  });

  for (const id of caught) {
    if (ctx.state.encounter.chainCancelled || ctx.state.result) return;
    const unit = ctx.state.units[id];
    if (!unit) continue;

    const away = {
      x: Math.sign(unit.anchor.x - origin.x),
      y: Math.sign(unit.anchor.y - origin.y),
    };
    // A unit standing on the origin has no line to travel along, either way.
    if (away.x === 0 && away.y === 0) continue;

    const dir = sense === 'away' ? away : { x: -away.x, y: -away.y };
    pushUnit(ctx, unit, dir, distance);
  }
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

    case 'cone': {
      // Needs a facing, and `line` is the only target that carries one.
      if (play.chosen.kind !== 'line') return [];
      const { from, dir } = play.chosen;
      // Perpendicular to the axis, for the widening.
      const perp = { x: -dir.y, y: dir.x };

      const cells: Coord[] = [];
      for (let depth = 0; depth < area.depth; depth++) {
        const spine = { x: from.x + dir.x * depth, y: from.y + dir.y * depth };
        for (let spread = -depth; spread <= depth; spread++) {
          const cell = { x: spine.x + perp.x * spread, y: spine.y + perp.y * spread };
          if (inBounds(ctx.state, cell)) cells.push(cell);
        }
      }

      const seen = new Set<UnitId>();
      const refs: TargetRef[] = [];
      for (const cell of cells) {
        const e = entityAt(ctx.state, cell);
        if (!e || seen.has(e.id)) continue;
        seen.add(e.id);
        refs.push(refOf(e));
      }
      return refs;
    }

    case 'adjacentCross': {
      const origin = originOf(ctx, play);
      if (!origin) return [];
      return allEntities(ctx.state)
        .filter((e) => cellsOf(e).some((c) => manhattan(c, origin) === 1))
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

