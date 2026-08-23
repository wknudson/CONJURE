/**
 * The catalog, viewed by school — the authoring surface for everything still to be written.
 *
 * The game ships far short of a full shelf. A Companion archetype wants ten to fifteen
 * spells of its own school and most schools have three or four, which is why the Grimoire
 * draft has a neutral fallback and why two bloodlines cannot fill eight slots without it.
 * That is a content gap, and the point of this module is that it is a *visible* one:
 * `catalogGaps()` will tell you exactly how many cards each school is short, and it is
 * asserted in the tests, so the shelf filling up is something the suite notices.
 *
 * Everything here is **derived from `CARDS`**, never listed. A new spell joins its
 * school's pool by existing with the right `school`; a new minion becomes unlockable by
 * the same rule. There is deliberately no registry to remember to update, because the one
 * thing that reliably goes stale in a catalog this size is a second list of what is in it.
 *
 * Two pools, because they are spent from two different budgets and gated two different
 * ways:
 *
 * | | | |
 * |---|---|---|
 * | **spells** | drafted into a Companion's Grimoire | by the beast's schools, at roll time |
 * | **minions** | bought into the Vanguard roster | by which schools you have tamed, permanently |
 */

import type { School } from '../../contract/ids.js';
import type { CardDef } from '../types/cards.js';
import type { GrimoireSource } from './grimoire.js';
import { CARDS } from './cards/index.js';
import { isBloodlineCard, isDraftable, isHybrid } from './grimoire.js';
import {
  DEFAULT_ROSTER,
  STARTING_WARBAND_POINTS,
  UNIVERSAL_ROSTER,
  isRosterEligible,
  rosterCost,
} from './roster.js';
import { COMPANIONS, companionById } from './companions.js';
import { traitsFor } from './companionTraits.js';

/**
 * The six elemental schools, in the order the game presents them.
 *
 * `neutral` and `arcane` are absent on purpose: neither is a Companion archetype, and
 * both exist to be the colourless half of a Hero Deck rather than a bank anything drafts
 * from. `SCHOOLS` is what a school-shaped thing iterates.
 */
export const SCHOOLS: readonly School[] = ['pyre', 'frost', 'surge', 'bulwark', 'dusk', 'bloom'];

/**
 * What a school can call its own: its colour, no fusions, nothing engine-dealt.
 *
 * Gated by `isBloodlineCard` — the same predicate `purePool` uses — and that is not
 * decoration. This function is a second answer to "what may a beast of this school draw",
 * and the two had already drifted once: the role overhaul taught `purePool` to refuse
 * Marks and Abilities and left this one taking whatever `isDraftable` allowed. The Vow
 * screen counts *this* list, so the drift surfaced as a card reading **"8 of 7 spells"** —
 * a screen promising the player less than the game deals.
 *
 * The two are one rule now. If they ever need to differ, that is a new function with a new
 * name and a reason, not a filter quietly missing from one of them.
 */
export function spellPool(school: School): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isDraftable(c) && isBloodlineCard(c) && !isHybrid(c) && c.school === school)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * Bodies a school can call its own.
 *
 * Filtered through `isRosterEligible`, which is the same predicate the deployment tray
 * uses — so a minion that cannot be fielded cannot be unlocked either, and the two can
 * never disagree about what a Vanguard may hold.
 */
export function minionPool(school: School): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isRosterEligible(c) && c.school === school)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * What a full shelf looks like, per school.
 *
 * A range rather than a number because it is a design target and not a rule: nothing
 * refuses to work below it, and `catalogGaps` reports against the floor.
 */
export const CATALOG_TARGET = { min: 10, max: 15 } as const;

export interface CatalogGap {
  school: School;
  spells: number;
  minions: number;
  /** Spells still to author before this school reaches `CATALOG_TARGET.min`. */
  short: number;
}

