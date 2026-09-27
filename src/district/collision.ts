/**
 * What an area will not let you walk through.
 *
 * Two layers, because they answer different questions. The tile layer handles the canal
 * and the edge of the world and comes free with the map. The box layer handles buildings,
 * lamp posts, crates and the sealed gate — things with a footprint that the grid alone is
 * too coarse to describe.
 *
 * An instance rather than module state: the screen is rebuilt every time a shop door
 * closes, and a module-level array would accumulate a second ward's worth of walls on the
 * second visit.
 *
 * The **area** is held for the same reason and by the same argument. It could have been a
 * module-level "current area" read by `isWalkable`, and that would have been the same mistake
 * one level down: `loadActors` is async and already guards against finishing after its screen
 * was torn down, so an in-flight load resuming after a crossing would sample the wrong grid.
 * A set of colliders belongs to one place, so it holds that place.
 */

import { isWalkable, type AreaDef } from './map.js';

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  tag: string;
  enabled: boolean;
}

/**
 * How wide a bucket of the box index is, in world units. One tile: most footprints are a
 * tile or less across, so a box lands in one to four buckets and a query reads one to four.
 */
const CELL = 4;

export class ColliderSet {
  /**
   * Every box, in the order it was added. The one list — the index below is a lookup over it,
   * never a second copy of what is solid, so `enabled` is read off the box at query time and a
   * gate that opens is open in every bucket at once.
   */
  readonly boxes: Collider[] = [];
  /**
   * The boxes again, bucketed by the cells their footprint covers.
   *
   * `blocked` used to scan every box for every probe, and it is asked constantly: twice per mover
   * per frame, a dozen times per wander pick, and once per cell of every reachability flood the
   * tests run. That was fine at twenty tiles and forty boxes and is not at twice the ground and
   * three times the furniture. Boxes are only ever added while an area is being built, so the
   * index is filled once and never rebalanced.
   */
  private readonly cells = new Map<number, Collider[]>();

  constructor(private readonly area: AreaDef) {}

  add(x: number, z: number, w: number, d: number, tag = ''): Collider {
    const box: Collider = {
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
      tag,
      enabled: true,
    };
    this.boxes.push(box);
    for (let cx = Math.floor(box.minX / CELL); cx <= Math.floor(box.maxX / CELL); cx++) {
      for (let cz = Math.floor(box.minZ / CELL); cz <= Math.floor(box.maxZ / CELL); cz++) {
        const key = cellKey(cx, cz);
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(box);
        else this.cells.set(key, [box]);
      }
    }
    return box;
  }

  /**
   * Whether a body of radius `r` may stand here.
   *
   * The tile layer is sampled at the centre and four cardinal offsets rather than just the
   * centre, so you cannot clip the corner of the canal by standing where your middle is
   * still on stone.
   */
  blocked(x: number, z: number, r = 0.4): boolean {
    const a = this.area;
    if (!isWalkable(a, x, z)) return true;
    if (!isWalkable(a, x + r, z) || !isWalkable(a, x - r, z)) return true;
    if (!isWalkable(a, x, z + r) || !isWalkable(a, x, z - r)) return true;

    // Only the buckets the body's own square touches. A box that overlaps the body shares at
    // least one point with that square, and every point's bucket holds every box covering it.
    for (let cx = Math.floor((x - r) / CELL); cx <= Math.floor((x + r) / CELL); cx++) {
      for (let cz = Math.floor((z - r) / CELL); cz <= Math.floor((z + r) / CELL); cz++) {
        const bucket = this.cells.get(cellKey(cx, cz));
        if (!bucket) continue;
        for (const c of bucket) {
          if (!c.enabled) continue;
          if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
        }
      }
    }
    return false;
  }

  /**
   * Moves a point, one axis at a time.
   *
   * Resolving each axis separately is what makes a body slide along a wall instead of
   * sticking to it: the blocked axis is simply not applied, and the free one still is.
   * At six units a second against a dt clamped to 0.05 the longest step is 0.3, well
   * inside the smallest radius, so nothing can tunnel through a wall between frames.
   */
  move(pos: { x: number; z: number }, dx: number, dz: number, r = 0.4): void {
    const nx = pos.x + dx;
    if (!this.blocked(nx, pos.z, r)) pos.x = nx;
    const nz = pos.z + dz;
    if (!this.blocked(pos.x, nz, r)) pos.z = nz;
  }
}

/**
 * One number per bucket, so the index is a `Map` of numbers rather than of strings built per
 * probe. Cells are a few hundred units either side of the origin at most, far inside the
 * sixteen bits each half gets.
 */
function cellKey(cx: number, cz: number): number {
  return (cx + 0x8000) * 0x10000 + (cz + 0x8000);
}
