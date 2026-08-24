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
import { hashText, makeRng, nextInt } from '../util/rng.js';
import { REAGENTS } from './splicing.js';
import { nextStoryContract, storyContractByEncounter, type StoryContract } from './campaign.js';
import { HUNTS, huntByEncounter, type Hunt } from './hunts.js';

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
  /**
   * Ducats staked to take the contract, doubled back on a win.
   *
   * A Wandering Duelist wants a bet, not a job — so a wagered contract charges the buy-in
   * the moment it is accepted and pays `wager * 2` if you walk away from it. Losing costs
   * exactly the buy-in, which was already gone.
   *
   * **Never cards.** The progression model is RPG rather than roguelike: what a loss costs
   * is money and time, never possessions, and a contract that could take a card off the
   * player would be the only thing in the game that does.
   */
  wager?: number;
  /** One line of why anyone is paying, for the card. */
  flavour: string;
  /**
   * The development test contract, drawn with an AUDIT seal and paying absurdly.
   *
   * A flag rather than a fourth `BountyDifficulty`: it is not a tier, it is not balanced
   * against the others, and giving it one would make every pay, title and core table grow
   * a column for something none of them describe.
   */
  audit?: true;
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
 * Which tier a fight belongs to, asked of the fight rather than of the contract.
 *
 * The Bounty knows its own difficulty, and for a contract that is the right place to read
 * it. But a fight can be reached without one — a standalone bout, a test, the Trial taken
 * off the Vivarium — and the Schematics a win offers must not depend on how the player got
 * there. So the tier is a property of the encounter, read out of the table that already
 * decides which posters a fight can appear on.
 *
 * Derived from `TIER_ENCOUNTERS` rather than stamped on `EncounterDef`, so a fight cannot
 * be promoted to Master on the board and still pay Novice at the desk.
 *
 * An encounter on no poster is Novice: unknown work is the cheapest work, and the
 * alternative is a fight that pays the top tier because nobody filed it.
 */
export function tierOfEncounter(encounterId: string): BountyDifficulty {
  // Story contracts carry their own tier, and are not in the rolled pools — they surface
  // through `composeBoard` in campaign order instead of by dice.
  const story = storyContractByEncounter(encounterId);
  if (story) return story.tier;
  // Hunts likewise: they are posted at the gate rather than on the board, and a Master
  // hunt paying Novice Schematics because nobody filed it is exactly the failure the
  // fallback below is apologising for.
  const wild = huntByEncounter(encounterId);
  if (wild) return wild.tier;
  for (const tier of DIFFICULTIES) {
    if (TIER_ENCOUNTERS[tier].includes(encounterId)) return tier;
  }
  return 'novice';
}

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

/**
 * Cores a contract pays, by tier.
 *
 * The only way to earn one. Novice work pays none — the two a character starts with are
 * meant to be spent learning what the bench does, and everything after that is worked
 * for. Which core is rolled, so a run of Adept contracts is not a run of the same core.
 */
