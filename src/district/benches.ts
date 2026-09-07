/**
 * The tills: where, inside a room, the trade screens open from.
 *
 * The four trades used to be `DoorSpec`s -- a hotspot on the pavement in front of a plaque,
 * and a full-screen menu the moment you pressed the key. A door is a way into a room now
 * (`ExitSpec.door`), and what opens the Artificer's screen is his bench at the back of the
 * forge, the apothecary's counter, the handler's table in the yard. The screens themselves
 * are unchanged; only the place you stand to open them moved indoors.
 *
 * The Field Journal is not here, on purpose. It is the one trade you carry: `J` opens it from
 * anywhere, street or room, and the building that was the Journal is the Records Office now.
 *
 * Addressed into rooms from outside by area id -- the house pattern `sites.ts`, `errands.ts`
 * and `stalls.ts` keep -- so a room file says where its floor is and this file says what is
 * standing on it. Pure: no three.js, no DOM.
 */

import type { DressingId } from './dressing.js';

export type BenchKind = 'artificer' | 'apothecary' | 'vivarium';

export interface BenchDef {
  /** `${areaId}:${slug}`, the sites idiom. */
  readonly id: string;
  /** The room it stands in. Must be an `indoor` area. */
  readonly areaId: string;
  readonly kind: BenchKind;
  /** Where you stand to work it. Walkable, and clear of the furniture. */
  readonly at: { readonly x: number; readonly z: number };
  /**
   * Where you are standing when the screen closes.
   *
   * More than an interact radius from `at`, or the room remounts with the prompt to reopen
   * the screen you just closed already up -- the rule `DoorSpec.returnZ` used to state. And
   * clear of every other hotspot in the room, for the same reason.
   */
  readonly back: { readonly x: number; readonly z: number };
  /** The interact prompt. */
  readonly label: string;
  /** The furniture that *is* the bench, if a piece stands for it. Placed by `world.ts`. */
  readonly prop?: {
    readonly kind: DressingId;
    readonly x: number;
    readonly z: number;
    readonly yaw?: number;
  };
}

export const BENCHES: readonly BenchDef[] = [
  {
    id: 'ashfall_ironworks:bench',
    areaId: 'ashfall_ironworks',
    kind: 'artificer',
    at: { x: 2, z: -6 },
    back: { x: 2, z: -2.4 },
    label: "Work the Artificer's bench",
  },
  {
    id: 'ashfall_apothecary:counter',
    areaId: 'ashfall_apothecary',
    kind: 'apothecary',
    at: { x: -2, z: 14 },
    back: { x: -2, z: 10.6 },
    label: 'Speak to the apothecary',
  },
  {
    id: 'ashfall_vivarium:table',
    areaId: 'ashfall_vivarium',
    kind: 'vivarium',
    at: { x: 2, z: 14 },
    back: { x: 2, z: 10.6 },
    label: 'Speak to the handler',
  },
];

export const benchesInArea = (areaId: string): readonly BenchDef[] =>
  BENCHES.filter((b) => b.areaId === areaId);

export const benchOfKind = (kind: BenchKind): BenchDef | undefined =>
  BENCHES.find((b) => b.kind === kind);
