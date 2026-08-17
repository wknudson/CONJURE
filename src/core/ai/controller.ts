/**
 * The AI turn loop: enumerate -> simulate -> score -> pick, one action at a time, until
 * nothing is worth doing or the action cap is reached.
 *
 * Two tiers, per Module 5 §3:
 *
 *   Novice  greedy, current action only. Cheap, and visibly imperfect — it will move a
 *           unit out of range before remembering it could have swung first.
 *   Adept   one-action lookahead. Values a candidate by what it *enables*, not only by
 *           what it does, which is precisely what fixes the ordering weakness above.
 *
 * Failsafes: a per-turn action cap, deterministic tie-breaking (never RNG), the Lethal
 * Veto in score.ts, and a simulation budget that degrades Adept to greedy rather than
 * letting a turn hang.
 */

import type { Side } from '../../contract/ids.js';
import type { GameState } from '../types/state.js';
import type { Command } from '../types/commands.js';
import { enumerateActions } from './enumerate.js';
import {
  ADEPT_WEIGHTS,
  NOVICE_WEIGHTS,
  scoreAction,
  type ScoredAction,
  type UtilityWeights,
} from './score.js';
import { nextFloat, nextInt } from '../util/rng.js';

export interface AiProfile {
  name: string;
  weights: UtilityWeights;
  /** Chance of deliberately choosing the 2nd or 3rd best action. */
  suboptimalChance: number;
  actionCap: number;
  /** Actions scoring at or below this are not worth taking. */
  passThreshold: number;
  /** Follow-up actions considered when valuing a candidate. 0 = pure greedy. */
  lookahead: 0 | 1;
  /** Candidates expanded during lookahead. Wider is better and costlier. */
  beamWidth: number;
  /** Weight given to what an action enables, relative to what it does. */
  lookaheadDiscount: number;
  /** How many further actions the rollout plays out when valuing an opener. */
  rolloutDepth: number;
  /**
   * Ceiling on simulated actions per turn, and the *only* limit that shapes play. Module 5
   * states 150 iterations; that reads as per decision, so the per-turn budget is a
   * multiple of it. Reaching it drops the rest of the turn to greedy.
   *
   * Tuned so a turn lands inside Module 5's 1.2s thinking cap on typical hardware, and
   * degrades in quality rather than in time on slower machines.
   */
  simulationBudget: number;
  /**
   * Last-resort anti-hang cutoff. Far above the simulation budget so it never fires in
   * normal play — reaching it means abandoning determinism to avoid freezing the tab.
   */
  hangGuardMs: number;
  /**
   * How much of its turn this tier commits to in advance.
   *
   * `all` shows attacks and card plays — the teaching tier, where total clarity is the
   * point. `attacks` shows only the blows, keeping what it is holding to itself, so
   * difficulty scales along information as well as skill.
   */
  telegraph: 'all' | 'attacks';
}

export const NOVICE_AI: AiProfile = {
  name: 'Novice',
  weights: NOVICE_WEIGHTS,
  suboptimalChance: 0.2,
  actionCap: 8,
  passThreshold: 0,
  lookahead: 0,
  beamWidth: 1,
  lookaheadDiscount: 0,
  rolloutDepth: 0,
  simulationBudget: 400,
  hangGuardMs: 8000,
  telegraph: 'all',
};

export const ADEPT_AI: AiProfile = {
  name: 'Adept',
  // Collision awareness is the other half of Module 5's Adept tier: unlike a Novice it
  // will deliberately shove a unit into a wall.
  weights: ADEPT_WEIGHTS,
  suboptimalChance: 0.05,
  actionCap: 8,
  passThreshold: 0,
  lookahead: 1,
  beamWidth: 4,
  lookaheadDiscount: 0.9,
  rolloutDepth: 3,
  // Tuned against measured play: 1600 buys the full strength gain over Novice, while
  // 2200 costs noticeably more thinking time for no additional wins.
  simulationBudget: 1600,
  hangGuardMs: 8000,
  telegraph: 'attacks',
};

export const AI_PROFILES: AiProfile[] = [NOVICE_AI, ADEPT_AI];

export function profileByName(name: string): AiProfile | undefined {
  return AI_PROFILES.find((p) => p.name.toLowerCase() === name.toLowerCase());
}

/**
 * Tracks how much thinking a turn has spent, so it degrades before it stalls.
 *
 * **The simulation count is the binding constraint, and deliberately so.** An earlier
 * version let the wall clock decide, which made the AI's choices depend on how busy the
 * machine was: the same seed produced different games, and the replay harness caught it
 * immediately. Anything that changes a decision has to be deterministic.
 *
 * The clock survives only as an anti-hang backstop, set far enough out that ordinary play
 * never reaches it. If it ever does fire, determinism is knowingly traded away to avoid
 * freezing the tab — the right call, but the reason it is not the primary limit.
 */
class Budget {
  private sims = 0;
  private latched = false;
  private readonly startedAt = Date.now();

  constructor(private readonly profile: AiProfile) {}

  spend(n = 1): void {
    this.sims += n;
  }

  get exhausted(): boolean {
    if (this.latched) return true;

    if (this.sims >= this.profile.simulationBudget) {
      this.latched = true;
      return true;
    }

    if (Date.now() - this.startedAt > this.profile.hangGuardMs) {
      this.latched = true;
      return true;
    }

    return false;
  }
}

/**
 * Plans a full turn and returns the command list. The caller replays these through the
 * real engine so the UI receives a normal event stream.
 */
