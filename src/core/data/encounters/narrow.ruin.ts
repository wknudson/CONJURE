/**
 * The Narrow Ruin — 4 wide, 6 deep.
 *
 * The smallest arena the rules accept, and the first to make the grid itself the enemy.
 * Four columns means there is no flank: everything happens in one corridor, and the two
 * neutral rows between the territories are the whole of the contested ground.
 *
 * It is built around the archetypes rather than around a duel. A turret in a four-wide
 * corridor is an area-denial puzzle with one answer — get something in the way, or shove
 * it — and a marksman covering the only lane means the approach has to be bought.
 *
 * The Warden is embodied, like every Commander: a Hero cannot be swung at, so the only
 * way to the Pact at the end of the corridor is the body standing in it. In four columns
 * that is the whole puzzle — the turret denies the lane, and the thing you actually have
 * to reach is behind it.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const NARROW_RUIN: EncounterDef = registerEncounter({
  id: 'narrow_ruin',
  name: 'The Narrow Ruin',
  blurb:
    'A collapsed hall four paces wide. A gale runs its length, something is emplaced at the far end, and the only way through is the way they are watching.',
  width: 4,
  height: 6,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Ruin Warden',
  enemySchool: 'bulwark',
  enemyDeck: [
    'arc_turret',
    'longshot_stalker',
    'stone_barricade',
    'stone_barricade',
    'grave_sentinel',
    'grave_sentinel',
    'shield_bash',
    'shield_bash',
    'aegis_ward',
    'scout_imp',
    'scout_imp',
    'dark_tithe',
  ],
  enemyOpeningBoard: [['arc_turret', 1, 1]],
  // The Warden is emplaced and so is what they are bound to. In a four-wide hall a
  // tortoise is a second wall, and the only door to the Pact behind it.
  enemyCompanion: { unitCardId: 'tortoise_bound' },
  // Blowing down the hall toward the player: the Warden's shots carry, and the player's
  // fall short until they close. The corridor is the pressure; the wind is the reason
  // standing still in it is worse than advancing.
  weather: { kind: 'gale', wind: { x: 0, y: 1 } },
  terrain: [
    { at: { x: 1, y: 2 }, kind: 'cover' },
    { at: { x: 2, y: 3 }, kind: 'wall' },
  ],
  // A barrel in the middle of a four-wide corridor is impossible to fight around
  // politely: whoever breaks it decides who is standing next to it.
  props: [{ at: { x: 2, y: 2 }, defId: 'magma_crystal' }],
  // One flank is a moving floor, running the length of the hall toward the enemy. Free
  // ground if taken deliberately; a delivery service into the turret's teeth if not.
  currents: [
    { at: { x: 0, y: 4 }, dir: { x: 0, y: -1 } },
    { at: { x: 0, y: 3 }, dir: { x: 0, y: -1 } },
    { at: { x: 0, y: 2 }, dir: { x: 0, y: -1 } },
  ],
  marrowGeodes: { min: 1, max: 2 },
});
