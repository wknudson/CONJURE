/**
 * Roaming packs — the things on the road that are nobody's.
 *
 * A contract is a job. A hunt is an animal somebody wants bound. A pack is neither: it is
 * four or five bodies loose on the verge with no hero behind them, no Bound Form, and
 * nothing to negotiate with. You walk into one and you fight it, and when the last of them
 * is down the fight is over — which the engine had no way to express until `victory: 'rout'`,
 * because victory meant felling a commander and a pack has none.
 *
 * ## Ten points, and why that number
 *
 * `STARTING_WARBAND_POINTS` is 10: it is what the game already means by "one warband", the
 * budget a new Commander fields their own line out of. A pack is one warband's worth of
 * somebody else, costed on the **same** ladder through `rosterPointsOf` — footprint 2 is six,
 * an elite four, a ranged body three, a plain melee two.
 *
 * The compositions below are authored rather than generated. Generated packs would be
 * endless and would sit outside the balance harness, which plays eight games against every
 * registered encounter; these are registered, so a pack that cannot be beaten is a red test
 * rather than a bad afternoon. `packs.test.ts` re-derives every total, so the number in the
 * comment can never quietly stop being the number in the array.
 *
 * ## Reinforcements
 *
 * Five more points, if the roll says so. Not guaranteed, because the fiction is that they
 * *wandered in* — the road is busy and the fighting is loud. Rolled once at setup rather than
 * per turn: a lazy roll draws from the RNG every round and desyncs a replay against a fight
 * where it never happened.
 */

import type { BountyDifficulty } from './bounties.js';
import { CARDS } from './cards/index.js';
import { rosterPointsOf } from './roster.js';

export interface PackDef {
  /** The encounter walking into one starts. Registered in `encounters/packs.ts`. */
  readonly encounterId: string;
  readonly name: string;
  /** One line for the pre-combat screen, in the voice of the road rather than a poster. */
  readonly blurb: string;
  /** What the spoils pay at. Packs are novice-to-adept work; nothing out here is a Master. */
  readonly tier: BountyDifficulty;
  /** The bodies, as card ids. Summing to exactly `PACK_POINTS` on the roster ladder. */
  readonly members: readonly string[];
  /**
   * What may turn up later, and how likely it is.
   *
   * `chance` is out of 100. `unitCardIds` is drawn from in order until `points` is spent, so
   * the list is a priority rather than a set.
   */
  readonly reinforce: { readonly points: number; readonly chance: number; readonly unitCardIds: readonly string[] };
}

/** One warband's worth. The same 10 a new Commander fields. */
export const PACK_POINTS = 10;

/** What wanders in afterwards, when it wanders in at all. */
export const REINFORCE_POINTS = 5;

export const PACKS: readonly PackDef[] = [
  {
    encounterId: 'pack_chalk_scavengers',
    name: 'Chalk-Road Scavengers',
    blurb:
      'Four of them working a spill of dropped freight, and they have decided you are the ' +
      'second-best thing on this road tonight.',
    tier: 'novice',
    // 2 + 2 + 2 + 2 + 2 = 10
    members: ['vanguard_footman', 'vanguard_footman', 'scout_imp', 'scout_imp', 'marrow_wisp'],
    reinforce: { points: REINFORCE_POINTS, chance: 45, unitCardIds: ['vanguard_footman', 'scout_imp', 'marrow_wisp'] },
  },
  {
    encounterId: 'pack_verge_stray_dogs',
    name: 'The Verge Strays',
    blurb:
      'Foundry dogs that stopped going back. Fast, thin, and entirely uninterested in ' +
      'whether you were only passing through.',
    tier: 'novice',
    // 2 + 2 + 2 + 2 + 2 = 10
    members: ['ember_hound', 'ember_hound', 'soot_sprite', 'rime_fox', 'static_hare'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['ember_hound', 'rime_fox', 'static_hare'] },
  },
  {
    encounterId: 'pack_spoil_heap_hollows',
    name: 'Spoil-Heap Hollows',
    blurb:
      'Whatever the Census relocated, some of it walked back. They keep to the heaps in ' +
      'daylight, which tells you what hour it is.',
    tier: 'adept',
    // 2 + 2 + 2 + 2 + 2 = 10
    members: ['ash_ghoul', 'ash_ghoul', 'hollowed_husk', 'grave_sentinel', 'carrion_crow'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['ash_ghoul', 'hollowed_husk', 'carrion_crow'] },
  },
];

export function packByEncounter(encounterId: string): PackDef | undefined {
  return PACKS.find((p) => p.encounterId === encounterId);
}

export function isPack(encounterId: string): boolean {
  return PACKS.some((p) => p.encounterId === encounterId);
}

/**
 * The bodies a pack's reinforcement budget actually buys, as card ids.
 *
 * Pure and RNG-free, which is the point of pulling it out of the arrival code: the
 * overworld needs to know what a pulled pack *is* in order to hand it to the engine, and it
 * has no combat state to spend a budget against. The arrival path calls this too, so the
 * squad the ring promises and the squad that walks in can never be two different lists.
 *
 * Spent greedily down `unitCardIds`, which the field documents as a priority rather than a
 * set — the first entries are what the pack would rather have.
 */
export function reinforceSquad(pack: PackDef): string[] {
  const out: string[] = [];
  let budget = pack.reinforce.points;

  for (const defId of pack.reinforce.unitCardIds) {
    const def = CARDS[defId];
    if (!def) continue;
    const cost = rosterPointsOf(def);
    // A zero-cost body would spend nothing and repeat forever. Nothing on the ladder costs
    // zero, so this is a guard against a future card rather than a live case.
    if (cost <= 0) continue;
    while (budget >= cost) {
      out.push(defId);
      budget -= cost;
    }
    if (budget <= 0) break;
  }

  return out;
}
