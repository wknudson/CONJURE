/**
 * Seeded PRNG (mulberry32). Serializable state so a GameState can be cloned, replayed,
 * and hashed. Nothing in the core may call Math.random().
 */

export interface RngState {
  s: number;
}

export const makeRng = (seed: number): RngState => ({ s: seed >>> 0 });

/** Advances the state in place and returns a float in [0, 1). */
export function nextFloat(rng: RngState): number {
  rng.s = (rng.s + 0x6d2b79f5) >>> 0;
  let t = rng.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Integer in [0, maxExclusive). */
export function nextInt(rng: RngState, maxExclusive: number): number {
  if (maxExclusive <= 0) return 0;
  return Math.floor(nextFloat(rng) * maxExclusive);
}

/** Fisher-Yates, in place, deterministic for a given rng state. */
export function shuffle<T>(rng: RngState, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = nextInt(rng, i + 1);
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items;
}