/**
 * How far each school is from a shelf of its own, worst first.
 *
 * Exists to be *read*, by a test and by whoever is authoring next. A gap that only shows
 * up as a Grimoire quietly padded with neutral cards is a gap nobody schedules.
 *
 * **Every school clears the floor now.** Dusk was the last one short — seven, because nine
 * of its twenty cards are Bound Forms and authored threats — and the decay shelf closed it.
 * So this reports zeroes today, and it is kept rather than deleted for the case it was really
 * written for: the next school somebody adds, which will read short here before it reads
 * short anywhere a player can see.
 *
 * It is worth knowing what this does **not** cover. `SCHOOLS` omits `arcane`, so Lexis —
 * whose grimoire is arcane and which pads six of its eight slots from the neutral fallback —
 * is invisible to this function by construction. That is the padded-Grimoire failure the
 * docblock above warns about, still live, one school out of scope.
 */
export function catalogGaps(): CatalogGap[] {
  return SCHOOLS.map((school) => {
    const spells = spellPool(school).length;
    return {
      school,
      spells,
      minions: minionPool(school).length,
      short: Math.max(0, CATALOG_TARGET.min - spells),
    };
  }).sort((a, b) => b.short - a.short || a.school.localeCompare(b.school));
}

// ------------------------------------------------------- the three species registries

/**
 * What each bloodline can roll, keyed by species — the three pools the Variance Engine
 * draws on, in the shape the design asks for them.
 *
 * **Derived at load, never authored.** That is the whole modularity claim, and it is
 * stronger than a hand-kept table would be: a new Bulwark spell joins Ferrum's pool *and*
 * the Tortoise's, the Juggernaut's, the Dynamo's and the Sovereign's by being written with
 * `school: 'bulwark'`, with no registry edit anywhere. A literal per-species array would
 * need five, and would be wrong the first time somebody forgot one.
 *
 * Keyed by species rather than by school because that is the question every caller
 * actually has — "what can *this beast* roll" — and because a hybrid speaks two schools,
 * so school-keyed tables push that join onto every reader.
 *
 * The values are card and trait **ids**, not defs, so these read as data and can be logged,
 * diffed and stamped into a save without dragging the whole card database along.
 */
export const MINIONS_BY_SPECIES: Readonly<Record<string, readonly string[]>> = byCompanion(
  (baseId) => unique(schoolsOf(baseId).flatMap((s) => minionPool(s).map((c) => c.id))),
);

export const SPELL_POOLS_BY_SPECIES: Readonly<Record<string, readonly string[]>> = byCompanion(
  (baseId) => unique(schoolsOf(baseId).flatMap((s) => spellPool(s).map((c) => c.id))),
);

/**
 * The knacks a bloodline can roll — its own, plus its parents' if it is a hybrid.
 *
 * Reads `traitsFor`, which is the taming roll's own source, so this registry and the roll
 * cannot disagree about what a Chimera might come out wearing. Pending knacks are absent
 * from both: a trait a player could roll and that then did nothing is worse than one that
 * does not exist yet.
 */
export const TRAITS_BY_SPECIES: Readonly<Record<string, readonly string[]>> = byCompanion(
  (baseId) => traitsFor(baseId).map((t) => t.id),
);

/** Builds one of the registries above, over every species the game knows. */
function byCompanion(of: (baseId: string) => string[]): Record<string, readonly string[]> {
  const out: Record<string, readonly string[]> = {};
  for (const c of COMPANIONS) out[c.id] = of(c.id);
  return out;
}

function unique(ids: string[]): string[] {
  return [...new Set(ids)].sort();
}

/**
 * What claiming one beast permanently grants the Vanguard.
 *
 * The rule a claim stamps, separated from the stamping so the two can be tested apart and
 * so nothing has to guess at it: `save.ts` calls this once when a beast is taken and
 * writes the answer down. **Permanent** is the operative word, and it is why the answer is
 * stored rather than recomputed — see `Profile.rosterUnlocks`.
 */
export function grantsFor(baseId: string): readonly string[] {
  return MINIONS_BY_SPECIES[baseId] ?? [];
}

// ------------------------------------------------------------------ enrolment

/**
 * The six disciplines a character may enrol in, and the bloodline each one starts beside.
 *
 * Derived from the roster rather than listed: a school's founding species is the
 * **mono-element** Companion that speaks it, and there is exactly one of each by
 * construction. Hybrids are excluded on purpose — a character does not begin holding two
 * schools, and a starting Chimera would make the whole choice mean half of what it says.
 *
 * The inverse of `schoolsOf`, and it has to be a derivation rather than a table for the
 * same reason: two lists of the same fact drift, and this one would drift silently the day
 * somebody added a second Frost bloodline.
 */
