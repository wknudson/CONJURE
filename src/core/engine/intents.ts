/**
 * Enemy intent: the enemy commits, in advance, to what it will do next turn.
 *
 * This is Into the Breach's central idea, and it is what turns every other system in the
 * game into a tool. A shove stops being chip damage and becomes "push the attacker off
 * its firing line". A Barricade becomes a body-block. Freeze becomes "cancel that
 * specific hit". Without it the player acts blind and every loss feels arbitrary.
 *
 * Two rules make it trustworthy, and both matter more than they look:
 *
 *   1. **A declared blow lands on the tile, not the target.** Move the victim away and
 *      the attack strikes empty ground — or whatever is standing there now, including one
 *      of the enemy's own units. That is the reward for playing well, and softening it
 *      would remove the reason to bother.
 *   2. **What is declared is what happens.** The enemy does not re-plan on its turn. If
 *      it could, the telegraph would be a suggestion rather than a promise, and the whole
 *      mechanic would be worth nothing.
 *
 * How much gets declared is a difficulty setting, not a constant — see `AiProfile.telegraph`.
 */

import { boneIncomeFor } from '../data/economy.js';
import type { Coord, UnitId } from '../../contract/ids.js';
import { coordKey } from '../../contract/ids.js';
import type { Command } from '../types/commands.js';
import type { GameState } from '../types/state.js';
import type { Ctx } from './context.js';
import { emit, newCause } from './context.js';
import { deepClone } from '../util/clone.js';
import { canAct } from './movement.js';
import { getEntity } from './board.js';
import { CARDS } from '../data/cards/index.js';

/**
 * Reads a planned turn and records what the player will be shown.
 *
 * The plan itself is kept alongside: execution replays these exact commands rather than
 * asking the AI again, which is what makes the declaration binding.
 */
export function declareIntents(
  ctx: Ctx,
  plan: Command[],
  telegraph: 'all' | 'attacks',
): void {
  const state = ctx.state;
  state.declaredPlan = plan.filter((c) => c.type !== 'endTurn');
  state.intents = [];

  // Movement is tracked as it is planned so an attack can show the path taken to reach
  // it — the arrow starts where the unit will be standing, not where it stands now.
  const plannedFrom = new Map<UnitId, Coord>();
  const plannedPath = new Map<UnitId, Coord[]>();

  for (const command of state.declaredPlan) {
    switch (command.type) {
      case 'moveUnit': {
        const unit = state.units[command.unit];
        if (!unit) break;
        if (!plannedFrom.has(command.unit)) plannedFrom.set(command.unit, { ...unit.anchor });
        const path = plannedPath.get(command.unit) ?? [{ ...unit.anchor }];
        path.push({ ...command.to });
        plannedPath.set(command.unit, path);
        break;
      }

      case 'attack': {
        const unit = state.units[command.attacker];
        if (!unit) break;

        const at =
          command.target.kind === 'portrait'
            ? undefined
            : getEntity(state, command.target.id)?.anchor;

        state.intents.push({
          unitId: command.attacker,
          kind: command.target.kind === 'portrait' ? 'commander' : 'attack',
          ...(at ? { at: { ...at } } : {}),
          ...(plannedPath.has(command.attacker)
            ? { path: plannedPath.get(command.attacker)!.map((c) => ({ ...c })) }
            : {}),
          damage: unit.atk,
        });
        break;
      }

      case 'channel': {
        const unit = state.units[command.unit];
        if (!unit) break;
        state.intents.push({
          unitId: command.unit,
          kind: 'channel',
          at: { ...unit.anchor },
          damage: 0,
        });
        break;
      }

      case 'playCard': {
        // Card plays are the hidden half at higher difficulty: an Adept keeps what it is
        // holding to itself, so only its blows are foreseeable.
        if (telegraph !== 'all') break;
        const inst = state.players.enemy.cards[command.card];
        const def = inst ? CARDS[inst.defId] : undefined;
        if (!def) break;

        // Where to point the marker. A tile is itself; an entity is marked where it
        // stands and *followed* if it moves (`targetId`), because unlike a blow the card
        // is bound to the target rather than the ground and a dodgeable-looking tile
        // would be a lie in the other direction; a line is marked at its origin. A
        // global cast has no tile at all — it is still declared, and the HUD names it.
        // This used to write `at` for tiles alone, so every mark, aura, targeted spell
        // and Cataclysmic Core was declared and drew nothing — at the one tier whose
        // whole premise is that nothing is hidden.
        const target = command.target;
        const entity =
          target.kind === 'entity' && target.ref.kind !== 'portrait'
            ? getEntity(state, target.ref.id)
            : undefined;
        const at =
          target.kind === 'tile' ? target.at : target.kind === 'line' ? target.from : entity?.anchor;

        state.intents.push({
          unitId: `card:${command.card}`,
          kind: 'card',
          ...(at ? { at: { ...at } } : {}),
          ...(entity ? { targetId: entity.id } : {}),
          damage: 0,
          label: def.name,
        });
        break;
      }

      default:
        break;
    }
  }

  // A body that only walks. Declared after the loop rather than inside it, because a
  // move followed by a strike is *one* intent — the approach is already drawn as the
  // attack's `path`, and announcing both would telegraph the same commitment twice.
  //
  // Gated behind the same telegraph setting as card plays: a Novice tells you everything,
  // and an Adept keeps its footwork to itself. Without the gate this would hand the
  // higher difficulty *more* information than the lower one.
  if (telegraph === 'all') {
    for (const [unitId, path] of plannedPath) {
      if (state.intents.some((i) => i.unitId === unitId)) continue;
      const to = path[path.length - 1];
      if (!to) continue;
      state.intents.push({
        unitId,
        kind: 'move',
        at: { ...to },
        path: path.map((c) => ({ ...c })),
        damage: 0,
      });
    }
  }

  for (const intent of state.intents) {
    emit(ctx, {
      t: 'intentDeclared',
      unitId: intent.unitId,
      kind: intent.kind,
      ...(intent.at ? { at: { ...intent.at } } : {}),
      damage: intent.damage,
      ...(intent.label ? { label: intent.label } : {}),
    });
  }
}

