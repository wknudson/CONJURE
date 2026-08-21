import { describe, expect, it } from 'vitest';
import {
  APOTHECARY_STOCK,
  CLINIC_RATE,
  clinicPrice,
  describeBoons,
  effectOf,
} from '../core/data/apothecary.js';
import { CATALYSTS, schematicsFor } from '../core/data/artificer.js';
import { BUFF_EFFECTS } from '../core/overworld/run.js';
import { newRun } from '../core/overworld/state.js';
import { type BuffId } from '../core/overworld/state.js';
import { isObtainable, startingCollection } from '../core/data/collection.js';
import type { Collection } from '../core/data/deckRules.js';
import { STAT_SCALE, unscaleStat } from '../core/scale.js';

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
    unlocked: [...ids],
  });

  it('offers a Schematic for nothing the player already owns', () => {
    const collection = startingCollection();
    const offered = schematicsFor(collection).map((d) => d.id);
    for (const id of collection.unlocked) {
      expect(offered, id).not.toContain(id);
    }
  });

  it('never offers the Rite, a setup-only block, or a Rank 2 printing', () => {
    // All three are things you cannot come to own by buying. They agree with the reward
    // roller because they ask the same predicate — which is the point of `isObtainable`.
    const offered = schematicsFor(owning([]));
    expect(offered.map((d) => d.id)).not.toContain('rite_of_subjugation');
    expect(offered.every((d) => !d.setupOnly)).toBe(true);
    expect(offered.every(isObtainable)).toBe(true);
  });

  it('offers a card the moment the last copy is gone', () => {
    const withIt = schematicsFor(owning(['shield_bash'])).map((d) => d.id);
    const without = schematicsFor(owning([])).map((d) => d.id);
    expect(withIt).not.toContain('shield_bash');
    expect(without).toContain('shield_bash');
  });

  it('never offers a body, however few the player owns', () => {
    // Minions are unlocked into a Vanguard Roster, not bought as copies. A body on the
    // shelf would be selling something no deck is allowed to hold.
    const shelf = schematicsFor(owning([])).map((d) => d.id);
    for (const id of ['scout_imp', 'grave_sentinel', 'magma_brute']) {
      expect(shelf, id).not.toContain(id);
    }
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

  it('bills by the band, so being carried in is dear and a scratch is not', () => {
    const scratched = newRun(1);
    scratched.pact.currentHp = scratched.pact.maxHp - 20;
    const floored = newRun(1);
    floored.pact.currentHp = STAT_SCALE;

    // Priced per ten points of health, because health stretched by ten and the Ducat did
    // not. The bill a player pays is the bill they always paid.
    expect(clinicPrice(scratched)).toBe(2 * CLINIC_RATE);
    expect(clinicPrice(floored)).toBe(
      unscaleStat(floored.pact.maxHp - STAT_SCALE) * CLINIC_RATE,
    );
    expect(clinicPrice(floored)).toBeGreaterThan(clinicPrice(scratched));
  });

  it('rounds a scratch up rather than treating it for nothing', () => {
    // Under a full band is still a wound. Free treatment for it would make the Clinic a
    // way to top yourself off between contracts.
    const grazed = newRun(1);
    grazed.pact.currentHp = grazed.pact.maxHp - 1;
    expect(clinicPrice(grazed)).toBe(CLINIC_RATE);
  });

  it('is the expensive way to heal, so buying tonics ahead stays worth it', () => {
    // If a Clinic point were cheaper than a tonic point, the satchel would be pointless.
    // Both sides in Ducats *per point of health*, or the comparison is between a rate and
    // a rate-per-ten and means nothing.
    const tonic = APOTHECARY_STOCK.find((s) => s.item.type === 'healing')!;
    expect(CLINIC_RATE / STAT_SCALE).toBeGreaterThan(tonic.price / tonic.item.value);
  });
});
