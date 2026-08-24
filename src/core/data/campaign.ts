/**
 * The King's Contracts: the story campaign, as data.
 *
 * Thirty contracts across the three tiers, walked in order, per
 * `docs/11_world_of_azo_and_the_kings_contracts.md`. Each is pinned 1:1 to an encounter —
 * the contract's id IS its encounter id — so completion can be recognised off the fight
 * that was fought without adding anything to the combat state.
 *
 * The board surfaces these through `composeBoard` in `bounties.ts`: each tier's poster
 * shows the next *uncompleted* story contract of that tier, and falls back to the rolled
 * pools once a tier's arc is done. Completion lives on the profile as a ledger of ids
 * (`Profile.campaign`), the same idiom as `rosterUnlocks` and `tutorial`.
 *
 * The `crack` is the reveal — the wrong-shaped detail the doc seeds each contract with.
 * Rough pass: it is shown as the notice modal when the player next steps onto the street,
 * which is where the death/rescue notices already appear.
 */

import type { BountyDifficulty } from './bounties.js';

export interface StoryContract {
  /** Equals the encounter id it sends you to. One contract, one fight, one name. */
  id: string;
  tier: BountyDifficulty;
  title: string;
  /** The job as the poster tells it — the lie, in the regime's own voice. */
  flavour: string;
  /** The reveal, shown on the street after the contract resolves. */
  crack: { title: string; body: string };
  /** Duels stake a wager instead of only paying a fee. */
  wager?: true;
}

/**
 * The campaign, in walking order within each tier.
 *
 * Wave 1 ships the first three Novice contracts and the first Adept one — the set the
 * design doc names as proving the clue plumbing. Later waves append; nothing here is
 * removed or reordered once shipped, because the ledger on the profile stores ids.
 */
export const STORY_CONTRACTS: readonly StoryContract[] = [
  // ---- Novice: Jolrek and its outskirts -------------------------------------------
  {
    id: 'lamprow_tithe',
    tier: 'novice',
    title: 'The Lamprow Tithe',
    flavour:
      'Arrears owed on lamp-tax, three seasons deep. Collect from the crew squatting ' +
      'behind the lighters’ hall. The Magistracy prefers the ledger settled quietly.',
    crack: {
      title: 'The Ledger, Settled',
      body:
        'You take their coin and count it against the arrears ledger Dispatch handed you. ' +
        'The debt is already marked paid. Twice. Two different clerks’ stamps, two ' +
        'different dates — and the crew’s copy of the receipt, crumpled in a pot on the ' +
        'stove, matches the first.',
    },
  },
  {
    id: 'bonemarket_vermin',
    tier: 'novice',
    title: 'Vermin of the Bonemarket',
    flavour:
      'A cinder-wasp nest in the awnings over Stall Row. Burn it out before market day. ' +
      'Posted by the stallholders’ association; paid by weight of comb recovered.',
    crack: {
      title: 'What the Comb Held',
      body:
        'The comb comes down heavier than comb should. Packed through every cell: chewed ' +
        'grain. The sacks it came from are still in the rafters, stamped with the ' +
        'Magistracy’s own seal — confiscated food, warehoused above a hungry market, ' +
        'never redistributed. The wasps found it first.',
    },
  },
  {
    id: 'curfew_breakers',
    tier: 'novice',
    title: 'The Curfew Breakers',
    flavour:
      'An unlawful assembly gathers in Ashfall after the bell, same corner, every night. ' +
      'Disperse it. The Wardens are stretched and the Magistracy dislikes patterns.',
    crack: {
      title: 'The Pattern',
      body:
        'They scatter, and behind where they stood is a bakery’s back door, still warm. ' +
        'The “assembly” was a bread queue. The dole was cut by writ the same week the ' +
        'curfew was posted — the queue did not move to the night. The night was moved ' +
        'onto the queue.',
    },
  },

  // ---- Adept: the Middle Ring ------------------------------------------------------
  {
    id: 'chalk_road_toll',
    tier: 'adept',
    title: 'The Chalk Road Toll',
    flavour:
      'Bandits are stopping grain wagons on the Chalk Road outside Millharrow. End it. ' +
      'Countersigned: the freight schedule does not move for weather or for sentiment.',
    crack: {
      title: 'The Toll, Counted',
      body:
        'Their whole haul, laid out on the verge: bread, seed-tools, a child’s boot. ' +
        'Their “chief” is fourteen and carries a tithe brand on the same wrist the ' +
        'manacle goes on. They were not robbing the wagons. They were robbing them back.',
    },
  },
];

/** The next uncompleted story contract of a tier, in shipped order. */
export function nextStoryContract(
  tier: BountyDifficulty,
  completed: readonly string[],
): StoryContract | undefined {
  return STORY_CONTRACTS.find((c) => c.tier === tier && !completed.includes(c.id));
}

/** The story contract a fight belongs to, if it is one. Keyed by encounter id. */
export function storyContractByEncounter(encounterId: string): StoryContract | undefined {
  return STORY_CONTRACTS.find((c) => c.id === encounterId);
}
