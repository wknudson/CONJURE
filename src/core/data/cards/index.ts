/**
 * The card registry.
 *
 * Cards live in per-school files and are merged here, so adding a school is adding a
 * file rather than growing one. Everything else in the codebase imports `CARDS` from
 * this module and never reaches into a school directly.
 */

import type { CardDef } from '../../types/cards.js';
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
 * Applies a `rank2` block to its Rank 1 printing.
 *
 * Done once here, at module load, rather than in the engine when a card is drawn. The
 * combat reducer therefore never learns what "ascended" means — a Rank 2 card is simply
 * a card, exactly as a fight with an Ironbrew is simply a fight that started with armour.
 * One less thing the pure engine has to be told about, and one less place for a merge to
 * happen differently than it did last time.
 */
function ascend(base: CardDef): CardDef {
  // `unit` is pulled out of the spread deliberately: it is the one override that is a
  // partial, so letting it land whole would replace a full stat block with a fragment.
  const { unit: unitOverride, ...flat } = base.rank2!;
  const merged: CardDef = {
    ...base,
    ...flat,
    id: ascendedId(base.id),
    name: flat.name ?? `${base.name} +`,
    ...(base.unit ? { unit: { ...base.unit, ...(unitOverride ?? {}) } } : {}),
  };
  // The upgraded printing has no upgrade of its own. Rank 3 would be a new field rather
  // than a chain — and without this, an ascended card would claim it could be ascended
  // again, and the forge would offer it.
  delete merged.rank2;
  return merged;
}

const RANK2: Record<string, CardDef> = {};
for (const base of Object.values(RANK1)) {
  if (base.rank2) RANK2[ascendedId(base.id)] = ascend(base);
}

/**
 * Every printing in the game, both ranks.
 *
 * Rank 2 entries are real cards in the registry rather than a lookup performed at draw
 * time, so everything that already resolves a card id — the deck builder, the engine,
 * the snapshot layer, the tooltip — works on them unchanged.
 */
export const CARDS: Record<string, CardDef> = { ...RANK1, ...RANK2 };

/** Card ids that have a Rank 2 printing to buy. Base ids only. */
export function ascendableIds(): string[] {
  return Object.values(RANK1)
    .filter((c) => c.rank2 && !c.setupOnly)
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
