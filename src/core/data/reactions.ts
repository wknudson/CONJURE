/**
 * Cross-school elemental reactions. See `docs/02_combat_lexicon.md`; the pairings that are
 * designed but not yet built are listed in `ROADMAP.md` §6.1.
 *
 * A reaction fires when damage of one school lands on a target already carrying the
 * status of another — fire onto ice becomes steam, impact onto frozen flesh shatters it.
 * This is the design's most distinctive system and the reason the status layer exists.
 *
 * Reactions are data. The engine evaluates this table inside `dealDamage`, the same
 * choke point marks go through, so no card can bypass them and none has to opt in.
 *
 * Two rules borrowed deliberately from the mark system, for consistency:
 *   - A reaction needs the hit to *land*. Damage entirely absorbed by armor applies its
 *     status but triggers nothing, exactly as a mark would not detonate.
 *   - A reaction respects `chainCancelled`, so a boss Damage Gate stops it mid-chain.
 */

import type { DamageType, StatusKind } from '../../contract/ids.js';
import type { Weather } from '../types/state.js';

export interface ReactionDef {
  id: string;
  name: string;
  /** Damage schools that can set it off. */
  triggers: DamageType[];
  /**
   * Status the target must already be carrying.
   *
   * Optional, because not every reaction is a collision of two schools *on a body*. Arc
   * is a collision between a school and the **ground**, and there is nothing on the
   * target to name.
   */
  requires?: StatusKind;
  /**
   * Weather the fight must be had in.
   *
   * The field the Arc note asked for, and the reason it could not be written down before:
   * `requires` names a status and the sky is not one. A reaction may gate on either, or
   * on both — a definition naming neither would fire on every hit of its type, which is
   * why `findReaction` refuses one.
   */
  requiresWeather?: Weather['kind'];
  /** Folded into the triggering hit, before armor. */
  bonusDamage?: number;
  /**
   * Dealt to the target after the hit resolves, bypassing armor entirely.
   *
   * Distinct from `bonusDamage`, which rides the triggering blow and is therefore
   * absorbed by armor like the rest of it. A reaction that is supposed to bite through
   * plate has to land separately and as `true` damage, or a well-armoured target simply
   * shrugs off the thing the reaction exists to do.
   */
  trueDamage?: number;
  /**
   * Consume the required status when it fires. Almost always true.
   *
   * Necessarily false for a weather-gated reaction: the sky is not a resource a hit can
   * spend, so Arc fires every time the conditions are met rather than once.
   */
  consumes: boolean;
  /**
   * Whether the hit must actually reach health, as a mark must.
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
  /** Overload: the charge blows outward, throwing everything around the target clear. */
  | { op: 'overload'; shove: number }
  /** Superconduct: cold runs through the charge, stripping plate and leaving it Brittle. */
  | { op: 'superconduct'; brittle: number }
  /** Wildfire: burn off every Toxin stack for area damage scaled by the stacks consumed. */
  | { op: 'consumeForAoe'; perStack: number; dtype: DamageType }
  /** Arc: the charge jumps to every body touching the target. */
  | { op: 'conduct'; damage: number; dtype: DamageType }
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
    trueDamage: 20,
    outcome: { op: 'spawnHazard', kind: 'steam_fog', turns: 1 },
    text: 'Fire on a Chilled target flash-boils it: 20 damage through any armor, and the tile fogs for a turn. Ranged attacks cannot see through fog.',
  },
  {
    id: 'shatter',
    name: 'Shatter',
    // Physical blows and collisions break ice; spells do not.
    triggers: ['physical', 'impact', 'frost'],
    requires: 'freeze',
    consumes: true,
    requiresHpLoss: false,
    outcome: { op: 'shatter', splash: 40 },
    text: 'A physical hit on a Frozen target breaks the ice: it loses all Armor, and adjacent units take 40 shrapnel damage.',
  },
  {
    id: 'overload',
    name: 'Overload',
    triggers: ['fire'],
    requires: 'charged',
    consumes: true,
    requiresHpLoss: true,
    // Small on the target and violent around it: the point is the shove, not the number.
    trueDamage: 10,
    outcome: { op: 'overload', shove: 1 },
    text: 'Fire into a Charged target detonates the charge: 10 damage through armor, and everything adjacent is thrown a tile directly away, taking collision damage if it hits something.',
  },
  {
    id: 'superconduct',
    name: 'Superconduct',
    triggers: ['frost'],
    requires: 'charged',
    consumes: true,
    // Like Shatter, this happens to what is encasing the target rather than to the target,
    // so armor absorbing the blow must not prevent the armor being stripped.
    requiresHpLoss: false,
    outcome: { op: 'superconduct', brittle: 2 },
    text: 'Frost through a Charged target conducts straight past its plate: all Armor is stripped and it is left Brittle.',
  },
  /**
   * **Arc.** The one reaction that collides a school with the ground rather than with a
   * status, and the last item on the sandbox audit.
   *
   * It was shipped and documented as unshipped: the behaviour lived in `conductShock`, a
   * private function in the damage pipeline, while both this file and the Lexicon said
   * Arc was deliberately not implemented and could not be expressed. Both premises had
   * quietly stopped being true — `shock` is a `DamageType` and the Surge set ships four
   * cards — so what was left was a reaction that fired without announcing itself, paid no
   * refund, and was invisible to `findReaction`.
   *
   * Two things change by making it a `ReactionDef` rather than a special case:
   *
   *  - It **emits `reactionTriggered` and pays the Pip refund**, under the same 2/turn cap
   *    as everything else. Setting up a storm arc is as much work as setting up a Vaporize
   *    and is now paid the same.
   *  - It **requires the hit to land.** `conductShock` ran regardless of `hpLoss`, so a
   *    shock fully absorbed by plate still arced. Nothing else in the table works that way,
   *    and the inconsistency was invisible because nothing announced it.
   *
   * The arcs deal `physical`, not `shock`, so an arc cannot arc: the depth is exactly one
   * by construction, independently of the cascade ceiling that now also bounds it.
   */
  {
    id: 'arc',
    name: 'Arc',
    triggers: ['shock'],
    requiresWeather: 'rain',
    // Nothing to spend. The rain does not run out.
    consumes: false,
    requiresHpLoss: true,
    outcome: { op: 'conduct', damage: 10, dtype: 'physical' },
    text: 'Surge damage in the rain earths itself through everything touching the target: 10 damage to every adjacent unit, whoever it belongs to.',
  },
  {
    id: 'wildfire',
    name: 'Wildfire',
    triggers: ['fire'],
    requires: 'toxin',
    consumes: true,
    requiresHpLoss: true,
    outcome: { op: 'consumeForAoe', perStack: 20, dtype: 'fire' },
    text: 'Fire ignites Toxin, consuming every stack to deal 20 fire damage per stack to everything adjacent.',
  },
];

/**
 * The reaction a hit of this school would provoke, here, now.
 *
 * First match wins, so the array order above is the priority order: a target carrying
 * chill *and* charged *and* toxin, hit by fire, Vaporizes and does nothing else.
 *
 * A definition that named neither a status nor a weather would match every hit of its
 * type and fire forever; the guard makes that unrepresentable rather than merely unwise.
 */
export function findReaction(
  dtype: DamageType,
  statuses: Partial<Record<StatusKind, number>>,
  weather?: Weather['kind'],
): ReactionDef | undefined {
  return REACTIONS.find((r) => {
    if (!r.triggers.includes(dtype)) return false;
    if (!r.requires && !r.requiresWeather) return false;
    if (r.requires && (statuses[r.requires] ?? 0) <= 0) return false;
    if (r.requiresWeather && weather !== r.requiresWeather) return false;
    return true;
  });
}
