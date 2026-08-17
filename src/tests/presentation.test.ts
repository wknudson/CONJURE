import { describe, expect, it } from 'vitest';
import { COMMANDER_MARGIN, IsoCamera } from '../render/IsoCamera.js';

/**
 * Presentation-layer guards. These are not about rules — they are about the demo staying
 * legible when the window is awkward or a turn produces a flood of events.
 */
describe('camera fit', () => {
  it('flags a viewport too small to render a readable board', () => {
    const cam = new IsoCamera(8, 8);
    cam.fit(340, 260);

    expect(cam.tooSmall, 'a 340px pane cannot show an 8x8 board legibly').toBe(true);
    // Clamped rather than shrunk to nothing, so the board is still usable.
    expect(cam.zoom).toBeGreaterThanOrEqual(0.45);
  });

  it('is content at a normal desktop size', () => {
    const cam = new IsoCamera(8, 8);
    cam.fit(1600, 950);

    expect(cam.tooSmall).toBe(false);
    expect(cam.zoom).toBeGreaterThan(0.9);
  });

  it('keeps a smaller arena readable where a larger one would not be', () => {
    const small = new IsoCamera(6, 8);
    const large = new IsoCamera(10, 10);
    small.fit(900, 620);
    large.fit(900, 620);

    expect(small.zoom).toBeGreaterThan(large.zoom);
  });

  it('round-trips tile picking at the clamped minimum zoom', () => {
    // The clamp must not break the inverse projection, or clicks would land on the
    // wrong tile precisely when the board is hardest to hit.
    const cam = new IsoCamera(8, 8);
    cam.fit(340, 260);

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = cam.tileCenter({ x, y });
        expect(cam.screenToTile(p.x, p.y)).toEqual({ x, y });
      }
    }
  });
});

describe('board rotation', () => {
  it('round-trips every tile at all four quarter-turns', () => {
    // Picking must stay exact after rotation, or clicks land on the wrong tile in
    // precisely the orientations a player reaches for to see round an obstacle.
    for (const step of [0, 1, 2, 3] as const) {
      const cam = new IsoCamera(6, 8);
      cam.rotationStep = step;
      cam.fit(1400, 900);

      for (let y = 0; y < 8; y++) {
        for (let x = 0; x < 6; x++) {
          const p = cam.tileCenter({ x, y });
          expect(cam.screenToTile(p.x, p.y), `step ${step} tile ${x},${y}`).toEqual({ x, y });
        }
      }
    }
  });

  it('keeps the whole board and both Commander lines on screen at every step', () => {
    for (const step of [0, 1, 2, 3] as const) {
      const cam = new IsoCamera(6, 8);
      cam.rotationStep = step;
      cam.fit(1400, 900);

      const points = [
        cam.worldToScreen(0, 0),
        cam.worldToScreen(6, 0),
        cam.worldToScreen(6, 8),
        cam.worldToScreen(0, 8),
        // The Commander rows sit outside the grid on both ends.
        cam.worldToScreen(3, -COMMANDER_MARGIN),
        cam.worldToScreen(3, 8 + COMMANDER_MARGIN),
      ];

      for (const p of points) {
        expect(p.x, `step ${step} x`).toBeGreaterThanOrEqual(0);
        expect(p.x, `step ${step} x`).toBeLessThanOrEqual(1400);
        expect(p.y, `step ${step} y`).toBeGreaterThanOrEqual(0);
        expect(p.y, `step ${step} y`).toBeLessThanOrEqual(900);
      }
    }
  });

  it('centres a non-square board consistently however it is turned', () => {
    // Rotating the midpoint is not the same as the midpoint of the rotated extent; that
    // difference used to push the board off-centre at 90 and 270 degrees.
    const centres = ([0, 1, 2, 3] as const).map((step) => {
      const cam = new IsoCamera(6, 8);
      cam.rotationStep = step;
      cam.fit(1400, 900);
      const corners = [
        cam.worldToScreen(0, 0),
        cam.worldToScreen(6, 0),
        cam.worldToScreen(6, 8),
        cam.worldToScreen(0, 8),
      ];
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
    });

    for (const c of centres) {
      expect(Math.abs(c.x - centres[0]!.x)).toBeLessThan(1);
      expect(Math.abs(c.y - centres[0]!.y)).toBeLessThan(1);
    }
  });

  it('wraps quarter-turns in both directions', () => {
    const cam = new IsoCamera(6, 6);
    cam.rotateBy(1);
    expect(cam.rotationStep).toBe(1);
    cam.rotateBy(-2);
    expect(cam.rotationStep).toBe(3);
    cam.rotateBy(1);
    expect(cam.rotationStep).toBe(0);
  });
});
