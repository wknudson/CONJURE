import { describe, expect, it } from 'vitest';
import { CARDS } from '../core/data/cards/index.js';
import {
  APOTHECARY_STOCK,
  CLINIC_RATE,
  clinicPrice,
  describeBoons,
  effectOf,
} from '../core/data/apothecary.js';
import {
  CATALYSTS,
  FORGE_COST,
  blueprintsFor,
  canForge,
  forgeCostOf,
} from '../core/data/artificer.js';
import { BUFF_EFFECTS } from '../core/overworld/run.js';
import { newRun } from '../core/overworld/state.js';
import { type BuffId } from '../core/overworld/state.js';
import { isObtainable, startingCollection } from '../core/data/collection.js';
import { tierOf } from '../core/data/deckRules.js';
import type { Collection } from '../core/data/deckRules.js';

/**
 * What the two shops are allowed to sell.
 *
 * The screens themselves are DOM and not tested here; what is tested is the data behind
 * them, because that is where a mistake is silent. A shelf that sells a brew the fight
 * has never heard of looks perfectly fine until someone drinks it.
 */

describe('the Apothecary shelf', () => {
  it('sells only brews the fight actually understands', () => {
    // The failure this catches is a typo'd id: `addConsumable` takes any string, and
    // `useConsumable` writes it straight into `activeBuff`, so a misspelt brew is bought,
    // carried, drunk, and does nothing at all.
    for (const stock of APOTHECARY_STOCK) {
      if (stock.item.type !== 'buff') continue;
      expect(BUFF_EFFECTS[stock.item.id as BuffId], stock.item.name).toBeDefined();
    }
  });

  it('describes the boon table rather than restating it', () => {
    const ironbrew = APOTHECARY_STOCK.find((s) => s.item.id === 'ironbrew')!;
    expect(effectOf(ironbrew)).toContain(String(BUFF_EFFECTS.ironbrew.armor));
  });

  it('states a healing item at its own value', () => {
    const tonic = APOTHECARY_STOCK.find((s) => s.item.type === 'healing')!;
    expect(effectOf(tonic)).toContain(String(tonic.item.value));
  });

  it('says so plainly when a boon grants nothing', () => {
    expect(describeBoons({})).toMatch(/nothing/i);
  });

  it('prices everything above nothing', () => {
    for (const stock of APOTHECARY_STOCK) {
      expect(stock.price, stock.item.name).toBeGreaterThan(0);
    }
  });
});

describe('the Artificer bench', () => {
  const owning = (ids: string[]): Collection => ({
    owned: Object.fromEntries(ids.map((id) => [id, 1])),
  });

  it('offers nothing the player already owns', () => {
    const collection = startingCollection();
    const offered = blueprintsFor(collection).map((d) => d.id);
    for (const id of Object.keys(collection.owned)) {
      expect(offered, id).not.toContain(id);
    }
  });

  it('never offers the Rite or a setup-only stat block', () => {
    // Both are engine furniture rather than cards. The reward roller and this list agree
    // because they ask the same predicate — which is the point of `isObtainable`.
    const offered = blueprintsFor(owning([]));
    expect(offered.map((d) => d.id)).not.toContain('rite_of_subjugation');
    expect(offered.every((d) => !d.setupOnly)).toBe(true);
    expect(offered.every(isObtainable)).toBe(true);
  });

  it('offers a card the moment the last copy is gone', () => {
    const withIt = blueprintsFor(owning(['scout_imp'])).map((d) => d.id);
    const without = blueprintsFor(owning([])).map((d) => d.id);
    expect(withIt).not.toContain('scout_imp');
    expect(without).toContain('scout_imp');
  });

  it('charges more for a bigger card', () => {
    expect(FORGE_COST[2].ducats).toBeGreaterThan(FORGE_COST[1].ducats);
    expect(FORGE_COST[3].ducats).toBeGreaterThan(FORGE_COST[2].ducats);
    expect(FORGE_COST[3].shards).toBeGreaterThan(FORGE_COST[1].shards);
  });

  it('prices a card off its tier, not off a second table', () => {
    const def = CARDS.scout_imp!;
    expect(forgeCostOf(def)).toEqual(FORGE_COST[tierOf(def)]);
  });

  it('wants both currencies, not whichever is larger', () => {
    const cost = { ducats: 30, shards: 1 };
    expect(canForge(cost, { ducats: 30, marrowShards: 1 })).toBe(true);
    expect(canForge(cost, { ducats: 999, marrowShards: 0 }), 'no shards').toBe(false);
    expect(canForge(cost, { ducats: 29, marrowShards: 99 }), 'no ducats').toBe(false);
  });

  it('names catalysts only for schools the reaction engine knows', () => {
    // A Bloom reagent would promise a hybrid with no reaction behind it.
    for (const catalyst of CATALYSTS) {
      expect(['pyre', 'surge', 'frost'], catalyst.name).toContain(catalyst.school);
    }
  });
});

describe('the Clinic', () => {
  it('costs nothing when there is nothing to mend', () => {
    expect(clinicPrice(newRun(1))).toBe(0);
  });

  it('bills by the point, so being carried in is dear and a scratch is not', () => {
    const scratched = newRun(1);
    scratched.pact.currentHp = scratched.pact.maxHp - 2;
    const floored = newRun(1);
    floored.pact.currentHp = 1;

    expect(clinicPrice(scratched)).toBe(2 * CLINIC_RATE);
    expect(clinicPrice(floored)).toBe((floored.pact.maxHp - 1) * CLINIC_RATE);
    expect(clinicPrice(floored)).toBeGreaterThan(clinicPrice(scratched));
  });

  it('is the expensive way to heal, so buying tonics ahead stays worth it', () => {
    // If a Clinic point were cheaper than a tonic point, the satchel would be pointless.
    const tonic = APOTHECARY_STOCK.find((s) => s.item.type === 'healing')!;
    expect(CLINIC_RATE).toBeGreaterThan(tonic.price / tonic.item.value);
  });
});
