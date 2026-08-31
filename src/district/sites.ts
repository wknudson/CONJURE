/**
 * Contract sites: where the work actually is.
 *
 * The bounty board is a briefing surface now — a poster says what the next job is and
 * where, and the fight is launched by walking up to the ground the writ names. This
 * registry is that ground: one site per story contract, plus the regional apex lairs,
 * placed by the same fiction the campaign was written in (most contracts name their
 * ward outright; the handful that don't are decided here and say why).
 *
 * The house pattern, deliberately: like `errands.ts` and `stalls.ts`, this file is pure
 * data addressed into areas from outside, so it touches none of the nineteen area files.
 * Liveness is stateless — a story site is live iff its contract's bounty is on the
 * composed board the district already holds, which IS `nextStoryContract` read back; a
 * lair is live when its gate opens and its cooldown has lapsed. Nothing here writes or
 * reads a save field of its own.
 *
 * Coordinates are world units (TILE = 4), picked against each area's authored grid and
 * kept clear of props; `sites.test.ts` holds every entry to a real area and a real
 * encounter.
 *
 * **Liveness is evaluated at area mount**, because `buildInteractables` runs once. A
 * gate that opens or a lair cooldown that lapses while the player is standing in the
 * ward will not surface its hotspot until they leave and return. Deliberate for now:
 * gates only change when the campaign ledger does, which happens through a fight the
 * player returns from, and a lair's ten-minute clock against a multi-ward walk makes
 * the stale window a curiosity rather than a wall. Flagged by the concurrent session
 * after its frozen-clock fix (`tickClock`, 60a336e) made in-ward time real — if wards
 * ever gain live re-evaluation of interactables, sites should join it.
 */

import type { Gate } from './chronicle.js';
import type { FolkId } from '../render/folk.js';

export interface ContractSite {
  /** `${areaId}:${slug}` — the errand and stall naming idiom. */
  readonly id: string;
  /** Must name an id in `areas/index.ts`. */
  readonly areaId: string;
  /** World units within that area. */
  readonly at: { readonly x: number; readonly z: number };
  /** The story contract or lair encounter this ground launches. */
  readonly encounterId: string;
  /** What the player reads when near it. */
  readonly label: string;
  /** One line more, shown on interact — the atlas voice. Stake warnings live here too. */
  readonly interactDetail?: string;
  /** Extra availability on top of board/cooldown liveness, e.g. the epilogue's finale gate. */
  readonly gate?: Gate;
  /**
   * Who is standing here, for the sites that are a person rather than a place.
   *
   * The wager duels only. A duel site's whole fiction is somebody waiting on the ground of
   * the fight, so while the contract is live the figure stands at `at` and *is* the
   * interactable -- walking up to the Smoke-Eater and talking to him is how the wager is
   * offered. Every other site stays a bare hotspot, because a granary door is not a person.
   * Drawn from the duelists sheet (`render/folk.ts`); hand-matched to each duelist's own
   * description rather than rolled, for the same reason the towns' cast lists are authored.
   */
  readonly duelist?: FolkId;
}

