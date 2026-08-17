/**
 * Isometric projection: a classic 2:1 diamond.
 *
 * All world<->screen math routes through here, including a quantised `rotationStep`.
 * The demo ships locked at 0, but keeping the seam means enabling 90-degree rotation
 * later is a small change rather than a rewrite of picking and depth sorting.
 */

import type { Coord } from '../contract/ids.js';

export const TILE_W = 116;
export const TILE_H = 58;

export interface ScreenPoint {
  x: number;
  y: number;
}

/** Below roughly this, tiles are too small to read or click accurately. */
const MIN_READABLE_ZOOM = 0.45;

/** How far beyond each end of the grid the Commander models stand, in tiles. */
export const COMMANDER_MARGIN = 1.35;

export class IsoCamera {
  origin: ScreenPoint = { x: 0, y: 0 };
  zoom = 1;
  rotationStep: 0 | 1 | 2 | 3 = 0;
  /** True when the viewport is too small to show the board at a readable size. */
  tooSmall = false;
  shake: ScreenPoint = { x: 0, y: 0 };

  /**
   * Visual-only rotation in progress, in radians.
   *
   * The logical `rotationStep` flips instantly — depth sorting and tile picking stay on
   * whole quarter-turns and never see an in-between state. What animates is the drawing:
   * the renderer spins the finished image about the board centre, so the transition looks
   * continuous while every calculation behind it stays discrete.
   */
  spin = 0;

  constructor(
    public gridW: number,
    public gridH: number,
  ) {}

  /** True while a turn is animating, which is when input should ignore the board. */
  get spinning(): boolean {
    return this.spin !== 0;
  }

  /** Quarter-turns, wrapping in both directions. */
  rotateBy(steps: number): void {
    this.rotationStep = (((this.rotationStep + steps) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
  }

  get tileW(): number {
    return TILE_W * this.zoom;
  }

  get tileH(): number {
    return TILE_H * this.zoom;
  }

  worldToScreen(gx: number, gy: number, elevPx = 0): ScreenPoint {
    const [rx, ry] = this.rot(gx, gy);
    return {
      x: this.origin.x + (rx - ry) * (this.tileW / 2) + this.shake.x,
      y: this.origin.y + (rx + ry) * (this.tileH / 2) - elevPx + this.shake.y,
    };
  }

  /** Centre point of a tile's diamond top face. */
  tileCenter(c: Coord, elevPx = 0): ScreenPoint {
    return this.worldToScreen(c.x + 0.5, c.y + 0.5, elevPx);
  }

  /** Screen pixel -> grid tile, or null when the point is off the board. */
  screenToTile(sx: number, sy: number): Coord | null {
    const dx = (sx - this.origin.x - this.shake.x) / (this.tileW / 2);
    const dy = (sy - this.origin.y - this.shake.y) / (this.tileH / 2);
    const rx = Math.floor((dy + dx) / 2);
    const ry = Math.floor((dy - dx) / 2);
    const [gx, gy] = this.unrot(rx, ry);
    if (gx < 0 || gy < 0 || gx >= this.gridW || gy >= this.gridH) return null;
    return { x: gx, y: gy };
  }

  /**
   * Painter's-algorithm depth key. Sorting by the entity's viewer-nearest occupied cell
   * places a 2x2 Behemoth correctly against 1x1s both in front of and behind it.
   */
  depthKey(cells: Coord[]): number {
    let best = -Infinity;
    let bestY = 0;
    for (const c of cells) {
      const [rx, ry] = this.rot(c.x, c.y);
      const d = rx + ry;
      if (d > best) {
        best = d;
        bestY = ry;
      }
    }
    return best * 1000 + bestY;
  }

  /**
   * Fits the board into the canvas, leaving room for the Commander models that stand
   * one row beyond each end of the grid.
   */
  fit(canvasW: number, canvasH: number): void {
    const topMargin = canvasH * 0.11;
    const bottomMargin = canvasH * 0.28;
    const availH = canvasH - topMargin - bottomMargin;
    const availW = canvasW * 0.92;

    // Measured from the projected corners rather than derived from the grid dimensions.
    // Rotating a non-square board changes its screen footprint, and rotating the *centre*
    // point is not the same as the centre of the rotated *extent* — that discrepancy put
    // the board half a tile off at 90 and 270 degrees.
    const extent = this.extentAtUnitZoom();

    const ideal = Math.min(availW / extent.width, availH / extent.height, 1.05);
    // Clamped at the bottom: below this the board is drawn but unreadable, and it is
    // better to overflow slightly and let the player enlarge the window than to render
    // tiles too small to aim at. `tooSmall` lets the UI say so.
    this.zoom = Math.max(ideal, MIN_READABLE_ZOOM);
    this.tooSmall = ideal < MIN_READABLE_ZOOM;

    // The extent was measured at zoom 1, so scale it before centring.
    this.origin = {
      x: canvasW / 2 - (extent.midX * this.zoom),
      y: topMargin + availH / 2 - (extent.midY * this.zoom),
    };
  }

  /**
   * Screen bounding box of everything that must stay visible, at zoom 1 and without the
   * origin applied: the four board corners plus the Commander lines that sit just beyond
   * each end of the grid.
   */
  private extentAtUnitZoom(): { width: number; height: number; midX: number; midY: number } {
    const points: ScreenPoint[] = [];
    const project = (gx: number, gy: number): void => {
      const [rx, ry] = this.rot(gx, gy);
      points.push({ x: (rx - ry) * (TILE_W / 2), y: (rx + ry) * (TILE_H / 2) });
    };

    for (const [gx, gy] of [
      [0, 0],
      [this.gridW, 0],
      [this.gridW, this.gridH],
      [0, this.gridH],
      // The Commander rows, which live outside the grid on both ends.
      [this.gridW / 2, -COMMANDER_MARGIN],
      [this.gridW / 2, this.gridH + COMMANDER_MARGIN],
    ] as const) {
      project(gx, gy);
    }

    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    return {
      width: maxX - minX,
      height: maxY - minY,
      midX: (minX + maxX) / 2,
      midY: (minY + maxY) / 2,
    };
  }

  /**
   * Rotates a *continuous* board position.
   *
   * Reflection is about the board's extent (`gridW`, `gridH`), not its last index. A
   * point at x = 0 sits on the board's edge, so its mirror is the opposite edge at
   * x = gridW — mirroring about `gridW - 1` instead would shift everything half a tile
   * and put tile centres on tile boundaries.
   */
  private rot(gx: number, gy: number): [number, number] {
    const w = this.gridW;
    const h = this.gridH;
    switch (this.rotationStep) {
      case 0:
        return [gx, gy];
      case 1:
        return [gy, w - gx];
      case 2:
        return [w - gx, h - gy];
      case 3:
        return [h - gy, gx];
    }
  }

  /**
   * Rotates a *tile index* back to board space.
   *
   * The counterpart to `rot`, and deliberately not its mirror image: an index identifies
   * a whole tile rather than a point, so it reflects about the last index (`gridW - 1`).
   * Tile 0 spans [0, 1) and its mirror is the tile spanning [w-1, w), which is index
   * w - 1 — using the extent here would land one tile past the edge.
   */
  private unrot(rx: number, ry: number): [number, number] {
    const nx = this.gridW - 1;
    const ny = this.gridH - 1;
    switch (this.rotationStep) {
      case 0:
        return [rx, ry];
      case 1:
        return [nx - ry, rx];
      case 2:
        return [nx - rx, ny - ry];
      case 3:
        return [ry, ny - rx];
    }
  }
}
