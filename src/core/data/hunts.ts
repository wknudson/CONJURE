/**
 * Wild Hunts — the standing work, out past the ward gate.
 *
 * A contract is a job somebody posted, and every one of them is finite: thirty story
 * contracts, walked once, and then that tier's poster falls back to a rolled pool of four
 * fights. A hunt is the other thing. Nobody posted it, nothing completes it, and the reason
 * to go again is the animal rather than the fee.
 *
 * ## Why they repeat
 *
 * Because what a hunt pays out is *rolled*, and the rolls are the content. A caught beast
 * draws its own eight-card Grimoire out of its bloodline's pool, rolls a constitution, rolls
 * one knack out of its species' pool, rolls per-card modifiers on the eight it drew, and
 * rolls — one time in a hundred — lustrous. Two Saltglass Seals are two different animals in
 * every one of those respects, and the whole `omit` mechanism exists so that they are not
 * even drawing from the same shelf as a Boreas.
 *
 * That is the argument for a cooldown rather than a lockout, and for a cooldown rather than
 * nothing. A hunt you can take forever is a grind; a hunt you can take once is a contract
 * wearing a different hat.
 *
 * ## Why the clock is not in here
 *
 * `HUNT_COOLDOWN_MS` is a duration and nothing in this module reads a clock. Every function
 * below takes `now` as an argument, because `src/core` is deterministic by construction —
 * the same inputs produce the same outputs, which is what makes a replay a replay and a
 * seeded test a test. `Date.now()` is called at the two edges that genuinely live in real
 * time: the HUD that draws the countdown, and `main.ts` when it stamps a finished hunt.
 *
 * The cooldown is therefore **wall-clock, not play-time**: it runs down while the game is
 * closed. That is deliberate — a ten-minute timer that only ticks while you are staring at
 * it is a tax on the player's attention, and this one is meant to be a reason to go and do
 * something else in the ward.
 */

import type { BountyDifficulty } from './bounties.js';

/**
 * How long a hunt is empty for after it pays out.
 *
 * Ten minutes of real time. Long enough that a player clears the board, spends the money and
 * comes back rather than re-running one fight; short enough that a session can see a hunt
 * twice. It is one number for every hunt on purpose — a per-tier cooldown would say master
 * beasts are rarer, which the tier already says through the fight itself.
 */
export const HUNT_COOLDOWN_MS = 10 * 60 * 1000;

export interface Hunt {
  /** The fight, by encounter id. */
  encounterId: string;
  /** The species bound by winning it, by Companion id. Always the encounter's own prize. */
  species: string;
  /** Which poster tier this hunt's spoils pay at. */
  tier: BountyDifficulty;
  /** Where in Azo it is, for the panel's grouping. */
  region: string;
}

/**
 * Every beast the wilds will give you, and where it lives.
 *
 * Twelve: the six founding bloodlines and the six second ones. **The founders are here on
 * purpose, including the one the player enrolled with.** A character begins vowed to exactly
 * one of the six, and the other five were previously unreachable in a finished save — there
 * was no way to ever field a Boreas if you had picked Ignis at creation, which quietly made
 * five sixths of the starting roster unplayable content.
 *
 * Listing the player's *own* species alongside them is the same decision taken to its
 * conclusion. A second Ignis is not a duplicate: it is a different eight cards, a different
 * knack, a different constitution, and a one-in-a-hundred chance of being lustrous. Hiding
 * it would be the game deciding the player cannot want another one.
 *
 * The hybrids are deliberately **not** here. Every one of them is bound off a named enemy in
 * the campaign — a duelist's beast, a contract's apex — and a hybrid available on a
 * ten-minute timer would flatten that into a shopping list. What is repeatable is the wild;
 * what is one-shot is the story.
 */
export const HUNTS: readonly Hunt[] = [
  // ------------------------------------------------------------------ the founders
  {
    encounterId: 'hunt_caldera_drake',
    species: 'ignis',
    tier: 'novice',
    region: 'The Caldera',
  },
  {
    encounterId: 'hunt_rimefield_bear',
    species: 'boreas',
    tier: 'adept',
    region: 'The Rimefields',
  },
  {
    encounterId: 'hunt_shelf_lynx',
    species: 'voltara',
    tier: 'adept',
    region: 'The Storm Shelf',
  },
  {
    encounterId: 'hunt_ashwood_stag',
    species: 'mortis',
    tier: 'master',
    region: 'The Ashwood',
  },
  {
    encounterId: 'hunt_ashwood_warden',
    species: 'sylva',
    tier: 'novice',
    region: 'The Ashwood',
  },
  {
    encounterId: 'hunt_chalk_boar',
    species: 'ferrum',
    tier: 'novice',
    region: 'The Chalk Road',
  },

  // ------------------------------------------------------- the second bloodlines
  {
    encounterId: 'hunt_cinderworks_salamander',
    species: 'salamander',
    tier: 'novice',
    region: 'The Cinderworks',
  },
  {
    encounterId: 'hunt_chalk_cut_ram',
    species: 'ram',
    tier: 'novice',
    region: 'The Chalk Road',
  },
  {
    encounterId: 'hunt_saltglass_seal',
    species: 'seal',
    tier: 'adept',
    region: 'Saltglass',
  },
  {
    encounterId: 'hunt_tallow_aurochs',
    species: 'aurochs',
    tier: 'adept',
    region: 'The Tallow Levels',
  },
  {
    encounterId: 'hunt_pylon_kudu',
    species: 'kudu',
    tier: 'master',
    region: 'The Storm Shelf',
  },
  {
    encounterId: 'hunt_barrow_jackal',
    species: 'jackal',
    tier: 'master',
    region: 'The Bone Bastion',
  },
];

export function huntByEncounter(encounterId: string): Hunt | undefined {
  return HUNTS.find((h) => h.encounterId === encounterId);
}

/** Whether an encounter id is a hunt at all. The board asks this; so does the tier table. */
export function isHunt(encounterId: string): boolean {
  return HUNTS.some((h) => h.encounterId === encounterId);
}

/**
 * Milliseconds until a hunt is walkable again. Zero means now.
 *
 * `last` is when it was last completed, or `undefined` for a hunt never taken. Both `now`
 * and `last` are epoch milliseconds and both come from the caller — see the module note.
 *
 * **A stamp in the future is treated as expired**, not as a very long wait. A clock rolled
 * back an hour, a save carried between machines in different time zones, or a hand-edited
 * profile would otherwise lock a hunt for as long as the discrepancy lasts, and there is no
 * reading of the player's intent under which that is the right answer. Erring toward
 * available is also the safer direction: the cost of being wrong is one extra hunt.
 */
export function huntCooldownRemaining(last: number | undefined, now: number): number {
  if (last === undefined || !Number.isFinite(last)) return 0;
  if (last > now) return 0;
  return Math.max(0, HUNT_COOLDOWN_MS - (now - last));
}

export function huntAvailable(last: number | undefined, now: number): boolean {
  return huntCooldownRemaining(last, now) === 0;
}

/**
 * "returns in 7m", for the panel.
 *
 * Rounds **up** to the next whole minute, so a hunt never reads "returns in 0m" while it is
 * still locked — a countdown that says zero and then refuses the click is worse than one
 * that overstates by fifty seconds.
 */
export function huntCooldownLabel(remainingMs: number): string {
  if (remainingMs <= 0) return '';
  const minutes = Math.ceil(remainingMs / 60_000);
  return minutes === 1 ? 'returns in a minute' : `returns in ${minutes}m`;
}
