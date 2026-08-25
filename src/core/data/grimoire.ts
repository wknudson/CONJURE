/**
 * The Grimoire draft — which eight spells a caught beast actually turns out to know.
 *
 * A Companion used to bring a fixed list. Every Ignis anybody ever tamed carried the same
 * eight cards, so a second Ignis was worth nothing: the only thing that differed was a
 * health roll and a knack. Catching one was a checkbox.
 *
 * A Companion now **drafts** its eight from its bloodline's pool. Two Ignis are two
 * different decks — one heavy on Ashen Wakes, one that happened to roll three Cataclysms —
 * and that is the reason to go and catch a second one.
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
  /**
   * Cards this bloodline never learns, by id. What makes two beasts of one school two
   * shelves instead of one shelf drawn twice.
   *
   * The pool used to be a pure function of `schools`, which was fine while every school had
   * exactly one species speaking it. It stopped being fine the moment a second Frost
   * bloodline existed: two species with the same school drew from a byte-identical pool, so
   * the only thing separating a Boreas from its cousin was a knack and a health roll — the
   * same "the second one is a checkbox" problem the draft was written to solve, moved up a
   * level from instances to species.
   *
   * Deliberately a **subtraction and a small one**. The two beasts of a school are meant to
   * share most of a shelf and disagree at the edges: a common core either can roll, plus a
   * few signature cards only one of them ever will. An exclusion list keeps that honest,
   * because the omitted cards are named where a reader can see them and the school's shelf
   * stays the one authoritative list of what the school *has*. A per-species allow-list
   * would say the same thing four times as long, and would silently drop every card
   * authored after it.
   *
   * Not a weighting. A rarity dial would make the difference statistical — noticeable across
   * fifty catches and invisible across five — and the point is that a player who catches
   * both can tell them apart.
   */
  omit?: readonly string[];
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
  // A Mark is the Hero's trap. A beast that drafted one would be holding a card its own
  // half of the deck is not allowed to contain, and the Field Journal would show a Grimoire
  // slot no socket could legally replace.
  if (def.kind === 'mark') return false;
  if (isAscendedId(def.id)) return false;
  return true;
}

/**
 * What a Companion's own shelves may hand it.
 *
 * The Grimoire is **elemental magic and the ground it stands on**: Spells, and the
 * Constructs a beast raises out of its own school. Abilities are excluded because they are
 * the colourless half the Hero builds — a Grimoire dealing a Shield Bash would be dealing
 * the player a card they already chose not to run.
 *
 * Constructs are deliberately still here, and it is the one place this rule reads looser
 * than "exclusively Spells". Pyre Pillar, Coolant Pillar, Ice Barricade and Smoke Bank are
 * elemental, so no Hero Deck may hold them either; dropping them from the draft as well
 * would leave four cards in the registry that nothing in the game can ever deal. Orphaning
 * content is a worse outcome than a Grimoire that occasionally raises a wall.
 */
export function isBloodlineCard(def: CardDef): boolean {
  return def.kind === 'spell' || def.kind === 'obstacle';
}

/** Whether this card is a fusion of two schools — the rare roll. */
export function isHybrid(def: CardDef): boolean {
  return def.spliceOnly === true;
}

/**
 * Whether one card belongs to one bloodline's pure shelf.
 *
 * The single answer to "may this beast learn this card", shared by `purePool` here and by
 * `SPELL_POOLS_BY_SPECIES` in `data/pools.ts`. Those two are the game's answer and the
 * screen's answer to the same question, and they have already drifted once — the role
 * overhaul taught one of them to refuse Marks and left the other taking anything draftable,
 * which surfaced to the player as a Vow card reading "8 of 7 spells". They share a function
 * now rather than a resemblance.
 */
export function inPurePool(source: GrimoireSource, def: CardDef): boolean {
  if (!isDraftable(def) || !isBloodlineCard(def) || isHybrid(def)) return false;
  if (!source.schools.includes(def.school)) return false;
  return !source.omit?.includes(def.id);
}

/**
 * The pure half of a bloodline's pool: its own schools, no fusions, less what it never
 * learns.
 *
 * Sorted by id, because a pool whose order came out of `Object.values` would reshuffle
 * every Grimoire in every save the day somebody added a card to the wrong file.
 */
export function purePool(source: GrimoireSource): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => inPurePool(source, c))
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
    .filter((c) => isDraftable(c) && isBloodlineCard(c) && isHybrid(c))
    .filter((c) => hybridSchools(c.id).some((s) => source.schools.includes(s)))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The last resort: colourless utility, for a bloodline whose own shelf is too short.
 *
 * Rather than deal a short book — silently, forever — a thin bloodline tops up from the
 * colourless shelves, which is the same pool a Hero Deck draws on.
 *
 * Marks are excluded even here. Everything else about this pool is a compromise; that one
 * is a rule, and it is the whole point of Phase 3: a beast must never end up holding the
 * Hero's trap, least of all by the back door of a shelf that ran dry.
 *
 * **This is a content gap wearing a rule**, and the overhaul made it a permanent one for
 * exactly one bloodline. It used to fire only for the thin elemental schools, and those are
 * now comfortably clear of it — every elemental species can fill eight out of its own
 * Spells and fusions. **Lexis cannot, and never will.** Its school is `arcane`, "Spell" now
 * means *elemental* magic, and arcane is by definition not elemental — so an Ink Owl's own
 * shelf holds two Constructs and nothing else, and the other six slots come from here.
 *
 * That is a real question for the Director rather than something to hide behind a
 * fallback: either arcane gets Spells of its own, or Lexis stops being a drafting
 * bloodline, or an Ink Owl is *defined* as the beast that lends the Hero its own tools.
 * The code does the third, because it is the only one of the three that is not a content
 * decision to make on somebody else's behalf.
 */