export const SPECIES_BY_SCHOOL: Readonly<Partial<Record<School, string>>> = foundersOf(COMPANIONS);

/**
 * The founder-picking rule, as a function over a list.
 *
 * Exported and taking its input rather than reaching for `COMPANIONS`, so the two guards
 * inside it can actually be *tested*. Both are currently unobservable against the shipped
 * roster — every school has exactly one mono bloodline and the monos are listed first — so
 * a rule written straight against the registry would be defence nobody could prove works,
 * which is the same as no defence at all.
 */
export function foundersOf(
  companions: readonly { id: string; grimoire: GrimoireSource }[],
): Partial<Record<School, string>> {
  const out: Partial<Record<School, string>> = {};
  for (const c of companions) {
    const schools = c.grimoire.schools;
    // Mono only. A hybrid is filed under one school for its Resonance and speaks two, and
    // a character does not begin holding two.
    if (schools.length !== 1) continue;
    const school = schools[0]!;
    // First wins, so enrolment is stable under a save even if a second bloodline of the
    // same school is authored later.
    out[school] ??= c.id;
  }
  return out;
}

/**
 * Schools a new character may actually choose.
 *
 * `SCHOOLS` is the set of elemental colours in the game; this is the subset with a
 * bloodline behind them, which is what enrolment needs. They are the same six today and
 * the distinction is not pedantry: a school authored before its founding species exists
 * would otherwise appear on the selection screen and hand out an undefined Companion.
 */
export const PLAYABLE_SCHOOLS: readonly School[] = playableFrom(SPECIES_BY_SCHOOL);

/**
 * The filter behind `PLAYABLE_SCHOOLS`, over a founder map rather than the shipped one.
 *
 * Same reason `foundersOf` takes its input: all six schools have a bloodline today, so a
 * filter written straight against the registry is a guard nothing can demonstrate. Handing
 * it a map with a hole in it is the only way to see it hold.
 */
export function playableFrom(founders: Partial<Record<School, string>>): School[] {
  return SCHOOLS.filter((s) => founders[s] !== undefined);
}

/** The bloodline a given discipline starts beside, or undefined if nothing speaks it. */
export function speciesForSchool(school: School): string | undefined {
  return SPECIES_BY_SCHOOL[school];
}

/**
 * The warband a character enrolled in this school begins with.
 *
 * Universal bodies first — there is always a line to hold — then that school's own, in
 * the order the pool lists them, until the ten points are spent. Derived rather than
 * authored per school for the reason everything in this file is: a new Frost body joins
 * the Boreas starting warband by existing, and nobody has to remember to add it.
 *
 * Deliberately **not** `DEFAULT_ROSTER`, which predates enrolment and hands out a Cinder
 * Lobber and a Longshot Stalker to everybody. That was fine when every character started
 * as an Ignis; with a discipline to choose it would mean a Boreas opening with a Pyre
 * body and a Dusk one, which is precisely the identity this screen exists to establish.
 */
export function startingRosterFor(
  school: School,
  budget: number = STARTING_WARBAND_POINTS,
): string[] {
  const roster: string[] = [];
  const fits = (id: string): boolean => rosterCost([...roster, id]) <= budget;
  const take = (id: string): void => {
    if (fits(id)) roster.push(id);
  };

  const candidates = [...UNIVERSAL_ROSTER, ...minionPool(school).map((d) => d.id)];

  // One of each first, cheapest-first within each half, so the line is as varied as the
  // school's shelf allows before it starts doubling up.
  for (const id of candidates) {
    if (!roster.includes(id)) take(id);
  }

  // Then repeats, until nothing else fits. A warband holding two Footmen holds two of the
  // same Footman -- the roster has always allowed that, and `vanguardProgress` is keyed by
  // def id precisely because they train as one body.
  //
  // Without this pass most schools open a point or two short: the shelves are thin enough
  // that no *distinct* body is left that fits the remainder. Leaving the budget unspent
  // would teach a new player that the number on the screen is decorative.
  for (let guard = 0; guard < budget && rosterCost(roster) < budget; guard++) {
    const next = candidates.find(fits);
    if (!next) break;
    roster.push(next);
  }

  return roster;
}

