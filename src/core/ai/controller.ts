/**
 * The AI turn loop: enumerate -> simulate -> score -> pick greedily, one action at a
 * time, until nothing is worth doing or the action cap is reached.
 *
 * Failsafes from Module 5: a per-turn action cap, deterministic tie-breaking (never RNG),
 * and the Lethal Veto handled in score.ts.
 */

import type { Side } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import type { Command } from '../types/commands.js';
import { enumerateActions } from './enumerate.js';
import { NOVICE_WEIGHTS, scoreAction, type ScoredAction, type UtilityWeights } from './score.js';
import { nextFloat, nextInt } from '../util/rng.js';

export interface AiProfile {
  name: string;
  weights: UtilityWeights;
  /** Chance of deliberately choosing the 2nd or 3rd best action. */
  suboptimalChance: number;
  actionCap: number;
  /** Actions scoring at or below this are not worth taking. */
  passThreshold: number;
}

export const NOVICE_AI: AiProfile = {
  name: 'Novice',
  weights: NOVICE_WEIGHTS,
  suboptimalChance: 0.2,
  actionCap: 8,
  passThreshold: 0,
};

/**
 * Plans a full turn and returns the command list. The caller replays these through the
 * real engine so the UI receives a normal event stream.
 */
export function planTurn(state: GameState, side: Side, profile: AiProfile = NOVICE_AI): Command[] {
  const commands: Command[] = [];
  let current = state;

  for (let i = 0; i < profile.actionCap; i++) {
    if (current.result) break;

    const candidates = enumerateActions(current, side)
      .map((c) => scoreAction(current, side, c, profile.weights))
      .filter((s): s is ScoredAction => s !== undefined)
      .filter((s) => Number.isFinite(s.utility) && s.utility > profile.passThreshold);

    if (candidates.length === 0) break;

    candidates.sort((a, b) => compareActions(a, b, current));

    const chosen = pickWithSuboptimality(current, candidates, profile);
    commands.push(chosen.command);
    current = chosen.next;
  }

  // Only pass the turn if the game is still running — the engine rejects any command
  // issued after a result is decided.
  if (!current.result) commands.push({ type: 'endTurn' });
  return commands;
}

/**
 * Deterministic ordering: higher utility first, then Module 5's tie-break — the action
 * whose target sits closest to the enemy's back row, then leftmost. Never random.
 */
function compareActions(a: ScoredAction, b: ScoredAction, state: GameState): number {
  if (a.utility !== b.utility) return b.utility - a.utility;

  const ka = tieBreakKey(a.command, state);
  const kb = tieBreakKey(b.command, state);
  if (ka.y !== kb.y) return kb.y - ka.y;
  if (ka.x !== kb.x) return ka.x - kb.x;
  return ka.tag.localeCompare(kb.tag);
}

function tieBreakKey(command: Command, state: GameState): { x: number; y: number; tag: string } {
  switch (command.type) {
    case 'moveUnit':
      return { x: command.to.x, y: command.to.y, tag: `move:${command.unit}` };
    case 'attack': {
      if (command.target.kind === 'portrait') {
        return { x: 0, y: 99, tag: `attack:${command.attacker}` };
      }
      const t = state.units[command.target.id] ?? state.obstacles[command.target.id];
      return {
        x: t?.anchor.x ?? 0,
        y: t?.anchor.y ?? 0,
        tag: `attack:${command.attacker}`,
      };
    }
    case 'playCard': {
      const at = command.target.kind === 'tile' ? command.target.at : undefined;
      return { x: at?.x ?? 0, y: at?.y ?? 0, tag: `play:${command.card}` };
    }
    case 'sacrifice': {
      const u = state.units[command.unit];
      return { x: u?.anchor.x ?? 0, y: u?.anchor.y ?? 0, tag: `sac:${command.unit}` };
    }
    case 'endTurn':
      return { x: 0, y: 0, tag: 'end' };
  }
}

/**
 * With `suboptimalChance` probability, take the 2nd or 3rd best action instead of the
 * best. Seeded, so a given game replays identically.
 */
function pickWithSuboptimality(
  state: GameState,
  sorted: ScoredAction[],
  profile: AiProfile,
): ScoredAction {
  const best = sorted[0]!;
  if (sorted.length === 1 || profile.suboptimalChance <= 0) return best;

  // Never fumble a winning line.
  if (!Number.isFinite(best.utility) || best.utility >= 10_000) return best;

  const roll = nextFloat(state.rng);
  if (roll >= profile.suboptimalChance) return best;

  const alternatives = sorted.slice(1, 3);
  if (alternatives.length === 0) return best;
  return alternatives[nextInt(state.rng, alternatives.length)]!;
}
