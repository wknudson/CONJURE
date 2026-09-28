/**
 * Roaming packs — the things on the road that are nobody's.
 *
 * A contract is a job. A hunt is an animal somebody wants bound. A pack is neither: it is
 * four or five bodies loose on the verge with no hero behind them, no Bound Form, and
 * nothing to negotiate with. You walk into one and you fight it, and when the last of them
 * is down the fight is over — which the engine had no way to express until `victory: 'rout'`,
 * because victory meant felling a commander and a pack has none.
 *
 * ## Ten points, and why that number
 *
 * `STARTING_WARBAND_POINTS` is 10: it is what the game already means by "one warband", the
 * budget a new Commander fields their own line out of. A pack is one warband's worth of
 * somebody else, costed on the **same** ladder through `rosterPointsOf` — footprint 2 is six,
 * an elite four, a ranged body three, a plain melee two.
 *
 * The compositions below are authored rather than generated. Generated packs would be
 * endless and would sit outside the balance harness, which plays eight games against every
 * registered encounter; these are registered, so a pack that cannot be beaten is a red test
 * rather than a bad afternoon. `packs.test.ts` re-derives every total, so the number in the
 * comment can never quietly stop being the number in the array.
 *
 * ## Reinforcements
 *
 * Five more points, if the roll says so. Not guaranteed, because the fiction is that they
 * *wandered in* — the road is busy and the fighting is loud. Rolled once at setup rather than
 * per turn: a lazy roll draws from the RNG every round and desyncs a replay against a fight
 * where it never happened.
 */

import type { BountyDifficulty } from './bounties.js';
import { CARDS } from './cards/index.js';
import { rosterPointsOf } from './roster.js';

export interface PackDef {
  /** The encounter walking into one starts. Registered in `encounters/packs.ts`. */
  readonly encounterId: string;
  readonly name: string;
  /** One line for the pre-combat screen, in the voice of the road rather than a poster. */
  readonly blurb: string;
  /** What the spoils pay at. Packs are novice-to-adept work; nothing out here is a Master. */
  readonly tier: BountyDifficulty;
  /** The bodies, as card ids. Summing to exactly `PACK_POINTS` on the roster ladder. */
  readonly members: readonly string[];
  /**
   * What may turn up later, and how likely it is.
   *
   * `chance` is out of 100. `unitCardIds` is drawn from in order until `points` is spent, so
   * the list is a priority rather than a set.
   */
  readonly reinforce: { readonly points: number; readonly chance: number; readonly unitCardIds: readonly string[] };
}

/** One warband's worth. The same 10 a new Commander fields. */
export const PACK_POINTS = 10;

/** What wanders in afterwards, when it wanders in at all. */
export const REINFORCE_POINTS = 5;

