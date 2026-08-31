/**
 * Vermin of the Bonemarket — story contract, Novice #2.
 *
 * Stall Row under the awnings: a cinder-wasp nest to burn out, market furniture for
 * cover, and a scavenger in the crowd because there is always a scavenger in the
 * Bonemarket. The nest-mother fights as the enemy Companion — a bound Cinder-Wasp Swarm
 * body — which is the first time the campaign shows the player an enemy Pact on the board.
 *
 * The crack (see `campaign.ts`): the comb is packed with confiscated grain, still in
 * sacks bearing the Magistracy's own seal.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';

// These fights carry a `subjugationPrize` now, and a prize is inert without something to
// offer it: `beginSubjugation` is what deals the Rite, and an encounter opts in by calling
// it. The shared seal-only script fires at a quarter strength, so the swarm can be
// bound instead of killed — which in each case is the reading the contract's own evidence
// supports, and the game never says so out loud.
registerEncounterScript('bonemarket_vermin', SEAL_ONLY_SCRIPT);

export const BONEMARKET_VERMIN: EncounterDef = registerEncounter({
  id: 'bonemarket_vermin',
  name: 'Vermin of the Bonemarket',
  blurb:
    'A cinder-wasp nest in the awnings over Stall Row, and market day is tomorrow. Paid ' +
    'by weight of comb recovered.',
  // 7x7: territory rows 0-1 and 5-6; three market rows between, cluttered with stalls.
  width: 7,
  height: 7,
  rosterBudget: 8,
  playerHp: 400,
  enemyHp: 320,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Nest',
  enemySchool: 'pyre',
  // A nest does not scheme; its deck is heat and reach.
  // TODO(worldbuild): swarm-flavoured spell set is approximated from pyre stock.
  enemyDeck: [
    'stoke',
    'cinder_gale',
    'ashen_wake',
    'cinder_mark',
    'shield_bash',
    'aegis_ward',
  ],
  // Drones on the wing. Ember moths stand in for wasp drones.
  // TODO(worldbuild): 'ember_moth' as wasp drones until a drone unit exists.
  enemyOpeningBoard: [
    ['ember_moth', 1, 1],
    ['ember_moth', 5, 1],
    ['ember_hound', 2, 0],
  ],
  // The nest-mother herself: the Cinder-Wasp Swarm's bound body, on the board, so the
  // fight is against something with a Pact behind it.
  enemyCompanion: { unitCardId: 'wasp_bound' },
  // Market furniture: stalls are cover, the fishmonger's slab is a wall you fight around.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 3 }, kind: 'cover' },
    { at: { x: 3, y: 2 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
  ],
  // Always a scavenger in the Bonemarket. The doc names this the contract's modifier.
  scavenger: true,
  marrowGeodes: { min: 1, max: 2 },
  // The swarm can be taken rather than burned out. Nobody on the market asked for that and
// nobody there will stop you.
  subjugationPrize: 'wasp',
});
