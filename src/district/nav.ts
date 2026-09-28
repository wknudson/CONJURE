/**
 * How to get from here to there round the buildings.
 *
 * Everything on the street that walks with a purpose used to steer straight at where it wanted
 * to be and let `ColliderSet.move` slide it along whatever was in the way. On a twenty-tile ward
 * with its buildings in rows that mostly worked. It is also why a pack chasing you round the end
 * of a terrace ground its face into the wall until you walked away, and why a wander target on
 * the far side of a spoil heap could hold a crew against the heap indefinitely. The grown areas
 * have yards, lanes and dead ends; straight lines do not get through them.
 *
 * So an area gets a grid of one-unit cells, built once from the same colliders the player is
 * stopped by, and anything that needs to go round something asks it for a path. A* over eight
 * neighbours with no corner cutting, then pulled tight so the route is a handful of corners
 * rather than a staircase. A mover walks straight whenever the straight line is clear, which is
 * most of the time, and only plans when it is not.
 *
 * The same grid answers two cheaper questions the wander needs: whether a spot can be stood on
 * at all, and whether it is in the same connected piece of ground as another -- a roam target
 * across a canal is walkable and unreachable, and used to be picked.
 *
 * Pure of three.js. Waypoints for the prowlers are here too: a lattice of cells across the
 * area's main ground, the network a Brogue monster wanders (see `waypoints`).
 */

import type { ColliderSet } from './collision.js';
import { tileAt } from './map.js';

export interface Point {
  x: number;
  z: number;
}

/** A search that has expanded this many cells gives up. A path across the largest map is a few thousand. */
const MAX_EXPAND = 12_000;

const SQRT2 = Math.SQRT2;

export class NavGrid {
  /** Cell size in world units. One: finer than a tile, coarser than a body. */
  static readonly CELL = 1;

  readonly cols: number;
  readonly rows: number;
  private readonly minX: number;
  private readonly minZ: number;
  /** 1 where a body of the grid's radius can stand at the cell's centre. */
  private readonly open: Uint8Array;
  /** Which connected piece of open ground each cell belongs to; -1 where it is not open. */
  private readonly comp: Int32Array;
  /** The piece with the most ground in it. The street, as opposed to a pocket behind a fence. */
  readonly mainComponent: number;

  // Search scratch, allocated once. `stamp` marks which cells this search has touched, so the
  // arrays never need clearing between searches.
  private readonly g: Float32Array;
  private readonly came: Int32Array;
  private readonly seen: Int32Array;
  private readonly shut: Int32Array;
  private search = 0;

