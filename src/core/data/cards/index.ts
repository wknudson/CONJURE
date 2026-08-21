/**
 * The card registry.
 *
 * Cards live in per-school files and are merged here, so adding a school is adding a
 * file rather than growing one. Everything else in the codebase imports `CARDS` from
 * this module and never reaches into a school directly.
 */

import type { CardDef } from '../../types/cards.js';
import { ascendCardDef } from '../ascension.js';
import { STARTER_CARDS, STARTER_DECK } from './starter.js';
import { ARCANE_CARDS } from './arcane.js';
import { FROST_CARDS } from './frost.js';
import { COMPANION_UNIT_CARDS } from './companionUnits.js';
import { TERRAIN_CARDS } from './terrain.js';
import { RANGED_CARDS } from './ranged.js';
import { SURGE_CARDS } from './surge.js';
import { BLOOM_CARDS } from './bloom.js';
import { BULWARK_CARDS } from './bulwark.js';
import { DUSK_CARDS } from './dusk.js';
import { GASLAMP_CARDS } from './gaslamp.js';
import { WILDLIFE_CARDS } from './wildlife.js';
import { THREAT_CARDS } from './threats.js';
import { HYBRID_CARDS } from './hybrid.js';
import { AURA_CARDS } from './auras.js';

const RANK1: Record<string, CardDef> = {
  ...STARTER_CARDS,
  ...ARCANE_CARDS,
  ...FROST_CARDS,
  ...COMPANION_UNIT_CARDS,
  ...TERRAIN_CARDS,
  ...RANGED_CARDS,
  ...SURGE_CARDS,
  ...BLOOM_CARDS,
  ...BULWARK_CARDS,
  ...DUSK_CARDS,
  ...GASLAMP_CARDS,
  ...WILDLIFE_CARDS,
  ...THREAT_CARDS,
  ...HYBRID_CARDS,
  ...AURA_CARDS,
};

/**
 * The suffix a Rank 2 printing wears.
 *
 * `baseIdOf` has stripped `_r2` since long before Ascension existed, precisely so both
 * ranks would share one copy cap. Using the convention that was already there means deck
 * validation, tier limits and the builder need no idea that Ascension happened.
 */
export function ascendedId(cardId: string): string {
  return `${cardId}_r2`;
}

export function isAscendedId(cardId: string): boolean {
  return cardId.endsWith('_r2');
}

/**
 * Every Rank 2 printing, derived once at module load.
 *
 * Derived, not authored. `ascendCardDef` raises the card's numbers by a fixed 10% and
 * changes nothing else, so a Rank 2 is not a second card to design — it is the same card
 * hitting harder. See `data/ascension.ts` for what that covers and, more importantly, for
 * the four things it deliberately refuses to touch.
 *
 * Built here rather than looked up when a card is drawn, so the combat reducer never
 * learns that "ascended" is a thing at all: a Rank 2 card is simply a card, exactly as a
 * fight with an Ironbrew is simply a fight that started with armour.
 *
 * A card with no number to raise gets no entry. That absence is what the Forge reads to
 * decide it has nothing to sell you.
 */
const RANK2: Record<string, CardDef> = {};
for (const base of Object.values(RANK1)) {
  const raised = ascendCardDef(base, ascendedId(base.id));
  if (raised) RANK2[raised.id] = raised;
}

/**
 * Every printing in the game, both ranks.
 *
 * Rank 2 entries are real cards in the registry rather than a lookup performed at draw
 * time, so everything that already resolves a card id — the deck builder, the engine,
 * the snapshot layer, the tooltip — works on them unchanged.
 */
export const CARDS: Record<string, CardDef> = { ...RANK1, ...RANK2 };

/**
 * Card ids that have a Rank 2 printing to buy. Base ids only.
 *
 * Asks the registry rather than a flag on the card: whether a card can be ascended is now
 * a fact about whether it deals a number, and deriving it means a new card joins the Forge
 * by existing rather than by somebody remembering to mark it.
 */
export function ascendableIds(): string[] {
  return Object.values(RANK1)
    .filter((c) => !c.setupOnly && RANK2[ascendedId(c.id)])
    .map((c) => c.id)
    .sort();
}

export { STARTER_DECK };

/** Card ids belonging to a school, for deck building and collection screens. */
export function cardsOfSchool(school: CardDef['school']): CardDef[] {
  return Object.values(CARDS).filter((c) => c.school === school);
}

// A duplicate id between schools would silently shadow one of them, which is exactly
// the kind of bug that only shows up as a mysteriously wrong card months later.
const seen = new Set<string>();
for (const source of [
  STARTER_CARDS,
  ARCANE_CARDS,
  FROST_CARDS,
  COMPANION_UNIT_CARDS,
  TERRAIN_CARDS,
  RANGED_CARDS,
  SURGE_CARDS,
  BLOOM_CARDS,
  BULWARK_CARDS,
  DUSK_CARDS,
  GASLAMP_CARDS,
  WILDLIFE_CARDS,
  THREAT_CARDS,
  HYBRID_CARDS,
]) {
  for (const id of Object.keys(source)) {
    if (seen.has(id)) throw new Error(`duplicate card id across school files: ${id}`);
    seen.add(id);
  }
}
