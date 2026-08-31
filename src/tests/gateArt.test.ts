/**
 * What the gate says about itself.
 *
 * `docs/worldbuild-todo.md` carried *"the mesh is still a sealed warded gate"* from Wave 5 to
 * Wave 13, and the reason it survived that long is that nothing could see it. A texture is drawn
 * by a couple of dozen `fillRect` calls into a canvas that only exists in a browser, so it is the
 * one part of this codebase where being wrong is completely invisible — no type catches it, no
 * test touched it, and reading the calls tells you the colours and not the picture.
 *
 * It turns out a canvas is a very small interface. `makeCanvas` wants `fillStyle` and `fillRect`
 * and nothing else, so a stub that records rectangles into a grid renders the drawing exactly,
 * under node, and the composition becomes something that can be asserted about.
 *
 * What is asserted here is only what the gate has to *mean*: you can see through it, it is in two
 * halves, it has hinges and a latch, and nothing on it glows. Not where any particular pixel is —
 * that would be a test that has to be rewritten every time somebody improves the drawing, which
 * is the opposite of useful.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const W = 32;
const H = 24;

/** The drawing, as a grid of colour strings. `null` is transparent. */
let grid: (string | null)[][] = [];

beforeEach(() => {
  grid = Array.from({ length: H }, () => Array<string | null>(W).fill(null));
  const ctx = {
    fillStyle: '#000000',
    imageSmoothingEnabled: true,
    fillRect(x: number, y: number, w: number, h: number) {
      for (let j = Math.round(y); j < Math.round(y + h); j++) {
        for (let i = Math.round(x); i < Math.round(x + w); i++) {
          if (grid[j] && i >= 0 && i < W) grid[j]![i] = String(ctx.fillStyle);
        }
      }
    },
  };
  (globalThis as unknown as { document: unknown }).document = {
    createElement: () => ({ width: 0, height: 0, getContext: () => ctx }),
  };
});

afterEach(() => {
  delete (globalThis as unknown as { document?: unknown }).document;
});

async function drawGate(): Promise<void> {
  const { makeGateTexture } = await import('../district/textures.js');
  makeGateTexture();
}

const column = (x: number): (string | null)[] => grid.map((row) => row[x] ?? null);
const clear = (px: (string | null)[]): number => px.filter((p) => p === null).length;

/** Everything painted, as `rgb(r,g,b)` or `#rrggbb`, normalised to channels. */
function channels(c: string): [number, number, number] {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = c.match(/\d+/g)!.map(Number);
  return [m[0]!, m[1]!, m[2]!];
}

describe('the gate reads as passable', () => {
  it('can be seen through', async () => {
    await drawGate();
    // Most of what makes a gate not a door. The bars have gaps and the gaps are transparent, so
    // the road on the other side shows — which is why a player believes there is a road.
    const painted = grid.flat().filter((p) => p !== null).length;
    const open = grid.flat().length - painted;
    expect(open / grid.flat().length, 'you cannot see the road through it').toBeGreaterThan(0.25);
  });

  it('is in two halves, with a seam that runs the whole height', async () => {
    // The single thing that separates a gate from a railing, and the first version of this test
    // did **not** separate them: it asked whether some middle column was mostly clear, which the
    // old sealed drawing passed by accident because the gaps between its bars are mostly clear
    // too. A test that accepts the thing it exists to reject is worse than no test.
    //
    // What actually distinguishes a seam from a bar gap is the **rails**. A leaf's rails run the
    // full width of that leaf, so every ordinary gap is closed at the rail heights. The seam is
    // the one column that is open all the way down — because it is the space between two
    // separate objects.
    await drawGate();
    const railRows = [4, 19];
    const openThrough = Array.from({ length: W }, (_, x) => x).filter((x) =>
      railRows.every((y) => grid[y]![x] === null),
    );
    expect(openThrough.length, 'nothing is open through the rails; this is one panel').toBeGreaterThan(0);
    expect(openThrough.length, 'too much of it is open to be a seam').toBeLessThan(4);
    for (const x of openThrough) {
      expect(Math.abs(x - W / 2), 'the seam is not where two leaves would meet').toBeLessThan(3);
    }
  });

  it('has hinge straps, not just thicker bars at the edges', async () => {
    // The other one that passed by accident. Asking whether the edge columns are more solid than
    // the middle is answered "yes" by any railing whose outermost bar happens to sit at the edge.
    //
    // A strap is a *horizontal* run of iron bolted across the leaf at the hanging side, at a
    // height where the rest of that leaf is open. That shape cannot occur in a field of vertical
    // bars, which is exactly why it is what says the thing swings.
    await drawGate();
    const strapAt = (x0: number, y: number): boolean => {
      for (let x = x0; x < x0 + 5; x++) if (grid[y]![x] === null) return false;
      // ...and the leaf is not simply solid at this height, which would make it a rail.
      return grid[y]!.slice(6, 12).some((p) => p === null);
    };
    const rows = Array.from({ length: H }, (_, y) => y);
    const left = rows.filter((y) => strapAt(0, y));
    const right = rows.filter((y) => strapAt(W - 5, y));
    expect(left.length, 'the left leaf has no hinge straps').toBeGreaterThanOrEqual(2);
    expect(right.length, 'the right leaf has no hinge straps').toBeGreaterThanOrEqual(2);
  });

  it('carries a latch where the ward used to be', async () => {
    await drawGate();
    // The whole content of this change. A latch is a thing a person operates; a ward is Magistracy
    // business and not yours. It sits across the seam at about the height of a hand.
    const brass = grid
      .flatMap((row, y) => row.map((c, x) => ({ c, x, y })))
      .filter(({ c }) => {
        if (!c) return false;
        const [r, g, b] = channels(c);
        return r > 140 && g > 110 && b < r - 40; // warm metal, not iron and not timber
      });
    expect(brass.length, 'nothing on it is brass').toBeGreaterThan(4);
    const mid = brass.filter((p) => p.y > H * 0.35 && p.y < H * 0.65);
    expect(mid.length, 'the latch is not at hand height').toBeGreaterThan(4);
    const spans = brass.some((p) => p.x < 15) && brass.some((p) => p.x > 16);
    expect(spans, 'the latch does not reach across the seam').toBe(true);
  });

  it('has nothing on it that glows', async () => {
    await drawGate();
    // The old drawing pinned a cyan ward at the centre, and that one detail was the whole
    // problem: it said sealed by somebody else. Anything this saturated and this cold on a gate
    // is a ward, and there are no wards on it now.
    const warded = grid.flat().filter((c) => {
      if (!c) return false;
      const [r, g, b] = channels(c);
      return b > 150 && g > 150 && r < 120; // the cyan family
    });
    expect(warded, 'something on the gate is warded').toHaveLength(0);
  });

  it('is not drawn ajar, because the collider is not', async () => {
    await drawGate();
    // The lie that would have replaced the old one. `world.ts` spans the whole eight-unit opening
    // with a collider, so a gate drawn standing open would be a picture the player walks into.
    // The seam is a seam; it is not a gap you could pass through.
    const gapColumns = Array.from({ length: W }, (_, x) => x).filter(
      (x) => clear(column(x)) > H * 0.85,
    );
    expect(gapColumns.length, 'there is a hole in it wide enough to look like a way through')
      .toBeLessThan(3);
  });
});
