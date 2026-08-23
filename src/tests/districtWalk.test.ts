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
    expect(w.sprite.scale.x).toBe(1);
  });

  it('mirrors only for the opposite bearing', () => {
    const w = new Walker(heroArt(), 2.1);
    w.step(1, 0, 0); // screen-right
    expect(w.sprite.scale.x).toBe(-1);
  });

  it('leaves the front and back frames unmirrored', () => {
    // Mirroring a face-on body is a subtly different person, not a turned one.
    const w = new Walker(heroArt(), 2.1);
    w.step(1, 0, 0);
    expect(w.sprite.scale.x).toBe(-1);
    w.step(0, 1, 0); // toward the camera
    expect(w.sprite.scale.x).toBe(1);
    w.step(0, -1, 0); // away
    expect(w.sprite.scale.x).toBe(1);
  });

  it('turns on the spot without mirroring the wrong way', () => {
    const w = new Walker(heroArt(), 2.1);
    w.face('right');
    expect(w.sprite.scale.x).toBe(-1);
    w.face('left');
    expect(w.sprite.scale.x).toBe(1);
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
