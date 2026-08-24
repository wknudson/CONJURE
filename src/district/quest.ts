/**
 * The guided first lap, as a function of what has already happened.
 *
 * Deliberately not a step counter. The flags are independent and checked by presence, so a
 * Commander who wanders into the Field Journal before the Artificer has still done the
 * Journal — the panel simply asks for the other one next. A counter would have had to
 * decide whether that visit "counted", and every answer to that question is a soft-lock
 * waiting for the one player who does things out of order.
 *
 * Pure: no three.js, no DOM, no save. It reads a ledger and returns strings.
 */

import type { TutorialFlag } from '../app/save.js';

export interface Pip {
  readonly key: 'artificer' | 'journal' | 'contract';
  readonly label: string;
  readonly lit: boolean;
}

const has = (flags: readonly TutorialFlag[], flag: TutorialFlag): boolean => flags.includes(flag);

/** Whether the panel should be on screen at all. Once the lap is walked, it goes away. */
export function tutorialActive(flags: readonly TutorialFlag[]): boolean {
  return !has(flags, 'complete');
}

/**
 * What the Commander is being asked to do next, or null once nothing is.
 *
 * Ordered by what teaches best, not by what is nearest: the Artificer before the Journal
 * because a bench you can see working explains itself, and the board last because taking a
 * contract is the one step that ends with leaving.
 */
export function currentObjective(flags: readonly TutorialFlag[]): string | null {
  if (has(flags, 'complete')) return null;
  if (!has(flags, 'intro')) return 'Report to Dispatcher Vex on the plaza';
  if (!has(flags, 'artificer')) return 'Visit the Ironworks Artificer, north up the walkway';
  if (!has(flags, 'journal')) return 'Visit the Field Journal, across the street';
  if (!has(flags, 'bounty_taken')) return 'Take the Novice contract from the Bounty Board';
  return 'Survive the contract';
}

/** The three marks on the panel. Lit ones are done. */
export function pipStates(flags: readonly TutorialFlag[]): Pip[] {
  const done = has(flags, 'complete');
  return [
    { key: 'artificer', label: 'artificer', lit: done || has(flags, 'artificer') },
    { key: 'journal', label: 'journal', lit: done || has(flags, 'journal') },
    { key: 'contract', label: 'contract', lit: done || has(flags, 'bounty_taken') },
  ];
}

/**
 * Whether the board will hand over a given contract yet.
 *
 * During the lap only the Novice posting is live. The others are not hidden — a new player
 * should see that a Master contract exists and that it is not for them today — but a
 * fresh Commander who takes the Ignis Trial as their first fight learns nothing from it
 * except that the game kills you.
 *
 * `noviceAffordable` is the escape hatch, and it is not optional. The Novice contract is a
 * duel, so it is the one posting that asks for a stake; every other tier is free to take.
 * A player who loses that stake would therefore be gated to the only fight they can no
 * longer pay for, with no way to earn. The gate exists to steer, so the moment it would
 * trap someone instead it opens.
 */
export function bountyAvailable(
  flags: readonly TutorialFlag[],
  difficulty: string,
  audit: boolean,
  noviceAffordable: boolean,
): boolean {
  if (!tutorialActive(flags)) return true;
  if (!noviceAffordable) return true;
  return difficulty === 'novice' && !audit;
}

/** Why a contract is greyed out, for the card that is greyed out. */
export const LOCKED_REASON = 'Prove yourself on a Novice contract first';

/** Which flag, if any, a door visit records. Only two of the four are steps. */
export function flagForDoor(key: string): TutorialFlag | null {
  if (key === 'artificer') return 'artificer';
  if (key === 'journal') return 'journal';
  return null;
}
