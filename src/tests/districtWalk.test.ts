/**
 * The Commander's walk on the street: which way the body faces, and which frame is up.
 *
 * This one does import three, unlike `district.test.ts` next to it. It can: nothing here
 * needs a GPU — a `Mesh`, a `PlaneGeometry` and a `Texture` are plain objects, and only the
 * renderer wants a context. So the `Walker` under test is the real one, driven by real
 * distances, rather than a restatement of its arithmetic.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  GAIT_CYCLE_DISTANCE,
  SIDE_ART_FACES,
  angleGap,
  holdFacing,
  pickFacing,
  screenAngleDeg,
  SIDE_WALK_ORDER,
  Walker,
  buildActorArt,
  disposeActorArt,
  type ActorArt,
} from '../district/sprites3d.js';

/** A stand-in image. `spriteTexture` only ever wraps it. */
const img = (tag: string): HTMLImageElement =>
  ({ tag, width: 136, height: 361 }) as unknown as HTMLImageElement;

/** The four authored frames, plus front/back, as `buildActorArt` wants them. */
function heroArt(frameCount = 4): ActorArt {
  return buildActorArt(
    {
      front: img('front'),
      back: img('back'),
      side: img('side'),
      sideWalk: Array.from({ length: frameCount }, (_u, n) => img(`walk-${n}`)),
    },
    1,
  );
}

/** Which authored frame a texture came from, by the tag on its stand-in image. */
const tagOf = (tex: THREE.Texture | null): string =>
  (tex?.image as { tag?: string } | undefined)?.tag ?? '?';

const shown = (w: Walker): string => tagOf(w.sprite.material.map);

/**
 * Which way the body is turned, as the sign of its X scale.
 *
 * The magnitude is the plane's width now — it follows the picture's own proportions — so the
 * mirror is the sign of that number rather than a bare -1.
 */
const turn = (w: Walker): number => Math.sign(w.sprite.scale.x);

/** Walk east in a straight line, sampling the frame at each step. */
function sample(w: Walker, distance: number, steps: number): string[] {
  const out: string[] = [];
  const dx = distance / steps;
  for (let i = 0; i < steps; i++) {
    w.step(dx, 0, 0);
    out.push(shown(w));
  }
  return out;
}

describe('which way the Commander faces', () => {
  it('knows the side art is drawn facing left', () => {
    // Every side-on frame on disk faces left. If that ever changes, this constant is the
    // edit, and these expectations are what will fail first.
    expect(SIDE_ART_FACES).toBe('left');
  });

  it('does not mirror when walking the way the art already faces', () => {
    const w = new Walker(heroArt(), 2.1);
    w.step(-1, 0, 0); // screen-left
    expect(turn(w)).toBe(1);
  });

  it('mirrors only for the opposite bearing', () => {
    const w = new Walker(heroArt(), 2.1);
    w.step(1, 0, 0); // screen-right
    expect(turn(w)).toBe(-1);
  });

  it('leaves the front and back frames unmirrored', () => {
    // Mirroring a face-on body is a subtly different person, not a turned one.
    const w = new Walker(heroArt(), 2.1);
    w.step(1, 0, 0);
    expect(turn(w)).toBe(-1);
    w.step(0, 1, 0); // toward the camera
    expect(turn(w)).toBe(1);
    w.step(0, -1, 0); // away
    expect(turn(w)).toBe(1);
  });

  it('turns on the spot without mirroring the wrong way', () => {
    const w = new Walker(heroArt(), 2.1);
    w.face('right');
    expect(turn(w)).toBe(-1);
    w.face('left');
    expect(turn(w)).toBe(1);
  });
});

