/**
 * What lies about on the ground: tufts, stones, leaves, litter, puddles, drifts.
 *
 * The ground of every area is one baked picture, a tile's paint at sixteen pixels, and from the
 * walk camera a field of grass is a green sheet and a chalk road a white one. The small things
 * that say what a surface is -- a tuft, a stone, a curl of dead leaf, a slick of standing water
 * -- were never there, because placing them by hand is placing thousands of them.
 *
 * So they are scattered, and the scatter is the part that matters: Poisson-disk points
 * (`poisson.ts`, after Bridson), so nothing touches and nothing lines up with the grid, kept to
 * the paints that grow or shed each kind, thinned by a density per paint, and kept clear of every
 * door, prompt, person and piece of furniture. Seeded off the area, so the same field has the
 * same stones in it every visit. Nothing here collides with anything; it is the one layer of the
 * world that is only ever looked at. Rooms have none.
 *
 * Pure: the drawing is `world.ts`'s, one instanced mesh per kind.
 */

import { hashText } from '../core/util/rng.js';
import { poissonDisk } from '../core/util/poisson.js';
import type { AreaDef } from './map.js';

export type ClutterKind = 'tuft' | 'flower' | 'pebble' | 'litter' | 'leaves' | 'cinder' | 'puddle' | 'drift' | 'bones';

/** Every kind, for the textures and the meshes. */
export const CLUTTER_KINDS: readonly ClutterKind[] = ['tuft', 'flower', 'pebble', 'litter', 'leaves', 'cinder', 'puddle', 'drift', 'bones'];

/** The kinds that stand up out of the ground; everything else lies flat on it. */
export const STANDING: ReadonlySet<ClutterKind> = new Set(['tuft', 'flower']);

/** How big each kind is, in world units: height for what stands, width for what lies. */
export const CLUTTER_SIZE: Readonly<Record<ClutterKind, number>> = {
  tuft: 0.55,
  flower: 0.5,
  pebble: 0.45,
  litter: 0.4,
  leaves: 0.6,
  cinder: 0.45,
  puddle: 1.1,
  drift: 0.9,
  bones: 0.55,
};

/**
 * What each paint sheds, and how thickly: the share of scatter points on that paint that become
 * each kind. Paints not listed shed nothing -- water, ice, and every floor indoors.
 */
export const CLUTTER: Readonly<Record<string, readonly (readonly [ClutterKind, number])[]>> = {
  grass: [['tuft', 0.42], ['flower', 0.05], ['pebble', 0.04]],
  field: [['tuft', 0.14], ['pebble', 0.08]],
  weeds: [['tuft', 0.5], ['flower', 0.07]],
  heath: [['tuft', 0.4], ['flower', 0.09]],
  barrow: [['tuft', 0.3], ['bones', 0.04]],
  chalk: [['pebble', 0.22], ['tuft', 0.07]],
  cobble: [['litter', 0.05], ['tuft', 0.05]],
  sidewalk: [['litter', 0.03]],
  flagstone: [['litter', 0.03], ['tuft', 0.02]],
  market: [['litter', 0.14]],
  slag: [['cinder', 0.32]],
  ash: [['cinder', 0.18], ['pebble', 0.08]],
  crust: [['pebble', 0.1], ['cinder', 0.08]],
  sulphur: [['pebble', 0.1]],
  blasted: [['pebble', 0.18], ['cinder', 0.08]],
  marsh: [['tuft', 0.3], ['puddle', 0.1]],
  salt: [['pebble', 0.07]],
  forest: [['leaves', 0.32], ['tuft', 0.08]],
  litter: [['leaves', 0.45]],
  snow: [['drift', 0.12], ['pebble', 0.03]],
  drift: [['drift', 0.28]],
  bone: [['bones', 0.14], ['pebble', 0.06]],
};

/** One thing on the ground. */
export interface ClutterPoint {
  readonly kind: ClutterKind;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  readonly scale: number;
}

/** Somewhere nothing may lie: a centre and how far to keep off it. */
export interface Keepout {
  readonly x: number;
  readonly z: number;
  readonly r: number;
}

/** How far apart scatter points are, at the least. A tuft a stride from the next. */
const SPACING = 1.35;

/** A stable 0-1 roll for a point, so a density test is the same test every visit. */
function roll(seed: number, x: number, z: number): number {
  let h = seed ^ Math.imul(Math.round(x * 64), 0x27d4eb2d) ^ Math.imul(Math.round(z * 64), 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * Everything lying about on an area's ground, kept off `avoid`.
 *
 * Deterministic for an area. Only walkable tiles shed anything, and only as their paint says.
 */
export function scatterClutter(area: AreaDef, avoid: readonly Keepout[]): ClutterPoint[] {
  if (area.indoor) return [];
  const seed = hashText(`${area.id}:clutter`);
  const paintAt = (x: number, z: number): string | null => {
    const col = Math.floor((x + area.halfX) / 4);
    const row = Math.floor((z + area.halfZ) / 4);
    if (row < 0 || row >= area.rows || col < 0 || col >= area.cols) return null;
    const t = area.legend[area.grid[row]![col]!];
    return t && t.walk ? t.tex : null;
  };
  const clear = (x: number, z: number): boolean => avoid.every((k) => Math.hypot(x - k.x, z - k.z) > k.r);
  // Sampled over the whole area and then kept to the paints that shed, rather than masked while
  // sampling: a mask leaves any patch of grass further than two spacings from the next one empty.
  const points = poissonDisk(-area.halfX, -area.halfZ, area.halfX, area.halfZ, SPACING, seed);
  const out: ClutterPoint[] = [];
  for (const pt of points) {
    const paint = paintAt(pt.x, pt.z);
    const table = paint ? CLUTTER[paint] : undefined;
    if (!table) continue;
    let r = roll(seed, pt.x, pt.z);
    for (const [kind, share] of table) {
      if (r < share) {
        if (clear(pt.x, pt.z)) {
          const r2 = roll(seed + 1, pt.x, pt.z);
          out.push({ kind, x: pt.x, z: pt.z, yaw: r2 * Math.PI * 2, scale: 0.75 + roll(seed + 2, pt.x, pt.z) * 0.5 });
        }
        break;
      }
      r -= share;
    }
  }
  return out;
}
