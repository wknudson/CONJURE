/**
 * Things worth stopping to look at.
 *
 * There was no verb for it. The world had notices you read in a panel, chests you open, herbs you
 * pick and people you talk to, and everything else -- a gibbet on a rise, the milestone that has
 * the wrong number on it, a cart nobody came back for -- was scenery you walked past. A sight is
 * the smallest thing the street can offer: stand at it, press Space, and a line or two of what you
 * notice comes up over the prompt and goes again. No panel, no loot, no gate by default.
 *
 * What it is for is the walk. Each area keeps count on the map panel -- found out of total -- and
 * finding all of an area's sights pays a small purse, once, through the same errand purse a chest
 * pays through. That is the whole of the reward, on purpose: the point is to have looked.
 *
 * A registry like `notices.ts` and `caches.ts`, addressed into an area by `areaId:slug`, and a
 * found sight is a world flag (`sight:<id>`) -- the same ledger a notice's flag goes into -- so
 * nothing about the save changes.
 */

import type { Gate } from './chronicle.js';

export interface SightDef {
  /** `areaId:slug`. Stable: the flag that records it is built from it. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to look. */
  readonly at: { readonly x: number; readonly z: number };
  /** The prompt: "Look at the gibbet". */
  readonly label: string;
  /** What you notice. A line or two -- this is a caption, not a reading. */
  readonly caption: string;
  /** When it is there to be noticed, if not always. */
  readonly gate?: Gate;
}

/** The world flag a sight raises when it is found. */
export const sightFlag = (id: string): string => `sight:${id}`;

/** What finding every sight in an area pays, once. */
export const SIGHTS_PURSE = { ducats: 12 } as const;

/** The flag that says an area's sights purse has been paid. */
export const sightsPaidFlag = (areaId: string): string => `sights_paid:${areaId}`;

