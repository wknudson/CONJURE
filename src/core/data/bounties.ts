/**
 * The Bounty Board: what work is going, and what it pays.
 *
 * Three contracts at a time, one per tier, so the board is always a choice about risk
 * rather than a list of whatever the dice produced. Rolled from a seed held on the
 * character, which is what keeps the board still while the player wanders in and out of
 * the shops — a board that rerolled on every hub mount would let anyone reroll a bad
 * offer by opening a door and closing it.
 *
 * Pure and DOM-free, and it never touches the engine: a bounty names an encounter by id
 * and leaves the loading of it to whoever runs the fight.
 */

import type { EncounterDef } from './encounters/registry.js';
import type { CombatSpoils } from '../overworld/state.js';
import { ENCOUNTERS, encounterById } from './encounters/index.js';
import { makeRng, nextInt } from '../util/rng.js';

export type BountyDifficulty = 'novice' | 'adept' | 'master';

export interface Bounty {
  id: string;
  title: string;
  difficulty: BountyDifficulty;
  /**
   * The encounter this contract sends you to, by id.
   *
   * Called a seed because it is what determines the opposition — the enemy deck, the
   * board, the boss. It is an encounter id rather than a number so that a bounty on disk
   * still means the same fight after the catalogue grows.
   */
  enemySeed: string;
  spoils: CombatSpoils;
  /** One line of why anyone is paying, for the card. */
  flavour: string;
}

export const DIFFICULTIES: readonly BountyDifficulty[] = ['novice', 'adept', 'master'];

/**
 * Which fights count as which tier.
 *
 * Derived from what each encounter actually asks of a player rather than from a number
 * on the encounter: the duel is an honest opener, the ruin and the field punish bad
 * positioning, and the Trial is a boss with a Rite attached.
 */
const TIER_ENCOUNTERS: Record<BountyDifficulty, string[]> = {
  novice: ['novice_duelist'],
  adept: ['narrow_ruin', 'glacial_field'],
  master: ['ignis_trial'],
};

/**
 * Base pay per tier, before the roll.
 *
 * Shards only start at Adept — they are the currency the Artificer wants, so the bench
 * stays out of reach until a player is taking real work.
 */
const TIER_PAY: Record<BountyDifficulty, { ducats: number; marrowShards: number }> = {
  novice: { ducats: 40, marrowShards: 0 },
  adept: { ducats: 85, marrowShards: 1 },
  master: { ducats: 160, marrowShards: 3 },
};

/** How far a tier's Ducat pay can swing, so two Adept contracts are not interchangeable. */
const TIER_SPREAD: Record<BountyDifficulty, number> = {
  novice: 15,
  adept: 30,
  master: 60,
};

const TITLES: Record<BountyDifficulty, string[]> = {
  novice: [
    'Alleyway Skirmish',
    'Gutter Dispute',
    'Lamplighter Escort',
    'Debt Collection, Minor',
  ],
  adept: [
    'Foundry Reclamation',
    'The Sunken Ward Contract',
    'Cellar Clearance',
    'Warrant of Distraint',
  ],
  master: [
    'Apex Subjugation',
    'The Magistracy Warrant',
    'Binding Order: Sealed',
  ],
};

const FLAVOUR: Record<BountyDifficulty, string> = {
  novice: 'Posted by a shopkeeper. Barely worth the ink, and it will be gone by evening.',
  adept: 'Countersigned. Somebody upstairs wants this closed and is not asking twice.',
  master: 'Wax seal, no name. The fee alone says what they expect to happen to you.',
};

/**
 * Rolls the three contracts on the board.
 *
 * Deterministic in the seed, so the same character always sees the same board until a
 * fight bumps it — the seeded generator the rest of the project uses, for the same reason
 * it uses it everywhere else.
 */
export function rollBounties(seed: number): Bounty[] {
  const rng = makeRng(seed);

  return DIFFICULTIES.map((difficulty) => {
    const pool = TIER_ENCOUNTERS[difficulty];
    const enemySeed = pool[nextInt(rng, pool.length)]!;
    const titles = TITLES[difficulty];
    const title = titles[nextInt(rng, titles.length)]!;

    const pay = TIER_PAY[difficulty];
    const spread = TIER_SPREAD[difficulty];

    return {
      // Seeded into the id so a cached `bountyId` cannot be confused with the same tier
      // on a later board.
      id: `${difficulty}_${seed >>> 0}_${enemySeed}`,
      title,
      difficulty,
      enemySeed,
      spoils: {
        ducats: pay.ducats + nextInt(rng, spread + 1),
        marrowShards: pay.marrowShards,
      },
      flavour: FLAVOUR[difficulty],
    };
  });
}

/**
 * Moves the board on.
 *
 * Called once per finished fight, win or lose. A player who declines everything on offer
 * keeps that board — refreshing on a timer would mean the right play is to wait.
 */
export function nextBountySeed(seed: number): number {
  return (Math.imul(seed, 1103515245) + 12345) >>> 0;
}

/** The encounter a bounty sends you to, or undefined if the catalogue no longer has it. */
export function encounterForBounty(bounty: Bounty): EncounterDef | undefined {
  return encounterById(bounty.enemySeed);
}

/** Guard for the tier tables, so a renamed encounter is caught by a test and not a player. */
export function knownEncounterIds(): string[] {
  return ENCOUNTERS.map((e) => e.id);
}
