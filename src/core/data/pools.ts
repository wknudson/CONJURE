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
import { CARDS } from './cards/index.js';
import { isDraftable, isHybrid } from './grimoire.js';
import { DEFAULT_ROSTER, UNIVERSAL_ROSTER, isRosterEligible } from './roster.js';
import { COMPANIONS, companionById } from './companions.js';

/**
 * The six elemental schools, in the order the game presents them.
 *
 * `neutral` and `arcane` are absent on purpose: neither is a Companion archetype, and
 * both exist to be the colourless half of a Hero Deck rather than a bank anything drafts
 * from. `SCHOOLS` is what a school-shaped thing iterates.
 */
export const SCHOOLS: readonly School[] = ['pyre', 'frost', 'surge', 'bulwark', 'dusk', 'bloom'];

/** Spells a school can call its own: its colour, no fusions, nothing engine-dealt. */
export function spellPool(school: School): CardDef[] {
  return Object.values(CARDS)
    .filter((c) => isDraftable(c) && !isHybrid(c) && c.school === school)
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
