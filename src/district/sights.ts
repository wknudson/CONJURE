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
