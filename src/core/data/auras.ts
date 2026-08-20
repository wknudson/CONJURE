/**
 * Elemental Auras — the Rule of 3.
 *
 * The replacement for the player's old `Escalate` keyword, and the reason it had to go:
 * Escalate was a passive a body simply *had*, so a unit that never left the board grew
 * without end. An Aura is cast, costs a card, and stops dead at three stacks.
 *
 * The shape of the arc is deliberate. Stacks one and two pay stats; the third pays
 * nothing at all and instead unlocks a **Climax trait** that is as much a liability as a
 * weapon. So an Aura is not a ramp — it is a fuse. It stops rewarding you at the moment it
 * starts costing you, and the answer to that is to spend it (see `detonateAura`).
 *
 * Data, not closures, exactly as cards are: the engine reads these numbers and owns every
 * behaviour, so a new Aura is a new entry here and nothing else.
 */

import type { School } from '../../contract/ids.js';

/** The hard cap. Three, everywhere, for every school — it is the name of the mechanic. */
export const AURA_MAX_STACKS = 3;

/**
 * The highest stack that still pays a stat.
 *
 * Stacks 1 and 2 grant; arriving at 3 grants nothing and unlocks the Climax instead, so a
 * fully-grown Aura is worth **two** steps of its stat and one trait. Named rather than
 * inlined because it is the one number that decides whether the Rule of 3 reads as
 * "grow, grow, transform" or as "grow, grow, grow".
 */
export const AURA_LAST_PAYING_STACK = 2;

/**
 * What a Climaxed Aura turns its host into.
 *
 * Ids rather than functions, so the AI can read that a unit has climaxed and what that
 * implies without executing anything.
 *
 * **None of the five behaviours are implemented yet** — this phase builds the Aura system
 * and marks the trait. `climaxTraitOf` is the one query everything else will hang off.
 */
export type ClimaxTraitId =
  /** Pyre. Ignite (2) on attack, and a fire hazard left on every tile it walks off. */
  | 'conflagration'
  /** Bloom. Leech on its attacks, and a Toxin deathburst when it finally falls. */
  | 'overgrowth'
  /** Surge. Ignores unit-collision when moving, damaging whatever it passes through. */
  | 'overload'
  /** Bulwark. Immune to Shove and Pull, and shatters destructible obstacles by walking into them. */
  | 'heavyFootprint'
  /** Dusk. Frail-Strike: whatever it wounds takes more from every later blow that turn. */
  | 'hollow';

/** The stats an Aura can pay. Every field is per-stack and additive. */
export interface AuraPassiveStat {
  atk?: number;
  maxHp?: number;
  mov?: number;
  /** Persistent armour, the same pool `grantArmor` writes. */
  armor?: number;
}

/**
 * A toll charged every turn the Aura lives, including after it has Climaxed.
 *
 * The counterpart to `passiveStat`, and a genuinely different clock: a stat is granted
 * once and kept, an upkeep is paid again every turn forever. Modelling Dusk's siphon as a
 * stat would have been a lie about when it costs you.
 */
export interface AuraUpkeep {
  /** True damage to the host. Ignores armour, so this can and does kill. */
  selfDamage?: number;
  /** Marrow handed to the host's owner. */
  marrow?: number;
}

export interface AuraDef {
  defId: string;
  name: string;
  school: School;
  /** Always `AURA_MAX_STACKS`. Carried per-Aura so the cap is visible where it is read. */
  maxStacks: number;
  passiveStat: AuraPassiveStat;
  upkeep?: AuraUpkeep;
  climaxTrait: ClimaxTraitId;
  text: string;
}

export const AURAS: Record<string, AuraDef> = {
  aura_conflagration: {
    defId: 'aura_conflagration',
    name: 'Conflagration',
    school: 'pyre',
    maxStacks: AURA_MAX_STACKS,
    passiveStat: { atk: 1 },
    climaxTrait: 'conflagration',
    text: '+1 ATK per stack. At Climax: Ignite (2) on attack, and it leaves fire in its wake.',
  },

  aura_overgrowth: {
    defId: 'aura_overgrowth',
    name: 'Overgrowth',
    school: 'bloom',
    maxStacks: AURA_MAX_STACKS,
    passiveStat: { maxHp: 2 },
    climaxTrait: 'overgrowth',
    text: '+2 Max HP per stack. At Climax: Leech, and a Toxin burst when it dies.',
  },

  aura_static_charge: {
    defId: 'aura_static_charge',
    name: 'Static Charge',
    school: 'surge',
    maxStacks: AURA_MAX_STACKS,
    passiveStat: { mov: 1 },
    climaxTrait: 'overload',
    text: '+1 MOV per stack. At Climax: Overload — it no longer stops for bodies.',
  },

  aura_petrifying_mantle: {
    defId: 'aura_petrifying_mantle',
    name: 'Petrifying Mantle',
    school: 'bulwark',
    maxStacks: AURA_MAX_STACKS,
    passiveStat: { armor: 1 },
    climaxTrait: 'heavyFootprint',
    text: '+1 Persistent Armor per stack. At Climax: Heavy Footprint — nothing shoves it.',
  },

  /**
   * The one Aura that can kill its own host, and the only Marrow in the game that costs
   * neither an action nor a card. You pay in a slow wound that armour cannot stop.
   */
  aura_marrow_siphon: {
    defId: 'aura_marrow_siphon',
    name: 'Marrow Siphon',
    school: 'dusk',
    maxStacks: AURA_MAX_STACKS,
    passiveStat: {},
    upkeep: { selfDamage: 1, marrow: 1 },
    climaxTrait: 'hollow',
    text: 'Each turn it bleeds 1 and yields 1 Marrow. At Climax: Hollow — its wounds fester.',
  },
};

export function auraDef(defId: string): AuraDef | undefined {
  return AURAS[defId];
}

/** Every Aura, for the tests and the tooling that sweep them. */
export const ALL_AURAS: AuraDef[] = Object.values(AURAS);