function neutralPool(): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isDraftable(c) && !isHybrid(c) && FALLBACK_SCHOOLS.includes(c.school))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * The colourless shelves a thin bloodline tops up from.
 *
 * Arcane joined neutral here because both are the same *kind* of card — utility nobody's
 * school owns — and excluding one of them was an accident of the fallback being written
 * before the Arcane set existed. It widens the safety net rather than changing any draw
 * that happens today: the fallback fires only when a bloodline's own shelves are
 * exhausted, and since the catalog expansion no species reaches that point.
 *
 * Deliberately **not** hybrids, which have their own step in the chain, and deliberately
 * not another school's cards, which would make a Boreas that ran short into a Sylva.
 */
const FALLBACK_SCHOOLS: readonly School[] = ['neutral', 'arcane'];

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

// ---------------------------------------------------------------- override sockets

/**
 * Why this card may not go in that slot, or null if it may.
 *
 * The `*Refusal` shape the whole codebase uses: the UI asks it to decide whether a card is
 * offerable, and the writer asks it again before committing, so a stale picker cannot
 * socket something the rules refuse.
 *
 * Sockets exist to close a gap the Forge left open. A spliced Hybrid is an elemental card,
 * and a Hero Deck takes neutral and arcane only — so a player could press a Vaporize Blast
 * at the bench and then have nowhere in the game to put it. The Companion's half is where
 * elemental magic lives, so that is where a forged one goes.
 */
export type SocketRefusal =
  | 'bad-slot'
  | 'unknown-card'
  | 'not-unlocked'
  | 'not-castable'
  | 'off-school'
  | null;

/**
 * The schools a card actually belongs to.
 *
 * A fusion carries **two**, and only one of them is written on it: Vaporize Blast is filed
 * under frost and pressed from Pyre and Frost. Reading `def.school` alone would tell an
 * Ignis it cannot hold the fire-and-ice spell that is half made of fire, which is exactly
 * backwards. The recipe is the authority; the filing is a filing.
 */
export function schoolsOfCard(def: CardDef): School[] {
  const fused = hybridSchools(def.id);
  return fused.length > 0 ? fused : [def.school];
}

/**
 * Whether a Companion's bloodline will accept this card at all.
 *
 * One school in common is enough, which is what makes a Hybrid the interesting case: an
 * Ignis takes a Pyre/Frost fusion because half of it is fire, and refuses a Surge/Bloom one
 * because none of it is. A beast is not a filing cabinet — it can only cast what it has
 * some claim to.
 */
export function acceptsSchool(source: GrimoireSource, def: CardDef): boolean {
  return schoolsOfCard(def).some((s) => source.schools.includes(s));
}

export function socketRefusal(
  source: GrimoireSource,
  unlocked: readonly string[],
  slot: number,
  cardId: string,
  size = 8,
): SocketRefusal {
  if (!Number.isInteger(slot) || slot < 0 || slot >= size) return 'bad-slot';

  const def = CARDS[cardId];
  if (!def) return 'unknown-card';
  // Bodies, Rank 2 printings, and the cards the Trial deals itself. The same predicate the
  // draft uses, so a card the beast could never have drawn cannot be slotted in either.
  if (!isDraftable(def)) return 'not-castable';
  // Forged, not merely printed. This is the half of the gate that makes the Forge matter:
  // a socket is where a spliced card goes, and you have to have spliced it.
  if (!unlocked.includes(cardId)) return 'not-unlocked';
  if (!acceptsSchool(source, def)) return 'off-school';
  return null;
}

/**
 * Everything the player could put in a slot right now.
 *
 * Slot-independent: the gate asks about the card and the bloodline, never about which of
 * the eight is being replaced. Passing a slot would imply there is a rule about position,
 * and inventing one nobody asked for is how a picker starts lying about why a card is grey.
 */
export function socketableCards(
  source: GrimoireSource,
  unlocked: readonly string[],
): CardDef[] {
  return unlocked
    .map((id) => CARDS[id])
    .filter((def): def is CardDef => Boolean(def))
    .filter((def) => socketRefusal(source, unlocked, 0, def.id) === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The eight a Companion will actually fuse in: what it drafted, with the sockets applied.
 *
 * The single definition, shared by the fight and by the screen that edits it. Two readings
 * of "what is in the Grimoire" is how a Field Journal comes to show one book and the board
 * to deal another.
 *
 * An override naming a card that no longer exists is ignored rather than dealt: a hole in
 * the draw pile is worse than a card the player forgot they socketed.
 */
export function resolveGrimoire(
  grimoire: readonly string[],
  overrides: Record<number, string> | undefined,
): string[] {
  if (!overrides) return [...grimoire];
  return grimoire.map((defId, slot) => {
    const swapped = overrides[slot];
    return swapped && CARDS[swapped] ? swapped : defId;
  });
}
