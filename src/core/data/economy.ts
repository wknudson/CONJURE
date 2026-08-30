/**
 * What an attack costs, what a body generates, and how much a side earns a turn.
 *
 * Before this, attacking was free and unbounded: one move and one attack per body, no cap on
 * how many bodies acted, and `playCard` was the only thing in the whole codebase that debited
 * a Bone. A turn was ten-plus free unit actions against one or two card plays, so the deck was
 * a garnish on a turn that was already full.
 *
 * The shape now: **a swing costs a Bone, and a body that does not swing makes one.** Every turn
 * every body is a question — strike, or fund the strike somebody else makes.
 *
 * ### This reverses a shipped pillar, on purpose
 *
 * `docs/07_deck_building.md` states *"Pips buy magic, and only magic,"* and §0 of the combat
 * overhaul is titled **The Pip Tax**. Those docs predate this rename and still say "Pip"; the
 * quotes are left verbatim so the citation resolves. That was written about *bodies costing
 * Pips to summon* — a one-off purchase against a trickle, where "a 3-Pip ranged body is three
 * turns of the entire economy." This is a different shape: a **cycle**, where the warband
 * funds itself and the player allocates. The old complaint was that buying a board meant
 * casting nothing; here a board is what lets you cast at all.
 *
 * ### Why income scales with the warband
 *
 * With `A = 1` and a melee channel of `1`, the net for a side attacking with a fraction `f` of
 * `N` bodies is `income + N(1 - 2f)`. Army size cancels at `f = 0.5`, so a flat income would
 * already be size-neutral *at the margin* — but not at the edges, and the edges are where the
 * fights are. A three-body ambush on a 4x6 has no slack at all, and a nine-body line on an 8x8
 * has a turn-one bank of four against nine legal swings.
 *
 * Scaling the income by the bodies that could spend it fixes both ends and keeps the curve the
 * decision it is meant to be. On a six-body warband:
 *
 * | attacking with | net Bones/turn | reads as |
 * |---|---|---|
 * | half | **+3** | the intended line — funds a card and a half |
 * | three quarters | **0** | sustainable, and you cast nothing |
 * | everything | **-3** | a burst, paid for out of the bank |
 */

import type { CardDef } from '../types/cards.js';
import { rosterPointsOf } from './roster.js';

/** What one swing costs its commander. */
export const ATTACK_BONE_COST = 1;

/**
 * Bone income per turn, given how many bodies a side has standing.
 *
 * `2 + bodies/3` rather than a flat `1`. The third is what lets a large warband feed itself
 * without making it free — nine bodies earn five, against nine Bones to swing with all of them.
 *
 * **The floor is 2, and it was 1, and the difference is the endgame.** A fight that reaches one
 * body a side earns exactly one Bone and spends exactly one attacking with it, so it can never
 * bank, never cast, and never close. Measured, four shipped encounters stopped reaching a
 * decision at all — `fouled_cistern`, `tallow_blight`, `rimefield_break` and `the_summons` all
 * ground to a halt at **one body each** with both Pacts still up and wounds still landing one
 * every twenty turns. The economy collapsed exactly when throughput was needed to finish.
 *
 * **And the body count is capped at two steps**, so income runs 2 to 4 and no further. Uncapped,
 * it paid the side that was already winning: `glacial_field` reached fifteen enemy bodies
 * against the player's one, which printed the enemy seven Bones a turn to the player's two and
 * turned a lead into a rout. A horde should be unwieldy, not efficient — at the cap, fifteen
 * bodies still only fund four swings a turn.
 *
 * Deliberately counts **bodies, not points**: a Behemoth is six points and one swing, and
 * paying income on its price rather than its reach would make one big body the cheapest
 * economy in the game.
 */
/** Most the body count may add, on top of the floor. See the note above on runaway swarms. */
export const INCOME_FROM_BODIES_CAP = 2;

export function boneIncomeFor(bodies: number): number {
  return 2 + Math.min(INCOME_FROM_BODIES_CAP, Math.floor(Math.max(0, bodies) / 3));
}

/** What a body produces when it gives up its swing. */
export interface ChannelYield {
  /** Banked, and what pays for somebody else's attack. */
  readonly bones: number;
  /** Evaporates at end of turn. Unchanged from before: a strict cost Bones cannot cover. */
  readonly marrow: number;
  /** Cards drawn. The ranged classes answer a dead hand rather than a thin bank. */
  readonly draw: number;
  /** What the HUD calls it. One verb per class — see below. */
  readonly verb: string;
}

/**
 * What each class of body makes when it channels.
 *
 * Read off `rosterPointsOf` rather than re-deriving the class, so a body's price and what it
 * generates can never disagree — the same single-source rule the roster ladder was written
 * under.
 *
 * The verbs are not decoration. This decision repeats once per body per turn, five or nine
 * times over, and "channel" five times is bookkeeping where "brace, sight, focus" is a line.
 *
 * | | | |
 * |---|---|---|
 * | melee (2) | **+1 Bone** | the workhorse battery — cheap bodies are what you can afford to sit down |
 * | ranged (3) | **+1 card** | artillery feeds the hand, not the bank; the one class that answers a dead draw |
 * | elite (4) | **+2 Bones** | pays for itself, and is the reason to spend four points on one body |
 * | Behemoth (6) | **nothing** | too big to sit down. Six points buys violence, not accounting |
 */
export function channelYieldFor(def: CardDef): ChannelYield | null {
  switch (rosterPointsOf(def)) {
    case 2:
      return { bones: 1, marrow: 1, draw: 0, verb: 'Brace' };
    case 3:
      return { bones: 0, marrow: 1, draw: 1, verb: 'Sight' };
    case 4:
      return { bones: 2, marrow: 1, draw: 0, verb: 'Focus' };
    default:
      // A Behemoth, or something with no unit block at all. Neither can channel.
      return null;
  }
}
