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
import { CARDS } from './cards/index.js';

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
  // -------------------------------------------------------------- the second pressing
  //
  // Six rows that between them reach every school. Note what none of them needs: a new
  // Core. A pressing is *two* schools, and the base card is always one of them -- so a
  // Bulwark spell and a Pyre Core is a Pyre/Bulwark hybrid without Bulwark ever having to
  // be bottled. That is what keeps the reagent table at three entries while the book
  // covers ten pairings.
  {
    baseCardId: 'ember_coat',
    catalystId: 'core_frost',
    resultId: 'thermal_eruption',
    requiredUnlockedCards: ['glacial_spike'],
  },
  {
    baseCardId: 'arc_lash',
    catalystId: 'core_pyre',
    resultId: 'plasma_arc',
    requiredUnlockedCards: ['flame_surge'],
  },
  {
    baseCardId: 'seismic_slam',
    catalystId: 'core_pyre',
    resultId: 'magma_shove',
    requiredUnlockedCards: ['flame_surge'],
  },
  {
    baseCardId: 'spore_cloud',
    catalystId: 'core_pyre',
    resultId: 'scorched_earth',
    requiredUnlockedCards: ['flame_surge'],
  },
  {
    baseCardId: 'seismic_slam',
    catalystId: 'core_frost',
    resultId: 'icebreaker',
    requiredUnlockedCards: ['glacial_spike'],
  },
  {
    baseCardId: 'marrow_siphon',
    catalystId: 'core_surge',
    resultId: 'aetheric_overload',
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

/**
 * The two schools a fusion is pressed from, by result id.
 *
 * A Hybrid card is filed under *one* school — Vaporize Blast is frost — because a card has
 * to be filed somewhere. That filing is not the same fact as what it is made of, and the
 * two come apart exactly where it matters: a Pyre bloodline can reach Vaporize Blast,
 * because its own school is half the recipe, and asking `def.school` would say otherwise.
 *
 * Read off the recipe book, so a new pairing needs no second list kept in step with it.
 * Empty for anything the book has never pressed.
 */
export function hybridSchools(resultId: string): School[] {
  const recipe = SPLICE_RECIPES.find((r) => r.resultId === resultId);
  if (!recipe) return [];
  const catalyst = reagentById(recipe.catalystId)?.school;
  const base = CARDS[recipe.baseCardId]?.school;
  const both = [base, catalyst].filter((s): s is School => Boolean(s));
  return [...new Set(both)];
}

/** Every base card the book knows how to press, for filtering what to offer. */
export function spliceableBaseIds(): string[] {
  return [...new Set(SPLICE_RECIPES.map((r) => r.baseCardId))].sort();
}
