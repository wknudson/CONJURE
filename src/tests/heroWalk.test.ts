/**
 * The Commander's walk: the placeholder bob, and the frame system waiting on art.
 *
 * Everything here is the arithmetic, deliberately. The bob is verified by recording the
 * transforms it asks the canvas for rather than by looking at pixels, and the frame picker
 * is pure. Neither needs a DOM, a decode, or a file on disk — which is what lets the naming
 * convention be pinned down before a single frame has been drawn to it.
 */
import { describe, expect, it } from 'vitest';
import {
  COMMANDER_HEIGHT_TILES,
  WALK_FRAMES,
  WALK_FRAME_MS,
  commanderSpriteSrc,
  commanderWalkSrc,
  drawCommander,
  walkFrameAt,
  type WalkCycle,
} from '../render/sprites.js';

interface Call {
  op: string;
  a: number;
  b?: number;
}

/** A canvas that records what it was asked to do instead of doing it. */
function spyCtx(): { ctx: CanvasRenderingContext2D; calls: Call[] } {
  const calls: Call[] = [];
  const ctx = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    save: () => calls.push({ op: 'save', a: 0 }),
    restore: () => calls.push({ op: 'restore', a: 0 }),
    rotate: (r: number) => calls.push({ op: 'rotate', a: r }),
    translate: (x: number, y: number) => calls.push({ op: 'translate', a: x, b: y }),
    drawImage: () => calls.push({ op: 'drawImage', a: 0 }),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

/** A stand-in bitmap. Only the aspect is ever read. */
const IMG = { width: 200, height: 300 } as unknown as HTMLImageElement;

const rotateOf = (c: Call[]): number => c.find((k) => k.op === 'rotate')?.a ?? 0;
const riseOf = (c: Call[]): number => -(c.find((k) => k.op === 'translate')?.b ?? 0);

describe('the placeholder walk', () => {
  it('draws a still figure untouched when no gait is given', () => {
    const { ctx, calls } = spyCtx();
    drawCommander(ctx, 40, IMG);
    // No transform at all: the figure the creation screen has always drawn.
    expect(calls.map((c) => c.op)).toEqual(['drawImage']);
  });

  it('treats an absent gait and a null gait the same', () => {
    const a = spyCtx();
    const b = spyCtx();
    drawCommander(a.ctx, 40, IMG);
    drawCommander(b.ctx, 40, IMG, null);
    expect(a.calls.map((c) => c.op)).toEqual(b.calls.map((c) => c.op));
  });

  it('still draws nothing at all while the sprite is loading', () => {
    const { ctx, calls } = spyCtx();
    drawCommander(ctx, 40, null, { phase: 0.5, lean: 1 });
    expect(calls).toEqual([]);
  });

  it('plants the body on the ground at each footfall', () => {
    // Whole phases are the moment a foot lands, and a walk that floats at the footfall is
    // a walk that never touches the pavement.
    for (const phase of [0, 1, 2, 17]) {
      const { ctx, calls } = spyCtx();
      drawCommander(ctx, 40, IMG, { phase });
      expect(riseOf(calls)).toBeCloseTo(0, 6);
    }
  });

  it('lifts the body between footfalls, and never below the ground', () => {
    const { ctx, calls } = spyCtx();
    drawCommander(ctx, 40, IMG, { phase: 0.5 });
    const peak = riseOf(calls);
    expect(peak).toBeGreaterThan(0);

    // Sampled across two full strides: always a lift, never a sink.
    for (let p = 0; p <= 2; p += 1 / 32) {
      const s = spyCtx();
      drawCommander(s.ctx, 40, IMG, { phase: p });
      expect(riseOf(s.calls)).toBeGreaterThanOrEqual(-1e-9);
      expect(riseOf(s.calls)).toBeLessThanOrEqual(peak + 1e-9);
    }
  });

  it('scales the bob with the figure, so it reads the same at every zoom', () => {
    const small = spyCtx();
    const big = spyCtx();
    drawCommander(small.ctx, 40, IMG, { phase: 0.5 });
    drawCommander(big.ctx, 120, IMG, { phase: 0.5 });
    expect(riseOf(big.calls) / riseOf(small.calls)).toBeCloseTo(3, 6);
  });

  it('keeps the bob subtle — a fraction of the body, not a hop', () => {
    const { ctx, calls } = spyCtx();
    drawCommander(ctx, 40, IMG, { phase: 0.5 });
    const bodyHeight = 40 * COMMANDER_HEIGHT_TILES;
    expect(riseOf(calls) / bodyHeight).toBeLessThan(0.03);
  });

  it('leans into the direction of travel and mirrors it going the other way', () => {
    // Sampled at a whole phase so the sway term is zero and only the lean is left.
    const right = spyCtx();
    const left = spyCtx();
    drawCommander(right.ctx, 40, IMG, { phase: 1, lean: 1 });
    drawCommander(left.ctx, 40, IMG, { phase: 1, lean: -1 });
    expect(rotateOf(right.calls)).toBeGreaterThan(0);
    expect(rotateOf(left.calls)).toBeCloseTo(-rotateOf(right.calls), 9);
  });

  it('leans less when travelling slower', () => {
    const fast = spyCtx();
    const slow = spyCtx();
    drawCommander(fast.ctx, 40, IMG, { phase: 1, lean: 1 });
    drawCommander(slow.ctx, 40, IMG, { phase: 1, lean: 0.25 });
    expect(Math.abs(rotateOf(slow.calls))).toBeLessThan(Math.abs(rotateOf(fast.calls)));
  });

  it('hinges at the feet, rotating before it lifts', () => {
    // A lean applied after the lift would swing the body about a point in mid-air.
    const { ctx, calls } = spyCtx();
    drawCommander(ctx, 40, IMG, { phase: 0.5, lean: 1 });
    expect(calls.map((c) => c.op)).toEqual(['save', 'rotate', 'translate', 'drawImage', 'restore']);
  });

  it('balances the transform stack', () => {
    const { ctx, calls } = spyCtx();
    drawCommander(ctx, 40, IMG, { phase: 0.3, lean: 0.8 });
    expect(calls.filter((c) => c.op === 'save')).toHaveLength(1);
    expect(calls.filter((c) => c.op === 'restore')).toHaveLength(1);
  });
});

describe('the walk-cycle frame system', () => {
  const frames = Array.from(
    { length: WALK_FRAMES },
    (_u, n) => ({ id: n }) as unknown as HTMLImageElement,
  );
  const cycle: WalkCycle = { frames, frameMs: WALK_FRAME_MS, loops: true };

  it('names frames as an extension of the standing convention', () => {
    // The standing file stays the idle pose, and its name stays the prefix — so anything
    // globbing a bearing keeps finding both.
    expect(commanderSpriteSrc('male', 'side')).toBe('/assets/sprites/hero-male-side.png');
    expect(commanderWalkSrc('male', 'side', 0)).toBe('/assets/sprites/hero-male-side-walk-0.png');
    expect(commanderWalkSrc('female', 'front', 3)).toBe(
      '/assets/sprites/hero-female-front-walk-3.png',
    );
  });

  it('holds each frame for its duration, in order', () => {
    for (let n = 0; n < WALK_FRAMES; n++) {
      expect(walkFrameAt(cycle, n * WALK_FRAME_MS)).toBe(frames[n]);
      expect(walkFrameAt(cycle, n * WALK_FRAME_MS + WALK_FRAME_MS - 1)).toBe(frames[n]);
    }
  });

  it('loops back to the first frame after a full stride', () => {
    const stride = WALK_FRAMES * WALK_FRAME_MS;
    expect(walkFrameAt(cycle, stride)).toBe(frames[0]);
    expect(walkFrameAt(cycle, stride * 9 + WALK_FRAME_MS)).toBe(frames[1]);
  });

  it('holds the last frame forever when it does not loop', () => {
    const once: WalkCycle = { ...cycle, loops: false };
    const stride = WALK_FRAMES * WALK_FRAME_MS;
    expect(walkFrameAt(once, stride)).toBe(frames[WALK_FRAMES - 1]);
    expect(walkFrameAt(once, stride * 100)).toBe(frames[WALK_FRAMES - 1]);
  });

  it('does not flicker to the end of the cycle on a small negative elapsed', () => {
    // A caller subtracting a start stamp from a clock can hand over a negative on frame one.
    expect(walkFrameAt(cycle, -1)).toBe(frames[WALK_FRAMES - 1]);
    expect(walkFrameAt(cycle, -WALK_FRAME_MS)).toBe(frames[WALK_FRAMES - 1]);
    expect(walkFrameAt(cycle, 0)).toBe(frames[0]);
  });

  it('survives an empty cycle rather than throwing mid-frame', () => {
    expect(walkFrameAt({ frames: [], frameMs: 120, loops: true }, 40)).toBeNull();
  });

  it('asks for enough frames to read as a walk', () => {
    expect(WALK_FRAMES).toBeGreaterThanOrEqual(4);
  });
});
