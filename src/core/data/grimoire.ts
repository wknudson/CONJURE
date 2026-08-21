/**
 * The Grimoire draft — which eight spells a caught beast actually turns out to know.
 *
 * A Companion used to bring a fixed list. Every Ignis anybody ever tamed carried the same
 * eight cards, so a second Ignis was worth nothing: the only thing that differed was a
 * health roll and a knack. Catching one was a checkbox.
 *
 * A Companion now **drafts** its eight from its bloodline's pool. Two Ignis are two
 * different decks — one heavy on runes, one that happened to roll three Cataclysms — and
 * that is the reason to go and catch a second one.
 *
 * ## What the weighting is for
 *
 * A pool with no weighting is a pool where an Ignis is a random pile of fire, and every
 * Ignis is the same random pile as every other. The weights make a bloodline mean
 * something:
 *
 *  - A **mono-element** beast rolls almost entirely from its own school. Its rare roll is
 *    a Hybrid built on that school — the one card a player would keep a beast for.
 *  - A **hybrid** beast draws from two schools at once and rolls their shared Hybrids far
 *    more often, because mixing them *is* what it is for.
 *
 * ## The one guard
 *
 * Copies are capped by Tier, exactly as a Hero Deck's are. Without it a beast could roll
 * eight copies of a Power Tier finisher, which is not a lucky beast — it is a broken one,
 * and it would be the only beast anybody used.
 */

import type { School } from '../../contract/ids.js';
import type { CardDef } from '../types/cards.js';
import type { RngState } from '../util/rng.js';
import { nextInt } from '../util/rng.js';
import { CARDS, isAscendedId } from './cards/index.js';
import { TIER_COPY_LIMIT, tierOf } from './deckRules.js';
import { isEngineDealt } from './collection.js';
import { hybridSchools } from './splicing.js';

/**
 * Where a species draws its eight from.
 *
 * Two schools rather than one is what makes a Chimera possible: the pool is the union, and
 * the Hybrid branch draws on cards belonging to *both*. A mono-element beast is the same
 * shape with one entry, which is why there is no separate case for it anywhere below.
 */
export interface GrimoireSource {
  schools: School[];
  /**
   * Chance in a hundred that a slot rolls a Hybrid instead of a pure card.
   *
   * Small for a mono-element beast — a Pyre drake that knew a fire-and-ice fusion is a
   * story, and stories should be rare. Large for a hybrid, whose whole identity is the
   * seam between two schools.
   */
  hybridChance: number;
}

/** The rarity a mono-element bloodline rolls a Hybrid at. Roughly one beast in three. */
export const MONO_HYBRID_CHANCE = 5;

/** A hybrid bloodline's, by contrast: about a third of its book. */
export const HYBRID_HYBRID_CHANCE = 35;

/**
 * Whether a card may be drafted into any Grimoire at all.
 *
 * Bodies are excluded because minions stopped being cards you hold — they are bought into
 * a Vanguard Roster out of a point budget, and a Grimoire that dealt one would be dealing
 * a card no deck is allowed to contain. Rank 2 printings are excluded because Ascension is
 * something the player buys for a card they own, not something a beast arrives having
 * already done.
 */
export function isDraftable(def: CardDef): boolean {
  // The Rite and the setup-only stat blocks. Asked through the shared predicate rather
  // than restated, because a Lexis drafting the Harpoon Protocol into its opening hand is
  // exactly the bug that rule exists to stop.
  if (isEngineDealt(def)) return false;
  if (def.kind === 'minion') return false;
  if (isAscendedId(def.id)) return false;
  return true;
}

/** Whether this card is a fusion of two schools — the rare roll. */
function isHybrid(def: CardDef): boolean {
  return def.spliceOnly === true;
}

/**
 * The pure half of a bloodline's pool: its own schools, no fusions.
 *
 * Sorted by id, because a pool whose order came out of `Object.values` would reshuffle
 * every Grimoire in every save the day somebody added a card to the wrong file.
 */
export function purePool(source: GrimoireSource): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isDraftable(c) && !isHybrid(c) && source.schools.includes(c.school))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The rare half: fusions this bloodline can reach.
 *
 * A Hybrid card carries one school of its own — Vaporize Blast is filed under frost — so
 * matching on that alone would hand a Pyre drake nothing and a Frost bear everything. What
 * decides reachability is the *recipe*: a fusion is in reach when this bloodline supplies
 * at least one of the two schools that press it.
 */
export function hybridPool(source: GrimoireSource): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isDraftable(c) && isHybrid(c))
    .filter((c) => hybridSchools(c.id).some((s) => source.schools.includes(s)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The last resort: colourless utility, for a bloodline whose own shelf is too short.
 *
 * Bulwark has two spells to its name and Surge has three, so neither can fill eight out of
 * its own school even with every copy the Tier limits allow. Rather than deal a short book
 * — silently, forever — a thin bloodline tops up from `neutral`, which is the same
 * colourless pool a Hero Deck draws on.
 *
 * **This is a content gap wearing a rule.** It fires only when a bloodline runs out, so the
 * day Bulwark has eight spells' worth of its own is the day this stops happening, with
 * nothing to remove. Until then a Vault Boar knows two Bulwark spells very well and pads
 * the rest with a hammer, which is at least an honest description of a Vault Boar.
 */
function neutralPool(): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isDraftable(c) && !isHybrid(c) && c.school === 'neutral')
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Draws one Grimoire.
 *
 * Slot by slot rather than as a shuffle-and-take, because the two pools are weighted
 * against each other per slot rather than merged into one bag — and because a beast that
 * rolled its rare Hybrid should have rolled it *once*, on one slot, rather than having the
 * whole draw tilt.
 *
 * The Tier cap is applied by narrowing the pool *before* each draw rather than by drawing
 * and re-drawing. That matters for the thin schools: Surge has three spells to its name, so
 * a re-draw loop spends most of its attempts landing on cards that are already at their cap
 * and gives up with a short book. Narrowing first cannot fail while any capacity remains,
 * and the arithmetic is eight passes over a list of a dozen.
 *
 * A slot with genuinely nothing left to give stops the draw. A bloodline whose whole pool
 * cannot fill eight deals a short Grimoire and is caught by the test that counts them,
 * rather than hanging the game.
 */
export function draftGrimoire(rng: RngState, source: GrimoireSource, size: number): string[] {
  const pure = purePool(source);
  const hybrids = hybridPool(source);
  const neutral = neutralPool();
  const drawn: string[] = [];
  const copies = new Map<string, number>();

  const under = (pool: CardDef[]): CardDef[] =>
    pool.filter((c) => (copies.get(c.id) ?? 0) < TIER_COPY_LIMIT[tierOf(c)]);

  for (let slot = 0; slot < size; slot++) {
    // Rolled every slot, and rolled even when the hybrid pool is empty, so that adding a
    // fusion to a school later does not move every existing beast's draw.
    const wantsHybrid = nextInt(rng, 100) < source.hybridChance;

    // What this slot wants, then what is left. The chain is ordered by how much of the
    // bloodline's identity each option carries: its own school first, its fusions next,
    // colourless utility only when the shelf is genuinely bare.
    const order = wantsHybrid && hybrids.length > 0 ? [hybrids, pure, neutral] : [pure, hybrids, neutral];
    const legal = order.map(under).find((p) => p.length > 0);
    if (!legal) break;

    const picked = legal[nextInt(rng, legal.length)]!;
    drawn.push(picked.id);
    copies.set(picked.id, (copies.get(picked.id) ?? 0) + 1);
  }

  return drawn;
}
