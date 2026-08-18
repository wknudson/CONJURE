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
  /**
   * Free rotation in radians, added on top of the quarter-turn steps.
   *
   * Unlike `spin`, which only tilts the finished image, this is part of the projection:
   * picking, framing and depth sorting all see it, so the board can sit at any angle and
   * still be clicked accurately. Quarter-turns remain a separate quantised value so that
   * Q/E keeps snapping to clean orientations rather than drifting off them.
   */
  continuousRotation = 0;
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

  /** Everything the board is turned by: quarter-turn steps plus any free rotation. */
  get angle(): number {
    return this.rotationStep * (Math.PI / 2) + this.continuousRotation;
  }

  /** True once the board has been turned off its quarter-turn grid. */
  get freeRotated(): boolean {
    return this.continuousRotation !== 0;
  }

  /** Quarter-turns, wrapping in both directions. */
  rotateBy(steps: number): void {
    this.rotationStep = (((this.rotationStep + steps) % 4) + 4) % 4 as 0 | 1 | 2 | 3;
  }

  /**
   * Drops the free rotation back onto the nearest quarter-turn.
   *
   * Snapping matters because the quantised orientations are the ones the art was drawn
   * for: at a clean angle the diamonds line up with the tile sprites, and a Behemoth's
   * silhouette reads as a box rather than as a lozenge.
   */
  snapToNearestStep(): void {
    const quarters = Math.round(this.angle / (Math.PI / 2));
    this.rotationStep = (((quarters % 4) + 4) % 4) as 0 | 1 | 2 | 3;
    this.continuousRotation = 0;
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

  /**
   * Screen pixel -> grid tile, or null when the point is off the board.
   *
   * Note the order: the projection is undone in *continuous* space and only rounded down
   * to a tile at the very end. Rounding first and then un-rotating whole indices — which
   * is what this did while rotation was limited to quarter-turns — only lands on the
   * right tile when the turn is a multiple of 90 degrees. At 47 degrees a tile's screen
   * diamond straddles several index cells, and flooring early picks one of its neighbours.
   */
  screenToTile(sx: number, sy: number): Coord | null {
    const dx = (sx - this.origin.x - this.shake.x) / (this.tileW / 2);
    const dy = (sy - this.origin.y - this.shake.y) / (this.tileH / 2);
    const [fx, fy] = this.unrot((dy + dx) / 2, (dy - dx) / 2);

    const gx = Math.floor(fx);
    const gy = Math.floor(fy);
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
    // Free rotation is measured against the circle the board sweeps out rather than the
    // box it happens to occupy right now. Measuring the current box would be tighter, but
    // the box grows and shrinks as the board turns, so the zoom would pulse under the
    // player's hand while they dragged — the board appearing to breathe is far worse than
    // a little unused margin at the clean angles.
    if (this.freeRotated) return this.sweptExtentAtUnitZoom();

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
   * The screen box the board fits inside at *every* angle, so the zoom holds still while
   * it turns.
   *
   * Whatever the angle, no part of the board escapes the circle of radius `r` about its
   * centre. Projecting that circle gives an ellipse whose extremes are r·√2 tiles across
   * and r·√2 tiles down — the √2 being what the isometric skew adds when the circle is
   * squashed onto the diamond. The centre itself is the one point rotation cannot move,
   * so it doubles as the framing midpoint.
   */
  private sweptExtentAtUnitZoom(): {
    width: number;
    height: number;
    midX: number;
    midY: number;
  } {
    const cx = this.gridW / 2;
    const cy = this.gridH / 2;
    // The Commanders stand beyond the ends of the grid and turn with it, so they set the
    // radius rather than the board's own corners.
    const r = Math.hypot(cx, cy + COMMANDER_MARGIN) * Math.SQRT2;

    return {
      width: r * TILE_W,
      height: r * TILE_H,
      midX: (cx - cy) * (TILE_W / 2),
      midY: (cx + cy) * (TILE_H / 2),
    };
  }

  /**
   * Turns a board position about the board's centre.
   *
   * The pivot is the physical middle of the grid — (w/2, h/2) — rather than a corner or
   * the origin, which is what makes the board appear to spin on a turntable instead of
   * swinging around one edge. Every projected point goes through here, so the framing,
   * the picking and the depth order all agree on where the board is pointing.
   *
   * The old quarter-turn table did the same thing by hand for four fixed angles; this is
   * that generalised, and reduces to the same rotations at multiples of 90 degrees.
   */
  private rot(gx: number, gy: number): [number, number] {
    const a = this.angle;
    if (a === 0) return [gx, gy];

    const cx = this.gridW / 2;
    const cy = this.gridH / 2;
    const dx = gx - cx;
    const dy = gy - cy;
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }

  /** The exact inverse of `rot`, for turning a screen hit back into a board position. */
  private unrot(rx: number, ry: number): [number, number] {
    const a = this.angle;
    if (a === 0) return [rx, ry];

    const cx = this.gridW / 2;
    const cy = this.gridH / 2;
    const dx = rx - cx;
    const dy = ry - cy;
    const cos = Math.cos(-a);
    const sin = Math.sin(-a);
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  }
}