export const SIGHTS: readonly SightDef[] = [
  /* ---- Ashfall Ward ---- */
  {
    id: 'ashfall_ward:the_bell',
    areaId: 'ashfall_ward',
    at: { x: -56, z: 78 },
    label: 'Look up at the bell',
    caption:
      'Cast in the Cinderworks and hung before the census. The name round its lip has been ' +
      'filed off and a number cut in its place. It rings the hours for the Magistracy and, once ' +
      'at night, for whoever the sexton is burying.',
  },
  {
    id: 'ashfall_ward:the_crane',
    areaId: 'ashfall_ward',
    at: { x: -82, z: -41 },
    label: 'Look at the crane',
    caption:
      'The treadwheel is boarded over and the hook lashed to the jib, so nothing can be lifted ' +
      'without a licence. The Toll House issues the licences. It has not issued one in eleven ' +
      'days.',
  },
  {
    id: 'ashfall_ward:the_ash_bridge',
    areaId: 'ashfall_ward',
    at: { x: 2, z: -52 },
    label: 'Look over the parapet',
    caption:
      'Flood marks scored into the stone, each with its year. The highest is at knee height. ' +
      'Somebody has cut a new one at the top of the arch, with no year, and rubbed ash into the ' +
      'groove so it shows.',
  },
  {
    id: 'ashfall_ward:the_bonded_seal',
    areaId: 'ashfall_ward',
    at: { x: -40, z: -82 },
    label: 'Look at the bonded door',
    caption:
      "Every door on the far bank carries the Magistracy's wax, and every seal has been lifted " +
      'and pressed back with a thumb. The thumbprint is the same on all of them.',
  },
  {
    id: 'ashfall_ward:the_pits',
    areaId: 'ashfall_ward',
    at: { x: 70, z: -16 },
    label: 'Look into the pits',
    caption:
      'Lime, then the bark liquor, strongest to weakest, a hide a month in each. The weakest ' +
      'pit has a boot in it, sole up. Nobody on the Row will say whose, which on the Row is an ' +
      'answer.',
  },
  {
    id: 'ashfall_ward:the_ropewalk',
    areaId: 'ashfall_ward',
    at: { x: -94, z: -4 },
    label: 'Look down the Ropewalk',
    caption:
      'Two hundred paces of shed and barely a stride across, a rope walked out down the whole ' +
      'of it and nobody at the far end. The ward buys its rope by the fathom. Its hangman buys ' +
      'it here.',
  },
  {
    id: 'ashfall_ward:the_ossuary',
    areaId: 'ashfall_ward',
    at: { x: -88, z: 70.4 },
    label: 'Look at the ossuary',
    caption:
      'No windows, one door, and the door bricked up. When the churchyard fills, the sexton ' +
      'lifts the old ones and brings them here. It has been full since before the wall. He has ' +
      'not stopped lifting.',
  },
  {
    id: 'ashfall_ward:the_new_grave',
    areaId: 'ashfall_ward',
    at: { x: -30, z: 69.6 },
    label: 'Look at the new stone',
    caption:
      'Three stones in a row, one new. The new one has a name cut on it and no dates, which on ' +
      'Chapel Hill means the Magistracy has not yet said when.',
  },
  {
    id: 'ashfall_ward:the_allotment',
    areaId: 'ashfall_ward',
    at: { x: 38, z: 70 },
    label: 'Look at the plot',
    caption:
      'Marked out in string, with a board at the corner: WORKED BY HAND, SEALED BY WRIT. The ' +
      'beans are up. The writ is newer than the beans.',
  },
  {
    id: 'ashfall_ward:the_garden_well',
    areaId: 'ashfall_ward',
    at: { x: 62, z: 74.6 },
    label: 'Look down the well',
    caption:
      "The winch is padlocked, and the lock is the Magistracy's. The gardeners draw their water " +
      'with a pot on a string through the gap under the lid, which nobody has thought to seal ' +
      'yet.',
  },
  {
    id: 'ashfall_ward:the_slip',
    areaId: 'ashfall_ward',
    at: { x: -94, z: -60 },
    label: 'Look at the keel',
    caption:
      'A barge keel laid down on the slip and left: ribs up, no planking, the tar on the stem ' +
      "gone grey. The shipwright's mark is one the Toll House does not recognise, which is why " +
      'it is still here.',
  },
  {
    id: 'ashfall_ward:the_rookery_court',
    areaId: 'ashfall_ward',
    at: { x: 76, z: 34 },
    label: 'Look up at the washing',
    caption:
      'Four lines across the court, a sheet on each, and every sheet patched in the same blue. ' +
      'In the Rookeries that means one family, or one debt.',
  },
  {
    id: 'ashfall_ward:the_south_gate',
    areaId: 'ashfall_ward',
    at: { x: 12, z: 90.6 },
    label: 'Read the toll board',
    caption:
      'TOLL AT THE WARD WALL, and the rates. Under them, in chalk: TOLL AT THE OLD WALL, struck ' +
      'through. The ward moved its wall out and kept its toll, and the chalk has been keeping ' +
      'count.',
  },
  {
    id: 'ashfall_ward:the_coal_staithes',
    areaId: 'ashfall_ward',
    at: { x: 50, z: -70 },
    label: 'Look at the staithes',
    caption:
      'Coal from the works, heaped for barges that stopped coming. The heaps have been picked ' +
      'away at the edges to the shape of a hand, which is what a winter looks like from the far ' +
      'bank.',
  },

  /* ---- The Chalk Verge ---- */
  {
    id: 'chalk_verge:the_ward_stone',
    areaId: 'chalk_verge',
    at: { x: -38, z: -26.6 },
    label: 'Look at the waystone',
    caption:
      'THE WARD ENDS HERE, cut deep and recut deeper. Somebody has scratched a line under it, and ' +
      'under that: SO DOES THE WRIT.',
  },
  {
    id: 'chalk_verge:the_empty_pen',
    areaId: 'chalk_verge',
    at: { x: 42.6, z: -26.4 },
    label: 'Look at the pen',
    caption:
      'Hurdles lashed with twine, the gate tied shut from the outside. Whatever was kept in here was ' +
      'not let out. The ground inside is trodden bare and it has not rained since.',
  },
  {
    id: 'chalk_verge:the_spoil',
    areaId: 'chalk_verge',
    at: { x: 46, z: -2.6 },
    label: 'Look at the spoil heaps',
    caption:
      "Foundry spoil, tipped and left: slag, clinker, a boot. The carters' tally is chalked on a " +
      'board stuck into the nearest heap. It stops mid-week.',
  },

  {
    id: 'chalk_verge:the_gibbet',
    areaId: 'chalk_verge',
    at: { x: -20, z: 12.8 },
    label: 'Look at the gibbet',
    caption:
      'Empty, and oiled. The chain has been replaced recently, and the notice nailed to the post has ' +
      'been torn down so many times the nails are all that is left of it.',
  },

  /* ---- The Chalk Road ---- */
  {
    id: 'chalk_road:the_milestone',
    areaId: 'chalk_road',
    at: { x: 10, z: -10.6 },
    label: 'Look at the milestone',
    caption:
      'MILLHARROW -- III. It is two, if you have walked it. Nobody has corrected the stone; they have ' +
      'corrected the road, twice, and moved the mill once.',
  },
  {
    id: 'chalk_road:the_carts',
    areaId: 'chalk_road',
    at: { x: -50, z: -14.4 },
    label: 'Look at the cart',
    caption:
      'Pulled off the road and left with the shafts down. The load is gone and so is one wheel. The ' +
      'axle has been greased since.',
  },
  {
    id: 'chalk_road:the_cairns',
    areaId: 'chalk_road',
    at: { x: -42, z: -2.4 },
    label: 'Look at the cairn',
    caption:
      'Every stone on it was carried from somewhere else. The ones at the bottom are chalk; the ones at ' +
      'the top came from the Rimefields, which is a long way to carry a stone to put on a pile.',
  },
];

export function sightsInArea(areaId: string): SightDef[] {
  return SIGHTS.filter((s) => s.areaId === areaId);
}

export function sightById(id: string): SightDef | undefined {
  return SIGHTS.find((s) => s.id === id);
}