describe('facing on a diagonal', () => {
  /**
   * The diagonal is not a near-miss, it is an exact tie — and no camera angle escapes it.
   *
   * Movement is camera-relative and `pickFacing` projects back onto the same camera axes, so
   * the two cancel: W+D is 135 degrees on screen at every yaw there is. That is the exact
   * line between the sector that draws the back and the sector that draws the side, so which
   * one wins is decided by the last bit of a float.
   */
  it('is an exact tie at every camera angle', () => {
    for (const yaw of [0, 0.3, Math.PI / 4, 1.2, 2.5, -0.9]) {
      const fwdX = -Math.sin(yaw);
      const fwdZ = -Math.cos(yaw);
      const rightX = Math.cos(yaw);
      const rightZ = -Math.sin(yaw);
      const mx = fwdX + rightX; // W + D
      const mz = fwdZ + rightZ;
      expect(screenAngleDeg(mx, mz, yaw)).toBeCloseTo(135, 9);
    }
  });

  it('measures the gap between two bearings the short way round', () => {
    // This was wrong first time and froze the Commander facing the camera: a 135-degree gap
    // came back as 45, which never cleared the switching margin, so the facing never changed.
    expect(angleGap(135, 0)).toBeCloseTo(135, 9);
    expect(angleGap(0, 135)).toBeCloseTo(135, 9);
    expect(angleGap(350, 10)).toBeCloseTo(20, 9); // across the wrap
    expect(angleGap(10, 350)).toBeCloseTo(20, 9);
    expect(angleGap(90, 90)).toBeCloseTo(0, 9);
    expect(angleGap(0, 180)).toBeCloseTo(180, 9);
  });

  it('holds whichever facing it already had when the direction sits on the line', () => {
    // Both answers are equally wrong at 135; the point is only that it stops changing.
    const upRight = { mx: 1, mz: -1 };
    expect(holdFacing(upRight.mx, upRight.mz, 0, 'up')).toBe('up');
    expect(holdFacing(upRight.mx, upRight.mz, 0, 'right')).toBe('right');
  });

  it('gives way once the direction is clearly past the line', () => {
    // 20 degrees beyond the boundary clears a 15-degree margin; 5 degrees does not.
    const at = (deg: number): { mx: number; mz: number } => {
      const r = (deg * Math.PI) / 180;
      return { mx: Math.sin(r), mz: -Math.cos(r) }; // 0 = away, 90 = screen right
    };
    const nearlyRight = at(65); // 25 past the 90-degree centre, 25 short of the 135 line
    expect(holdFacing(nearlyRight.mx, nearlyRight.mz, 0, 'up')).toBe('right');
    const justPast = at(50); // 130 from 'up' centre — inside the margin, so 'up' keeps it
    expect(holdFacing(justPast.mx, justPast.mz, 0, 'up')).toBe('up');
  });

  it('never delays a cardinal, which is the whole point of holding the diagonal', () => {
    // A body walking dead away or dead sideways is unambiguous and must turn at once,
    // whatever it was showing before.
    expect(holdFacing(0, -1, 0, 'right')).toBe('up');
    expect(holdFacing(0, 1, 0, 'up')).toBe('down');
    expect(holdFacing(1, 0, 0, 'up')).toBe('right');
    expect(holdFacing(-1, 0, 0, 'right')).toBe('left');
  });

  it('agrees with the plain picker everywhere except the contested band', () => {
    for (let deg = 0; deg < 360; deg += 1) {
      const r = (deg * Math.PI) / 180;
      const mx = Math.sin(r);
      const mz = -Math.cos(r);
      const plain = pickFacing(mx, mz, 0);
      const held = holdFacing(mx, mz, 0, plain);
      // Handed its own answer as the incumbent, hysteresis must never disagree with it.
      expect(held).toBe(plain);
    }
  });
});

