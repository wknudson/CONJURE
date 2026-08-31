/**
 * The Curfew Breakers — story contract, Novice #3.
 *
 * A night corner in Ashfall and an "assembly" that holds its spot and does not chase.
 * The doc specifies turfwar as the mechanical read: bodies arrive that belong to neither
 * army and maul whichever is nearest — the crowd's dogs, loose in the scuffle.
 *
 * The crack (see `campaign.ts`): the assembly is a bread queue, and the curfew was
 * posted the same week the dole was cut.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const CURFEW_BREAKERS: EncounterDef = registerEncounter({
  id: 'curfew_breakers',
  name: 'The Curfew Breakers',
  blurb:
    'An unlawful assembly, same Ashfall corner every night after the bell. Disperse it. ' +
    'The Magistracy dislikes patterns.',
  // 6x8, the novice duelist's lane shape: a street, fought down its length.
  width: 6,
  height: 8,
  rosterBudget: 8,
  playerHp: 400,
  enemyHp: 340,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Assembly',
  enemySchool: 'bulwark',
  // They hold ground; their deck is walls and shoves, nothing that advances.
  // TODO(worldbuild): crowd-flavoured units; shieldbearers stand in for linked arms.
  enemyDeck: [
    'bastion_stance',
    'phalanx_step',
    'stone_barricade',
    'stone_barricade',
    'shield_bash',
    'aegis_ward',
    'tremor_mark',
  ],
  enemyOpeningBoard: [
    ['shieldbearer', 1, 1],
    ['shieldbearer', 4, 1],
    ['scout_imp', 2, 0],
  ],
  // The Assembly holds ground and so does this: the Pact's body, planted in the street.
  enemyCompanion: { unitCardId: 'crab_bound' },
  // Loose dogs in the scuffle: feral bodies that maul whichever side is nearest.
  // TODO(worldbuild): 'marrow_hound' as the crowd's dogs until a street-dog unit exists.
  turfwar: { count: 2, unitCardId: 'marrow_hound' },
  // A barrow and two bench-stalls in the street's middle rows.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 4 }, kind: 'cover' },
    { at: { x: 1, y: 4 }, kind: 'wall' },
  ],
});
