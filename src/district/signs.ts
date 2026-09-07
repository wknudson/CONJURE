/**
 * What hangs over a door.
 *
 * A name into `SIGN_GLYPHS` in `textures.ts`, typed so that hanging a sign nobody has drawn is
 * a compile error, and listed here rather than there so `map.ts` -- which is DOM-free and
 * three-free on purpose -- can name one on an `ExitSpec` without importing a canvas.
 *
 * Both ways: a test asks that every sign here hangs over at least one door in the world, the
 * discipline the furniture and the animals already keep. Dropping a glyph is a decision.
 */
export const SIGN_IDS = [
  'artificer',
  'apothecary',
  'vivarium',
  'records',
  'toll',
  'counting',
  'chapel',
  'tavern',
  'lamp',
  'market',
  'pawn',
] as const;

export type SignId = (typeof SIGN_IDS)[number];

export function isSignId(id: string): id is SignId {
  return (SIGN_IDS as readonly string[]).includes(id);
}