  constructor(colliders: ColliderSet, radius = 0.45) {
    const a = colliders.area;
    const C = NavGrid.CELL;
    this.minX = -a.halfX;
    this.minZ = -a.halfZ;
    this.cols = Math.round((a.halfX * 2) / C);
    this.rows = Math.round((a.halfZ * 2) / C);
    const n = this.cols * this.rows;
    this.open = new Uint8Array(n);
    // Painted rather than asked. Asking `colliders.blocked` of every cell was fine at twenty tiles
    // and is a quarter of a second at the Ashwood's sixty-four by fifty-six, under load, at every
    // crossing into it. The answer is the same one `blocked` gives, got the other way round: the
    // tile layer first, each cell's five probes read off the tiles, and then every box painted
    // over the cells whose centre it covers, which is the test `blocked` makes box by box.
    const walkAt = (x: number, z: number): boolean => tileAt(a, x, z).walk;
    for (let r = 0; r < this.rows; r++) {
      const z = this.minZ + (r + 0.5) * C;
      for (let c = 0; c < this.cols; c++) {
        const x = this.minX + (c + 0.5) * C;
        const ok =
          walkAt(x, z) && walkAt(x + radius, z) && walkAt(x - radius, z) && walkAt(x, z + radius) && walkAt(x, z - radius);
        this.open[r * this.cols + c] = ok ? 1 : 0;
      }
    }
    for (const b of colliders.boxes) {
      if (!b.enabled) continue;
      const c0 = Math.max(0, Math.floor((b.minX - radius - this.minX) / C - 0.5));
      const c1 = Math.min(this.cols - 1, Math.ceil((b.maxX + radius - this.minX) / C - 0.5));
      const r0 = Math.max(0, Math.floor((b.minZ - radius - this.minZ) / C - 0.5));
      const r1 = Math.min(this.rows - 1, Math.ceil((b.maxZ + radius - this.minZ) / C - 0.5));
      for (let r = r0; r <= r1; r++) {
        const z = this.minZ + (r + 0.5) * C;
        if (!(z > b.minZ - radius && z < b.maxZ + radius)) continue;
        for (let c = c0; c <= c1; c++) {
          const x = this.minX + (c + 0.5) * C;
          if (x > b.minX - radius && x < b.maxX + radius) this.open[r * this.cols + c] = 0;
        }
      }
    }

    this.comp = new Int32Array(n).fill(-1);
    const sizes: number[] = [];
    const queue = new Int32Array(n);
    for (let start = 0; start < n; start++) {
      if (!this.open[start] || this.comp[start]! >= 0) continue;
      const id = sizes.length;
      let head = 0;
      let tail = 0;
      queue[tail++] = start;
      this.comp[start] = id;
      while (head < tail) {
        const i = queue[head++]!;
        const c = i % this.cols;
        const r = (i - c) / this.cols;
        const nb = [c > 0 ? i - 1 : -1, c < this.cols - 1 ? i + 1 : -1, r > 0 ? i - this.cols : -1, r < this.rows - 1 ? i + this.cols : -1];
        for (const j of nb) {
          if (j < 0 || !this.open[j] || this.comp[j]! >= 0) continue;
          this.comp[j] = id;
          queue[tail++] = j;
        }
      }
      sizes.push(tail);
    }
    let best = -1;
    for (let id = 0; id < sizes.length; id++) if (best < 0 || sizes[id]! > sizes[best]!) best = id;
    this.mainComponent = best;

    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.seen = new Int32Array(n);
    this.shut = new Int32Array(n);
  }

  /** The cell a point is in, or -1 off the grid. */
  cellOf(x: number, z: number): number {
    const c = Math.floor((x - this.minX) / NavGrid.CELL);
    const r = Math.floor((z - this.minZ) / NavGrid.CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  private centre(i: number): Point {
    const c = i % this.cols;
    const r = (i - c) / this.cols;
    return { x: this.minX + (c + 0.5) * NavGrid.CELL, z: this.minZ + (r + 0.5) * NavGrid.CELL };
  }

  /** Whether a body could stand here. */
  walkable(x: number, z: number): boolean {
    const i = this.cellOf(x, z);
    return i >= 0 && this.open[i] === 1;
  }

  /** Which piece of ground a point is on, or -1 if it is not open ground. */
  componentAt(x: number, z: number): number {
    const i = this.cellOf(x, z);
    return i >= 0 ? this.comp[i]! : -1;
  }

  /** Whether one point can be walked to from the other at all. */
  connected(ax: number, az: number, bx: number, bz: number): boolean {
    const ca = this.componentAt(ax, az);
    return ca >= 0 && ca === this.componentAt(bx, bz);
  }

  /**
   * Whether a body could walk the straight line between two points: every cell it crosses open.
   *
   * Sampled at a third of a cell, which is fine enough that a diagonal cannot slip between two
   * blocked cells that touch at a corner.
   */
  lineClear(ax: number, az: number, bx: number, bz: number): boolean {
    const d = Math.hypot(bx - ax, bz - az);
    const steps = Math.max(1, Math.ceil(d / (NavGrid.CELL / 3)));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      if (!this.walkable(ax + (bx - ax) * t, az + (bz - az) * t)) return false;
    }
    return true;
  }

  /** The open cell nearest a point, searched outward ring by ring, or null past `reach` cells. */
  nearestOpen(x: number, z: number, reach = 6): Point | null {
    const i0 = this.cellOf(x, z);
    if (i0 >= 0 && this.open[i0]) return this.centre(i0);
    const c0 = Math.floor((x - this.minX) / NavGrid.CELL);
    const r0 = Math.floor((z - this.minZ) / NavGrid.CELL);
    for (let k = 1; k <= reach; k++) {
      let best: Point | null = null;
      let bestD = Infinity;
      for (let dr = -k; dr <= k; dr++) {
        for (let dc = -k; dc <= k; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== k) continue;
          const c = c0 + dc;
          const r = r0 + dr;
          if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
          const i = r * this.cols + c;
          if (!this.open[i]) continue;
          const p = this.centre(i);
          const d = Math.hypot(p.x - x, p.z - z);
          if (d < bestD) {
            bestD = d;
            best = p;
          }
        }
      }
      if (best) return best;
    }
    return null;
  }

