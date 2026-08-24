/**
 * What the ward will not let you walk through.
 *
 * Two layers, because they answer different questions. The tile layer handles the canal
 * and the edge of the world and comes free with the map. The box layer handles buildings,
 * lamp posts, crates and the sealed gate — things with a footprint that the grid alone is
 * too coarse to describe.
 *
 * An instance rather than module state: the screen is rebuilt every time a shop door
 * closes, and a module-level array would accumulate a second ward's worth of walls on the
 * second visit.
 */

import { isWalkable } from './map.js';

export interface Collider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  tag: string;
  enabled: boolean;
}

export class ColliderSet {
  readonly boxes: Collider[] = [];

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
    if (!isWalkable(x, z)) return true;
    if (!isWalkable(x + r, z) || !isWalkable(x - r, z)) return true;
    if (!isWalkable(x, z + r) || !isWalkable(x, z - r)) return true;

    for (const c of this.boxes) {
      if (!c.enabled) continue;
      if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return true;
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
