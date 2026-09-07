/**
 * Things left lying about: a chest in a cellar, an urn in a corner, a strongbox behind a door.
 *
 * Opened once per character and remembered in the save (`Profile.caches`), which is what
 * separates a cache from a forage node: the node grows back and the chest does not. What one
 * hands over is exactly the shape an errand pays -- Ducats, Marrow Shards, Cores, a brew --
 * through the same purse writer (`payErrand`), so there is one answer to "what does a payout
 * do" and a cache cannot mint something the economy has no field for.
 *
 * Addressed into areas from outside by area id, the house pattern. Gated by the Chronicle where
 * a place should not be lootable before it has been earned: a shut cache keeps its furniture
 * standing and loses its prompt, so the room still has a strongbox in it and the strongbox
 * still says nothing.
 *
 * Pure: no three.js, no DOM -- `save.ts` reads the registry to drop ids that no longer exist.
 */

import type { BuffId } from '../core/overworld/state.js';
import { BREW_NAMES } from '../core/overworld/run.js';
import { reagentById } from '../core/data/splicing.js';
import type { DressingId } from './dressing.js';
import type { Gate } from './chronicle.js';

/** What a cache pays. The same shape as an errand's reward, on purpose. */
export interface CacheLoot {
  readonly ducats?: number;
  readonly marrowShards?: number;
  readonly reagents?: Readonly<Record<string, number>>;
  readonly brew?: BuffId;
}

export interface CacheDef {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to open it. Walkable, clear of the furniture including its own. */
  readonly at: { readonly x: number; readonly z: number };
  /** The thing itself. Always drawn; the prompt is what comes and goes. */
  readonly prop: {
    readonly kind: DressingId;
    readonly x: number;
    readonly z: number;
    readonly yaw?: number;
  };
  /** The interact prompt: "Open the chest". */
  readonly label: string;
  /** One line more, under the prompt. Where it came from, if the place knows. */
  readonly detail?: string;
  readonly loot: CacheLoot;
  /** When it can be opened. Absent means always. */
  readonly gate?: Gate;
}

