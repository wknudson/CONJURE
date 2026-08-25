/**
 * Roaming packs: the budget, the fight shape, and the reward trap.
 *
 * The budget is the interesting one. A pack is "ten points" in the same currency the player
 * spends on their own warband, and the only way that stays true is for something to re-derive
 * it — a total written in a comment stops being the total the first time somebody swaps a
 * body and does not re-add the column.
 */

import { describe, expect, it } from 'vitest';
import { PACKS, PACK_POINTS, isPack, packByEncounter } from '../core/data/packs.js';
import { CARDS } from '../core/data/cards/index.js';
import { isRosterEligible, rosterPointsOf } from '../core/data/roster.js';
import { encounterById } from '../core/data/encounters/index.js';
import { getEncounterScript } from '../core/data/encounters/registry.js';
import { packBounty, tierOfEncounter } from '../core/data/bounties.js';

const points = (ids: readonly string[]): number =>
  ids.reduce((n, id) => n + (CARDS[id] ? rosterPointsOf(CARDS[id]!) : 0), 0);

describe('a pack is one warband of somebody else', () => {
  it('costs exactly ten points, on the ladder the player buys from', () => {
    for (const pack of PACKS) {
      expect(points(pack.members), `${pack.encounterId}: ${pack.members.join(' ')}`).toBe(
        PACK_POINTS,
      );
    }
  });

  it('is built out of bodies a warband could actually field', () => {
    // `isRosterEligible` refuses Bound Forms, spliced cards and setup-only stat blocks. A
    // pack containing one would be costed on a ladder that does not price it — and in the
    // case of a Bound Form, would put a Companion body on the road with no Companion.
    for (const pack of PACKS) {
      for (const id of [...pack.members, ...pack.reinforce.unitCardIds]) {
        const def = CARDS[id];
        expect(def, `${pack.encounterId} names ${id}`).toBeDefined();
        expect(isRosterEligible(def!), `${id} is fieldable`).toBe(true);
      }
    }
  });

  it('keeps its reinforcements inside their own budget', () => {
    for (const pack of PACKS) {
      expect(pack.reinforce.points).toBeGreaterThan(0);
      // Every body on the list has to be affordable on its own, or the budget can never be
      // spent and the reinforcements silently never arrive.
      const cheapest = Math.min(...pack.reinforce.unitCardIds.map((id) => rosterPointsOf(CARDS[id]!)));
      expect(cheapest, `${pack.encounterId}: nothing affordable`).toBeLessThanOrEqual(
        pack.reinforce.points,
      );
      expect(pack.reinforce.chance).toBeGreaterThan(0);
      expect(pack.reinforce.chance).toBeLessThanOrEqual(100);
    }
  });
});

describe('a pack, as a fight', () => {
  it('is registered, and is won by clearing the board', () => {
    for (const pack of PACKS) {
      const enc = encounterById(pack.encounterId);
      expect(enc, pack.encounterId).toBeDefined();
      expect(enc!.victory, `${pack.encounterId} must be a rout`).toBe('rout');
    }
  });

  it('has nothing standing behind it', () => {
    // The whole promise of the feature: these units and nothing else. A Bound Form or a deck
    // would mean a commander the rout rule then refuses to let the player reach.
    for (const pack of PACKS) {
      const enc = encounterById(pack.encounterId)!;
      expect(enc.enemyCompanion, `${pack.encounterId} companion`).toBeUndefined();
      expect(enc.enemyDeck, `${pack.encounterId} deck`).toEqual([]);
      // The free opening footman is suppressed, or every pack would field eleven points.
      expect(enc.vanguard, `${pack.encounterId} vanguard`).toBeNull();
    }
  });

  it('puts every one of its bodies on the board', () => {
    for (const pack of PACKS) {
      const enc = encounterById(pack.encounterId)!;
      expect(enc.enemyOpeningBoard.map((e) => e[0]).sort()).toEqual([...pack.members].sort());
      // Inside the arena, or `placeOpeningUnit` walks them somewhere unintended.
      for (const [id, x, y] of enc.enemyOpeningBoard) {
        expect(x, `${id} x`).toBeGreaterThanOrEqual(0);
        expect(x, `${id} x`).toBeLessThan(enc.width);
        expect(y, `${id} y`).toBeGreaterThanOrEqual(0);
        expect(y, `${id} y`).toBeLessThan(enc.height);
      }
    }
  });

  it('has a script, because the reinforcements are rolled in one', () => {
    for (const pack of PACKS) {
      const script = getEncounterScript(pack.encounterId);
      expect(script?.setup, `${pack.encounterId} setup`).toBeDefined();
      expect(script?.onTurnStart, `${pack.encounterId} turn hook`).toBeDefined();
    }
  });
});

describe('what a pack pays', () => {
  it('is filed at its own tier, so it does not quietly pay nothing', () => {
    // `tierOfEncounter` falls through to Novice for anything it does not recognise, and
    // Novice pays **zero** Marrow Shards — which is precisely the reward these exist to hand
    // out. The same value also decides how many Schematics a win offers.
    for (const pack of PACKS) {
      expect(tierOfEncounter(pack.encounterId), pack.encounterId).toBe(pack.tier);
    }
  });

  it('always pays at least one shard, whatever the tier table says', () => {
    for (const pack of PACKS) {
      const bounty = packBounty(pack, 1234);
      expect(bounty.spoils.marrowShards ?? 0, pack.encounterId).toBeGreaterThan(0);
      expect(bounty.spoils.ducats ?? 0, pack.encounterId).toBeGreaterThan(0);
      // Not a bet. Nothing on the road agreed to one.
      expect(bounty.wager, pack.encounterId).toBeUndefined();
      expect(bounty.enemySeed).toBe(pack.encounterId);
      expect(bounty.difficulty).toBe(pack.tier);
    }
  });

  it('pays less coin than a contract of the same tier', () => {
    // Packs are a material faucet, not an income. If the road ever out-earned the board, the
    // campaign becomes the slow way to make a living.
    for (const pack of PACKS) {
      const bounty = packBounty(pack, 99);
      expect(bounty.spoils.ducats!, pack.encounterId).toBeLessThan(80);
    }
  });

  it('is recognised by id, and nothing else is', () => {
    expect(isPack(PACKS[0]!.encounterId)).toBe(true);
    expect(isPack('ignis_trial')).toBe(false);
    expect(packByEncounter('not_a_pack')).toBeUndefined();
  });
});
