/**
 * Projected incoming damage: what the Pact will actually lose, not what was declared.
 *
 * The declared figure alone under-reports, and it does so in the direction that erodes
 * trust — the player is promised 3 and takes 4. Two reasons, and neither is a status tick:
 *
 *   1. **Escalation.** An intent records the attacker's ATK at the moment it was declared,
 *      but Growth fires at the start of the enemy's turn, *before* the blow lands. A
 *      unit that grows between the promise and the swing hits for more than it said.
 *   2. **Commander damage-over-time.** Burn and Toxin live on units in this engine, never
 *      on a Commander, so today this contributes nothing. It is computed anyway so that
 *      the readout stays correct the day a card puts a status on a portrait, rather than
 *      quietly under-reporting again.
 *
 * This is a client-side forecast over state the engine already exposes. Nothing here
 * mutates anything, and the engine has no idea it exists.
 *
 * It is deliberately an **upper bound**: it assumes every declared blow lands, so an
 * attacker that dies before it swings makes the figure read high. That is the safe
 * direction to be wrong in — a player who is told 7 and takes 6 is never caught out,
 * whereas one told 3 who takes 4 learns to distrust the number entirely.
 */

import type { BoardView } from '../contract/query.js';
import { STAT_SCALE } from '../core/scale.js';

export interface ProjectedDamage {
  /** Everything the Pact is expected to lose before the player acts again. */
  total: number;
  /** From declared attacks, at the value they will actually strike for. */
  fromAttacks: number;
  /** Extra beyond the declared figure, because attackers will grow first. */
  fromEscalation: number;
  /** Recurring damage on the Commander itself. Zero unless the rules gain such a thing. */
  fromStatuses: number;
}

/**
 * What one stack of Burn or Toxin costs a turn. Both tick at the stat scale; the engine's
 * table is not exported and both of its rows say the same number.
 */
const TICK_PER_STACK = STAT_SCALE;

export function calculateProjectedDamage(board: BoardView): ProjectedDamage {
  let fromAttacks = 0;
  let fromEscalation = 0;

  for (const intent of board.intents) {
    // A blow aimed at the Bound Form is a blow aimed at the Pact: its damage is
    // redirected there, so the readout has to count it exactly like a portrait attack.
    // Without this, the on-grid route to the Pact would be entirely invisible.
    const atBoundForm = intent.kind === 'attack' && intent.at !== undefined
      ? boundFormAt(board, intent.at)
      : false;
    if (intent.kind !== 'commander' && !atBoundForm) continue;
    fromAttacks += intent.damage;

    // Will this attacker be bigger by the time it swings? The view says how it grows —
    // its own step and its own ceiling, read off its stat block — so the forecast adds
    // what the engine will actually add. This used to be a constant of one for every
    // grower, against an engine that grows bodies by ten: ten short for the ones that
    // grow, one too many for the ones whose block grows in health alone. A keyword the
    // view has not put numbers to earns nothing rather than a guess.
    const unit = board.units.find((u) => u.id === intent.unitId);
    if (!unit?.growth) continue;

    // A unit already at its ceiling has nothing more to gain, so its declared figure
    // stands. The cap is the body's own, not the school default — the day a card grows
    // further than its kind, the readout follows it.
    if (unit.escalation >= unit.growth.cap) continue;

    fromEscalation += unit.growth.step;
  }

  const fromStatuses = commanderTickDamage(board);

  return {
    total: fromAttacks + fromEscalation + fromStatuses,
    fromAttacks,
    fromEscalation,
    fromStatuses,
  };
}

/** Whether the player's Bound Form occupies the given tile, footprint included. */
function boundFormAt(board: BoardView, at: { x: number; y: number }): boolean {
  for (const u of board.units) {
    if (u.side !== 'player') continue;
    if (!u.keywords.includes('BoundForm')) continue;
    const span = u.footprint;
    if (at.x >= u.anchor.x && at.x < u.anchor.x + span && at.y >= u.anchor.y && at.y < u.anchor.y + span) {
      return true;
    }
  }
  return false;
}

/**
 * Recurring damage sitting on the Commander.
 *
 * Statuses are tracked per unit and a Commander is not a unit, so this is zero today.
 * Kept as the seam it will need: the alternative is discovering the readout has started
 * lying again the first time something applies Burn to a portrait.
 */
function commanderTickDamage(board: BoardView): number {
  const onCommander = board.statuses.filter((s) => s.unitId === 'player');
  // Per stack at the stat scale, as `tickStatus` pays it — the seam this function exists
  // to keep honest was itself a factor of ten short.
  return onCommander
    .filter((s) => s.kind === 'burn' || s.kind === 'toxin')
    .reduce((sum, s) => sum + s.stacks * TICK_PER_STACK, 0);
}

/** One line for the HUD, itemised when there is more than one source. */
export function describeProjected(p: ProjectedDamage): string {
  if (p.total <= 0) return '';

  const parts: string[] = [];
  if (p.fromAttacks > 0) parts.push(`${p.fromAttacks} attack`);
  if (p.fromEscalation > 0) parts.push(`${p.fromEscalation} escalation`);
  if (p.fromStatuses > 0) parts.push(`${p.fromStatuses} status`);

  return parts.length > 1
    ? `Incoming: ${p.total} damage (${parts.join(', ')})`
    : `Incoming: ${p.total} damage`;
}
