import type { CombatBoons } from '../core/engine/setup.js';

/**
 * Every field a `CombatBoons` may carry, as data.
 *
 * One list, in one place, because there were two and they drifted the first time the
 * vocabulary grew — `relics.test.ts` kept its own copy of the allowed keys and started
 * rejecting a relic for naming a capability that had been legal for a sprint.
 *
 * Typed as a **total record**, so this is not a list somebody has to remember to update:
 * adding a field to `CombatBoons` without adding it here fails the build. That compile-time
 * check is what makes the runtime loops that read it worth anything.
 */
export const ALL_BOONS: Record<keyof CombatBoons, true> = {
  armor: true,
  bones: true,
  extraOpeningCards: true,
  maxBones: true,
  ignoreFog: true,
  immuneToBurn: true,
  ignoreIceSlip: true,
  immuneToToxin: true,
  revealIntents: true,
  bonusObstacleHp: true,
  bonusTitheMarrow: true,
  healOnTithe: true,
  bonusToxinStacks: true,
  boundFormIgnoresHazards: true,
  boundFormGrounded: true,
  bonusHandLimit: true,
  doubleResonance: true,
  discountHybrids: true,
  collisionResist: true,
  ignoreGuardians: true,
  fogConceals: true,
  steamBurns: true,
  arcPierces: true,
  armorOnArcCollateral: true,
  alliesGrounded: true,
  wildfireSeedsToxin: true,
  chillConducts: true,
  bonusFreezeStacks: true,
  immuneToShatterSplash: true,
  bonusShoveDistance: true,
};

export const BOON_KEYS = Object.keys(ALL_BOONS) as (keyof CombatBoons)[];

/**
 * A boon set with every capability switched on at once.
 *
 * `1` serves for both halves of the union: truthy for the flags, and a real amount for the
 * numbers. Used to push everything through a seam at once and see what fails to arrive.
 */
export function everyBoon(): CombatBoons {
  return Object.fromEntries(BOON_KEYS.map((k) => [k, 1])) as CombatBoons;
}
