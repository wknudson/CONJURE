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

export class IsoCamera {
  origin: ScreenPoint = { x: 0, y: 0 };
  zoom = 1;
  rotationStep: 0 | 1 | 2 | 3 = 0;
  /** True when the viewport is too small to show the board at a readable size. */
  tooSmall = false;
  shake: ScreenPoint = { x: 0, y: 0 };

  constructor(
    public gridW: number,
    public gridH: number,
  ) {}

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

    // Two extra virtual rows of depth: one for each Commander line.
    const boardW = (this.gridW + this.gridH) * (TILE_W / 2);
    const boardH = (this.gridW + this.gridH + 2.6) * (TILE_H / 2);

    // Clamped at the bottom: below this the board is drawn but unreadable, and it is
    // better to overflow slightly and let the player scroll or enlarge the window than
    // to render tiles too small to aim at. `tooSmall` lets the UI say so.
    const ideal = Math.min(availW / boardW, availH / boardH, 1.05);
    this.zoom = Math.max(ideal, MIN_READABLE_ZOOM);
    this.tooSmall = ideal < MIN_READABLE_ZOOM;

    // Centre the diamond: its widest point is at the middle of the two axes.
    const centre = this.rawCentre();
    this.origin = {
      x: canvasW / 2 - centre.x,
      y: topMargin + availH / 2 - centre.y,
    };
  }

  private rawCentre(): ScreenPoint {
    const [rx, ry] = this.rot(this.gridW / 2, this.gridH / 2);
    return {
      x: (rx - ry) * (this.tileW / 2),
      y: (rx + ry) * (this.tileH / 2),
    };
  }

  private rot(gx: number, gy: number): [number, number] {
    const nx = this.gridW - 1;
    const ny = this.gridH - 1;
    switch (this.rotationStep) {
      case 0:
        return [gx, gy];
      case 1:
        return [gy, nx - gx];
      case 2:
        return [nx - gx, ny - gy];
      case 3:
        return [ny - gy, gx];
    }
  }

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
