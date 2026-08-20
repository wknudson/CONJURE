/** Shared identifier and primitive types. Imported by both the logic core and the renderer. */

export type UnitId = string;
export type CardInstanceId = string;
export type CardDefId = string;
export type RuneDefId = string;
export type EntityId = UnitId;

export type Side = 'player' | 'enemy';

/** Grid coordinate. x = column (0..w-1, left to right). y = row (0 = enemy backline, h-1 = player backline). */
export interface Coord {
  x: number;
  y: number;
}

/** Elemental schools. The demo uses pyre / dusk / arcane; the rest are reserved. */
export type School = 'pyre' | 'frost' | 'surge' | 'bulwark' | 'dusk' | 'bloom' | 'arcane' | 'neutral';

/** Damage typing drives rune alignment (which triggers detonate vs. fizzle). */
export type DamageType = 'physical' | 'fire' | 'frost' | 'shock' | 'spell' | 'impact' | 'true';

/** What caused a damage instance — the renderer picks animations from this. */
export type DamageCause = 'attack' | 'spell' | 'collision' | 'rune' | 'status' | 'counter' | 'impact' | 'reaction';

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
  /** Frost: the target takes +2 from every hit until it wears off. */
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
  | 'Haste'
  | 'Dormant'
  | 'Impact'
  | 'Counter'
  | 'Guardian'
  | 'Escalate'
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
