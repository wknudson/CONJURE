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
  {
    id: 'ashfall_cinder_cup:upstairs_bed',
    areaId: 'ashfall_cinder_cup',
    at: { x: -26, z: 6 },
    prop: { x: -26, z: 2, yaw: Math.PI / 2 },
    label: 'Take the bed upstairs',
    fee: 20,
    wakeHour: 7,
    line: 'You wake to the hearth being raked and the smell of the works on the wind. Seven, and the ward is up.',
  },
  {
    // The cheapest bed in Jolrek, behind a curtain in a clinic over a cistern.
    id: 'ward_seven_clinic:the_cot',
    areaId: 'ward_seven_clinic',
    at: { x: -6, z: 6 },
    prop: { x: -6, z: 2, yaw: Math.PI / 2 },
    label: 'Take the cot behind the curtain',
    fee: 8,
    wakeHour: 6,
    line: 'You wake damp. Everything in Ward Seven wakes damp. The healer has already seen four people.',
  },
  {
    // Nobody's bed, and the tally says to pay for it anyway. The cheapest sleep in Azo.
    id: 'chalk_verge_bothy:shepherds_bed',
    areaId: 'chalk_verge_bothy',
    at: { x: -14, z: -14.6 },
    prop: { x: -14, z: -18, yaw: Math.PI / 2 },
    label: "Take the shepherd's bed",
    fee: 2,
    wakeHour: 6,
    line: 'You wake cold, and leave two Ducats in the tin under the rafter, because the last person did.',
  },
  {
    id: 'chalk_road_waystation:the_cot',
    areaId: 'chalk_road_waystation',
    at: { x: -18, z: 13.6 },
    prop: { x: -18, z: 10, yaw: Math.PI / 2 },
    label: "Take the toll-keeper's cot",
    fee: 6,
    wakeHour: 6,
    line: 'You wake to a cart going by outside without stopping, which is what carts do here now. Six.',
  },
  {
    id: 'tallow_pump_house:engineers_cot',
    areaId: 'tallow_pump_house',
    at: { x: -18, z: 10.6 },
    prop: { x: -18, z: 14, yaw: Math.PI / 2 },
    label: "Take the engineer's cot",
    fee: 4,
    wakeHour: 6,
    line: 'You wake to the pipe ticking as it cools, which it has been doing for eleven years. Six.',
  },
  {
    id: 'highcourt_smoke_eaters:upstairs_bed',
    areaId: 'highcourt_smoke_eaters',
    at: { x: 18, z: 14 },
    prop: { x: 18, z: 18 },
    label: 'Take the bed upstairs',
    fee: 30,
    wakeHour: 7,
    line: 'You wake to bells from the Spire, which is the court waking, and to the Smoke-Eater already at his bench.',
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