const TIER_CORES: Record<BountyDifficulty, number> = {
  novice: 0,
  adept: 1,
  master: 2,
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

/**
 * The Magistrate's Audit: a test contract, posted third.
 *
 * A development affordance, shipped deliberately and labelled as one. It exists so gear
 * prices, hybrid pressings and Rank 2 Ascensions can be exercised in a minute instead of
 * a dozen contracts — every one of those systems is a *sink*, and a sink is untestable
 * without a source.
 *
 * Three decisions worth naming:
 *
 * - **It is a real fight, at the easiest tier.** The point is a fast loop, not a free
 *   purse: an audit that paid on being clicked would test the shop and nothing about the
 *   run resolving around it, and `resolveCombat` is the seam the spoils actually travel.
 * - **It is poster #3, and the Master contract moves to #4.** Overwriting the third slot
 *   would have taken the Apex Subjugation off the board with it — the only encounter that
 *   calls `beginSubjugation`, and therefore the only route to a bound Companion. The test
 *   slot is worth a poster; it is not worth the boss.
 * - **It is not a difficulty.** `audit` is a flag rather than a fourth `BountyDifficulty`,
 *   so the pay, title, core and spread tables keep exactly three tiers and no balance
 *   table grows a column for a thing that is not balanced.
 *
 * Its id is fixed rather than seeded, so it survives a board reroll and can be recognised
 * on sight in a save.
 */
export const AUDIT_BOUNTY_ID = 'audit_smuggled_vault';

/**
 * What the vault holds. Absurd on purpose: this is a bench supply, not a reward curve.
 *
 * The Ducat figure is sized against the **whole gear counter**, because the thing the audit
 * exists to test is the counter, and a purse that buys most of a shelf tests most of one.
 * `audit.test.ts` asserts it outright rather than trusting this comment, which is how the
 * number was caught trailing the catalogue: 5000 covered eleven relics comfortably and did
 * not cover thirty-six. Raised with headroom, so the next shelf to grow does not
 * immediately fail the same assertion.
 */
export const AUDIT_SPOILS = {
  ducats: 15000,
  marrowShards: 100,
  reagents: {
    core_pyre: 12,
    core_surge: 12,
    core_frost: 12,
    core_bulwark: 12,
    core_dusk: 12,
    core_bloom: 12,
  },
} as const;

function auditBounty(): Bounty {
  return {
    id: AUDIT_BOUNTY_ID,
    title: "Magistrate's Audit: The Smuggled Vault",
    // The easiest opposition on the board. A test loop that takes ten minutes to close is
    // not a test loop.
    difficulty: 'novice',
    enemySeed: 'novice_duelist',
    audit: true,
    spoils: {
      ducats: AUDIT_SPOILS.ducats,
      marrowShards: AUDIT_SPOILS.marrowShards,
      reagents: { ...AUDIT_SPOILS.reagents },
    },
    flavour:
      'Red wax, countersigned twice, and no clerk will admit to filing it. The vault was ' +
      'seized months ago and nobody has counted what is in it.',
  };
}

/**
 * The board: three rolled contracts and the audit, in poster order.
 *
 * Deterministic in the seed, so the same character always sees the same board until a
 * fight bumps it — the seeded generator the rest of the project uses, for the same reason
 * it uses it everywhere else. The audit is spliced in at index 2 rather than appended, so
 * it is poster #3 and the Master contract keeps its place on the board at #4.
 */
/**
 * What a Wandering Duelist puts up, by tier.
 *
 * Scaled off the tier's own pay rather than invented, so a duel is always roughly "the
 * job again, doubled or nothing" — and so retuning the pay table retunes the duels with
 * it instead of leaving them behind.
 */
export const TIER_WAGER: Record<BountyDifficulty, number> = {
  novice: 40,
  adept: 90,
  master: 180,
};

/** What a won wager pays back, including the stake. */
export const WAGER_MULTIPLIER = 2;

/**
 * Which contracts are duels.
 *
 * Only the fights that are actually a person across a board: a duelist bets, a ruin does
 * not. Checked by encounter rather than by tier so a new duelling encounter inherits it.
 */
export const DUEL_ENCOUNTERS: readonly string[] = ['novice_duelist'];

export function rollBounties(seed: number): Bounty[] {
  const rolled = rollTiers(seed);
  return [rolled[0]!, rolled[1]!, auditBounty(), rolled[2]!];
}

/**
 * One story contract, dressed as a Bounty for the board.
 *
 * Pays exactly what its tier pays (base + the same seeded spread the rolled contracts
 * get), so taking the campaign is never a tax and never a windfall — the story changes
 * what the work *is*, not what work is worth. Duels stake the tier wager, same as any
 * duelist. The id is prefixed rather than seeded because a story contract must be
 * recognisable across boards: it stays posted until it is done.
 */
export function storyBounty(contract: StoryContract, seed: number): Bounty {
  const rng = makeRng((seed ^ hashText(contract.id)) >>> 0);
  const pay = TIER_PAY[contract.tier];
  return {
    id: `story_${contract.id}`,
    title: contract.title,
    difficulty: contract.tier,
    enemySeed: contract.id,
    spoils: {
      ducats: pay.ducats + nextInt(rng, TIER_SPREAD[contract.tier] + 1),
      marrowShards: pay.marrowShards,
      ...(TIER_CORES[contract.tier] > 0
        ? { reagents: { [REAGENTS[nextInt(rng, REAGENTS.length)]!.id]: TIER_CORES[contract.tier] } }
        : {}),
    },
    ...(contract.wager ? { wager: TIER_WAGER[contract.tier] } : {}),
    flavour: contract.flavour,
  };
}

/**
 * One Wild Hunt, dressed as a Bounty so it can ride the road every other fight rides.
 *
 * A hunt is not posted on the board — it is taken at the gate — but everything downstream of
 * *taking* a contract is the same machinery: `takeBounty` finds the encounter, the
 * pre-combat screen locks the deck, `finishCombat` resolves it, and `resolveCombat` pays the
 * spoils and advances the bounty seed. Inventing a second path for hunts would have meant a
 * second place where a subjugation is claimed, and the first one is nine steps long.
 *
 * It also buys the repeatability for free, which is the part worth pointing at.
 * `resolveCombat` advances `bountySeed` after **every** finished fight, and
 * `claimSubjugation` salts its roll by how many beasts are already in the roster — so the
 * second Saltglass Seal is rolled off a different seed than the first without hunts having
 * to arrange anything.
 *
 * Pays its tier, exactly like a story contract, with the same seeded spread. Never wagered:
 * a wager is a bet against a person, and an animal has not agreed to anything.
 */
export function huntBounty(hunt: Hunt, seed: number): Bounty {
  const rng = makeRng((seed ^ hashText(hunt.encounterId)) >>> 0);
  const pay = TIER_PAY[hunt.tier];
  const encounter = encounterById(hunt.encounterId);
  return {
    id: `hunt_${hunt.encounterId}`,
    title: encounter?.name ?? hunt.encounterId,
    difficulty: hunt.tier,
    enemySeed: hunt.encounterId,
    spoils: {
      ducats: pay.ducats + nextInt(rng, TIER_SPREAD[hunt.tier] + 1),
      marrowShards: pay.marrowShards,
      ...(TIER_CORES[hunt.tier] > 0
        ? { reagents: { [REAGENTS[nextInt(rng, REAGENTS.length)]!.id]: TIER_CORES[hunt.tier] } }
        : {}),
    },
    flavour: encounter?.blurb ?? 'Standing work, past the gate.',
  };
}

/** Every hunt as a Bounty, in registry order. The gate panel's whole data source. */
export function huntBoard(seed: number): Bounty[] {
  return HUNTS.map((h) => huntBounty(h, seed));
}

/**
 * The board the player actually sees: the campaign first, dice after.
 *
 * Each tier's poster shows the next uncompleted story contract of that tier; once a
 * tier's arc is walked, the poster falls back to the rolled pool, which is the board the
 * game had before the campaign existed. The audit keeps its slot either way.
 */
export function composeBoard(seed: number, completed: readonly string[]): Bounty[] {
  const board = rollBounties(seed);
  const slotByTier: Record<BountyDifficulty, number> = { novice: 0, adept: 1, master: 3 };
  for (const tier of DIFFICULTIES) {
    const next = nextStoryContract(tier, completed);
    if (next) board[slotByTier[tier]] = storyBounty(next, seed);
  }
  return board;
}

/** The three real contracts, one per tier. */
function rollTiers(seed: number): Bounty[] {
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
        ...(TIER_CORES[difficulty] > 0
          ? { reagents: { [REAGENTS[nextInt(rng, REAGENTS.length)]!.id]: TIER_CORES[difficulty] } }
          : {}),
      },
      // A duel is a bet. Everything else is a job.
      ...(DUEL_ENCOUNTERS.includes(enemySeed) ? { wager: TIER_WAGER[difficulty] } : {}),
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
