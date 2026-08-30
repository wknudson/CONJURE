/**
 * The things standing about in a ward, and what kind of thing each of them is.
 *
 * Before this the world had three: a crate, a lamp, and a tree. Nineteen areas were built out
 * of those three, which is why a foundry and a barrow field looked like the same place with a
 * different floor. The problem was never the count — Ashfall carries thirty-four props and the
 * Caldera carried one — it was that there were only three nouns available.
 *
 * One registry rather than a field per kind. `AreaProps` was already twelve fields; adding
 * `barrels`, `carts`, `fences`, `braziers` and the rest would have taken it past twenty, each
 * with its own loop in `world.ts` and its own line in every test that walks props. Here a new
 * prop is one entry and one texture, and nothing downstream learns a new name — the same trade
 * `render/folk.ts` makes for the townsfolk.
 *
 * Deliberately free of three.js and the DOM: `map.ts` imports `DressingId` to type an area's
 * furniture, and a data module reaching into the renderer would be the wrong way round. The
 * geometry lives in `world.ts` and the textures in `textures.ts`.
 */

/**
 * How a prop is built, which is a different question from what it is.
 *
 * Four, because the two that existed do not cover what these places need. Trees are billboards
 * and crates are boxes; a fence is neither, and a scorch mark on the Storm Shelf is neither
 * again.
 */
export type DressingForm =
  /** Faces the camera on Y, like a tree. For things with no meaningful front. */
  | 'billboard'
  /**
   * An upright plane at a **fixed** yaw. The one that earns its place: a fence that swings
   * round to face the camera is not a fence, it is a signboard, and the moment the player
   * orbits with Q/E the illusion that it encloses anything is gone.
   */
  | 'panel'
  /** A solid block, like a crate. For things with mass. */
  | 'box'
  /** A flat decal on the floor. For marks rather than objects. */
  | 'ground';

export interface DressingKind {
  readonly form: DressingForm;
  /**
   * How big, in world units. Read differently per form: height for `billboard` and `panel`,
   * edge length for `box`, radius for `ground`. One number because every prop here is roughly
   * as wide as it is tall and the texture's own aspect does the rest.
   */
  readonly size: number;
  /**
   * Whether a body is stopped by it.
   *
   * Per kind rather than per form, because the existing world already disagrees within a form:
   * crates are boxes and collide, trees are billboards and do not. The honest line is mass —
   * anything a person could walk past or step over (washing, a scorch mark, a low cairn) lets
   * them, and anything they would have to shove (a barrel, a well, a cart) does not.
   *
   * Every `true` here is a potential soft-lock, which is why a test walks the spawn to every
   * exit through these colliders rather than trusting the placement.
   */
  readonly collides: boolean;
  /** One line on what it is for, so the registry reads as a catalogue rather than a table. */
  readonly note: string;
}

export type DressingId =
  | 'barrel'
  | 'sacks'
  | 'haybale'
  | 'awning'
  | 'fence'
  | 'cart'
  | 'brazier'
  | 'well'
  | 'trough'
  | 'rack'
  | 'washing'
  | 'cairn'
  | 'waystone'
  | 'spoilheap'
  | 'logpile'
  | 'scorch'
  | 'bollard'
  | 'pens';

/**
 * The vocabulary.
 *
 * `box` is deliberately rare. A box wears its picture on all six faces, so it only suits a
 * thing that genuinely is a filled volume — a barrel, a bale, a stack of sacks — and its art
 * has to fill its canvas or the transparent parts cut through and it reads as a wire frame.
 * Everything whose shape *is* the point is a `billboard`.
 */
export const DRESSING: Record<DressingId, DressingKind> = {
  barrel: { form: 'box', size: 1.5, collides: true, note: 'Lamp oil, beer, brine. Everywhere something is stored.' },
  sacks: { form: 'box', size: 1.7, collides: true, note: 'Grain at the mill, meal at the baker.' },
  haybale: { form: 'box', size: 1.9, collides: true, note: 'Fodder. Livestock country.' },
  awning: { form: 'panel', size: 3.0, collides: false, note: 'Stretched over a stall row. Hangs above head height, so it stops nobody.' },
  fence: { form: 'panel', size: 2.0, collides: true, note: 'Hurdle and rail. What makes a field a field.' },
  cart: { form: 'billboard', size: 2.6, collides: true, note: 'Hand cart, coal cart, freight. Parked, never moving.' },
  brazier: { form: 'billboard', size: 2.2, collides: true, note: 'Open fire. Throws its own light, which is not gaslight.' },
  well: { form: 'billboard', size: 2.4, collides: true, note: 'Stone rim. The reason a hamlet is where it is.' },
  trough: { form: 'billboard', size: 2.0, collides: true, note: 'Water for animals. Low and long.' },
  rack: { form: 'billboard', size: 3.2, collides: false, note: 'Drying frame — nets, hides, herbs. Open enough to walk through.' },
  washing: { form: 'panel', size: 2.8, collides: false, note: 'A line strung between windows. Strung high; you pass under it.' },
  cairn: { form: 'billboard', size: 1.8, collides: false, note: 'Stacked stones. The only mark people leave on the wilds.' },
  waystone: { form: 'panel', size: 2.6, collides: true, note: 'A carved marker. Carries text — the wilds have no walls to paint on.' },
  spoilheap: { form: 'billboard', size: 3.2, collides: true, note: 'What came out of the ground and was not wanted.' },
  logpile: { form: 'billboard', size: 2.2, collides: true, note: 'Cut timber, stacked to season.' },
  scorch: { form: 'ground', size: 3.6, collides: false, note: 'Burn mark. A thing happened here and is over.' },
  bollard: { form: 'billboard', size: 1.1, collides: true, note: 'Quay and processional. Stops a cart, not a person going round it.' },
  pens: { form: 'panel', size: 1.7, collides: true, note: 'Livestock hurdles, penned. Lower and tighter than a fence.' },
};

export const DRESSING_IDS = Object.keys(DRESSING) as DressingId[];

export function isDressingId(id: string): id is DressingId {
  return Object.prototype.hasOwnProperty.call(DRESSING, id);
}
