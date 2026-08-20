/**
 * The Ironworks Artificer's bench: what it can make.
 *
 * Three trades share it. **Schematic Forging** cuts a card you have never held.
 * **Ascension** raises one you already know to its Rank 2 printing. **Aetheric Splicing**
 * presses a card and a reagent into a hybrid, and is not built yet — only its vocabulary
 * lives here, so the scaffolding has something real to name.
 *
 * The prices are not here: they are in `overworld/forge.ts` with the transactions that
 * charge them, because a cost and the check that it can be paid drifting apart is how a
 * button ends up promising something the till refuses.
 *
 * DOM-free and beside the rest of `src/core/data/`, so what the bench offers is testable
 * without mounting a screen.
 */

import type { CardDef } from '../types/cards.js';
import type { School } from '../../contract/ids.js';
import type { Collection } from './deckRules.js';
import { CARDS } from './cards/index.js';
import { isObtainable } from './collection.js';
import { tierOf } from './deckRules.js';

// --------------------------------------------------------------- schematics

/**
 * Every card the player could cut but does not have.
 *
 * Owning one copy takes a card off the list entirely rather than offering the second and
 * third: the bench sells *access* to a card, and extra copies are what winning is for —
 * which is what stops a rich player buying a finished deck outright.
 *
 * `isObtainable` is the gate, so Rank 2 printings and engine furniture stay off the shelf
 * for the same reason they stay out of reward rolls.
 *
 * Every unowned card is assumed to have a Schematic available. When Schematics become
 * things a player finds, this grows a second argument and nothing else changes.
 */
export function schematicsFor(collection: Collection): CardDef[] {
  return Object.values(CARDS)
    .filter((def) => isObtainable(def) && (collection.owned[def.id] ?? 0) === 0)
    .sort((a, b) => tierOf(a) - tierOf(b) || a.name.localeCompare(b.name));
}

/**
 * Everything the bench knows how to cut, owned or not.
 *
 * The counterpart to `schematicsFor`, which answers "what could I buy" and is what the
 * Safehouse counts on its door. This answers "what is there", which is the question a
 * workspace with a filter bar is for: sorting by unlock status means nothing on a list
 * that has already removed everything unlocked, and a player scanning for a card wants to
 * find it and see that they hold it rather than conclude the bench has never heard of it.
 *
 * Same `isObtainable` gate, so Rank 2 printings and engine furniture stay off the shelf.
 */
export function schematicCatalogue(): CardDef[] {
  return Object.values(CARDS)
    .filter((def) => isObtainable(def))
    .sort((a, b) => tierOf(a) - tierOf(b) || a.name.localeCompare(b.name));
}

// ----------------------------------------------------------------- splicing

/**
 * A reagent that can be pressed into a card on the splicing bench.
 *
 * Three, matching the three schools whose elemental reactions the engine already
 * understands — a catalyst that produced a hybrid with no reaction behind it would be a
 * promise the combat engine could not keep.
 */
export interface Catalyst {
  id: string;
  name: string;
  school: School;
  blurb: string;
}

export const CATALYSTS: readonly Catalyst[] = [
  {
    id: 'pyre_reagent',
    name: 'Pyre Reagent',
    school: 'pyre',
    blurb: 'Bottled furnace-slag. Adds burning to what it touches.',
  },
  {
    id: 'surge_reagent',
    name: 'Surge Reagent',
    school: 'surge',
    blurb: 'A caged arc, humming. Adds charge, and charge jumps.',
  },
  {
    id: 'frost_reagent',
    name: 'Frost Reagent',
    school: 'frost',
    blurb: 'Cold enough to make brass brittle. Adds slowing, and worse.',
  },
];
