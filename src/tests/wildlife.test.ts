/**
 * The animals: that they wander, that they break away from you, and that they cannot walk
 * through a wall doing it.
 *
 * Real `Critter`s driven by real frames, the way `packAggro.test.ts` next door drives real
 * `Pack`s and for the same reason — a `Vector3` and a `ColliderSet` are plain objects, and only
 * the renderer wants a context. A restatement of the arithmetic here would pass while the thing
 * itself stood still.
 *
 * Three things are worth guarding, and they are the three that fail quietly:
 *
 *  1. **The flush.** It is the only behaviour in the system the player can cause, and the whole
 *     difference between a world with animals in it and a world with animated scenery in it. A
 *     critter that stopped reacting would look exactly like one that was working.
 *  2. **The speed bound.** `Critter` moves at double its kind's speed while bolting, which is
 *     the number `collision.ts`'s anti-tunnelling proof actually has to hold against — and it
 *     bolts *away from the player*, which is precisely the direction a wall is most likely to
 *     be. A hare through a hedge would be blamed on the hedge.
 *  3. **Flight.** A flying kind ignores the collider set on purpose. That is a deliberate
 *     exemption from the rule above and it should be impossible to grant by accident.
 */

import { describe, expect, it } from 'vitest';
import { Critter } from '../district/entities.js';
import { CRITTERS, CRITTER_IDS, type CritterId } from '../district/wildlife.js';
import { ColliderSet } from '../district/collision.js';
import { CHALK_VERGE, AREAS } from '../district/areas/index.js';
import { applySway, buildActorArt, setWindTime, type ActorArt } from '../district/sprites3d.js';
import { SWAYS } from '../district/dressing.js';
import * as THREE from 'three';

const img = (tag: string): HTMLImageElement =>
  ({ tag, width: 16, height: 12 }) as unknown as HTMLImageElement;

function art(): ActorArt {
  return buildActorArt({ front: img('f'), back: img('b'), side: img('s') }, 1);
}

/**
 * A seeded roll, and it has to actually vary.
 *
 * `packAggro.test.ts` next door gets away with `() => 0.5` because a `Pack` spends most of its
 * life in states that do not consult it. A `Critter` does nothing else: `pickTarget` takes twelve
 * attempts at a random bearing, and under a constant roll those are twelve attempts at the *same
 * bearing* -- so if that one point is blocked, all twelve fail, it falls back to its home, and
 * the animal stands perfectly still forever. Which is what the first run of this file showed,
 * and it took a while to believe it was the fixture rather than the code.
 */
