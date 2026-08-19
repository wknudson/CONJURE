/**
 * The splicing bench's materials and its recipe book.
 *
 * A recipe is a lookup, not a construction: base card plus reagent names a hybrid that
 * already exists in the registry. That is the whole safety property — a splice can only
 * ever produce a card the engine already knows how to resolve, so the bench cannot invent
 * something that fails in combat instead of at the counter.
 *
 * Pure data, DOM-free, and it imports nothing from the engine.
 */

import type { School } from '../../contract/ids.js';

/**
 * A material the bench consumes.
 *
 * Ids are `core_<school>` and are the same strings used as keys in
 * `economy.reagents` — one spelling from the bag to the recipe, so a reagent cannot be
 * held under one name and required under another.
 */
export interface Reagent {
  id: string;
  name: string;
  school: School;
  blurb: string;
}

export const REAGENTS: readonly Reagent[] = [
  {
    id: 'core_pyre',
    name: 'Pyre Core',
    school: 'pyre',
    blurb: 'Bottled furnace-slag, still ticking as it cools.',
  },
  {
    id: 'core_surge',
    name: 'Surge Core',
    school: 'surge',
    blurb: 'A caged arc. It hums when another one is near.',
  },
  {
    id: 'core_frost',
    name: 'Frost Core',
    school: 'frost',
    blurb: 'Cold enough to make brass brittle. Handle with tongs.',
  },
];

export function reagentById(id: string): Reagent | undefined {
  return REAGENTS.find((r) => r.id === id);
}

/**
 * One pressing: a card, a core, and what comes out.
 *
 * Flat rows rather than a nested map so a recipe reads as a sentence and the table can be
 * scanned for what a given reagent is good for.
 */
export interface SpliceRecipe {
  baseCardId: string;
  catalystId: string;
  resultId: string;
}

/**
 * The book.
 *
 * Both current recipes take the same base card, which is deliberate: the interesting
 * decision is *which core* to spend, not which card to feed in. `flame_surge` is the
 * common Pyre spell every starter deck carries, so the bench is reachable on day one.
 */
export const SPLICE_RECIPES: readonly SpliceRecipe[] = [
  {
    baseCardId: 'flame_surge',
    catalystId: 'core_frost',
    resultId: 'vaporize_blast',
  },
  {
    baseCardId: 'flame_surge',
    catalystId: 'core_surge',
    resultId: 'superconduct_strike',
  },
];

/** The recipe for a pairing, or undefined if the bench has never heard of it. */
export function recipeFor(baseCardId: string, catalystId: string): SpliceRecipe | undefined {
  return SPLICE_RECIPES.find(
    (r) => r.baseCardId === baseCardId && r.catalystId === catalystId,
  );
}

/** Every base card the book knows how to press, for filtering what to offer. */
export function spliceableBaseIds(): string[] {
  return [...new Set(SPLICE_RECIPES.map((r) => r.baseCardId))].sort();
}
