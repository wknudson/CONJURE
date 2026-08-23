/**
 * The elemental layer: which damage type a school deals, and what changes that number.
 *
 * This exists because a school's element was, until now, a fact about its *cards* and not
 * about its *bodies*. A Pyre minion carried `school: 'pyre'`, and swung for `physical` —
 * `attackDtype` was opt-in and exactly two cards in the catalogue set it. So a Pyre warband
 * could not detonate a Cinder Mark (aligned to fire and spell), no weather could single out
 * an element, and nothing could resist one. The school was a colour on a card frame.
 *
 * Everything here is a table, and the tables are the only copies. `dtypeOf` is what the
 * attack reducer reads instead of defaulting to physical, so a body's element follows from
 * the school it already declares rather than from a field somebody has to remember to set.
 */

import type { DamageType, School } from '../../contract/ids.js';
import type { Weather } from '../types/state.js';

/**
 * The element each school hits with. One per school, and the only place this is written.
 *
 * `arcane` and `neutral` deal `physical` rather than `spell`, and that is the one entry worth
 * arguing about. `spell` is aligned by four of the six Marks, so an arcane body swinging with
 * it would set off Cinder, Rime, Arc and Soul Splinter alike — the Hero's colourless bodies
 * would be the best mark-triggers in the game. `spell` stays what a *spell* does; a body with
 * no element swings like a body with no element.
 */
export const SCHOOL_DTYPE: Record<School, DamageType> = {
  pyre: 'fire',
  frost: 'frost',
  surge: 'shock',
  bulwark: 'impact',
  dusk: 'decay',
  bloom: 'toxic',
  arcane: 'physical',
  neutral: 'physical',
};

/** What this body's strikes are made of. */
export function dtypeOf(school: School): DamageType {
  return SCHOOL_DTYPE[school];
}

/** The six elemental damage types, in school order. Excludes `physical`/`spell`/`true`. */
export const ELEMENTAL_DTYPES: readonly DamageType[] = [
  'fire',
  'frost',
  'shock',
  'impact',
  'decay',
  'toxic',
];

/**
 * How much of its own element a body shrugs off.
 *
 * A single flat number rather than a resistance table per unit, and flat rather than a
 * percentage because every HP and damage figure in this game is a multiple of ten (see the
 * Stat Stretch note in `docs/02_combat_lexicon.md`) and a percentage is the one thing that
 * reliably produces a 27. It is subtracted before armour, alongside Brittle and weather.
 *
 * **This is a balance dial, and setting it to 0 disables the rule entirely** without touching
 * any other code: `resistOf` returns the sum of this and any authored override, so zero here
 * leaves only what cards ask for by name. It is deliberately smaller than `BRITTLE_BONUS`,
 * because being the wrong element to fight something should be a nudge and being frozen
 * through should be a problem.
 */
export const SELF_ELEMENT_RESIST = 10;

/**
 * What the sky does to each element.
 *
 * Signed, and applied to the damage figure before armour: negative damps, positive amplifies.
 * This generalises what used to be a single hard-coded rule — rain took 10 off fire and
 * nothing else in the game could be weather-sensitive.
 *
 * The entries are chosen to be guessable from the word rather than to be learned from a
 * table. Rain drowns fire and carries a charge; a gale fans flame and scatters a cloud of
 * poison. Fog is **deliberately absent**: its effect is on sight, and it is already the
 * harshest weather in the game for that reason — a fight where nobody can see past three
 * tiles does not also need a damage rule.
 */
export const WEATHER_ELEMENTAL: Partial<
  Record<Weather['kind'], Partial<Record<DamageType, number>>>
> = {
  rain: { fire: -10, shock: +10 },
  gale: { fire: +10, toxic: -10 },
};

/**
 * Which school owns each elemental damage type — the inverse of `SCHOOL_DTYPE`.
 *
 * Derived rather than written, so it cannot fall out of step with the table above, and
 * filtered to the elemental six: `arcane` and `neutral` both deal `physical`, so an inverse
 * that included them would have to pick a winner between two schools that own nothing.
 *
 * Exists for the UI. Players are taught Pyre and Bloom, not "fire" and "toxic", so anything
 * naming an element to a human wants the school word.
 */
export const SCHOOL_OF_DTYPE: Partial<Record<DamageType, School>> = Object.fromEntries(
  (Object.entries(SCHOOL_DTYPE) as [School, DamageType][])
    .filter(([, dtype]) => ELEMENTAL_DTYPES.includes(dtype))
    .map(([school, dtype]) => [dtype, school]),
) as Partial<Record<DamageType, School>>;

/** What the weather adds to (or takes off) a hit of this type. Zero when it has no opinion. */
export function weatherMod(weather: Weather | undefined, dtype: DamageType): number {
  if (!weather) return 0;
  return WEATHER_ELEMENTAL[weather.kind]?.[dtype] ?? 0;
}

/**
 * What a body of this school takes off a hit of this type.
 *
 * Returned as a **negative** number so callers add every modifier and never have to remember
 * which way round one of them runs. `own` is the derived rule; `authored` is a card's own
 * table, which may resist something else, resist harder, or be *vulnerable* by passing a
 * positive figure.
 */
export function resistOf(
  school: School,
  dtype: DamageType,
  authored?: Partial<Record<DamageType, number>>,
): number {
  // `true` is outside this system by definition: it bypasses armour and Brittle, and a
  // resistance that applied to it would make it not true.
  if (dtype === 'true') return 0;

  // The self-resist applies to **elements only**, and the `ELEMENTAL_DTYPES` guard is the
  // whole point of that list rather than a tidiness check. `arcane` and `neutral` deal
  // `physical`, so without it every colourless body in the game — the Scout Imp, the
  // Vanguard Footman, half the Hero's shelf — quietly resisted physical damage, which is
  // both the commonest type on the board and the one nobody chose to be weak to. Two
  // Scout Imps hitting each other did 10 less than their stat blocks claimed.
  //
  // Physical is the *absence* of an element. Nothing resists its own absence.
  const own =
    ELEMENTAL_DTYPES.includes(dtype) && dtypeOf(school) === dtype ? -SELF_ELEMENT_RESIST : 0;
  return own + (authored?.[dtype] ?? 0);
}
