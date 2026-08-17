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
export type DamageType = 'physical' | 'fire' | 'frost' | 'spell' | 'impact' | 'true';

/** What caused a damage instance — the renderer picks animations from this. */
export type DamageCause = 'attack' | 'spell' | 'collision' | 'rune' | 'status' | 'counter' | 'impact' | 'reaction';

export type StatusKind =
  | 'burn'
  | 'toxin'
  | 'chill'
  | 'freeze'
  | 'entangle'
  | 'stun'
  /** Frost: the target takes +2 from every hit until it wears off. */
  | 'brittle';

export type Keyword =
  | 'Haste'
  | 'Dormant'
  | 'Impact'
  | 'Counter'
  | 'Guardian'
  | 'Escalate'
  | 'Retain'
  | 'PowerTier'
  | 'Sacrifice';

/** A thing that can be damaged: an on-grid entity, or an off-grid commander portrait. */
export type TargetRef =
  | { kind: 'unit'; id: UnitId }
  | { kind: 'obstacle'; id: UnitId }
  | { kind: 'portrait'; side: Side };

export const coordKey = (c: Coord): string => `${c.x},${c.y}`;
export const coordEq = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y;
