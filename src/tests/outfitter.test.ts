import { describe, expect, it } from 'vitest';
import {
  GEAR_STOCK,
  buyGear,
  gearForSlot,
  gearPrice,
  gearRefusal,
  gearRelic,
} from '../core/data/outfitter.js';
import { RELICS, slotOf } from '../core/data/relics.js';
import { RELIC_SLOT_ORDER, newRun } from '../core/overworld/state.js';
import type { OverworldState } from '../core/overworld/state.js';

/**
 * The Tailoring counter.
 *
 * Relics were the one thing in the game with no source: every character was handed the
 * whole footlocker at creation as an explicit placeholder. These are the tests that make
 * the placeholder unnecessary, and the ones that stop it being reintroduced by accident.
 */

function purse(ducats: number): OverworldState {
  const o = newRun(1);
  o.economy.ducats = ducats;
  o.relics = [];
  return o;
}

describe('the counter carries the whole catalogue', () => {
  it('prices every relic in the game', () => {
    // Enforced at module load too, so an unpriced relic cannot ship. This says why.
    for (const id of Object.keys(RELICS)) {
      expect(gearPrice(id), `${id} has no price`).toBeGreaterThan(0);
    }
  });

  it('sells something for every slot', () => {
    // A slot with nothing behind it is a hole in the loadout the player cannot fill.
    for (const slot of RELIC_SLOT_ORDER) {
      expect(gearForSlot(slot).length, `${slot} has no stock`).toBeGreaterThan(0);
    }
  });

  it('names only relics that exist', () => {
    for (const item of GEAR_STOCK) {
      expect(gearRelic(item), `${item.relicId} is not a relic`).toBeDefined();
    }
  });

  it('files each listing under the slot its relic actually claims', () => {
    // The grouping is what tells a player which gear competes with which; filing a piece
    // under the wrong heading would answer that question wrongly.
    for (const slot of RELIC_SLOT_ORDER) {
      for (const item of gearForSlot(slot)) {
        expect(slotOf(item.relicId), item.relicId).toBe(slot);
      }
    }
  });
});

describe('buying', () => {
  it('takes the coin and hands over the gear', () => {
    const o = purse(500);
    expect(buyGear(o, 'relic_goggles')).toBe(true);
    expect(o.relics).toContain('relic_goggles');
    expect(o.economy.ducats).toBe(500 - gearPrice('relic_goggles')!);
  });

  it('does not equip it', () => {
    // Buying and wearing are separate decisions; the loadout is where the second is made.
    const o = purse(500);
    buyGear(o, 'relic_goggles');
    expect(Object.values(o.equippedRelics)).not.toContain('relic_goggles');
  });

  it('refuses an empty purse, and charges nothing for the refusal', () => {
    const o = purse(10);
    expect(gearRefusal(o, 'relic_goggles')).toBe('too-poor');
    expect(buyGear(o, 'relic_goggles')).toBe(false);
    expect(o.economy.ducats).toBe(10);
    expect(o.relics).toHaveLength(0);
  });

  it('refuses a second copy, and charges nothing for that either', () => {
    // The one that matters: a stale render must not be able to sell the same coat twice.
    const o = purse(1000);
    buyGear(o, 'relic_coat');
    const after = o.economy.ducats;

    expect(gearRefusal(o, 'relic_coat')).toBe('already-owned');
    expect(buyGear(o, 'relic_coat')).toBe(false);
    expect(o.economy.ducats).toBe(after);
    expect(o.relics.filter((r) => r === 'relic_coat')).toHaveLength(1);
  });

  it('refuses something the counter does not carry', () => {
    const o = purse(1000);
    expect(gearRefusal(o, 'relic_nonesuch')).toBe('no-such-relic');
    expect(buyGear(o, 'relic_nonesuch')).toBe(false);
    expect(o.economy.ducats).toBe(1000);
  });

  it('can outfit a commander completely, given the coin', () => {
    // End to end: every slot fillable by purchase alone, which is the whole point of the
    // counter existing.
    const o = purse(10_000);
    for (const slot of RELIC_SLOT_ORDER) {
      const first = gearForSlot(slot)[0]!;
      expect(buyGear(o, first.relicId), `${slot} unpurchasable`).toBe(true);
    }
    expect(o.relics).toHaveLength(RELIC_SLOT_ORDER.length);
  });
});

describe('pricing holds its shape', () => {
  it('never gives anything away', () => {
    for (const item of GEAR_STOCK) {
      expect(item.price, item.relicId).toBeGreaterThan(0);
    }
  });

  it('charges most for the pieces that change what is legal', () => {
    // The loadout's whole axis: a relic that raises a ceiling or lifts a restriction is a
    // different kind of purchase from one that adds a number, and should read as one.
    // Anything that raises a ceiling or lifts a restriction. `relic_battery` was missing
    // from this list, which read as an oversight the moment a second ceiling-raiser joined
    // it — raising the Bone cap is the same kind of purchase whichever piece does it.
    const ruleBenders = [
      'relic_gloves',
      'relic_coin',
      'relic_splicer_goggles',
      'relic_battery',
      'relic_twin_cell',
      'relic_survey_prism',
      'relic_sighting_rig',
      'relic_leyline_tap',
      'relic_ferrocrete',
      'relic_communion',
    ];
    const plainest = Math.min(
      ...GEAR_STOCK.filter((g) => !ruleBenders.includes(g.relicId)).map((g) => g.price),
    );
    for (const id of ruleBenders) {
      expect(gearPrice(id)!, `${id} is priced like a stat stick`).toBeGreaterThan(plainest);
    }
  });
});
