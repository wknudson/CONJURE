/**
 * The King's Contracts — the remaining Novice fights (campaign, Wave 2).
 *
 * Five street-level jobs in Jolrek, per `docs/11_world_of_azo_and_the_kings_contracts.md`
 * §3. The Smoke-Eater duel lives in `campaign.duels.ts` with the other wagers.
 *
 * All of these run on stock bodies — see `docs/worldbuild-todo.md` for what each is
 * standing in for.
 */

import type { EncounterDef } from './registry.js';
import { registerEncounter, registerEncounterScript } from './registry.js';
import { SEAL_ONLY_SCRIPT } from './seal.js';

// These fights carry a `subjugationPrize` now, and a prize is inert without something to
// offer it: `beginSubjugation` is what deals the Rite, and an encounter opts in by calling
// it. The shared seal-only script fires at a quarter strength, so the starved gargoyle can be
// bound instead of killed — which in each case is the reading the contract's own evidence
// supports, and the game never says so out loud.
registerEncounterScript('fouled_cistern', SEAL_ONLY_SCRIPT);

/** Novice #3 — fog, an ambush, and three lamps that did not fail. */
export const LAMPLIGHTER_ESCORT: EncounterDef = registerEncounter({
  id: 'lamplighter_escort',
  name: 'Lamplighter Escort',
  blurb:
    'Three lamps dark on the Lamprow stretch and old Tam will not walk it alone. See him ' +
    'through to the last post.',
  width: 6,
  height: 8,
  playerHp: 400,
  enemyHp: 320,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Footpads',
  enemySchool: 'dusk',
  // TODO(worldbuild): footpads are stock dusk bodies; want laid-off miner units.
  enemyDeck: [
    'smoke_bomb',
    'shield_bash',
    'shield_bash',
    'dark_tithe',
    'grapple_line',
    'aegis_ward',
    'soul_splinter_mark',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['hollowed_husk', 4, 1],
    ['ash_ghoul', 2, 0],
  ],
  // The dark stretch itself: fog cuts vision to lamplight distances.
  weather: { kind: 'fog' },
  // Doorways and a parked barrow along the unlit run.
  terrain: [
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'cover' },
    { at: { x: 2, y: 4 }, kind: 'cover' },
    { at: { x: 4, y: 5 }, kind: 'wall' },
  ],
});

/** Novice #5 — a cramped cellar, a press, and a sheet still drying on the drum. */
export const DEBT_COLLECTED_MINOR: EncounterDef = registerEncounter({
  id: 'debt_collected_minor',
  name: 'A Debt Collected, Minor',
  blurb:
    'A printing press in a Lamprow cellar, to be seized against arrears. Bring gloves; ' +
    'ink does not wash out of a warrant.',
  // The smallest legal room but one: everything happens at arm's length.
  width: 6,
  height: 6,
  playerHp: 400,
  enemyHp: 300,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Printers',
  enemySchool: 'dusk',
  // TODO(worldbuild): printers with ink and hooks are stock bodies for now.
  enemyDeck: [
    'grapple_line',
    'shield_bash',
    'dark_tithe',
    'stone_barricade',
    'aegis_ward',
    'soul_splinter_mark',
  ],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['marrow_wisp', 4, 1],
    ['marrow_wisp', 2, 0],
  ],
  // The press and the paper stacks: a cellar is mostly furniture.
  terrain: [
    { at: { x: 2, y: 2 }, kind: 'wall' },
    { at: { x: 3, y: 2 }, kind: 'wall' },
    { at: { x: 1, y: 3 }, kind: 'cover' },
    { at: { x: 4, y: 3 }, kind: 'cover' },
  ],
});

/** Novice #7 — rain over the cistern, and a beast that was hiding, not hunting. */
export const FOULED_CISTERN: EncounterDef = registerEncounter({
  id: 'fouled_cistern',
  name: 'The Fouled Cistern',
  blurb:
    'Something has moved into the Ward Seven cistern and the water tastes of it. Put it ' +
    'down before the pumps foul.',
  width: 6,
  height: 7,
  playerHp: 400,
  // A starved juvenile: the lowest Pact in the campaign, and that is the tell.
  enemyHp: 260,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Thing Below',
  enemySchool: 'frost',
  enemyDeck: [
    'brittle_touch',
    'creeping_rime',
    'flash_freeze',
    'rime_mark',
    'aegis_ward',
  ],
  enemyOpeningBoard: [
    ['rime_fox', 1, 1],
    ['rime_fox', 4, 0],
  ],
  // The gargoyle pup itself, on the board — a Grave-Gargoyle's bound body.
  enemyCompanion: { unitCardId: 'gargoyle_bound' },
  // Rain drums on the grates above: fire dimmed, shock loud. The doc's named weather.
  weather: { kind: 'rain' },
  // Cistern pillars.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 1, y: 4 }, kind: 'cover' },
    { at: { x: 4, y: 2 }, kind: 'cover' },
  ],
  // It was hiding, not hunting — the Threat Ledger says so afterwards. Binding it is the
// reading the evidence already supports.
  subjugationPrize: 'gargoyle',
});

