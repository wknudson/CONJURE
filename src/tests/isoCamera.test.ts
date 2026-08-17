import { describe, expect, it } from 'vitest';
import { IsoCamera } from '../render/IsoCamera.js';
import { cellsAt } from '../core/util/grid.js';

/**
 * Projection and picking must round-trip exactly, or clicks land on the wrong tile —
 * the single most player-visible way an isometric board can be broken.
 */
describe('IsoCamera', () => {
  const cam = () => {
    const c = new IsoCamera(5, 5);
    c.fit(1280, 720);
    return c;
  };

  it('round-trips every tile through worldToScreen and screenToTile', () => {
    const c = cam();
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        const centre = c.tileCenter({ x, y });
        const back = c.screenToTile(centre.x, centre.y);
        expect(back, `tile ${x},${y}`).toEqual({ x, y });
      }
    }
  });

  it('returns null for points outside the board', () => {
    const c = cam();
    expect(c.screenToTile(-500, -500)).toBeNull();
    expect(c.screenToTile(5000, 5000)).toBeNull();
  });

  it('keeps the whole board inside the canvas', () => {
    const c = cam();
    for (let y = 0; y <= 5; y++) {
      for (let x = 0; x <= 5; x++) {
        const p = c.worldToScreen(x, y);
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(1280);
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThan(720);
      }
    }
  });

  it('sorts nearer tiles after farther ones', () => {
    const c = cam();
    const back = c.depthKey(cellsAt({ x: 2, y: 0 }, 1));
    const front = c.depthKey(cellsAt({ x: 2, y: 4 }, 1));
    expect(front).toBeGreaterThan(back);
  });

  it('sorts a 2x2 Behemoth by its viewer-nearest cell', () => {
    const c = cam();
    // Behemoth at (1,1) covers rows 1-2. A minion at row 3 is in front of it;
    // a minion at row 0 is behind it.
    const behemoth = c.depthKey(cellsAt({ x: 1, y: 1 }, 2));
    const inFront = c.depthKey(cellsAt({ x: 1, y: 3 }, 1));
    const behind = c.depthKey(cellsAt({ x: 1, y: 0 }, 1));

    expect(inFront).toBeGreaterThan(behemoth);
    expect(behemoth).toBeGreaterThan(behind);
  });

  /**
   * Rotation reflects continuous positions about the board *extent* but tile indices
   * about the *last index* — a distinction that vanishes on a square board and is
   * invisible in play until a click at 90 degrees lands one tile out. A non-square
   * board is the only shape that can catch it, so it gets its own coverage.
   */
  it('round-trips every tile of a non-square board at every rotation', () => {
    const c = new IsoCamera(4, 7);
    c.fit(1280, 720);

    for (const step of [0, 1, 2, 3] as const) {
      c.rotationStep = step;
      c.fit(1280, 720);
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 4; x++) {
          const centre = c.tileCenter({ x, y });
          expect(c.screenToTile(centre.x, centre.y), `tile ${x},${y} at step ${step}`).toEqual({
            x,
            y,
          });
        }
      }
    }
  });

  it('frames a non-square board inside the canvas at every rotation', () => {
    const c = new IsoCamera(4, 7);
    for (const step of [0, 1, 2, 3] as const) {
      c.rotationStep = step;
      c.fit(1280, 720);
      for (let y = 0; y <= 7; y++) {
        for (let x = 0; x <= 4; x++) {
          const p = c.worldToScreen(x, y);
          expect(p.x, `x of ${x},${y} at step ${step}`).toBeGreaterThan(0);
          expect(p.x).toBeLessThan(1280);
          expect(p.y, `y of ${x},${y} at step ${step}`).toBeGreaterThan(0);
          expect(p.y).toBeLessThan(720);
        }
      }
    }
  });

  it('keeps picking correct after a resize', () => {
    const c = new IsoCamera(6, 6);
    c.fit(800, 600);
    const centre = c.tileCenter({ x: 4, y: 1 });
    expect(c.screenToTile(centre.x, centre.y)).toEqual({ x: 4, y: 1 });

    c.fit(1600, 900);
    const moved = c.tileCenter({ x: 4, y: 1 });
    expect(c.screenToTile(moved.x, moved.y)).toEqual({ x: 4, y: 1 });
  });
});
