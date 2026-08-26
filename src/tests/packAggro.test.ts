/**
 * The road that hunts: pack vision, the chase, and the Combat Ring.
 *
 * Imports three, like `districtWalk.test.ts` next door and for the same reason — a `Mesh`,
 * a `RingGeometry` and a `Vector3` are plain objects, and only the renderer wants a
 * context. So these are the real `Pack` and the real `CombatRing`, driven by real frames,
 * rather than a restatement of their arithmetic.
 *
 * The three things worth guarding are the three that fail quietly:
 *
 *  1. suppression — a pack that can see you through pavement makes the walkway a lie;
 *  2. the chase bound — a pack faster than six units a second walks through walls, and
 *     nothing about the symptom would point at the number;
 *  3. the ring's cap — the compensation is priced per pull, so an uncapped ring is an
 *     uncapped promise.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CombatRing, Pack } from '../district/entities.js';
import { ColliderSet } from '../district/collision.js';
import { CHALK_VERGE } from '../district/areas/chalkVerge.js';
import { LOOK } from '../district/look.js';
import { buildActorArt, type ActorArt } from '../district/sprites3d.js';

const img = (tag: string): HTMLImageElement =>
  ({ tag, width: 136, height: 361 }) as unknown as HTMLImageElement;

function art(): ActorArt {
  return buildActorArt(
    {
      front: img('front'),
      back: img('back'),
      side: img('side'),
      sideWalk: [img('w0'), img('w1'), img('w2'), img('w3')],
    },
    1,
  );
}

/** A pack standing on open chalk, with a real collider layer under it. */
function pack(x = 0, z = 0, roam = 6): Pack {
  return new Pack('pack_chalk_scavengers', art(), 1.9, x, z, roam, new ColliderSet(CHALK_VERGE), () => 0.5);
}

/** Runs `seconds` of frames at a fixed step, the way the screen's clamped loop would. */
function run(p: Pack, seconds: number, step = 0.05): void {
  for (let t = 0; t < seconds; t += step) p.update(step, t, 0);
}

describe('a pack notices you', () => {
  it('sees you standing in front of it, off the pavement', () => {
    const p = pack();
    // Facing +z by default, which is where the heading starts.
    p.playerAt.set(0, 0, 3);
    p.playerSafe = false;
    expect(p.sees()).toBe(true);
  });

  it('is blind to you on sanctioned pavement, however close you stand', () => {
    // The whole value of the walkway. Absolute, exactly as the Warden's rule is.
    const p = pack();
    p.playerAt.set(0, 0, 1);
    p.playerSafe = true;
    expect(p.sees()).toBe(false);
  });

  it('is blind to you behind it, and to you far away', () => {
    const behind = pack();
    behind.playerAt.set(0, 0, -3);
    behind.playerSafe = false;
    expect(behind.sees(), 'outside the arc').toBe(false);

    const far = pack();
    far.playerAt.set(0, 0, LOOK.packVisionRange + 4);
    far.playerSafe = false;
    expect(far.sees(), 'outside the range').toBe(false);
  });

  it('closes the distance once it has decided', () => {
    const p = pack();
    p.playerAt.set(0, 0, 5);
    p.playerSafe = false;
    const before = Math.hypot(p.playerAt.x - p.position.x, p.playerAt.z - p.position.z);

    run(p, 1.5);

    const after = Math.hypot(p.playerAt.x - p.position.x, p.playerAt.z - p.position.z);
    expect(p.state).toBe('CHASE');
    expect(after, 'it should have come at you').toBeLessThan(before - 1);
  });

  it('gives up the moment you reach pavement, mid-chase', () => {
    const p = pack();
    p.playerAt.set(0, 0, 4);
    p.playerSafe = false;
    run(p, 0.6);
    expect(p.state).toBe('CHASE');

    // One step onto stone. This is the frame the lesson lands on.
    p.playerSafe = true;
    run(p, 0.2);
    expect(p.state).toBe('ROAM');
  });

  it('holds still when the ring tells it to', () => {
    // The pack that jumped you has to be standing where the circle opened.
    const p = pack();
    const at = { x: p.position.x, z: p.position.z };
    p.holdStill(3);
    run(p, 1.5);
    expect(Math.hypot(p.position.x - at.x, p.position.z - at.z)).toBeLessThan(0.01);
  });

  it('never outruns the collision layer', () => {
    // `collision.ts` proves it cannot tunnel by bounding the fastest mover at six units a
    // second against a frame delta clamped to 0.05 — a step of 0.3, inside the smallest
    // collider radius. This is that proof, asserted rather than commented.
    expect(LOOK.packChaseSpeed).toBeLessThanOrEqual(6);
    expect(LOOK.packChaseSpeed * 0.05).toBeLessThan(0.4);
  });
});