export const PACKS: readonly PackDef[] = [
  {
    encounterId: 'pack_chalk_scavengers',
    name: 'Chalk-Road Scavengers',
    blurb:
      'Four of them working a spill of dropped freight, and they have decided you are the ' +
      'second-best thing on this road tonight.',
    tier: 'novice',
    // 2 + 2 + 2 + 2 + 2 = 10
    members: ['vanguard_footman', 'vanguard_footman', 'scout_imp', 'scout_imp', 'marrow_wisp'],
    reinforce: { points: REINFORCE_POINTS, chance: 45, unitCardIds: ['vanguard_footman', 'scout_imp', 'marrow_wisp'] },
  },
  {
    encounterId: 'pack_verge_stray_dogs',
    name: 'The Verge Strays',
    blurb:
      'Foundry dogs that stopped going back. Fast, thin, and entirely uninterested in ' +
      'whether you were only passing through.',
    tier: 'novice',
    // 2 + 2 + 2 + 2 + 2 = 10
    members: ['ember_hound', 'ember_hound', 'soot_sprite', 'rime_fox', 'static_hare'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['ember_hound', 'rime_fox', 'static_hare'] },
  },
  {
    encounterId: 'pack_spoil_heap_hollows',
    name: 'Spoil-Heap Hollows',
    blurb:
      'Whatever the Census relocated, some of it walked back. They keep to the heaps in ' +
      'daylight, which tells you what hour it is.',
    tier: 'adept',
    // 2 + 2 + 2 + 2 + 2 = 10
    members: ['ash_ghoul', 'ash_ghoul', 'hollowed_husk', 'grave_sentinel', 'carrion_crow'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['ash_ghoul', 'hollowed_husk', 'carrion_crow'] },
  },

  /* ---- Lamprow: the two crews working the Sink, below the lamps ---- */

  {
    encounterId: 'pack_lamprow_gutter_crew',
    name: 'The Lampwick Gutter Crew',
    blurb:
      'They work the ditch under the lamps and they know exactly how far the light reaches. ' +
      'So do you, now.',
    tier: 'novice',
    // 3 + 3 + 2 + 2 = 10. Two ranged bodies: a crew that has learned to fight from where the
    // pavement is not, which is the whole argument of the ward it lives in.
    members: ['cinder_lobber', 'longshot_stalker', 'vanguard_footman', 'scout_imp'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['cinder_lobber', 'scout_imp', 'vanguard_footman'] },
  },
  {
    encounterId: 'pack_lamprow_tithe_takers',
    name: 'The Tithe-Takers',
    blurb:
      'Collectors for a debt nobody can produce the paper for. They are very calm about it, ' +
      'which is worse.',
    tier: 'adept',
    // 4 + 2 + 2 + 2 = 10. Slow and armoured — they do not need to catch you, only to be
    // between you and the way back up onto the flags.
    members: ['slag_iron_golem', 'quarry_hand', 'shieldbearer', 'vanguard_footman'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['scrap_metal_mortar', 'quarry_hand'] },
  },

  /* ---- The Chalk Road: three crews on one stretch, close enough to hear each other ---- */

  {
    encounterId: 'pack_road_waywatch',
    name: 'The Waywatch',
    blurb:
      'They collect a toll the Magistracy never set, on a road the Magistracy never mends. ' +
      'The arrangement has held for years.',
    tier: 'novice',
    // 2 x 5 = 10. The plainest fight on the road, and the one most likely to be the *second*
    // thing a ring drags in.
    members: ['vanguard_footman', 'vanguard_footman', 'scout_imp', 'briar_wolf', 'briar_wolf'],
    reinforce: { points: REINFORCE_POINTS, chance: 45, unitCardIds: ['longshot_stalker', 'vanguard_footman'] },
  },
  {
    encounterId: 'pack_hedgerow_vermin',
    name: 'Hedgerow Vermin',
    blurb:
      'Field things that came out of the strips and did not go back in. The hedges are full ' +
      'of them and the hedges run the length of the road.',
    tier: 'novice',
    // 2 x 5 = 10.
    members: ['sporeback_boar', 'sporeback_boar', 'mire_toad', 'briar_wolf', 'sap_wisp'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['sporeback_boar', 'mire_toad', 'sap_wisp'] },
  },
  {
    encounterId: 'pack_freight_pickers',
    name: 'The Freight-Pickers',
    blurb:
      'Three of them and not one willing to come closer than they have to. Whatever fell off ' +
      'the wagon, they intend to keep it.',
    tier: 'adept',
    // 4 + 3 + 3 = 10, and the only pack in the game that fields three bodies instead of five,
    // every one of them ranged. A genuinely different shape: it cannot screen itself, so it
    // has to be reached — which is the interesting case when a ring pulls it into somebody
    // else's fight.
    members: ['arc_dynamo', 'clockwork_bombardier', 'scrap_metal_mortar'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['clockwork_bombardier', 'voltaic_coil'] },
  },
  {
    /**
     * The Warden's detail, and the one entry here that does not roam.
     *
     * Filed as a pack because a pack is exactly what it is mechanically — one warband of
     * somebody else, costed on the same ten-point ladder, won by clearing the board — and
     * filing it here is what earns it the budget re-derivation in `packs.test.ts` and the
     * eight balance playouts, neither of which a hand-cut encounter would get.
     *
     * It is never placed from an area's `packs` list. It is what a Warden serves on you when
     * their cone catches you off the pavement, which used to be an arrest and is now a fight.
     */
    encounterId: 'warden_writ',
    name: "The Warden's Writ",
    blurb:
      'A Warden with a seal in one hand and three of the watch behind him. He has stopped ' +
      'asking where you are supposed to be.',
    tier: 'adept',
    // 4 + 2 + 2 + 2 = 10. Bulwark and neutral only: a city watch is armour and numbers, and
    // an elemental body in the middle of it would read as somebody else's warband.
    members: ['anvil_lord', 'vanguard_footman', 'vanguard_footman', 'vanguard_footman'],
    // A marksman first, then another body. The Magistracy is not short of either.
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['longshot_stalker', 'vanguard_footman'] },
  },
  /* ---- The city after dark: crews that come out when the lamps are the only law ---- */

  {
    encounterId: 'pack_knackers_lads',
    name: "The Knacker's Lads",
    blurb:
      'They take what the Bonemarket will not sell and sell it anyway. At this hour they are ' +
      'choosing who else is stock.',
    tier: 'novice',
    // 2 + 2 + 2 + 2 + 2 = 10. Things that were dead and things that eat them, and one man
    // keeping the ledger.
    members: ['ash_ghoul', 'hollowed_husk', 'carrion_crow', 'carrion_crow', 'vanguard_footman'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['carrion_crow', 'ash_ghoul'] },
  },
  {
    encounterId: 'pack_slag_rats',
    name: 'The Slag Rats',
    blurb:
      'They live in the warm ground under the heaps and come up when the shift bell goes. The ' +
      'foreman calls them a heat problem.',
    tier: 'adept',
    // 2 + 2 + 3 + 3 = 10. Two to close, two to lob from the heap tops.
    members: ['soot_sprite', 'soot_sprite', 'cinder_adder', 'cinder_lobber'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['soot_sprite', 'cinder_adder'] },
  },
  {
    encounterId: 'pack_cistern_things',
    name: 'What Lives in the Cistern',
    blurb:
      'The pumps stopped and something else started. It comes up the seeps at night to see ' +
      'what the ward is doing.',
    tier: 'novice',
    // 2 x 5 = 10. Slow and wet and a great many of them.
    members: ['mire_toad', 'mire_toad', 'hollowed_husk', 'sap_wisp', 'creeping_briar'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['mire_toad', 'sap_wisp'] },
  },
  {
    encounterId: 'pack_night_bailiffs',
    name: 'The Night Bailiffs',
    blurb:
      'The Court sits by day and these sit by night. They carry no seal, because nobody they ' +
      'stop is going to ask to see it.',
    tier: 'adept',
    // 2 + 2 + 3 + 3 = 10. Two shields in front and two bows behind: the processional is long
    // and straight, and they would rather you did not reach them.
    members: ['shieldbearer', 'quarry_hand', 'longshot_stalker', 'hedge_slinger'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['longshot_stalker', 'shieldbearer'] },
  },
  {
    encounterId: 'pack_wick_thieves',
    name: 'The Wick-Thieves',
    blurb:
      'Oil is money on the Lamprow and a lit lamp is oil left out. They start at the far end ' +
      'of the row and work toward you.',
    tier: 'novice',
    // 3 + 2 + 2 + 3 = 10.
    members: ['cinder_lobber', 'scout_imp', 'soot_sprite', 'hedge_slinger'],
    reinforce: { points: REINFORCE_POINTS, chance: 45, unitCardIds: ['scout_imp', 'soot_sprite'] },
  },

  /* ---- The Ring: the farms, the drained country, the salt and the river ---- */

  {
    encounterId: 'pack_scarecrow_men',
    name: 'The Scarecrow Men',
    blurb:
      'Millharrow stopped putting them up after the second harvest they walked. The fields ' +
      'were not grateful enough to stop.',
    tier: 'adept',
    // 2 + 3 + 3 + 2 = 10. One to stand in the furrow and three to throw things from it.
    members: ['bramble_sentinel', 'hedge_slinger', 'thorn_lobber', 'sap_wisp'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['bramble_sentinel', 'sap_wisp'] },
  },
  {
    encounterId: 'pack_dyke_wardens',
    name: 'The Dyke-Wardens',
    blurb:
      'Nobody appointed them. They keep the sluices, after a fashion, and they are sure the ' +
      'levels are theirs.',
    tier: 'adept',
    // 2 + 2 + 3 + 3 = 10.
    members: ['mire_toad', 'sporeback_boar', 'thorn_lobber', 'thorn_lobber'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['mire_toad', 'sporeback_boar'] },
  },
  {
    encounterId: 'pack_glass_pickers',
    name: 'The Glass-Pickers',
    blurb:
      'They work the cull heaps behind the kilns for pane that will still sell. Anything on ' +
      'the pans that moves is the same trade.',
    tier: 'adept',
    // 3 + 3 + 2 + 2 = 10. Two arbalests, loaded with offcuts.
    members: ['glass_arbalest', 'glass_arbalest', 'scrap_phalanx', 'vanguard_footman'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['scrap_phalanx', 'scout_imp'] },
  },
  {
    encounterId: 'pack_bridge_tollers',
    name: 'The Bridge-Tollers',
    blurb:
      'Fenwick charges to cross and so do they, on the south bank, in daylight, with the ' +
      'bridge behind them. It is simpler to pay one of them.',
    tier: 'novice',
    // 2 + 2 + 3 + 3 = 10.
    members: ['vanguard_footman', 'shieldbearer', 'longshot_stalker', 'hedge_slinger'],
    reinforce: { points: REINFORCE_POINTS, chance: 45, unitCardIds: ['vanguard_footman', 'hedge_slinger'] },
  },
  {
    encounterId: 'pack_stile_mourners',
    name: 'The Stile Mourners',
    blurb:
      'They stand at the stile at night as if they were waiting to be let over. Whatever they ' +
      'are mourning, it is not you yet.',
    tier: 'adept',
    // 2 x 5 = 10.
    members: ['grave_sentinel', 'ash_ghoul', 'carrion_crow', 'marrow_wisp', 'hollowed_husk'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['ash_ghoul', 'carrion_crow'] },
  },

  /* ---- The Wildlands: nobody lives here, and these do ---- */

  {
    encounterId: 'pack_magma_brood',
    name: 'The Magma Brood',
    blurb:
      'Born in the vents and in no hurry to leave them. The crater floor is warm enough to ' +
      'keep them fed and they would like to know what you are.',
    tier: 'adept',
    // 3 + 3 + 2 + 2 = 10.
    members: ['cinder_lobber', 'cinder_adder', 'ember_hound', 'ember_moth'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['ember_moth', 'cinder_adder'] },
  },
  {
    encounterId: 'pack_ashwood_wolves',
    name: 'The Ashwood Pack',
    blurb:
      'They have the whole wood and they walk all of it. You are on their round, and they ' +
      'know it before you do.',
    tier: 'adept',
    // 2 x 5 = 10. Four wolves and whatever they flushed.
    members: ['briar_wolf', 'briar_wolf', 'briar_wolf', 'briar_wolf', 'sporeback_boar'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['briar_wolf'] },
  },
  {
    encounterId: 'pack_poacher_band',
    name: 'The Poacher Band',
    blurb:
      'They set lines through the Ashwood for anything the Vivarium would pay for, and they ' +
      'have heard what a Whisperer fetches.',
    tier: 'novice',
    // 3 + 3 + 2 + 2 = 10.
    members: ['hedge_slinger', 'longshot_stalker', 'vanguard_footman', 'scout_imp'],
    reinforce: { points: REINFORCE_POINTS, chance: 45, unitCardIds: ['scout_imp', 'hedge_slinger'] },
  },
  {
    encounterId: 'pack_hoarhounds',
    name: 'The Hoarhound Pack',
    blurb:
      'White on white until they move, and they do not move until they are sure. The ice ' +
      'bands are theirs to cross and yours to slip on.',
    tier: 'adept',
    // 2 x 5 = 10.
    members: ['hoarhound', 'hoarhound', 'rime_fox', 'glacial_stalker', 'rime_fox'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['hoarhound', 'rime_fox'] },
  },
  {
    encounterId: 'pack_rime_archers',
    name: 'The Rime-Archers',
    blurb:
      'Somebody posted them on the ridges a long winter ago and forgot to send the relief. ' +
      'They have not forgotten their orders.',
    tier: 'adept',
    // 3 + 3 + 2 + 2 = 10. The first pack that would rather shoot you from a ridge than meet
    // you on the snow.
    members: ['rime_archer', 'rime_archer', 'rimeguard', 'glacial_stalker'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['rimeguard', 'rime_fox'] },
  },
  {
    encounterId: 'pack_static_swarm',
    name: 'The Static Swarm',
    blurb:
      'The pylons hum and these hum back. Stand between two footings long enough and they ' +
      'come to find out what is earthing them.',
    tier: 'novice',
    // 2 x 5 = 10.
    members: ['storm_wisp', 'storm_wisp', 'static_hare', 'voltaic_hound', 'voltaic_coil'],
    reinforce: { points: REINFORCE_POINTS, chance: 60, unitCardIds: ['storm_wisp', 'static_hare'] },
  },
  {
    encounterId: 'pack_pylon_keepers',
    name: 'The Pylon-Keepers',
    blurb:
      'Machines left to mind the machines. Nobody has told them the survey was abandoned, and ' +
      'you are not on their list.',
    tier: 'adept',
    // 4 + 2 + 2 + 2 = 10.
    members: ['arc_turret', 'storm_rod', 'voltaic_coil', 'voltaic_hound'],
    reinforce: { points: REINFORCE_POINTS, chance: 50, unitCardIds: ['voltaic_coil', 'storm_rod'] },
  },
  {
    encounterId: 'pack_barrow_watch',
    name: 'The Barrow Watch',
    blurb:
      'They walk the causeway between the mounds as they were buried to. The Bastion was ' +
      'built to keep something in, and they are what it keeps.',
    tier: 'adept',
    // 2 x 5 = 10.
    members: ['grave_sentinel', 'grave_sentinel', 'ash_ghoul', 'hollowed_husk', 'marrow_wisp'],
    reinforce: { points: REINFORCE_POINTS, chance: 55, unitCardIds: ['grave_sentinel', 'ash_ghoul'] },
  },
];

