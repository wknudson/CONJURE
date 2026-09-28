/**
 * The Journeyman Duelist: the Adept poster's honest duel.
 *
 * The Novice Duelist is where a player meets the Hero's first shelf; this is where they meet
 * the second. Its deck is the colourless half of `cards/hero.ts` — every neutral ability and
 * construct the Hero kit added — so beating it is how a player comes to own a Bola or a
 * Weighted Net at all. A duel teaches by being lost to: a player who has been Entangled
 * twice by it knows exactly what the card is for.
 *
 * Posted on the Adept rolled pool (`bounties.ts`) and wagered like every duel. It is not a
 * story contract and awards no beast; a duelist's Companion is theirs to keep.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter } from './registry.js';

export const ADEPT_DUELIST: EncounterDef = registerEncounter({
  id: 'adept_duelist',
  name: 'The Journeyman Duelist',
  blurb:
    'A journeyman working the ward circuit for a master’s seal. Rope, nets and a crate of ' +
    'somebody else’s supplies — every trick in the kit, and happy to show you all of them.',
  // Seven wide and eight deep: a lane wide enough for a net to catch three, and long enough
  // that Scatter Debris laid across the middle costs a real turn.
  width: 7,
  height: 8,
  playerHp: 400,
  enemyHp: 430,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Journeyman Duelist',
  enemySchool: 'surge',
  /**
   * The neutral shelf, whole, so the Adept poster teaches every card of it.
   *
   * Hero-legal throughout — Abilities, Constructs and two Marks — which `duelist.test.ts`
   * asks of every duel. Two Bolas because it is the cheapest card in the kit and the one a
   * journeyman would lean on; one of everything else.
   */
  enemyDeck: [
    'bola',
    'bola',
    'weighted_net',
    'brace_and_heave',
    'sledgehammer',
    'forced_march',
    'pike_thrust',
    'scatter_debris',
    'cut_loose',
    'second_wind',
    'field_dressing',
    'supply_run',
    'quick_study',
    'sandbag_wall',
    'supply_crate',
    'tar_barrel',
    'arc_mark',
    'tremor_mark',
  ],
  /**
   * A Surge warband worth the arena: thirteen points authored plus the free Footman at the
   * middle of row 1, which on a 7-wide board is (3,1) and is left clear here.
   */
  enemyOpeningBoard: [
    ['voltaic_hound', 1, 1],
    ['static_hare', 5, 1],
    ['voltaic_coil', 2, 1],
    ['storm_wisp', 4, 1],
    ['clockwork_bombardier', 3, 0],
    ['storm_rod', 6, 0],
  ],
  // The Conduit Kudu: a caster that stands back and throws, which is what a journeyman who
  // relies on rope and nets wants beside them.
  enemyCompanion: { unitCardId: 'kudu_bound' },
  marrowGeodes: { min: 1, max: 2 },
  scavenger: true,
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 5, y: 4 }, kind: 'cover' },
    { at: { x: 3, y: 4 }, kind: 'wall' },
  ],
});
