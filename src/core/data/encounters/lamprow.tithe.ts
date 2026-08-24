/**
 * The Lamprow Tithe — story contract, Novice #1.
 *
 * A cramped yard behind the lighters' hall, and a gutter crew defending it with what a
 * kitchen holds. The first fight of the campaign, so it is deliberately the gentlest
 * board in the catalogue: small, close, one screen of cover, no enemy Companion.
 *
 * The crack (see `campaign.ts`): the arrears ledger shows the debt already paid, twice.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const LAMPROW_TITHE: EncounterDef = registerEncounter({
  id: 'lamprow_tithe',
  name: 'The Lamprow Tithe',
  blurb:
    'A collection call behind the lighters’ hall. The crew owes three seasons of lamp-tax ' +
    'and Dispatch would like the ledger settled quietly.',
  // 6x6: territory rows are 0-1 and 4-5, leaving a two-row yard in the middle. The whole
  // fight happens across a kitchen table's worth of ground, which is the point.
  width: 6,
  height: 6,
  playerHp: 400,
  enemyHp: 300,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Gutter Crew',
  enemySchool: 'dusk',
  // TODO(worldbuild): "kitchen-tool minions" are stock bodies for now — scout imps and a
  // marrow wisp standing in for pan-wielders until the crew gets its own units/art.
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'dark_tithe',
    'aegis_ward',
    'stone_barricade',
    'grapple_line',
    'soul_splinter_mark',
  ],
  // Rows 0-1 are theirs; setup places their free vanguard_footman at (3,1), so nothing
  // else stands there.
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['scout_imp', 4, 0],
    ['marrow_wisp', 2, 0],
  ],
  // No enemyCompanion: a gutter crew has no bound beast, and the first story fight
  // should not teach the mirror-Pact rule yet.
  // An overturned cart and a stack of crates split the yard without walling it.
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'cover' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
  ],
});
