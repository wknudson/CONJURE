/**
 * The Chalk Road Toll — story contract, Adept #1.
 *
 * A road ambush in the rain outside Millharrow: hedges for cover, a long board so the
 * approach is fought before the fight is, and weather doing real work (rain: fire −10,
 * shock +10). The first countersigned contract, and the first one whose crack cannot be
 * mistaken for paperwork error.
 *
 * The crack (see `campaign.ts`): the bandits' haul is bread and seed-tools, and their
 * chief is fourteen with a tithe brand.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const CHALK_ROAD_TOLL: EncounterDef = registerEncounter({
  id: 'chalk_road_toll',
  name: 'The Chalk Road Toll',
  blurb:
    'Grain wagons are being stopped on the Chalk Road outside Millharrow. The freight ' +
    'schedule does not move for weather or for sentiment. End it.',
  // 6x9: a road. Territory rows 0-1 and 7-8; five open rows of verge and hedge between,
  // so closing the distance in the rain is most of the fight.
  width: 6,
  height: 9,
  rosterBudget: 10,
  playerHp: 400,
  enemyHp: 380,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Road Toll',
  enemySchool: 'bloom',
  // Farmhands turned ambushers: snares, roots, thrown stones.
  // TODO(worldbuild): bandit-flavoured deck approximated from stock; wants its own units.
  enemyDeck: [
    'grapple_line',
    'rot_root_snare',
    'shield_bash',
    'shield_bash',
    'stone_barricade',
    'aegis_ward',
    'dark_tithe',
    'cinder_mark',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['scout_imp', 4, 1],
    ['grave_sentinel', 2, 0],
    ['marrow_wisp', 4, 0],
  ],
  // Their "chief" fights beside them — a tamed working beast, not a war companion.
  // TODO(worldbuild): 'ferrum_bound' (a vault boar) as the farm beast; wants a lighter body.
  enemyCompanion: { unitCardId: 'ferrum_bound' },
  // Rain over the whole fight: the doc's named weather, and it matters — fire is dimmed,
  // shock is loud, and arc reactions become live if anyone brings a storm.
  weather: { kind: 'rain' },
  // Hedgerows down the verges, a fallen cart mid-road.
  terrain: [
    { at: { x: 0, y: 3 }, kind: 'cover' },
    { at: { x: 0, y: 5 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 5, y: 6 }, kind: 'cover' },
    { at: { x: 2, y: 4 }, kind: 'wall' },
    { at: { x: 3, y: 5 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 1, max: 3 },
});