export const CONTRACT_SITES: readonly ContractSite[] = [
  // ---- Novice: Jolrek and its outskirts (0-2 crossings from the plaza) --------------
  {
    id: 'lamprow:tithe',
    areaId: 'lamprow',
    at: { x: 30, z: -10 },
    encounterId: 'lamprow_tithe',
    label: 'Behind the Lighters’ Hall',
    interactDetail:
      'A squat behind the hall, a stove going, and a receipt in a pot that Dispatch would rather you did not read first.',
  },
  {
    id: 'bonemarket:vermin',
    areaId: 'bonemarket',
    at: { x: 34, z: -14 },
    encounterId: 'bonemarket_vermin',
    label: 'Stall Row',
    interactDetail:
      'The awnings over Stall Row are sagging with comb, and the comb is heavier than comb should be.',
  },
  {
    id: 'lamprow:dark_stretch',
    areaId: 'lamprow',
    at: { x: -14, z: -6 },
    encounterId: 'lamplighter_escort',
    label: 'The Dark Stretch',
    interactDetail:
      'Three posts, three cold wicks, and old Tam waiting at the first one because he will not walk it alone.',
  },
  {
    id: 'ashfall_ward:bakery_door',
    areaId: 'ashfall_ward',
    at: { x: 22, z: -4 },
    encounterId: 'curfew_breakers',
    label: 'The Bakery Door',
    interactDetail:
      'The same corner, every night after the bell. The door behind where they stand is still warm.',
  },
  {
    id: 'lamprow:printers_cellar',
    areaId: 'lamprow',
    at: { x: -22, z: 26 },
    encounterId: 'debt_collected_minor',
    label: 'The Printers’ Cellar',
    interactDetail:
      'A cellar door below the Sink, and the smell of ink through the boards. The warrant says bring gloves.',
  },
  {
    id: 'highcourt:smoke_eaters_bench',
    areaId: 'highcourt',
    at: { x: 6, z: -6 },
    encounterId: 'smoke_eaters_rest',
    label: 'The Smoke-Eater’s Bench',
    // The barefoot veteran: the man the blurb says has nothing left to put up but the beast.
    duelist: 'novice_wanderer_c',
    interactDetail:
      'He has claimed the bench, and the clean-air trade walks the long way round him. He duels anyone the Wardens send — and duels are wagered.',
  },
  {
    id: 'ward_seven:cistern_mouth',
    areaId: 'ward_seven',
    at: { x: -10, z: -22 },
    encounterId: 'fouled_cistern',
    label: 'The Cistern Mouth',
    interactDetail:
      'The pumps foul by noon and the water tastes of what is living in it. The ward has stopped drawing from the north pipe.',
  },
  {
    id: 'cinderworks:bill_fence',
    areaId: 'cinderworks',
    at: { x: -26, z: 30 },
    encounterId: 'poster_work',
    label: 'The Bill Fence',
    interactDetail:
      'Fresh paste every morning, the length of the fence. Somebody wants these read more than they want to be paid.',
  },
  {
    // Inside the Warden's beat, deliberately: reaching the site means reading the cone,
    // which is the ward's one lesson.
    id: 'ashfall_ward:hollis_granary',
    areaId: 'ashfall_ward',
    at: { x: -22, z: -2 },
    encounterId: 'gutter_dispute',
    label: 'The Hollis Granary',
    interactDetail:
      'The granary came down in the night and two crews are already inside the frame. The beams did not break quietly.',
  },
  {
    // The fiction names no ward — decided: Ward Seven, the wet poor ward where the
    // healer, apothecary and herbalist already stand. A clinic for unregistered
    // Whisperers belongs where the Magistracy's water went bad.
    id: 'ward_seven:back_alley_clinic',
    areaId: 'ward_seven',
    at: { x: 14, z: 22 },
    encounterId: 'clinic_quota',
    label: 'The Back-Alley Clinic',
    interactDetail:
      'No sign, one lamp, and a queue that scatters when you turn the corner. The schedule of fees is already in your hand.',
  },

  // ---- Adept: the Middle Ring --------------------------------------------------------
  {
    // The Freight-Pickers' roam circle overlaps this stretch: an ambush on the way to an
    // ambush, and intended.
    id: 'chalk_road:toll_stretch',
    areaId: 'chalk_road',
    at: { x: -26, z: 6 },
    encounterId: 'chalk_road_toll',
    label: 'The Toll Stretch',
    interactDetail:
      'Broken axle-grease and bootprints either side of the ruts. The wagons are stopped here, and it is not the hedge doing it.',
  },
  {
    id: 'tallow_levels:north_field',
    areaId: 'tallow_levels',
    at: { x: -18, z: -26 },
    encounterId: 'tallow_blight',
    label: 'The North Field',
    interactDetail:
      'One torn line, fence to fence, straight as a surveyor’s chain. Nothing else in the field is touched.',
  },
  {
    id: 'saltglass:customs_chain',
    areaId: 'saltglass',
    at: { x: -6, z: -30 },
    encounterId: 'saltglass_riot',
    label: 'The Customs Chain',
    interactDetail:
      'The crowd on the quay is not dispersing, and the chain across the harbour mouth has a writ tag nobody will read aloud.',
  },
  {
    id: 'brays_hollow:marsh_farmstead',
    areaId: 'brays_hollow',
    at: { x: -10, z: -6 },
    encounterId: 'warrant_of_distraint',
    label: 'The Marsh Farmstead',
    interactDetail:
      'Hurdles, a yard, and a family standing in front of a boar that is standing in front of them. The schedule of fees is attached.',
  },
  {
    id: 'fenwicks_crossing:sealed_wagon',
    areaId: 'fenwicks_crossing',
    at: { x: 10, z: -26 },
    encounterId: 'night_freight',
    label: 'The Sealed Wagon',
    interactDetail:
      'It waits at the bridgehead with its lamps doused. Do not open the crates. Do not answer questions about the crates.',
  },
  {
    id: 'ashwood:poachers_fire',
    areaId: 'ashwood',
    at: { x: 14, z: 38 },
    encounterId: 'ashwood_poacher',
    label: 'The Poacher’s Fire',
    // Sword and bedroll, dressed for the fringe he is bleeding.
    duelist: 'adept_journeyman_c',
    interactDetail:
      'A banked fire just off the ride, laid by somebody who wants to be found by the right person. Duels are wagered.',
  },
  {
    id: 'fenwicks_crossing:inn_cellar',
    areaId: 'fenwicks_crossing',
    at: { x: -26, z: 18 },
    encounterId: 'cellar_clearance',
    label: 'The Inn Cellar',
    interactDetail:
      'The trapdoor behind the coach inn, and the barking underneath it, and a landlord who would rather the Crossing were not burnt down.',
  },
  {
    id: 'weeping_stile:cold_hearths',
    areaId: 'weeping_stile',
    at: { x: -2, z: -14 },
    encounterId: 'hollow_census',
    label: 'The Cold Hearths',
    interactDetail:
      'Every door unlocked and every hearth cold. The clerk is waiting at the first of them with the roll open.',
  },
  {
    id: 'millharrow:mill_sluice',
    areaId: 'millharrow',
    at: { x: -18, z: -26 },
    encounterId: 'drowned_granary',
    label: 'The Mill Sluice',
    interactDetail:
      'The pond is climbing the granary steps and the mill has stopped grinding. Whatever dammed the race is still in it.',
  },
  {
    // The road's east waystone pair, the lane running between the stones: the map has no
    // bridge but Fenwick's, and Fenwick's already hosts two sites. The duel's terrain is
    // drawn on the ground it names.
    id: 'chalk_road:waystone',
    areaId: 'chalk_road',
    at: { x: 26, z: 2 },
    encounterId: 'waystone_duel',
    label: 'The Waystone',
    // The long coat of a man who keeps a post, which is the whole of what he does.
    duelist: 'adept_journeyman_a',
    interactDetail:
      'He stands the lane between the stones and the toll-men no longer bother walking up. Millharrow’s children come this way with bread. Duels are wagered.',
  },

  // ---- Master: the wildlands (the Caldera's nearness is deliberate — crater and
  // foundry are the same event at two distances) --------------------------------------
  {
    id: 'caldera:denning_ground',
    areaId: 'caldera',
    at: { x: -34, z: 10 },
    encounterId: 'caldera_chimera',
    label: 'The Denning Ground',
    interactDetail:
      'Drill stakes ring the hollow, every one of them snapped off at the ground. Something keeps this den in spite of the schedule.',
  },
  {
    id: 'rimefields:cracked_face',
    areaId: 'rimefields',
    at: { x: 6, z: -38 },
    encounterId: 'rimefield_break',
    label: 'The Cracked Face',
    interactDetail:
      'The snowpack above the pass is holding on a line too straight to be luck. What stands under it has not moved since the blasting.',
  },
  {
    id: 'storm_shelf:conductors_ground',
    areaId: 'storm_shelf',
    at: { x: 18, z: 10 },
    encounterId: 'storm_shelf_binding',
    label: 'The Conductor’s Ground',
    interactDetail:
      'Every strike-scar on this rank ends at the same radius, as if each one had been caught on the way down.',
  },
  {
    id: 'storm_shelf:pylon_nine',
    areaId: 'storm_shelf',
    at: { x: -6, z: -14 },
    encounterId: 'pylon_nine',
    label: 'Pylon Nine',
    interactDetail:
      'The newest footing on the shelf, and the only one the moths will not circle. The charge in the air is going somewhere.',
  },
  {
    id: 'ashwood:grove',
    areaId: 'ashwood',
    at: { x: -42, z: 18 },
    encounterId: 'wildfire_writ',
    label: 'The Grove',
    interactDetail:
      'The burn line on the survey curves around every stand worth money. What it curves through is ahead of you.',
  },
  {
    // Ground of her choosing — the one contract that names no place. She cleared the
    // Stile; she cannot stop saying so; a duel among the sixty-one cold hearths is her
    // crack made ground.
    id: 'weeping_stile:her_ground',
    areaId: 'weeping_stile',
    at: { x: 10, z: 6 },
    encounterId: 'coldwater_duel',
    label: 'Ground of Her Choosing',
    // Mask and rapier: the first of the King's Duelists, dressed for the ceremony she insists
    // this still is.
    duelist: 'master_duelist_a',
    interactDetail:
      'A duelist’s square has been swept in the middle of the village, and sixty-one hearths stand cold around it. She is waiting where the ledger says nobody lives. Duels are wagered.',
  },
  {
    // Cinderworks, not the Caldera road: the code seats the fight there, the atlas
    // concurs, and the ward's south ash yards literally read as flats. A Caldera lair
    // would put four sites in one crater.
    id: 'cinderworks:slag_flats',
    areaId: 'cinderworks',
    at: { x: 10, z: 10 },
    encounterId: 'dynamo_flats',
    label: 'The Slag Flats',
    interactDetail:
      'Pit-brands on every track in the ash, and every track leads out. Nothing here is being stolen; it is being let go.',
  },
  {
    // The fiction runs Fenwick's-to-the-undercroft, but Fenwick's already holds two
    // sites and the crack happens at this gate. The walk down Highcourt's service end,
    // past HE COUNTS THE FLOORS, is the better approach.
    id: 'highcourt:undercroft_gate',
    areaId: 'highcourt',
    at: { x: -30, z: 26 },
    encounterId: 'relocation_train',
    label: 'The Undercroft Gate',
    interactDetail:
      'The convoy forms up at the service gate after dark. The manifest lists sixty berths and one direction.',
  },
  {
    id: 'bone_bastion:new_rows',
    areaId: 'bone_bastion',
    at: { x: 34, z: 6 },
    encounterId: 'bone_bastion',
    label: 'The New Rows',
    interactDetail:
      'The graves here are cut square and numbered in a clerk’s hand, and none of the numbers is old. Something large keeps the rows at night.',
  },
  {
    id: 'highcourt:spire_doors',
    areaId: 'highcourt',
    at: { x: -2, z: -30 },
    encounterId: 'the_summons',
    label: 'The Spire Doors',
    interactDetail:
      'The bunting runs the length of the processional and the doors stand open. The last wall before them has something new painted on it.',
  },

  // ---- The epilogue: all Highcourt, staggered by their own gates ---------------------
  {
    id: 'highcourt:dispatch_line',
    areaId: 'highcourt',
    at: { x: 14, z: 26 },
    encounterId: 'dead_letters',
    label: 'The Dispatch Line',
    interactDetail:
      'The pneumatic housing is warm and the hatch is new-oiled. Somebody is keeping this line, and nobody is paying them to.',
    gate: { after: ['the_summons'] },
  },
  {
    id: 'highcourt:undercroft_stair',
    areaId: 'highcourt',
    at: { x: -30, z: 34 },
    encounterId: 'undercroft_census',
    label: 'The Undercroft Stair',
    interactDetail:
      'The gate stands open now, which is somehow worse. The clerk is already on the second step, counting under her breath.',
    gate: { after: ['dead_letters'] },
  },
  {
    id: 'highcourt:last_post',
    areaId: 'highcourt',
    at: { x: -2, z: -22 },
    encounterId: 'underhill_duel',
    label: 'The Last Post',
    // The King's coat and the heavy sword, at attention for the order that is never coming.
    duelist: 'master_duelist_c',
    interactDetail:
      'One man in a King’s coat, square in front of the doors, at attention for an order that is never coming. Duels are wagered.',
    gate: { after: ['undercroft_census'] },
  },
  {
    id: 'highcourt:floor_below',
    areaId: 'highcourt',
    at: { x: -34, z: 42 },
    encounterId: 'the_quiet_below',
    label: 'The Floor Below',
    interactDetail:
      'The stair goes down further than the service plans admit, and the light at the bottom is geode-light. It is not flickering. It is breathing.',
    gate: { after: ['underhill_duel'] },
  },

  // ---- The regional apex lairs: second routes, gated on the fight that named the
  // species -----------------------------------------------------------------------------
  {
    // The sluice beast is settled, either way; only then does the Caldera's shelf admit
    // what it is.
    id: 'caldera:obsidian_shelf',
    areaId: 'caldera',
    at: { x: -18, z: 22 },
    encounterId: 'caldera_tortoise',
    label: 'The Obsidian Shelf',
    interactDetail:
      'The crust here rings hollow underfoot, and the drill scars stop dead at its edge. Something under it is holding the heat in.',
    gate: { after: ['drowned_granary'] },
  },
  {
    id: 'caldera:vent_nest',
    areaId: 'caldera',
    at: { x: 14, z: -30 },
    encounterId: 'caldera_wasps',
    label: 'The Vent Nest',
    interactDetail:
      'Comb in the rock seams, head-high and humming. The whole buttress is warm, and it is not the vents doing it.',
    gate: { after: ['bonemarket_vermin'] },
  },
  {
    // A master lair three crossings out that a low-tier player can walk into is
    // intended: the wilds do not scale, and a live lair is not a promise it is winnable.
    id: 'rimefields:black_ice',
    areaId: 'rimefields',
    at: { x: -46, z: 18 },
    encounterId: 'rimefield_gargoyle',
    label: 'Black Ice',
    interactDetail:
      'The sheet is darker than the snow it interrupts, and nothing has crossed it since the last fall. The shapes under it are not stones.',
    gate: { after: ['fouled_cistern', 'rimefield_break'] },
  },
];

export function sitesInArea(areaId: string): readonly ContractSite[] {
  return CONTRACT_SITES.filter((s) => s.areaId === areaId);
}

export function siteByEncounter(encounterId: string): ContractSite | undefined {
  return CONTRACT_SITES.find((s) => s.encounterId === encounterId);
}