export function packByEncounter(encounterId: string): PackDef | undefined {
  return PACKS.find((p) => p.encounterId === encounterId);
}

export function isPack(encounterId: string): boolean {
  return PACKS.some((p) => p.encounterId === encounterId);
}

/**
 * The bodies a pack's reinforcement budget actually buys, as card ids.
 *
 * Pure and RNG-free, which is the point of pulling it out of the arrival code: the
 * overworld needs to know what a pulled pack *is* in order to hand it to the engine, and it
 * has no combat state to spend a budget against. The arrival path calls this too, so the
 * squad the ring promises and the squad that walks in can never be two different lists.
 *
 * Spent greedily down `unitCardIds`, which the field documents as a priority rather than a
 * set — the first entries are what the pack would rather have.
 */
export function reinforceSquad(pack: PackDef): string[] {
  const out: string[] = [];
  let budget = pack.reinforce.points;

  for (const defId of pack.reinforce.unitCardIds) {
    const def = CARDS[defId];
    if (!def) continue;
    const cost = rosterPointsOf(def);
    // A zero-cost body would spend nothing and repeat forever. Nothing on the ladder costs
    // zero, so this is a guard against a future card rather than a live case.
    if (cost <= 0) continue;
    while (budget >= cost) {
      out.push(defId);
      budget -= cost;
    }
    if (budget <= 0) break;
  }

  return out;
}
