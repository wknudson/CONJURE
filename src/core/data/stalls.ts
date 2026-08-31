/**
 * Street trade: the stalls people actually keep.
 *
 * `docs/worldbuild-todo.md` Wave 6: *"The Bonemarket's six traders, Fenwick's innkeeper and
 * brewer | they talk; nothing is bought | shops. Every trade in the game is still a door in
 * Ashfall, so a market with traders who do not trade is set dressing that argues with itself."*
 *
 * ## What they sell, and why it is not what the Apothecary sells
 *
 * Cores. Reagents were the one currency in the game with **exactly one source** — a won contract
 * — and no way to convert between the six schools, so a player holding three Pyre cores and
 * needing a Frost one for a splice had nothing to do but keep fighting and hope. That is not a
 * shortage, it is a dice roll standing where a decision should be.
 *
 * And they sell it **where the ground makes it.** The Cinderworks deals in Pyre because it is a
 * foundry; Saltglass deals in Frost because it is a salt flat; Millharrow deals in Bloom because
 * it is farmland. One school each, cheap. The Bonemarket alchemist deals in all six and charges
 * for the privilege, which is what a market *is*.
 *
 * That turns the map into the price list. Converting a surplus Pyre into a Frost costs about
 * ninety Ducats if you do it over the counter at the Bonemarket, or about fifty-five if you are
 * willing to walk to the Cinderworks and then out to the pans. A walkable world should pay for
 * being walked, and until now nothing in it did.
 *
 * The brews are the second, smaller half and answer the doc's row directly: Fenwick's innkeeper
 * and the two brewers stock what the Apothecary stocks, dearer, four crossings from Ashfall.
 * Nobody walks back to the ward for a tonic; the point is that you no longer have to.
 *
 * Data and rules, DOM-free, on the same terms as `outfitter.ts` next door — which is the model
 * this follows exactly: a stock table, a refusal, and a mutation.
 */

import type { OverworldState } from '../overworld/state.js';
import { addConsumable, INVENTORY_LIMIT } from '../overworld/state.js';
import { REAGENTS, reagentById } from './splicing.js';
import { APOTHECARY_STOCK } from './apothecary.js';

/**
 * What a Core is worth at the place that makes it.
 *
 * Anchored to what a contract pays rather than picked: an Adept contract pays 85 Ducats and one
 * Core, so a Core bought at the source costs about an Adept contract's pay. Buying one is a
 * afternoon's work, which is the right weight — it should be a decision to buy one and never a
 * way to skip the game.
 */
export const CORE_BASE = 90;

export type StallGoods = 'cores' | 'brews';

export interface StallDef {
  /** Who keeps it, as `${areaId}:${npcId}` — the same address an errand's giver uses. */
  readonly keeper: string;
  readonly name: string;
  /** One line, in their voice, shown at the head of the stall. */
  readonly line: string;
  readonly goods: StallGoods;
  /**
   * Which Cores this stall deals in. Ignored for a brew stall.
   *
   * One school where the ground makes it, all six at the market. An empty list would be a stall
   * with nothing on it, and a test refuses one.
   */
  readonly cores?: readonly string[];
  /** What they charge, against `CORE_BASE`. Above 1 is a mark-up. */
  readonly buyRate: number;
  /**
   * What they pay you, against `CORE_BASE`.
   *
   * Always well under `buyRate`, and a test says so: a stall where you could buy and sell at the
   * same price is a stall you can stand in front of and print money at.
   */
  readonly sellRate: number;
}

/* ------------------------------------------------------------------------------------ *
 * Who keeps a stall.
 *
 * Written to the rule the errands follow: the stall names its keeper, so no area file changes
 * and a townsperson does not grow a field. Which school a place deals in is a reading of what
 * the ground there actually is — the atlas does the deciding, not the balance.
 * ------------------------------------------------------------------------------------ */

export const STALLS: readonly StallDef[] = [
  /* --- the market: everything, dearer -------------------------------------------------- */
  {
    keeper: 'bonemarket:bonemarket_alchemist',
    name: 'The Bonemarket Core Row',
    line: 'Six schools on one bench. You will not find that anywhere else, and you will pay me for it.',
    goods: 'cores',
    cores: REAGENTS.map((r) => r.id),
    // The convenience premium, and the whole reason the specialists below are worth a walk.
    buyRate: 1.62,
    sellRate: 0.66,
  },

  /* --- the sources: one school each, cheap --------------------------------------------- */
  {
    keeper: 'cinderworks:cinderworks_glassblower',
    name: 'The Cinderworks Draw-Bench',
    line: 'Everything I pull comes out of that furnace still ticking. Pyre, and nothing but.',
    goods: 'cores',
    cores: ['core_pyre'],
    buyRate: 1,
    sellRate: 0.4,
  },
  {
    keeper: 'saltglass:saltglass_panwife',
    name: 'The Saltglass Pans',
    line: 'Worked before dawn, off the flats. Cold comes out of this ground whether anybody wants it or not.',
    goods: 'cores',
    cores: ['core_frost'],
    buyRate: 1,
    sellRate: 0.4,
  },
  {
    keeper: 'millharrow:millharrow_farmer_wife',
    name: 'The Millharrow Cart Way',
    line: 'Green things. It is a crossroads in farm country — what else were you expecting.',
    goods: 'cores',
    cores: ['core_bloom'],
    buyRate: 1,
    sellRate: 0.4,
  },
  {
    keeper: 'lamprow:lamprow_urchin',
    name: 'Under the Kerb',
    line: 'I do not ask where it came off and you do not ask where I got it. Surge, if you want it.',
    goods: 'cores',
    cores: ['core_surge'],
    // Cheaper than a proper counter and pays worse, because it is a boy under a kerb with a
    // pocket and no ledger. The one stall in the world that is not a business.
    buyRate: 0.88,
    sellRate: 0.3,
  },
  {
    keeper: 'tallow_levels:tallow_tanner',
    name: 'The Tallow Rendering Yard',
    line: 'Rendering country. What settles at the bottom of the vats is worth more than the hides.',
    goods: 'cores',
    cores: ['core_dusk'],
    buyRate: 1,
    sellRate: 0.4,
  },
  {
    keeper: 'brays_hollow:brays_weaver',
    name: "Bray's Hollow Rim",
    line: 'Quarried out of the rim, before the hedges took it back. Bulwark. Heavy, and it keeps.',
    goods: 'cores',
    cores: ['core_bulwark'],
    buyRate: 1,
    sellRate: 0.4,
  },

  /* --- brews, out where the ward is a long way off ------------------------------------- */
  {
    keeper: 'fenwicks_crossing:fenwick_innkeeper',
    name: "The Fenwick's Crossing Inn",
    line: 'Everything an Apothecary keeps, at what it costs to have it carted out here. Nobody haggles twice.',
    goods: 'brews',
    buyRate: 1.5,
    sellRate: 0,
  },
  {
    keeper: 'millharrow:millharrow_brewer',
    name: 'The Millharrow Brewhouse',
    line: 'I brew for the harvest and I brew for whatever you are about to walk into. Same barrel.',
    goods: 'brews',
    buyRate: 1.35,
    sellRate: 0,
  },
  {
    keeper: 'ward_seven:ward_seven_apothecary',
    name: 'The Ward Seven Bench',
    line: 'Boil it first. I have said that to everyone who has ever bought anything from me.',
    goods: 'brews',
    // Barely a mark-up: Ward Seven is one crossing from Ashfall and the healer has nothing.
    buyRate: 1.1,
    sellRate: 0,
  },
];