describe('the Combat Ring', () => {
  const ringWith = (packs: Pack[], onDone: (p: string[]) => void = () => {}): CombatRing =>
    new CombatRing(0, 0, packs, onDone);

  it('grows to its full reach over its full duration, and no further', () => {
    const ring = ringWith([]);
    expect(ring.radiusAt(0)).toBe(0);
    expect(ring.radiusAt(CombatRing.DURATION / 2)).toBeCloseTo(CombatRing.RADIUS / 2);
    expect(ring.radiusAt(CombatRing.DURATION)).toBe(CombatRing.RADIUS);
    expect(ring.radiusAt(CombatRing.DURATION * 3), 'clamped').toBe(CombatRing.RADIUS);
  });

  it('catches what is inside it and leaves what is outside', () => {
    const near = pack(2, 0);
    const far = pack(40, 0);
    const ring = ringWith([near, far]);

    for (let t = 0; t < CombatRing.DURATION + 0.2; t += 0.05) ring.update(0.05);

    expect(ring.pulled).toEqual([near.encounterId]);
    expect(near.state, 'a caught pack turns and comes in').toBe('CHASE');
  });

  it('stops at two, and the third keeps roaming', () => {
    // Not queued as a wave three: being jumped by four things at once is a loss with extra
    // steps, and the compensation is priced per pull.
    const a = pack(1, 0);
    const b = pack(0, 1);
    const c = pack(-1, 0);
    for (const [i, p] of [a, b, c].entries()) {
      Object.defineProperty(p, 'encounterId', { value: `pack_${i}` });
    }
    const ring = ringWith([a, b, c]);

    for (let t = 0; t < CombatRing.DURATION + 0.2; t += 0.05) ring.update(0.05);

    expect(ring.pulled).toHaveLength(CombatRing.MAX_PULLS);
    expect(c.state, 'the one it could not take is untouched').toBe('ROAM');
  });

  it('reports once, when it has finished closing', () => {
    let calls = 0;
    let payload: string[] | null = null;
    const near = pack(2, 0);
    const ring = ringWith([near], (pulled) => {
      calls += 1;
      payload = pulled;
    });

    // Half way: still drawing, nothing handed over yet.
    for (let t = 0; t < CombatRing.DURATION / 2; t += 0.05) ring.update(0.05);
    expect(calls).toBe(0);

    for (let t = 0; t < CombatRing.DURATION; t += 0.05) ring.update(0.05);
    expect(calls).toBe(1);
    expect(payload).toEqual([near.encounterId]);

    // And it stays reported: further frames must not fire it again.
    for (let t = 0; t < 1; t += 0.05) ring.update(0.05);
    expect(calls).toBe(1);
  });

  it('hands back an empty list when the road was otherwise quiet', () => {
    // The ordinary case, and it has to be the ordinary case: one mob, no wave, no bonus.
    let payload: string[] | null = null;
    const ring = ringWith([pack(40, 40)], (pulled) => {
      payload = pulled;
    });
    for (let t = 0; t < CombatRing.DURATION + 0.2; t += 0.05) ring.update(0.05);
    expect(payload).toEqual([]);
  });

  it('lies flat on the road', () => {
    // Ground furniture, not a billboard: nothing about a circle on the floor should turn to
    // face the camera.
    const ring = ringWith([]);
    expect(ring.mesh.rotation.x).toBeCloseTo(-Math.PI / 2);
    expect(ring.mesh.position.y).toBeGreaterThan(0);
    expect(ring.mesh.material.blending).toBe(THREE.AdditiveBlending);
  });
});

describe('the Verge is one shared stretch of road', () => {
  it('overlaps every pair of roam circles, so a pull can actually happen', () => {
    // The reason the packs were moved. If this drifts back apart the ring still works and
    // never fires, which is the worst kind of broken: a feature that silently does nothing.
    const specs = CHALK_VERGE.props.packs ?? [];
    expect(specs.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < specs.length; i++) {
      for (let j = i + 1; j < specs.length; j++) {
        const a = specs[i]!;
        const b = specs[j]!;
        const d = Math.hypot(a.x - b.x, a.z - b.z);
        expect(d, `${a.encounterId} and ${b.encounterId} can never meet`).toBeLessThan(
          a.roam + b.roam,
        );
      }
    }
  });

  it('has no pavement to hide on, so the cones never go dark', () => {
    // Stated in the area's own data rather than assumed: `safety: 'none'` is what makes the
    // verge the place this mechanic is demonstrated.
    expect(CHALK_VERGE.safety).toBe('none');
  });
});
