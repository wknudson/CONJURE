/**
 * Street trade, and the one thing a shop must never be: a machine that prints money.
 *
 * Everything else here is the same class of check the errands get — a stall names a townsperson
 * who is a string in an area file, and a Core id that is a string in another one, and neither
 * crossing is checked by a compiler. A typo is a stall nobody can ever open.
 *
 * The interesting tests are the two about the *spread*. A stall that pays as much for a Core as
 * it charges is somewhere a player stands and clicks until they are rich, and it would look
 * completely correct in review: two numbers, both plausible, in a table of two-number rows. The
 * same is true across stalls — the market pays 0.66 and the Cinderworks charges 1.0, so a Pyre
 * core bought at the works and sold at the market would be a 30-Ducat profit per round trip and
 * an afternoon's walking would break the economy. That one is only visible if you compare every
 * stall against every other, which is exactly what a person will not do and a loop will.
 */

import { describe, expect, it } from 'vitest';
import {
  CORE_BASE,
  STALLS,
  brewPrice,
  buyAt,
  buyRefusal,
  corePrice,
  sellAt,
  sellRefusal,
  stallFor,
  stallStock,
} from '../core/data/stalls.js';
import { REAGENTS } from '../core/data/splicing.js';
import { APOTHECARY_STOCK } from '../core/data/apothecary.js';
import { AREAS } from '../district/areas/index.js';
import { INVENTORY_LIMIT, newRun } from '../core/overworld/state.js';
import type { OverworldState } from '../core/overworld/state.js';

const CAST = new Set(AREAS.flatMap((a) => (a.props.npcs ?? []).map((n) => `${a.id}:${n.id}`)));
const CORE_IDS = new Set(REAGENTS.map((r) => r.id));

function purse(ducats: number, reagents: Record<string, number> = {}): OverworldState {
  const o = newRun(1);
  o.economy.ducats = ducats;
  o.economy.reagents = { ...reagents };
  return o;
}

describe('every stall is kept by somebody who is standing there', () => {
  it('names a real townsperson', () => {
    for (const s of STALLS) {
      expect(CAST.has(s.keeper), `${s.name}: nobody called ${s.keeper}`).toBe(true);
    }
  });

  it('is kept by somebody the screen will actually ask about it', () => {
    // The same trap the errands have: an NPC with no `art` is routed to `talkToVex`, so a stall
    // hung on the Dispatcher would resolve, validate, and never open.
    const artless = new Set(
      AREAS.flatMap((a) => (a.props.npcs ?? []).filter((n) => !n.art).map((n) => `${a.id}:${n.id}`)),
    );
    for (const s of STALLS) {
      expect(artless.has(s.keeper), `${s.name}: ${s.keeper} is never asked`).toBe(false);
    }
  });

  it('gives nobody two stalls', () => {
    const keepers = STALLS.map((s) => s.keeper);
    expect(keepers).toHaveLength(new Set(keepers).size);
  });

  it('has something on it', () => {
    for (const s of STALLS) {
      expect(stallStock(s).length, `${s.name} is an empty stall`).toBeGreaterThan(0);
      expect(s.line.length, `${s.name} has no keeper's line`).toBeGreaterThan(0);
    }
  });

  it('deals only in Cores that exist', () => {
    for (const s of STALLS) {
      for (const id of s.cores ?? []) {
        expect(CORE_IDS.has(id), `${s.name}: no such Core '${id}'`).toBe(true);
      }
    }
  });
});

describe('the spread, which is what stops this being a printing press', () => {
  it('never pays as much for a thing as it charges', () => {
    for (const s of STALLS) {
      if (s.goods !== 'cores') continue;
      expect(s.sellRate, `${s.name} buys at its own asking price`).toBeLessThan(s.buyRate);
    }
  });

  it('cannot be arbitraged between any two stalls in the world', () => {
    // The one that needed a loop. Buy a Core at the cheapest stall that sells it, walk it to the
    // best-paying stall that buys it, and the round trip must lose money -- otherwise the map is
    // a money press and the only cost is patience, which is not a cost.
    for (const id of CORE_IDS) {
      const sellers = STALLS.filter((s) => corePrice(s, id));
      if (sellers.length < 2) continue;
      const cheapest = Math.min(...sellers.map((s) => corePrice(s, id)!.buy));
      const bestPaid = Math.max(...sellers.map((s) => corePrice(s, id)!.sell));
      expect(bestPaid, `${id} can be bought for ${cheapest} and sold for ${bestPaid}`).toBeLessThan(
        cheapest,
      );
    }
  });

  it('prices a Core against what a contract pays for one', () => {
    // An Adept contract pays 85 Ducats and one Core, so buying one at the source is about an
    // afternoon's work. Deliberately not cheap: a Core you can buy for pocket change turns
    // splicing from a decision into a formality.
    expect(CORE_BASE).toBeGreaterThan(60);
    for (const s of STALLS) {
      if (s.goods !== 'cores') continue;
      const any = corePrice(s, (s.cores ?? [])[0]!)!;
      expect(any.buy, `${s.name} sells Cores for nothing`).toBeGreaterThan(60);
    }
  });

  it('makes the market dearer than the ground that makes the thing', () => {
    // The design, stated: the Bonemarket has all six on one bench and charges for it; the
    // specialists are cheap and far. That difference is what turns the map into the price list.
    const market = STALLS.find((s) => (s.cores ?? []).length === REAGENTS.length)!;
    const sources = STALLS.filter(
      (s) => s.goods === 'cores' && s !== market && (s.cores ?? []).length === 1,
    );
    expect(sources.length, 'there are specialists to walk to').toBeGreaterThanOrEqual(5);
    for (const s of sources) {
      expect(s.buyRate, `${s.name} is not cheaper than the market`).toBeLessThan(market.buyRate);
    }
  });

  it('sells every school somewhere, so no splice is unreachable', () => {
    // The shortage this exists to end: a Core had exactly one source, a won contract, and no
    // way to convert between schools. A school nobody stocks is that shortage again.
    for (const id of CORE_IDS) {
      expect(
        STALLS.some((s) => corePrice(s, id)),
        `nowhere sells ${id}`,
      ).toBe(true);
    }
  });
});

