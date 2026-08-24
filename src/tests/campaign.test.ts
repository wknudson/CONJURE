/**
 * The King's Contracts: the campaign ledger, and the board that serves it.
 *
 * The rules under test are the ones a player would actually trip over: the story surfaces
 * in order, completion moves it on, a finished tier gives its poster back to the dice,
 * and a story fight pays exactly what its tier pays.
 */

import { describe, expect, it } from 'vitest';
import { STORY_CONTRACTS, nextStoryContract } from '../core/data/campaign.js';
import {
  composeBoard,
  rollBounties,
  storyBounty,
  tierOfEncounter,
  DIFFICULTIES,
} from '../core/data/bounties.js';
import { encounterById } from '../core/data/encounters/index.js';

describe('the campaign data', () => {
  it('sends every story contract to a fight that exists', () => {
    for (const c of STORY_CONTRACTS) {
      expect(encounterById(c.id), `${c.title} -> ${c.id}`).toBeDefined();
    }
  });

  it('gives every contract a crack — a contract without a reveal is just a bounty', () => {
    for (const c of STORY_CONTRACTS) {
      expect(c.crack.title.length, c.id).toBeGreaterThan(0);
      expect(c.crack.body.length, c.id).toBeGreaterThan(20);
    }
  });

  it('files every story fight under its own tier', () => {
    for (const c of STORY_CONTRACTS) {
      expect(tierOfEncounter(c.id), c.id).toBe(c.tier);
    }
  });

  it('keeps ids unique — the ledger stores them by presence', () => {
    const ids = STORY_CONTRACTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('walks each tier in shipped order', () => {
    const novice = STORY_CONTRACTS.filter((c) => c.tier === 'novice');
    expect(nextStoryContract('novice', [])).toBe(novice[0]);
    expect(nextStoryContract('novice', [novice[0]!.id])).toBe(novice[1]);
    // Completion out of shipped order cannot wedge the pointer.
    const shuffled = novice.map((c) => c.id).reverse();
    expect(nextStoryContract('novice', shuffled)).toBeUndefined();
  });
});

describe('the board with a campaign on it', () => {
  it('posts the next story contract on its tier slot', () => {
    const board = composeBoard(1234, []);
    // Slots: 0 novice, 1 adept, 2 audit, 3 master.
    expect(board[0]!.enemySeed).toBe(nextStoryContract('novice', [])!.id);
    expect(board[1]!.enemySeed).toBe(nextStoryContract('adept', [])!.id);
    expect(board[2]!.audit).toBe(true);
  });

  it('moves the poster on when a contract completes', () => {
    const first = nextStoryContract('novice', [])!;
    const board = composeBoard(1234, [first.id]);
    expect(board[0]!.enemySeed).not.toBe(first.id);
    expect(board[0]!.enemySeed).toBe(nextStoryContract('novice', [first.id])!.id);
  });

  it('gives a finished tier its slot back to the dice', () => {
    const allNovice = STORY_CONTRACTS.filter((c) => c.tier === 'novice').map((c) => c.id);
    const board = composeBoard(1234, allNovice);
    const rolled = rollBounties(1234);
    expect(board[0]!.id).toBe(rolled[0]!.id);
    expect(board[0]!.enemySeed).toBe(rolled[0]!.enemySeed);
  });

  it('keeps a story poster identical across boards until it is done', () => {
    // The id is what the district's board panel keys on; a story contract that changed
    // id when the seed moved would read as a different job every time you came home.
    const a = composeBoard(1, [])[0]!;
    const b = composeBoard(999, [])[0]!;
    expect(a.id).toBe(b.id);
    expect(a.title).toBe(b.title);
  });

  it('pays a story contract at exactly its tier', () => {
    for (const tier of DIFFICULTIES) {
      const next = nextStoryContract(tier, []);
      if (!next) continue;
      const story = storyBounty(next, 42);
      const rolled = rollBounties(42).find((x) => x.difficulty === tier && !x.audit)!;
      // Same base + same spread bounds. Not equal — the spread is rolled — but within it.
      const gap = Math.abs(story.spoils.ducats! - rolled.spoils.ducats!);
      expect(gap).toBeLessThanOrEqual(60);
      expect(story.spoils.marrowShards).toBe(rolled.spoils.marrowShards);
      expect(story.difficulty).toBe(tier);
    }
  });
});
