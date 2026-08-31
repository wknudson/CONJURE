import { describe, expect, it } from 'vitest';
import { LAIRS, isLair, lairByEncounter } from '../core/data/lairs.js';
import { huntBounty, lairBoard, lairBounty, tierOfEncounter } from '../core/data/bounties.js';
import { HUNTS } from '../core/data/hunts.js';
import { encounterById } from '../core/data/encounters/index.js';

/**
 * The lair registry's contracts: pay grade filed, never wagered, and every entry backed
 * by a real encounter. The placement half lives in `sites.test.ts`; this is the money.
 */
describe('regional apex lairs', () => {
  it('backs every lair with a registered encounter carrying a prize', () => {
    for (const lair of LAIRS) {
      const enc = encounterById(lair.encounterId);
      expect(enc, `${lair.encounterId}: lair with no encounter`).toBeDefined();
      expect(
        enc!.subjugationPrize,
        `${lair.encounterId}: a second route must offer the species`,
      ).toBeTruthy();
    }
  });

  it('files every lair in the tier table', () => {
    // An unfiled fight silently pays Novice — the exact failure the registry exists for.
    for (const lair of LAIRS) {
      expect(tierOfEncounter(lair.encounterId)).toBe(lair.tier);
    }
  });

  it('pays tier rates with the seeded spread, and never a wager', () => {
    for (const lair of LAIRS) {
      const bounty = lairBounty(lair, 12345);
      // Same table a hunt of the same tier reads, asserted through one rather than by
      // exporting the pay table for a test's convenience.
      const peer = HUNTS.find((h) => h.tier === lair.tier)!;
      const peerPay = huntBounty(peer, 12345);
      expect(bounty.spoils.marrowShards).toBe(peerPay.spoils.marrowShards);
      expect(bounty.spoils.ducats).toBeGreaterThan(0);
      // An animal has not agreed to anything.
      expect(bounty.wager).toBeUndefined();
      expect(bounty.id).toBe(`lair_${lair.encounterId}`);
      expect(bounty.enemySeed).toBe(lair.encounterId);
    }
  });

  it('composes the whole board deterministically', () => {
    const a = lairBoard(777);
    const b = lairBoard(777);
    expect(a.map((x) => x.spoils.ducats)).toEqual(b.map((x) => x.spoils.ducats));
    expect(a).toHaveLength(LAIRS.length);
  });

  it('answers membership', () => {
    expect(isLair('rimefield_gargoyle')).toBe(true);
    expect(isLair('bone_bastion')).toBe(false);
    expect(lairByEncounter('caldera_wasps')?.tier).toBe('adept');
  });
});