export function planTurn(state: GameState, side: Side, profile: AiProfile = NOVICE_AI): Command[] {
  const commands: Command[] = [];
  const budget = new Budget(profile);
  let current = state;

  for (let i = 0; i < profile.actionCap; i++) {
    if (current.result) break;

    const candidates = scoreAll(current, side, profile, budget);
    if (candidates.length === 0) break;

    candidates.sort((a, b) => compareActions(a, b, current));

    // Lookahead re-ranks the leaders by what each one leaves available. Skipped once the
    // budget is gone, which turns the remainder of the turn into a greedy plan.
    const ranked =
      profile.lookahead > 0 && !budget.exhausted
        ? withLookahead(current, side, candidates, profile, budget)
        : candidates;

    const chosen = pickWithSuboptimality(current, ranked, profile);
    commands.push(chosen.command);
    current = chosen.next;
  }

  // Only pass the turn if the game is still running — the engine rejects any command
  // issued after a result is decided.
  if (!current.result) commands.push({ type: 'endTurn' });
  return commands;
}

function scoreAll(
  state: GameState,
  side: Side,
  profile: AiProfile,
  budget: Budget,
): ScoredAction[] {
  const actions = enumerateActions(state, side);
  const out: ScoredAction[] = [];

  for (const command of actions) {
    // Checked inside the loop: a single enumeration on a large board can be a hundred
    // simulations, which is enough to overrun the whole turn's budget on its own.
    if (budget.exhausted) break;
    budget.spend();

    const scored = scoreAction(state, side, command, profile.weights);
    if (!scored) continue;
    if (!Number.isFinite(scored.utility) || scored.utility <= profile.passThreshold) continue;
    out.push(scored);
  }

  return out;
}

/**
 * One-action lookahead.
 *
 * A candidate is re-valued as `its own utility + discount × the best thing it leaves
 * available`. That single change is what makes a unit swing before it withdraws: moving
 * first scores well on its own but leaves nothing, while attacking first scores modestly
 * and still leaves the move.
 *
 * A winning line is never re-ranked — no amount of follow-up beats taking the game.
 */
function withLookahead(
  state: GameState,
  side: Side,
  candidates: ScoredAction[],
  profile: AiProfile,
  budget: Budget,
): ScoredAction[] {
  const leaders = beamFor(candidates, profile.beamWidth);
  if (leaders.length <= 1) return candidates;
  if (leaders.some((c) => c.utility >= 10_000)) return candidates;

  const rescored = leaders.map((candidate) => {
    if (candidate.next.result || budget.exhausted) {
      return { candidate, value: candidate.utility };
    }

    // Value of the whole turn that starts with this action, not of the action plus its
    // single best sequel. Adding a sequel's score to the opener double-counts it — that
    // sequel gets taken on the next iteration anyway — and rewards actions that leave
    // *many* options over actions that leave *good* ones.
    const rest = rolloutValue(candidate.next, side, profile, budget, profile.rolloutDepth);
    return { candidate, value: candidate.utility + profile.lookaheadDiscount * rest };
  });

  rescored.sort((a, b) => {
    if (a.value !== b.value) return b.value - a.value;
    // Fall back to the same deterministic tie-break the greedy path uses.
    return compareActions(a.candidate, b.candidate, state);
  });

  // The re-ranked leaders, then everything else in its original order.
  const promoted = rescored.map((r) => r.candidate);
  const seen = new Set(promoted);
  return [...promoted, ...candidates.filter((c) => !seen.has(c))];
}

/**
 * Total utility of continuing this turn greedily for a few more actions.
 *
 * A cheap stand-in for "how good is the turn this opener leads to". Greedy inside the
 * rollout is fine: the question is which *first* action to commit to, and a consistent
 * continuation policy is enough to rank them.
 */
function rolloutValue(
  state: GameState,
  side: Side,
  profile: AiProfile,
  budget: Budget,
  depth: number,
): number {
  let total = 0;
  let current = state;

  for (let i = 0; i < depth; i++) {
    if (current.result || budget.exhausted) break;
    const options = scoreAll(current, side, profile, budget);
    if (options.length === 0) break;

    const best = options.reduce((a, b) => (b.utility > a.utility ? b : a));
    total += best.utility;
    current = best.next;
  }

  return total;
}

/**
 * Picks which candidates are worth looking ahead from.
 *
 * Taking the top N by greedy score alone defeats the entire purpose: the actions
 * lookahead exists to rescue are precisely the ones that score badly on their own. A free
 * attack worth 4 never enters a beam full of advances worth 9, so it never gets the
 * chance to show that it costs nothing and leaves the move intact.
 *
 * So the beam is the top N *plus* the best of every command type, which guarantees the
 * comparison that matters actually happens.
 */
function beamFor(candidates: ScoredAction[], width: number): ScoredAction[] {
  const beam = candidates.slice(0, width);
  const included = new Set(beam);

  const kinds = new Set(candidates.map((c) => c.command.type));
  for (const kind of kinds) {
    const best = candidates.find((c) => c.command.type === kind);
    if (best && !included.has(best)) {
      included.add(best);
      beam.push(best);
    }
  }

  return beam;
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
    case 'channel': {
      const u = state.units[command.unit];
      return { x: u?.anchor.x ?? 0, y: u?.anchor.y ?? 0, tag: `channel:${command.unit}` };
    }
    case 'attackTile':
      return { x: command.at.x, y: command.at.y, tag: `whiff:${command.attacker}` };
    case 'declareIntents':
      return { x: 0, y: 0, tag: 'declare' };
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