function rolls(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A spot on the Verge with room around it in every direction.
 *
 * Not a nicety. The first draft of the flush tests put the hare at the origin, which happens to
 * have a hedge a few units west of it — so the animal bolted straight into a collider, went
 * nowhere, and three tests read that as "the flush is broken". It was not: being stopped by a
 * wall while fleeing is the *other* thing this file is here to prove. A behavioural test has to
 * be given somewhere the behaviour can actually happen.
 */
function openSpot(): { x: number; z: number } {
  const cs = new ColliderSet(CHALK_VERGE);
  for (let r = 2; r < CHALK_VERGE.rows - 2; r++) {
    for (let c = 2; c < CHALK_VERGE.cols - 2; c++) {
      const x = c * 4 - CHALK_VERGE.halfX + 2;
      const z = r * 4 - CHALK_VERGE.halfZ + 2;
      const clearAround = [-8, -4, 0, 4, 8].every((dx) =>
        [-8, -4, 0, 4, 8].every((dz) => !cs.blocked(x + dx, z + dz, 0.3)),
      );
      if (clearAround) return { x, z };
    }
  }
  throw new Error('the Chalk Verge has no open ground, which cannot be true');
}

/** One animal on open chalk, with a real collider layer under it. */
function critter(kind: CritterId, x = 0, z = 0, roam = 8): Critter {
  return new Critter(kind, art(), x, z, roam, new ColliderSet(CHALK_VERGE), rolls(9001));
}

/** Runs `seconds` of frames at the clamped step the screen's loop actually uses. */
function run(c: Critter, seconds: number, step = 0.05): void {
  for (let t = 0; t < seconds; t += step) c.update(step, t, 0);
}

const flat = (c: Critter): { x: number; z: number } => ({ x: c.position.x, z: c.position.z });
const gap = (a: { x: number; z: number }, b: { x: number; z: number }): number =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('an animal goes about its business', () => {
  it('does not stand where it was put', () => {
    const c = critter('hare');
    // Parked well out of its tolerance, so nothing below is the flush in disguise.
    c.playerAt.set(60, 0, 60);
    run(c, 12);
    expect(gap(flat(c), { x: 0, z: 0 }), 'it has been somewhere').toBeGreaterThan(1);
  });

  it('stays on its own patch', () => {
    // The radius is the whole of the containment: nothing else stops an animal walking to the
    // far end of the Ashwood, and a deer that arrived at the crossing would be a deer nobody
    // put there. Generous, because a bolt legitimately carries it past the edge and it makes
    // wherever it lands its new home.
    const c = critter('fox', 0, 0, 6);
    c.playerAt.set(60, 0, 60);
    run(c, 60);
    expect(gap(flat(c), { x: 0, z: 0 })).toBeLessThan(20);
  });

  it('pauses between legs rather than pacing', () => {
    // A creature that never stops reads as a patrol. Sampled rather than asserted directly:
    // over half a minute a grazing animal should be still for a decent share of the frames.
    const c = critter('sheep', 0, 0, 6);
    c.playerAt.set(60, 0, 60);
    let still = 0;
    let frames = 0;
    for (let t = 0; t < 40; t += 0.05) {
      const was = flat(c);
      c.update(0.05, t, 0);
      if (gap(flat(c), was) < 1e-6) still++;
      frames++;
    }
    expect(still / frames, 'a sheep spends most of its time not moving').toBeGreaterThan(0.4);
  });
});

describe('the flush, which is the whole point', () => {
  it('breaks away when you come close', () => {
    const c = critter('hare', 0, 0, 10);
    c.playerAt.set(60, 0, 60);
    run(c, 3);

    // Walk up to it, inside a hare's eight units.
    const before = flat(c);
    c.playerAt.set(before.x + 3, 0, before.z);
    run(c, 1.2);

    const after = flat(c);
    expect(gap(after, { x: before.x + 3, z: before.z }), 'further away than it was').toBeGreaterThan(
      3,
    );
  });

  it('keeps going away from where you are now, not where you were', () => {
    // Recomputed every frame on purpose: a bolt aimed once at the spot the player occupied when
    // it started will happily run *past* somebody who is walking after it.
    const home = openSpot();
    const c = critter('hare', home.x, home.z, 12);
    c.playerAt.set(home.x + 3, 0, home.z);
    for (let t = 0; t < 1.2; t += 0.05) {
      c.update(0.05, t, 0);
      // Chasing it: the player keeps three units behind wherever it has got to.
      c.playerAt.set(c.position.x + 3, 0, c.position.z);
    }
    expect(gap(flat(c), home), 'it kept running').toBeGreaterThan(4);
  });

  it('settles again, and does not run back through you', () => {
    const home = openSpot();
    const c = critter('hare', home.x, home.z, 14);
    c.playerAt.set(home.x + 3, 0, home.z);
    run(c, 1.6);
    const fled = flat(c);
    // The player stays put. Its new home is wherever it ended up, so nothing drags it back --
    // which is the one thing a bolt must never do, and what a naive `pickTarget` off the
    // original home would have made it do immediately.
    run(c, 8);
    expect(gap(flat(c), { x: home.x + 3, z: home.z }), 'still clear of the player').toBeGreaterThan(2);
    expect(gap(flat(c), fled), 'and back to wandering rather than frozen').toBeGreaterThan(0.5);
  });

  it('is not startled at all by something with no tolerance', () => {
    // The wolf. One animal in the world that does not run from you is worth more than another
    // six that scatter, and `flush: 0` is how that is said. Standing on top of it changes
    // nothing about what it does.
    const c = critter('wolf', 0, 0, 6);
    c.playerAt.set(0.2, 0, 0.2);
    let ran = 0;
    for (let t = 0; t < 6; t += 0.05) {
      const was = flat(c);
      c.update(0.05, t, 0);
      // A bolt covers twice the kind's speed; a wander covers exactly it. Anything faster than
      // the wander over one frame is the flush firing.
      if (gap(flat(c), was) > CRITTERS.wolf.speed * 0.05 * 1.2) ran++;
      c.playerAt.set(c.position.x + 0.2, 0, c.position.z + 0.2);
    }
    expect(ran, 'the wolf never bolted').toBe(0);
  });
});

describe('what an animal may and may not walk through', () => {
  it('is stopped by a wall, even at a full bolt', () => {
    // The bound is `speed * 2` against a `dt` clamped to 0.05, and a bolt runs *away from the
    // player* -- which is exactly the direction the wall is in when somebody has cornered it.
    // Driven against the Verge's own colliders rather than a stub, so this is the real layer.
    const colliders = new ColliderSet(CHALK_VERGE);
    const area = CHALK_VERGE;
    // Somewhere on the map with a blocked tile nearby to be pushed into.
    let seeded: { x: number; z: number } | null = null;
    for (let r = 1; r < area.rows - 1 && !seeded; r++) {
      for (let c = 1; c < area.cols - 1; c++) {
        const x = c * 4 - area.halfX + 2;
        const z = r * 4 - area.halfZ + 2;
        if (!colliders.blocked(x, z, 0.3) && colliders.blocked(x + 4, z, 0.3)) {
          seeded = { x, z };
          break;
        }
      }
    }
    expect(seeded, 'the Verge has somewhere to be cornered').not.toBeNull();

    const c = new Critter('hare', art(), seeded!.x, seeded!.z, 6, colliders, rolls(4242));
    // Player on the open side, so the bolt is straight at the blocked one.
    for (let t = 0; t < 4; t += 0.05) {
      c.playerAt.set(c.position.x - 2, 0, c.position.z);
      c.update(0.05, t, 0);
      expect(
        colliders.blocked(c.position.x, c.position.z, 0.3),
        `a hare ended up inside a wall at ${c.position.x},${c.position.z}`,
      ).toBe(false);
    }
  });

  it('lets a bird through it, which is the exemption', () => {
    // A rook that had to path round a chimney would spend the ward circling its one clear
    // corner. This is what `flies` buys, stated so that granting it by accident is a test
    // failure rather than a bird stuck on a roof.
    const colliders = new ColliderSet(CHALK_VERGE);
    const c = new Critter('rook', art(), 0, 0, 30, colliders, rolls(77));
    c.playerAt.set(0, 0, 0);
    run(c, 30);
    expect(c.position.y, 'and it is up there rather than on the ground').toBeGreaterThan(5);
  });

  it('holds every flying kind at its own altitude', () => {
    for (const id of CRITTER_IDS.filter((k) => CRITTERS[k].flies)) {
      const c = critter(id, 0, 0, 20);
      c.playerAt.set(0, 0, 0);
      run(c, 5);
      const alt = CRITTERS[id].altitude ?? 8;
      // A slow rise and fall about it, which is what stops a flight reading as a decal slid
      // across the sky. The bob is under a unit, so this is tight.
      expect(Math.abs(c.position.y - alt), `${id} drifted off its altitude`).toBeLessThan(1.2);
    }
  });

  it('keeps every kind with legs on the floor', () => {
    // Not exactly zero: `Walker.step` writes the walking bob into the same `y`, and that bob is
    // wanted -- it is what makes a fox trot rather than glide. What is being asserted is that a
    // ground animal never acquires an *altitude*, which is a different quantity by an order of
    // magnitude: the tallest thing here is a deer at 1.5, and its gait lifts it by hundredths.
    for (const id of CRITTER_IDS.filter((k) => !CRITTERS[k].flies)) {
      const c = critter(id, 0, 0, 6);
      c.playerAt.set(60, 0, 60);
      run(c, 4);
      expect(c.position.y, `${id} is off the ground`).toBeLessThan(0.3);
    }
  });
});

describe('off the street while a board stands on it', () => {
  it('goes, and comes back', () => {
    // The same rule the packs follow, and for a milder version of the same reason: a hare
    // wandering through a tactical grid is the loudest possible statement that the board is
    // pasted onto a world still going about its business.
    const c = critter('hare');
    expect(c.walker.sprite.visible).toBe(true);
    c.setVisible(false);
    expect(c.walker.sprite.visible).toBe(false);
    c.setVisible(true);
    expect(c.walker.sprite.visible).toBe(true);
  });
});

describe('the bestiary, as data', () => {
  it('gives everything with legs a speed the collider layer can hold', () => {
    for (const id of CRITTER_IDS) {
      const k = CRITTERS[id];
      if (k.flies) continue;
      expect(k.speed, `${id} is fast enough to tunnel`).toBeLessThanOrEqual(3.5);
    }
  });

  it('gives everything that flies an altitude to fly at', () => {
    for (const id of CRITTER_IDS) {
      const k = CRITTERS[id];
      if (!k.flies) continue;
      expect(k.altitude, `${id} flies at ground level`).toBeGreaterThan(1);
    }
  });

  it('keeps at least one animal that does not run, because that is a design statement', () => {
    const stoic = CRITTER_IDS.filter((id) => !CRITTERS[id].flies && CRITTERS[id].flush === 0);
    expect(stoic.length, 'something on the ground stands its ground').toBeGreaterThan(0);
  });

  it('puts something in every one of the seven areas nobody lives in', () => {
    // The atlas says nobody *lives* out there. It does not say the largest maps in the game
    // are empty, and until this pass they were.
    const wild = ['chalk_verge', 'chalk_road', 'caldera', 'ashwood', 'rimefields', 'storm_shelf', 'bone_bastion'];
    for (const id of wild) {
      const area = AREAS.find((a) => a.id === id)!;
      expect((area.props.wildlife ?? []).length, `${id} has nothing in it`).toBeGreaterThan(0);
    }
  });
});

describe('the wind, and the one number that has to be normalised', () => {
  /** Runs a patched material's `onBeforeCompile` and hands back what the shader ended up as. */
  function compile(amount: number, height?: number): { uniforms: Record<string, { value: unknown }>; vertexShader: string } {
    const mat = new THREE.MeshLambertMaterial();
    if (height === undefined) applySway(mat, amount);
    else applySway(mat, amount, height);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      // Newlines are irrelevant here: `applySway` patches by plain substring replace, so a
      // one-line stand-in exercises exactly the same code path as a real compiled shader.
      vertexShader: '#include <common> void main() { #include <begin_vertex> }',
      fragmentShader: '',
    };
    mat.onBeforeCompile!(shader as never, null as never);
    return shader;
  }

  it('takes the plane height, and defaults to a unit plane', () => {
    // `BillboardSprite` is a 1x1 plane sized by `scale`, so its `position.y` runs 0..1 and the
    // default is right for it. A `panel` is built at full size, so its `position.y` runs 0..size
    // -- and the first version of this squared *that*, which gave a size-3 awning a lean of nine
    // and a swing of most of a metre. Nothing about the symptom pointed at the exponent.
    expect(compile(0.05).uniforms.uTall!.value).toBe(1);
    expect(compile(0.09, 3).uniforms.uTall!.value).toBe(3);
  });

  it('divides by it rather than trusting the geometry', () => {
    const { vertexShader } = compile(0.09, 3);
    expect(vertexShader, 'the lean is normalised').toContain('position.y / uTall');
    expect(vertexShader, 'and pinned at the base').toContain('transformed.x += swayAmt * uSway * swayLean;');
  });

  it('refuses a zero height, which would divide the world by nothing', () => {
    const value = compile(0.05, 0).uniforms.uTall!.value as number;
    expect(value).toBeGreaterThan(0);
  });

  it('hands every swaying thing the same clock', () => {
    // One shared uniform object rather than one per sprite, which is what keeps a field of reeds
    // in the *same wind*. Each running its own clock reads as malfunction rather than breeze.
    const a = compile(0.05);
    const b = compile(0.05);
    expect(a.uniforms.uWind).toBe(b.uniforms.uWind);
    setWindTime(12.5);
    expect(a.uniforms.uWind!.value).toBe(12.5);
    expect(b.uniforms.uWind!.value, 'both, from one write').toBe(12.5);
  });

  it('sways the things that grow and nothing with mass', () => {
    // Per kind rather than per form, the same call `collides` makes. A swaying barrel is a
    // barrel nobody stacked properly.
    for (const id of ['reeds', 'bracken', 'wildflowers', 'bramble'] as const) {
      expect(SWAYS.has(id), `${id} should move`).toBe(true);
    }
    for (const id of ['barrel', 'sacks', 'haybale', 'cart', 'well', 'cairn'] as const) {
      expect(SWAYS.has(id), `${id} should not`).toBe(false);
    }
  });
});
