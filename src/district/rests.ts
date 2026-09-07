/**
 * Somewhere to sleep.
 *
 * A bed advances the street clock to the next waking hour, for a fee, and that is all it
 * does. It does not heal: the Pact is mended at the Clinic and by the rescue bill, and a bed
 * that undercut both would be a balance change wearing an inn's clothes. What it buys is the
 * clock -- a Commander who wants the night crews off the road, or the dawn light for the walk,
 * or the herbs regrown, sleeps for it.
 *
 * Addressed into areas from outside by area id, the house pattern. Pure: no three.js, no DOM.
 */

import { DAY_HOURS } from './daylight.js';

export interface RestDef {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  readonly areaId: string;
  /** Where you stand to take it. Walkable, clear of the furniture including the bed. */
  readonly at: { readonly x: number; readonly z: number };
  /** The bed itself. Placed by `world.ts` through `registryProps`. */
  readonly prop: { readonly x: number; readonly z: number; readonly yaw?: number };
  /** The interact prompt: "Take the cot". The fee is added by the screen. */
  readonly label: string;
  readonly fee: number;
  /** The hour you wake at, 0 to 23. */
  readonly wakeHour: number;
  /** What the street says when you do. */
  readonly line: string;
}

export const RESTS: readonly RestDef[] = [
  {
    // The Clinic's cot, behind the curtain. Not a bed for the night, officially -- but the
    // apothecary has never turned a paying customer off it, and it is the only mattress in the
    // ward that is not somebody's own.
    id: 'ashfall_apothecary:clinic_cot',
    areaId: 'ashfall_apothecary',
    at: { x: 20.4, z: 10 },
    prop: { x: 22, z: 6.6, yaw: Math.PI / 2 },
    label: 'Take the Clinic cot until morning',
    fee: 12,
    wakeHour: 6,
    line: 'You wake to jars being counted. It is morning, and you are billed for it.',
  },
];

export const restById = (id: string): RestDef | undefined => RESTS.find((r) => r.id === id);

export const restsInArea = (areaId: string): readonly RestDef[] =>
  RESTS.filter((r) => r.areaId === areaId);

/**
 * The clock reading you wake at: the first `wakeHour` strictly after `clock`.
 *
 * Strictly after, so lying down at six sleeps a whole day rather than no time at all -- a
 * bed that could be taken for nothing would be a free skip of every night crew. The clock is
 * not wrapped: it counts hours since the character started and the day is read off it.
 */
export function restUntil(clock: number, wakeHour: number): number {
  const day = Math.floor(clock / DAY_HOURS);
  const today = day * DAY_HOURS + wakeHour;
  return today > clock ? today : today + DAY_HOURS;
}
