/**
 * How a card's price is written for the player.
 *
 * Marrow is a strict requirement rather than a discount, so it cannot simply be folded
 * into one number: `{ bones: 1, marrow: 2 }` and `{ bones: 3, marrow: 0 }` both total three
 * and are not remotely the same card. The badge shows the Marrow half only when there is
 * one, so the overwhelming majority of cards read exactly as they always did.
 */

import type { CardCost } from '../core/types/cards.js';

/** The cost badge: `3`, `1+2✦` when Marrow is also required, or `1✦` when only Marrow is. */
export function formatCost(cost: CardCost): string {
  if (cost.marrow <= 0) return `${cost.bones}`;
  // A card priced purely in Marrow would otherwise read `0+1✦`, and a leading zero looks
  // like a rendering fault rather than a price. Dropping it says the true thing more
  // plainly: this costs one Marrow, and no Bones enter into it.
  return cost.bones > 0 ? `${cost.bones}+${cost.marrow}✦` : `${cost.marrow}✦`;
}

/** Prose for a shortfall, naming which pool is missing. */
export function describeShortfall(cost: CardCost, bones: number, marrow: number): string | null {
  if (marrow < cost.marrow) {
    const short = cost.marrow - marrow;
    return `needs ${cost.marrow} Marrow and you have ${marrow} — extract ${short} more. Bones cannot cover it.`;
  }
  const generic = bones + (marrow - cost.marrow);
  if (generic < cost.bones) {
    return `costs ${cost.bones} — you are ${cost.bones - generic} short (${bones} Bones + ${marrow} Marrow)`;
  }
  return null;
}
