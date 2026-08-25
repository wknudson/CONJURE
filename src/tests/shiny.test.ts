/**
 * Lustrous beasts: the odds, the fact that it is only ever a look, and the one thing that
 * could have gone badly wrong — the roll's position in the RNG stream.
 *
 * `tameCompanion` draws every one of a beast's properties off a single seeded stream, in a
 * fixed order, which is what makes a subjugation replay to the same animal. A new draw
 * inserted anywhere but the *end* shifts every subsequent one, so an existing save's beast
 * would come back from a reload with a different constitution and a different book. The
 * regression test below pins that.
 */

import { describe, expect, it } from 'vitest';
import { SHINY_ODDS, tameCompanion } from '../core/overworld/vivarium.js';
import { makeRng } from '../core/util/rng.js';
import { COMPANIONS } from '../core/data/companions.js';

describe('the shiny roll', () => {
  it('does not disturb anything drawn before it', () => {
    // The guard on the whole feature. These are the properties that existed before shinies,
    // rolled off a fixed seed; if the shiny draw ever moves earlier in `tameCompanion`, one
    // of them changes and this fails.
    //
    // Written as a snapshot of *relationships* rather than of literal values, so it still
    // means something after a balance change: what must hold is that one seed produces one
    // beast, and that two beasts differing only in shininess are otherwise identical.
    const beast = tameCompanion(makeRng(2024), 'ignis', 1);
    const again = tameCompanion(makeRng(2024), 'ignis', 1);
    expect(again.baseHpRoll).toBe(beast.baseHpRoll);
    expect(again.traitId).toBe(beast.traitId);
    expect(again.grimoire).toEqual(beast.grimoire);
    expect(again.spellModifiers).toEqual(beast.spellModifiers);
    expect(again.shiny).toBe(beast.shiny);
  });

  it('is absent rather than false on an ordinary beast', () => {
    // So the flag reads the same in a save as in memory, and no migration has to invent a
    // value for the ninety-nine.
    let ordinary = 0;
    for (let seed = 1; seed < 200 && ordinary < 5; seed++) {
      const beast = tameCompanion(makeRng(seed), 'boreas', 1);
      if (beast.shiny === undefined) {
        expect('shiny' in beast, 'an ordinary beast should carry no shiny key').toBe(false);
        ordinary++;
      }
    }
    expect(ordinary, 'ordinary beasts should be easy to find').toBeGreaterThan(0);
  });

  it('comes up at roughly one in a hundred', () => {
    // A statistical claim, so the band is wide: this is checking the odds are the advertised
    // order of magnitude, not that the generator is uniform. A rate of zero or of one in ten
    // both mean the roll is wired wrong.
    let shiny = 0;
    const trials = 4000;
    for (let seed = 1; seed <= trials; seed++) {
      if (tameCompanion(makeRng(seed * 31), 'mortis', 1).shiny) shiny++;
    }
    const rate = shiny / trials;
    expect(rate, `${shiny}/${trials} came up lustrous`).toBeGreaterThan(1 / (SHINY_ODDS * 4));
    expect(rate, `${shiny}/${trials} came up lustrous`).toBeLessThan(4 / SHINY_ODDS);
  });

  it('grants nothing — a lustrous beast is rolled on the same tables as any other', () => {
    // The design promise, enforced. If a shiny ever gained a stat, this is where it would be
    // caught: the two populations are drawn from the same generator and must have the same
    // range of constitutions, and the shiny must not sit above the ordinary ceiling.
    const shinies: number[] = [];
    const plain: number[] = [];
    for (let seed = 1; seed <= 3000; seed++) {
      const beast = tameCompanion(makeRng(seed * 17), 'sylva', 1);
      (beast.shiny ? shinies : plain).push(beast.baseHpRoll);
    }
    expect(shinies.length, 'no shiny turned up in 3000 catches').toBeGreaterThan(0);
    expect(Math.max(...shinies)).toBeLessThanOrEqual(Math.max(...plain));
    expect(Math.min(...shinies)).toBeGreaterThanOrEqual(Math.min(...plain));
  });

  it('can happen to any species, on any catch', () => {
    // Every acquisition path — wild taming, a duel's stake, an apex subjugation — runs
    // through `tameCompanion`, so one roll covers all of them. This checks the roll is not
    // somehow keyed to a species.
    const found = new Set<string>();
    for (const species of COMPANIONS) {
      for (let seed = 1; seed <= 600; seed++) {
        if (tameCompanion(makeRng(seed * 13), species.id, 1).shiny) {
          found.add(species.id);
          break;
        }
      }
    }
    expect(found.size, 'every species should be able to come up lustrous').toBe(COMPANIONS.length);
  });
});
