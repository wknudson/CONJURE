/**
 * The animals, and what kind of animal each of them is.
 *
 * Before this the only things in Azo that moved were the gas lamps, the canal, a townsperson
 * bobbing on the spot, and the packs that want to kill you. Nineteen areas of it. The wildlands
 * in particular are *deliberately* free of people — the atlas says nobody lives out there and a
 * test pins it — but nobody ever decided that the Ashwood should have no animals in it either,
 * and an empty wood is a stage set rather than a wood.
 *
 * One registry, on exactly the terms `dressing.ts` won its argument on: a new animal is one
 * entry here and one texture factory, `map.ts` imports `CritterId` to type an area's fauna, and
 * nothing downstream learns a new name. `AreaProps` gains one field rather than one per beast.
 *
 * Deliberately free of three.js and the DOM. The behaviour lives in `entities.ts` beside `Pack`,
 * which is where it belongs and which it borrows most of; the pictures live in `textures.ts`.
 */

export interface CritterKind {
  /** How tall it stands, in world units. A rat is 0.3; a Commander is 2.5. */
  readonly height: number;
  /**
   * How fast it moves when it is going somewhere, in world units a second.
   *
   * Bounded by the same argument `Pack.SPEED` is: `collision.ts` proves nothing tunnels through
   * a wall between two frames by stating the fastest body against a `dt` clamped to 0.05, and
   * the smallest collider radius is what that has to stay inside. A hare bolting at nine would
   * be through the hedge. See `Critter.FLUSH_SPEED`, which is this doubled and is the real
   * number to check.
   */
  readonly speed: number;
  /**
   * How close you get before it breaks away, in world units. Zero means it does not.
   *
   * The whole point of the system. A creature that wanders is scenery with a tween on it; a
   * creature that *reacts to you* is the thing that makes a place feel inhabited, and it is the
   * only behaviour here that the player can cause.
   *
   * Zero is used twice and means two different things, which is fine because the animals are
   * different: a rook overhead is too far up to care, and a wolf on the Rimefields does not run
   * from you. The second is the more interesting one — one animal in the world that stands and
   * watches is worth more than another six that scatter.
   */
  readonly flush: number;
  /**
   * Whether it is in the air.
   *
   * A flying kind takes an altitude, ignores the collider set entirely, and roams much wider —
   * which is the whole of "birds crossing the sky" without a second system to maintain. It is a
   * flag rather than a form because everything else about the two is identical: a body, a
   * wander, a heading, a picture that turns to camera.
   */
  readonly flies: boolean;
  /** How high it flies, in world units. Ignored on the ground. */
  readonly altitude?: number;
  /** One line on what it is and where it belongs, so this reads as a bestiary. */
  readonly note: string;
}

export type CritterId =
  | 'rat'
  | 'hare'
  | 'fox'
  | 'deer'
  | 'goat'
  | 'sheep'
  | 'crab'
  | 'heron'
  | 'wolf'
  | 'rook'
  | 'gull'
  | 'moth';

/**
 * The bestiary.
 *
 * Twelve, chosen so that every biome in the world has something that belongs to it and nothing
 * else — a foundry ward gets rats and rooks, a saltmarsh gets gulls and crabs, and a barrow field
 * gets rooks and nothing else because that is the point of a barrow field. An animal that could
 * stand anywhere is an animal that says nothing about where it is standing.
 *
 * `flush` carries most of the character. A hare is gone before you have seen it; a sheep barely
 * looks up; a wolf does not move at all.
 */
export const CRITTERS: Record<CritterId, CritterKind> = {
  rat: {
    height: 0.3,
    speed: 2.6,
    flush: 4.5,
    flies: false,
    note: 'Gutters, spoil heaps, the Sink. Bolts before you are sure you saw it.',
  },
  hare: {
    height: 0.45,
    speed: 3.0,
    flush: 8,
    flies: false,
    note: 'Field margins and snow. The most nervous thing in Azo; it breaks at the longest range.',
  },
  fox: {
    height: 0.6,
    speed: 2.4,
    flush: 6,
    flies: false,
    note: 'Woodland edges and the backs of towns. Goes at a trot rather than a bolt.',
  },
  deer: {
    height: 1.5,
    speed: 2.8,
    flush: 9,
    flies: false,
    note: 'Ashwood clearings. Big enough to see a long way off, which is the point of it.',
  },
  goat: {
    height: 0.85,
    speed: 1.6,
    flush: 3,
    flies: false,
    note: 'Hillside and rough ground. Barely concerned by anybody.',
  },
  sheep: {
    height: 0.8,
    speed: 1.2,
    flush: 2.5,
    flies: false,
    note: 'Farmland. Moves the least of anything with legs, and always in company.',
  },
  crab: {
    height: 0.25,
    speed: 1.4,
    flush: 3.5,
    flies: false,
    note: 'Salt pans and river mud. Sidles rather than runs.',
  },
  heron: {
    height: 1.3,
    speed: 1.1,
    flush: 10,
    flies: false,
    note: 'Standing in the drainage cuts. Stands still until it does not, and then it is gone.',
  },
  wolf: {
    height: 1.0,
    speed: 2.2,
    flush: 0,
    flies: false,
    note: 'The Rimefields and the deep Ashwood. Does not run from you. Watches, and keeps its distance on its own terms.',
  },
  rook: {
    height: 0.5,
    speed: 3.4,
    flush: 0,
    flies: true,
    altitude: 11,
    note: 'Over every roof and every barrow in the world. Too high to care what you are doing.',
  },
  gull: {
    height: 0.55,
    speed: 3.6,
    flush: 0,
    flies: true,
    altitude: 9,
    note: 'Water and the smell of a market. Wheels wider than a rook does.',
  },
  moth: {
    height: 0.3,
    speed: 1.0,
    flush: 0,
    flies: true,
    altitude: 2.4,
    note: 'Drawn to anything burning. Low, slow, and the only wildlife on the Caldera floor.',
  },
};

export const CRITTER_IDS = Object.keys(CRITTERS) as CritterId[];

export function isCritterId(id: string): id is CritterId {
  return Object.prototype.hasOwnProperty.call(CRITTERS, id);
}
