/**
 * The Novice Duelist: a straightforward mirror-ish fight with no script hooks.
 * This is the encounter that proves the core combat loop is fun.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const NOVICE_DUELIST: EncounterDef = registerEncounter({
  id: 'novice_duelist',
  name: 'Wandering Novice Duelist',
  blurb:
    'A hedge-mage looking for an easy purse. Standard rules, no tricks — the honest test of your deck.',
  // A narrow lane: 6 wide but 8 deep, so closing the distance takes real turns and the
  // approach itself is a decision. Rows 6-7 are yours, 0-1 theirs, four neutral between.
  width: 6,
  height: 8,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Novice Duelist',
  enemySchool: 'dusk',
  enemyDeck: [
    'scout_imp',
    'scout_imp',
    'marrow_wisp',
    'grave_sentinel',
    'grave_sentinel',
    'cinder_mark',
    'flame_surge',
    'flame_surge',
    'shield_bash',
    'shield_bash',
    'stone_barricade',
    'aegis_ward',
    'dark_tithe',
    'soul_splinter_mark',
    'magma_brute',
  ],
  enemyOpeningBoard: [['scout_imp', 4, 1]],
  // A duelist, so they fight as you do: their Companion stands on the board, their spells
  // are cast from it, and shoving it into a wall costs them exactly what it would cost you.
  enemyCompanion: { unitCardId: 'umbra_bound' },
  // Something to fight over in the middle before either side is really ready to.
  marrowGeodes: { min: 1, max: 3 },
  // A hedge-mage's duel on open road: someone else's purse wanders through it.
  scavenger: true,
  // Two bramble screens midfield break the sightlines down the lane without walling it,
  // and a pair of rubble blocks force melee to commit to a side.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 4 }, kind: 'cover' },
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
  ],
});