/**
 * Turns the declared plan into the commands to actually run.
 *
 * Adapted, not re-planned. An attack is retargeted onto whatever occupies the declared
 * tile now — which may be nobody, and may be one of the enemy's own units. Anything whose
 * actor is dead or held is dropped.
 */
export function commandsForDeclaredTurn(state: GameState): Command[] {
  const out: Command[] = [];

  for (const command of state.declaredPlan) {
    switch (command.type) {
      case 'attack': {
        const attacker = state.units[command.attacker];
        if (!attacker || !canAct(attacker)) break;

        if (command.target.kind === 'portrait') {
          out.push(command);
          break;
        }

        // Resolve by position, not identity: the tile is what was declared.
        const declaredAt = intentTileFor(state, command.attacker);
        if (!declaredAt) {
          out.push(command);
          break;
        }

        const occupant = occupantOf(state, declaredAt);
        if (!occupant) {
          // Nothing there any more. The swing still happens, and hits nothing.
          out.push({ type: 'attackTile', attacker: command.attacker, at: declaredAt });
          break;
        }
        out.push({
          type: 'attack',
          attacker: command.attacker,
          target:
            'atk' in occupant
              ? { kind: 'unit', id: occupant.id }
              : { kind: 'obstacle', id: occupant.id },
        });
        break;
      }

      case 'moveUnit': {
        const unit = state.units[command.unit];
        if (!unit || !canAct(unit)) break;
        out.push(command);
        break;
      }

      default:
        out.push(command);
        break;
    }
  }

  return out;
}

/** The tile a unit's declared attack was aimed at. */
function intentTileFor(state: GameState, unitId: UnitId): Coord | undefined {
  const intent = state.intents.find((i) => i.unitId === unitId && i.kind === 'attack');
  return intent?.at;
}

function occupantOf(state: GameState, at: Coord): { id: UnitId; atk?: number } | undefined {
  for (const unit of Object.values(state.units)) {
    const cells =
      unit.footprint === 1
        ? [unit.anchor]
        : [
            unit.anchor,
            { x: unit.anchor.x + 1, y: unit.anchor.y },
            { x: unit.anchor.x, y: unit.anchor.y + 1 },
            { x: unit.anchor.x + 1, y: unit.anchor.y + 1 },
          ];
    if (cells.some((c) => coordKey(c) === coordKey(at))) return unit;
  }
  for (const o of Object.values(state.obstacles)) {
    if (coordKey(o.anchor) === coordKey(at)) return o;
  }
  return undefined;
}

/** Clears declarations, e.g. when a boss phase change invalidates the whole plan. */
export function clearIntents(ctx: Ctx): void {
  if (ctx.state.intents.length === 0 && ctx.state.declaredPlan.length === 0) return;
  ctx.state.intents = [];
  ctx.state.declaredPlan = [];
  newCause(ctx);
  emit(ctx, { t: 'intentsCleared' });
}

/**
 * The board the enemy's *next* turn will be played on.
 *
 * Declaration happens while its units are spent from the turn just finished, so planning
 * against the live state would find nothing anyone could do. The clone restores their
 * actions — it is a forecast, not a mutation, and the real state is untouched.
 *
 * Deliberately does not simulate the upkeep draw: what the enemy will hold next turn
 * depends on a shuffle that has not happened, and promising a card play from a card it
 * does not have yet would be a lie.
 *
 * It *does* credit next turn's Bone income, and must. A swing costs a Bone, so a plan drawn
 * against this turn's bank would declare blows the enemy cannot fund — and an unaffordable
 * declared attack is dropped in silence by `session.ts`, which is the same lie in the other
 * direction. The player would see four arrows, plan a Freeze around the third, and watch two of
 * them never arrive.
 *
 * Income is the one part of next turn that *is* knowable: it is a function of the bodies
 * standing, and this clone already knows those.
 */
export function boardForNextEnemyTurn(state: GameState): GameState {
  const clone = deepClone(state);
  for (const unit of Object.values(clone.units)) {
    if (unit.side !== 'enemy') continue;
    unit.movedThisTurn = false;
    unit.attackedThisTurn = false;
    unit.summonedThisTurn = false;
  }
  const paid = Object.values(clone.units).filter(
    (u) => u.side === 'enemy' && !u.keywords.includes('Feral'),
  ).length;
  const cmd = clone.players.enemy;
  cmd.bones = Math.min(cmd.boneCap, cmd.bones + boneIncomeFor(paid));
  clone.activeSide = 'enemy';
  clone.phase = 'action';
  return clone;
}
