/**
 * The King's Contracts — the wager duels (campaign, Wave 2).
 *
 * Three duelists on the ladder the design doc runs under the whole arc: a broken veteran
 * in Highcourt, a discharged King's Duelist poaching the Ashwood fringe, and the man
 * Millharrow feeds on the Waystone bridge. Every one is a person across a board, so every
 * one is a bet — the campaign marks them `wager: true` and the board stakes the tier.
 *
 * Like the Novice Duelist, their decks are Hero-legal kit (abilities, marks, constructs),
 * because that is what a duelist has.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';

/**
 * Every duelist here stakes their beast as well as their purse.
 *
 * A wager duel was previously the one fight shape that could not end in a binding: the
 * duelists all fielded a stock `umbra_bound` and none of them carried a `subjugationPrize`,
 * so beating one paid money and nothing else. Now each carries the beast the doc gave them,
 * and the seal fires at a quarter strength like everywhere else — so a duel can be won by
 * taking the animal instead of the man, which is the mercy the whole campaign is quietly
 * arguing for.
 *
 * The script is the shared seal-only one: a duelist is a person with a beast, not a boss
 * with phases, so there is no gate to fire at half.
 */
const DUEL_IDS = ['smoke_eaters_rest', 'ashwood_poacher', 'coldwater_duel', 'waystone_duel'];
for (const id of DUEL_IDS) registerEncounterScript(id, SEAL_ONLY_SCRIPT);

/** Novice #6 — the veteran who heard the floor eating. */
export const SMOKE_EATERS_REST: EncounterDef = registerEncounter({
  id: 'smoke_eaters_rest',
  name: 'Smoke-Eater’s Rest',
  blurb:
    'A cracked veteran has claimed a bench on Highcourt plaza and duels anyone the ' +
    'Wardens send to move him. Be politer than the last three.',
  width: 7,
  height: 7,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Smoke-Eater',
  enemySchool: 'bulwark',
  // An old soldier's kit: shields, grapples, and the discipline of a man who stood post.
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'aegis_ward',
    'aegis_ward',
    'grapple_line',
    'concussive_blow',
    'stone_barricade',
    'tremor_mark',
    'cinder_mark',
  ],
  // What is left of his old squad, drilled and square.
  enemyOpeningBoard: [
    ['shieldbearer', 2, 1],
    ['shieldbearer', 4, 1],
    ['grave_sentinel', 2, 0],
  ],
  // A Hedgefort: a standing stone the hedge grew through, and about as willing to move as
  // the old soldier casting from behind it.
  enemyCompanion: { unitCardId: 'crab_bound' },
  // Bind it and it is yours. A duel staked on the beast rather than only on the purse —
  // the Smoke-Eater has nothing else left to put up.
  subjugationPrize: 'crab',
  // A plaza: clean ground, two benches, one fountain. A duel, not an ambush.
  terrain: [
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
  ],
});

/** Adept #6 — the discharged King's Duelist, poaching the forest he refused to burn. */
export const ASHWOOD_POACHER: EncounterDef = registerEncounter({
  id: 'ashwood_poacher',
  name: 'The Poacher of the Ashwood Fringe',
  blurb:
    'A poacher-duelist is bleeding the King’s forest and mocking the wardens sent after ' +
    'him. Bring back his medallion, whole or otherwise.',
  width: 7,
  height: 8,
  playerHp: 400,
  enemyHp: 400,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Poacher',
  enemySchool: 'bloom',
  // A woodsman's duel: snares, sightlines, and patience.
  enemyDeck: [
    'grapple_line',
    'aether_beam',
    'shield_bash',
    'aegis_ward',
    'stone_barricade',
    'rot_root_snare',
    'rime_mark',
    'soul_splinter_mark',
  ],
  enemyOpeningBoard: [
    ['longshot_stalker', 1, 1],
    ['briar_wolf', 5, 1],
    ['briar_wolf', 2, 0],
  ],
  // Something taken from the wood, as a discharged man's beast should be: antlers with
  // last winter's thorns still frozen into them.
  enemyCompanion: { unitCardId: 'elk_bound' },
  subjugationPrize: 'elk',
  // The fringe under fog: trunks and thickets, sight bought a tile at a time.
  weather: { kind: 'fog' },
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'cover' },
    { at: { x: 2, y: 5 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'cover' },
    { at: { x: 6, y: 2 }, kind: 'cover' },
  ],
});