  /**
   * A walkable route from one point to another, as the corners to walk to in order -- the start
   * left out, the goal included -- or null if there is none.
   *
   * A goal on blocked ground is moved to the nearest open cell first, because "go to where the
   * player was standing" is often a point against a wall.
   */
  path(ax: number, az: number, bx: number, bz: number): Point[] | null {
    const startP = this.walkable(ax, az) ? { x: ax, z: az } : this.nearestOpen(ax, az);
    const goalP = this.walkable(bx, bz) ? { x: bx, z: bz } : this.nearestOpen(bx, bz);
    if (!startP || !goalP) return null;
    const start = this.cellOf(startP.x, startP.z);
    const goal = this.cellOf(goalP.x, goalP.z);
    if (this.comp[start] !== this.comp[goal]) return null;
    if (start === goal || this.lineClear(startP.x, startP.z, goalP.x, goalP.z)) return [goalP];

    const stamp = ++this.search;
    const cols = this.cols;
    const gc = goal % cols;
    const gr = (goal - gc) / cols;
    const h = (i: number): number => {
      const c = i % cols;
      const r = (i - c) / cols;
      const dx = Math.abs(c - gc);
      const dz = Math.abs(r - gr);
      return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
    };

    const heap = new MinHeap();
    this.g[start] = 0;
    this.came[start] = -1;
    this.seen[start] = stamp;
    heap.push(start, h(start));
    let expanded = 0;
    let found = false;

    while (heap.size > 0) {
      const i = heap.pop();
      if (this.shut[i] === stamp) continue;
      this.shut[i] = stamp;
      if (i === goal) {
        found = true;
        break;
      }
      if (++expanded > MAX_EXPAND) break;
      const c = i % cols;
      const r = (i - c) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nc = c + dc;
          const nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= cols || nr >= this.rows) continue;
          const j = nr * cols + nc;
          if (!this.open[j] || this.shut[j] === stamp) continue;
          // No cutting a corner: a diagonal step needs both of the cells it passes between.
          if (dr && dc && (!this.open[r * cols + nc] || !this.open[nr * cols + c])) continue;
          const g = this.g[i]! + (dr && dc ? SQRT2 : 1);
          if (this.seen[j] === stamp && g >= this.g[j]!) continue;
          this.seen[j] = stamp;
          this.g[j] = g;
          this.came[j] = i;
          heap.push(j, g + h(j));
        }
      }
    }
    if (!found) return null;

    // Back from the goal, then pulled tight: from each corner, skip ahead to the furthest later
    // cell still in a clear straight line.
    const cells: number[] = [];
    for (let i = goal; i !== -1; i = this.came[i]!) cells.push(i);
    cells.reverse();
    const out: Point[] = [];
    let from = startP;
    let k = 0;
    while (k < cells.length - 1) {
      let far = k + 1;
      for (let m = cells.length - 1; m > k + 1; m--) {
        const p = this.centre(cells[m]!);
        if (this.lineClear(from.x, from.z, p.x, p.z)) {
          far = m;
          break;
        }
      }
      const p = far === cells.length - 1 ? goalP : this.centre(cells[far]!);
      out.push(p);
      from = p;
      k = far;
    }
    if (out.length === 0) out.push(goalP);
    return out;
  }

  /**
   * A lattice of stopping points across the area's main ground, `spacing` apart.
   *
   * The network a prowler wanders -- Brian Walker's arrangement in Brogue, where a monster with
   * nothing to do walks to the nearest waypoint it has not visited yet, and when it has visited
   * them all, forgets and starts again. Each lattice point is moved to the nearest open cell of
   * the main piece of ground, or dropped if there is none close.
   */
  waypoints(spacing = 12): Point[] {
    const out: Point[] = [];
    const w = this.cols * NavGrid.CELL;
    const d = this.rows * NavGrid.CELL;
    for (let z = spacing / 2; z < d; z += spacing) {
      for (let x = spacing / 2; x < w; x += spacing) {
        const p = this.nearestOpen(this.minX + x, this.minZ + z, Math.ceil(spacing / 3));
        if (p && this.componentAt(p.x, p.z) === this.mainComponent) out.push(p);
      }
    }
    return out;
  }
}

