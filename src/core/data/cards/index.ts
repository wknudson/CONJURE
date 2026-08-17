/**
 * The card registry.
 *
 * Cards live in per-school files and are merged here, so adding a school is adding a
 * file rather than growing one. Everything else in the codebase imports `CARDS` from
 * this module and never reaches into a school directly.
 */

import type { CardDef } from '../../types/cards.js';
import { STARTER_CARDS, STARTER_DECK } from './starter.js';
import { FROST_CARDS } from './frost.js';

export const CARDS: Record<string, CardDef> = {
  ...STARTER_CARDS,
  ...FROST_CARDS,
};

export { STARTER_DECK };

/** Card ids belonging to a school, for deck building and collection screens. */
export function cardsOfSchool(school: CardDef['school']): CardDef[] {
  return Object.values(CARDS).filter((c) => c.school === school);
}

// A duplicate id between schools would silently shadow one of them, which is exactly
// the kind of bug that only shows up as a mysteriously wrong card months later.
const seen = new Set<string>();
for (const source of [STARTER_CARDS, FROST_CARDS]) {
  for (const id of Object.keys(source)) {
    if (seen.has(id)) throw new Error(`duplicate card id across school files: ${id}`);
    seen.add(id);
  }
}
