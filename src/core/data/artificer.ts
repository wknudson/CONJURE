/**
 * The Ironworks Artificer's bench: what can be forged, and what it costs.
 *
 * Two trades share the bench. **Blueprint Forging** buys a card you do not own outright,
 * paid in Ducats and Marrow Shards. **Aetheric Splicing** is the other one — a base card
 * and a catalyst reagent pressed into a hybrid — and is not built yet; only its
 * vocabulary lives here, so the scaffolding has something real to name.
 *
 * DOM-free and beside the rest of `src/core/data/`: a forge price is a balance number,
 * and balance numbers do not belong in a template string.
 */

import type { CardDef } from '../types/cards.js';
import type { School } from '../../contract/ids.js';
import type { CardTier, Collection } from './deckRules.js';
import { CARDS } from './cards/index.js';
import { isObtainable } from './collection.js';
import { tierOf } from './deckRules.js';

// ------------------------------------------------------------------ forging

export interface ForgeCost {
  ducats: number;
  shards: number;
}

/**
 * Price by Tier, not by card.
 *
 * A per-card price list is a second balance table to keep in step with the first; tier
 * already encodes "how big is this", so the forge reads it rather than restating it. The
 * curve is steep on Shards deliberately — Ducats are earned by winning, Shards by
 * butchery, and a Tier 3 card should want both.
 */
export const FORGE_COST: Record<CardTier, ForgeCost> = {
  1: { ducats: 30, shards: 1 },
  2: { ducats: 70, shards: 2 },
  3: { ducats: 130, shards: 4 },
};

export function forgeCostOf(def: CardDef): ForgeCost {
  return FORGE_COST[tierOf(def)];
}

/**
 * Everything the player could forge but does not have.
 *
 * Owning one copy takes a card off the list entirely rather than offering the second and
 * third: the Artificer sells access to a card, and extra copies are what wins are for.
 */
export function blueprintsFor(collection: Collection): CardDef[] {
  return Object.values(CARDS)
    .filter((def) => isObtainable(def) && (collection.owned[def.id] ?? 0) === 0)
    .sort((a, b) => tierOf(a) - tierOf(b) || a.name.localeCompare(b.name));
}

export function canForge(
  cost: ForgeCost,
  purse: { ducats: number; marrowShards: number },
): boolean {
  return purse.ducats >= cost.ducats && purse.marrowShards >= cost.shards;
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
