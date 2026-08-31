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
  /**
   * A Hero Deck, because that is what a duelist has.
   *
   * The blurb calls this "the honest test of your deck", and it was not one: this deck used
   * to hold five bodies and two Flame Surges, none of which the player's half may contain.
   * Beating it therefore taught you plans for cards you could never deck -- a minion goes
   * in a Vanguard and a Spell is the Companion's -- so most of the offer was noise.
   *
   * Every card below is one a Hero Deck can legally hold: **Abilities, Marks and
   * Constructs**, all of them neutral or arcane. `validateDeck` is not run against an enemy
   * deck, so nothing enforces this at runtime; `duelist.test.ts` does, by asking
   * `deckRoleRefusal` about every card here.
   *
   * All six Marks ride in it, which is the other half of the point. A Mark is the only way
   * the Hero puts an element on the board, and until this deck carried them there was no
   * fight in the game that taught one.
   */
  enemyDeck: [
    // Abilities -- the colourless utility both halves of a duel are built out of.
    'shield_bash',
    'shield_bash',
    'aegis_ward',
    'aegis_ward',
    'dark_tithe',
    'grapple_line',
    'aether_beam',
    // Constructs -- something between you and the Pact.
    'stone_barricade',
    'stone_barricade',
    'alchemists_barricade',
    // Marks, one per element. The duelist is where a player meets all six.
    'cinder_mark',
    'rime_mark',
    'arc_mark',
    'tremor_mark',
    'soul_splinter_mark',
    'rot_root_snare',
  ],
  /**
   * Their warband, deployed before the bell — because that is where bodies come from now.
   *
   * Taking the minions out of the deck above would otherwise have quietly made this fight
   * easier: five body-cards left and nothing replaced them. This is the replacement, and it
   * is the *player's own* Dusk starting roster, to the point — `startingRosterFor('dusk')`
   * is `vanguard_footman, scout_imp, ash_ghoul, grave_sentinel, hollowed_husk` and costs
   * exactly the 10-point budget a character gets.
   *
   * The **Footman is not listed here, and that is not an omission**: `setup.ts` already
   * hands the enemy a free `vanguard_footman` at the middle of row 1, which on a 6-wide
   * board is (3,1). Listing one too would field six bodies against a ten-point roster and
   * put a second unit on an occupied tile. Four here plus that one is the ten.
   *
   * So the duel is symmetric in both halves now. They deploy a warband and hold a Hero
   * Deck, exactly as you do, and neither of you can buy a body with Bones mid-fight.
   *
   * Rows 0-1 are theirs; (3,1) belongs to the free Footman and the back row is left clear
   * for the Companion body to place itself into.
   */
  enemyOpeningBoard: [
    ['grave_sentinel', 2, 1],
    ['ash_ghoul', 1, 1],
    ['scout_imp', 4, 1],
    ['hollowed_husk', 2, 0],
    // The arena pass: a 6x8 seats fourteen points and a duelist concedes nothing at the
    // coin. Two more dusk bodies bring the warband to the ground's own number.
    ['hollow_wraith', 5, 0],
    ['carrion_crow', 0, 0],
  ],
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