/** Novice #8 — bill-stickers, a lookout, and manifests someone wanted read. */
export const POSTER_WORK: EncounterDef = registerEncounter({
  id: 'poster_work',
  name: 'Poster Work',
  blurb:
    'Seditious bills on the Cinderworks fence, fresh paste every morning. Strip the fence ' +
    'and detain whoever holds the brush.',
  width: 6,
  height: 6,
  playerHp: 400,
  // The lightest opposition in the campaign. They are bill-stickers.
  enemyHp: 260,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Bill-Stickers',
  enemySchool: 'dusk',
  // TODO(worldbuild): flee-biased AI is not a data field; the crew fights like anything
  // else for now. The scavenger below is the lookout, who at least genuinely runs.
  enemyDeck: ['smoke_bomb', 'shield_bash', 'dark_tithe', 'aegis_ward', 'grapple_line'],
  enemyOpeningBoard: [
    ['scout_imp', 1, 1],
    ['scout_imp', 4, 1],
  ],
  // The lookout: arrives, grabs what matters, runs for the edge.
  scavenger: true,
  // The fence line itself, mid-board.
  terrain: [
    { at: { x: 1, y: 2 }, kind: 'cover' },
    { at: { x: 2, y: 2 }, kind: 'cover' },
    { at: { x: 4, y: 3 }, kind: 'cover' },
  ],
});

/** Novice #9 — two crews, sawn beams, and an insurance writ dated three days early. */
export const GUTTER_DISPUTE: EncounterDef = registerEncounter({
  id: 'gutter_dispute',
  name: 'Gutter Dispute',
  blurb:
    'The Hollis granary came down and two crews are contesting the scavenge. The ' +
    'Magistracy does not care who wins, only that it stops.',
  width: 7,
  height: 7,
  playerHp: 400,
  enemyHp: 330,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'Scavenge Crew',
  enemySchool: 'bulwark',
  // TODO(worldbuild): a genuinely three-sided scrap needs a third army; the rival crew is
  // approximated by turfwar bodies that maul whoever is nearest.
  enemyDeck: [
    'shield_bash',
    'shield_bash',
    'concussive_blow',
    'stone_barricade',
    'aegis_ward',
    'tremor_mark',
  ],
  enemyOpeningBoard: [
    ['shieldbearer', 1, 1],
    ['scout_imp', 5, 1],
    ['marrow_wisp', 2, 0],
  ],
  turfwar: { count: 2, unitCardId: 'marrow_hound' },
  // The collapse itself: rubble to fight over, and geodes in it worth the fighting.
  terrain: [
    { at: { x: 2, y: 3 }, kind: 'wall' },
    { at: { x: 4, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 4 }, kind: 'cover' },
    { at: { x: 1, y: 4 }, kind: 'cover' },
    { at: { x: 5, y: 2 }, kind: 'cover' },
  ],
  marrowGeodes: { min: 2, max: 4 },
});

/** Novice #10 — small loyal beasts, doorway by doorway, and a fine dated next month. */
export const CLINIC_QUOTA: EncounterDef = registerEncounter({
  id: 'clinic_quota',
  name: 'The Clinic Quota',
  blurb:
    'A back-alley clinic treats unregistered Whisperers and owes licensing fines it was ' +
    'never going to be allowed to avoid. Collect.',
  width: 6,
  height: 7,
  playerHp: 400,
  enemyHp: 310,
  playerName: 'Hero',
  companionName: 'Ignis',
  companionSchool: 'pyre',
  enemyName: 'The Minders',
  enemySchool: 'bloom',
  enemyDeck: [
    'sap_draught',
    'root_snare',
    'thornlash',
    'aegis_ward',
    'rot_root_snare',
    'shield_bash',
  ],
  // Small and loyal: a fox, a wolf, a wisp — patients' beasts, minding the doors.
  enemyOpeningBoard: [
    ['rime_fox', 1, 1],
    ['briar_wolf', 4, 1],
    ['sap_wisp', 2, 0],
  ],
  // The clinic's floor plan: two doorways, defended.
  terrain: [
    { at: { x: 0, y: 3 }, kind: 'wall' },
    { at: { x: 1, y: 3 }, kind: 'wall' },
    { at: { x: 3, y: 3 }, kind: 'wall' },
    { at: { x: 5, y: 3 }, kind: 'wall' },
    { at: { x: 2, y: 4 }, kind: 'cover' },
  ],
});
