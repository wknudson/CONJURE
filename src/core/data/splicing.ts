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
  /**
   * Cards that must already be unlocked before the bench will attempt this pressing.
   *
   * A hybrid is two schools fused, and the base card only ever accounts for one of them.
   * The prerequisite is the *other* half: you may not press a Vaporize Blast out of a fire
   * spell and a cold rock unless you have actually learned to cast frost. It turns the
   * bench from a shop into a payoff for having played both schools.
   *
   * **Never consumed.** These are permanent unlocks, and an unlock that could be spent
   * would not be one — the same rule that stopped the base card being eaten. The Core is
   * the whole price; this is the qualification.
   *
   * `baseCardId` is checked separately and needs no entry here.
   */
  requiredUnlockedCards?: readonly string[];
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
    requiredUnlockedCards: ['glacial_spike'],
  },
  {
    baseCardId: 'flame_surge',
    catalystId: 'core_surge',
    resultId: 'overload_strike',
    requiredUnlockedCards: ['arc_lash'],
  },
  // The mirror of the first row, and the only thing a Pyre Core is good for. Until this
  // existed the bench had no recipe taking one at all, so a core earned from a Master
  // contract could sit in the bag forever with nothing to spend it on.
  {
    baseCardId: 'glacial_spike',
    catalystId: 'core_pyre',
    resultId: 'cryo_combustion',
    requiredUnlockedCards: ['flame_surge'],
  },
  {
    baseCardId: 'spore_cloud',
    catalystId: 'core_surge',
    resultId: 'galvanic_spores',
    requiredUnlockedCards: ['arc_lash'],
  },
  {
    baseCardId: 'dark_tithe',
    catalystId: 'core_surge',
    resultId: 'aetheric_defibrillator',
    requiredUnlockedCards: ['arc_lash'],
  },
];

/**
 * Guards the book against two rows claiming the same pressing.
 *
 * `recipeFor` takes the first match, so a duplicate pairing would make the later row
 * unreachable — a card in the registry that no amount of play could ever produce. Checked
 * at module load rather than in a test, because the failure is silent everywhere else.
 */
{
  const seen = new Set<string>();
  for (const r of SPLICE_RECIPES) {
    const key = `${r.baseCardId}+${r.catalystId}`;
    if (seen.has(key)) throw new Error(`duplicate splice recipe: ${key}`);
    seen.add(key);
    // A prerequisite naming the recipe's own product would be a card gated behind itself:
    // unreachable, and silently so everywhere except here.
    if (r.requiredUnlockedCards?.includes(r.resultId)) {
      throw new Error(`splice recipe ${key} requires its own result`);
    }
  }
}

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
