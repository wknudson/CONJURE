/**
 * The Lamprow Tithe — story contract, Novice #1.
 *
 * A cramped yard behind the lighters' hall, and a gutter crew defending it with what a
 * kitchen holds. The first fight of the campaign, so it is deliberately the gentlest
 * board in the catalogue: small, close, one screen of cover, and a Bound Form that is
 * plainly the thing to break — which is the rule the whole campaign runs on, taught on
 * the smallest board it can be taught on.
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
  // The crew's dog, and the whole of the way to their Pact — a Commander cannot be swung
  // at, so the first story fight is where that gets taught rather than where it is spared.
  // Placed off the default lane because the scout at (4,0) already has it.
  enemyCompanion: { unitCardId: 'jackal_bound', at: { x: 5, y: 0 } },
  // An overturned cart and a stack of crates split the yard without walling it.
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'cover' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
  ],
});