export function stallFor(areaId: string, npcId: string): StallDef | undefined {
  return STALLS.find((s) => s.keeper === `${areaId}:${npcId}`);
}

/** What one Core costs here, and what this stall will pay for one. Rounded to whole Ducats. */
export function corePrice(stall: StallDef, coreId: string): { buy: number; sell: number } | null {
  if (stall.goods !== 'cores' || !(stall.cores ?? []).includes(coreId)) return null;
  if (!reagentById(coreId)) return null;
  return {
    buy: Math.round(CORE_BASE * stall.buyRate),
    sell: Math.round(CORE_BASE * stall.sellRate),
  };
}

/** What a brew costs here, against the Apothecary's own shelf price. */
export function brewPrice(stall: StallDef, itemId: string): number | null {
  if (stall.goods !== 'brews') return null;
  const shelf = APOTHECARY_STOCK.find((s) => s.item.id === itemId);
  return shelf ? Math.round(shelf.price * stall.buyRate) : null;
}

/** Everything this stall has on it, as ids. Cores or brews, never both. */
export function stallStock(stall: StallDef): readonly string[] {
  return stall.goods === 'cores'
    ? (stall.cores ?? [])
    : APOTHECARY_STOCK.map((s) => s.item.id);
}

export type TradeRefusal = 'too-poor' | 'none-to-sell' | 'satchel-full' | 'not-stocked' | null;

export function buyRefusal(
  overworld: OverworldState,
  stall: StallDef,
  id: string,
): TradeRefusal {
  if (stall.goods === 'cores') {
    const price = corePrice(stall, id);
    if (!price) return 'not-stocked';
    return overworld.economy.ducats < price.buy ? 'too-poor' : null;
  }
  const price = brewPrice(stall, id);
  if (price === null) return 'not-stocked';
  if (overworld.economy.ducats < price) return 'too-poor';
  // Checked before the money moves rather than after. `addConsumable` refuses a full satchel
  // by returning false, and a purchase that took the Ducats and then declined to hand the brew
  // over is the one failure here that a player would rightly call theft.
  return overworld.inventory.length >= INVENTORY_LIMIT ? 'satchel-full' : null;
}

export function sellRefusal(overworld: OverworldState, stall: StallDef, id: string): TradeRefusal {
  const price = corePrice(stall, id);
  if (!price || price.sell <= 0) return 'not-stocked';
  return (overworld.economy.reagents[id] ?? 0) > 0 ? null : 'none-to-sell';
}

/** Takes the money and hands the thing over, or does neither. Returns whether it went through. */
export function buyAt(overworld: OverworldState, stall: StallDef, id: string): boolean {
  if (buyRefusal(overworld, stall, id) !== null) return false;

  if (stall.goods === 'cores') {
    overworld.economy.ducats -= corePrice(stall, id)!.buy;
    overworld.economy.reagents[id] = (overworld.economy.reagents[id] ?? 0) + 1;
    return true;
  }

  const shelf = APOTHECARY_STOCK.find((s) => s.item.id === id)!;
  // The item is handed over *first*, so a satchel that filled between the check and here costs
  // the player nothing. `addConsumable` is the authority on whether there is room.
  if (!addConsumable(overworld, { ...shelf.item })) return false;
  overworld.economy.ducats -= brewPrice(stall, id)!;
  return true;
}

/** Sells one Core into the stall. Cores only: nobody buys a half-drunk tonic back. */
export function sellAt(overworld: OverworldState, stall: StallDef, id: string): boolean {
  if (sellRefusal(overworld, stall, id) !== null) return false;
  const reagents = overworld.economy.reagents;
  reagents[id] = (reagents[id] ?? 0) - 1;
  // Deleted at zero, the way `splice.ts` and `forge.ts` both do it, so the purse never grows a
  // key per Core the player has ever briefly owned.
  if (reagents[id]! <= 0) delete reagents[id];
  overworld.economy.ducats += corePrice(stall, id)!.sell;
  return true;
}
