/**
 * The Threat Ledger's roster: what can be met, and what is known about it.
 *
 * The list is derived from the card registry rather than hand-written, so a new enemy is
 * a card file edit and nothing else. A hand-kept roster would be a second list to update
 * and the one that quietly falls behind.
 *
 * "Enemy" here means *any* stat block that can stand on a board — the player's own
 * minions included, since the Novice Duelist fields Scout Imps exactly as the player
 * does. The Ledger records what was faced, not what belongs to whom.
 */

import type { CardDef } from '../types/cards.js';
import type { Bestiary } from '../overworld/state.js';
import { CARDS } from './cards/index.js';

/** Every card that puts a body on the board, sorted so the Ledger is stable. */
export function bestiaryRoster(): CardDef[] {
  return Object.values(CARDS)
    .filter((def) => def.unit !== undefined)
    // Rank 2 printings are the same creature with better numbers, not a second entry.
    .filter((def) => !def.id.endsWith('_r2'))
    .sort((a, b) => (a.unit!.hp + a.unit!.atk) - (b.unit!.hp + b.unit!.atk) || a.name.localeCompare(b.name));
}

/**
 * Whether the Ledger will print this thing's details.
 *
 * Killing it is the price of knowing it. Meeting one and running teaches you nothing —
 * which is the whole reason the Ledger has an `encountered` tally as well: it can say
 * "you have seen four of these and never put one down".
 */
export function isIdentified(bestiary: Bestiary, defId: string): boolean {
  return (bestiary[defId]?.defeated ?? 0) > 0;
}

export interface LedgerEntry {
  def: CardDef;
  encountered: number;
  defeated: number;
  identified: boolean;
}

export function ledgerFor(bestiary: Bestiary): LedgerEntry[] {
  return bestiaryRoster().map((def) => {
    const tally = bestiary[def.id];
    return {
      def,
      encountered: tally?.encountered ?? 0,
      defeated: tally?.defeated ?? 0,
      identified: isIdentified(bestiary, def.id),
    };
  });
}

/** How much of the Ledger has been filled in, for the tab's own status line. */
export function ledgerProgress(bestiary: Bestiary): { known: number; total: number } {
  const roster = bestiaryRoster();
  return {
    known: roster.filter((def) => isIdentified(bestiary, def.id)).length,
    total: roster.length,
  };
}
