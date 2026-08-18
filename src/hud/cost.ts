/**
 * How a card's price is written for the player.
 *
 * Marrow is a strict requirement rather than a discount, so it cannot simply be folded
 * into one number: `{ pips: 1, marrow: 2 }` and `{ pips: 3, marrow: 0 }` both total three
 * and are not remotely the same card. The badge shows the Marrow half only when there is
 * one, so the overwhelming majority of cards read exactly as they always did.
 */

import type { CardCost } from '../core/types/cards.js';

/** The cost badge: `3`, or `1+2✦` when Marrow is strictly required. */
export function formatCost(cost: CardCost): string {
  return cost.marrow > 0 ? `${cost.pips}+${cost.marrow}✦` : `${cost.pips}`;
}

/** Prose for a shortfall, naming which pool is missing. */
export function describeShortfall(cost: CardCost, pips: number, marrow: number): string | null {
  if (marrow < cost.marrow) {
    const short = cost.marrow - marrow;
    return `needs ${cost.marrow} Marrow and you have ${marrow} — extract ${short} more. Pips cannot cover it.`;
  }
  const generic = pips + (marrow - cost.marrow);
  if (generic < cost.pips) {
    return `costs ${cost.pips} — you are ${cost.pips - generic} short (${pips} Pips + ${marrow} Marrow)`;
  }
  return null;
}