// ------------------------------------------------------------------ roster unlocks

/**
 * Which schools a bloodline speaks.
 *
 * The Grimoire source rather than `def.school`, and the difference is the whole reason
 * this is a function: a hybrid Companion's `school` names only the *parent whose Resonance
 * it borrows*, while `grimoire.schools` names both halves of what it actually is. A
 * Grave-Gargoyle unlocking only Dusk bodies would be unlocking half a beast.
 */
export function schoolsOf(baseId: string): readonly School[] {
  return companionById(baseId)?.grimoire.schools ?? [];
}

/**
 * Every body a warband may field, given the bloodlines it has actually tamed.
 *
 * The seam `validateRoster` was built with and nothing had yet filled. Three rules, in
 * order of how much they matter:
 *
 *  1. **`UNIVERSAL_ROSTER` is always in.** There is always a line to hold, whatever a
 *     player has or has not caught, so a fresh character is never looking at an empty tray.
 *  2. **A school is unlocked by taming it**, and a hybrid unlocks both of its schools.
 *     Taming is already the delivery mechanism for a Grimoire; this makes it the delivery
 *     mechanism for a warband too, which is the payoff the subjugation trials were missing.
 *  3. **Colourless bodies belong to everybody.** A `neutral` or `arcane` minion is not
 *     anybody's school reward and is never gated behind one.
 *
 * Derived every call rather than cached: it is a filter over a few dozen cards, and a
 * cached unlock list is exactly the thing that goes stale the day a minion is added.
 */
export function rosterUnlocksFor(tamedBaseIds: readonly string[]): string[] {
  const schools = new Set<School>();
  for (const baseId of tamedBaseIds) {
    for (const school of schoolsOf(baseId)) schools.add(school);
  }

  // The floor is the universal bodies **and the starting warband**.
  //
  // Without the second half this gate is a regression rather than a feature: a fresh
  // character is dealt `DEFAULT_ROSTER`, which carries a Longshot Stalker, and a Dusk body
  // is not something an Ignis has earned. The tray would open with every chip greyed and
  // the whole warband illegal — a rule breaking the game's own opening position.
  //
  // So the gate is about what a player may **add**, not about what they were given. Every
  // school body authored from here on is genuinely locked behind its bloodline; the four
  // the game has always started with stay where they are.
  // `DEFAULT_ROSTER` is in this floor and deliberately *not* in `save.unlockFloor`, which
  // is the one a new character is created with. The two answer different questions: this
  // is the generous reading used when **migrating** a save written before enrolment
  // existed, where every character was an Ignis and was dealt this exact warband; that one
  // is what a player who chose a discipline gets, and handing a Boreas a Cinder Lobber
  // would undo the choice.
  const out = new Set<string>([...UNIVERSAL_ROSTER, ...DEFAULT_ROSTER]);
  for (const def of Object.values(CARDS)) {
    if (!isRosterEligible(def)) continue;
    if (def.school === 'neutral' || def.school === 'arcane') out.add(def.id);
    else if (schools.has(def.school)) out.add(def.id);
  }
  return [...out].sort();
}

/**
 * What each school brings to a Vanguard, for the screen that explains the reward.
 *
 * The same derivation `rosterUnlocksFor` runs, sliced the other way: that one answers
 * "what may this character field", this one answers "what is taming a Boreas *worth*".
 * Both read the card database, so they cannot disagree.
 */
export function minionUnlocksBySchool(): Record<School, string[]> {
  const out = {} as Record<School, string[]>;
  for (const school of SCHOOLS) out[school] = minionPool(school).map((c) => c.id);
  return out;
}

/**
 * Bloodlines that unlock nothing, which is a content gap and not a rule.
 *
 * Named rather than silently tolerated, for the same reason `catalogGaps` exists: a
 * subjugation trial whose reward is an empty tray is a promise the game does not keep, and
 * it should be a thing the suite can see rather than a thing a player discovers.
 */
export function bloodlinesWithNoBodies(): string[] {
  return COMPANIONS.filter((c) => schoolsOf(c.id).every((s) => minionPool(s).length === 0))
    .map((c) => c.id)
    .sort();
}
