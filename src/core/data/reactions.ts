/**
 * Cross-school elemental reactions (Module 1 §4).
 *
 * A reaction fires when damage of one school lands on a target already carrying the
 * status of another — fire onto ice becomes steam, impact onto frozen flesh shatters it.
 * This is the design's most distinctive system and the reason the status layer exists.
 *
 * Reactions are data. The engine evaluates this table inside `dealDamage`, the same
 * choke point runes go through, so no card can bypass them and none has to opt in.
 *
 * Two rules borrowed deliberately from the rune system, for consistency:
 *   - A reaction needs the hit to *land*. Damage entirely absorbed by armor applies its
 *     status but triggers nothing, exactly as a rune would not detonate.
 *   - A reaction respects `chainCancelled`, so a boss Damage Gate stops it mid-chain.
 */

import type { DamageType, StatusKind } from '../../contract/ids.js';

export interface ReactionDef {
  id: string;
  name: string;
  /** Damage schools that can set it off. */
  triggers: DamageType[];
  /** Status the target must already be carrying. */
  requires: StatusKind;
  /** Folded into the triggering hit, before armor. */
  bonusDamage?: number;
  /** Consume the required status when it fires. Almost always true. */
  consumes: boolean;
  /**
   * Whether the hit must actually reach health, as a rune must.
   *
   * True for reactions that represent something happening *to the unit*. False for
   * Shatter, which is something happening to the ice encasing it — requiring HP loss
   * there would mean armor prevents the one reaction whose entire purpose is removing
   * armor, so a heavily armoured frozen target could never be broken.
   */
  requiresHpLoss: boolean;
  /** What happens after the hit resolves. Interpreted by the engine. */
  outcome: ReactionOutcome;
  /** Shown in the rules reference and on hover. */
  text: string;
}

export type ReactionOutcome =
  /** Vaporize: the tile fills with steam that blocks ranged sight. */
  | { op: 'spawnHazard'; kind: 'steam_fog'; turns: number }
  /** Shatter: strip all armor, then splash the neighbours. */
  | { op: 'shatter'; splash: number }
  /** Wildfire: burn off every Toxin stack for area damage scaled by the stacks consumed. */
  | { op: 'consumeForAoe'; perStack: number; dtype: DamageType }
  /** Nothing beyond the bonus damage and the status change. */
  | { op: 'none' };

export const REACTIONS: ReactionDef[] = [
  {
    id: 'vaporize',
    name: 'Vaporize',
    triggers: ['fire'],
    requires: 'chill',
    consumes: true,
    requiresHpLoss: true,
    outcome: { op: 'spawnHazard', kind: 'steam_fog', turns: 2 },
    text: 'Fire on a Chilled target flashes it to steam, fogging the tile for 2 turns. Ranged attacks cannot see through fog.',
  },
  {
    id: 'shatter',
    name: 'Shatter',
    // Physical blows and collisions break ice; spells do not.
    triggers: ['physical', 'impact'],
    requires: 'freeze',
    consumes: true,
    requiresHpLoss: false,
    outcome: { op: 'shatter', splash: 4 },
    text: 'A physical hit on a Frozen target breaks the ice: it loses all Armor, and adjacent units take 4 shrapnel damage.',
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    triggers: ['fire'],
    requires: 'toxin',
    consumes: true,
    requiresHpLoss: true,
    outcome: { op: 'consumeForAoe', perStack: 2, dtype: 'fire' },
    text: 'Fire ignites Toxin, consuming every stack to deal 2 fire damage per stack to everything adjacent.',
  },
];

/** The reaction a hit of this school would provoke on a target carrying these statuses. */
export function findReaction(
  dtype: DamageType,
  statuses: Partial<Record<StatusKind, number>>,
): ReactionDef | undefined {
  return REACTIONS.find(
    (r) => r.triggers.includes(dtype) && (statuses[r.requires] ?? 0) > 0,
  );
}
