/**
 * The 25% seal, in one place.
 *
 * A boss opts into the Rite of Subjugation by calling `beginSubjugation` from its own
 * script — the engine names no species and picks no threshold, deliberately, so that which
 * beast can be bound and *when* stays a property of the encounter. That left every
 * encounter restating the same four lines, and by the time the campaign shipped there were
 * three verbatim copies of them: `ignis.trial.ts` wrote it, `campaign.master.ts` copied it
 * for eight fights, and `the.summons.ts` copied it again for the throne room.
 *
 * Three copies of a rule is two too many when a fourth was about to be written for every
 * wild hunt. The threshold is a game-wide constant — a quarter strength is what "cornered"
 * means in this game — and the encounters that differ from it can still not call this.
 *
 * `beginSubjugation` is idempotent, so calling this from both `onTurnStart` and
 * `onCommanderHpChanged` is the intended usage rather than a belt-and-braces habit: the
 * first catches a boss brought under the line by a status tick, the second by a blow.
 */

import type { Ctx } from '../../engine/context.js';
import { beginSubjugation } from '../../engine/subjugation.js';

/** The share of a commander's health at which the wild magic seals it. */
export const SEAL_THRESHOLD = 0.25;

/**
 * Seals the enemy commander once it is at or under a quarter of its ceiling.
 *
 * Does nothing to a dead commander — a corpse cannot be bound, and the Rite dealt to a
 * fight that is already decided would put a card in a hand nobody will play.
 */
export function sealAt25(ctx: Ctx): void {
  const cmd = ctx.state.players.enemy;
  if (cmd.hp <= 0) return;
  if (cmd.hp > Math.floor(cmd.maxHp * SEAL_THRESHOLD)) return;
  beginSubjugation(ctx);
}

/**
 * The whole script a plain subjugation fight needs.
 *
 * Most beasts want exactly this and nothing else: watch the health, seal at a quarter. A
 * boss with phases builds its own script and calls `sealAt25` from inside it, which is what
 * the master-tier encounters do.
 */
export const SEAL_ONLY_SCRIPT = {
  onTurnStart(ctx: Ctx, side: 'player' | 'enemy'): void {
    if (side === 'enemy') sealAt25(ctx);
  },
  onCommanderHpChanged(ctx: Ctx, side: 'player' | 'enemy'): void {
    if (side === 'enemy') sealAt25(ctx);
  },
};
