/**
 * The Tailoring counter: gear, priced.
 *
 * Relics were the one thing in the game with no source. Every character was handed the
 * entire footlocker at creation as an explicit placeholder — the alternative at the time
 * being gear that existed and could never be worn — with a comment asking whoever gave
 * them a source to take that line away. This is that source.
 *
 * Priced by what the rule is worth rather than by slot. A relic that raises a ceiling and
 * a relic that removes a restriction are different kinds of purchase, and the ones that
 * change what is *legal* — the hand limit, the Resonance count, the reaction cap — cost
 * the most, because that is the axis the whole loadout system exists on.
 *
 * Data rather than markup, and DOM-free, so what the counter sells can be tested without
 * mounting a screen.
 */

import type { OverworldState, RelicSlot } from '../overworld/state.js';
import { RELICS, relicById, slotOf } from './relics.js';
import type { RelicDef } from './relics.js';

export interface GearStock {
  relicId: string;
  /** Ducats. */
  price: number;
  /** Why anyone would want it, in the counter's voice rather than the rules'. */
  pitch: string;
}

/**
 * What one relic costs.
 *
 * A flat table rather than a formula: a price is a balance decision, and a formula would
 * make it a consequence of one.
 */
export const GEAR_STOCK: readonly GearStock[] = [
  // ---------------------------------------------------------------- optics
  {
    relicId: 'relic_goggles',
    price: 180,
    pitch: 'Smoked glass, tight seal. The fog stops being an argument.',
  },
  {
    relicId: 'relic_monocle',
    price: 260,
    pitch: 'Ground for reading a room. You will know what they mean to do.',
  },
  {
    relicId: 'relic_splicer_goggles',
    price: 340,
    pitch: 'Ground for reading a seam. Every pressing comes off the bench cheaper.',
  },
  // ---------------------------------------------------------------- vestment
  {
    relicId: 'relic_coat',
    price: 150,
    pitch: 'Heavy, and it has been shot at before. Three plates of it.',
  },
  {
    relicId: 'relic_lead_coat',
    price: 300,
    pitch: 'Lined against the green. Nothing they brew will settle in you.',
  },
  // ---------------------------------------------------------------- trinket
  {
    relicId: 'relic_battery',
    price: 320,
    pitch: 'A wound cell that keeps winding. Bank one more than the rules allow.',
  },
  {
    relicId: 'relic_mortar',
    price: 200,
    pitch: 'Pestle worn to a curve. Whatever you raise, raise it sturdier.',
  },
  {
    relicId: 'relic_coin',
    price: 360,
    pitch: 'Worn smooth on one side. Hold nine cards where the table says seven.',
  },
  // ---------------------------------------------------------------- treads
  {
    relicId: 'relic_boots',
    price: 240,
    pitch: 'Bolted through at the ankle. Nothing moves your Companion but your Companion.',
  },
  // ---------------------------------------------------------------- will
  {
    relicId: 'relic_ledger',
    price: 220,
    pitch: 'Ruled in something that is not ink. Every offering pays a little more.',
  },
  {
    relicId: 'relic_gloves',
    price: 420,
    pitch: 'Stitched with something that remembers. Your passive fires twice.',
  },
];

/** The counter's stock for one slot, in the order it is listed. */
export function gearForSlot(slot: RelicSlot): GearStock[] {
  return GEAR_STOCK.filter((g) => slotOf(g.relicId) === slot);
}

/** What a relic sells for, or undefined if the counter does not carry it. */
export function gearPrice(relicId: string): number | undefined {
  return GEAR_STOCK.find((g) => g.relicId === relicId)?.price;
}

/** The relic behind a listing. Undefined only if the stock names something that is gone. */
export function gearRelic(stock: GearStock): RelicDef | undefined {
  return relicById(stock.relicId);
}

/** Why a piece of gear cannot be bought, in the player's words, or null if it can. */
export type GearRefusal = 'already-owned' | 'too-poor' | 'no-such-relic' | null;

export function gearRefusal(overworld: OverworldState, relicId: string): GearRefusal {
  if (!relicById(relicId)) return 'no-such-relic';
  if (overworld.relics.includes(relicId)) return 'already-owned';
  const price = gearPrice(relicId);
  if (price === undefined) return 'no-such-relic';
  if (overworld.economy.ducats < price) return 'too-poor';
  return null;
}

/**
 * Buys one piece of gear into the footlocker.
 *
 * Asks the refusal rather than trusting the button, like every other till in the game: a
 * stale render must not be able to spend. Returns whether anything was bought, so a caller
 * cannot charge for a purchase that did not happen.
 *
 * Deliberately does **not** equip it. Buying and wearing are separate decisions, and the
 * loadout is where the second one is made.
 */
export function buyGear(overworld: OverworldState, relicId: string): boolean {
  if (gearRefusal(overworld, relicId) !== null) return false;
  const price = gearPrice(relicId);
  if (price === undefined) return false;

  overworld.economy.ducats -= price;
  overworld.relics.push(relicId);
  return true;
}

/**
 * Every relic the counter can sell.
 *
 * A load-time guard rather than a test, so a relic added without a price cannot ship
 * unreachable — the exact failure this file exists to end.
 */
for (const id of Object.keys(RELICS)) {
  if (!GEAR_STOCK.some((g) => g.relicId === id)) {
    throw new Error(`relic ${id} has no price at the Tailoring counter`);
  }
}
