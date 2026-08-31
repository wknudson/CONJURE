/**
 * The regional apex lairs — the pay/tier half.
 *
 * A lair is a walk-to fight with no poster and no signpost: the ground itself is the
 * surfacing (`district/sites.ts` holds where each one stands and what gate opens it).
 * This file is the core-side registry, split from the placement the way `hunts.ts` is
 * split from the gate panel, and for the same reason: `bounties.ts` needs the tier to
 * pay the fight correctly, and core cannot import the district.
 *
 * Rematches ride the hunt clock: a won lair stamps the same cooldown map hunts use, and
 * a repeat binding is a different animal — the taming roll is salted by roster size, so
 * the second Seal never duplicates the first.
 */

import type { BountyDifficulty } from './bounties.js';

export interface Lair {
  /** The encounter the lair launches. */
  readonly encounterId: string;
  /** Pay grade — a lair unfiled here would quietly pay Novice. */
  readonly tier: BountyDifficulty;
  /** The region it stands in, for panels that group by ground. */
  readonly region: string;
}

export const LAIRS: readonly Lair[] = [
  { encounterId: 'caldera_tortoise', tier: 'adept', region: 'The Caldera' },
  { encounterId: 'caldera_wasps', tier: 'adept', region: 'The Caldera' },
  { encounterId: 'rimefield_gargoyle', tier: 'master', region: 'The Rimefields' },
];

export function lairByEncounter(encounterId: string): Lair | undefined {
  return LAIRS.find((l) => l.encounterId === encounterId);
}

export function isLair(encounterId: string): boolean {
  return LAIRS.some((l) => l.encounterId === encounterId);
}
