/**
 * The Apothecary's stock.
 *
 * Data rather than markup, for the same reason cards are: a price is a balance decision,
 * and balance decisions should be readable in one file instead of buried in a template
 * string. The shop screen renders this list and knows nothing else about it.
 *
 * Deliberately DOM-free and beside the rest of `src/core/data/`, so what the shop sells
 * can be tested without mounting a screen.
 */

import type { BuffId, Consumable, OverworldState } from '../overworld/state.js';
import type { CombatBoons } from '../engine/setup.js';
import { BUFF_EFFECTS } from '../overworld/run.js';
import { unscaleStat } from '../scale.js';

export interface StockItem {
  item: Consumable;
  /** Ducats. */
  price: number;
  /** The flavour line. What it *does* is derived, not written twice — see `effectOf`. */
  blurb: string;
}

/**
 * Three things, always the same three.
 *
 * A rotating stock would make the Apothecary a slot machine; a fixed shelf makes it a
 * budgeting decision, which is the one this screen is for.
 */
export const APOTHECARY_STOCK: readonly StockItem[] = [
  {
    item: { id: 'mending_tonic', name: 'Mending Tonic', type: 'healing', value: 120 },
    price: 25,
    blurb: 'Bitter, and it seals the smaller tears. Drunk here, not out there.',
  },
  {
    item: { id: 'ironbrew', name: 'Ironbrew', type: 'buff', value: 0 },
    price: 45,
    blurb: 'Filings suspended in tallow. The first blow lands on the brew, not on you.',
  },
  {
    item: { id: 'kinetic_capacitor', name: 'Kinetic Capacitor', type: 'buff', value: 0 },
    price: 45,
    blurb: 'A wound brass flywheel, still turning. Opens the ledger with more to spend.',
  },
];

/**
 * Ducats per **ten** points of health at the Clinic.
 *
 * Priced above a Mending Tonic per point on purpose: the Clinic is the expensive way to
 * get well, and buying tonics ahead of time is meant to be the thrifty one. It exists so
 * that waking at 10 health after a rescue is a bill rather than a dead end.
 *
 * Per ten rather than per point because health stretched and Ducats did not. Left as a
 * per-point rate this would have multiplied every Clinic bill by ten overnight and made
 * the one recovery a broke player can afford the most expensive thing in the game.
 */
export const CLINIC_RATE = 3;

/** What it would cost to walk out of the Clinic whole. Zero when already whole. */
export function clinicPrice(overworld: OverworldState): number {
  const missing = Math.max(0, overworld.pact.maxHp - overworld.pact.currentHp);
  // Rounded up, so a wound too small to be worth a full band still costs something.
  return unscaleStat(missing) * CLINIC_RATE;
}

/**
 * What an item actually does, in the fight's own terms.
 *
 * Buff text is read out of `BUFF_EFFECTS` rather than written on the shelf, so the price
 * tag and the fight can never disagree about what was bought. The same anti-drift rule
 * the pre-combat weather line follows.
 */
export function effectOf(stock: StockItem): string {
  if (stock.item.type === 'healing') return `Restores ${stock.item.value} Pact health.`;
  const boons = BUFF_EFFECTS[stock.item.id as BuffId];
  return boons ? `Next fight: ${describeBoons(boons)}` : 'No effect.';
}

/** The boon table as a sentence. Every field is optional, so an empty one reads honestly. */
export function describeBoons(boons: CombatBoons): string {
  const parts: string[] = [];
  if (boons.armor) parts.push(`open with ${boons.armor} Armor`);
  if (boons.pips) parts.push(`+${boons.pips} Pips`);
  if (boons.extraOpeningCards) parts.push(`+${boons.extraOpeningCards} opening cards`);
  return parts.length > 0 ? `${parts.join(', ')}.` : 'nothing at all.';
}
