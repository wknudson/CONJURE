/** Shared identifier and primitive types. Imported by both the logic core and the renderer. */

export type UnitId = string;
export type CardInstanceId = string;
export type CardDefId = string;
export type MarkDefId = string;
export type EntityId = UnitId;

export type Side = 'player' | 'enemy';

/** Grid coordinate. x = column (0..w-1, left to right). y = row (0 = enemy backline, h-1 = player backline). */
export interface Coord {
  x: number;
  y: number;
}

/** Elemental schools. The demo uses pyre / dusk / arcane; the rest are reserved. */
export type School = 'pyre' | 'frost' | 'surge' | 'bulwark' | 'dusk' | 'bloom' | 'arcane' | 'neutral';

/**
 * Damage typing drives mark alignment (which triggers detonate vs. fizzle), the reaction
 * table, weather modifiers, and elemental resistance.
 *
 * Six of these are the elemental schools' own damage, one per school — see `SCHOOL_DTYPE`
 * in `core/data/elements.ts`, which is the only place the mapping is written down. `decay`
 * and `toxic` were added last, for Dusk and Bloom: those two were the schools with no damage
 * type of their own, so a Dusk body hit like an arcane one and neither school could be
 * gated by weather or aligned to a mark the way the other four could.
 *
 * `physical` is what a body with no element swings with. `spell` is what a *spell* with no
 * element does — deliberately not the arcane school's attack type, because `spell` is aligned
 * by four of the six Marks and an arcane body swinging would otherwise set off all of them.
 * `true` bypasses armour, Brittle, resistance and weather alike.
 */
export type DamageType =
  | 'physical'
  | 'fire'
  | 'frost'
  | 'shock'
  | 'impact'
  | 'decay'
  | 'toxic'
  | 'spell'
  | 'true';

/** What caused a damage instance — the renderer picks animations from this. */
export type DamageCause = 'attack' | 'spell' | 'collision' | 'mark' | 'status' | 'counter' | 'impact' | 'reaction';

export type StatusKind =
  | 'burn'
  | 'toxin'
  | 'chill'
  | 'freeze'
  | 'entangle'
  | 'stun'
  /**
   * Bled for Marrow. It gave up its turn along with the blood: it cannot move, strike or
   * channel until the start of its owner's next turn, when the tick clears it.
   *
   * Deliberately **not** `stun`. Stun is what an enemy does to you, and it is reserved for
   * control effects; Exhaustion is what you do to your own body, and the two want to be
   * told apart — by a reader, by the threat model, and by any future effect that cleanses
   * one of them.
   */
  | 'exhaust'
  /**
   * Quickened. +1 MOV per stack, for this turn only.
   *
   * A status rather than a stat edit because it has to come off again, and the status tick
   * is the one place in the engine that reliably takes things away.
   */
  | 'fleet'
  /** Frost: the target takes `BRITTLE_BONUS` extra from every hit until it wears off. */
  | 'brittle'
  /**
   * Surge: residual charge, left behind by a shock hit.
   *
   * On its own it does nothing at all, which is what makes a Surge hit a setup move
   * rather than merely damage — fire sets the charge off, frost conducts through it.
   */
  | 'charged'
  /**
   * Wild magic sealing a cornered Alpha. Nothing reduces its health while this holds.
   *
   * Neither of the two below ever ticks: the status tick walks explicit lists, and these
   * are absent from all of them. They end when the subjugation does, not on a clock.
   */
  | 'aetherPlated'
  /** Tethered to the beast. It cannot move, strike, or channel — only endure. */
  | 'anchor';

export type Keyword =
  /**
   * Can act the turn it arrives. Every other summon waits a turn — that is the rule, not a
   * keyword. `Dormant` and `Impact` used to sit here naming that same wait as if it were
   * something the two cards did specially; nothing in the engine ever read either.
   */
  | 'Haste'
  | 'Counter'
  | 'Guardian'
  /**
   * Grows at the start of its own turn, if it survived the round.
   *
   * **Enemy-side only.** The player's units grow through Auras now, which cap at three;
   * this is the boss clock, and it is the one growth the game still wants unbounded-ish.
   * A player-side card may still carry the keyword — the gate is on the side, not the data,
   * so an enemy fielding the same body still gets its clock.
   */
  | 'Growth'
  | 'Retain'
  | 'PowerTier'
  /** Your Companion's body on the board. Its wounds are the Pact's wounds. */
  | 'BoundForm'
  /** Wild. Belongs to no one, fights everyone, and everyone may fight it. */
  | 'Feral';

/** A thing that can be damaged: an on-grid entity, or an off-grid commander portrait. */
export type TargetRef =
  | { kind: 'unit'; id: UnitId }
  | { kind: 'obstacle'; id: UnitId }
  | { kind: 'portrait'; side: Side };

export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const coordEq = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y;