describe('the walk cycle', () => {
  /**
   * Foot separation at the ground line, measured off the art itself. Frames 0 and 2 are
   * strides, frame 1 is the pass — and frame 3 is a third stride, which is the whole reason
   * `SIDE_WALK_ORDER` exists.
   */
  const FOOT_GAP: Record<string, number> = {
    'walk-0': 35,
    'walk-1': 10,
    'walk-2': 31,
    'walk-3': 34,
  };
  const isPass = (tag: string): boolean => (FOOT_GAP[tag] ?? 99) < 20;

  it('skips the frame that is not a passing pose', () => {
    expect(SIDE_WALK_ORDER).toEqual([0, 1, 2, 1]);
    expect(SIDE_WALK_ORDER).not.toContain(3);
  });

  it('alternates stride and pass, which the authored order does not', () => {
    const played = SIDE_WALK_ORDER.map((i) => `walk-${i}`);
    expect(played.map(isPass)).toEqual([false, true, false, true]);

    // The same check against the frames in file order, to pin down what was wrong with it:
    // two strides run back to back and the second half of the cycle never passes.
    const authored = [0, 1, 2, 3].map((i) => `walk-${i}`);
    expect(authored.map(isPass)).toEqual([false, true, false, false]);
  });

  it('shows every frame of the cycle across one gait', () => {
    const w = new Walker(heroArt(), 2.1);
    const seen = new Set(sample(w, GAIT_CYCLE_DISTANCE, 64));
    expect([...seen].sort()).toEqual(['walk-0', 'walk-1', 'walk-2']);
  });

  it('runs the cycle once per gait distance, not once per frame', () => {
    const w = new Walker(heroArt(), 2.1);
    // Two full gaits: the sequence should repeat exactly, pass included.
    const first = sample(w, GAIT_CYCLE_DISTANCE, 8);
    const second = sample(w, GAIT_CYCLE_DISTANCE, 8);
    expect(second).toEqual(first);
    expect(first.filter(isPass)).toHaveLength(4); // two of the four entries are the pass
  });

  it('keeps the cadence when there are fewer frames to play', () => {
    // The two-pose fallback covers the same ground per cycle as the four-entry one, so a
    // checkout without the walk art walks at the same speed rather than twice as fast.
    //
    // Probed by walking a fresh body one exact distance, rather than by comparing two
    // stretches of a sampled walk — the sample grid need not land on a cycle boundary, and
    // an off-by-one there says nothing about the cadence.
    const frameAfter = (art: ActorArt, distance: number): string => {
      const w = new Walker(art, 2.1);
      w.step(distance, 0, 0);
      return shown(w);
    };
    for (const frames of [4, 2]) {
      const art = heroArt(frames);
      for (const d of [0.1, 0.6, 1.1, 1.7]) {
        expect(frameAfter(art, d + GAIT_CYCLE_DISTANCE)).toBe(frameAfter(art, d));
      }
    }
  });

  it('plays a short frame set in file order rather than mangling it', () => {
    // `SIDE_WALK_ORDER` names frame 2, which a two-frame set does not have. Filtering the
    // order down would drop a frame and double another; file order is the honest fallback.
    const art = heroArt(2);
    expect(art.sideWalk.map((t) => tagOf(t))).toEqual(['walk-0', 'walk-1']);
  });

  it('arranges the four authored frames into playback order', () => {
    expect(heroArt(4).sideWalk.map((t) => tagOf(t))).toEqual([
      'walk-0',
      'walk-1',
      'walk-2',
      'walk-1',
    ]);
  });

  it('uploads a reused frame once and plays it by reference', () => {
    const art = heroArt(4);
    expect(art.sideWalk[1]).toBe(art.sideWalk[3]);
  });

  it('holds a frame while standing still, and restarts the cycle from the plant', () => {
    const w = new Walker(heroArt(), 2.1);
    sample(w, GAIT_CYCLE_DISTANCE * 0.4, 4);
    w.step(0, 0, 0);
    const standing = shown(w);
    w.step(0, 0, 0);
    expect(shown(w)).toBe(standing);
    // Next step starts the cycle over rather than resuming mid-stride.
    w.step(0.01, 0, 0);
    expect(shown(w)).toBe('walk-0');
  });

  it('falls back to the standing profile for a body with no walk art', () => {
    const beast = buildActorArt({ front: img('c-front'), back: img('c-back'), side: img('c-side') }, 1);
    expect(beast.sideWalk).toEqual([]);
    const w = new Walker(beast, 1.5);
    expect(sample(w, GAIT_CYCLE_DISTANCE, 8)).toEqual(Array(8).fill('c-side'));
  });

  it('runs at a cadence a walk can be read at', () => {
    // The complaint that prompted this was chop, and chop is a frame rate. At the ward's six
    // units a second, the cycle distance decides it: this asserts the resulting frame is on
    // screen long enough to be seen as a pose rather than a flicker. 1.8 gave 75ms, which is
    // roughly twice too fast to read with only three distinct drawings to show.
    const MOVE_SPEED = 6;
    const secondsPerCycle = GAIT_CYCLE_DISTANCE / MOVE_SPEED;
    const msPerFrame = (secondsPerCycle * 1000) / SIDE_WALK_ORDER.length;
    expect(msPerFrame).toBeGreaterThanOrEqual(120);
    expect(msPerFrame).toBeLessThanOrEqual(220);
  });

  it('lifts the body between footfalls and sets it down on them', () => {
    const w = new Walker(heroArt(), 2.1);
    const bobAfter = (d: number): number => {
      const fresh = new Walker(heroArt(), 2.1);
      fresh.step(d, 0, 0);
      return fresh.bob;
    };
    // Peaks land on the two passing poses, troughs on the two strides, so the rise
    // reinforces the frame cycle rather than beating against it.
    expect(bobAfter(GAIT_CYCLE_DISTANCE * 0.25)).toBeGreaterThan(0);
    expect(bobAfter(GAIT_CYCLE_DISTANCE * 0.75)).toBeGreaterThan(0);
    expect(bobAfter(GAIT_CYCLE_DISTANCE * 0.5)).toBeCloseTo(0, 6);
    expect(bobAfter(GAIT_CYCLE_DISTANCE)).toBeCloseTo(0, 6);
    expect(w.bob).toBe(0); // untouched: standing still
  });

  it('never sinks the body below the pavement', () => {
    const w = new Walker(heroArt(), 2.1);
    for (let i = 0; i < 200; i++) {
      w.step(0.06, 0, 0);
      expect(w.bob).toBeGreaterThanOrEqual(0);
      expect(w.sprite.position.y).toBeCloseTo(w.bob, 9);
    }
  });

  it('keeps the rise subtle, and in proportion to the body', () => {
    const tall = new Walker(heroArt(), 2.1);
    const small = new Walker(heroArt(), 1.5);
    tall.step(GAIT_CYCLE_DISTANCE * 0.25, 0, 0);
    small.step(GAIT_CYCLE_DISTANCE * 0.25, 0, 0);
    expect(tall.bob / 2.1).toBeCloseTo(small.bob / 1.5, 9);
    expect(tall.bob).toBeLessThan(2.1 * 0.04);
  });

  it('bobs a body that has no walk frames at all', () => {
    // The companion slides otherwise: with nothing to swap, the rise is the only thing
    // saying it is moving under its own legs.
    const beast = buildActorArt({ front: img('c-front'), back: img('c-back'), side: img('c-side') }, 1);
    const w = new Walker(beast, 1.5);
    w.step(GAIT_CYCLE_DISTANCE * 0.25, 0, 0);
    expect(w.bob).toBeGreaterThan(0);
  });

  it('drops flat the moment it stops, leaving idle bobs a clear field', () => {
    const w = new Walker(heroArt(), 2.1);
    w.step(GAIT_CYCLE_DISTANCE * 0.25, 0, 0);
    expect(w.sprite.position.y).toBeGreaterThan(0);
    w.step(0, 0, 0);
    expect(w.sprite.position.y).toBe(0);
  });

  it('advances a two-cycle sheet twice as fast through its list', () => {
    // Twenty frames holding two gait cycles must show ten of them per cycle. Read as one
    // cycle they would swing at half the speed of the ground.
    const sheetArt = buildActorArt(
      {
        front: img('front'),
        back: img('back'),
        side: img('side'),
        sideWalk: Array.from({ length: 20 }, (_u, n) => img(`s${n}`)),
        walkGaitCycles: 2,
      },
      1,
    );
    expect(sheetArt.walkGaitCycles).toBe(2);
    // Twenty frames are not reorderable by SIDE_WALK_ORDER's indices alone, so they play in
    // file order — which is what a sheet wants.
    expect(sheetArt.sideWalk).toHaveLength(20);

    const at = (d: number): string => {
      const w = new Walker(sheetArt, 2.1);
      w.step(d, 0, 0);
      return shown(w);
    };
    expect(at(0.001)).toBe('s0');
    // Half the list consumed by one gait cycle.
    expect(at(GAIT_CYCLE_DISTANCE * 0.999)).toBe('s9');
    expect(at(GAIT_CYCLE_DISTANCE)).toBe('s10');
    // The whole list over two, then back to the start.
    expect(at(GAIT_CYCLE_DISTANCE * 2)).toBe('s0');
  });

  it('sizes the plane from the picture, not from the front frame', () => {
    // A body is narrower from the side than from the front. One plane cut to the front's
    // proportions stretched the side-on Commander 45% wide; the width now follows whatever
    // texture is showing.
    const wide = ({ tag: 'front', width: 110, height: 253 }) as unknown as HTMLImageElement;
    const narrow = ({ tag: 'side', width: 76, height: 253 }) as unknown as HTMLImageElement;
    const art = buildActorArt({ front: wide, back: wide, side: narrow }, 1);
    const w = new Walker(art, 2.1);

    w.step(0, 1, 0); // facing the camera
    expect(Math.abs(w.sprite.scale.x)).toBeCloseTo(2.1 * (110 / 253), 6);
    w.step(-1, 0, 0); // turned side-on
    expect(Math.abs(w.sprite.scale.x)).toBeCloseTo(2.1 * (76 / 253), 6);
  });

  it('keeps the feet on the ground whatever the plane is scaled to', () => {
    // The geometry spans 0..1 and is scaled, so the bottom edge stays on `position.y` — the
    // one thing every caller relies on when it puts a body somewhere.
    const w = new Walker(heroArt(), 2.1);
    w.sprite.position.set(3, 0, 4);
    w.step(1, 0, 0);
    w.sprite.geometry.computeBoundingBox();
    expect(w.sprite.geometry.boundingBox!.min.y).toBeCloseTo(0, 9);
    expect(w.sprite.geometry.boundingBox!.max.y).toBeCloseTo(1, 9);
  });

  it('releases a reused frame exactly once', () => {
    const art = heroArt(4);
    let disposals = 0;
    for (const tex of new Set([art.front, art.back, art.side, ...art.sideWalk])) {
      tex.addEventListener('dispose', () => disposals++);
    }
    disposeActorArt(art);
    // front, back, side, and the three distinct walk frames — six, not seven.
    expect(disposals).toBe(6);
  });
});
