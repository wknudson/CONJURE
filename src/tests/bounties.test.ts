import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  encounterForBounty,
  knownEncounterIds,
  nextBountySeed,
  rollBounties,
} from '../core/data/bounties.js';
import { resolveCombat } from '../core/overworld/run.js';
import { newRun, type GlobalGameState } from '../core/overworld/state.js';

/**
 * The Bounty Board.
 *
 * Mostly about what must *not* move. A board that rerolled when the player opened a shop
 * door, or a payout read after the reroll instead of before, would both be invisible in
 * play and both be free money.
 */

describe('the board', () => {
  it('posts one contract per tier, so the choice is always about risk', () => {
    const board = rollBounties(12345);
    expect(board).toHaveLength(3);
    expect(board.map((b) => b.difficulty)).toEqual([...DIFFICULTIES]);
  });

  it('is the same board every time it is asked, for the same seed', () => {
    // The hub re-mounts on every returning shop door. If this were not stable, closing a
    // door would reroll an offer the player did not like.
    expect(rollBounties(999)).toEqual(rollBounties(999));
  });

  it('is a different board after a fight', () => {
    const before = rollBounties(999);
    const after = rollBounties(nextBountySeed(999));
    expect(after).not.toEqual(before);
  });

  it('does not settle into one board after many fights', () => {
    // A seed bump that collapsed to a fixed point would freeze the board forever.
    let seed = 1;
    const seen = new Set<number>();
    for (let i = 0; i < 50; i++) {
      seed = nextBountySeed(seed);
      seen.add(seed);
    }
    expect(seen.size, 'fifty distinct boards').toBe(50);
  });

  it('sends every contract somewhere that exists', () => {
    // The tier tables name encounters by id, which a rename would silently break. Better
    // caught here than by a player clicking a contract that goes nowhere.
    const ids = new Set(knownEncounterIds());
    for (let seed = 1; seed < 60; seed++) {
      for (const bounty of rollBounties(seed)) {
        expect(ids.has(bounty.enemySeed), `${bounty.title} -> ${bounty.enemySeed}`).toBe(true);
        expect(encounterForBounty(bounty)).toBeDefined();
      }
    }
  });

  it('pays more for harder work, always', () => {
    for (let seed = 1; seed < 40; seed++) {
      const [novice, adept, master] = rollBounties(seed);
      expect(novice!.spoils.ducats!).toBeLessThan(adept!.spoils.ducats!);
      expect(adept!.spoils.ducats!).toBeLessThan(master!.spoils.ducats!);
    }
  });

  it('gives every contract a distinct id, so a cached one cannot be confused', () => {
    const ids = rollBounties(4242).map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the payout', () => {
  const accepted = (seed: number, tier: number): GlobalGameState => {
    const bounty = rollBounties(seed)[tier]!;
    const overworld = newRun(seed);
    overworld.activeEncounter = { bountyId: bounty.id, spoils: bounty.spoils };
    return { overworld, combat: {} };
  };

  it('settles at the rate the accepted contract promised', () => {
    const bounty = rollBounties(77)[2]!;
    const g = accepted(77, 2);

    resolveCombat(g, { pactHp: 9 }, 'victory');

    expect(g.overworld.economy.ducats).toBe(bounty.spoils.ducats);
    expect(g.overworld.economy.marrowShards).toBe(bounty.spoils.marrowShards);
  });

  it('is not re-read off the board after the reroll', () => {
    // The bug this exists to prevent: `resolveCombat` bumps the seed, so a payout looked
    // up afterwards would settle a Master win against whatever the new board offered.
    const taken = rollBounties(77)[2]!;
    const g = accepted(77, 2);

    resolveCombat(g, { pactHp: 9 }, 'victory');

    const nowOnTheBoard = rollBounties(g.overworld.bountySeed)[2]!;
    expect(nowOnTheBoard.spoils.ducats, 'the board did move').not.toBe(taken.spoils.ducats);
    expect(g.overworld.economy.ducats, 'but the purse followed the contract').toBe(
      taken.spoils.ducats,
    );
  });

  it('pays nothing for a loss, however rich the contract', () => {
    const g = accepted(77, 2);
    resolveCombat(g, { pactHp: 0 }, 'defeat');

    expect(g.overworld.economy.ducats).toBe(0);
    expect(g.overworld.economy.marrowShards).toBe(0);
  });

  it('pays nothing at all for a fight nobody was contracted for', () => {
    const overworld = newRun(3);
    const g: GlobalGameState = { overworld, combat: {} };
    resolveCombat(g, { pactHp: 20 }, 'victory');
    expect(overworld.economy.ducats).toBe(0);
  });

  it('moves the board on whether the fight was won or lost', () => {
    for (const result of ['victory', 'defeat'] as const) {
      const g = accepted(77, 0);
      const before = g.overworld.bountySeed;
      resolveCombat(g, { pactHp: 5 }, result);
      expect(g.overworld.bountySeed, result).not.toBe(before);
    }
  });
});