/** Master #6 — the King's Duelist who cleared Weeping Stile, and cannot stop saying so. */
export const COLDWATER_DUEL: EncounterDef = registerEncounter({
  id: 'coldwater_duel',
  name: 'The King’s Duelist: Coldwater',
  blurb:
    'The first of the King’s Duelists requests you by name, on ground of her choosing. ' +
    'This is an honor. The fee schedule says so.',
  width: 8,
  height: 8,
  playerHp: 400,
  enemyHp: 460,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Coldwater',
  enemySchool: 'dusk',
  // The doc's brief: devour and cascade. Culls, harvests, tithes — a duelist who wins by
  // spending what falls.
  enemyDeck: [
    'cull_the_weak',
    'harvest_the_weak',
    'dark_tithe',
    'dark_tithe',
    'shield_bash',
    'shield_bash',
    'aegis_ward',
    'aegis_ward',
    'aether_beam',
    'soul_splinter_mark',
    'arc_mark',
  ],
  enemyOpeningBoard: [
    ['galvanic_revenant', 2, 1],
    ['grave_sentinel', 5, 1],
    ['hollow_wraith', 3, 0],
  ],
  // A King's Duelist warrants her own beast, and Coldwater's is what is left of a
  // lamplighter who kept going back for the wick. She does not say where she got it.
  enemyCompanion: { unitCardId: 'shade_bound' },
  subjugationPrize: 'shade',
  // Ground of her choosing: a clean court, one obstruction, nowhere to hide from her.
  terrain: [
    { at: { x: 3, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
  ],
});

/** Adept #10 — the man Millharrow feeds, holding the bridge against the toll. */
export const WAYSTONE_DUEL: EncounterDef = registerEncounter({
  id: 'waystone_duel',
  name: 'Duel at the Waystone',
  blurb:
    'A duelist holds the Waystone bridge and turns the toll-men back at the parapet. The ' +
    'crown wants its road, and is paying you to want it too.',
  width: 6,
  height: 9,
  playerHp: 400,
  enemyHp: 420,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Waystone Duelist',
  enemySchool: 'bulwark',
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'concussive_blow',
    'aegis_ward',
    'aegis_ward',
    'bastion_stance',
    'stone_barricade',
    'tremor_mark',
    'arc_mark',
  ],
  enemyOpeningBoard: [
    ['shieldbearer', 2, 1],
    ['anvil_lord', 4, 1],
  ],
  // Hedge lightning, coiled in the bridge's own briar. The children who bring him bread
  // walk past it twice a day and it has never once moved.
  enemyCompanion: { unitCardId: 'serpent_bound' },
  subjugationPrize: 'serpent',
  // The gale funnels down the river as it always does at the Waystone.
  weather: { kind: 'gale', wind: { x: 0, y: 1 } },
  // The bridge: parapets wall both edges through the middle rows, leaving a two-tile
  // lane. A one-lane fight, exactly as the doc bills it.
  terrain: [
    { at: { x: 0, y: 2 }, kind: 'wall' },
    { at: { x: 1, y: 2 }, kind: 'wall' },
    { at: { x: 4, y: 2 }, kind: 'wall' },
    { at: { x: 5, y: 2 }, kind: 'wall' },
    { at: { x: 0, y: 4 }, kind: 'wall' },
    { at: { x: 1, y: 4 }, kind: 'wall' },
    { at: { x: 4, y: 4 }, kind: 'wall' },
    { at: { x: 5, y: 4 }, kind: 'wall' },
    { at: { x: 0, y: 6 }, kind: 'wall' },
    { at: { x: 1, y: 6 }, kind: 'wall' },
    { at: { x: 4, y: 6 }, kind: 'wall' },
    { at: { x: 5, y: 6 }, kind: 'wall' },
  ],
});