/**
 * One mover's route, kept between frames.
 *
 * Plans only when the straight line to where it is going is blocked, and re-plans only when the
 * destination has moved a couple of units and half a second has passed -- a chase re-plans a
 * couple of times a second, not sixty.
 */
export class NavAgent {
  private route: Point[] = [];
  private goalX = Number.NaN;
  private goalZ = Number.NaN;
  private age = Infinity;

  /** Forget the route, so the next ask plans afresh. */
  clear(): void {
    this.route.length = 0;
    this.goalX = Number.NaN;
    this.age = Infinity;
  }

  /**
   * The point to steer at next, going from (x, z) toward (tx, tz). The destination itself when
   * the way is clear; the next corner of a planned route when it is not; the destination again if
   * no route exists, which leaves the collider slide to do what it always did.
   */
  next(nav: NavGrid, x: number, z: number, tx: number, tz: number, dt: number): Point {
    this.age += dt;
    if (nav.lineClear(x, z, tx, tz)) {
      this.route.length = 0;
      return { x: tx, z: tz };
    }
    const moved = !(Math.hypot(tx - this.goalX, tz - this.goalZ) <= 2);
    if (this.route.length === 0 || (moved && this.age > 0.5)) {
      this.route = nav.path(x, z, tx, tz) ?? [];
      this.goalX = tx;
      this.goalZ = tz;
      this.age = 0;
    }
    // Corners already reached are behind us. A corner that has come into straight view early is
    // skipped too: the line past it is clear, so there is nothing left to go round.
    while (this.route.length > 1) {
      const head = this.route[0]!;
      const after = this.route[1]!;
      if (Math.hypot(head.x - x, head.z - z) < 0.6 || nav.lineClear(x, z, after.x, after.z)) this.route.shift();
      else break;
    }
    return this.route[0] ?? { x: tx, z: tz };
  }
}

/** A binary min-heap of cell indices keyed by a float. Just enough for A*. */
class MinHeap {
  private readonly items: number[] = [];
  private readonly keys: number[] = [];

  get size(): number {
    return this.items.length;
  }

  push(item: number, key: number): void {
    const items = this.items;
    const keys = this.keys;
    let i = items.length;
    items.push(item);
    keys.push(key);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      items[i] = items[p]!;
      keys[i] = keys[p]!;
      i = p;
    }
    items[i] = item;
    keys[i] = key;
  }

  pop(): number {
    const items = this.items;
    const keys = this.keys;
    const top = items[0]!;
    const lastItem = items.pop()!;
    const lastKey = keys.pop()!;
    const n = items.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r]! < keys[l]! ? r : l;
        if (keys[c]! >= lastKey) break;
        items[i] = items[c]!;
        keys[i] = keys[c]!;
        i = c;
      }
      items[i] = lastItem;
      keys[i] = lastKey;
    }
    return top;
  }
}