export const CACHES: readonly CacheDef[] = [
  {
    id: 'ashfall_ward:alley_cache',
    areaId: 'ashfall_ward',
    at: { x: 41.8, z: -14 },
    prop: { kind: 'chest', x: 44, z: -14 },
    label: 'Open the chest',
    detail: 'Left in the back alley. Nobody has come back for it.',
    loot: { ducats: 15, marrowShards: 1 },
  },
  {
    id: 'ashfall_ironworks:scrap_chest',
    areaId: 'ashfall_ironworks',
    at: { x: -22.2, z: 18 },
    prop: { kind: 'chest', x: -24, z: 18 },
    label: 'Open the scrap chest',
    detail: "Offcuts the bench does not want. The Artificer will not miss them.",
    loot: { ducats: 25, reagents: { core_pyre: 1 } },
  },
  {
    id: 'ashfall_apothecary:cellar_urn',
    areaId: 'ashfall_apothecary',
    at: { x: 19.8, z: 18 },
    prop: { kind: 'urn', x: 22, z: 18 },
    label: 'Look in the urn',
    detail: 'Sealed with wax, and the wax is broken.',
    loot: { brew: 'ironbrew' },
  },
  {
    // The clerks' strongbox, and it stays shut until the ward's first contract has shown the
    // Magistracy what you are for. Standing in the room from the first visit, saying nothing.
    id: 'ashfall_records:strongbox',
    areaId: 'ashfall_records',
    at: { x: 19.8, z: -18 },
    prop: { kind: 'chest', x: 22, z: -18 },
    label: 'Open the strongbox',
    detail: 'The arrears, in coin. The clerk has turned her back on purpose.',
    loot: { ducats: 60, marrowShards: 2 },
    gate: { after: ['curfew_breakers'] },
  },
  {
    // The day's takings. The tariff on the wall says what the box is; reading it is what makes
    // the box yours -- a flag gate, the first in the world, and the reason the flags exist.
    id: 'ashfall_toll_house:strongbox',
    areaId: 'ashfall_toll_house',
    at: { x: 9.8, z: -12 },
    prop: { kind: 'chest', x: 12, z: -12 },
    label: 'Open the strongbox',
    detail: 'The takings the Counting House never sent for.',
    loot: { ducats: 30, reagents: { core_frost: 1 } },
    gate: { flags: ['read_toll_tariff'] },
  },
  {
    id: 'ashfall_chapel:alms_box',
    areaId: 'ashfall_chapel',
    at: { x: 15.8, z: 14 },
    prop: { kind: 'chest', x: 18, z: 14 },
    label: 'Open the alms box',
    detail: 'The keeper nods. A candle lit is a candle paid for.',
    loot: { ducats: 20, marrowShards: 1 },
    gate: { flags: ['lit_a_candle'] },
  },
  {
    id: 'ashfall_cinder_cup:cellar_cask',
    areaId: 'ashfall_cinder_cup',
    at: { x: -23.8, z: 18 },
    prop: { kind: 'barrel', x: -26, z: 18 },
    label: 'Tap the cask',
    detail: 'Not on the shelf. The publican keeps one back.',
    loot: { brew: 'quicksilver' },
  },
  {
    // What "nil remaining in the ward" looks like when you open the box.
    id: 'ashfall_counting_house:arrears',
    areaId: 'ashfall_counting_house',
    at: { x: 11.8, z: -17 },
    prop: { kind: 'chest', x: 14, z: -17 },
    label: 'Open the strongbox',
    detail: 'The figure the Spire asked for was nil.',
    loot: { ducats: 90, marrowShards: 3 },
  },

  /* --- Lamprow ----------------------------------------------------------------------- */
  {
    id: 'lamprow:sink_stash',
    areaId: 'lamprow',
    at: { x: -49.8, z: 18 },
    prop: { kind: 'chest', x: -52, z: 18 },
    label: 'Open the chest',
    detail: 'Pushed into the corner of the Sink, under the washing, where the Warden does not look.',
    loot: { ducats: 20 },
  },
  {
    id: 'lamprow_oil_house:keepers_cask',
    areaId: 'lamprow_oil_house',
    at: { x: 9.8, z: 8 },
    prop: { kind: 'barrel', x: 12, z: 8 },
    label: 'Tap the small cask',
    detail: 'Not oil. The keeper distils something of his own on the side.',
    loot: { brew: 'kinetic_capacitor' },
    gate: { flags: ['read_the_measure'] },
  },
  {
    id: 'lamprow_tithe_office:collected_twice',
    areaId: 'lamprow_tithe_office',
    at: { x: 11.8, z: -17 },
    prop: { kind: 'chest', x: 14, z: -17 },
    label: 'Open the strongbox',
    detail: 'What was collected twice, and marked paid once.',
    loot: { ducats: 50, reagents: { core_surge: 1 } },
  },
  {
    // Behind the crew. What the count is.
    id: 'lamprow_sink_cellars:the_count',
    areaId: 'lamprow_sink_cellars',
    at: { x: 11.8, z: -16 },
    prop: { kind: 'chest', x: 14, z: -16 },
    label: 'Open the count',
    detail: 'Every gill the Sink was assessed for, in coin, in the dark.',
    loot: { ducats: 45, marrowShards: 2 },
  },

  /* --- the Bonemarket ---------------------------------------------------------------- */
  {
    id: 'bonemarket:back_lane_crate',
    areaId: 'bonemarket',
    at: { x: -51.8, z: 26 },
    prop: { kind: 'chest', x: -54, z: 26 },
    label: 'Open the crate',
    detail: 'Fell off a cart on the back lane, and nobody has claimed it because claiming it is admitting the cart.',
    loot: { ducats: 18 },
  },
  {
    id: 'bonemarket_hall:under_the_slab',
    areaId: 'bonemarket_hall',
    at: { x: 27.8, z: 4 },
    prop: { kind: 'chest', x: 30, z: 4 },
    label: 'Look under the slab',
    detail: 'The fishmonger keeps the sea money here. There has been no sea money for a year.',
    loot: { ducats: 24, marrowShards: 1 },
  },
  {
    id: 'bonemarket_pawnshop:unredeemed',
    areaId: 'bonemarket_pawnshop',
    at: { x: 9.8, z: 12 },
    prop: { kind: 'chest', x: 12, z: 12 },
    label: 'Open the unredeemed shelf',
    detail: 'The broker turns a page. She is not selling; she is failing to notice.',
    loot: { ducats: 40, reagents: { core_dusk: 1 } },
    gate: { after: ['bonemarket_vermin'] },
  },

  /* --- the Cinderworks --------------------------------------------------------------- */
  {
    id: 'cinderworks:spur_crate',
    areaId: 'cinderworks',
    at: { x: 55.8, z: 34 },
    prop: { kind: 'chest', x: 58, z: 34 },
    label: 'Open the wagon chest',
    detail: 'Chocked at the end of the spur, and the wagon it came off is long gone.',
    loot: { ducats: 22, reagents: { core_pyre: 1 } },
  },
  {
    id: 'cinderworks_foundry:foremans_box',
    areaId: 'cinderworks_foundry',
    at: { x: 23.8, z: -4 },
    prop: { kind: 'chest', x: 26, z: -4 },
    label: "Open the foreman's box",
    detail: 'The flats are quiet. He said you could.',
    loot: { ducats: 55, marrowShards: 2, reagents: { core_pyre: 1 } },
    gate: { after: ['dynamo_flats'] },
  },
  {
    id: 'cinderworks_posters:type_case',
    areaId: 'cinderworks_posters',
    at: { x: 9.8, z: 12 },
    prop: { kind: 'chest', x: 12, z: 12 },
    label: 'Open the type case',
    detail: 'Lead sorts, and under them what the poster is really paid in.',
    loot: { ducats: 35, marrowShards: 1 },
    gate: { after: ['poster_work'] },
  },

  /* --- Ward Seven -------------------------------------------------------------------- */
  {
    id: 'ward_seven:seep_chest',
    areaId: 'ward_seven',
    at: { x: 10.2, z: 38 },
    prop: { kind: 'chest', x: 8, z: 38 },
    label: 'Open the sunk chest',
    detail: 'Half under the peat of the second seep. Whoever buried it did not come back for it either.',
    loot: { ducats: 20, marrowShards: 1 },
  },
  {
    id: 'ward_seven_cistern:the_sump',
    areaId: 'ward_seven_cistern',
    at: { x: 17.8, z: 4 },
    prop: { kind: 'chest', x: 20, z: 4 },
    label: 'Open the sump chest',
    detail: 'What the crew by the pumps has been keeping dry.',
    loot: { ducats: 40, reagents: { core_bloom: 1 } },
  },
  {
    id: 'ward_seven_clinic:dispensary',
    areaId: 'ward_seven_clinic',
    at: { x: 11.8, z: 12 },
    prop: { kind: 'chest', x: 14, z: 12 },
    label: 'Open the dispensary',
    detail: 'The healer nods at it. The quota has been answered for, and what is left is yours.',
    loot: { brew: 'ironbrew', ducats: 10 },
    gate: { after: ['clinic_quota'] },
  },

  /* --- the Chalk Verge, and the road ------------------------------------------------- */
  {
    // Under the big cairn on the south track, where a shepherd hid what a shepherd has.
    id: 'chalk_verge:the_cairn',
    areaId: 'chalk_verge',
    at: { x: -47.8, z: 18 },
    prop: { kind: 'cairn', x: -50, z: 18 },
    label: 'Lift the cairn stones',
    detail: 'Stacked too neatly to be a marker. Somebody put something under it and meant to come back.',
    loot: { ducats: 14, reagents: { core_bloom: 1 } },
  },
  {
    id: 'chalk_verge_bothy:the_tin',
    areaId: 'chalk_verge_bothy',
    at: { x: 11.8, z: 14 },
    prop: { kind: 'chest', x: 14, z: 14 },
    label: "Open the shepherd's box",
    detail: 'What the last person left, as the tally says to. It is not much. It is yours.',
    loot: { ducats: 9, brew: 'ironbrew' },
  },
  {
    // The wreck at the stretch, once the men who stopped it there are dealt with.
    id: 'chalk_road:wrecked_cart',
    areaId: 'chalk_road',
    at: { x: -30, z: 7.2 },
    prop: { kind: 'cart', x: -30, z: 10 },
    label: 'Search the wrecked cart',
    detail: 'Axle gone, load half-taken. What the Waywatch left because they could not carry it.',
    loot: { ducats: 26, marrowShards: 1, reagents: { core_bulwark: 1 } },
    gate: { after: ['chalk_road_toll'] },
  },
  {
    id: 'chalk_road_waystation:strongbox',
    areaId: 'chalk_road_waystation',
    at: { x: 15.8, z: -14 },
    prop: { kind: 'chest', x: 18, z: -14 },
    label: 'Open the toll strongbox',
    detail: 'Never sent to Jolrek. Nobody came for it, and the road did not send anybody.',
    loot: { ducats: 34, marrowShards: 1 },
  },

  /* --- Millharrow, and the Levels ---------------------------------------------------- */
  {
    id: 'millharrow_mill:grain_store',
    areaId: 'millharrow_mill',
    at: { x: 15.8, z: -14 },
    prop: { kind: 'chest', x: 18, z: -14 },
    label: "Open the miller's box",
    detail: 'Where the flour money goes before it goes to the toll. The millhand looks the other way.',
    loot: { ducats: 18, reagents: { core_bloom: 1 } },
  },
  {
    id: 'millharrow_granary:the_dry_box',
    areaId: 'millharrow_granary',
    at: { x: 19.8, z: -18 },
    prop: { kind: 'chest', x: 22, z: -18 },
    label: 'Open the granary strongbox',
    detail: 'What the granary was keeping dry, on the one shelf the water did not reach. Now that the water has nothing in it.',
    loot: { ducats: 48, marrowShards: 2, reagents: { core_bloom: 1 } },
    gate: { after: ['drowned_granary'] },
  },
  {
    // In the condemned field, once the thing in it is answered for.
    id: 'tallow_levels:north_field_box',
    areaId: 'tallow_levels',
    at: { x: -18, z: -31.8 },
    prop: { kind: 'chest', x: -18, z: -34 },
    label: 'Open the box in the north field',
    detail: 'Half sunk in the field the order says not to cross. The order does not apply to you any more.',
    loot: { ducats: 30, marrowShards: 1, reagents: { core_dusk: 1 } },
    gate: { after: ['tallow_blight'] },
  },
  {
    id: 'tallow_pump_house:engineers_box',
    areaId: 'tallow_pump_house',
    at: { x: 15.8, z: -14 },
    prop: { kind: 'chest', x: 18, z: -14 },
    label: "Open the engineer's strongbox",
    detail: 'The Magistracy’s engineer left in a hurry and left this. Eleven years of a wage nobody collected.',
    loot: { ducats: 44, marrowShards: 2 },
  },

  /* --- Saltglass, and the Hollow ----------------------------------------------------- */
  {
    id: 'saltglass:salt_store',
    areaId: 'saltglass',
    at: { x: -47.8, z: 26 },
    prop: { kind: 'chest', x: -50, z: 26 },
    label: 'Open the salt store',
    detail: 'Under a pane rank, out of the glare. Salt that was never bonded because nobody wrote it down.',
    loot: { ducats: 16, reagents: { core_frost: 1 } },
  },
  {
    id: 'saltglass_glasshouse:cullet_box',
    areaId: 'saltglass_glasshouse',
    at: { x: 15.8, z: 6 },
    prop: { kind: 'chest', x: 18, z: 6 },
    label: 'Open the cullet box',
    detail: 'Broken panes, kept to melt back. Something in the bottom of it is not glass.',
    loot: { ducats: 20, reagents: { core_pyre: 1 } },
  },
  {
    // The bond. Held, as the wall says, and then not.
    id: 'saltglass_customs_house:the_bond',
    areaId: 'saltglass_customs_house',
    at: { x: 15.8, z: -14 },
    prop: { kind: 'chest', x: 18, z: -14 },
    label: 'Open the bond chest',
    detail: 'A year of a fishing town’s catch and salt, in coin, behind a chain. The quay knows where it is now.',
    loot: { ducats: 70, marrowShards: 3, reagents: { core_frost: 1 } },
    gate: { after: ['saltglass_riot'] },
  },
  {
    id: 'brays_hollow:hedge_hoard',
    areaId: 'brays_hollow',
    at: { x: 39.8, z: -38 },
    prop: { kind: 'chest', x: 42, z: -38 },
    label: 'Open the box in the hedge',
    detail: 'Pushed into the north hedge at the rim. The child’s, probably. It is everything they have.',
    loot: { ducats: 12, marrowShards: 1 },
  },
  {
    id: 'brays_barn:the_licence_money',
    areaId: 'brays_barn',
    at: { x: -15.8, z: -6 },
    prop: { kind: 'chest', x: -18, z: -6 },
    label: 'Open the box under the hay',
    detail: 'What the licence would have cost, saved a coin at a time and never enough. The herd is still here; so is this.',
    loot: { ducats: 55, marrowShards: 2, reagents: { core_bulwark: 1 } },
    gate: { after: ['warrant_of_distraint'] },
  },

  /* --- Fenwick's Crossing, and the Stile --------------------------------------------- */
  {
    id: 'fenwicks_crossing:under_the_span',
    areaId: 'fenwicks_crossing',
    at: { x: 59.8, z: -34 },
    prop: { kind: 'chest', x: 62, z: -34 },
    label: 'Open the box under the span',
    detail: 'Wedged against the east abutment, where the carpenter keeps what the river brings him.',
    loot: { ducats: 18, marrowShards: 1 },
  },
  {
    // The toll, in coin. Reading the book is what tells you which column it came from.
    id: 'fenwicks_toll_house:the_night_column',
    areaId: 'fenwicks_toll_house',
    at: { x: 15.8, z: -14 },
    prop: { kind: 'chest', x: 18, z: -14 },
    label: 'Open the toll strongbox',
    detail: 'The night column, in coin. The keeper has turned to the window.',
    loot: { ducats: 40, marrowShards: 1, reagents: { core_surge: 1 } },
    gate: { flags: ['read_the_toll_book'] },
  },
  {
    id: 'fenwicks_inn:the_strongroom',
    areaId: 'fenwicks_inn',
    at: { x: -19.8, z: -14 },
    prop: { kind: 'chest', x: -22, z: -14 },
    label: 'Open the strongroom chest',
    detail: 'Behind the bar, under the stair. The innkeeper is outside lighting the lamps.',
    loot: { ducats: 26, brew: 'quicksilver' },
  },
  {
    id: 'fenwicks_cellars:what_was_kept',
    areaId: 'fenwicks_cellars',
    at: { x: 19.8, z: 14 },
    prop: { kind: 'chest', x: 22, z: 14 },
    label: 'Open what was kept',
    detail: 'In the dark end, behind where the dogs were. What the brewer put down in the spring, and what the dogs had been keeping on top of it.',
    loot: { ducats: 60, marrowShards: 2, reagents: { core_dusk: 1 } },
    gate: { after: ['cellar_clearance'] },
  },
  {
    // The oak at the lane end, hollow, and something in it that is not an owl.
    id: 'weeping_stile:the_hollow_oak',
    areaId: 'weeping_stile',
    at: { x: 35.8, z: -6 },
    prop: { kind: 'deadfall', x: 38, z: -6 },
    label: 'Reach into the hollow oak',
    detail: 'Somebody in the village kept things here. The village is gone; the things are not.',
    loot: { ducats: 22, marrowShards: 1, reagents: { core_dusk: 1 } },
  },
  {
    id: 'weeping_stile_chapel:the_plate',
    areaId: 'weeping_stile_chapel',
    at: { x: 15.8, z: -14 },
    prop: { kind: 'chest', x: 18, z: -14 },
    label: 'Open the plate box',
    detail: 'The chapel plate. Nobody took it, because nobody was left to, and the candle-keeper is not a thief.',
    loot: { ducats: 20, marrowShards: 2 },
    gate: { flags: ['tended_the_stile_candle'] },
  },
  {
    id: 'weeping_stile_chapel:under_the_altar',
    areaId: 'weeping_stile_chapel',
    at: { x: -15.8, z: -14 },
    prop: { kind: 'chest', x: -18, z: -14 },
    label: 'Open the box under the altar',
    detail: 'What the clerk was not shown. The page that is missing from the roll is folded on top of it.',
    loot: { ducats: 40, marrowShards: 2, reagents: { core_dusk: 1 } },
    gate: { after: ['hollow_census'] },
  },

  /* --- Highcourt --------------------------------------------------------------------- */
  {
    id: 'highcourt:service_chest',
    areaId: 'highcourt',
    at: { x: 43.8, z: 46 },
    prop: { kind: 'chest', x: 46, z: 46 },
    label: 'Open the servants’ chest',
    detail: 'In the weeds at the end the court does not look at. The court does not look at it.',
    loot: { ducats: 30, marrowShards: 1 },
  },
  {
    id: 'highcourt_spire_lobby:census_strongbox',
    areaId: 'highcourt_spire_lobby',
    at: { x: 25.8, z: -16 },
    prop: { kind: 'chest', x: 28, z: -16 },
    label: 'Open the census strongbox',
    detail: 'What the count is worth, sent up. You have been up. It is yours to bring down.',
    loot: { ducats: 110, marrowShards: 3, reagents: { core_surge: 1 } },
    gate: { after: ['the_summons'] },
  },
  {
    id: 'highcourt_smoke_eaters:the_tin',
    areaId: 'highcourt_smoke_eaters',
    at: { x: 19.8, z: -16 },
    prop: { kind: 'chest', x: 22, z: -16 },
    label: "Open the Smoke-Eater's tin",
    detail: 'His stake, kept by the hearth. He has not lost on this side of the stair; he has now.',
    loot: { ducats: 60, brew: 'quicksilver' },
    gate: { after: ['smoke_eaters_rest'] },
  },
  {
    id: 'highcourt_undercroft:the_floor_below',
    areaId: 'highcourt_undercroft',
    at: { x: 19.8, z: 24 },
    prop: { kind: 'chest', x: 22, z: 24 },
    label: 'Open what is on the floor below',
    detail: 'A floor. A box on it. The dread was the expensive part.',
    loot: { ducats: 120, marrowShards: 4, reagents: { core_dusk: 1 } },
    gate: { after: ['the_quiet_below'] },
  },
];

export const cacheById = (id: string): CacheDef | undefined => CACHES.find((c) => c.id === id);

export const cachesInArea = (areaId: string): readonly CacheDef[] =>
  CACHES.filter((c) => c.areaId === areaId);

/** "Found: 25 Ducats, 1 Pyre Core." -- the line that says what you found, in the game's names. */
export function describeLoot(loot: CacheLoot): string {
  const parts: string[] = [];
  if (loot.ducats) parts.push(`${loot.ducats} Ducats`);
  if (loot.marrowShards) {
    parts.push(`${loot.marrowShards} Marrow Shard${loot.marrowShards === 1 ? '' : 's'}`);
  }
  for (const [id, n] of Object.entries(loot.reagents ?? {})) {
    if (n > 0) parts.push(`${n} ${reagentById(id)?.name ?? id}`);
  }
  if (loot.brew) parts.push(BREW_NAMES[loot.brew]);
  return parts.length > 0 ? `Found: ${parts.join(', ')}.` : 'Empty.';
}
