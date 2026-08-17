import { describe, expect, it } from 'vitest';
import { IsoCamera } from '../render/IsoCamera.js';

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
