/**
 * The Summons — the campaign finale (Wave 4).
 *
 * Not a bounty: a royal writ with the player's name on it, and the last poster the
 * campaign puts on the board. The road to the Spire has no fight on it — the city
 * cheers the delivery through Highcourt — so the encounter IS the throne room, per
 * `docs/11_world_of_azo_and_the_kings_contracts.md` §6.
 *
 * The fight runs the `ignis_trial` machinery whole, because the doc specifies exactly
 * that — and since both fights want it, the machinery now lives in `bossPhases.ts` and
 * this file names the knobs: the 50% damage gate clamps and cancels the chain, the purge
 * shrugs off whatever was saved for the moment, and Vane docks from his phase-1 form
 * into the 2x2 Clockwork Colossus. No Forced Eviction — the Colossus rises where the
 * floor opens, or waits while the throne guard clears it. At 25% the Harpoon Protocol
 * fires — `beginSubjugation` seals the engine, injects the Rite, and the three-round
 * siege ends it. There is **no subjugationPrize**, and that is the point of the ending:
 * a seal without a prize is a `bound` result that pays like a victory and adds nothing
 * to the roster. Vane is subjugated by the exact instrument he built to license the
 * wild, and what the player keeps is Azo.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { growAtHalfScript } from './bossPhases.js';

const ENCOUNTER_ID = 'the_summons';

const script = growAtHalfScript({
  phaseName: 'The Great Quieting',
  grownDefId: 'colossus_bound',
  addDefId: 'grave_sentinel',
  // Where the throne guard answers if the Colossus is boxed in.
  addSpawns: [
    [2, 1],
    [5, 1],
    [3, 0],
  ],
  forcedEviction: false,
});

registerEncounterScript(ENCOUNTER_ID, script);

export const THE_SUMMONS: EncounterDef = registerEncounter({
  id: ENCOUNTER_ID,
  name: 'The Summons: the Chrono-Spire',
  blurb:
    'He thanks you by name, by contract, in order — the roads you cleared, the beasts ' +
    'you brought to harness, the core you carried in. Then he tells you what it keys. ' +
    'You were never hunting threats. You were collecting his collateral.',
  width: 8,
  height: 8,
  rosterBudget: 10,
  playerHp: 400,
  // The largest Pact in the game. He has been collecting it all campaign.
  enemyHp: 500,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Lord Magistrate Vane',
  enemySchool: 'surge',
  // Surge/dusk, cascade-heavy, per the doc: culls and tithes behind sentinel steel.
  enemyDeck: [
    'chain_bolt',
    'discharge',
    'arc_lash',
    'paralytic_arc',
    'wither',
    'shadow_siphon',
    'dark_tithe',
    'cull_the_weak',
    'arc_mark',
    'soul_splinter_mark',
    'aegis_ward',
    'aegis_ward',
  ],
  // The royal sentinels he casts from behind.
  enemyOpeningBoard: [
    ['grave_sentinel', 2, 1],
    ['grave_sentinel', 5, 1],
    ['galvanic_revenant', 3, 0],
    ['storm_rod', 5, 0],
  ],
  // Phase 1: the Lord Magistrate on the dais, his Ink Owl beside the throne. The owl is
  // the body the Colossus docks from — the Magistracy's bird, traded for its engine.
  enemyCompanion: { unitCardId: 'lexis_bound' },
  // The throne room: pillar colonnades, and clean floor where the Colossus will need it.
  terrain: [
    { at: { x: 1, y: 2 }, kind: 'wall' },
    { at: { x: 6, y: 2 }, kind: 'wall' },
    { at: { x: 1, y: 5 }, kind: 'wall' },
    { at: { x: 6, y: 5 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
    { at: { x: 4, y: 3 }, kind: 'cover' },
  ],
  script,
});