describe('buying', () => {
  const works = stallFor('cinderworks', 'cinderworks_glassblower')!;

  it('takes the Ducats and hands the Core over', () => {
    const o = purse(500);
    expect(buyAt(o, works, 'core_pyre')).toBe(true);
    expect(o.economy.reagents.core_pyre).toBe(1);
    expect(o.economy.ducats).toBe(500 - corePrice(works, 'core_pyre')!.buy);
  });

  it('refuses what the stall does not stock, rather than inventing a price', () => {
    const o = purse(5000);
    expect(buyRefusal(o, works, 'core_frost')).toBe('not-stocked');
    expect(buyAt(o, works, 'core_frost')).toBe(false);
    expect(o.economy.ducats, 'and takes nothing').toBe(5000);
  });

  it('refuses a purse that cannot cover it, and takes nothing', () => {
    const o = purse(10);
    expect(buyRefusal(o, works, 'core_pyre')).toBe('too-poor');
    expect(buyAt(o, works, 'core_pyre')).toBe(false);
    expect(o.economy.ducats).toBe(10);
    expect(o.economy.reagents.core_pyre).toBeUndefined();
  });
});

describe('selling', () => {
  const market = stallFor('bonemarket', 'bonemarket_alchemist')!;

  it('takes the Core and pays for it', () => {
    const o = purse(0, { core_dusk: 2 });
    expect(sellAt(o, market, 'core_dusk')).toBe(true);
    expect(o.economy.reagents.core_dusk).toBe(1);
    expect(o.economy.ducats).toBe(corePrice(market, 'core_dusk')!.sell);
  });

  it('drops the key at zero rather than leaving a nought behind', () => {
    // The same rule `splice.ts` and `forge.ts` follow. A purse that grows a key per Core the
    // player has ever briefly owned is a save file that only gets bigger.
    const o = purse(0, { core_dusk: 1 });
    sellAt(o, market, 'core_dusk');
    expect('core_dusk' in o.economy.reagents).toBe(false);
  });

  it('refuses to sell what is not held', () => {
    const o = purse(0);
    expect(sellRefusal(o, market, 'core_dusk')).toBe('none-to-sell');
    expect(sellAt(o, market, 'core_dusk')).toBe(false);
    expect(o.economy.ducats).toBe(0);
  });

  it('will not buy back a brew, at any stall', () => {
    // Nobody takes a half-drunk tonic. `sellRate` is zero on every brew stall and `sellRefusal`
    // reads it, so the sell button is never even drawn.
    for (const s of STALLS.filter((x) => x.goods === 'brews')) {
      const o = purse(0);
      expect(sellRefusal(o, s, 'mending_tonic')).toBe('not-stocked');
    }
  });
});

describe('the brews, four crossings from the ward', () => {
  const inn = stallFor('fenwicks_crossing', 'fenwick_innkeeper')!;

  it('stocks what the Apothecary stocks', () => {
    expect([...stallStock(inn)].sort()).toEqual(APOTHECARY_STOCK.map((s) => s.item.id).sort());
  });

  it('charges more than the ward does, because it is not the ward', () => {
    for (const shelf of APOTHECARY_STOCK) {
      const here = brewPrice(inn, shelf.item.id)!;
      expect(here, `${shelf.item.name} out here is not dearer`).toBeGreaterThan(shelf.price);
    }
  });

  it('refuses a full satchel before it takes the money', () => {
    // The one failure a player would rightly call theft. `addConsumable` returns false on a full
    // satchel, so a purchase that debited first and asked second would take the Ducats and hand
    // nothing over.
    const o = purse(5000);
    for (let i = 0; i < INVENTORY_LIMIT; i++) {
      o.inventory.push({ id: 'mending_tonic', name: 'Mending Tonic', type: 'healing', value: 120 });
    }
    expect(buyRefusal(o, inn, 'mending_tonic')).toBe('satchel-full');
    expect(buyAt(o, inn, 'mending_tonic')).toBe(false);
    expect(o.economy.ducats, 'and the purse is untouched').toBe(5000);
  });

  it('puts a real brew in the satchel', () => {
    const o = purse(5000);
    expect(buyAt(o, inn, 'ironbrew')).toBe(true);
    expect(o.inventory.map((i) => i.id)).toContain('ironbrew');
    expect(o.economy.ducats).toBe(5000 - brewPrice(inn, 'ironbrew')!);
  });
});

describe('where the stalls are', () => {
  it('puts trade in more than one region', () => {
    const areas = new Set(STALLS.map((s) => s.keeper.split(':')[0]));
    expect(areas.size, 'trade is not one ward feature').toBeGreaterThanOrEqual(6);
  });

  it('leaves the wilds without a counter, because nobody lives there', () => {
    // The atlas claim a test in `district.test.ts` already pins for people. A stall in the
    // Ashwood would be somebody keeping shop where the world says nobody lives.
    const uninhabited = ['chalk_verge', 'chalk_road', 'caldera', 'ashwood', 'rimefields', 'storm_shelf', 'bone_bastion'];
    for (const s of STALLS) {
      expect(uninhabited, `${s.name} keeps shop in the wilds`).not.toContain(s.keeper.split(':')[0]);
    }
  });
});
